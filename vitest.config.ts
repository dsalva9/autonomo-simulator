import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/engine/**/*.test.ts",
      "tests/content/**/*.test.ts",
      "tests/simulation/**/*.test.ts",
      "tests/services/**/*.test.ts",
    ],
    exclude: ["tests/ui/**", "node_modules/**", "dist/**"],
    globals: false,
  },
});
