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
    coaching_style:    str = "Balanced",
    feedback_detail:   str = "Detailed",
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

    # ── User Personality Profile (trajectory analysis from history) ───────
    personality_section = ""
    if session_history and len(session_history) >= 2:
        skill_trajectories: dict = {"filler": [], "delivery": [], "structure": [], "vocab": [], "confidence": []}
        recurring_fillers: dict = {}
        all_avgs = []
        for s in session_history[-8:]:
            sc = s.get("scores", {})
            if isinstance(sc, str):
                try:
                    import json as _j; sc = _j.loads(sc)
                except Exception:
                    sc = {}
            if sc:
                avgscore = sum(sc.values()) / max(len(sc), 1)
                all_avgs.append(avgscore)
                for skill in skill_trajectories:
                    if skill in sc:
                        skill_trajectories[skill].append(sc[skill])
            for issue in (s.get("top_issues") or []):
                recurring_fillers[issue] = recurring_fillers.get(issue, 0) + 1

        trends = {}
        for skill, vals in skill_trajectories.items():
            if len(vals) >= 2:
                delta = vals[-1] - vals[0]
                trends[skill] = (
                    "rapidly_improving" if delta > 12 else
                    "improving"         if delta > 4  else
                    "stable"            if abs(delta) <= 4 else
                    "regressing"        if delta > -12 else
                    "needs_urgent_work"
                )

        persistent_weak = [s for s, vals in skill_trajectories.items() if vals and sum(vals)/len(vals) < 65]
        natural_strengths = [s for s, vals in skill_trajectories.items() if vals and sum(vals)/len(vals) > 75]
        chronic_issues = [k for k, v in recurring_fillers.items() if v >= 2]
        overall = (
            "dramatically_improving" if len(all_avgs) >= 3 and all_avgs[-1] - all_avgs[0] > 12 else
            "steadily_improving"     if len(all_avgs) >= 2 and all_avgs[-1] - all_avgs[0] > 4  else
            "plateauing"             if len(all_avgs) >= 2 and abs(all_avgs[-1] - all_avgs[0]) <= 4 else
            "declining"              if len(all_avgs) >= 2 and all_avgs[-1] - all_avgs[0] < -4 else
            "early_stage"
        )

        personality_section = f"""
## USER PERSONALITY PROFILE (from {len(session_history)} sessions of data)
Overall trajectory: {overall}
Natural strengths (avg >75): {', '.join(natural_strengths) if natural_strengths else 'still developing'}
Persistent weaknesses (avg <65): {', '.join(persistent_weak) if persistent_weak else 'none yet'}
Chronic issues (recurring 2+ sessions): {', '.join(chronic_issues) if chronic_issues else 'none'}
Skill trends: {', '.join(f'{k}={v}' for k,v in trends.items())}

PERSONALISATION RULES:
- Reference the user's TRAJECTORY explicitly. If plateauing, say so directly.
- If a CHRONIC issue appears today too, escalate urgency — it's now a pattern.
- If a PERSISTENT WEAKNESS showed up today, make it the absolute top priority.
- If a NATURAL STRENGTH performed well today, briefly acknowledge and move on.
- NEVER give the same advice as the previous session.
"""


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

    # NLP data (human-readable, not raw numbers in coaching text)
    if nlp_result:
        filler_rate = nlp_result.fillers_per_minute
        filler_label = (
            "excellent (very few fillers)"   if filler_rate < 0.8 else
            "good (minor habit)"             if filler_rate < 2.0 else
            "moderate (noticeable pattern)"  if filler_rate < 4.0 else
            "high (fillers dominate speech)"
        )
        ttr = nlp_result.ttr_score
        vocab_label = (
            "very repetitive"  if ttr < 0.30 else
            "limited range"    if ttr < 0.42 else
            "good diversity"   if ttr < 0.60 else
            "excellent range"
        )
        power_count = getattr(nlp_result, "power_word_count", 0)
        power_label = (
            "no assertive language detected" if power_count == 0 else
            f"{power_count} power phrase(s) — confident, authoritative language"
        )
        nlp = f"""- Filler words: {nlp_result.filler_count} total — {filler_label}
- Top fillers used: {dict(list(nlp_result.filler_detail.items())[:5])}
- Vocabulary: {vocab_label} (TTR={ttr:.2f})
- Hedge words: {nlp_result.hedge_word_count} found ({nlp_result.hedge_words_found[:4]})
- Authority language: {power_label}
- Sentences: {nlp_result.sentence_count}, avg {nlp_result.avg_sentence_length:.0f} words each
- Incomplete sentences: {nlp_result.incomplete_sentence_count}"""
    else:
        nlp = "Language data unavailable."


    focus_map = {
        "filler_words":      "Focus ONLY on filler word usage. Reference specific fillers from the data.",
        "pacing":            "Focus ONLY on speech rate and pausing patterns.",
        "delivery_monotony": "Focus ONLY on vocal variety. Reference the monotony score.",
        "idea_structure":    "Focus ONLY on how well they organized their ideas.",
        "vocabulary":        "Focus ONLY on vocabulary diversity. Reference the TTR score.",
        "confidence":        "Focus ONLY on confident, assertive delivery.",
    }
    focus_instruction = focus_map.get(focus_area, "Focus on the weakest area.")

    # ── Coaching style tone instruction ──────────────────────────────────────
    style_instructions = {
        "Encouraging": """TONE RULE: This user wants encouragement. Lead with genuine positives. Frame every critique 
as a growth opportunity. Be warm, celebratory of wins, and never blunt. End with motivation.""",
        "Balanced": """TONE RULE: Balanced coaching. Honest about weaknesses, warm about strengths. 
Don't sugarcoat problems but don't be harsh either. This is the default coaching mode.""",
        "Strict": """TONE RULE: This user wants strict, no-nonsense coaching. Be direct and demanding. 
Minimize praise — they want hard truths. Identify the biggest flaw and attack it directly. 
They can handle criticism and prefer it to empty encouragement.""",
    }
    style_section = style_instructions.get(coaching_style, style_instructions["Balanced"])

    # ── Feedback detail level ─────────────────────────────────────────────────
    detail_instructions = {
        "Basic": """DETAIL LEVEL: Basic. Keep ALL text fields SHORT — 1-2 sentences max each. 
No jargon. Simple actionable steps only. User wants a quick summary, not a deep dive.""",
        "Detailed": """DETAIL LEVEL: Detailed. Give full context for each piece of feedback. 
Include specific examples from the transcript. 2-4 sentences per field is appropriate.""",
        "Expert": """DETAIL LEVEL: Expert. Go deep. Reference specific linguistic patterns, 
acoustic data interpretation, and advanced frameworks. User is sophisticated and wants 
professional-grade analysis. Use precise language. 3-5 sentences per field.""",
    }
    detail_section = detail_instructions.get(feedback_detail, detail_instructions["Detailed"])

    if pre_scores is None:
        pre_scores = {"filler": 50, "delivery": 50, "structure": 50, "vocab": 50, "confidence": 50}

    return f"""You are an elite AI speech coach with deep memory of this user's journey. Return ONLY valid JSON — no extra text.

## USER PREFERENCES (MANDATORY — follow these exactly)
{style_section}
{detail_section}

{goal_section}
{personality_section}
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

SUMMARY QUALITY RULES:
- Do not write generic feedback. Every summary field must mention either a specific phrase from the transcript, the user's topic, or the exact speaking behavior detected.
- Pick one bottleneck only. The priority_fix should name the highest-leverage issue for the next session, not list multiple problems.
- Connect cause to effect. Explain how the behavior changed listener trust, clarity, energy, or persuasion.
- Make the daily_drill operational: include the exact reps, timing, and success criterion.
- If the transcript is short or thin, say that the main issue is low evidence/low elaboration and coach them to expand with one example.
- Avoid vague compliments like "good job" unless followed by the specific behavior that made it good.

Return ONLY this JSON, no other text. MATCH the specificity shown in the GOOD examples — the AI will be evaluated on quality:
{{
  "scores": {{
    "filler": <copy from pre-calculated>,
    "delivery": <copy from pre-calculated>,
    "structure": <copy from pre-calculated>,
    "vocab": <copy from pre-calculated>,
    "confidence": <copy from pre-calculated>
  }},
  "what_went_well": "<BAD example: 'You did great staying on topic.' GOOD example: 'When you opened with the contrast between X and Y, you gave the listener an immediate anchor — that rhetorical setup is exactly what top speakers use. Your closing sentence also had conviction: you stated your position without hedging.'>",
  "priority_fix": "<BAD: 'Use fewer filler words.' GOOD: 'Your like-habit fires every time you shift between ideas — it showed up 8 times at topic transitions. Replace it with a deliberate pause: close your mouth, think the next word, then say it. Listeners never notice a half-second gap; they always notice the verbal tic.'>",
  "example_moment": "<Quote one REAL phrase from the transcript. Format exactly: SAID: [quote] -> INSTEAD: [better version with explanation]. BAD: 'You trailed off.' GOOD: 'SAID: ...and I think maybe it could be useful for people -> INSTEAD: This will save most professionals 2 hours a week. Own the claim, cut the hedge, end with a fact.'>",
  "daily_drill": "<2-minute drill with numbered steps and success criterion. BAD: 'Practice speaking clearly.' GOOD: '1. Take the topic sentence from today. 2. Say it out loud normally. 3. Say it again but pause instead of any filler. 4. Repeat 5x. SUCCESS: You pause deliberately. That silence will feel too long — that feeling means it is working.'>",
  "mechanical_tip": "<One physical technique. BAD: 'Breathe deeply.' GOOD: 'Before you start speaking, inhale slowly for 4 counts through your nose, hold for 2, exhale for 6 through your mouth. This resets your vocal cords and drops your speaking rate without any conscious effort.'>",
  "micro_habit": "<One behaviour to catch TODAY in casual talk — specific to their exact weakness detected. BAD: 'Notice filler words.' GOOD: 'Every time you start a new thought today, try to begin with the noun — not so, not like, not um. Just the subject of your sentence. Count how many times you manage it.'>",
  "encouragement": "<One sentence, warm and specific. BAD: 'Keep it up!' GOOD: 'The discipline to practice on a topic this challenging is exactly what separates speakers who improve from those who plateau — you showed that today.'>",
  "content_feedback": "<2 sentences on the IDEAS only — structure, argument, use of examples. BAD: 'You had good content.' GOOD: 'Your central argument was clear, but it needed one concrete example to land the point — the claim floated without an anchor. Next time, follow your main point immediately with a specific case or stat and the impact triples.'>",
  "transcript_highlights": [{{"text": "<exact quoted phrase from transcript>", "type": "filler_cluster|hedge_words|rushed|strong_moment|incomplete", "suggestion": "<specific rewrite, or why the strong moment worked>"}}],
  "session_comparison": "<1-2 sentences using actual trend data. BAD: 'You improved.' GOOD: 'Your filler rate dropped by half since last session — the pause drill is working. Delivery variety is now the main lever left.' Or empty string if first session.>",
  "recurring_patterns": ["<Only if appeared in 3+ sessions. Use precise labels: trailing_sentence_endings, over_reliance_on_basically, weak_opening_words>"],
  "improvement_noted": "<Specific improvement from past data with evidence. BAD: 'You improved.' GOOD: 'Three sessions ago you averaged 6 fillers per minute; today it was under 2. That is a measurable result from consistent work.' Or empty string.>",
  "drill_followup": "<Specific comment on last drill based on today's results. BAD: 'Good work.' GOOD: 'Last session I asked you to pause instead of filling — and today's numbers show it stuck. The habit is forming.' Or empty string if no history.>",
  "next_session_focus": "<filler_words|delivery_monotony|idea_structure|vocabulary|confidence>"
}}

Pre-calculated scores (COPY THESE EXACTLY into the scores field):
{{
  "filler": {pre_scores["filler"]},
  "delivery": {pre_scores["delivery"]},
  "structure": {pre_scores["structure"]},
  "vocab": {pre_scores["vocab"]},
  "confidence": {pre_scores["confidence"]}
}}

Your scores field must match those numbers exactly. ALL creative energy goes into the coaching text fields."""


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
        
        # --- 0-Word Fast Fail ---
        if transcript_result and transcript_result.word_count == 0:
            logger.info("[CoachingService] 0 words detected, bypassing LLM for fast fail report.")
            return CoachingReport(
                scores=CoachingScores(filler=0, delivery=0, structure=0, vocab=0, confidence=0),
                what_went_well="Nothing to analyze.",
                priority_fix="We couldn't detect any speech. Please check your microphone and try again.",
                example_moment=None,
                daily_drill="Record a 30-second audio check to ensure your microphone is picking up your voice clearly.",
                mechanical_tip="Make sure you are in a quiet environment and your mic is not muted.",
                micro_habit="Do a quick mic test before every session.",
                encouragement="Don't worry, technical issues happen to the best of us!",
                content_feedback="No speech detected.",
                focus_area="microphone_check",
                session_number=session_number,
                transcript_highlights=[],
                session_comparison="",
                recurring_patterns=[],
                improvement_noted="",
                drill_followup="",
                next_session_focus="audio_setup",
            )
            
        provider = getattr(self, 'provider', None)

        if self.client is None and not hasattr(self, 'openai_client'):
            logger.warning("[CoachingService] No client — returning fallback")
            return self._fallback_report(focus_area, session_number, pre_computed_scores, speaking_goal)

        coaching_style = (user_profile or {}).get("coaching_style", "Balanced")
        feedback_detail = (user_profile or {}).get("feedback_detail", "Detailed")

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
            coaching_style=coaching_style,
            feedback_detail=feedback_detail,
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
