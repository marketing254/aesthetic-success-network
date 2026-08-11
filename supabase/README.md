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
| 5 | `0005_waitlist_agreement.sql` | Member Agreement acceptance columns on `waitlist_signups` (no-op on fresh installs that ran the updated 0001) |
| 6 | `0006_members_and_audit.sql` | `members` (waitlist → member activation) + `review_actions` (the Audit log) |
| 7 | `0007_portal_gate_policies.sql` | self-read RLS policies powering the portal gate (only activated members / approved experts / approved partners can ever enter the portal routes) |
| 8 | `0008_portals.sql` | `hotline_requests` + `hotline_responses` (the Expert Hotline), `vendor_deals`, `expert_kits` — everything the three portals read and write |

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
  to_regclass('public.waitlist_counts')      is not null as counts_view,
  to_regclass('public.hotline_requests')     is not null as hotline,
  to_regclass('public.hotline_responses')    is not null as hotline_responses,
  to_regclass('public.vendor_deals')         is not null as deals,
  to_regclass('public.expert_kits')          is not null as kits;
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

3. **Email delivery — Supabase sends the code, with an app fallback.**
   The login route asks Supabase Auth to email the 6-digit code
   (`signInWithOtp`), which requires TWO dashboard settings:
   - **Project Settings → Auth → SMTP Settings** — enable Custom SMTP with
     the Rackspace values below (verified working; sender
     `support@aestheticsuccessnetwork.com`, name "Aesthetic Success
     Network").
   - **Authentication → Emails → Magic Link template** — the body must
     contain `{{ .Token }}` so a code (not a link) is sent. Paste
     [`templates/admin-otp-email.html`](templates/admin-otp-email.html)
     and set the subject to
     `Your Aesthetic Success Network sign-in code: {{ .Token }}`.
     **If a magic link arrives instead of a code, this template didn't
     save.**

   If Supabase can't send (SMTP misconfigured, outage), the route
   automatically falls back to generating the code via the Admin API and
   emailing it through the app's own transport (`sendAdminCodeEmail`), so
   admins are never locked out. App transport vars (same on Vercel):

   ```
   SMTP_HOST=secure.emailsrvr.com
   SMTP_PORT=465
   SMTP_USER=support@aestheticsuccessnetwork.com
   SMTP_PASS=<the support@ mailbox password>
   ```

   One authenticated mailbox covers every sender — Rackspace allows
   same-domain send-as, so each email goes out From the address matching
   its purpose:

   | Email | From / Reply-To |
   |---|---|
   | Waitlist confirmation (member) | `members@aestheticsuccessnetwork.com` |
   | Expert application confirmation | `experts@aestheticsuccessnetwork.com` |
   | Partner application confirmation | `partners@aestheticsuccessnetwork.com` |
   | Admin sign-in code | `support@aestheticsuccessnetwork.com` |
   | Team notifications | From support@ → `TEAM_DISTRIBUTION_LIST` (lester/reshani/rushdha @ekwa.com) |

   Ask the DNS team to confirm **SPF, DKIM and DMARC** exist for
   `aestheticsuccessnetwork.com` (Lester already requested them) — without
   them these emails may land in spam.

   Recommended: Authentication → Providers → Email → set **Email OTP
   Expiration** to 600 seconds (10 minutes).

4. Sign in at `/admin/login`: enter your email → enter the 6-digit code →
   console. Deactivating an admin (Admin team page) blocks them instantly.
   (`templates/admin-otp-email.html` is kept only as a reference copy of
   the email design; it does not need to be pasted into Supabase.)

## 4b. Portal sign-in (members / experts / partners)

The three portals — `/dashboard`, `/expert`, `/vendor` — share one sign-in
page at **`/login`**, using the same 6-digit email-code flow as the admin
console but gated on portal roles instead of the admin allow-list:

- **member** → an `active` row in `members`
- **expert** → an `approved` row in `expert_applications`
- **partner** → an `approved` row in `partner_applications`

One email can hold several roles; the portal shell then shows a switcher.

**Auth users are provisioned automatically.** Portal sign-in uses
`shouldCreateUser: false`, so an approved person with no Supabase auth user
would be locked out. Activating a member and approving an expert/partner
both call `ensureAuthUser()`, which creates the auth user (already
email-confirmed — control of the inbox is proven by the code at sign-in).
Provisioning is fail-soft and logged, so a hiccup never rolls back an
approval; if someone reports "your account isn't set up for sign-in yet",
add them under Authentication → Users and they're unblocked.

Anyone signed in without a live role is bounced to `/?portal=inactive`;
signed-out visitors go to `/login?redirect=…`.

### The Expert Hotline loop

1. Member submits at `/dashboard/hotline/new` → row lands as `submitted`,
   member gets a receipt email, the team gets a notification.
2. Admin routes it at **`/admin/hotline`** → status `assigned`, the chosen
   expert is emailed. This is the one deliberately manual step.
3. Expert writes the plan at `/expert/requests/[id]`. Drafts stay private;
   delivering flips the request to `answered` and emails the member.
4. Member reads it at `/dashboard/hotline/[id]`.

Vendor deals follow the same curated shape: partners draft and submit,
**only an admin can publish** (`/admin/deals`), and editing a live deal
pulls it back into review.

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
5. Portals, end to end:
   - Activate yourself as a member (Members → activate), approve a test
     expert and a test partner.
   - Sign in at `/login` with each email — you should land on `/dashboard`,
     `/expert` and `/vendor` respectively.
   - Member: submit a Hotline question. Admin: route it at `/admin/hotline`.
     Expert: deliver an action plan. Member: read it. Check the emails at
     each hop.
   - Partner: create a deal → submit for review. Admin: publish it at
     `/admin/deals`. Member: see it under Vendor deals.
   - Expert: publish a kit → it appears in the member's Expert kits.
