"use client";

import { Suspense } from "react";
import OtpLoginForm from "@/components/auth/OtpLoginForm";

/**
 * Expert sign-in. OTP-based: enter email → receive 6-digit code → enter
 * code → land on /expert. Account creation happens via the admin
 * Add-expert flow at /admin/experts, not here.
 */
export default function ExpertLoginPage() {
  return (
    <Suspense fallback={null}>
      <OtpLoginForm
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
