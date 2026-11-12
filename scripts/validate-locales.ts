import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { EventCategorySchema, type EventDef, EventSchema } from "../src/engine/schemas/index.ts";

export interface LocaleValidationResult {
  ok: boolean;
  locale: string;
  eventCount: number;
  keyCount: number;
  errors: string[];
}

export function buildExpectedEventLocaleKeys(events: readonly EventDef[]): Set<string> {
  const expected = new Set<string>();
  for (const event of events) {
    expected.add(`${event.id}.title`);
    expected.add(`${event.id}.body`);
    for (const choice of event.choices) {
      expected.add(`${event.id}.choices.${choice.id}.label`);
      if (choice.result_text != null) {
        expected.add(`${event.id}.choices.${choice.id}.result_text`);
      }
      if (choice.outcomes != null) {
        for (const outcome of choice.outcomes) {
          expected.add(`${event.id}.choices.${choice.id}.outcomes.${outcome.id}.result_text`);
        }
      }
    }
  }
  return expected;
}

function listYamlFilesInDir(dirPath: string, relDirLabel: string, errors: string[]): string[] {
  const entries = readdirSync(dirPath, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const fullPath = resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      errors.push(`${relDirLabel}/${entry.name}: unexpected nested directory.`);
      continue;
    }
    const ext = extname(entry.name).toLowerCase();
    if (ext !== ".yaml" && ext !== ".yml") {
      errors.push(`${relDirLabel}/${entry.name}: unsupported file extension '${ext || "(none)"}'.`);
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function safeParseYaml(filePath: string, relLabel: string, errors: string[]): unknown {
  try {
    const raw = readFileSync(filePath, "utf8");
    return parseYaml(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`${relLabel}: YAML syntax error — ${message}`);
    return undefined;
  }
}

export function validateLocales(rootDir = process.cwd(), locale = "en"): LocaleValidationResult {
  const errors: string[] = [];
  const events: EventDef[] = [];
  const eventsRoot = resolve(rootDir, "content", "events");

  if (!existsSync(eventsRoot)) {
    return {
      ok: false,
      locale,
      eventCount: 0,
      keyCount: 0,
      errors: ["Missing content/events/ directory."],
    };
  }

  for (const category of EventCategorySchema.options) {
    const catDir = resolve(eventsRoot, category);
    if (!existsSync(catDir)) {
      continue;
    }
    const eventFiles = listYamlFilesInDir(catDir, `content/events/${category}`, errors);
    for (const filePath of eventFiles) {
      const relLabel = `content/events/${category}/${basename(filePath)}`;
      const rawDoc = safeParseYaml(filePath, relLabel, errors);
      if (rawDoc === undefined) {
        continue;
      }
      const parsed = EventSchema.safeParse(rawDoc);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push(`${relLabel} [${issue.path.join(".")}]: ${issue.message}`);
        }
        continue;
      }
      events.push(parsed.data);
    }
  }

  events.sort((a, b) => a.id.localeCompare(b.id));
  const expectedKeys = buildExpectedEventLocaleKeys(events);

  const localeDir = resolve(rootDir, "content", "locales", locale);
  if (!existsSync(localeDir)) {
    errors.push(`Missing content/locales/${locale}/ directory.`);
    return {
      ok: false,
      locale,
      eventCount: events.length,
      keyCount: 0,
      errors,
    };
  }

  const localeFiles = listYamlFilesInDir(localeDir, `content/locales/${locale}`, errors);
  if (events.length > 0 && localeFiles.length === 0) {
    errors.push(`No YAML translation files found in content/locales/${locale}/.`);
  }

  const mergedEntries = new Map<string, { value: string; sourceFile: string }>();

  for (const filePath of localeFiles) {
    const relLabel = `content/locales/${locale}/${basename(filePath)}`;
    const rawDoc = safeParseYaml(filePath, relLabel, errors);
    if (rawDoc === undefined) {
      continue;
    }
    if (rawDoc === null || typeof rawDoc !== "object" || Array.isArray(rawDoc)) {
      errors.push(
        `${relLabel}: locale file must be a flat YAML mapping of string keys to strings.`,
      );
      continue;
    }

    for (const [key, val] of Object.entries(rawDoc as Record<string, unknown>)) {
      const prev = mergedEntries.get(key);
      if (prev) {
        errors.push(
          `${relLabel}: duplicate translation key '${key}' (already defined in ${prev.sourceFile}).`,
        );
        continue;
      }
      if (typeof val !== "string" || val.trim().length === 0) {
        errors.push(`${relLabel}: key '${key}' must map to a non-empty string.`);
        continue;
      }
      mergedEntries.set(key, { value: val, sourceFile: relLabel });
    }
  }

  for (const requiredKey of [...expectedKeys].sort((a, b) => a.localeCompare(b))) {
    if (!mergedEntries.has(requiredKey)) {
      errors.push(
        `Missing '${locale}' translation key '${requiredKey}' in content/locales/${locale}/*.yaml.`,
      );
    }
  }

  for (const [actualKey, meta] of [...mergedEntries.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (!expectedKeys.has(actualKey)) {
      errors.push(`${meta.sourceFile}: orphan translation key '${actualKey}' matches no event.`);
    }
  }

  return {
    ok: errors.length === 0,
    locale,
    eventCount: events.length,
    keyCount: mergedEntries.size,
    errors,
  };
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectExecution()) {
  const result = validateLocales(process.cwd(), "en");
  if (!result.ok) {
    for (const err of result.errors) {
      console.error(`[validate:locales] ${err}`);
    }
    process.exit(1);
  }
  console.log(
    `[validate:locales] Validated ${result.keyCount} '${result.locale}' translation keys across ${result.eventCount} events.`,
  );
}
