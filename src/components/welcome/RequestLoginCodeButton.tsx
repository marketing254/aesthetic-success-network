"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Fires POST /api/portal/login (the existing member/expert/partner OTP
 * request route — unmodified) so a brand-new founding member can get
 * into the portal straight from /welcome without knowing that route
 * exists.
 */
export default function RequestLoginCodeButton({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "busy" | "sent" | "error">("idle");

  if (!email) {
    return (
      <Link className="btn bronze" href="/login">
        Log in to your portal &rarr;
      </Link>
    );
  }

  if (status === "sent") {
    return (
      <div className="thanks" style={{ textAlign: "center" }}>
        <h3>Code sent.</h3>
        <p>
          Check {email} for your 6-digit login code, then head to{" "}
          <Link href={`/login?email=${encodeURIComponent(email)}`}>the login page</Link> to enter
          it.
        </p>
      </div>
    );
  }

  const onClick = async () => {
    setStatus("busy");
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div>
      <button className="btn bronze" type="button" onClick={onClick} disabled={status === "busy"}>
        {status === "busy" ? "Sending…" : "Send my login code"}
      </button>
      {status === "error" && (
        <div className="formerror" role="alert" style={{ marginTop: 14 }}>
          Could not send a code right now.{" "}
          <Link href={`/login?email=${encodeURIComponent(email)}`}>Try the login page</Link>{" "}
          instead.
        </div>
      )}
    </div>
  );
}
