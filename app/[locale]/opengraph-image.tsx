import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Scribix AI Video Clipper — Turn long videos into publish-ready shorts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #eee8ff 0%, #f7f5ff 56%, #fff4cd 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
          position: "relative",
        }}
      >
        <svg
          width="180"
          height="180"
          viewBox="0 0 96 96"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M62,30 C62,24 34,24 34,41.28 C34,50.4 62,45.6 62,54.72 C62,72 34,72 34,66"
            fill="none"
            stroke="#17122c"
            strokeWidth={15}
            strokeLinecap="round"
          />
        </svg>

        <div
          style={{
            fontSize: 120,
            color: "#17122c",
            marginTop: 36,
            letterSpacing: "-0.02em",
            fontFamily: "sans-serif",
            fontWeight: 600,
          }}
        >
          Scribix
        </div>

        <div
          style={{
            fontSize: 26,
            color: "#665f7c",
            marginTop: 28,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          AI video clipper
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 48,
            fontSize: 18,
            color: "#665f7c",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          Long Video &middot; Editable Clips &middot; Vertical MP4
        </div>
      </div>
    ),
    { ...size }
  );
}
