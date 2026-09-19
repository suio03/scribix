import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";

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
function Tag({ children, x, y, color = ink, bg = "white" }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        padding: "13px 22px",
        background: bg,
        color,
        borderRadius: 30,
        fontSize: 23,
        fontWeight: 600,
        boxShadow: "0 8px 24px #21163712",
      }}
    >
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

function Arrow({ x, y, w = 100 }) {
  return (
    <svg
      style={{ position: "absolute", left: x, top: y }}
      width={w}
      height="60"
      viewBox={`0 0 ${w} 60`}
    >
      <path
        d={`M0 30H${w - 8}M${w - 30} 10L${w - 8} 30 ${w - 30} 50`}
        fill="none"
        stroke={violet}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Timeline({ x, y, w, selection = true }) {
  return (
    <div
      style={{
        ...card,
        left: x,
        top: y,
        width: w,
        height: 100,
        background: "white",
        display: "flex",
        gap: 7,
        padding: "20px",
        alignItems: "center",
        borderRadius: 16,
      }}
    >
      {Array.from({ length: 65 }, (_, i) => (
        <i
          key={i}
          style={{
            flex: 1,
            height: 12 + Math.abs(Math.sin(i * 2.34)) * 48,
            background: selection && i > 18 && i < 48 ? violet : "#d7d0df",
            borderRadius: 4,
          }}
        />
      ))}
      {selection && (
        <div
          style={{
            position: "absolute",
            left: w * 0.28,
            width: w * 0.46,
            top: 10,
            bottom: 10,
            border: `3px solid ${violet}`,
            borderRadius: 8,
            background: "#713cff08",
          }}
        />
      )}
    </div>
  );
}
function Selection() {
  return (
    <>
      <Photo name="podcast" x={65} y={155} w={715} h={460} />
      <Tag x={95} y={180}>
        Podcast · 42:18
      </Tag>
      <Timeline x={65} y={665} w={715} />
      <svg
        style={{ position: "absolute", left: 790, top: 180 }}
        width="125"
        height="510"
      >
        <path
          d="M0 275H48V55H120M48 275H120M48 275V460H120"
          stroke={violet}
          strokeWidth="3"
          fill="none"
        />
      </svg>
      {[
        ["A stronger opening", "01:24 — 02:02"],
        ["The surprising insight", "12:10 — 12:48"],
        ["A story worth sharing", "28:32 — 29:14"],
      ].map(([title, time], i) => (
        <div
          key={title}
          style={{
            ...card,
            left: 905,
            top: 140 + i * 215,
            width: 600,
            height: 180,
            background: "white",
            padding: "30px 30px 30px 165px",
          }}
        >
          <Photo
            name="podcast"
            x={15}
            y={15}
            w={125}
            h={150}
            style={{ boxShadow: "none", borderRadius: 15 }}
          />
          <div
            style={{
              fontSize: 16,
              color: violet,
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            AI SUGGESTION · 0{i + 1}
          </div>
          <div style={{ fontSize: 29, fontWeight: 650, marginBottom: 14 }}>
            {title}
          </div>
          <div style={{ fontSize: 22, color: "#847a91" }}>{time}</div>
        </div>
      ))}
    </>
  );
}
function Framing() {
  return (
    <>
      <Photo name="cooking" x={70} y={210} w={910} h={585}>
        <div
          style={{ position: "absolute", inset: 0, background: "#14251e25" }}
        />
        <div
          style={{
            position: "absolute",
            left: 292,
            top: 12,
            width: 327,
            height: 560,
            border: "4px solid #dfff8c",
            borderRadius: 20,
          }}
        />
      </Photo>
      <Tag x={95} y={237}>
        16:9
      </Tag>
      <Arrow x={1005} y={475} w={95} />
      <Photo
        name="cooking"
        x={1135}
        y={115}
        w={360}
        h={640}
        style={{ border: "7px solid white" }}
      />
      <Tag x={1230} y={783}>
        9:16
      </Tag>
      <Tag x={75} y={108} bg="#dfff8c">
        Position + zoom
      </Tag>
    </>
  );
}
function Captions() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <Photo
          key={i}
          name="travel"
          x={135 + i * 457}
          y={95 + (i === 1 ? 35 : 0)}
          w={405}
          h={680}
          style={{
            transform: `rotate(${i === 0 ? -4 : i === 2 ? 4 : 0}deg)`,
            border: "6px solid white",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 22,
              right: 22,
              bottom: 100,
              textAlign: "center",
              fontSize: i === 1 ? 39 : 35,
              fontWeight: 800,
              lineHeight: 1.15,
              color: i === 1 ? ink : "white",
              textShadow: i === 1 ? "none" : "0 2px 7px black",
            }}
          >
            <span
              style={{
                background:
                  i === 1 ? "#ffe260" : i === 2 ? "#713cff" : "transparent",
                padding: "5px 10px",
                boxDecorationBreak: "clone",
              }}
            >
              {i === 0 ? "TAKE THE" : i === 1 ? "Take the" : "take the"}
              <br />
              {i === 0
                ? "SCENIC ROUTE."
                : i === 1
                  ? "scenic route."
                  : "scenic route."}
            </span>
          </div>
          <div
            style={{
              position: "absolute",
              left: 28,
              bottom: 28,
              color: "white",
              fontSize: 18,
            }}
          >
            Aa / 0{i + 1}
          </div>
        </Photo>
      ))}
    </>
  );
}
function Trim() {
  return (
    <>
      <Photo name="design" x={65} y={110} w={680} h={490} />
      <div
        style={{
          ...card,
          left: 795,
          top: 110,
          width: 740,
          height: 490,
          background: "white",
          padding: 45,
        }}
      >
        <div
          style={{
            fontSize: 19,
            color: "#8d819e",
            letterSpacing: 2,
            marginBottom: 28,
          }}
        >
          EDIT WITH YOUR TRANSCRIPT
        </div>
        <p style={{ fontSize: 38, lineHeight: 1.6, margin: 0 }}>
          <span style={{ color: "#b5aabb", textDecoration: "line-through" }}>
            So, um, I think…
          </span>
          <br />
          <span
            style={{
              background: "#e4d8ff",
              boxDecorationBreak: "clone",
              padding: "5px 8px",
            }}
          >
            Good design starts with a better question.
          </span>
        </p>
        <div style={{ marginTop: 32, color: violet, fontSize: 23 }}>
          Start here → End here
        </div>
      </div>
      <Timeline x={65} y={657} w={1470} />
      <Tag x={570} y={790} bg={violet} color="white">
        Keep the story. Refine the cut.
      </Tag>
    </>
  );
}
function Covers() {
  return (
    <>
      {[
        ["cooking", "FRESH IDEAS", "ON YOUR PLATE", "#ddff91"],
        ["travel", "TAKE THE", "SCENIC ROUTE", "#ffe266"],
        ["design", "START WITH", "A BETTER QUESTION", "#fff"],
      ].map(([name, a, b, color], i) => (
        <Photo
          key={name}
          name={name}
          x={120 + i * 463}
          y={110 + (i === 1 ? -30 : 20)}
          w={410}
          h={660}
          style={{ transform: `rotate(${i === 0 ? -5 : i === 2 ? 5 : 0}deg)` }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(transparent 25%,#080818c0 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 28,
              right: 28,
              bottom: 48,
              fontSize: 45,
              lineHeight: 1.06,
              letterSpacing: -1.5,
              fontWeight: 850,
              color,
            }}
          >
            {a}
            <br />
            {b}
          </div>
          <div
            style={{
              position: "absolute",
              top: 25,
              left: 28,
              fontSize: 17,
              color: "white",
              letterSpacing: 3,
            }}
          >
            STORIES / 0{i + 1}
          </div>
        </Photo>
      ))}
    </>
  );
}
export function Publish({ film = false }) {
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
          <OffthreadVideo
            src={staticFile("clip4.mp4")}
            startFrom={300}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
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
export function FeatureArtwork({ variant }) {
  const backgrounds = {
    selection: "#f8eddf",
    framing: "#e5f2e8",
    captions: "#e8eafa",
    trim: "#f0ecfa",
    cover: "#f5e5e9",
    package: "#19122d",
  };
  return (
    <AbsoluteFill
      style={{
        background: backgrounds[variant],
        fontFamily: "Geist, sans-serif",
        color: ink,
      }}
    >
      <style>{`@font-face{font-family:Geist;src:url('${staticFile("body.ttf")}')}`}</style>
      {variant === "selection" ? (
        <Selection />
      ) : variant === "framing" ? (
        <Framing />
      ) : variant === "captions" ? (
        <Captions />
      ) : variant === "trim" ? (
        <Trim />
      ) : variant === "cover" ? (
        <Covers />
      ) : (
        <Publish />
      )}
    </AbsoluteFill>
  );
}
