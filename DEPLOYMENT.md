# Fluently — Deployment Guide

The backend runs on **Hugging Face Spaces** at:
> `https://shaurya0606-speakiq-backend.hf.space`

The frontend is a React SPA **built and served by the same FastAPI backend** — there is no separate static hosting. One URL, no CORS issues.

---

## Architecture

```
Browser
  ↓
https://shaurya0606-speakiq-backend.hf.space
  ↓
FastAPI (main.py)
  ├── /sessions        → analysis pipeline
  ├── /dashboard       → user progress
  ├── /health          → health check
  └── /               → serves React SPA from frontend/dist
```

---

## 1. Supabase Setup (one-time)

1. In the Supabase SQL Editor, run any pending migration scripts in `backend/scripts/`.
2. In **Authentication → URL Configuration**, set **Site URL** to:
   ```
   https://shaurya0606-speakiq-backend.hf.space
   ```
3. Add these to **Redirect URLs**:
   ```
   https://shaurya0606-speakiq-backend.hf.space/
   http://localhost:8002/
   http://localhost:5173/
   ```
4. In **Authentication → Providers → Email**, keep **Confirm email** enabled.
5. Ensure the `audio-recordings` bucket and RLS policies are configured. The backend uses the service-role key and must never expose it to the frontend.

---

## 2. Environment Variables

### Backend (Hugging Face Spaces secrets)

Set these in your HF Space → **Settings → Repository secrets**:

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | `https://gakfjshqzwtgqpkftnyd.supabase.co` |
| `SUPABASE_SERVICE_KEY` | ✅ | Service role key (never the anon key) |
| `OPENAI_API_KEY` | ✅* | For Whisper transcription |
| `GROQ_API_KEY` | ✅* | For Llama coaching (free tier, preferred) |
| `ANTHROPIC_API_KEY` | optional | Claude fallback for coaching |
| `RESEND_API_KEY` | optional | Session completion emails |
| `RESEND_FROM_EMAIL` | optional | e.g. `Fluently <hello@mail.example.com>` |
| `VAPID_PRIVATE_KEY` | optional | Push notifications |
| `VAPID_SUBJECT` | optional | e.g. `mailto:admin@fluently.com` |
| `ENVIRONMENT` | optional | `production` |

> *At least one of `OPENAI_API_KEY` or `GROQ_API_KEY` is required for the AI pipeline to work.

### Frontend (build-time, baked into `frontend/dist`)

These live in `frontend/.env` for local builds:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://shaurya0606-speakiq-backend.hf.space` |
| `VITE_SUPABASE_URL` | `https://gakfjshqzwtgqpkftnyd.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (never the service key) |

---

## 3. Deploying to Hugging Face Spaces

### 3.1 Build the frontend first

```bash
cd frontend
npm install
npm run build
cd ..
```

This outputs to `frontend/dist/` which `main.py` automatically serves.

### 3.2 Push to Hugging Face

```bash
# Add HF remote if not already added
git remote add hf https://huggingface.co/spaces/shaurya0606/speakiq-backend

# Commit the built frontend dist
git add frontend/dist
git commit -m "build: update frontend bundle"

# Push to HF
git push hf main
```

> HF Spaces will automatically restart the FastAPI server after the push.

### 3.3 Verify deployment

```bash
curl https://shaurya0606-speakiq-backend.hf.space/health
# → {"status": "ok", "service": "fluently-api"}

curl https://shaurya0606-speakiq-backend.hf.space/system/status
# → {"api": {"status": "connected"}, "supabase": {"status": "connected", ...}}
```

---

## 4. Running Locally

To run the full app (frontend + backend) on one URL locally:

```bash
# 1. Build the frontend
cd frontend
npm install
npm run build
cd ..

# 2. Create backend .env in root (see Environment Variables above)

# 3. Start the server
python -m uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

Open **http://localhost:8002** — the React app loads and API calls go to the same server.

For frontend hot-reload during development:

```bash
# Terminal 1 — backend
python -m uvicorn main:app --host 0.0.0.0 --port 8002 --reload

# Terminal 2 — Vite dev server (proxies API calls to backend)
cd frontend && npm run dev
# → http://localhost:5173
```

---

## 5. Configure Email and Push Delivery (optional)

1. Create and verify a sending domain in Resend.
2. Set `RESEND_FROM_EMAIL` to a verified sender, e.g. `Fluently <hello@mail.example.com>`.
3. Set `RESEND_API_KEY` in HF Spaces secrets.
4. Generate VAPID keys and set `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in HF secrets.

Session-report emails are only sent when both `email` and `sessionCompletion` are enabled in a user's notification preferences. Daily reminders require `python -m jobs.reminders` to be run on a schedule (e.g. a cron job or HF scheduled task).

---

## 6. Final Acceptance Checks

1. Sign up with a new inbox, resend confirmation, and open the confirmation link in the same browser.
2. Save notification preferences, reload Settings, and confirm the toggles persist.
3. Enable email + session-completion notifications, complete a short session, and confirm the report email arrives.
4. Verify a second user cannot access the first user's session, transcript, or audio.
5. Record a realistic 30–60 second sample and confirm the session reaches `complete`, then inspect the report and dashboard trend.

---

## Operational Notes

- **Never commit `.env` files.** Client-side variables must be prefixed with `VITE_`; all other secrets stay only in HF Spaces secrets.
- **Rotate any Supabase service-role key** that has ever been pasted into a terminal, source file, or remote URL.
- The analysis pipeline runs as a **FastAPI background task**. For higher volume, move to a durable queue before scaling.
- Daily reminder emails require a scheduled job: `python -m jobs.reminders` run externally.
