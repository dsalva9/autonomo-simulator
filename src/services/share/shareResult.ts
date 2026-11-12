import type { EndingId, GameState, VictoryBadge } from "../../engine/index.ts";
import {
  ENDING_METADATA,
  type EndingMetadata,
  VICTORY_BADGE_LABELS,
  getEndingMetadata,
  getVictoryBadgeLabel,
  resolveLocalizedEndingQuote,
} from "../endings/endingMetadata.ts";
import {
  type SupportedLocale,
  formatDurationMonthsEs,
  formatEuros,
  normalizeLocale,
} from "../i18n/resolveEventText.ts";

export { ENDING_METADATA, VICTORY_BADGE_LABELS, type EndingMetadata };

export interface EndRunShareSummary {
  monthsSurvived: number;
  finalMoney: number;
  lifetimeBilled: number;
  endingId: EndingId;
  summaryQuote: string;
  localizedQuoteEn?: string;
  earnedVictories: VictoryBadge[];
  seed: string;
  endlessMode: boolean;
  gameUrl: string;
}

export interface RenderShareCardOptions {
  illustrationImage?: CanvasImageSource | null;
  locale?: SupportedLocale;
}

export const CANONICAL_GAME_URL = "https://autonomo-simulator.vercel.app/";

export function resolveShareUrl(explicitUrl?: string): string {
  if (explicitUrl && explicitUrl.trim().length > 0) {
    return explicitUrl.trim();
  }
  if (typeof window !== "undefined" && window.location?.href) {
    const { protocol, hostname, origin, pathname } = window.location;
    const isHttp = protocol === "http:" || protocol === "https:";
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]";
    if (isHttp && hostname && !isLocalhost) {
      return `${origin}${pathname}`;
    }
  }
  return CANONICAL_GAME_URL;
}

export function createShareSummaryFromState(
  state: GameState,
  explicitUrl?: string,
): EndRunShareSummary {
  const endingId: EndingId = state.ending?.id ?? "defeat_bankruptcy";
  const monthsSurvived = state.ending?.month ?? state.month;
  const summaryQuote =
    state.ending?.summary_quote ?? "Sé tu propio jefe. Descubre por qué era mala idea.";

  return {
    monthsSurvived,
    finalMoney: state.indicators.money,
    lifetimeBilled: state.finances.lifetime_billed,
    endingId,
    summaryQuote,
    localizedQuoteEn: resolveLocalizedEndingQuote(endingId, summaryQuote, "en", state),
    earnedVictories: [...state.earned_victories],
    seed: state.prng.seed,
    endlessMode: state.endless_mode,
    gameUrl: resolveShareUrl(explicitUrl),
  };
}

export function buildShareText(
  summary: EndRunShareSummary,
  locale: SupportedLocale = "es-ES",
): string {
  const isEn = normalizeLocale(locale) === "en";
  const meta = getEndingMetadata(summary.endingId, locale);
  const duration = formatDurationMonthsEs(summary.monthsSurvived, locale);
  const quote =
    isEn && summary.localizedQuoteEn
      ? summary.localizedQuoteEn
      : resolveLocalizedEndingQuote(summary.endingId, summary.summaryQuote, locale);

  if (isEn) {
    const lines: string[] = [
      "📋 FORM 036-END · SELF-EMPLOYED SURVIVAL CERTIFICATE",
      `📌 Outcome: ${meta.title}`,
      `⏱️ Time contributed: ${duration}`,
      `💶 Final cash: ${formatEuros(summary.finalMoney, locale)} | 🧾 Official billing: ${formatEuros(summary.lifetimeBilled, locale)}`,
    ];

    if (summary.earnedVictories.length > 0) {
      const badges = summary.earnedVictories
        .map((b) => getVictoryBadgeLabel(b, locale).title)
        .join(" · ");
      lines.push(`🏅 Seals earned: ${badges}`);
    }

    lines.push(`"${quote}"`);
    lines.push(`🎲 Seed: ${summary.seed} · ${summary.gameUrl}`);

    return lines.join("\n");
  }

  const lines: string[] = [
    "📋 MODELO 036-FIN · CERTIFICADO DE SUPERVIVENCIA AUTÓNOMA",
    `📌 Desenlace: ${meta.title}`,
    `⏱️ Tiempo cotizado: ${duration}`,
    `💶 Liquidez final: ${formatEuros(summary.finalMoney)} | 🧾 Facturado oficial: ${formatEuros(summary.lifetimeBilled)}`,
  ];

  if (summary.earnedVictories.length > 0) {
    const badges = summary.earnedVictories.map((b) => VICTORY_BADGE_LABELS[b].title).join(" · ");
    lines.push(`🏅 Sellos conquistados: ${badges}`);
  }

  lines.push(`«${summary.summaryQuote}»`);
  lines.push(`🎲 Semilla: ${summary.seed} · ${summary.gameUrl}`);

  return lines.join("\n");
}

function wrapCanvasParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function getSourceImageDimensions(source: CanvasImageSource): { w: number; h: number } | null {
  const rec = source as unknown as Record<string, unknown>;
  const w =
    typeof rec.naturalWidth === "number" && rec.naturalWidth > 0
      ? rec.naturalWidth
      : typeof rec.videoWidth === "number" && rec.videoWidth > 0
        ? rec.videoWidth
        : typeof rec.width === "number" && rec.width > 0
          ? rec.width
          : 0;
  const h =
    typeof rec.naturalHeight === "number" && rec.naturalHeight > 0
      ? rec.naturalHeight
      : typeof rec.videoHeight === "number" && rec.videoHeight > 0
        ? rec.videoHeight
        : typeof rec.height === "number" && rec.height > 0
          ? rec.height
          : 0;
  return w > 0 && h > 0 ? { w, h } : null;
}

function drawCoverIllustration(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
): void {
  if (typeof ctx.drawImage !== "function") {
    return;
  }
  try {
    const dims = getSourceImageDimensions(source);
    if (!dims) {
      ctx.drawImage(source, destX, destY, destW, destH);
      return;
    }
    const targetAspect = destW / destH;
    const sourceAspect = dims.w / dims.h;
    let sx = 0;
    let sy = 0;
    let sw = dims.w;
    let sh = dims.h;

    if (Math.abs(sourceAspect - targetAspect) > 0.01) {
      if (sourceAspect > targetAspect) {
        sw = Math.round(dims.h * targetAspect);
        sx = Math.floor((dims.w - sw) / 2);
      } else {
        sh = Math.round(dims.w / targetAspect);
        sy = Math.floor((dims.h - sh) / 2);
      }
    }
    ctx.drawImage(source, sx, sy, sw, sh, destX, destY, destW, destH);
  } catch {
    // Gracefully keep paper backing if source image is broken or unloaded
  }
}

/**
 * Renders a 1080×1350 portrait bureaucratic certificate onto the provided `<canvas>`.
 * When `options.illustrationImage` is supplied, composites a framed 16:9 comic vignette
 * cleanly between the outcome header and the 2×2 casilla grid with zero overlap.
 * Safe in headless/unit environments where 2D context may be unavailable.
 */
export function renderShareCardToCanvas(
  canvas: HTMLCanvasElement,
  summary: EndRunShareSummary,
  options?: RenderShareCardOptions,
): boolean {
  const width = 1080;
  const height = 1350;
  canvas.width = width;
  canvas.height = height;

  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) {
    return false;
  }

  const locale = options?.locale ?? "es-ES";
  const isEn = normalizeLocale(locale) === "en";
  const illustration = options?.illustrationImage ?? null;
  const hasIllustration = illustration !== null;

  const meta = getEndingMetadata(summary.endingId, locale);
  const localizedQuote =
    isEn && summary.localizedQuoteEn
      ? summary.localizedQuoteEn
      : resolveLocalizedEndingQuote(summary.endingId, summary.summaryQuote, locale);
  const stampPrimary =
    meta.tone === "victory" ? "#1F5C53" : meta.tone === "abandon" ? "#264E7A" : "#B42B24";
  const stampFill =
    meta.tone === "victory" ? "#E8F5F1" : meta.tone === "abandon" ? "#EBF2FA" : "#FDF0EF";

  // 1. Warm archival paper base
  ctx.fillStyle = "#F6EFE0";
  ctx.fillRect(0, 0, width, height);

  // Subtle ruled ledger lines
  ctx.strokeStyle = "#E6DCC6";
  ctx.lineWidth = 1;
  for (let y = 120; y < height - 80; y += 36) {
    ctx.beginPath();
    ctx.moveTo(48, y);
    ctx.lineTo(width - 48, y);
    ctx.stroke();
  }

  // 2. Heavy double bureaucratic border
  ctx.strokeStyle = "#1F2421";
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, width - 72, height - 72);
  ctx.lineWidth = 2;
  ctx.strokeRect(50, 50, width - 100, height - 100);

  const innerTextMaxWidth = width - 168;
  const outcomeColumnMaxWidth = 556;

  const headerH = hasIllustration ? 114 : 128;
  const subheaderY = 50 + headerH;
  const subheaderH = hasIllustration ? 56 : 68;

  // 3. Official Ministry-Parody Top Header Banner
  ctx.fillStyle = "#1F2421";
  ctx.fillRect(50, 50, width - 100, headerH);

  ctx.fillStyle = "#FCE592";
  ctx.font = hasIllustration
    ? "700 21px 'Courier New', monospace"
    : "700 22px 'Courier New', monospace";
  ctx.fillText(
    isEn
      ? "FORM 036-END · SELF-EMPLOYED SURVIVAL CERTIFICATE"
      : "MODELO 036-FIN · CERTIFICADO DE SUPERVIVENCIA AUTÓNOMA",
    84,
    hasIllustration ? 92 : 98,
    innerTextMaxWidth,
  );

  ctx.fillStyle = "#FFFDF8";
  ctx.font = hasIllustration ? "700 28px Georgia, serif" : "700 30px Georgia, serif";
  ctx.fillText(
    isEn ? "AUTÓNOMO SIMULATOR · DOSSIER REGISTRY" : "AUTÓNOMO SIMULATOR · REGISTRO DE EXPEDIENTES",
    84,
    hasIllustration ? 138 : 146,
    innerTextMaxWidth,
  );

  // 4. Form Subheader Strip
  ctx.fillStyle = "#EFE4CE";
  ctx.fillRect(50, subheaderY, width - 100, subheaderH);
  ctx.strokeStyle = "#1F2421";
  ctx.lineWidth = 2;
  ctx.strokeRect(50, subheaderY, width - 100, subheaderH);

  const subheaderTextY = hasIllustration ? 199 : 220;
  ctx.fillStyle = "#1F2421";
  ctx.font = hasIllustration
    ? "700 20px 'Courier New', monospace"
    : "700 21px 'Courier New', monospace";
  ctx.fillText(meta.code, 84, subheaderTextY, 500);

  const seedDisplay = summary.seed.length > 26 ? `${summary.seed.slice(0, 25)}…` : summary.seed;
  ctx.textAlign = "right";
  ctx.fillStyle = "#4A524E";
  ctx.fillText(
    isEn ? `SEED: ${seedDisplay}` : `SEMILLA: ${seedDisplay}`,
    width - 84,
    subheaderTextY,
    388,
  );
  ctx.textAlign = "left";

  // 5. Outcome Title Block (constrained to left column clear of tilted rubber stamp)
  ctx.fillStyle = stampPrimary;
  ctx.font = hasIllustration
    ? "700 20px 'Courier New', monospace"
    : "700 21px 'Courier New', monospace";
  ctx.fillText(
    isEn
      ? summary.endlessMode
        ? "FINAL RULING (ENDLESS MODE)"
        : "DOSSIER RULING"
      : summary.endlessMode
        ? "RESOLUCIÓN FINAL (MODO INFINITO)"
        : "RESOLUCIÓN DEL EXPEDIENTE",
    84,
    hasIllustration ? 256 : 288,
    outcomeColumnMaxWidth,
  );

  ctx.fillStyle = "#1F2421";
  ctx.font = hasIllustration ? "700 38px Georgia, serif" : "700 44px Georgia, serif";
  const titleLines = wrapCanvasParagraph(ctx, meta.title, outcomeColumnMaxWidth);
  let cursorY = hasIllustration ? 300 : 340;
  const titleStep = hasIllustration ? 42 : 48;
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, 84, cursorY, outcomeColumnMaxWidth);
    cursorY += titleStep;
  }

  ctx.fillStyle = "#4A524E";
  ctx.font = hasIllustration
    ? "400 21px 'Trebuchet MS', sans-serif"
    : "400 24px 'Trebuchet MS', sans-serif";
  const subLines = wrapCanvasParagraph(ctx, meta.subtitle, outcomeColumnMaxWidth);
  let subY = cursorY - 6;
  const subStep = hasIllustration ? 26 : 32;
  for (const line of subLines.slice(0, 3)) {
    ctx.fillText(line, 84, subY, outcomeColumnMaxWidth);
    subY += subStep;
  }

  // 5B. Framed 16:9 Comic Vignette Box (when ending illustration is provided)
  if (hasIllustration && illustration) {
    const vignetteBoxX = 84;
    const vignetteBoxY = 448;
    const vignetteBoxW = width - 168;
    const vignetteBoxH = 339;

    ctx.fillStyle = "#FFFDF8";
    ctx.fillRect(vignetteBoxX, vignetteBoxY, vignetteBoxW, vignetteBoxH);
    ctx.strokeStyle = "#1F2421";
    ctx.lineWidth = 3;
    ctx.strokeRect(vignetteBoxX, vignetteBoxY, vignetteBoxW, vignetteBoxH);

    ctx.fillStyle = "#EFE4CE";
    ctx.fillRect(vignetteBoxX + 3, vignetteBoxY + 3, vignetteBoxW - 6, 30);
    ctx.fillStyle = "#4A524E";
    ctx.font = "700 17px 'Courier New', monospace";
    ctx.fillText(
      isEn
        ? "VISUAL EXHIBIT [00] · ARCHIVAL DOSSIER EVIDENCE"
        : "ANEXO GRÁFICO [00] · EVIDENCIA VISUAL DEL EXPEDIENTE",
      vignetteBoxX + 20,
      vignetteBoxY + 24,
      vignetteBoxW - 40,
    );

    // Exact 16:9 comic panel viewport (512×288) centered on archival paper mount
    const panelW = 512;
    const panelH = 288;
    const panelX = Math.floor((width - panelW) / 2);
    const panelY = vignetteBoxY + 41;

    // Decorative archival side-margin registration rules
    ctx.strokeStyle = "#DACBB2";
    ctx.lineWidth = 2;
    for (let tickY = panelY + 28; tickY < panelY + panelH - 16; tickY += 48) {
      ctx.beginPath();
      ctx.moveTo(vignetteBoxX + 28, tickY);
      ctx.lineTo(panelX - 24, tickY);
      ctx.moveTo(panelX + panelW + 24, tickY);
      ctx.lineTo(vignetteBoxX + vignetteBoxW - 28, tickY);
      ctx.stroke();
    }

    // Hard offset comic ink shadow + paper backing + illustration + 3px ink frame
    ctx.fillStyle = "#1F2421";
    ctx.fillRect(panelX + 5, panelY + 5, panelW, panelH);

    ctx.fillStyle = "#F6EFE0";
    ctx.fillRect(panelX, panelY, panelW, panelH);

    drawCoverIllustration(ctx, illustration, panelX, panelY, panelW, panelH);

    ctx.strokeStyle = "#1F2421";
    ctx.lineWidth = 3;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
  }

  // 6. 2x2 Official Ledger Boxes
  const gridTop = hasIllustration ? 804 : 530;
  const boxW = (width - 192) / 2;
  const boxH = hasIllustration ? 108 : 156;
  const boxRowGap = hasIllustration ? 14 : 22;
  const boxes = [
    {
      code: isEn ? "BOX [01] · TIME CONTRIBUTED" : "CASILLA [01] · TIEMPO COTIZADO",
      value: formatDurationMonthsEs(summary.monthsSurvived, locale),
      accent: "#1F2421",
    },
    {
      code: isEn ? "BOX [02] · AVAILABLE CASH" : "CASILLA [02] · LIQUIDEZ DISPONIBLE",
      value: formatEuros(summary.finalMoney, locale),
      accent: summary.finalMoney < 0 ? "#B42B24" : "#1F5C53",
    },
    {
      code: isEn ? "BOX [03] · OFFICIAL BILLING" : "CASILLA [03] · FACTURACIÓN OFICIAL",
      value: formatEuros(summary.lifetimeBilled, locale),
      accent: "#264E7A",
    },
    {
      code: isEn ? "BOX [04] · REGIME MODE" : "CASILLA [04] · MODALIDAD",
      value: isEn
        ? summary.endlessMode
          ? "Endless Mode (+120m)"
          : "RETA Campaign (10 yrs)"
        : summary.endlessMode
          ? "Modo Infinito (+120m)"
          : "Campaña RETA (10 años)",
      accent: "#1F2421",
    },
  ];

  boxes.forEach((box, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 84 + col * (boxW + 24);
    const y = gridTop + row * (boxH + boxRowGap);

    ctx.fillStyle = "#FFFDF8";
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = "#1F2421";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, boxW, boxH);

    const headerBandH = hasIllustration ? 34 : 42;
    ctx.fillStyle = "#EFE4CE";
    ctx.fillRect(x + 3, y + 3, boxW - 6, headerBandH);
    ctx.fillStyle = "#4A524E";
    ctx.font = hasIllustration
      ? "700 17px 'Courier New', monospace"
      : "700 18px 'Courier New', monospace";
    ctx.fillText(box.code, x + 18, y + (hasIllustration ? 24 : 30), boxW - 36);

    ctx.fillStyle = box.accent;
    const maxValWidth = boxW - 36;
    const baseValFontPx = hasIllustration ? 29 : 34;
    const minValFontPx = 18;
    let displayVal = box.value;
    let fittedFontPx = baseValFontPx;
    ctx.font = `700 ${fittedFontPx}px 'Courier New', monospace`;

    while (fittedFontPx > minValFontPx && ctx.measureText(displayVal).width > maxValWidth) {
      fittedFontPx -= 1;
      ctx.font = `700 ${fittedFontPx}px 'Courier New', monospace`;
    }

    if (idx === 0 && ctx.measureText(displayVal).width > maxValWidth) {
      const years = Math.floor(summary.monthsSurvived / 12);
      const remMonths = summary.monthsSurvived % 12;
      displayVal =
        years > 0
          ? isEn
            ? `${years}y ${remMonths}m (${summary.monthsSurvived} mos)`
            : `${years}a ${remMonths}m (${summary.monthsSurvived} meses)`
          : displayVal;
      fittedFontPx = baseValFontPx;
      ctx.font = `700 ${fittedFontPx}px 'Courier New', monospace`;
      while (fittedFontPx > minValFontPx && ctx.measureText(displayVal).width > maxValWidth) {
        fittedFontPx -= 1;
        ctx.font = `700 ${fittedFontPx}px 'Courier New', monospace`;
      }
    }

    const valBaselineY = y + (hasIllustration ? 75 : 108);
    ctx.fillText(displayVal, x + 18, valBaselineY, maxValWidth);
  });

  // 7. Satirical Quote / Epitaph Box
  const quoteBoxY = hasIllustration ? 1050 : 898;
  const quoteBoxH = hasIllustration ? 142 : 204;
  ctx.fillStyle = "#FFFDF8";
  ctx.fillRect(84, quoteBoxY, width - 168, quoteBoxH);
  ctx.strokeStyle = "#1F2421";
  ctx.lineWidth = 3;
  ctx.strokeRect(84, quoteBoxY, width - 168, quoteBoxH);

  ctx.fillStyle = "#9A5B13";
  ctx.font = hasIllustration
    ? "700 18px 'Courier New', monospace"
    : "700 19px 'Courier New', monospace";
  ctx.fillText(
    isEn ? "CLOSING REMARKS & AUDIT NOTES:" : "OBSERVACIONES E INFORME DE CIERRE:",
    112,
    quoteBoxY + (hasIllustration ? 30 : 38),
    width - 224,
  );

  ctx.fillStyle = "#1F2421";
  ctx.font = hasIllustration ? "italic 25px Georgia, serif" : "italic 30px Georgia, serif";
  const framedQuote = isEn ? `"${localizedQuote}"` : `«${localizedQuote}»`;
  const quoteLines = wrapCanvasParagraph(ctx, framedQuote, width - 224);
  let quoteY = quoteBoxY + (hasIllustration ? 66 : 88);
  const quoteStep = hasIllustration ? 31 : 40;
  for (const line of quoteLines.slice(0, 3)) {
    ctx.fillText(line, 112, quoteY, width - 224);
    quoteY += quoteStep;
  }

  // 8. Earned Victory Badges Row (preserved even after Endless defeat!)
  const badgeRowY = hasIllustration ? 1204 : 1132;
  const badgeH = hasIllustration ? 48 : 62;
  if (summary.earnedVictories.length > 0) {
    let badgeX = 84;
    for (const badge of summary.earnedVictories) {
      const label = getVictoryBadgeLabel(badge, locale).shortSeal;
      const badgeW = 360;
      ctx.fillStyle = "#E8F5F1";
      ctx.fillRect(badgeX, badgeRowY, badgeW, badgeH);
      ctx.strokeStyle = "#1F5C53";
      ctx.lineWidth = 3;
      ctx.strokeRect(badgeX, badgeRowY, badgeW, badgeH);

      ctx.fillStyle = "#1F5C53";
      ctx.font = hasIllustration
        ? "700 20px 'Courier New', monospace"
        : "700 22px 'Courier New', monospace";
      ctx.fillText(`★ ${label}`, badgeX + 20, badgeRowY + (hasIllustration ? 31 : 39), badgeW - 40);
      badgeX += badgeW + 24;
    }
  } else {
    ctx.fillStyle = "#4A524E";
    ctx.font = hasIllustration
      ? "700 19px 'Courier New', monospace"
      : "700 20px 'Courier New', monospace";
    ctx.fillText(
      isEn
        ? "NO VICTORY SEALS RECORDED IN THIS DOSSIER"
        : "SIN SELLOS DE VICTORIA REGISTRADOS EN ESTE EXPEDIENTE",
      84,
      badgeRowY + (hasIllustration ? 31 : 38),
      innerTextMaxWidth,
    );
  }

  // 9. Tilted Official Rubber Stamp Seal (x ≈ 677..999, strictly above vignette / casillas)
  const stampCenterY = hasIllustration ? 336 : 362;
  const stampHalfH = hasIllustration ? 48 : 52;
  ctx.save();
  ctx.translate(width - 242, stampCenterY);
  ctx.rotate(-0.16);
  ctx.fillStyle = stampFill;
  ctx.fillRect(-155, -stampHalfH, 310, stampHalfH * 2);
  ctx.strokeStyle = stampPrimary;
  ctx.lineWidth = 6;
  ctx.strokeRect(-155, -stampHalfH, 310, stampHalfH * 2);
  ctx.lineWidth = 2;
  ctx.strokeRect(-144, -(stampHalfH - 11), 288, (stampHalfH - 11) * 2);

  ctx.fillStyle = stampPrimary;
  ctx.textAlign = "center";
  ctx.font = "700 17px 'Courier New', monospace";
  ctx.fillText(isEn ? "OFFICIAL RETA SEAL" : "SELLO OFICIAL RETA", 0, -11, 268);
  ctx.font = hasIllustration
    ? "900 31px 'Courier New', monospace"
    : "900 32px 'Courier New', monospace";
  ctx.fillText(meta.stampText, 0, hasIllustration ? 24 : 26, 268);
  ctx.restore();

  // 10. Footer Bar
  const footerY = hasIllustration ? 1282 : 1258;
  ctx.fillStyle = "#1F2421";
  ctx.font = hasIllustration ? "700 20px Georgia, serif" : "700 21px Georgia, serif";
  ctx.fillText(
    isEn
      ? '"Be your own boss. Find out why it was a terrible idea."'
      : "«Sé tu propio jefe. Descubre por qué era mala idea.»",
    84,
    footerY,
    530,
  );

  ctx.textAlign = "right";
  ctx.fillStyle = "#4A524E";
  ctx.font = hasIllustration
    ? "700 18px 'Courier New', monospace"
    : "700 19px 'Courier New', monospace";
  ctx.fillText(summary.gameUrl, width - 84, footerY, 358);
  ctx.textAlign = "left";

  return true;
}

/**
 * Preloads a share-card ending illustration without rejecting on network/decode failures.
 */
export function preloadShareIllustration(
  illustrationUrl: string,
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const trimmed = illustrationUrl.trim();
    if (!trimmed || typeof Image === "undefined") {
      resolve(null);
      return;
    }

    const img = new Image();
    img.decoding = "async";

    if (/^https?:\/\//i.test(trimmed) && typeof window !== "undefined" && window.location?.origin) {
      try {
        const parsed = new URL(trimmed, window.location.href);
        if (parsed.origin !== window.location.origin) {
          img.crossOrigin = "anonymous";
        }
      } catch {
        // Keep default same-origin behavior
      }
    }

    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = trimmed;
  });
}

/**
 * Renders the synchronous Modelo 036-FIN certificate immediately, then preloads `illustrationUrl`
 * (when provided) and re-renders the canvas with the framed 16:9 ending comic panel.
 */
export async function loadAndRenderShareCard(
  canvas: HTMLCanvasElement,
  summary: EndRunShareSummary,
  illustrationUrl?: string | null,
  locale: SupportedLocale = "es-ES",
): Promise<boolean> {
  const baseRendered = renderShareCardToCanvas(canvas, summary, { locale });
  if (!illustrationUrl || !illustrationUrl.trim()) {
    return baseRendered;
  }

  const loadedImage = await preloadShareIllustration(illustrationUrl);
  if (!loadedImage) {
    return baseRendered;
  }

  return renderShareCardToCanvas(canvas, summary, { illustrationImage: loadedImage, locale });
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== "function") {
      resolve(null);
      return;
    }
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      resolve(null);
    }
  });
}

export async function copyShareText(
  summary: EndRunShareSummary,
  locale: SupportedLocale = "es-ES",
): Promise<boolean> {
  const text = buildShareText(summary, locale);
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy textarea copy
    }
  }

  if (typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }

  return false;
}

export async function downloadShareCardPng(
  canvas: HTMLCanvasElement,
  filename = "modelo-036-certificado-autonomo.png",
): Promise<boolean> {
  if (typeof document === "undefined") {
    return false;
  }

  const blob = await canvasToPngBlob(canvas);
  if (blob && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    return true;
  }

  try {
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch {
    return false;
  }
}

export async function shareRunResult(
  summary: EndRunShareSummary,
  canvas?: HTMLCanvasElement | null,
  locale: SupportedLocale = "es-ES",
): Promise<{ method: "web-share-files" | "web-share-text" | "clipboard" | "failed"; ok: boolean }> {
  const isEn = normalizeLocale(locale) === "en";
  const text = buildShareText(summary, locale);
  const title = isEn
    ? "Autónomo Simulator · Form 036-END Certificate"
    : "Autónomo Simulator · Certificado Modelo 036-FIN";

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    if (canvas && typeof navigator.canShare === "function" && typeof File === "function") {
      const blob = await canvasToPngBlob(canvas);
      if (blob) {
        const file = new File([blob], `certificado-autonomo-${summary.monthsSurvived}m.png`, {
          type: "image/png",
        });
        try {
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ title, text, files: [file] });
            return { method: "web-share-files", ok: true };
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return { method: "web-share-files", ok: false };
          }
        }
      }
    }

    try {
      await navigator.share({ title, text });
      return { method: "web-share-text", ok: true };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { method: "web-share-text", ok: false };
      }
    }
  }

  const copied = await copyShareText(summary, locale);
  return copied ? { method: "clipboard", ok: true } : { method: "failed", ok: false };
}
