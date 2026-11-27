import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { compileLocaleOverlays } from "../../scripts/compile-content.ts";
import { loadAndValidateContent } from "../../scripts/validate-content.ts";
import { validateLocales } from "../../scripts/validate-locales.ts";
import {
  BalanceConfigSchema,
  type ContentCatalog,
  type EventDef,
  EventSchema,
  type GameState,
  applyPlayerChoice,
  applyQuarterlySettlement,
  applyRecurringMonthEconomy,
  computeBaselineMonthlyBilling,
  computeEffectiveEventWeight,
  computeEffectiveGestorFee,
  computeEffectiveTeamMultiplier,
  computeMarginalTaxRate,
  computeMonthlyEconomyBreakdown,
  computeMonthlyLivingCost,
  computeMonthlySocialSecurityQuota,
  createInitialGameState,
  drawTurnEvents,
  enqueueScheduledEvent,
  evaluateRequirements,
  getBusinessTierConfig,
  getEffectiveHardDebtFloor,
  getEffectiveScaledChoiceEffects,
  getTeamHeadcount,
  hasActiveRequirements,
  isBoutiqueSeniorSolo,
  isChoiceEligible,
  prepareQuarterlyTax,
  resolveChoiceEffects,
  scaleMonetaryValue,
  selectHistoricalAuditEvent,
  selectInspectableHaciendaEvent,
  settleQuarter,
} from "../../src/engine/index.ts";
import { createFixtureCharacters, createFixtureEvents, createFixtureManifest } from "./fixtures.ts";

function createLiveV2Catalog(extraEvents: EventDef[] = []): ContentCatalog {
  const liveBalance = BalanceConfigSchema.parse(
    parseYaml(readFileSync(join(process.cwd(), "content/config/balance.yaml"), "utf8")),
  );
  const chars = createFixtureCharacters();
  chars.empleada_senior_laura = {
    schema_version: 1,
    id: "empleada_senior_laura",
    name: "Laura (Especialista Sénior)",
    role: "empleado",
    bio: "Sénior de agencia.",
    portrait_asset_id: "char_empleado_junior_dani",
    employee_params: {
      role_label: "Especialista sénior",
      monthly_cost: 2100,
      billing_multiplier: 2.05,
    },
  };
  chars.empleado_junior_dani = {
    ...chars.empleado_junior_dani,
    employee_params: {
      role_label: "Junior Multiusos",
      monthly_cost: 1350,
      billing_multiplier: 1.58,
    },
  };
  return {
    balance: liveBalance,
    characters: chars,
    events: [...createFixtureEvents(), ...extraEvents],
    manifest: createFixtureManifest(),
  };
}

describe("Autónomo Simulator v2 — Business Scaling, Progressive Economy & Systemic Depth", () => {
  it("computes progressive RETA brackets, marginal IRPF slices, Impuesto de Sociedades, and exact tax-shield identity", () => {
    const catalog = createLiveV2Catalog();
    const base = createInitialGameState(catalog, { seed: "V2-TAX-1" });

    // Verify getBusinessTierConfig returns exact tier specs
    expect(getBusinessTierConfig(base, catalog).max_team_size).toBe(1);
    expect(getBusinessTierConfig("agencia_consultora", catalog).event_stakes_multiplier).toBe(3.2);

    // Month 1 Solo Start (Self, rep 35, moral 75): preQuotaProfit < 2200 -> 294 € RETA
    const m1 = computeMonthlyEconomyBreakdown(base, catalog);
    expect(m1.businessTier).toBe("solo_autonomo");
    expect(m1.corporateTaxRegime).toBe(false);
    expect(m1.socialSecurityQuota).toBe(294);
    expect(m1.structuralOverhead).toBe(0);
    expect(m1.grossTaxWithoutDeductions - m1.taxShieldOnExpenses).toBe(m1.netTaxAccrued);
    expect(m1.marginalTaxRate).toBe(0.3); // taxableProfit ~1873 sits in 1500..3000 (30%)

    // Monotonicity: raising monthly_billed_delta by +1 € never yields lower netCashAfterTax
    let prevNet = Number.NEGATIVE_INFINITY;
    for (const extraBilled of [0, 500, 1200, 2000, 3500, 6000, 8000]) {
      const s: GameState = {
        ...base,
        modifiers: [
          {
            id: "retainer",
            label: "Iguala",
            remaining_months: 6,
            monthly_billed_delta: extraBilled,
          },
        ],
      };
      const b = computeMonthlyEconomyBreakdown(s, catalog);
      expect(b.grossTaxWithoutDeductions - b.taxShieldOnExpenses).toBe(b.netTaxAccrued);
      expect(b.netCashAfterTax).toBeGreaterThanOrEqual(prevNet);
      prevNet = b.netCashAfterTax;
    }

    // Verify all 5 RETA brackets cleanly on pre-quota monthly net profit
    const quotaAtExtra = (extraBilled: number) =>
      computeMonthlySocialSecurityQuota(
        {
          ...base,
          modifiers: [
            { id: "r", label: "R", remaining_months: 3, monthly_billed_delta: extraBilled },
          ],
        },
        catalog,
      );
    expect(quotaAtExtra(0)).toBe(294); // ~2167 < 2200
    expect(quotaAtExtra(400)).toBe(350); // ~2567 in 2200..2999
    expect(quotaAtExtra(1200)).toBe(420); // ~3367 in 3000..4199
    expect(quotaAtExtra(2500)).toBe(510); // ~4667 in 4200..5799
    expect(quotaAtExtra(4500)).toBe(590); // ~6667 >= 5800

    // S.L. regime: flat 24% Impuesto de Sociedades + fixed 460 € Societario + 560 € structural overhead + 1.95x Elena fee
    const slState: GameState = {
      ...base,
      business: { tier: "sociedad_limitada", months_in_tier: 4, sl_formed_month: 30 },
      gestor: {
        tier: "premium",
        character_id: "gestor_premium_elena",
        monthly_fee: computeEffectiveGestorFee("premium", "sociedad_limitada", catalog),
        inspection_shield: 0.5,
        months_active: 4,
      },
      modifiers: [
        {
          id: "big_retainer",
          label: "Iguala S.L.",
          remaining_months: 6,
          monthly_billed_delta: 6000,
        },
      ],
    };
    const slBreakdown = computeMonthlyEconomyBreakdown(slState, catalog);
    expect(slBreakdown.corporateTaxRegime).toBe(true);
    expect(slBreakdown.socialSecurityQuota).toBe(460);
    expect(slBreakdown.structuralOverhead).toBe(560);
    expect(slBreakdown.gestorFee).toBe(Math.round(260 * 1.95)); // 507 €
    expect(slBreakdown.marginalTaxRate).toBe(0.24);
    expect(computeMarginalTaxRate(slState, catalog)).toBe(0.24);
    expect(slBreakdown.netTaxAccrued).toBe(Math.round(slBreakdown.taxableProfit * 0.24));
    expect(slBreakdown.grossTaxWithoutDeductions - slBreakdown.taxShieldOnExpenses).toBe(
      slBreakdown.netTaxAccrued,
    );

    // Agency Societario quota is 520 € and structural overhead is 1,250 €
    const agencyState: GameState = {
      ...slState,
      business: { tier: "agencia_consultora", months_in_tier: 2, sl_formed_month: 30 },
    };
    const agencyBreakdown = computeMonthlyEconomyBreakdown(agencyState, catalog);
    expect(agencyBreakdown.socialSecurityQuota).toBe(520);
    expect(agencyBreakdown.structuralOverhead).toBe(1250);
    expect(agencyBreakdown.gestorFee).toBe(Math.round(260 * 2.8)); // 728 €
  });

  it("enforces 3-Act living cost escalation, Act II/III market squeeze, and Act III complexity stress", () => {
    const catalog = createLiveV2Catalog();
    const base = createInitialGameState(catalog, { seed: "V2-ACTS" });

    // Living cost checkpoints matching ADR 004 §3.2 exactly
    expect(computeMonthlyLivingCost({ month: 1 }, catalog)).toBe(1440);
    expect(computeMonthlyLivingCost({ month: 30 }, catalog)).toBe(1440 + 2 * 75); // 1590
    expect(computeMonthlyLivingCost({ month: 42 }, catalog)).toBe(1440 + 3 * 75); // 1665
    expect(computeMonthlyLivingCost({ month: 54 }, catalog)).toBe(1440 + 3 * 75 + 110); // 1775
    expect(computeMonthlyLivingCost({ month: 66 }, catalog)).toBe(1440 + 3 * 75 + 2 * 110); // 1885
    expect(computeMonthlyLivingCost({ month: 90 }, catalog)).toBe(1440 + 3 * 75 + 3 * 110 + 145); // 2140
    expect(computeMonthlyLivingCost({ month: 102 }, catalog)).toBe(
      1440 + 3 * 75 + 3 * 110 + 2 * 145,
    ); // 2285
    // Endless taper post-M120 (year 10+ adds floor(145*0.5)=72 per year)
    expect(computeMonthlyLivingCost({ month: 133 }, catalog)).toBe(
      1440 + 3 * 75 + 3 * 110 + 3 * 145 + 2 * 72,
    );

    // Market squeeze across Acts I -> II -> III
    const bAct1 = computeBaselineMonthlyBilling({ ...base, month: 12 }, catalog);
    const bAct2 = computeBaselineMonthlyBilling({ ...base, month: 48 }, catalog);
    const bAct3 = computeBaselineMonthlyBilling({ ...base, month: 84 }, catalog);
    expect(bAct2).toBeLessThan(bAct1);
    expect(bAct3).toBeLessThan(bAct2);

    // Act III complexity stress (+1 when personal_life < 70, 0 when personal_life >= 70)
    const lowPlAct3 = applyRecurringMonthEconomy(
      {
        ...base,
        month: 80,
        indicators: { ...base.indicators, personal_life: 55, stress: 40 },
      },
      catalog,
    );
    const highPlAct3 = applyRecurringMonthEconomy(
      {
        ...base,
        month: 80,
        indicators: { ...base.indicators, personal_life: 72, stress: 40 },
      },
      catalog,
    );
    const baseRelief = catalog.balance.personal_life_monthly_stress_relief;
    // Low PL (55): -baseRelief + +1 Act3 complexity
    expect(lowPlAct3.passiveStressDelta).toBe(-baseRelief + 1);
    // High PL (72): -baseRelief + 0 Act3 complexity
    expect(highPlAct3.passiveStressDelta).toBe(-baseRelief);
  });

  it("supports Boutique Senior Solo billing bonus and badge threshold without hiring", () => {
    const catalog = createLiveV2Catalog();
    const base = createInitialGameState(catalog, { seed: "V2-BOUTIQUE" });

    // Below month 30 -> no boutique bonus
    expect(
      isBoutiqueSeniorSolo(
        { ...base, month: 29, indicators: { ...base.indicators, reputation: 90 } },
        catalog,
      ),
    ).toBe(false);
    // Month 30, rep 70 -> billing bonus active (>1.0x), badge requires >= 72
    const m30Rep70: GameState = {
      ...base,
      month: 30,
      indicators: { ...base.indicators, reputation: 70 },
    };
    const m30Rep68: GameState = {
      ...base,
      month: 30,
      indicators: { ...base.indicators, reputation: 68 },
    };
    const m30Rep100: GameState = {
      ...base,
      month: 30,
      indicators: { ...base.indicators, reputation: 100 },
    };
    expect(isBoutiqueSeniorSolo(m30Rep70, catalog)).toBe(false);
    expect(isBoutiqueSeniorSolo(m30Rep100, catalog)).toBe(true);
    expect(computeBaselineMonthlyBilling(m30Rep70, catalog)).toBeGreaterThan(
      computeBaselineMonthlyBilling(m30Rep68, catalog),
    );
    // At rep 100 vs rep 68 (same moral/act), repFactor increases AND boutiqueFactor hits (1 + boutique_solo_max_bonus)
    const soloAt100 = computeBaselineMonthlyBilling(m30Rep100, catalog);
    const maxBoutiqueFactor = 1 + (catalog.balance.team_scaling?.boutique_solo_max_bonus ?? 0.5);
    expect(soloAt100).toBe(
      Math.round(
        catalog.balance.base_monthly_billing *
          catalog.balance.reputation_multiplier_max *
          (catalog.balance.moral_multiplier_min +
            0.75 * (catalog.balance.moral_multiplier_max - catalog.balance.moral_multiplier_min)) *
          maxBoutiqueFactor,
      ),
    );
  });

  it("handles set_business_tier, auto-sync with sociedad_limitada_activa, expand_team, shrink_team, multi-staff dismiss_employee, and management stress", () => {
    const catalog = createLiveV2Catalog();
    const base = createInitialGameState(catalog, { seed: "V2-SCALE" });

    // 1. Legacy flag set_flags: [sociedad_limitada_activa] auto-promotes solo_autonomo -> sociedad_limitada and refreshes gestor fee
    const withElena: GameState = {
      ...base,
      month: 36,
      gestor: {
        tier: "premium",
        character_id: "gestor_premium_elena",
        monthly_fee: 260,
        inspection_shield: 0.5,
        months_active: 12,
      },
    };
    const legacySlEvent: EventDef = {
      schema_version: 1,
      id: "gestor_elena_escritura_test",
      category: "gestor",
      title: "Constitución S.L.",
      body: "Firmas ante notario.",
      weight: 5,
      cooldown_months: 0,
      choices: [
        {
          id: "constituir",
          label: "Constituir S.L.",
          effects: { set_flags: ["sociedad_limitada_activa"], deductible_expense: 1200 },
        },
        { id: "esperar", label: "Esperar", effects: { stress: -2 } },
      ],
    };
    const promoted = resolveChoiceEffects(
      withElena,
      catalog,
      legacySlEvent,
      legacySlEvent.choices[0]!,
    );
    expect(promoted.state.business.tier).toBe("sociedad_limitada");
    expect(promoted.state.business.sl_formed_month).toBe(36);
    expect(promoted.state.flags.sociedad_limitada_activa).toBe(true);
    expect(promoted.state.gestor.monthly_fee).toBe(Math.round(260 * 1.95));
    expect(promoted.summary.business_tier_changed_to).toBe("sociedad_limitada");

    // 2. Explicit set_business_tier -> agencia_consultora & expand_team up to cap
    const scaleEvent: EventDef = {
      schema_version: 1,
      id: "empleados_expansion_agencia",
      category: "empleados",
      title: "Salto a Agencia",
      body: "Crecemos plantilla.",
      weight: 5,
      cooldown_months: 0,
      choices: [
        {
          id: "abrir_agencia",
          label: "Subir a Agencia con 4 personas",
          effects: {
            set_business_tier: { tier: "agencia_consultora" },
            expand_team: {
              count: 4,
              lead_character_id: "empleada_senior_laura",
              avg_monthly_cost: 1850,
            },
          },
        },
        { id: "mantener", label: "Mantener", effects: { stress: -2 } },
      ],
    };
    const agency = resolveChoiceEffects(
      promoted.state,
      catalog,
      scaleEvent,
      scaleEvent.choices[0]!,
    );
    expect(agency.state.business.tier).toBe("agencia_consultora");
    expect(agency.state.gestor.monthly_fee).toBe(Math.round(260 * 2.8));
    expect(getTeamHeadcount(agency.state)).toBe(4);
    expect(agency.state.employee?.character_id).toBe("empleada_senior_laura");
    expect(agency.state.employee?.lead_monthly_cost).toBe(2100);
    expect(agency.state.employee?.monthly_cost).toBe(2100 + 3 * 1850);
    expect(agency.summary.team_headcount_delta).toBe(4);

    // Diminishing seat curve: headcount 4 with Laura (2.05) at sat 75 (satScale=1.0)
    const expectedMult = 1 + (1.05 + 0.78 * (1 + 0.95 + 0.95 ** 2));
    expect(computeEffectiveTeamMultiplier(agency.state, catalog)).toBeCloseTo(expectedMult, 6);

    // Management stress overhead: headcount 4 = +2 stress, mitigated by -1 when Laura has sat >= 72 -> +1
    const recurringWithLaura = applyRecurringMonthEconomy(
      {
        ...agency.state,
        month: 40,
        indicators: { ...agency.state.indicators, personal_life: 55, stress: 40 },
      },
      catalog,
    );
    // -baseRelief (pl 55 >= 50) + (+2 - 1 = +1 Laura mgmt)
    expect(recurringWithLaura.passiveStressDelta).toBe(
      -catalog.balance.personal_life_monthly_stress_relief + 1,
    );

    // At headcount >= 4 and stress >= 62, personal_life takes -1 management drain
    const highStressAgency = applyRecurringMonthEconomy(
      {
        ...agency.state,
        month: 40,
        indicators: { ...agency.state.indicators, personal_life: 55, stress: 66 },
      },
      catalog,
    );
    expect(highStressAgency.maintenancePersonalLifeDelta).toBe(-1);
    expect(highStressAgency.state.indicators.personal_life).toBe(54);

    // 3. Multi-staff-safe dismiss_employee removes ONLY 1 person from 4-person team (-5 sat)
    const dismissEvent: EventDef = {
      schema_version: 1,
      id: "empleados_salida_uno",
      category: "empleados",
      title: "Ajuste",
      body: "Sale una persona.",
      weight: 5,
      cooldown_months: 0,
      choices: [
        {
          id: "despedir_uno",
          label: "Rescindir un puesto",
          effects: { dismiss_employee: { severance_cost: 900 } },
        },
        { id: "mantener", label: "Mantener", effects: { stress: 2 } },
      ],
    };
    const afterDismissOne = resolveChoiceEffects(
      agency.state,
      catalog,
      dismissEvent,
      dismissEvent.choices[0]!,
    );
    expect(getTeamHeadcount(afterDismissOne.state)).toBe(3);
    expect(afterDismissOne.state.employee?.monthly_cost).toBe(2100 + 2 * 1850);
    expect(afterDismissOne.state.employee?.satisfaction).toBe(70);
    expect(afterDismissOne.summary.team_headcount_delta).toBe(-1);

    // 4. shrink_team removes 2 people (leaves lead) with -6 layoff shock, then dismiss_all wipes team
    const shrinkEvent: EventDef = {
      schema_version: 1,
      id: "empleados_ere_parcial",
      category: "empleados",
      title: "Reajuste",
      body: "Recortas estructura.",
      weight: 5,
      cooldown_months: 0,
      choices: [
        {
          id: "recortar_dos",
          label: "Recortar 2 puestos",
          effects: { shrink_team: { count: 2, severance_per_person: 1200 } },
        },
        {
          id: "cerrar_todo",
          label: "Disolver plantilla",
          effects: { shrink_team: { count: 12, severance_per_person: 1000, dismiss_all: true } },
        },
      ],
    };
    const afterShrink = resolveChoiceEffects(
      afterDismissOne.state,
      catalog,
      shrinkEvent,
      shrinkEvent.choices[0]!,
    );
    expect(getTeamHeadcount(afterShrink.state)).toBe(1);
    expect(afterShrink.state.employee?.monthly_cost).toBe(2100);
    expect(afterShrink.state.employee?.satisfaction).toBe(64); // 70 - 6
    expect(afterShrink.summary.money_delta).toBe(-2400);
    expect(afterShrink.summary.team_headcount_delta).toBe(-2);

    const afterDismissAll = resolveChoiceEffects(
      afterShrink.state,
      catalog,
      shrinkEvent,
      shrinkEvent.choices[1]!,
    );
    expect(afterDismissAll.state.employee).toBeNull();
    expect(getTeamHeadcount(afterDismissAll.state)).toBe(0);
    expect(afterDismissAll.summary.money_delta).toBe(-1000);
  });

  it("scales opt-in scale_with_tier events and choice money requirements accurately while leaving untagged events fixed", () => {
    const catalog = createLiveV2Catalog();
    const base = createInitialGameState(catalog, { seed: "V2-STAKES" });

    expect(scaleMonetaryValue(1000, 1)).toBe(1000);
    expect(scaleMonetaryValue(0, 3.2)).toBe(0);
    expect(scaleMonetaryValue(1200, 2.15)).toBe(2600); // 2580 -> nearest 50
    expect(scaleMonetaryValue(-120, 1.45)).toBe(-170); // -174 -> nearest 10 (<200)

    const scaledEvent: EventDef = {
      schema_version: 1,
      id: "clientes_proyecto_escalable",
      category: "clientes",
      title: "Licitación clave",
      body: "Te proponen una ampliación con adelanto de producción.",
      scale_with_tier: true,
      weight: 10,
      cooldown_months: 0,
      choices: [
        {
          id: "invertir_y_ejecutar",
          label: "Invertir y asumir el contrato",
          requirements: { stats: { money: { min: 1000 } } },
          effects: {
            billed_income: 2000,
            deductible_expense: 500,
            add_modifier: {
              id: "iguala_escala",
              label: "Iguala",
              remaining_months: 3,
              monthly_billed_delta: 400,
            },
          },
        },
        { id: "rechazar", label: "Rechazar", effects: { stress: -2 } },
      ],
    };

    const agencyState: GameState = {
      ...base,
      business: { tier: "agencia_consultora", months_in_tier: 5, sl_formed_month: 30 },
      indicators: { ...base.indicators, money: 2500 }, // >= 1000 solo, but < 3200 (1000 * 3.20) for Agencia!
    };
    expect(isChoiceEligible(agencyState, scaledEvent.choices[0]!, scaledEvent, catalog)).toBe(
      false,
    );

    const richAgency: GameState = {
      ...agencyState,
      indicators: { ...agencyState.indicators, money: 3500 },
    };
    expect(isChoiceEligible(richAgency, scaledEvent.choices[0]!, scaledEvent, catalog)).toBe(true);

    const preview = getEffectiveScaledChoiceEffects(
      richAgency,
      catalog,
      scaledEvent,
      scaledEvent.choices[0]!.effects!,
    );
    expect(preview.billed_income).toBe(6400); // 2000 * 3.20
    expect(preview.deductible_expense).toBe(1600); // 500 * 3.20
    expect(preview.add_modifier?.monthly_billed_delta).toBe(1300); // 400 * 3.20 = 1280 -> 1300

    const resolved = resolveChoiceEffects(
      richAgency,
      catalog,
      scaledEvent,
      scaledEvent.choices[0]!,
    );
    expect(resolved.summary.money_delta).toBe(6400 - 1600);
    expect(resolved.state.modifiers[0]?.monthly_billed_delta).toBe(1300);
  });

  it("enforces Elena compliance warning/drop, S.L. self penalty, and tier-scaled hard_debt_floor", () => {
    const catalog = createLiveV2Catalog();
    const base = createInitialGameState(catalog, { seed: "V2-COMPLIANCE" });

    // 1. Elena warns at fiscal_risk >= 45, clears < 30, drops client at >= 65
    const elenaState: GameState = {
      ...base,
      month: 9,
      fiscal_risk: 48,
      gestor: {
        tier: "premium",
        character_id: "gestor_premium_elena",
        monthly_fee: 260,
        inspection_shield: 0.5,
        months_active: 6,
      },
      finances: { ...base.finances, accrued_tax_liability: 1000 },
    };
    const warned = prepareQuarterlyTax(
      elenaState,
      catalog,
      () => null,
      () => null,
    );
    expect(warned.report.elena_compliance_event).toBe("warning");
    expect(warned.state.flags.elena_aviso_cumplimiento).toBe(true);
    expect(warned.state.gestor.tier).toBe("premium");

    const cleared = prepareQuarterlyTax(
      { ...warned.state, month: 12, fiscal_risk: 20 },
      catalog,
      () => null,
      () => null,
    );
    expect(cleared.report.elena_compliance_event).toBeNull();
    expect(cleared.state.flags.elena_aviso_cumplimiento).toBeUndefined();

    const dropped = prepareQuarterlyTax(
      { ...elenaState, fiscal_risk: 68 },
      catalog,
      () => null,
      () => null,
    );
    expect(dropped.report.elena_compliance_event).toBe("dropped");
    expect(dropped.state.gestor.tier).toBe("self");
    expect(dropped.state.gestor.inspection_shield).toBe(0);
    expect(dropped.state.flags.elena_rescision_cumplimiento).toBe(true);
    expect(dropped.state.indicators.reputation).toBe(elenaState.indicators.reputation - 8);

    // 2. S.L. managed as self incurs +450 € quarterly penalty
    const slSelfState: GameState = {
      ...base,
      month: 15,
      business: { tier: "sociedad_limitada", months_in_tier: 3, sl_formed_month: 12 },
      gestor: {
        tier: "self",
        character_id: null,
        monthly_fee: 0,
        inspection_shield: 0,
        months_active: 15,
      },
      finances: { ...base.finances, accrued_tax_liability: 1000 },
    };
    const slQuarter = prepareQuarterlyTax(
      slSelfState,
      catalog,
      () => null,
      () => null,
    );
    expect(slQuarter.report.sl_self_penalty).toBe(450);
    expect(slQuarter.report.accrued_tax_due).toBeGreaterThanOrEqual(1450);

    // 3. Tier-scaled hard_debt_floor: -12,000 € is bankrupt for Solo (-5k) but survives in S.L. (-15k)
    expect(getEffectiveHardDebtFloor(base, catalog)).toBe(-5000);
    expect(getEffectiveHardDebtFloor(slSelfState, catalog)).toBe(-15000);
    expect(
      getEffectiveHardDebtFloor(
        {
          ...base,
          business: { tier: "agencia_consultora", months_in_tier: 1, sl_formed_month: 1 },
        },
        catalog,
      ),
    ).toBe(-25000);

    const slWithDebt: GameState = {
      ...slSelfState,
      phase: "quarterly_tax",
      indicators: { ...slSelfState.indicators, money: -10_000 },
      finances: {
        ...slSelfState.finances,
        accrued_tax_liability: 500,
        deferred_tax: { principal: 1000, surcharge: 100, due_month: 15 },
      },
    };
    const settledSl = applyQuarterlySettlement(slWithDebt, catalog, "pay");
    // -10,000 - 1,100 = -11,100 >= -15,000 -> NOT defaulted on S.L.
    expect(settledSl.summary.deferred_tax_defaulted).toBe(false);

    const settledSolo = applyQuarterlySettlement(
      {
        ...slWithDebt,
        business: { tier: "solo_autonomo", months_in_tier: 15, sl_formed_month: null },
      },
      catalog,
      "pay",
    );
    expect(settledSolo.summary.deferred_tax_defaulted).toBe(true);
  });

  it("removes passive moral drain below fiscal_risk 65, tracks 4-year prescripción fiscal expiry, and rolls 14-42m historical audits", () => {
    const histAuditEvent: EventDef = {
      schema_version: 1,
      id: "hacienda_revision_ejercicio_pasado",
      category: "hacienda",
      title: "Revisión de ejercicio anterior",
      body: "Hacienda revisa facturas de hace dos años.",
      tags: ["prescripcion_fiscal", "inspeccion"],
      character_id: "hacienda_inspector_gomez",
      requirements: {
        stats: { fiscal_risk: { min: 40 } },
      },
      weight: 0,
      cooldown_months: 12,
      choices: [
        { id: "regularizar", label: "Regularizar", effects: { cash_delta: -1200, stress: 6 } },
        { id: "alegar", label: "Alegar", effects: { stress: 10 } },
      ],
    };
    const catalog = createLiveV2Catalog([histAuditEvent]);
    const base = createInitialGameState(catalog, { seed: "V2-PRESCRIPCION" });

    // 1. No passive moral/stress drain at fiscal_risk = 55 (< 65)
    const moderateRisk = applyRecurringMonthEconomy(
      {
        ...base,
        fiscal_risk: 55,
        indicators: { ...base.indicators, moral: 55, stress: 30, personal_life: 45 },
      },
      catalog,
    );
    expect(moderateRisk.maintenanceMoralDelta).toBe(0);
    expect(moderateRisk.passiveStressDelta).toBe(0);

    // High paranoia at fiscal_risk = 70 (-1 moral, +1 stress) and 88 (-2 moral, +2 stress)
    const highRisk = applyRecurringMonthEconomy(
      {
        ...base,
        fiscal_risk: 70,
        indicators: { ...base.indicators, moral: 55, stress: 30, personal_life: 45 },
      },
      catalog,
    );
    expect(highRisk.maintenanceMoralDelta).toBe(-1);
    expect(highRisk.passiveStressDelta).toBe(1);

    const extremeRisk = applyRecurringMonthEconomy(
      {
        ...base,
        fiscal_risk: 88,
        indicators: { ...base.indicators, moral: 55, stress: 30, personal_life: 45 },
      },
      catalog,
    );
    expect(extremeRisk.maintenanceMoralDelta).toBe(-2);
    expect(extremeRisk.passiveStressDelta).toBe(2);

    // 2. Recording FiscalExposureEntry on risky en B choice
    const enBEvent: EventDef = {
      schema_version: 1,
      id: "clientes_sobre_grande",
      category: "clientes",
      title: "Cobro en mano",
      body: "Efectivo sin factura.",
      weight: 5,
      cooldown_months: 0,
      choices: [
        { id: "aceptar", label: "Aceptar", effects: { cash_delta: 2500, fiscal_risk: 14 } },
        { id: "rechazar", label: "Rechazar", effects: { stress: -2 } },
      ],
    };
    const afterEnB = resolveChoiceEffects(
      { ...base, month: 6 },
      catalog,
      enBEvent,
      enBEvent.choices[0]!,
    ).state;
    expect(afterEnB.finances.historical_exposures).toHaveLength(1);
    expect(afterEnB.finances.historical_exposures[0]).toMatchObject({
      origin_month: 6,
      expires_month: 54,
      risk_points: 14,
      untaxed_amount: 2500,
      audited: false,
    });

    // 3. Clean expiry at month === 54 prunes exposure and sets flags.ejercicio_prescrito_limpio
    const expired = applyRecurringMonthEconomy({ ...afterEnB, month: 54 }, catalog).state;
    expect(expired.finances.historical_exposures).toHaveLength(0);
    expect(expired.flags.ejercicio_prescrito_limpio).toBe(true);

    // 4. Quarterly historical audit roll at age 24 (month 30) triggers even with current fiscal_risk = 0,
    // schedules prescripcion_fiscal event with source_event_id: "historical_audit", and bypasses fiscal_risk.min on draw
    const guaranteedHistCatalog: ContentCatalog = {
      ...catalog,
      balance: {
        ...catalog.balance,
        prescripcion: {
          ...catalog.balance.prescripcion!,
          base_quarterly_prob: 1,
          max_quarterly_prob: 1,
        },
      },
    };
    const qAudit = prepareQuarterlyTax(
      {
        ...afterEnB,
        month: 30,
        fiscal_risk: 0,
        finances: {
          ...afterEnB.finances,
          accrued_tax_liability: 0,
        },
      },
      guaranteedHistCatalog,
      selectInspectableHaciendaEvent,
      selectHistoricalAuditEvent,
    );
    expect(qAudit.report.historical_audit_triggered).toBe(true);
    expect(qAudit.report.inspection_scheduled_event_id).toBe("hacienda_revision_ejercicio_pasado");
    expect(qAudit.state.flags.auditoria_ejercicio_anterior).toBe(true);
    expect(qAudit.state.finances.historical_exposures[0]?.audited).toBe(true);
    expect(qAudit.state.scheduled_queue[0]).toMatchObject({
      event_id: "hacienda_revision_ejercicio_pasado",
      source_event_id: "historical_audit",
      priority: "high",
      origin_month: 30,
    });

    const settled = settleQuarter(qAudit.state, guaranteedHistCatalog, "pay");
    expect(settled.state.month).toBe(31);
    expect(settled.state.current_turn_events[0]).toBe("hacienda_revision_ejercicio_pasado");
  });

  it("tracks partner neglect_months, dynamic support_modifier gating, contextual weights, and priority/long-horizon queue rules", () => {
    const partnerCrisisEvent: EventDef = {
      schema_version: 1,
      id: "familia_ultimatum_alex",
      category: "familia",
      title: "Conversación pendiente",
      body: "Álex pide hablar en serio.",
      tags: ["crisis_pareja", "pareja_ultimatum"],
      character_id: "pareja_alex",
      weight: 10,
      cooldown_months: 0,
      choices: [
        { id: "escuchar", label: "Escuchar", effects: { personal_life: 10 } },
        { id: "posponer", label: "Posponer", effects: { personal_life: -8 } },
      ],
    };
    const partnerSynergyEvent: EventDef = {
      schema_version: 1,
      id: "familia_contacto_alex",
      category: "familia",
      title: "Recomendación en casa",
      body: "Álex te presenta un contacto clave.",
      tags: ["sinergia_pareja"],
      character_id: "pareja_alex",
      weight: 10,
      cooldown_months: 0,
      choices: [
        { id: "aceptar", label: "Aceptar", effects: { reputation: 6 } },
        { id: "agradecer", label: "Agradecer", effects: { moral: 2 } },
      ],
    };
    const slTierEvent: EventDef = {
      schema_version: 1,
      id: "clientes_licitacion_sl",
      category: "clientes",
      title: "Concurso S.L.",
      body: "Solo sociedades.",
      requirements: { business_tiers: ["sociedad_limitada", "agencia_consultora"] },
      weight: 10,
      cooldown_months: 0,
      choices: [
        { id: "presentar", label: "Presentar", effects: { billed_income: 8000 } },
        { id: "pasar", label: "Pasar", effects: { stress: -2 } },
      ],
    };
    const catalog = createLiveV2Catalog([partnerCrisisEvent, partnerSynergyEvent, slTierEvent]);
    const base = createInitialGameState(catalog, { seed: "V2-PARTNER-QUEUE" });

    // Partnered with low personal_life (<=38): support suspended + +1 friction, neglect_months increments, crisis_pareja_latente at 4
    const partnered: GameState = {
      ...base,
      indicators: { ...base.indicators, personal_life: 32, stress: 40 },
      family: {
        status: "cohabiting",
        partner_character_id: "pareja_alex",
        partner_name: "Álex",
        children_count: 0,
        monthly_cost: 180,
        support_modifier: 1,
        neglect_months: 3,
      },
    };
    const strained = applyRecurringMonthEconomy(partnered, catalog);
    expect(strained.state.family.neglect_months).toBe(4);
    expect(strained.state.flags.crisis_pareja_latente).toBe(true);
    expect(strained.passiveStressDelta).toBe(1); // support suspended + +1 home friction

    // Partnered with high personal_life (>=70): support + extra -1 synergy
    const happyPartner = applyRecurringMonthEconomy(
      {
        ...partnered,
        indicators: { ...partnered.indicators, personal_life: 74, stress: 40 },
        family: { ...partnered.family, neglect_months: 1 },
        flags: { crisis_pareja_latente: true },
      },
      catalog,
    );
    expect(happyPartner.state.family.neglect_months).toBe(0);
    expect(happyPartner.state.flags.crisis_pareja_latente).toBeUndefined();
    // -baseRelief personal_life relief (74 < 76) - 1 support_modifier - 1 synergy
    expect(happyPartner.passiveStressDelta).toBe(
      -catalog.balance.personal_life_monthly_stress_relief - 2,
    );

    // Contextual weight multipliers
    expect(computeEffectiveEventWeight(partnerCrisisEvent, strained.state, catalog)).toBeCloseTo(
      10 * 2.8,
      6,
    );
    expect(
      computeEffectiveEventWeight(
        partnerCrisisEvent,
        { ...strained.state, indicators: { ...strained.state.indicators, personal_life: 20 } },
        catalog,
      ),
    ).toBeCloseTo(10 * 4.5, 6);
    expect(
      computeEffectiveEventWeight(partnerSynergyEvent, happyPartner.state, catalog),
    ).toBeCloseTo(10 * 2.0, 6);
    expect(
      computeEffectiveEventWeight(
        slTierEvent,
        {
          ...base,
          business: { tier: "sociedad_limitada", months_in_tier: 2, sl_formed_month: 20 },
        },
        catalog,
      ),
    ).toBeCloseTo(10 * 1.8, 6);

    // Scheduled queue: ±6m deduplication, priority sorting, and 12m long-horizon deferral
    let q = enqueueScheduledEvent([], {
      queue_id: "q1",
      event_id: "clientes_encargo_urgente",
      trigger_month: 10,
      origin_month: 8,
      priority: "normal",
      source_event_id: "test",
    });
    // Duplicate within ±6m is skipped
    q = enqueueScheduledEvent(q, {
      queue_id: "q_dup",
      event_id: "clientes_encargo_urgente",
      trigger_month: 15,
      origin_month: 9,
      priority: "normal",
      source_event_id: "test",
    });
    expect(q).toHaveLength(1);
    // Distinct distant follow-up (>6m apart) IS accepted
    q = enqueueScheduledEvent(q, {
      queue_id: "q_far",
      event_id: "clientes_encargo_urgente",
      trigger_month: 17,
      origin_month: 9,
      priority: "normal",
      source_event_id: "test",
    });
    expect(q).toHaveLength(2);

    // Priority "high" wins Slot 1 over earlier/FIFO "normal" due item
    const prioDraw = drawTurnEvents(
      {
        ...base,
        month: 10,
        scheduled_queue: [
          {
            queue_id: "q_norm",
            event_id: "clientes_encargo_urgente",
            trigger_month: 9,
            origin_month: 7,
            priority: "normal",
            source_event_id: "test",
          },
          {
            queue_id: "q_high",
            event_id: "gestor_oferta_servicios",
            trigger_month: 10,
            origin_month: 8,
            priority: "high",
            source_event_id: "test",
          },
        ],
      },
      catalog,
    );
    expect(prioDraw.drawnEventIds[0]).toBe("gestor_oferta_servicios");

    // Long-horizon (>=12m) event defers up to 12 times before dropping
    let longState: GameState = {
      ...base,
      month: 20,
      scheduled_queue: [
        {
          queue_id: "q_long",
          event_id: "clientes_licitacion_sl", // ineligible while solo_autonomo
          trigger_month: 20,
          origin_month: 8, // 12m horizon
          priority: "normal",
          source_event_id: "test",
        },
      ],
    };
    for (let d = 1; d <= 12; d += 1) {
      const drawn = drawTurnEvents(longState, catalog);
      expect(drawn.state.scheduled_queue).toHaveLength(1);
      expect(drawn.state.scheduled_queue[0]?.deferred_months).toBe(d);
      longState = { ...drawn.state, month: longState.month + 1 };
    }
    const droppedOn13th = drawTurnEvents(longState, catalog);
    expect(droppedOn13th.state.scheduled_queue).toHaveLength(0);
  });

  it("enforces new v2 requirements (business_tiers, team_size, children_count) and ADR 004 §6.3 content validator rules", () => {
    const catalog = createLiveV2Catalog();
    const base = createInitialGameState(catalog, { seed: "V2-REQS" });

    expect(hasActiveRequirements({ business_tiers: ["sociedad_limitada"] })).toBe(true);
    expect(hasActiveRequirements({ team_size: { min: 2 } })).toBe(true);
    expect(hasActiveRequirements({ children_count: { min: 1 } })).toBe(true);
    expect(evaluateRequirements(base, { business_tiers: ["solo_autonomo"] })).toBe(true);
    expect(evaluateRequirements(base, { business_tiers: ["sociedad_limitada"] })).toBe(false);
    expect(evaluateRequirements(base, { team_size: { max: 0 } })).toBe(true);
    expect(evaluateRequirements(base, { team_size: { min: 1 } })).toBe(false);
    expect(evaluateRequirements(base, { children_count: { min: 1 } })).toBe(false);
    expect(
      evaluateRequirements(
        { ...base, family: { ...base.family, children_count: 2 } },
        { children_count: { min: 1, max: 3 } },
      ),
    ).toBe(true);

    // Anti-softlock rejects event where all choices are gated by new v2 requirements
    expect(
      EventSchema.safeParse({
        schema_version: 1,
        id: "clientes_bloqueo_v2",
        category: "clientes",
        title: "Bloqueado",
        body: "Sin alternativa libre.",
        weight: 5,
        cooldown_months: 0,
        choices: [
          {
            id: "solo_sl",
            label: "Opción S.L.",
            requirements: { business_tiers: ["sociedad_limitada"] },
            effects: { billed_income: 5000 },
          },
          {
            id: "solo_equipo",
            label: "Opción equipo",
            requirements: { team_size: { min: 2 } },
            effects: { billed_income: 3000 },
          },
        ],
      }).success,
    ).toBe(false);

    // Temp workspace validator checks for ADR 004 §6.3
    const dir = mkdtempSync(join(tmpdir(), "autonomo-v2-val-"));
    try {
      mkdirSync(join(dir, "assets", "characters"), { recursive: true });
      mkdirSync(join(dir, "assets", "ui"), { recursive: true });
      mkdirSync(join(dir, "content", "config"), { recursive: true });
      mkdirSync(join(dir, "content", "characters"), { recursive: true });
      for (const cat of ["clientes", "hacienda", "familia", "empleados", "gestor"]) {
        mkdirSync(join(dir, "content", "events", cat), { recursive: true });
      }
      const manifest = createFixtureManifest();
      writeFileSync(join(dir, "assets", "manifest.json"), JSON.stringify(manifest, null, 2));
      for (const entry of Object.values(manifest.assets)) {
        writeFileSync(
          join(dir, "assets", entry.path),
          `<svg xmlns="http://www.w3.org/2000/svg" width="${entry.width}" height="${entry.height}" viewBox="0 0 ${entry.width} ${entry.height}"><rect width="10" height="10"/></svg>`,
        );
      }
      for (const rel of Object.values(manifest.fallbacks)) {
        writeFileSync(
          join(dir, "assets", rel),
          `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320" viewBox="0 0 512 320"><rect width="10" height="10"/></svg>`,
        );
      }
      writeFileSync(
        join(dir, "content", "config", "balance.yaml"),
        readFileSync(join(process.cwd(), "content/config/balance.yaml"), "utf8"),
      );
      for (const charDef of Object.values(createFixtureCharacters())) {
        writeFileSync(
          join(dir, "content", "characters", `${charDef.id}.yaml`),
          stringifyYaml(charDef),
        );
      }

      // Valid hire_employee guarded by team_size.max === 0 + valid prescripcion_fiscal weight:0 event
      writeFileSync(
        join(dir, "content", "events", "empleados", "empleados_team_size_guard.yaml"),
        stringifyYaml({
          schema_version: 1,
          id: "empleados_team_size_guard",
          category: "empleados",
          title: "Primer fichaje con team_size",
          body: "Sin plantilla actual.",
          requirements: { team_size: { max: 0 } },
          weight: 5,
          cooldown_months: 6,
          choices: [
            {
              id: "fichar",
              label: "Fichar",
              effects: { hire_employee: { character_id: "empleado_junior_dani" } },
            },
            { id: "pasar", label: "Pasar", effects: { stress: -2 } },
          ],
        }),
      );
      writeFileSync(
        join(dir, "content", "events", "hacienda", "hacienda_prescripcion_test.yaml"),
        stringifyYaml({
          schema_version: 1,
          id: "hacienda_prescripcion_test",
          category: "hacienda",
          title: "Auditoría histórica",
          body: "Revisión de hace 2 años.",
          tags: ["prescripcion_fiscal"],
          weight: 0,
          cooldown_months: 12,
          choices: [
            { id: "pagar", label: "Pagar", effects: { cash_delta: -900 } },
            { id: "alegar", label: "Alegar", effects: { stress: 8 } },
          ],
        }),
      );
      expect(loadAndValidateContent(dir).ok).toBe(true);

      // Invalid scale_with_tier with literal € + invalid expand_team.lead_character_id role
      writeFileSync(
        join(dir, "content", "events", "clientes", "clientes_bad_scale.yaml"),
        stringifyYaml({
          schema_version: 1,
          id: "clientes_bad_scale",
          category: "clientes",
          title: "Contrato de 5.000 €",
          body: "Paga 5.000 €.",
          scale_with_tier: true,
          weight: 5,
          cooldown_months: 0,
          choices: [
            {
              id: "aceptar",
              label: "Cobrar 5.000 €",
              effects: {
                billed_income: 5000,
                expand_team: { count: 1, lead_character_id: "pareja_alex" },
              },
            },
            { id: "pasar", label: "Pasar", effects: { stress: -1 } },
          ],
        }),
      );
      const invalid = loadAndValidateContent(dir);
      expect(invalid.ok).toBe(false);
      expect(invalid.errors.some((e) => e.includes("title must not contain literal '€'"))).toBe(
        true,
      );
      expect(invalid.errors.some((e) => e.includes("body must not contain literal '€'"))).toBe(
        true,
      );
      expect(invalid.errors.some((e) => e.includes("label must not contain literal '€'"))).toBe(
        true,
      );
      expect(
        invalid.errors.some((e) =>
          e.includes("expand_team lead_character_id 'pareja_alex' must have role 'empleado'"),
        ),
      ).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("clamps expand_team to business tier max_team_size, swaps lead cleanly, applies historical audit fallback fine, and merges extra EN locale shards deterministically", () => {
    const catalog = createLiveV2Catalog();
    const base = createInitialGameState(catalog, { seed: "V2-EDGE-CASES" });

    // 1. expand_team respects tier cap (estudio_consolidado max_team_size = 3) and upgrades lead Dani -> Laura
    const estudioBase: GameState = {
      ...base,
      business: { tier: "estudio_consolidado", months_in_tier: 2, sl_formed_month: null },
      employee: {
        character_id: "empleado_junior_dani",
        role_label: "Junior Multiusos",
        headcount: 1,
        lead_monthly_cost: 1350,
        monthly_cost: 1350,
        billing_multiplier: 1.58,
        satisfaction: 75,
        months_employed: 4,
      },
    };
    const expandTooMany: EventDef = {
      schema_version: 1,
      id: "empleados_subida_tope",
      category: "empleados",
      title: "Ampliación al tope",
      body: "Incorporas refuerzos.",
      weight: 5,
      cooldown_months: 0,
      choices: [
        {
          id: "ampliar",
          label: "Ampliar",
          effects: {
            expand_team: {
              count: 5,
              lead_character_id: "empleada_senior_laura",
              avg_monthly_cost: 1850,
            },
          },
        },
        { id: "esperar", label: "Esperar", effects: { stress: -1 } },
      ],
    };
    const capped = resolveChoiceEffects(
      estudioBase,
      catalog,
      expandTooMany,
      expandTooMany.choices[0]!,
    );
    expect(getTeamHeadcount(capped.state)).toBe(3); // capped at estudio_consolidado max 3
    expect(capped.state.employee?.character_id).toBe("empleada_senior_laura");
    expect(capped.state.employee?.lead_monthly_cost).toBe(2100);
    expect(capped.state.employee?.monthly_cost).toBe(2100 + 2 * 1850);
    expect(capped.summary.team_headcount_delta).toBe(2);

    // 2. Historical audit fallback fine when no prescripcion_fiscal event exists in catalog
    const guaranteedHistCatalog: ContentCatalog = {
      ...catalog,
      balance: {
        ...catalog.balance,
        prescripcion: {
          ...catalog.balance.prescripcion!,
          base_quarterly_prob: 1,
          max_quarterly_prob: 1,
        },
      },
    };
    const histFallback = prepareQuarterlyTax(
      {
        ...base,
        month: 30,
        fiscal_risk: 0,
        finances: {
          ...base.finances,
          accrued_tax_liability: 0,
          historical_exposures: [
            {
              id: "exp_old_1",
              origin_month: 6,
              expires_month: 54,
              risk_points: 20,
              untaxed_amount: 3000,
              source_event_id: "clientes_pago_sin_factura",
              audited: false,
            },
          ],
        },
      },
      guaranteedHistCatalog,
      selectInspectableHaciendaEvent,
      selectHistoricalAuditEvent,
    );
    expect(histFallback.report.historical_audit_triggered).toBe(true);
    expect(histFallback.report.inspection_scheduled_event_id).toBeNull();
    // Math.max(600, Math.round(3000 * 0.45 + 20 * 18)) = Math.max(600, 1710) = 1710
    expect(histFallback.report.inspection_fallback_fine).toBe(1710);

    // 3. End-to-end applyPlayerChoice unlocks rich_250k only at >= 250,000 € (NOT at 160,000 €!)
    const routineCatalog: ContentCatalog = {
      ...catalog,
      events: [
        {
          schema_version: 1,
          id: "clientes_rutina_v2",
          category: "clientes",
          title: "Rutina",
          body: "Mes normal.",
          weight: 10,
          cooldown_months: 0,
          choices: [
            { id: "ok", label: "Ok", effects: { billed_income: 500 } },
            { id: "calma", label: "Calma", effects: { stress: -2 } },
          ],
        },
      ],
    };
    const at160k = applyPlayerChoice(
      {
        ...base,
        month: 10,
        phase: "event_resolution",
        indicators: { ...base.indicators, money: 160_000 },
        current_turn_events: ["clientes_rutina_v2"],
      },
      routineCatalog,
      "ok",
    );
    expect(at160k.state.earned_victories).not.toContain("rich_250k");
    expect(at160k.state.phase).toBe("event_resolution");

    const at250k = applyPlayerChoice(
      {
        ...base,
        month: 10,
        phase: "event_resolution",
        indicators: { ...base.indicators, money: 250_000 },
        current_turn_events: ["clientes_rutina_v2"],
      },
      routineCatalog,
      "ok",
    );
    expect(at250k.state.earned_victories).toContain("rich_250k");
    expect(at250k.state.phase).toBe("victory_prompt");

    // 4. validate-locales.ts and compile-content.ts discover & merge arbitrary EN shards deterministically and reject duplicates
    const localeDir = mkdtempSync(join(tmpdir(), "autonomo-v2-loc-"));
    try {
      mkdirSync(join(localeDir, "content", "events", "familia"), { recursive: true });
      mkdirSync(join(localeDir, "content", "events", "clientes"), { recursive: true });
      mkdirSync(join(localeDir, "content", "locales", "en"), { recursive: true });
      mkdirSync(join(localeDir, "src", "content"), { recursive: true });

      writeFileSync(
        join(localeDir, "content", "events", "familia", "familia_v2_test.yaml"),
        stringifyYaml({
          schema_version: 1,
          id: "familia_v2_test",
          category: "familia",
          title: "Título familia",
          body: "Cuerpo familia.",
          weight: 5,
          cooldown_months: 0,
          choices: [
            { id: "op_a", label: "Op A", result_text: "Res A", effects: { moral: 1 } },
            { id: "op_b", label: "Op B", effects: { moral: -1 } },
          ],
        }),
      );
      writeFileSync(
        join(localeDir, "content", "events", "clientes", "clientes_v2_test.yaml"),
        stringifyYaml({
          schema_version: 1,
          id: "clientes_v2_test",
          category: "clientes",
          title: "Título cliente",
          body: "Cuerpo cliente.",
          weight: 5,
          cooldown_months: 0,
          choices: [
            { id: "op_a", label: "Op A", effects: { moral: 1 } },
            { id: "op_b", label: "Op B", effects: { moral: -1 } },
          ],
        }),
      );

      writeFileSync(
        join(localeDir, "content", "locales", "en", "v2_life_and_long_arcs.yaml"),
        stringifyYaml({
          "familia_v2_test.title": "Family title",
          "familia_v2_test.body": "Family body.",
          "familia_v2_test.choices.op_a.label": "Opt A",
          "familia_v2_test.choices.op_a.result_text": "Res A EN",
          "familia_v2_test.choices.op_b.label": "Opt B",
        }),
      );
      writeFileSync(
        join(localeDir, "content", "locales", "en", "v2_scale_and_agency.yaml"),
        stringifyYaml({
          "clientes_v2_test.title": "Client title",
          "clientes_v2_test.body": "Client body.",
          "clientes_v2_test.choices.op_a.label": "Opt A",
          "clientes_v2_test.choices.op_b.label": "Opt B",
        }),
      );

      const valRes = validateLocales(localeDir, "en");
      expect(valRes.ok).toBe(true);
      expect(valRes.keyCount).toBe(9);

      const compiled = compileLocaleOverlays(localeDir);
      expect(Object.keys(compiled.en!)).toEqual([
        "clientes_v2_test.body",
        "clientes_v2_test.choices.op_a.label",
        "clientes_v2_test.choices.op_b.label",
        "clientes_v2_test.title",
        "familia_v2_test.body",
        "familia_v2_test.choices.op_a.label",
        "familia_v2_test.choices.op_a.result_text",
        "familia_v2_test.choices.op_b.label",
        "familia_v2_test.title",
      ]);

      // Duplicate key across shards must throw in compileLocaleOverlays
      writeFileSync(
        join(localeDir, "content", "locales", "en", "v2_scale_and_agency.yaml"),
        stringifyYaml({
          "clientes_v2_test.title": "Client title",
          "clientes_v2_test.body": "Client body.",
          "clientes_v2_test.choices.op_a.label": "Opt A",
          "clientes_v2_test.choices.op_b.label": "Opt B",
          "familia_v2_test.title": "Duplicate!",
        }),
      );
      expect(() => compileLocaleOverlays(localeDir)).toThrow(/duplicate translation key/i);
    } finally {
      rmSync(localeDir, { recursive: true, force: true });
    }
  });
});
