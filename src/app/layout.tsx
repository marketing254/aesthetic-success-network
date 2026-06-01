import type { Metadata } from "next";
import "./tokens.css";
import "./globals.css";
import { brand } from "@/content";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: `${brand.name} — A human expert on the line for every practice problem`,
  description:
    "The only network for US aesthetic practice owners with a human expert on the line — 24/7 expert helpline, vendor savings, exclusive content, and 500+ practice owners.",
  metadataBase: new URL(`https://${brand.domain}`),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="orchid-atelier">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..700&family=Hanken+Grotesk:wght@300..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
