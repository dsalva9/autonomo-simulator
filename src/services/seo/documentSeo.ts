import type { GameState } from "../../engine/index.ts";
import { getEndingMetadata } from "../endings/endingMetadata.ts";
import {
  type SupportedLocale,
  formatCalendarBadgeEs,
  normalizeLocale,
} from "../i18n/resolveEventText.ts";

export type SeoPageView = "landing" | "title" | "game" | "end_run";

export interface DocumentSeoSnapshot {
  lang: "es" | "en";
  ogLocale: "es_ES" | "en_US";
  canonicalUrl: string;
  title: string;
  description: string;
}

const BASE_SITE_URL = "https://autonomo-simulator.com/";

export function parseUrlLocaleParam(search: string, pathname = ""): "es-ES" | "en" | null {
  if (search) {
    const params = new URLSearchParams(search);
    const raw = params.get("lang")?.trim().toLowerCase();
    if (raw) {
      if (raw === "en" || raw.startsWith("en-")) {
        return "en";
      }
      if (raw === "es" || raw.startsWith("es-")) {
        return "es-ES";
      }
    }
  }

  if (pathname && /\/en(?:\/(?:index\.html)?)?$/i.test(pathname.trim())) {
    return "en";
  }

  return null;
}

export function parseUrlInitialViewParam(search: string): "landing" | "title" | null {
  if (!search) {
    return null;
  }
  const params = new URLSearchParams(search);
  const raw = params.get("view")?.trim().toLowerCase();
  if (raw === "panel" || raw === "dashboard" || raw === "title") {
    return "title";
  }
  if (raw === "landing" || raw === "portada") {
    return "landing";
  }
  return null;
}

export function buildDocumentSeoSnapshot(options: {
  view: SeoPageView;
  locale: SupportedLocale;
  state?: GameState | null;
}): DocumentSeoSnapshot {
  const normalized = normalizeLocale(options.locale);
  const isEn = normalized === "en";
  const lang = isEn ? "en" : "es";
  const ogLocale = isEn ? "en_US" : "es_ES";
  const canonicalUrl = isEn ? `${BASE_SITE_URL}en/` : BASE_SITE_URL;

  if (options.view === "end_run" && options.state?.ending) {
    const endingMeta = getEndingMetadata(options.state.ending.id, normalized);
    return isEn
      ? {
          lang,
          ogLocale,
          canonicalUrl,
          title: `${endingMeta.title} · Form 036 Certificate — Autónomo Simulator`,
          description: `Official Form 036-END survival record: "${endingMeta.title}". Play Autónomo Simulator free in your browser — survive 10 years as a freelancer in Spain.`,
        }
      : {
          lang,
          ogLocale,
          canonicalUrl,
          title: `${endingMeta.title} · Certificado Modelo 036 — Autónomo Simulator`,
          description: `Acta final Modelo 036-FIN: «${endingMeta.title}». Juega gratis a Autónomo Simulator en navegador y sobrevive 10 años cotizando en el RETA.`,
        };
  }

  if (options.view === "game" && options.state) {
    const cal = formatCalendarBadgeEs(options.state.month, normalized);
    return isEn
      ? {
          lang,
          ogLocale,
          canonicalUrl,
          title: `${cal.label} · Active Dossier — Autónomo Simulator`,
          description:
            "Manage clients, monthly RETA fees, stress, and quarterly VAT/IRPF settlements in Autónomo Simulator — the satirical Spanish freelancer survival game.",
        }
      : {
          lang,
          ogLocale,
          canonicalUrl,
          title: `${cal.label} · Despacho en curso — Autónomo Simulator`,
          description:
            "Gestiona clientes, cuota mensual del RETA, estrés y cierres trimestrales de IVA e IRPF en Autónomo Simulator, el juego satírico sobre ser autónomo en España.",
        };
  }

  if (options.view === "title") {
    return isEn
      ? {
          lang,
          ogLocale,
          canonicalUrl,
          title: "Dossier Dashboard · Achievements — Autónomo Simulator",
          description:
            "Start a new seeded run, resume your active dossier, browse your Hall of the Fallen certificates, and track all 15 achievements in Autónomo Simulator.",
        }
      : {
          lang,
          ogLocale,
          canonicalUrl,
          title: "Panel de Expedientes · Logros — Autónomo Simulator",
          description:
            "Inicia una nueva alta en el RETA con semilla, reanuda tu partida, consulta el Salón de Caídos y sigue tus 15 logros en Autónomo Simulator.",
        };
  }

  return isEn
    ? {
        lang,
        ogLocale,
        canonicalUrl,
        title: "Autónomo Simulator — Spanish Freelancer Survival Game",
        description:
          "Free satirical survival game about freelancing in Spain. Balance clients, monthly fees, stress, and quarterly VAT & IRPF for 10 years or bank 150,000 €.",
      }
    : {
        lang,
        ogLocale,
        canonicalUrl,
        title: "Autónomo Simulator — Juego de supervivencia en el RETA",
        description:
          "Juego web gratuito de humor y supervivencia sobre ser autónomo en España. Sobrevive 10 años entre facturas, clientes regateadores, cuotas y el Trimestre.",
      };
}

function upsertMetaContent(
  selector: string,
  attrName: "name" | "property",
  attrValue: string,
  content: string,
): void {
  if (typeof document === "undefined") {
    return;
  }
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  if (el.getAttribute("content") !== content) {
    el.setAttribute("content", content);
  }
}

export function syncDocumentSeo(options: {
  view: SeoPageView;
  locale: SupportedLocale;
  state?: GameState | null;
}): DocumentSeoSnapshot {
  const snapshot = buildDocumentSeoSnapshot(options);
  if (typeof document === "undefined") {
    return snapshot;
  }

  if (document.documentElement.lang !== snapshot.lang) {
    document.documentElement.lang = snapshot.lang;
  }
  if (document.title !== snapshot.title) {
    document.title = snapshot.title;
  }

  upsertMetaContent('meta[name="description"]', "name", "description", snapshot.description);
  upsertMetaContent('meta[property="og:locale"]', "property", "og:locale", snapshot.ogLocale);
  upsertMetaContent('meta[property="og:title"]', "property", "og:title", snapshot.title);
  upsertMetaContent(
    'meta[property="og:description"]',
    "property",
    "og:description",
    snapshot.description,
  );
  upsertMetaContent('meta[property="og:url"]', "property", "og:url", snapshot.canonicalUrl);
  upsertMetaContent('meta[name="twitter:title"]', "name", "twitter:title", snapshot.title);
  upsertMetaContent(
    'meta[name="twitter:description"]',
    "name",
    "twitter:description",
    snapshot.description,
  );

  const canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonicalLink && canonicalLink.getAttribute("href") !== snapshot.canonicalUrl) {
    canonicalLink.setAttribute("href", snapshot.canonicalUrl);
  }

  return snapshot;
}
