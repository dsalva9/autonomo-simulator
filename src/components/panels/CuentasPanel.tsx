import { BookOpen, Clock, FileWarning, TrendingUp } from "lucide-react";
import {
  type GameState,
  computeBaselineMonthlyBilling,
  computeMonthlyRecurringExpenses,
} from "../../engine/index.ts";
import { compiledCatalog } from "../../services/content/catalog.ts";
import {
  formatEuros,
  formatSignedEuros,
  formatSignedInt,
} from "../../services/i18n/resolveEventText.ts";

export interface CuentasPanelProps {
  state: GameState;
}

export function CuentasPanel({ state }: CuentasPanelProps) {
  const { balance } = compiledCatalog;
  const baselineBilling = computeBaselineMonthlyBilling(state, compiledCatalog);
  const totalFixedExpenses = computeMonthlyRecurringExpenses(state, compiledCatalog);
  const netMonthlyBaseline = baselineBilling - totalFixedExpenses;
  const estMonthlyTax = Math.round(baselineBilling * balance.effective_quarterly_tax_rate);
  const netMonthlyAfterTax = netMonthlyBaseline - estMonthlyTax;

  const modifierExpenseDelta = state.modifiers.reduce(
    (sum, mod) => sum + (mod.monthly_expense_delta ?? 0),
    0,
  );

  return (
    <section
      data-testid="panel-cuentas"
      aria-label="Cuaderno de Cuentas"
      className="paper-dossier rounded-xl overflow-hidden bg-[#fffdf8]"
    >
      <div className="dossier-header">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-[#1f5c53] shrink-0" aria-hidden="true" />
          <h2 className="font-editorial font-bold text-base text-[#1f2421] truncate">
            Cuaderno de Cuentas
          </h2>
        </div>
        <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#efe4ce] text-[#373f3a] shrink-0">
          LIBRO REGISTRO
        </span>
      </div>

      <div className="cuentas-body p-3 space-y-2 text-xs">
        {/* Monthly Baseline Cashflow Table */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 font-bold text-[#1f2421]">
            <span className="inline-flex items-center gap-1 min-w-0">
              <TrendingUp className="w-3.5 h-3.5 text-[#1f5c53] shrink-0" aria-hidden="true" />
              <span className="truncate">Facturación base mensual</span>
            </span>
            <span className="font-bureau text-[#1f5c53] tabular-nums whitespace-nowrap shrink-0">
              +{formatEuros(baselineBilling)}
            </span>
          </div>

          <div className="border-t border-[#1f2421]/14 pt-1 space-y-0.5 text-[#373f3a]">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">Coste de vida básico</span>
              <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                -{formatEuros(balance.base_living_cost)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">Cuota fija RETA</span>
              <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                -{formatEuros(balance.autonomo_quota)}
              </span>
            </div>
            {state.gestor.monthly_fee > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">Iguala de gestoría</span>
                <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                  -{formatEuros(state.gestor.monthly_fee)}
                </span>
              </div>
            )}
            {state.family.monthly_cost > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">Gastos familiares</span>
                <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                  -{formatEuros(state.family.monthly_cost)}
                </span>
              </div>
            )}
            {state.employee && (
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">Nómina ({state.employee.role_label})</span>
                <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                  -{formatEuros(state.employee.monthly_cost)}
                </span>
              </div>
            )}
            {modifierExpenseDelta !== 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">Efectos temporales</span>
                <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                  {formatSignedEuros(-modifierExpenseDelta)}
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-[#1f2421]/18 pt-1.5 space-y-1">
            <div className="flex items-center justify-between gap-2 font-semibold text-[#1f2421]">
              <span className="truncate">Margen antes de impuestos</span>
              <span
                className={`font-bureau tabular-nums whitespace-nowrap shrink-0 ${
                  netMonthlyBaseline >= 0 ? "text-[#1f5c53]" : "text-[#b42b24]"
                }`}
              >
                {formatSignedEuros(netMonthlyBaseline)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-[#4a524e]">
              <span className="truncate">
                Provisión fiscal est. ({Math.round(balance.effective_quarterly_tax_rate * 100)}%)
              </span>
              <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                -{formatEuros(estMonthlyTax)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 font-bold pt-0.5 text-[#1f2421]">
              <span className="truncate">Margen tras provisión fiscal</span>
              <span
                data-testid="ledger-net-after-tax"
                className={`font-bureau tabular-nums whitespace-nowrap shrink-0 ${
                  netMonthlyAfterTax >= 0 ? "text-[#1f5c53]" : "text-[#b42b24]"
                }`}
              >
                {formatSignedEuros(netMonthlyAfterTax)}
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
            PROVISIÓN TRIMESTRAL (IVA + IRPF)
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#373f3a] truncate">Facturado trimestre:</span>
            <span className="font-bureau font-bold text-[#1f2421] tabular-nums whitespace-nowrap shrink-0">
              {formatEuros(state.finances.current_quarter_billed)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#373f3a] truncate">Impuestos devengados:</span>
            <span
              data-testid="ledger-accrued-tax"
              className="font-bureau font-bold text-[#b42b24] tabular-nums whitespace-nowrap shrink-0"
            >
              {formatEuros(state.finances.accrued_tax_liability)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[#264e7a]/20 pt-1">
            <span className="text-[#373f3a] truncate">Facturación oficial acum.:</span>
            <span className="font-bureau font-bold text-[#264e7a] tabular-nums whitespace-nowrap shrink-0">
              {formatEuros(state.finances.lifetime_billed)}
            </span>
          </div>
        </div>

        {/* Active Deferred Tax Debt */}
        {state.finances.deferred_tax && (
          <div
            data-testid="ledger-deferred-tax"
            className="rounded-lg border border-[#b42b24] bg-[#fdf0ef] px-3 py-2 space-y-0.5"
          >
            <div className="flex items-center gap-1.5 stamp-badge text-[10px] text-[#b42b24]">
              <FileWarning className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              APLAZAMIENTO ACTIVO (VENCE MES {state.finances.deferred_tax.due_month})
            </div>
            <p className="text-[11px] text-[#373f3a] tabular-nums">
              Principal {formatEuros(state.finances.deferred_tax.principal)} + recargo{" "}
              {formatEuros(state.finances.deferred_tax.surcharge)} ={" "}
              <strong className="font-bureau text-[#b42b24] whitespace-nowrap">
                {formatEuros(
                  state.finances.deferred_tax.principal + state.finances.deferred_tax.surcharge,
                )}
              </strong>
            </p>
          </div>
        )}

        {/* Pending Invoices */}
        <div className="border-t border-[#1f2421]/14 pt-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="stamp-badge text-[10px] text-[#4a524e] flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
              Facturas a plazo ({state.finances.pending_invoices.length})
            </h3>
            {state.finances.pending_invoices.length === 0 && (
              <span className="text-[11px] text-[#4a524e] italic">Sin cobros pendientes</span>
            )}
          </div>
          {state.finances.pending_invoices.length > 0 && (
            <ul className="space-y-1 max-h-24 overflow-y-auto dossier-scroll pr-0.5">
              {state.finances.pending_invoices.map((inv) => (
                <li
                  key={inv.id}
                  className="rounded border border-[#1f2421]/20 bg-[#f6efe0] px-2.5 py-1.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="font-bureau font-bold text-[#1f5c53] tabular-nums whitespace-nowrap">
                      +{formatEuros(inv.amount)}
                    </span>
                    <span className="text-[11px] text-[#4a524e] ml-1.5">
                      · Impago {Math.round(inv.default_prob * 100)}%
                    </span>
                  </div>
                  <span className="stamp-badge text-[10px] px-1.5 py-0.5 rounded bg-[#fcf4df] text-[#8f510d] shrink-0">
                    M{inv.due_month}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Active Temporal Modifiers */}
        {state.modifiers.length > 0 && (
          <div className="border-t border-[#1f2421]/14 pt-2.5 space-y-1.5">
            <h3 className="stamp-badge text-[10px] text-[#4a524e]">
              Efectos temporales ({state.modifiers.length})
            </h3>
            <ul className="space-y-1 max-h-24 overflow-y-auto dossier-scroll pr-0.5">
              {state.modifiers.map((mod) => (
                <li
                  key={mod.id}
                  className="rounded border border-[#1f2421]/20 bg-[#f6efe0] px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2 font-bold text-[#1f2421]">
                    <span className="truncate">{mod.label}</span>
                    <span className="font-bureau text-[10px] text-[#8f510d] tabular-nums whitespace-nowrap shrink-0">
                      {mod.remaining_months} {mod.remaining_months === 1 ? "mes" : "meses"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 font-bureau text-[10px] text-[#373f3a] tabular-nums">
                    {mod.monthly_billed_delta ? (
                      <span>Fact.: {formatSignedEuros(mod.monthly_billed_delta)}/m</span>
                    ) : null}
                    {mod.monthly_expense_delta ? (
                      <span>Gasto: {formatSignedEuros(mod.monthly_expense_delta)}/m</span>
                    ) : null}
                    {mod.monthly_moral_delta ? (
                      <span>Moral: {formatSignedInt(mod.monthly_moral_delta)}/m</span>
                    ) : null}
                    {mod.monthly_stress_delta ? (
                      <span>Estrés: {formatSignedInt(mod.monthly_stress_delta)}/m</span>
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
