---
title: Fluently Backend
emoji: 🎤
colorFrom: green
colorTo: blue
sdk: docker
pinned: false
app_port: 7860
---

# Fluently — AI Speech Coaching Backend

FastAPI backend powering [Fluently](https://coder-jane06.github.io/Speakiq/), an AI-powered speech coaching app.

## Stack

- **FastAPI** — REST API
- **Whisper** — Speech transcription
- **Claude (Anthropic)** — Coaching report generation
- **Librosa** — Acoustic analysis
- **spaCy** — NLP analysis
- **Supabase** — Database & auth

## Endpoints

- `GET /health` — Health check
- `POST /sessions/upload` — Upload audio for analysis
- `GET /sessions/{id}` — Fetch session results
- `GET /dashboard/stats` — User dashboard stats
- `GET /system/status` — System health

## Environment Variables

Set these in HuggingFace Space → Settings → Variables and secrets:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `OPENAI_API_KEY` | OpenAI key (Whisper) |
| `ANTHROPIC_API_KEY` | Anthropic key (Claude) |
| `FRONTEND_URL` | Frontend origin for CORS |
| `ENVIRONMENT` | Set to `production` |
