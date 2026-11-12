import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import type { CompiledContentBundle } from "../src/engine/types.ts";
import { loadAndValidateContent } from "./validate-content.ts";

export type CompiledLocalesMap = Record<string, Record<string, string>>;

export function compileLocaleOverlays(rootDir = process.cwd()): CompiledLocalesMap {
  const localesRoot = resolve(rootDir, "content", "locales");
  const compiled: CompiledLocalesMap = {
    en: {},
  };

  if (existsSync(localesRoot)) {
    const localeDirs = readdirSync(localesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    for (const locale of localeDirs) {
      const localeDir = resolve(localesRoot, locale);
      const files = readdirSync(localeDir, { withFileTypes: true })
        .filter((entry) => {
          if (!entry.isFile() || entry.name.startsWith(".")) {
            return false;
          }
          const ext = extname(entry.name).toLowerCase();
          return ext === ".yaml" || ext === ".yml";
        })
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

      const rawTable: Record<string, string> = {};
      for (const fileName of files) {
        const filePath = resolve(localeDir, fileName);
        const parsed = parseYaml(readFileSync(filePath, "utf8"));
        if (parsed == null) {
          continue;
        }
        if (typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error(
            `content/locales/${locale}/${fileName} must be a flat YAML mapping of string keys to strings.`,
          );
        }
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value !== "string" || value.trim().length === 0) {
            throw new Error(
              `content/locales/${locale}/${fileName} key '${key}' must be a non-empty string.`,
            );
          }
          rawTable[key] = value;
        }
      }

      const sortedTable: Record<string, string> = {};
      for (const key of Object.keys(rawTable).sort((a, b) => a.localeCompare(b))) {
        sortedTable[key] = rawTable[key];
      }
      compiled[locale] = sortedTable;
    }
  }

  const sortedLocales: CompiledLocalesMap = {};
  for (const locale of Object.keys(compiled).sort((a, b) => a.localeCompare(b))) {
    sortedLocales[locale] = compiled[locale];
  }

  const outLocalesPath = resolve(rootDir, "src", "content", "compiled-locales.json");
  mkdirSync(dirname(outLocalesPath), { recursive: true });
  writeFileSync(outLocalesPath, `${JSON.stringify(sortedLocales, null, 2)}\n`, "utf8");

  return sortedLocales;
}

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

  compileLocaleOverlays(rootDir);

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
      `[compile:content] Wrote src/generated/content-bundle.json and src/content/compiled-locales.json (${Object.keys(bundle.characters).length} characters, ${bundle.events.length} events).`,
    );
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
