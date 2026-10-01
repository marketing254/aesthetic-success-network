"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NextLink from "next/link";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { CV_ACCEPTED_EXT } from "@/lib/jobs/constants";
import { validateCvFile } from "@/lib/jobs/validateApplication";

/**
 * The apply panel on a public job page.
 *
 * Three states, decided after hydration by /api/seeker/me:
 *
 *   signed out      → the reason to register, and the two links
 *   already applied → what they did and where to track it
 *   signed in       → the form
 *
 * It resolves its own signed-in state rather than being handed it. The
 * page around it renders the JobPosting structured data for anonymous
 * crawlers and has never needed to know who you are; keeping the auth
 * lookup in here means adding the apply gate didn't change how that
 * page loads at all.
 *
 * Posts that only take applications on an external site never render
 * the form — there is no inbox for us to deliver to — but they still
 * sit behind the account gate, because capturing the applicant is the
 * point of the gate and it works just as well before an outbound click.
 */

const INK = "#0A1320";
const INK_MUTED = "#5C6770";
const GOLD = "#A07823";
const LINE = "#E0DACE";

type MeState =
  | { status: "loading" }
  | { status: "anon" }
  | {
      status: "known";
      fullName: string;
      email: string;
      phone: string | null;
      alreadyApplied: boolean;
    };

export default function JobApplyPanel({
  slug,
  practiceName,
  applyUrl,
  hasApplyEmail,
  embedded = false,
}: {
  slug: string;
  practiceName: string;
  applyUrl: string | null;
  hasApplyEmail: boolean;
  /** Rendered inside its own card (no top divider / margin). */
  embedded?: boolean;
}) {
  const [me, setMe] = useState<MeState>({ status: "loading" });
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [copyToSelf, setCopyToSelf] = useState(true);
  const [cv, setCv] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ warning: string | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/seeker/me?slug=${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as {
        signed_in?: boolean;
        full_name?: string;
        email?: string;
        phone?: string | null;
        already_applied?: boolean;
      };
      if (!body.signed_in) {
        setMe({ status: "anon" });
        return;
      }
      setMe({
        status: "known",
        fullName: body.full_name ?? "",
        email: body.email ?? "",
        phone: body.phone ?? null,
        alreadyApplied: !!body.already_applied,
      });
      setFullName(body.full_name ?? "");
      setEmail(body.email ?? "");
      setPhone(body.phone ?? "");
    } catch {
      // Treat an unreachable check as signed-out. The apply route
      // re-checks anyway, so the worst case is one extra sign-in prompt.
      setMe({ status: "anon" });
    }
  }, [slug]);

  useEffect(() => {
    // Deferred a tick so the effect body itself never sets state
    // (react-hooks/set-state-in-effect); the fetch resolves later anyway.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setCv(null);
      return;
    }
    // Same validator the route runs. Checking here saves the applicant
    // uploading 10MB before being told no; the server check is the one
    // that actually decides.
    const check = validateCvFile({ name: file.name, size: file.size, type: file.type });
    if (!check.ok) {
      setErr(check.error);
      setCv(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setErr(null);
    setCv(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!cv) {
      setErr("Attach your CV. Practices won't consider an application without one.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const form = new FormData();
      form.set("full_name", fullName.trim());
      form.set("email", email.trim().toLowerCase());
      form.set("phone", phone.trim());
      form.set("message", message.trim());
      form.set("copy_to_applicant", copyToSelf ? "true" : "false");
      form.set("cv", cv);

      const res = await fetch(`/api/jobs/${encodeURIComponent(slug)}/apply`, {
        method: "POST",
        body: form,
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        warning?: string | null;
        reason?: string;
      };

      if (!res.ok || !body.ok) {
        if (body.reason === "signin_required") {
          setMe({ status: "anon" });
          return;
        }
        setErr(body.error ?? "Couldn't send your application. Please try again.");
        return;
      }
      setDone({ warning: body.warning ?? null });
    } catch {
      setErr("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const returnTo = `/jobs/${slug}`;
  const joinHref = `/seeker/join?next=${encodeURIComponent(returnTo)}`;
  const loginHref = `/seeker/login?next=${encodeURIComponent(returnTo)}`;

  const wrap = (children: React.ReactNode) => (
    <Box sx={embedded ? undefined : { mt: 4, pt: 4, borderTop: `1px solid ${LINE}` }}>
      {children}
    </Box>
  );

  if (me.status === "loading") {
    return wrap(
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <CircularProgress size={18} sx={{ color: GOLD }} />
        <Typography sx={{ color: INK_MUTED, fontSize: "0.9rem" }}>Loading…</Typography>
      </Stack>,
    );
  }

  // ---------------------------------------------------------------
  // Signed out. The ask has to be worth it, so say what they get
  // rather than just demanding a sign-in.
  // ---------------------------------------------------------------
  if (me.status === "anon") {
    return wrap(
      <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
        <Typography sx={{ fontWeight: 700, color: INK, fontSize: "1.05rem" }}>
          Apply for this role
        </Typography>
        <Typography sx={{ color: INK_MUTED, fontSize: "0.95rem", maxWidth: 520 }}>
          Create a free account to apply. It takes a minute, it lets you track
          where your application got to, and you never have to retype your
          details for the next job. Applying is free; membership is a separate
          thing for practices that are hiring.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button
            component={NextLink}
            href={joinHref}
            variant="contained"
            size="large"
            sx={{ bgcolor: INK, "&:hover": { bgcolor: "#06182A" }, px: 4 }}
          >
            Create a free account
          </Button>
          <Button
            component={NextLink}
            href={loginHref}
            size="large"
            sx={{ color: INK, borderColor: LINE }}
            variant="outlined"
          >
            I already have one
          </Button>
        </Stack>
      </Stack>,
    );
  }

  // ---------------------------------------------------------------
  // Signed in, and this job only takes applications elsewhere.
  // ---------------------------------------------------------------
  if (!hasApplyEmail) {
    return wrap(
      <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
        <Typography sx={{ fontWeight: 700, color: INK, fontSize: "1.05rem" }}>
          Apply for this role
        </Typography>
        <Typography sx={{ color: INK_MUTED, fontSize: "0.95rem" }}>
          {practiceName} takes applications on their own site.
        </Typography>
        {applyUrl ? (
          <Button
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            size="large"
            sx={{ bgcolor: INK, "&:hover": { bgcolor: "#06182A" }, px: 4 }}
          >
            Apply on their site
          </Button>
        ) : null}
      </Stack>,
    );
  }

  if (done) {
    return wrap(
      <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
        <Alert severity={done.warning ? "warning" : "success"} sx={{ width: "100%" }}>
          {done.warning ?? `Your application has been sent to ${practiceName}.`}
        </Alert>
        <Typography sx={{ color: INK_MUTED, fontSize: "0.9rem" }}>
          They reply to you directly.{" "}
          <NextLink href="/seeker/applications" style={{ color: GOLD }}>
            Track your applications
          </NextLink>
          .
        </Typography>
      </Stack>,
    );
  }

  if (me.alreadyApplied) {
    return wrap(
      <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <Typography sx={{ fontWeight: 700, color: INK, fontSize: "1.05rem" }}>
          You&apos;ve applied for this role
        </Typography>
        <Typography sx={{ color: INK_MUTED, fontSize: "0.95rem" }}>
          {practiceName} has your application.{" "}
          <NextLink href="/seeker/applications" style={{ color: GOLD }}>
            Check its status
          </NextLink>
          .
        </Typography>
      </Stack>,
    );
  }

  // ---------------------------------------------------------------
  // The form.
  // ---------------------------------------------------------------
  return wrap(
    <Box component="form" onSubmit={submit}>
      <Typography sx={{ fontWeight: 700, color: INK, fontSize: "1.05rem", mb: 2 }}>
        Apply for this role
      </Typography>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      <Stack spacing={2.5} sx={{ maxWidth: 560 }}>
        <TextField
          label="Your name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label="Your email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          helperText={`${practiceName} replies to this address.`}
          fullWidth
        />
        <TextField
          label="Contact number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          helperText="Optional, but most practices call before they email."
          fullWidth
        />
        <TextField
          label="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          multiline
          minRows={4}
          placeholder="Why you're a good fit, your availability, anything they should know."
          fullWidth
        />

        <Box>
          <Button
            component="label"
            variant="outlined"
            startIcon={<UploadFileIcon />}
            sx={{ color: INK, borderColor: LINE }}
          >
            {cv ? "Change CV" : "Attach your CV"}
            <input
              ref={fileRef}
              type="file"
              hidden
              accept={CV_ACCEPTED_EXT.join(",")}
              onChange={pickFile}
            />
          </Button>
          <Typography sx={{ mt: 1, fontSize: "0.85rem", color: INK_MUTED }}>
            {cv ? cv.name : "PDF or Word, up to 10MB. Required."}
          </Typography>
        </Box>

        <FormControlLabel
          control={
            <Checkbox
              checked={copyToSelf}
              onChange={(e) => setCopyToSelf(e.target.checked)}
            />
          }
          label="Send me a copy of my application"
        />

        <Box>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={busy}
            startIcon={busy ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{ bgcolor: INK, "&:hover": { bgcolor: "#06182A" }, px: 4 }}
          >
            {busy ? "Sending…" : "Send application"}
          </Button>
          {/* Say what we actually do with it. The old copy on this page
              promised we didn't keep anything, which stopped being true
              the moment applications started being stored. */}
          <Typography sx={{ mt: 1.5, fontSize: "0.85rem", color: INK_MUTED, maxWidth: 520 }}>
            Your application goes to {practiceName} and they reply to you
            directly. We keep a copy so you can track it here.
          </Typography>
        </Box>
      </Stack>
    </Box>,
  );
}
