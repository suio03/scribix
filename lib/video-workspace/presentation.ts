import {
  FINAL_VIDEO_PRESET,
  type CaptionTemplateId,
  type CaptionWord,
  type CropSpec,
  type LogoPosition,
} from "./contracts";

export type PixelBox = {
  width: number;
  height: number;
  left: number;
  top: number;
};

export type CaptionVisualStyle = {
  fontSize: number;
  fontWeight: 400 | 700 | 900;
  boxed: boolean;
  outline: number;
  shadow: number;
  uppercase: boolean;
};

export const VIDEO_SAFE_AREA_PX = 54;
export const VIDEO_LOGO_TOP_PX = 115;
export const VIDEO_LOGO_BOTTOM_PX = 154;
export const VIDEO_LOGO_SIDE_PX = 65;
export const VIDEO_SIGNATURE_HEIGHT_PX = 22;

export function coverCropBox(
  sourceWidth: number,
  sourceHeight: number,
  crop: CropSpec
): PixelBox {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: FINAL_VIDEO_PRESET.width, height: FINAL_VIDEO_PRESET.height, left: 0, top: 0 };
  }
  const targetWidth = even(Math.ceil(FINAL_VIDEO_PRESET.width * crop.zoom));
  const targetHeight = even(Math.ceil(FINAL_VIDEO_PRESET.height * crop.zoom));
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = even(Math.ceil(sourceWidth * scale));
  const height = even(Math.ceil(sourceHeight * scale));
  return {
    width,
    height,
    left: -Math.round((width - FINAL_VIDEO_PRESET.width) * crop.x),
    top: -Math.round((height - FINAL_VIDEO_PRESET.height) * crop.y),
  };
}

export function browserCropStyle(box: PixelBox): {
  width: string;
  height: string;
  left: string;
  top: string;
} {
  return {
    width: `${(box.width / FINAL_VIDEO_PRESET.width) * 100}%`,
    height: `${(box.height / FINAL_VIDEO_PRESET.height) * 100}%`,
    left: `${(box.left / FINAL_VIDEO_PRESET.width) * 100}%`,
    top: `${(box.top / FINAL_VIDEO_PRESET.height) * 100}%`,
  };
}

export function captionVisualStyle(templateId: CaptionTemplateId): CaptionVisualStyle {
  if (templateId === "boxed-v1") {
    return { fontSize: 72, fontWeight: 700, boxed: true, outline: 0, shadow: 0, uppercase: false };
  }
  if (templateId === "minimal-v1") {
    return { fontSize: 68, fontWeight: 400, boxed: false, outline: 3, shadow: 1, uppercase: false };
  }
  return { fontSize: 82, fontWeight: 900, boxed: false, outline: 5, shadow: 2, uppercase: true };
}

export function wrapCaptionWordIndexes(
  words: readonly CaptionWord[],
  maxCharsPerLine: number,
  maxLines: number
): number[][] {
  const lines: number[][] = [[]];
  let lineLength = 0;
  for (const [index, word] of words.entries()) {
    const length = [...word.text].length;
    const nextLength = lineLength + (lineLength > 0 ? 1 : 0) + length;
    if (nextLength > maxCharsPerLine && lines.length < maxLines) {
      lines.push([]);
      lineLength = 0;
    }
    lines.at(-1)?.push(index);
    lineLength += (lineLength > 0 ? 1 : 0) + length;
  }
  return lines;
}

export function activeCaptionWordIndex(
  words: readonly CaptionWord[],
  sourceMs: number
): number | null {
  const index = words.findIndex(
    (word) => sourceMs >= word.sourceStartMs && sourceMs < word.sourceEndMs
  );
  return index === -1 ? null : index;
}

export function logoBox(
  position: LogoPosition,
  logoScale: number,
  sourceWidth: number,
  sourceHeight: number
): PixelBox {
  const width = logoWidthPx(logoScale);
  const height = sourceWidth > 0 && sourceHeight > 0
    ? even(Math.max(2, Math.round(width * sourceHeight / sourceWidth)))
    : width;
  const left = position.endsWith("left")
    ? VIDEO_LOGO_SIDE_PX
    : FINAL_VIDEO_PRESET.width - width - VIDEO_LOGO_SIDE_PX;
  const top = position.startsWith("top")
    ? VIDEO_LOGO_TOP_PX
    : FINAL_VIDEO_PRESET.height - height - VIDEO_LOGO_BOTTOM_PX;
  return { width, height, left, top };
}

export function logoWidthPx(logoScale: number): number {
  return even(Math.max(54, Math.round(FINAL_VIDEO_PRESET.width * logoScale)));
}

function even(value: number): number {
  return value % 2 === 0 ? value : value + 1;
}
