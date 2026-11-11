import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  AssetManifestSchema,
  BalanceConfigSchema,
  CharacterSchema,
  EventSchema,
} from "../src/engine/schemas/index.ts";

interface SchemaTarget {
  filename: string;
  title: string;
  schema: z.ZodType;
}

const SCHEMA_TARGETS: readonly SchemaTarget[] = [
  {
    filename: "asset-manifest.schema.json",
    title: "AssetManifest",
    schema: AssetManifestSchema,
  },
  {
    filename: "balance.schema.json",
    title: "BalanceConfig",
    schema: BalanceConfigSchema,
  },
  {
    filename: "character.schema.json",
    title: "CharacterDef",
    schema: CharacterSchema,
  },
  {
    filename: "event.schema.json",
    title: "EventDef",
    schema: EventSchema,
  },
];

export function renderJsonSchemaDocument(target: SchemaTarget): string {
  const raw = z.toJSONSchema(target.schema, {
    target: "draft-2020-12",
    unrepresentable: "any",
  }) as Record<string, unknown>;

  const enriched: Record<string, unknown> = {
    $schema: raw.$schema ?? "https://json-schema.org/draft/2020-12/schema",
    $id: target.filename,
    title: target.title,
    ...raw,
  };

  return `${JSON.stringify(enriched, null, 2)}\n`;
}

export function emitSchemas(
  rootDir = process.cwd(),
  checkOnly = false,
): { ok: boolean; diffs: string[] } {
  const schemasDir = resolve(rootDir, "schemas");
  const diffs: string[] = [];

  if (!checkOnly) {
    mkdirSync(schemasDir, { recursive: true });
  }

  for (const target of SCHEMA_TARGETS) {
    const outPath = resolve(schemasDir, target.filename);
    const expected = renderJsonSchemaDocument(target);

    if (checkOnly) {
      if (!existsSync(outPath)) {
        diffs.push(`Missing generated schema file: schemas/${target.filename}`);
        continue;
      }
      const actual = readFileSync(outPath, "utf8").replace(/\r\n/g, "\n");
      if (actual !== expected) {
        diffs.push(`Out-of-sync schema file: schemas/${target.filename} (run 'pnpm schema:emit')`);
      }
    } else {
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, expected, "utf8");
    }
  }

  return {
    ok: diffs.length === 0,
    diffs,
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
  const checkMode = process.argv.includes("--check");
  const result = emitSchemas(process.cwd(), checkMode);

  if (!result.ok) {
    for (const msg of result.diffs) {
      console.error(`[schema:check] ${msg}`);
    }
    process.exit(1);
  }

  if (checkMode) {
    console.log(`[schema:check] All ${SCHEMA_TARGETS.length} JSON Schemas are in sync.`);
  } else {
    console.log(`[schema:emit] Emitted ${SCHEMA_TARGETS.length} JSON Schemas to schemas/.`);
  }
}
