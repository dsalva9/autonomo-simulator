import { createHash } from "node:crypto";
import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

const EXCLUDED_PRECACHE_FILES = new Set(["sw.js", "og-preview.png", ".DS_Store", "Thumbs.db"]);

function collectDistFiles(dirPath: string, distRoot: string, acc: string[] = []): string[] {
  if (!existsSync(dirPath)) {
    return acc;
  }
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectDistFiles(fullPath, distRoot, acc);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (EXCLUDED_PRECACHE_FILES.has(entry.name) || entry.name.endsWith(".map")) {
      continue;
    }
    const relPosix = relative(distRoot, fullPath).split(sep).join("/");
    acc.push(`./${relPosix}`);
  }
  return acc;
}

function copyStaticGameAssetsAndInjectSw(): Plugin {
  return {
    name: "copy-static-game-assets-and-inject-sw",
    closeBundle() {
      const distRoot = resolve(process.cwd(), "dist");
      const srcAssets = resolve(process.cwd(), "assets");
      const destAssets = resolve(distRoot, "assets");

      if (existsSync(srcAssets)) {
        cpSync(srcAssets, destAssets, { recursive: true });
      }

      const swPath = resolve(distRoot, "sw.js");
      if (!existsSync(swPath)) {
        return;
      }

      const discovered = collectDistFiles(distRoot, distRoot).sort();
      const precacheUrls = ["./", ...discovered];

      const hasher = createHash("sha256");
      for (const relUrl of discovered) {
        const diskPath = resolve(distRoot, relUrl.slice(2));
        hasher.update(relUrl);
        hasher.update(readFileSync(diskPath));
      }
      const cacheVersion = `v-${hasher.digest("hex").slice(0, 12)}`;

      const swTemplate = readFileSync(swPath, "utf8");
      const injectedSw = swTemplate
        .replace("__AUTONOMO_SW_VERSION__", cacheVersion)
        .replace(
          /\/\*\s*__AUTONOMO_PRECACHE_MANIFEST__\s*\*\/\s*\[[\s\S]*?\]/,
          JSON.stringify(precacheUrls, null, 2),
        );

      writeFileSync(swPath, injectedSw, "utf8");
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), copyStaticGameAssetsAndInjectSw()],
  build: {
    outDir: "dist",
    assetsDir: "_bundle",
    sourcemap: false,
    target: "es2022",
  },
});
