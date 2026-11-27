import { BookOpen, Clock, FileWarning, ShieldCheck, TrendingUp } from "lucide-react";
import {
  type GameState,
  computeMonthlyEconomyBreakdown,
  resolvePartnerName,
} from "../../engine/index.ts";
import { compiledCatalog } from "../../services/content/catalog.ts";
import {
  formatEuros,
  formatSignedEuros,
  formatSignedInt,
  normalizeLocale,
  translateBusinessTierShort,
  translateEmployeeRoleLabel,
  translateModifierLabel,
} from "../../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../../services/i18n/uiStrings.ts";
import { useGameStore } from "../../store/gameStore.ts";

export interface CuentasPanelProps {
  state: GameState;
  locale?: string;
  embeddedInFolder?: boolean;
  className?: string;
}

export function CuentasPanel({
  state,
  locale: localeProp,
  embeddedInFolder = false,
  className = "",
}: CuentasPanelProps) {
  const storeLocale = useGameStore((s) => s.profile.settings.locale);
  const locale = localeProp ?? storeLocale;
  const isEn = normalizeLocale(locale) === "en";
  const ui = getUiStrings(locale);

  const breakdown = computeMonthlyEconomyBreakdown(state, compiledCatalog);
  const tierShort = translateBusinessTierShort(breakdown.businessTier, locale);
  const corporateTaxPct = Math.round((compiledCatalog.balance.corporate_tax_rate ?? 0.24) * 100);
  const irpfDisplayPct = Math.round(
    (breakdown.taxableProfit > 0 ? breakdown.effectiveTaxRate : breakdown.marginalTaxRate) * 100,
  );

  const openPrescripcionCount = (state.finances.historical_exposures ?? []).filter(
    (entry) => !entry.audited && state.month < entry.expires_month,
  ).length;

  const hasExtras =
    Boolean(state.finances.deferred_tax) ||
    openPrescripcionCount > 0 ||
    state.finances.pending_invoices.length > 0 ||
    state.modifiers.length > 0;

  return (
    <section
      data-testid="panel-cuentas"
      aria-label={ui.cuentas.sectionAria}
      className={`${
        embeddedInFolder
          ? "flex-1 min-h-0 flex flex-col overflow-hidden bg-[#fffdf8]"
          : "paper-dossier rounded-xl overflow-hidden bg-[#fffdf8] flex flex-col"
      } ${className}`}
    >
      {!embeddedInFolder ? (
        <div className="dossier-header shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <BookOpen className="w-4 h-4 text-[#1f5c53] shrink-0" aria-hidden="true" />
            <h2 className="font-editorial font-bold text-[15px] leading-tight text-[#1f2421] whitespace-nowrap">
              {ui.cuentas.heading}
            </h2>
          </div>
          <span className="stamp-badge text-[9.5px] px-1.5 py-0.5 rounded bg-[#efe4ce] text-[#373f3a] shrink-0">
            {ui.cuentas.badge}
          </span>
        </div>
      ) : (
        <h2 className="sr-only">{ui.cuentas.heading}</h2>
      )}

      <div
        className={`cuentas-body p-2.5 sm:p-3 text-xs ${
          embeddedInFolder
            ? "flex-1 min-h-0 overflow-y-auto dossier-scroll space-y-2"
            : "space-y-2 lg:space-y-1.5 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden"
        }`}
      >
        {/* Pinned Core Block: Monthly Baseline Cashflow P&L + Compact Trimestre Tracker */}
        <div
          className={
            embeddedInFolder
              ? "space-y-2"
              : "shrink-0 space-y-2 md:max-lg:grid md:max-lg:grid-cols-2 md:max-lg:gap-3 md:max-lg:space-y-0 lg:space-y-1.5"
          }
        >
          {/* Monthly Baseline Cashflow Table */}
          <div className="space-y-1 lg:space-y-0.5">
            <div className="flex items-center justify-between gap-2 font-bold text-[#1f2421] leading-snug">
              <span className="inline-flex items-center gap-1 min-w-0">
                <TrendingUp className="w-3.5 h-3.5 text-[#1f5c53] shrink-0" aria-hidden="true" />
                <span className="truncate">{ui.cuentas.baselineBilling}</span>
              </span>
              <span className="font-bureau text-[#1f5c53] tabular-nums whitespace-nowrap shrink-0">
                +{formatEuros(breakdown.grossBilling, locale)}
              </span>
            </div>

            <div className="border-t border-[#1f2421]/14 pt-0.5 space-y-0.5 text-[#373f3a] leading-snug">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{ui.cuentas.livingCost}</span>
                <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                  -{formatEuros(breakdown.livingCost, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {breakdown.corporateTaxRegime
                    ? ui.cuentas.corporateQuota
                    : ui.cuentas.autonomoQuota}
                </span>
                <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                  -{formatEuros(breakdown.socialSecurityQuota, locale)}
                </span>
              </div>
              {breakdown.structuralOverhead > 0 && (
                <div
                  data-testid="ledger-structural-overhead"
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate">{ui.cuentas.structuralOverheadLabel(tierShort)}</span>
                  <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                    -{formatEuros(breakdown.structuralOverhead, locale)}
                  </span>
                </div>
              )}
              {breakdown.gestorFee > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{ui.cuentas.gestorRetainer}</span>
                  <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                    -{formatEuros(breakdown.gestorFee, locale)}
                  </span>
                </div>
              )}
              {breakdown.familyCost > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{ui.cuentas.familyCosts}</span>
                  <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                    -{formatEuros(breakdown.familyCost, locale)}
                  </span>
                </div>
              )}
              {state.employee && breakdown.payrollCost > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {breakdown.teamHeadcount > 1
                      ? ui.cuentas.multiPayrollLabel(breakdown.teamHeadcount)
                      : ui.cuentas.payrollLabel(
                          translateEmployeeRoleLabel(state.employee.role_label, locale),
                        )}
                  </span>
                  <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                    -{formatEuros(breakdown.payrollCost, locale)}
                  </span>
                </div>
              )}
              {breakdown.modifierExpenseDelta !== 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{ui.cuentas.tempEffects}</span>
                  <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                    {formatSignedEuros(-breakdown.modifierExpenseDelta, locale)}
                  </span>
                </div>
              )}
            </div>

            <div className="border-t border-[#1f2421]/18 pt-1 space-y-0.5 leading-snug">
              <div className="flex items-center justify-between gap-2 font-semibold text-[#1f2421]">
                <span className="truncate">{ui.cuentas.marginBeforeTax}</span>
                <span
                  className={`font-bureau tabular-nums whitespace-nowrap shrink-0 ${
                    breakdown.netRecurringCash >= 0 ? "text-[#1f5c53]" : "text-[#9e221b]"
                  }`}
                >
                  {formatSignedEuros(breakdown.netRecurringCash, locale)}
                </span>
              </div>
              <div
                data-testid="ledger-tax-provision"
                className="flex items-center justify-between gap-2 text-[11px] text-[#4a524e]"
              >
                <span className="truncate">
                  {breakdown.corporateTaxRegime
                    ? ui.cuentas.corporateTaxProvision(corporateTaxPct)
                    : ui.cuentas.irpfProvision(irpfDisplayPct)}
                </span>
                <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                  -{formatEuros(breakdown.netTaxAccrued, locale)}
                </span>
              </div>
              {breakdown.taxShieldOnExpenses > 0 && (
                <div
                  data-testid="ledger-deductible-shield"
                  className="flex items-center justify-between gap-2 text-[10.5px] text-[#1f5c53]"
                >
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {isEn
                        ? `Deductible shield (${formatEuros(breakdown.deductibleExpenses, locale)})`
                        : `Escudo deducible (${formatEuros(breakdown.deductibleExpenses, locale)})`}
                    </span>
                  </span>
                  <span className="font-bureau font-bold tabular-nums whitespace-nowrap shrink-0">
                    +{formatEuros(breakdown.taxShieldOnExpenses, locale)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 font-bold pt-0.5 text-[#1f2421]">
                <span className="truncate">{ui.cuentas.marginAfterTax}</span>
                <span
                  data-testid="ledger-net-after-tax"
                  className={`font-bureau tabular-nums whitespace-nowrap shrink-0 ${
                    breakdown.netCashAfterTax >= 0 ? "text-[#1f5c53]" : "text-[#9e221b]"
                  }`}
                >
                  {formatSignedEuros(breakdown.netCashAfterTax, locale)}
                </span>
              </div>
            </div>
          </div>

          {/* Compact Trimestre Tracker */}
          <div
            data-testid="ledger-trimestre-box"
            className="rounded-lg border border-[#264e7a]/40 bg-[#ebf2fa]/85 px-2.5 py-1.5 space-y-0.5 leading-snug self-start"
          >
            <div className="stamp-badge text-[9.5px] text-[#264e7a]">
              {breakdown.corporateTaxRegime
                ? ui.cuentas.corporateQuarterProvisionHeading
                : ui.cuentas.quarterProvisionHeading}
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-[#373f3a] truncate">{ui.cuentas.quarterBilled}</span>
              <span className="font-bureau font-bold text-[#1f2421] tabular-nums whitespace-nowrap shrink-0">
                {formatEuros(state.finances.current_quarter_billed, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-[#373f3a] truncate">{ui.cuentas.accruedTaxes}</span>
              <span
                data-testid="ledger-accrued-tax"
                className="font-bureau font-bold text-[#9e221b] tabular-nums whitespace-nowrap shrink-0"
              >
                {formatEuros(state.finances.accrued_tax_liability, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[#264e7a]/20 pt-0.5 text-[11px]">
              <span className="text-[#373f3a] truncate">{ui.cuentas.lifetimeBilled}</span>
              <span className="font-bureau font-bold text-[#264e7a] tabular-nums whitespace-nowrap shrink-0">
                {formatEuros(state.finances.lifetime_billed, locale)}
              </span>
            </div>
          </div>
        </div>

        {/* Optional Scrollable Ledger Extras: Active Deferral, 4-Yr Prescripción Window, Pending Invoices, Active Modifiers */}
        {hasExtras && (
          <div
            data-testid="cuentas-extras-scroll"
            className={
              embeddedInFolder
                ? "space-y-2 pt-1.5 border-t border-[#1f2421]/14"
                : "space-y-1.5 pt-1.5 border-t border-[#1f2421]/14 lg:flex-1 lg:min-h-0 lg:overflow-y-auto dossier-scroll lg:pr-0.5"
            }
          >
            {/* Active Deferred Tax Debt */}
            {state.finances.deferred_tax && (
              <div
                data-testid="ledger-deferred-tax"
                className="rounded-lg border border-[#9e221b] bg-[#fdf0ef] px-2.5 py-1.5 space-y-0.5"
              >
                <div className="flex items-center gap-1.5 stamp-badge text-[10px] text-[#9e221b]">
                  <FileWarning className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {ui.cuentas.activeDeferralHeading(state.finances.deferred_tax.due_month)}
                </div>
                <p className="text-[11px] text-[#373f3a] tabular-nums leading-snug">
                  {ui.cuentas.principalWord}{" "}
                  {formatEuros(state.finances.deferred_tax.principal, locale)} +{" "}
                  {ui.cuentas.surchargeWord}{" "}
                  {formatEuros(state.finances.deferred_tax.surcharge, locale)} ={" "}
                  <strong className="font-bureau text-[#9e221b] whitespace-nowrap">
                    {formatEuros(
                      state.finances.deferred_tax.principal + state.finances.deferred_tax.surcharge,
                      locale,
                    )}
                  </strong>
                </p>
              </div>
            )}

            {/* Open 4-Year Prescripción Fiscal Audit Window */}
            {openPrescripcionCount > 0 && (
              <div
                data-testid="ledger-prescripcion-warning"
                className="rounded-lg border border-[#7a4308]/55 bg-[#fcf4df] px-2.5 py-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#7a4308] leading-snug"
              >
                <FileWarning className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{ui.cuentas.openPrescripcionWindow(openPrescripcionCount)}</span>
              </div>
            )}

            {/* Pending Invoices — hidden completely when empty so Cuentas stays compact */}
            {state.finances.pending_invoices.length > 0 && (
              <div className="space-y-1">
                <h3 className="stamp-badge text-[10px] text-[#4a524e] flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                  {ui.cuentas.deferredInvoicesHeading(state.finances.pending_invoices.length)}
                </h3>
                <ul className="space-y-1">
                  {state.finances.pending_invoices.map((inv) => (
                    <li
                      key={inv.id}
                      className="rounded border border-[#1f2421]/20 bg-[#f6efe0] px-2.5 py-1 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="font-bureau font-bold text-[#1f5c53] tabular-nums whitespace-nowrap">
                          +{formatEuros(inv.amount, locale)}
                        </span>
                        <span className="text-[11px] text-[#4a524e] ml-1.5">
                          {ui.cuentas.defaultRiskPct(Math.round(inv.default_prob * 100))}
                        </span>
                      </div>
                      <span className="stamp-badge text-[10px] px-1.5 py-0.5 rounded bg-[#fcf4df] text-[#7a4308] shrink-0">
                        M{inv.due_month}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Active Temporal Modifiers */}
            {state.modifiers.length > 0 && (
              <div className="space-y-1">
                <h3 className="stamp-badge text-[10px] text-[#4a524e]">
                  {ui.cuentas.temporalModifiersHeading(state.modifiers.length)}
                </h3>
                <ul className="space-y-1">
                  {state.modifiers.map((mod) => (
                    <li
                      key={mod.id}
                      className="rounded border border-[#1f2421]/20 bg-[#f6efe0] px-2.5 py-1"
                    >
                      <div className="flex items-start justify-between gap-2 font-bold text-[#1f2421] leading-snug">
                        <span className="break-words">
                          {translateModifierLabel(mod, locale, resolvePartnerName(state))}
                        </span>
                        <span className="font-bureau text-[10px] text-[#7a4308] tabular-nums whitespace-nowrap shrink-0">
                          {ui.cuentas.remainingMonths(mod.remaining_months)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 font-bureau text-[10px] text-[#373f3a] tabular-nums">
                        {mod.monthly_billed_delta ? (
                          <span>
                            {ui.cuentas.modBilledShort}:{" "}
                            {formatSignedEuros(mod.monthly_billed_delta, locale)}
                            {ui.cuentas.perMonthSuffix}
                          </span>
                        ) : null}
                        {mod.monthly_expense_delta ? (
                          <span>
                            {ui.cuentas.modExpenseShort}:{" "}
                            {formatSignedEuros(mod.monthly_expense_delta, locale)}
                            {ui.cuentas.perMonthSuffix}
                          </span>
                        ) : null}
                        {mod.monthly_moral_delta ? (
                          <span>
                            {ui.cuentas.modMoralShort}: {formatSignedInt(mod.monthly_moral_delta)}
                            {ui.cuentas.perMonthSuffix}
                          </span>
                        ) : null}
                        {mod.monthly_stress_delta ? (
                          <span>
                            {ui.cuentas.modStressShort}: {formatSignedInt(mod.monthly_stress_delta)}
                            {ui.cuentas.perMonthSuffix}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
