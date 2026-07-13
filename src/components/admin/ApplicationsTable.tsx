"use client";
import { Fragment, useMemo, useState, useTransition } from "react";
import {
  Box,
  Button,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import ExpandLessOutlinedIcon from "@mui/icons-material/ExpandLessOutlined";

export type AppStatus = "new" | "in_review" | "approved" | "declined";

export type AppRow = {
  id: string;
  status: AppStatus;
  created_at: string;
} & Record<string, string | boolean | null>;

export type ColumnSpec = {
  key: string;
  label: string;
  secondaryKey?: string;
  maxWidth?: number;
};

export type DetailSpec = { key: string; label: string };

const STATUS_COLOR: Record<AppStatus, { bg: string; fg: string }> = {
  new: { bg: "rgba(217,168,75,0.14)", fg: "#7A5B17" },
  in_review: { bg: "rgba(84,113,138,0.14)", fg: "#33475C" },
  approved: { bg: "rgba(46,138,87,0.12)", fg: "#1F5C39" },
  declined: { bg: "rgba(120,120,120,0.14)", fg: "#4A4A4A" },
};

const STATUS_LABEL: Record<AppStatus, string> = {
  new: "New",
  in_review: "In review",
  approved: "Approved",
  declined: "Declined",
};

function csvEscape(s: unknown): string {
  if (s === null || s === undefined) return "";
  const v = String(s);
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Generic application-review table for the launch phase — used by the
 * Experts and Partners admin pages. Search, status pipeline
 * (new → in_review → approved/declined), expandable details, CSV export.
 */
export default function ApplicationsTable({
  overline,
  title,
  initialRows,
  apiPath,
  emailKey,
  columns,
  details,
  searchKeys,
  csvKeys,
  emptyHint,
}: {
  overline: string;
  title: string;
  initialRows: AppRow[];
  apiPath: string;
  emailKey: string;
  columns: ColumnSpec[];
  details: DetailSpec[];
  searchKeys: string[];
  csvKeys: string[];
  emptyHint: string;
}) {
  const [rows, setRows] = useState<AppRow[]>(initialRows);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const lc = q.trim().toLowerCase();
    if (!lc) return rows;
    return rows.filter((r) =>
      searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(lc)),
    );
  }, [rows, q, searchKeys]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      toReview: rows.filter((r) => r.status === "new" || r.status === "in_review").length,
      approved: rows.filter((r) => r.status === "approved").length,
    }),
    [rows],
  );

  const updateStatus = (id: string, status: AppStatus) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, status } : row)));
    fetch(apiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    }).catch(() => {
      setRows((r) =>
        r.map((row) =>
          row.id === id
            ? { ...row, status: initialRows.find((x) => x.id === id)?.status ?? "new" }
            : row,
        ),
      );
    });
  };

  const refresh = () => {
    startTransition(() => {
      fetch(apiPath, { method: "GET", cache: "no-store" })
        .then((r) => r.json())
        .then((d: { rows?: AppRow[] }) => {
          if (d.rows) setRows(d.rows);
        });
    });
  };

  const exportCSV = () => {
    const headers = ["id", ...csvKeys, "status", "created_at"];
    const lines = [
      headers.join(","),
      ...filtered.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asn-${overline.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={3.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: "text.secondary", display: "block" }}>
            {overline.toUpperCase()}
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.5, mb: 1, fontSize: { xs: "1.85rem", md: "2.5rem" } }}>
            {title}
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 620 }}>
            {counts.total.toLocaleString("en-US")} applications
            {counts.toReview > 0 ? ` · ${counts.toReview} to review` : ""}
            {counts.approved > 0 ? ` · ${counts.approved} approved` : ""}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={refresh} disabled={isPending}>
              <RefreshOutlinedIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<DownloadOutlinedIcon />}
            onClick={exportCSV}
            disabled={filtered.length === 0}
          >
            Export CSV
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        {[
          { label: "Total applications", value: counts.total, accent: false },
          { label: "To review", value: counts.toReview, accent: true },
          { label: "Approved", value: counts.approved, accent: false },
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
        placeholder="Search…"
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
              {rows.length === 0 ? "No applications yet" : "No matches"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {rows.length === 0 ? emptyHint : "Try clearing the search."}
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
                  py: 2,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  fontSize: "0.88rem",
                  verticalAlign: "top",
                },
              }}
            >
              <Box component="thead">
                <Box component="tr">
                  {columns.map((c) => (
                    <Box component="th" key={c.key}>
                      {c.label}
                    </Box>
                  ))}
                  <Box component="th">Status</Box>
                  <Box component="th">Applied</Box>
                  <Box component="th"></Box>
                </Box>
              </Box>
              <Box component="tbody">
                {filtered.map((row) => {
                  const color = STATUS_COLOR[row.status];
                  const open = openId === row.id;
                  const email = String(row[emailKey] ?? "");
                  return (
                    <Fragment key={row.id}>
                      <Box component="tr">
                        {columns.map((c, i) => (
                          <Box
                            component="td"
                            key={c.key}
                            sx={c.maxWidth ? { maxWidth: c.maxWidth } : undefined}
                          >
                            <Typography
                              sx={{
                                fontWeight: i === 0 ? 600 : 400,
                                fontSize: i === 0 ? "0.88rem" : "0.84rem",
                                color: row[c.key] ? "text.primary" : "text.disabled",
                              }}
                            >
                              {String(row[c.key] ?? "")}
                            </Typography>
                            {c.secondaryKey && (
                              <Typography
                                variant="body2"
                                sx={{ color: "text.secondary", fontSize: "0.78rem", mt: 0.25 }}
                              >
                                {String(row[c.secondaryKey] ?? "")}
                              </Typography>
                            )}
                          </Box>
                        ))}
                        <Box component="td">
                          <Select
                            value={row.status}
                            onChange={(e) => updateStatus(row.id, e.target.value as AppStatus)}
                            variant="standard"
                            disableUnderline
                            sx={{
                              "& .MuiSelect-select": {
                                minHeight: 0,
                                py: 0.5,
                                px: 1.25,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                borderRadius: 999,
                                bgcolor: color.bg,
                                color: color.fg,
                              },
                              "& .MuiSelect-icon": { color: color.fg, right: 4 },
                            }}
                          >
                            {(Object.keys(STATUS_LABEL) as AppStatus[]).map((s) => (
                              <MenuItem key={s} value={s}>
                                {STATUS_LABEL[s]}
                              </MenuItem>
                            ))}
                          </Select>
                        </Box>
                        <Box component="td">
                          <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                            {formatDate(row.created_at)}
                          </Typography>
                        </Box>
                        <Box component="td" sx={{ whiteSpace: "nowrap" }}>
                          {email && (
                            <Tooltip title={`Email ${email}`}>
                              <IconButton component="a" href={`mailto:${email}`} size="small">
                                <EmailOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title={open ? "Hide details" : "View details"}>
                            <IconButton size="small" onClick={() => setOpenId(open ? null : row.id)}>
                              {open ? (
                                <ExpandLessOutlinedIcon fontSize="small" />
                              ) : (
                                <ExpandMoreOutlinedIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                      {open && (
                        <Box component="tr">
                          <Box
                            component="td"
                            colSpan={columns.length + 3}
                            sx={{ bgcolor: "rgba(247,245,240,0.5)" }}
                          >
                            <Grid container spacing={2}>
                              {details.map((d) => {
                                const val = row[d.key];
                                const display =
                                  typeof val === "boolean" ? (val ? "Yes" : "No") : val ? String(val) : "—";
                                const isUrl = typeof val === "string" && /^https?:\/\//i.test(val);
                                return (
                                  <Grid key={d.key} size={{ xs: 12, sm: 6, md: 4 }}>
                                    <Typography
                                      variant="overline"
                                      sx={{ fontSize: "0.6rem", color: "text.secondary", display: "block" }}
                                    >
                                      {d.label}
                                    </Typography>
                                    {isUrl ? (
                                      <Typography
                                        component="a"
                                        href={String(val)}
                                        target="_blank"
                                        rel="noreferrer"
                                        variant="body2"
                                        sx={{
                                          fontSize: "0.84rem",
                                          color: "#A87D2C",
                                          wordBreak: "break-all",
                                        }}
                                      >
                                        {display}
                                      </Typography>
                                    ) : (
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontSize: "0.84rem",
                                          color: val ? "text.primary" : "text.disabled",
                                          whiteSpace: "pre-wrap",
                                        }}
                                      >
                                        {display}
                                      </Typography>
                                    )}
                                  </Grid>
                                );
                              })}
                            </Grid>
                          </Box>
                        </Box>
                      )}
                    </Fragment>
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
