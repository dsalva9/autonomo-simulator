import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, posix, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

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

    if (process.platform === "win32") {
      const escapedStageGlob = `${stageDir.replace(/'/g, "''")}\\*`;
      const escapedZipPath = zipPath.replace(/'/g, "''");
      execFileSync(
        "powershell",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `$ProgressPreference = 'SilentlyContinue'; Compress-Archive -Path '${escapedStageGlob}' -DestinationPath '${escapedZipPath}' -Force`,
        ],
        { stdio: "pipe" },
      );
    } else {
      execFileSync("zip", ["-r", "-q", zipPath, "."], {
        cwd: stageDir,
        stdio: "inherit",
      });
    }
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
