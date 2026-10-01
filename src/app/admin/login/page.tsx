"use client";

import { Suspense } from "react";
import OtpLoginForm from "@/components/auth/OtpLoginForm";

/**
 * Admin sign-in. OTP-based: enter email → receive 6-digit code → enter
 * code → land on /admin. Allow-list (admin_users table) enforced both
 * at send and verify endpoints, defense in depth.
 */
export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <OtpLoginForm
        config={{
          roleLabel: "admin",
          sendEndpoint: "/api/admin/login",
          verifyEndpoint: "/api/admin/verify-otp",
          emailStepTitle: "Sign in to the admin console",
          codeStepTitle: "Enter your code",
          emailStepSubtitle:
            "Only allow-listed admin emails can sign in. Codes expire in 5 minutes.",
          codeStepSubtitle:
            "Check your inbox for a 6-digit code from support@aestheticsuccessnetwork.com.",
          accentColor: "#8C1D1D",
          accentTint: "rgba(140,29,29,0.10)",
          unknownEmailMessage:
            "That email is not on the admin allow-list. Ask an owner-role admin to add you.",
        }}
      />
    </Suspense>
  );
}
