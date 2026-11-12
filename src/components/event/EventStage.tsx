import { ArrowRight, CheckCircle2, Dices, Lock, Receipt } from "lucide-react";
import { type SyntheticEvent, useEffect, useRef } from "react";
import type {
  ActiveEventView,
  ChoiceOutcomeSummary,
  ChoiceSpec,
  EffectsSpec,
  GameState,
  MonthStartSummary,
  RenderMode,
} from "../../engine/index.ts";
import {
  compiledCatalog,
  resolveCategoryFallbackAsset,
  resolveCharacterPortraitAsset,
  resolveEventBannerAsset,
} from "../../services/content/catalog.ts";
import {
  explainChoiceLockReasons,
  formatEuros,
  formatSignedEuros,
  formatSignedInt,
  humanizeFlag,
  normalizeLocale,
  resolveChoiceLabel,
  resolveChoiceResultText,
  resolveEventBody,
  resolveEventTitle,
  translateCategoryLabel,
  translateCharacterName,
  translateFamilyStatus,
  translateGestorTier,
  translateModifierLabel,
} from "../../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../../services/i18n/uiStrings.ts";
import { type PendingOutcomeView, useGameStore } from "../../store/gameStore.ts";

export interface EventStageProps {
  state: GameState;
  activeEventView: ActiveEventView | null;
  pendingOutcome: PendingOutcomeView | null;
  lastMonthStart: MonthStartSummary | null;
  locale: string;
  keyboardEnabled: boolean;
  onSelectChoice: (choiceId: string) => void;
  onContinueOutcome: () => void;
}

type ExtendedChoiceOutcomeSummary = ChoiceOutcomeSummary & {
  tax_accrued_delta?: number;
  employee_satisfaction_delta?: number;
};

type ExtendedMonthStartSummary = MonthStartSummary & {
  deductible_expenses?: number;
  tax_shield_on_expenses?: number;
  modifier_moral_delta?: number;
  modifier_stress_delta?: number;
};

interface AutoSettledQuarterInfo {
  quarter: number;
  month: number;
  paidAmount: number;
}

interface StakeChip {
  key: string;
  text: string;
  tone: "positive" | "negative" | "warning" | "info" | "neutral";
}

interface DeltaPillProps {
  label: string;
  formatted: string;
  favorable: boolean;
}

function renderModeClass(mode: RenderMode): string {
  return mode === "pixel_art" ? "render-pixel-art" : "render-vector-hd";
}

function stakeChipClass(tone: StakeChip["tone"]): string {
  switch (tone) {
    case "positive":
      return "bg-[#e8f5f1] text-[#1f5c53] border-[#1f5c53]/45";
    case "negative":
      return "bg-[#fdf0ef] text-[#9e221b] border-[#9e221b]/45";
    case "warning":
      return "bg-[#fcf4df] text-[#7a4308] border-[#7a4308]/45";
    case "info":
      return "bg-[#ebf2fa] text-[#264e7a] border-[#264e7a]/45";
    case "neutral":
      return "bg-[#efe4ce] text-[#373f3a] border-[#1f2421]/30";
  }
}

function buildDeterministicStakeChips(
  choice: ChoiceSpec,
  resolvedLabel: string,
  locale: string,
): StakeChip[] {
  const effects = choice.effects;
  if (!effects || (choice.outcomes && choice.outcomes.length > 0)) {
    return [];
  }

  const isEn = normalizeLocale(locale) === "en";
  const { balance, characters } = compiledCatalog;
  const labelMentionsEuro = resolvedLabel.includes("€");
  const chips: StakeChip[] = [];

  // 1. Immediate deterministic cash delta if not already stated in the choice label
  const billed = effects.billed_income ?? 0;
  const cashDelta = effects.cash_delta ?? 0;
  const deductible = effects.deductible_expense ?? 0;
  const netImmediate = Math.round(billed + cashDelta - deductible);

  if (!labelMentionsEuro && netImmediate !== 0) {
    const suffix =
      billed > 0
        ? isEn
          ? " · +VAT"
          : " · +IVA"
        : deductible > 0 && cashDelta === 0
          ? isEn
            ? " · deduct."
            : " · deduc."
          : "";
    chips.push({
      key: "cash",
      text: `${formatSignedEuros(netImmediate, locale)}${suffix}`,
      tone: netImmediate > 0 ? "positive" : "negative",
    });
  } else if (labelMentionsEuro && deductible > 0 && billed === 0) {
    chips.push({
      key: "deductible",
      text: isEn ? "Deductible" : "Deducible",
      tone: "info",
    });
  }

  // 2. Deferred invoice terms
  if (effects.deferred_invoice) {
    const inv = effects.deferred_invoice;
    chips.push({
      key: "deferred",
      text: isEn
        ? `+${formatEuros(inv.amount, locale)} (in ${inv.delay_months}m)`
        : `+${formatEuros(inv.amount, locale)} (a ${inv.delay_months}m)`,
      tone: "info",
    });
  }

  // 3. Structural recurring commitments (staff, advisor, family, temporal modifier)
  if (effects.hire_employee) {
    const empChar = characters[effects.hire_employee.character_id];
    const empCost = empChar?.employee_params?.monthly_cost;
    const empMult = empChar?.employee_params?.billing_multiplier;
    if (empCost !== undefined) {
      chips.push({
        key: "hire",
        text: `-${formatEuros(empCost, locale)}/m${empMult ? ` · ×${empMult}` : ""}`,
        tone: "info",
      });
    }
  } else if (effects.dismiss_employee) {
    const sev = effects.dismiss_employee.severance_cost;
    chips.push({
      key: "dismiss",
      text:
        sev > 0 && !labelMentionsEuro
          ? isEn
            ? `-${formatEuros(sev, locale)} · end payroll`
            : `-${formatEuros(sev, locale)} · fin nómina`
          : isEn
            ? "End payroll"
            : "Fin nómina",
      tone: sev > 0 ? "negative" : "neutral",
    });
  } else if (effects.set_gestor) {
    const gestorChar = effects.set_gestor.character_id
      ? characters[effects.set_gestor.character_id]
      : undefined;
    const fee =
      gestorChar?.gestor_params?.monthly_fee ??
      balance.gestor_tiers[effects.set_gestor.tier].monthly_fee;
    chips.push({
      key: "gestor",
      text: `${translateGestorTier(effects.set_gestor.tier, locale)} (${formatEuros(fee, locale)}/m)`,
      tone: "info",
    });
  } else if (effects.add_modifier) {
    const mod = effects.add_modifier;
    const netMonthly = Math.round(
      (mod.monthly_billed_delta ?? 0) - (mod.monthly_expense_delta ?? 0),
    );
    if (netMonthly !== 0) {
      chips.push({
        key: "modifier",
        text: `${formatSignedEuros(netMonthly, locale)}/m ×${mod.remaining_months}m`,
        tone: netMonthly > 0 ? "positive" : "warning",
      });
    }
  } else if (effects.add_child) {
    const addedCost = effects.add_child * balance.child_monthly_cost;
    chips.push({
      key: "child",
      text: `-${formatEuros(addedCost, locale)}/m`,
      tone: "info",
    });
  }

  // 4. High strain / hidden workload warning so players aren't ambushed by >= +10 Stress hits
  const stressHit = effects.stress ?? 0;
  if (stressHit >= 10) {
    chips.push({
      key: "strain",
      text: isEn ? `⚡ High strain (+${stressHit})` : `⚡ Carga alta (+${stressHit})`,
      tone: stressHit >= 14 ? "negative" : "warning",
    });
  } else if ((effects.fiscal_risk ?? 0) >= 10) {
    chips.push({
      key: "tax-risk",
      text: isEn ? "🏛️ Tax risk" : "🏛️ Riesgo fiscal",
      tone: "warning",
    });
  }

  return chips.slice(0, 3);
}

function DeltaPill({ label, formatted, favorable }: DeltaPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-bureau text-xs font-bold tabular-nums whitespace-nowrap ${
        favorable
          ? "bg-[#e8f5f1] text-[#1f5c53] border-[#1f5c53]/50"
          : "bg-[#fdf0ef] text-[#9e221b] border-[#9e221b]/50"
      }`}
    >
      <span>{label}:</span>
      <span>{formatted}</span>
    </span>
  );
}

export function EventStage({
  state,
  activeEventView,
  pendingOutcome,
  lastMonthStart,
  locale,
  keyboardEnabled,
  onSelectChoice,
  onContinueOutcome,
}: EventStageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const eventTitleRef = useRef<HTMLHeadingElement | null>(null);
  const ui = getUiStrings(locale);
  const isEn = normalizeLocale(locale) === "en";

  const lastAutoSettledQuarter = useGameStore(
    (s) =>
      (s as unknown as { lastAutoSettledQuarter?: AutoSettledQuarterInfo | null })
        .lastAutoSettledQuarter ?? null,
  );

  // Track turn transitions so keyboard focus never drops to document.body after clicking or pressing Enter,
  // while keeping initial mount focus off choice-btn-0 so first ArrowDown focuses choice-btn-0 cleanly.
  const turnFocusKey = pendingOutcome
    ? `outcome:${state.run_id}:${state.month}:${pendingOutcome.event.id}:${pendingOutcome.choiceId}:${pendingOutcome.outcome.outcome_id ?? "det"}`
    : activeEventView
      ? `event:${state.run_id}:${state.month}:${activeEventView.event.id}`
      : `idle:${state.run_id}:${state.month}`;
  const prevTurnFocusKeyRef = useRef<string | null>(null);
  const prevKeyboardEnabledRef = useRef<boolean>(keyboardEnabled);

  useEffect(() => {
    const wasInitialMount = prevTurnFocusKeyRef.current === null;
    const turnChanged = prevTurnFocusKeyRef.current !== turnFocusKey;
    const modalJustClosed = !prevKeyboardEnabledRef.current && keyboardEnabled;

    prevTurnFocusKeyRef.current = turnFocusKey;
    prevKeyboardEnabledRef.current = keyboardEnabled;

    if (!keyboardEnabled) {
      return;
    }

    if (wasInitialMount) {
      if (pendingOutcome) {
        stageRef.current
          ?.querySelector<HTMLButtonElement>('[data-testid="outcome-continue-btn"]')
          ?.focus({ preventScroll: true });
      } else if (document.activeElement === document.body) {
        eventTitleRef.current?.focus({ preventScroll: true });
      }
      return;
    }

    if (!turnChanged && !modalJustClosed) {
      return;
    }

    if (pendingOutcome) {
      stageRef.current
        ?.querySelector<HTMLButtonElement>('[data-testid="outcome-continue-btn"]')
        ?.focus({ preventScroll: true });
      return;
    }

    if (activeEventView) {
      const firstEnabledChoice = stageRef.current?.querySelector<HTMLButtonElement>(
        '[data-testid^="choice-btn-"]:not(:disabled)',
      );
      firstEnabledChoice?.focus({ preventScroll: true });
    }
  }, [turnFocusKey, keyboardEnabled, pendingOutcome, activeEventView]);

  useEffect(() => {
    if (!keyboardEnabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (pendingOutcome) {
        if (
          event.key === "ArrowDown" ||
          event.key === "ArrowUp" ||
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight"
        ) {
          if (target?.closest('[data-keyboard-scroll="true"]')) {
            return;
          }
          event.preventDefault();
          stageRef.current
            ?.querySelector<HTMLButtonElement>('[data-testid="outcome-continue-btn"]')
            ?.focus({ preventScroll: window.innerWidth >= 1280 });
          return;
        }
        if (event.key === "1") {
          event.preventDefault();
          onContinueOutcome();
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          // If focus is already on a button, native click handles Enter/Space; avoid double fire
          if (target?.tagName === "BUTTON") {
            return;
          }
          event.preventDefault();
          onContinueOutcome();
        }
        return;
      }

      if (!activeEventView) {
        return;
      }

      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowLeft"
      ) {
        if (
          target?.closest('[data-keyboard-scroll="true"]') ||
          target?.getAttribute("role") === "tab"
        ) {
          return;
        }
        const enabledButtons = Array.from(
          stageRef.current?.querySelectorAll<HTMLButtonElement>(
            '[data-testid^="choice-btn-"]:not(:disabled)',
          ) ?? [],
        );
        if (enabledButtons.length > 0) {
          event.preventDefault();
          const active = document.activeElement as HTMLButtonElement | null;
          const currentIndex = active ? enabledButtons.indexOf(active) : -1;
          const moveForward = event.key === "ArrowDown" || event.key === "ArrowRight";
          const nextIndex = moveForward
            ? currentIndex < 0
              ? 0
              : (currentIndex + 1) % enabledButtons.length
            : currentIndex <= 0
              ? enabledButtons.length - 1
              : currentIndex - 1;
          enabledButtons[nextIndex]?.focus({ preventScroll: window.innerWidth >= 1280 });
        }
        return;
      }

      if (/^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const entry = activeEventView.choices[index];
        if (entry?.eligible) {
          event.preventDefault();
          onSelectChoice(entry.choice.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keyboardEnabled, pendingOutcome, activeEventView, onSelectChoice, onContinueOutcome]);

  const activeCharacter = activeEventView?.event.character_id
    ? compiledCatalog.characters[activeEventView.event.character_id]
    : undefined;
  const activeCharacterName = activeCharacter
    ? translateCharacterName(activeCharacter, locale)
    : "";
  const activeCharacterExpression = activeEventView?.event.character_expression ?? "neutral";
  const activeCharacterPortrait = activeEventView
    ? resolveCharacterPortraitAsset(
        compiledCatalog.manifest,
        activeCharacter,
        activeCharacterExpression,
      )
    : null;
  const bannerResolution = activeEventView
    ? resolveEventBannerAsset(compiledCatalog.manifest, activeEventView.event, state)
    : null;
  const categoryFallbackAsset = activeEventView
    ? resolveCategoryFallbackAsset(compiledCatalog.manifest, activeEventView.event.category)
    : null;

  const handleCategoryArtError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (!categoryFallbackAsset) {
      return;
    }
    const img = event.currentTarget;
    if (img.src !== categoryFallbackAsset.url && !img.dataset.fallbackApplied) {
      img.dataset.fallbackApplied = "true";
      img.src = categoryFallbackAsset.url;
    }
  };

  const pendingChoiceObj = pendingOutcome
    ? pendingOutcome.event.choices.find((c) => c.id === pendingOutcome.choiceId)
    : undefined;
  const displayedChoiceLabel = pendingOutcome
    ? pendingChoiceObj
      ? resolveChoiceLabel(pendingOutcome.event.id, pendingChoiceObj, locale)
      : pendingOutcome.choiceLabel
    : "";

  const appliedEffects: EffectsSpec | undefined = pendingOutcome
    ? pendingOutcome.outcome.outcome_id
      ? pendingChoiceObj?.outcomes?.find((o) => o.id === pendingOutcome.outcome.outcome_id)?.effects
      : (pendingChoiceObj?.effects ?? undefined)
    : undefined;

  const extOutcome = pendingOutcome?.outcome as ExtendedChoiceOutcomeSummary | undefined;
  const extMonthStart = lastMonthStart as ExtendedMonthStartSummary | null;

  // Compute applied tax accrual / deductible shield & employee satisfaction deltas for outcome-panel
  const computedTaxDelta = pendingOutcome
    ? (extOutcome?.tax_accrued_delta ??
      Math.round(
        (appliedEffects?.billed_income ?? 0) * compiledCatalog.balance.effective_quarterly_tax_rate,
      ) -
        Math.round(
          (appliedEffects?.deductible_expense ?? 0) *
            compiledCatalog.balance.deductible_tax_fraction,
        ))
    : 0;

  const computedEmpSatDelta = pendingOutcome
    ? (extOutcome?.employee_satisfaction_delta ??
      (state.employee || appliedEffects?.hire_employee
        ? (appliedEffects?.employee_satisfaction ?? 0)
        : 0))
    : 0;

  const showAutoQuarterReceipt =
    lastAutoSettledQuarter !== null &&
    (lastAutoSettledQuarter.month === state.month ||
      lastAutoSettledQuarter.month === state.month - 1);

  const monthPassiveStress = extMonthStart?.passive_stress_delta ?? 0;
  const monthModMoral = extMonthStart?.modifier_moral_delta ?? 0;
  const monthModStress = extMonthStart?.modifier_stress_delta ?? 0;
  const monthTaxShield = extMonthStart?.tax_shield_on_expenses ?? 0;
  const totalMonthStressTick = monthPassiveStress + monthModStress;

  const hasSecondaryEconomyTicker =
    Boolean(extMonthStart && extMonthStart.invoices_settled.length > 0) ||
    showAutoQuarterReceipt ||
    monthModMoral !== 0 ||
    totalMonthStressTick !== 0;

  const appliedSetFlags = appliedEffects?.set_flags ?? [];
  const appliedClearFlags = appliedEffects?.clear_flags ?? [];

  const hasAnyOutcomePill = Boolean(
    pendingOutcome &&
      (pendingOutcome.outcome.money_delta !== 0 ||
        pendingOutcome.outcome.moral_delta !== 0 ||
        pendingOutcome.outcome.stress_delta !== 0 ||
        pendingOutcome.outcome.personal_life_delta !== 0 ||
        pendingOutcome.outcome.reputation_delta !== 0 ||
        pendingOutcome.outcome.fiscal_risk_delta !== 0 ||
        computedTaxDelta !== 0 ||
        computedEmpSatDelta !== 0 ||
        appliedEffects?.deferred_invoice ||
        appliedEffects?.add_modifier ||
        appliedEffects?.hire_employee ||
        appliedEffects?.dismiss_employee ||
        appliedEffects?.set_gestor ||
        appliedEffects?.set_family_status ||
        appliedEffects?.add_child ||
        appliedSetFlags.length > 0 ||
        appliedClearFlags.length > 0 ||
        pendingOutcome.outcome.scheduled_event_ids.length > 0),
  );

  return (
    <div
      ref={stageRef}
      data-testid="event-stage"
      className="event-stage-stack flex flex-col gap-2.5"
    >
      {/* Monthly Recurring Economy Strip: Single-Line Desktop Ticker / 2-Band Mobile Ledger */}
      {extMonthStart && extMonthStart.month === state.month && !pendingOutcome && (
        <div
          data-testid="month-economy-strip"
          className="paper-dossier-warm rounded-xl overflow-hidden text-xs"
        >
          <div className="month-economy-strip-row px-3 sm:px-3.5 py-1.5 bg-[#efe4ce]/65 flex flex-wrap items-center justify-between gap-x-2 xl:gap-x-3 gap-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-[#1f2421] min-w-0">
              <Receipt className="w-3.5 h-3.5 text-[#1f5c53] shrink-0" aria-hidden="true" />
              <span className="truncate">
                <span className="hidden xl:inline">{ui.eventStage.recurringLongPrefix}</span>
                <span className="xl:hidden">{ui.eventStage.recurringShortPrefix}</span>
                {ui.eventStage.monthLabel(extMonthStart.month)}
              </span>
            </div>

            <span
              className={`font-bureau text-[11px] font-bold tabular-nums whitespace-nowrap shrink-0 sm:order-3 ${
                extMonthStart.net_recurring_cash >= 0 ? "text-[#1f5c53]" : "text-[#9e221b]"
              }`}
            >
              {ui.eventStage.fixedCashLabel}{" "}
              {formatSignedEuros(extMonthStart.net_recurring_cash, locale)}
            </span>

            <div className="w-full sm:w-auto sm:order-2 flex flex-wrap items-center justify-between sm:justify-start gap-x-2 xl:gap-x-3 gap-y-0.5 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#1f2421]/14 font-bureau text-[11px] tabular-nums">
              <span>
                <span className="text-[#4a524e]">{ui.eventStage.billedShort}</span>
                <strong className="font-bold text-[#1f5c53] whitespace-nowrap">
                  +{formatEuros(extMonthStart.gross_billing, locale)}
                </strong>
              </span>
              <span>
                <span className="text-[#4a524e]">{ui.eventStage.fixedCostsShort}</span>
                <strong className="font-bold text-[#9e221b] whitespace-nowrap">
                  -{formatEuros(extMonthStart.total_expenses, locale)}
                </strong>
              </span>
              <span>
                <span className="text-[#4a524e]">{ui.eventStage.vatIrpfShort}</span>
                <strong className="font-bold text-[#264e7a] whitespace-nowrap">
                  +{formatEuros(extMonthStart.tax_accrued_on_billing, locale)}
                </strong>
                {monthTaxShield > 0 && (
                  <span className="hidden 2xl:inline text-[10px] text-[#1f5c53] ml-1">
                    (
                    {isEn
                      ? `-${formatEuros(monthTaxShield, locale)} deduct.`
                      : `-${formatEuros(monthTaxShield, locale)} deduc.`}
                    )
                  </span>
                )}
              </span>
            </div>
          </div>

          {hasSecondaryEconomyTicker && (
            <div className="px-3 sm:px-3.5 py-1 border-t border-[#1f2421]/14 bg-[#fffdf8]/90 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-bureau text-[11px] font-bold tabular-nums">
              {showAutoQuarterReceipt && lastAutoSettledQuarter && (
                <span data-testid="auto-settled-quarter-receipt" className="text-[#1f5c53]">
                  {isEn
                    ? `✓ Q${lastAutoSettledQuarter.quarter} tax auto-settled (${
                        lastAutoSettledQuarter.paidAmount > 0
                          ? `-${formatEuros(lastAutoSettledQuarter.paidAmount, locale)}`
                          : formatEuros(0, locale)
                      })`
                    : `✓ Trimestre T${lastAutoSettledQuarter.quarter} liquidado (${
                        lastAutoSettledQuarter.paidAmount > 0
                          ? `-${formatEuros(lastAutoSettledQuarter.paidAmount, locale)}`
                          : formatEuros(0, locale)
                      })`}
                </span>
              )}
              {extMonthStart.invoices_settled.map((inv) => (
                <span
                  key={inv.invoice_id}
                  className={inv.paid ? "text-[#1f5c53]" : "text-[#9e221b]"}
                >
                  {inv.paid
                    ? ui.eventStage.invoicePaid(formatEuros(inv.amount, locale))
                    : ui.eventStage.invoiceDefaulted(formatEuros(inv.amount, locale))}
                </span>
              ))}
              {monthModMoral !== 0 && (
                <span className={monthModMoral > 0 ? "text-[#1f5c53]" : "text-[#9e221b]"}>
                  {ui.eventStage.deltaMoral}: {formatSignedInt(monthModMoral)}
                </span>
              )}
              {totalMonthStressTick !== 0 && (
                <span className={totalMonthStressTick < 0 ? "text-[#1f5c53]" : "text-[#7a4308]"}>
                  {ui.eventStage.deltaStress}: {formatSignedInt(totalMonthStressTick)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Outcome Resolution View */}
      {pendingOutcome ? (
        <article
          data-testid="outcome-panel"
          className="paper-dossier animate-dossier rounded-xl overflow-hidden"
        >
          <div className="dossier-header">
            <span className="stamp-badge text-[11px] px-2 py-0.5 rounded bg-[#e8f5f1] text-[#1f5c53] border border-[#1f5c53]/45 shrink-0">
              {state.ending ? ui.eventStage.dossierClosedBadge : ui.eventStage.rulingRecordedBadge}
            </span>
            <span className="font-bureau text-xs font-bold text-[#4a524e] truncate">
              {resolveEventTitle(pendingOutcome.event, locale)}
            </span>
          </div>

          <div className="outcome-card-body p-3.5 sm:p-4 space-y-3">
            <div className="rounded-lg bg-[#f6efe0] border border-[#1f2421]/20 px-3 py-2 text-xs text-[#373f3a]">
              <span className="font-bold text-[#1f2421]">{ui.eventStage.decisionTakenLabel}</span>
              <span>{displayedChoiceLabel}</span>
            </div>

            <p
              data-testid="outcome-result-text"
              className="text-sm sm:text-base leading-relaxed text-[#1f2421] font-medium"
            >
              {resolveChoiceResultText(
                pendingOutcome.event.id,
                pendingOutcome.choiceId,
                pendingOutcome.outcome.outcome_id,
                pendingOutcome.outcome.result_text,
                locale,
              ) ?? ui.eventStage.defaultResultFallback}
            </p>

            {/* Applied Deltas & Structural Consequences Breakdown */}
            <div data-testid="outcome-deltas" className="flex flex-wrap gap-1.5 pt-0.5">
              {pendingOutcome.outcome.money_delta !== 0 && (
                <DeltaPill
                  label={ui.eventStage.deltaCash}
                  formatted={formatSignedEuros(pendingOutcome.outcome.money_delta, locale)}
                  favorable={pendingOutcome.outcome.money_delta > 0}
                />
              )}
              {computedTaxDelta !== 0 && (
                <DeltaPill
                  label={
                    computedTaxDelta < 0
                      ? isEn
                        ? "Tax shield"
                        : "Escudo fiscal"
                      : isEn
                        ? "VAT/Tax reserve"
                        : "Reserva IVA/IRPF"
                  }
                  formatted={
                    computedTaxDelta < 0
                      ? formatSignedEuros(computedTaxDelta, locale)
                      : `+${formatEuros(computedTaxDelta, locale)}`
                  }
                  favorable={computedTaxDelta < 0}
                />
              )}
              {appliedEffects?.deferred_invoice && (
                <DeltaPill
                  label={isEn ? "Deferred invoice" : "Factura aplazada"}
                  formatted={
                    isEn
                      ? `+${formatEuros(appliedEffects.deferred_invoice.amount, locale)} (in ${appliedEffects.deferred_invoice.delay_months}m)`
                      : `+${formatEuros(appliedEffects.deferred_invoice.amount, locale)} (cobro en ${appliedEffects.deferred_invoice.delay_months}m)`
                  }
                  favorable={true}
                />
              )}
              {pendingOutcome.outcome.moral_delta !== 0 && (
                <DeltaPill
                  label={ui.eventStage.deltaMoral}
                  formatted={formatSignedInt(pendingOutcome.outcome.moral_delta)}
                  favorable={pendingOutcome.outcome.moral_delta > 0}
                />
              )}
              {pendingOutcome.outcome.stress_delta !== 0 && (
                <DeltaPill
                  label={ui.eventStage.deltaStress}
                  formatted={formatSignedInt(pendingOutcome.outcome.stress_delta)}
                  favorable={pendingOutcome.outcome.stress_delta < 0}
                />
              )}
              {pendingOutcome.outcome.personal_life_delta !== 0 && (
                <DeltaPill
                  label={ui.eventStage.deltaPersonalLife}
                  formatted={formatSignedInt(pendingOutcome.outcome.personal_life_delta)}
                  favorable={pendingOutcome.outcome.personal_life_delta > 0}
                />
              )}
              {pendingOutcome.outcome.reputation_delta !== 0 && (
                <DeltaPill
                  label={ui.eventStage.deltaReputation}
                  formatted={formatSignedInt(pendingOutcome.outcome.reputation_delta)}
                  favorable={pendingOutcome.outcome.reputation_delta > 0}
                />
              )}
              {computedEmpSatDelta !== 0 && (
                <DeltaPill
                  label={isEn ? "Staff morale" : "Clima plantilla"}
                  formatted={formatSignedInt(computedEmpSatDelta)}
                  favorable={computedEmpSatDelta > 0}
                />
              )}
              {pendingOutcome.outcome.fiscal_risk_delta !== 0 && (
                <DeltaPill
                  label={ui.eventStage.deltaTaxTension}
                  formatted={`${formatSignedInt(pendingOutcome.outcome.fiscal_risk_delta)} (${
                    pendingOutcome.outcome.fiscal_risk_delta > 0
                      ? ui.eventStage.taxTensionUp
                      : ui.eventStage.taxTensionDown
                  })`}
                  favorable={pendingOutcome.outcome.fiscal_risk_delta < 0}
                />
              )}
              {appliedEffects?.add_modifier &&
                (() => {
                  const mod = appliedEffects.add_modifier;
                  const netEur = Math.round(
                    (mod.monthly_billed_delta ?? 0) - (mod.monthly_expense_delta ?? 0),
                  );
                  const parts: string[] = [];
                  if (netEur !== 0) {
                    parts.push(`${formatSignedEuros(netEur, locale)}/m`);
                  }
                  if (mod.monthly_moral_delta) {
                    parts.push(
                      `${ui.eventStage.deltaMoral} ${formatSignedInt(mod.monthly_moral_delta)}/m`,
                    );
                  }
                  if (mod.monthly_stress_delta) {
                    parts.push(
                      `${ui.eventStage.deltaStress} ${formatSignedInt(mod.monthly_stress_delta)}/m`,
                    );
                  }
                  const summary =
                    parts.length > 0
                      ? `${parts.join(" · ")} × ${mod.remaining_months}m`
                      : `× ${mod.remaining_months}m`;
                  const favorable =
                    netEur > 0 ||
                    (netEur === 0 &&
                      (mod.monthly_moral_delta ?? 0) >= 0 &&
                      (mod.monthly_stress_delta ?? 0) <= 0);
                  return (
                    <DeltaPill
                      label={translateModifierLabel(mod, locale)}
                      formatted={summary}
                      favorable={favorable}
                    />
                  );
                })()}
              {appliedEffects?.hire_employee &&
                (() => {
                  const empChar =
                    compiledCatalog.characters[appliedEffects.hire_employee.character_id];
                  const empName = empChar
                    ? translateCharacterName(empChar, locale)
                    : appliedEffects.hire_employee.character_id;
                  const empCost = empChar?.employee_params?.monthly_cost ?? 0;
                  const empMult = empChar?.employee_params?.billing_multiplier ?? 1;
                  return (
                    <DeltaPill
                      label={isEn ? "Hired staff" : "Alta en plantilla"}
                      formatted={`${empName} (-${formatEuros(empCost, locale)}/m · ×${empMult})`}
                      favorable={true}
                    />
                  );
                })()}
              {appliedEffects?.dismiss_employee && (
                <DeltaPill
                  label={isEn ? "Staff dismissed" : "Baja en plantilla"}
                  formatted={
                    appliedEffects.dismiss_employee.severance_cost > 0
                      ? isEn
                        ? `-${formatEuros(appliedEffects.dismiss_employee.severance_cost, locale)} severance`
                        : `Indemnización -${formatEuros(appliedEffects.dismiss_employee.severance_cost, locale)}`
                      : isEn
                        ? "Payroll ended"
                        : "Fin de nómina"
                  }
                  favorable={appliedEffects.dismiss_employee.severance_cost === 0}
                />
              )}
              {appliedEffects?.set_gestor &&
                (() => {
                  const gChar = appliedEffects.set_gestor.character_id
                    ? compiledCatalog.characters[appliedEffects.set_gestor.character_id]
                    : undefined;
                  const fee =
                    gChar?.gestor_params?.monthly_fee ??
                    compiledCatalog.balance.gestor_tiers[appliedEffects.set_gestor.tier]
                      .monthly_fee;
                  return (
                    <DeltaPill
                      label={isEn ? "Tax advisor" : "Gestoría"}
                      formatted={`${translateGestorTier(appliedEffects.set_gestor.tier, locale)} (${formatEuros(fee, locale)}/m)`}
                      favorable={appliedEffects.set_gestor.tier !== "self"}
                    />
                  );
                })()}
              {appliedEffects?.set_family_status && (
                <DeltaPill
                  label={isEn ? "Personal status" : "Situación familiar"}
                  formatted={translateFamilyStatus(appliedEffects.set_family_status.status, locale)}
                  favorable={appliedEffects.set_family_status.status !== "separated"}
                />
              )}
              {appliedEffects?.add_child && (
                <DeltaPill
                  label={isEn ? "Family" : "Familia"}
                  formatted={
                    isEn
                      ? `+${appliedEffects.add_child} child (-${formatEuros(appliedEffects.add_child * compiledCatalog.balance.child_monthly_cost, locale)}/m)`
                      : `+${appliedEffects.add_child} hijo(s) (-${formatEuros(appliedEffects.add_child * compiledCatalog.balance.child_monthly_cost, locale)}/m)`
                  }
                  favorable={true}
                />
              )}
              {appliedSetFlags.length > 0 && (
                <span className="inline-flex flex-wrap items-center gap-1 rounded-md border border-[#264e7a]/50 bg-[#ebf2fa] px-2.5 py-1 font-bureau text-xs font-bold text-[#264e7a]">
                  <span>{isEn ? "Dossier:" : "Expediente:"}</span>
                  <span>
                    {appliedSetFlags.map((flag) => humanizeFlag(flag, locale)).join(" · ")}
                  </span>
                </span>
              )}
              {appliedClearFlags.length > 0 && (
                <span className="inline-flex flex-wrap items-center gap-1 rounded-md border border-[#1f2421]/30 bg-[#efe4ce] px-2.5 py-1 font-bureau text-xs font-bold text-[#373f3a]">
                  <span>{isEn ? "Cleared:" : "Archivado:"}</span>
                  <span>
                    {appliedClearFlags.map((flag) => humanizeFlag(flag, locale)).join(" · ")}
                  </span>
                </span>
              )}
              {pendingOutcome.outcome.scheduled_event_ids.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[#7a4308]/50 bg-[#fcf4df] px-2.5 py-1 font-bureau text-xs font-bold text-[#7a4308]">
                  {ui.eventStage.futureConsequencesBadge}
                </span>
              )}
              {!hasAnyOutcomePill && (
                <span className="inline-flex items-center rounded-md border border-[#1f2421]/25 bg-[#efe4ce] px-2.5 py-1 font-bureau text-xs font-bold text-[#373f3a]">
                  {isEn ? "No immediate ledger changes" : "Sin variación contable inmediata"}
                </span>
              )}
            </div>

            <div className="pt-0.5">
              <button
                type="button"
                data-testid="outcome-continue-btn"
                onClick={onContinueOutcome}
                className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] font-bold text-base px-5 py-2.5 flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>
                  {state.ending
                    ? ui.eventStage.continueToFinalCert
                    : state.phase === "quarterly_tax"
                      ? ui.eventStage.continueToQuarter
                      : ui.eventStage.continueBtn}
                </span>
                <span className="hidden sm:inline-block ml-1 font-bureau text-xs px-1.5 py-0.5 rounded bg-[#fffdf8]/20">
                  {ui.eventStage.enterKeyLabel}
                </span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </div>
        </article>
      ) : activeEventView ? (
        <article
          data-testid="event-card"
          data-event-id={activeEventView.event.id}
          className="paper-dossier animate-dossier rounded-xl overflow-hidden"
        >
          {/* Standardized Bureaucratic Dossier Header */}
          <div className="dossier-header">
            <span className="stamp-badge text-[11px] px-2 py-0.5 rounded bg-[#fcf4df] text-[#7a4308] border border-[#7a4308]/45 truncate">
              {ui.eventStage.dossierPrefix}{" "}
              {translateCategoryLabel(activeEventView.event.category, locale)}
            </span>

            {state.current_turn_events.length > 1 ? (
              <span className="font-bureau text-[11px] font-bold px-2 py-0.5 rounded bg-[#efe4ce] text-[#1f2421] shrink-0 tabular-nums">
                {ui.eventStage.pendingEventsCount(state.current_turn_events.length - 1)}
              </span>
            ) : (
              <span className="font-bureau text-[11px] font-bold text-[#4a524e] shrink-0 tabular-nums">
                {ui.eventStage.monthLabel(state.month)}
              </span>
            )}
          </div>

          <div className="event-card-body p-3.5 sm:p-4 space-y-2.5 sm:space-y-3">
            {/* Visual Comic Header Banner + Pinned Multi-Expression Polaroid */}
            {bannerResolution && (
              <div
                className={`event-banner-wrap relative ${
                  activeCharacter && activeCharacterPortrait ? "sm:pb-2" : ""
                }`}
              >
                <img
                  data-testid="event-banner-art"
                  data-banner-kind={bannerResolution.kind}
                  data-asset-id={bannerResolution.asset.id}
                  src={bannerResolution.asset.url}
                  alt={ui.eventStage.sceneAltPrefix(
                    translateCategoryLabel(activeEventView.event.category, locale),
                  )}
                  width={bannerResolution.asset.width}
                  height={bannerResolution.asset.height}
                  decoding="async"
                  onError={handleCategoryArtError}
                  className={`event-banner-img w-full ${
                    bannerResolution.kind === "milestone"
                      ? "aspect-video sm:aspect-auto sm:h-36"
                      : "aspect-[8/3] sm:aspect-auto sm:h-32"
                  } object-cover rounded-lg border-2 border-[#1f2421] bg-[#f6efe0] shadow-[2px_2px_0px_0px_rgba(31,36,33,0.85)] ${renderModeClass(
                    bannerResolution.asset.render_mode,
                  )}`}
                />

                {activeCharacter && activeCharacterPortrait && (
                  <figure
                    data-testid="event-character-polaroid"
                    data-expression={activeCharacterExpression}
                    data-asset-id={activeCharacterPortrait.id}
                    className="event-polaroid-desktop polaroid-card rounded-[3px] flex sm:block items-center gap-2.5 mx-1 sm:mx-0 mb-0 mt-2 sm:mt-0 p-1 sm:pb-1.5 w-fit max-w-[calc(100%-0.5rem)] sm:w-22 sm:absolute sm:right-3 sm:bottom-0 z-10"
                  >
                    <span className="polaroid-pin" aria-hidden="true" />
                    <img
                      data-testid="event-character-polaroid-img"
                      src={activeCharacterPortrait.url}
                      alt={activeCharacterName}
                      width={activeCharacterPortrait.width}
                      height={activeCharacterPortrait.height}
                      decoding="async"
                      onError={handleCategoryArtError}
                      className={`w-10 h-10 sm:w-full aspect-square object-cover shrink-0 border border-[#1f2421]/35 bg-[#f6efe0] ${renderModeClass(
                        activeCharacterPortrait.render_mode,
                      )}`}
                    />
                    <figcaption className="min-w-0 pr-1 sm:pr-0 sm:mt-1 px-0.5 sm:text-center font-bureau text-[10px] font-bold text-[#1f2421] leading-tight line-clamp-2">
                      {activeCharacterName}
                    </figcaption>
                  </figure>
                )}
              </div>
            )}

            {/* Title & Body — never truncated */}
            <div className="space-y-1.5">
              <h2
                ref={eventTitleRef}
                tabIndex={-1}
                data-testid="event-title"
                className="font-editorial text-lg sm:text-xl font-bold text-[#1f2421] leading-snug outline-none"
              >
                {resolveEventTitle(activeEventView.event, locale)}
              </h2>
              <p
                data-testid="event-body"
                className="text-sm sm:text-[14.5px] text-[#373f3a] leading-relaxed xl:leading-snug"
              >
                {resolveEventBody(activeEventView.event, locale)}
              </p>
            </div>

            {/* Choice Buttons (min-height >= 48px on touch & desktop, >= 6px gap, 2-col on >=4 choices) */}
            <fieldset
              data-choice-count={activeEventView.choices.length}
              className="event-choices-grid pt-0.5 border-0 p-0 m-0 min-w-0"
              aria-label={ui.eventStage.choicesAria}
            >
              {activeEventView.choices.map((entry, index) => {
                const { choice, eligible } = entry;
                const lockReasons = eligible
                  ? []
                  : explainChoiceLockReasons(state, choice.requirements, locale);
                const hasWeightedOutcomes = Boolean(choice.outcomes && choice.outcomes.length > 0);
                const resolvedLabel = resolveChoiceLabel(activeEventView.event.id, choice, locale);
                const stakeChips = eligible
                  ? buildDeterministicStakeChips(choice, resolvedLabel, locale)
                  : [];

                return (
                  <button
                    key={choice.id}
                    type="button"
                    data-testid={`choice-btn-${index}`}
                    data-choice-id={choice.id}
                    disabled={!eligible}
                    onClick={() => onSelectChoice(choice.id)}
                    className={`event-choice-btn w-full min-h-12 text-left rounded-lg border-2 px-3 sm:px-3.5 py-2 transition-all flex items-start gap-2.5 ${
                      eligible
                        ? "border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] active:translate-y-px shadow-[2px_2px_0px_0px_rgba(31,36,33,0.85)] cursor-pointer"
                        : "border-[#7a7468] bg-[#efe4ce] text-[#373f3a] cursor-not-allowed"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`font-bureau text-xs font-bold w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5 border tabular-nums ${
                        eligible
                          ? "bg-[#1f2421] text-[#fffdf8] border-[#1f2421]"
                          : "bg-[#dfd1b8] text-[#373f3a] border-[#6e685f]"
                      }`}
                    >
                      {index + 1}
                    </span>

                    <span className="flex-1 min-w-0 space-y-1 self-center">
                      <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <span className="font-semibold text-sm sm:text-[14.5px] leading-snug text-[#1f2421]">
                          {resolvedLabel}
                        </span>

                        {(hasWeightedOutcomes || stakeChips.length > 0) && eligible && (
                          <span
                            data-testid={`choice-stakes-${index}`}
                            className="inline-flex flex-wrap items-center gap-1 shrink-0"
                          >
                            {stakeChips.map((chip) => (
                              <span
                                key={chip.key}
                                className={`inline-flex items-center font-bureau text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none whitespace-nowrap tabular-nums ${stakeChipClass(
                                  chip.tone,
                                )}`}
                              >
                                {chip.text}
                              </span>
                            ))}
                            {hasWeightedOutcomes && (
                              <span className="inline-flex items-center gap-1 font-bureau text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#fcf4df] text-[#7a4308] border border-[#7a4308]/35 shrink-0">
                                <Dices className="w-3 h-3 shrink-0" aria-hidden="true" />
                                <span>{ui.eventStage.uncertaintyBadge}</span>
                              </span>
                            )}
                          </span>
                        )}
                      </span>

                      {!eligible && (
                        <span
                          data-testid={`choice-lock-reason-${index}`}
                          className="flex items-center gap-1.5 text-xs font-semibold text-[#8f1d18]"
                        >
                          <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            {ui.eventStage.lockedPrefix}{" "}
                            {lockReasons.length > 0
                              ? lockReasons.join(" · ")
                              : ui.eventStage.lockedFallback}
                          </span>
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </fieldset>
          </div>
        </article>
      ) : (
        <div className="paper-dossier rounded-xl p-6 text-center text-sm text-[#4a524e]">
          {ui.eventStage.processingMonth(state.month)}
        </div>
      )}
    </div>
  );
}
