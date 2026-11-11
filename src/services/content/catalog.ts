import type {
  AssetEntry,
  AssetManifest,
  CharacterDef,
  CharacterExpression,
  CompiledContentBundle,
  EndingId,
  EventCategory,
  EventDef,
  GameState,
} from "../../engine/index.ts";
import rawBundle from "../../generated/content-bundle.json";

export const compiledCatalog = rawBundle as unknown as CompiledContentBundle;

export type ResolvedAsset = AssetEntry & {
  id: string;
  url: string;
};

export interface EventBannerResolution {
  asset: ResolvedAsset;
  kind: "milestone" | "banner";
}

export const ENDING_ILLUSTRATION_IDS: Record<EndingId, string> = {
  defeat_bankruptcy: "illus_final_bancarrota",
  defeat_burnout_stress: "illus_final_ansiedad",
  defeat_resignation_moral: "illus_final_desmotivacion",
  abandon_oposiciones: "illus_final_oposiciones",
  abandon_salaried: "illus_final_asalariado",
  abandon_subsidies: "illus_final_subsidios",
  retired_hero: "illus_final_heroe",
  retired_rich: "illus_final_ricachon",
};

export function normalizeAssetUrl(relativeAssetPath: string): string {
  const trimmed = relativeAssetPath
    .trim()
    .replace(/^\.?\//, "")
    .replace(/^assets\//, "");
  return `./assets/${trimmed}`;
}

export function resolveManifestAsset(
  manifest: AssetManifest,
  assetId: string | null | undefined,
): ResolvedAsset | null {
  if (!assetId) {
    return null;
  }
  const entry = manifest.assets[assetId];
  if (!entry) {
    return null;
  }
  return {
    ...entry,
    id: assetId,
    url: normalizeAssetUrl(entry.path),
  };
}

export function resolveCategoryFallbackAsset(
  manifest: AssetManifest,
  category: EventCategory,
): ResolvedAsset {
  const fallbackPath = manifest.fallbacks[category];
  const matchedEntry = Object.entries(manifest.assets).find(
    ([, asset]) => asset.path === fallbackPath,
  );
  if (matchedEntry) {
    const [id, asset] = matchedEntry;
    return {
      ...asset,
      id,
      url: normalizeAssetUrl(asset.path),
    };
  }
  return {
    id: `fallback_${category}`,
    path: fallbackPath,
    url: normalizeAssetUrl(fallbackPath),
    category: "ui",
    width: 512,
    height: 320,
    render_mode: manifest.default_render_mode,
    status: "placeholder",
  };
}

export function resolveDeskBackgroundAsset(
  manifest: AssetManifest,
  state: Pick<GameState, "indicators" | "employee">,
): ResolvedAsset | null {
  let targetId = "bg_despacho_base";

  if (state.indicators.stress >= 75) {
    targetId = "bg_despacho_burnout";
  } else if (state.indicators.money < 0) {
    targetId = "bg_despacho_numeros_rojos";
  } else if (
    state.employee !== null ||
    (state.indicators.money >= 25_000 && state.indicators.reputation >= 65)
  ) {
    targetId = "bg_despacho_estudio";
  }

  return (
    resolveManifestAsset(manifest, targetId) ?? resolveManifestAsset(manifest, "bg_despacho_base")
  );
}

export function resolveCharacterPortraitAsset(
  manifest: AssetManifest,
  character: Pick<CharacterDef, "portrait_asset_id" | "expressions"> | null | undefined,
  expression?: CharacterExpression | null,
): ResolvedAsset | null {
  if (!character) {
    return null;
  }

  const expr: CharacterExpression = expression ?? "neutral";
  const candidateIds = [
    character.expressions?.[expr],
    character.expressions?.neutral,
    character.portrait_asset_id,
  ];

  for (const candidateId of candidateIds) {
    const resolved = resolveManifestAsset(manifest, candidateId);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

export function resolveEventBannerAsset(
  manifest: AssetManifest,
  event: Pick<EventDef, "category" | "illustration_id" | "character_expression">,
  state: Pick<GameState, "indicators" | "fiscal_risk" | "flags">,
): EventBannerResolution {
  if (event.illustration_id) {
    const milestoneAsset = resolveManifestAsset(manifest, event.illustration_id);
    if (milestoneAsset) {
      return { asset: milestoneAsset, kind: "milestone" };
    }
  }

  let bannerId: string;
  switch (event.category) {
    case "clientes": {
      const isTense =
        event.character_expression === "angry" ||
        event.character_expression === "stressed" ||
        state.indicators.money < 0;
      bannerId = isTense ? "banner_clientes_tension" : "banner_clientes_base";
      break;
    }
    case "hacienda": {
      const isInspection =
        state.fiscal_risk >= 40 ||
        Boolean(state.flags.inspeccion_en_curso) ||
        event.character_expression === "angry";
      bannerId = isInspection ? "banner_hacienda_inspeccion" : "banner_hacienda_base";
      break;
    }
    case "familia":
      bannerId = "banner_familia_base";
      break;
    case "empleados":
      bannerId = "banner_empleados_base";
      break;
    case "gestor":
      bannerId = "banner_gestor_base";
      break;
  }

  const bannerAsset =
    resolveManifestAsset(manifest, bannerId) ??
    resolveCategoryFallbackAsset(manifest, event.category);

  return { asset: bannerAsset, kind: "banner" };
}

export function resolveEndingIllustrationAsset(
  manifest: AssetManifest,
  endingId: EndingId | null | undefined,
): ResolvedAsset | null {
  if (!endingId) {
    return null;
  }
  const assetId = ENDING_ILLUSTRATION_IDS[endingId];
  return resolveManifestAsset(manifest, assetId);
}
