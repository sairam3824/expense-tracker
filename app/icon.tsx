import { ImageResponse } from "next/og";

// Generated at build time so there's no binary asset to keep in the repo.
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 116,
          fontWeight: 600,
        }}
      >
        ₹
      </div>
    ),
    size
  );
}
