"use client";

/**
 * Identity layer.
 *
 * Reads Supabase Auth state in the browser and resolves the current
 * vendor / admin row from the database. Falls back to mock data when
 * no session exists yet (e.g. during the test/test preview phase).
 *
 * Server-side identity lookups should use createServerSupabase() +
 * `.from('vendors').select('*').single()` directly — this module is the
 * client-side equivalent that hooks expose to React components.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { member } from "@/lib/memberData";
import { vendor as mockVendor } from "@/lib/vendorData";

export type PlaceholderIdentity = {
  firstName: string;
  lastName: string;
  email: string;
  initials: string;
  loading: boolean;
};

function initialsFrom(name: string, fallback: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function useMemberIdentity(): PlaceholderIdentity {
  // Member portal isn't wired to Supabase Auth yet (Phase 4) — still mock.
  return {
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    initials: member.avatarInitials,
    loading: false,
  };
}

export function useVendorIdentity(): PlaceholderIdentity {
  const [identity, setIdentity] = useState<PlaceholderIdentity>(() => ({
    firstName: mockVendor.contactName.split(" ")[0] ?? mockVendor.displayName,
    lastName: mockVendor.contactName.split(" ").slice(1).join(" ") || "",
    email: mockVendor.contactEmail,
    initials: mockVendor.avatarInitials,
    loading: true,
  }));

  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabase();

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;

      if (!userData.user) {
        // No real session (probably the test/test preview cookie). Keep mock.
        setIdentity((prev) => ({ ...prev, loading: false }));
        return;
      }

      const { data: vendorRow } = await supabase
        .from("vendors")
        .select("contact_name, contact_email, display_name")
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();

      if (!active) return;

      if (vendorRow) {
        const fullName = vendorRow.contact_name ?? "";
        const [first, ...rest] = fullName.split(" ");
        setIdentity({
          firstName: first ?? vendorRow.display_name ?? "Partner",
          lastName: rest.join(" "),
          email: vendorRow.contact_email,
          initials: initialsFrom(fullName || vendorRow.display_name || "Partner", "VP"),
          loading: false,
        });
      } else {
        // Signed in but no vendor row yet. Show the auth user's email.
        const email = userData.user.email ?? "partners@aestheticsuccessnetwork.com";
        setIdentity({
          firstName: "Partner",
          lastName: "",
          email,
          initials: initialsFrom(email.split("@")[0]!, "VP"),
          loading: false,
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return identity;
}

export function useAdminIdentity(): PlaceholderIdentity {
  const [identity, setIdentity] = useState<PlaceholderIdentity>(() => ({
    firstName: "Team",
    lastName: "Admin",
    email: "hello@aestheticsuccessnetwork.com",
    initials: "TA",
    loading: true,
  }));

  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabase();

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;

      if (!userData.user) {
        setIdentity((prev) => ({ ...prev, loading: false }));
        return;
      }

      const { data: adminRow } = await supabase
        .from("admin_users")
        .select("full_name, email, role")
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();

      if (!active) return;

      if (adminRow) {
        const [first, ...rest] = (adminRow.full_name ?? "").split(" ");
        setIdentity({
          firstName: first ?? "Admin",
          lastName: rest.join(" "),
          email: adminRow.email,
          initials: initialsFrom(adminRow.full_name ?? adminRow.email, "AD"),
          loading: false,
        });
      } else {
        const email = userData.user.email ?? "hello@aestheticsuccessnetwork.com";
        setIdentity({
          firstName: "Admin",
          lastName: "",
          email,
          initials: initialsFrom(email.split("@")[0]!, "AD"),
          loading: false,
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return identity;
}

// Sign-out: clears the Supabase session (which clears the auth cookie),
// also pings /api/vendor/login DELETE to clean up any legacy preview cookie,
// and routes to the right "logged out" destination.
type SignOutTarget = "vendor" | "member" | "admin" | "expert" | "seeker";

/** DELETE on each role's login route signs that role out server-side. */
const SIGN_OUT_API: Record<string, string> = {
  member: "/api/member/login",
  expert: "/api/expert/login",
  vendor: "/api/vendor/login",
  admin: "/api/admin/login",
  seeker: "/api/seeker/login",
};

const SIGN_OUT_PAGE: Record<string, string> = {
  member: "/member/login",
  expert: "/expert/login",
  vendor: "/vendor/login",
  admin: "/admin/login",
  seeker: "/seeker/login",
};

export function useSignOut(target: SignOutTarget = "member") {
  const router = useRouter();
  return async () => {
    try {
      const supabase = createBrowserSupabase();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    try {
      // Belt + suspenders: hit the signed-in role's OWN login route so the
      // server clears its session (and, for vendors, the legacy preview
      // cookie) and can write a final auth_audit entry.
      await fetch(SIGN_OUT_API[target] ?? "/api/member/login", { method: "DELETE" });
    } catch {
      // ignore
    }
    router.push(SIGN_OUT_PAGE[target] ?? "/");
  };
}
