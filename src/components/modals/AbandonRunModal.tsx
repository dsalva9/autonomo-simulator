import { LogOut, X } from "lucide-react";
import { useRef } from "react";
import type { AbandonEndingId } from "../../engine/index.ts";
import { getUiStrings } from "../../services/i18n/uiStrings.ts";
import { useGameStore } from "../../store/gameStore.ts";
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
  const locale = localeProp ?? storeLocale;
  const ab = getUiStrings(locale).modals.abandon;

  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useModalKeyboard(dialogRef, {
    onEscape: onCancel,
    shortcuts: {
      "1": () => onConfirmAbandon("abandon_oposiciones"),
      "2": () => onConfirmAbandon("abandon_salaried"),
      "3": () => onConfirmAbandon("abandon_subsidies"),
    },
  });

  return (
    <dialog
      ref={dialogRef}
      open
      aria-modal="true"
      aria-labelledby="abandon-modal-title"
      data-testid="abandon-modal"
      className="fixed inset-0 z-50 m-0 h-dvh w-full max-h-none max-w-none border-0 bg-[#1f2421]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="paper-dossier animate-dossier w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col rounded-xl overflow-hidden">
        <div className="bg-[#1f2421] text-[#fffdf8] px-4 sm:px-5 py-3.5 border-b-2 border-[#1f2421] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <LogOut className="w-5 h-5 shrink-0 text-[#fce592]" aria-hidden="true" />
            <h2 id="abandon-modal-title" className="font-editorial text-base sm:text-lg font-bold">
              {ab.heading}
            </h2>
          </div>
          <button
            type="button"
            data-testid="abandon-cancel-btn"
            onClick={onCancel}
            aria-label={ab.closeAria}
            title={ab.closeTitle}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-[#fffdf8]/15 shrink-0 cursor-pointer"
          >
            <span className="hidden sm:inline font-bureau text-[10px] font-bold text-[#fce592]">
              Esc
            </span>
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-2.5 text-sm overflow-y-auto dossier-scroll">
          <p className="text-[#373f3a]">{ab.prompt}</p>

          <button
            type="button"
            data-testid="abandon-oposiciones-btn"
            data-autofocus="true"
            data-modal-option="true"
            onClick={() => onConfirmAbandon("abandon_oposiciones")}
            className="w-full min-h-12 text-left rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] px-3.5 py-2.5 font-semibold cursor-pointer transition-colors"
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
            className="w-full min-h-12 text-left rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] px-3.5 py-2.5 font-semibold cursor-pointer transition-colors"
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
            className="w-full min-h-12 text-left rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] px-3.5 py-2.5 font-semibold cursor-pointer transition-colors"
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
