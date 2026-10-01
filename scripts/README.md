# Scripts

Local, one-off tools. None of them run in production. Every script reads
`.env.local` at the project root; the Supabase ones need
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (the service
key can read and change everything, so keep `.env.local` out of git and
out of screenshots).

| Script | What it does |
|--------|--------------|
| `import-resources.mjs` | Bulk-imports kit folders into the resource library (Storage + `resources` rows). |
| `import-profiles.mjs` | Fills expert / partner profile fields and uploads headshots + logos from a local assets folder and a JSON file you keep outside the repo. |
| `backfill-referral-handles.mjs` | Gives every active expert / partner a referral code and a vanity handle (`aestheticsuccessnetwork.com/<handle>`). |
| `job-email-preview.mjs` | Sends every job-board email with sample data to a reviewer for approval. |
| `indexnow.mjs` | Submits sitemap URLs to Bing / Yandex via IndexNow. |

The DMN-era `supabase/seed/*`, `supabase/reset/*` and
`supabase/scripts/*` tools were not carried over. Do not copy them in;
see `supabase/README.md` section 8.

---

## import-resources

Bulk-imports every kit folder under your `Resources/` root into Supabase.

### Run order

1. Run every migration in `supabase/migrations/` (see `supabase/README.md`).
2. Make sure `.env.local` has:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
3. Verify the buckets exist in Supabase Storage:
   - `member-resources` (content files)
   - `kit-thumbnails` (cover artwork)

### What it does

For every direct subfolder of the root **and** every subfolder of
`Book club resources/`:

1. Detects whether it's a **standard kit** or a **Book Club kit**
   (presence of `Book Study Guide.pdf`).
2. Uploads `Cover - Square (social).png` (or `Card - Portal Grid.png` with
   `--portrait-cover`) to `kit-thumbnails/<slug>/portal-card.<ext>`.
3. Uploads `Cover - Detail Hero (wide).png` to
   `kit-thumbnails/<slug>/resource-card.<ext>`.
4. Uploads every content file to `member-resources/<slug>/<safe-name>`.
5. Inserts one row in `resources` per content file with the right `kind`
   + `position`, plus topic-level metadata (`portal_card_url`,
   `resource_card_url`, `kit_type`, `book_club_payload`).

The importer is **idempotent** — if a `topic_slug` already exists in
the DB, the kit is skipped entirely. To re-import a kit, delete its
rows first (then re-run).

### Categories

`--category` must be one of the ASN resource categories (they match the
admin kit editor exactly):

- `Pricing & Margins`
- `Consult & Conversion`
- `Team & Culture`
- `Patient Experience`
- `Marketing & Growth`
- `Operations & Compliance`

Book Club kits get `--book-club-category` (default `Book Club`) instead.

### Commands

```bash
# Dry run — prints the plan, uploads nothing
npm run import-resources -- \
  --root "C:/ASN/Resources" \
  --category "Pricing & Margins" \
  --dry-run

# Real run — imports as pending_review (admin must approve)
npm run import-resources -- \
  --root "C:/ASN/Resources" \
  --category "Pricing & Margins"

# Publish on insert (skips the review queue)
npm run import-resources -- \
  --root "C:/ASN/Resources" \
  --category "Consult & Conversion" \
  --publish

# Import only a single kit (exact folder-name match)
npm run import-resources -- \
  --root "C:/ASN/Resources" \
  --only "Atomic Habits" \
  --publish

# Attribute a kit to an expert or partner (member-portal only, never public)
npm run import-resources -- \
  --root "C:/ASN/Resources" \
  --category "Team & Culture" \
  --expert-email "jane@example.com" \
  --publish
```

### Options

| Flag                       | Default              | Notes                                                 |
| -------------------------- | -------------------- | ----------------------------------------------------- |
| `--root <path>`            | (required)           | Absolute path to the `Resources/` folder.             |
| `--category <name>`        | `null`               | Category for **standard** kits. Must be one of the list above. |
| `--book-club-category <s>` | `Book Club`          | Category written on Book Club kits.                   |
| `--only "<name>"`          | (none, repeatable)   | Import only the named kit folders.                    |
| `--expert-email <email>`   | (none)               | Attribute every kit to this expert (`originating_expert_id`). |
| `--vendor-email <email>`   | (none)               | Attribute every kit to this partner (`originating_vendor_id`). |
| `--portrait-cover`         | off                  | Use the 3:4 "Card - Portal Grid" image as the portal card. |
| `--publish`                | off                  | Insert rows as `approved` + `is_published=true`.      |
| `--dry-run`                | off                  | Print the plan; don't upload or insert anything.      |

### How files map to `resources.kind`

| File on disk                          | Resource kind        |
| ------------------------------------- | -------------------- |
| `Training Video.mp4`                  | `video_full`         |
| `Action Guide.pdf`                    | `action_guide`       |
| `Book Study Guide.pdf` (Book Club)    | `book_study_guide`   |
| `Discussion Questions.pdf` (BC)       | `discussion_questions` |
| `Key Takeaways.pdf`                   | `key_takeaways`      |
| `Infographic.pdf` (BC)                | `infographic`        |
| `Infographic.png` (BC)                | `infographic_image`  |
| `Checklist.pdf`                       | `checklist`          |
| `Worksheet.pdf`                       | `worksheet`          |
| `Slide Deck.pdf` / `.pptx`            | `slide_deck`         |
| `Wall Poster.pdf`                     | `other`              |
| `Short N (9x16) - <principle>.mp4`    | `video_short` (title = principle name) |
| `Expert Spotlight - <title>.mp4`      | `expert_spotlight`   |
| `Highlight N (16x9) - <title>.mp4`    | `highlight_moment`   |

### Book Club kits — `book_club_payload`

When a kit is detected as Book Club, the importer ALSO writes a JSON blob
to every row's `book_club_payload`:

```json
{
  "shorts": [
    { "index": 1, "principle": "Make It Obvious", "public_url": "https://…" },
    { "index": 2, "principle": "Make It Easy",    "public_url": "https://…" },
    { "index": 3, "principle": "Make It Satisfying","public_url": "https://…" }
  ],
  "has_infographic": true
}
```

The member portal reads `kit_type === 'book_club'` and renders the
shorts as a "Key Principles" reel above the standard player + curriculum.

### Troubleshooting

- **`Missing SUPABASE env`** — check `.env.local` and confirm
  `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set.
- **`Unknown --category`** — use one of the six ASN categories above,
  spelled exactly.
- **`Upload failed (...): The resource already exists`** — re-running with
  the same slug. Either delete the old rows first or accept the skip.
- **`DB read failed`** — usually means a migration is missing
  (`kit_type` / `book_club_payload` columns require migration 0027).
- **Storage bucket missing** — run `supabase/migrations/0011` and `0012`
  again (bucket creation is idempotent).

---

## import-profiles

Updates `experts` / `vendors` rows (matched by email) with profile text
and uploads headshots / logos to `kit-thumbnails/profiles/`. It never
creates rows and never touches status, verification or billing.

The people list is a JSON file kept **outside the repo** (it holds
contact details). Image paths inside it are relative to `--root`.
Partner `category` must be one of the ASN partner categories
(`Injectables & pharmaceuticals`, `Devices & equipment (lasers,
energy-based)`, `Skincare & product lines`, `Practice-management
software`, `Marketing & growth`, `Patient financing`, `Staffing & HR`,
`Coaching & consulting`, `Continuing education`, `Accounting & CFO`,
`Other`).

```bash
node scripts/import-profiles.mjs --print-example > C:/ASN/profiles.local.json
# edit the JSON, then:
node scripts/import-profiles.mjs --root "C:/ASN/Profile Assets" --profiles "C:/ASN/profiles.local.json" --dry-run
node scripts/import-profiles.mjs --root "C:/ASN/Profile Assets" --profiles "C:/ASN/profiles.local.json"
```

Only PNG, JPG and WebP images are accepted (no SVG).

---

## backfill-referral-handles

Ensures every active expert and partner has a referral code and a vanity
handle. Idempotent. Requires migration `0046` (already in the run order).

```bash
node scripts/backfill-referral-handles.mjs --dry-run
node scripts/backfill-referral-handles.mjs
```

---

## job-email-preview

Sends the six job-board emails, rendered with sample aesthetics data, to a
reviewer with subjects prefixed `[FOR APPROVAL n/6]`. Local only; the
hook it uses refuses to arm in production.

```bash
node scripts/job-email-preview.mjs                      # To = EMAIL_SANDBOX_TO, else rushdhaakbar82@gmail.com
node scripts/job-email-preview.mjs someone@example.com  # explicit To, optional Cc after it
```

---

## indexnow

Submits every URL in the live sitemap (or the URLs you pass) to the
IndexNow endpoint so Bing, Yandex, DuckDuckGo and Brave recrawl within
minutes. Google ignores IndexNow; use Search Console for Google.

Setup (once):

1. Generate a key: any 8 to 128 hex characters, e.g. `openssl rand -hex 16`.
2. Put it in `.env.local` as `INDEXNOW_KEY=<key>` (never commit it).
3. Create `public/<key>.txt` containing the key as its only line, and deploy.

```bash
node scripts/indexnow.mjs --dry-run
node scripts/indexnow.mjs
node scripts/indexnow.mjs https://www.aestheticsuccessnetwork.com/pricing
```
