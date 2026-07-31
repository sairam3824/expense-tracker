import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. This is what makes "Add to Home Screen"
// produce a real app icon that opens without browser chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ledger — Expense Tracker",
    short_name: "Ledger",
    description: "Balances and spending across Nana, Sai and SBI.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f1ede1",
    theme_color: "#f1ede1",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
