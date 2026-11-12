import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  packageItchRelease,
  shouldIncludeInItchArchive,
  stagePortableItchBundle,
  verifyPortableDistBundle,
} from "../../scripts/package-itch.ts";

const tempDirs: string[] = [];

function createTempRoot(): string {
  const dir = mkdtempSync(resolve(tmpdir(), "autonomo-itch-test-"));
  tempDirs.push(dir);
  return dir;
}

function writeMinimalPortableDist(rootDir: string, indexHtmlOverride?: string): string {
  const distDir = resolve(rootDir, "dist");
  mkdirSync(resolve(distDir, "_bundle"), { recursive: true });
  mkdirSync(resolve(distDir, "assets"), { recursive: true });

  const defaultIndexHtml = [
    "<!doctype html>",
    '<html lang="es">',
    "<head>",
    '  <link rel="stylesheet" href="./_bundle/index-abc123.css" />',
    '  <meta property="og:image" content="https://autonomo-simulator.vercel.app/og-preview.png" />',
    "</head>",
    "<body>",
    '  <div id="root"></div>',
    '  <script type="module" src="./_bundle/index-abc123.js"></script>',
    "</body>",
    "</html>",
  ].join("\n");

  writeFileSync(resolve(distDir, "index.html"), indexHtmlOverride ?? defaultIndexHtml, "utf8");
  writeFileSync(resolve(distDir, "manifest.webmanifest"), '{"name":"Autonomo"}', "utf8");
  writeFileSync(resolve(distDir, "sw.js"), "self.addEventListener('install', () => {});", "utf8");
  writeFileSync(resolve(distDir, "assets", "manifest.json"), '{"version":1,"assets":{}}', "utf8");
  writeFileSync(resolve(distDir, "_bundle", "index-abc123.js"), "console.log('ok');", "utf8");
  writeFileSync(resolve(distDir, "_bundle", "index-abc123.css"), "body { margin: 0; }", "utf8");
  writeFileSync(resolve(distDir, "_bundle", "index-abc123.js.map"), "{}", "utf8");
  writeFileSync(resolve(distDir, "og-preview.png"), "fake-png-bytes", "utf8");

  return distDir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("itch.io portable packager (scripts/package-itch.ts)", () => {
  it("filters out social preview cards, source maps, and OS metadata files", () => {
    expect(shouldIncludeInItchArchive("index.html")).toBe(true);
    expect(shouldIncludeInItchArchive("_bundle/index-abc123.js")).toBe(true);
    expect(shouldIncludeInItchArchive("assets/manifest.json")).toBe(true);
    expect(shouldIncludeInItchArchive("og-preview.png")).toBe(false);
    expect(shouldIncludeInItchArchive("_bundle/index-abc123.js.map")).toBe(false);
    expect(shouldIncludeInItchArchive(".DS_Store")).toBe(false);
    expect(shouldIncludeInItchArchive("assets/Thumbs.db")).toBe(false);
  });

  it("validates portable relative './_bundle/' paths and rejects root-anchored '/_bundle/' or '/assets/' URLs", () => {
    const validRoot = createTempRoot();
    const validDist = writeMinimalPortableDist(validRoot);
    expect(() => verifyPortableDistBundle(validDist)).not.toThrow();

    const rootAnchoredBundle = createTempRoot();
    const badBundleDist = writeMinimalPortableDist(
      rootAnchoredBundle,
      '<!doctype html><html><body><script type="module" src="/_bundle/index.js"></script></body></html>',
    );
    expect(() => verifyPortableDistBundle(badBundleDist)).toThrow(/root-anchored/);

    const rootAnchoredAssets = createTempRoot();
    const badAssetsDist = writeMinimalPortableDist(
      rootAnchoredAssets,
      '<!doctype html><html><head><link rel="icon" href="/assets/icon.svg" /></head><body><script src="./_bundle/index.js"></script></body></html>',
    );
    expect(() => verifyPortableDistBundle(badAssetsDist)).toThrow(/root-anchored/);
  });

  it("stages lean files and builds release/autonomo-simulator-web.zip in an isolated workspace", () => {
    const rootDir = createTempRoot();
    const distDir = writeMinimalPortableDist(rootDir);
    const stageDir = resolve(rootDir, "stage-check");

    const staged = stagePortableItchBundle(distDir, stageDir);
    expect(staged).toContain("index.html");
    expect(staged).toContain("_bundle/index-abc123.js");
    expect(staged).toContain("assets/manifest.json");
    expect(staged).not.toContain("og-preview.png");
    expect(staged).not.toContain("_bundle/index-abc123.js.map");

    const result = packageItchRelease(rootDir);
    expect(result.zipPath).toBe(resolve(rootDir, "release", "autonomo-simulator-web.zip"));
    expect(existsSync(result.zipPath)).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(100);
    expect(result.includedFiles).not.toContain("og-preview.png");
    expect(result.includedFiles).not.toContain("_bundle/index-abc123.js.map");
  });
});
