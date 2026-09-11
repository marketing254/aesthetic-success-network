"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Chip,
  Grid,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";

export type ResourceRow = {
  id: string;
  expert_id: string;
  expert_name: string;
  title: string;
  category: string | null;
  summary: string | null;
  content: string | null;
  resource_url: string | null;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_COLOR: Record<ResourceRow["status"], { bg: string; fg: string }> = {
  published: { bg: "rgba(46,138,87,0.12)", fg: "#1F5C39" },
  draft: { bg: "rgba(120,120,120,0.14)", fg: "#4A4A4A" },
  archived: { bg: "rgba(199,92,74,0.14)", fg: "#7A2E1F" },
};

const STATUSES: ResourceRow["status"][] = ["draft", "published", "archived"];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ResourcesTable({ initialRows }: { initialRows: ResourceRow[] }) {
  const [rows, setRows] = useState<ResourceRow[]>(initialRows);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(lc) ||
        r.expert_name.toLowerCase().includes(lc) ||
        (r.category ?? "").toLowerCase().includes(lc),
    );
  }, [rows, q]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      published: rows.filter((r) => r.status === "published").length,
      draft: rows.filter((r) => r.status === "draft").length,
    }),
    [rows],
  );

  const setStatus = async (row: ResourceRow, status: ResourceRow["status"]) => {
    const prev = row.status;
    setErr(null);
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, status } : x)));
    const res = await fetch(`/api/admin/resources/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, status: prev } : x)));
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(body.error ?? "Update failed.");
    }
  };

  return (
    <Stack spacing={3}>
      {err && (
        <Alert severity="error" onClose={() => setErr(null)}>
          {err}
        </Alert>
      )}

      <Grid container spacing={2}>
        {[
          { label: "Total kits", value: counts.total, accent: false },
          { label: "Published", value: counts.published, accent: true },
          { label: "Draft", value: counts.draft, accent: false },
        ].map((card) => (
          <Grid key={card.label} size={{ xs: 6, md: 4 }}>
            <Box
              sx={{
                p: 2.25,
                borderRadius: "16px",
                border: "1px solid",
                borderColor: card.accent ? "rgba(217,168,75,0.4)" : "divider",
                bgcolor: card.accent ? "rgba(217,168,75,0.05)" : "common.white",
              }}
            >
              <Typography variant="overline" sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                {card.label}
              </Typography>
              <Typography
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: { xs: "1.8rem", md: "2.1rem" },
                  lineHeight: 1,
                  color: "text.primary",
                  mt: 0.5,
                }}
              >
                {card.value.toLocaleString("en-US")}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <TextField
        placeholder="Search title, expert, category…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlinedIcon sx={{ color: "text.secondary", fontSize: 20 }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{ maxWidth: 420 }}
      />

      <Box
        sx={{
          borderRadius: "20px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "common.white",
          overflow: "hidden",
        }}
      >
        {filtered.length === 0 ? (
          <Box sx={{ p: 5, textAlign: "center" }}>
            <Typography variant="h5" sx={{ mb: 1, color: "text.primary" }}>
              {rows.length === 0 ? "No kits yet" : "No matches"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {rows.length === 0
                ? "No kits yet — create one above."
                : "Try clearing the search."}
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
                  py: 1.9,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  fontSize: "0.88rem",
                  verticalAlign: "top",
                },
                "& tr:last-child td": { borderBottom: "none" },
              }}
            >
              <Box component="thead">
                <Box component="tr">
                  <Box component="th">Title</Box>
                  <Box component="th">Expert</Box>
                  <Box component="th">Category</Box>
                  <Box component="th">Status</Box>
                  <Box component="th">Published</Box>
                  <Box component="th">Updated</Box>
                </Box>
              </Box>
              <Box component="tbody">
                {filtered.map((row) => {
                  const color = STATUS_COLOR[row.status];
                  return (
                    <Box component="tr" key={row.id}>
                      <Box component="td">
                        <Typography
                          component={Link}
                          href={`/admin/resources/${row.id}/edit`}
                          sx={{
                            fontWeight: 600,
                            color: "text.primary",
                            textDecoration: "none",
                            "&:hover": { textDecoration: "underline" },
                          }}
                        >
                          {row.title}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ color: "text.primary" }}>
                          {row.expert_name}
                        </Typography>
                      </Box>
                      <Box component="td">
                        {row.category ? (
                          <Chip
                            label={row.category}
                            size="small"
                            sx={{ fontSize: "0.7rem", height: 22, bgcolor: "rgba(10,19,32,0.05)" }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: "text.disabled" }}>
                            —
                          </Typography>
                        )}
                      </Box>
                      <Box component="td">
                        <Select
                          value={row.status}
                          onChange={(e) => setStatus(row, e.target.value as ResourceRow["status"])}
                          size="small"
                          sx={{
                            fontSize: "0.75rem",
                            height: 30,
                            textTransform: "capitalize",
                            bgcolor: color.bg,
                            color: color.fg,
                            "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                            "& .MuiSelect-select": { py: 0.4, px: 1.25 },
                          }}
                        >
                          {STATUSES.map((s) => (
                            <MenuItem key={s} value={s} sx={{ textTransform: "capitalize" }}>
                              {s}
                            </MenuItem>
                          ))}
                        </Select>
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                          {formatDate(row.published_at)}
                        </Typography>
                      </Box>
                      <Box component="td">
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                          {formatDate(row.updated_at)}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Stack>
  );
}
