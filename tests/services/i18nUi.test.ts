import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileLocaleOverlays } from "../../scripts/compile-content.ts";
import { buildExpectedEventLocaleKeys, validateLocales } from "../../scripts/validate-locales.ts";
import { type EndingId, type GameState, startNewRun } from "../../src/engine/index.ts";
import {
  ACHIEVEMENT_CATALOG,
  getLocalizedAchievement,
  getLocalizedAchievementCatalog,
} from "../../src/services/achievements/definitions.ts";
import { compiledCatalog } from "../../src/services/content/catalog.ts";
import {
  ENDING_METADATA,
  ENDING_METADATA_EN,
  VICTORY_BADGE_LABELS,
  getEndingMetadata,
  getVictoryBadgeLabel,
  resolveLocalizedEndingQuote,
} from "../../src/services/endings/endingMetadata.ts";
import {
  EXACT_FLAG_LABELS_EN,
  EXACT_FLAG_LABELS_ES,
  MODIFIER_LABELS_BY_ID_EN,
  MODIFIER_LABELS_EN,
  clearLocaleOverlays,
  describeFiscalRiskTension,
  explainChoiceLockReasons,
  formatCalendarBadgeEs,
  formatDurationMonthsEs,
  formatEuros,
  formatSignedEuros,
  humanizeFlag,
  normalizeLocale,
  registerLocaleOverlay,
  resolveChoiceLabel,
  resolveChoiceResultText,
  resolveEventBody,
  resolveEventText,
  resolveEventTitle,
  translateCategoryLabel,
  translateCharacterBio,
  translateCharacterName,
  translateCharacterRole,
  translateEmployeeRoleLabel,
  translateFamilyStatus,
  translateGestorTier,
  translateModifierLabel,
} from "../../src/services/i18n/resolveEventText.ts";
import { getUiStrings } from "../../src/services/i18n/uiStrings.ts";
import {
  buildShareText,
  createShareSummaryFromState,
  renderShareCardToCanvas,
} from "../../src/services/share/shareSummary.ts";
import {
  createDefaultProfileEnvelope,
  createMemoryStorageDriver,
  createStorageAdapter,
  defaultStorageAdapter,
} from "../../src/services/storage/index.ts";
import { setGameStoreStoragePort, useGameStore } from "../../src/store/gameStore.ts";

function createFakeCanvasHarness() {
  const drawnText: Array<{
    text: string;
    x: number;
    y: number;
    maxWidth: number | undefined;
  }> = [];
  let currentFont = "400 16px sans-serif";

  const mockCtx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    textAlign: "left",
    get font() {
      return currentFont;
    },
    set font(val: string) {
      currentFont = val;
    },
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    drawImage: () => {},
    measureText: (str: string) => {
      const pxMatch = /(\d+)px/.exec(currentFont);
      const fontSize = pxMatch ? Number(pxMatch[1]) : 20;
      return { width: str.length * fontSize * 0.56 };
    },
    fillText: (text: string, x: number, y: number, maxWidth?: number) => {
      drawnText.push({ text, x, y, maxWidth });
    },
  };

  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => mockCtx,
  } as unknown as HTMLCanvasElement;

  return { fakeCanvas, drawnText };
}

const SAMPLE_EVENT_YAML = `schema_version: 1
id: cliente_prueba_traduccion
category: clientes
title: Encargo urgente con factura dudosa
body: Un cliente pide entregar mañana mismo un proyecto completo a cambio de pagar la mitad sin IVA.
weight: 10
cooldown_months: 6
choices:
  - id: aceptar_legal
    label: Emitir presupuesto con IVA oficial
    effects:
      billed_income: 1200
    result_text: Acepta a regañadientes y firmas hoja de encargo reglamentaria.
  - id: arriesgar_efectivo
    label: Cobrar adelanto en mano
    outcomes:
      - id: sale_bien
        weight: 60
        effects:
          cash_delta: 900
        result_text: Cobras en metálico sin dejar rastro bancario inmediato.
      - id: susto_fiscal
        weight: 40
        effects:
          fiscal_risk: 15
        result_text: El cliente deduce el pago igualmente y salta una alerta cruzada.
`;

describe("Phase 3B Localization (es-ES & en) — UI Strings, Formatters, Catalogs & Validators", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    clearLocaleOverlays();
    setGameStoreStoragePort(defaultStorageAdapter);
    useGameStore.setState({
      profile: createDefaultProfileEnvelope(),
    });
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("keeps es-ES as default profile locale and exposes complete es-ES / en UI string dictionaries", () => {
    const defaultProfile = createDefaultProfileEnvelope();
    expect(defaultProfile.settings.locale).toBe("es-ES");

    expect(normalizeLocale()).toBe("es-ES");
    expect(normalizeLocale("es-ES")).toBe("es-ES");
    expect(normalizeLocale("en")).toBe("en");
    expect(normalizeLocale("en-US")).toBe("en");
    // Guard against accidental numeric index argument if passed to Array.prototype.map
    expect(normalizeLocale(1)).toBe("es-ES");

    const es = getUiStrings("es-ES");
    const en = getUiStrings("en");

    expect(es.locale).toBe("es-ES");
    expect(en.locale).toBe("en");
    expect(es.game.mobileNavAria).toBe("Secciones del despacho");
    expect(en.game.mobileNavAria).toBe("Office sections");
    expect(es.title.achievementsTabLabel(3, 15)).toBe("Logros (3/15)");
    expect(en.title.achievementsTabLabel(3, 15)).toBe("Achievements (3/15)");
    expect(es.modals.quarterly.heading(3, 1)).toContain("1");
    expect(en.modals.quarterly.heading(3, 1)).toContain("Q1");
    expect(en.modals.abandon.heading).toContain("Form 036");
    expect(en.endRun.newRunBtn).toBe("Register as Self-Employed");
  });

  it("formats currency, durations, calendar badges, domain labels, and lock reasons in es-ES and en", () => {
    expect(formatEuros(12_450, "es-ES")).toBe("12.450 €");
    expect(formatEuros(12_450, "en")).toBe("12,450 €");
    expect(formatSignedEuros(850, "en")).toBe("+850 €");
    expect(formatSignedEuros(-1500, "en")).toBe("-1,500 €");

    expect(formatDurationMonthsEs(1, "en")).toBe("1 month");
    expect(formatDurationMonthsEs(5, "en")).toBe("5 months");
    expect(formatDurationMonthsEs(12, "en")).toBe("1 year (12 months)");
    expect(formatDurationMonthsEs(25, "en")).toBe("2 years and 1 month (25 months)");

    const calEnM1 = formatCalendarBadgeEs(1, "en");
    expect(calEnM1.label).toBe("Year 1 · Month 1");
    expect(calEnM1.trimestreLabel).toBe("Quarter in 2 months");
    expect(calEnM1.shortTrimestreBadge).toBe("Q1·2m");

    const calEnM2 = formatCalendarBadgeEs(2, "en");
    expect(calEnM2.trimestreLabel).toBe("Quarter in 1 month");

    const calEnM3 = formatCalendarBadgeEs(3, "en");
    expect(calEnM3.label).toBe("Year 1 · Month 3");
    expect(calEnM3.trimestreLabel).toBe("Q1 closes this month");
    expect(calEnM3.shortTrimestreBadge).toBe("Q1 now");

    expect(translateGestorTier("self", "en")).toBe("Self-filed");
    expect(translateGestorTier("cheap", "en")).toBe("Budget advisor");
    expect(translateGestorTier("premium", "en")).toBe("Premium tax firm");

    expect(translateFamilyStatus("single", "en")).toBe("Single");
    expect(translateFamilyStatus("cohabiting", "en")).toBe("Cohabiting");

    expect(translateCategoryLabel("hacienda", "en")).toBe("Tax Agency (AEAT)");
    expect(translateCategoryLabel("empleados", "en")).toBe("Payroll & staff");

    expect(describeFiscalRiskTension(10, "en")).toEqual({ label: "Low profile", level: "calm" });
    expect(describeFiscalRiskTension(35, "en")).toEqual({ label: "Under watch", level: "watched" });
    expect(describeFiscalRiskTension(70, "en")).toEqual({
      label: "In the crosshairs",
      level: "critical",
    });

    expect(humanizeFlag("cobro_en_b_reciente", "en")).toBe("recent off-the-books payment");
    expect(humanizeFlag("retraso_pago_cliente", "en")).toBe("delay payment client");

    const { state } = startNewRun(compiledCatalog, { seed: "I18N-LOCKS-01" });
    const stateWithFlag: GameState = {
      ...state,
      month: 2,
      flags: { ...state.flags, sancion_hacienda_previa: true },
    };

    const enReasons = explainChoiceLockReasons(
      stateWithFlag,
      {
        min_month: 6,
        stats: { money: { min: 15_000 }, stress: { max: 5 } },
        required_flags: ["pareja_estable"],
        forbidden_flags: ["sancion_hacienda_previa"],
        gestor_tiers: ["cheap", "premium"],
        family_statuses: ["dating", "cohabiting"],
        has_employee: true,
      },
      "en",
    );

    expect(enReasons).toContain("Available from month 6");
    expect(enReasons).toContain("Requires min. Cash 15,000 €");
    expect(enReasons).toContain('Requires "steady partner"');
    expect(enReasons).toContain('Unavailable with "prior tax penalty"');
    expect(enReasons).toContain("Requires advisor: Budget advisor or Premium tax firm");
    expect(enReasons).toContain("Requires family status: Dating or Cohabiting");
    expect(enReasons).toContain("Requires an employee on payroll");
  });

  it("translates characters, employee role labels, and active modifier labels in English", () => {
    const paco = compiledCatalog.characters.gestor_barato_paco;
    expect(paco).toBeDefined();
    if (paco) {
      expect(translateCharacterName(paco, "es-ES")).toBe(paco.name);
      expect(translateCharacterName(paco, "en")).toBe('Paco "Quick-File"');
      expect(translateCharacterBio(paco, "en")).toContain("churro shop");
      expect(translateCharacterRole(paco.role, "en")).toBe("Tax Advisor");
    }

    expect(translateEmployeeRoleLabel("Especialista sénior", "en")).toBe("Senior Specialist");
    expect(translateEmployeeRoleLabel("Junior Multiusos", "en")).toBe("All-Rounder Junior");
    expect(translateModifierLabel("Iguala por boca-oreja", "en")).toBe("Word-of-mouth retainer");
    expect(translateModifierLabel("Renting equipo de trabajo", "es-ES")).toBe(
      "Renting equipo de trabajo",
    );

    // Enforce 100% ES/EN coverage for every add_modifier.id, add_modifier.label & flag across the 300-event catalog
    expect(compiledCatalog.events).toHaveLength(300);
    const seenModifierIds = new Set<string>();
    const seenFlags = new Set<string>(["ex_pareja_alex", "historia_con_alex"]);
    const collectReqFlags = (
      req?: { required_flags?: string[] | null; forbidden_flags?: string[] | null } | null,
    ) => {
      if (!req) {
        return;
      }
      for (const flag of req.required_flags ?? []) {
        seenFlags.add(flag);
      }
      for (const flag of req.forbidden_flags ?? []) {
        seenFlags.add(flag);
      }
    };

    for (const event of compiledCatalog.events) {
      collectReqFlags(event.requirements);
      for (const choice of event.choices) {
        collectReqFlags(choice.requirements);
        const blocks = [
          ...(choice.effects ? [choice.effects] : []),
          ...(choice.outcomes ? choice.outcomes.map((o) => o.effects) : []),
        ];
        for (const eff of blocks) {
          for (const flag of eff.set_flags ?? []) {
            seenFlags.add(flag);
          }
          for (const flag of eff.clear_flags ?? []) {
            seenFlags.add(flag);
          }
          if (!eff.add_modifier) {
            continue;
          }
          const mod = eff.add_modifier;
          seenModifierIds.add(mod.id);
          expect(
            MODIFIER_LABELS_BY_ID_EN[mod.id],
            `Missing MODIFIER_LABELS_BY_ID_EN entry for '${mod.id}' in '${event.id}'`,
          ).toBeDefined();
          expect(
            MODIFIER_LABELS_EN[mod.label],
            `Missing MODIFIER_LABELS_EN entry for '${mod.label}' ('${mod.id}' in '${event.id}')`,
          ).toBeDefined();

          const translated = translateModifierLabel(mod, "en");
          expect(translated.trim().length).toBeGreaterThan(3);
          expect(translated).not.toBe(mod.label);
        }
      }
    }
    expect(seenModifierIds.size).toBeGreaterThanOrEqual(80);
    expect(seenFlags.size).toBeGreaterThanOrEqual(30);

    expect(Object.keys(EXACT_FLAG_LABELS_ES).sort()).toEqual(
      Object.keys(EXACT_FLAG_LABELS_EN).sort(),
    );
    for (const flag of seenFlags) {
      expect(
        EXACT_FLAG_LABELS_ES[flag],
        `Missing EXACT_FLAG_LABELS_ES entry for '${flag}'`,
      ).toBeDefined();
      expect(
        EXACT_FLAG_LABELS_EN[flag],
        `Missing EXACT_FLAG_LABELS_EN entry for '${flag}'`,
      ).toBeDefined();
      const esFlag = humanizeFlag(flag, "es-ES");
      const enFlag = humanizeFlag(flag, "en");
      expect(esFlag).not.toContain("_");
      expect(enFlag).not.toContain("_");
      expect(enFlag).not.toBe(esFlag);
    }
  });

  it("keeps persistent base locale overlays intact when clearLocaleOverlays clears test overlays", () => {
    registerLocaleOverlay(
      "en",
      {
        "persistent_test_evt.title": "Persistent English Title",
      },
      { persistent: true },
    );
    registerLocaleOverlay("en", {
      "persistent_test_evt.title": "Temporary Test Override",
    });

    expect(resolveEventText("en", "persistent_test_evt", "title", "Fallback ES")).toBe(
      "Temporary Test Override",
    );

    clearLocaleOverlays();

    expect(resolveEventText("en", "persistent_test_evt", "title", "Fallback ES")).toBe(
      "Persistent English Title",
    );

    const sampleEvent = compiledCatalog.events[0];
    expect(sampleEvent).toBeDefined();
    if (sampleEvent) {
      registerLocaleOverlay("en", {
        [`${sampleEvent.id}.title`]: "Custom EN Event Title",
        [`${sampleEvent.id}.body`]: "Custom EN Event Body",
        [`${sampleEvent.id}.choices.${sampleEvent.choices[0].id}.label`]: "Custom EN Choice",
        [`${sampleEvent.id}.choices.${sampleEvent.choices[0].id}.result_text`]: "Custom EN Result",
      });
      expect(resolveEventTitle(sampleEvent, "en")).toBe("Custom EN Event Title");
      expect(resolveEventBody(sampleEvent, "en")).toBe("Custom EN Event Body");
      expect(resolveChoiceLabel(sampleEvent.id, sampleEvent.choices[0], "en")).toBe(
        "Custom EN Choice",
      );
      expect(
        resolveChoiceResultText(sampleEvent.id, sampleEvent.choices[0].id, null, "Fallback", "en"),
      ).toBe("Custom EN Result");
    }
  });

  it("localizes all 15 achievements and all 8 endings + victory badges in es-ES and en", () => {
    const esAchievements = getLocalizedAchievementCatalog("es-ES");
    const enAchievements = getLocalizedAchievementCatalog("en");

    expect(esAchievements).toHaveLength(15);
    expect(enAchievements).toHaveLength(15);

    for (let i = 0; i < ACHIEVEMENT_CATALOG.length; i += 1) {
      const base = ACHIEVEMENT_CATALOG[i];
      const enItem = enAchievements[i];
      expect(enItem.id).toBe(base.id);
      expect(enItem.code).toBe(base.code);
      expect(enItem.title.trim().length).toBeGreaterThan(3);
      expect(enItem.description.trim().length).toBeGreaterThan(10);
      expect(enItem.title).not.toBe(base.title);
      expect(getLocalizedAchievement(base.id, "en")?.title).toBe(enItem.title);
    }

    const endingIds = Object.keys(ENDING_METADATA) as EndingId[];
    expect(endingIds).toHaveLength(8);
    for (const endingId of endingIds) {
      const esMeta = getEndingMetadata(endingId, "es-ES");
      const enMeta = getEndingMetadata(endingId, "en");
      expect(enMeta).toEqual(ENDING_METADATA_EN[endingId]);
      expect(enMeta.tone).toBe(esMeta.tone);
      expect(enMeta.title).not.toBe(esMeta.title);
      expect(enMeta.stampText.length).toBeGreaterThan(2);

      const translatedDefaultQuote = resolveLocalizedEndingQuote(endingId, "", "en");
      expect(translatedDefaultQuote.length).toBeGreaterThan(15);
    }

    for (const badge of Object.keys(VICTORY_BADGE_LABELS) as Array<
      keyof typeof VICTORY_BADGE_LABELS
    >) {
      const esBadge = getVictoryBadgeLabel(badge, "es-ES");
      const enBadge = getVictoryBadgeLabel(badge, "en");
      expect(enBadge.title).not.toBe(esBadge.title);
      expect(enBadge.shortSeal).not.toBe(esBadge.shortSeal);
    }
  });

  it("builds English share text and renders English share canvas within safe layout bounds", () => {
    const { state } = startNewRun(compiledCatalog, { seed: "EN-SHARE-2026" });
    const endedState: GameState = {
      ...state,
      month: 120,
      earned_victories: ["hero_120m", "rich_150k"],
      indicators: { ...state.indicators, money: 154_300 },
      finances: { ...state.finances, lifetime_billed: 420_000 },
      ending: {
        id: "retired_hero",
        month: 120,
        summary_quote:
          "Diez años cotizando sin perder el juicio del todo. En tu gestoría han puesto una placa con tu nombre.",
      },
    };

    const summary = createShareSummaryFromState(endedState, "https://autonomo.example/en");
    const shareTextEn = buildShareText(summary, "en");

    expect(shareTextEn).toContain("FORM 036-END · SELF-EMPLOYED SURVIVAL CERTIFICATE");
    expect(shareTextEn).toContain("Self-Employed Hero!");
    expect(shareTextEn).toContain("10 years (120 months)");
    expect(shareTextEn).toContain("154,300 €");
    expect(shareTextEn).toContain("420,000 €");
    expect(shareTextEn).toContain("Self-Employed Hero! (120 months)");
    expect(shareTextEn).toContain("Rolling in It (150,000 €)");
    expect(shareTextEn).toContain("brass plaque in your honor");

    const { fakeCanvas, drawnText } = createFakeCanvasHarness();
    const ok = renderShareCardToCanvas(fakeCanvas, summary, { locale: "en" });
    expect(ok).toBe(true);
    expect(fakeCanvas.width).toBe(1080);
    expect(fakeCanvas.height).toBe(1350);
    expect(drawnText.some((entry) => entry.text.includes("DOSSIER REGISTRY"))).toBe(true);
    expect(drawnText.some((entry) => entry.text.includes("BOX [01] · TIME CONTRIBUTED"))).toBe(
      true,
    );
    expect(drawnText.some((entry) => entry.text === "10-YR HERO")).toBe(true);
    for (const entry of drawnText) {
      expect(entry.maxWidth).toBeTypeOf("number");
      expect(entry.maxWidth).toBeGreaterThan(0);
    }
  });

  it("persists setLocalePreference and toggleLocalePreference through gameStore StoragePort", async () => {
    const driver = createMemoryStorageDriver();
    const storage = createStorageAdapter(driver);
    setGameStoreStoragePort(storage);

    useGameStore.setState({
      profile: createDefaultProfileEnvelope(),
    });
    expect(useGameStore.getState().profile.settings.locale).toBe("es-ES");

    await useGameStore.getState().setLocalePreference("en");
    expect(useGameStore.getState().profile.settings.locale).toBe("en");

    const persistedEn = await storage.loadProfile();
    expect(persistedEn.settings.locale).toBe("en");

    await useGameStore.getState().toggleLocalePreference();
    expect(useGameStore.getState().profile.settings.locale).toBe("es-ES");

    const persistedEs = await storage.loadProfile();
    expect(persistedEs.settings.locale).toBe("es-ES");
  });

  it("validates event locale YAML key parity, rejects missing/empty/duplicate/orphan keys, and compiles sorted JSON", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "autonomo-locales-test-"));
    tempDirs.push(tempRoot);

    const clientesEventsDir = join(tempRoot, "content", "events", "clientes");
    const enLocalesDir = join(tempRoot, "content", "locales", "en");
    mkdirSync(clientesEventsDir, { recursive: true });
    mkdirSync(enLocalesDir, { recursive: true });

    writeFileSync(
      join(clientesEventsDir, "cliente_prueba_traduccion.yaml"),
      SAMPLE_EVENT_YAML,
      "utf8",
    );

    // 1. Missing keys fail cleanly
    writeFileSync(
      join(enLocalesDir, "clientes.yaml"),
      `cliente_prueba_traduccion.title: "Rush gig with shady invoice"\n`,
      "utf8",
    );
    const missingResult = validateLocales(tempRoot, "en");
    expect(missingResult.ok).toBe(false);
    expect(missingResult.errors.some((e) => e.includes("Missing 'en' translation key"))).toBe(true);

    // 2. Complete valid keys pass & compile deterministically
    const validEnYaml = [
      'cliente_prueba_traduccion.choices.arriesgar_efectivo.outcomes.susto_fiscal.result_text: "The client deducts the expense anyway and triggers a cross-check alert."',
      'cliente_prueba_traduccion.title: "Rush gig with shady invoice"',
      'cliente_prueba_traduccion.body: "A client asks you to deliver a full project tomorrow in exchange for paying half off the books."',
      'cliente_prueba_traduccion.choices.aceptar_legal.label: "Send an official quote with VAT"',
      'cliente_prueba_traduccion.choices.aceptar_legal.result_text: "They grudgingly accept and sign a standard work order."',
      'cliente_prueba_traduccion.choices.arriesgar_efectivo.label: "Take cash advance in hand"',
      'cliente_prueba_traduccion.choices.arriesgar_efectivo.outcomes.sale_bien.result_text: "You pocket the cash without leaving an immediate bank trail."',
    ].join("\n");
    writeFileSync(join(enLocalesDir, "clientes.yaml"), `${validEnYaml}\n`, "utf8");

    const validResult = validateLocales(tempRoot, "en");
    expect(validResult.errors).toEqual([]);
    expect(validResult.ok).toBe(true);
    expect(validResult.eventCount).toBe(1);
    expect(validResult.keyCount).toBe(7);

    const compiled = compileLocaleOverlays(tempRoot);
    const outPath = join(tempRoot, "src", "content", "compiled-locales.json");
    const diskJson = JSON.parse(readFileSync(outPath, "utf8")) as Record<
      string,
      Record<string, string>
    >;
    expect(diskJson).toEqual(compiled);
    const emittedKeys = Object.keys(diskJson.en);
    expect(emittedKeys).toEqual([...emittedKeys].sort((a, b) => a.localeCompare(b)));
    expect(emittedKeys).toHaveLength(7);

    // 3. Orphan & duplicate & empty keys are caught
    writeFileSync(
      join(enLocalesDir, "extra.yaml"),
      [
        'cliente_prueba_traduccion.title: "Duplicate title across file"',
        'evento_fantasma.title: "Orphan event title"',
        'evento_vacio.body: "   "',
      ].join("\n"),
      "utf8",
    );
    const brokenResult = validateLocales(tempRoot, "en");
    expect(brokenResult.ok).toBe(false);
    expect(brokenResult.errors.some((e) => e.includes("duplicate translation key"))).toBe(true);
    expect(brokenResult.errors.some((e) => e.includes("orphan translation key"))).toBe(true);
    expect(brokenResult.errors.some((e) => e.includes("must map to a non-empty string"))).toBe(
      true,
    );

    // Verify helper parity on live compiledCatalog sample
    const sampleExpected = buildExpectedEventLocaleKeys(compiledCatalog.events.slice(0, 2));
    expect(sampleExpected.size).toBeGreaterThanOrEqual(8);
  });

  it("translates abandonment Spanish summary_quotes in EN and explains Phase 3.5 flag, months_of_year, and employee_satisfaction locks", () => {
    const rawOposicionesEs =
      "Das de baja la actividad, archivas las carpetas del trimestre y despejas la mesa para el temario y el cronómetro: cambias clientes de viernes tarde por una meta estable.";
    const enAbandonQuote = resolveLocalizedEndingQuote(
      "abandon_oposiciones",
      rawOposicionesEs,
      "en",
    );
    expect(enAbandonQuote).not.toContain("Das de baja");
    expect(enAbandonQuote.toLowerCase()).toMatch(/exam|syllab|civil|gazette/);

    expect(humanizeFlag("estudio_propio_activo", "en")).toBe("active private studio");
    expect(humanizeFlag("clausula_pausa_firmada", "en")).toBe("signed project-pause clause");
    expect(humanizeFlag("ex_pareja_alex", "en")).toBe("history as Álex's ex-partner");
    expect(humanizeFlag("web_corporativa_activa", "en")).toBe("live business website");

    const { state } = startNewRun(compiledCatalog, { seed: "P35-LOCKS-01" });
    const withLowSatStaff: GameState = {
      ...state,
      month: 2, // February
      employee: {
        character_id: "empleado_junior_dani",
        role_label: "Asistente júnior",
        monthly_cost: 1450,
        billing_multiplier: 1.35,
        satisfaction: 40,
        months_employed: 3,
      },
    };

    const enLockReasons = explainChoiceLockReasons(
      withLowSatStaff,
      {
        months_of_year: [7, 8],
        employee_satisfaction: { min: 65 },
        required_flags: ["estudio_propio_activo"],
      } as Parameters<typeof explainChoiceLockReasons>[1],
      "en",
    );
    expect(enLockReasons).toContain("Only available in July or August");
    expect(enLockReasons).toContain("Requires min. Staff satisfaction 65");
    expect(enLockReasons).toContain('Requires "active private studio"');

    const esLockReasons = explainChoiceLockReasons(
      withLowSatStaff,
      {
        months_of_year: [8],
        employee_satisfaction: { min: 65 },
        required_flags: ["clausula_pausa_firmada"],
      } as Parameters<typeof explainChoiceLockReasons>[1],
      "es-ES",
    );
    expect(esLockReasons).toContain("Solo disponible en Agosto");
    expect(esLockReasons).toContain("Requiere Satisfacción laboral mín. 65");
    expect(esLockReasons).toContain("Requiere «cláusula de pausa firmada»");
  });
});
