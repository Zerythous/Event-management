# Eventora — Phase 2.1 Local Supabase Setup & Security Guide

Eventora runs as a static HTML/CSS/JavaScript frontend served by `server.js` (no bundler or Vite migration is used). Authentication uses **@supabase/supabase-js v2** directly in the browser via `eventora/scripts/supabase-client.js` and `eventora/scripts/auth-store.js`.

---

## 1. Local Configuration File (Required Before Live Testing)

Create an untracked local credential file by copying the tracked template:

- **Template (tracked):** `eventora/scripts/supabase-config.example.js`
- **Local config (create & edit locally):** `eventora/scripts/supabase-config.local.js`

```powershell
Copy-Item "eventora/scripts/supabase-config.example.js" "eventora/scripts/supabase-config.local.js"
```

---

## 2. Where to Paste Your Project URL & Publishable Key

Open `eventora/scripts/supabase-config.local.js` and replace the two placeholders with values from **Supabase Dashboard → Project Settings → API**:

```js
window.EVENTORA_SUPABASE_CONFIG = {
  url: 'https://<your-project-ref>.supabase.co', // <- Paste Project URL here
  publishableKey: '<your-publishable-key>',       // <- Paste Publishable (or legacy anon) key here
  storageBucket: 'eventora-media'
};
```

> **Security rule:** NEVER paste a `service_role` key, secret key (`sb_secret_...`), database password, or service-account credential into any frontend file. `supabase-client.js` actively rejects secret/service-role keys at runtime.

---

## 3. Verifying Git Ignore

`eventora/.gitignore` ignores `scripts/supabase-config.local.js`, `*.local.js`, `.env`, and `.env.*`.

Verify before committing any future changes:

```powershell
git check-ignore -v eventora/scripts/supabase-config.local.js
git status --short
```

---

## 4. Supabase Auth URL Settings for Local Development

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL:** `http://localhost:8000/eventora/index.html`
- **Redirect URLs (add all):**
  - `http://localhost:8000/eventora/*`
  - `http://localhost:8000/eventora/login.html`
  - `http://localhost:8000/eventora/profile.html`
  - `http://localhost:8000/eventora/forgot-password.html`

---

## 5. Running Eventora Locally

Start the Node static server from the repository root:

```powershell
npm run dev
```

Open Eventora at **http://localhost:8000/eventora/index.html** (note that `/` serves the preserved legacy `landing.html`).

---

## 6. Testing Authentication Flows

1. **Email Signup (`signup.html`):**
   - Open http://localhost:8000/eventora/signup.html.
   - Enter Full Name, select a non-privileged Workspace Focus (`Participant`, `Event Organizer`, or `Event Manager`), enter Email, strong Password (8+ chars), confirm Password, accept terms, and submit.
   - Note: `role_preference` is stored as non-privileged UI metadata only; `admin` / `super_admin` permissions are never assigned from frontend signup.

2. **Email Verification:**
   - If **Confirm email** is enabled in Supabase Auth, `signup.html` instructs you to check your inbox and shows a **Resend Verification Email** button.
   - Clicking the email confirmation link redirects to `login.html?verified=1`.

3. **Email & Password Login (`login.html`):**
   - Open http://localhost:8000/eventora/login.html and sign in with verified credentials.
   - Confirm redirect to `profile.html` (or `?redirect=...`), and check that refreshing preserves your session and updates the navbar avatar/initials dropdown across all Eventora pages.

4. **Google OAuth Login (`login.html` / `signup.html`):**
   - Click **Continue with Google** on `login.html` or `signup.html`.
   - Ensure Google provider is enabled in **Supabase Dashboard → Authentication → Providers → Google** with your Google Client ID/Secret and Supabase callback URL (`https://<your-project-ref>.supabase.co/auth/v1/callback`).
   - After consent, Supabase redirects back to Eventora, restores the session, displays your Google avatar (or initials fallback), and updates navbar + profile state.

5. **Password Recovery (`forgot-password.html`):**
   - Open http://localhost:8000/eventora/forgot-password.html and submit your account email.
   - Open the password reset email link (routes back to `forgot-password.html?mode=reset`).
   - Enter and confirm your new password (8+ characters) and submit to verify `updateUser({ password })`.

6. **Profile Editing & Logout (`profile.html`):**
   - Verify displayed name, email, verification badge, auth provider, and read-only server-verified role status (`participant`).
   - Click **Edit Profile**, update display fields (`Full Name`, `Institution`, `Department`, `City`, `Bio`, non-privileged `Workspace Focus`), save, and reload to confirm persistence via Supabase Auth user metadata.
   - Click **Logout** (profile header or navbar dropdown) and confirm session clears cleanly across pages.

---

## 7. Future Database & Storage Architecture Notes (Not Executed in Phase 2.1)

- **Profile Table Alignment:** When connecting Eventora's Phase 1B PostgreSQL schema (`supabase/migrations/002_schema_and_constraints.sql` – `004_rls_policies.sql`), authenticated user display identity maps to `public.profiles (id, full_name, avatar_url, platform_role)` and private contact metadata maps to `public.profile_private_data`. Server-side trigger `enforce_profile_role_security()` forces `platform_role = 'participant'` on self-insert and blocks self-privilege escalation.
- **`eventora-media` Bucket Layout:** `EventoraSupabase.storage` prepares scoped upload paths without opening unrestricted public access:
  - User avatars: `avatars/{user_id}/{timestamp}-{filename}`
  - Event posters: `events/{event_slug}/poster/{timestamp}-{filename}`
  - Event cover banners: `events/{event_slug}/cover/{timestamp}-{filename}`
- **Required Storage RLS Policies (for future Storage phase):**
  - Restrict `avatars/{user_id}/*` uploads/updates/deletes strictly to `(storage.foldername(name))[2] = auth.uid()::text`.
  - Restrict `events/{event_slug}/*` uploads/updates/deletes strictly to verified event owners/admins checked against `public.events` / `public.event_collaborators`.
  - Allow controlled read (`SELECT`) only per approved visibility policy rather than granting blanket write/delete permissions to `anon` or `public`.

---

## 8. Phase 2.2 Role-Based Dashboards & Access Boundaries

- **Role Resolution (`eventora/scripts/auth-store.js` & `eventora/scripts/role-access.js`):**
  1. **Authoritative server claim (highest precedence):** Whenever Supabase JWT `app_metadata` carries a platform role (`platform_role`, `role`, `user_role`, `eventora_role`, or `roles[0]`), `hasServerVerifiedRole` is `true` and that server-verified role always overrides everything else (including `admin` and `super_admin`).
  2. **Workspace routing before Phase 3 DB triggers:** When `app_metadata` has no platform role yet (`hasServerVerifiedRole === false`), Eventora routes standard workspaces strictly among `participant`, `organizer`, and `manager` using the user's Supabase signup role selection (`user_metadata.role_preference` / `role`, saved during email signup or Google signup onboarding), safely defaulting to `participant` if absent or invalid.
  3. **Strict privilege boundary:** `admin` and `super_admin` are **never** selectable or accepted from frontend signup, `user_metadata`, profile edits, or browser storage — they resolve strictly from server-controlled `app_metadata`.
- **Role Home Dashboards:**
  - `participant` → `participant-dashboard.html`
  - `organizer` → `organizer-dashboard.html`
  - `manager` → `manager-dashboard.html` (and scoped `manage-event.html?scope=manager`)
  - `admin` → `admin-dashboard.html`
  - `super_admin` → `superadmin-dashboard.html`
- **Important Security Limitation:** Frontend route guards (`EventoraAccess.evaluatePageAccess`), capability checks, and role-scoped navbars control client UI routing and presentation only. Production multi-tenant security **requires** backend PostgreSQL Row Level Security (RLS) policies, verified `platform_role` database triggers, and server RPC authorization (enabled in the database integration phases).
