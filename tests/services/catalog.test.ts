import { describe, expect, it } from "vitest";
import {
  type AssetManifest,
  type CharacterDef,
  type EndingId,
  startNewRun,
} from "../../src/engine/index.ts";
import {
  ENDING_ILLUSTRATION_IDS,
  compiledCatalog,
  resolveCharacterPortraitAsset,
  resolveDeskBackgroundAsset,
  resolveEndingIllustrationAsset,
  resolveEventBannerAsset,
} from "../../src/services/content/catalog.ts";

function buildPhase1Manifest(): AssetManifest {
  return {
    schema_version: 1,
    default_render_mode: "vector_hd",
    assets: {
      bg_despacho_base: {
        path: "backgrounds/bg_despacho_base.webp",
        category: "background",
        width: 1280,
        height: 720,
        render_mode: "vector_hd",
        status: "ready",
      },
      bg_despacho_burnout: {
        path: "backgrounds/bg_despacho_burnout.webp",
        category: "background",
        width: 1280,
        height: 720,
        render_mode: "vector_hd",
        status: "ready",
      },
      bg_despacho_numeros_rojos: {
        path: "backgrounds/bg_despacho_numeros_rojos.webp",
        category: "background",
        width: 1280,
        height: 720,
        render_mode: "vector_hd",
        status: "ready",
      },
      bg_despacho_estudio: {
        path: "backgrounds/bg_despacho_estudio.webp",
        category: "background",
        width: 1280,
        height: 720,
        render_mode: "vector_hd",
        status: "ready",
      },
      char_gestor_barato_paco: {
        path: "characters/char_gestor_barato_paco.webp",
        category: "character",
        width: 512,
        height: 512,
        render_mode: "vector_hd",
        status: "ready",
      },
      char_gestor_barato_paco_estresado: {
        path: "characters/char_gestor_barato_paco_estresado.webp",
        category: "character",
        width: 512,
        height: 512,
        render_mode: "vector_hd",
        status: "ready",
      },
      char_gestor_barato_paco_confiado: {
        path: "characters/char_gestor_barato_paco_confiado.webp",
        category: "character",
        width: 512,
        height: 512,
        render_mode: "vector_hd",
        status: "ready",
      },
      banner_clientes_base: {
        path: "illustrations/banner_clientes_base.webp",
        category: "illustration",
        width: 960,
        height: 360,
        render_mode: "vector_hd",
        status: "ready",
      },
      banner_clientes_tension: {
        path: "illustrations/banner_clientes_tension.webp",
        category: "illustration",
        width: 960,
        height: 360,
        render_mode: "vector_hd",
        status: "ready",
      },
      banner_hacienda_base: {
        path: "illustrations/banner_hacienda_base.webp",
        category: "illustration",
        width: 960,
        height: 360,
        render_mode: "vector_hd",
        status: "ready",
      },
      banner_hacienda_inspeccion: {
        path: "illustrations/banner_hacienda_inspeccion.webp",
        category: "illustration",
        width: 960,
        height: 360,
        render_mode: "vector_hd",
        status: "ready",
      },
      banner_familia_base: {
        path: "illustrations/banner_familia_base.webp",
        category: "illustration",
        width: 960,
        height: 360,
        render_mode: "vector_hd",
        status: "ready",
      },
      banner_empleados_base: {
        path: "illustrations/banner_empleados_base.webp",
        category: "illustration",
        width: 960,
        height: 360,
        render_mode: "vector_hd",
        status: "ready",
      },
      banner_gestor_base: {
        path: "illustrations/banner_gestor_base.webp",
        category: "illustration",
        width: 960,
        height: 360,
        render_mode: "vector_hd",
        status: "ready",
      },
      illus_hito_inspeccion_hacienda: {
        path: "illustrations/illus_hito_inspeccion_hacienda.webp",
        category: "illustration",
        width: 960,
        height: 540,
        render_mode: "vector_hd",
        status: "ready",
      },
      illus_final_bancarrota: {
        path: "illustrations/illus_final_bancarrota.webp",
        category: "illustration",
        width: 960,
        height: 540,
        render_mode: "vector_hd",
        status: "ready",
      },
      illus_final_ansiedad: {
        path: "illustrations/illus_final_ansiedad.webp",
        category: "illustration",
        width: 960,
        height: 540,
        render_mode: "vector_hd",
        status: "ready",
      },
      illus_final_desmotivacion: {
        path: "illustrations/illus_final_desmotivacion.webp",
        category: "illustration",
        width: 960,
        height: 540,
        render_mode: "vector_hd",
        status: "ready",
      },
      illus_final_oposiciones: {
        path: "illustrations/illus_final_oposiciones.webp",
        category: "illustration",
        width: 960,
        height: 540,
        render_mode: "vector_hd",
        status: "ready",
      },
      illus_final_asalariado: {
        path: "illustrations/illus_final_asalariado.webp",
        category: "illustration",
        width: 960,
        height: 540,
        render_mode: "vector_hd",
        status: "ready",
      },
      illus_final_subsidios: {
        path: "illustrations/illus_final_subsidios.webp",
        category: "illustration",
        width: 960,
        height: 540,
        render_mode: "vector_hd",
        status: "ready",
      },
      illus_final_heroe: {
        path: "illustrations/illus_final_heroe.webp",
        category: "illustration",
        width: 960,
        height: 540,
        render_mode: "vector_hd",
        status: "ready",
      },
      illus_final_ricachon: {
        path: "illustrations/illus_final_ricachon.webp",
        category: "illustration",
        width: 960,
        height: 540,
        render_mode: "vector_hd",
        status: "ready",
      },
      ui_fallback_clientes: {
        path: "ui/fallback_clientes.svg",
        category: "ui",
        width: 512,
        height: 320,
        render_mode: "vector_hd",
        status: "ready",
      },
      ui_fallback_hacienda: {
        path: "ui/fallback_hacienda.svg",
        category: "ui",
        width: 512,
        height: 320,
        render_mode: "vector_hd",
        status: "ready",
      },
    },
    fallbacks: {
      clientes: "ui/fallback_clientes.svg",
      hacienda: "ui/fallback_hacienda.svg",
      familia: "ui/fallback_familia.svg",
      empleados: "ui/fallback_empleados.svg",
      gestor: "ui/fallback_gestor.svg",
    },
  };
}

function buildPhase0MinimalManifest(): AssetManifest {
  return {
    schema_version: 1,
    default_render_mode: "vector_hd",
    assets: {
      bg_despacho_base: {
        path: "backgrounds/bg_despacho_base.svg",
        category: "background",
        width: 960,
        height: 540,
        render_mode: "vector_hd",
        status: "placeholder",
      },
      char_gestor_barato_paco: {
        path: "characters/char_gestor_barato_paco.svg",
        category: "character",
        width: 512,
        height: 512,
        render_mode: "vector_hd",
        status: "placeholder",
      },
      ui_fallback_clientes: {
        path: "ui/fallback_clientes.svg",
        category: "ui",
        width: 512,
        height: 320,
        render_mode: "vector_hd",
        status: "placeholder",
      },
    },
    fallbacks: {
      clientes: "ui/fallback_clientes.svg",
      hacienda: "ui/fallback_hacienda.svg",
      familia: "ui/fallback_familia.svg",
      empleados: "ui/fallback_empleados.svg",
      gestor: "ui/fallback_gestor.svg",
    },
  };
}

describe("Phase 1 Asset Resolution Helpers (catalog.ts)", () => {
  const manifest = buildPhase1Manifest();
  const minimalManifest = buildPhase0MinimalManifest();
  const { state: baseState } = startNewRun(compiledCatalog, {
    seed: "CATALOG-TEST-01",
    runId: "run_catalog_01",
  });

  describe("resolveDeskBackgroundAsset", () => {
    it("enforces priority order: burnout (stress >= 75) > numeros_rojos (money < 0) > estudio > base", () => {
      const mockEmployee = {
        character_id: "empleado_junior_dani",
        role_label: "Asistente júnior",
        monthly_cost: 1450,
        billing_multiplier: 1.35,
        satisfaction: 75,
        months_employed: 2,
      };

      // Priority 1 wins even when money < 0 and employee !== null
      expect(
        resolveDeskBackgroundAsset(manifest, {
          indicators: { ...baseState.indicators, stress: 75, money: -400, reputation: 80 },
          employee: mockEmployee,
        })?.id,
      ).toBe("bg_despacho_burnout");

      // Priority 2 wins when stress < 75 even if employee !== null
      expect(
        resolveDeskBackgroundAsset(manifest, {
          indicators: { ...baseState.indicators, stress: 74, money: -1, reputation: 90 },
          employee: mockEmployee,
        })?.id,
      ).toBe("bg_despacho_numeros_rojos");

      // Priority 3 via employee !== null
      expect(
        resolveDeskBackgroundAsset(manifest, {
          indicators: { ...baseState.indicators, stress: 40, money: 1200, reputation: 30 },
          employee: mockEmployee,
        })?.id,
      ).toBe("bg_despacho_estudio");

      // Priority 3 via money >= 25_000 && reputation >= 65
      expect(
        resolveDeskBackgroundAsset(manifest, {
          indicators: { ...baseState.indicators, stress: 40, money: 25_000, reputation: 65 },
          employee: null,
        })?.id,
      ).toBe("bg_despacho_estudio");

      // Below reputation threshold -> base desk
      expect(
        resolveDeskBackgroundAsset(manifest, {
          indicators: { ...baseState.indicators, stress: 40, money: 25_000, reputation: 64 },
          employee: null,
        })?.id,
      ).toBe("bg_despacho_base");
    });

    it("gracefully falls back to bg_despacho_base when state-specific desk IDs are absent", () => {
      const resolved = resolveDeskBackgroundAsset(minimalManifest, {
        indicators: { ...baseState.indicators, stress: 90, money: -1200 },
        employee: null,
      });
      expect(resolved?.id).toBe("bg_despacho_base");
    });
  });

  describe("resolveCharacterPortraitAsset", () => {
    const pacoCharacter: Pick<CharacterDef, "portrait_asset_id" | "expressions"> = {
      portrait_asset_id: "char_gestor_barato_paco",
      expressions: {
        neutral: "char_gestor_barato_paco",
        stressed: "char_gestor_barato_paco_estresado",
        pleased: "char_gestor_barato_paco_confiado",
      },
    };

    it("resolves requested expression variant and falls back cleanly through neutral -> portrait_asset_id", () => {
      expect(resolveCharacterPortraitAsset(manifest, pacoCharacter, "stressed")?.id).toBe(
        "char_gestor_barato_paco_estresado",
      );
      expect(resolveCharacterPortraitAsset(manifest, pacoCharacter, "pleased")?.id).toBe(
        "char_gestor_barato_paco_confiado",
      );
      // Missing 'angry' variant on Paco falls back to neutral
      expect(resolveCharacterPortraitAsset(manifest, pacoCharacter, "angry")?.id).toBe(
        "char_gestor_barato_paco",
      );
      // Omitted expression defaults to neutral
      expect(resolveCharacterPortraitAsset(manifest, pacoCharacter)?.id).toBe(
        "char_gestor_barato_paco",
      );
      expect(resolveCharacterPortraitAsset(manifest, null, "stressed")).toBeNull();
    });

    it("falls back to portrait_asset_id when expression variant IDs are missing from a Phase-0 manifest", () => {
      expect(resolveCharacterPortraitAsset(minimalManifest, pacoCharacter, "stressed")?.id).toBe(
        "char_gestor_barato_paco",
      );
    });
  });

  describe("resolveEventBannerAsset", () => {
    it("returns kind='milestone' when bespoke illustration_id resolves in manifest", () => {
      const res = resolveEventBannerAsset(
        manifest,
        {
          category: "hacienda",
          illustration_id: "illus_hito_inspeccion_hacienda",
          character_expression: "angry",
        },
        baseState,
      );
      expect(res.kind).toBe("milestone");
      expect(res.asset.id).toBe("illus_hito_inspeccion_hacienda");
      expect(res.asset.width).toBe(960);
      expect(res.asset.height).toBe(540);
    });

    it("selects mood-aware 8:3 category banners across all 5 categories", () => {
      // Clientes base vs tension
      expect(
        resolveEventBannerAsset(
          manifest,
          { category: "clientes", illustration_id: null, character_expression: "neutral" },
          baseState,
        ),
      ).toEqual(
        expect.objectContaining({
          kind: "banner",
          asset: expect.objectContaining({ id: "banner_clientes_base" }),
        }),
      );

      expect(
        resolveEventBannerAsset(
          manifest,
          { category: "clientes", illustration_id: null, character_expression: "angry" },
          baseState,
        ).asset.id,
      ).toBe("banner_clientes_tension");

      expect(
        resolveEventBannerAsset(
          manifest,
          { category: "clientes", illustration_id: null, character_expression: "neutral" },
          {
            ...baseState,
            indicators: { ...baseState.indicators, money: -50 },
          },
        ).asset.id,
      ).toBe("banner_clientes_tension");

      // Hacienda base vs inspeccion
      expect(
        resolveEventBannerAsset(
          manifest,
          { category: "hacienda", illustration_id: null, character_expression: "neutral" },
          { ...baseState, fiscal_risk: 10, flags: {} },
        ).asset.id,
      ).toBe("banner_hacienda_base");

      expect(
        resolveEventBannerAsset(
          manifest,
          { category: "hacienda", illustration_id: null, character_expression: "neutral" },
          { ...baseState, fiscal_risk: 40, flags: {} },
        ).asset.id,
      ).toBe("banner_hacienda_inspeccion");

      expect(
        resolveEventBannerAsset(
          manifest,
          { category: "hacienda", illustration_id: null, character_expression: "neutral" },
          { ...baseState, fiscal_risk: 5, flags: { inspeccion_en_curso: true } },
        ).asset.id,
      ).toBe("banner_hacienda_inspeccion");

      // Familia, empleados, gestor
      expect(
        resolveEventBannerAsset(
          manifest,
          { category: "familia", illustration_id: null, character_expression: null },
          baseState,
        ).asset.id,
      ).toBe("banner_familia_base");
      expect(
        resolveEventBannerAsset(
          manifest,
          { category: "empleados", illustration_id: null, character_expression: null },
          baseState,
        ).asset.id,
      ).toBe("banner_empleados_base");
      expect(
        resolveEventBannerAsset(
          manifest,
          { category: "gestor", illustration_id: null, character_expression: null },
          baseState,
        ).asset.id,
      ).toBe("banner_gestor_base");
    });

    it("falls back to resolveCategoryFallbackAsset when banner_* is absent from manifest", () => {
      const fallbackClientes = resolveEventBannerAsset(
        minimalManifest,
        { category: "clientes", illustration_id: null, character_expression: "stressed" },
        baseState,
      );
      expect(fallbackClientes.kind).toBe("banner");
      expect(fallbackClientes.asset.id).toBe("ui_fallback_clientes");

      const fallbackFamilia = resolveEventBannerAsset(
        minimalManifest,
        { category: "familia", illustration_id: null, character_expression: null },
        baseState,
      );
      expect(fallbackFamilia.kind).toBe("banner");
      expect(fallbackFamilia.asset.id).toBe("fallback_familia");
    });
  });

  describe("resolveEndingIllustrationAsset", () => {
    it("maps all 8 EndingIds to their canonical illus_final_* assets and returns null when absent", () => {
      const expectedPairs: [EndingId, string][] = [
        ["defeat_bankruptcy", "illus_final_bancarrota"],
        ["defeat_burnout_stress", "illus_final_ansiedad"],
        ["defeat_resignation_moral", "illus_final_desmotivacion"],
        ["abandon_oposiciones", "illus_final_oposiciones"],
        ["abandon_salaried", "illus_final_asalariado"],
        ["abandon_subsidies", "illus_final_subsidios"],
        ["retired_hero", "illus_final_heroe"],
        ["retired_rich", "illus_final_ricachon"],
      ];

      expect(Object.keys(ENDING_ILLUSTRATION_IDS)).toHaveLength(8);
      for (const [endingId, expectedAssetId] of expectedPairs) {
        const resolved = resolveEndingIllustrationAsset(manifest, endingId);
        expect(resolved).not.toBeNull();
        expect(resolved?.id).toBe(expectedAssetId);
        expect(resolveEndingIllustrationAsset(minimalManifest, endingId)).toBeNull();
      }

      expect(resolveEndingIllustrationAsset(manifest, null)).toBeNull();
    });
  });
});
