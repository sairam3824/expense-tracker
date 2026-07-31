import { ImageResponse } from "next/og";

// iOS ignores SVG for home-screen icons and doesn't apply its own background,
// so this is a filled 180×180 PNG.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f1ede1",
          color: "#1d3557",
          fontSize: 108,
          fontWeight: 600,
        }}
      >
        ₹
      </div>
    ),
    size
  );
}
