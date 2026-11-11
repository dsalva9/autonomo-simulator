import type {
  AssetEntry,
  AssetManifest,
  CompiledContentBundle,
  EventCategory,
} from "../../engine/index.ts";
import rawBundle from "../../generated/content-bundle.json";

export const compiledCatalog = rawBundle as unknown as CompiledContentBundle;

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
): (AssetEntry & { id: string; url: string }) | null {
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
): {
  id: string;
  url: string;
  width: number;
  height: number;
  render_mode: AssetEntry["render_mode"];
  status: AssetEntry["status"];
} {
  const fallbackPath = manifest.fallbacks[category];
  const matchedEntry = Object.entries(manifest.assets).find(
    ([, asset]) => asset.path === fallbackPath,
  );
  if (matchedEntry) {
    const [id, asset] = matchedEntry;
    return {
      id,
      url: normalizeAssetUrl(asset.path),
      width: asset.width,
      height: asset.height,
      render_mode: asset.render_mode,
      status: asset.status,
    };
  }
  return {
    id: `fallback_${category}`,
    url: normalizeAssetUrl(fallbackPath),
    width: 512,
    height: 320,
    render_mode: manifest.default_render_mode,
    status: "placeholder",
  };
}
