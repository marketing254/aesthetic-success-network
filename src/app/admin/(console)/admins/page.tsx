"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import LinkOffOutlinedIcon from "@mui/icons-material/LinkOffOutlined";

type AdminRow = {
  id: string;
  email: string;
  full_name: string;
  role: "owner" | "admin" | "reviewer" | "support";
  active: boolean;
  last_active_at: string | null;
  auth_user_id: string | null;
  created_at: string;
};

const ROLE_TINT: Record<AdminRow["role"], { bg: string; color: string; label: string }> = {
  owner: { bg: "rgba(14,42,61,0.07)", color: "#0E2A3D", label: "Owner" },
  admin: { bg: "rgba(217,168,75,0.16)", color: "#A07823", label: "Admin" },
  reviewer: { bg: "rgba(34,108,78,0.12)", color: "#1F5C40", label: "Reviewer" },
  support: { bg: "rgba(140,29,29,0.1)", color: "#8C1D1D", label: "Support" },
};

export default function AdminTeamPage() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AdminRow["role"]>("admin");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/admins", { cache: "no-store" });
      const body = (await res.json()) as { rows?: AdminRow[]; error?: string };
      if (!res.ok || body.error) {
        setError(body.error ?? `Failed to load (${res.status})`);
        setRows([]);
        return;
      }
      setRows(body.rows ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitInvite = async () => {
    setInviting(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, full_name: fullName, role }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || body.error) {
        setToast(body.error ?? `Failed (${res.status})`);
        return;
      }
      setToast(`Added ${email} to the admin allow-list. They still need an auth user pre-created in Supabase.`);
      setEmail("");
      setFullName("");
      setRole("admin");
      setInviteOpen(false);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed.");
    } finally {
      setInviting(false);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    try {
      const res = await fetch("/api/admin/admins", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || body.error) {
        setToast(body.error ?? "Failed");
        return;
      }
      setToast(active ? "Admin reactivated." : "Admin deactivated.");
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed.");
    }
  };

  return (
    <Stack spacing={4}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}>
        <Box>
          <Typography variant="overline" sx={{ display: "block" }}>
            ADMIN TEAM
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            Who can access the console
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 620 }}>
            Adding someone here puts them on the allow-list. They still need an auth user pre-created in Supabase before the magic-link sign-in works.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<PersonAddOutlinedIcon />}
          onClick={() => setInviteOpen(true)}
        >
          Add admin
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Stack sx={{ py: 6, alignItems: "center" }}>
          <CircularProgress size={24} sx={{ color: "#A07823" }} />
        </Stack>
      ) : (
        <Grid container spacing={2.5}>
          {rows.map((a) => {
            const r = ROLE_TINT[a.role];
            return (
              <Grid key={a.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Box
                  sx={{
                    p: 3,
                    borderRadius: "18px",
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "common.white",
                    height: "100%",
                    transition: "transform 200ms ease, box-shadow 200ms ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "0 24px 40px -28px rgba(14,42,61,0.3)",
                    },
                    opacity: a.active ? 1 : 0.6,
                  }}
                >
                  <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2 }}>
                    <Avatar
                      sx={{
                        width: 48,
                        height: 48,
                        bgcolor: r.bg,
                        color: r.color,
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: "1rem",
                      }}
                    >
                      {a.full_name
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: "1rem", lineHeight: 1.2 }} noWrap>
                        {a.full_name}
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: "0.78rem", color: "text.secondary" }} noWrap>
                        {a.email}
                      </Typography>
                    </Box>
                    <Tooltip title={a.auth_user_id ? "Auth user linked" : "Auth user not yet created in Supabase"}>
                      <Box>
                        {a.auth_user_id ? (
                          <LinkOutlinedIcon sx={{ fontSize: 18, color: "#1F5C40" }} />
                        ) : (
                          <LinkOffOutlinedIcon sx={{ fontSize: 18, color: "#A07823" }} />
                        )}
                      </Box>
                    </Tooltip>
                  </Stack>
                  <Stack direction="row" spacing={0.75} sx={{ mb: 1.75, alignItems: "center" }}>
                    <Chip
                      label={r.label.toUpperCase()}
                      size="small"
                      sx={{
                        bgcolor: r.bg,
                        color: r.color,
                        fontWeight: 700,
                        fontSize: "0.66rem",
                        letterSpacing: "0.08em",
                      }}
                    />
                    <Chip
                      label={a.active ? "ACTIVE" : "INACTIVE"}
                      size="small"
                      sx={{
                        bgcolor: a.active ? "rgba(34,108,78,0.12)" : "rgba(14,42,61,0.06)",
                        color: a.active ? "#1F5C40" : "text.secondary",
                        fontWeight: 700,
                        fontSize: "0.6rem",
                        height: 20,
                      }}
                    />
                  </Stack>
                  <Stack direction="row" sx={{ pt: 2, borderTop: "1px solid", borderColor: "divider", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body2" sx={{ fontSize: "0.74rem", color: "text.secondary" }}>
                      {a.last_active_at
                        ? `Active ${new Date(a.last_active_at).toLocaleDateString()}`
                        : "Never signed in"}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => toggleActive(a.id, !a.active)}
                      sx={{
                        color: a.active ? "text.secondary" : "success.dark",
                        textTransform: "none",
                      }}
                      title={a.active ? "Deactivate" : "Reactivate"}
                    >
                      {a.active ? <LinkOffOutlinedIcon fontSize="small" /> : <LinkOutlinedIcon fontSize="small" />}
                    </IconButton>
                  </Stack>
                </Box>
              </Grid>
            );
          })}
          {rows.length === 0 && (
            <Grid size={12}>
              <Box sx={{ p: 6, textAlign: "center", borderRadius: "18px", border: "1px dashed", borderColor: "divider", bgcolor: "common.white" }}>
                <Typography sx={{ color: "text.secondary" }}>No admins yet. Add the first one above.</Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      )}

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1.05rem", fontWeight: 700 }}>Add an admin</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.84rem" }}>
              After adding here, also create the auth user in Supabase Dashboard → Authentication → Users → Add user with that email and &quot;Auto Confirm User&quot; ticked.
            </Typography>
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Full name"
              fullWidth
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <TextField
              label="Role"
              select
              fullWidth
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRow["role"])}
            >
              <MenuItem value="owner">Owner</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="reviewer">Reviewer</MenuItem>
              <MenuItem value="support">Support</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={inviting || !email.trim() || !fullName.trim()}
            onClick={submitInvite}
          >
            {inviting ? "Adding…" : "Add admin"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Stack>
  );
}
