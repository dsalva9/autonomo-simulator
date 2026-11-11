import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type AssetCategory,
  type AssetManifest,
  AssetManifestSchema,
  SnakeCaseIdSchema,
} from "../src/engine/schemas/index.ts";

export const ASSET_CATEGORY_MAX_BYTES: Readonly<Record<AssetCategory, number>> = {
  background: 145 * 1024,
  illustration: 125 * 1024,
  character: 70 * 1024,
  ui: 20 * 1024,
};

export const TOTAL_ASSETS_MAX_BYTES = Math.floor(2.2 * 1024 * 1024);

export type WebpChunkFormat = "VP8 " | "VP8L" | "VP8X";

export type WebpDimensionResult =
  | { ok: true; width: number; height: number; format: WebpChunkFormat }
  | { ok: false; error: string };

export interface AssetValidationResult {
  ok: boolean;
  manifest: AssetManifest | null;
  totalBytes: number;
  errors: string[];
}

export function validateAssets(rootDir = process.cwd()): AssetValidationResult {
  const errors: string[] = [];
  const assetsDir = resolve(rootDir, "assets");
  const manifestPath = resolve(assetsDir, "manifest.json");

  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      manifest: null,
      totalBytes: 0,
      errors: ["Missing assets/manifest.json."],
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      manifest: null,
      totalBytes: 0,
      errors: [`Invalid JSON in assets/manifest.json: ${message}`],
    };
  }

  const parsedManifest = AssetManifestSchema.safeParse(parsedJson);
  if (!parsedManifest.success) {
    for (const issue of parsedManifest.error.issues) {
      errors.push(`assets/manifest.json [${issue.path.join(".")}]: ${issue.message}`);
    }
    return {
      ok: false,
      manifest: null,
      totalBytes: 0,
      errors,
    };
  }

  const manifest = parsedManifest.data;

  for (const [assetId, entry] of Object.entries(manifest.assets)) {
    if (!SnakeCaseIdSchema.safeParse(assetId).success) {
      errors.push(`Asset key '${assetId}' in assets/manifest.json must be lowercase snake_case.`);
    }

    const fileCheckErrors = checkAssetFile(
      assetsDir,
      entry.path,
      entry.width,
      entry.height,
      entry.category,
    );
    for (const errMsg of fileCheckErrors) {
      errors.push(`Asset '${assetId}' (${entry.path}): ${errMsg}`);
    }
  }

  for (const [category, fallbackRelPath] of Object.entries(manifest.fallbacks)) {
    const fileCheckErrors = checkAssetFile(assetsDir, fallbackRelPath, undefined, undefined, "ui");
    for (const errMsg of fileCheckErrors) {
      errors.push(`Fallback '${category}' (${fallbackRelPath}): ${errMsg}`);
    }
  }

  const totalBytes = computeAssetsPayloadBytes(assetsDir);
  if (totalBytes > 2.2 * 1024 * 1024) {
    const actualMb = (totalBytes / (1024 * 1024)).toFixed(2);
    errors.push(
      `Total assets/ payload (${totalBytes} bytes / ${actualMb} MB) exceeds 2.2 MB cap (${TOTAL_ASSETS_MAX_BYTES} bytes).`,
    );
  }

  return {
    ok: errors.length === 0,
    manifest,
    totalBytes,
    errors,
  };
}

export function parseWebpDimensions(buf: Buffer): WebpDimensionResult {
  if (buf.length < 12) {
    return { ok: false, error: "Invalid WebP binary: file shorter than 12-byte RIFF header." };
  }

  const riffMagic = buf.toString("ascii", 0, 4);
  const webpMagic = buf.toString("ascii", 8, 12);
  if (riffMagic !== "RIFF" || webpMagic !== "WEBP") {
    return {
      ok: false,
      error: "Invalid WebP binary: missing RIFF....WEBP magic bytes.",
    };
  }

  let offset = 12;
  while (offset + 8 <= buf.length) {
    const chunkTag = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const payloadOffset = offset + 8;
    const payloadEnd = payloadOffset + chunkSize;

    if (payloadEnd > buf.length) {
      return {
        ok: false,
        error: `Invalid WebP binary: chunk '${chunkTag}' size (${chunkSize}) exceeds file length.`,
      };
    }

    if (chunkTag === "VP8X") {
      if (chunkSize < 10) {
        return { ok: false, error: "Invalid WebP VP8X chunk: payload shorter than 10 bytes." };
      }
      const widthMinusOne =
        buf[payloadOffset + 4]! | (buf[payloadOffset + 5]! << 8) | (buf[payloadOffset + 6]! << 16);
      const heightMinusOne =
        buf[payloadOffset + 7]! | (buf[payloadOffset + 8]! << 8) | (buf[payloadOffset + 9]! << 16);
      return {
        ok: true,
        width: widthMinusOne + 1,
        height: heightMinusOne + 1,
        format: "VP8X",
      };
    }

    if (chunkTag === "VP8L") {
      if (chunkSize < 5) {
        return { ok: false, error: "Invalid WebP VP8L chunk: payload shorter than 5 bytes." };
      }
      if (buf[payloadOffset] !== 0x2f) {
        return {
          ok: false,
          error: "Invalid WebP VP8L chunk: missing 0x2f lossless signature byte.",
        };
      }
      const bits = buf.readUInt32LE(payloadOffset + 1);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >>> 14) & 0x3fff) + 1;
      return {
        ok: true,
        width,
        height,
        format: "VP8L",
      };
    }

    if (chunkTag === "VP8 ") {
      if (chunkSize < 10) {
        return { ok: false, error: "Invalid WebP VP8 chunk: payload shorter than 10 bytes." };
      }
      if (
        buf[payloadOffset + 3] !== 0x9d ||
        buf[payloadOffset + 4] !== 0x01 ||
        buf[payloadOffset + 5] !== 0x2a
      ) {
        return {
          ok: false,
          error: "Invalid WebP VP8 chunk: missing 0x9d 0x01 0x2a keyframe start code.",
        };
      }
      const width = buf.readUInt16LE(payloadOffset + 6) & 0x3fff;
      const height = buf.readUInt16LE(payloadOffset + 8) & 0x3fff;
      if (width === 0 || height === 0) {
        return { ok: false, error: "Invalid WebP VP8 chunk: zero pixel dimension." };
      }
      return {
        ok: true,
        width,
        height,
        format: "VP8 ",
      };
    }

    offset = payloadEnd + (chunkSize & 1);
  }

  return {
    ok: false,
    error: "Invalid WebP binary: no VP8, VP8L, or VP8X image header chunk found.",
  };
}

function checkAssetFile(
  assetsDir: string,
  relPath: string,
  expectedWidth?: number,
  expectedHeight?: number,
  category?: AssetCategory,
): string[] {
  const errs: string[] = [];
  const resolved = resolve(assetsDir, relPath);
  const relToAssets = relative(assetsDir, resolved);

  if (relToAssets.startsWith("..") || relToAssets.includes(`..${sep}`)) {
    errs.push("Path escapes assets/ directory.");
    return errs;
  }

  if (!existsSync(resolved)) {
    errs.push("Referenced file does not exist under assets/.");
    return errs;
  }

  const stat = statSync(resolved);
  if (!stat.isFile()) {
    errs.push("Referenced path is not a regular file.");
    return errs;
  }

  if (category != null) {
    const maxBytes = ASSET_CATEGORY_MAX_BYTES[category];
    if (stat.size > maxBytes) {
      const actualKb = (stat.size / 1024).toFixed(1);
      const maxKb = Math.round(maxBytes / 1024);
      errs.push(
        `File size (${stat.size} bytes / ${actualKb} KB) exceeds '${category}' cap of ${maxKb} KB (${maxBytes} bytes).`,
      );
    }
  }

  const ext = extname(resolved).toLowerCase();
  if (ext !== ".svg" && ext !== ".webp") {
    errs.push(`Unsupported asset extension '${ext || "(none)"}' (expected '.svg' or '.webp').`);
    return errs;
  }

  if (ext === ".svg") {
    const content = readFileSync(resolved, "utf8");
    const svgOpenMatch = content.match(/<svg\b([^>]*)>/i);
    if (!svgOpenMatch || !/<\/svg>\s*$/i.test(content.trim())) {
      errs.push("Invalid SVG markup (missing <svg ...>...</svg> structure).");
      return errs;
    }

    const attrs = svgOpenMatch[1];
    if (!/xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(attrs)) {
      errs.push('SVG root tag is missing xmlns="http://www.w3.org/2000/svg".');
    }

    if (expectedWidth != null && expectedHeight != null) {
      const parsedDims = parseSvgDimensions(attrs);
      if (parsedDims.width != null && parsedDims.width !== expectedWidth) {
        errs.push(
          `SVG width (${parsedDims.width}) does not match manifest width (${expectedWidth}).`,
        );
      }
      if (parsedDims.height != null && parsedDims.height !== expectedHeight) {
        errs.push(
          `SVG height (${parsedDims.height}) does not match manifest height (${expectedHeight}).`,
        );
      }
    }
  } else if (ext === ".webp") {
    const buf = readFileSync(resolved);
    const parsedDims = parseWebpDimensions(buf);
    if (!parsedDims.ok) {
      errs.push(parsedDims.error);
      return errs;
    }

    if (expectedWidth != null && parsedDims.width !== expectedWidth) {
      errs.push(
        `WebP width (${parsedDims.width}) does not match manifest width (${expectedWidth}).`,
      );
    }
    if (expectedHeight != null && parsedDims.height !== expectedHeight) {
      errs.push(
        `WebP height (${parsedDims.height}) does not match manifest height (${expectedHeight}).`,
      );
    }
  }

  return errs;
}

function computeAssetsPayloadBytes(dirPath: string): number {
  if (!existsSync(dirPath)) {
    return 0;
  }
  let total = 0;
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "manifest.json") {
      continue;
    }
    const fullPath = resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += computeAssetsPayloadBytes(fullPath);
    } else if (entry.isFile()) {
      total += statSync(fullPath).size;
    }
  }
  return total;
}

function parseSvgDimensions(svgAttrs: string): { width: number | null; height: number | null } {
  const widthAttr = svgAttrs.match(/\bwidth\s*=\s*["']([0-9]+)(?:px)?["']/i);
  const heightAttr = svgAttrs.match(/\bheight\s*=\s*["']([0-9]+)(?:px)?["']/i);

  let width = widthAttr ? Number(widthAttr[1]) : null;
  let height = heightAttr ? Number(heightAttr[1]) : null;

  if (width == null || height == null) {
    const viewBoxMatch = svgAttrs.match(
      /\bviewBox\s*=\s*["']\s*0\s+0\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s*["']/i,
    );
    if (viewBoxMatch) {
      if (width == null) {
        width = Number(viewBoxMatch[1]);
      }
      if (height == null) {
        height = Number(viewBoxMatch[2]);
      }
    }
  }

  return { width, height };
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectExecution()) {
  const result = validateAssets(process.cwd());
  if (!result.ok || !result.manifest) {
    for (const err of result.errors) {
      console.error(`[validate:assets] ${err}`);
    }
    process.exit(1);
  }
  const assetCount = Object.keys(result.manifest.assets).length;
  const totalMb = (result.totalBytes / (1024 * 1024)).toFixed(2);
  console.log(
    `[validate:assets] Validated ${assetCount} assets and category fallbacks (${totalMb} MB / 2.20 MB budget).`,
  );
}
