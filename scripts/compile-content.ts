import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { CompiledContentBundle } from "../src/engine/types.ts";
import { loadAndValidateContent } from "./validate-content.ts";

export function compileContentBundle(rootDir = process.cwd()): CompiledContentBundle {
  const validated = loadAndValidateContent(rootDir);
  if (!validated.ok || !validated.balance || !validated.manifest) {
    const details = validated.errors.map((e) => `  - ${e}`).join("\n");
    throw new Error(`Content compilation aborted due to validation errors:\n${details}`);
  }

  const sortedCharacters: CompiledContentBundle["characters"] = {};
  for (const key of Object.keys(validated.characters).sort((a, b) => a.localeCompare(b))) {
    sortedCharacters[key] = validated.characters[key];
  }

  const bundle: CompiledContentBundle = {
    schema_version: 1,
    balance: validated.balance,
    characters: sortedCharacters,
    events: validated.events,
    manifest: validated.manifest,
  };

  const outPath = resolve(rootDir, "src", "generated", "content-bundle.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");

  return bundle;
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectExecution()) {
  try {
    const bundle = compileContentBundle(process.cwd());
    console.log(
      `[compile:content] Wrote src/generated/content-bundle.json (${Object.keys(bundle.characters).length} characters, ${bundle.events.length} events).`,
    );
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
