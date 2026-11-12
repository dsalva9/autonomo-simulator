import type { EndingId, GameState, VictoryBadge } from "../../engine/index.ts";
import {
  type SupportedLocale,
  normalizeLocale,
  resolveChoiceResultText,
  resolveEventText,
} from "../i18n/resolveEventText.ts";

export interface EndingMetadata {
  code: string;
  title: string;
  subtitle: string;
  stampText: string;
  tone: "defeat" | "abandon" | "victory";
  defaultQuote: string;
}

const DEFAULT_SPANISH_ENDING_QUOTES: Record<EndingId, string> = {
  defeat_bankruptcy:
    "La cuota de autónomos no perdona ni aunque el banco te bloquee hasta el Bizum.",
  defeat_burnout_stress:
    "Cuando empezaste a soñar en formato Modelo 303, el médico te quitó el portátil.",
  defeat_resignation_moral:
    "Has cerrado el Excel, has borrado Slack y te has comprado un temario con subrayadores pastel.",
  abandon_oposiciones:
    "Cambias los clientes urgentes de viernes tarde por el BOE y un café de máquina.",
  abandon_salaried:
    "Vuelves a la nómina fija: cobras menos en bruto, pero los domingos vuelves a ser persona.",
  abandon_subsidies:
    "Tramitas el cese de actividad tras descubrir que emprender sin red tenía letra pequeña.",
  retired_hero:
    "Diez años cotizando sin perder el juicio del todo. En tu gestoría han puesto una placa con tu nombre.",
  retired_rich:
    "Con 150.000 € limpios en el banco, por fin puedes decir la frase mágica: «Consultadlo con mi asesor».",
};

export const ENDING_QUOTES_EN: Record<EndingId, string> = {
  defeat_bankruptcy:
    "The monthly self-employment fee shows no mercy even after the bank freezes your instant transfers.",
  defeat_burnout_stress:
    "Once you started dreaming in quarterly VAT boxes, your doctor confiscated the laptop.",
  defeat_resignation_moral:
    "You closed the spreadsheet, uninstalled Slack, and bought a civil-service syllabus with pastel highlighters.",
  abandon_oposiciones:
    "You trade Friday-evening rush revisions for the Official State Gazette and vending-machine coffee.",
  abandon_salaried:
    "Back on payroll: lower gross numbers on paper, yet on Sundays you are a human being again.",
  abandon_subsidies:
    "You file for cessation of activity after discovering that working without a safety net had fine print.",
  retired_hero:
    "Ten years contributing without completely losing your mind. Your tax advisor hung a brass plaque in your honor.",
  retired_rich:
    'With 150,000 € clear in the bank, you finally unlock the magic words: "Have your people call my advisor."',
};

export const ENDING_METADATA: Record<EndingId, EndingMetadata> = {
  defeat_bankruptcy: {
    code: "MOD. 036-BAJA · INSOLVENCIA",
    title: "Bancarrota en Números Rojos",
    subtitle: "Embargo de cuentas tras encadenar descubiertos sin liquidez para las cuotas.",
    stampText: "INSOLVENTE",
    tone: "defeat",
    defaultQuote: DEFAULT_SPANISH_ENDING_QUOTES.defeat_bankruptcy,
  },
  defeat_burnout_stress: {
    code: "MOD. IT-100 · BAJA POR ANSIEDAD",
    title: "Baja por Ansiedad Aguda",
    subtitle:
      "El médico de cabecera te ha confiscado el portátil, el móvil y el certificado digital.",
    stampText: "COLAPSO",
    tone: "defeat",
    defaultQuote: DEFAULT_SPANISH_ENDING_QUOTES.defeat_burnout_stress,
  },
  defeat_resignation_moral: {
    code: "MOD. 037 · AGOTAMIENTO MORAL",
    title: "Moral a Cero: Cierre de Persiana",
    subtitle:
      "Has cerrado la hoja de cálculo, borrado el correo y comprado subrayadores para opositar.",
    stampText: "DIMISIÓN",
    tone: "defeat",
    defaultQuote: DEFAULT_SPANISH_ENDING_QUOTES.defeat_resignation_moral,
  },
  abandon_oposiciones: {
    code: "MOD. BOE-A1 · TRANSICIÓN PÚBLICA",
    title: "Exilio Voluntario al Temario",
    subtitle: "Cambias los encargos urgentes de viernes noche por el Boletín Oficial del Estado.",
    stampText: "OPOSITOR",
    tone: "abandon",
    defaultQuote: DEFAULT_SPANISH_ENDING_QUOTES.abandon_oposiciones,
  },
  abandon_salaried: {
    code: "MOD. CTA-AJENA · VUELTA A OFICINA",
    title: "Regreso a la Nómina Fija",
    subtitle:
      "Vuelves a aguantar reuniones ajenas, pero los domingos vuelves a dormir de un tirón.",
    stampText: "ASALARIADO",
    tone: "abandon",
    defaultQuote: DEFAULT_SPANISH_ENDING_QUOTES.abandon_salaried,
  },
  abandon_subsidies: {
    code: "MOD. CESE-ACT · FIN DE ETAPA",
    title: "Cese de Actividad Tramitado",
    subtitle:
      "Cierras el expediente tras descubrir en propia piel la letra pequeña de emprender sin red.",
    stampText: "BAJA RETA",
    tone: "abandon",
    defaultQuote: DEFAULT_SPANISH_ENDING_QUOTES.abandon_subsidies,
  },
  retired_hero: {
    code: "MOD. HONOR-120 · SUPERVIVIENTE DECENAL",
    title: "¡Eres un Héroe del RETA!",
    subtitle: "Diez años completos sobreviviendo a clientes, cuotas, trimestres e imprevistos.",
    stampText: "HÉROE 10 AÑOS",
    tone: "victory",
    defaultQuote: DEFAULT_SPANISH_ENDING_QUOTES.retired_hero,
  },
  retired_rich: {
    code: "MOD. PATRIMONIO-150K · RETIRO DORADO",
    title: "¡Ricachón! Retiro con 150.000 €",
    subtitle: "Liquidez suficiente en el banco para delegar hasta la lectura de notificaciones.",
    stampText: "RICACHÓN",
    tone: "victory",
    defaultQuote: DEFAULT_SPANISH_ENDING_QUOTES.retired_rich,
  },
};

export const ENDING_METADATA_EN: Record<EndingId, EndingMetadata> = {
  defeat_bankruptcy: {
    code: "FORM 036-EXIT · INSOLVENCY",
    title: "Bankruptcy in the Red",
    subtitle: "Accounts frozen after chaining overdrafts with zero cash left for monthly fees.",
    stampText: "INSOLVENT",
    tone: "defeat",
    defaultQuote: ENDING_QUOTES_EN.defeat_bankruptcy,
  },
  defeat_burnout_stress: {
    code: "FORM SL-100 · BURNOUT LEAVE",
    title: "Acute Burnout Leave",
    subtitle: "Your doctor confiscated your laptop, phone, and digital tax certificate.",
    stampText: "BURNOUT",
    tone: "defeat",
    defaultQuote: ENDING_QUOTES_EN.defeat_burnout_stress,
  },
  defeat_resignation_moral: {
    code: "FORM 037 · MORALE EXHAUSTION",
    title: "Zero Morale: Shutters Down",
    subtitle: "You closed the spreadsheet, deleted your inbox, and bought pastel highlighters.",
    stampText: "RESIGNED",
    tone: "defeat",
    defaultQuote: ENDING_QUOTES_EN.defeat_resignation_moral,
  },
  abandon_oposiciones: {
    code: "FORM CS-A1 · PUBLIC EXAM TRACK",
    title: "Voluntary Exile to Civil Exams",
    subtitle: "Trading Friday-night rush gigs for civil-service study binders and vending coffee.",
    stampText: "CIVIL EXAM",
    tone: "abandon",
    defaultQuote: ENDING_QUOTES_EN.abandon_oposiciones,
  },
  abandon_salaried: {
    code: "FORM PAY-ROLL · BACK TO OFFICE",
    title: "Return to a Fixed Paycheck",
    subtitle: "You sit through someone else's meetings again, yet sleep straight through Sundays.",
    stampText: "SALARIED",
    tone: "abandon",
    defaultQuote: ENDING_QUOTES_EN.abandon_salaried,
  },
  abandon_subsidies: {
    code: "FORM CEASE-ACT · CASE CLOSED",
    title: "Cessation of Activity Filed",
    subtitle:
      "You close the dossier after learning firsthand the fine print of freelancing without a net.",
    stampText: "DEREGISTERED",
    tone: "abandon",
    defaultQuote: ENDING_QUOTES_EN.abandon_subsidies,
  },
  retired_hero: {
    code: "FORM HONOR-120 · DECADE SURVIVOR",
    title: "Self-Employed Hero!",
    subtitle: "Ten full years surviving clients, monthly contributions, quarters, and surprises.",
    stampText: "10-YR HERO",
    tone: "victory",
    defaultQuote: ENDING_QUOTES_EN.retired_hero,
  },
  retired_rich: {
    code: "FORM WEALTH-150K · GOLDEN EXIT",
    title: "Rolling in It! 150,000 € Exit",
    subtitle: "Enough liquidity in the bank to outsource even opening electronic tax notices.",
    stampText: "TYCOON",
    tone: "victory",
    defaultQuote: ENDING_QUOTES_EN.retired_rich,
  },
};

export const VICTORY_BADGE_LABELS: Record<VictoryBadge, { title: string; shortSeal: string }> = {
  hero_120m: {
    title: "¡Eres un héroe! (120 meses)",
    shortSeal: "SELLO HÉROE · 120M",
  },
  rich_150k: {
    title: "Ricachón (150.000 €)",
    shortSeal: "SELLO RICACHÓN · 150K€",
  },
};

export const VICTORY_BADGE_LABELS_EN: Record<VictoryBadge, { title: string; shortSeal: string }> = {
  hero_120m: {
    title: "Self-Employed Hero! (120 months)",
    shortSeal: "HERO SEAL · 120M",
  },
  rich_150k: {
    title: "Rolling in It (150,000 €)",
    shortSeal: "TYCOON SEAL · 150K€",
  },
};

const ABANDON_EVENT_CHOICE_BY_ENDING: Partial<
  Record<EndingId, { eventId: string; choiceId: string }>
> = {
  abandon_oposiciones: {
    eventId: "familia_encrucijada_agotamiento",
    choiceId: "cerrar_y_preparar_oposiciones",
  },
  abandon_salaried: {
    eventId: "familia_encrucijada_agotamiento",
    choiceId: "volver_a_empleo_asalariado",
  },
  abandon_subsidies: {
    eventId: "familia_encrucijada_agotamiento",
    choiceId: "solicitar_cese_y_prestacion",
  },
};

const KNOWN_ABANDON_QUOTES_ES_TO_EN: Readonly<Record<string, string>> = {
  "Das de baja la actividad, archivas las carpetas del trimestre y despejas la mesa para el temario y el cronómetro: cambias clientes de viernes tarde por una meta estable.":
    "You deregister your business, box up your quarterly tax binders, and clear the desk for exam syllabi and a stopwatch: trading Friday-evening clients for a steady goal.",
  "Cambias la épica emprendedora por un contrato en plantilla y horario de oficina: el primer domingo sin abrir el correo sientes que vuelves a respirar.":
    "You trade entrepreneurial hustle for a salaried contract and office hours: on your first Sunday without checking email, you feel like you can breathe again.",
  "Tras tantos meses cotizando religiosamente, acreditas el cese de actividad y te apoyas en la protección pública que te corresponde para descansar y recomponerte con calma.":
    "After so many months paying contributions religiously, you document your cessation of activity and lean on the public benefits you earned to rest and rebuild calmly.",
};

const DEFAULT_FALLBACK_QUOTE_ES = "Sé tu propio jefe. Descubre por qué era mala idea.";
const DEFAULT_FALLBACK_QUOTE_EN = "Be your own boss. Find out why it was a terrible idea.";

function looksLikeRawSpanishQuote(text: string): boolean {
  return /[áéíóúñ¡¿«»]|\b(das de baja|cambias|tras tantos|cotizando|trimestre|actividad|persiana|cuota|autonom|hacienda|nomina|portatil|medico|despacho|clientes)\b/i.test(
    text,
  );
}

export function getEndingMetadata(
  endingId: EndingId,
  locale: SupportedLocale = "es-ES",
): EndingMetadata {
  return normalizeLocale(locale) === "en"
    ? ENDING_METADATA_EN[endingId]
    : ENDING_METADATA[endingId];
}

export function getVictoryBadgeLabel(
  badge: VictoryBadge,
  locale: SupportedLocale = "es-ES",
): { title: string; shortSeal: string } {
  return normalizeLocale(locale) === "en"
    ? VICTORY_BADGE_LABELS_EN[badge]
    : VICTORY_BADGE_LABELS[badge];
}

export function resolveLocalizedEndingQuote(
  endingId: EndingId,
  rawQuote: string,
  locale: SupportedLocale = "es-ES",
  state?: GameState | null,
): string {
  if (normalizeLocale(locale) !== "en") {
    return rawQuote;
  }
  const canonicalEnFallback =
    ENDING_METADATA_EN[endingId]?.defaultQuote ??
    ENDING_QUOTES_EN[endingId] ??
    DEFAULT_FALLBACK_QUOTE_EN;

  if (!rawQuote || rawQuote === DEFAULT_FALLBACK_QUOTE_ES) {
    return canonicalEnFallback;
  }
  if (rawQuote === DEFAULT_SPANISH_ENDING_QUOTES[endingId]) {
    return canonicalEnFallback;
  }

  const exactKnownAbandon = KNOWN_ABANDON_QUOTES_ES_TO_EN[rawQuote];
  if (exactKnownAbandon) {
    const mapped = ABANDON_EVENT_CHOICE_BY_ENDING[endingId];
    if (mapped) {
      const fromOverlay = resolveEventText(
        "en",
        mapped.eventId,
        `choices.${mapped.choiceId}.result_text`,
        "",
      );
      if (fromOverlay && fromOverlay.trim().length > 0) {
        return fromOverlay;
      }
    }
    return exactKnownAbandon;
  }

  if (state?.history && state.history.length > 0) {
    for (let i = state.history.length - 1; i >= 0; i -= 1) {
      const entry = state.history[i];
      if (entry?.kind === "event_choice" && entry.event_id && entry.choice_id) {
        const resolved = resolveChoiceResultText(
          entry.event_id,
          entry.choice_id,
          entry.outcome_id ?? null,
          rawQuote,
          "en",
        );
        if (resolved && resolved !== rawQuote) {
          return resolved;
        }
        break;
      }
    }
  }

  if (endingId.startsWith("abandon_")) {
    const mapped = ABANDON_EVENT_CHOICE_BY_ENDING[endingId];
    if (mapped && looksLikeRawSpanishQuote(rawQuote)) {
      const fromOverlay = resolveEventText(
        "en",
        mapped.eventId,
        `choices.${mapped.choiceId}.result_text`,
        "",
      );
      if (fromOverlay && fromOverlay.trim().length > 0) {
        return fromOverlay;
      }
      return canonicalEnFallback;
    }
  }

  if (looksLikeRawSpanishQuote(rawQuote)) {
    return canonicalEnFallback;
  }

  return rawQuote;
}
