import { Briefcase, Heart, ShieldCheck, Users } from "lucide-react";
import type { GameState, RenderMode } from "../../engine/index.ts";
import { compiledCatalog, resolveCharacterPortraitAsset } from "../../services/content/catalog.ts";
import {
  formatEuros,
  translateCharacterName,
  translateEmployeeRoleLabel,
  translateFamilyStatus,
  translateGestorTier,
} from "../../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../../services/i18n/uiStrings.ts";
import { useGameStore } from "../../store/gameStore.ts";

export interface EntornoPanelProps {
  state: GameState;
  locale?: string;
}

function renderModeClass(mode: RenderMode): string {
  return mode === "pixel_art" ? "render-pixel-art" : "render-vector-hd";
}

export function EntornoPanel({ state, locale: localeProp }: EntornoPanelProps) {
  const storeLocale = useGameStore((s) => s.profile.settings.locale);
  const locale = localeProp ?? storeLocale;
  const ui = getUiStrings(locale);
  const { characters, manifest } = compiledCatalog;

  const gestorChar = state.gestor.character_id ? characters[state.gestor.character_id] : undefined;
  const gestorName = gestorChar ? translateCharacterName(gestorChar, locale) : undefined;
  const gestorPortrait = resolveCharacterPortraitAsset(manifest, gestorChar);

  const partnerChar = state.family.partner_character_id
    ? characters[state.family.partner_character_id]
    : undefined;
  const partnerName = partnerChar ? translateCharacterName(partnerChar, locale) : undefined;
  const partnerPortrait = resolveCharacterPortraitAsset(manifest, partnerChar);

  const employeeChar = state.employee ? characters[state.employee.character_id] : undefined;
  const employeeName = employeeChar ? translateCharacterName(employeeChar, locale) : undefined;
  const employeePortrait = resolveCharacterPortraitAsset(manifest, employeeChar);
  const employeeRoleLabel = state.employee
    ? translateEmployeeRoleLabel(state.employee.role_label, locale)
    : "";

  return (
    <section
      data-testid="panel-entorno"
      aria-label={ui.entorno.sectionAria}
      className="paper-dossier rounded-xl overflow-hidden bg-[#fffdf8]"
    >
      <div className="dossier-header">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-4 h-4 text-[#264e7a] shrink-0" aria-hidden="true" />
          <h2 className="font-editorial font-bold text-base text-[#1f2421] truncate">
            {ui.entorno.heading}
          </h2>
        </div>
        <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#efe4ce] text-[#373f3a] shrink-0">
          {ui.entorno.badge}
        </span>
      </div>

      <div className="divide-y divide-[#1f2421]/14">
        {/* Row 1: Gestoría */}
        <div className="px-3 py-2 flex items-center gap-2.5">
          <div className="w-10 shrink-0 flex items-center justify-center">
            {gestorPortrait ? (
              <div
                data-testid="entorno-polaroid-gestor"
                className="polaroid-card p-0.5 pb-1 rounded-[3px]"
              >
                <span className="polaroid-pin polaroid-pin-sm" aria-hidden="true" />
                <img
                  src={gestorPortrait.url}
                  alt={gestorName ?? ui.entorno.gestorFallbackAlt}
                  width={gestorPortrait.width}
                  height={gestorPortrait.height}
                  decoding="async"
                  className={`w-8 h-8 aspect-square object-cover border border-[#1f2421]/35 bg-[#f6efe0] ${renderModeClass(
                    gestorPortrait.render_mode,
                  )}`}
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-lg border border-[#1f2421]/25 bg-[#f6efe0] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-[#8f510d]" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-xs space-y-0.5">
            <div className="stamp-badge text-[10px] text-[#8f510d] leading-none">
              {ui.entorno.gestorHeader}
            </div>
            <p className="font-bold text-[#1f2421] truncate">
              {gestorName ?? translateGestorTier(state.gestor.tier, locale)}
            </p>
            <p className="font-bureau text-[11px] text-[#4a524e] tabular-nums truncate">
              {formatEuros(state.gestor.monthly_fee, locale)}
              {ui.entorno.perMonth} ·{" "}
              {ui.entorno.shieldPct(Math.round(state.gestor.inspection_shield * 100))}
            </p>
          </div>
        </div>

        {/* Row 2: Familia / Pareja */}
        <div className="px-3 py-2 flex items-center gap-2.5">
          <div className="w-10 shrink-0 flex items-center justify-center">
            {partnerPortrait ? (
              <div
                data-testid="entorno-polaroid-partner"
                className="polaroid-card p-0.5 pb-1 rounded-[3px]"
              >
                <span className="polaroid-pin polaroid-pin-sm" aria-hidden="true" />
                <img
                  src={partnerPortrait.url}
                  alt={partnerName ?? ui.entorno.partnerFallbackAlt}
                  width={partnerPortrait.width}
                  height={partnerPortrait.height}
                  decoding="async"
                  className={`w-8 h-8 aspect-square object-cover border border-[#1f2421]/35 bg-[#f6efe0] ${renderModeClass(
                    partnerPortrait.render_mode,
                  )}`}
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-lg border border-[#1f2421]/25 bg-[#f6efe0] flex items-center justify-center">
                <Heart className="w-4 h-4 text-[#b42b24]" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-xs space-y-0.5">
            <div className="stamp-badge text-[10px] text-[#b42b24] leading-none">
              {ui.entorno.personalLifeHeader}
            </div>
            <p className="font-bold text-[#1f2421] truncate">
              {translateFamilyStatus(state.family.status, locale)}
              {partnerName ? ` · ${partnerName}` : ""}
            </p>
            <p className="font-bureau text-[11px] text-[#4a524e] tabular-nums truncate">
              {ui.entorno.childrenAndCost(
                state.family.children_count,
                formatEuros(state.family.monthly_cost, locale),
              )}
            </p>
          </div>
        </div>

        {/* Row 3: Empleado (max 1) */}
        <div className="px-3 py-2 flex items-center gap-2.5">
          <div className="w-10 shrink-0 flex items-center justify-center">
            {state.employee && employeePortrait ? (
              <div
                data-testid="entorno-polaroid-employee"
                className="polaroid-card p-0.5 pb-1 rounded-[3px]"
              >
                <span className="polaroid-pin polaroid-pin-sm" aria-hidden="true" />
                <img
                  src={employeePortrait.url}
                  alt={employeeName ?? employeeRoleLabel}
                  width={employeePortrait.width}
                  height={employeePortrait.height}
                  decoding="async"
                  className={`w-8 h-8 aspect-square object-cover border border-[#1f2421]/35 bg-[#f6efe0] ${renderModeClass(
                    employeePortrait.render_mode,
                  )}`}
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-lg border border-[#1f2421]/25 bg-[#f6efe0] flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-[#1f5c53]" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-xs space-y-0.5">
            <div className="stamp-badge text-[10px] text-[#1f5c53] leading-none">
              {ui.entorno.staffHeader}
            </div>
            {state.employee ? (
              <>
                <p className="font-bold text-[#1f2421] truncate">
                  {employeeName ? `${employeeName} · ` : ""}
                  {employeeRoleLabel}
                </p>
                <p className="font-bureau text-[11px] text-[#4a524e] tabular-nums truncate">
                  {formatEuros(state.employee.monthly_cost, locale)}
                  {ui.entorno.perMonth} ·{" "}
                  {ui.entorno.billingMultiplier(state.employee.billing_multiplier)}
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-[#1f2421] truncate">{ui.entorno.noEmployeesTitle}</p>
                <p className="text-[11px] text-[#4a524e] truncate">{ui.entorno.noEmployeesSub}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
