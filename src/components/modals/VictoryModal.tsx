import { Award, Infinity as InfinityIcon, Trophy } from "lucide-react";
import { useRef } from "react";
import type { GameState, VictoryDecision } from "../../engine/index.ts";
import { formatDurationMonthsEs, formatEuros } from "../../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../../services/i18n/uiStrings.ts";
import { useGameStore } from "../../store/gameStore.ts";
import { useModalKeyboard } from "./useModalKeyboard.ts";

export interface VictoryModalProps {
  state: GameState;
  locale?: string;
  onDecide: (decision: VictoryDecision) => void;
}

export function VictoryModal({ state, locale: localeProp, onDecide }: VictoryModalProps) {
  const storeLocale = useGameStore((s) => s.profile.settings.locale);
  const locale = localeProp ?? storeLocale;
  const v = getUiStrings(locale).modals.victory;

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const isRich = state.pending_victory_badge === "rich_150k";

  const headline = isRich ? v.richHeadline : v.heroHeadline;
  const subheadline = isRich ? v.richSubheadline : v.heroSubheadline;

  useModalKeyboard(dialogRef, {
    onDefaultEnter: () => onDecide("continue"),
    shortcuts: {
      "1": () => onDecide("continue"),
      "2": () => onDecide("retire"),
    },
  });

  return (
    <dialog
      ref={dialogRef}
      open
      aria-modal="true"
      aria-labelledby="victory-modal-title"
      data-testid="victory-modal"
      className="fixed inset-0 z-50 m-0 h-dvh w-full max-h-none max-w-none border-0 bg-[#1f2421]/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
    >
      <div className="paper-dossier animate-dossier w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col rounded-xl overflow-hidden">
        <div className="bg-[#1f5c53] text-[#fffdf8] px-4 sm:px-5 py-2.5 sm:py-3 border-b-2 border-[#1f2421] flex items-center gap-3 shrink-0">
          <Trophy className="w-5 h-5 sm:w-7 sm:h-7 text-[#fce592] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="stamp-badge text-[10px] sm:text-xs text-[#fce592] truncate">
              {v.diplomaBadge}
            </p>
            <h2 id="victory-modal-title" className="font-editorial text-lg sm:text-2xl font-bold">
              {headline}
            </h2>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-3.5 sm:p-4 space-y-3 text-sm overflow-y-auto dossier-scroll">
          <p className="text-xs sm:text-base text-[#1f2421] leading-relaxed">{subheadline}</p>

          <div className="rounded-lg border border-[#1f5c53] bg-[#e8f5f1] p-3 space-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-bureau font-bold text-[#1f5c53]">
              <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
              {v.sealedBadgeHeading}
            </div>
            <p className="text-[#373f3a]">
              {v.timeContributedLabel}{" "}
              <strong>{formatDurationMonthsEs(state.month, locale)}</strong> · {v.liquidityLabel}{" "}
              <strong className="font-bureau tabular-nums whitespace-nowrap">
                {formatEuros(state.indicators.money, locale)}
              </strong>
              . {v.endlessGuaranteeNote}
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-[#1f2421]/18 bg-[#fffdf8] px-3.5 sm:px-4 py-2 sm:py-2.5 space-y-2">
          <button
            type="button"
            data-testid="victory-continue-btn"
            data-autofocus="true"
            data-modal-option="true"
            onClick={() => onDecide("continue")}
            className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] px-4 py-2.5 font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <span className="font-bureau text-xs px-1.5 py-0.5 rounded bg-[#fffdf8]/20 shrink-0 tabular-nums">
                1
              </span>
              <InfinityIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span className="text-xs sm:text-sm">{v.continueEndlessBtn}</span>
            </span>
            <span className="hidden sm:inline-block font-bureau text-xs px-1.5 py-0.5 rounded bg-[#fffdf8]/20 shrink-0">
              {v.enterKeyLabel}
            </span>
          </button>

          <button
            type="button"
            data-testid="victory-retire-btn"
            data-modal-option="true"
            onClick={() => onDecide("retire")}
            className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] text-[#1f2421] px-4 py-2.5 font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors"
          >
            <span className="inline-flex items-center gap-2 text-left">
              <span className="font-bureau text-xs px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8] shrink-0 tabular-nums">
                2
              </span>
              <span className="text-xs sm:text-sm">{v.retireBtn}</span>
            </span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
