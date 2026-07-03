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
import re
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
    user_id: Optional[str] = None,
    speaking_goal_override: Optional[str] = None,
    difficulty_tier: str = "beginner",
    authorization: str = None,
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
                raise RuntimeError("Whisper transcription returned None")

        except Exception as e:
            logger.error(f"[Pipeline] Whisper failed: {e}")
            try:
                from config import get_db
                get_db().table("sessions").update(
                    {"status": "failed"}
                ).eq("id", session_id).execute()
            except Exception as db_err:
                logger.error(f"[Pipeline] Could not update session status after Whisper failure: {db_err}")
            return None

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

        session_history = []
        speaking_goal = speaking_goal_override or "general"
        if user_id:
            try:
                from config import get_db
                from services.memory_service import MemoryService

                memory_svc = MemoryService(get_db())
                session_history = await memory_svc.get_session_history(user_id, limit=7)
                if not speaking_goal_override and user_profile:
                    speaking_goal = user_profile.get("speaking_goal", "general") or "general"
                logger.info(f"[Pipeline] Loaded {len(session_history)} past sessions for AI memory")
            except Exception as e:
                logger.error(f"[Pipeline] Memory fetch failed: {e}")

        pre_scores = compute_scores_from_data(
            transcript_result,
            acoustic_result,
            nlp_result,
            speaking_goal=speaking_goal,
            difficulty_tier=difficulty_tier,
            session_history=session_history,
        )

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
    nlp,
    speaking_goal: str = "general",
    difficulty_tier: str = "beginner",
    authorization: str = None,
    session_history: Optional[list] = None,
) -> dict:
    def clamp(value: float, low: int = 0, high: int = 100) -> int:
        return int(max(low, min(high, round(value))))

    def range_score(value: float, ideal_low: float, ideal_high: float, outer_low: float, outer_high: float) -> int:
        if value <= 0:
            return 45
        if ideal_low <= value <= ideal_high:
            return 100
        if outer_low <= value < ideal_low:
            return clamp(100 - ((ideal_low - value) / max(ideal_low - outer_low, 1)) * 55)
        if ideal_high < value <= outer_high:
            return clamp(100 - ((value - ideal_high) / max(outer_high - ideal_high, 1)) * 55)
        return 30

    def density_score(count: float, per_minute: float, beginner_lenient: bool = True) -> int:
        if per_minute <= 0:
            return 98
        bands = [(0.8, 92), (1.5, 82), (2.5, 68), (4.0, 50), (6.0, 32)]
        for limit, score in bands:
            if per_minute <= limit:
                return min(100, score + (5 if beginner_lenient and difficulty_tier == "beginner" else 0))
        return 18

    text = getattr(transcript, "transcript", "") or ""
    text_l = text.lower()
    words = re.findall(r"[a-zA-Z']+", text_l)
    word_count = getattr(transcript, "word_count", None) or len(words)

    # 1. 0-Word Fix: If there is no speech, all scores should be strictly zero.
    if word_count == 0:
        return {
            "filler": 0,
            "delivery": 0,
            "structure": 0,
            "vocab": 0,
            "confidence": 0,
        }

    sentence_parts = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    sentence_count = getattr(nlp, "sentence_count", 0) if nlp else len(sentence_parts)
    avg_sentence_length = getattr(nlp, "avg_sentence_length", 0.0) if nlp else (
        word_count / sentence_count if sentence_count else 0
    )

    # Common metrics
    evidence_count = len(re.findall(r"\b(for example|for instance|data|research|study|survey|because|evidence|in my experience|when i|we measured)\b", text_l)) + len(re.findall(r"\b\d+(\.\d+)?%?\b", text_l))
    transition_count = len(re.findall(r"\b(first|second|third|finally|however|therefore|because|for example|for instance|on the other hand|in conclusion|the key point|my point|as a result|to summarize|next)\b", text_l))
    first_person_i = len(re.findall(r"\b(i|me|my|mine)\b", text_l))
    first_person_we = len(re.findall(r"\b(we|our|us)\b", text_l))
    
    # Orator specific: Rule of three (triads - very naive check for multiple 'and'/'or' in quick succession), Antithesis
    orator_hits = len(re.findall(r"\b(imagine|story|we must|not only|but also|today|together)\b", text_l))
    contrast_hits = len(re.findall(r"\b(but|yet|however|instead|rather|never|always)\b", text_l))
    rhetorical_questions = text.count("?")
    sentence_starts = [re.findall(r"[a-zA-Z']+", s.lower())[:1] for s in sentence_parts]
    starts = [s[0] for s in sentence_starts if s]
    repeated_starts = len(starts) - len(set(starts)) if len(starts) > 1 else 0

    # Debater specific: DR. MO and 4-step refutation
    debate_hits = len(re.findall(r"\b(claim|argument|evidence|rebut|opponent|impact|outweigh|therefore|deny|reverse|minimize)\b", text_l))
    signposting = len(re.findall(r"\b(firstly|secondly|my first point|moving on|in response to)\b", text_l))

    # Presenter specific:
    presenter_hits = len(re.findall(r"\b(takeaway|data|slide|first|second|finally|recommend|conclusion|as you can see|raise your hand)\b", text_l))

    # Interviewer specific: STAR
    star_hits = len(re.findall(r"\b(situation|task|action|result|challenge|impact|learned)\b", text_l))
    # Sequential STAR check (naive):
    situation_idx = text_l.find("situation")
    action_idx = text_l.find("action")
    result_idx = text_l.find("result")
    sequential_star_bonus = 5 if (situation_idx != -1 and action_idx != -1 and result_idx != -1 and situation_idx < action_idx < result_idx) else 0

    # --- FILLER / FLUENCY ---
    filler_rate = getattr(nlp, "fillers_per_minute", 0.0) if nlp else 0.0
    filler_count = getattr(nlp, "filler_count", 0) if nlp else 0
    hedge_count = getattr(nlp, "hedge_word_count", 0) if nlp else 0
    filler_score = density_score(filler_count, filler_rate)
    
    # Hedges hurt Debater and Interviewer the most
    hedge_penalty_mult = 5 if speaking_goal == "debater" else (4 if speaking_goal == "interviewer" else 2)
    hedge_penalty = min(25, hedge_count * hedge_penalty_mult)
    filler_score = clamp(filler_score - hedge_penalty)

    # --- DELIVERY ---
    if acoustic:
        wpm = getattr(acoustic, "wpm", 0.0)
        pitch_std = getattr(acoustic, "pitch_std", 0.0)
        monotony = getattr(acoustic, "monotony_score", 0.0)
        silence_pct = getattr(acoustic, "silence_percentage", 0.0)
        longest_pause = getattr(acoustic, "longest_pause_sec", 0.0)
        jitter = getattr(acoustic, "jitter", 0.0)
        shimmer = getattr(acoustic, "shimmer", 0.0)
        hnr = getattr(acoustic, "hnr", 0.0)
        intensity_db = getattr(acoustic, "intensity_db", 0.0)

        # Adjusted pace ranges per mode
        pace_ranges = {
            "orator": (105, 155, 80, 185),
            "presenter": (115, 155, 90, 185),
            "interviewer": (120, 160, 95, 185),
            "debater": (140, 185, 110, 215), # Fast pace expected
            "general": (120, 160, 90, 190),
        }
        pace_score = range_score(wpm, *pace_ranges.get(speaking_goal, pace_ranges["general"]))

        pitch_score = clamp((min(pitch_std, 85) / 85) * 75 + (monotony * 25))
        if speaking_goal == "orator":
            pitch_score = clamp(pitch_score + 10) # Reward wide pitch variation
        if speaking_goal == "interviewer" and pitch_std > 90:
            pitch_score = clamp(pitch_score - 10) # Penalize over-the-top expressiveness

        if speaking_goal == "orator":
            # Dramatic pauses are okay, even long ones.
            pause_score = 100
            if silence_pct > 35:
                pause_score -= min(35, (silence_pct - 35) * 1.5)
            if longest_pause > 5.0:
                pause_score -= min(30, (longest_pause - 5.0) * 5)
        elif speaking_goal == "debater":
            # Continuous talking expected, pauses are penalized.
            pause_score = range_score(longest_pause, 0.2, 1.4, 0.0, 2.5)
            if silence_pct > 20:
                pause_score -= min(35, (silence_pct - 20) * 2.5)
        else:
            pause_score = range_score(longest_pause, 0.3, 2.2, 0.0, 4.0)
            if silence_pct > 28:
                pause_score -= min(25, (silence_pct - 28) * 1.2)

        voice_quality = 78
        if jitter:
            voice_quality -= min(18, max(0, jitter - 1.2) * 5)
        if shimmer:
            voice_quality -= min(12, max(0, shimmer - 12) * 0.6)
        if hnr > 0:
            voice_quality += min(10, hnr * 0.5)
        if intensity_db > 55:
            voice_quality += 6
        elif 0 < intensity_db < 42:
            voice_quality -= 8

        delivery_score = clamp(
            pace_score * 0.28
            + pitch_score * 0.28
            + pause_score * 0.26
            + clamp(voice_quality) * 0.18
        )
    else:
        delivery_score = 50

    # --- STRUCTURE ---
    if word_count <= 0:
        structure_score = 35 # Should not happen due to early return
    else:
        length_target = {
            "beginner": (45, 110),
            "intermediate": (60, 145),
            "advanced": (80, 190),
        }.get(difficulty_tier, (45, 120))
        length_score = range_score(word_count, length_target[0], length_target[1], 25, length_target[1] + 90)
        sentence_score = range_score(avg_sentence_length, 9, 22, 4, 35)
        transition_score = clamp(min(transition_count, 5) * 18 + min(evidence_count, 4) * 4)

        mode_bonus = 0
        if speaking_goal == "interviewer":
            mode_bonus = min(26, star_hits * 6 + sequential_star_bonus)
            if first_person_i > 0 and first_person_i >= first_person_we:
                mode_bonus += 8
        elif speaking_goal == "debater":
            mode_bonus = min(30, debate_hits * 5 + signposting * 4 + evidence_count * 3)
        elif speaking_goal == "presenter":
            mode_bonus = min(28, presenter_hits * 5 + signposting * 4 + evidence_count * 3)
        elif speaking_goal == "orator":
            mode_bonus = min(28, orator_hits * 4 + repeated_starts * 6 + contrast_hits * 4 + rhetorical_questions * 4)
        else:
            mode_bonus = min(20, transition_count * 3 + evidence_count * 4)

        structure_score = clamp(length_score * 0.28 + sentence_score * 0.24 + transition_score * 0.24 + 24 + mode_bonus)

    # --- VOCABULARY ---
    if nlp:
        ttr = getattr(nlp, "ttr_score", 0.0)
        unique_words = getattr(nlp, "unique_word_count", 0)
        total_content = getattr(nlp, "total_word_count", 0)
        diversity_score = range_score(ttr, 0.42, 0.68, 0.25, 0.85)
        specificity_score = clamp(min(evidence_count, 5) * 12 + min(unique_words, 55) * 0.65)
        repetition_penalty = 0
        if total_content > 0 and unique_words / max(total_content, 1) < 0.32:
            repetition_penalty = 12
        vocab_score = clamp(diversity_score * 0.62 + specificity_score * 0.38 - hedge_penalty * 0.5 - repetition_penalty)
    else:
        vocab_score = 50

    # --- CONFIDENCE ---
    # Weightings shift based on mode
    if speaking_goal == "orator":
        # Delivery is paramount
        w_f, w_d, w_s, w_v = 0.20, 0.45, 0.20, 0.15
    elif speaking_goal == "debater":
        # Structure and vocab (logic) are paramount
        w_f, w_d, w_s, w_v = 0.20, 0.20, 0.40, 0.20
    elif speaking_goal == "interviewer":
        # Structure (STAR) and Filler (professionalism) are key
        w_f, w_d, w_s, w_v = 0.30, 0.20, 0.35, 0.15
    else:
        w_f, w_d, w_s, w_v = 0.25, 0.34, 0.22, 0.19

    confidence_score = clamp(
        filler_score * w_f
        + delivery_score * w_d
        + structure_score * w_s
        + vocab_score * w_v
        + (10 if speaking_goal == "general" else 5)
    )

    if speaking_goal == "interviewer":
        if first_person_i == 0 and word_count > 35:
            confidence_score = clamp(confidence_score - 10)
        if first_person_we > first_person_i * 2 and first_person_we > 2:
            confidence_score = clamp(confidence_score - 8)
    if speaking_goal == "debater" and hedge_count > 2:
        confidence_score = clamp(confidence_score - min(15, hedge_count * 3))
    if acoustic and getattr(acoustic, "jitter", 0.0) > 2.5:
        confidence_score = clamp(confidence_score - 7)

    scores = {
        "filler": clamp(filler_score),
        "delivery": clamp(delivery_score),
        "structure": clamp(structure_score),
        "vocab": clamp(vocab_score),
        "confidence": clamp(confidence_score),
    }

    if session_history:
        previous_scores = session_history[-1].get("scores") if isinstance(session_history[-1], dict) else None
        if isinstance(previous_scores, str):
            try:
                previous_scores = json.loads(previous_scores)
            except json.JSONDecodeError:
                previous_scores = None
        if isinstance(previous_scores, dict):
            for key, value in list(scores.items()):
                previous = previous_scores.get(key)
                if isinstance(previous, (int, float)) and value >= previous + 8:
                    scores[key] = clamp(value + 2)

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
            "advanced_acoustic": {
                "jitter": getattr(acoustic, 'jitter', 0.0) if acoustic else 0.0,
                "shimmer": getattr(acoustic, 'shimmer', 0.0) if acoustic else 0.0,
                "hnr": getattr(acoustic, 'hnr', 0.0) if acoustic else 0.0,
                "intensity_db": getattr(acoustic, 'intensity_db', 0.0) if acoustic else 0.0
            }
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
