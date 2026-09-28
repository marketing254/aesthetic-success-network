# Aesthetic Success Network: database setup guide

This guide sets up the ASN database on Supabase from nothing. It is written for someone who has never used Supabase. Follow the steps in order. Do not skip any.

You will need:

- A Supabase account (https://supabase.com).
- The folder `supabase/migrations/` from this repository (62 SQL files).
- The file `supabase/templates/admin-otp-email.html`.
- About 45 minutes.

Words used below:

- **Dashboard**: the Supabase website for your project.
- **SQL editor**: Dashboard, left menu, "SQL Editor". A page where you paste SQL and press Run.
- **Migration**: one of the numbered `.sql` files. Each one must be run once, in number order.

---

## 1. Create the project and turn OFF auto-expose

1. Sign in to Supabase. Click "New project".
2. Name it `asn-production` (or `asn-test` for a test copy).
3. Choose a strong database password. Save it in the team password manager. You will rarely need it.
4. Region: choose the one closest to most users (US East is fine).
5. Wait until the project says "Active".
6. Left menu: "Project Settings" (gear icon), then "API".
7. Find the setting "Automatically expose new tables" (it may sit under "Data API" or "API Settings", called "Expose tables in schema public automatically" on some versions). Turn it **OFF**. Save.
8. Do not run any SQL before step 7 is done. The migrations grant access table by table on purpose. If this setting stays on, private tables would be reachable by the public key.

## Reusing the existing ASN Supabase project (instead of creating a new one)

The old launch-phase tables use the same names as the new schema with different columns, so the new files cannot run on top of them. Wipe the tables only; the project itself, its keys, Auth users, SMTP and email templates all stay.

1. Dashboard → Project Settings → API → turn OFF "Automatically expose new tables" (if it is on).
2. Dashboard → Storage → open the `agreements` bucket and delete any files in it.
3. Dashboard → Authentication → Users → delete every old TEST member, expert and partner user. Keep the admin users.
4. SQL editor → paste and run `supabase/reset/reset-existing-project.sql` once. Check with `select table_name from information_schema.tables where table_schema = 'public';` → 0 rows.
5. Continue with section 2 below: run `0001_waitlist.sql` through `0069_asn_application_fields.sql` in order.
6. Authentication → Users → add any admin listed in `0005_admin_seed.sql` that does not exist yet (auto-confirm, no password), e.g. `fathimarushdhaakbar28@gmail.com`.
7. Because the same Magic Link template now serves members, experts and partners as well as admins, paste the role-neutral `supabase/templates/admin-otp-email.html` over the old admin-only one (optional but recommended).

## 2. Run the migrations in this exact order

How to run one file:

1. Left menu: "SQL Editor". Click "New query".
2. Open the `.sql` file on your computer in a text editor. Select all, copy.
3. Paste into the SQL editor. Click "Run" (or press Ctrl+Enter).
4. Wait for "Success. No rows returned" (or a small result table). If you see a red error, stop and read section 9 before going on.
5. Move to the next file. Never run a file twice unless section 9 tells you to.

Run these files, in this order. There is no `0009` and no `0035`. That is normal.

| # | File | Note |
|---|------|------|
| 1 | `0001_waitlist.sql` | |
| 2 | `0002_vendor_portal.sql` | |
| 3 | `0003_rls_policies.sql` | |
| 4 | `0004_grants.sql` | |
| 5 | `0005_admin_seed.sql` | **Edited for ASN.** Creates the three admin logins: lester@ekwa.com (owner), rushdha@ekwa.com, rushdhaakbar82@gmail.com. |
| 6 | `0006_logo_storage.sql` | Creates bucket `vendor-logos`. |
| 7 | `0007_verified_gate.sql` | |
| 8 | `0008_catalog_documents.sql` | Creates bucket `catalog-media`. |
| 9 | `0010_notifications.sql` | |
| 10 | `0011_member_resources.sql` | Creates bucket `member-resources`. |
| 11 | `0012_kit_thumbnails.sql` | Creates bucket `kit-thumbnails`. |
| 12 | `0013_resources_v2.sql` | Empties the resources table. Fine on a new project. Never run again later. |
| 13 | `0014_member_assistant.sql` | |
| 14 | `0015_stripe_billing.sql` | |
| 15 | `0016_early_tier_and_sms_consent.sql` | |
| 16 | `0017_expert_applications.sql` | |
| 17 | `0018_experts_portal.sql` | |
| 18 | `0019_experts_grants_fix.sql` | |
| 19 | `0020_expert_resources.sql` | Creates private bucket `expert-resources`. |
| 20 | `0021_network_feed.sql` | |
| 21 | `0022_expert_chatbot.sql` | |
| 22 | `0023_network_realtime.sql` | |
| 23 | `0024_resource_inquiries.sql` | |
| 24 | `0025_resource_originating_vendor.sql` | |
| 25 | `0026_resource_feedback.sql` | |
| 26 | `0027_book_club_and_analytics.sql` | |
| 27 | `0028_admin_authored_posts.sql` | |
| 28 | `0029_resource_kind_book_club.sql` | Adds enum values. Run on its own, as one file. |
| 29 | `0030_profile_avatars.sql` | |
| 30 | `0031_referrals.sql` | |
| 31 | `0032_lead_magnets.sql` | |
| 32 | `0033_vendor_expert_billing.sql` | |
| 33 | `0034_agreement_esign.sql` | Creates private bucket `agreements`. |
| 34 | `0036_founding_invites.sql` | |
| 35 | `0037_founding_invites_draft.sql` | |
| 36 | `0038_application_extra_fields.sql` | |
| 37 | `0039_founding_agreement_v4.sql` | |
| 38 | `0040_vendor_billing_parent.sql` | |
| 39 | `0041_founding_invite_companies.sql` | |
| 40 | `0042_expert_billing_exempt.sql` | |
| 41 | `0043_founding_expert_cap.sql` | Founding expert cap is 20. Do not change. |
| 42 | `0044_review_actions_expert_targets.sql` | |
| 43 | `0045_resource_kind_spotlight_highlight.sql` | Adds enum values. Run on its own, as one file. |
| 44 | `0046_referral_slug_revenue.sql` | |
| 45 | `0047_profile_spotlights.sql` | |
| 46 | `0048_member_inquiries.sql` | |
| 47 | `0049_inquiry_pack_delivery.sql` | Creates bucket `inquiry-packs`. |
| 48 | `0050_spotlight_dual_owner.sql` | |
| 49 | `0051_invite_links.sql` | |
| 50 | `0052_billing_hardening.sql` | |
| 51 | `0053_kit_access_counts.sql` | |
| 52 | `0054_member_promo_codes.sql` | **Edited for ASN.** No promo code is seeded. Defaults: 90 trial days, 10 uses. |
| 53 | `0055_member_onboarding.sql` | |
| 54 | `0056_onboarding_sequence.sql` | |
| 55 | `0057_member_heard_about.sql` | |
| 56 | `0058_paid_ads_channel.sql` | |
| 57 | `0059_pending_registrations.sql` | Needed: the Stripe webhook reads it after every payment |
| 58 | `0060_members_account_type.sql` | Only the members.account_type column. The job board itself is held back in `later/job-board/` |
| 64 | `0066_founding_invite_pricing.sql` | |
| 65 | `0067_asn_security_hardening.sql` | **New for ASN.** Security fixes: locks Stripe event log, protects member/partner/expert billing columns, tidies resource access, creates bucket `avatars`, adds the rate limiter. |
| 66 | `0068_notifications_reconcile.sql` | **New for ASN.** Lets the app send in-app notifications to experts and members, not only partners and admins. |
| 67 | `0069_asn_application_fields.sql` | **New for ASN.** Adds the ASN form fields (waitlist name/role/locations/challenge/agreement, expert bio/sample/courses/ownership, partner contact role). |

When all 62 files have run, go to step 3.

## 3. Check the storage buckets

1. Left menu: "Storage".
2. You should see these ten buckets. "Public" means anyone with the link can view a file.

| Bucket | Public? |
|--------|---------|
| `vendor-logos` | Public |
| `catalog-media` | Public |
| `member-resources` | Public |
| `kit-thumbnails` | Public |
| `expert-resources` | Private |
| `agreements` | Private |
| `inquiry-packs` | Public |
| `job-banners` | Public |
| `job-applications` | Private |
| `avatars` | Public |

3. If one is missing, the migration that creates it did not finish. Re-run that one file (the table in step 2 says which). Bucket creation is safe to repeat.
4. Do not create buckets by hand and do not change the Private ones to Public.

## 4. Authentication settings

1. Left menu: "Authentication", then "URL Configuration".
2. Site URL: `https://www.aestheticsuccessnetwork.com`
3. Redirect URLs: click "Add URL" for each of these three, one at a time:
   - `https://www.aestheticsuccessnetwork.com/auth/callback`
   - `http://localhost:3000/auth/callback`
   - `https://*.vercel.app/auth/callback`
4. Save.
5. Now "Authentication", then "Sign In / Providers" (called "Providers" on some versions). Open "Email".
   - Keep "Enable Email provider" ON.
   - Turn **OFF** "Allow new users to sign up". The app creates every user itself.
   - Turn OFF "Confirm email" if it is on (users are created already confirmed).
   - Set "Email OTP Expiration" to `300` seconds (5 minutes).
   - Set "Email OTP Length" to `6`.
   - Save.
6. Now "Project Settings", then "Authentication" (or "Authentication", then "Emails", then "SMTP Settings"). Turn ON "Enable Custom SMTP" and fill in:
   - Sender email: `support@aestheticsuccessnetwork.com`
   - Sender name: `Aesthetic Success Network`
   - Host, port, username, password: the Rackspace mailbox details for `support@aestheticsuccessnetwork.com` (in the password manager). Username is the full email address.
   - Save.
7. Now "Authentication", then "Emails" (or "Email Templates"). Open the **"Magic Link"** template.
   - Subject: `Your Aesthetic Success Network sign-in code: {{ .Token }}`
   - Body: open `supabase/templates/admin-otp-email.html`, select all, copy, and paste it into the body box, replacing everything that was there.
   - Check the pasted body contains the text `{{ .Token }}`. That is what turns the email into a 6-digit code instead of a link.
   - Save.
8. Rate limits ("Authentication", then "Rate Limits"): leave the defaults.

## 5. Create the admin users

Each admin needs two things: a row in the database (done by 0005) and a login user. Do this for each of the three addresses.

1. Left menu: "Authentication", then "Users".
2. Click "Add user", then "Create new user".
3. Email: `lester@ekwa.com`
4. Tick "Auto Confirm User".
5. Leave the password empty. Admins sign in with an emailed code, never a password.
6. Click "Create user".
7. Repeat for `rushdha@ekwa.com`.
8. Repeat for `rushdhaakbar82@gmail.com`.
9. To add another admin later: create the login user as above, then copy `supabase/seed.local.example.sql` to `supabase/seed.local.sql`, fill in the row, and run it in the SQL editor. Never put extra admins in the migrations.

## 6. Turn on Realtime for five tables

Realtime lets the network feed and the inquiry inboxes update live. The migrations already add these tables to the publication. Confirm it:

1. Left menu: "Database", then "Publications".
2. Open `supabase_realtime`.
3. These five must be toggled ON: `expert_posts`, `post_reactions`, `post_comments`, `resource_inquiries`, `resource_inquiry_replies`.
4. If any is off, toggle it on. Leave every other table off.

## 7. Copy the keys into the app

1. Left menu: "Project Settings", then "API" (or "API Keys").
2. Copy three values into the app's `.env.local` file (and into Vercel's environment variables for production):

| Supabase label | Put it in |
|----------------|-----------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY` |

3. The `service_role` key can read and change everything. Never put it in a browser, a screenshot, a chat, or a file that is committed. `.env.local` is gitignored.
4. Restart the app after changing `.env.local`.

## 8. Things you must never run

The DMN project shipped some cleanup tools. They are NOT in this repository on purpose. If you ever see them, do not run them on the ASN project:

- `_pre_launch_cleanup.sql` (deletes members, experts, partners and login users)
- `_wipe_data.sql` (empties the main tables)
- `supabase/reset/_reset_data.sql` and `supabase/reset/clear-storage.mjs` (empties tables and storage)
- `supabase/scripts/phillips_offer_spotlight.sql` (DMN-only data)

Also never re-run these two migrations once the site has real data:

- `0013_resources_v2.sql` (it empties the resource library)
-
## 9. If something goes wrong, or you need a clean test project

**A migration shows a red error.**

1. Read the first line of the error.
2. "already exists": the file (or part of it) was run before. This is usually harmless. Move on to the next file.
3. "does not exist": you skipped a file, or ran one out of order. Find the last file that ran cleanly, then run the missing files in order.
4. "permission denied" on `storage`: you are not the project owner. Ask the owner to run the file.
5. Anything else: copy the whole error and send it to the developer with the file name. Do not keep pressing Run.

**You want a fresh test database.**

1. Do not "reset" the production project. Create a new project instead: `asn-test-<today's date>`.
2. Repeat sections 1 to 7 on the new project. Use Stripe test keys with it.
3. Point your local `.env.local` at the new project's URL and keys.
4. When you are done testing, delete the test project: "Project Settings", "General", "Delete project". Deleting a test project cannot affect production.

**You need to remove an admin.**

Run in the SQL editor: `update public.admin_users set active = false where email = 'person@example.com';` Then in "Authentication", "Users", delete that user. Do not delete rows from `admin_users`; the review history points at them.

## Held-back features (job board, summit)

Their migrations live in `supabase/migrations/later/` and are NOT part of the run order above. See `later/README.md` when those features are switched on.
