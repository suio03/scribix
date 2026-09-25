import React from "react";
import { Img, staticFile, useCurrentFrame, interpolate } from "remotion";

const ink = "#211637",
  violet = "#713cff";
const card = {
  position: "absolute",
  borderRadius: 24,
  overflow: "hidden",
  boxShadow: "0 24px 65px #25203e20",
};
export function Photo({ name, x, y, w, h, style = {}, children }) {
  return (
    <div style={{ ...card, left: x, top: y, width: w, height: h, ...style }}>
      <Img
        src={staticFile(`${name}.webp`)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      {children}
    </div>
  );
}
export function Platform({ name, size = 48 }) {
  return name === "TikTok" ? (
    <div
      style={{
        width: size,
        height: size,
        background: "#101017",
        borderRadius: 12,
        padding: 8,
      }}
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%">
        <path
          d="M16.7 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.55 2.55 0 0 1-2.59 2.5 2.52 2.52 0 0 1-2.59-2.5 2.52 2.52 0 0 1 2.59-2.5c.27 0 .53.04.78.12v-3.1a5.72 5.72 0 0 0-.78-.05A5.62 5.62 0 0 0 4.24 15.5 5.62 5.62 0 0 0 9.86 21a5.62 5.62 0 0 0 5.62-5.5V9.01a7.34 7.34 0 0 0 4.28 1.38V7.3a4.27 4.27 0 0 1-3.06-1.48Z"
          fill="#25F4EE"
          transform="translate(-1.1 -.7)"
        />
        <path
          d="M16.7 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.55 2.55 0 0 1-2.59 2.5 2.52 2.52 0 0 1-2.59-2.5 2.52 2.52 0 0 1 2.59-2.5c.27 0 .53.04.78.12v-3.1a5.72 5.72 0 0 0-.78-.05A5.62 5.62 0 0 0 4.24 15.5 5.62 5.62 0 0 0 9.86 21a5.62 5.62 0 0 0 5.62-5.5V9.01a7.34 7.34 0 0 0 4.28 1.38V7.3a4.27 4.27 0 0 1-3.06-1.48Z"
          fill="#FE2C55"
          transform="translate(1.1 .7)"
        />
        <path
          d="M16.7 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.55 2.55 0 0 1-2.59 2.5 2.52 2.52 0 0 1-2.59-2.5 2.52 2.52 0 0 1 2.59-2.5c.27 0 .53.04.78.12v-3.1a5.72 5.72 0 0 0-.78-.05A5.62 5.62 0 0 0 4.24 15.5 5.62 5.62 0 0 0 9.86 21a5.62 5.62 0 0 0 5.62-5.5V9.01a7.34 7.34 0 0 0 4.28 1.38V7.3a4.27 4.27 0 0 1-3.06-1.48Z"
          fill="white"
        />
      </svg>
    </div>
  ) : (
    <Img
      src={staticFile(name === "YouTube" ? "youtube.png" : "linkedin.png")}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}

export function Publish({ film = false, clip = null }) {
  const frame = useCurrentFrame();
  const sent = film && frame > 105;
  const progress = interpolate(frame, [60, 105], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: film ? 235 : 85,
          top: film ? 225 : 80,
          fontSize: 22,
          color: film ? "#776b86" : "#c9c2df",
          letterSpacing: 2,
        }}
      >
        YOUR FINISHED CLIP
      </div>
      {film ? (
        <div
          style={{
            ...card,
            left: 250,
            top: 275,
            width: 250,
            height: 445,
            border: "5px solid white",
          }}
        >
          {clip}
        </div>
      ) : (
        <Photo
          name="podcast"
          x={95}
          y={140}
          w={315}
          h={560}
          style={{ border: "6px solid white" }}
        >
          <div
            style={{
              position: "absolute",
              bottom: 85,
              left: 18,
              right: 18,
              color: "white",
              textAlign: "center",
              fontSize: 32,
              fontWeight: 800,
              textShadow: "0 2px 8px black",
            }}
          >
            ONE GREAT
            <br />
            CONVERSATION.
          </div>
        </Photo>
      )}
      <svg
        style={{
          position: "absolute",
          left: film ? 500 : 420,
          top: film ? 310 : 195,
        }}
        width="170"
        height={film ? 350 : 440}
      >
        <path
          d={
            film
              ? "M0 175H70V30H170M70 175H170M70 175V320H170"
              : "M0 220H70V30H170M70 220H170M70 220V405H170"
          }
          stroke={film ? violet : "#9c7aff"}
          strokeWidth="3"
          fill="none"
        />
      </svg>
      {["YouTube", "TikTok", "LinkedIn"].map((name, i) => (
        <div
          key={name}
          style={{
            ...card,
            left: film ? 680 : 570,
            top: (film ? 285 : 145) + i * (film ? 145 : 182),
            width: film ? 680 : 935,
            height: film ? 112 : 158,
            background: "#fff",
            padding: film ? "18px 22px" : "24px 28px",
            display: "flex",
            alignItems: "center",
            gap: film ? 18 : 25,
            opacity: film
              ? interpolate(frame, [i * 10, i * 10 + 15], [0.45, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 1,
          }}
        >
          <Platform name={name} size={film ? 40 : 56} />
          <div style={{ flex: 1 }}>
            <div
              style={{ fontSize: film ? 26 : 30, fontWeight: 700, color: ink }}
            >
              {name}{" "}
              <span
                style={{
                  fontSize: film ? 16 : 19,
                  fontWeight: 450,
                  color: "#968b9e",
                }}
              >
                {" "}
                / Studio account
              </span>
            </div>
            <div
              style={{
                marginTop: 9,
                fontSize: film ? 18 : 23,
                color: "#7d728b",
              }}
            >
              {
                [
                  "A conversation worth sharing.",
                  "Your next favorite moment.",
                  "An idea to bring to your team.",
                ][i]
              }
            </div>
          </div>
          <div
            style={{
              color: sent ? "#188362" : violet,
              fontSize: film ? 17 : 21,
              fontWeight: 600,
            }}
          >
            {sent ? "✓ Submitted" : "✓ Selected"}
          </div>
          {film && frame > 60 && frame < 106 && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                width: `${progress}%`,
                height: 4,
                background: violet,
              }}
            />
          )}
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          left: film ? 680 : 570,
          top: film ? 725 : 745,
          width: film ? 680 : 935,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            color: film ? "#776b86" : "#c9c2df",
            fontSize: film ? 14 : 20,
          }}
        >
          Platform-specific copy · Individual status
        </span>
        <div
          style={{
            background: sent ? "#bff5dc" : "#d6c4ff",
            color: ink,
            fontWeight: 700,
            fontSize: film ? 20 : 25,
            padding: film ? "14px 22px" : "18px 32px",
            borderRadius: 35,
            transform: film && frame > 55 && frame < 65 ? "scale(.96)" : "none",
          }}
        >
          {sent ? "View post status →" : "Publish to 3 accounts ↗"}
        </div>
      </div>
      {film && (
        <div
          style={{
            position: "absolute",
            right: 240,
            top: 225,
            fontSize: 15,
            color: "#776b86",
          }}
        >
          ILLUSTRATIVE PUBLISHING FLOW
        </div>
      )}
    </>
  );
}
