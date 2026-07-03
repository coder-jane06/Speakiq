<USER_REQUEST>
# SpeakIQ — Production Master Plan
### From working dev sprint → polished, secure, production-grade AI coaching product

> **Audited:** July 2026 · **Stack:** React + Vite + TypeScript + Tailwind · FastAPI + Python · Supabase PostgreSQL + Storage · faster-whisper · Librosa · spaCy · Groq llama · Docker + Render · GitHub Pages
>
> **The mission:** Make SpeakIQ the app where users *actually see their speaking improve* — not just scores going up, but understanding exactly what's wrong, why it's wrong, and drilling it out. Duolingo for public speaking.

---

## How to read this plan

Tasks are tagged by type:
- 🔴 **Security** — must be done before showing this to anyone
- 🟡 **Core** — the product doesn't work properly without this
- 🟢 **Polish** — significant improvement, low risk
- 🔵 **Feature** — new capability, additive

Each task has: **What**, **Why**, **Exact files to change**, **Acceptance criteria**, and **Removability** (nothing in this plan creates unremovable coupling).

Work phases in strict order. Phases 0–1 are non-negotiable before demo-ing to any recruiter or real user.

---

## Phase 0 — Emergency Security (Day 1, before anything else)

> The repo has real user data and wide-open security holes in a public repository. This is not optional.

---

### 0.1 Purge `user_details.json` from git history 🔴

**What:** `fetch_user_details.py` dumps real Supabase user emails, IDs, and sign-in timestamps to `user_details.json`, which is committed to the public repo. Real people's data is publicly accessible right now.

**Fix:**
```bash
# Install BFG Repo Cleaner
brew install bfg   # or download the .jar

# Nuke it from history
bfg --delete-files user_details.json
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force

# Prevent recurrence
echo "user_details.json" >> .gitignore
echo "*.json" >> .gitignore   # for any future debug exports
```

**Acceptance criteria:** `git log --all --full-history -- user_details.json` returns nothing.

---

### 0.2 Remove hardcoded UUID from `check_streak.py` 🔴

**What:** A real Supabase user UUID is hardcoded on line 5 of a public file. Anyone can query your DB for this user's data.

**Fix in `check_streak.py`:**
```python
import sys
user_id = sys.argv[1] if len(sys.argv) > 1 else None
if not user_id:
    print("Usage: python check_streak.py <user_id>")
    sys.exit(1)
```

**Verify clean:** `grep -r "[0-9a-f]\{8\}-[0-9a-f]\{4\}" . --include="*.py"` → zero results.

---

### 0.3 Lock CORS to your production domain 🔴

**What:** `main.py` uses `allow_origin_regex=".*"` — any website in the world can call your API.

**Fix in `main.py`:**
```python
import os

ALLOWED_ORIGINS = (
    ["*"]
    if os.getenv("ENVIRONMENT") == "development"
    else ["https://coder-jane06.github.io"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Acceptance criteria:** A `curl` from an unknown origin returns a CORS error on production.

---

### 0.4 Add JWT authentication to all API routes 🔴

**What:** `/sessions/upload`, `/sessions/{id}`, and `/dashboard` have zero user verification. The Render API URL is publicly visible in `test_flow.py`. `PyJWT` is already in `requirements.txt` — just wire it up.

**Create `auth.py`:**
```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from config import get_settings

bearer = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer)
):
    token = credentials.credentials
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated"
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

**Apply to every router:**
```python
# routers/sessions.py, routers/dashboard.py
from auth import get_current_user

@router.post("/upload")
async def upload(user=Depends(get_current_user), ...):
    user_id = user["sub"]  # Supabase user UUID
```

**Frontend — pass JWT on every request:**
```typescript
const { data: { session } } = await supabase.auth.getSession()
const headers = { Authorization: `Bearer ${session?.access_token}` }
```

**Add to `config.py` Settings:**
```python
supabase_jwt_secret: str = os.getenv("SUPABASE_JWT_SECRET", "")
# Get from: Supabase Dashboard → Settings → API → JWT Secret
```

**Acceptance criteria:** Unauthenticated request → 401. Authenticated request → works.

---

### 0.5 Fix anon key / service key confusion in `config.py` 🔴

**What:** `config.py` falls back to `VITE_SUPABASE_ANON_KEY` as the `supabase_service_key`. These are completely different credentials. The anon key is safe to expose client-side. The service key bypasses RLS entirely — it must never touch the frontend.

**Fix:**
- Remove the `frontend_env` fallback entirely from `config.py`
- Backend `.env` must have its own `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Add a startup assertion:
```python
# In lifespan or startup
settings = get_settings()
if settings.supabase_service_key.startswith("eyJ") and len(settings.supabase_service_key) < 300:
    raise RuntimeError("SUPABASE_SERVICE_KEY looks like an anon key. Check your .env.")
```

**Acceptance criteria:** `config.py` has zero reference to `VITE_` variables.

---

### 0.6 Add file validation on audio upload 🔴

**What:** `test_flow.py` shows the API accepts `b"fake audio data" * 100` as valid audio. No MIME type or size check exists.

**Add to upload route:**
```python
ALLOWED_MIME_TYPES = {"audio/webm", "audio/wav", "audio/mp4", "audio/mpeg", "audio/ogg"}
MAX_SIZE_MB = 50

async def validate_audio(audio: UploadFile) -> bytes:
    if audio.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, f"Unsupported format: {audio.content_type}")
    content = await audio.read()
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(413, f"File too large (max {MAX_SIZE_MB}MB)")
    await audio.seek(0)
    return content
```

**Acceptance criteria:** `.txt` file upload → 400. 200MB file → 413. Valid audio → 201.

---

### 0.7 Add rate limiting 🔴

**What:** No rate limiting means one person can drain your entire Groq quota in minutes.

**Add `slowapi` (already works with FastAPI):**
```python
# requirements.txt: slowapi>=0.1.9

# main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# In router
@router.post("/upload")
@limiter.limit("10/hour")
async def upload(request: Request, ...):
    ...
```

**Acceptance criteria:** 11th upload in an hour → 429 with clear error message.

---

## Phase 1 — Make the Core Product Actually Work (Days 2–5)

> Whisper transcribes. Librosa analyses. spaCy finds fillers. Groq coaches. But right now these pipelines almost certainly don't talk to each other properly — Groq likely gets a generic prompt with no transcript, no timestamps, no filler positions. This phase fixes the entire coaching pipeline end-to-end.

---

### 1.1 Build a unified analysis payload 🟡

**What:** Everything the pipeline produces needs to be consolidated into one structured object before anything gets sent to Groq. Right now each service runs independently with no shared structure.

**Create `services/analysis_builder.py`:**
```python
from dataclasses import dataclass, field
from typing import List

@dataclass
class WordEntry:
    word: str
    start: float   # seconds from Whisper word_timestamps
    end: float

@dataclass
class FillerOccurrence:
    word: str
    count: int
    timestamps: List[float]  # seconds of each occurrence

@dataclass
class SilenceGap:
    start: float
    end: float
    duration: float

@dataclass
class SpeechAnalysis:
    # From faster-whisper
    transcript: str
    words: List[WordEntry]
    duration_seconds: float

    # From Librosa
    words_per_minute: float
    avg_pitch_hz: float
    pitch_variance: float       # high = expressive, low = monotone
    tremor_score: float         # 0-1, from pitch jitter — high = nervous

    # From spaCy
    filler_words: List[FillerOccurrence]
    hedge_words: List[FillerOccurrence]   # "I think", "kind of", "maybe"
    sentences: List[str]
    type_token_ratio: float     # vocabulary diversity: unique/total words

    # From pipeline
    silence_gaps: List[SilenceGap]
    worst_window: dict          # {"text": "...", "filler_count": 4, "start": 23.1}
    topic: str
    user_goal: str              # from user_profiles.speaking_goal
```

**Acceptance criteria:** Pipeline returns a fully populated `SpeechAnalysis` object for any valid audio.

---

### 1.2 Write a grounded, transcript-aware Groq coaching prompt 🟡

**What:** This is the single most impactful change in the entire project. The AI coaching must quote your actual words, reference actual timestamps, and adapt to your actual goal.

**Create `services/coaching_prompt.py`:**
```python
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

    return f"""You are an expert speech coach. {goal_instruction}

TOPIC THE USER WAS SPEAKING ON: {analysis.topic}

FULL TRANSCRIPT:
{analysis.transcript}

WORST MOMENT (highest filler density):
"{analysis.worst_window.get('text', 'N/A')}" — {analysis.worst_window.get('filler_count', 0)} fillers in this window (at {analysis.worst_window.get('start', 0):.0f}s)

DELIVERY METRICS:
- Duration: {analysis.duration_seconds:.0f}s
- Pace: {analysis.words_per_minute:.0f} WPM (ideal: 120–160 WPM)
- Pitch avg: {analysis.avg_pitch_hz:.0f}Hz, variance: {analysis.pitch_variance:.1f} (>40 = expressive, <20 = monotone)
- Vocabulary diversity (TTR): {analysis.type_token_ratio:.2f} (>0.6 = rich, <0.4 = repetitive)
- Speaking confidence indicator: {1 - analysis.tremor_score:.0%}

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
  "scores": {{"overall": 0, "delivery": 0, "vocabulary": 0, "filler_control": 0, "structure": 0}}
}}
"""
```

**Acceptance criteria:** Groq output quotes real transcript words with timestamps. No generic phrases like "try to speak more clearly" without citing where specifically.

---

### 1.3 Fix background processing to prevent Render timeouts 🟡

**What:** Whisper + Librosa + spaCy + Groq on one file takes 15–60 seconds. Render Starter times out at 30s. The session must return instantly and process in the background.

**Pattern for `routers/sessions.py`:**
```python
from fastapi import BackgroundTasks
from uuid import uuid4

@router.post("/upload", status_code=201)
async def upload_session(
    background_tasks: BackgroundTasks,
    audio: UploadFile,
    topic_id: str = Form(...),
    topic_text: str = Form(...),
    user=Depends(get_current_user)
):
    session_id = str(uuid4())

    # Save audio + create DB row BEFORE returning
    await save_audio_to_storage(session_id, audio)
    await create_session_row(session_id, user["sub"], topic_id, status="processing")

    # Heavy work runs AFTER response is sent
    background_tasks.add_task(process_session_pipeline, session_id, topic_text, user["sub"])

    return {"session_id": session_id, "status": "processing"}


async def process_session_pipeline(session_id: str, topic_text: str, user_id: str):
    try:
        await update_session_status(session_id, "transcribing")
        audio_bytes = await fetch_audio_from_storage(session_id)

        await update_session_status(session_id, "analyzing")
        analysis = await run_full_analysis(audio_bytes, topic_text, user_id)

        await update_session_status(session_id, "generating_feedback")
        coaching = await get_groq_coaching(analysis)

        await update_session(session_id, status="complete", results=coaching,
                             metrics=analysis.__dict__)
    except Exception as e:
        logger.error(f"Session {session_id} failed: {e}")
        await update_session(session_id, status="failed", error=str(e))
```

**Acceptance criteria:** `POST /upload` returns 201 in under 2 seconds. `GET /sessions/{id}` cycles through `processing → transcribing → analyzing → generating_feedback → complete`.

---

### 1.4 Frontend polling with real status states 🟡

**What:** The 15–60s processing window is currently a black box to the user.

**States to show in React:**
```
idle → uploading → transcribing → analyzing → generating feedback → complete (or failed)
```

**Implementation in `Session.page.tsx`:**
```typescript
const STATUS_MESSAGES = {
  uploading:            "Uploading your recording...",
  transcribing:         "Transcribing your speech (Whisper AI)...",
  analyzing:            "Analysing pace, pitch, and filler words...",
  generating_feedback:  "Your coach is reading every word...",
  complete:             "Coaching ready!",
  failed:               "Something went wrong. Try again.",
}

// Poll every 3 seconds
useEffect(() => {
  if (!sessionId || status === "complete" || status === "failed") return
  const interval = setInterval(async () => {
    const { data } = await api.get(`/sessions/${sessionId}`)
    setStatus(data.status)
    if (data.status === "complete") {
      setResults(data.results)
      clearInterval(interval)
    }
  }, 3000)
  return () => clearInterval(interval)
}, [sessionId, status])
```

- Animated step progress bar showing which stage is active
- On `failed`: clear error message + retry button
- On `complete`: auto-scroll to results section

**Acceptance criteria:** User uploading a 2-min recording sees meaningful stage updates throughout, never just a spinner.

---

### 1.5 Live recording cues during the session 🟢

**What:** Zero feedback while speaking. Users could race at 200 WPM with no idea.

**Create `frontend/src/components/session/LiveCues.tsx`:**
- Live pace meter updated every 3s (slow / good / fast) using word timing from Web Speech API
- Subtle amber pulse glow when pace > 180 WPM
- Pause counter
- Live waveform via Web Audio API `AnalyserNode → canvas`

**Also — Safari iOS audio fix (critical for mobile):**
```typescript
const mimeType = MediaRecorder.isTypeSupported("audio/webm")
  ? "audio/webm"
  : "audio/mp4"
const recorder = new MediaRecorder(stream, { mimeType })
```

**Removable:** Delete `LiveCues.tsx` + remove from `Session.page` → gone. Pure frontend.

---

## Phase 2 — The Results Experience (Days 6–9)

> Users get a score. They don't see their words, can't hear their voice, and don't know what to do next. This phase turns the results page into the "aha moment."

---

### 2.1 Annotated transcript viewer — THE highest impact feature 🟡

**What:** Show the full transcript with every word colour-coded inline. This is the moment users realise they said "basically" six times. Without seeing their words, the coaching is abstract.

**Colour scheme:**
- 🔴 Red underline = filler word ("um", "uh", "like", "basically")
- 🟡 Amber underline = hedge phrase ("I think", "kind of", "maybe")
- 🟢 Green highlight = strong, precise vocabulary (positive reinforcement)
- Grey inline chip = `[2.1s pause]` for silences over 1s
- Click any word → audio player jumps to that timestamp

**Create `frontend/src/components/results/TranscriptViewer.tsx`:**
```tsx
interface Word {
  word: string
  start: number
  end: number
  type: "normal" | "filler" | "hedge" | "strong"
}

// Render each word as a <span> with colour based on type
// onClick: audioRef.current.currentTime = word.start
```

**Backend:** Add `GET /sessions/{id}/transcript` returning word array with types — data already exists in `session_metrics.words` and `session_metrics.filler_positions`.

**Removable:** Delete `TranscriptViewer.tsx` + endpoint → gone.

---

### 2.2 Audio playback synced to transcript 🟡

**What:** Users upload audio and never hear it again. Hearing yourself is the single most effective self-coaching technique that exists.

**Create `frontend/src/components/results/AudioPlayer.tsx`:**
- Styled audio player (not the browser default)
- As audio plays, current word in TranscriptViewer highlights
- Click any word in transcript → audio seeks to that point
- Signed Supabase URL so the file isn't public

**Backend:** Add `GET /sessions/{id}/audio-url` returning a signed URL:
```python
url = supabase.storage.from_("audio").create_signed_url(
    path=f"sessions/{session_id}/audio.webm",
    expires_in=3600
)
```

**Removable:** Delete `AudioPlayer.tsx` + remove endpoint → gone.

---

### 2.3 Worst moment highlight card 🟢

**What:** The single worst sentence (highest filler density) surfaced at the top of results. Specific moments change behaviour; general scores don't.

**Create `frontend/src/components/results/WorstMomentCard.tsx`:**
```
Your toughest moment:
"So like, I think the main uh point is basically that..."
4 fillers in 8 words — at 0:23
```

**Data source:** `coaching_results.worst_moment` — already generated in Phase 1.2.

**Removable:** Delete `WorstMomentCard.tsx` → gone. Pure frontend.

---

### 2.4 Before/after sentence rewriter 🟢

**What:** "Use fewer fillers" is useless. Show what your actual words sound like when cleaned up.

**Output from Phase 1.2 already includes `rewritten_sentences`. Just display it:**

```
You said:   "So like, I think climate change is kind of a big deal you know."
Stronger:   "Climate change is the defining challenge of our generation."
```

**Create `frontend/src/components/results/SentenceRewriteCard.tsx`**

**Removable:** Delete `SentenceRewriteCard.tsx` → gone. Pure frontend.

---

### 2.5 Delivery diagnosis gauges 🟢

**What:** "Delivery: 45" tells users nothing. Three visual gauges tell them everything.

**Create `frontend/src/components/results/DeliveryDiagnosis.tsx`:**
```
Pace    [slow ←——●————→ fast]  142 WPM  ✓ In range
Tone    [flat ←——●————→ expressive]  pitch variance 38Hz  ↗ Getting there
Pauses  [none ←————●——→ too many]  4 gaps over 1.5s  ↗ Could use more
```
Each gauge includes a one-line actionable tip based on the user's actual numbers.

**Removable:** Delete `DeliveryDiagnosis.tsx` → gone. Pure frontend.

---

### 2.6 Filler word breakdown chart 🟢

**What:** "7 fillers" is vague. This shows which fillers, how often, and marks them as patterns.

**Create `frontend/src/components/results/FillerBreakdown.tsx`:**
```
"basically"  ██████  6×  (your #1 crutch)
"like"       ████    4×
"um"         ███     3×
"you know"   ██      2×
```

**Data:** Already in `session_metrics.filler_detail`. Pure frontend component.

**Removable:** Delete `FillerBreakdown.tsx` → gone.

---

### 2.7 Personalised drill card 🟢

**What:** The drill must match the user's actual weakest point — not a generic "practice speaking."

| Weakness detected | Drill generated |
|---|---|
| Fillers > 3/min | "30-Second No-Filler Challenge: speak for 30 seconds about your session topic. Replace every 'um' with a silent pause." |
| Pitch variance < 20Hz | "Emotion Shift: take this sentence from your session: '[quote]'. Say it 4 ways: excited, angry, sad, proud." |
| WPM > 170 | "Half-Speed: re-say your opening sentence. Time it. Now say it again taking twice as long using deliberate pauses." |
| TTR < 0.4 | "Power Word Swap: you said '[weak sentence]'. Replace 3 words with stronger alternatives." |
| Hedge overuse | "Definitive Statements: re-say 3 sentences from your session WITHOUT 'I think', 'maybe', or 'kind of'." |

Drills are **self-practice only** — no recording, no AI analysis. This keeps them instant and free.

**Modify `frontend/Results.page.tsx`:** upgrade existing drill card with the type, instructions, and optional countdown timer.

---

## Phase 3 — Auth & User Accounts (Days 10–12)

> Without auth, there are no persistent accounts, no history, and no sessions tied to real users. This should have been built first but requires Phase 0 security work to be in place.

---

### 3.1 Supabase Auth with Google OAuth 🟡

**Steps:**
1. Enable Google OAuth: Supabase Dashboard → Auth → Providers → Google
2. Replace any mock auth in frontend:
```typescript
// Sign in
await supabase.auth.signInWithOAuth({ provider: "google" })

// Persist session on app load
const { data: { session } } = await supabase.auth.getSession()
supabase.auth.onAuthStateChange((_event, session) => {
  setUser(session?.user ?? null)
})
```
3. Gate all routes: redirect to `/login` if no session
4. Pass JWT to all backend calls (Phase 0.4 handles server-side)

Add email/password as fallback.

**Acceptance criteria:** Sign up → record session → close browser → return next day → all previous sessions visible.

---

### 3.2 Onboarding flow 🟢

**What:** New users land with no context. A 3-step onboarding sets goals and makes the first session guided.

**Step 1 — Welcome:** "SpeakIQ coaches your speech using AI. Here's how it works." (30-second explainer)
**Step 2 — Setup:** Name · Speaking goal (Orator / Debater / Presenter / Interviewer) · Experience level
**Step 3 — First session:** Guided recording with a beginner-friendly topic pre-selected

Store `onboarding_complete: true` in `user_profiles`. Skip for returning users.

**Acceptance criteria:** A first-time user knows what to do within 60 seconds of landing.

---

## Phase 4 — Surface What's Already Built (Days 13–15)

> The DB already has `streaks`, `daily_completions`, `user_profiles` with full history. None of it is visible in the frontend. This phase is almost entirely frontend wiring.

---

### 4.1 Progress dashboard with score history 🟢

**New page: `/dashboard`**
- Line chart (Recharts) of overall score per session over time
- Breakdown trend lines: clarity, pace, filler control, vocabulary
- Best session card + improvement % since first session
- "Persistent patterns" alert: "⚠️ 'like' appeared in 8 of your last 10 sessions"

**Backend `GET /dashboard/progress`:**
```python
@dashboard_router.get("/progress")
async def get_progress(user=Depends(get_current_user)):
    sessions = (
        get_db()
        .table("sessions")
        .select("id, created_at, overall_score, delivery_score, filler_count, wpm, pitch_variance")
        .eq("user_id", user["sub"])
        .eq("status", "complete")
        .order("created_at")
        .execute()
    )
    return sessions.data
```

**Acceptance criteria:** User with 5+ sessions sees a score trend chart with per-metric breakdowns.

---

### 4.2 Streak counter + daily nudge 🟢

**What:** The `streaks` table exists. Wire it to the frontend.

**Backend `GET /dashboard/streak`:**
```python
return {
    "current_streak": streak.current,
    "longest_streak": streak.longest,
    "today_done": today_done,
    "freeze_available": streak.freezes_remaining > 0
}
```

**Frontend:** Flame icon + day count on dashboard. If `today_done: false`: "Practice today to keep your streak 🔥"

**Streak freeze** (Phase 0 quick win from the second plan): Users earn 1 freeze every 7 days. Miss a day → auto-applies, streak survives. Add `streak_freezes` column to streaks table and check before breaking streak.

**Removable:** Remove freeze check from streak service → streaks work as before.

---

### 4.3 Session history page 🟢

**New page: `/history`**
- List of all completed sessions: date · topic · overall score · key metric badges
- Click any session → full coaching report
- Filter by date range or topic

**Acceptance criteria:** Users can scroll back through all previous sessions and re-read any coaching report.

---

### 4.4 Personal records system 🟢

**What:** Every session feels the same — no celebration moments.

**After each session, check if any score is a new all-time best:**
```python
# In profile_service.py
if new_score > profile.personal_bests.get("delivery", 0):
    profile.personal_bests["delivery"] = new_score
    new_pbs.append("delivery")
```

**Frontend:** If `new_pbs` array is non-empty, show confetti + "🏆 New Personal Best! Delivery: 94"

**Removable:** Remove PB check from profile service + remove badge from Results → gone.

---

### 4.5 Topics system — visible and usable 🟢

**What:** The `topics` table exists but it's unclear how users interact with it.

**Pre-seed 20+ topics across:**
- Business: investor pitch · meeting update · product demo · status report
- Social: introduction · storytelling · debate · TEDx-style talk
- Academic: lecture · Q&A · seminar presentation
- Interview: tell me about yourself · STAR answers · salary negotiation

Add a topic picker on the record screen. Show "Free practice" as an option. Display the chosen topic on the coaching report so feedback explicitly references it.

---

## Phase 5 — Smarter AI Coaching (Days 16–20)

> Make the AI remember across sessions and escalate when patterns repeat.

---

### 5.1 Pattern recognition with escalating urgency 🟢

**What:** The same generic tip every session teaches nothing. Escalate when patterns persist.

**Logic in `coaching_service.py`:**
```python
def get_escalation_level(word: str, recent_sessions: list) -> str:
    occurrences = sum(1 for s in recent_sessions if word in s.get("top_fillers", []))
    if occurrences >= 5: return "🚨 This is your #1 speech habit. It's time to break it."
    if occurrences >= 3: return f"⚠️ '{word}' has appeared in {occurrences} of your last sessions."
    return ""  # No escalation — first-time mention
```

**Create `frontend/src/components/results/PatternAlert.tsx`:**
Shown at top of results when an escalation is active.

**Removable:** Delete `PatternAlert.tsx` + remove escalation logic from prompt → gone.

---

### 5.2 Goal-adaptive scoring weights 🟢

**What:** An Interviewer cares about STAR structure and conciseness. An Orator cares about emotional resonance and rhetoric. One score system fits nobody perfectly.

**In `analysis/pipeline.py`:**
```python
GOAL_WEIGHTS = {
    "orator":      {"delivery": 0.40, "vocabulary": 0.30, "filler": 0.15, "structure": 0.15},
    "debater":     {"delivery": 0.25, "vocabulary": 0.25, "filler": 0.20, "structure": 0.30},
    "presenter":   {"delivery": 0.30, "vocabulary": 0.25, "filler": 0.25, "structure": 0.20},
    "interviewer": {"delivery": 0.20, "vocabulary": 0.20, "filler": 0.20, "structure": 0.40},
}
```

**Removable:** Reset all weights to 0.25 → back to equal scoring.

---

### 5.3 Mini-curriculum per score band 🟢

**What:** Score of 40 on fillers shows you're bad. But what do you DO about it over the next week?

**Create `frontend/src/components/dashboard/CurriculumCard.tsx`** — static content, no DB needed:
```
Filler Control: 38/100

Week 1 — Awareness: Notice every time you say "um". Don't try to stop yet.
Week 2 — Replace: Pause instead of filling. Silence is confidence.
Week 3 — Flow: Bridge thoughts without filler using connective phrases.
Week 4 — Natural: Fillers below 2/min. Focus on expressiveness now.
```

**Removable:** Delete `CurriculumCard.tsx` → gone. Pure frontend.

---

### 5.4 Topic progression system 🟢

**What:** Beginner topics and expert topics feel the same. No sense of growth.

After 5 sessions averaging > 80 overall → user unlocks Intermediate tier. After 10 sessions averaging > 85 → Advanced.

```python
# In profile_service.py
def check_tier_upgrade(user_id: str, recent_scores: list):
    avg = sum(recent_scores[-5:]) / 5
    if avg > 85 and profile.tier == "intermediate":
        profile.tier = "advanced"
        return {"upgraded": True, "new_tier": "advanced"}
```

Show a "You graduated! 🎓 Advanced topics unlocked" modal on next login.

**Removable:** Remove tier filter from sessions.py → all topics available to everyone.

---

## Phase 6 — Habit Engine (Days 21–25)

> Streaks are not enough. Users need challenge, proof of improvement, and re-engagement.

---

### 6.1 Shareable score cards 🟢

**What:** No organic growth, no social proof. One-tap share generates a card.

**Create `frontend/src/components/ShareCard.tsx`** — uses `html2canvas` → PNG → native Web Share API:
```
┌─────────────────────────┐
│  🎙️ SpeakIQ             │
│  Session #14            │
│                         │
│  Overall: 84 ↑ +12      │
│  Filler: 92  Pace: 78   │
│                         │
│  "Basically" gone! 🏆   │
│  14-day streak 🔥       │
└─────────────────────────┘
```

**Removable:** Delete `ShareCard.tsx` + remove button from Results → gone. Pure frontend.

---

### 6.2 Weekly progress email 🔵

**What:** Users forget the app exists without re-engagement.

**Create `backend/services/email_service.py`** using Resend (free tier: 3,000 emails/month):
```python
import resend

def send_weekly_digest(user_email: str, stats: dict):
    resend.Emails.send({
        "from": "coach@speakiq.ai",
        "to": user_email,
        "subject": f"Your week in speaking — {stats['sessions']} sessions, streak: {stats['streak']} 🔥",
        "html": render_weekly_template(stats)
    })
```

Schedule via Supabase Edge Function (cron: Monday 9am IST).

**Removable:** Delete `email_service.py` + disable cron → gone.

---

### 6.3 Weekly challenge system 🔵

**What:** Beyond streaks, rotating challenges give users a concrete goal.

**Rotating challenges:**
- "🎯 Filler-Free Friday — complete a session with under 2 fillers"
- "⚡ Pace Week — stay under 150 WPM for 3 sessions"
- "🏔️ Consistency — 7 sessions in 7 days"
- "📚 Vocabulary — achieve TTR > 0.6 in any session"

**New files:** `backend/routers/challenges.py` · `frontend/src/components/dashboard/ChallengeCard.tsx` · DB: `challenges` + `user_challenge_progress` tables.

**Removable:** Delete both files + drop tables → gone.

---

### 6.4 Anonymous percentile leaderboard 🔵

**What:** Solo practice has no social motivation.

**Dashboard sidebar:** "You're in the top 31% for vocabulary this week."

**Backend:** Aggregate stats endpoint in `dashboard.py` — compares user's metric against weekly averages across all users (anonymised).

**Removable:** Delete leaderboard card + remove endpoint → gone.

---

## Phase 7 — Code Quality & Repo Health (Days 26–28)

---

### 7.1 Clean up repo root 🟢

Every debug script must leave root:

```
scripts/
  db/         apply_sql.py · check_streak.py · count_users.py
              fetch_user_details.py (sanitised) · reset_password.py
              update_profile.py · verify.py · verify2.py
              find_account_29_sessions.py
  deploy/     hf_deploy.py · poll_hf.py · get_hf_logs.py
  test/       test_flow.py · test_deep_settings.py
              test_get_session.py · test_upload_script.py
              generate_snapshot.py · generate_spoken.py
```

Add to `.gitignore`:
```
build_logs.txt
home_diff.txt
*.wav
spoken.wav
test.webm
user_details.json
recover.js
__pycache__/
*.pyc
.env
frontend/.env
```

**Acceptance criteria:** `ls *.py` in root returns only `main.py` and `config.py`.

---

### 7.2 Fix Dockerfile — remove HF artifacts 🟢

The app is on Render, not Hugging Face Spaces. Port 7860 is an HF artifact.

```dockerfile
# Remove hardcoded port
EXPOSE ${PORT:-8000}
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]

# Remove `git` from apt-get — it's a build tool, not a runtime dependency
# Saves ~30MB from image size
```

---

### 7.3 Remove unused AI provider dependencies 🟢

`requirements.txt` has `openai`, `anthropic`, and `groq`. If only Groq is active:

- Remove `openai>=1.35.0` and `anthropic>=0.29.0`
- Saves ~50MB from Docker image, reduces cold start time on Render

---

### 7.4 Supabase client singleton 🟢

`get_db()` currently calls `create_client()` on every request. Under load, httpx pools are rebuilt constantly.

```python
# services/db.py
from supabase import create_client, Client
from config import get_settings
from functools import lru_cache

@lru_cache(maxsize=1)
def get_db() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_key)
```

---

### 7.5 Proper error handling on all DB writes 🟢

```python
# services/db.py
async def safe_write(operation, context: str):
    try:
        result = operation.execute()
        if hasattr(result, "error") and result.error:
            logger.error(f"{context}: {result.error}")
            raise HTTPException(500, f"Database error: {context}")
        return result
    except Exception as e:
        logger.error(f"{context} failed: {e}")
        raise HTTPException(500, "Database operation failed")
```

---

### 7.6 Smooth out scoring curves 🟢

Current scoring uses step functions that produce jarring jumps. Replace with continuous curves:

```python
# Instead of: if filler_rate < 2: score = 70; elif filler_rate < 4: score = 50
# Use:
filler_score = max(0, min(100, 100 - (filler_rate * 15)))
pace_score = max(0, 100 - abs(wpm - 140) * 1.2)  # peaks at 140 WPM
```

---

## Phase 8 — Future Modes (Month 2–3)

> These are fully self-contained pages/flows. Build only after everything above is production-stable.

---

### 8.1 Interview Mode 🔵

**The monetisation feature.** Full mock interview: AI asks a question → user answers 60–90s → scored on STAR structure, confidence, conciseness → AI asks a follow-up → full report after 5 questions.

**Completely separate page + router.** Removable entirely without affecting the main flow.

---

### 8.2 AI Conversation Partner 🔵

Real back-and-forth dialogue. AI speaks via TTS → user responds → AI follows up → trains improvisation and spontaneous speaking. Uses Groq for text generation + any TTS API.

**Completely separate page + router.**

---

### 8.3 Pronunciation Track (for non-native speakers) 🔵

Phoneme accuracy comparison. "Your 'th' sounds were correct 71% of the time." Particularly relevant for Indian English speakers preparing for global audiences. Uses Whisper phoneme data.

**Completely separate page + router.**

---

### 8.4 Speaking Anxiety / Fear Index 🔵

Track nervousness via acoustic indicators: voice tremor (pitch jitter), rushed pace, long hesitations → "Speaking Confidence Index" chart. Show the user their anxiety level decreasing over 30 sessions.

Already partially supported by `tremor_score` in the `SpeechAnalysis` dataclass from Phase 1.1.

---

## Phase 9 — Portfolio & README (Day 29, 2 hours)

---

### 9.1 Write a proper README 🟢

```markdown
# SpeakIQ — AI Speech Coach

> Record yourself speaking. Get coaching that quotes exactly what you said.

[Live Demo](https://coder-jane06.github.io/Speakiq) · [API Docs](https://your-render-url.onrender.com/docs)

## What it does
[2–3 sentences + one screenshot of the results page]

## Tech stack
[Badges row: Python · FastAPI · React · TypeScript · Supabase · Docker · Whisper · Groq]

## How it works
Record → Transcribe (Whisper) → Analyse (Librosa + spaCy) → Coach (Groq) → Improve

## Running locally
[Exact commands: clone, pip install, npm install, env vars, uvicorn + vite dev]

## Architecture
[Brief: GitHub Pages frontend → Render backend → Supabase DB + Storage → AI pipeline]
```

**GitHub repo metadata (one-click fixes in Settings):**
- Description: "AI speech coach — record, transcribe with Whisper, get feedback grounded in your actual words"
- Website: your GitHub Pages link
- Topics: `ai` · `speech-coaching` · `fastapi` · `react` · `typescript` · `supabase` · `whisper` · `groq` · `python`

---

## Master Priority Table

| # | Task | Phase | Effort | Impact |
|---|------|-------|--------|--------|
| 1 | Purge user_details.json + UUIDs | 0 | 1 hr | 🔴 Do now |
| 2 | Lock CORS + JWT auth | 0 | 4 hrs | 🔴 Do now |
| 3 | Fix anon/service key confusion | 0 | 1 hr | 🔴 Do now |
| 4 | File validation + rate limiting | 0 | 2 hrs | 🔴 Do now |
| 5 | Unified analysis payload | 1 | 4 hrs | ⭐⭐⭐⭐⭐ |
| 6 | Grounded Groq coaching prompt | 1 | 4 hrs | ⭐⭐⭐⭐⭐ |
| 7 | Background processing + timeout fix | 1 | 4 hrs | ⭐⭐⭐⭐⭐ |
| 8 | Frontend polling + status states | 1 | 3 hrs | ⭐⭐⭐⭐ |
| 9 | Annotated transcript viewer | 2 | 1 day | ⭐⭐⭐⭐⭐ |
| 10 | Audio playback synced to transcript | 2 | 1 day | ⭐⭐⭐⭐⭐ |
| 11 | Delivery diagnosis gauges | 2 | 4 hrs | ⭐⭐⭐⭐ |
| 12 | Filler word breakdown chart | 2 | 3 hrs | ⭐⭐⭐⭐ |
| 13 | Worst moment highlight | 2 | 2 hrs | ⭐⭐⭐⭐ |
| 14 | Before/after sentence rewriter | 2 | 2 hrs | ⭐⭐⭐⭐ |
| 15 | Personalised drill card | 2 | 3 hrs | ⭐⭐⭐⭐ |
| 16 | Supabase Auth (Google OAuth) | 3 | 1 day | ⭐⭐⭐⭐⭐ |
| 17 | Onboarding flow | 3 | 1 day | ⭐⭐⭐⭐ |
| 18 | Progress dashboard + chart | 4 | 1 day | ⭐⭐⭐⭐ |
| 19 | Streak counter + freeze | 4 | 4 hrs | ⭐⭐⭐⭐⭐ |
| 20 | Session history page | 4 | 4 hrs | ⭐⭐⭐⭐ |
| 21 | Personal records system | 4 | 3 hrs | ⭐⭐⭐⭐ |
| 22 | Topics system visible | 4 | 4 hrs | ⭐⭐⭐ |
| 23 | Live recording cues | 1 | 4 hrs | ⭐⭐⭐⭐ |
| 24 | Pattern alerts (escalation) | 5 | 3 hrs | ⭐⭐⭐⭐ |
| 25 | Goal-adaptive scoring weights | 5 | 3 hrs | ⭐⭐⭐⭐ |
| 26 | Mini curriculum per score band | 5 | 3 hrs | ⭐⭐⭐⭐ |
| 27 | Topic progression / tiers | 5 | 4 hrs | ⭐⭐⭐ |
| 28 | Shareable score cards | 6 | 4 hrs | ⭐⭐⭐⭐ |
| 29 | Weekly email digest | 6 | 1 day | ⭐⭐⭐⭐ |
| 30 | Weekly challenge system | 6 | 1 day | ⭐⭐⭐ |
| 31 | Anonymous leaderboard | 6 | 4 hrs | ⭐⭐⭐ |
| 32 | Repo cleanup + Dockerfile fix | 7 | 2 hrs | ⭐⭐⭐⭐ |
| 33 | Remove unused dependencies | 7 | 30 min | ⭐⭐⭐ |
| 34 | Supabase singleton + error handling | 7 | 2 hrs | ⭐⭐⭐ |
| 35 | Smooth scoring curves | 7 | 1 hr | ⭐⭐⭐ |
| 36 | README + GitHub metadata | 9 | 2 hrs | ⭐⭐⭐⭐ |
| 37 | Interview Mode | 8 | 2 weeks | ⭐⭐⭐⭐⭐ |
| 38 | AI Conversation Partner | 8 | 2 weeks | ⭐⭐⭐⭐⭐ |
| 39 | Pronunciation Track | 8 | 1 week | ⭐⭐⭐⭐ |
| 40 | Speaking Anxiety / Fear Index | 8 | 1 week | ⭐⭐⭐⭐ |

---

## Definition of "Production Ready"

SpeakIQ is genuinely production-ready — not just portfolio-ready — when every box below is checked:

**Security**
- [ ] No user data in public repo, no UUIDs in code
- [ ] CORS locked to production domain
- [ ] JWT auth on every API route
- [ ] File validation + rate limiting active
- [ ] Anon key never touches the service role slot

**Core product**
- [ ] Coaching feedback quotes specific transcript moments with timestamps
- [ ] Processing pipeline never times out (background tasks)
- [ ] Frontend shows real status through the processing window
- [ ] Audio playback + annotated transcript on results page

**User experience**
- [ ] New user can sign up, record, get feedback, and see progress with zero help
- [ ] Full flow works on iPhone 14 Safari (mobile + audio fallback)
- [ ] Streak and progress history visible in frontend
- [ ] Personalised drill on every results page

**Code quality**
- [ ] Repo root contains only `main.py`, `config.py`, and config files
- [ ] README explains the project with screenshot and setup instructions
- [ ] Smooth scoring curves (no step-function jumps)
- [ ] Zero 504 timeouts on any audio length up to 10 minutes

**Engagement**
- [ ] Streak freeze prevents accidental streak loss
- [ ] Pattern alerts escalate on repeated problems
- [ ] Shareable score cards working

---

*Generated July 2026 — unified from full codebase audit of github.com/coder-jane06/Speakiq*
*Combines security plan (Plan A) + product roadmap (Plan B) + new suggestions from codebase analysis*


lets go with phase 0 changes then i will tell u when to execute further phases
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-07-01T11:32:46+05:30.
</ADDITIONAL_METADATA>
<USER_SETTINGS_CHANGE>
The user changed setting `Model Selection` from None to Gemini 3.1 Pro (High). No need to comment on this change if the user doesn't ask about it. If reporting what model you are, please use a human readable name instead of the exact string.
</USER_SETTINGS_CHANGE>