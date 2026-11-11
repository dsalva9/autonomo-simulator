import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stringify as stringifyYaml } from "yaml";
import { renderJsonSchemaDocument } from "../../scripts/emit-schemas.ts";
import { validateAssets } from "../../scripts/validate-assets.ts";
import { loadAndValidateContent } from "../../scripts/validate-content.ts";
import {
  AssetManifestSchema,
  BalanceConfigSchema,
  CharacterSchema,
  EventSchema,
} from "../../src/engine/index.ts";
import {
  createFixtureBalance,
  createFixtureCharacters,
  createFixtureEvents,
  createFixtureManifest,
} from "./fixtures.ts";

function writeTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "autonomo-test-"));
  mkdirSync(join(dir, "assets", "characters"), { recursive: true });
  mkdirSync(join(dir, "assets", "ui"), { recursive: true });
  mkdirSync(join(dir, "content", "config"), { recursive: true });
  mkdirSync(join(dir, "content", "characters"), { recursive: true });
  for (const cat of ["clientes", "hacienda", "familia", "empleados", "gestor"]) {
    mkdirSync(join(dir, "content", "events", cat), { recursive: true });
  }

  const manifest = createFixtureManifest();
  writeFileSync(join(dir, "assets", "manifest.json"), JSON.stringify(manifest, null, 2));

  for (const entry of Object.values(manifest.assets)) {
    writeFileSync(
      join(dir, "assets", entry.path),
      `<svg xmlns="http://www.w3.org/2000/svg" width="${entry.width}" height="${entry.height}" viewBox="0 0 ${entry.width} ${entry.height}"><rect width="100" height="100" fill="#222"/></svg>`,
    );
  }
  for (const relPath of Object.values(manifest.fallbacks)) {
    writeFileSync(
      join(dir, "assets", relPath),
      `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320" viewBox="0 0 512 320"><rect width="100" height="100" fill="#444"/></svg>`,
    );
  }

  writeFileSync(
    join(dir, "content", "config", "balance.yaml"),
    stringifyYaml(createFixtureBalance()),
  );

  for (const charDef of Object.values(createFixtureCharacters())) {
    writeFileSync(join(dir, "content", "characters", `${charDef.id}.yaml`), stringifyYaml(charDef));
  }

  for (const ev of createFixtureEvents()) {
    writeFileSync(join(dir, "content", "events", ev.category, `${ev.id}.yaml`), stringifyYaml(ev));
  }

  return dir;
}

describe("Zod contracts, JSON schema emission & semantic validators", () => {
  it("validates well-formed fixtures and rejects unknown strict fields", () => {
    expect(BalanceConfigSchema.safeParse(createFixtureBalance()).success).toBe(true);
    expect(AssetManifestSchema.safeParse(createFixtureManifest()).success).toBe(true);

    const paco = createFixtureCharacters().gestor_barato_paco;
    expect(CharacterSchema.safeParse(paco).success).toBe(true);
    expect(CharacterSchema.safeParse({ ...paco, gestor_params: null }).success).toBe(false);
    expect(CharacterSchema.safeParse({ ...paco, extra_field: 123 }).success).toBe(false);

    const sampleEvent = createFixtureEvents()[0];
    expect(EventSchema.safeParse(sampleEvent).success).toBe(true);

    const bothEffectsAndOutcomes = {
      ...sampleEvent,
      choices: [
        {
          ...sampleEvent.choices[0],
          effects: { moral: 2 },
        },
        sampleEvent.choices[1],
      ],
    };
    expect(EventSchema.safeParse(bothEffectsAndOutcomes).success).toBe(false);

    const softlockedEvent = {
      ...sampleEvent,
      choices: sampleEvent.choices.map((c) => ({
        ...c,
        requirements: { min_month: 5 },
      })),
    };
    expect(EventSchema.safeParse(softlockedEvent).success).toBe(false);
  });

  it("emits valid JSON Schema Draft 2020-12 documents for all 4 contracts", () => {
    const rendered = renderJsonSchemaDocument({
      filename: "event.schema.json",
      title: "EventDef",
      schema: EventSchema,
    });
    const parsed = JSON.parse(rendered) as Record<string, unknown>;
    expect(parsed.$id).toBe("event.schema.json");
    expect(parsed.title).toBe("EventDef");
    expect(parsed.type).toBe("object");
  });

  it("validates a complete workspace and catches orphan weight:0 and delay:0 cycles", () => {
    const dir = writeTempWorkspace();
    try {
      expect(validateAssets(dir).ok).toBe(true);
      const validRes = loadAndValidateContent(dir);
      expect(validRes.ok).toBe(true);

      const orphanEvent = {
        schema_version: 1,
        id: "clientes_huella_huerfana",
        category: "clientes",
        title: "Huérfano",
        body: "Nadie me programa.",
        weight: 0,
        cooldown_months: 0,
        choices: [
          { id: "op_a", label: "A", effects: { moral: 1 } },
          { id: "op_b", label: "B", effects: { moral: -1 } },
        ],
      };
      writeFileSync(
        join(dir, "content", "events", "clientes", "clientes_huella_huerfana.yaml"),
        stringifyYaml(orphanEvent),
      );
      const orphanRes = loadAndValidateContent(dir);
      expect(orphanRes.ok).toBe(false);
      expect(orphanRes.errors.some((e) => e.includes("orphan event"))).toBe(true);

      const cycleEvent = {
        ...orphanEvent,
        weight: 5,
        choices: [
          {
            id: "op_a",
            label: "A",
            effects: {
              schedule_events: [{ event_id: "clientes_huella_huerfana", delay_months: 0 }],
            },
          },
          { id: "op_b", label: "B", effects: { moral: -1 } },
        ],
      };
      writeFileSync(
        join(dir, "content", "events", "clientes", "clientes_huella_huerfana.yaml"),
        stringifyYaml(cycleEvent),
      );
      const cycleRes = loadAndValidateContent(dir);
      expect(cycleRes.ok).toBe(false);
      expect(cycleRes.errors.some((e) => e.includes("delay_months: 0"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
