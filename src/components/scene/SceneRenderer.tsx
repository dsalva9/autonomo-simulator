import { LampDesk } from "lucide-react";
import type { SyntheticEvent } from "react";
import type {
  CharacterDef,
  EventCategory,
  EventDef,
  GameState,
  RenderMode,
} from "../../engine/index.ts";
import {
  compiledCatalog,
  resolveCategoryFallbackAsset,
  resolveCharacterPortraitAsset,
  resolveDeskBackgroundAsset,
  resolveManifestAsset,
} from "../../services/content/catalog.ts";
import {
  translateCategoryLabel,
  translateCharacterName,
  translateCharacterRole,
} from "../../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../../services/i18n/uiStrings.ts";
import { useGameStore } from "../../store/gameStore.ts";

export interface SceneRendererProps {
  state: GameState;
  activeEvent: EventDef | null;
  locale?: string;
}

function renderModeClass(mode: RenderMode): string {
  return mode === "pixel_art" ? "render-pixel-art" : "render-vector-hd";
}

function resolveSceneCharacterRoleLabel(role: CharacterDef["role"], locale: string): string {
  const ui = getUiStrings(locale);
  if (role === "hacienda") {
    return ui.scene.roleTaxAgency;
  }
  if (role === "pareja") {
    return ui.scene.rolePersonalBond;
  }
  return translateCharacterRole(role, locale);
}

export function SceneRenderer({ state, activeEvent, locale: localeProp }: SceneRendererProps) {
  const storeLocale = useGameStore((s) => s.profile.settings.locale);
  const locale = localeProp ?? storeLocale;
  const ui = getUiStrings(locale);
  const { manifest, characters } = compiledCatalog;

  const bgAsset = resolveDeskBackgroundAsset(manifest, state);
  const showCafe = state.indicators.stress >= 50;
  const showFacturas = state.finances.accrued_tax_liability >= 1200;
  const showNumerosRojos = state.indicators.money < 0;
  const showFamilia = state.family.status !== "single";

  const cafeAsset = showCafe ? resolveManifestAsset(manifest, "prop_cafe") : null;
  const facturasAsset = showFacturas ? resolveManifestAsset(manifest, "prop_facturas") : null;
  const numerosRojosAsset = showNumerosRojos
    ? resolveManifestAsset(manifest, "prop_numeros_rojos")
    : null;
  const familiaAsset = showFamilia ? resolveManifestAsset(manifest, "prop_foto_familia") : null;

  const character: CharacterDef | undefined = activeEvent?.character_id
    ? characters[activeEvent.character_id]
    : undefined;

  const portraitAsset = resolveCharacterPortraitAsset(
    manifest,
    character,
    activeEvent?.character_expression,
  );

  const bespokeIllustration = activeEvent?.illustration_id
    ? resolveManifestAsset(manifest, activeEvent.illustration_id)
    : null;

  const fallbackCategory: EventCategory =
    activeEvent?.category ?? (state.phase === "quarterly_tax" ? "hacienda" : "clientes");
  const fallbackAsset = resolveCategoryFallbackAsset(manifest, fallbackCategory);

  const subjectArt = portraitAsset ?? bespokeIllustration ?? fallbackAsset;
  const subjectLabel = character
    ? translateCharacterName(character, locale)
    : translateCategoryLabel(fallbackCategory, locale);
  const subjectSubLabel = character
    ? resolveSceneCharacterRoleLabel(character.role, locale)
    : ui.scene.dossierOnDesk;

  const isBurnoutDesk = bgAsset?.id === "bg_despacho_burnout";
  const deskStatusLabel = isBurnoutDesk
    ? ui.scene.statusAtLimit
    : showNumerosRojos
      ? ui.scene.statusOverdraft
      : showCafe
        ? ui.scene.statusUnderPressure
        : ui.scene.statusOperational;

  const deskStatusTone =
    isBurnoutDesk || showNumerosRojos
      ? "bg-[#fdf0ef] text-[#9e221b] border border-[#9e221b]/35"
      : showCafe
        ? "bg-[#fcf4df] text-[#7a4308] border border-[#7a4308]/35"
        : "bg-[#efe4ce] text-[#373f3a]";

  const handleFallbackArtError = (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.src !== fallbackAsset.url && !img.dataset.fallbackApplied) {
      img.dataset.fallbackApplied = "true";
      img.src = fallbackAsset.url;
    }
  };

  return (
    <section
      data-testid="scene-renderer"
      aria-label={ui.scene.sectionAria}
      className="paper-dossier rounded-xl overflow-hidden bg-[#fffdf8]"
    >
      {/* Standardized Desktop Dossier Header (>= 1280px) */}
      <div className="hidden xl:flex dossier-header">
        <div className="flex items-center gap-2 min-w-0">
          <LampDesk className="w-4 h-4 text-[#7a4308] shrink-0" aria-hidden="true" />
          <h2 className="font-editorial font-bold text-base text-[#1f2421] truncate">
            {ui.scene.heading}
          </h2>
        </div>
        <span className={`stamp-badge text-[10px] px-2 py-0.5 rounded shrink-0 ${deskStatusTone}`}>
          {deskStatusLabel}
        </span>
      </div>

      {/* Panoramic Desk Stage: clean unobstructed art with 4 non-overlapping prop slots */}
      <div className="scene-stage-frame relative w-full h-20 sm:h-28 overflow-hidden border-b border-[#1f2421]/18 bg-[#e9decb]">
        {bgAsset && (
          <img
            data-testid="scene-bg"
            data-asset-id={bgAsset.id}
            src={bgAsset.url}
            alt={ui.scene.deskAlt}
            width={bgAsset.width}
            height={bgAsset.height}
            decoding="async"
            onError={handleFallbackArtError}
            className={`w-full h-full object-cover object-[center_62%] ${renderModeClass(bgAsset.render_mode)}`}
          />
        )}

        {/* Slot 1 (Top-Left): Números Rojos Stamp when Money < 0 */}
        {numerosRojosAsset && (
          <img
            data-testid="scene-prop-numeros-rojos"
            src={numerosRojosAsset.url}
            alt={ui.scene.propOverdraftAlt}
            width={numerosRojosAsset.width}
            height={numerosRojosAsset.height}
            decoding="async"
            className={`absolute top-1.5 left-2 w-11 h-11 sm:w-14 sm:h-14 xl:w-16 xl:h-16 pointer-events-none ${renderModeClass(numerosRojosAsset.render_mode)}`}
          />
        )}

        {/* Slot 2 (Bottom-Left): Accrued Tax Stack (Modelo 303) when >= 1,200 € */}
        {facturasAsset && (
          <img
            data-testid="scene-prop-facturas"
            src={facturasAsset.url}
            alt={ui.scene.propInvoicesAlt}
            width={facturasAsset.width}
            height={facturasAsset.height}
            decoding="async"
            className={`absolute bottom-1 left-2.5 w-11 h-11 sm:w-14 sm:h-14 xl:w-16 xl:h-16 drop-shadow-sm pointer-events-none ${renderModeClass(facturasAsset.render_mode)}`}
          />
        )}

        {/* Slot 3 (Bottom-Center-Right): Family Photo Frame when family.status !== "single" */}
        {familiaAsset && (
          <img
            data-testid="scene-prop-familia"
            src={familiaAsset.url}
            alt={ui.scene.propFamilyAlt}
            width={familiaAsset.width}
            height={familiaAsset.height}
            decoding="async"
            className={`absolute bottom-1 right-[24%] w-10 h-10 sm:w-13 sm:h-13 xl:w-14 xl:h-14 drop-shadow-sm pointer-events-none ${renderModeClass(familiaAsset.render_mode)}`}
          />
        )}

        {/* Slot 4 (Bottom-Right): Survival Coffee Mug when Stress >= 50 */}
        {cafeAsset && (
          <img
            data-testid="scene-prop-cafe"
            src={cafeAsset.url}
            alt={ui.scene.propCoffeeAlt}
            width={cafeAsset.width}
            height={cafeAsset.height}
            decoding="async"
            className={`absolute bottom-1 right-2.5 w-10 h-10 sm:w-13 sm:h-13 xl:w-14 xl:h-14 drop-shadow-sm pointer-events-none ${renderModeClass(cafeAsset.render_mode)}`}
          />
        )}
      </div>

      {/* Mobile / Tablet Slim 1-Line Subject Strip (< 1280px) — Zero Desk Art Occlusion */}
      <div className="xl:hidden px-3 py-1 bg-[#fffdf8] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img
            data-testid="scene-subject-mobile-art"
            data-asset-id={subjectArt.id}
            src={subjectArt.url}
            alt={subjectLabel}
            width={subjectArt.width}
            height={subjectArt.height}
            decoding="async"
            onError={handleFallbackArtError}
            className={`w-6 h-6 rounded object-cover shrink-0 border border-[#1f2421]/35 bg-[#f6efe0] ${renderModeClass(subjectArt.render_mode)}`}
          />
          <p className="text-xs font-bold text-[#1f2421] truncate">{subjectLabel}</p>
        </div>

        <span className="stamp-badge inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#f6efe0] text-[#7a4308] border border-[#1f2421]/18 shrink-0">
          <img
            src={fallbackAsset.url}
            alt=""
            aria-hidden="true"
            width={12}
            height={12}
            decoding="async"
            className="w-3 h-3 rounded-xs object-cover shrink-0"
          />
          {subjectSubLabel}
        </span>
      </div>

      {/* Desktop Compact Interlocutor Footer (>= 1280px) */}
      <div className="scene-interlocutor-footer hidden xl:flex items-center gap-2.5 px-3 py-2 bg-[#fffdf8]">
        <img
          data-testid="scene-subject-art"
          data-asset-id={subjectArt.id}
          src={subjectArt.url}
          alt={subjectLabel}
          width={subjectArt.width}
          height={subjectArt.height}
          decoding="async"
          onError={handleFallbackArtError}
          className={`w-9 h-9 rounded-lg object-cover shrink-0 border border-[#1f2421]/60 bg-[#f6efe0] ${renderModeClass(subjectArt.render_mode)}`}
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="stamp-badge inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#efe4ce] text-[#373f3a]">
              <img
                data-testid="scene-category-stamp"
                src={fallbackAsset.url}
                alt=""
                aria-hidden="true"
                width={12}
                height={12}
                decoding="async"
                className="w-3 h-3 rounded-xs object-cover shrink-0"
              />
              {subjectSubLabel}
            </span>
            {showCafe && (
              <span className="stamp-badge text-[10px] px-1.5 py-0.5 rounded bg-[#fcf4df] text-[#7a4308]">
                {ui.scene.caffeineActive}
              </span>
            )}
          </div>
          <p className="font-editorial font-bold text-xs text-[#1f2421] truncate">{subjectLabel}</p>
        </div>
      </div>
    </section>
  );
}
