import { describe, expect, it } from "vitest";
import {
  type ContentCatalog,
  type EventDef,
  type GameState,
  applyPlayerChoice,
  computeEffectiveEventWeight,
  createInitialGameState,
  dismissAnnualSummary,
  drawTurnEvents,
  evaluateRequirements,
  findInspectableHaciendaEventId,
  getActiveEvent,
  isInspectableHaciendaEvent,
  prepareQuarterlyTax,
  resolveChoiceEffects,
  resolveVictoryPrompt,
  retireFromRun,
  selectInspectableHaciendaEvent,
  settleQuarter,
  startNewRun,
} from "../../src/engine/index.ts";
import { createFixtureBalance, createFixtureCharacters, createFixtureEvents } from "./fixtures.ts";

function stepOneAction(state: GameState, catalog: ContentCatalog): GameState {
  if (state.phase === "event_resolution") {
    const view = getActiveEvent(state, catalog)!;
    const eligible = view.choices.find((c) => c.eligible)!;
    return applyPlayerChoice(state, catalog, eligible.choice.id).state;
  }
  if (state.phase === "quarterly_tax") {
    return settleQuarter(state, catalog, "pay").state;
  }
  if (state.phase === "victory_prompt") {
    return resolveVictoryPrompt(state, catalog, "continue").state;
  }
  if (state.phase === "annual_summary") {
    return dismissAnnualSummary(state, catalog).state;
  }
  return state;
}

describe("Turn pipeline, cooldown relaxation, victories, annual summary & save determinism", () => {
  it("relaxes cooldowns when every repeatable random event is on cooldown", () => {
    const singleLongCooldownCatalog: ContentCatalog = {
      balance: createFixtureBalance(),
      characters: createFixtureCharacters(),
      events: [
        {
          schema_version: 1,
          id: "clientes_unico_evento",
          category: "clientes",
          title: "Único evento",
          body: "Con enfriamiento largo.",
          weight: 10,
          cooldown_months: 12,
          choices: [
            { id: "seguir", label: "Seguir", effects: { billed_income: 500, stress: -2 } },
            { id: "descansar", label: "Descansar", effects: { stress: -4 } },
          ],
        },
      ],
    };

    const m1 = startNewRun(singleLongCooldownCatalog, { seed: "RELAX-1" });
    expect(m1.state.current_turn_events).toEqual(["clientes_unico_evento"]);

    const m2 = applyPlayerChoice(m1.state, singleLongCooldownCatalog, "seguir");
    expect(m2.state.month).toBe(2);
    expect(m2.resolution.monthStart?.cooldown_relaxed).toBe(true);
    expect(m2.state.current_turn_events).toEqual(["clientes_unico_evento"]);
  });

  it("caps scheduled chain events at 1 per month and spills excess FIFO to the next month", () => {
    const catalog: ContentCatalog = {
      balance: createFixtureBalance(),
      characters: createFixtureCharacters(),
      events: createFixtureEvents(),
    };

    const started = startNewRun(catalog, { seed: "FIFO-QUEUE" });
    const withQueued: GameState = {
      ...started.state,
      flags: { cobro_en_b_reciente: true },
      scheduled_queue: [
        {
          queue_id: "q1",
          event_id: "hacienda_carta_certificada",
          trigger_month: 2,
          source_event_id: "test",
        },
        {
          queue_id: "q2",
          event_id: "gestor_oferta_servicios",
          trigger_month: 2,
          source_event_id: "test",
        },
      ],
      current_turn_events: ["clientes_encargo_urgente"],
    };

    const intoMonth2 = applyPlayerChoice(withQueued, catalog, "poner_limites");
    expect(intoMonth2.state.month).toBe(2);
    expect(intoMonth2.state.current_turn_events.length).toBe(2);
    expect(intoMonth2.state.current_turn_events[0]).toBe("hacienda_carta_certificada");
    expect(intoMonth2.state.scheduled_queue.map((q) => q.queue_id)).toEqual(["q2"]);
  });

  it("handles Month 12 annual summary, victory prompts, Endless mode, and badge retention", () => {
    const catalog: ContentCatalog = {
      balance: createFixtureBalance(),
      characters: createFixtureCharacters(),
      events: [
        {
          schema_version: 1,
          id: "clientes_rutina",
          category: "clientes",
          title: "Rutina",
          body: "Mes tranquilo.",
          weight: 10,
          cooldown_months: 0,
          choices: [
            { id: "facturar", label: "Facturar", effects: { billed_income: 700, stress: -2 } },
            { id: "calma", label: "Calma", effects: { stress: -5 } },
            { id: "quemarse", label: "Quemarse", effects: { stress: 15 } },
          ],
        },
      ],
    };

    let { state } = startNewRun(catalog, { seed: "ANNUAL-AND-VICTORY" });
    while (state.month < 12 || state.phase !== "annual_summary") {
      state = stepOneAction(state, catalog);
    }

    expect(state.month).toBe(12);
    expect(state.phase).toBe("annual_summary");

    state = dismissAnnualSummary(state, catalog).state;
    expect(state.month).toBe(13);
    expect(state.phase).toBe("event_resolution");

    const richSetup: GameState = {
      ...state,
      indicators: { ...state.indicators, money: 160000 },
      current_turn_events: ["clientes_rutina"],
    };
    const afterRichTurn = applyPlayerChoice(richSetup, catalog, "facturar");
    expect(afterRichTurn.state.phase).toBe("victory_prompt");
    expect(afterRichTurn.state.earned_victories).toContain("rich_150k");

    const endless = resolveVictoryPrompt(afterRichTurn.state, catalog, "continue");
    expect(endless.state.endless_mode).toBe(true);
    expect(endless.state.earned_victories).toContain("rich_150k");

    const burnoutSetup: GameState = {
      ...endless.state,
      indicators: { ...endless.state.indicators, stress: 95 },
      current_turn_events: ["clientes_rutina"],
    };
    const burnedOut = applyPlayerChoice(burnoutSetup, catalog, "quemarse");
    expect(burnedOut.state.phase).toBe("game_over");
    expect(burnedOut.state.ending?.id).toBe("defeat_burnout_stress");
    expect(burnedOut.state.earned_victories).toContain("rich_150k");
  });

  it("preserves exact state determinism across mid-month JSON save/reload", () => {
    const catalog: ContentCatalog = {
      balance: createFixtureBalance(),
      characters: createFixtureCharacters(),
      events: createFixtureEvents(),
    };

    let continuous = startNewRun(catalog, { seed: "SAVE-PARITY-99" }).state;
    let reloaded = startNewRun(catalog, { seed: "SAVE-PARITY-99" }).state;

    for (let step = 0; step < 30; step += 1) {
      if (continuous.phase === "game_over") {
        break;
      }
      continuous = stepOneAction(continuous, catalog);
      reloaded = JSON.parse(JSON.stringify(reloaded)) as GameState;
      reloaded = stepOneAction(reloaded, catalog);
      expect(reloaded).toEqual(continuous);
    }
  });

  it("captures postChoiceState at Month N before advancing to Month N+1 recurring economy", () => {
    const catalog: ContentCatalog = {
      balance: createFixtureBalance(),
      characters: createFixtureCharacters(),
      events: [
        {
          schema_version: 1,
          id: "familia_gasto_directo",
          category: "familia",
          title: "Gasto imprevisto",
          body: "Toca pagar reparación doméstica.",
          weight: 10,
          cooldown_months: 0,
          choices: [
            {
              id: "pagar_reparacion",
              label: "Pagar 400 €",
              result_text: "Pagas al contado.",
              effects: { cash_delta: -400, stress: -3 },
            },
            {
              id: "ignorar",
              label: "Ignorar",
              result_text: "Lo dejas pasar.",
              effects: { stress: 5 },
            },
          ],
        },
      ],
    };

    const started = startNewRun(catalog, { seed: "POST-CHOICE-SNAPSHOT" });
    const month1MoneyBeforeChoice = started.state.indicators.money;
    expect(started.state.month).toBe(1);

    const step = applyPlayerChoice(started.state, catalog, "pagar_reparacion");

    // Headless next state already advanced to Month 2 with Month 2 recurring economy
    expect(step.state.month).toBe(2);
    expect(step.resolution.monthStart?.month).toBe(2);

    // postChoiceState preserves exact Month 1 state & -400 € cash delta before Month 2 billing
    expect(step.resolution.postChoiceState).toBeDefined();
    expect(step.resolution.postChoiceState!.month).toBe(1);
    expect(step.resolution.postChoiceState!.current_turn_events).toEqual([]);
    expect(step.resolution.postChoiceState!.indicators.money).toBe(month1MoneyBeforeChoice - 400);
    expect(step.resolution.choiceOutcome?.money_delta).toBe(-400);
  });

  it("evaluates seasonal months_of_year and employee_satisfaction requirements and effects", () => {
    const catalog: ContentCatalog = {
      balance: createFixtureBalance(),
      characters: createFixtureCharacters(),
      events: createFixtureEvents(),
    };
    const base = createInitialGameState(catalog, { seed: "SEASONAL-AND-EMP-SAT" });

    // months_of_year: 1 = Jan, 8 = Aug (Month 8 & Month 20), 12 = Dec (Month 12 & Month 24)
    expect(evaluateRequirements({ ...base, month: 8 }, { months_of_year: [8] })).toBe(true);
    expect(evaluateRequirements({ ...base, month: 20 }, { months_of_year: [8] })).toBe(true);
    expect(evaluateRequirements({ ...base, month: 7 }, { months_of_year: [8] })).toBe(false);
    expect(evaluateRequirements({ ...base, month: 24 }, { months_of_year: [4, 8, 12] })).toBe(true);

    // employee_satisfaction evaluates false when state.employee === null
    expect(evaluateRequirements(base, { employee_satisfaction: { min: 50 } })).toBe(false);
    expect(evaluateRequirements(base, { employee_satisfaction: { max: 50 } })).toBe(false);

    const hired = resolveChoiceEffects(
      { ...base, month: 5 },
      catalog,
      catalog.events.find((e) => e.id === "empleados_primer_fichaje")!,
      catalog.events.find((e) => e.id === "empleados_primer_fichaje")!.choices[0],
    ).state;
    expect(hired.employee?.satisfaction).toBe(75);
    expect(evaluateRequirements(hired, { employee_satisfaction: { min: 60, max: 80 } })).toBe(true);
    expect(evaluateRequirements(hired, { employee_satisfaction: { max: 50 } })).toBe(false);

    // Effects: employee_satisfaction clamps [0, 100], tracks delta, and is a no-op when null
    const satEvent: EventDef = {
      schema_version: 1,
      id: "empleados_clima_equipo",
      category: "empleados",
      title: "Clima laboral",
      body: "Revisión con el equipo.",
      weight: 5,
      cooldown_months: 0,
      choices: [
        {
          id: "subir_animo",
          label: "Dar bonus",
          effects: { billed_income: 1000, employee_satisfaction: 40 },
        },
        {
          id: "exprimir_entrega",
          label: "Exigir horas extra",
          effects: { deductible_expense: 500, employee_satisfaction: -90 },
        },
      ],
    };

    const noopOnSolo = resolveChoiceEffects(base, catalog, satEvent, satEvent.choices[0]);
    expect(noopOnSolo.state.employee).toBeNull();
    expect(noopOnSolo.summary.employee_satisfaction_delta).toBe(0);
    expect(noopOnSolo.summary.tax_accrued_delta).toBe(Math.round(1000 * 0.28));

    const clampedHigh = resolveChoiceEffects(hired, catalog, satEvent, satEvent.choices[0]);
    expect(clampedHigh.state.employee?.satisfaction).toBe(100);
    expect(clampedHigh.summary.employee_satisfaction_delta).toBe(25);

    const clampedLow = resolveChoiceEffects(hired, catalog, satEvent, satEvent.choices[1]);
    expect(clampedLow.state.employee?.satisfaction).toBe(0);
    expect(clampedLow.summary.employee_satisfaction_delta).toBe(-75);
    // Starting accrued_tax_liability is 0, so deductible relief clamps at 0 -> tax_accrued_delta = 0
    expect(clampedLow.summary.tax_accrued_delta).toBe(0);
  });

  it("tracks Álex relationship flags and clears partner_character_id upon separation", () => {
    const catalog: ContentCatalog = {
      balance: createFixtureBalance(),
      characters: createFixtureCharacters(),
      events: createFixtureEvents(),
    };
    const base = createInitialGameState(catalog, { seed: "ALEX-RELATIONSHIP" });
    const familyEvent = catalog.events.find((e) => e.id === "familia_plan_fin_de_semana")!;

    const dating = resolveChoiceEffects(base, catalog, familyEvent, familyEvent.choices[0]).state;
    expect(dating.family.status).toBe("dating");
    expect(dating.family.partner_character_id).toBe("pareja_alex");
    expect(dating.flags.historia_con_alex).toBe(true);

    const separationEvent: EventDef = {
      schema_version: 1,
      id: "familia_ruptura",
      category: "familia",
      title: "Ruptura",
      body: "Cada uno por su lado.",
      weight: 5,
      cooldown_months: 0,
      choices: [
        {
          id: "separarse",
          label: "Separarse",
          effects: {
            set_family_status: { status: "separated", partner_character_id: "pareja_alex" },
          },
        },
        { id: "hablar", label: "Hablar", effects: { stress: -2 } },
      ],
    };

    const separated = resolveChoiceEffects(
      dating,
      catalog,
      separationEvent,
      separationEvent.choices[0],
    ).state;
    expect(separated.family.status).toBe("separated");
    expect(separated.family.partner_character_id).toBeNull();
    expect(separated.family.support_modifier).toBe(0);
    expect(separated.flags.historia_con_alex).toBe(true);
    expect(separated.flags.ex_pareja_alex).toBe(true);
  });

  it("filters Hacienda inspections to real weighted audit events and applies fallback fine when none are eligible", () => {
    const nonAuditGlitch: EventDef = {
      schema_version: 1,
      id: "hacienda_bucle_clave_pin",
      category: "hacienda",
      title: "Bucle Cl@ve PIN",
      body: "SMS que nunca llega.",
      tags: ["clave_pin"],
      weight: 10,
      cooldown_months: 0,
      choices: [
        { id: "reintentar", label: "Reintentar", effects: { stress: 4 } },
        { id: "salir", label: "Salir", effects: { stress: 1 } },
      ],
    };
    const chainFinale: EventDef = {
      schema_version: 1,
      id: "hacienda_acta_inspeccion",
      category: "hacienda",
      title: "Acta de inspección",
      body: "Resolución final.",
      character_id: "hacienda_inspector_gomez",
      weight: 0,
      cooldown_months: 0,
      choices: [
        { id: "firmar_conformidad", label: "Firmar", effects: { cash_delta: -1200 } },
        { id: "alegar", label: "Alegar", effects: { stress: 8 } },
      ],
    };
    const realAuditA: EventDef = {
      schema_version: 1,
      id: "hacienda_requerimiento_iva",
      category: "hacienda",
      title: "Requerimiento de IVA",
      body: "Aporta libro de facturas recibidas.",
      character_id: "hacienda_inspector_gomez",
      weight: 6,
      cooldown_months: 6,
      choices: [
        { id: "aportar", label: "Aportar libros", effects: { stress: 5 } },
        { id: "gestor", label: "Enviar al gestor", effects: { deductible_expense: 150 } },
      ],
    };
    const realAuditB: EventDef = {
      schema_version: 1,
      id: "hacienda_comprobacion_gastos",
      category: "hacienda",
      title: "Comprobación limitada",
      body: "Revisión de gastos deducibles.",
      tags: ["comprobacion"],
      weight: 6,
      cooldown_months: 6,
      choices: [
        { id: "justificar", label: "Justificar", effects: { stress: 4 } },
        { id: "aceptar", label: "Aceptar", effects: { cash_delta: -400 } },
      ],
    };

    const routineRentaCampaign: EventDef = {
      schema_version: 1,
      id: "hacienda_campana_renta_primavera",
      category: "hacienda",
      title: "Campaña de la Renta",
      body: "Revisión rutinaria del borrador.",
      character_id: "hacienda_inspector_gomez",
      weight: 6,
      cooldown_months: 11,
      choices: [
        { id: "revisar", label: "Revisar", effects: { cash_delta: 210 } },
        { id: "confirmar", label: "Confirmar", effects: { stress: 2 } },
      ],
    };

    expect(isInspectableHaciendaEvent(nonAuditGlitch)).toBe(false);
    expect(isInspectableHaciendaEvent(routineRentaCampaign)).toBe(false);
    expect(isInspectableHaciendaEvent(chainFinale)).toBe(false);
    expect(isInspectableHaciendaEvent(realAuditA)).toBe(true);
    expect(isInspectableHaciendaEvent(realAuditB)).toBe(true);

    const auditCatalog: ContentCatalog = {
      balance: {
        ...createFixtureBalance(),
        inspection_curve: {
          ...createFixtureBalance().inspection_curve,
          min_fiscal_risk: 15,
          max_probability: 1,
        },
      },
      characters: createFixtureCharacters(),
      events: [nonAuditGlitch, chainFinale, realAuditA, realAuditB],
    };

    const base = {
      ...createInitialGameState(auditCatalog, { seed: "HACIENDA-AUDIT-PICK" }),
      month: 3,
      fiscal_risk: 100,
    };
    const selected = selectInspectableHaciendaEvent(base, auditCatalog);
    expect(["hacienda_requerimiento_iva", "hacienda_comprobacion_gastos"]).toContain(
      selected.eventId,
    );
    expect(findInspectableHaciendaEventId(base, auditCatalog)).toBe(selected.eventId);

    // Fallback fine when only non-audit glitches / weight:0 finales exist
    const fallbackCatalog: ContentCatalog = {
      ...auditCatalog,
      events: [nonAuditGlitch, chainFinale],
    };
    const prepared = prepareQuarterlyTax(base, fallbackCatalog, selectInspectableHaciendaEvent);
    expect(prepared.report.inspection_triggered).toBe(true);
    expect(prepared.report.inspection_scheduled_event_id).toBeNull();
    expect(prepared.report.inspection_fallback_fine).toBe(600 + 12 * 100);
    expect(prepared.state.finances.accrued_tax_liability).toBeGreaterThanOrEqual(1800);
  });

  it("revalidates and redraws Slot 2 when Slot 1's choice invalidates Slot 2 intra-month", () => {
    const slot1Dismiss: EventDef = {
      schema_version: 1,
      id: "empleados_crisis_salida",
      category: "empleados",
      title: "Salida pactada",
      body: "Dani pide rescindir contrato.",
      requirements: { has_employee: true },
      exclusive_with: ["clientes_excluido"],
      weight: 0,
      cooldown_months: 0,
      choices: [
        {
          id: "despedir_ahora",
          label: "Rescindir contrato",
          effects: { dismiss_employee: { severance_cost: 300 } },
        },
        { id: "retener", label: "Retener", effects: { stress: 4 } },
      ],
    };
    const slot2NeedsEmployee: EventDef = {
      schema_version: 1,
      id: "empleados_reunion_semanal",
      category: "empleados",
      title: "Reunión con Dani",
      body: "Repaso de tareas del equipo.",
      requirements: { has_employee: true },
      weight: 10,
      cooldown_months: 0,
      choices: [
        { id: "revisar", label: "Revisar", effects: { moral: 2 } },
        { id: "posponer", label: "Posponer", effects: { stress: 1 } },
      ],
    };
    const excludedReplacement: EventDef = {
      schema_version: 1,
      id: "clientes_excluido",
      category: "clientes",
      title: "Excluido",
      body: "Incompatible con Slot 1.",
      weight: 50,
      cooldown_months: 0,
      choices: [
        { id: "a", label: "A", effects: { moral: 1 } },
        { id: "b", label: "B", effects: { moral: -1 } },
      ],
    };
    const validReplacement: EventDef = {
      schema_version: 1,
      id: "clientes_reemplazo_valido",
      category: "clientes",
      title: "Encargo entrante",
      body: "Llega un presupuesto nuevo.",
      weight: 10,
      cooldown_months: 0,
      choices: [
        { id: "aceptar", label: "Aceptar", effects: { billed_income: 800 } },
        { id: "rechazar", label: "Rechazar", effects: { stress: -2 } },
      ],
    };

    const catalog: ContentCatalog = {
      balance: createFixtureBalance(),
      characters: createFixtureCharacters(),
      events: [slot1Dismiss, slot2NeedsEmployee, excludedReplacement, validReplacement],
    };

    const state: GameState = {
      ...createInitialGameState(catalog, { seed: "SLOT2-REDRAW" }),
      month: 5,
      phase: "event_resolution",
      employee: {
        character_id: "empleado_junior_dani",
        role_label: "Junior Multiusos",
        monthly_cost: 1350,
        billing_multiplier: 1.58,
        satisfaction: 75,
        months_employed: 2,
      },
      current_turn_events: ["empleados_crisis_salida", "empleados_reunion_semanal"],
    };

    const afterSlot1 = applyPlayerChoice(state, catalog, "despedir_ahora");
    expect(afterSlot1.state.month).toBe(5);
    expect(afterSlot1.state.phase).toBe("event_resolution");
    expect(afterSlot1.state.employee).toBeNull();
    expect(afterSlot1.state.current_turn_events).toEqual(["clientes_reemplazo_valido"]);
  });

  it("defers temporarily ineligible scheduled chain events up to 6 months and applies diminishing weight decay", () => {
    const chainFollowup: EventDef = {
      schema_version: 1,
      id: "clientes_cobro_diferido_cadena",
      category: "clientes",
      title: "Reclamación de factura",
      body: "Requiere bandera activa.",
      requirements: { required_flags: ["habilitar_cadena"] },
      weight: 0,
      cooldown_months: 0,
      choices: [
        { id: "cobrar", label: "Cobrar", effects: { billed_income: 600 } },
        { id: "perdonar", label: "Perdonar", effects: { moral: -2 } },
      ],
    };
    const evergreenA: EventDef = {
      schema_version: 1,
      id: "clientes_frecuente",
      category: "clientes",
      title: "Frecuente",
      body: "Evento común.",
      weight: 12,
      cooldown_months: 0,
      choices: [
        { id: "a", label: "A", effects: { stress: -1 } },
        { id: "b", label: "B", effects: { moral: 1 } },
      ],
    };

    const catalog: ContentCatalog = {
      balance: { ...createFixtureBalance(), event_novelty_decay_k: 0.85 },
      characters: createFixtureCharacters(),
      events: [chainFollowup, evergreenA],
    };

    let state: GameState = {
      ...createInitialGameState(catalog, { seed: "DEFERRED-CHAIN" }),
      month: 2,
      scheduled_queue: [
        {
          queue_id: "q_chain",
          event_id: "clientes_cobro_diferido_cadena",
          trigger_month: 2,
          source_event_id: "clientes_frecuente",
        },
      ],
    };

    // Deferrals 1..6 keep the chain alive in scheduled_queue
    for (let deferral = 1; deferral <= 6; deferral += 1) {
      const drawn = drawTurnEvents(state, catalog);
      expect(drawn.drawnEventIds).toEqual(["clientes_frecuente"]);
      expect(drawn.state.scheduled_queue).toHaveLength(1);
      expect(drawn.state.scheduled_queue[0]).toMatchObject({
        queue_id: "q_chain",
        trigger_month: state.month + 1,
        deferred_months: deferral,
      });
      state = {
        ...drawn.state,
        month: state.month + 1,
      };
    }

    // If it becomes eligible before exhausting deferrals, it fires in Slot 1
    const eligibleBeforeDrop = drawTurnEvents(
      {
        ...state,
        flags: { habilitar_cadena: true },
      },
      catalog,
    );
    expect(eligibleBeforeDrop.drawnEventIds[0]).toBe("clientes_cobro_diferido_cadena");
    expect(eligibleBeforeDrop.state.scheduled_queue).toHaveLength(0);

    // If still ineligible at deferred_months === 6, 7th check drops it cleanly
    const droppedAfterSix = drawTurnEvents(state, catalog);
    expect(droppedAfterSix.state.scheduled_queue).toHaveLength(0);

    // Diminishing weight decay verification
    expect(computeEffectiveEventWeight(evergreenA, state, catalog)).toBe(12);
    const seenThreeTimes = { ...state, occurrences: { clientes_frecuente: 3 } };
    const expectedDecayed = 12 / (1 + 0.85 * 3) ** 1.35;
    expect(computeEffectiveEventWeight(evergreenA, seenThreeTimes, catalog)).toBeCloseTo(
      expectedDecayed,
      8,
    );
  });

  it("supports voluntary retireFromRun only after earning a victory badge or entering Endless mode, and shows Year 10 annual summary before M120 victory prompt", () => {
    const catalog: ContentCatalog = {
      balance: createFixtureBalance(),
      characters: createFixtureCharacters(),
      events: createFixtureEvents(),
    };
    const earlyState = startNewRun(catalog, { seed: "RETIRE-TEST" }).state;

    // Cannot retire early without victory badge or endless mode
    expect(() => retireFromRun(earlyState, catalog)).toThrow();

    // Entering Month 120 with M120 event unresolved and Q40 unpaid (only 119 months survived) MUST NOT allow honorable retirement
    const month120StartCandidate: GameState = {
      ...earlyState,
      month: 120,
      earned_victories: [],
      endless_mode: false,
      indicators: { ...earlyState.indicators, money: 42000 },
    };
    expect(() => retireFromRun(month120StartCandidate, catalog)).toThrow();

    // Surviving Month 120 and settling Q40 shows Year 10 annual_summary BEFORE victory_prompt
    const m120QuarterState: GameState = {
      ...earlyState,
      month: 120,
      phase: "quarterly_tax",
      current_turn_events: [],
      indicators: { ...earlyState.indicators, money: 42000, stress: 30, moral: 75 },
      finances: {
        ...earlyState.finances,
        current_quarter_billed: 6000,
        accrued_tax_liability: 1200,
      },
      annual_snapshot: {
        ...earlyState.annual_snapshot,
        year: 10,
        start_money: 35000,
        billed: 24000,
        expenses: 15000,
        taxes_paid: 3600,
        events_resolved: 12,
      },
    };
    const afterQ40 = settleQuarter(m120QuarterState, catalog, "pay");
    expect(afterQ40.state.month).toBe(120);
    expect(afterQ40.state.phase).toBe("annual_summary");
    expect(afterQ40.state.earned_victories).toContain("hero_120m");
    expect(afterQ40.state.pending_victory_badge).toBe("hero_120m");
    expect(afterQ40.resolution.annualSummary?.year).toBe(10);
    expect(afterQ40.resolution.unlockedVictories).toEqual(["hero_120m"]);

    // Dismissing Year 10 annual summary opens victory_prompt instead of skipping to Month 121
    const afterYear10Summary = dismissAnnualSummary(afterQ40.state, catalog);
    expect(afterYear10Summary.state.month).toBe(120);
    expect(afterYear10Summary.state.phase).toBe("victory_prompt");
    expect(afterYear10Summary.state.pending_victory_badge).toBe("hero_120m");

    // Choosing "retire" on victory_prompt ends run with retired_hero while preserving Year 10 annual_summary history
    const retiredAt120 = resolveVictoryPrompt(afterYear10Summary.state, catalog, "retire");
    expect(retiredAt120.state.phase).toBe("game_over");
    expect(retiredAt120.state.ending).toEqual({
      id: "retired_hero",
      month: 120,
      summary_quote: catalog.balance.ending_quotes!.retired_hero,
    });
    expect(
      retiredAt120.state.history.some((e) => e.kind === "annual_summary" && e.month === 120),
    ).toBe(true);

    // Choosing "continue" on victory_prompt enters Endless Mode at Month 121 without repeating Year 10 annual_summary
    const continuedIntoEndless = resolveVictoryPrompt(
      afterYear10Summary.state,
      catalog,
      "continue",
    );
    expect(continuedIntoEndless.state.endless_mode).toBe(true);
    expect(continuedIntoEndless.state.month).toBe(121);
    expect(continuedIntoEndless.state.phase).toBe("event_resolution");

    // Voluntary retireFromRun works once hero_120m has been genuinely earned
    const heroEarnedCandidate: GameState = {
      ...earlyState,
      month: 120,
      earned_victories: ["hero_120m"],
      indicators: { ...earlyState.indicators, money: 42000 },
    };
    const heroRetired = retireFromRun(heroEarnedCandidate, catalog);
    expect(heroRetired.state.phase).toBe("game_over");
    expect(heroRetired.state.ending).toEqual({
      id: "retired_hero",
      month: 120,
      summary_quote: catalog.balance.ending_quotes!.retired_hero,
    });
    expect(heroRetired.state.earned_victories).toEqual(["hero_120m"]);

    // Retiring in Endless mode after earning rich_150k (or holding >= 150,000 €) awards retired_rich
    const richEndlessCandidate: GameState = {
      ...earlyState,
      month: 134,
      endless_mode: true,
      earned_victories: ["hero_120m"],
      indicators: { ...earlyState.indicators, money: 155000 },
    };
    const richRetired = retireFromRun(richEndlessCandidate, catalog);
    expect(richRetired.state.phase).toBe("game_over");
    expect(richRetired.state.ending).toEqual({
      id: "retired_rich",
      month: 134,
      summary_quote: catalog.balance.ending_quotes!.retired_rich,
    });
    expect(richRetired.state.earned_victories).toEqual(["hero_120m", "rich_150k"]);
    expect(richRetired.resolution.unlockedVictories).toEqual(["rich_150k"]);

    // Cannot retire again once already in game_over
    expect(() => retireFromRun(richRetired.state, catalog)).toThrow();
  });

  it("evaluates pre-decay fiscal_risk and next-month months_of_year on triggered inspections and delivers queued audit after risk decay", () => {
    const wrongMonthAudit: EventDef = {
      schema_version: 1,
      id: "hacienda_cruce_modelo_347_clientes",
      category: "hacienda",
      title: "Cruce Modelo 347",
      body: "Solo febrero y marzo.",
      character_id: "hacienda_inspector_gomez",
      requirements: {
        months_of_year: [2, 3],
        stats: { fiscal_risk: { min: 20 } },
      },
      weight: 50,
      cooldown_months: 12,
      choices: [
        { id: "aportar", label: "Aportar", effects: { stress: 4 } },
        { id: "gestor", label: "Gestor", effects: { deductible_expense: 120 } },
      ],
    };
    const validMinRiskAudit: EventDef = {
      schema_version: 1,
      id: "hacienda_visita_comprobacion_censal",
      category: "hacienda",
      title: "Comprobación censal",
      body: "Requiere riesgo pre-decaimiento >= 28.",
      character_id: "hacienda_inspector_gomez",
      requirements: {
        months_of_year: [1, 4, 7, 10],
        stats: { fiscal_risk: { min: 28 } },
      },
      weight: 8,
      cooldown_months: 12,
      choices: [
        { id: "atender", label: "Atender", effects: { stress: 5 } },
        { id: "alegar", label: "Alegar", effects: { deductible_expense: 150 } },
      ],
    };
    const fillerClient: EventDef = {
      schema_version: 1,
      id: "clientes_relleno",
      category: "clientes",
      title: "Cliente",
      body: "Relleno.",
      weight: 10,
      cooldown_months: 0,
      choices: [
        { id: "a", label: "A", effects: { billed_income: 500 } },
        { id: "b", label: "B", effects: { stress: -2 } },
      ],
    };

    const catalog: ContentCatalog = {
      balance: {
        ...createFixtureBalance(),
        gestor_tiers: {
          ...createFixtureBalance().gestor_tiers,
          self: {
            ...createFixtureBalance().gestor_tiers.self,
            quarterly_error_prob: 0,
          },
        },
        inspection_curve: {
          ...createFixtureBalance().inspection_curve,
          min_fiscal_risk: 15,
          max_probability: 1,
          exponent: 0.0001,
          risk_decay_on_trigger: 35,
        },
      },
      characters: createFixtureCharacters(),
      events: [wrongMonthAudit, validMinRiskAudit, fillerClient],
    };

    const q1State: GameState = {
      ...createInitialGameState(catalog, { seed: "PRE-DECAY-INSPECTION" }),
      month: 3,
      fiscal_risk: 38,
    };

    // Direct call at Month 3 checks Month 4 (April) -> skips [2, 3] event and selects min:28 event
    expect(selectInspectableHaciendaEvent(q1State, catalog).eventId).toBe(
      "hacienda_visita_comprobacion_censal",
    );

    // prepareQuarterlyTax decays fiscal_risk 38 -> 3, yet schedules hacienda_visita_comprobacion_censal
    const prepared = prepareQuarterlyTax(q1State, catalog, selectInspectableHaciendaEvent);
    expect(prepared.report.inspection_triggered).toBe(true);
    expect(prepared.report.inspection_scheduled_event_id).toBe(
      "hacienda_visita_comprobacion_censal",
    );
    expect(prepared.state.fiscal_risk).toBe(3);

    // Settling Q1 advances to Month 4 where drawTurnEvents delivers the scheduled audit in Slot 1 despite post-decay fiscal_risk === 3
    const settled = settleQuarter(prepared.state, catalog, "pay");
    expect(settled.state.month).toBe(4);
    expect(settled.state.current_turn_events[0]).toBe("hacienda_visita_comprobacion_censal");
  });

  it("populates MonthStartSummary overdraft, maintenance, and net stress/moral deltas matching exact post-outcome state transitions", () => {
    const catalog: ContentCatalog = {
      balance: {
        ...createFixtureBalance(),
        high_stat_decay_threshold: 60,
        negative_cash_monthly_stress: 6,
      },
      characters: createFixtureCharacters(),
      events: [
        {
          schema_version: 1,
          id: "clientes_mes_rojo",
          category: "clientes",
          title: "Pago urgente",
          body: "Te deja en descubierto.",
          weight: 10,
          cooldown_months: 0,
          choices: [
            { id: "pagar", label: "Pagar", effects: { cash_delta: -4500, moral: 15 } },
            { id: "esperar", label: "Esperar", effects: { stress: 1 } },
          ],
        },
      ],
    };

    const m1 = startNewRun(catalog, { seed: "NET-DELTA-TELESCOPE" });
    const step = applyPlayerChoice(m1.state, catalog, "pagar");
    const postChoice = step.resolution.postChoiceState!;
    const ms = step.resolution.monthStart!;

    expect(postChoice.indicators.money).toBeLessThan(0);
    expect(ms.overdraft_stress_delta).toBe(6);
    expect(ms.net_stress_delta).toBe(
      (ms.passive_stress_delta ?? 0) +
        (ms.modifier_stress_delta ?? 0) +
        (ms.overdraft_stress_delta ?? 0),
    );
    expect(ms.net_stress_delta).toBe(step.state.indicators.stress - postChoice.indicators.stress);
    expect(ms.net_moral_delta).toBe(
      (ms.modifier_moral_delta ?? 0) + (ms.maintenance_moral_delta ?? 0),
    );
    expect(ms.net_moral_delta).toBe(step.state.indicators.moral - postChoice.indicators.moral);
  });
});
