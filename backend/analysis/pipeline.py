# =============================================================
# backend/analysis/pipeline.py
#
# WHAT THIS FILE DOES:
#   Orchestrates the full analysis pipeline:
#   audio file → Whisper → Librosa → spaCy → Claude → report
#
# WHAT YOU LEARN HERE:
#   - How to orchestrate multiple async services
#   - Why we run independent tasks concurrently with asyncio
#   - How to save structured data to Supabase
#   - Error isolation (one stage failing doesn't break others)
#
# THE ORCHESTRATOR PATTERN:
#   Each service (Whisper, Librosa, spaCy, Claude) does ONE thing.
#   This pipeline.py connects them in the right order.
#   It's the conductor of an orchestra — it doesn't play an
#   instrument, it coordinates who plays when.
# =============================================================

import asyncio
import json
import logging
import tempfile
import os
from dataclasses import asdict
from typing import Optional

from analysis.whisper_service  import whisper_service,  TranscriptResult
from analysis.acoustic_service import acoustic_service, AcousticResult
from analysis.nlp_service      import nlp_service,      NLPResult
from analysis.coaching_service import coaching_service, CoachingReport

logger = logging.getLogger(__name__)


async def run_analysis_pipeline(
    session_id:  str,
    audio_bytes: bytes,
    topic:       str,
    user_profile: Optional[dict] = None,
    session_number: int = 1,
    user_id: Optional[str] = None
) -> Optional[CoachingReport]:
    """
    Run the full analysis pipeline on a recorded session.

    FLOW:
    1. Whisper transcribes the audio (async, network call)
    2. Librosa + spaCy analyze in parallel (CPU, thread pool)
    3. Claude generates coaching from all results (async, network)
    4. Save everything to Supabase

    PARAMETERS:
        session_id:     UUID of the session row in Supabase
        audio_bytes:    raw audio data from the upload
        topic:          the topic the user spoke about
        user_profile:   user's history for personalization
        session_number: which session number this is

    RETURNS:
        CoachingReport if successful, None if catastrophic failure
    """

    logger.info(f"[Pipeline] Starting analysis for session {session_id[:8]}...")

    try:
        # ----------------------------------------------------------
        # STAGE 1: Transcription (Whisper)
        #
        # This MUST run first because:
        # - spaCy needs the transcript text
        # - Coaching needs the transcript
        # - WPM calculation needs word_count from Whisper
        #
        # We write audio to a temp file because Whisper needs a path.
        # ----------------------------------------------------------
        transcript_result: Optional[TranscriptResult] = None

        try:
            logger.info(f"[Pipeline] Stage 1: Whisper transcription...")
            transcript_result = await whisper_service.transcribe_from_bytes(
                audio_bytes=audio_bytes,
                filename="recording.webm"
            )

            if transcript_result:
                logger.info(
                    f"[Pipeline] Transcription complete: "
                    f"{transcript_result.word_count} words"
                )
            else:
                logger.warning("[Pipeline] Transcription returned None — continuing")

        except Exception as e:
            logger.error(f"[Pipeline] Whisper failed: {e}")
            # Don't return — continue with None transcript
            # Librosa can still run, coaching will use fallback

        # ----------------------------------------------------------
        # STAGE 2: Acoustic + NLP analysis (run concurrently)
        #
        # These two are INDEPENDENT of each other:
        # - Librosa only needs the audio bytes
        # - spaCy only needs the transcript text
        # They don't need each other's output.
        #
        # asyncio.gather() runs them at the same time.
        # Instead of: acoustic (3s) + nlp (1s) = 4s total
        # We get:     max(acoustic, nlp) = 3s total
        #
        # run_in_threadpool wraps CPU-bound sync functions so they
        # don't block FastAPI's async event loop.
        # ----------------------------------------------------------
        acoustic_result: Optional[AcousticResult] = None
        nlp_result:      Optional[NLPResult]      = None

        async def run_acoustic():
            try:
                logger.info("[Pipeline] Stage 2a: Acoustic analysis...")
                from fastapi.concurrency import run_in_threadpool
                result = await run_in_threadpool(
                    acoustic_service.analyze_from_bytes,
                    audio_bytes,
                    transcript_result.word_count if transcript_result else 0
                )
                logger.info("[Pipeline] Acoustic analysis complete")
                return result
            except Exception as e:
                logger.error(f"[Pipeline] Acoustic analysis failed: {e}")
                return None

        async def run_nlp():
            try:
                if not transcript_result or not transcript_result.transcript:
                    logger.warning("[Pipeline] No transcript for NLP — skipping")
                    return None
                logger.info("[Pipeline] Stage 2b: NLP analysis...")
                from fastapi.concurrency import run_in_threadpool
                result = await run_in_threadpool(
                    nlp_service.analyze,
                    transcript_result.transcript,
                    transcript_result.duration_secs
                )
                logger.info("[Pipeline] NLP analysis complete")
                return result
            except Exception as e:
                logger.error(f"[Pipeline] NLP analysis failed: {e}")
                return None

        # Run both concurrently — this is the asyncio.gather pattern
        acoustic_result, nlp_result = await asyncio.gather(
            run_acoustic(),
            run_nlp()
        )

        # ----------------------------------------------------------
        # STAGE 3: Claude coaching report
        #
        # Now we have all the data. Feed everything to Claude.
        # coaching_service.generate_report() never raises —
        # it returns a fallback report if Claude fails.
        # ----------------------------------------------------------
        logger.info("[Pipeline] Stage 3: Generating coaching report...")

        # We need a TranscriptResult even if Whisper failed
        if not transcript_result:
            from analysis.whisper_service import TranscriptResult
            transcript_result = TranscriptResult(
                transcript="[Transcription unavailable]",
                word_count=0,
                duration_secs=60.0
            )

        pre_scores = compute_scores_from_data(transcript_result, acoustic_result, nlp_result)
        session_history = []
        speaking_goal = "general"
        if user_id:
            try:
                from config import get_db
                from services.memory_service import MemoryService

                memory_svc = MemoryService(get_db())
                session_history = await memory_svc.get_session_history(user_id, limit=7)
                if user_profile:
                    speaking_goal = user_profile.get("speaking_goal", "general") or "general"
                logger.info(f"[Pipeline] Loaded {len(session_history)} past sessions for AI memory")
            except Exception as e:
                logger.error(f"[Pipeline] Memory fetch failed: {e}")

        coaching_report = await coaching_service.generate_report(
            topic=             topic,
            transcript_result= transcript_result,
            acoustic_result=   acoustic_result,
            nlp_result=        nlp_result,
            user_profile=      user_profile,
            session_number=    session_number,
            pre_computed_scores=pre_scores,
            session_history=   session_history,
            speaking_goal=     speaking_goal,
        )

        # ----------------------------------------------------------
        # STAGE 4: Save to Supabase
        #
        # Now save all the metrics and the coaching report to the
        # session_metrics table. This is what the results page
        # will query to display the coaching report.
        # ----------------------------------------------------------
        try:
            logger.info("[Pipeline] Stage 4: Saving to Supabase...")
            await save_results_to_db(
                session_id=     session_id,
                transcript=     transcript_result,
                acoustic=       acoustic_result,
                nlp=            nlp_result,
                coaching=       coaching_report
            )
            logger.info(f"[Pipeline] Saved results for session {session_id[:8]}")
        except Exception as e:
            logger.error(f"[Pipeline] DB save failed: {e}")
            # Don't fail — the report is still returned to the user

        if user_id:
            try:
                from config import get_db
                from services.memory_service import MemoryService

                memory_svc = MemoryService(get_db())
                await memory_svc.generate_session_summary(
                    session_id=session_id,
                    user_id=user_id,
                    session_number=session_number,
                    topic=topic,
                    coaching_report=coaching_report,
                    nlp_result=nlp_result,
                    acoustic_result=acoustic_result,
                    speaking_goal=speaking_goal,
                )
            except Exception as e:
                logger.error(f"[Pipeline] Session summary save failed: {e}")

        # Update session status to 'complete'
        try:
            from config import get_db
            db = get_db()
            db.table("sessions") \
                .update({"status": "complete"}) \
                .eq("id", session_id) \
                .execute()
        except Exception as e:
            logger.error(f"[Pipeline] Status update failed: {e}")

        # Update streak
        if user_id:
            try:
                from config import get_db
                from services.streak_service import StreakService
                svc = StreakService(get_db())
                await svc.update_streak(user_id, session_id)
            except Exception as e:
                logger.error(f"[Pipeline] Streak update failed: {e}")

        logger.info(f"[Pipeline] ✓ Pipeline complete for session {session_id[:8]}")

        try:
            from services.profile_service import update_user_profile
            await update_user_profile(
                session_id=session_id,
                nlp_result=nlp_result,
                acoustic_result=acoustic_result,
                coaching_report=coaching_report,
                pre_computed_scores=pre_scores,
            )
            logger.info(f"[Pipeline] User profile updated")
        except Exception as e:
            logger.error(f"[Pipeline] Profile update failed: {e}")

        return coaching_report

    except Exception as e:
        logger.error(f"[Pipeline] Fatal error: {e}")
        try:
            from config import get_db
            get_db().table("sessions").update(
                {"status": "failed"}
            ).eq("id", session_id).execute()
        except Exception as inner_e:
            pass
        return None


def compute_scores_from_data(
    transcript,
    acoustic,
    nlp
) -> dict:
    scores = {}

    # --- FILLER SCORE ---
    filler_rate = nlp.fillers_per_minute if (nlp and hasattr(nlp, 'fillers_per_minute')) else (nlp.filler_rate if (nlp and hasattr(nlp, 'filler_rate')) else 0)
    if filler_rate == 0:
        scores["filler"] = 100
    elif filler_rate < 1:
        scores["filler"] = 85
    elif filler_rate < 2:
        scores["filler"] = 70
    elif filler_rate < 4:
        scores["filler"] = 50
    elif filler_rate < 6:
        scores["filler"] = 30
    else:
        scores["filler"] = 10

    # --- DELIVERY SCORE (from acoustic) ---
    if acoustic:
        pitch_std = acoustic.pitch_std
        monotony = acoustic.monotony_score
        silence_pct = acoustic.silence_percentage
        longest_pause = acoustic.longest_pause_sec
        wpm = acoustic.wpm

        # Pitch variation: 0-40 pts
        if pitch_std >= 60:
            pitch_pts = 40
        elif pitch_std >= 40:
            pitch_pts = 30
        elif pitch_std >= 20:
            pitch_pts = 20
        elif pitch_std >= 10:
            pitch_pts = 10
        else:
            pitch_pts = 0

        # WPM range: 0-30 pts (120-160 is ideal)
        if 120 <= wpm <= 160:
            wpm_pts = 30
        elif 100 <= wpm < 120 or 160 < wpm <= 180:
            wpm_pts = 20
        elif 80 <= wpm < 100 or 180 < wpm <= 200:
            wpm_pts = 10
        else:
            wpm_pts = 0

        # Pause control: 0-30 pts
        if longest_pause <= 1.5 and silence_pct < 20:
            pause_pts = 30
        elif longest_pause <= 2.5 and silence_pct < 30:
            pause_pts = 20
        elif longest_pause <= 4.0:
            pause_pts = 10
        else:
            pause_pts = 0

        scores["delivery"] = min(pitch_pts + wpm_pts + pause_pts, 100)
    else:
        scores["delivery"] = 50  # fallback if acoustic failed

    # --- STRUCTURE SCORE (from NLP + transcript) ---
    if nlp and transcript:
        word_count = transcript.word_count
        sentences = nlp.sentence_count if hasattr(nlp, 'sentence_count') else 5
        ttr = nlp.ttr_score if hasattr(nlp, 'ttr_score') else (nlp.type_token_ratio if hasattr(nlp, 'type_token_ratio') else 0.5)

        # Word count: were they speaking enough? 0-30 pts
        if word_count >= 100:
            wc_pts = 30
        elif word_count >= 70:
            wc_pts = 20
        elif word_count >= 40:
            wc_pts = 10
        else:
            wc_pts = 0

        # Sentence variety: 0-30 pts
        if sentences >= 6:
            sent_pts = 30
        elif sentences >= 4:
            sent_pts = 20
        elif sentences >= 2:
            sent_pts = 10
        else:
            sent_pts = 0

        # TTR (vocabulary diversity reflects structure): 0-40 pts
        if ttr >= 0.7:
            ttr_pts = 40
        elif ttr >= 0.5:
            ttr_pts = 30
        elif ttr >= 0.35:
            ttr_pts = 20
        else:
            ttr_pts = 10

        scores["structure"] = min(wc_pts + sent_pts + ttr_pts, 100)
    else:
        scores["structure"] = 50

    # --- VOCAB SCORE ---
    if nlp:
        ttr = nlp.ttr_score if hasattr(nlp, 'ttr_score') else (nlp.type_token_ratio if hasattr(nlp, 'type_token_ratio') else 0.5)
        if ttr >= 0.7:
            scores["vocab"] = 95
        elif ttr >= 0.6:
            scores["vocab"] = 80
        elif ttr >= 0.5:
            scores["vocab"] = 65
        elif ttr >= 0.35:
            scores["vocab"] = 45
        else:
            scores["vocab"] = 25
    else:
        scores["vocab"] = 50

    # --- CONFIDENCE SCORE ---
    # Derived from: low fillers + good pace + not too many pauses
    filler_contrib = scores["filler"] * 0.4
    delivery_contrib = scores["delivery"] * 0.4
    structure_contrib = scores["structure"] * 0.2
    scores["confidence"] = int(
        filler_contrib + delivery_contrib + structure_contrib
    )

    return scores


async def save_results_to_db(
    session_id: str,
    transcript: TranscriptResult,
    acoustic:   Optional[AcousticResult],
    nlp:        Optional[NLPResult],
    coaching:   CoachingReport
):
    """
    Save all analysis results to Supabase session_metrics table.

    WHY A SEPARATE FUNCTION:
    Keeping DB logic out of the pipeline function keeps things
    clean. If we change the DB schema, we only update this function.
    """
    from config import get_db
    from fastapi.concurrency import run_in_threadpool

    # Build the metrics row
    # We use .get() with defaults everywhere because any stage
    # could have returned None
    metrics_row = {
        "session_id":  session_id,

        # Transcript data
        "transcript":  transcript.transcript if transcript else None,
        "words":       json.dumps([
            {"word": w.word, "start": w.start, "end": w.end}
            for w in (transcript.words if transcript else [])
        ]),

        # Filler data
        "filler_count":    nlp.filler_count if nlp else 0,
        "filler_detail":   json.dumps(nlp.filler_detail if nlp else {}),
        "filler_positions": json.dumps([
            {"word": f.word, "position": f.position}
            for f in (nlp.filler_occurrences if nlp else [])
        ]),

        # Acoustic data
        "wpm":               acoustic.wpm if acoustic else 0,
        "pause_count":       acoustic.pause_count if acoustic else 0,
        "longest_pause_sec": acoustic.longest_pause_sec if acoustic else 0,
        "pause_list":        json.dumps([
            {"start": p.start, "end": p.end, "duration": p.duration}
            for p in (acoustic.pause_list if acoustic else [])
        ]),
        "pitch_mean":        acoustic.pitch_mean if acoustic else 0,
        "pitch_std":         acoustic.pitch_std if acoustic else 0,
        "energy_variance":   acoustic.energy_variance if acoustic else 0,
        "silence_percentage": acoustic.silence_percentage if acoustic else 0,

        # NLP data
        "ttr_score":       nlp.ttr_score if nlp else 0,
        "hedge_word_count": nlp.hedge_word_count if nlp else 0,
        "sentence_count":  nlp.sentence_count if nlp else 0,

        # Coaching report
        "coaching_report": json.dumps({
            "scores": {
                "filler":     coaching.scores.filler,
                "delivery":   coaching.scores.delivery,
                "structure":  coaching.scores.structure,
                "vocab":      coaching.scores.vocab,
                "confidence": coaching.scores.confidence,
            },
            "what_went_well":    coaching.what_went_well,
            "priority_fix":      coaching.priority_fix,
            "example_moment":    coaching.example_moment,
            "daily_drill":       coaching.daily_drill,
            "mechanical_tip":    coaching.mechanical_tip,
            "micro_habit":       coaching.micro_habit,
            "encouragement":     coaching.encouragement,
            "content_feedback":  coaching.content_feedback,
            "focus_area":        coaching.focus_area,
            "transcript_highlights": coaching.transcript_highlights,
            "session_comparison":    coaching.session_comparison,
            "recurring_patterns":    coaching.recurring_patterns,
            "improvement_noted":     coaching.improvement_noted,
            "drill_followup":        coaching.drill_followup,
            "next_session_focus":    coaching.next_session_focus,
        })
    }

    # Run the DB insert in a thread pool
    # (Supabase client is sync, not async)
    await run_in_threadpool(
        lambda: get_db()
            .table("session_metrics")
            .insert(metrics_row)
            .execute()
    )
