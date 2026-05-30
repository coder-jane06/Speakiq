# =============================================================
# backend/analysis/coaching_service.py
# Uses Groq API (free tier) with Llama 3 model
# =============================================================

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Optional

from analysis.whisper_service import TranscriptResult
from analysis.acoustic_service import AcousticResult
from analysis.nlp_service import NLPResult

logger = logging.getLogger(__name__)


@dataclass
class CoachingScores:
    filler:     int = 50
    delivery:   int = 50
    structure:  int = 50
    vocab:      int = 50
    confidence: int = 50


@dataclass
class CoachingReport:
    scores:             CoachingScores = field(default_factory=CoachingScores)
    what_went_well:     str = ""
    priority_fix:       str = ""
    example_moment:     Optional[str] = None
    daily_drill:        str = ""
    mechanical_tip:     str = ""
    micro_habit:        str = ""
    encouragement:      str = ""
    content_feedback:   str = ""
    focus_area:         str = "filler_words"
    session_number:     int = 1


def pick_focus_area(user_profile: Optional[dict]) -> str:
    """Pick the single focus area for this session."""
    if not user_profile:
        return "filler_words"

    scores = {
        "filler_words":      user_profile.get("filler_score", 50),
        "delivery_monotony": user_profile.get("delivery_score", 50),
        "idea_structure":    user_profile.get("structure_score", 50),
        "vocabulary":        user_profile.get("vocab_score", 50),
        "confidence":        user_profile.get("confidence_score", 50),
    }
    last_coached = user_profile.get("last_coached", None)
    sorted_areas = sorted(scores.items(), key=lambda x: x[1])
    for area, _ in sorted_areas:
        if area != last_coached:
            return area
    return sorted_areas[0][0]


def build_coaching_prompt(
    topic:             str,
    transcript_result: TranscriptResult,
    acoustic_result:   Optional[AcousticResult],
    nlp_result:        Optional[NLPResult],
    user_profile:      Optional[dict],
    focus_area:        str,
    session_number:    int,
    pre_scores:        Optional[dict] = None
) -> str:
    """Build personalized coaching prompt with all session data."""

    session_num = session_number or 1
    if session_num <= 5:
        tier = "BEGINNER"
        tier_instruction = """This is an early session. Focus on 
        the basics: filler words, basic pacing, completing sentences.
        Keep feedback encouraging and simple."""
    elif session_num <= 15:
        tier = "INTERMEDIATE"  
        tier_instruction = """This user has solid basics. Push them 
        on delivery variety, idea structure, and confidence. 
        Stop mentioning basic filler word tips unless count > 5/min."""
    elif session_num <= 30:
        tier = "ADVANCED"
        tier_instruction = """This is an experienced user. Coach on 
        advanced storytelling, emotional pitch variation, persuasive 
        vocabulary, and audience engagement. Basic tips are insulting 
        at this stage."""
    else:
        tier = "EXPERT"
        tier_instruction = """Elite level coaching only. Focus on 
        nuance, presence, rhetorical devices, and mastery-level 
        refinements."""

    # User history section
    if user_profile and user_profile.get("total_sessions", 0) > 1:
        history = f"""
## Your coaching history with this user
- Sessions completed: {user_profile.get("total_sessions", 0)}
- Coaching tier: {tier}
- Filler score trend: {user_profile.get("filler_trend", "stable")}
- Their persistent top fillers: {user_profile.get("top_fillers", [])}
- Delivery trend: {user_profile.get("delivery_trend", "stable")}
- Last session you coached on: {user_profile.get("last_coached", "nothing yet")}
- Current streak: {user_profile.get("current_streak", 1)} days

{tier_instruction}

IMPORTANT: Reference their history in your feedback.
If their filler trend is "improving", acknowledge it.
If "regressing", address it directly.
Do NOT repeat advice from their last coached area: {user_profile.get("last_coached")}
"""
    else:
        history = f"""
## First session context
This is session #{session_num}. Be encouraging and welcoming.
{tier_instruction}
"""

    # Transcript (truncated)
    transcript_text = (transcript_result.transcript or "")[:800]

    # Acoustic data
    if acoustic_result:
        acoustic = f"""- Speech rate: {acoustic_result.wpm:.0f} WPM (ideal: 130-150)
- Pauses: {acoustic_result.pause_count} total, longest {acoustic_result.longest_pause_sec:.1f}s
- Silence: {acoustic_result.silence_percentage:.1f}% of recording
- Pitch variation: {acoustic_result.pitch_std:.1f} Hz std (low = monotone)
- Monotony score: {acoustic_result.monotony_score:.2f} (0=robotic, 1=expressive)"""
    else:
        acoustic = "Acoustic data unavailable."

    # NLP data
    if nlp_result:
        nlp = f"""- Filler words: {nlp_result.filler_count} total ({nlp_result.fillers_per_minute}/min)
- Filler breakdown: {dict(list(nlp_result.filler_detail.items())[:5])}
- Vocabulary diversity (TTR): {nlp_result.ttr_score:.2f}
- Hedge words: {nlp_result.hedge_word_count} ({nlp_result.hedge_words_found[:4]})
- Sentences: {nlp_result.sentence_count}, avg length {nlp_result.avg_sentence_length:.0f} words"""
    else:
        nlp = "NLP data unavailable."

    focus_map = {
        "filler_words":      "Focus ONLY on filler word usage. Reference specific fillers from the data.",
        "pacing":            "Focus ONLY on speech rate and pausing patterns.",
        "delivery_monotony": "Focus ONLY on vocal variety. Reference the monotony score.",
        "idea_structure":    "Focus ONLY on how well they organized their ideas.",
        "vocabulary":        "Focus ONLY on vocabulary diversity. Reference the TTR score.",
        "confidence":        "Focus ONLY on confident, assertive delivery.",
    }
    focus_instruction = focus_map.get(focus_area, "Focus on the weakest area.")

    if pre_scores is None:
        pre_scores = {"filler": 50, "delivery": 50, "structure": 50, "vocab": 50, "confidence": 50}

    return f"""You are an expert speech coach. Analyze this speaking session and return ONLY a JSON object.

Topic: "{topic}"
Session: #{session_number}
{history}

Transcript:
"{transcript_text}"

Acoustic analysis:
{acoustic}

Language analysis:
{nlp}

Coaching instruction:
{focus_instruction}

STRICT COACHING RULES:
RULE 1: NO TECHNICAL NUMBERS IN FEEDBACK. Never mention Hz, WPM numbers, TTR scores, or milliseconds in the feedback fields. You can use these internally to decide what to coach on, but never show them to the user. Instead, use relatable analogies (e.g., "like telling a story to a friend", "sounding like reading a script").
RULE 2: USE ANALOGIES AND REAL EXAMPLES. Every piece of feedback must use either a relatable analogy, a specific action the user can do right now, or a reference to their actual words from the transcript.
RULE 3: THE DAILY DRILL MUST BE DOABLE IN 2 MINUTES. It should be a concrete exercise, e.g., "Pick any sentence from today's topic and say it 3 times...".
RULE 4: THE MECHANICAL TIP MUST BE PHYSICAL AND SIMPLE. It should focus on body/voice mechanics, e.g., "Take one slow breath in through your nose...".
RULE 5: CONTENT ANALYSIS. Evaluate if they stayed on topic, if they had structure (opening, middle, end), and if they used specific examples instead of generalities. Give 1-2 sentences on their IDEAS, not just delivery.
RULE 6: TONE MUST BE LIKE A SUPPORTIVE HUMAN COACH. Be warm, encouraging, and human. Do not sound robotic or like a professor.

Return ONLY this JSON, no other text:
{{
  "scores": {{
    "filler": <0-100>,
    "delivery": <0-100>,
    "structure": <0-100>,
    "vocab": <0-100>,
    "confidence": <0-100>
  }},
  "what_went_well": "<Specific positive with real examples/analogies>",
  "priority_fix": "<One specific fix using an analogy, NO technical numbers>",
  "example_moment": "<Quote from transcript + what to do instead>",
  "daily_drill": "<specific 2-5 minute physical exercise with exact instructions. Example: Read a paragraph aloud, pause 2 seconds at every comma>",
  "mechanical_tip": "<one physical tip about breathing, posture, or mouth movement>",
  "micro_habit": "<one thing to watch for in casual conversation today>",
  "encouragement": "<One warm, supportive sentence>",
  "content_feedback": "<1-2 sentences on their IDEAS, structure, and use of examples>"
}}

Pre-calculated scores (USE THESE EXACTLY, do not change them):
{{
  "filler": {pre_scores["filler"]},
  "delivery": {pre_scores["delivery"]},
  "structure": {pre_scores["structure"]},
  "vocab": {pre_scores["vocab"]},
  "confidence": {pre_scores["confidence"]}
}}

Your ONLY job for scores is to copy these exact numbers into the literal "scores" object.
Focus your energy on writing excellent coaching text for the other fields, strictly following the STRICT COACHING RULES above."""


class CoachingService:
    """Generates coaching reports using Groq's free API (Llama 3)."""

    FALLBACK_REPORT = {
        "scores": {"filler": 50, "delivery": 50, "structure": 50, "vocab": 50, "confidence": 50},
        "what_went_well": "You completed the full session — consistency is everything.",
        "priority_fix": "Keep practicing daily. Analysis was temporarily unavailable.",
        "example_moment": None,
        "daily_drill": "Record yourself for 60 seconds on any topic and listen back.",
        "mechanical_tip": "Take a deep breath before you start speaking to steady your voice.",
        "micro_habit": "Pause for one second before answering any question today.",
        "encouragement": "Showing up every day is what makes great speakers.",
        "content_feedback": "We couldn't analyze your ideas this time, but keep sharing your thoughts clearly."
    }

    def __init__(self):
        try:
            import os
            from dotenv import load_dotenv
            from groq import Groq
            load_dotenv(dotenv_path=os.path.join(
                os.path.dirname(os.path.abspath(__file__)), '..', '.env'
            ))
            api_key = os.getenv("GROQ_API_KEY")
            self.client = Groq(api_key=api_key)
            self.model  = "llama-3.3-70b-versatile"
            logger.info("[CoachingService] Groq client initialized (llama-3.3-70b)")
        except Exception as e:
            logger.error(f"[CoachingService] Failed to init Groq: {e}")
            self.client = None


    async def generate_report(
        self,
        topic:             str,
        transcript_result: TranscriptResult,
        acoustic_result:   Optional[AcousticResult],
        nlp_result:        Optional[NLPResult],
        user_profile:      Optional[dict] = None,
        session_number:    int = 1,
        pre_computed_scores: Optional[dict] = None
    ) -> CoachingReport:
        """Generate coaching report. Always returns a report — never raises."""

        focus_area = pick_focus_area(user_profile)

        if self.client is None:
            logger.warning("[CoachingService] No client — returning fallback")
            return self._fallback_report(focus_area, session_number)

        prompt = build_coaching_prompt(
            topic=topic,
            transcript_result=transcript_result,
            acoustic_result=acoustic_result,
            nlp_result=nlp_result,
            user_profile=user_profile,
            focus_area=focus_area,
            session_number=session_number,
            pre_scores=pre_computed_scores
        )

        logger.info(f"[CoachingService] Generating report (focus: {focus_area})")

        try:
            # Groq API call
            # response_format={"type": "json_object"} forces JSON output
            # This is more reliable than asking nicely in the prompt
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1024,
                temperature=0.3,        # lower = more consistent output
                response_format={"type": "json_object"}
            )

            response_text = completion.choices[0].message.content.strip()

            # Parse JSON response
            clean = response_text
            if "```json" in clean:
                clean = clean.split("```json")[1].split("```")[0]
            elif "```" in clean:
                clean = clean.split("```")[1].split("```")[0]

            report_data = json.loads(clean.strip())

            scores = CoachingScores(
                filler=     pre_computed_scores["filler"] if pre_computed_scores else report_data["scores"].get("filler", 50),
                delivery=   pre_computed_scores["delivery"] if pre_computed_scores else report_data["scores"].get("delivery", 50),
                structure=  pre_computed_scores["structure"] if pre_computed_scores else report_data["scores"].get("structure", 50),
                vocab=      pre_computed_scores["vocab"] if pre_computed_scores else report_data["scores"].get("vocab", 50),
                confidence= pre_computed_scores["confidence"] if pre_computed_scores else report_data["scores"].get("confidence", 50),
            )

            report = CoachingReport(
                scores=             scores,
                what_went_well=     report_data.get("what_went_well", ""),
                priority_fix=       report_data.get("priority_fix", ""),
                example_moment=     report_data.get("example_moment"),
                daily_drill=        report_data.get("daily_drill", ""),
                mechanical_tip=     report_data.get("mechanical_tip", ""),
                micro_habit=        report_data.get("micro_habit", ""),
                encouragement=      report_data.get("encouragement", ""),
                content_feedback=   report_data.get("content_feedback", ""),
                focus_area=         focus_area,
                session_number=     session_number
            )

            logger.info(
                f"[CoachingService] Report done — "
                f"filler={scores.filler}, delivery={scores.delivery}, "
                f"confidence={scores.confidence}"
            )
            return report

        except json.JSONDecodeError as e:
            logger.error(f"[CoachingService] JSON parse failed: {e}")
            return self._fallback_report(focus_area, session_number)
        except Exception as e:
            logger.error(f"[CoachingService] Failed: {type(e).__name__}: {e}")
            return self._fallback_report(focus_area, session_number)

    def _fallback_report(self, focus_area: str, session_number: int) -> CoachingReport:
        d = self.FALLBACK_REPORT
        return CoachingReport(
            scores=CoachingScores(**d["scores"]),
            what_went_well=     d["what_went_well"],
            priority_fix=       d["priority_fix"],
            example_moment=     d["example_moment"],
            daily_drill=        d["daily_drill"],
            mechanical_tip=     d["mechanical_tip"],
            micro_habit=        d["micro_habit"],
            encouragement=      d["encouragement"],
            content_feedback=   d["content_feedback"],
            focus_area=         focus_area,
            session_number=     session_number
        )


coaching_service = CoachingService()