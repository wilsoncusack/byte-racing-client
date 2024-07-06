import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "BYTERACING",
  description: "Compete for EVM efficiency",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
      <Analytics />
    </html>
  );
}
