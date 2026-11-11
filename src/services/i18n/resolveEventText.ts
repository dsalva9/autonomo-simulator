import type {
  ChoiceSpec,
  EventDef,
  FamilyStatus,
  GameState,
  GestorTier,
  RequirementsSpec,
} from "../../engine/index.ts";

export type SupportedLocale = "es-ES" | (string & {});

const localeOverlays = new Map<string, Record<string, string>>();

export function registerLocaleOverlay(
  locale: SupportedLocale,
  entries: Record<string, string>,
): void {
  const existing = localeOverlays.get(locale) ?? {};
  localeOverlays.set(locale, { ...existing, ...entries });
}

export function clearLocaleOverlays(): void {
  localeOverlays.clear();
}

/**
 * Resolves event copy by deterministic `<eventId>.<fieldPath>` path.
 * In MVP (`es-ES`), inline YAML strings act as authoritative fallback;
 * registered locale overlays override cleanly without changing event schemas.
 */
export function resolveEventText(
  locale: SupportedLocale,
  eventId: string,
  fieldPath: string,
  fallbackText: string,
): string {
  const table = localeOverlays.get(locale);
  if (!table) {
    return fallbackText;
  }
  const fullKey = `${eventId}.${fieldPath}`;
  return table[fullKey] ?? fallbackText;
}

export function resolveEventTitle(event: EventDef, locale: SupportedLocale = "es-ES"): string {
  return resolveEventText(locale, event.id, "title", event.title);
}

export function resolveEventBody(event: EventDef, locale: SupportedLocale = "es-ES"): string {
  return resolveEventText(locale, event.id, "body", event.body);
}

export function resolveChoiceLabel(
  eventId: string,
  choice: ChoiceSpec,
  locale: SupportedLocale = "es-ES",
): string {
  return resolveEventText(locale, eventId, `choices.${choice.id}.label`, choice.label);
}

export function resolveChoiceResultText(
  eventId: string,
  choiceId: string,
  outcomeId: string | null,
  fallbackText: string | null,
  locale: SupportedLocale = "es-ES",
): string | null {
  if (!fallbackText) {
    return null;
  }
  const path = outcomeId
    ? `choices.${choiceId}.outcomes.${outcomeId}.result_text`
    : `choices.${choiceId}.result_text`;
  return resolveEventText(locale, eventId, path, fallbackText);
}

/**
 * Deterministic Spanish integer thousands formatter (`3500` -> `"3.500 €"`, `-650` -> `"-650 €"`).
 * Avoids Node/Chromium ICU differences on 4-digit numbers.
 */
export function formatIntegerEs(value: number): string {
  const rounded = Math.round(value);
  const negative = rounded < 0;
  const digits = Math.abs(rounded).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return negative ? `-${grouped}` : grouped;
}

export function formatEuros(amount: number): string {
  return `${formatIntegerEs(amount)} €`;
}

export function formatSignedEuros(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded > 0) {
    return `+${formatIntegerEs(rounded)} €`;
  }
  return `${formatIntegerEs(rounded)} €`;
}

export function formatSignedInt(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) {
    return `+${rounded}`;
  }
  return `${rounded}`;
}

export function formatDurationMonthsEs(totalMonths: number): string {
  const safeMonths = Math.max(0, Math.floor(totalMonths));
  const years = Math.floor(safeMonths / 12);
  const remMonths = safeMonths % 12;

  if (years === 0) {
    return `${remMonths} ${remMonths === 1 ? "mes" : "meses"}`;
  }
  const yearLabel = `${years} ${years === 1 ? "año" : "años"}`;
  if (remMonths === 0) {
    return `${yearLabel} (${safeMonths} meses)`;
  }
  const monthLabel = `${remMonths} ${remMonths === 1 ? "mes" : "meses"}`;
  return `${yearLabel} y ${monthLabel} (${safeMonths} meses)`;
}

export function formatCalendarBadgeEs(month: number): {
  year: number;
  monthOfYear: number;
  quarter: number;
  monthsUntilTrimestre: number;
  label: string;
  trimestreLabel: string;
} {
  const safeMonth = Math.max(1, Math.floor(month));
  const year = Math.ceil(safeMonth / 12);
  const monthOfYear = ((safeMonth - 1) % 12) + 1;
  const quarter = Math.ceil(monthOfYear / 3);
  const mod = safeMonth % 3;
  const monthsUntilTrimestre = mod === 0 ? 0 : 3 - mod;

  const trimestreLabel =
    monthsUntilTrimestre === 0
      ? `Cierre T${quarter} este mes`
      : `Trimestre en ${monthsUntilTrimestre} ${monthsUntilTrimestre === 1 ? "mes" : "meses"}`;

  return {
    year,
    monthOfYear,
    quarter,
    monthsUntilTrimestre,
    label: `Año ${year} · Mes ${monthOfYear}`,
    trimestreLabel,
  };
}

export function translateGestorTier(tier: GestorTier): string {
  switch (tier) {
    case "self":
      return "Autogestión";
    case "cheap":
      return "Gestor económico";
    case "premium":
      return "Asesoría premium";
  }
}

export function translateFamilyStatus(status: FamilyStatus): string {
  switch (status) {
    case "single":
      return "Soltero/a";
    case "dating":
      return "En pareja";
    case "cohabiting":
      return "Conviviendo";
    case "separated":
      return "Separado/a";
  }
}

export function translateCategoryLabel(category: EventDef["category"]): string {
  switch (category) {
    case "clientes":
      return "Clientes y encargos";
    case "hacienda":
      return "Agencia Tributaria";
    case "familia":
      return "Familia y descanso";
    case "empleados":
      return "Plantilla laboral";
    case "gestor":
      return "Gestoría fiscal";
  }
}

export function describeFiscalRiskTension(fiscalRisk: number): {
  label: string;
  level: "calm" | "watched" | "critical";
} {
  if (fiscalRisk >= 55) {
    return { label: "En el punto de mira", level: "critical" };
  }
  if (fiscalRisk >= 25) {
    return { label: "Vigilado", level: "watched" };
  }
  return { label: "Tranquilo", level: "calm" };
}

const STAT_LABELS_ES: Record<keyof NonNullable<RequirementsSpec["stats"]>, string> = {
  money: "Dinero",
  moral: "Moral",
  stress: "Estrés",
  personal_life: "Vida personal",
  reputation: "Reputación",
  fiscal_risk: "Riesgo fiscal",
};

function humanizeFlagEs(flag: string): string {
  return flag.replace(/_/g, " ");
}

/**
 * Produces human-readable Spanish reasons explaining why a choice's requirements
 * are not currently met by `state`.
 */
export function explainChoiceLockReasons(
  state: GameState,
  requirements?: RequirementsSpec | null,
): string[] {
  if (!requirements) {
    return [];
  }

  const reasons: string[] = [];

  if (requirements.min_month != null && state.month < requirements.min_month) {
    reasons.push(`Disponible a partir del mes ${requirements.min_month}`);
  }
  if (requirements.max_month != null && state.month > requirements.max_month) {
    reasons.push(`Solo disponible hasta el mes ${requirements.max_month}`);
  }

  if (requirements.stats) {
    const statKeys = Object.keys(requirements.stats) as (keyof NonNullable<
      RequirementsSpec["stats"]
    >)[];
    for (const key of statKeys) {
      const range = requirements.stats[key];
      if (!range) {
        continue;
      }
      const currentVal = key === "fiscal_risk" ? state.fiscal_risk : state.indicators[key];
      const label = STAT_LABELS_ES[key];
      if (range.min != null && currentVal < range.min) {
        const formattedMin = key === "money" ? formatEuros(range.min) : String(range.min);
        reasons.push(`Requiere ${label} mín. ${formattedMin}`);
      }
      if (range.max != null && currentVal > range.max) {
        const formattedMax = key === "money" ? formatEuros(range.max) : String(range.max);
        reasons.push(`Requiere ${label} máx. ${formattedMax}`);
      }
    }
  }

  if (requirements.required_flags) {
    for (const flag of requirements.required_flags) {
      if (!state.flags[flag]) {
        reasons.push(`Requiere «${humanizeFlagEs(flag)}»`);
      }
    }
  }

  if (requirements.forbidden_flags) {
    for (const flag of requirements.forbidden_flags) {
      if (state.flags[flag]) {
        reasons.push(`No disponible con «${humanizeFlagEs(flag)}»`);
      }
    }
  }

  if (requirements.gestor_tiers && requirements.gestor_tiers.length > 0) {
    if (!requirements.gestor_tiers.includes(state.gestor.tier)) {
      const allowed = requirements.gestor_tiers.map(translateGestorTier).join(" o ");
      reasons.push(`Requiere gestoría: ${allowed}`);
    }
  }

  if (requirements.family_statuses && requirements.family_statuses.length > 0) {
    if (!requirements.family_statuses.includes(state.family.status)) {
      const allowed = requirements.family_statuses.map(translateFamilyStatus).join(" o ");
      reasons.push(`Requiere situación familiar: ${allowed}`);
    }
  }

  if (requirements.has_employee != null) {
    const currentlyHasEmployee = state.employee !== null;
    if (currentlyHasEmployee !== requirements.has_employee) {
      reasons.push(
        requirements.has_employee
          ? "Requiere tener un empleado en plantilla"
          : "Máximo 1 empleado en plantilla",
      );
    }
  }

  return reasons;
}
