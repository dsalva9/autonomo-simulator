import { type SupportedLocale, normalizeLocale } from "../i18n/resolveEventText.ts";
import {
  ACHIEVEMENT_CATALOG,
  type AchievementDefinition,
  type AchievementId,
} from "../storage/index.ts";

const ACHIEVEMENT_TRANSLATIONS_EN: Readonly<
  Record<AchievementId, Pick<AchievementDefinition, "title" | "description">>
> = {
  primer_trimestre: {
    title: "Quarterly Baptism",
    description: "Reach month 3 and survive your very first quarterly VAT and income tax filing.",
  },
  primer_ano: {
    title: "First-Year Survivor",
    description:
      "Complete 12 consecutive months registered as self-employed without deregistering.",
  },
  gestor_contratado: {
    title: "Delegated Paperwork",
    description: "Hire a tax advisor so you stop fighting tax forms all by yourself.",
  },
  aplazamiento_solicitado: {
    title: "Kicking the Can",
    description:
      "Request a surcharged quarterly tax deferral to buy three months of financial breathing room.",
  },
  numeros_rojos_superados: {
    title: "Overdraft Tightrope",
    description:
      "Survive dipping into the red and climb back to a positive checking account balance.",
  },
  superviviente_hacienda: {
    title: "Tax Audit Survivor",
    description: "Resolve your first Tax Agency notice or audit file and stay in business.",
  },
  colchon_10k: {
    title: "Rainy-Day Cushion",
    description:
      "Gather at least 10,000 € in available cash without the quarterly filing evaporating it.",
  },
  primer_empleado: {
    title: "First Payroll on Deck",
    description: "Hire your first employee on payroll and shoulder their monthly social cost.",
  },
  familia_formada: {
    title: "Work-Life Household",
    description: "Move in together or grow your family while juggling client deadlines.",
  },
  criatura_en_casa: {
    title: "Parenting Juggler",
    description: "Raise at least one child at home while balancing clients, daycare, and filings.",
  },
  cinco_anos: {
    title: "Half a Decade Registered",
    description: "Endure five full years (60 months) of invoices, clients, and tax filings.",
  },
  facturacion_100k: {
    title: "Six Figures Invoiced",
    description:
      "Reach 100,000 € in cumulative official billing under the watchful eye of the tax office.",
  },
  heroe_120m: {
    title: "Self-Employed Hero!",
    description: "Survive ten full years (120 months) as a self-employed freelancer.",
  },
  ricachon_150k: {
    title: "Rolling in It",
    description: "Accumulate at least 150,000 € in available bank liquidity.",
  },
  modo_infinito: {
    title: "Contributing Masochist",
    description:
      "Turn down retirement after earning a victory seal and keep filing in Endless Mode.",
  },
};

export function getLocalizedAchievement(
  id: AchievementId,
  locale: SupportedLocale = "es-ES",
): AchievementDefinition | undefined {
  const base = ACHIEVEMENT_CATALOG.find((entry) => entry.id === id);
  if (!base) {
    return undefined;
  }
  if (normalizeLocale(locale) === "en") {
    const en = ACHIEVEMENT_TRANSLATIONS_EN[id];
    return {
      ...base,
      title: en.title,
      description: en.description,
    };
  }
  return base;
}

export function getLocalizedAchievementCatalog(
  locale: SupportedLocale = "es-ES",
): readonly AchievementDefinition[] {
  if (normalizeLocale(locale) !== "en") {
    return ACHIEVEMENT_CATALOG;
  }
  return ACHIEVEMENT_CATALOG.map((entry) => {
    const en = ACHIEVEMENT_TRANSLATIONS_EN[entry.id];
    return {
      ...entry,
      title: en.title,
      description: en.description,
    };
  });
}

export { ACHIEVEMENT_CATALOG, type AchievementDefinition, type AchievementId };
