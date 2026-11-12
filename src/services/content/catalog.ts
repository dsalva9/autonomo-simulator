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
import compiledLocales from "../../content/compiled-locales.json";
import rawBundle from "../../generated/content-bundle.json";
import { registerLocaleOverlay } from "../i18n/resolveEventText.ts";

export const compiledCatalog = rawBundle as unknown as CompiledContentBundle;

const enOverlay = (compiledLocales as Record<string, Record<string, string>>).en;
if (enOverlay) {
  registerLocaleOverlay("en", enOverlay, { persistent: true });
}

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
  state: Pick<GameState, "indicators" | "employee"> & {
    flags?: GameState["flags"];
  },
): ResolvedAsset | null {
  let targetId = "bg_despacho_base";

  if (state.indicators.stress >= 75) {
    targetId = "bg_despacho_burnout";
  } else if (state.indicators.money < 0) {
    targetId = "bg_despacho_numeros_rojos";
  } else if (
    state.employee !== null ||
    Boolean(state.flags?.estudio_propio_activo) ||
    (state.indicators.reputation >= 75 && state.indicators.money >= 18_000) ||
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

const FAMILIA_TENSION_TAGS = new Set([
  "urgencias",
  "averia",
  "agotamiento",
  "crisis_familiar",
  "gastos_imprevistos",
  "mudanza",
]);

const EMPLEADOS_TENSION_TAGS = new Set([
  "conflicto_laboral",
  "conflicto",
  "despido",
  "baja_medica",
  "incendio",
  "pico_trabajo",
  "inspeccion",
]);

const GESTOR_URGENCIA_TAGS = new Set([
  "chapuza",
  "chapuza_digital",
  "excel",
  "clave_pin",
  "certificado_digital",
  "requerimiento",
  "contraste_censal",
]);

function hasMatchingTag(tags: readonly string[] | undefined, targetSet: ReadonlySet<string>): boolean {
  if (!tags) {
    return false;
  }
  return tags.some((tag) => targetSet.has(tag));
}

export function resolveEventBannerAsset(
  manifest: AssetManifest,
  event: Pick<EventDef, "category" | "illustration_id" | "character_expression"> & {
    tags?: readonly string[];
  },
  state: Pick<GameState, "indicators" | "fiscal_risk" | "flags">,
): EventBannerResolution {
  if (event.illustration_id) {
    const milestoneAsset = resolveManifestAsset(manifest, event.illustration_id);
    if (milestoneAsset) {
      return { asset: milestoneAsset, kind: "milestone" };
    }
  }

  const baseBannerId = `banner_${event.category}_base`;
  let bannerId: string;
  switch (event.category) {
    case "clientes": {
      const isTense =
        event.character_expression === "angry" ||
        event.character_expression === "stressed" ||
        state.indicators.money < 0;
      bannerId = isTense ? "banner_clientes_tension" : baseBannerId;
      break;
    }
    case "hacienda": {
      const isInspection =
        state.fiscal_risk >= 40 ||
        Boolean(state.flags.inspeccion_en_curso) ||
        event.character_expression === "angry";
      bannerId = isInspection ? "banner_hacienda_inspeccion" : baseBannerId;
      break;
    }
    case "familia": {
      const isTense =
        event.character_expression === "angry" ||
        event.character_expression === "stressed" ||
        state.indicators.stress >= 70 ||
        state.indicators.personal_life <= 30 ||
        hasMatchingTag(event.tags, FAMILIA_TENSION_TAGS);
      bannerId = isTense ? "banner_familia_tension" : baseBannerId;
      break;
    }
    case "empleados": {
      const isTense =
        event.character_expression === "angry" ||
        event.character_expression === "stressed" ||
        Boolean(state.flags.desgaste_plantilla) ||
        state.indicators.stress >= 70 ||
        hasMatchingTag(event.tags, EMPLEADOS_TENSION_TAGS);
      bannerId = isTense ? "banner_empleados_tension" : baseBannerId;
      break;
    }
    case "gestor": {
      const isUrgent =
        event.character_expression === "angry" ||
        event.character_expression === "stressed" ||
        state.fiscal_risk >= 40 ||
        Boolean(state.flags.inspeccion_en_curso) ||
        Boolean(state.flags.certificado_digital_caducado) ||
        hasMatchingTag(event.tags, GESTOR_URGENCIA_TAGS);
      bannerId = isUrgent ? "banner_gestor_urgencia" : baseBannerId;
      break;
    }
  }

  const bannerAsset =
    resolveManifestAsset(manifest, bannerId) ??
    resolveManifestAsset(manifest, baseBannerId) ??
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
