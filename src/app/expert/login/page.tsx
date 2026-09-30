"use client";

import { Suspense } from "react";
import OtpLoginForm from "@/components/auth/OtpLoginForm";
import { EP } from "@/components/shared/TopNavPortalShell";

/**
 * Expert sign-in. OTP-based: enter email → receive 6-digit code → enter
 * code → land on /expert. Account creation happens via the admin
 * Add-expert flow at /admin/experts, not here.
 *
 * Same fields and endpoints as every other portal login; only the band
 * beside the form uses the expert portal's espresso gradient with a
 * bronze glow.
 */
export default function ExpertLoginPage() {
  return (
    <Suspense fallback={null}>
      <OtpLoginForm
        band={{ from: EP.espresso, to: EP.espressoDeep, glow: "176,122,44" }}
        config={{
          roleLabel: "expert",
          sendEndpoint: "/api/expert/login",
          verifyEndpoint: "/api/expert/verify-otp",
          emailStepTitle: "Sign in to your expert portal",
          codeStepTitle: "Enter your code",
          emailStepSubtitle:
            "We'll email you a 6-digit code. No password to remember.",
          codeStepSubtitle:
            "Check your inbox for a 6-digit code from support@aestheticsuccessnetwork.com.",
          accentColor: "#0E2A3D",
          accentTint: "rgba(14,42,61,0.08)",
          unknownEmailMessage:
            "We couldn't find an expert account for that email. Apply at /experts first; we'll email you once the team reviews your application.",
        }}
      />
    </Suspense>
  );
}
