import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { pressStart2P } from "./lib/fonts";
import Head from "next/head";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en" className={pressStart2P.className}>
      <Head>
          <script defer src="https://api.pirsch.io/pa.js"
        id="pianjs"
        data-code="auPvWdXpZYJMo8FlQXSmtNx5SiQQ9F3G"></script>
      </Head>
      <body className={inter.className}>{children}</body>
      <Analytics />
    </html>
  );
}
