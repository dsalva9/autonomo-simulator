import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type AssetManifest,
  AssetManifestSchema,
  SnakeCaseIdSchema,
} from "../src/engine/schemas/index.ts";

export interface AssetValidationResult {
  ok: boolean;
  manifest: AssetManifest | null;
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
      errors,
    };
  }

  const manifest = parsedManifest.data;

  for (const [assetId, entry] of Object.entries(manifest.assets)) {
    if (!SnakeCaseIdSchema.safeParse(assetId).success) {
      errors.push(`Asset key '${assetId}' in assets/manifest.json must be lowercase snake_case.`);
    }

    const fileCheckErrors = checkAssetFile(assetsDir, entry.path, entry.width, entry.height);
    for (const errMsg of fileCheckErrors) {
      errors.push(`Asset '${assetId}' (${entry.path}): ${errMsg}`);
    }
  }

  for (const [category, fallbackRelPath] of Object.entries(manifest.fallbacks)) {
    const fileCheckErrors = checkAssetFile(assetsDir, fallbackRelPath);
    for (const errMsg of fileCheckErrors) {
      errors.push(`Fallback '${category}' (${fallbackRelPath}): ${errMsg}`);
    }
  }

  return {
    ok: errors.length === 0,
    manifest,
    errors,
  };
}

function checkAssetFile(
  assetsDir: string,
  relPath: string,
  expectedWidth?: number,
  expectedHeight?: number,
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

  const ext = extname(resolved).toLowerCase();
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
  }

  return errs;
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
  console.log(`[validate:assets] Validated ${assetCount} assets and category fallbacks.`);
}
