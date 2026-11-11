import type { EndingId, GameState, VictoryBadge } from "../../engine/index.ts";
import { formatDurationMonthsEs, formatEuros } from "../i18n/resolveEventText.ts";

export interface EndingMetadata {
  code: string;
  title: string;
  subtitle: string;
  stampText: string;
  tone: "defeat" | "abandon" | "victory";
}

export const ENDING_METADATA: Record<EndingId, EndingMetadata> = {
  defeat_bankruptcy: {
    code: "MOD. 036-BAJA · INSOLVENCIA",
    title: "Bancarrota en Números Rojos",
    subtitle: "Embargo de cuentas tras encadenar descubiertos sin liquidez para las cuotas.",
    stampText: "INSOLVENTE",
    tone: "defeat",
  },
  defeat_burnout_stress: {
    code: "MOD. IT-100 · BAJA POR ANSIEDAD",
    title: "Baja por Ansiedad Aguda",
    subtitle:
      "El médico de cabecera te ha confiscado el portátil, el móvil y el certificado digital.",
    stampText: "COLAPSO",
    tone: "defeat",
  },
  defeat_resignation_moral: {
    code: "MOD. 037 · AGOTAMIENTO MORAL",
    title: "Moral a Cero: Cierre de Persiana",
    subtitle:
      "Has cerrado la hoja de cálculo, borrado el correo y comprado subrayadores para opositar.",
    stampText: "DIMISIÓN",
    tone: "defeat",
  },
  abandon_oposiciones: {
    code: "MOD. BOE-A1 · TRANSICIÓN PÚBLICA",
    title: "Exilio Voluntario al Temario",
    subtitle: "Cambias los encargos urgentes de viernes noche por el Boletín Oficial del Estado.",
    stampText: "OPOSITOR",
    tone: "abandon",
  },
  abandon_salaried: {
    code: "MOD. CTA-AJENA · VUELTA A OFICINA",
    title: "Regreso a la Nómina Fija",
    subtitle:
      "Vuelves a aguantar reuniones ajenas, pero los domingos vuelves a dormir de un tirón.",
    stampText: "ASALARIADO",
    tone: "abandon",
  },
  abandon_subsidies: {
    code: "MOD. CESE-ACT · FIN DE ETAPA",
    title: "Cese de Actividad Tramitado",
    subtitle:
      "Cierras el expediente tras descubrir en propia piel la letra pequeña de emprender sin red.",
    stampText: "BAJA RETA",
    tone: "abandon",
  },
  retired_hero: {
    code: "MOD. HONOR-120 · SUPERVIVIENTE DECENAL",
    title: "¡Eres un Héroe del RETA!",
    subtitle: "Diez años completos sobreviviendo a clientes, cuotas, trimestres e imprevistos.",
    stampText: "HÉROE 10 AÑOS",
    tone: "victory",
  },
  retired_rich: {
    code: "MOD. PATRIMONIO-150K · RETIRO DORADO",
    title: "¡Ricachón! Retiro con 150.000 €",
    subtitle: "Liquidez suficiente en el banco para delegar hasta la lectura de notificaciones.",
    stampText: "RICACHÓN",
    tone: "victory",
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

export interface EndRunShareSummary {
  monthsSurvived: number;
  finalMoney: number;
  lifetimeBilled: number;
  endingId: EndingId;
  summaryQuote: string;
  earnedVictories: VictoryBadge[];
  seed: string;
  endlessMode: boolean;
  gameUrl: string;
}

export function resolveShareUrl(explicitUrl?: string): string {
  if (explicitUrl && explicitUrl.trim().length > 0) {
    return explicitUrl.trim();
  }
  if (typeof window !== "undefined" && window.location?.href) {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return "https://autonomo-simulator.local";
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
    earnedVictories: [...state.earned_victories],
    seed: state.prng.seed,
    endlessMode: state.endless_mode,
    gameUrl: resolveShareUrl(explicitUrl),
  };
}

export function buildShareText(summary: EndRunShareSummary): string {
  const meta = ENDING_METADATA[summary.endingId];
  const duration = formatDurationMonthsEs(summary.monthsSurvived);
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

/**
 * Renders a 1080×1350 portrait bureaucratic certificate onto the provided `<canvas>`.
 * Safe in headless/unit environments where 2D context may be unavailable.
 */
export function renderShareCardToCanvas(
  canvas: HTMLCanvasElement,
  summary: EndRunShareSummary,
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

  const meta = ENDING_METADATA[summary.endingId];
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

  // 3. Official Ministry-Parody Top Header Banner
  ctx.fillStyle = "#1F2421";
  ctx.fillRect(50, 50, width - 100, 128);

  ctx.fillStyle = "#FCE592";
  ctx.font = "700 22px 'Courier New', monospace";
  ctx.fillText("MODELO 036-FIN · CERTIFICADO DE SUPERVIVENCIA AUTÓNOMA", 84, 98, innerTextMaxWidth);

  ctx.fillStyle = "#FFFDF8";
  ctx.font = "700 30px Georgia, serif";
  ctx.fillText("AUTÓNOMO SIMULATOR · REGISTRO DE EXPEDIENTES", 84, 146, innerTextMaxWidth);

  // 4. Form Subheader Strip
  ctx.fillStyle = "#EFE4CE";
  ctx.fillRect(50, 178, width - 100, 68);
  ctx.strokeStyle = "#1F2421";
  ctx.lineWidth = 2;
  ctx.strokeRect(50, 178, width - 100, 68);

  ctx.fillStyle = "#1F2421";
  ctx.font = "700 21px 'Courier New', monospace";
  ctx.fillText(meta.code, 84, 220, 500);

  const seedDisplay = summary.seed.length > 26 ? `${summary.seed.slice(0, 25)}…` : summary.seed;
  ctx.textAlign = "right";
  ctx.fillStyle = "#4A524E";
  ctx.fillText(`SEMILLA: ${seedDisplay}`, width - 84, 220, 388);
  ctx.textAlign = "left";

  // 5. Outcome Title Block (constrained to left column clear of tilted rubber stamp)
  ctx.fillStyle = stampPrimary;
  ctx.font = "700 21px 'Courier New', monospace";
  ctx.fillText(
    summary.endlessMode ? "RESOLUCIÓN FINAL (MODO INFINITO)" : "RESOLUCIÓN DEL EXPEDIENTE",
    84,
    288,
    outcomeColumnMaxWidth,
  );

  ctx.fillStyle = "#1F2421";
  ctx.font = "700 44px Georgia, serif";
  const titleLines = wrapCanvasParagraph(ctx, meta.title, outcomeColumnMaxWidth);
  let cursorY = 340;
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, 84, cursorY, outcomeColumnMaxWidth);
    cursorY += 48;
  }

  ctx.fillStyle = "#4A524E";
  ctx.font = "400 24px 'Trebuchet MS', sans-serif";
  const subLines = wrapCanvasParagraph(ctx, meta.subtitle, outcomeColumnMaxWidth);
  let subY = cursorY - 6;
  for (const line of subLines.slice(0, 3)) {
    ctx.fillText(line, 84, subY, outcomeColumnMaxWidth);
    subY += 32;
  }

  // 6. 2x2 Official Ledger Boxes
  const gridTop = 530;
  const boxW = (width - 192) / 2;
  const boxH = 156;
  const boxes = [
    {
      code: "CASILLA [01] · TIEMPO COTIZADO",
      value: formatDurationMonthsEs(summary.monthsSurvived),
      accent: "#1F2421",
    },
    {
      code: "CASILLA [02] · LIQUIDEZ DISPONIBLE",
      value: formatEuros(summary.finalMoney),
      accent: summary.finalMoney < 0 ? "#B42B24" : "#1F5C53",
    },
    {
      code: "CASILLA [03] · FACTURACIÓN OFICIAL",
      value: formatEuros(summary.lifetimeBilled),
      accent: "#264E7A",
    },
    {
      code: "CASILLA [04] · MODALIDAD",
      value: summary.endlessMode ? "Modo Infinito (+120m)" : "Campaña RETA (10 años)",
      accent: "#1F2421",
    },
  ];

  boxes.forEach((box, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 84 + col * (boxW + 24);
    const y = gridTop + row * (boxH + 22);

    ctx.fillStyle = "#FFFDF8";
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = "#1F2421";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, boxW, boxH);

    ctx.fillStyle = "#EFE4CE";
    ctx.fillRect(x + 3, y + 3, boxW - 6, 42);
    ctx.fillStyle = "#4A524E";
    ctx.font = "700 18px 'Courier New', monospace";
    ctx.fillText(box.code, x + 18, y + 30, boxW - 36);

    ctx.fillStyle = box.accent;
    ctx.font = "700 34px 'Courier New', monospace";
    const fittedVal = wrapCanvasParagraph(ctx, box.value, boxW - 36);
    ctx.fillText(fittedVal[0] ?? box.value, x + 18, y + 108, boxW - 36);
    if (fittedVal[1]) {
      ctx.font = "700 24px 'Courier New', monospace";
      ctx.fillText(fittedVal[1], x + 18, y + 138, boxW - 36);
    }
  });

  // 7. Satirical Quote / Epitaph Box
  const quoteBoxY = 898;
  const quoteBoxH = 204;
  ctx.fillStyle = "#FFFDF8";
  ctx.fillRect(84, quoteBoxY, width - 168, quoteBoxH);
  ctx.strokeStyle = "#1F2421";
  ctx.lineWidth = 3;
  ctx.strokeRect(84, quoteBoxY, width - 168, quoteBoxH);

  ctx.fillStyle = "#9A5B13";
  ctx.font = "700 19px 'Courier New', monospace";
  ctx.fillText("OBSERVACIONES E INFORME DE CIERRE:", 112, quoteBoxY + 38, width - 224);

  ctx.fillStyle = "#1F2421";
  ctx.font = "italic 30px Georgia, serif";
  const quoteLines = wrapCanvasParagraph(ctx, `«${summary.summaryQuote}»`, width - 224);
  let quoteY = quoteBoxY + 88;
  for (const line of quoteLines.slice(0, 3)) {
    ctx.fillText(line, 112, quoteY, width - 224);
    quoteY += 40;
  }

  // 8. Earned Victory Badges Row (preserved even after Endless defeat!)
  const badgeRowY = 1132;
  if (summary.earnedVictories.length > 0) {
    let badgeX = 84;
    for (const badge of summary.earnedVictories) {
      const label = VICTORY_BADGE_LABELS[badge].shortSeal;
      const badgeW = 360;
      ctx.fillStyle = "#E8F5F1";
      ctx.fillRect(badgeX, badgeRowY, badgeW, 62);
      ctx.strokeStyle = "#1F5C53";
      ctx.lineWidth = 3;
      ctx.strokeRect(badgeX, badgeRowY, badgeW, 62);

      ctx.fillStyle = "#1F5C53";
      ctx.font = "700 22px 'Courier New', monospace";
      ctx.fillText(`★ ${label}`, badgeX + 20, badgeRowY + 39, badgeW - 40);
      badgeX += badgeW + 24;
    }
  } else {
    ctx.fillStyle = "#4A524E";
    ctx.font = "700 20px 'Courier New', monospace";
    ctx.fillText(
      "SIN SELLOS DE VICTORIA REGISTRADOS EN ESTE EXPEDIENTE",
      84,
      badgeRowY + 38,
      innerTextMaxWidth,
    );
  }

  // 9. Tilted Official Rubber Stamp Seal (x ≈ 677..999, y ≈ 286..438)
  ctx.save();
  ctx.translate(width - 242, 362);
  ctx.rotate(-0.16);
  ctx.fillStyle = stampFill;
  ctx.fillRect(-155, -52, 310, 104);
  ctx.strokeStyle = stampPrimary;
  ctx.lineWidth = 6;
  ctx.strokeRect(-155, -52, 310, 104);
  ctx.lineWidth = 2;
  ctx.strokeRect(-144, -41, 288, 82);

  ctx.fillStyle = stampPrimary;
  ctx.textAlign = "center";
  ctx.font = "700 17px 'Courier New', monospace";
  ctx.fillText("SELLO OFICIAL RETA", 0, -12, 268);
  ctx.font = "900 32px 'Courier New', monospace";
  ctx.fillText(meta.stampText, 0, 26, 268);
  ctx.restore();

  // 10. Footer Bar
  ctx.fillStyle = "#1F2421";
  ctx.font = "700 21px Georgia, serif";
  ctx.fillText("«Sé tu propio jefe. Descubre por qué era mala idea.»", 84, 1258, 530);

  ctx.textAlign = "right";
  ctx.fillStyle = "#4A524E";
  ctx.font = "700 19px 'Courier New', monospace";
  ctx.fillText(summary.gameUrl, width - 84, 1258, 358);
  ctx.textAlign = "left";

  return true;
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

export async function copyShareText(summary: EndRunShareSummary): Promise<boolean> {
  const text = buildShareText(summary);
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
): Promise<{ method: "web-share-files" | "web-share-text" | "clipboard" | "failed"; ok: boolean }> {
  const text = buildShareText(summary);
  const title = "Autónomo Simulator · Certificado Modelo 036-FIN";

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

  const copied = await copyShareText(summary);
  return copied ? { method: "clipboard", ok: true } : { method: "failed", ok: false };
}
