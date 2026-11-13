import { Award, LogOut, Trophy, X } from "lucide-react";
import { useRef } from "react";
import type { AbandonEndingId } from "../../engine/index.ts";
import { formatDurationMonthsEs, formatEuros } from "../../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../../services/i18n/uiStrings.ts";
import { canRetireHonorably, useGameStore } from "../../store/gameStore.ts";
import { useModalKeyboard } from "./useModalKeyboard.ts";

export interface AbandonRunModalProps {
  locale?: string;
  onConfirmAbandon: (endingId: AbandonEndingId) => void;
  onCancel: () => void;
}

export function AbandonRunModal({
  locale: localeProp,
  onConfirmAbandon,
  onCancel,
}: AbandonRunModalProps) {
  const storeLocale = useGameStore((s) => s.profile.settings.locale);
  const activeRun = useGameStore((s) => s.activeRun);
  const retireActiveRun = useGameStore((s) => s.retireActiveRun);

  const locale = localeProp ?? storeLocale;
  const ab = getUiStrings(locale).modals.abandon;
  const honorable = canRetireHonorably(activeRun);

  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const handleHonorableRetire = () => {
    void retireActiveRun();
  };

  useModalKeyboard(
    dialogRef,
    honorable
      ? {
          onEscape: onCancel,
          onDefaultEnter: handleHonorableRetire,
          shortcuts: {
            "1": handleHonorableRetire,
          },
        }
      : {
          onEscape: onCancel,
          shortcuts: {
            "1": () => onConfirmAbandon("abandon_oposiciones"),
            "2": () => onConfirmAbandon("abandon_salaried"),
            "3": () => onConfirmAbandon("abandon_subsidies"),
          },
        },
  );

  if (honorable && activeRun) {
    return (
      <dialog
        ref={dialogRef}
        open
        aria-modal="true"
        aria-labelledby="abandon-modal-title"
        data-testid="abandon-modal"
        className="fixed inset-0 z-50 m-0 h-dvh w-full max-h-none max-w-none border-0 bg-[#1f2421]/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      >
        <div className="paper-dossier animate-dossier w-full max-w-md max-h-[calc(100dvh-1.5rem)] flex flex-col rounded-xl overflow-hidden">
          <div className="bg-[#1f5c53] text-[#fffdf8] px-4 sm:px-5 py-2 sm:py-3 [@media(max-height:500px)]:py-1.5 border-b-2 border-[#1f2421] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <Trophy className="w-5 h-5 shrink-0 text-[#fce592]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="stamp-badge text-[10px] text-[#fce592] leading-tight break-words">
                  {ab.honorableBadge}
                </p>
                <h2
                  id="abandon-modal-title"
                  className="font-editorial text-base sm:text-lg font-bold leading-snug"
                >
                  {ab.honorableHeading}
                </h2>
              </div>
            </div>
            <button
              type="button"
              data-testid="abandon-cancel-btn"
              onClick={onCancel}
              aria-label={ab.closeAria}
              title={ab.closeTitle}
              className="min-h-9 min-w-9 inline-flex items-center justify-center gap-1 rounded px-2 py-1 hover:bg-[#fffdf8]/15 shrink-0 cursor-pointer"
            >
              <span className="hidden sm:inline font-bureau text-[10px] font-bold text-[#fce592]">
                {ab.escKeyLabel}
              </span>
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 min-h-0 p-3.5 sm:p-4 space-y-2.5 text-sm overflow-y-auto dossier-scroll">
            <p className="text-[#1f2421] leading-relaxed">{ab.honorablePrompt}</p>

            <div className="rounded-lg border border-[#1f5c53] bg-[#e8f5f1] p-3 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-bureau font-bold text-[#1f5c53]">
                <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {formatDurationMonthsEs(activeRun.month, locale)} ·{" "}
                  {formatEuros(activeRun.indicators.money, locale)}
                </span>
              </div>
              <p className="text-[#373f3a]">{ab.honorableSummary}</p>
            </div>
          </div>

          <div className="shrink-0 border-t border-[#1f2421]/18 bg-[#fffdf8] px-3.5 sm:px-4 py-2 [@media(max-height:500px)]:py-1.5 grid grid-cols-1 [@media(max-height:500px)]:grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="retire-honorable-confirm-btn"
              data-autofocus="true"
              data-modal-option="true"
              onClick={handleHonorableRetire}
              className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] px-3.5 py-2.5 font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors"
            >
              <span className="inline-flex items-center gap-2 text-left">
                <span className="font-bureau text-xs px-1.5 py-0.5 rounded bg-[#fffdf8]/20 shrink-0 tabular-nums">
                  1
                </span>
                <Award className="w-4 h-4 shrink-0 text-[#fce592]" aria-hidden="true" />
                <span>{ab.retireHonorablyBtn}</span>
              </span>
              <span className="hidden sm:inline-block font-bureau text-xs px-1.5 py-0.5 rounded bg-[#fffdf8]/20 shrink-0">
                {ab.enterKeyLabel}
              </span>
            </button>

            <button
              type="button"
              data-modal-option="true"
              onClick={onCancel}
              className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] text-[#1f2421] px-3.5 py-2.5 font-semibold flex items-center justify-between gap-2 cursor-pointer transition-colors"
            >
              <span className="text-left text-xs sm:text-sm">{ab.honorableCancelBtn}</span>
              <span className="font-bureau text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8] shrink-0">
                {ab.escKeyLabel}
              </span>
            </button>
          </div>
        </div>
      </dialog>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      open
      aria-modal="true"
      aria-labelledby="abandon-modal-title"
      data-testid="abandon-modal"
      className="fixed inset-0 z-50 m-0 h-dvh w-full max-h-none max-w-none border-0 bg-[#1f2421]/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
    >
      <div className="paper-dossier animate-dossier w-full max-w-md max-h-[calc(100dvh-1.5rem)] flex flex-col rounded-xl overflow-hidden">
        <div className="bg-[#1f2421] text-[#fffdf8] px-4 sm:px-5 py-2 sm:py-3 [@media(max-height:500px)]:py-1.5 border-b-2 border-[#1f2421] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <LogOut className="w-5 h-5 shrink-0 text-[#fce592]" aria-hidden="true" />
            <h2
              id="abandon-modal-title"
              className="font-editorial text-base sm:text-lg font-bold leading-snug"
            >
              {ab.heading}
            </h2>
          </div>
          <button
            type="button"
            data-testid="abandon-cancel-btn"
            onClick={onCancel}
            aria-label={ab.closeAria}
            title={ab.closeTitle}
            className="min-h-9 min-w-9 inline-flex items-center justify-center gap-1 rounded px-2 py-1 hover:bg-[#fffdf8]/15 shrink-0 cursor-pointer"
          >
            <span className="hidden sm:inline font-bureau text-[10px] font-bold text-[#fce592]">
              Esc
            </span>
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-3.5 sm:p-4 space-y-2 text-sm overflow-y-auto dossier-scroll">
          <p className="text-xs sm:text-sm text-[#373f3a]">{ab.prompt}</p>

          <button
            type="button"
            data-testid="abandon-oposiciones-btn"
            data-autofocus="true"
            data-modal-option="true"
            onClick={() => onConfirmAbandon("abandon_oposiciones")}
            className="w-full min-h-12 text-left rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] px-3.5 py-2 font-semibold cursor-pointer transition-colors"
          >
            <span className="flex items-center justify-between gap-2">
              <span>{ab.oposicionesTitle}</span>
              <span className="font-bureau text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8] shrink-0 tabular-nums">
                1
              </span>
            </span>
            <span className="block text-xs font-normal text-[#4a524e] mt-0.5">
              {ab.oposicionesDesc}
            </span>
          </button>

          <button
            type="button"
            data-testid="abandon-salaried-btn"
            data-modal-option="true"
            onClick={() => onConfirmAbandon("abandon_salaried")}
            className="w-full min-h-12 text-left rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] px-3.5 py-2 font-semibold cursor-pointer transition-colors"
          >
            <span className="flex items-center justify-between gap-2">
              <span>{ab.salariedTitle}</span>
              <span className="font-bureau text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8] shrink-0 tabular-nums">
                2
              </span>
            </span>
            <span className="block text-xs font-normal text-[#4a524e] mt-0.5">
              {ab.salariedDesc}
            </span>
          </button>

          <button
            type="button"
            data-testid="abandon-cese-btn"
            data-modal-option="true"
            onClick={() => onConfirmAbandon("abandon_subsidies")}
            className="w-full min-h-12 text-left rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] px-3.5 py-2 font-semibold cursor-pointer transition-colors"
          >
            <span className="flex items-center justify-between gap-2">
              <span>{ab.ceseTitle}</span>
              <span className="font-bureau text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8] shrink-0 tabular-nums">
                3
              </span>
            </span>
            <span className="block text-xs font-normal text-[#4a524e] mt-0.5">{ab.ceseDesc}</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
