import { FeatureArtwork, Publish, Platform } from "./artwork.jsx";
import React from "react";
import {
  AbsoluteFill,
  Composition,
  Img,
  OffthreadVideo,
  interpolate,
  registerRoot,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";

const ink = "#211637",
  purple = "#713cff",
  yellow = "#ffd35a";
const box = {
  position: "absolute",
  overflow: "hidden",
  borderRadius: 24,
  boxShadow: "0 24px 55px #25164425",
};
function Media({ src, x, y, w, h, start = 0, still = false, style = {} }) {
  return (
    <div style={{ ...box, left: x, top: y, width: w, height: h, ...style }}>
      {still ? (
        <Img
          src={staticFile(src.replace(".mp4", ".jpg"))}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <OffthreadVideo
          src={staticFile(src)}
          startFrom={start * 30}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
    </div>
  );
}
function Pill({ children, x, y, light = false }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        borderRadius: 30,
        padding: "12px 22px",
        fontSize: 20,
        fontWeight: 650,
        background: light ? "#ffffff" : ink,
        color: light ? ink : "white",
        boxShadow: "0 6px 20px #21163712",
      }}
    >
      {children}
    </div>
  );
}
function Waves({ x = 100, y = 655, w = 580, selected = true, frame = 0 }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: 80,
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: 12,
        borderRadius: 14,
        background: "#fff",
        border: "1px solid #ddd4ed",
      }}
    >
      {Array.from({ length: 70 }, (_, i) => (
        <i
          key={i}
          style={{
            display: "block",
            flex: 1,
            height: 12 + Math.abs(Math.sin(i * 1.78)) * 40,
            background: selected && i > 13 && i < 48 ? purple : "#d6cde2",
            borderRadius: 3,
          }}
        />
      ))}
      {selected && (
        <div
          style={{
            position: "absolute",
            left: w * 0.21,
            width: w * 0.49,
            top: 5,
            bottom: 5,
            border: `2px solid ${purple}`,
            borderRadius: 8,
            background: "#713cff0b",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          height: 70,
          width: 2,
          background: ink,
          left: 20 + ((frame % 150) / 150) * (w - 40),
        }}
      />
    </div>
  );
}
function Heading({ number, title, subtitle }) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 55,
          fontSize: 18,
          letterSpacing: 3,
          color: purple,
          fontWeight: 700,
        }}
      >
        {number} / SCRIBIX
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 96,
          fontSize: 56,
          fontWeight: 700,
          letterSpacing: -2.5,
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          left: 82,
          top: 171,
          fontSize: 22,
          color: "#776b86",
        }}
      >
        {subtitle}
      </div>
    </>
  );
}
function Results({ frame = 0, still = false }) {
  return (
    <>
      <Heading
        number="01"
        title="One conversation. More to share."
        subtitle="Find moments. Finish clips. Publish across platforms."
      />
      <Media
        src="source-sync.mp4"
        x={80}
        y={305}
        w={570}
        h={321}
        still={still}
      />
      <Pill x={103} y={328}>
        16:9 · Original
      </Pill>
      <Waves x={80} y={646} w={570} frame={frame} />
      <svg
        style={{ position: "absolute", left: 675, top: 417 }}
        width="90"
        height="90"
        viewBox="0 0 90 90"
      >
        <path
          d="M5 45H74M54 24L76 45 54 66"
          stroke={purple}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {[
        ["clip1.mp4", 23],
        ["clip4.mp4", 8],
        ["clip3.mp4", 1],
      ].map(([src, start], i) => (
        <React.Fragment key={src}>
          <Media
            src={src}
            start={start}
            x={790 + i * 241}
            y={280 + (i === 1 ? -22 : 0)}
            w={218}
            h={388}
            still={still}
            style={{
              transform: `translateY(${still ? 0 : Math.sin(frame / 35 + i) * 5}px)`,
              border: "5px solid white",
            }}
          />
          <Pill x={805 + i * 241} y={689 + (i === 1 ? -22 : 0)} light>
            0{i + 1} · 9:16
          </Pill>
        </React.Fragment>
      ))}
      <div
        style={{
          position: "absolute",
          left: 790,
          top: 780,
          display: "flex",
          alignItems: "center",
          gap: 30,
        }}
      >
        {["YouTube", "TikTok", "LinkedIn"].map((name) => (
          <div
            key={name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 20,
              color: ink,
            }}
          >
            <Platform name={name} size={32} />
            {name}
          </div>
        ))}
      </div>
    </>
  );
}
function Framing({ frame = 0, still = false }) {
  return (
    <>
      <Heading
        number="02"
        title="Made for the vertical screen."
        subtitle="Keep the speaker in focus. Keep the story intact."
      />
      <Media
        src="source-sync.mp4"
        start={7.8}
        x={80}
        y={305}
        w={780}
        h={439}
        still={still}
      />
      <div
        style={{
          ...box,
          left: 374,
          top: 310,
          width: 235,
          height: 427,
          border: `3px solid ${yellow}`,
          boxShadow: "0 0 0 2px #21163740",
        }}
      />
      <Pill x={107} y={331}>
        16:9
      </Pill>
      <Media
        src="clip1.mp4"
        start={24}
        x={1050}
        y={243}
        w={284}
        h={505}
        still={still}
        style={{ border: "6px solid white" }}
      />
      <Pill x={1094} y={768} light>
        9:16 · MP4
      </Pill>
      <svg
        style={{ position: "absolute", left: 895, top: 465 }}
        width="100"
        height="80"
      >
        <path
          d="M0 40H80M60 20L82 40 60 60"
          stroke={purple}
          strokeWidth="5"
          fill="none"
        />
      </svg>
    </>
  );
}
function Captions({ frame = 0, still = false }) {
  return (
    <>
      <Heading
        number="03"
        title="Give every word its moment."
        subtitle="Readable captions. A finished short."
      />
      <Media
        src="clip1.mp4"
        start={23}
        x={135}
        y={245}
        w={300}
        h={534}
        still={still}
        style={{ border: "6px solid white" }}
      />
      <div style={{ position: "absolute", left: 550, top: 325, width: 830 }}>
        <div style={{ fontSize: 24, color: "#776b86", marginBottom: 25 }}>
          CAPTIONS / 9:16
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 750,
            letterSpacing: -3,
            lineHeight: 1.15,
          }}
        >
          A conversation.
          <br />
          <span
            style={{ background: yellow, borderRadius: 12, padding: "0 18px" }}
          >
            Worth watching.
          </span>
        </div>
        <div style={{ display: "flex", gap: 15, marginTop: 40 }}>
          {["Aa", "Aa", "Aa"].map((t, i) => (
            <div
              key={i}
              style={{
                fontSize: 40,
                fontWeight: 750,
                padding: "18px 32px",
                borderRadius: 16,
                background: i === 0 ? purple : i === 1 ? ink : "white",
                color: i === 2 ? ink : "white",
                border:
                  i === 0 ? `3px solid ${yellow}` : "3px solid transparent",
              }}
            >
              {t}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 30, fontSize: 22, color: "#776b86" }}>
          Words · Position · Color · Emphasis
        </div>
      </div>
    </>
  );
}
function EditStill() {
  return (
    <>
      <Heading
        number="04"
        title="A tighter story starts here."
        subtitle="Refine the beginning. Land the ending."
      />
      <Media src="source-sync.mp4" x={80} y={300} w={650} h={366} still />
      <div
        style={{
          ...box,
          left: 810,
          top: 300,
          width: 640,
          height: 365,
          background: "white",
          padding: 40,
        }}
      >
        <div style={{ color: "#82758f", fontSize: 18, marginBottom: 24 }}>
          TRANSCRIPT / EDIT SELECTION
        </div>
        <div style={{ fontSize: 30, lineHeight: 1.5, color: "#b9b0c4" }}>
          …{" "}
          <span
            style={{
              color: ink,
              background: "#e5dbff",
              boxDecorationBreak: "clone",
              padding: "5px 8px",
            }}
          >
            do something that was beyond his lifetime within his lifetime
          </span>{" "}
          …
        </div>
        <div style={{ marginTop: 35, color: purple, fontSize: 24 }}>
          06:30.479 → 07:05.479
        </div>
      </div>
      <Waves x={80} y={704} w={1370} />
    </>
  );
}
function PackageStill({ cover = false }) {
  return (
    <>
      <Heading
        number={cover ? "05" : "06"}
        title={
          cover
            ? "Give your clip a first impression."
            : "Ready beyond the editor."
        }
        subtitle={
          cover
            ? "Shape the title. Create the cover."
            : "Video, cover and post copy. Together."
        }
      />
      <Media src="clip1.mp4" x={110} y={250} w={285} h={507} still />
      <div
        style={{
          ...box,
          left: 490,
          top: 285,
          width: 410,
          height: 440,
          background: ink,
          padding: 32,
          color: "white",
          transform: "rotate(-4deg)",
        }}
      >
        <div style={{ fontSize: 18, color: yellow, letterSpacing: 3 }}>
          THE AI CONVERSATION
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 750,
            lineHeight: 1.05,
            letterSpacing: -2,
            marginTop: 60,
          }}
        >
          Why GPUs
          <br />
          are a<br />
          <span style={{ color: yellow }}>“time machine”</span>
        </div>
      </div>
      <div
        style={{
          ...box,
          left: 975,
          top: 330,
          width: 435,
          height: 355,
          background: "white",
          padding: 32,
        }}
      >
        <div
          style={{
            color: purple,
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 35,
          }}
        >
          {cover ? "COVER + TITLE" : "EXPORT PACKAGE"}
        </div>
        {(cover
          ? ["Why GPUs are a", "“time machine”", "A new way to think about AI."]
          : ["MP4   Finished video", "JPG    Cover image", "TXT    Post copy"]
        ).map((s, i) => (
          <div
            key={s}
            style={{
              fontSize: i === 2 ? 24 : 28,
              padding: "19px 0",
              borderBottom: "1px solid #eee8f4",
            }}
          >
            {s}
          </div>
        ))}
      </div>
    </>
  );
}
function Scene({ variant }) {
  const frame = useCurrentFrame();
  const entrance = interpolate(frame, [0, 16], [10, 0], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ transform: `translateY(${entrance}px)` }}>
      {variant === "publish" ? (
        <>
          <div
            style={{
              position: "absolute",
              left: 80,
              top: 55,
              color: ink,
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: -2,
            }}
          >
            One clip. Multiple destinations.
          </div>
          <div
            style={{
              position: "absolute",
              left: 82,
              top: 132,
              color: "#776b86",
              fontSize: 23,
            }}
          >
            Choose your accounts. Tailor your copy. Publish from Scribix.
          </div>
          <Publish film />
        </>
      ) : variant === "selection" ? (
        <Results frame={frame} />
      ) : variant === "framing" ? (
        <Framing frame={frame} />
      ) : (
        <Captions frame={frame} />
      )}
    </AbsoluteFill>
  );
}
export function Film({ variant = "film" }) {
  const frame = useCurrentFrame();
  const scenes = ["selection", "framing", "captions", "publish"];
  if (variant !== "film") return <FeatureArtwork variant={variant} />;
  return (
    <AbsoluteFill
      style={{
        background: "#f0ebf8",
        color: ink,
        fontFamily: "Geist, sans-serif",
      }}
    >
      <style>{`@font-face{font-family:Geist;src:url('${staticFile("body.ttf")}')}`}</style>
      <div
        style={{
          position: "absolute",
          inset: 24,
          border: "1px solid #dcd3e8",
          borderRadius: 28,
        }}
      />
      {variant === "film" ? (
        scenes.map((name, i) => (
          <Sequence key={name} from={i * 180} durationInFrames={180}>
            <Scene variant={name} />
          </Sequence>
        ))
      ) : variant === "selection" ? (
        <Results still />
      ) : variant === "framing" ? (
        <Framing still />
      ) : variant === "captions" ? (
        <Captions still />
      ) : variant === "trim" ? (
        <EditStill />
      ) : (
        <PackageStill cover={variant === "cover"} />
      )}
      <div
        style={{
          position: "absolute",
          bottom: 18,
          left: 80,
          right: 80,
          display: "flex",
          gap: 8,
        }}
      >
        {scenes.map((name, i) => (
          <div
            key={name}
            style={{
              height: 3,
              flex: 1,
              background:
                variant === "film" && Math.floor(frame / 180) === i
                  ? purple
                  : "#d9cfe5",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}
registerRoot(() => (
  <Composition
    id="Homepage"
    component={Film}
    durationInFrames={720}
    fps={30}
    width={1600}
    height={900}
  />
));
