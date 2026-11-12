# ADR 003: Phase 3.5 Tax-Deductible Overhead, Studio Scaling, Stat Maintenance & Selector Pacing
- **Status**: accepted
- **Date**: 2026-11-12

## Context
- **Non-Deductible Business Overhead & Studio Trap (`src/engine/economy.ts`, `content/characters/`)**:
  - Previously, `applyRecurringMonthEconomy` accrued `effective_quarterly_tax_rate` (`28%`) on `100%` of gross monthly billing without deducting recurring business expenses (`autonomo_quota`, `gestor.monthly_fee`, `employee.monthly_cost`, and positive `monthly_expense_delta` modifiers).
  - Consequently, hiring Dani or Laura taxed their gross billing boost at full rate while paying their fixed monthly wage out of post-tax cash, turning studio expansion into a cashflow trap and leaving `ricachon_150k` (`150,000 €`) nearly unreachable in legitimate runs, while `EmployeeState.satisfaction` had no mechanical impact on productivity.
- **Late-Game Stat Pinning & Flat Cost of Living (`content/config/balance.yaml`)**:
  - Generous passive stress recovery (`2/mo` above `55` plus `2/mo` partner support) and zero upper-end stat maintenance allowed Years 4–10 runs to pin permanently at `100/100/100/0` (`moral`/`reputation`/`personal_life`/`stress`), while static `base_living_cost` ignored decade-long inflation.
- **Selector Repetition, Inspection Glitches, Silent Chain Drops & Endless Retirement (`src/engine/selector.ts`, `src/engine/turn.ts`)**:
  - Static event weights caused high-weight evergreen cards to repeat heavily before lower-weight narrative arcs surfaced across 120+ months, and Narrative lacked seasonal calendar gating (`months_of_year`) and `employee_satisfaction` requirements/effects.
  - Quarterly Hacienda inspections could schedule `weight: 0` chain finales (e.g., `hacienda_acta_inspeccion`) or benign portal/certificate/filing glitches (`bucle_clave_pin`, `certificado_digital`, `caida_sede`, `notificacion_agosto`, `campana_renta`) instead of genuine audits.
  - Resolving `Slot 1` could invalidate `Slot 2`'s hard requirements within the same month without revalidating `Slot 2`, due chain events that temporarily failed `isEventHardEligible` were silently dropped on first check, and Endless Mode runs lacked a pure `retireFromRun` engine transition to voluntarily retire after continuing past a victory prompt.

## Decision
- **Zod & JSON Schema Extensions (`src/engine/schemas/event.ts`, `balance.ts`, `schemas/*.schema.json`)**:
  - Add `months_of_year` (`1..12` via `((state.month - 1) % 12) + 1`) and `employee_satisfaction` (`StatRangeSchema`, `false` when `state.employee === null`) to `RequirementsSpecSchema`, updating `hasActiveRequirements()` so anti-softlock validation enforces unconditional fallbacks when choices use either filter.
  - Add `employee_satisfaction` (`number` delta clamped `[0, 100]`, no-op when `state.employee === null`) to `EffectsSpecSchema`, expose `tax_accrued_delta` & `employee_satisfaction_delta` on `ChoiceOutcomeSummary`, and set `flags.historia_con_alex = true` on `dating`/`cohabiting` vs `flags.ex_pareja_alex = true` + `family.partner_character_id = null` on `separated` in `resolveChoiceEffects`.
  - Add optional `annual_living_cost_growth`, `high_stat_decay_threshold`, and `event_novelty_decay_k` to `BalanceConfigSchema` and re-emit `schemas/*.schema.json` via `pnpm schema:emit`.
- **Tax-Deductible Business Overhead, Satisfaction-Scaled Studio Multipliers & Late-Game Drift (`src/engine/economy.ts`, `balance.yaml`)**:
  - Export `computeMonthlyDeductibleExpenses(state, catalog)` summing `autonomo_quota + gestor.monthly_fee + (employee?.monthly_cost ?? 0) + Math.max(0, modifierExpenseDelta)`.
  - Offset monthly tax accrual by `Math.round(deductibleExpenses * deductible_tax_fraction)` (clamping `accrued_tax_liability >= 0`) and expose `deductible_expenses`, `tax_shield_on_expenses`, `net_tax_accrued`, `modifier_moral_delta`, and `modifier_stress_delta` on `MonthStartSummary`.
  - Scale `employeeMultiplier` in `computeBaselineMonthlyBilling` by `satScale = 0.4 + 0.8 * (clampStat(employee.satisfaction) / 100)` (`satisfaction = 75 -> 1.0x` boost, `100 -> 1.2x`, `25 -> 0.6x` while wage remains fixed) and calibrate `empleado_junior_dani` (`1,350 €/mo`, `1.58x`) and `empleada_senior_laura` (`2,100 €/mo`, `2.05x`).
  - Add annual cost-of-living creep (`Math.floor((month - 1) / 12) * annual_living_cost_growth` with `annual_living_cost_growth: 64`, `base_living_cost: 1405`, `reputation_multiplier_max: 1.24`, and `moral_multiplier_max: 1.13` so Month 1 passive after-tax cashflow stays negative at `-119 €/mo`), gentle high-stat maintenance drift (`high_stat_decay_threshold: 60` with `-2/mo` near-ceiling decay at `>= 90`), tiered stress recovery (`personal_life_recovery_threshold: 65`, `personal_life_monthly_stress_relief: 1` or `2` when `personal_life >= 82`, `default_partner_support_modifier: 1`), and sharpened Gestor/Hacienda risk (`self`: `25%` error / `240 €` / `+7` stress; `premium`: `170 €/mo` / `0.72` shield; `min_fiscal_risk: 15`; `quarterly_natural_risk_decay: 3`).
- **Novelty Decay, Audit Filtering, Deferred Chains, Slot-2 Revalidation & `retireFromRun` (`src/engine/selector.ts`, `src/engine/turn.ts`)**:
  - Apply diminishing weight decay `event.weight / Math.pow(1 + (event_novelty_decay_k ?? 0.85) * occurrences, 1.35)` when drawing random events.
  - Restrict quarterly inspection scheduling (`isInspectableHaciendaEvent` / `selectInspectableHaciendaEvent`) to eligible `weight > 0` Hacienda audit/comprobación/requerimiento events selected via seeded `pickWeighted`, applying `fallback_fine_base + fallback_fine_per_risk * fiscal_risk` when none are eligible.
  - Retain temporarily ineligible due scheduled events in `scheduled_queue` with `trigger_month: state.month + 1` while `(deferred_months ?? 0) < 6`.
  - Revalidate `Slot 2` in `applyPlayerChoice` after `Slot 1` resolves, redrawing a fresh eligible non-cooldown random event (excluding `Slot 1` and `exclusive_with`) if `Slot 1` invalidated `Slot 2`.
  - Export pure `retireFromRun(state, catalog)` allowing voluntary retirement whenever `state.phase !== "game_over"` and `(endless_mode || month >= victory_month || earned_victories.length > 0)`, awarding `"retired_rich"` (at `>= 150,000 €` or with `"rich_150k"`) else `"retired_hero"`.

## Consequences
- **Authentic Fiscal Trade-Offs & Viable Studio Path**: Paying RETA, hiring a Gestor, and employing Dani/Laura legitimately shield quarterly IVA/IRPF accrual, making `ricachon_150k` (`150,000 €`) achievable (`~20%` on skilled growth/studio runs) without breaking solo early-game solvency tension (`0.0%` `PassiveRejectBot` survival, `~93%` `ConservativeLegalBot` survival).
- **Sustained Decade Pacing & Narrative Freshness**: High stats require active maintenance in Years 4–10, seasonal/morale-gated events integrate cleanly into schema validation, chain arcs survive transient state mismatches up to 6 months, and Endless Mode runs can retire cleanly at any point with full `src/engine/` purity.
