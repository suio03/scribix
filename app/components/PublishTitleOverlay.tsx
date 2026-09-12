import { titleLayout } from "@/containers/video-preview/title-layout.mjs";
import type { RenderSpec } from "@/lib/video-workspace/contracts";

export function PublishTitleOverlay({ spec, timeMs = 0, cover = false }: { spec: RenderSpec; timeMs?: number; cover?: boolean }) {
  const overlay = cover ? spec.coverTitle : spec.openingTitle;
  if (!overlay?.enabled || (!cover && timeMs >= overlay.durationMs)) return null;
  const layout = titleLayout(overlay, spec.captions.positionY, cover);
  return <>
    <style>{'@font-face{font-family:"Scribix Title";src:url("/fonts/NotoSansJP-Bold.woff2") format("woff2");font-weight:700;font-display:swap;}'}</style>
    <div className="pointer-events-none absolute inset-x-[8%] text-center" style={{
      top: `${layout.positionY * 100}%`, transform: "translateY(-50%)", color: overlay.color,
      fontFamily: '"Scribix Title", sans-serif', fontSize: `${layout.fontSize / 10.8}cqw`,
      lineHeight: `${layout.lineHeight / 10.8}cqw`, fontWeight: 700,
      textShadow: "0 2px 4px #000", whiteSpace: "pre",
    }}>{layout.lines.join("\n")}</div>
  </>;
}
