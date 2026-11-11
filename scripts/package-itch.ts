import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface PackageItchResult {
  zipPath: string;
  sizeBytes: number;
}

const REQUIRED_DIST_PATHS = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "assets/manifest.json",
] as const;

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

  const indexHtml = readFileSync(resolve(distDir, "index.html"), "utf8");
  if (/(?:src|href)=["']\/_bundle\//.test(indexHtml)) {
    throw new Error(
      "dist/index.html contains root-anchored '/_bundle/' paths; vite.config.ts must keep base: './' for itch.io portability.",
    );
  }
  if (!/(?:src|href)=["']\.\/_bundle\//.test(indexHtml)) {
    throw new Error(
      "dist/index.html did not emit relative './_bundle/' asset paths expected for itch.io HTML5 embeds.",
    );
  }
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

  if (process.platform === "win32") {
    const escapedDistGlob = `${distDir.replace(/'/g, "''")}\\*`;
    const escapedZipPath = zipPath.replace(/'/g, "''");
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `$ProgressPreference = 'SilentlyContinue'; Compress-Archive -Path '${escapedDistGlob}' -DestinationPath '${escapedZipPath}' -Force`,
      ],
      { stdio: "pipe" },
    );
  } else {
    execFileSync("zip", ["-r", "-q", zipPath, "."], {
      cwd: distDir,
      stdio: "inherit",
    });
  }

  if (!existsSync(zipPath)) {
    throw new Error(`Expected archive was not created at '${zipPath}'.`);
  }

  const sizeBytes = statSync(zipPath).size;
  return { zipPath, sizeBytes };
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectExecution()) {
  const { zipPath, sizeBytes } = packageItchRelease(process.cwd());
  const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
  console.log(`[package:itch] Created portable HTML5 archive: ${zipPath} (${sizeMb} MB).`);
}
