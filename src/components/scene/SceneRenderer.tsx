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
  normalizeLocale,
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
  embeddedInFolder?: boolean;
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

export function SceneRenderer({
  state,
  activeEvent,
  locale: localeProp,
  embeddedInFolder = false,
}: SceneRendererProps) {
  const storeLocale = useGameStore((s) => s.profile.settings.locale);
  const locale = localeProp ?? storeLocale;
  const isEn = normalizeLocale(locale) === "en";
  const ui = getUiStrings(locale);
  const { manifest, characters } = compiledCatalog;

  const bgAsset = resolveDeskBackgroundAsset(manifest, state);
  const showCafe = state.indicators.stress >= 50;
  const showFacturas = state.finances.accrued_tax_liability >= 1200;
  const showNumerosRojos = state.indicators.money < 0;
  const showFamilia =
    state.family.status === "dating" ||
    state.family.status === "cohabiting" ||
    state.family.children_count > 0;
  const hasStudioOrTeam = Boolean(
    state.employee || state.flags?.estudio_calle_alquilado || state.flags?.estudio_propio_activo,
  );
  const showHaciendaChip = state.fiscal_risk >= 25 || state.phase === "quarterly_tax";

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

  const activePropChips: { key: string; label: string; tone: string }[] = [];
  if (showNumerosRojos) {
    activePropChips.push({
      key: "overdraft",
      label: isEn ? "🚨 Overdraft" : "🚨 Números rojos",
      tone: "bg-[#fdf0ef] text-[#9e221b] border-[#9e221b]/40",
    });
  }
  if (showFacturas) {
    activePropChips.push({
      key: "facturas",
      label: isEn ? "📄 Invoices" : "📄 Facturas",
      tone: "bg-[#fcf4df] text-[#7a4308] border-[#7a4308]/35",
    });
  }
  if (showHaciendaChip) {
    activePropChips.push({
      key: "hacienda",
      label: isEn ? "📨 Tax Office" : "📨 Hacienda",
      tone: "bg-[#fdf0ef] text-[#9e221b] border-[#9e221b]/35",
    });
  }
  if (isBurnoutDesk) {
    activePropChips.push({
      key: "burnout",
      label: "🔥 Burnout",
      tone: "bg-[#fdf0ef] text-[#9e221b] border-[#9e221b]/40",
    });
  } else if (showCafe) {
    activePropChips.push({
      key: "cafe",
      label: isEn ? "☕ Double shift" : "☕ Doble jornada",
      tone: "bg-[#fcf4df] text-[#7a4308] border-[#7a4308]/35",
    });
  }
  if (hasStudioOrTeam) {
    activePropChips.push({
      key: "equipo",
      label: isEn ? "💻 Studio team" : "💻 Equipo",
      tone: "bg-[#e8f5f1] text-[#1f5c53] border-[#1f5c53]/40",
    });
  }
  if (showFamilia) {
    activePropChips.push({
      key: "familia",
      label: isEn ? "🖼️ Family" : "🖼️ Familia",
      tone: "bg-[#ebf2fa] text-[#264e7a] border-[#264e7a]/35",
    });
  }
  if (activePropChips.length === 0) {
    activePropChips.push({
      key: "calm",
      label: isEn ? "🪴 Desk in order" : "🪴 Mesa en orden",
      tone: "bg-[#efe4ce] text-[#373f3a] border-[#1f2421]/20",
    });
  }

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
      className={
        embeddedInFolder
          ? "shrink-0 border-b border-[#1f2421]/18 bg-[#fffdf8]"
          : "paper-dossier shrink-0 rounded-xl overflow-hidden bg-[#fffdf8]"
      }
    >
      {/* Dossier Header (shown on mobile Entorno showcase & standalone desktop Left column) */}
      {!embeddedInFolder ? (
        <div className="dossier-header">
          <div className="flex items-center gap-2 min-w-0">
            <LampDesk className="w-4 h-4 text-[#7a4308] shrink-0" aria-hidden="true" />
            <h2 className="font-editorial font-bold text-base text-[#1f2421] leading-tight">
              {ui.scene.heading}
            </h2>
          </div>
          <span
            className={`stamp-badge text-[10px] px-2 py-0.5 rounded shrink-0 ${deskStatusTone}`}
          >
            {deskStatusLabel}
          </span>
        </div>
      ) : (
        <h2 className="sr-only">{ui.scene.heading}</h2>
      )}

      {/* Panoramic Desk Stage: 4 horizontally distinct prop lanes so zero props overlap or clip */}
      <div className="scene-stage-frame relative w-full h-40 md:h-50 lg:h-36 overflow-hidden border-b border-[#1f2421]/18 bg-[#e9decb]">
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

        {/* Lane 1 (Top-Left): Números Rojos Stamp when Money < 0 */}
        {numerosRojosAsset && (
          <img
            data-testid="scene-prop-numeros-rojos"
            src={numerosRojosAsset.url}
            alt={ui.scene.propOverdraftAlt}
            width={numerosRojosAsset.width}
            height={numerosRojosAsset.height}
            decoding="async"
            className={`scene-prop-item absolute top-1 left-2 w-12 h-12 lg:w-12 lg:h-12 xl:w-13 xl:h-13 pointer-events-none ${renderModeClass(numerosRojosAsset.render_mode)}`}
          />
        )}

        {/* Lane 2 (Bottom-Center-Left): Accrued Tax Stack (Modelo 303) when >= 1,200 € */}
        {facturasAsset && (
          <img
            data-testid="scene-prop-facturas"
            src={facturasAsset.url}
            alt={ui.scene.propInvoicesAlt}
            width={facturasAsset.width}
            height={facturasAsset.height}
            decoding="async"
            className={`scene-prop-item absolute bottom-1 left-[27%] w-12 h-12 lg:w-12 lg:h-12 xl:w-13 xl:h-13 drop-shadow-sm pointer-events-none ${renderModeClass(facturasAsset.render_mode)}`}
          />
        )}

        {/* Lane 3 (Bottom-Center-Right): Family Photo Frame when dating / cohabiting / children > 0 */}
        {familiaAsset && (
          <img
            data-testid="scene-prop-familia"
            src={familiaAsset.url}
            alt={ui.scene.propFamilyAlt}
            width={familiaAsset.width}
            height={familiaAsset.height}
            decoding="async"
            className={`scene-prop-item absolute bottom-1 right-[27%] w-11 h-11 lg:w-11 lg:h-11 xl:w-12 xl:h-12 drop-shadow-sm pointer-events-none ${renderModeClass(familiaAsset.render_mode)}`}
          />
        )}

        {/* Lane 4 (Bottom-Right): Survival Coffee Mug when Stress >= 50 */}
        {cafeAsset && (
          <img
            data-testid="scene-prop-cafe"
            src={cafeAsset.url}
            alt={ui.scene.propCoffeeAlt}
            width={cafeAsset.width}
            height={cafeAsset.height}
            decoding="async"
            className={`scene-prop-item absolute bottom-1 right-2 w-11 h-11 lg:w-11 lg:h-11 xl:w-12 xl:h-12 drop-shadow-sm pointer-events-none ${renderModeClass(cafeAsset.render_mode)}`}
          />
        )}
      </div>

      {/* Mobile / Portrait-Tablet Showcase Footer (< 1024px): Subject + Active Desk-Prop Chips */}
      <div className="lg:hidden px-3 py-2 bg-[#fffdf8] space-y-1.5">
        <div className="flex items-center justify-between gap-2">
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
              className={`w-7 h-7 rounded object-cover shrink-0 border border-[#1f2421]/35 bg-[#f6efe0] ${renderModeClass(subjectArt.render_mode)}`}
            />
            <p className="text-xs font-bold text-[#1f2421] leading-snug break-words">
              {subjectLabel}
            </p>
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

        <div
          data-testid="scene-mobile-prop-chips"
          className="flex flex-wrap items-center gap-1 pt-0.5"
        >
          {activePropChips.map((chip) => (
            <span
              key={chip.key}
              className={`font-bureau text-[10px] font-bold leading-none px-1.5 py-1 rounded border ${chip.tone}`}
            >
              {chip.label}
            </span>
          ))}
        </div>
      </div>

      {/* Desktop Compact Interlocutor Footer (>= 1024px) */}
      <div className="scene-interlocutor-footer hidden lg:flex items-center gap-2.5 px-3 py-2 bg-[#fffdf8]">
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
          <p className="font-editorial font-bold text-xs text-[#1f2421] leading-snug break-words">
            {subjectLabel}
          </p>
        </div>
      </div>
    </section>
  );
}
