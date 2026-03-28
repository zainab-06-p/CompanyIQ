# Supabase + Auth + History Setup

## 1) Supabase project

1. Create a Supabase project.
2. In Authentication > Providers, enable Email provider.
3. Turn ON email confirmations.
4. In Authentication > URL Configuration:
   - Site URL: http://localhost:5173
   - Redirect URL: http://localhost:5173/auth?verified=1
5. In SQL Editor, run `supabase_setup.sql`.

## 2) Backend environment

Set these in `backend/.env`:

- `APP_URL=http://localhost:5173`
- `SUPABASE_URL=https://<project-id>.supabase.co`
- `SUPABASE_ANON_KEY=<anon-key>`
- `SUPABASE_SERVICE_ROLE_KEY=<service-role-key>`

Then restart backend.

## 3) What is now implemented in code

- Signup uses Supabase Auth and sends verification email.
- Login validates via Supabase Auth.
- Backend still issues existing local JWT to keep all current APIs compatible.
- New users are blocked with a plan-selection page until they pick:
  - `free_score`, `quick_scan`, or `standard`
- Selected plan is saved into Supabase `user_metadata.plan`.
- Report history is stored in Supabase table `public.user_history`.
- New page `/history` shows cross-device history for logged-in user.

## 4) Google Cloud email delivery options

Supabase sends confirmation emails automatically. To use Google-managed email delivery:

Option A (recommended):
1. Use Supabase Auth email + configure custom SMTP in Supabase dashboard.
2. Use a Google Workspace SMTP sender account (`no-reply@yourdomain.com`).
3. In Supabase > Authentication > SMTP Settings, set host/user/password from your Google sender account.

Option B (advanced):
1. Use Gmail API via Google Cloud OAuth credentials from backend.
2. Build custom email-sender service and custom verification links.
3. This replaces Supabase built-in confirmation workflow and is more complex.

For most cases, Option A is simpler and production-safe.

## 5) New/updated backend routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/resend-confirmation`
- `GET /api/auth/me`
- `POST /api/auth/select-plan`
- `GET /api/history`
- `POST /api/history/track`

## 6) Frontend behavior

- Auth page shows verification message after signup.
- Includes "Resend confirmation email" action.
- If user has no selected plan, app redirects to onboarding page.
- Report views are auto-tracked to cloud history when logged in.
