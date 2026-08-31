import assert from "node:assert/strict";
import test from "node:test";
import { validBrandAssetHeader } from "./asset-content";

test("brand assets require magic bytes matching their declared type", () => {
  assert.equal(validBrandAssetHeader("logo", "image/png", Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ])), true);
  assert.equal(validBrandAssetHeader("logo", "image/webp", new TextEncoder().encode("RIFF0000WEBP")), true);
  assert.equal(validBrandAssetHeader("font", "font/otf", new TextEncoder().encode("OTTO")), true);
  assert.equal(validBrandAssetHeader("font", "font/ttf", Uint8Array.from([0, 1, 0, 0])), true);
  assert.equal(validBrandAssetHeader("logo", "image/png", new TextEncoder().encode("<script>")), false);
  assert.equal(validBrandAssetHeader("font", "font/ttf", new TextEncoder().encode("RIFF")), false);
});
