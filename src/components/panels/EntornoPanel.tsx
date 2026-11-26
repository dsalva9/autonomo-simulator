import { Briefcase, Heart, ShieldCheck, Target, Users } from "lucide-react";
import { type GameState, type RenderMode, resolvePartnerName } from "../../engine/index.ts";
import { compiledCatalog, resolveCharacterPortraitAsset } from "../../services/content/catalog.ts";
import {
  formatEuros,
  humanizeFlag,
  normalizeLocale,
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
  embeddedInFolder?: boolean;
  className?: string;
}

function renderModeClass(mode: RenderMode): string {
  return mode === "pixel_art" ? "render-pixel-art" : "render-vector-hd";
}

export function EntornoPanel({
  state,
  locale: localeProp,
  embeddedInFolder = false,
  className = "",
}: EntornoPanelProps) {
  const storeLocale = useGameStore((s) => s.profile.settings.locale);
  const locale = localeProp ?? storeLocale;
  const isEn = normalizeLocale(locale) === "en";
  const ui = getUiStrings(locale);
  const { characters, manifest } = compiledCatalog;

  const gestorChar = state.gestor.character_id ? characters[state.gestor.character_id] : undefined;
  const gestorName = gestorChar ? translateCharacterName(gestorChar, locale) : undefined;
  const gestorPortrait = resolveCharacterPortraitAsset(manifest, gestorChar);

  const partnerChar = state.family.partner_character_id
    ? characters[state.family.partner_character_id]
    : undefined;
  const partnerName = partnerChar
    ? translateCharacterName(partnerChar, locale, resolvePartnerName(state))
    : undefined;
  const partnerPortrait = resolveCharacterPortraitAsset(manifest, partnerChar);

  const employeeChar = state.employee ? characters[state.employee.character_id] : undefined;
  const employeeName = employeeChar ? translateCharacterName(employeeChar, locale) : undefined;
  const employeePortrait = resolveCharacterPortraitAsset(manifest, employeeChar);
  const employeeRoleLabel = state.employee
    ? translateEmployeeRoleLabel(state.employee.role_label, locale)
    : "";
  const employeeSatisfaction = state.employee
    ? Math.max(0, Math.min(100, Math.round(state.employee.satisfaction)))
    : 0;
  // Live satisfaction-scaled effective billing multiplier matching src/engine/economy.ts
  const effectiveEmployeeMultiplier = state.employee
    ? 1 + (state.employee.billing_multiplier - 1) * (0.4 + 0.8 * (employeeSatisfaction / 100))
    : 1;

  // Avoid redundant "Laura (Senior Specialist) · Senior Specialist" repetition when character name already embeds role
  const showEmployeeRoleSuffix =
    Boolean(employeeRoleLabel) &&
    (!employeeName || !employeeName.toLowerCase().includes(employeeRoleLabel.toLowerCase()));

  const empSatBarColor =
    employeeSatisfaction >= 65
      ? "bg-[#1f5c53]"
      : employeeSatisfaction >= 40
        ? "bg-[#c97a16]"
        : "bg-[#b42b24]";
  const empSatTextColor =
    employeeSatisfaction >= 65
      ? "text-[#1f5c53]"
      : employeeSatisfaction >= 40
        ? "text-[#7a4308]"
        : "text-[#9e221b]";

  const survivalTargetMonths = compiledCatalog.balance.victory_month;
  const wealthTargetMoney = compiledCatalog.balance.victory_money;
  const survivalPct = Math.min(100, Math.round((state.month / survivalTargetMonths) * 100));
  const wealthPct = Math.min(
    100,
    Math.max(0, Math.round((state.indicators.money / wealthTargetMoney) * 100)),
  );

  const statusChips: { key: string; label: string; tone: string }[] = [];
  if (state.indicators.money < 0) {
    statusChips.push({
      key: "overdraft",
      label: isEn ? "🚨 Overdraft" : "🚨 Números rojos",
      tone: "bg-[#fdf0ef] text-[#9e221b] border-[#9e221b]/40",
    });
  }
  if (state.finances.accrued_tax_liability >= 1200) {
    statusChips.push({
      key: "facturas",
      label: isEn ? "📄 Tax accrued" : "📄 Impuestos acum.",
      tone: "bg-[#fcf4df] text-[#7a4308] border-[#7a4308]/35",
    });
  }
  if (state.fiscal_risk >= 25 || state.phase === "quarterly_tax") {
    statusChips.push({
      key: "hacienda",
      label: isEn ? "📨 Tax Office alert" : "📨 Ojo con Hacienda",
      tone: "bg-[#fdf0ef] text-[#9e221b] border-[#9e221b]/35",
    });
  }
  if (state.indicators.stress >= 75) {
    statusChips.push({
      key: "burnout",
      label: "🔥 Burnout",
      tone: "bg-[#fdf0ef] text-[#9e221b] border-[#9e221b]/40",
    });
  } else if (state.indicators.stress >= 50) {
    statusChips.push({
      key: "cafe",
      label: isEn ? "☕ Double shift" : "☕ Doble jornada",
      tone: "bg-[#fcf4df] text-[#7a4308] border-[#7a4308]/35",
    });
  }
  if (
    state.employee ||
    state.flags?.estudio_calle_alquilado ||
    state.flags?.estudio_propio_activo
  ) {
    statusChips.push({
      key: "equipo",
      label: isEn ? "💻 Studio" : "💻 Estudio",
      tone: "bg-[#e8f5f1] text-[#1f5c53] border-[#1f5c53]/40",
    });
  }
  if (statusChips.length === 0) {
    statusChips.push({
      key: "calm",
      label: isEn ? "🪴 Desk in order" : "🪴 Mesa en orden",
      tone: "bg-[#efe4ce] text-[#373f3a] border-[#1f2421]/20",
    });
  }

  const activeFlagLabels = Object.entries(state.flags)
    .filter(([, active]) => Boolean(active))
    .map(([flagId]) => ({ id: flagId, label: humanizeFlag(flagId, locale) }))
    .slice(0, 4);

  return (
    <section
      data-testid="panel-entorno"
      aria-label={ui.entorno.sectionAria}
      className={`${
        embeddedInFolder
          ? "flex-1 min-h-0 flex flex-col overflow-hidden bg-[#fffdf8]"
          : "paper-dossier rounded-xl overflow-hidden bg-[#fffdf8] flex flex-col"
      } ${className}`}
    >
      {!embeddedInFolder ? (
        <div className="dossier-header shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4 text-[#264e7a] shrink-0" aria-hidden="true" />
            <h2 className="font-editorial font-bold text-base text-[#1f2421] leading-tight">
              {ui.entorno.heading}
            </h2>
          </div>
          <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#efe4ce] text-[#373f3a] shrink-0">
            {ui.entorno.badge}
          </span>
        </div>
      ) : (
        <h2 className="sr-only">{ui.entorno.heading}</h2>
      )}

      <div className="entorno-body flex-1 min-h-0 overflow-y-auto dossier-scroll flex flex-col divide-y md:max-lg:grid md:max-lg:grid-cols-3 md:max-lg:divide-y-0 md:max-lg:divide-x divide-[#1f2421]/14">
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
                <ShieldCheck className="w-4 h-4 text-[#7a4308]" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-xs space-y-0.5">
            <div className="stamp-badge text-[10px] text-[#7a4308] leading-none">
              {ui.entorno.gestorHeader}
            </div>
            <p className="font-bold text-[#1f2421] leading-snug break-words">
              {gestorName ?? translateGestorTier(state.gestor.tier, locale)}
            </p>
            <p className="font-bureau text-[11px] text-[#4a524e] tabular-nums leading-snug break-words">
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
                <Heart className="w-4 h-4 text-[#9e221b]" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-xs space-y-0.5">
            <div className="stamp-badge text-[10px] text-[#9e221b] leading-none">
              {ui.entorno.personalLifeHeader}
            </div>
            <p className="font-bold text-[#1f2421] leading-snug break-words">
              {translateFamilyStatus(state.family.status, locale)}
              {partnerName ? ` · ${partnerName}` : ""}
            </p>
            <p className="font-bureau text-[11px] text-[#4a524e] tabular-nums leading-snug break-words">
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
                <p className="font-bold text-[#1f2421] leading-snug line-clamp-2 break-words">
                  {employeeName ?? employeeRoleLabel}
                  {employeeName && showEmployeeRoleSuffix ? ` · ${employeeRoleLabel}` : ""}
                </p>
                <p className="font-bureau text-[11px] text-[#4a524e] tabular-nums leading-snug break-words">
                  {formatEuros(state.employee.monthly_cost, locale)}
                  {ui.entorno.perMonth} ·{" "}
                  {ui.entorno.billingMultiplier(effectiveEmployeeMultiplier)}
                </p>
                <div
                  data-testid="entorno-employee-satisfaction"
                  className="pt-0.5 flex items-center gap-2"
                >
                  <span className="text-[10.5px] font-semibold text-[#4a524e] shrink-0">
                    {isEn ? "Morale" : "Clima"}
                  </span>
                  <div
                    aria-hidden="true"
                    className="flex-1 h-1.5 rounded-full bg-[#e5dac5] overflow-hidden border border-[#1f2421]/20"
                  >
                    <div
                      className={`h-full transition-all duration-200 ${empSatBarColor}`}
                      style={{ width: `${employeeSatisfaction}%` }}
                    />
                  </div>
                  <span
                    className={`font-bureau text-[10.5px] font-bold tabular-nums shrink-0 ${empSatTextColor}`}
                  >
                    {employeeSatisfaction}%
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="font-bold text-[#1f2421] leading-snug break-words">
                  {ui.entorno.noEmployeesTitle}
                </p>
                <p className="text-[11px] text-[#4a524e] leading-snug break-words">
                  {ui.entorno.noEmployeesSub}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Desktop Career Objectives & Live Situation Summary (fills vertical space cleanly on tall screens) */}
        {!embeddedInFolder && (
          <div
            data-testid="entorno-status-summary"
            className="hidden lg:flex flex-col mt-auto border-t border-[#1f2421]/14 bg-[#f6efe0]/70 px-3 py-2.5 gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Target className="w-3.5 h-3.5 text-[#1f5c53] shrink-0" aria-hidden="true" />
                <span className="stamp-badge text-[10px] text-[#373f3a] leading-none truncate">
                  {isEn ? "Career Objectives" : "Objetivos del Alta"}
                </span>
              </div>
              {state.endless_mode && (
                <span className="stamp-badge text-[9.5px] px-1.5 py-0.5 rounded bg-[#e8f5f1] text-[#1f5c53] border border-[#1f5c53]/35 shrink-0">
                  {isEn ? "Endless" : "Infinito"}
                </span>
              )}
            </div>

            {/* Dual Victory Progress Bars */}
            <div className="space-y-1.5 font-bureau text-[10.5px] tabular-nums">
              <div className="space-y-0.5">
                <div className="flex items-center justify-between gap-2 text-[#373f3a]">
                  <span className="font-semibold">
                    {isEn ? "10-year survival" : "Resistencia 10 años"}
                  </span>
                  <span className="font-bold text-[#1f2421]">
                    {Math.min(state.month, survivalTargetMonths)}/{survivalTargetMonths}{" "}
                    {isEn ? "mo" : "m"}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="h-1.5 rounded-full bg-[#e5dac5] overflow-hidden border border-[#1f2421]/20"
                >
                  <div
                    className="h-full bg-[#264e7a] transition-all duration-200"
                    style={{ width: `${survivalPct}%` }}
                  />
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center justify-between gap-2 text-[#373f3a]">
                  <span className="font-semibold">
                    {isEn ? "Net cash target" : "Meta solvencia"}
                  </span>
                  <span className="font-bold text-[#1f5c53]">
                    {formatEuros(Math.max(0, state.indicators.money), locale)} /{" "}
                    {formatEuros(wealthTargetMoney, locale)}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="h-1.5 rounded-full bg-[#e5dac5] overflow-hidden border border-[#1f2421]/20"
                >
                  <div
                    className="h-full bg-[#1f5c53] transition-all duration-200"
                    style={{ width: `${wealthPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Active Desk Climate & Narrative Conditions */}
            <div className="pt-1 border-t border-[#1f2421]/12 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1">
                {statusChips.map((chip) => (
                  <span
                    key={chip.key}
                    className={`font-bureau text-[10px] font-bold leading-none px-1.5 py-1 rounded border ${chip.tone}`}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>

              {activeFlagLabels.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {activeFlagLabels.map((flag) => (
                    <span
                      key={flag.id}
                      className="text-[10px] font-semibold leading-tight px-1.5 py-0.5 rounded bg-[#fffdf8] text-[#373f3a] border border-[#1f2421]/22 break-words"
                    >
                      · {flag.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
