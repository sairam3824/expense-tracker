import type { Metadata, Viewport } from "next";
import { Special_Elite, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Special_Elite({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const ledger = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ledger",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ledger — Expense Tracker",
  description: "Track balances across Nana, Sai, and SBI.",
  appleWebApp: { capable: true, title: "Ledger", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale/userScalable lock: capping zoom stops people enlarging
  // small figures and fails WCAG 1.4.4. The usual reason to set it — iOS
  // auto-zooming when a field is focused — is handled properly instead, by
  // keeping every input at 16px or larger.
  viewportFit: "cover",
  themeColor: "#f1ede1",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} ${ledger.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
