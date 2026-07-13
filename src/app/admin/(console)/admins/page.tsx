"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";

type AdminRow = {
  id: string;
  email: string;
  full_name: string;
  role: "owner" | "admin" | "reviewer" | "support";
  active: boolean;
  last_active_at: string | null;
  created_at: string;
};

export default function AdminTeamPage() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/admins", { cache: "no-store" });
      const body = (await res.json()) as { rows?: AdminRow[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load.");
      setRows(body.rows ?? []);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, fullName: newName, role: newRole }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not add admin.");
      setNotice(
        `Added ${newEmail}. Remember to also create this user in Supabase Authentication → Users so the magic link works.`,
      );
      setNewEmail("");
      setNewName("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add admin.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: AdminRow) => {
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, active: !x.active } : x)));
    try {
      const res = await fetch("/api/admin/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, active: !row.active }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Update failed.");
      }
    } catch (e) {
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, active: row.active } : x)));
      setErr(e instanceof Error ? e.message : "Update failed.");
    }
  };

  return (
    <Stack spacing={3.5}>
      <Box>
        <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
          TEAM
        </Typography>
        <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
          Admin team
        </Typography>
        <Typography sx={{ color: "text.secondary", maxWidth: 680 }}>
          Everyone on this list can sign in to the console with a magic link. Adding or
          deactivating admins is owner-only. New admins must also exist in Supabase Authentication
          → Users (create the user there with the same email).
        </Typography>
      </Box>

      {err && (
        <Alert severity="error" onClose={() => setErr(null)}>
          {err}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={addAdmin}
        sx={{
          p: 2.5,
          borderRadius: "16px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "common.white",
        }}
      >
        <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Add an admin</Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            label="Email"
            type="email"
            size="small"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            sx={{ flex: 1.2 }}
          />
          <TextField
            label="Full name"
            size="small"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Select
            size="small"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="reviewer">Reviewer</MenuItem>
            <MenuItem value="support">Support</MenuItem>
            <MenuItem value="owner">Owner</MenuItem>
          </Select>
          <Button
            type="submit"
            variant="contained"
            disabled={busy}
            startIcon={<PersonAddAltOutlinedIcon />}
          >
            {busy ? "Adding…" : "Add"}
          </Button>
        </Stack>
      </Box>

      <Box
        sx={{
          borderRadius: "20px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "common.white",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <Box sx={{ p: 5, textAlign: "center" }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Loading…
            </Typography>
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ p: 5, textAlign: "center" }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No admins found. Seed the admin team with the SQL in supabase/README.md.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Box
              component="table"
              sx={{
                width: "100%",
                borderCollapse: "collapse",
                "& th": {
                  textAlign: "left",
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "text.secondary",
                  fontWeight: 700,
                  px: 2.5,
                  py: 1.5,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  bgcolor: "rgba(247,245,240,0.6)",
                },
                "& td": {
                  px: 2.5,
                  py: 1.75,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  fontSize: "0.88rem",
                },
                "& tr:last-child td": { borderBottom: "none" },
              }}
            >
              <Box component="thead">
                <Box component="tr">
                  <Box component="th">Admin</Box>
                  <Box component="th">Role</Box>
                  <Box component="th">Last active</Box>
                  <Box component="th">Active</Box>
                </Box>
              </Box>
              <Box component="tbody">
                {rows.map((row) => (
                  <Box component="tr" key={row.id}>
                    <Box component="td">
                      <Typography sx={{ fontWeight: 600 }}>{row.full_name}</Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.78rem" }}>
                        {row.email}
                      </Typography>
                    </Box>
                    <Box component="td">
                      <Chip
                        label={row.role}
                        size="small"
                        sx={{
                          textTransform: "capitalize",
                          fontSize: "0.7rem",
                          height: 22,
                          bgcolor:
                            row.role === "owner" ? "rgba(217,168,75,0.16)" : "rgba(10,19,32,0.06)",
                          color: row.role === "owner" ? "#7A5B17" : "#0A1320",
                        }}
                      />
                    </Box>
                    <Box component="td">
                      <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                        {row.last_active_at
                          ? new Date(row.last_active_at).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "—"}
                      </Typography>
                    </Box>
                    <Box component="td">
                      <Switch checked={row.active} onChange={() => toggleActive(row)} size="small" />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Stack>
  );
}
