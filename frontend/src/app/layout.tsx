import type { Metadata } from "next";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "@/styles/globals.scss";
import "./globals.css";

config.autoAddCss = false;

export const metadata: Metadata = {
  title: "AssetFlow EAM",
  description: "Enterprise Asset Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" data-bs-theme="light" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
