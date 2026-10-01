"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, MenuItem, Stack, TextField } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { JOB_EMPLOYMENT_TYPES, JOB_ROLES } from "@/lib/jobs/constants";

const INK = "#0A1A2F";
const INK_MUTED = "#7A8590";

/**
 * Filters for the public board.
 *
 * They write to the URL rather than holding state locally, which keeps
 * "/jobs?role=injector_rn_np" shareable, linkable and crawlable — the
 * listing stays server-rendered and Google can index the filtered view.
 * Local state here is only the in-progress form.
 */
export default function JobFilters({
  role,
  location,
  type,
}: {
  role: string;
  location: string;
  type: string;
}) {
  const router = useRouter();
  const [r, setR] = useState(role);
  const [l, setL] = useState(location);
  const [t, setT] = useState(type);

  const apply = (next: { r?: string; l?: string; t?: string }) => {
    const params = new URLSearchParams();
    const nr = next.r ?? r;
    const nl = next.l ?? l;
    const nt = next.t ?? t;
    if (nr) params.set("role", nr);
    if (nl.trim()) params.set("location", nl.trim());
    if (nt) params.set("type", nt);
    const qs = params.toString();
    router.push(qs ? `/jobs?${qs}` : "/jobs");
  };

  const dirty = Boolean(r || l.trim() || t);

  const field = {
    flex: 1,
    minWidth: 0,
    bgcolor: "#fff",
    "& .MuiOutlinedInput-root": { borderRadius: 2 },
  } as const;

  return (
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        apply({});
      }}
    >
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: "stretch" }}>
        <TextField
          select
          size="small"
          label="Role"
          value={r}
          onChange={(e) => {
            setR(e.target.value);
            apply({ r: e.target.value });
          }}
          sx={field}
        >
          <MenuItem value="">All roles</MenuItem>
          {JOB_ROLES.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          label="Location"
          placeholder="City or state"
          value={l}
          onChange={(e) => setL(e.target.value)}
          onBlur={() => {
            if (l.trim() !== location.trim()) apply({});
          }}
          sx={field}
        />

        <TextField
          select
          size="small"
          label="Employment type"
          value={t}
          onChange={(e) => {
            setT(e.target.value);
            apply({ t: e.target.value });
          }}
          sx={field}
        >
          <MenuItem value="">Any type</MenuItem>
          {JOB_EMPLOYMENT_TYPES.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>

        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <Button
            type="submit"
            variant="contained"
            startIcon={<SearchRoundedIcon />}
            sx={{
              bgcolor: INK,
              "&:hover": { bgcolor: "#06182A" },
              borderRadius: 2,
              px: 3,
              whiteSpace: "nowrap",
              flex: { xs: 1, md: "none" },
            }}
          >
            Search
          </Button>
          {dirty ? (
            <Button
              onClick={() => {
                setR("");
                setL("");
                setT("");
                router.push("/jobs");
              }}
              sx={{ color: INK_MUTED, whiteSpace: "nowrap", borderRadius: 2 }}
            >
              Clear
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}
