export function validBrandAssetHeader(
  kind: "logo" | "font",
  mimeType: string,
  bytes: Uint8Array
): boolean {
  if (kind === "logo") {
    if (mimeType === "image/png") {
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    }
    if (mimeType === "image/jpeg") {
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    }
    if (mimeType === "image/webp") {
      return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
    }
    return false;
  }
  if (mimeType === "font/otf" || mimeType === "application/x-font-opentype") {
    return ascii(bytes, 0, 4) === "OTTO";
  }
  if (mimeType === "font/ttf" || mimeType === "application/x-font-ttf") {
    return startsWith(bytes, [0x00, 0x01, 0x00, 0x00]) || ascii(bytes, 0, 4) === "true";
  }
  return false;
}

function startsWith(bytes: Uint8Array, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}
