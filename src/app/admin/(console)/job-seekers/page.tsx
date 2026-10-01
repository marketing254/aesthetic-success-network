"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { JOB_ROLES, roleLabel } from "@/lib/jobs/constants";
import { useLiveRefresh } from "@/lib/jobs/useLiveRefresh";

/**
 * Admin → Job seekers.
 *
 * The free accounts created to apply for jobs. This page is the
 * commercial return on the phase-2 change: applicants used to leave no
 * trace, and now they are a segmented, exportable list.
 *
 * Paying members never appear here. The API filters on
 * account_type='job_seeker', the same split that keeps job seekers off
 * the Members page and out of the membership counts on the dashboard.
 */

type Seeker = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  job_role_interest: string | null;
  created_at: string;
  application_count: number;
};

export default function AdminJobSeekersPage() {
  const [rows, setRows] = useState<Seeker[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/job-seekers", { cache: "no-store" });
      const body = (await res.json()) as {
        ok?: boolean;
        seekers?: Seeker[];
        truncated?: boolean;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setErr(body.error ?? "Couldn't load job seekers.");
        return;
      }
      setRows(body.seekers ?? []);
      setTruncated(!!body.truncated);
    } catch {
      setErr("Couldn't reach the server.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(load);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter && r.job_role_interest !== roleFilter) return false;
      if (!q) return true;
      return [r.first_name, r.last_name, r.email, r.city]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [rows, query, roleFilter]);

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
      >
        <Box>
          <Typography component="h1" sx={{ fontSize: "1.6rem", fontWeight: 700 }}>
            Job seekers
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.9rem" }}>
            Free accounts created to apply for jobs. Nobody here has a membership.
          </Typography>
        </Box>
        {/* A plain link, not a fetch-and-blob. The endpoint sets
            Content-Disposition and the browser handles the download,
            which keeps a file of real contact details out of JS memory
            and out of any client-side cache. */}
        <Button
          href="/api/admin/job-seekers?format=csv"
          variant="outlined"
          startIcon={<DownloadIcon />}
          disabled={!rows || rows.length === 0}
        >
          Export CSV
        </Button>
      </Stack>

      {err ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {err}
        </Alert>
      ) : null}

      {truncated ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          Showing the 5,000 most recent. The CSV export has the same limit; say the
          word and we&apos;ll paginate it.
        </Alert>
      ) : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          size="small"
          label="Search name, email or city"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ minWidth: 280 }}
        />
        <TextField
          select
          size="small"
          label="Role they want"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="">All roles</MenuItem>
          {JOB_ROLES.map((r) => (
            <MenuItem key={r.value} value={r.value}>
              {r.label}
            </MenuItem>
          ))}
        </TextField>
        {filtered ? (
          <Chip
            label={`${filtered.length} ${filtered.length === 1 ? "person" : "people"}`}
            sx={{ alignSelf: "center" }}
          />
        ) : null}
      </Stack>

      {rows === null && !err ? (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <CircularProgress size={18} />
          <Typography sx={{ color: "text.secondary" }}>Loading…</Typography>
        </Stack>
      ) : null}

      {filtered && filtered.length === 0 ? (
        <Box sx={{ py: 6, textAlign: "center", border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
            {rows && rows.length > 0 ? "Nobody matches that filter" : "No job seekers yet"}
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            {rows && rows.length > 0
              ? "Try a different search."
              : "They appear here as soon as someone registers to apply for a job."}
          </Typography>
        </Box>
      ) : null}

      {filtered && filtered.length > 0 ? (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>City</TableCell>
                <TableCell>Looking for</TableCell>
                <TableCell align="right">Applications</TableCell>
                <TableCell>Registered</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    {[r.first_name, r.last_name].filter(Boolean).join(" ")}
                  </TableCell>
                  <TableCell>
                    <a href={`mailto:${r.email}`}>{r.email}</a>
                  </TableCell>
                  <TableCell>{r.phone ?? ""}</TableCell>
                  <TableCell>{r.city ?? ""}</TableCell>
                  <TableCell>
                    {r.job_role_interest ? roleLabel(r.job_role_interest) : ""}
                  </TableCell>
                  <TableCell align="right">{r.application_count}</TableCell>
                  <TableCell>{r.created_at.slice(0, 10)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : null}
    </Box>
  );
}
