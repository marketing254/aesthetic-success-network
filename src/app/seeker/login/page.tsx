"use client";

import { Suspense } from "react";
import OtpLoginForm from "@/components/auth/OtpLoginForm";

/**
 * Job-seeker sign-in.
 *
 * Separate from /member/login because the two audiences are different
 * and the copy has to say so. A candidate arriving here has just been
 * asked to make an account to apply for a job, and the one thing they
 * are worried about is whether this is the $29 thing. Say it isn't.
 */
export default function SeekerLoginPage() {
  return (
    <Suspense fallback={null}>
      <OtpLoginForm
        config={{
          roleLabel: "job seeker",
          sendEndpoint: "/api/seeker/login",
          verifyEndpoint: "/api/seeker/verify-otp",
          emailStepTitle: "Sign in to apply",
          codeStepTitle: "Enter your code",
          emailStepSubtitle:
            "We'll email you a 6-digit code. No password, and applying is free.",
          codeStepSubtitle:
            "Check your inbox for a 6-digit code from support@aestheticsuccessnetwork.com.",
          accentColor: "#A07823",
          accentTint: "rgba(217,168,75,0.16)",
          signupHref: "/seeker/join",
          signupLabel: "No account yet?",
          unknownEmailMessage:
            "We couldn't find an account for that email. Create a free one, it takes a minute.",
          // Sends them back to the job they were applying for. The verify
          // endpoint allowlists the value; see forwardNextParam.
          forwardNextParam: true,
        }}
      />
    </Suspense>
  );
}
