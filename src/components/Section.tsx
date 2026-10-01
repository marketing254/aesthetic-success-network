"use client";
import { Box, Container, Typography } from "@mui/material";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  align?: "center" | "left";
  background?: "default" | "alt" | "ink";
  py?: number | { xs: number; md: number };
  containerWidth?: "md" | "lg" | "xl";
};

export default function Section({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  align = "center",
  background = "default",
  py = { xs: 7, md: 10 },
  containerWidth = "lg",
}: SectionProps) {
  const bgMap = {
    default: "transparent",
    alt: "grey.50",
    ink: "primary.main",
  } as const;

  const fg = background === "ink" ? "common.white" : "text.primary";

  return (
    <Box
      component="section"
      id={id}
      sx={{
        bgcolor: bgMap[background],
        color: fg,
        py,
        position: "relative",
        scrollMarginTop: 96,
      }}
    >
      <Container maxWidth={containerWidth}>
        {(eyebrow || title || subtitle) && (
          <Box
            sx={{
              maxWidth: 760,
              mx: align === "center" ? "auto" : 0,
              textAlign: align,
              mb: { xs: 4, md: 6 },
            }}
          >
            {eyebrow && (
              <Typography
                variant="overline"
                sx={{ color: background === "ink" ? "secondary.main" : "secondary.main", mb: 2, display: "block" }}
              >
                {eyebrow}
              </Typography>
            )}
            {title && (
              <Typography variant="h2" component="h2" sx={{ color: fg }}>
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography
                variant="subtitle1"
                sx={{ mt: 3, color: background === "ink" ? "rgba(255,255,255,0.75)" : "text.secondary" }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        )}
        {children}
      </Container>
    </Box>
  );
}
