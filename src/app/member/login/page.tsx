"use client";

import { Suspense } from "react";
import OtpLoginForm from "@/components/auth/OtpLoginForm";

export default function MemberLoginPage() {
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
