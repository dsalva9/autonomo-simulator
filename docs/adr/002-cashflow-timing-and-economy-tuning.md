# ADR 002: Two-Step Cashflow Outcome Timing, Tax-Reserve Liquidity & Phase 2 Economy Tuning
- **Status**: accepted
- **Date**: 2026-11-11

## Context
- **Synchronous Month-Advance HUD Bug (`src/engine/turn.ts` + `src/store/gameStore.ts`)**:
  - In Phase 0/1, `applyPlayerChoice` resolved the active event choice (`resolveChoiceEffects`) and, whenever it was the final card of Month `N` (`N % 3 !== 0`), immediately advanced into Month `N+1` (`advanceToNextMonth` -> `stepMonthStart` -> `applyRecurringMonthEconomy`) inside the same synchronous engine call.
  - `useGameStore.chooseOption` then diffed `prevIndicators` against `nextState.indicators` and rendered `activeRun = nextState` while `pendingOutcome` remained open on screen.
  - As a result, choosing an option in Month `N` that cost `-400 €` immediately credited Month `N+1`'s recurring pre-tax cashflow (`+616 €..+763 €`), causing the sticky HUD to jump to Month `N+1` and flash a positive green delta (`+216 €..+363 €`) while the player was still reading Month `N`'s outcome card.
- **Passive Surplus Snowball & Month-1 Pre-Credit (`content/config/balance.yaml`)**:
  - Starting with `initial_indicators.money: 3500` plus immediate Month 1 `stepMonthStart` pre-credit launched every run at `4,263 €` before a single decision.
  - Worse, at starting stats (`reputation: 35`, `moral: 75`), baseline billing (`2,323 €/mo`) exceeded recurring living + RETA expenses (`1,560 €/mo`) AND quarterly tax accrual (`650 €/mo`) by `+113 €/mo` after taxes, making `ConservativeLegalBot` `100.0%` immortal (`0` bankruptcies across 250 campaigns) and allowing late-game cash (`reputation_multiplier_max: 1.45`) to snowball past `80,000 €`.
- **Tax-Adjusted Liquidity Blindness**:
  - Players saw raw `indicators.money` (*Caja*) without a pure engine helper exposing how much of that cash was already spoken for by accrued IVA/IRPF and any active `deferred_tax` (*Aplazamiento*).

## Decision
- **Pure `postChoiceState` Snapshot & Two-Step Store Presentation (`src/engine/types.ts`, `src/engine/turn.ts`, `src/store/gameStore.ts`)**:
  - Extend `TurnResolution` with `postChoiceState?: GameState`, populated in `applyPlayerChoice` immediately after `resolveChoiceEffects` (at `month = N`, with `current_turn_events` sliced, strictly before `transitionAfterTurnEvents` / `advanceToNextMonth`). The headless `applyPlayerChoice` return contract (`{ state, resolution }`) remains 100% pure and unchanged for Monte Carlo bots.
  - Keep `activeRun` in `useGameStore` as the canonical persisted `nextState` so IndexedDB autosaves never re-roll RNG on mid-turn browser reload, while adding `outcomePreviewState`, `queuedPostOutcomeDeltas`, `queuedMonthStart`, and selector `getVisibleGameState(store)` (`store.outcomePreviewState ?? store.activeRun`).
  - While `pendingOutcome` is open (when `uiStore.fastPacing === false`, default), `getVisibleGameState` exposes Month `N`'s `outcomePreviewState` and `lastDeltas` reflects the exact choice delta (`prevIndicators -> postChoiceState.indicators`). Calling `acknowledgeOutcome()` clears `outcomePreviewState` and applies `queuedPostOutcomeDeltas` + `queuedMonthStart`, cleanly transitioning the HUD to Month `N+1`'s recurring economy.
- **Pure Tax-Adjusted Liquidity Helpers (`src/engine/economy.ts`, `src/engine/index.ts`)**:
  - Export `computeReservedTaxObligation(state)` (`accrued_tax_liability + (deferred_tax ? deferred_tax.principal + deferred_tax.surcharge : 0)`) and `computeNetCashAfterTaxReserve(state)` (`indicators.money - computeReservedTaxObligation(state)`).
- **Phase 2 `balance.yaml` Calibration (Verified Against 60-Event Catalog)**:
  - Lower `initial_indicators.money` from `3500` to `2600` (`3,216 €` post-Month-1 `Caja`; `2,596 €` net after tax reserve).
  - Tune `base_monthly_billing: 2240`, `base_living_cost: 1290`, `autonomo_quota: 310`, `reputation_multiplier_min: 0.74`, `reputation_multiplier_max: 1.35`, and `personal_life_recovery_threshold: 55` (`effective_quarterly_tax_rate: 0.28`).
  - At Month 1 (`reputation: 35`, `moral: 75`), baseline billing (`2,216 €`) minus recurring expenses (`1,600 €`) minus quarterly tax accrual (`620 €`) yields **`-4 €/mo` after taxes before any gestor, partner, child, or event expense**, guaranteeing passive play goes bankrupt (`0.0%` survival on `PassiveRejectBot`) while calibrated 60-event Monte Carlo survival sits at **`42.3%` (`RandomBot`)** and **`80.0%` (`ConservativeLegalBot`, `50/250` bankruptcies)**.
- **Ephemeral Pacing & Audio Preferences (`src/store/uiStore.ts`)**:
  - Add `sfxMuted` (`"autonomo:sfx_muted"`, default `false`) and `fastPacing` (`"autonomo:fast_pacing"`, default `false`, auto-acknowledges non-lethal outcomes) with `try/catch`-guarded `localStorage` persistence.

## Consequences
- **Accurate Player Cause-and-Effect Feedback**: Paying `-400 €` in an event immediately displays `-400 €` in red on Month `N`'s HUD; Month `N+1` recurring billing appears only after clicking *Continuar*.
- **Genuine Solvency Tension**: `Caja` visibly rises on invoiced gigs and drops on expenses, *Trimestres*, family milestones, hiring, and fines; players can track both raw *Caja* and net cash after Hacienda reserves without violating `src/engine/` purity.
