"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import StoreOutlinedIcon from "@mui/icons-material/StoreOutlined";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  challengeOptions,
  locationOptions,
  memberRoles,
  waitlist as waitlistCopy,
  waitlistByRole,
} from "@/content";
import { vendorCategories } from "@/docs";
import { C } from "@/theme";

const MotionBox = motion.create(Box);
const OTHER = "Other";
const rose = (a: number) => `rgba(194,78,114,${a})`;
const plum = (a: number) => `rgba(58,35,51,${a})`;

type Role = "member" | "vendor";

function pitchFor(role: Role) {
  return role === "vendor" ? waitlistByRole.vendor : waitlistByRole.member;
}

function OtherReveal({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="other-reveal"
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: "auto", marginTop: 14 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          style={{ overflow: "hidden", width: "100%" }}
        >
          <Box sx={{ pt: "10px", pb: "2px" }}>{children}</Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function WaitlistSection() {
  const reduced = useReducedMotion();

  const [role, setRole] = useState<Role>("member");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const [memberRoleValue, setMemberRoleValue] = useState("");
  const [memberChallengeValue, setMemberChallengeValue] = useState("");
  const [vendorCategoryValue, setVendorCategoryValue] = useState("");

  const isVendor = role === "vendor";
  const pitch = pitchFor(role);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (isVendor && (!agreed || !authorized)) {
      setError("Please confirm both boxes before applying as a vendor partner.");
      return;
    }
    // Prototype: no backend wired. Silent, real-feeling success.
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 700);
  };

  return (
    <Box
      id="waitlist"
      component="section"
      sx={{
        position: "relative",
        py: { xs: 8, md: 12 },
        bgcolor: C.paper,
        borderTop: `1px solid ${C.line}`,
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(45% 50% at 0% 50%, ${rose(0.08)} 0%, transparent 60%), radial-gradient(40% 40% at 100% 100%, rgba(226,160,124,0.12) 0%, transparent 65%)`,
          pointerEvents: "none",
        }}
      />

      <Container maxWidth="lg" sx={{ position: "relative" }}>
        <Grid container spacing={{ xs: 5, md: 7 }} sx={{ alignItems: "flex-start" }}>
          {/* LEFT pitch — switches with the tab */}
          <Grid size={{ xs: 12, md: 5 }}>
            <MotionBox
              initial={reduced ? false : { opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              sx={{ position: { md: "sticky" }, top: { md: 96 } }}
            >
              <Stack spacing={2.5}>
                <Typography variant="overline" sx={{ color: C.accentDark }}>
                  {pitch.eyebrow}
                </Typography>
                <AnimatePresence mode="wait">
                  <MotionBox
                    key={`headline-${role}`}
                    initial={reduced ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Typography
                      variant="h2"
                      component="h2"
                      sx={{ color: C.ink, fontSize: { xs: "1.9rem", md: "2.5rem" }, lineHeight: 1.1, mb: 1.5 }}
                    >
                      {pitch.headline}
                    </Typography>
                    <Typography variant="subtitle1" sx={{ color: C.inkSoft, maxWidth: 480 }}>
                      {pitch.subtitle}
                    </Typography>
                  </MotionBox>
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  <MotionBox
                    key={`bullets-${role}`}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Stack spacing={1.5} sx={{ pt: 1.5 }}>
                      {pitch.benefits.map((b) => (
                        <Stack key={b} direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                          <CheckCircleOutlineIcon sx={{ color: C.accentDark, fontSize: 19, mt: "1px", flexShrink: 0 }} />
                          <Typography variant="body2" sx={{ color: C.ink, fontSize: "0.95rem", lineHeight: 1.6 }}>
                            {b}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </MotionBox>
                </AnimatePresence>
              </Stack>
            </MotionBox>
          </Grid>

          {/* RIGHT form card */}
          <Grid size={{ xs: 12, md: 7 }}>
            <MotionBox
              initial={reduced ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <Box
                component={submitted ? "div" : "form"}
                onSubmit={submitted ? undefined : onSubmit}
                sx={{
                  position: "relative",
                  px: { xs: 3, sm: 3.5, md: 4 },
                  py: { xs: 3, sm: 3.25, md: 3.75 },
                  borderRadius: 4,
                  bgcolor: C.white,
                  border: `1px solid ${C.line}`,
                  boxShadow: `0 1px 0 0 rgba(255,255,255,0.7) inset, 0 40px 80px -30px ${plum(0.18)}, 0 0 0 1px ${rose(0.08)}`,
                  overflow: "hidden",
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: "8%",
                    right: "8%",
                    height: 2,
                    background: `linear-gradient(90deg, transparent, ${rose(0.85)}, rgba(226,160,124,0.95), ${rose(0.85)}, transparent)`,
                  }}
                />

                {submitted ? (
                  <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center", py: 4 }}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: "50%",
                        bgcolor: rose(0.12),
                        border: `1px solid ${rose(0.4)}`,
                        color: C.accentDark,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <CheckCircleOutlineIcon sx={{ fontSize: 34 }} />
                    </Box>
                    <Typography variant="h3" sx={{ color: C.ink, fontSize: "1.6rem" }}>
                      {isVendor ? "Application received." : "You're on the list."}
                    </Typography>
                    <Typography sx={{ color: C.inkSoft, maxWidth: 380 }}>
                      {isVendor
                        ? "Our partner team will review your application and follow up within one business day."
                        : "We'll be in touch before founding spots fill. No payment now — founding members are billed only when the doors open."}
                    </Typography>
                  </Stack>
                ) : (
                  <Stack spacing={2.25}>
                    <ToggleButtonGroup
                      exclusive
                      value={role}
                      onChange={(_, v) => {
                        if (v) {
                          setRole(v as Role);
                          setAgreed(false);
                          setAuthorized(false);
                          setError(null);
                        }
                      }}
                      fullWidth
                      sx={{
                        gap: 1,
                        "& .MuiToggleButtonGroup-grouped": {
                          border: `1px solid ${plum(0.14)} !important`,
                          borderRadius: "999px !important",
                          ml: "0 !important",
                        },
                        "& .MuiToggleButton-root": {
                          flex: 1,
                          color: C.inkSoft,
                          bgcolor: C.paperTint,
                          py: 1.15,
                          textTransform: "none",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          gap: 0.6,
                          transition: "all 350ms cubic-bezier(0.16, 1, 0.3, 1)",
                          "&.Mui-selected": {
                            bgcolor: rose(0.14),
                            color: C.ink,
                            border: `1px solid ${rose(0.6)} !important`,
                            boxShadow: `0 0 0 1px ${rose(0.2)}, 0 12px 30px -10px ${rose(0.4)}`,
                            "&:hover": { bgcolor: rose(0.22) },
                          },
                          "&:hover": { bgcolor: C.paper },
                        },
                      }}
                    >
                      <ToggleButton value="member">
                        <PersonOutlineOutlinedIcon sx={{ fontSize: 17 }} />
                        Join the waitlist
                      </ToggleButton>
                      <ToggleButton value="vendor">
                        <StoreOutlinedIcon sx={{ fontSize: 17 }} />
                        Apply as vendor
                      </ToggleButton>
                    </ToggleButtonGroup>

                    <AnimatePresence mode="wait" initial={false}>
                      {isVendor ? (
                        <motion.div
                          key="vendor"
                          initial={reduced ? false : { opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
                          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                          style={{ width: "100%", minWidth: 0 }}
                        >
                          <Stack spacing={2.25}>
                            <SectionLabel num="01" title="Company" />
                            <Grid container spacing={1.5}>
                              <Grid size={{ xs: 12 }}>
                                <LightField name="companyName" label="Company name" placeholder="Lumière Aesthetics Supply" required />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <LightField name="website" label="Website" placeholder="https://yourcompany.com" required />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <LightField
                                  name="category"
                                  label="Category"
                                  select
                                  value={vendorCategoryValue}
                                  onChange={(e) => setVendorCategoryValue(e.target.value)}
                                  required
                                >
                                  <MenuItem value="" disabled>
                                    Choose
                                  </MenuItem>
                                  {vendorCategories.map((c) => (
                                    <MenuItem key={c} value={c}>
                                      {c}
                                    </MenuItem>
                                  ))}
                                </LightField>
                                <OtherReveal show={vendorCategoryValue === OTHER}>
                                  <LightField name="categoryOther" label="Describe your category" placeholder="What kind of product or service do you provide?" required />
                                </OtherReveal>
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                <LightField name="description" label="What does your company do, in one sentence?" placeholder="We supply medical-grade skincare to aesthetic practices." multiline minRows={2} required />
                              </Grid>
                            </Grid>

                            <SectionLabel num="02" title="Contact" />
                            <Grid container spacing={1.5}>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <LightField name="firstName" label="First name" placeholder="Taylor" required />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <LightField name="lastName" label="Last name" placeholder="Morgan" required />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <LightField name="email" type="email" label="Primary work email" placeholder="taylor@company.com" required />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <LightField name="secondaryEmail" type="email" label="Secondary email (optional)" placeholder="partnerships@company.com" />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <LightField name="contactPhone" type="tel" label="Primary phone" placeholder="+1 (555) 010-1234" required />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <LightField name="secondaryPhone" type="tel" label="Secondary phone (optional)" placeholder="+1 (555) 010-5678" />
                              </Grid>
                            </Grid>

                            <SectionLabel num="03" title="Sign on behalf of the company" />
                            <Grid container spacing={1.5}>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <LightField name="signatureName" label="Signer full name" placeholder="Taylor Morgan" required />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <LightField name="signatureTitle" label="Signer title" placeholder="VP of Partnerships" required />
                              </Grid>
                            </Grid>

                            <Stack spacing={1.25} sx={{ mt: 1 }}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={agreed}
                                    onChange={(e) => setAgreed(e.target.checked)}
                                    size="small"
                                    sx={{ color: plum(0.35), "&.Mui-checked": { color: C.accentDark }, p: 0.5, mr: 0.5 }}
                                  />
                                }
                                label={
                                  <Typography sx={{ fontSize: "0.82rem", color: C.inkSoft, lineHeight: 1.5 }}>
                                    I have read and agree to the{" "}
                                    <Box
                                      component={Link}
                                      href="/agreement/vendor"
                                      target="_blank"
                                      rel="noopener"
                                      sx={{ color: C.accentDark, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }}
                                    >
                                      Vendor Partnership Agreement
                                      <OpenInNewIcon sx={{ fontSize: 12, ml: 0.4, verticalAlign: "middle" }} />
                                    </Box>
                                    .
                                  </Typography>
                                }
                                sx={{ alignItems: "flex-start", m: 0 }}
                              />
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={authorized}
                                    onChange={(e) => setAuthorized(e.target.checked)}
                                    size="small"
                                    sx={{ color: plum(0.35), "&.Mui-checked": { color: C.accentDark }, p: 0.5, mr: 0.5 }}
                                  />
                                }
                                label={
                                  <Typography sx={{ fontSize: "0.82rem", color: C.inkSoft, lineHeight: 1.5 }}>
                                    I confirm I am authorized to commit my company to this partnership.
                                  </Typography>
                                }
                                sx={{ alignItems: "flex-start", m: 0 }}
                              />
                            </Stack>
                          </Stack>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="member"
                          initial={reduced ? false : { opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
                          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                          style={{ width: "100%", minWidth: 0 }}
                        >
                          <Grid container spacing={1.5}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <LightField name="firstName" label="First name" placeholder="Dr. Taylor" required />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <LightField name="lastName" label="Last name" placeholder="Morgan" required />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <LightField name="email" type="email" label="Email address" placeholder="taylor@practice.com" required />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <LightField name="phone" type="tel" label="Mobile number" placeholder="+1 (555) 010-1234" required />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                              <LightField
                                name="roleLabel"
                                label="What best describes your role?"
                                select
                                value={memberRoleValue}
                                onChange={(e) => setMemberRoleValue(e.target.value)}
                              >
                                <MenuItem value="" disabled>
                                  Choose one
                                </MenuItem>
                                {memberRoles.map((r) => (
                                  <MenuItem key={r} value={r}>
                                    {r}
                                  </MenuItem>
                                ))}
                              </LightField>
                              <OtherReveal show={memberRoleValue === OTHER}>
                                <LightField name="roleLabelOther" label="Explain your role" placeholder="e.g. Practice administrator, CFO, regional director" required />
                              </OtherReveal>
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                              <LightField name="practiceName" label="Practice name" placeholder="Morgan Aesthetics Group" />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <LightField name="locations" label="Number of locations" select defaultValue="">
                                <MenuItem value="" disabled>
                                  Choose
                                </MenuItem>
                                {locationOptions.map((o) => (
                                  <MenuItem key={o} value={o}>
                                    {o}
                                  </MenuItem>
                                ))}
                              </LightField>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <LightField
                                name="challenge"
                                label="Biggest challenge right now?"
                                select
                                value={memberChallengeValue}
                                onChange={(e) => setMemberChallengeValue(e.target.value)}
                              >
                                <MenuItem value="" disabled>
                                  Choose
                                </MenuItem>
                                {challengeOptions.map((c) => (
                                  <MenuItem key={c} value={c}>
                                    {c}
                                  </MenuItem>
                                ))}
                              </LightField>
                            </Grid>
                            {memberChallengeValue === OTHER && (
                              <Grid size={{ xs: 12 }}>
                                <OtherReveal show>
                                  <LightField name="challengeOther" label="Describe your biggest challenge" placeholder="What's slowing your practice down right now?" multiline minRows={2} required />
                                </OtherReveal>
                              </Grid>
                            )}
                          </Grid>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!isVendor && (
                      <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start", color: C.muted, mt: 0.5 }}>
                        <LockOutlinedIcon sx={{ fontSize: 14, mt: "3px", flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ color: C.muted, fontSize: "0.78rem", lineHeight: 1.55 }}>
                          By joining the waitlist you agree to the{" "}
                          <DocLink href="/agreement/member">Member Agreement</DocLink>,{" "}
                          <DocLink href="/legal/refund">Refund Policy</DocLink>, and{" "}
                          <DocLink href="/legal/privacy">Privacy Policy</DocLink>. {waitlistCopy.footerNote}
                        </Typography>
                      </Stack>
                    )}

                    {error && (
                      <Typography
                        role="alert"
                        sx={{
                          color: "#8C1D1D",
                          fontWeight: 600,
                          fontSize: "0.82rem",
                          bgcolor: "rgba(220,60,60,0.08)",
                          border: "1px solid rgba(220,60,60,0.25)",
                          borderRadius: 2,
                          px: 1.5,
                          py: 1,
                        }}
                      >
                        {error}
                      </Typography>
                    )}

                    <Button
                      type="submit"
                      variant="contained"
                      color="secondary"
                      size="large"
                      disabled={submitting || (isVendor && (!agreed || !authorized))}
                      fullWidth
                      endIcon={submitting ? <CircularProgress size={18} thickness={5} sx={{ color: "#fff" }} /> : <ArrowForwardIcon />}
                      sx={{ py: 1.65, fontSize: "0.98rem", boxShadow: `0 18px 38px -14px ${rose(0.55)}` }}
                    >
                      {submitting
                        ? isVendor
                          ? "Sending application…"
                          : waitlistCopy.submittingLabel
                        : isVendor
                          ? "Apply as vendor partner"
                          : waitlistCopy.submitLabel}
                    </Button>

                    {!isVendor && (
                      <Typography variant="body2" sx={{ color: C.muted, fontSize: "0.74rem", textAlign: "center" }}>
                        No payment now. Founding members are billed only when the doors open on launch day.
                      </Typography>
                    )}
                  </Stack>
                )}
              </Box>
            </MotionBox>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Box
      component={Link}
      href={href}
      target="_blank"
      rel="noopener"
      sx={{ color: C.accentDark, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }}
    >
      {children}
      <OpenInNewIcon sx={{ fontSize: 11, ml: 0.3, verticalAlign: "middle" }} />
    </Box>
  );
}

function SectionLabel({ num, title }: { num: string; title: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mt: 1, width: "100%", minWidth: 0 }}>
      <Box
        sx={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: "50%",
          bgcolor: rose(0.14),
          color: C.accentDark,
          display: "grid",
          placeItems: "center",
          fontSize: "0.66rem",
          fontWeight: 700,
          border: `1px solid ${rose(0.3)}`,
        }}
      >
        {num}
      </Box>
      <Typography variant="overline" sx={{ color: C.ink, fontSize: "0.7rem", letterSpacing: "0.16em", fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>
        {title}
      </Typography>
      <Box sx={{ flex: 1, height: 1, bgcolor: C.line }} />
    </Box>
  );
}

type FieldProps = React.ComponentProps<typeof TextField> & { label: string };

function LightField({ label, name, ...props }: FieldProps) {
  return (
    <TextField
      {...props}
      name={name}
      label={label}
      variant="outlined"
      fullWidth
      slotProps={{
        inputLabel: {
          shrink: true,
          sx: {
            color: C.inkSoft,
            fontWeight: 600,
            fontSize: "0.85rem",
            "&.MuiInputLabel-shrink": { transform: "translate(14px, -9px) scale(0.78)" },
            "&.Mui-focused": { color: C.accentDark },
          },
        },
      }}
      sx={{
        "& .MuiOutlinedInput-root": {
          bgcolor: C.white,
          color: C.ink,
          minHeight: 50,
          transition: "all 280ms cubic-bezier(0.16, 1, 0.3, 1)",
          "& fieldset": { borderColor: plum(0.18), borderWidth: 1 },
          "&:hover fieldset": { borderColor: plum(0.45) },
          "&.Mui-focused": { boxShadow: `0 0 0 4px ${rose(0.18)}` },
          "&.Mui-focused fieldset": { borderColor: C.accent, borderWidth: 1.5 },
        },
        "& .MuiOutlinedInput-input": {
          color: C.ink,
          fontSize: "0.92rem",
          fontWeight: 500,
          py: 1.4,
          "&::placeholder": { color: C.muted, opacity: 1, fontSize: "0.82rem", fontWeight: 400 },
        },
        "& .MuiSelect-select": { py: "13px !important" },
      }}
    />
  );
}
