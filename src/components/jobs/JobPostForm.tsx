"use client";

import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Collapse,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import {
  BANNER_ACCEPTED_EXT,
  BANNER_MAX_BYTES,
  JOB_EMPLOYMENT_TYPES,
  JOB_PAY_UNITS,
  JOB_POST_FORMATS,
  JOB_ROLES,
  JOB_WORKPLACES,
} from "@/lib/jobs/constants";
import { bannerPublicUrl } from "@/lib/jobs/format";

const INK = "#0A1A2F";
const INK_MUTED = "#7A8590";
const INK_SOFT = "#3B4A55";
const GOLD = "#A07823";
const LINE = "#E6DDCF";

export type JobFormValues = {
  practice_name: string;
  role: string;
  role_other: string;
  employment_type: string;
  location: string;
  workplace: string;
  pay_min: string;
  pay_max: string;
  pay_unit: string;
  description: string;
  requirements: string;
  apply_email: string;
  apply_url: string;
  start_date: string;
  start_flexible: boolean;
  post_format: string;
  banner_path: string;
  banner_alt: string;
};

export const EMPTY_JOB_FORM: JobFormValues = {
  practice_name: "",
  role: "",
  role_other: "",
  employment_type: "full_time",
  location: "",
  workplace: "onsite",
  pay_min: "",
  pay_max: "",
  pay_unit: "hour",
  description: "",
  requirements: "",
  apply_email: "",
  apply_url: "",
  start_date: "",
  start_flexible: false,
  // Written-out is the default. A member who never notices the toggle
  // gets exactly the form that existed before banners were added.
  post_format: "detailed",
  banner_path: "",
  banner_alt: "",
};

/**
 * A stored post → form values.
 *
 * Both edit surfaces need this — the member's own edit at
 * /dashboard/jobs/[id]/edit and the admin's edit-before-approving in the
 * moderation queue — and both must produce a shape the SAME validator
 * accepts, which is the whole reason the edit paths reuse this form
 * rather than each rolling their own fields. An admin fixing a typo must
 * not be able to approve a post into a state the member's form would
 * have refused.
 *
 * Numbers become strings because every field here is a text input; the
 * validator parses them back (and tolerates "$45,000" while it's at it).
 */
export function jobRowToFormValues(job: {
  practice_name: string;
  role: string;
  role_other: string | null;
  employment_type: string;
  location: string;
  workplace: string;
  pay_min: number | string | null;
  pay_max: number | string | null;
  pay_unit: string;
  description: string | null;
  requirements: string | null;
  apply_email: string | null;
  apply_url: string | null;
  start_date: string | null;
  start_flexible: boolean;
  post_format?: string | null;
  banner_path?: string | null;
  banner_alt?: string | null;
}): JobFormValues {
  const money = (n: number | string | null) => {
    // A banner post can have null pay (0061) — must return "" here, not
    // "0": Number(null) is 0, which is finite, so skipping this check
    // would pre-fill the field with a real-looking zero instead of blank.
    if (n === null) return "";
    const num = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(num)) return "";
    // Drop the trailing ".00" Postgres numeric(10,2) hands back, but keep
    // real cents on an hourly rate like 22.50.
    return Number.isInteger(num) ? String(num) : String(num);
  };
  return {
    practice_name: job.practice_name ?? "",
    role: job.role ?? "",
    role_other: job.role_other ?? "",
    employment_type: job.employment_type ?? "full_time",
    location: job.location ?? "",
    workplace: job.workplace ?? "onsite",
    pay_min: money(job.pay_min),
    pay_max: money(job.pay_max),
    pay_unit: job.pay_unit ?? "hour",
    description: job.description ?? "",
    requirements: job.requirements ?? "",
    apply_email: job.apply_email ?? "",
    apply_url: job.apply_url ?? "",
    // The date input wants YYYY-MM-DD; Postgres `date` already gives us
    // that, but a timestamptz-shaped value would arrive with a T suffix.
    start_date: (job.start_date ?? "").slice(0, 10),
    start_flexible: job.start_flexible === true,
    post_format: job.post_format ?? "detailed",
    banner_path: job.banner_path ?? "",
    banner_alt: job.banner_alt ?? "",
  };
}

/**
 * The post-a-job form, shared by /dashboard/jobs/new and both edit views.
 *
 * Two things here are load-bearing rather than cosmetic:
 *
 *  - Pay range is REQUIRED and the helper text says why. Most aesthetics ads
 *    hide pay and candidates hate it; making it mandatory is the board's
 *    clearest differentiator and it costs us nothing. Anyone tempted to
 *    make this optional should read the spec first.
 *  - The role list is a fixed dropdown, never free text, because free
 *    text fragments the public filters immediately.
 *
 * Client-side checks here are for fast feedback only. The API re-runs
 * the same rules through lib/jobs/validate.ts, and the DB has CHECK
 * constraints under that.
 */
export default function JobPostForm({
  initial,
  submitLabel,
  onSubmit,
  onSaveDraft,
  busy,
  error,
}: {
  initial: JobFormValues;
  submitLabel: string;
  onSubmit: (values: JobFormValues) => void;
  onSaveDraft?: (values: JobFormValues) => void;
  busy: boolean;
  error: string | null;
}) {
  const [v, setV] = useState<JobFormValues>(initial);
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Free text, not the fixed Role dropdown further down the form. That
  // dropdown exists so the public board can filter by role; this is just
  // wording for a ChatGPT prompt, so forcing someone into the same fixed
  // list twice — before they've even seen the rest of the form — would be
  // friction for nothing. If they leave it blank the prompt falls back to
  // whatever they've since picked in the real Role field.
  const [bannerJobTitle, setBannerJobTitle] = useState("");

  // Also free text, also just for the prompt. Without somewhere to put
  // real duties and qualifications, the prompt can only ever tell
  // ChatGPT to invent generic ones — and a generic banner is worse than
  // no banner. This is what turns "make me a poster" into "make me a
  // poster that's actually about this job."
  const [bannerResponsibilities, setBannerResponsibilities] = useState("");
  const [bannerQualifications, setBannerQualifications] = useState("");

  const isBanner = v.post_format === "banner";

  const set = <K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const payMin = Number(v.pay_min.replace(/[$,\s]/g, ""));
  const payMax = Number(v.pay_max.replace(/[$,\s]/g, ""));
  const bannerPayLine =
    v.pay_min.trim() && v.pay_max.trim()
      ? `$${v.pay_min}–$${v.pay_max} ${JOB_PAY_UNITS.find((u) => u.value === v.pay_unit)?.label ?? ""}`
      : "[leave this line off the banner if you'd rather not show pay]";
  const bannerEmploymentLabel =
    JOB_EMPLOYMENT_TYPES.find((t) => t.value === v.employment_type)?.label ?? "[full time / part time / etc]";

  // The prompt is one string so the Copy button and the preview can never
  // disagree. It re-renders as the fields above it change.
  const bannerPrompt = `Design a recruitment banner/flyer for a job advert: a photo band across
the top, a bold role-title bar, then two clearly organized sections
below, each a short bulleted list, "Responsibilities" and "Education &
Qualification", finishing with a contact footer bar. That's a layout
reference only, not a template to copy exactly, adapt it as needed.

Use OUR colour scheme, not a generic one: deep navy (#0A1A2F) for dark
panels and headers, gold (#A07823) for the role-title bar and accents,
white or cream for the body background. No unrelated brand colours.

Practice: ${v.practice_name || "[your practice name]"}
Role: ${bannerJobTitle.trim() || JOB_ROLES.find((r) => r.value === v.role)?.label || "[the role]"}
Location: ${v.location || "[city, state]"}
Employment type: ${bannerEmploymentLabel}
Pay: ${bannerPayLine}

Responsibilities, bullet exactly this, don't invent generic duties:
${bannerResponsibilities.trim() || "[list 4-6 real day-to-day duties for this role]"}

Education & Qualification, bullet exactly this:
${bannerQualifications.trim() || "[list the licences, experience and education actually required]"}

Contact: ${v.apply_email.trim() || v.apply_url.trim() || "[how to apply]"}

Keep the text legible on a phone, if it's too much to fit, trim the
wording, don't shrink the type.`;
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(bannerPrompt);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 2500);
    } catch {
      // Clipboard blocked (older browsers, some embedded views): show
      // the text so it can be selected by hand.
      setPromptOpen(true);
    }
  };

  const problems = useMemo(() => {
    const p: Partial<Record<keyof JobFormValues, string>> = {};
    if (v.practice_name.trim().length < 2) p.practice_name = "Required";
    if (!v.role) p.role = "Choose a role";
    if (v.role === "other" && !v.role_other.trim()) p.role_other = "Tell us the role title";
    if (v.location.trim().length < 2) p.location = "City and state, or region";
    // Pay and the long description are required on a DETAILED post, no
    // exceptions. A BANNER post may leave both blank — the graphic is
    // expected to carry them — but typing one side of the pay range
    // still means the other is expected, and any description typed in
    // still has to clear the same floor as everywhere else (see 0061).
    const bannerPayBlank = isBanner && !v.pay_min.trim() && !v.pay_max.trim();
    if (!bannerPayBlank) {
      if (!v.pay_min.trim() || !Number.isFinite(payMin)) p.pay_min = "Required";
      if (!v.pay_max.trim() || !Number.isFinite(payMax)) p.pay_max = "Required";
      if (Number.isFinite(payMin) && Number.isFinite(payMax) && payMax < payMin) {
        p.pay_max = "Must be at least the minimum";
      }
    }
    if ((!isBanner || v.description.trim()) && v.description.trim().length < 30) {
      p.description = "At least 30 characters";
    }
    if (!v.apply_email.trim() && !v.apply_url.trim()) {
      p.apply_email = "Add an email or a link";
    }
    // A banner post has to actually carry a banner, and the alt text is
    // required rather than optional: without it a screen reader gets
    // nothing at all from a post whose main content is a picture.
    if (v.post_format === "banner") {
      if (!v.banner_path.trim()) p.banner_path = "Upload your banner";
      const alt = v.banner_alt.trim();
      if (alt.length < 5) p.banner_alt = "Describe the banner in a line";
      if (alt.length > 300) p.banner_alt = "300 characters or fewer";
    }
    return p;
  }, [v, payMin, payMax, isBanner]);

  const valid = Object.keys(problems).length === 0;

  const show = (key: keyof JobFormValues) => (touched ? problems[key] : undefined);

  async function uploadBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Checked here for fast feedback; /api/member/jobs/banner re-checks
    // extension, mime and size and is the one that decides.
    if (file.size > BANNER_MAX_BYTES) {
      setUploadErr("Your banner must be under 5MB.");
      if (bannerInputRef.current) bannerInputRef.current.value = "";
      return;
    }

    setUploading(true);
    setUploadErr(null);
    try {
      const body = new FormData();
      body.set("banner", file);
      const res = await fetch("/api/member/jobs/banner", { method: "POST", body });
      const json = (await res.json()) as {
        ok?: boolean;
        banner_path?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.banner_path) {
        setUploadErr(json.error ?? "Couldn't upload that image. Try again.");
        return;
      }
      set("banner_path", json.banner_path);
    } catch {
      setUploadErr("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  }

  const handleSubmit = () => {
    setTouched(true);
    if (valid) onSubmit(v);
  };

  const fieldSx = { "& .MuiOutlinedInput-root": { bgcolor: "#fff" } };

  return (
    <Stack spacing={3}>
      {error ? <Alert severity="error">{error}</Alert> : null}

      {/* THE TOGGLE.
          Members asked for this because writing a description is the
          slow part and most of them are already generating a graphic in
          ChatGPT anyway. The time estimates are on the buttons on
          purpose, that is the actual decision being made, and making
          someone reason about "what is banner mode" is exactly the kind
          of thinking this option exists to remove. */}
      <Section
        title="How do you want to post this?"
        note="You can switch at any point. Nothing you've typed is lost."
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          {JOB_POST_FORMATS.map((format) => {
            const selected = v.post_format === format.value;
            return (
              <Box
                key={format.value}
                role="button"
                tabIndex={0}
                onClick={() => set("post_format", format.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    set("post_format", format.value);
                  }
                }}
                sx={{
                  flex: 1,
                  p: 2,
                  cursor: "pointer",
                  borderRadius: 2,
                  bgcolor: "#fff",
                  border: `2px solid ${selected ? GOLD : LINE}`,
                  "&:hover": { borderColor: GOLD },
                }}
              >
                <Typography sx={{ fontWeight: 700, color: INK }}>{format.label}</Typography>
                <Typography sx={{ color: GOLD, fontSize: "0.85rem", fontWeight: 600 }}>
                  {format.minutes}
                </Typography>
                <Typography sx={{ color: INK_MUTED, fontSize: "0.85rem", mt: 0.5 }}>
                  {format.note}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Section>

      {isBanner ? (
        <Section
          title="Your banner"
          note="Make the graphic anywhere you like (most people use ChatGPT). Then upload it here."
        >
          {/* The prompt is spelled out because "just ask ChatGPT" is
              useless advice to someone who hasn't done it, and this
              option is aimed squarely at the members who are least
              comfortable with AI. Practice name and location are the
              SAME state as the fields later in the form (typing here
              updates them too), so there's nothing to reconcile and
              nothing to re-type.
              Responsibilities/qualifications exist for one reason: a
              prompt with nothing real to describe can only ever produce
              a generic poster. Forcing that tradeoff into the open, via
              copy, not validation, is what "always push for more
              detail" means here; nobody is blocked from generating a
              plainer banner if that's what they want. */}
          <Box sx={{ p: 2, bgcolor: "#FAF7F1", border: `1px solid ${LINE}`, borderRadius: 2 }}>
            <Typography sx={{ fontWeight: 600, color: INK, fontSize: "0.9rem", mb: 1.5 }}>
              Fill these in to generate your prompt
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
              <TextField
                label="Practice name"
                value={v.practice_name}
                onChange={(e) => set("practice_name", e.target.value)}
                error={!!show("practice_name")}
                fullWidth
                size="small"
                sx={fieldSx}
              />
              <TextField
                label="Job title"
                placeholder="Nurse Injector (RN)"
                value={bannerJobTitle}
                onChange={(e) => setBannerJobTitle(e.target.value)}
                fullWidth
                size="small"
                sx={fieldSx}
              />
              <TextField
                label="Location"
                placeholder="Austin, TX"
                value={v.location}
                onChange={(e) => set("location", e.target.value)}
                error={!!show("location")}
                fullWidth
                size="small"
                sx={fieldSx}
              />
            </Stack>

            {/* Same state as "The role" and "Pay range" sections — which
                is exactly why those two are hidden further down while
                this box is open. Filling these in here fills them in
                there too, and vice versa; there is only one copy of
                each, never two forms to keep in sync. */}
            <Typography sx={{ fontSize: "0.8rem", color: INK_MUTED, mb: 1 }}>
              Pay is optional here too. Leave it blank if your banner already shows it, or fill it in
              and it&apos;ll also appear as real text on the page underneath the banner.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
              <TextField
                select
                label="Employment type"
                value={v.employment_type}
                onChange={(e) => set("employment_type", e.target.value)}
                fullWidth
                size="small"
                sx={fieldSx}
              >
                {JOB_EMPLOYMENT_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Pay from"
                placeholder="Optional"
                value={v.pay_min}
                onChange={(e) => set("pay_min", e.target.value)}
                slotProps={{
                  input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                }}
                fullWidth
                size="small"
                sx={fieldSx}
              />
              <TextField
                label="Pay to"
                placeholder="Optional"
                value={v.pay_max}
                onChange={(e) => set("pay_max", e.target.value)}
                slotProps={{
                  input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                }}
                fullWidth
                size="small"
                sx={fieldSx}
              />
              <TextField
                select
                label="Per"
                value={v.pay_unit}
                onChange={(e) => set("pay_unit", e.target.value)}
                fullWidth
                size="small"
                sx={{ ...fieldSx, minWidth: 130 }}
              >
                {JOB_PAY_UNITS.map((u) => (
                  <MenuItem key={u.value} value={u.value}>
                    {u.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Typography sx={{ fontWeight: 600, color: INK, fontSize: "0.85rem", mb: 0.25 }}>
              The more detail you give, the better the banner
            </Typography>
            <Typography sx={{ fontSize: "0.8rem", color: INK_MUTED, mb: 1.5 }}>
              A generic prompt gets a generic poster. List the real day-to-day and the real
              requirements. ChatGPT turns them into the two bulleted sections on the banner.
            </Typography>
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <TextField
                label="Responsibilities"
                placeholder={"e.g.\n- Four days a week, no weekends\n- 45-minute consult slots\n- Injectables, laser and skincare"}
                multiline
                minRows={3}
                value={bannerResponsibilities}
                onChange={(e) => setBannerResponsibilities(e.target.value)}
                fullWidth
                size="small"
                sx={fieldSx}
              />
              <TextField
                label="Education & qualifications"
                placeholder={"e.g.\n- Current state licence\n- 2+ years clinical experience"}
                multiline
                minRows={3}
                value={bannerQualifications}
                onChange={(e) => setBannerQualifications(e.target.value)}
                fullWidth
                size="small"
                sx={fieldSx}
              />
            </Stack>

            {/* The prompt card. Three steps, one Copy button, and the
                text itself folded away, nobody needs to read 200 words
                of instructions to ChatGPT, they need to paste them. */}
            <Box sx={{ border: `1px solid ${LINE}`, borderRadius: 2, bgcolor: "#fff", overflow: "hidden" }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ px: 2, py: 1.5, alignItems: { sm: "center" }, justifyContent: "space-between", borderBottom: `1px solid ${LINE}` }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700, color: INK, fontSize: "0.95rem" }}>Your ChatGPT prompt is ready</Typography>
                  <Typography sx={{ fontSize: "0.8rem", color: INK_MUTED }}>
                    It already includes everything you typed above.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={copyPrompt}
                    startIcon={promptCopied ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
                    sx={{ bgcolor: promptCopied ? "#1B5E20" : INK, "&:hover": { bgcolor: promptCopied ? "#1B5E20" : "#06182A" }, whiteSpace: "nowrap" }}
                  >
                    {promptCopied ? "Copied" : "Copy prompt"}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    component="a"
                    href="https://chatgpt.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 15 }} />}
                    sx={{ color: INK, borderColor: LINE, whiteSpace: "nowrap" }}
                  >
                    Open ChatGPT
                  </Button>
                </Stack>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1, sm: 0 }} sx={{ px: 2, py: 1.5, bgcolor: "#FAF7F1" }}>
                {[
                  ["1", "Copy the prompt"],
                  ["2", "Paste it into ChatGPT and save the image it makes"],
                  ["3", "Upload that image below"],
                ].map(([n, label]) => (
                  <Stack key={n} direction="row" spacing={1} sx={{ alignItems: "center", flex: 1 }}>
                    <Box
                      sx={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        bgcolor: GOLD,
                        color: "#fff",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      {n}
                    </Box>
                    <Typography sx={{ fontSize: "0.82rem", color: INK_SOFT }}>{label}</Typography>
                  </Stack>
                ))}
              </Stack>

              <Button
                size="small"
                onClick={() => setPromptOpen((o) => !o)}
                endIcon={<ExpandMoreRoundedIcon sx={{ transform: promptOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />}
                sx={{ color: INK_MUTED, px: 2, py: 1, borderRadius: 0, justifyContent: "flex-start", width: "100%", textTransform: "none" }}
              >
                {promptOpen ? "Hide the prompt text" : "Show the prompt text"}
              </Button>
              <Collapse in={promptOpen}>
                <Typography
                  component="pre"
                  sx={{
                    m: 0,
                    px: 2,
                    pb: 2,
                    fontSize: "0.8rem",
                    color: INK_SOFT,
                    whiteSpace: "pre-wrap",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    userSelect: "all",
                  }}
                >
                  {bannerPrompt}
                </Typography>
              </Collapse>
            </Box>
          </Box>

          <Box>
            <Button
              component="label"
              variant="outlined"
              disabled={uploading}
              startIcon={<UploadFileIcon />}
              sx={{ color: INK, borderColor: LINE }}
            >
              {uploading ? "Uploading…" : v.banner_path ? "Replace banner" : "Upload banner"}
              <input
                ref={bannerInputRef}
                type="file"
                hidden
                accept={BANNER_ACCEPTED_EXT.join(",")}
                onChange={uploadBanner}
              />
            </Button>
            <Typography sx={{ mt: 1, fontSize: "0.85rem", color: INK_MUTED }}>
              PNG, JPG or WebP, up to 5MB.
            </Typography>
            {uploadErr ? (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {uploadErr}
              </Alert>
            ) : null}
            {show("banner_path") ? (
              <Typography sx={{ mt: 1, fontSize: "0.85rem", color: "#8A3A3A" }}>
                {show("banner_path")}
              </Typography>
            ) : null}
          </Box>

          {v.banner_path ? (
            <Box>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bannerPublicUrl(v.banner_path) ?? ""}
                alt="Your uploaded job banner"
                style={{
                  width: "100%",
                  maxWidth: 520,
                  height: "auto",
                  display: "block",
                  borderRadius: 8,
                  border: `1px solid ${LINE}`,
                }}
              />
            </Box>
          ) : null}

          <TextField
            label="Describe the banner in a line"
            required
            value={v.banner_alt}
            onChange={(e) => set("banner_alt", e.target.value)}
            error={!!show("banner_alt")}
            helperText={
              show("banner_alt") ??
              "What the image says, in words. Screen readers and Google read this, not the picture."
            }
            fullWidth
            sx={fieldSx}
          />
        </Section>
      ) : null}

      {/* Skipped in banner mode — practice name and location are already
          collected in the quick-fill row inside "Your banner" above, and
          it's the same state either way. Asking twice would just be
          asking the same question the member already answered. */}
      {!isBanner ? (
        <Section title="The practice">
          <TextField
            label="Practice name"
            required
            value={v.practice_name}
            onChange={(e) => set("practice_name", e.target.value)}
            error={!!show("practice_name")}
            helperText={show("practice_name")}
            fullWidth
            sx={fieldSx}
          />
          <TextField
            label="Location"
            required
            placeholder="Austin, TX"
            value={v.location}
            onChange={(e) => set("location", e.target.value)}
            error={!!show("location")}
            helperText={show("location") ?? "City and state, or the region you serve"}
            fullWidth
            sx={fieldSx}
          />
        </Section>
      ) : null}

      <Section title="The role">
        <TextField
          select
          label="Role"
          required
          value={v.role}
          onChange={(e) => set("role", e.target.value)}
          error={!!show("role")}
          helperText={show("role")}
          fullWidth
          sx={fieldSx}
        >
          {JOB_ROLES.map((r) => (
            <MenuItem key={r.value} value={r.value}>
              {r.label}
            </MenuItem>
          ))}
        </TextField>

        {v.role === "other" ? (
          <TextField
            label="Role title"
            required
            value={v.role_other}
            onChange={(e) => set("role_other", e.target.value)}
            error={!!show("role_other")}
            helperText={show("role_other") ?? "What should this job be called on the board?"}
            fullWidth
            sx={fieldSx}
          />
        ) : null}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          {/* Skipped in banner mode — already collected in the quick-fill
              row inside "Your banner" above, same state either way. */}
          {!isBanner ? (
            <TextField
              select
              label="Employment type"
              required
              value={v.employment_type}
              onChange={(e) => set("employment_type", e.target.value)}
              fullWidth
              sx={fieldSx}
            >
              {JOB_EMPLOYMENT_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          <TextField
            select
            label="Onsite or remote"
            required
            value={v.workplace}
            onChange={(e) => set("workplace", e.target.value)}
            fullWidth
            sx={fieldSx}
          >
            {JOB_WORKPLACES.map((w) => (
              <MenuItem key={w.value} value={w.value}>
                {w.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Section>

      {/* Skipped in banner mode — already collected in the quick-fill row
          inside "Your banner" above, same state either way. Still
          optional there, per lib/jobs/validate.ts, this section only
          disappears, the requirement doesn't change. */}
      {!isBanner ? (
        <Section
          title="Pay range"
          note="Required on every ASN post. Most aesthetics ads hide the pay and candidates skip them. Showing a range is the single biggest reason a good applicant picks your ad over an identical one. A range is fine; “depends on experience” is not."
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="From"
              required
              value={v.pay_min}
              onChange={(e) => set("pay_min", e.target.value)}
              error={!!show("pay_min")}
              helperText={show("pay_min")}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
              }}
              fullWidth
              sx={fieldSx}
            />
            <TextField
              label="To"
              required
              value={v.pay_max}
              onChange={(e) => set("pay_max", e.target.value)}
              error={!!show("pay_max")}
              helperText={show("pay_max")}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
              }}
              fullWidth
              sx={fieldSx}
            />
            <TextField
              select
              label="Per"
              required
              value={v.pay_unit}
              onChange={(e) => set("pay_unit", e.target.value)}
              sx={{ ...fieldSx, minWidth: 150 }}
            >
              {JOB_PAY_UNITS.map((u) => (
                <MenuItem key={u.value} value={u.value}>
                  {u.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Section>
      ) : null}

      {/* Formatting: plain text plus one convention — a line starting
          with "-" becomes a bullet, on the public page and inside the
          Google for Jobs markup alike. See lib/jobs/richText.ts for why
          it is not a rich text editor. */}
      {/* On a DETAILED post this stays required — no exceptions, see
          lib/jobs/validate.ts. On a BANNER post it's optional as of
          0061_banner_pay_description_optional.sql, at the member's
          explicit request: the banner is expected to carry this instead.
          The tradeoff that decision accepts is real, with it left
          blank, a banner post has no member-written text for Google, the
          JobPosting markup, or a screen reader to read, and falls back to
          a synthesized one-line stand-in (see lib/jobs/jsonLd.ts). */}
      <Section
        title={isBanner ? "A short summary" : "The job"}
        note={
          isBanner
            ? "Optional, only because your banner is a picture that already says this. Google and screen readers can't read an image, so leaving this blank means they get nothing about the role at all beyond your practice name and title."
            : "Plain text, no images. Start a line with a dash (-) and it becomes a bullet point."
        }
      >
        <TextField
          label={isBanner ? "Short summary" : "Job description"}
          required={!isBanner}
          multiline
          minRows={isBanner ? 3 : 7}
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
          error={!!show("description")}
          helperText={
            show("description") ??
            (isBanner
              ? "The role, the practice, and one reason it's worth applying."
              : "The day to day, the team, the schedule.")
          }
          fullWidth
          sx={fieldSx}
        />
        <TextField
          label="What you're looking for"
          multiline
          minRows={4}
          value={v.requirements}
          onChange={(e) => set("requirements", e.target.value)}
          helperText="Optional. Qualifications, licences, years of experience. Dashes make bullets here too."
          fullWidth
          sx={fieldSx}
        />
      </Section>

      {/* Copy corrected in phase 2. Applications used to be a mailto
          straight to the practice; they now come through us so the
          applicant can be captured and can track the outcome. Saying
          otherwise on the form would be a promise the product no longer
          keeps. */}
      <Section
        title="How to apply"
        note="Give an email and applications arrive in your inbox, with the CV attached and reply-to set to the candidate. Give a link instead and applicants go to your own site."
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Application email"
            type="email"
            value={v.apply_email}
            onChange={(e) => set("apply_email", e.target.value)}
            error={!!show("apply_email")}
            helperText={show("apply_email")}
            fullWidth
            sx={fieldSx}
          />
          <TextField
            label="Or an application link"
            placeholder="https://"
            value={v.apply_url}
            onChange={(e) => set("apply_url", e.target.value)}
            fullWidth
            sx={fieldSx}
          />
        </Stack>
      </Section>

      <Section title="Start date">
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: "center" }}>
          <TextField
            label="Start date"
            type="date"
            value={v.start_date}
            onChange={(e) => set("start_date", e.target.value)}
            disabled={v.start_flexible}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ ...fieldSx, minWidth: 220 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={v.start_flexible}
                onChange={(e) => set("start_flexible", e.target.checked)}
              />
            }
            label="Flexible"
          />
        </Stack>
      </Section>

      <Box sx={{ borderTop: `1px solid ${LINE}`, pt: 3 }}>
        <Typography sx={{ fontSize: "0.85rem", color: INK_MUTED, mb: 2 }}>
          Every post is read by a person before it goes live, usually the same day. You&apos;ll get
          an email either way.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button
            variant="contained"
            size="large"
            onClick={handleSubmit}
            disabled={busy}
            sx={{ bgcolor: INK, "&:hover": { bgcolor: "#06182A" }, px: 4 }}
          >
            {busy ? "Sending…" : submitLabel}
          </Button>
          {onSaveDraft ? (
            <Button
              variant="text"
              size="large"
              onClick={() => onSaveDraft(v)}
              disabled={busy}
              sx={{ color: INK_MUTED }}
            >
              Save as draft
            </Button>
          ) : null}
        </Stack>
        {touched && !valid ? (
          <Typography sx={{ mt: 1.5, fontSize: "0.85rem", color: "#B3261E" }}>
            A few fields still need attention.
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: GOLD,
          mb: note ? 0.75 : 1.75,
        }}
      >
        {title}
      </Typography>
      {note ? (
        <Typography sx={{ fontSize: "0.85rem", color: INK_MUTED, mb: 1.75, maxWidth: 620 }}>
          {note}
        </Typography>
      ) : null}
      <Stack spacing={2}>{children}</Stack>
    </Box>
  );
}
