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

  const modifierExpenseDelta = state.modifiers.reduce(
    (sum, mod) => sum + (mod.monthly_expense_delta ?? 0),
    0,
  );

  return (
    <section
      data-testid="panel-cuentas"
      aria-label="Cuaderno de Cuentas"
      className="paper-dossier rounded-xl p-4 space-y-4"
    >
      <div className="flex items-center justify-between border-b-2 border-[#1f2421]/20 pb-2.5">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#1f5c53]" aria-hidden="true" />
          <h2 className="font-editorial font-bold text-base text-[#1f2421]">Cuaderno de Cuentas</h2>
        </div>
        <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#efe4ce] text-[#373f3a]">
          LIBRO REGISTRO
        </span>
      </div>

      {/* Monthly Baseline Cashflow */}
      <div className="rounded-lg border border-[#1f2421]/30 bg-[#f6efe0] p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between font-bold text-[#1f2421]">
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#1f5c53]" aria-hidden="true" />
            Facturación base mensual
          </span>
          <span className="font-bureau text-[#1f5c53]">+{formatEuros(baselineBilling)}</span>
        </div>

        <div className="border-t border-[#1f2421]/15 pt-2 space-y-1 text-[#373f3a]">
          <div className="flex justify-between">
            <span>Coste de vida básico</span>
            <span className="font-bureau">-{formatEuros(balance.base_living_cost)}</span>
          </div>
          <div className="flex justify-between">
            <span>Cuota fija RETA</span>
            <span className="font-bureau">-{formatEuros(balance.autonomo_quota)}</span>
          </div>
          {state.gestor.monthly_fee > 0 && (
            <div className="flex justify-between">
              <span>Iguala de gestoría</span>
              <span className="font-bureau">-{formatEuros(state.gestor.monthly_fee)}</span>
            </div>
          )}
          {state.family.monthly_cost > 0 && (
            <div className="flex justify-between">
              <span>Gastos familiares</span>
              <span className="font-bureau">-{formatEuros(state.family.monthly_cost)}</span>
            </div>
          )}
          {state.employee && (
            <div className="flex justify-between">
              <span>Nómina + Seg. Social ({state.employee.role_label})</span>
              <span className="font-bureau">-{formatEuros(state.employee.monthly_cost)}</span>
            </div>
          )}
          {modifierExpenseDelta !== 0 && (
            <div className="flex justify-between">
              <span>Efectos temporales</span>
              <span className="font-bureau">{formatSignedEuros(-modifierExpenseDelta)}</span>
            </div>
          )}
        </div>

        <div className="border-t border-[#1f2421]/25 pt-2 flex justify-between font-bold">
          <span>Margen fijo antes de impuestos</span>
          <span
            className={`font-bureau ${
              netMonthlyBaseline >= 0 ? "text-[#1f5c53]" : "text-[#b42b24]"
            }`}
          >
            {formatSignedEuros(netMonthlyBaseline)}
          </span>
        </div>
        <div className="flex justify-between text-[11px] text-[#4a524e]">
          <span>
            Devengo fiscal estimado/mes ({Math.round(balance.effective_quarterly_tax_rate * 100)}%)
          </span>
          <span className="font-bureau">{formatEuros(estMonthlyTax)}</span>
        </div>
      </div>

      {/* Trimestre Tracker */}
      <div
        data-testid="ledger-trimestre-box"
        className="rounded-lg border-2 border-[#264e7a]/50 bg-[#ebf2fa] p-3 space-y-1.5 text-xs"
      >
        <div className="stamp-badge text-[11px] text-[#264e7a]">
          PROVISIÓN TRIMESTRAL (IVA + IRPF)
        </div>
        <div className="flex justify-between">
          <span className="text-[#373f3a]">Facturado este trimestre:</span>
          <span className="font-bureau font-bold text-[#1f2421]">
            {formatEuros(state.finances.current_quarter_billed)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#373f3a]">Impuestos devengados:</span>
          <span data-testid="ledger-accrued-tax" className="font-bureau font-bold text-[#b42b24]">
            {formatEuros(state.finances.accrued_tax_liability)}
          </span>
        </div>
        <div className="flex justify-between border-t border-[#264e7a]/20 pt-1.5">
          <span className="text-[#373f3a]">Facturación histórica oficial:</span>
          <span className="font-bureau font-bold text-[#264e7a]">
            {formatEuros(state.finances.lifetime_billed)}
          </span>
        </div>
      </div>

      {/* Active Deferred Tax Debt */}
      {state.finances.deferred_tax && (
        <div
          data-testid="ledger-deferred-tax"
          className="rounded-lg border-2 border-[#b42b24] bg-[#fdf0ef] p-3 space-y-1 text-xs"
        >
          <div className="flex items-center gap-1.5 stamp-badge text-[11px] text-[#b42b24]">
            <FileWarning className="w-3.5 h-3.5" aria-hidden="true" />
            APLAZAMIENTO ACTIVO (VENCE MES {state.finances.deferred_tax.due_month})
          </div>
          <p className="text-[#373f3a]">
            Principal {formatEuros(state.finances.deferred_tax.principal)} + recargo{" "}
            {formatEuros(state.finances.deferred_tax.surcharge)} ={" "}
            <strong className="font-bureau text-[#b42b24]">
              {formatEuros(
                state.finances.deferred_tax.principal + state.finances.deferred_tax.surcharge,
              )}
            </strong>
          </p>
        </div>
      )}

      {/* Pending Invoices */}
      <div className="space-y-1.5">
        <h3 className="stamp-badge text-[11px] text-[#4a524e] flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          Facturas pendientes de cobro ({state.finances.pending_invoices.length})
        </h3>
        {state.finances.pending_invoices.length === 0 ? (
          <p className="text-xs text-[#4a524e] italic">
            Ninguna factura emitida a plazo en este momento.
          </p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {state.finances.pending_invoices.map((inv) => (
              <li
                key={inv.id}
                className="rounded border border-[#1f2421]/30 bg-[#fffdf8] px-2.5 py-2 flex items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bureau font-bold text-[#1f5c53]">
                    +{formatEuros(inv.amount)}
                  </span>
                  <span className="block text-[11px] text-[#4a524e]">
                    Vence en mes {inv.due_month} · Riesgo impago{" "}
                    {Math.round(inv.default_prob * 100)}%
                  </span>
                </div>
                <span className="stamp-badge text-[10px] px-1.5 py-0.5 rounded bg-[#fcf4df] text-[#8f510d]">
                  M{inv.due_month}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Active Temporal Modifiers */}
      {state.modifiers.length > 0 && (
        <div className="space-y-1.5 border-t border-[#1f2421]/15 pt-3">
          <h3 className="stamp-badge text-[11px] text-[#4a524e]">
            Efectos temporales activos ({state.modifiers.length})
          </h3>
          <ul className="space-y-1.5 text-xs">
            {state.modifiers.map((mod) => (
              <li
                key={mod.id}
                className="rounded border border-[#1f2421]/30 bg-[#f6efe0] px-2.5 py-2"
              >
                <div className="flex items-center justify-between font-bold text-[#1f2421]">
                  <span>{mod.label}</span>
                  <span className="font-bureau text-[11px] text-[#8f510d]">
                    {mod.remaining_months} {mod.remaining_months === 1 ? "mes" : "meses"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 font-bureau text-[11px] text-[#373f3a]">
                  {mod.monthly_billed_delta ? (
                    <span>Fact.: {formatSignedEuros(mod.monthly_billed_delta)}/mes</span>
                  ) : null}
                  {mod.monthly_expense_delta ? (
                    <span>Gasto: {formatSignedEuros(mod.monthly_expense_delta)}/mes</span>
                  ) : null}
                  {mod.monthly_moral_delta ? (
                    <span>Moral: {formatSignedInt(mod.monthly_moral_delta)}/mes</span>
                  ) : null}
                  {mod.monthly_stress_delta ? (
                    <span>Estrés: {formatSignedInt(mod.monthly_stress_delta)}/mes</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
