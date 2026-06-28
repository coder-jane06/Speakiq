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
    # Adaptive memory fields
    transcript_highlights: list = field(default_factory=list)
    session_comparison:    str = ""
    recurring_patterns:    list = field(default_factory=list)
    improvement_noted:     str = ""
    drill_followup:        str = ""
    next_session_focus:    str = ""


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
    pre_scores:        Optional[dict] = None,
    session_history:   Optional[list] = None,
    speaking_goal:     str = "general",
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

    # ── Speaking goal section ──────────────────────────────────────────
    goal_instructions = {
        "orator": """The user wants to become a powerful ORATOR. Tailor ALL coaching toward:
- The "Big Three" Rhetorical Devices: The Rule of Three (Triads), Anaphora (Repetition), and Contrast (Antithesis). Look for these in the transcript.
- Emotional pacing: Coach them on varying their speed (slowing down for gravity, speeding up for urgency).
- Projection and Presence: Use their Intensity/Volume data to ensure they aren't trailing off.
- Look for intentional, dramatic pauses. A high silence percentage can be a GOOD thing for an orator if placed correctly.""",
        "debater": """The user wants to excel at DEBATING. Tailor ALL coaching toward:
- The Four-Step Refutation Model (Signpost, State, Support, Impact).
- The DR. MO Framework (Deny, Reverse, Minimize, Outweigh). Look for these in how they counterarguments.
- Flag logical fallacies (e.g., ad hominem, red herring) if their reasoning is weak, and coach them to pivot back to the core issue.
- Assertiveness vs Aggression: Their tone should be confident but not hostile.
- Rebuttals: Fast WPM is acceptable here, provided they don't sacrifice clarity.""",
        "presenter": """The user wants to ace PRESENTATIONS. Tailor ALL coaching toward:
- The "Tagline-Evidence-Pause" pattern.
- Clear slide transitions. Long pauses should be interpreted as transitioning between visual points.
- Data-driven communication and precise vocabulary (Lexical Diversity).
- Opening hooks and clear takeaway conclusions.""",
        "interviewer": """The user wants to excel in JOB INTERVIEWS. Tailor ALL coaching toward:
- The STAR Method (Situation, Task, Action, Result). Aggressively evaluate their answer ratio (e.g. did they spend too much time on the Situation?).
- The "I vs We" Bias: Flag if they rely too heavily on "we" statements instead of claiming personal ownership with "I".
- Conversational tone vs Rambling: Answers must be concise and avoid trailing off.
- Nerves: Look closely at Jitter and Shimmer data to detect vocal strain or wavering, and coach them on breath control."""
    }
    goal_text = goal_instructions.get(
        speaking_goal,
        "Focus on general speaking improvement across all dimensions."
    )
    goal_section = f"\n## Speaking Goal: {speaking_goal.upper()}\n{goal_text}\n"

    # ── Session history / AI memory ────────────────────────────────────
    if session_history and len(session_history) > 0:
        history_lines = []
        for s in session_history[-5:]:
            line = s.get("summary_text", "")
            if s.get("drill_completed"):
                line += " [DRILL DONE ✓]"
            else:
                line += " [DRILL SKIPPED]"
            history_lines.append(f"  - {line}")
        memory_section = (
            "\n## Your Memory of This User (past sessions)\n"
            + "\n".join(history_lines)
            + "\n\nCRITICAL MEMORY RULES:"
            + "\n- Reference specific improvements or regressions you see above"
            + "\n- If the user completed their last drill, acknowledge it warmly in drill_followup"
            + "\n- If they skipped it, gently suggest trying again in drill_followup"
            + "\n- If a pattern appears in 3+ sessions, escalate urgency in recurring_patterns"
            + "\n- NEVER give the exact same advice as the last session\n"
        )
    else:
        memory_section = ""

    # ── User profile history ───────────────────────────────────────────
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

    # Transcript (truncated to keep tokens reasonable)
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
{goal_section}
{memory_section}
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
RULE 1: NO TECHNICAL NUMBERS IN FEEDBACK. Never mention Hz, WPM numbers, TTR scores, or milliseconds in the feedback fields. Use relatable analogies instead.
RULE 2: USE ANALOGIES AND REAL EXAMPLES. Every piece of feedback must use a relatable analogy, a specific action, or a reference to their actual words from the transcript.
RULE 3: THE DAILY DRILL MUST BE DOABLE IN 2 MINUTES. Concrete exercise, e.g., "Pick any sentence from today's topic and say it 3 times...".
RULE 4: THE MECHANICAL TIP MUST BE PHYSICAL AND SIMPLE. Body/voice mechanics only, e.g., "Take one slow breath in through your nose...".
RULE 5: CONTENT ANALYSIS. Evaluate if they stayed on topic, had structure (opening, middle, end), and used specific examples. Give 1-2 sentences on their IDEAS.
RULE 6: TONE MUST BE LIKE A SUPPORTIVE HUMAN COACH. Be warm, encouraging, and human.

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
  "daily_drill": "<specific 2-5 minute physical exercise with exact instructions>",
  "mechanical_tip": "<one physical tip about breathing, posture, or mouth movement>",
  "micro_habit": "<one thing to watch for in casual conversation today>",
  "encouragement": "<One warm, supportive sentence>",
  "content_feedback": "<1-2 sentences on their IDEAS, structure, and use of examples>",
  "transcript_highlights": [{{"text": "<exact quoted phrase>", "type": "filler_cluster|hedge_words|rushed", "suggestion": "<better alternative>"}}],
  "session_comparison": "<1-2 sentences comparing THIS session to the previous one, or empty string if first session>",
  "recurring_patterns": ["<pattern_name if it appeared in 3+ sessions>"],
  "improvement_noted": "<specific improvement from past sessions, or empty string>",
  "drill_followup": "<warm comment on last session's drill — did it help? or empty string if no history>",
  "next_session_focus": "<recommended focus area: filler_words|delivery_monotony|idea_structure|vocabulary|confidence>"
}}

Pre-calculated scores (USE THESE EXACTLY, copy them into scores):
{{
  "filler": {pre_scores["filler"]},
  "delivery": {pre_scores["delivery"]},
  "structure": {pre_scores["structure"]},
  "vocab": {pre_scores["vocab"]},
  "confidence": {pre_scores["confidence"]}
}}

Your ONLY job for scores is to copy these exact numbers.
Focus energy on writing excellent coaching text, strictly following the STRICT COACHING RULES above."""


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
        "content_feedback": "We couldn't analyze your ideas this time, but keep sharing your thoughts clearly.",
        "transcript_highlights": [],
        "session_comparison": "",
        "recurring_patterns": [],
        "improvement_noted": "",
        "drill_followup": "",
        "next_session_focus": "filler_words",
    }

    def __init__(self):
        # HF Spaces injects secrets as environment variables directly.
        # Load .env only as a local fallback for development.
        try:
            from dotenv import load_dotenv
            load_dotenv(dotenv_path=os.path.join(
                os.path.dirname(os.path.abspath(__file__)), '..', '.env'
            ))
        except Exception:
            pass

        self.client = None
        self.model  = "llama-3.3-70b-versatile"

        # Try Groq first (primary)
        groq_key = os.getenv("GROQ_API_KEY", "").strip()
        if groq_key:
            try:
                from groq import Groq
                self.client = Groq(api_key=groq_key)
                self.provider = "groq"
                logger.info("[CoachingService] Groq client initialized (llama-3.3-70b)")
                return
            except Exception as e:
                logger.error(f"[CoachingService] Groq init failed: {e}")

        # Fallback: OpenAI GPT-4o-mini (if available)
        openai_key = os.getenv("OPENAI_API_KEY", "").strip()
        if openai_key:
            try:
                import openai
                self.openai_client = openai.OpenAI(api_key=openai_key)
                self.provider = "openai"
                logger.info("[CoachingService] OpenAI fallback client initialized (gpt-4o-mini)")
                return
            except Exception as e:
                logger.error(f"[CoachingService] OpenAI init failed: {e}")

        logger.warning("[CoachingService] No AI client available — will use fallback reports")

    async def generate_report(
        self,
        topic:               str,
        transcript_result:   TranscriptResult,
        acoustic_result:     Optional[AcousticResult],
        nlp_result:          Optional[NLPResult],
        user_profile:        Optional[dict] = None,
        session_number:      int = 1,
        pre_computed_scores: Optional[dict] = None,
        session_history:     Optional[list] = None,
        speaking_goal:       str = "general",
    ) -> CoachingReport:
        """Generate coaching report. Always returns a report — never raises."""

        focus_area = pick_focus_area(user_profile)
        provider = getattr(self, 'provider', None)

        if self.client is None and not hasattr(self, 'openai_client'):
            logger.warning("[CoachingService] No client — returning fallback")
            return self._fallback_report(focus_area, session_number, pre_computed_scores, speaking_goal)

        prompt = build_coaching_prompt(
            topic=topic,
            transcript_result=transcript_result,
            acoustic_result=acoustic_result,
            nlp_result=nlp_result,
            user_profile=user_profile,
            focus_area=focus_area,
            session_number=session_number,
            pre_scores=pre_computed_scores,
            session_history=session_history,
            speaking_goal=speaking_goal,
        )

        logger.info(f"[CoachingService] Generating report (focus: {focus_area}, goal: {speaking_goal})")

        try:
            response_text = None
            
            # Helper function to call the LLM
            def call_llm(client, is_openai=False):
                if is_openai:
                    completion = client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{"role": "user", "content": prompt}],
                        max_tokens=1600,
                        temperature=0.3,
                        response_format={"type": "json_object"}
                    )
                else:
                    completion = client.chat.completions.create(
                        model=self.model,
                        messages=[{"role": "user", "content": prompt}],
                        max_tokens=1600,
                        temperature=0.3,
                        response_format={"type": "json_object"}
                    )
                return completion.choices[0].message.content.strip()

            # Attempt Primary Provider
            if provider == "groq" and self.client:
                try:
                    response_text = call_llm(self.client, is_openai=False)
                except Exception as e:
                    logger.warning(f"[CoachingService] Groq failed: {e}. Trying OpenAI fallback...")
                    if hasattr(self, 'openai_client') and self.openai_client:
                        response_text = call_llm(self.openai_client, is_openai=True)
                    else:
                        raise e # No fallback available, raise to trigger _fallback_report
            
            # Attempt OpenAI if it was primary
            elif provider == "openai" and hasattr(self, 'openai_client') and self.openai_client:
                response_text = call_llm(self.openai_client, is_openai=True)
            else:
                raise Exception("No valid LLM client configured")

            # Parse JSON response
            clean = response_text
            if "```json" in clean:
                clean = clean.split("```json")[1].split("```")[0]
            elif "```" in clean:
                clean = clean.split("```")[1].split("```")[0]

            report_data = json.loads(clean.strip())

            scores = CoachingScores(
                filler=     pre_computed_scores["filler"]     if pre_computed_scores else report_data["scores"].get("filler", 50),
                delivery=   pre_computed_scores["delivery"]   if pre_computed_scores else report_data["scores"].get("delivery", 50),
                structure=  pre_computed_scores["structure"]  if pre_computed_scores else report_data["scores"].get("structure", 50),
                vocab=      pre_computed_scores["vocab"]      if pre_computed_scores else report_data["scores"].get("vocab", 50),
                confidence= pre_computed_scores["confidence"] if pre_computed_scores else report_data["scores"].get("confidence", 50),
            )

            report = CoachingReport(
                scores=                scores,
                what_went_well=        report_data.get("what_went_well", ""),
                priority_fix=          report_data.get("priority_fix", ""),
                example_moment=        report_data.get("example_moment"),
                daily_drill=           report_data.get("daily_drill", ""),
                mechanical_tip=        report_data.get("mechanical_tip", ""),
                micro_habit=           report_data.get("micro_habit", ""),
                encouragement=         report_data.get("encouragement", ""),
                content_feedback=      report_data.get("content_feedback", ""),
                focus_area=            focus_area,
                session_number=        session_number,
                transcript_highlights= report_data.get("transcript_highlights", []),
                session_comparison=    report_data.get("session_comparison", ""),
                recurring_patterns=    report_data.get("recurring_patterns", []),
                improvement_noted=     report_data.get("improvement_noted", ""),
                drill_followup=        report_data.get("drill_followup", ""),
                next_session_focus=    report_data.get("next_session_focus", ""),
            )

            logger.info(
                f"[CoachingService] Report done — "
                f"filler={scores.filler}, delivery={scores.delivery}, "
                f"confidence={scores.confidence}"
            )
            return report

        except Exception as e:
            logger.error(f"[CoachingService] All LLM providers failed: {e}")
            return self._fallback_report(focus_area, session_number, pre_computed_scores, speaking_goal)

    def _fallback_report(self, focus_area: str, session_number: int, pre_computed_scores: Optional[dict] = None, speaking_goal: str = "general") -> CoachingReport:
        d = self.FALLBACK_REPORT.copy()
        
        # Inject the actual pre-computed scores so the user doesn't just see 50s everywhere
        if pre_computed_scores:
            d["scores"] = pre_computed_scores

        d["next_session_focus"] = focus_area
        
        # Tailor fallback encouragement based on speaking_goal
        goal_messages = {
            "orator": "Even great orators experience technical pauses. Your analysis is safe; keep practicing your narrative flow.",
            "debater": "A debater must adapt to the unexpected. Analysis was unavailable, but your resilience is key.",
            "interviewer": "Interviews often have technical hiccups. Stay confident; your practice today still matters.",
            "presenter": "Presentations can have tech issues. Keep focusing on clear transitions."
        }
        d["encouragement"] = goal_messages.get(speaking_goal, d["encouragement"])
        d["priority_fix"] = f"Keep practicing for your {speaking_goal} goal. AI Analysis was temporarily unavailable due to server load."

        return CoachingReport(
            scores=CoachingScores(**d["scores"]),
            what_went_well=d["what_went_well"],
            priority_fix=d["priority_fix"],
            example_moment=d["example_moment"],
            daily_drill=d["daily_drill"],
            mechanical_tip=d["mechanical_tip"],
            micro_habit=d["micro_habit"],
            encouragement=d["encouragement"],
            content_feedback=d["content_feedback"],
            focus_area=focus_area,
            session_number=session_number,
            transcript_highlights=d["transcript_highlights"],
            session_comparison=d["session_comparison"],
            recurring_patterns=d["recurring_patterns"],
            improvement_noted=d["improvement_noted"],
            drill_followup=d["drill_followup"],
            next_session_focus=d["next_session_focus"],
        )


coaching_service = CoachingService()
