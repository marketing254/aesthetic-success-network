"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Box, Button, Typography } from "@mui/material";
import OtpLoginForm from "@/components/auth/OtpLoginForm";

const MEMBER_LAUNCH_OPEN = process.env.NEXT_PUBLIC_MEMBER_LAUNCH_ENABLED === "true";

export default function MemberLoginPage() {
  if (!MEMBER_LAUNCH_OPEN) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#F2EEE6", display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
        <Box sx={{ maxWidth: 440, bgcolor: "#fff", borderRadius: "16px", border: "1px solid rgba(10,19,32,0.08)", p: 4, textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/asn-nav-icon.png" alt="Aesthetic Success Network" width={52} height={52} style={{ borderRadius: 12 }} />
          <Typography sx={{ fontWeight: 700, fontSize: "1.25rem", mt: 2, mb: 1 }}>Member sign-in opens at launch</Typography>
          <Typography sx={{ color: "text.secondary", mb: 3 }}>
            The member portal is not open yet. Reserve your founding spot and we will email you first, before the doors open.
          </Typography>
          <Button component={Link} href="/join/member" variant="contained">
            Reserve a founding spot
          </Button>
        </Box>
      </Box>
    );
  }
  return (
    <Suspense fallback={null}>
      <OtpLoginForm
        config={{
          roleLabel: "member",
          sendEndpoint: "/api/member/login",
          verifyEndpoint: "/api/member/verify-otp",
          emailStepTitle: "Sign in to your member portal",
          codeStepTitle: "Enter your code",
          emailStepSubtitle:
            "We'll email you a 6-digit code. No password to remember.",
          codeStepSubtitle:
            "Check your inbox for a 6-digit code from support@aestheticsuccessnetwork.com.",
          accentColor: "#A07823",
          accentTint: "rgba(217,168,75,0.16)",
          signupHref: "/join",
          forwardNextParam: true,
          signupLabel: "Not a member yet?",
          unknownEmailMessage:
            "We couldn't find a member account for that email. Sign up at /join, or check the spelling.",
        }}
      />
    </Suspense>
  );
}
