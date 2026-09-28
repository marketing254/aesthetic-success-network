"use client";

import { Suspense } from "react";
import OtpLoginForm from "@/components/auth/OtpLoginForm";

/**
 * Company (vendor) sign-in. OTP-based: enter email → receive 6-digit
 * code → enter code → land on /vendor. Application happens at
 * /companies#apply (in-page WaitlistSection); the team reviews and an
 * admin activates the auth user from the admin portal.
 */
export default function VendorLoginPage() {
  return (
    <Suspense fallback={null}>
      <OtpLoginForm
        config={{
          roleLabel: "company",
          sendEndpoint: "/api/vendor/login",
          verifyEndpoint: "/api/vendor/verify-otp",
          emailStepTitle: "Sign in to your company portal",
          codeStepTitle: "Enter your code",
          emailStepSubtitle:
            "We'll email you a 6-digit code. No password to remember.",
          codeStepSubtitle:
            "Check your inbox for a 6-digit code from support@aestheticsuccessnetwork.com.",
          accentColor: "#0E2A3D",
          accentTint: "rgba(14,42,61,0.08)",
          signupHref: "/companies#apply",
          signupLabel: "Want to list your company?",
          unknownEmailMessage:
            "We couldn't find an application for that email. Apply at /companies first, then come back to sign in.",
        }}
      />
    </Suspense>
  );
}
