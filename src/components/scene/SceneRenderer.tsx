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
import { translateCategoryLabel } from "../../services/i18n/resolveEventText.ts";

export interface SceneRendererProps {
  state: GameState;
  activeEvent: EventDef | null;
}

function renderModeClass(mode: RenderMode): string {
  return mode === "pixel_art" ? "render-pixel-art" : "render-vector-hd";
}

function translateCharacterRoleEs(role: CharacterDef["role"]): string {
  switch (role) {
    case "cliente":
      return "Cliente";
    case "hacienda":
      return "Agencia Tributaria";
    case "gestor":
      return "Gestoría";
    case "pareja":
      return "Vínculo personal";
    case "empleado":
      return "Plantilla";
  }
}

export function SceneRenderer({ state, activeEvent }: SceneRendererProps) {
  const { manifest, characters } = compiledCatalog;

  const bgAsset = resolveDeskBackgroundAsset(manifest, state);
  const showCafe = state.indicators.stress >= 50;
  const showFacturas = state.finances.accrued_tax_liability > 0;
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
  const subjectLabel = character ? character.name : translateCategoryLabel(fallbackCategory);
  const subjectSubLabel = character
    ? translateCharacterRoleEs(character.role)
    : "Expediente en mesa";

  return (
    <section
      data-testid="scene-renderer"
      aria-label="Escena del despacho"
      className="paper-dossier rounded-xl overflow-hidden bg-[#f3e8d5]"
    >
      {/* Office Desk Stage: compact strip on mobile, full 16:9 window on desktop */}
      <div className="relative w-full h-32 sm:h-40 lg:h-auto lg:aspect-video overflow-hidden border-b-2 border-[#1f2421] bg-[#e9decb]">
        {bgAsset && (
          <img
            data-testid="scene-bg"
            data-asset-id={bgAsset.id}
            src={bgAsset.url}
            alt="Despacho de autónomo"
            width={bgAsset.width}
            height={bgAsset.height}
            decoding="async"
            className={`w-full h-full object-cover object-bottom ${renderModeClass(bgAsset.render_mode)}`}
          />
        )}

        {/* Reactive Prop: Accrued Tax Stack (Modelo 303) */}
        {facturasAsset && (
          <img
            data-testid="scene-prop-facturas"
            src={facturasAsset.url}
            alt="Facturas pendientes del trimestre"
            width={facturasAsset.width}
            height={facturasAsset.height}
            decoding="async"
            className={`absolute bottom-1 left-2 w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 drop-shadow-sm pointer-events-none ${renderModeClass(facturasAsset.render_mode)}`}
          />
        )}

        {/* Reactive Prop: Family Photo Frame when family.status !== "single" */}
        {familiaAsset && (
          <img
            data-testid="scene-prop-familia"
            src={familiaAsset.url}
            alt="Fotografía familiar sobre el escritorio"
            width={familiaAsset.width}
            height={familiaAsset.height}
            decoding="async"
            className={`absolute bottom-1 left-16 sm:left-24 lg:left-auto lg:right-2 w-12 h-12 sm:w-14 sm:h-14 lg:w-20 lg:h-20 drop-shadow-sm pointer-events-none ${renderModeClass(familiaAsset.render_mode)}`}
          />
        )}

        {/* Reactive Prop: Survival Coffee Mug when Stress >= 50 */}
        {cafeAsset && (
          <img
            data-testid="scene-prop-cafe"
            src={cafeAsset.url}
            alt="Taza de café por estrés elevado"
            width={cafeAsset.width}
            height={cafeAsset.height}
            decoding="async"
            className={`absolute bottom-1 right-28 lg:right-20 w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 drop-shadow-sm pointer-events-none ${renderModeClass(cafeAsset.render_mode)}`}
          />
        )}

        {/* Reactive Prop: Números Rojos Stamp when Money < 0 */}
        {numerosRojosAsset && (
          <img
            data-testid="scene-prop-numeros-rojos"
            src={numerosRojosAsset.url}
            alt="Aviso bancario de números rojos"
            width={numerosRojosAsset.width}
            height={numerosRojosAsset.height}
            decoding="async"
            className={`absolute top-1.5 left-2 w-20 h-20 lg:w-28 lg:h-28 pointer-events-none ${renderModeClass(numerosRojosAsset.render_mode)}`}
          />
        )}

        {/* Mobile Docked Subject Portrait / Category Card */}
        <div className="lg:hidden absolute inset-y-1.5 right-2 flex items-center gap-2 bg-[#fffdf8]/95 border-2 border-[#1f2421] rounded-lg p-1.5 shadow-sm max-w-[54%]">
          <img
            data-testid="scene-subject-mobile-art"
            data-asset-id={subjectArt.id}
            src={subjectArt.url}
            alt={subjectLabel}
            width={subjectArt.width}
            height={subjectArt.height}
            decoding="async"
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded object-cover shrink-0 border border-[#1f2421]/30 ${renderModeClass(subjectArt.render_mode)}`}
          />
          <div className="min-w-0 pr-1">
            <p className="stamp-badge text-[10px] text-[#8f510d] truncate">{subjectSubLabel}</p>
            <p className="text-xs font-bold text-[#1f2421] leading-tight line-clamp-2">
              {subjectLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Desktop Interlocutor / Category Dossier Footer */}
      <div className="hidden lg:flex items-center gap-3.5 p-3.5 bg-[#fffdf8]">
        <img
          data-testid="scene-subject-art"
          data-asset-id={subjectArt.id}
          src={subjectArt.url}
          alt={subjectLabel}
          width={subjectArt.width}
          height={subjectArt.height}
          decoding="async"
          className={`w-20 h-20 rounded-lg object-cover shrink-0 border-2 border-[#1f2421] bg-[#f6efe0] ${renderModeClass(subjectArt.render_mode)}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="stamp-badge text-[11px] px-2 py-0.5 rounded bg-[#efe4ce] text-[#1f2421] border border-[#1f2421]/40">
              {subjectSubLabel}
            </span>
            {showCafe && (
              <span className="stamp-badge text-[10px] px-1.5 py-0.5 rounded bg-[#fcf4df] text-[#8f510d]">
                Cafeína activa
              </span>
            )}
          </div>
          <h2 className="mt-1 font-editorial font-bold text-base text-[#1f2421] truncate">
            {subjectLabel}
          </h2>
          {character ? (
            <p className="mt-0.5 text-xs text-[#4a524e] line-clamp-2 leading-relaxed">
              {character.bio}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-[#4a524e] leading-relaxed">
              Mesa de trabajo · Mes {state.month} de actividad en el RETA.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
