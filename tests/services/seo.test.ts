import { describe, expect, it } from "vitest";
import { type GameState, startNewRun } from "../../src/engine/index.ts";
import { compiledCatalog } from "../../src/services/content/catalog.ts";
import {
  buildDocumentSeoSnapshot,
  parseUrlLocaleParam,
} from "../../src/services/seo/documentSeo.ts";

describe("Per-Page & Bilingual SEO Metadata Builder (documentSeo.ts)", () => {
  it("parses ?lang=es / ?lang=en URL query parameters safely", () => {
    expect(parseUrlLocaleParam("")).toBeNull();
    expect(parseUrlLocaleParam("?seed=FOO")).toBeNull();
    expect(parseUrlLocaleParam("?lang=fr")).toBeNull();
    expect(parseUrlLocaleParam("?lang=en")).toBe("en");
    expect(parseUrlLocaleParam("?lang=en-US")).toBe("en");
    expect(parseUrlLocaleParam("?lang=es")).toBe("es-ES");
    expect(parseUrlLocaleParam("?lang=es-ES")).toBe("es-ES");
  });

  it("builds distinct, localized SEO snapshots across TitleScreen, GameScreen & EndRunScreen", () => {
    const titleEs = buildDocumentSeoSnapshot({ view: "title", locale: "es-ES" });
    const titleEn = buildDocumentSeoSnapshot({ view: "title", locale: "en" });

    expect(titleEs.lang).toBe("es");
    expect(titleEs.ogLocale).toBe("es_ES");
    expect(titleEs.canonicalUrl).toBe("https://autonomo-simulator.vercel.app/");
    expect(titleEs.title).toContain("Autónomo Simulator");
    expect(titleEs.description).toContain("autónomo en España");

    expect(titleEn.lang).toBe("en");
    expect(titleEn.ogLocale).toBe("en_US");
    expect(titleEn.canonicalUrl).toBe("https://autonomo-simulator.vercel.app/?lang=en");
    expect(titleEn.title).toContain("Spanish Freelancer Survival Game");

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
    expect(endEs.title).not.toBe(titleEs.title);
    expect(endEn.title).not.toBe(titleEn.title);
  });
});
