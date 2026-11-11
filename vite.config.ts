import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

function copyStaticGameAssets(): Plugin {
  return {
    name: "copy-static-game-assets",
    closeBundle() {
      const srcAssets = resolve(process.cwd(), "assets");
      const destAssets = resolve(process.cwd(), "dist", "assets");
      if (existsSync(srcAssets)) {
        cpSync(srcAssets, destAssets, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), copyStaticGameAssets()],
  build: {
    outDir: "dist",
    assetsDir: "_bundle",
    sourcemap: false,
    target: "es2022",
  },
});
