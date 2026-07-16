# SpeakIQ production launch

This repository uses two Render services defined in `render.yaml`:

- `speakiq-api`: the FastAPI API and speech-analysis worker.
- `speakiq-web`: the React static site.

Deploy the API first so that its public URL can be used as `VITE_API_URL` for the web build.

## 1. Prepare Supabase

1. In the Supabase SQL Editor, run `scripts/migrate_v3_preferences.sql` and `backend/scripts/migrate_v5_push.sql`.
2. In **Authentication → URL Configuration**, set **Site URL** to the final web URL, for example `https://app.example.com`.
3. Add the exact final URL with a trailing slash to **Redirect URLs**, for example `https://app.example.com/`. Keep `http://localhost:3000/**` and `http://localhost:5173/**` for local work.
4. In **Authentication → Providers → Email**, keep **Confirm email** enabled for real accounts. The client uses PKCE and now processes the return code after verification.
5. Ensure the `audio-recordings` bucket and existing tables have the expected policies. The backend uses the service-role key and must never expose it to the frontend.

## 2. Configure email and push delivery

1. Create and verify a sending domain in Resend, such as `mail.example.com`.
2. Set `RESEND_FROM_EMAIL` to a verified sender such as `SpeakIQ <hello@mail.example.com>`. Do not use `onboarding@resend.dev` outside Resend's testing constraints.
3. Set `RESEND_API_KEY` on the API service.
4. Generate VAPID keys and set `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` on the API service. Set the matching public key as `VITE_VAPID_PUBLIC_KEY` on the static site.

Session-report emails are only sent when both `email` and `sessionCompletion` are enabled in a user's saved notification preferences.

## 3. Create the Render services

1. In Render, select **New → Blueprint** and connect this GitHub repository. Render reads `render.yaml`.
2. Enter API secrets on `speakiq-api`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and/or `GROQ_API_KEY` as used by the selected coaching provider
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
   - `FRONTEND_URL` (the final `speakiq-web` URL, no trailing slash)
3. Deploy `speakiq-api` and confirm `https://<api-host>/health` returns `{"status":"ok"}`.
4. Enter these build-time values on `speakiq-web` and deploy it:
   - `VITE_API_URL=https://<api-host>`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (the public anon/publishable key only)
   - `VITE_VAPID_PUBLIC_KEY`
5. After the web service has its final URL, update `FRONTEND_URL` on the API and redeploy the API. This activates strict CORS and correct email report links.

## 4. Attach a custom domain

1. Add `app.example.com` to the `speakiq-web` custom domains in Render.
2. At the domain registrar, create exactly the DNS record Render displays (normally a CNAME for a subdomain). Wait for Render to issue HTTPS.
3. Add `api.example.com` to `speakiq-api` only if a public API domain is wanted. Otherwise the generated Render API hostname is sufficient.
4. Replace the temporary Render values in Supabase Site URL, Redirect URLs, `FRONTEND_URL`, and `VITE_API_URL` with the custom domain values; redeploy the web site after changing `VITE_API_URL`.

## 5. Final acceptance checks

1. Sign up with a new inbox, resend confirmation once, and open the confirmation link in the same browser/device.
2. Save notification preferences, reload Settings, and confirm the toggles persist.
3. Enable email plus session-completion notifications, complete a short session, and confirm the report email has the score cards and CTA.
4. Verify a second user cannot load the first user's session, transcript, signed audio URL, or export.
5. Record a realistic 30–60 second sample and confirm the session reaches `complete`, then inspect the report and dashboard trend.

## Operational notes

- Rotate any Supabase service-role or hosting token that has ever been pasted into a terminal, source file, or remote URL.
- Do not commit `.env` files. Client-side variables must be prefixed with `VITE_`; all other secrets stay only in Render.
- The current analysis runs as a FastAPI background task. For higher volume or stronger retry guarantees, move analysis to a durable queue/worker before scaling traffic.
