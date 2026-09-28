"use client";

import { useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";

/**
 * PdfPagesViewer — an in-house PDF reader.
 *
 * Renders every page of a PDF as a crisp canvas "sheet" stacked down the
 * page — white cards on the portal's cream background — instead of
 * embedding the browser's built-in viewer (whose dark chrome and black
 * margins can't be styled from outside and looked broken inside the
 * portal).
 *
 * pdf.js is self-hosted (bundled from node_modules; the worker ships as
 * a static asset from our own origin), so it passes the CSP with no
 * external hosts. Loaded dynamically so the ~1 MB library only downloads
 * on pages that actually show a document.
 */
export default function PdfPagesViewer({ url, title }: { url: string; title: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        setPageCount(doc.numPages);

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        // Render at the container's width; 2x pixel density for crisp text.
        const cssWidth = Math.min(container.clientWidth, 980);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let i = 1; i <= doc.numPages; i += 1) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = cssWidth / base.width;
          const viewport = page.getViewport({ scale: scale * dpr });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
          canvas.style.display = "block";
          canvas.style.borderRadius = "6px";
          canvas.style.boxShadow = "0 10px 30px -14px rgba(10,26,47,0.28)";
          canvas.style.border = "1px solid #E6DDCF";
          canvas.style.margin = "0 auto 20px";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${title} — page ${i} of ${doc.numPages}`);
          container.appendChild(canvas);

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        }
        if (!cancelled) setState("ready");
      } catch (err) {
        console.error("[pdf viewer] render failed:", err);
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, title]);

  return (
    <Box>
      {state === "loading" && (
        <Stack sx={{ alignItems: "center", py: 8 }} spacing={1.5}>
          <CircularProgress size={22} sx={{ color: "#A07823" }} />
          <Typography sx={{ fontSize: "0.8rem", color: "#7A8590" }}>Loading document…</Typography>
        </Stack>
      )}
      {state === "error" && (
        <Stack sx={{ alignItems: "center", py: 8 }} spacing={1}>
          <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: "#0A1A2F" }}>
            The document couldn&apos;t be displayed here.
          </Typography>
          <Typography sx={{ fontSize: "0.82rem", color: "#7A8590" }}>
            Use the Download button above to open it directly.
          </Typography>
        </Stack>
      )}
      <Box ref={containerRef} />
      {state === "ready" && pageCount > 0 && (
        <Typography sx={{ textAlign: "center", fontSize: "0.74rem", color: "#7A8590", pb: 2 }}>
          {pageCount} page{pageCount === 1 ? "" : "s"} · end of document
        </Typography>
      )}
    </Box>
  );
}
