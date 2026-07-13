# ASN — Supabase setup (launch phase)

Everything the waitlist phase needs: three intake tables, the counts view,
the admin team, and magic-link auth for the admin console.

## 1. Create the project

Create a new Supabase project (one per vertical — do not share the DMN/TD
project). Note the **Project URL**, **anon key**, and **service_role key**
from Settings → API.

## 2. Run the migrations (in numeric order)

Open the SQL editor and run each file in `migrations/`:

| Order | File | Provides |
|---|---|---|
| 1 | `0001_waitlist.sql` | `waitlist_signups` + `waitlist_counts` view |
| 2 | `0002_expert_applications.sql` | `expert_applications` |
| 3 | `0003_partner_applications.sql` | `partner_applications` |
| 4 | `0004_admin.sql` | `admin_users` + `auth_audit` + RLS policy + admin seed |

RLS is enabled deny-all on the intake tables — only the server (service
role key) reads/writes them. **Never skip 0004**: it also carries the RLS
policy the admin middleware depends on.

## 3. Verify (expect every column `true`)

```sql
select
  to_regclass('public.waitlist_signups')     is not null as waitlist,
  to_regclass('public.expert_applications')  is not null as expert_apps,
  to_regclass('public.partner_applications') is not null as partner_apps,
  to_regclass('public.admin_users')          is not null as admins,
  to_regclass('public.auth_audit')           is not null as audit,
  to_regclass('public.waitlist_counts')      is not null as counts_view;
```

## 4. Admin sign-in (6-digit email codes)

The console at `/admin` uses Supabase Auth email OTP codes (not magic
links), gated by the `admin_users` allow-list:

1. **Seed / edit the team** (0004 seeds Lester + Rushdha; add more):

   ```sql
   insert into public.admin_users (email, full_name, role, active)
   values ('someone@ekwa.com', 'Someone', 'admin', true)
   on conflict do nothing;
   ```

2. **Create the same emails as auth users**: Authentication → Users →
   *Add user* → *Create new user* (no password needed — they'll only use
   sign-in codes). Sign-in uses `shouldCreateUser: false`, so an email that
   doesn't exist as an auth user can never get a code.

3. **Switch the email template to a code**: Authentication → **Emails**
   (Templates) → **Magic Link**. `signInWithOtp` uses this template — if it
   contains `{{ .Token }}`, Supabase sends a 6-digit code instead of a
   link. Paste the branded template from
   [`templates/admin-otp-email.html`](templates/admin-otp-email.html) into
   the body, and set the subject to:

   ```
   Your Aesthetic Success Network sign-in code: {{ .Token }}
   ```

   Recommended: Authentication → Providers → Email → set **Email OTP
   Expiration** to 600 seconds (10 minutes).

4. Sign in at `/admin/login`: enter your email → enter the 6-digit code →
   console. Deactivating an admin (Admin team page) blocks them instantly.
   (Keep `/auth/callback` in Redirect URLs anyway — it's harmless and lets
   you switch back to magic links later: Site URL = your deployed URL,
   Redirect URLs = `https://<your-domain>/auth/callback` +
   `http://localhost:3000/auth/callback`.)

5. **Send auth emails from marketing@ekwa.co**: by default Supabase sends
   auth emails from its own shared address (heavily rate-limited — dev
   only, ~2 emails/hour). For production, go to Project Settings → Auth →
   **SMTP Settings**, enable *Custom SMTP*, and enter the mailbox
   credentials. **The SMTP host is NOT something Supabase provides — it's
   the host of whichever provider holds the `marketing@ekwa.co` mailbox:**

   | Where marketing@ekwa.co lives | Host | Port | Username | Password |
   |---|---|---|---|---|
   | Google Workspace / Gmail | `smtp.gmail.com` | 465 | `marketing@ekwa.co` | an **App Password** (Google account → Security → 2-Step Verification → App passwords) |
   | Microsoft 365 / Outlook | `smtp.office365.com` | 587 | `marketing@ekwa.co` | mailbox password |
   | Rackspace | `secure.emailsrvr.com` | 465 | `marketing@ekwa.co` | mailbox password |
   | Resend (API relay) | `smtp.resend.com` | 465 | `resend` | your `re_...` API key |

   Sender name: "Aesthetic Success Network", sender address:
   `marketing@ekwa.co`. Use the **same host/port/user/password** for the
   app's `SMTP_*` vars in `.env.local` so the signup/confirmation emails
   send from the same mailbox. If ekwa.co is on Google Workspace, the
   Workspace admin may need to allow SMTP/App Passwords for that account.

## 5. Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Var | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✔ | Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✔ | Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | ✔ | Settings → API — server only, never exposed |
| `IP_HASH_SALT` | ✔ (prod) | Stable 32+ chars. **Never rotate after launch.** |
| `NEXT_PUBLIC_LAUNCH_AT` | ✔ | ISO date the countdown targets |
| `NEXT_PUBLIC_APP_URL` | ✔ | Canonical site URL (used in emails/links) |
| `SMTP_HOST/PORT/USER/PASS` | optional | Email transport #1 |
| `GMAIL_USER` + `GMAIL_APP_PASSWORD` | optional | Email transport #2 (dev) |
| `RESEND_API_KEY` | optional | Email transport #3 |
| `WAITLIST_EMAIL_FROM` | optional | e.g. `Aesthetic Success Network <hello@aestheticsuccessnetwork.com>` |
| `TEAM_DISTRIBUTION_LIST` | optional | Comma-separated internal notification emails |

With no email provider configured, emails are logged to the server console
and signups still succeed (fail-soft by design).

## 6. Smoke test

1. `npm run dev` → submit all three forms (home waitlist, /experts, /partners).
2. Check rows landed: `select * from waitlist_signups; select * from expert_applications; select * from partner_applications;`
3. Confirmation + team emails arrive (or appear in the server log).
4. Sign in at `/admin/login`, review each queue, flip statuses, export CSV.
