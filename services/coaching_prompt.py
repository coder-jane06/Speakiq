from services.analysis_builder import SpeechAnalysis

def build_coaching_prompt(analysis: SpeechAnalysis) -> str:
    filler_summary = "\n".join(
        f'  - "{f.word}" — {f.count}x at {", ".join(f"{t:.0f}s" for t in f.timestamps)}'
        for f in sorted(analysis.filler_words, key=lambda x: -x.count)
    )
    hedge_summary = "\n".join(
        f'  - "{h.word}" — {h.count}x'
        for h in sorted(analysis.hedge_words, key=lambda x: -x.count)
    )
    silence_summary = ", ".join(
        f'{s.duration:.1f}s pause at {s.start:.0f}s'
        for s in analysis.silence_gaps if s.duration > 1.5
    )
    goal_instruction = {
        "orator":     "Focus on vocal power, rhetoric, and emotional resonance.",
        "debater":    "Focus on logical structure, rebuttals, and confident assertions.",
        "presenter":  "Focus on clarity, pace, and keeping audiences engaged.",
        "interviewer": "Focus on STAR structure, conciseness, and confident delivery.",
    }.get(analysis.user_goal, "Give balanced feedback across all dimensions.")

    # Difficulty-aware coaching tone
    difficulty = getattr(analysis, "difficulty_tier", "intermediate")
    if difficulty in ("beginner", "easy"):
        difficulty_instruction = (
            "This is a BEGINNER speaker. Be warm, encouraging and positive. "
            "Celebrate what they did well. Focus on only 1-2 key improvements to avoid overwhelm. "
            "Use simple, accessible language. Set expectations appropriate for someone just starting out."
        )
    elif difficulty in ("advanced", "hard"):
        difficulty_instruction = (
            "This is an ADVANCED speaker. Apply professional-grade standards. "
            "Be precise and demanding — point out subtle issues like pacing inconsistencies, "
            "weak transitions, hedging language, and lack of rhetorical sophistication. "
            "Compare to elite speakers in their domain. Push them to excellence."
        )
    else:
        difficulty_instruction = (
            "This is an INTERMEDIATE speaker. Give balanced, honest feedback. "
            "Acknowledge progress while clearly identifying gaps. "
            "Provide specific, actionable improvements with professional benchmarks."
        )

    worst_start = analysis.worst_window.get('start', 0) if isinstance(analysis.worst_window.get('start', 0), (int, float)) else 0

    return f"""You are an expert speech coach. {goal_instruction}

DIFFICULTY LEVEL: {difficulty_instruction}

TOPIC THE USER WAS SPEAKING ON: {analysis.topic}

FULL TRANSCRIPT:
{analysis.transcript}

WORST MOMENT (highest filler density):
"{analysis.worst_window.get('text', 'N/A')}" — {analysis.worst_window.get('filler_count', 0)} fillers in this window (at {worst_start:.0f}s)

DELIVERY METRICS:
- Duration: {analysis.duration_seconds:.0f}s
- Pace: {analysis.words_per_minute:.0f} WPM (ideal: 120–160 WPM)
- Pitch avg: {analysis.avg_pitch_hz:.0f}Hz, variance: {analysis.pitch_variance:.1f} (>40 = expressive, <20 = monotone)
- Vocabulary diversity (TTR): {analysis.type_token_ratio:.2f} (>0.6 = rich, <0.4 = repetitive)
- Speaking confidence indicator: {max(0.0, 1.0 - analysis.tremor_score):.0%}

FILLER WORDS DETECTED (with timestamps):
{filler_summary if filler_summary else "  None detected — excellent!"}

HEDGE WORDS DETECTED:
{hedge_summary if hedge_summary else "  None detected."}

NOTABLE SILENCES:
{silence_summary if silence_summary else "  None over 1.5s."}

INSTRUCTIONS:
1. Open with ONE sentence: overall impression + whether they addressed the topic.
2. Give exactly 3 STRENGTHS. Each must quote ≤8 words from the transcript with its timestamp.
3. Give exactly 3 IMPROVEMENTS. Each must: name the exact problem, cite where it happened (timestamp + quote), explain why it matters, give a concrete fix.
4. Highlight the single WORST MOMENT and explain what went wrong there specifically.
5. Give ONE personalized drill based on their weakest area — something they can do in the next 10 minutes without any app.

Respond ONLY as JSON:
{{
  "overall": "string",
  "strengths": [{{"observation": "", "quote": "", "timestamp_s": 0, "why": ""}}],
  "improvements": [{{"problem": "", "quote": "", "timestamp_s": 0, "why_it_matters": "", "fix": ""}}],
  "worst_moment": {{"quote": "", "timestamp_s": 0, "what_went_wrong": ""}},
  "rewritten_sentences": [{{"original": "", "improved": ""}}],
  "drill": {{"title": "", "instructions": "", "duration_minutes": 10}},
  "scores": {{"overall": 0, "delivery": 0, "vocabulary": 0, "filler_control": 0, "structure": 0, "confidence": 0}}
}}
"""

