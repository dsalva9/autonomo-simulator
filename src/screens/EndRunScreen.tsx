import { Award, Copy, Download, Home, RotateCcw, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState } from "../engine/index.ts";
import { compiledCatalog, resolveEndingIllustrationAsset } from "../services/content/catalog.ts";
import { formatDurationMonthsEs, formatEuros } from "../services/i18n/resolveEventText.ts";
import {
  ENDING_METADATA,
  VICTORY_BADGE_LABELS,
  copyShareText,
  createShareSummaryFromState,
  downloadShareCardPng,
  loadAndRenderShareCard,
  shareRunResult,
} from "../services/share/shareResult.ts";
import { useGameStore } from "../store/gameStore.ts";

export interface EndRunScreenProps {
  state: GameState;
}

export function EndRunScreen({ state }: EndRunScreenProps) {
  const startRun = useGameStore((s) => s.startRun);
  const returnToTitle = useGameStore((s) => s.returnToTitle);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const shareSummary = useMemo(() => createShareSummaryFromState(state), [state]);
  const endingMeta = ENDING_METADATA[shareSummary.endingId];
  const endingIllustration = useMemo(
    () => resolveEndingIllustrationAsset(compiledCatalog.manifest, shareSummary.endingId),
    [shareSummary.endingId],
  );

  useEffect(() => {
    if (canvasRef.current) {
      void loadAndRenderShareCard(canvasRef.current, shareSummary, endingIllustration?.url);
    }
  }, [shareSummary, endingIllustration?.url]);

  const handleCopyText = async () => {
    const ok = await copyShareText(shareSummary);
    setFeedback(
      ok
        ? "¡Resumen copiado al portapapeles! Listo para pegar en WhatsApp o Telegram."
        : "No se pudo acceder al portapapeles en este navegador.",
    );
  };

  const handleDownloadPng = async () => {
    if (!canvasRef.current) return;
    const filename = `certificado-autonomo-${shareSummary.monthsSurvived}m.png`;
    const ok = await downloadShareCardPng(canvasRef.current, filename);
    setFeedback(
      ok ? `Certificado PNG descargado (${filename}).` : "No se pudo generar la descarga PNG.",
    );
  };

  const handleNativeShare = async () => {
    const res = await shareRunResult(shareSummary, canvasRef.current);
    if (res.ok) {
      setFeedback(
        res.method === "clipboard"
          ? "¡Resumen copiado al portapapeles! (Compartir nativo no disponible en este dispositivo)."
          : "¡Certificado compartido con éxito!",
      );
    }
  };

  const bannerHeaderBg =
    endingMeta.tone === "victory"
      ? "bg-[#1f5c53]"
      : endingMeta.tone === "abandon"
        ? "bg-[#264e7a]"
        : "bg-[#b42b24]";

  return (
    <main
      data-testid="end-run-screen"
      className="min-h-screen px-3.5 sm:px-5 py-5 sm:py-8 max-w-6xl mx-auto"
    >
      <section className="paper-dossier rounded-2xl overflow-hidden">
        <div
          className={`${bannerHeaderBg} text-[#fffdf8] px-4 sm:px-7 py-3.5 border-b-2 border-[#1f2421] flex flex-wrap items-center justify-between gap-2`}
        >
          <span className="stamp-badge text-[11px] sm:text-xs text-[#fce592]">
            {endingMeta.code}
          </span>
          <span className="stamp-badge text-[11px] sm:text-xs px-2.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8]">
            {endingMeta.stampText}
          </span>
        </div>

        <div className="p-4 sm:p-6 lg:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-7 items-start">
          {/* Left: Epitaph Narrative, Illustration, Stats & Actions */}
          <div className="lg:col-span-7 space-y-4">
            <div className="space-y-1.5">
              <h1
                data-testid="end-run-title"
                className="font-editorial text-2xl sm:text-4xl font-bold text-[#1f2421] leading-tight"
              >
                {endingMeta.title}
              </h1>
              <p className="text-sm sm:text-base text-[#373f3a] leading-relaxed">
                {endingMeta.subtitle}
              </p>
            </div>

            {endingIllustration && (
              <img
                data-testid="end-run-illustration"
                data-asset-id={endingIllustration.id}
                src={endingIllustration.url}
                alt={endingMeta.title}
                width={endingIllustration.width}
                height={endingIllustration.height}
                decoding="async"
                className={`w-full aspect-video object-cover rounded-xl border-2 border-[#1f2421] bg-[#f6efe0] shadow-[3px_3px_0px_0px_rgba(31,36,33,0.88)] ${
                  endingIllustration.render_mode === "pixel_art"
                    ? "render-pixel-art"
                    : "render-vector-hd"
                }`}
              />
            )}

            <blockquote
              data-testid="end-run-quote"
              className="rounded-xl border border-[#1f2421]/35 bg-[#f6efe0] px-4 py-3.5 font-editorial italic text-base sm:text-lg text-[#1f2421] leading-relaxed"
            >
              «{shareSummary.summaryQuote}»
            </blockquote>

            {/* Aligned 2x2 Tabular Stats Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs sm:text-sm">
              <div className="rounded-lg border border-[#1f2421]/25 bg-[#fffdf8] p-3">
                <span className="text-[#4a524e] block text-[11px] sm:text-xs">
                  Tiempo sobrevivido
                </span>
                <strong
                  data-testid="end-run-duration"
                  className="font-bureau text-sm sm:text-base text-[#1f2421] tabular-nums"
                >
                  {formatDurationMonthsEs(shareSummary.monthsSurvived)}
                </strong>
              </div>
              <div className="rounded-lg border border-[#1f2421]/25 bg-[#fffdf8] p-3">
                <span className="text-[#4a524e] block text-[11px] sm:text-xs">Liquidez final</span>
                <strong
                  data-testid="end-run-money"
                  className={`font-bureau text-sm sm:text-base tabular-nums whitespace-nowrap ${
                    shareSummary.finalMoney < 0 ? "text-[#b42b24]" : "text-[#1f5c53]"
                  }`}
                >
                  {formatEuros(shareSummary.finalMoney)}
                </strong>
              </div>
              <div className="rounded-lg border border-[#1f2421]/25 bg-[#fffdf8] p-3">
                <span className="text-[#4a524e] block text-[11px] sm:text-xs">
                  Facturación oficial
                </span>
                <strong
                  data-testid="end-run-billed"
                  className="font-bureau text-sm sm:text-base text-[#264e7a] tabular-nums whitespace-nowrap"
                >
                  {formatEuros(shareSummary.lifetimeBilled)}
                </strong>
              </div>
              <div className="rounded-lg border border-[#1f2421]/25 bg-[#fffdf8] p-3 min-w-0">
                <span className="text-[#4a524e] block text-[11px] sm:text-xs">
                  Semilla del expediente
                </span>
                <strong
                  title={shareSummary.seed}
                  className="font-bureau text-xs sm:text-sm text-[#1f2421] block truncate"
                >
                  {shareSummary.seed}
                </strong>
              </div>
            </div>

            {/* Earned Victory Badges (preserved even after Endless defeat) */}
            {shareSummary.earnedVictories.length > 0 && (
              <div
                data-testid="end-run-victory-badges"
                className="rounded-xl border border-[#1f5c53] bg-[#e8f5f1] p-3.5 space-y-2"
              >
                <div className="flex items-center gap-1.5 stamp-badge text-[11px] text-[#1f5c53]">
                  <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
                  Sellos de victoria conquistados en esta carrera
                </div>
                <div className="flex flex-wrap gap-2">
                  {shareSummary.earnedVictories.map((badge) => (
                    <span
                      key={badge}
                      className="font-bureau text-xs font-bold px-2.5 py-1 rounded-md bg-[#1f5c53] text-[#fffdf8]"
                    >
                      ★ {VICTORY_BADGE_LABELS[badge].title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Share & Replay Buttons */}
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  data-testid="share-native-btn"
                  onClick={() => void handleNativeShare()}
                  className="min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] font-bold text-xs sm:text-sm px-3 py-2.5 flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Compartir</span>
                </button>

                <button
                  type="button"
                  data-testid="copy-summary-btn"
                  onClick={() => void handleCopyText()}
                  className="min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] text-[#1f2421] font-bold text-xs sm:text-sm px-3 py-2.5 flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Copiar resumen</span>
                </button>

                <button
                  type="button"
                  data-testid="download-card-btn"
                  onClick={() => void handleDownloadPng()}
                  className="min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] text-[#1f2421] font-bold text-xs sm:text-sm px-3 py-2.5 flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Descargar PNG</span>
                </button>
              </div>

              {feedback && (
                <p
                  data-testid="share-feedback"
                  aria-live="polite"
                  className="rounded-lg border border-[#1f5c53] bg-[#e8f5f1] px-3.5 py-2 text-xs font-semibold text-[#1f5c53]"
                >
                  {feedback}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#1f2421]/14">
                <button
                  type="button"
                  data-testid="end-new-run-btn"
                  onClick={() => void startRun()}
                  className="min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#b42b24] hover:bg-[#96221c] text-[#fffdf8] font-bold text-sm px-4 py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Nueva alta en el RETA</span>
                </button>

                <button
                  type="button"
                  data-testid="end-return-title-btn"
                  onClick={returnToTitle}
                  className="min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#efe4ce] hover:bg-[#e5d6ba] text-[#1f2421] font-bold text-sm px-4 py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Home className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Inicio y Salón de Caídos</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Live 1080x1350 Illustrated Canvas Certificate Preview */}
          <aside className="lg:col-span-5 paper-dossier-warm rounded-xl overflow-hidden">
            <div className="dossier-header">
              <span className="stamp-badge text-[11px] text-[#1f2421]">CERTIFICADO OFICIAL</span>
              <span className="font-bureau text-[11px] font-bold text-[#4a524e]">
                1080×1350 PNG
              </span>
            </div>
            <div className="p-3 sm:p-4 flex flex-col items-center bg-[#efe4ce]/45">
              <canvas
                ref={canvasRef}
                data-testid="share-canvas"
                width={1080}
                height={1350}
                aria-label="Certificado de supervivencia autónoma Modelo 036-FIN"
                className="w-full max-w-sm aspect-[4/5] rounded-lg border-2 border-[#1f2421] shadow-sm bg-[#f6efe0]"
              />
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
