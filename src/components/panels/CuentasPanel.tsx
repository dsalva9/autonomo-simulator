import { BookOpen, Clock, FileWarning, ShieldCheck, TrendingUp } from "lucide-react";
import {
  type GameState,
  computeBaselineMonthlyBilling,
  computeMonthlyDeductibleExpenses,
  computeMonthlyRecurringExpenses,
} from "../../engine/index.ts";
import { compiledCatalog } from "../../services/content/catalog.ts";
import {
  formatEuros,
  formatSignedEuros,
  formatSignedInt,
  normalizeLocale,
  translateEmployeeRoleLabel,
  translateModifierLabel,
} from "../../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../../services/i18n/uiStrings.ts";
import { useGameStore } from "../../store/gameStore.ts";

export interface CuentasPanelProps {
  state: GameState;
  locale?: string;
}

export function CuentasPanel({ state, locale: localeProp }: CuentasPanelProps) {
  const storeLocale = useGameStore((s) => s.profile.settings.locale);
  const locale = localeProp ?? storeLocale;
  const isEn = normalizeLocale(locale) === "en";
  const ui = getUiStrings(locale);

  const { balance } = compiledCatalog;
  const baselineBilling = computeBaselineMonthlyBilling(state, compiledCatalog);
  const totalFixedExpenses = computeMonthlyRecurringExpenses(state, compiledCatalog);
  const deductibleExpenses = computeMonthlyDeductibleExpenses(state, compiledCatalog);
  const livingCostCreep =
    Math.max(0, Math.floor((state.month - 1) / 12)) * (balance.annual_living_cost_growth ?? 0);
  const effectiveLivingCost = Math.round(balance.base_living_cost + livingCostCreep);
  const netMonthlyBaseline = baselineBilling - totalFixedExpenses;

  const grossMonthlyTax = Math.round(baselineBilling * balance.effective_quarterly_tax_rate);
  const monthlyTaxShield = Math.round(deductibleExpenses * balance.deductible_tax_fraction);
  const estNetMonthlyTax = Math.max(0, grossMonthlyTax - monthlyTaxShield);
  const netMonthlyAfterTax = netMonthlyBaseline - estNetMonthlyTax;

  const modifierExpenseDelta = state.modifiers.reduce(
    (sum, mod) => sum + (mod.monthly_expense_delta ?? 0),
    0,
  );

  return (
    <section
      data-testid="panel-cuentas"
      aria-label={ui.cuentas.sectionAria}
      className="paper-dossier rounded-xl overflow-hidden bg-[#fffdf8]"
    >
      <div className="dossier-header">
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

      <div className="cuentas-body p-3 space-y-2 text-xs">
        {/* Monthly Baseline Cashflow Table */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 font-bold text-[#1f2421]">
            <span className="inline-flex items-center gap-1 min-w-0">
              <TrendingUp className="w-3.5 h-3.5 text-[#1f5c53] shrink-0" aria-hidden="true" />
              <span className="truncate">{ui.cuentas.baselineBilling}</span>
            </span>
            <span className="font-bureau text-[#1f5c53] tabular-nums whitespace-nowrap shrink-0">
              +{formatEuros(baselineBilling, locale)}
            </span>
          </div>

          <div className="border-t border-[#1f2421]/14 pt-1 space-y-0.5 text-[#373f3a]">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{ui.cuentas.livingCost}</span>
              <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                -{formatEuros(effectiveLivingCost, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{ui.cuentas.autonomoQuota}</span>
              <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                -{formatEuros(balance.autonomo_quota, locale)}
              </span>
            </div>
            {state.gestor.monthly_fee > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{ui.cuentas.gestorRetainer}</span>
                <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                  -{formatEuros(state.gestor.monthly_fee, locale)}
                </span>
              </div>
            )}
            {state.family.monthly_cost > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{ui.cuentas.familyCosts}</span>
                <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                  -{formatEuros(state.family.monthly_cost, locale)}
                </span>
              </div>
            )}
            {state.employee && (
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {ui.cuentas.payrollLabel(
                    translateEmployeeRoleLabel(state.employee.role_label, locale),
                  )}
                </span>
                <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                  -{formatEuros(state.employee.monthly_cost, locale)}
                </span>
              </div>
            )}
            {modifierExpenseDelta !== 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{ui.cuentas.tempEffects}</span>
                <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                  {formatSignedEuros(-modifierExpenseDelta, locale)}
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-[#1f2421]/18 pt-1.5 space-y-0.5">
            <div className="flex items-center justify-between gap-2 font-semibold text-[#1f2421]">
              <span className="truncate">{ui.cuentas.marginBeforeTax}</span>
              <span
                className={`font-bureau tabular-nums whitespace-nowrap shrink-0 ${
                  netMonthlyBaseline >= 0 ? "text-[#1f5c53]" : "text-[#9e221b]"
                }`}
              >
                {formatSignedEuros(netMonthlyBaseline, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-[#4a524e]">
              <span className="truncate">
                {ui.cuentas.estTaxProvision(Math.round(balance.effective_quarterly_tax_rate * 100))}
              </span>
              <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                -{formatEuros(estNetMonthlyTax, locale)}
              </span>
            </div>
            {monthlyTaxShield > 0 && (
              <div
                data-testid="ledger-deductible-shield"
                className="flex items-center justify-between gap-2 text-[10.5px] text-[#1f5c53]"
              >
                <span className="inline-flex items-center gap-1 truncate">
                  <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {isEn
                      ? `Deductible shield (${formatEuros(deductibleExpenses, locale)})`
                      : `Escudo deducible (${formatEuros(deductibleExpenses, locale)})`}
                  </span>
                </span>
                <span className="font-bureau font-bold tabular-nums whitespace-nowrap shrink-0">
                  +{formatEuros(monthlyTaxShield, locale)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 font-bold pt-0.5 text-[#1f2421]">
              <span className="truncate">{ui.cuentas.marginAfterTax}</span>
              <span
                data-testid="ledger-net-after-tax"
                className={`font-bureau tabular-nums whitespace-nowrap shrink-0 ${
                  netMonthlyAfterTax >= 0 ? "text-[#1f5c53]" : "text-[#9e221b]"
                }`}
              >
                {formatSignedEuros(netMonthlyAfterTax, locale)}
              </span>
            </div>
          </div>
        </div>

        {/* Trimestre Tracker */}
        <div
          data-testid="ledger-trimestre-box"
          className="rounded-lg border border-[#264e7a]/40 bg-[#ebf2fa]/85 px-3 py-2 space-y-1"
        >
          <div className="stamp-badge text-[10px] text-[#264e7a]">
            {ui.cuentas.quarterProvisionHeading}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#373f3a] truncate">{ui.cuentas.quarterBilled}</span>
            <span className="font-bureau font-bold text-[#1f2421] tabular-nums whitespace-nowrap shrink-0">
              {formatEuros(state.finances.current_quarter_billed, locale)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#373f3a] truncate">{ui.cuentas.accruedTaxes}</span>
            <span
              data-testid="ledger-accrued-tax"
              className="font-bureau font-bold text-[#9e221b] tabular-nums whitespace-nowrap shrink-0"
            >
              {formatEuros(state.finances.accrued_tax_liability, locale)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[#264e7a]/20 pt-1">
            <span className="text-[#373f3a] truncate">{ui.cuentas.lifetimeBilled}</span>
            <span className="font-bureau font-bold text-[#264e7a] tabular-nums whitespace-nowrap shrink-0">
              {formatEuros(state.finances.lifetime_billed, locale)}
            </span>
          </div>
        </div>

        {/* Active Deferred Tax Debt */}
        {state.finances.deferred_tax && (
          <div
            data-testid="ledger-deferred-tax"
            className="rounded-lg border border-[#9e221b] bg-[#fdf0ef] px-3 py-2 space-y-0.5"
          >
            <div className="flex items-center gap-1.5 stamp-badge text-[10px] text-[#9e221b]">
              <FileWarning className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {ui.cuentas.activeDeferralHeading(state.finances.deferred_tax.due_month)}
            </div>
            <p className="text-[11px] text-[#373f3a] tabular-nums">
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

        {/* Pending Invoices */}
        <div className="border-t border-[#1f2421]/14 pt-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="stamp-badge text-[10px] text-[#4a524e] flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
              {ui.cuentas.deferredInvoicesHeading(state.finances.pending_invoices.length)}
            </h3>
            {state.finances.pending_invoices.length === 0 && (
              <span className="text-[11px] text-[#4a524e] italic">
                {ui.cuentas.noPendingPayments}
              </span>
            )}
          </div>
          {state.finances.pending_invoices.length > 0 && (
            <ul className="space-y-1 xl:max-h-24 overflow-y-auto dossier-scroll pr-0.5">
              {state.finances.pending_invoices.map((inv) => (
                <li
                  key={inv.id}
                  className="rounded border border-[#1f2421]/20 bg-[#f6efe0] px-2.5 py-1.5 flex items-center justify-between gap-2"
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
          )}
        </div>

        {/* Active Temporal Modifiers */}
        {state.modifiers.length > 0 && (
          <div className="border-t border-[#1f2421]/14 pt-2 space-y-1.5">
            <h3 className="stamp-badge text-[10px] text-[#4a524e]">
              {ui.cuentas.temporalModifiersHeading(state.modifiers.length)}
            </h3>
            <ul className="space-y-1 xl:max-h-24 overflow-y-auto dossier-scroll pr-0.5">
              {state.modifiers.map((mod) => (
                <li
                  key={mod.id}
                  className="rounded border border-[#1f2421]/20 bg-[#f6efe0] px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2 font-bold text-[#1f2421]">
                    <span className="truncate">{translateModifierLabel(mod, locale)}</span>
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
    </section>
  );
}
