import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { serverError } from "@/lib/api/errorResponse";
import { roleLabel } from "@/lib/jobs/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/job-seekers          → JSON
 * GET /api/admin/job-seekers?format=csv → CSV download
 *
 * The captured applicant list. This is the commercial reason the free
 * account exists: an applicant who mailtos a practice is invisible to
 * us, and one who registers is a contactable person with a stated role
 * interest and a city.
 *
 * Filtered to account_type='job_seeker', so paying members never appear
 * here — the same split that keeps job seekers off /api/admin/members.
 */

const MAX_ROWS = 5000;

type SeekerRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  job_role_interest: string | null;
  created_at: string;
};

/**
 * One CSV cell.
 *
 * The leading-apostrophe guard is not cosmetic: Excel and Sheets treat a
 * cell starting with =, +, - or @ as a formula, so a name typed as
 * "=cmd|..." becomes a live formula in whoever opens this file. Every
 * value here is user-supplied through a public signup form, which is
 * exactly the input you must assume is hostile.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(rows: SeekerRow[], counts: Map<string, number>): string {
  const header = [
    "First name",
    "Last name",
    "Email",
    "Phone",
    "City",
    "Role interest",
    "Applications",
    "Registered",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.city,
        r.job_role_interest ? roleLabel(r.job_role_interest) : "",
        counts.get(r.id) ?? 0,
        r.created_at.slice(0, 10),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // CRLF + BOM: Excel on Windows opens UTF-8 CSV as mojibake without the
  // BOM, and this file is going to be opened in Excel on Windows.
  return "﻿" + lines.join("\r\n");
}

export async function GET(req: Request) {
  const route = "GET /api/admin/job-seekers";

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from("members")
      .select("id, first_name, last_name, email, phone, city, job_role_interest, created_at")
      .eq("account_type", "job_seeker")
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS)
      .returns<SeekerRow[]>();
    if (error) throw error;

    const rows = data ?? [];

    // Application counts, tallied in memory rather than with a grouped
    // query. Honest about the trade: this is fine at launch scale and
    // becomes the wrong approach somewhere in the tens of thousands, at
    // which point it wants a view or a denormalised counter on members.
    const counts = new Map<string, number>();
    if (rows.length > 0) {
      const { data: apps } = await admin
        .from("job_applications")
        .select("applicant_member_id")
        .in(
          "applicant_member_id",
          rows.map((r) => r.id),
        );
      for (const a of apps ?? []) {
        const key = a.applicant_member_id;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const url = new URL(req.url);
    if (url.searchParams.get("format") === "csv") {
      const today = new Date().toISOString().slice(0, 10);
      return new NextResponse(toCsv(rows, counts), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="asn-job-seekers-${today}.csv"`,
          // This file is a list of real people's contact details. It
          // should never sit in a shared cache.
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      truncated: rows.length === MAX_ROWS,
      seekers: rows.map((r) => ({ ...r, application_count: counts.get(r.id) ?? 0 })),
    });
  } catch (err) {
    return serverError(err, { route });
  }
}
