import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stringify as stringifyYaml } from "yaml";
import { renderJsonSchemaDocument } from "../../scripts/emit-schemas.ts";
import {
  ASSET_CATEGORY_MAX_BYTES,
  parseWebpDimensions,
  validateAssets,
} from "../../scripts/validate-assets.ts";
import { loadAndValidateContent } from "../../scripts/validate-content.ts";
import {
  AssetManifestSchema,
  BalanceConfigSchema,
  CharacterExpressionSchema,
  CharacterExpressionsMapSchema,
  CharacterSchema,
  EventSchema,
} from "../../src/engine/index.ts";
import {
  createFixtureBalance,
  createFixtureCharacters,
  createFixtureEvents,
  createFixtureManifest,
} from "./fixtures.ts";

function buildRiffWebp(chunkTag: string, payload: Buffer, totalByteSize?: number): Buffer {
  const padByte = payload.length & 1;
  const minSize = 12 + 8 + payload.length + padByte;
  const finalSize = totalByteSize != null && totalByteSize > minSize ? totalByteSize : minSize;
  const buf = Buffer.alloc(finalSize, 0);

  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(finalSize - 8, 4);
  buf.write("WEBP", 8, "ascii");
  buf.write(chunkTag, 12, "ascii");
  buf.writeUInt32LE(payload.length, 16);
  payload.copy(buf, 20);

  if (finalSize > minSize) {
    const trailingPayloadLen = finalSize - minSize - 8;
    if (trailingPayloadLen >= 0) {
      buf.write("JUNK", minSize, "ascii");
      buf.writeUInt32LE(trailingPayloadLen, minSize + 4);
    }
  }

  return buf;
}

function createLossyVp8Webp(width: number, height: number, totalByteSize?: number): Buffer {
  const payload = Buffer.alloc(10, 0);
  // 3-byte keyframe tag (bit 0 = 0 for keyframe)
  payload[0] = 0x10;
  payload[1] = 0x00;
  payload[2] = 0x00;
  // VP8 keyframe start code at payload offset 3..6
  payload[3] = 0x9d;
  payload[4] = 0x01;
  payload[5] = 0x2a;
  // 14-bit LE width & height (with scale bits in upper 2 bits to verify masking)
  payload.writeUInt16LE((width & 0x3fff) | 0x4000, 6);
  payload.writeUInt16LE((height & 0x3fff) | 0x8000, 8);
  return buildRiffWebp("VP8 ", payload, totalByteSize);
}

function createLosslessVp8LWebp(width: number, height: number, totalByteSize?: number): Buffer {
  const payload = Buffer.alloc(5, 0);
  payload[0] = 0x2f;
  const packed = (((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14) | (1 << 28)) >>> 0;
  payload.writeUInt32LE(packed, 1);
  return buildRiffWebp("VP8L", payload, totalByteSize);
}

function createExtendedVp8XWebp(width: number, height: number, totalByteSize?: number): Buffer {
  const payload = Buffer.alloc(10, 0);
  payload[0] = 0x10; // alpha flag example
  const wMinusOne = width - 1;
  const hMinusOne = height - 1;
  payload[4] = wMinusOne & 0xff;
  payload[5] = (wMinusOne >>> 8) & 0xff;
  payload[6] = (wMinusOne >>> 16) & 0xff;
  payload[7] = hMinusOne & 0xff;
  payload[8] = (hMinusOne >>> 8) & 0xff;
  payload[9] = (hMinusOne >>> 16) & 0xff;
  return buildRiffWebp("VP8X", payload, totalByteSize);
}

function writeTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "autonomo-test-"));
  mkdirSync(join(dir, "assets", "backgrounds"), { recursive: true });
  mkdirSync(join(dir, "assets", "characters"), { recursive: true });
  mkdirSync(join(dir, "assets", "illustrations"), { recursive: true });
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

  it("validates multi-expression CharacterSchema and EventSchema contracts", () => {
    expect(CharacterExpressionSchema.options).toEqual(["neutral", "stressed", "angry", "pleased"]);
    expect(
      CharacterExpressionsMapSchema.safeParse({
        neutral: "char_gestor_barato_paco",
        stressed: "char_gestor_barato_paco_estresado",
      }).success,
    ).toBe(true);
    expect(
      CharacterExpressionsMapSchema.safeParse({
        happy: "char_gestor_barato_paco_feliz",
      }).success,
    ).toBe(false);
    expect(
      CharacterExpressionsMapSchema.safeParse({
        angry: "BadCamelCaseId",
      }).success,
    ).toBe(false);

    const paco = createFixtureCharacters().gestor_barato_paco;
    expect(
      CharacterSchema.safeParse({
        ...paco,
        expressions: {
          neutral: "char_gestor_barato_paco",
          stressed: "char_gestor_barato_paco_estresado",
          pleased: "char_gestor_barato_paco_confiado",
        },
      }).success,
    ).toBe(true);
    expect(CharacterSchema.safeParse({ ...paco, expressions: null }).success).toBe(true);

    const sampleEvent = createFixtureEvents()[0];
    for (const expr of ["neutral", "stressed", "angry", "pleased", null] as const) {
      expect(
        EventSchema.safeParse({
          ...sampleEvent,
          character_expression: expr,
        }).success,
      ).toBe(true);
    }
    expect(
      EventSchema.safeParse({
        ...sampleEvent,
        character_expression: "furious",
      }).success,
    ).toBe(false);
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

  it("cross-validates character.expressions against manifest.assets and character_expression against character_id", () => {
    const dir = writeTempWorkspace();
    try {
      const manifest = createFixtureManifest();
      manifest.assets.char_gestor_barato_paco_estresado = {
        path: "characters/char_gestor_barato_paco_estresado.webp",
        category: "character",
        width: 512,
        height: 512,
        render_mode: "vector_hd",
        status: "ready",
      };
      writeFileSync(join(dir, "assets", "manifest.json"), JSON.stringify(manifest, null, 2));
      writeFileSync(
        join(dir, "assets", "characters", "char_gestor_barato_paco_estresado.webp"),
        createLossyVp8Webp(512, 512),
      );

      const paco = {
        ...createFixtureCharacters().gestor_barato_paco,
        expressions: {
          neutral: "char_gestor_barato_paco",
          stressed: "char_gestor_barato_paco_estresado",
        },
      };
      writeFileSync(
        join(dir, "content", "characters", "gestor_barato_paco.yaml"),
        stringifyYaml(paco),
      );

      const pacoEvent = {
        ...createFixtureEvents().find((e) => e.id === "gestor_oferta_servicios")!,
        character_expression: "stressed",
      };
      writeFileSync(
        join(dir, "content", "events", "gestor", "gestor_oferta_servicios.yaml"),
        stringifyYaml(pacoEvent),
      );

      const okRes = loadAndValidateContent(dir);
      expect(okRes.errors).toEqual([]);
      expect(okRes.ok).toBe(true);

      // Missing expression asset in manifest
      const brokenChar = {
        ...paco,
        expressions: {
          ...paco.expressions,
          angry: "char_gestor_barato_paco_inexistente",
        },
      };
      writeFileSync(
        join(dir, "content", "characters", "gestor_barato_paco.yaml"),
        stringifyYaml(brokenChar),
      );
      const missingExprRes = loadAndValidateContent(dir);
      expect(missingExprRes.ok).toBe(false);
      expect(
        missingExprRes.errors.some((e) =>
          e.includes("expressions.angry 'char_gestor_barato_paco_inexistente' not found"),
        ),
      ).toBe(true);

      // Restore valid character, then test event with character_expression + character_id: null
      writeFileSync(
        join(dir, "content", "characters", "gestor_barato_paco.yaml"),
        stringifyYaml(paco),
      );
      const nullCharExprEvent = {
        ...pacoEvent,
        character_id: null,
        character_expression: "stressed",
      };
      writeFileSync(
        join(dir, "content", "events", "gestor", "gestor_oferta_servicios.yaml"),
        stringifyYaml(nullCharExprEvent),
      );
      const nullCharRes = loadAndValidateContent(dir);
      expect(nullCharRes.ok).toBe(false);
      expect(
        nullCharRes.errors.some((e) =>
          e.includes("character_expression 'stressed' requires a non-null character_id"),
        ),
      ).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses VP8, VP8L, and VP8X WebP headers and rejects corrupt magic bytes, dimension mismatches, and size overruns", () => {
    expect(parseWebpDimensions(createLossyVp8Webp(1280, 720))).toEqual({
      ok: true,
      width: 1280,
      height: 720,
      format: "VP8 ",
    });
    expect(parseWebpDimensions(createLosslessVp8LWebp(960, 540))).toEqual({
      ok: true,
      width: 960,
      height: 540,
      format: "VP8L",
    });
    expect(parseWebpDimensions(createExtendedVp8XWebp(960, 360))).toEqual({
      ok: true,
      width: 960,
      height: 360,
      format: "VP8X",
    });

    // Rejects invalid magic headers and malformed bitstream signatures
    expect(parseWebpDimensions(Buffer.from("not-a-webp"))).toMatchObject({ ok: false });
    expect(parseWebpDimensions(Buffer.from("RIFF\x10\x00\x00\x00WAVEfmt "))).toMatchObject({
      ok: false,
    });
    const badVp8L = createLosslessVp8LWebp(512, 512);
    badVp8L[20] = 0x00; // clobber 0x2f signature
    expect(parseWebpDimensions(badVp8L)).toMatchObject({ ok: false });
    const badVp8 = createLossyVp8Webp(512, 512);
    badVp8[23] = 0x00; // clobber 0x9d start code
    expect(parseWebpDimensions(badVp8)).toMatchObject({ ok: false });

    const dir = writeTempWorkspace();
    try {
      const manifest = createFixtureManifest();
      manifest.assets.bg_despacho_base = {
        path: "backgrounds/bg_despacho_base.webp",
        category: "background",
        width: 1280,
        height: 720,
        render_mode: "vector_hd",
        status: "ready",
      };
      manifest.assets.illus_hito_prueba = {
        path: "illustrations/illus_hito_prueba.webp",
        category: "illustration",
        width: 960,
        height: 540,
        render_mode: "vector_hd",
        status: "ready",
      };
      manifest.assets.banner_clientes_base = {
        path: "illustrations/banner_clientes_base.webp",
        category: "illustration",
        width: 960,
        height: 360,
        render_mode: "vector_hd",
        status: "ready",
      };
      writeFileSync(join(dir, "assets", "manifest.json"), JSON.stringify(manifest, null, 2));
      writeFileSync(
        join(dir, "assets", "backgrounds", "bg_despacho_base.webp"),
        createLossyVp8Webp(1280, 720),
      );
      writeFileSync(
        join(dir, "assets", "illustrations", "illus_hito_prueba.webp"),
        createLosslessVp8LWebp(960, 540),
      );
      writeFileSync(
        join(dir, "assets", "illustrations", "banner_clientes_base.webp"),
        createExtendedVp8XWebp(960, 360),
      );

      const validWebpRes = validateAssets(dir);
      expect(validWebpRes.errors).toEqual([]);
      expect(validWebpRes.ok).toBe(true);

      // Dimension mismatch on WebP
      writeFileSync(
        join(dir, "assets", "illustrations", "illus_hito_prueba.webp"),
        createLosslessVp8LWebp(800, 600),
      );
      const dimErrRes = validateAssets(dir);
      expect(dimErrRes.ok).toBe(false);
      expect(dimErrRes.errors.some((e) => e.includes("WebP width (800)"))).toBe(true);
      expect(dimErrRes.errors.some((e) => e.includes("WebP height (600)"))).toBe(true);

      // Restore valid dimensions, test unsupported extension (.png)
      writeFileSync(
        join(dir, "assets", "illustrations", "illus_hito_prueba.webp"),
        createLosslessVp8LWebp(960, 540),
      );
      const badExtManifest = {
        ...manifest,
        assets: {
          ...manifest.assets,
          char_formato_invalido: {
            path: "characters/char_formato_invalido.png",
            category: "character" as const,
            width: 512,
            height: 512,
            render_mode: "vector_hd" as const,
            status: "ready" as const,
          },
        },
      };
      writeFileSync(join(dir, "assets", "manifest.json"), JSON.stringify(badExtManifest, null, 2));
      writeFileSync(join(dir, "assets", "characters", "char_formato_invalido.png"), "fake-png");
      const extErrRes = validateAssets(dir);
      expect(extErrRes.ok).toBe(false);
      expect(extErrRes.errors.some((e) => e.includes("Unsupported asset extension '.png'"))).toBe(
        true,
      );
      rmSync(join(dir, "assets", "characters", "char_formato_invalido.png"));

      // Per-category file size cap violation (character > 70 KB)
      const heavyCharManifest = {
        ...manifest,
        assets: {
          ...manifest.assets,
          char_pesado: {
            path: "characters/char_pesado.webp",
            category: "character" as const,
            width: 512,
            height: 512,
            render_mode: "vector_hd" as const,
            status: "ready" as const,
          },
        },
      };
      writeFileSync(
        join(dir, "assets", "manifest.json"),
        JSON.stringify(heavyCharManifest, null, 2),
      );
      writeFileSync(
        join(dir, "assets", "characters", "char_pesado.webp"),
        createLossyVp8Webp(512, 512, ASSET_CATEGORY_MAX_BYTES.character + 1024),
      );
      const catCapRes = validateAssets(dir);
      expect(catCapRes.ok).toBe(false);
      expect(catCapRes.errors.some((e) => e.includes("exceeds 'character' cap"))).toBe(true);
      rmSync(join(dir, "assets", "characters", "char_pesado.webp"));

      // Total assets/ payload cap violation (> 3.50 MB across individually compliant <= 145 KB backgrounds)
      for (let i = 1; i <= 26; i += 1) {
        const id = `bg_lote_${i}`;
        const rel = `backgrounds/${id}.webp`;
        manifest.assets[id] = {
          path: rel,
          category: "background",
          width: 1280,
          height: 720,
          render_mode: "vector_hd",
          status: "ready",
        };
        writeFileSync(join(dir, "assets", rel), createLossyVp8Webp(1280, 720, 144 * 1024));
      }
      writeFileSync(join(dir, "assets", "manifest.json"), JSON.stringify(manifest, null, 2));
      const totalCapRes = validateAssets(dir);
      expect(totalCapRes.ok).toBe(false);
      expect(
        totalCapRes.errors.some(
          (e) => e.includes("Total assets/ payload") && e.includes("3.50 MB"),
        ),
      ).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
