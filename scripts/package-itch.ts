import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, posix, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { deflateRawSync } from "node:zlib";

export interface PackageItchResult {
  zipPath: string;
  sizeBytes: number;
  includedFiles: string[];
}

const REQUIRED_DIST_PATHS = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "assets/manifest.json",
] as const;

const EXCLUDED_ITCH_FILENAMES = new Set(["og-preview.png", ".DS_Store", "Thumbs.db"]);

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function computeCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = (CRC32_TABLE[(crc ^ (buf[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, Math.min(2107, date.getUTCFullYear()));
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | ((seconds >> 1) & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

/**
 * Writes a PKWARE APPNOTE §4.4.17.1-compliant ZIP archive with strict POSIX forward-slash (`/`)
 * entry names and zero `./` or `\` prefixes so Linux/itch.io HTML5 extractors resolve directories cleanly.
 */
export function writePosixZipArchive(
  sourceDir: string,
  relPosixFiles: string[],
  outZipPath: string,
): void {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const rawRel of relPosixFiles) {
    const entryName = rawRel.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
    if (!entryName || entryName.includes("\\")) {
      throw new Error(`Invalid ZIP entry path '${rawRel}'.`);
    }

    const absFile = resolve(sourceDir, entryName);
    const rawData = readFileSync(absFile);
    const stat = statSync(absFile);
    const { dosTime, dosDate } = toDosDateTime(stat.mtime);

    const deflated = deflateRawSync(rawData, { level: 9 });
    const useDeflate = deflated.length < rawData.length;
    const method = useDeflate ? 8 : 0;
    const payload = useDeflate ? deflated : rawData;

    const crc = computeCrc32(rawData);
    const nameBytes = Buffer.from(entryName, "utf8");
    const utf8Flag = 0x0800; // Bit 11: UTF-8 filename encoding

    // Local File Header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // Version needed: 2.0
    localHeader.writeUInt16LE(utf8Flag, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(rawData.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28); // Extra field length

    localParts.push(localHeader, nameBytes, payload);

    // Central Directory File Header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4); // Made by: UNIX (3) + ZIP 2.0 (20)
    centralHeader.writeUInt16LE(20, 6); // Version needed: 2.0
    centralHeader.writeUInt16LE(utf8Flag, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30); // Extra length
    centralHeader.writeUInt16LE(0, 32); // Comment length
    centralHeader.writeUInt16LE(0, 34); // Disk number start
    centralHeader.writeUInt16LE(0, 36); // Internal file attributes
    centralHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38); // UNIX regular file 0644
    centralHeader.writeUInt32LE(localOffset, 42);

    centralParts.push(centralHeader, nameBytes);
    localOffset += localHeader.length + nameBytes.length + payload.length;
  }

  const centralDirBuffer = Buffer.concat(centralParts);
  const entryCount = relPosixFiles.length;

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entryCount, 8);
  eocd.writeUInt16LE(entryCount, 10);
  eocd.writeUInt32LE(centralDirBuffer.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  eocd.writeUInt16LE(0, 20);

  writeFileSync(outZipPath, Buffer.concat([...localParts, centralDirBuffer, eocd]));
}

/**
 * Reads the Central Directory of a ZIP buffer and returns exact stored entry filenames.
 */
export function listZipEntries(zipBuffer: Buffer): string[] {
  let eocdOffset = -1;
  for (let i = zipBuffer.length - 22; i >= Math.max(0, zipBuffer.length - 65557); i -= 1) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error("Invalid ZIP archive: End of Central Directory signature not found.");
  }

  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
  const entries: string[] = [];
  let ptr = centralDirOffset;

  for (let i = 0; i < totalEntries; i += 1) {
    if (zipBuffer.readUInt32LE(ptr) !== 0x02014b50) {
      throw new Error(`Invalid Central Directory header signature at offset ${ptr}.`);
    }
    const nameLen = zipBuffer.readUInt16LE(ptr + 28);
    const extraLen = zipBuffer.readUInt16LE(ptr + 30);
    const commentLen = zipBuffer.readUInt16LE(ptr + 32);
    const name = zipBuffer.subarray(ptr + 46, ptr + 46 + nameLen).toString("utf8");
    entries.push(name);
    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

export function shouldIncludeInItchArchive(relPosixPath: string): boolean {
  const normalized = relPosixPath.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!normalized) {
    return false;
  }
  const base = posix.basename(normalized);
  if (EXCLUDED_ITCH_FILENAMES.has(base)) {
    return false;
  }
  if (normalized.endsWith(".map")) {
    return false;
  }
  return true;
}

export function verifyPortableDistBundle(distDir: string): void {
  if (!existsSync(distDir)) {
    throw new Error(`Missing build directory '${distDir}'. Run 'pnpm build' first.`);
  }

  for (const relPath of REQUIRED_DIST_PATHS) {
    const target = resolve(distDir, relPath);
    if (!existsSync(target)) {
      throw new Error(`Missing required build artifact '${relPath}' inside '${distDir}'.`);
    }
  }

  const bundleDir = resolve(distDir, "_bundle");
  if (!existsSync(bundleDir) || !statSync(bundleDir).isDirectory()) {
    throw new Error(`Missing required '_bundle/' directory inside '${distDir}'.`);
  }

  const indexHtml = readFileSync(resolve(distDir, "index.html"), "utf8");
  if (/(?:src|href)=["']\/(?:_bundle|assets)\//.test(indexHtml)) {
    throw new Error(
      "dist/index.html contains root-anchored '/_bundle/' or '/assets/' paths; vite.config.ts must keep base: './' for itch.io portability.",
    );
  }
  if (!/(?:src|href)=["']\.\/_bundle\//.test(indexHtml)) {
    throw new Error(
      "dist/index.html did not emit relative './_bundle/' asset paths expected for itch.io HTML5 embeds.",
    );
  }
}

function collectDistFiles(baseDir: string, currentDir = baseDir): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = resolve(currentDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectDistFiles(baseDir, fullPath));
    } else if (entry.isFile()) {
      const rel = relative(baseDir, fullPath).split(sep).join("/");
      results.push(rel);
    }
  }
  return results.sort((a, b) => a.localeCompare(b));
}

export function stagePortableItchBundle(distDir: string, stageDir: string): string[] {
  rmSync(stageDir, { recursive: true, force: true });
  mkdirSync(stageDir, { recursive: true });

  const included: string[] = [];
  for (const relPosixPath of collectDistFiles(distDir)) {
    if (!shouldIncludeInItchArchive(relPosixPath)) {
      continue;
    }
    const srcPath = resolve(distDir, relPosixPath);
    const destPath = resolve(stageDir, relPosixPath);
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(srcPath, destPath);
    included.push(relPosixPath);
  }
  return included;
}

export function packageItchRelease(rootDir = process.cwd()): PackageItchResult {
  const distDir = resolve(rootDir, "dist");
  verifyPortableDistBundle(distDir);

  const releaseDir = resolve(rootDir, "release");
  mkdirSync(releaseDir, { recursive: true });

  const zipPath = resolve(releaseDir, "autonomo-simulator-web.zip");
  if (existsSync(zipPath)) {
    rmSync(zipPath, { force: true });
  }

  const stageDir = resolve(releaseDir, `.itch-staging-${process.pid}`);
  let includedFiles: string[] = [];

  try {
    includedFiles = stagePortableItchBundle(distDir, stageDir);
    writePosixZipArchive(stageDir, includedFiles, zipPath);
  } finally {
    rmSync(stageDir, { recursive: true, force: true });
  }

  if (!existsSync(zipPath)) {
    throw new Error(`Expected archive was not created at '${zipPath}'.`);
  }

  const sizeBytes = statSync(zipPath).size;
  return { zipPath, sizeBytes, includedFiles };
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectExecution()) {
  const { zipPath, sizeBytes, includedFiles } = packageItchRelease(process.cwd());
  const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
  console.log(
    `[package:itch] Created portable HTML5 archive: ${zipPath} (${sizeMb} MB, ${includedFiles.length} files).`,
  );
}
