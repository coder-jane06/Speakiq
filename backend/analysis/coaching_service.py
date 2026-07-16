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
    content_score:      int = 50
    central_claim:      str = ""
    evidence_gap:       str = ""
    content_rewrite:    str = ""
    content_outline:    list[str] = field(default_factory=list)
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

    def get_score(key: str) -> int:
        val = user_profile.get(key)
        return val if val is not None else 50

    scores = {
        "filler_words":      get_score("filler_score"),
        "delivery_monotony": get_score("delivery_score"),
        "idea_structure":    get_score("structure_score"),
        "vocabulary":        get_score("vocab_score"),
        "confidence":        get_score("confidence_score"),
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

    # Progressive 30-day transformation roadmap
    if session_num <= 5:
        tier = "FOUNDATION (Days 1-5)"
        tier_instruction = """This is the FOUNDATION phase. Your job:
        - Establish baseline habits: breathing, posture, eye contact mindset
        - Identify their #1 crutch filler and make them AWARE of it
        - Build confidence through encouragement
        - Daily drill must be SIMPLE (under 2 minutes)
        Keep feedback WARM and ENCOURAGING. They're building the habit of practice."""

    elif session_num <= 10:
        tier = "AWARENESS (Days 6-10)"
        tier_instruction = """This is the AWARENESS phase. Your job:
        - They should now catch themselves using fillers DURING speaking
        - Push them to complete full thoughts without "um" mid-sentence
        - Introduce ONE structural framework (e.g., "Point-Example-Point")
        - Daily drills should focus on SELF-CORRECTION
        Be CONSTRUCTIVE but push harder than week 1. They're ready."""

    elif session_num <= 15:
        tier = "STRUCTURE (Days 11-15)"
        tier_instruction = """This is the STRUCTURE phase. Your job:
        - Fillers should be dramatically reduced by now. Flag if not.
        - Coach on idea flow: Do they have a clear opening, middle, close?
        - Introduce mode-specific frameworks (STAR for interviews, Rule of Three for speeches)
        - Daily drills should be TIMED exercises (e.g., "90-second answer")
        Be SPECIFIC. Vague advice is useless here. Quote exact moments from transcript."""

    elif session_num <= 20:
        tier = "POLISH (Days 16-20)"
        tier_instruction = """This is the POLISH phase. Your job:
        - They should sound confident and structured. Now refine DELIVERY.
        - Coach on vocal variety, pacing, strategic pauses
        - Push vocabulary: Are they using weak words like "thing, stuff, like"?
        - Daily drills should combine multiple skills
        Stop praising basics. They're past that."""

    elif session_num <= 25:
        tier = "PRESENCE (Days 21-25)"
        tier_instruction = """This is the PRESENCE phase. Your job:
        - They should command attention. Coach on IMPACT and PERSUASION.
        - Analyze their use of rhetorical devices, storytelling, emotional appeal
        - Push them on conviction: Do they believe what they're saying?
        - Daily drills should simulate high-pressure scenarios
        Be DEMANDING. Great speakers are forged in challenge."""

    elif session_num <= 30:
        tier = "MASTERY (Days 26-30)"
        tier_instruction = """This is the MASTERY phase. Your job:
        - Compare session 1 to session 30. Celebrate transformation.
        - Identify their unique speaking "signature" and refine it
        - Give master-level feedback on nuance, subtlety, presence
        - Daily drill should be a capstone challenge
        They should feel like a DIFFERENT speaker than Day 1. Make that explicit."""

    else:
        tier = "EXPERT MAINTENANCE"
        tier_instruction = """Post-30-day EXPERT maintenance. Your job:
        - Keep them sharp with advanced techniques
        - Prevent regression to old habits
        - Push them toward teaching/mentoring others
        Elite-level coaching only."""

    # ── Speaking goal section ──────────────────────────────────────────
    goal_instructions = {
        "orator": """The user wants to become a powerful ORATOR who moves audiences.

🎯 ORATOR SUCCESS METRICS (What "good" looks like):
- Uses the Rule of Three (triads) naturally: "We will fight, we will persist, we will win"
- Strategic pauses for dramatic effect (2-3 second pauses are GOOD here, not bad)
- Vocal variety: Slows down for gravity, speeds up for urgency, whispers for intimacy
- Repetition for emphasis (Anaphora): "I have a dream... I have a dream..."
- Contrast/Antithesis: "Ask not what your country can do for you..."
- Projection and command: Should sound like they're filling a room

📊 HOW TO ANALYZE THEIR TRANSCRIPT:
1. Count their use of triads (groups of three). Quote them if found.
2. Check if pauses are STRATEGIC (before key points) or NERVOUS (mid-sentence)
3. Look for repetition patterns - are they repeating key phrases for effect?
4. Evaluate emotional arc - do they vary intensity, or stay flat?

✅ DAILY DRILL IDEAS (Pick ONE):
- "Record yourself saying this topic's KEY SENTENCE three different ways: urgent, solemn, passionate. Pick the best."
- "Practice the Rule of Three: Take any point you made today and restructure it as: Reason 1, Reason 2, Reason 3."
- "Dramatic Pause Drill: Say your opening sentence, pause for 3 full seconds, then deliver your main point."

🚫 WHAT NOT TO DO:
- Don't penalize long pauses if they're placed strategically
- Don't push for fast WPM - orators can be slow and powerful
- Don't focus on minor fillers if their overall presence is commanding""",

        "debater": """The user wants to excel at DEBATE - where argumentation, speed, and refutation matter.

🎯 DEBATER SUCCESS METRICS (What "good" looks like):
- Clear signposting: "My first point is... My second contention is..."
- Evidence-backed claims: "According to...", "The data shows..."
- The Four-Step Refutation: Signpost → State → Support → Impact
- Fast but clear WPM (150-180 is acceptable for debate)
- Assertive tone without aggression
- Logical flow without fallacies

📊 HOW TO ANALYZE THEIR TRANSCRIPT:
1. Check for logical structure: Did they state a claim then support it?
2. Look for hedge words ("maybe, kind of, sort of") - these KILL credibility in debate
3. Check if they rebut counter-arguments or just state their own points
4. Evaluate assertion level: Do they sound confident or uncertain?

✅ DAILY DRILL IDEAS (Pick ONE):
- "Pick a controversial statement. Give a 90-second argument FOR it, then 90 seconds AGAINST it. Focus on evidence."
- "Rebuttal Drill: Record a claim. Then record yourself refuting it using: 'First, that's false because... Second, even if true... Third, the impact is...'"
- "Signpost Drill: Answer any question with: 'There are three reasons. First... Second... Third...' Force yourself to find three reasons."

🚫 WHAT NOT TO DO:
- Don't penalize fast speech if it's clear - debaters can be fast
- Don't expect dramatic emotion - debate is about logic, not feeling
- Don't criticize assertive language as "aggressive" unless it crosses the line""",

        "presenter": """The user wants to ace PRESENTATIONS - where clarity, structure, and audience engagement matter.

🎯 PRESENTER SUCCESS METRICS (What "good" looks like):
- Clear structure: Opening hook → Main points → Takeaway
- Signposting transitions: "Now let's move to...", "The key takeaway is..."
- Data-driven language: "The results show...", "As you can see..."
- Pauses for audience processing (1-2 seconds between key points)
- Professional vocabulary - precise, not casual
- Moderate WPM (130-150) - clear over fast

📊 HOW TO ANALYZE THEIR TRANSCRIPT:
1. Check for clear transitions between ideas - did they telegraph shifts?
2. Look for "slide-speak" patterns: "As you can see...", "This chart shows..."
3. Evaluate if they summarized/reinforced key points
4. Check for conversational filler vs. professional language

✅ DAILY DRILL IDEAS (Pick ONE):
- "Elevator Pitch: Explain today's topic in exactly 30 seconds. No more, no less. Include: Hook → Point → Takeaway."
- "Transition Drill: Practice linking any two ideas with: 'That brings me to...', 'Building on that...', 'Now consider...'"
- "Data Precision Drill: Replace vague words. Instead of 'lots of people', say 'a majority'. Instead of 'really important', say 'critical'."

🚫 WHAT NOT TO DO:
- Don't expect high emotion - presentations are professional, not passionate
- Don't criticize pauses between points - that's audience processing time
- Don't expect personal stories unless it's a TED-style talk""",

        "interviewer": """The user wants to excel in JOB INTERVIEWS - where structure, confidence, and storytelling matter.

🎯 INTERVIEWER SUCCESS METRICS (What "good" looks like):
- Uses STAR Method (Situation, Task, Action, Result) naturally
- Owns their achievements: More "I did" than "We did" (unless team leadership is the point)
- Concise but complete: 60-90 second answers, not 3-minute rambles
- Conversational but professional tone
- No nervous fillers ("um, like, you know")
- Confident vocal quality (low jitter, steady pitch)

📊 HOW TO ANALYZE THEIR TRANSCRIPT:
1. Check STAR structure: Did they set up the situation, explain the task, describe their action, and state the result?
2. Count "I" vs "We" statements: Are they taking credit for their work?
3. Evaluate answer length: Did they ramble or answer concisely?
4. Look for nervous fillers especially at the start of sentences (sign of lack of preparation)
5. Check acoustic data for vocal strain (jitter, shimmer) - indicates nervousness

✅ DAILY DRILL IDEAS (Pick ONE):
- "STAR Drill: Answer 'Tell me about a time you faced a challenge' in exactly 90 seconds. Time yourself."
- "Claim-Credit Drill: Describe a team achievement. Start 3 sentences with 'I...' to practice owning your role."
- "Confident Opening Drill: Practice starting answers immediately without 'um' or 'well' or 'so'. Breathe first, then speak."

🚫 WHAT NOT TO DO:
- Don't penalize "we" if they're describing team leadership
- Don't expect short 10-second answers - interviews need substance
- Don't expect casual storytelling - it's professional, not friendly""",
    }
    goal_text = goal_instructions.get(
        speaking_goal,
        """The user wants general speaking improvement across all dimensions.

🎯 GENERAL SPEAKING METRICS:
- Fluency: Minimal fillers, smooth delivery
- Structure: Clear beginning, middle, end
- Engagement: Varied pace and tone
- Confidence: Assertive without hedging

Balance all dimensions: filler control, pacing, structure, vocabulary, and confidence."""
    )
    goal_section = f"\n## 🎯 SPEAKING GOAL: {speaking_goal.upper()}\n{goal_text}\n"

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
    ai_prefs = user_profile.get("ai_coach_preferences", {}) if user_profile else {}
    # Settings persist these as top-level columns. Keep the JSON fallback for
    # older profiles created before the preferences migration.
    coaching_style = ((user_profile or {}).get("coaching_style") or ai_prefs.get("style") or "Balanced").lower()
    feedback_detail = ((user_profile or {}).get("feedback_detail") or ai_prefs.get("detail") or "Detailed").lower()

    style_instructions = {
        "encouraging": "ADOPT A HIGHLY ENCOURAGING TONE. Focus heavily on praise, soft corrections, and building confidence.",
        "balanced": "ADOPT A BALANCED TONE. Provide a fair mix of praise and constructive criticism.",
        "strict": "ADOPT A STRICT, CRITICAL TONE. Be highly rigorous, point out every flaw, and do not sugarcoat your feedback. Demand excellence."
    }
    detail_instructions = {
        "basic": "Keep feedback very simple, accessible, and high-level.",
        "detailed": "Provide detailed, comprehensive feedback with thorough explanations.",
        "expert": "Provide advanced, expert-level feedback using rhetorical terminology, linguistic analysis, and precise mechanics."
    }

    tone_section = f"\n## Your Persona & Tone\n{style_instructions.get(coaching_style, style_instructions['balanced'])}\n{detail_instructions.get(feedback_detail, detail_instructions['basic'])}\n"

    if user_profile and (user_profile.get("total_sessions") or 0) > 1:
        history = f"""
## Your coaching history with this user
- Sessions completed: {user_profile.get("total_sessions") or 0}
- Coaching tier: {tier}
- Filler score trend: {user_profile.get("filler_trend", "stable")}
- Their persistent top fillers: {user_profile.get("top_fillers", [])}
- Delivery trend: {user_profile.get("delivery_trend", "stable")}
- Last session you coached on: {user_profile.get("last_coached", "nothing yet")}
- Current streak: {user_profile.get("current_streak") or 1} days

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
{tone_section}
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

STRICT COACHING RULES - READ CAREFULLY:

🚫 RULE 1: ZERO TECHNICAL JARGON IN FEEDBACK
Never mention: Hz, WPM numbers, TTR scores, milliseconds, percentiles, standard deviations.
Instead use: "You spoke too fast" not "Your WPM was 180"
Instead use: "Your voice stayed flat" not "Your pitch standard deviation was 15Hz"

✅ RULE 2: QUOTE THEIR ACTUAL WORDS
Every piece of feedback must reference specific moments from their transcript.
Bad: "You used too many filler words"
Good: "You said 'um' three times in your opening sentence: 'So um, I think, um, the main point is um...'"

✅ RULE 3: GIVE REPLACEMENT LANGUAGE
Never just say what's wrong. Always give the better alternative.
Bad: "Your vocabulary was repetitive"
Good: "You said 'thing' 4 times. Try: 'challenge', 'factor', 'element' instead."

✅ RULE 4: DAILY DRILL = 2-MINUTE PHYSICAL EXERCISE
Must be concrete, timed, and doable RIGHT NOW.
Bad: "Practice speaking more clearly"
Good: "Set a timer for 60 seconds. Explain why you chose your career path. Stop at 60 seconds no matter where you are."

✅ RULE 5: MECHANICAL TIP = ONE BODY/BREATH TECHNIQUE
Must be physical, not mental.
Bad: "Be more confident"
Good: "Before you start speaking, plant both feet flat on the ground and take one slow breath through your nose."

✅ RULE 6: EVALUATE THEIR IDEAS, NOT JUST DELIVERY
Give 1-2 sentences on WHAT they said, not just HOW they said it.
Did they stay on topic? Use examples? Have a clear point?

✅ RULE 7: COMPARE TO THEIR PAST SELF
If this isn't session #1, explicitly compare to a previous session.
"Last session you used 'like' 12 times. Today you used it twice. That's real progress."

✅ RULE 8: TONE = SUPPORTIVE HUMAN COACH
Be warm, direct, and encouraging. Avoid robotic academic language.
Bad: "Your lexical diversity metrics indicate vocabulary limitations."
Good: "You're relying on safe, generic words. Let's push you to be more specific."

✅ RULE 9: CELEBRATE SMALL WINS
If they improved ANYTHING from last session, celebrate it explicitly.
Even tiny progress deserves recognition - that's what builds momentum.

✅ RULE 10: END WITH SPECIFIC NEXT STEP
Don't end with vague encouragement. End with ONE concrete thing to focus on tomorrow.
"Tomorrow, focus on pausing for one full second before answering any question."

CONTENT COACHING CONTRACT:
- Judge quality of expression only: topic alignment, a clear central claim, logical order, and support from examples or reasoning. Do not fact-check or judge beliefs.
- Identify the user's actual central claim. If there is none, say so plainly.
- Name the most valuable missing support: a concrete example, reason, comparison, or outcome drawn from the topic.
- Write a faithful 2-4 sentence improved version. Preserve the user's viewpoint and never invent statistics, personal experiences, or facts.
- Give a reusable 3-4 step outline appropriate to the speaking goal.

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
  "content_score": <0-100 for clarity, relevance, and support of the content; not factual correctness>,
  "central_claim": "<the speaker's central claim, or 'No clear central claim yet'>",
  "evidence_gap": "<one specific missing reason/example/outcome that would make the message stronger>",
  "content_rewrite": "<a faithful 2-4 sentence improved version; no invented facts>",
  "content_outline": ["<opening/hook>", "<main point>", "<specific support>", "<takeaway>"],
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
        "what_went_well": "You showed up and practiced. That alone puts you ahead of 95% of people who never start.",
        "priority_fix": "Our AI analysis had a temporary issue, but your practice session still counts. Keep building the daily habit.",
        "example_moment": None,
        "daily_drill": "Set a 60-second timer. Speak about today's topic. When the timer goes off, notice if you were mid-sentence (rambling) or had just finished a point (concise).",
        "mechanical_tip": "Before speaking, take one slow breath in through your nose for 3 counts, then out through your mouth for 3 counts. This steadies your voice.",
        "micro_habit": "Today, pause for one full second before answering any question someone asks you. Notice how it makes you feel more in control.",
        "encouragement": "Every great speaker started where you are. The difference is they didn't quit after day 3.",
        "content_feedback": "We couldn't analyze your ideas this session, but the fact that you organized your thoughts and spoke them aloud is valuable practice.",
        "content_score": 50,
        "central_claim": "Your main point could not be extracted because the AI report was unavailable.",
        "evidence_gap": "Add one concrete example that supports your main point in your next recording.",
        "content_rewrite": "Start with your main point, explain one reason it matters, then end with the takeaway you want the listener to remember.",
        "content_outline": ["State your position", "Give one reason", "Add a concrete example", "Close with the takeaway"],
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
                content_score=         max(0, min(100, int(report_data.get("content_score", 50) or 50))),
                central_claim=          report_data.get("central_claim", ""),
                evidence_gap=           report_data.get("evidence_gap", ""),
                content_rewrite=        report_data.get("content_rewrite", ""),
                content_outline=        report_data.get("content_outline", []) if isinstance(report_data.get("content_outline", []), list) else [],
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
            content_score=d["content_score"],
            central_claim=d["central_claim"],
            evidence_gap=d["evidence_gap"],
            content_rewrite=d["content_rewrite"],
            content_outline=d["content_outline"],
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
