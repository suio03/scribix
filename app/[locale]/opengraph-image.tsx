import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Scribix — Studio-grade Transcription";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#f4f0e6",
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
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 22 28 Q 22 20, 30 20 L 70 20 Q 78 20, 78 28 L 78 54 Q 78 62, 70 62 L 42 62 L 34 72 L 34 62 Q 22 62, 22 54 Z"
            fill="none"
            stroke="#5c7050"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="34" cy="41" r="2" fill="#5c7050" />
          <circle cx="42" cy="41" r="3.5" fill="#5c7050" />
          <circle cx="50" cy="41" r="5" fill="#5c7050" />
          <circle cx="58" cy="41" r="3.5" fill="#5c7050" />
          <circle cx="66" cy="41" r="2" fill="#5c7050" />
        </svg>

        <div
          style={{
            fontSize: 120,
            color: "#0e0d0b",
            marginTop: 36,
            letterSpacing: "-0.02em",
            fontFamily: "serif",
            fontWeight: 400,
          }}
        >
          Scribix
        </div>

        <div
          style={{
            fontSize: 26,
            color: "#6e6b62",
            marginTop: 28,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          Studio-grade Transcription
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 48,
            fontSize: 18,
            color: "#6e6b62",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          Audio &middot; Video &middot; AI Transcription
        </div>
      </div>
    ),
    { ...size }
  );
}
