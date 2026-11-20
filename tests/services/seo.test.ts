import { describe, expect, it } from "vitest";
import { type GameState, startNewRun } from "../../src/engine/index.ts";
import { compiledCatalog } from "../../src/services/content/catalog.ts";
import {
  buildDocumentSeoSnapshot,
  parseUrlInitialViewParam,
  parseUrlLocaleParam,
} from "../../src/services/seo/documentSeo.ts";

describe("Per-Page & Bilingual SEO Metadata Builder (documentSeo.ts)", () => {
  it("parses ?lang=es / ?lang=en, /en/ pathname, and ?view=panel / ?view=landing URL parameters safely", () => {
    expect(parseUrlLocaleParam("")).toBeNull();
    expect(parseUrlLocaleParam("?seed=FOO")).toBeNull();
    expect(parseUrlLocaleParam("?lang=fr")).toBeNull();
    expect(parseUrlLocaleParam("?lang=en")).toBe("en");
    expect(parseUrlLocaleParam("?lang=en-US")).toBe("en");
    expect(parseUrlLocaleParam("?lang=es")).toBe("es-ES");
    expect(parseUrlLocaleParam("?lang=es-ES")).toBe("es-ES");
    expect(parseUrlLocaleParam("", "/en/")).toBe("en");
    expect(parseUrlLocaleParam("", "/en")).toBe("en");
    expect(parseUrlLocaleParam("", "/en/index.html")).toBe("en");
    expect(parseUrlLocaleParam("?lang=es", "/en/")).toBe("es-ES");
    expect(parseUrlLocaleParam("", "/")).toBeNull();

    expect(parseUrlInitialViewParam("")).toBeNull();
    expect(parseUrlInitialViewParam("?view=panel")).toBe("title");
    expect(parseUrlInitialViewParam("?view=dashboard")).toBe("title");
    expect(parseUrlInitialViewParam("?view=landing")).toBe("landing");
    expect(parseUrlInitialViewParam("?view=unknown")).toBeNull();
  });

  it("builds distinct, localized SEO snapshots across Landing, Dashboard, GameScreen & EndRunScreen", () => {
    const landingEs = buildDocumentSeoSnapshot({ view: "landing", locale: "es-ES" });
    const landingEn = buildDocumentSeoSnapshot({ view: "landing", locale: "en" });

    expect(landingEs.lang).toBe("es");
    expect(landingEs.ogLocale).toBe("es_ES");
    expect(landingEs.canonicalUrl).toBe("https://autonomo-simulator.vercel.app/");
    expect(landingEs.title).toContain("Autónomo Simulator");
    expect(landingEs.description).toContain("autónomo en España");

    expect(landingEn.lang).toBe("en");
    expect(landingEn.ogLocale).toBe("en_US");
    expect(landingEn.canonicalUrl).toBe("https://autonomo-simulator.vercel.app/en/");
    expect(landingEn.title).toContain("Spanish Freelancer Survival Game");

    const dashEs = buildDocumentSeoSnapshot({ view: "title", locale: "es-ES" });
    const dashEn = buildDocumentSeoSnapshot({ view: "title", locale: "en" });
    expect(dashEs.title).toContain("Panel de Expedientes");
    expect(dashEn.title).toContain("Dossier Dashboard");
    expect(dashEs.title).not.toBe(landingEs.title);
    expect(dashEn.title).not.toBe(landingEn.title);

    const { state } = startNewRun(compiledCatalog, { seed: "SEO-TEST-01" });
    const gameEs = buildDocumentSeoSnapshot({ view: "game", locale: "es-ES", state });
    const gameEn = buildDocumentSeoSnapshot({ view: "game", locale: "en", state });

    expect(gameEs.title).toContain("Año 1 · Mes 1");
    expect(gameEn.title).toContain("Year 1 · Month 1");

    const endedState: GameState = {
      ...state,
      ending: {
        id: "retired_rich",
        month: 84,
        summary_quote: "Ricachón",
      },
    };
    const endEs = buildDocumentSeoSnapshot({ view: "end_run", locale: "es-ES", state: endedState });
    const endEn = buildDocumentSeoSnapshot({ view: "end_run", locale: "en", state: endedState });

    expect(endEs.title).toContain("Certificado Modelo 036");
    expect(endEn.title).toContain("Form 036 Certificate");
    expect(endEs.title).not.toBe(dashEs.title);
    expect(endEn.title).not.toBe(dashEn.title);
  });
});
