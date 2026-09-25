import React from "react";
import {
  AbsoluteFill,
  Composition,
  Img,
  interpolate,
  OffthreadVideo,
  registerRoot,
  staticFile,
  useCurrentFrame,
  Easing,
} from "remotion";

// Looping homepage demos built from licensed Pexels stock footage (see
// render-loops.mjs for sources and trims). Caption and
// title styles mirror the product's render presets (lib/video-workspace/
// presentation.ts, containers/video-preview/final-render.mjs) at half scale.
// Only effects the product supports appear here: fill/fit/auto framing,
// the three caption templates and the opening title.

export const FPS = 30;
const SOURCE_ASPECT = 16 / 9;
const ink = "#211637",
  violet = "#713cff";
const HIGHLIGHT = "#FFD600";
const CAPTION_STYLE = {
  "karaoke-v1": { fontSize: 82, fontWeight: 700, outline: 5, shadow: 2, uppercase: true, maxChars: 16 },
  "boxed-v1": { fontSize: 72, fontWeight: 700, boxed: true, outline: 0, shadow: 0, maxChars: 20 },
  "minimal-v1": { fontSize: 68, fontWeight: 700, outline: 3, shadow: 1, maxChars: 20 },
};

/**
 * Draws a normalized 1920×1080 stock clip into a W×H box. `x`/`y` are the
 * focus point as fractions of the source, `h` the visible fraction of its height.
 */
function Footage({ src, W, H, crop, style }) {
  const imgH = Math.max(H, W / SOURCE_ASPECT, H / crop.h);
  const imgW = imgH * SOURCE_ASPECT;
  const left = Math.min(0, Math.max(W - imgW, W / 2 - crop.x * imgW));
  const top = Math.min(0, Math.max(H - imgH, H / 2 - crop.y * imgH));
  return (
    <OffthreadVideo
      src={staticFile(`stock/${src}.mp4`)}
      muted
      style={{ position: "absolute", left, top, width: imgW, height: imgH, maxWidth: "none", ...style }}
    />
  );
}

function activeAt(items, t) {
  return items.filter((item) => item.from <= t).at(-1) ?? items[0];
}

/** Caption cue with evenly timed words; `k` scales 1080-wide sizes. */
function Caption({ cue, t, template, k, positionY = 0.78 }) {
  const style = CAPTION_STYLE[template];
  const words = cue.text.split(" ");
  const step = (cue.to - cue.from) / words.length;
  const active = Math.min(words.length - 1, Math.floor((t - cue.from) / step));
  const lines = [];
  let length = 0;
  for (const [index, word] of words.entries()) {
    const next = length + (length ? 1 : 0) + word.length;
    if (!lines.length || (next > style.maxChars && lines.length < 2)) {
      lines.push([]);
      length = 0;
    }
    lines.at(-1).push(index);
    length += (length ? 1 : 0) + word.length;
  }
  const pop = interpolate(t - cue.from, [0, 0.12], [0.92, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: "5%",
        width: "90%",
        top: `${positionY * 100}%`,
        transform: `translateY(-50%) scale(${pop})`,
        textAlign: "center",
        lineHeight: 1.12,
        fontFamily: "Caption, sans-serif",
        whiteSpace: "nowrap",
        color: "white",
        fontSize: style.fontSize * k,
        fontWeight: style.fontWeight,
        textTransform: style.uppercase ? "uppercase" : "none",
        WebkitTextStroke: style.outline ? `${style.outline * k}px rgba(0,0,0,0.8)` : undefined,
        paintOrder: "stroke fill",
        textShadow: style.shadow
          ? `0 ${style.shadow * k}px ${style.shadow * 2 * k}px rgba(0,0,0,0.95)`
          : undefined,
      }}
    >
      <span
        style={
          style.boxed
            ? {
                display: "inline-block",
                background: "rgba(0,0,0,0.75)",
                borderRadius: 16 * k,
                padding: `${14 * k}px ${24 * k}px`,
              }
            : undefined
        }
      >
        {lines.map((line, i) => (
          <span key={i} style={{ display: "block" }}>
            {line.map((index, j) => (
              <span key={index} style={{ color: index === active ? HIGHLIGHT : undefined }}>
                {j > 0 ? " " : ""}
                {words[index]}
              </span>
            ))}
          </span>
        ))}
      </span>
    </div>
  );
}

function OpeningTitle({ text, color = "#FFFFFF", k, t, until }) {
  const opacity = interpolate(t, [0, 0.2, until - 0.25, until], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: "8%",
        right: "8%",
        top: "22%",
        transform: "translateY(-50%)",
        textAlign: "center",
        fontSize: 84 * k,
        lineHeight: 1.1,
        fontFamily: "Caption, sans-serif",
        fontWeight: 700,
        color,
        opacity,
        WebkitTextStroke: `${2 * k}px rgba(0,0,0,0.85)`,
        paintOrder: "stroke fill",
        textShadow: `0 ${3 * k}px ${6 * k}px rgba(0,0,0,0.8)`,
      }}
    >
      {text}
    </div>
  );
}

/**
 * One vertical clip on the wall. `shots` are hard cuts between crops (auto
 * framing ranges); `fit` letterboxes over a blurred copy like fit framing.
 */
export function WallCard({ clip, shots, template, cues, title, fit = false }) {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const W = 540,
    H = 960,
    k = W / 1080;
  const shot = activeAt(shots, t);
  const cue = cues.find((c) => t >= c.from && t < c.to);
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden", fontFamily: "Geist, sans-serif" }}>
      <FontFace />
      {fit ? (
        <>
          <Footage
            src={clip}
            W={W}
            H={H}
            crop={{ x: 0.5, y: 0.5, h: 1 }}
            style={{ filter: "blur(22px) brightness(0.7)", transform: "scale(1.1)" }}
          />
          <div style={{ position: "absolute", left: 0, top: (H - W / SOURCE_ASPECT) / 2, width: W, height: W / SOURCE_ASPECT, overflow: "hidden" }}>
            <Footage src={clip} W={W} H={W / SOURCE_ASPECT} crop={{ x: 0.5, y: 0.5, h: 1 }} />
          </div>
        </>
      ) : (
        <Footage src={clip} W={W} H={H} crop={shot.crop} />
      )}
      {title ? <OpeningTitle text={title.text} color={title.color} k={k} t={t} until={title.until} /> : null}
      {cue ? <Caption cue={cue} t={t} template={template} k={k} positionY={fit ? 0.8 : 0.78} /> : null}
    </AbsoluteFill>
  );
}

// Noto Sans JP Bold is the product's title font (public/fonts); Geist here
// is the page UI stand-in used by the older artwork.
function FontFace() {
  return (
    <style>{`@font-face{font-family:Geist;font-weight:100 900;src:url('${staticFile("body.woff2")}') format('woff2')}@font-face{font-family:Caption;font-weight:700;src:url('${staticFile("caption.woff2")}') format('woff2')}`}</style>
  );
}

function Tag({ children, x, y, bg = "white", color = ink, style }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        padding: "12px 22px",
        background: bg,
        color,
        borderRadius: 30,
        fontSize: 23,
        fontWeight: 650,
        boxShadow: "0 8px 24px #21163712",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SpeakingBars({ x, y, frame, on }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "10px 14px",
        borderRadius: 22,
        background: "white",
        boxShadow: "0 8px 24px #21163725",
        opacity: on,
        transform: `scale(${0.85 + 0.15 * on})`,
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <i
          key={i}
          style={{
            display: "block",
            width: 6,
            borderRadius: 3,
            background: violet,
            height: 8 + 14 * Math.abs(Math.sin(frame / 4 + i * 1.3)),
          }}
        />
      ))}
    </div>
  );
}

const FRAMING_X = [0.24, 0.79];
const FRAMING_SHOTS = [
  { from: 0, crop: { x: FRAMING_X[0], y: 0.45, h: 1 } },
  { from: 4, crop: { x: FRAMING_X[1], y: 0.45, h: 1 } },
];
const FRAMING_CUES = [
  { from: 0.3, to: 1.9, text: "So when did you" },
  { from: 1.9, to: 3.7, text: "start writing?" },
  { from: 4.2, to: 5.9, text: "Honestly? The week" },
  { from: 5.9, to: 7.7, text: "I lost my job." },
];

/** Feature loop: auto framing follows whoever is speaking. 1600×900 canvas. */
export function FramingFeature() {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const panel = { x: 70, y: 180, w: 960, h: 540 };
  const cropW = panel.h * (9 / 16);
  const ease = Easing.inOut(Easing.cubic);
  const along = interpolate(t, [3.55, 4.1, 7.55, 8], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const centre = interpolate(along, [0, 1], FRAMING_X);
  const cropLeft = Math.min(panel.w - cropW, Math.max(0, centre * panel.w - cropW / 2));
  const shot = activeAt(FRAMING_SHOTS, t);
  const cue = FRAMING_CUES.find((c) => t >= c.from && t < c.to);
  const firstSpeaking = interpolate(t, [0.2, 0.4, 3.6, 3.8], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const secondSpeaking = interpolate(t, [4.1, 4.3, 7.6, 7.8], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phone = { x: 1150, y: 90, w: 405, h: 720 };
  return (
    <AbsoluteFill style={{ background: "#e5f2e8", fontFamily: "Geist, sans-serif", color: ink }}>
      <FontFace />
      <div
        style={{
          position: "absolute",
          left: panel.x,
          top: panel.y,
          width: panel.w,
          height: panel.h,
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 24px 65px #25203e20",
        }}
      >
        <Footage src="feat-framing" W={panel.w} H={panel.h} crop={{ x: 0.5, y: 0.5, h: 1 }} />
        <div
          style={{
            position: "absolute",
            left: cropLeft,
            top: 0,
            width: cropW,
            height: panel.h,
            borderRadius: 18,
            border: "4px solid #dfff8c",
            boxShadow: "0 0 0 2000px rgba(20,37,30,0.5)",
          }}
        />
      </div>
      <Tag x={panel.x + 22} y={panel.y + 22}>16:9</Tag>
      <SpeakingBars x={panel.x + FRAMING_X[0] * panel.w - 36} y={panel.y + panel.h + 24} frame={frame} on={firstSpeaking} />
      <SpeakingBars x={panel.x + FRAMING_X[1] * panel.w - 36} y={panel.y + panel.h + 24} frame={frame} on={secondSpeaking} />
      <svg
        width="80"
        height="40"
        viewBox="0 0 80 40"
        style={{ position: "absolute", left: 1050, top: panel.y + panel.h / 2 - 20 }}
      >
        <path d="M4 20h62M52 6l14 14-14 14" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: phone.x,
          top: phone.y,
          width: phone.w,
          height: phone.h,
          borderRadius: 30,
          overflow: "hidden",
          border: "7px solid white",
          boxShadow: "0 24px 65px #25203e30",
          background: "#000",
        }}
      >
        <Footage src="feat-framing" W={phone.w - 14} H={phone.h - 14} crop={shot.crop} />
        {cue ? <Caption cue={cue} t={t} template="karaoke-v1" k={(phone.w - 14) / 1080} /> : null}
      </div>
      <Tag x={phone.x + phone.w / 2 - 44} y={phone.y + phone.h + 22}>9:16</Tag>
    </AbsoluteFill>
  );
}

const FEATURE_SECONDS = 8;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const card = { background: "white", borderRadius: 22, boxShadow: "0 18px 50px #25203e18" };

/** 9:16 output preview with a white bezel, matching the framing loop. */
function Phone({ x, y, w = 405, h = 720, clip, crop, children }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 30,
        overflow: "hidden",
        border: "7px solid white",
        boxShadow: "0 24px 65px #25203e30",
        background: "#000",
      }}
    >
      <Footage src={clip} W={w - 14} H={h - 14} crop={crop} />
      {children}
    </div>
  );
}

function PhoneCaption({ cues, t, template, w = 405 }) {
  const cue = cues.find((c) => t >= c.from && t < c.to);
  return cue ? <Caption cue={cue} t={t} template={template} k={(w - 14) / 1080} /> : null;
}

// Deterministic waveform heights (0.2–1).
const WAVE = Array.from({ length: 96 }, (_, i) => 0.2 + 0.8 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.43)));

const MOMENTS = [
  { title: "Why I never retired", range: "04:12 – 04:51", start: 0.1, end: 0.18 },
  { title: "Hire for attitude", range: "17:38 – 18:24", start: 0.41, end: 0.5 },
  { title: "The advice I ignore", range: "31:05 – 31:40", start: 0.72, end: 0.8 },
];

/** AI moment selection: suggested ranges on the source timeline. */
export function SelectionFeature() {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const active = Math.min(2, Math.floor(t / (FEATURE_SECONDS / 3)));
  const panel = { x: 70, y: 90, w: 960, h: 540 };
  const bar = { x: 70, y: 680, w: 960, h: 110 };
  const m = MOMENTS[active];
  const local = (t % (FEATURE_SECONDS / 3)) / (FEATURE_SECONDS / 3);
  const playhead = m.start + (m.end - m.start) * local;
  return (
    <AbsoluteFill style={{ background: "#ece8ff", fontFamily: "Geist, sans-serif", color: ink }}>
      <FontFace />
      <div style={{ position: "absolute", left: panel.x, top: panel.y, width: panel.w, height: panel.h, borderRadius: 24, overflow: "hidden", boxShadow: "0 24px 65px #25203e20" }}>
        <Footage src="feat-select" W={panel.w} H={panel.h} crop={{ x: 0.5, y: 0.5, h: 1 }} />
      </div>
      <Tag x={panel.x + 22} y={panel.y + 22}>Interview · 42:18</Tag>
      <div style={{ position: "absolute", left: bar.x, top: bar.y, width: bar.w, height: bar.h, ...card }}>
        {MOMENTS.map((moment, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 12,
              bottom: 12,
              left: 20 + moment.start * (bar.w - 40),
              width: (moment.end - moment.start) * (bar.w - 40),
              borderRadius: 12,
              background: i === active ? "#713cff33" : "#713cff14",
              border: `3px solid ${i === active ? violet : "transparent"}`,
            }}
          />
        ))}
        <div style={{ position: "absolute", left: 20, right: 20, top: 0, bottom: 0, display: "flex", alignItems: "center", gap: 4 }}>
          {WAVE.map((v, i) => {
            const pos = i / (WAVE.length - 1);
            const inside = MOMENTS.some((mm) => pos >= mm.start && pos <= mm.end);
            return <i key={i} style={{ flex: 1, height: 70 * v, borderRadius: 3, background: inside ? violet : "#c9c2e4" }} />;
          })}
        </div>
        <div style={{ position: "absolute", top: 4, bottom: 4, width: 4, borderRadius: 2, background: ink, left: 20 + playhead * (bar.w - 40) - 2 }} />
      </div>
      {MOMENTS.map((moment, i) => {
        const enter = interpolate(t, [0.15 * i, 0.15 * i + 0.45], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        const on = i === active;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 1090,
              top: 110 + i * 200,
              width: 440,
              height: 170,
              ...card,
              border: `4px solid ${on ? violet : "transparent"}`,
              opacity: enter,
              transform: `translateX(${(1 - enter) * 40}px) scale(${on ? 1.03 : 1})`,
              padding: "26px 30px",
              boxSizing: "border-box",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: violet, letterSpacing: 1 }}>MOMENT {i + 1}</div>
            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 700, lineHeight: 1.15 }}>{moment.title}</div>
            <div style={{ marginTop: 12, fontSize: 21, color: "#6b6480" }}>{moment.range}</div>
            {on ? (
              <div style={{ position: "absolute", right: 24, top: 24, width: 40, height: 40, borderRadius: 20, background: violet, color: "white", display: "grid", placeItems: "center", fontSize: 24, fontWeight: 700 }}>✓</div>
            ) : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

const CAPTION_TEMPLATES = [
  { id: "karaoke-v1", name: "Karaoke" },
  { id: "boxed-v1", name: "Boxed" },
  { id: "minimal-v1", name: "Minimal" },
];
const CAPTIONS_CUES = [
  { from: 0.2, to: 1.4, text: "Retirement isn't" },
  { from: 1.4, to: 2.6, text: "the end of work." },
  { from: 2.8, to: 4.1, text: "It's the first time" },
  { from: 4.1, to: 5.3, text: "you get to choose it." },
  { from: 5.5, to: 6.7, text: "So choose" },
  { from: 6.7, to: 7.9, text: "something you love." },
];

/** Caption templates: the same clip switches between the three presets. */
export function CaptionsFeature() {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const active = Math.min(2, Math.floor(t / (FEATURE_SECONDS / 3)));
  return (
    <AbsoluteFill style={{ background: "#fff2cc", fontFamily: "Geist, sans-serif", color: ink }}>
      <FontFace />
      {CAPTION_TEMPLATES.map((template, i) => {
        const on = i === active;
        const style = CAPTION_STYLE[template.id];
        return (
          <div
            key={template.id}
            style={{
              position: "absolute",
              left: 150,
              top: 150 + i * 205,
              width: 600,
              height: 170,
              ...card,
              border: `4px solid ${on ? violet : "transparent"}`,
              transform: `scale(${on ? 1.03 : 1})`,
              display: "flex",
              alignItems: "center",
              gap: 30,
              padding: "0 30px",
              boxSizing: "border-box",
            }}
          >
            <div style={{ width: 230, height: 118, borderRadius: 16, background: "#3b3548", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <span
                style={{
                  fontFamily: "Caption, sans-serif",
                  fontWeight: 700,
                  fontSize: style.fontSize * 0.5,
                  color: "white",
                  textTransform: style.uppercase ? "uppercase" : "none",
                  WebkitTextStroke: style.outline ? `${style.outline * 0.5}px rgba(0,0,0,0.8)` : undefined,
                  paintOrder: "stroke fill",
                  ...(style.boxed ? { background: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "4px 12px" } : {}),
                }}
              >
                Aa <span style={{ color: HIGHLIGHT }}>Aa</span>
              </span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>{template.name}</div>
            {on ? (
              <div style={{ marginLeft: "auto", width: 44, height: 44, borderRadius: 22, background: violet, color: "white", display: "grid", placeItems: "center", fontSize: 26, fontWeight: 700 }}>✓</div>
            ) : null}
          </div>
        );
      })}
      <svg width="80" height="40" viewBox="0 0 80 40" style={{ position: "absolute", left: 830, top: 430 }}>
        <path d="M4 20h62M52 6l14 14-14 14" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <Phone x={1000} y={90} clip="feat-captions" crop={{ x: 0.47, y: 0.42, h: 1 }}>
        <PhoneCaption cues={CAPTIONS_CUES} t={t} template={CAPTION_TEMPLATES[active].id} />
      </Phone>
    </AbsoluteFill>
  );
}

const TRANSCRIPT = [
  { time: "00:41", text: "Okay, quick housekeeping before we start.", keep: false },
  { time: "00:47", text: "The mistake most founders make", keep: true },
  { time: "00:50", text: "is building for everyone.", keep: true },
  { time: "00:53", text: "Pick one person.", keep: true },
  { time: "00:55", text: "Solve their problem completely.", keep: true },
  { time: "00:59", text: "Anyway, the links are below.", keep: false },
];
const TRIM_CUES = [
  { from: 2.0, to: 3.5, text: TRANSCRIPT[1].text, line: 1 },
  { from: 3.5, to: 5.0, text: TRANSCRIPT[2].text, line: 2 },
  { from: 5.0, to: 6.3, text: TRANSCRIPT[3].text, line: 3 },
  { from: 6.3, to: 7.9, text: TRANSCRIPT[4].text, line: 4 },
];

/** Transcript-based trimming: handles tighten to the kept sentences. */
export function TrimFeature() {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const tighten = interpolate(t, [0.5, 1.7], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const cue = TRIM_CUES.find((c) => t >= c.from && t < c.to);
  const lineH = 78;
  const box = { x: 90, y: 100, w: 820 };
  const selTop = interpolate(tighten, [0, 1], [0, 1]) * lineH;
  const selBottom = interpolate(tighten, [0, 1], [6, 5]) * lineH;
  const bar = { x: 90, y: 680, w: 820, h: 90 };
  const handleL = interpolate(tighten, [0, 1], [0.04, 0.2]);
  const handleR = interpolate(tighten, [0, 1], [0.96, 0.8]);
  const progress = cue ? handleL + (handleR - handleL) * ((t - 2) / 5.9) : handleL;
  return (
    <AbsoluteFill style={{ background: "#e2effd", fontFamily: "Geist, sans-serif", color: ink }}>
      <FontFace />
      <div style={{ position: "absolute", left: box.x - 20, top: box.y - 20, width: box.w + 40, height: 6 * lineH + 40, ...card }} />
      <div style={{ position: "absolute", left: box.x - 6, top: box.y + selTop, width: box.w + 12, height: selBottom - selTop, borderRadius: 14, background: "#713cff1c", border: `3px solid ${violet}` }} />
      {TRANSCRIPT.map((line, i) => {
        const dim = line.keep ? 1 : interpolate(tighten, [0, 1], [1, 0.35]);
        const speaking = cue && cue.line === i;
        return (
          <div key={i} style={{ position: "absolute", left: box.x + 24, top: box.y + i * lineH, height: lineH, display: "flex", alignItems: "center", gap: 26, opacity: dim, textDecoration: !line.keep && tighten > 0.9 ? "line-through" : "none" }}>
            <span style={{ fontSize: 20, color: "#6b6480", fontVariantNumeric: "tabular-nums" }}>{line.time}</span>
            <span style={{ fontSize: 30, fontWeight: speaking ? 700 : 500, color: speaking ? violet : ink }}>{line.text}</span>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: bar.x - 20, top: bar.y, width: bar.w + 40, height: bar.h, ...card }}>
        <div style={{ position: "absolute", left: 20, right: 20, top: 30, height: 30, borderRadius: 8, background: "#dfe6f0" }} />
        <div style={{ position: "absolute", top: 22, height: 46, left: 20 + handleL * bar.w, width: (handleR - handleL) * bar.w, borderRadius: 10, background: "#713cff2a", borderLeft: `8px solid ${violet}`, borderRight: `8px solid ${violet}` }} />
        <div style={{ position: "absolute", top: 14, width: 4, height: 62, borderRadius: 2, background: ink, left: 20 + progress * bar.w }} />
      </div>
      <Phone x={1070} y={90} clip="feat-trim" crop={{ x: 0.46, y: 0.42, h: 1 }}>
        {cue ? <Caption cue={cue} t={t} template="minimal-v1" k={391 / 1080} /> : null}
      </Phone>
    </AbsoluteFill>
  );
}

const COVER_FRAMES = 6;
const COVER_TITLE = "One knife. Every dish.";

/** Cover: pick a frame from the clip, then add a cover title (rendered at 78% height). */
export function CoverFeature() {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const picked = Math.round(interpolate(t, [0.4, 1.6], [0, 3], clamp));
  const typed = Math.round(interpolate(t, [2.2, 4.2], [0, COVER_TITLE.length], clamp));
  const caret = Math.floor(t * 2) % 2 === 0 && t < 5;
  const thumb = { w: 124, h: 220, gap: 16 };
  return (
    <AbsoluteFill style={{ background: "#ffe6dc", fontFamily: "Geist, sans-serif", color: ink }}>
      <FontFace />
      <div style={{ position: "absolute", left: 70, top: 150, width: 860, height: 200, ...card, padding: "32px 36px", boxSizing: "border-box" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#6b6480" }}>Cover title</div>
        <div style={{ marginTop: 16, height: 76, borderRadius: 14, border: `3px solid ${violet}`, display: "flex", alignItems: "center", padding: "0 22px", fontSize: 34, fontWeight: 600 }}>
          {COVER_TITLE.slice(0, typed)}
          <span style={{ width: 3, height: 38, marginLeft: 3, background: caret ? ink : "transparent" }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 70, top: 420, width: 860, height: 300, ...card, display: "flex", alignItems: "center", gap: thumb.gap, padding: "0 30px", boxSizing: "border-box" }}>
        {Array.from({ length: COVER_FRAMES }, (_, i) => (
          <div key={i} style={{ position: "relative", width: thumb.w, height: thumb.h, borderRadius: 12, overflow: "hidden", outline: i === picked ? `5px solid ${violet}` : "none", outlineOffset: 3 }}>
            <Img src={staticFile(`frames/cover-${i}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        ))}
      </div>
      <svg width="80" height="40" viewBox="0 0 80 40" style={{ position: "absolute", left: 975, top: 430 }}>
        <path d="M4 20h62M52 6l14 14-14 14" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ position: "absolute", left: 1110, top: 90, width: 405, height: 720, borderRadius: 30, overflow: "hidden", border: "7px solid white", boxShadow: "0 24px 65px #25203e30", background: "#000" }}>
        <Img src={staticFile(`frames/cover-${picked}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div
          style={{
            position: "absolute",
            left: "8%",
            right: "8%",
            top: "78%",
            transform: "translateY(-50%)",
            textAlign: "center",
            fontFamily: "Caption, sans-serif",
            fontWeight: 700,
            fontSize: 50,
            lineHeight: 1.1,
            color: "white",
            WebkitTextStroke: "1px rgba(0,0,0,0.85)",
            paintOrder: "stroke fill",
            textShadow: "0 2px 6px rgba(0,0,0,0.8)",
          }}
        >
          {COVER_TITLE.slice(0, typed)}
        </div>
      </div>
    </AbsoluteFill>
  );
}

const DESTINATIONS = [
  { name: "YouTube Shorts", color: "#FF0033", account: "@kofi.talks", copy: "Why I stopped saying yes to everything #shorts" },
  { name: "TikTok", color: "#111111", account: "@kofitalks", copy: "The one word that saved my calendar" },
  { name: "LinkedIn", color: "#0A66C2", account: "Kofi Mensah", copy: "The most useful word I learned this year: no." },
];
const PUBLISH_CUES = [
  { from: 0.2, to: 1.9, text: "I used to say yes" },
  { from: 1.9, to: 3.6, text: "to every single request." },
  { from: 3.9, to: 5.7, text: "Then I learned" },
  { from: 5.7, to: 7.8, text: "the most useful word: no." },
];

/** Publishing: pick connected accounts, tailor copy, submit. Illustrative states. */
export function PublishFeature() {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const press = interpolate(t, [3.1, 3.25, 3.45], [1, 0.94, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#efe9df", fontFamily: "Geist, sans-serif", color: ink }}>
      <FontFace />
      <Phone x={110} y={90} clip="feat-publish" crop={{ x: 0.33, y: 0.4, h: 1 }}>
        <PhoneCaption cues={PUBLISH_CUES} t={t} template="boxed-v1" />
      </Phone>
      <svg width="80" height="40" viewBox="0 0 80 40" style={{ position: "absolute", left: 580, top: 430 }}>
        <path d="M4 20h62M52 6l14 14-14 14" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {DESTINATIONS.map((d, i) => {
        const checked = t >= 0.5 + i * 0.45;
        const status = t < 3.6 + i * 0.5 ? (t < 3.3 ? null : "Publishing…") : t < 4.6 + i * 0.5 ? "Publishing…" : "Submitted";
        return (
          <div key={d.name} style={{ position: "absolute", left: 710, top: 90 + i * 190, width: 800, height: 165, ...card, display: "flex", alignItems: "center", gap: 26, padding: "0 30px", boxSizing: "border-box" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, border: `3px solid ${checked ? violet : "#c9c2e4"}`, background: checked ? violet : "white", color: "white", display: "grid", placeItems: "center", fontSize: 24, fontWeight: 700, flexShrink: 0 }}>{checked ? "✓" : ""}</div>
            <div style={{ width: 16, height: 16, borderRadius: 8, background: d.color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 27, fontWeight: 700 }}>
                {d.name} <span style={{ fontWeight: 500, color: "#6b6480", fontSize: 22 }}>· {d.account}</span>
              </div>
              <div style={{ marginTop: 10, fontSize: 22, color: "#3b3548", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.copy}</div>
            </div>
            {status ? (
              <div style={{ padding: "10px 18px", borderRadius: 20, fontSize: 20, fontWeight: 700, background: status === "Submitted" ? "#d8f5e3" : "#ece8ff", color: status === "Submitted" ? "#16734a" : violet, flexShrink: 0 }}>
                {status === "Submitted" ? "✓ " : ""}
                {status}
              </div>
            ) : null}
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 1250, top: 690, width: 260, height: 78, borderRadius: 40, background: violet, color: "white", display: "grid", placeItems: "center", fontSize: 28, fontWeight: 700, transform: `scale(${press})`, boxShadow: "0 14px 30px #713cff55" }}>
        Publish
      </div>
    </AbsoluteFill>
  );
}

const FEATURES = {
  "feature-selection": SelectionFeature,
  "feature-framing": FramingFeature,
  "feature-captions": CaptionsFeature,
  "feature-trim": TrimFeature,
  "feature-cover": CoverFeature,
  "feature-package": PublishFeature,
};

const CARD_SECONDS = 8;
const at = (x, y = 0.45, h = 1) => [{ from: 0, crop: { x, y, h } }];

// Wall cards: one Pexels clip each, no person repeated. Crops use focus
// fractions of the normalized 16:9 source; captions are illustrative lines.
export const WALL_CARDS = {
  "wall-01": {
    template: "boxed-v1",
    shots: at(0.6, 0.4),
    cues: [
      { from: 0.2, to: 1.9, text: "Nobody tells you" },
      { from: 1.9, to: 3.8, text: "the first year is the hardest." },
      { from: 4.1, to: 5.9, text: "And that's exactly" },
      { from: 5.9, to: 7.8, text: "why most people quit." },
    ],
  },
  "wall-02": {
    template: "karaoke-v1",
    shots: at(0.47, 0.42),
    cues: [
      { from: 0.2, to: 1.8, text: "Three settings" },
      { from: 1.8, to: 3.6, text: "every streamer misses." },
      { from: 3.9, to: 5.7, text: "Number one:" },
      { from: 5.7, to: 7.8, text: "your mic gain." },
    ],
  },
  "wall-03": {
    seconds: 7,
    template: "minimal-v1",
    shots: at(0.42, 0.4),
    cues: [
      { from: 0.2, to: 2.2, text: "If the budget can't grow," },
      { from: 2.2, to: 4.2, text: "the scope has to shrink." },
      { from: 4.5, to: 6.8, text: "That's the whole trade-off." },
    ],
  },
  "wall-04": {
    template: "karaoke-v1",
    // Auto framing follows the teacher as he walks toward the map.
    shots: [
      { from: 0, crop: { x: 0.2, y: 0.45, h: 1 } },
      { from: 3, crop: { x: 0.31, y: 0.45, h: 1 } },
    ],
    cues: [
      { from: 0.3, to: 2.1, text: "Look at this line" },
      { from: 2.1, to: 3.9, text: "right here." },
      { from: 4.1, to: 5.9, text: "These countries" },
      { from: 5.9, to: 7.8, text: "are losing farmland." },
    ],
  },
  "wall-05": {
    template: "boxed-v1",
    shots: at(0.49, 0.5, 0.72),
    cues: [
      { from: 0.2, to: 2, text: "Most teams don't have" },
      { from: 2, to: 3.8, text: "a data problem." },
      { from: 4.1, to: 5.9, text: "They have" },
      { from: 5.9, to: 7.8, text: "a decision problem." },
    ],
  },
  "wall-06": {
    template: "karaoke-v1",
    title: { text: "The 3-ingredient rule", color: "#FFFFFF", until: 3 },
    shots: at(0.49, 0.4),
    cues: [
      { from: 0.3, to: 2.3, text: "Stop buying jarred sauce." },
      { from: 2.5, to: 3.9, text: "Tomatoes, garlic," },
      { from: 3.9, to: 5.4, text: "good olive oil." },
      { from: 5.6, to: 7.7, text: "That's the whole secret." },
    ],
  },
  "wall-07": {
    template: "minimal-v1",
    shots: at(0.47, 0.42),
    cues: [
      { from: 0.2, to: 2.1, text: "We met at a dance" },
      { from: 2.1, to: 3.9, text: "in nineteen sixty-two." },
      { from: 4.2, to: 5.9, text: "He couldn't dance" },
      { from: 5.9, to: 7.8, text: "at all." },
    ],
  },
  "wall-08": {
    template: "boxed-v1",
    fit: true,
    shots: at(0.5),
    cues: [
      { from: 0.2, to: 2, text: "Skip the tour boats." },
      { from: 2, to: 3.9, text: "Take the ferry instead." },
      { from: 4.2, to: 6, text: "Same view," },
      { from: 6, to: 7.8, text: "a tenth of the price." },
    ],
  },
  "wall-09": {
    template: "karaoke-v1",
    shots: at(0.61, 0.42),
    cues: [
      { from: 0.2, to: 1.9, text: "This tablet app" },
      { from: 1.9, to: 3.8, text: "replaced my laptop." },
      { from: 4.1, to: 5.9, text: "Here's the one" },
      { from: 5.9, to: 7.8, text: "feature that did it." },
    ],
  },
  "wall-10": {
    template: "minimal-v1",
    shots: at(0.43, 0.42),
    cues: [
      { from: 0.2, to: 2, text: "Blend it upward," },
      { from: 2, to: 3.8, text: "never side to side." },
      { from: 4.1, to: 5.9, text: "That's how it lasts" },
      { from: 5.9, to: 7.8, text: "all day." },
    ],
  },
};

registerRoot(() => (
  <>
    {Object.entries(WALL_CARDS).map(([id, { seconds = CARD_SECONDS, ...props }]) => (
      <Composition
        key={id}
        id={id}
        component={WallCard}
        defaultProps={{ clip: id, ...props }}
        durationInFrames={seconds * FPS}
        fps={FPS}
        width={540}
        height={960}
      />
    ))}
    {Object.entries(FEATURES).map(([id, component]) => (
      <Composition
        key={id}
        id={id}
        component={component}
        durationInFrames={FEATURE_SECONDS * FPS}
        fps={FPS}
        width={1600}
        height={900}
      />
    ))}
  </>
));
