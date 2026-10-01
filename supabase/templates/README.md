# Supabase Auth email: dashboard setup (ASN)

Every 6-digit sign-in code (member, expert, partner, job seeker, admin) is sent by Supabase Auth through the dashboard's custom SMTP, not by the app. The app only calls `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })` with no `emailRedirectTo`, so Supabase renders the **Magic Link** template. Because that template contains `{{ .Token }}`, Supabase sends a code instead of a link.

These emails are not affected by `EMAIL_SANDBOX`; they leave through Supabase. To test sign-in locally without emailing real people, use a test inbox you control.

## 1. Custom SMTP (one Rackspace mailbox, support@)

Supabase Dashboard → **Project Settings → Authentication → SMTP Settings** → toggle **Enable Custom SMTP** on, then:

| Field | Value |
|---|---|
| Sender email | `support@aestheticsuccessnetwork.com` |
| Sender name | `Aesthetic Success Network` |
| Host | `secure.emailsrvr.com` |
| Port | `465` |
| Username | `support@aestheticsuccessnetwork.com` |
| Password | the Rackspace password for the support@ mailbox |
| Minimum interval between emails | `60` seconds (default) |

Click **Save**. Judge the save by the green toast, not by the masked password box (it always looks empty after a reload). Ignore the "personal email providers" warning; Rackspace is a business host.

## 2. Magic Link template (the one template for every role)

Supabase Dashboard → **Authentication → Emails** (called "Email Templates" on older dashboards) → **Magic Link** tab.

1. **Subject heading**: `Your Aesthetic Success Network sign-in code: {{ .Token }}`
2. **Message body**: open `supabase/templates/admin-otp-email.html`, copy the whole file (the HTML comment at the top is harmless) and paste it over the default body. Keep `{{ .Token }}` exactly as written; it is what turns the email into a code.
3. Click **Save**.

The template is role-neutral on purpose ("Your sign-in code", "Enter this code on the Aesthetic Success Network sign-in page"), because Supabase uses one Magic Link template for the member, expert, partner, seeker and admin login routes.

If someone receives a link instead of a code, the template did not save. Re-paste it and save again.

## 3. OTP expiry: 5 minutes

Supabase Dashboard → **Authentication → Providers → Email** (older dashboards: Authentication → Settings → Email):

- **Email OTP Expiration**: `300` seconds (5 minutes). The login screens tell people "It expires in 5 minutes."
- **Email OTP Length**: `6`.
- Leave **Confirm email** as it is for the project; the app pre-creates auth users itself.

Click **Save**.

## 4. Quick check

1. Open `/member/login` (or `/admin/login`) on the deployed site and request a code for an address you control.
2. The email should arrive from `Aesthetic Success Network <support@aestheticsuccessnetwork.com>` with the subject `Your Aesthetic Success Network sign-in code: 123456` and the code in the gold box.
3. Entering the code within 5 minutes signs you in; after 5 minutes it must be rejected.
4. The app logs each request in `email_events` with `provider: "supabase_auth"`; the subject stored there is only a label, the real subject is the dashboard template above.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Link instead of a code | Template body or subject lost `{{ .Token }}` | Re-paste the template, save, confirm the toast |
| "Error sending magic link email" | SMTP credentials wrong or the mailbox password changed | Re-enter the support@ password in SMTP Settings |
| Code arrives from `noreply@mail.app.supabase.io` | Custom SMTP not enabled | Toggle Enable Custom SMTP and save |
| Code rejected immediately | Clock skew or expiry set below 60 s | Set Email OTP Expiration to 300 |
| Second request within a minute fails | Supabase rate limit (1 per address per minute) | Wait 60 seconds; the app also allows 5 attempts per 10 minutes |
