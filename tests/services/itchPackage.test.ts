import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { inflateRawSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import {
  listZipEntries,
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

function extractZipEntryUtf8(zipBuffer: Buffer, targetName: string): string {
  let offset = 0;
  while (offset + 30 <= zipBuffer.length && zipBuffer.readUInt32LE(offset) === 0x04034b50) {
    const method = zipBuffer.readUInt16LE(offset + 8);
    const compSize = zipBuffer.readUInt32LE(offset + 18);
    const nameLen = zipBuffer.readUInt16LE(offset + 26);
    const extraLen = zipBuffer.readUInt16LE(offset + 28);
    const name = zipBuffer.subarray(offset + 30, offset + 30 + nameLen).toString("utf8");
    const dataStart = offset + 30 + nameLen + extraLen;
    const payload = zipBuffer.subarray(dataStart, dataStart + compSize);
    if (name === targetName) {
      return (method === 8 ? inflateRawSync(payload) : payload).toString("utf8");
    }
    offset = dataStart + compSize;
  }
  throw new Error(`Entry '${targetName}' not found in local ZIP headers.`);
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

  it("stages lean files and builds POSIX '/' release/autonomo-simulator-web.zip with root index.html", () => {
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

    // Inspect raw ZIP Central Directory headers for strict PKWARE POSIX '/' compliance
    const zipBuffer = readFileSync(result.zipPath);
    const entries = listZipEntries(zipBuffer);
    expect(entries.length).toBe(result.includedFiles.length);
    expect(entries).toContain("index.html");
    expect(entries).toContain("_bundle/index-abc123.js");
    expect(entries).toContain("_bundle/index-abc123.css");
    expect(entries).toContain("assets/manifest.json");
    for (const entry of entries) {
      expect(entry.includes("\\")).toBe(false);
      expect(entry.startsWith("./")).toBe(false);
      expect(entry.startsWith("/")).toBe(false);
    }

    // Verify lossless round-trip decompression of root and nested entries
    expect(extractZipEntryUtf8(zipBuffer, "index.html")).toContain("./_bundle/index-abc123.js");
    expect(extractZipEntryUtf8(zipBuffer, "_bundle/index-abc123.js")).toBe("console.log('ok');");
    expect(extractZipEntryUtf8(zipBuffer, "assets/manifest.json")).toBe(
      '{"version":1,"assets":{}}',
    );
  });
});
