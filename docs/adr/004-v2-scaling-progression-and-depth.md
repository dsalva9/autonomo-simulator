# ADR 004: Autónomo Simulator v2 — Business Scaling, Progressive Economy, Long-Horizon Consequences & Systemic Depth

- **Status**: accepted
- **Date**: 2026-11-27
- **Supersedes / Extends**: Extends [ADR 002](./002-cashflow-timing-and-economy-tuning.md) and [ADR 003](./003-phase-3-5-tax-deductibility-decay-and-pacing.md)
- **Companion Document**: `docs/qa/v2-content-blueprint.md` (event-by-event content audit and new event roster)

---

## 1. Context & Problem Statement

Real-player feedback and systematic telemetry/catalog audits of Autónomo Simulator v1 (300 events, flat solo economy) validated **8 interconnected systemic flaws** that flatten the 10-year campaign after Year 3:

1. **Event Amnesia**: Permanent one-time purchases, hardware upgrades, or irreversible life/business setups (e.g., ergonomic chair/mouse, fixed-rate mortgage, VeriFactu migration, vendor onboarding) lack `set_flags` / `forbidden_flags` or `max_occurrences: 1` guards and repeat awkwardly.
2. **Invisible Partner & Under-Pressured `personal_life`**: Only ~17/300 events involve `pareja_alex` / `family_statuses`, `personal_life` gates `0` events or choices, and relationship ultimatums resolve for trivial sums (~120 €).
3. **Elena (Premium Gestor) Auto-Win**: At 170 €/mo tax-deductible (`122 €` net), `72%` inspection shield, `1%` error rate, and 16/17 Elena events awarding positive net cash, hiring Elena removes fiscal tension for the rest of the run.
4. **Unviable "En B" Risk-Reward Loop**: Risky tax-evasion choices deliver weak net advantages (`+260–397 €`) while `economy.ts` inflicts a silent passive `-3` to `-5` `moral/mo` drain whenever `fiscal_risk >= 35`, making 100% legal play strictly dominant (`~93%` `ConservativeLegalBot` survival).
5. **Short Consequence Horizon**: 54 of 56 `schedule_events` edges resolve in `1–3` months and `0` exceed `8` months; Spain's real 4-year *prescripción fiscal* (48 months) and multi-year career bets do not exist.
6. **Flat Business Scaling**: The `sociedad_limitada_activa` flag is read by `0` other events; `state.employee` hard-caps payroll at `1` person; only `3` events have `min_month >= 97`; a Year-9 S.L. still plays 2,000 € solo gigs.
7. **Flat Year 3–10 Difficulty Curve**: Fixed `310 €` RETA, flat `28%` tax rate, and mild `+64 €/mo/yr` living-cost creep allow passive mid-game builds to snowball unchallenged into Month 120.
8. **Underused RPG Stat Checks**: Across 893 choices, only `23` gate on `reputation`, `2` on `stress`, `1` on `moral`, `0` on `personal_life`, and `0` on `fiscal_risk`, and eligible unlocked RPG checks are invisible in the UI.

### Approved Human Owner Targets
- Design the complete **v2 architecture** upfront while preserving all `AGENTS.md` invariants (100% pure deterministic `src/engine/`, seeded PRNG, `pnpm schema:emit`, anti-softlock rule, Zero Desktop Yo-Yo Scroll & Zero-Scroll Mobile Stage).
- Calibrate careful 100% legal play (`ConservativeLegalBot`) to a **45%–55%** 120-month survival rate (tense, meaningful trade-offs rather than an auto-win), while keeping `PassiveRejectBot` at `0%` survival.
- Raise the **"Ricachón"** cash-victory threshold from `150,000 €` to **`250,000 €`** (`victory_money: 250000`).

---

## 2. Business Progression & Multi-Employee Team Model

### 2.1 Four Business Stages (`BusinessTier`) + Boutique Senior Solo Path

Introduce a first-class `BusinessState` struct on `GameState`:

```ts
export type BusinessTier =
  | "solo_autonomo"
  | "estudio_consolidado"
  | "sociedad_limitada"
  | "agencia_consultora";

export interface BusinessState {
  tier: BusinessTier;
  months_in_tier: number;
  sl_formed_month: number | null; // First month S.L. or Agencia was entered
}
```

| `BusinessTier` | ES Label | EN Label | Tax Regime | Team Cap | Structural Overhead (Deductible) | `billing_multiplier` | `event_stakes_multiplier` | `gestor_fee_multiplier` | `hard_debt_floor` |
|---|---|---|---|---:|---:|---:|---:|---:|---:|
| `solo_autonomo` | Autónomo Individual | Solo Freelancer | Progressive IRPF + RETA brackets | `1` | `0 €/mo` | `1.00x` | `1.00x` | `1.00x` | `-5,000 €` |
| `estudio_consolidado` | Estudio Consolidado | Boutique Studio | Progressive IRPF + RETA brackets | `3` | `280 €/mo` | `1.22x` | `1.45x` | `1.35x` | `-8,000 €` |
| `sociedad_limitada` | Sociedad Limitada (S.L.) | Limited Company (S.L.) | Impuesto de Sociedades (`24%`) + Societario (`460 €/mo`) | `6` | `560 €/mo` | `1.35x` | `2.15x` | `1.95x` | `-15,000 €` |
| `agencia_consultora` | Agencia / Consultora | Agency / Consultancy | Impuesto de Sociedades (`24%`) + Societario (`520 €/mo`) | `12` | `1,250 €/mo` | `1.50x` | `3.20x` | `2.80x` | `-25,000 €` |

#### Viable Late-Game "Boutique Senior Solo" Path (No Forced Hiring)
Players who never want to manage payroll have an authentic high-skill solo path:
1. **Tier Access Without Employees**: A solo player (`headcount === 0`) can upgrade to `estudio_consolidado` (e.g., boutique independent practice) and even incorporate as a `sociedad_limitada` (**S.L.U.** — *Sociedad Limitada Unipersonal*) to escape `37%–44%` marginal IRPF once net profit exceeds `~5,000 €/mo`. Only `agencia_consultora` requires an active team (`team_size: { min: 4 }`).
2. **Boutique Senior Solo Premium (`economy.ts`)**: Whenever `getTeamHeadcount(state) === 0`, `state.month >= balance.team_scaling.boutique_solo_min_month` (`30`), and `state.indicators.reputation >= balance.team_scaling.boutique_solo_min_reputation` (`68`), baseline billing receives a specialist multiplier:
   $$\text{boutiqueFactor} = 1 + \text{clamp}\!\left(\frac{\text{reputation} - 68}{100 - 68},\; 0,\; 1\right) \times 0.50$$
   - Scales linearly from `1.00x` at `rep = 68` to **`1.50x`** at `rep = 100`.
   - Zero payroll insolvency risk, zero management stress, and unlocks bespoke high-ticket Boutique Solo events (`team_size: { max: 0 }`, `stats: { reputation: { min: 70 } }`), balanced by single-point-of-failure illness/burnout vulnerability.
   - Pure helper `isBoutiqueSeniorSolo(state, catalog): boolean` (`headcount === 0 && month >= 30 && reputation >= 72`) drives optional UI badge display.

#### Automatic `sociedad_limitada_activa` Synchronization
To guarantee zero drift between legacy flags and `state.business.tier`:
- When `effects.set_business_tier` transitions to `"sociedad_limitada"` or `"agencia_consultora"`, `resolveChoiceEffects` automatically sets `flags.sociedad_limitada_activa = true` and records `business.sl_formed_month ??= state.month`.
- Conversely, if an existing v1 event (such as `gestor_elena_escritura_notarial_sl`) sets `flags.sociedad_limitada_activa` without specifying `set_business_tier`, and `state.business.tier` is `"solo_autonomo"` or `"estudio_consolidado"`, `resolveChoiceEffects` automatically promotes `state.business.tier` to `"sociedad_limitada"` and refreshes `gestor.monthly_fee` via `computeEffectiveGestorFee`.

### 2.2 Multi-Employee Team Model (0 to 12 Staff, Backward-Compatible `EmployeeState`)

To avoid dual-source-of-truth bugs while maintaining 100% compatibility with Dani/Laura character identity and all 300 existing YAML events (`hire_employee`, `dismiss_employee`, `has_employee`, `employee_satisfaction`), extend `EmployeeState` in place:

```ts
export interface EmployeeState {
  character_id: string;        // Named team lead ("empleado_junior_dani" | "empleada_senior_laura")
  role_label: string;          // Lead role label (or team descriptor)
  headcount: number;           // Integer 1..12; total active staff on payroll (including lead)
  lead_monthly_cost: number;   // Lead's individual monthly employer cost (salary + SS)
  monthly_cost: number;        // Authoritative total monthly payroll (lead + extra staff, deductible)
  billing_multiplier: number;  // Lead's base multiplier (Dani 1.58, Laura 2.05)
  satisfaction: number;        // 0..100 average team morale / satisfaction
  months_employed: number;     // Total months with active staff
}
```

Pure helper: `export function getTeamHeadcount(state: Pick<GameState, "employee">): number { return state.employee ? Math.max(1, state.employee.headcount ?? 1) : 0; }`

#### Effect Primitive Semantics (`src/engine/effects.ts`)
1. **`hire_employee: { character_id }`** *(Existing v1 primitive — preserved)*:
   - Initializes `state.employee` with `headcount: 1`, `lead_monthly_cost: charDef.employee_params.monthly_cost`, `monthly_cost: charDef.employee_params.monthly_cost`, `billing_multiplier: charDef.employee_params.billing_multiplier`, `satisfaction: 75`, `months_employed: 0`.
2. **`expand_team: { count, avg_monthly_cost?, lead_character_id?, role_label? }`** *(New v2 primitive)*:
   - Reads `maxCap = Math.min(12, getBusinessTierConfig(state, catalog).max_team_size)`.
   - Default `unitCost = spec.avg_monthly_cost ?? balance.team_scaling.default_staff_monthly_cost` (`1,850 €/mo`).
   - If `state.employee === null`:
     - Resolves lead character `leadId = spec.lead_character_id ?? "empleado_junior_dani"`.
     - Computes `effectiveTotal = Math.min(spec.count, maxCap)`. If `effectiveTotal <= 0`, no-op.
     - Sets `headcount = effectiveTotal`, `lead_monthly_cost = leadDef.employee_params.monthly_cost`, `monthly_cost = leadCost + (effectiveTotal - 1) * unitCost`, `satisfaction = 75`, `months_employed = 0`.
   - If `state.employee !== null`:
     - Optional lead upgrade: if `spec.lead_character_id` is supplied and differs from current `character_id`, swaps lead character/multiplier and adjusts `monthly_cost` by `newLeadCost - oldLeadCost`.
     - Computes `added = Math.max(0, Math.min(spec.count, maxCap - state.employee.headcount))`.
     - Increments `headcount += added` and `monthly_cost += added * unitCost`.
3. **`shrink_team: { count, severance_per_person, dismiss_all? }`** *(New v2 primitive)*:
   - No-op if `state.employee === null`.
   - `removed = spec.dismiss_all ? state.employee.headcount : Math.min(spec.count, state.employee.headcount)`.
   - Deducts `totalSeverance = Math.round(removed * spec.severance_per_person)` from `money` (and adds to `annualExpenses`; scaled if `event.scale_with_tier` is true).
   - If `state.employee.headcount - removed <= 0`: sets `state.employee = null`.
   - Else: reduces `headcount` by `removed`, subtracts `removed * avgNonLeadCost` from `monthly_cost` (clamped `>= lead_monthly_cost`), and applies `-6` team satisfaction (layoff shock, unless overridden by explicit `employee_satisfaction` delta).
4. **`dismiss_employee: { severance_cost }`** *(Existing v1 primitive — multi-staff safe)*:
   - Deducts `severance_cost` from `money` and adds to `annualExpenses`.
   - If `headcount <= 1`: sets `state.employee = null` (100% identical to v1).
   - If `headcount > 1`: removes `1` person (prevents legacy single-employee events from wiping an 8-person agency!), subtracts average non-lead monthly cost `Math.round((monthly_cost - lead_monthly_cost) / (headcount - 1))` from `monthly_cost`, and applies `-5` `satisfaction`.

#### Team Billing Curve & Management Overhead (`src/engine/economy.ts`)
Let $\text{satScale} = 0.4 + 0.8 \times \frac{\text{clampStat}(\text{satisfaction})}{100}$ (`75 -> 1.00`, `100 -> 1.20`, `25 -> 0.60`):
- For `headcount === 1`:
  $$\text{teamMultiplier} = 1 + (\text{lead.billing\_multiplier} - 1) \times \text{satScale}$$
  *(Exact v1 identity.)*
- For `headcount >= 2` (`extraCount = headcount - 1`):
  $$\text{extraBoost} = \sum_{j=0}^{\text{extraCount}-1} b_{\text{seat}} \cdot d^{j}, \qquad b_{\text{seat}} = 0.78,\; d = 0.95$$
  $$\text{teamMultiplier} = 1 + \big((\text{lead.billing\_multiplier} - 1) + \text{extraBoost}\big) \times \text{satScale}$$
- **Management Stress Overhead** (applied in `applyRecurringMonthEconomy` as part of `passiveStressDelta`):
  - `headcount` `2–3`: `+1` stress/mo
  - `headcount` `4–6`: `+2` stress/mo
  - `headcount` `7–12`: `+3` stress/mo
  - Mitigated by `-1` stress/mo (floored at `0`) when `state.employee.character_id === "empleada_senior_laura"` AND `state.employee.satisfaction >= 72` (rewarding senior delegation!).
  - When `headcount >= 4` and `stress >= 62`, `personal_life` takes an additional `-1/mo` management-drain tick.

---

## 3. Economy, Progressive Taxes, Scale-Aware Stakes & 3-Act Difficulty Curve

### 3.1 Progressive IRPF + RETA (Autónomos) vs. Impuesto de Sociedades (S.L. / Agencia)

Replace flat `310 €` RETA and flat `28%` tax with a realistic Spanish fiscal crossover that turns incorporation into a genuine strategic inflection point around `~4,800–5,500 €/mo` net profit:

1. **Social Security Quota (`computeMonthlySocialSecurityQuota`)** *(Tax-deductible)*:
   - **Autónomo Tiers (`solo_autonomo`, `estudio_consolidado`) — *Cotización por Ingresos Reales* (`reta_brackets`)**, evaluated on pre-quota monthly net profit `preQuotaProfit = Math.max(0, grossBilling - structuralOverhead - gestorFee - payrollCost - Math.max(0, modifierExpenseDelta))`:
     - `< 2,200 €/mo` -> **`294 €/mo`**
     - `2,200 – 2,999 €/mo` -> **`350 €/mo`**
     - `3,000 – 4,199 €/mo` -> **`420 €/mo`**
     - `4,200 – 5,799 €/mo` -> **`510 €/mo`**
     - `>= 5,800 €/mo` -> **`590 €/mo`**
   - **Corporate Tiers (`sociedad_limitada`, `agencia_consultora`) — *Autónomo Societario***:
     - `sociedad_limitada`: fixed **`460 €/mo`**
     - `agencia_consultora`: fixed **`520 €/mo`**

2. **Monthly Deductible Expenses (`computeMonthlyDeductibleExpenses`)**:
   $$\text{deductible} = \text{socialSecurityQuota} + \text{structuralOverhead} + \text{effectiveGestorFee} + \text{payrollCost} + \max(0,\; \Delta_{\text{modExpense}})$$

3. **Progressive IRPF vs. Impuesto de Sociedades (`computeMonthlyTaxBreakdown`)**:
   Let $\text{taxableProfit} = \max(0,\; \text{grossBilling} - \text{deductible})$.
   - **Autónomo Tiers (`corporate_tax_regime: false`) — Marginal `irpf_brackets`** *(smooth marginal slices; earning +1 € never yields lower net cash)*:
     - Slice `0 – 1,500 €/mo`: **`22%`**
     - Slice `1,500 – 3,000 €/mo`: **`30%`**
     - Slice `3,000 – 5,000 €/mo`: **`37%`**
     - Slice `> 5,000 €/mo`: **`44%`**
   - **Corporate Tiers (`corporate_tax_regime: true`) — Impuesto de Sociedades**:
     - Flat **`24%`** (`corporate_tax_rate: 0.24`) on `taxableProfit`.
   - **Consistent Tax Shield Reporting**:
     - `grossTaxWithoutDeductions` = tax computed on `grossBilling` alone.
     - `netTaxAccrued` = tax computed on `max(0, grossBilling - deductible)`.
     - `taxShieldOnExpenses = Math.max(0, grossTaxWithoutDeductions - netTaxAccrued)`.
     - Identity `grossTaxWithoutDeductions - taxShieldOnExpenses === netTaxAccrued` holds unconditionally.
   - **Event `billed_income`, `deductible_expense`, and Maturing `pending_invoices`**:
     - Use pure `computeMarginalTaxRate(state, catalog)`: returns `corporate_tax_rate` (`0.24`) for corporate tiers, or the player's current marginal `irpf_brackets` rate (`0.22 / 0.30 / 0.37 / 0.44`) for autonomous tiers (falling back to `balance.effective_quarterly_tax_rate` when `irpf_brackets` is omitted in minimal unit-test fixtures).

### 3.2 3-Act Difficulty Escalation (`act_difficulty`)

| Act | Months | Living Cost Growth (`/elapsed yr`) | Market Rate Squeeze (`act_market_squeeze`) | Complexity Stress | Strategic Pressure |
|---|---|---|---|---:|---|
| **Act I: Survival** | `1–36` (Y1–Y3) | `+75 €/mo/yr` | `1.00x` | `+0` | First Trimestres, Self vs Paco vs Elena, building cash buffer & reputation. |
| **Act II: Tax & Margin Squeeze** | `37–72` (Y4–Y6) | `+110 €/mo/yr` | `0.94x` | `+0` | Inflation + progressive IRPF/RETA + rate erosion squeeze coasting solo players; forces Boutique Solo (`rep >= 68`), Studio/S.L. upgrade, or grey-zone plays. |
| **Act III: Scale & Macro Volatility** | `73–120` (Y7–Y10) | `+145 €/mo/yr` *(tapers `0.5x` post-M120 Endless)* | `0.88x` | `+1/mo` *(unless `personal_life >= 70`)* | High fixed burn, macro/AI/recession shocks, payroll & labor inspections, 10k–45k € tenders, race to Month 120 or `250,000 €`. |

Living cost formula (`base_living_cost: 1440`):
$$\text{livingCost}(m) = 1440 + \sum_{y=1}^{\lfloor (m-1)/12 \rfloor} g(y), \quad g(y) = \begin{cases} 75 & y \le 3 \\ 110 & 4 \le y \le 6 \\ 145 & 7 \le y \le 9 \\ 72 & y \ge 10 \end{cases}$$

#### Verified Monthly Baseline Cashflow Reference (Before Event Gigs)

| Archetype Snapshot | Month | Gross Billing | Deductible Overhead | SS Quota | Monthly Tax | Living + Family | Baseline Net/mo |
|---|---:|---:|---:|---:|---:|---:|---:|
| Y1 Solo Start (Self, rep 35) | 1 | `2,137 €` | `294 €` | `294 €` | `433 €` | `1,440 €` | **`-30 €`** |
| Y3 Solo Elena (rep 60, partner) | 30 | `2,388 €` | `610 €` | `350 €` | `413 €` | `1,770 €` | **`-405 €`** |
| Y6 Coasting Solo Elena (rep 62, 1 child) | 66 | `2,251 €` | `610 €` | `350 €` | `372 €` | `2,345 €` | **`-1,076 €`** |
| Y4 Premature S.L. (0 staff, rep 55) | 42 | `2,957 €` | `1,527 €` | `460 €` | `343 €` | `1,845 €` | **`-758 €`** |
| Y6 Boutique Solo (`estudio`, rep 85) | 66 | `3,962 €` | `1,051 €` | `420 €` | `754 €` | `2,345 €` | **`-188 €`** |
| Y8 Boutique Solo (`S.L.U.`, rep 92) | 90 | `4,615 €` | `1,527 €` | `460 €` | `741 €` | `2,600 €` | **`-253 €`** |
| Y5 Studio (2 staff, Laura lead, sat 75) | 54 | `8,103 €` | `5,001 €` | `420 €` | `818 €` | `2,235 €` | **`+49 €`** |
| Y6 S.L. (4 staff, sat 75, rep 75) | 66 | `13,983 €` | `9,177 €` | `460 €` | `1,153 €` | `2,345 €` | **`+1,308 €`** |
| Y8 Agency (8 staff, sat 75, rep 82) | 90 | `23,707 €` | `17,548 €` | `520 €` | `1,478 €` | `2,600 €` | **`+2,081 €`** |
| **Y8 Agency Crisis (8 staff, sat 40, rep 70)** | 90 | `16,124 €` | `17,548 €` | `520 €` | `0 €` | `2,600 €` | **`-4,024 €`** |
| Y9 Agency (10 staff, sat 80, rep 88) | 102 | `29,429 €` | `21,248 €` | `520 €` | `1,963 €` | `2,745 €` | **`+3,473 €`** |

*Takeaway*: Coasting solo runs bleed slowly in Acts II–III unless actively hustling or evolving (driving `ConservativeLegalBot` straight into the **45%–55%** survival band), premature S.L. punishes you immediately, Boutique Senior Solo is lean and viable (+ high-rep retainers), and an 8–10 person Agency unlocks genuine `250,000 €` reach while sitting one morale/account crisis away from `-4,000 €/mo` insolvency.

### 3.3 Scale-Aware Event Stakes (`scale_with_tier`)

High-tier runs (`sociedad_limitada`, `agencia_consultora`) receive realistic `10k–45k €` contracts and `10k–30k €` crises through **two complementary mechanisms**:
1. **Bespoke Tier-Gated Events**: New v2 events gated via `requirements.business_tiers: ["sociedad_limitada", "agencia_consultora"]` authored directly with 10k–45k € copy and effects.
2. **Opt-In `scale_with_tier: true` on `EventSchema`** *(defaults to `false`; zero impact on untouched v1 events)*:
   - Pure helper `scaleMonetaryValue(amount: number, multiplier: number): number`:
     - If `multiplier === 1` or `amount === 0`, returns `Math.round(amount)`.
     - Scales `raw = amount * multiplier`; rounds to nearest `50 €` when `Math.abs(raw) >= 200`, else nearest `10 €`.
   - When `event.scale_with_tier === true`, `resolveChoiceEffects` AND `evaluateRequirements` (for `stats.money` on choices) AND UI stake preview helper `getEffectiveScaledChoiceEffects(state, catalog, event, effects)` scale:
     - `billed_income`, `cash_delta`, `deductible_expense`, `deferred_invoice.amount`, `add_modifier.monthly_billed_delta`, `add_modifier.monthly_expense_delta`, `dismiss_employee.severance_cost`, `shrink_team.severance_per_person`, and choice `requirements.stats.money.{min, max}`.
   - **Text-vs-Math Guardrail (`scripts/validate-content.ts`)**: Any event with `scale_with_tier: true` MUST NOT embed literal `€` amounts inside `title`, `body`, or `choices[].label` (prose stays qualitative; `EventStage` stake chips display the exact scaled `€` amount dynamically!).

---

## 4. Gestor Rebalance & "En B" Risk-Reward Economy

### 4.1 Gestor Tiers & Tier-Scaled Fees (`computeEffectiveGestorFee`)

Effective fee is always `Math.round(balance.gestor_tiers[tier].monthly_fee * business_tiers[business.tier].gestor_fee_multiplier)`.

| Tier | Solo Fee | Estudio (`1.35x`) | S.L. (`1.95x`) | Agencia (`2.80x`) | `inspection_shield` | `quarterly_error_prob` | Base Error Surcharge *(scales by `event_stakes_multiplier`)* | Error Stress | Identity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `self` | `0 €` | `0 €` | *(Compliance penalty: `+450 €/q` + `35%` error)* | *(Compliance penalty: `+450 €/q` + `35%` error)* | `0.00` | `0.26` | `260 €` | `8` | Early survival gamble; untenable once incorporated. |
| `cheap` (Paco) | `85 €` | `115 €` | `165 €` | `240 €` | `0.22` | `0.11` | `160 €` | `4` | **Grey-Zone Niche**: Affordable, never drops you for high `fiscal_risk`, tolerates aggressive deductions & "en B" survival plays. |
| `premium` (Elena) | `260 €` | `350 €` | `505 €` | `730 €` | `0.50` *(down from 0.72)* | `0.02` | `90 €` | `2` | **Legal Corporate Shield with Compliance Teeth**: Heavy early burn, strong but non-invincible `50%` shield, unlocks S.L. & clean tenders, **refuses clients who abuse "en B"**. |

#### Elena Compliance Friction (Quarterly Check in `prepareQuarterlyTax`)
When `state.gestor.tier === "premium"`:
- If `state.fiscal_risk >= 65` (`gestor_compliance.premium_drop_fiscal_risk`):
  - Elena **terminates the engagement** (`gestor` reverts to `"self"`, `monthly_fee = 0`, `inspection_shield = 0`, sets `flags.elena_rescision_cumplimiento = true`, applies `-8` `reputation` and `+10` `stress`, records `report.elena_compliance_event = "dropped"`).
- Else if `state.fiscal_risk >= 45` (`gestor_compliance.premium_warning_fiscal_risk`):
  - Sets `flags.elena_aviso_cumplimiento = true`, applies `+4` `stress`, records `report.elena_compliance_event = "warning"`.
- Else if `state.fiscal_risk < 30` and `flags.elena_aviso_cumplimiento`:
  - Clears `flags.elena_aviso_cumplimiento`.

*(Content-side complement: `content-fixer` rebalances Elena's 17 events so they require investment/compliance trade-offs rather than handing out free net cash.)*

### 4.2 "En B" Risk-Reward & Spain's 4-Year *Prescripción Fiscal*

1. **Remove Unfair Passive Moral Drain (`src/engine/economy.ts`)**:
   - Delete the v1 `-3` moral/mo (`fiscal_risk >= 35`) and `-5` moral/mo (`fiscal_risk >= 60`) penalties.
   - Replace with realistic high-exposure paranoia only:
     - `fiscal_risk < 65`: **`0` passive moral/stress penalty**.
     - `65 <= fiscal_risk < 85`: `-1 moral/mo` and `+1 stress/mo`.
     - `fiscal_risk >= 85`: `-2 moral/mo` and `+2 stress/mo`.
   - Raise the low-moral death-spiral `fiscal_risk` trigger from `28` to `70`.
   - Raise `inspection_curve.quarterly_natural_risk_decay` from `3` to `4` (active radar cools down over clean quarters, while long-term liability moves into the 4-year ledger below).

2. **4-Year *Prescripción Fiscal* Delayed Audit Ledger (`FinanceState.historical_exposures`)**:
   ```ts
   export interface FiscalExposureEntry {
     id: string;
     origin_month: number;
     expires_month: number;   // origin_month + 48 (Ley General Tributaria Art. 66)
     risk_points: number;     // >= 10
     untaxed_amount: number;  // Positive untaxed cash_delta (€), 0 if pure deduction offense
     source_event_id: string;
     audited: boolean;
   }
   ```
   - **Recording (`resolveChoiceEffects`)**: Whenever an effect applies `fiscal_risk_delta >= 10` (or `fiscal_risk_delta >= 6` with untaxed `cash_delta >= 1000`), append a `FiscalExposureEntry` (`expires_month = state.month + 48`).
   - **Prescription Expiry (`applyRecurringMonthEconomy`)**: Prune any entry where `state.month >= entry.expires_month`; if at least one non-audited entry expires cleanly, set `flags.ejercicio_prescrito_limpio = true` (feeds the new *Ejercicio Prescrito* achievement!).
   - **Quarterly Historical Audit Roll (`prepareQuarterlyTax`)**:
     - Filter `eligible = historical_exposures.filter(e => !e.audited && age >= 14 && age <= 42)` where `age = state.month - e.origin_month`.
     - If `eligible.length > 0` and no immediate inspection triggered this quarter:
       - `dormantRisk = Math.min(100, eligible.reduce((s, e) => s + e.risk_points, 0))`
       - `rawProb = Math.min(0.32, 0.03 + 0.0035 * dormantRisk)`
       - `effectiveProb = rawProb * (1 - state.gestor.inspection_shield * 0.65)` *(Elena mitigates at most 65% of her shield on hidden historical offenses!)*
       - Roll seeded PRNG: on trigger, mark the highest-`risk_points` eligible entry `audited = true`, set `flags.auditoria_ejercicio_anterior = true`, set `report.historical_audit_triggered = true`, and enqueue a `tags: ["prescripcion_fiscal"]` Hacienda audit event via `selectHistoricalAuditEvent(tempState, catalog)` at `month + 1` with `priority: "high"` and `source_event_id: "historical_audit"` (or apply fallback back-tax fine `Math.max(600, Math.round(entry.untaxed_amount * 0.45 + entry.risk_points * 18))` if none are eligible).

---

## 5. Reactive Partner Pressure & Long-Horizon Consequences

### 5.1 Partner Neglect Tracker & Positive Synergies

Extend `FamilyState`:
```ts
export interface FamilyState {
  status: "single" | "dating" | "cohabiting" | "separated";
  partner_character_id: string | null;
  partner_name?: string;
  children_count: number;
  monthly_cost: number;
  support_modifier: number;
  neglect_months: number; // Consecutive/accumulated strain counter while partnered
}
```

- **Monthly Update (`applyRecurringMonthEconomy`)**:
  - When `family.status === "dating" || family.status === "cohabiting"`:
    - If `personal_life <= 38` OR (`stress >= 78` AND `personal_life <= 50`): `neglect_months += 1`.
    - Else if `personal_life >= 58`: `neglect_months = Math.max(0, neglect_months - 1)`.
    - **Dynamic `support_modifier` Gating**:
      - `personal_life <= 38`: `support_modifier` is **suspended** (`0`) AND home friction adds `+1` passive stress/mo.
      - `personal_life >= 70`: full `support_modifier` applies PLUS an extra `-1` passive stress relief (partner synergy!).
    - **Crisis Escalation**: When `neglect_months >= 4`, set `flags.crisis_pareja_latente = true`. Clearing requires restoring `personal_life >= 62` for 2 consecutive months (`neglect_months === 0`) or resolving a partner-repair event.
  - When `single` or `separated`: `neglect_months = 0`.

### 5.2 Contextual Selector Weighting (`computeEffectiveEventWeight` in `selector.ts`)

Pure, data-driven contextual multipliers stacked cleanly on top of novelty decay (`weight / (1 + k * seen) ** 1.35`):

| Condition | Target Event Match | Weight Multiplier |
|---|---|---:|
| Partnered AND (`personal_life <= 25` OR `neglect_months >= 5`) | `category === "familia"` AND (`character_id === "pareja_alex"` OR tag in `["crisis_pareja", "pareja_ultimatum"]`) | **`4.5x`** |
| Partnered AND (`personal_life <= 38` OR `neglect_months >= 3`) | `category === "familia"` AND (`character_id === "pareja_alex"` OR tag in `["crisis_pareja", "pareja"]`) | **`2.8x`** |
| Partnered AND `personal_life >= 70` | `category === "familia"` AND tag in `["sinergia_pareja", "red_pareja"]` | **`2.0x`** |
| `business.tier` in `["sociedad_limitada", "agencia_consultora"]` | Event explicitly defines `requirements.business_tiers` including `state.business.tier` | **`1.8x`** |

### 5.3 Long-Horizon `scheduled_queue` Resilience (6–48 Months)

Extend `ScheduledEvent`:
```ts
export interface ScheduledEvent {
  queue_id: string;
  event_id: string;
  trigger_month: number;
  source_event_id: string;
  origin_month?: number;
  priority?: "normal" | "high";
  deferred_months?: number;
}
```
- **Long-Horizon Deferral Window**: Entries whose scheduled horizon `trigger_month - (origin_month ?? trigger_month) >= 12` (or `priority === "high"`) defer up to **`12` months** (`maxDefer = 12`) if temporarily ineligible on `trigger_month`; short-term edges retain `maxDefer = 6`.
- **Priority Ordering**: `drawTurnEvents` evaluates due entries (`trigger_month <= state.month`) sorted by `priority === "high"` first, then `trigger_month ASC`, then FIFO insertion order.
- **Deduplication**: `enqueueScheduledEvent` skips inserting a duplicate `event_id` if an identical `event_id` is already queued within `±6` months (prevents duplicate audit pile-ups while still allowing distinct distant follow-ups).
- **Historical Audit Bypass**: Just like `source_event_id === "quarterly_inspection"`, `source_event_id === "historical_audit"` satisfies `requirements.stats.fiscal_risk.min` during Slot 1 draw so a 30-month-delayed audit fires reliably even if current short-term `fiscal_risk` has decayed!

---

## 6. Expanded Schema Contract (`src/engine/schemas/`)

All YAML schemas remain at `schema_version: 1` with **strictly optional additive fields**, ensuring 100% of existing 300 YAML files validate without breaking changes. After editing Zod schemas, `engine-dev` MUST run `pnpm schema:emit` to regenerate `schemas/*.schema.json`.

### 6.1 `src/engine/schemas/event.ts`

```ts
export const BusinessTierSchema = z.enum([
  "solo_autonomo",
  "estudio_consolidado",
  "sociedad_limitada",
  "agencia_consultora",
]);

export const SchedulePrioritySchema = z.enum(["normal", "high"]);

export const SetBusinessTierSpecSchema = z
  .object({
    tier: BusinessTierSchema,
  })
  .strict();

export const ExpandTeamSpecSchema = z
  .object({
    count: z.number().int().min(1).max(6),
    avg_monthly_cost: z.number().int().min(800).max(6000).optional(),
    lead_character_id: SnakeCaseIdSchema.optional(),
    role_label: z.string().min(1).optional(),
  })
  .strict();

export const ShrinkTeamSpecSchema = z
  .object({
    count: z.number().int().min(1).max(12),
    severance_per_person: z.number().int().min(0),
    dismiss_all: z.boolean().optional(),
  })
  .strict();
```

- **`RequirementsSpecSchema` additions** *(all `.nullable().optional()`)*:
  - `business_tiers: z.array(BusinessTierSchema).min(1).nullable().optional()`
  - `team_size: StatRangeSchema.nullable().optional()` *(checks `getTeamHeadcount(state)`)*
  - `children_count: StatRangeSchema.nullable().optional()` *(checks `state.family.children_count`)*
  - Update `hasActiveRequirements(req)` to return `true` whenever any of `business_tiers`, `team_size`, or `children_count` is active (enforcing anti-softlock across all new RPG/tier/team gates!).
- **`ScheduleEventSpecSchema` addition**:
  - `priority: SchedulePrioritySchema.optional()`
- **`EffectsSpecSchema` additions**:
  - `set_business_tier: SetBusinessTierSpecSchema.optional()`
  - `expand_team: ExpandTeamSpecSchema.optional()`
  - `shrink_team: ShrinkTeamSpecSchema.optional()`
- **`EventSchema` addition**:
  - `scale_with_tier: z.boolean().optional()`
- **`ChoiceOutcomeSummary` (`src/engine/types.ts`) additions**:
  - `business_tier_changed_to?: BusinessTier | null`
  - `team_headcount_delta?: number`
- **`QuarterlyReport` (`src/engine/types.ts`) additions**:
  - `sl_self_penalty?: number`
  - `elena_compliance_event?: "warning" | "dropped" | null`
  - `historical_audit_triggered?: boolean`

### 6.2 `src/engine/schemas/balance.ts`

Add the following `.optional()` v2 config blocks to `BalanceConfigSchema` (fully populated in `content/config/balance.yaml`; engine exports authoritative fallback defaults when omitted in legacy unit-test fixtures):

- `corporate_tax_rate`: `z.number().min(0).max(1).optional()` (`0.24`)
- `business_tiers`: `z.object({ solo_autonomo, estudio_consolidado, sociedad_limitada, agencia_consultora }).strict().optional()`, each using `BusinessTierBalanceSchema` (`billing_multiplier`, `event_stakes_multiplier`, `monthly_structural_overhead`, `gestor_fee_multiplier`, `max_team_size`, `hard_debt_floor`, `corporate_tax_regime`, `societario_quota?`)
- `reta_brackets`: `z.array(z.object({ max_monthly_profit: z.number().nullable(), monthly_quota: z.number().int().min(0) }).strict()).min(1).optional()`
- `irpf_brackets`: `z.array(z.object({ up_to_monthly_profit: z.number().nullable(), marginal_rate: z.number().min(0).max(1) }).strict()).min(1).optional()`
- `team_scaling`: `TeamScalingBalanceSchema.optional()` (`default_staff_monthly_cost: 1850`, `base_additional_seat_multiplier: 0.78`, `seat_diminishing_factor: 0.95`, `boutique_solo_min_reputation: 68`, `boutique_solo_min_month: 30`, `boutique_solo_max_bonus: 0.50`)
- `act_difficulty`: `ActDifficultySchema.optional()` (`act2_start_month: 37`, `act3_start_month: 73`, `act1_living_cost_growth: 75`, `act2_living_cost_growth: 110`, `act3_living_cost_growth: 145`, `act2_market_squeeze: 0.94`, `act3_market_squeeze: 0.88`, `act3_monthly_stress_pressure: 1`)
- `gestor_compliance`: `GestorComplianceSchema.optional()` (`premium_warning_fiscal_risk: 45`, `premium_drop_fiscal_risk: 65`, `sl_self_quarterly_penalty: 450`, `sl_self_error_prob: 0.35`)
- `prescripcion`: `PrescripcionConfigSchema.optional()` (`window_months: 48`, `min_audit_age_months: 14`, `max_audit_age_months: 42`, `min_risk_points_recorded: 10`, `base_quarterly_prob: 0.03`, `prob_per_risk_point: 0.0035`, `max_quarterly_prob: 0.32`, `gestor_shield_effectiveness: 0.65`, `fallback_fine_rate: 0.45`, `fallback_fine_min: 600`)
- `partner_pressure`: `PartnerPressureConfigSchema.optional()` (`neglect_personal_life_threshold: 38`, `synergy_personal_life_threshold: 70`, `crisis_weight_multiplier: 2.8`, `critical_crisis_weight_multiplier: 4.5`, `synergy_weight_multiplier: 2.0`, `tier_event_weight_multiplier: 1.8`)
- Update `content/config/balance.yaml`: `victory_money: 250000`, `ending_quotes.retired_rich` citing `250.000 €`, `base_living_cost: 1440`, updated `gestor_tiers` (`self: 0/0.00/0.26/260/8`, `cheap: 85/0.22/0.11/160/4`, `premium: 260/0.50/0.02/90/2`), and `inspection_curve.quarterly_natural_risk_decay: 4`.

### 6.3 Content Validator & Catalog Test Contracts (`scripts/validate-content.ts`)

1. Validate `expand_team.lead_character_id` (if set) references an existing character with `role: "empleado"`.
2. Allow `hire_employee` when event or choice specifies `has_employee: false` OR `team_size.max === 0`.
3. When `event.scale_with_tier === true`, fail validation if `event.title`, `event.body`, or any `choice.label` contains a literal `€` symbol (prevents stale numbers diverging from tier-scaled effects).
4. **Authoring Reference — Valid Character Expressions** *(enforced by `tests/content/content.test.ts`)*:
   - `cliente_corporativo_marta`: `neutral | angry`
   - `empleada_senior_laura`: `neutral | stressed`
   - `cliente_regateador`, `hacienda_inspector_gomez`: `neutral | angry | pleased`
   - `gestor_barato_paco`, `gestor_premium_elena`, `pareja_alex`, `empleado_junior_dani`: `neutral | stressed | pleased`
5. **Authoring Reference — Modifier & Locale Parity**: Every `add_modifier` across new events MUST be registered in `MODIFIER_LABELS_BY_ID_EN` and `MODIFIER_LABELS_EN` (`src/services/i18n/resolveEventText.ts`), and `lateGameRepeatableEvents` (`min_month >= 60`, `max_occurrences: null`, `weight > 0`) MUST remain `>= 25` (keeping the 4 core veteran repeatable events uncapped).

---

## 7. Save Migration (`save_version: 1 → 2`) & Victory Badge (`250k €`) Strategy

### 7.1 Canonical v2 Victory & Achievement IDs with Lossless Legacy Migration

- **`VictoryBadge`** (`src/engine/types.ts`): `"hero_120m" | "rich_250k"`
- **`RunMilestoneId`** (`src/services/analytics/umamiAnalytics.ts`): `"year_1" | "year_3" | "year_5" | "year_10_hero" | "rich_250k"` *(cleanly separates v2 250k milestones from historical v1 150k analytics data without breaking existing dashboards)*.
- **`AchievementId`** (`src/services/storage/StoragePort.ts`): Rename `"ricachon_150k"` → **`"ricachon_250k"`** (`CAJA-250K`, evaluated dynamically against `victoryMoney` defaulting to `250_000`) and add **3 v2 progression seals** (15 → **18** total seals):
  - `sociedad_limitada` (`MOD-200`): Constitute a Sociedad Limitada (`business.tier === "sociedad_limitada" || business.tier === "agencia_consultora"`).
  - `agencia_consolidada` (`TGSS-05`): Lead a team of 5+ people on payroll (`getTeamHeadcount(state) >= 5`).
  - `ejercicio_prescrito` (`LGT-48M`): Have a past risky fiscal exercise prescribe cleanly after 4 years (`Boolean(state.flags.ejercicio_prescrito_limpio)`).

### 7.2 Deterministic `v1 → v2` Migration (`src/services/storage/migrations.ts`)

- Bump `CURRENT_SAVE_VERSION = 2 as const`, `GameState.schema_version = 2`, and `ENGINE_BUILD = "2.0.0"`.
- Add legacy normalization maps:
  - `LEGACY_VICTORY_BADGE_MAP = { rich_150k: "rich_250k" }`
  - `LEGACY_ACHIEVEMENT_KEY_MAP = { aplazamiento_Solicitado: "aplazamiento_solicitado", ricachon_150k: "ricachon_250k" }`
- Implement pure `migrateGameStateV1ToV2(rawState)`:
  1. Sets `schema_version: 2`.
  2. Infers `business: BusinessState`:
     - `flags.sociedad_limitada_activa` → `{ tier: "sociedad_limitada", months_in_tier: 0, sl_formed_month: Math.max(1, month - 1) }`
     - Else if `flags.estudio_calle_alquilado || flags.estudio_propio_activo || (employee != null && month >= 24)` → `{ tier: "estudio_consolidado", months_in_tier: 0, sl_formed_month: null }`
     - Else → `{ tier: "solo_autonomo", months_in_tier: 0, sl_formed_month: null }`
  3. Backfills `employee` (when non-null): `headcount: employee.headcount ?? 1`, `lead_monthly_cost: employee.lead_monthly_cost ?? employee.monthly_cost`.
  4. Backfills `family.neglect_months = family.neglect_months ?? 0`.
  5. Backfills `finances.historical_exposures = finances.historical_exposures ?? []`.
  6. Maps `earned_victories`, `pending_victory_badge`, and `victory_unlocked` history summaries via `LEGACY_VICTORY_BADGE_MAP` (deduplicated).
  7. Backfills `scheduled_queue` items with `origin_month ?? Math.max(1, trigger_month - 2)` and `priority ?? "normal"`.
- **`SAVE_MIGRATIONS[1]` Critical Invariant**: Apply `migrateGameStateV1ToV2` not only to `envelope.state`, **but also to `envelope.pending_turn.outcome_preview_state` and `envelope.pending_turn.queued_final_state`** when present so an active v1 save suspended on an outcome panel migrates cleanly without dropping `pending_turn`!
- **`migrateProfileEnvelope()`**: Normalizes `achievements` keys via `LEGACY_ACHIEVEMENT_KEY_MAP` and maps every `hall_of_fame[i].earned_victories` entry via `LEGACY_VICTORY_BADGE_MAP`, preserving all past player unlocks and Hall of Fame entries with zero data loss.
- **`src/store/gameStore.ts` Fast-Pacing Guard**: Update `tryAutoSettleQuarterlyTax` so Fast Pacing NEVER auto-settles a quarter when `report.inspection_triggered || report.historical_audit_triggered || report.elena_compliance_event != null || (report.sl_self_penalty ?? 0) > 0`, and scales `FAST_PACING_AUTO_SETTLE_MIN_BUFFER` by `tier.event_stakes_multiplier` (`1,200 €` Solo → `3,840 €` Agencia).

---

## 8. UI/UX Impact & Zero-Scroll Ergonomics Plan

Every UI update MUST preserve `AGENTS.md` §4 UX invariants:
- **Zero Desktop Yo-Yo Scroll** (`1366×768` & `1440×900`): `scrollHeight <= innerHeight + 2` at `scrollY === 0` across active turn loop, outcome panel, modals, `TitleScreen`, and `EndRunScreen`.
- **Zero-Scroll Mobile Decision Stage** (`360×780`, `390×844`): pure `Despacho` card + choices fit cleanly with `>= 48px` tap targets, `>= 6px` gaps, zero occlusion (`document.elementFromPoint`), and zero silent text truncation.

### Component-by-Component Specification

1. **`IndicatorBar.tsx` (Zero Extra Vertical Height)**:
   - Never add a 3rd row. Render a compact inline **Business Tier Pill** (`data-testid="indicator-business-tier"`) inside the existing `indicator-calendar` pill:
     - `>= 640px`: `Autónomo` / `Estudio` / `S.L.` / `Agencia` (or `Boutique` when `isBoutiqueSeniorSolo`).
     - `< 480px`: hidden or 3-char compact code (`S.L.` / `AGE` only once upgraded past `solo_autonomo`) so Row 1 stays strictly single-line (`<= 100px` total HUD height).

2. **`EventStage.tsx` (RPG Stat-Check Chips, Tier-Scaled Stakes & v2 Outcome Pills)**:
   - **Unlocked RPG Check Pills (`data-testid="choice-rpg-unlock-${index}"`)**: When an eligible choice has non-money `requirements` (`stats.{reputation, stress, moral, personal_life, fiscal_risk}`, `business_tiers`, `team_size`, `gestor_tiers`, `family_statuses`, `employee_satisfaction`), render a compact archival badge inside the existing `choice-stakes-${index}` flex-wrap row (e.g., `✓ Rep ≥ 65`, `✓ Vida ≥ 70`, `✓ S.L.`, `✓ Equipo ≥ 3`, `✓ Estrés ≤ 40`).
   - Cap total chips per choice button to **`4`** (priority order: RPG unlock pill → scaled cash/retainer pill → risk/strain pill → uncertainty dice badge) so choice buttons never expand vertically past the Zero-Scroll budget.
   - **Exact Tier-Scaled Preview**: `buildDeterministicStakeChips` calls pure `getEffectiveScaledChoiceEffects(state, catalog, event, effects)` so preview Euro chips match exact resolved Euro deltas.
   - **Locked RPG Reasons**: Extend `explainChoiceLockReasons()` (`src/services/i18n/resolveEventText.ts`) to format `business_tiers`, `team_size`, and `children_count` in ES & EN, and update `has_employee: false` copy to `"Solo sin empleados en plantilla"` / `"Only available while solo (0 staff)"`.
   - **Outcome Panel Pills**: Render `DeltaPill` badges for `set_business_tier` (new structure tier), `expand_team` (`+N plantilla · -X €/m`), and `shrink_team` (`-N plantilla · indemnización`).

3. **`EntornoPanel.tsx` & `SceneRenderer.tsx`**:
   - **Structure Badge**: Display current `business.tier` and tax regime (`IRPF` vs `Imp. Sociedades`) cleanly in the `Entorno` header stamp.
   - **Partner Row**: Display live partner climate pill when partnered — `"Tensión en casa"` / `"Strain at home"` (`personal_life <= 38` or `neglect_months >= 3`) vs `"Apoyo activo"` / `"Active support"` (`personal_life >= 70`).
   - **Team Row (`data-testid="entorno-team-summary"`)**:
     - `headcount === 0`: `"Sin plantilla"` (plus emerald `"Boutique Sénior"` chip when `isBoutiqueSeniorSolo`).
     - `headcount === 1`: lead name, role, monthly cost, live billing multiplier, and Clima bar (identical height to v1).
     - `headcount >= 2`: `"{headcount} personas · Líder: {leadName}"`, total monthly payroll (`-X €/m · ×Y.YY`), and average team Clima bar.
   - **Scene Backdrop (`resolveDeskBackgroundAsset`)**: Upgrade backdrop to `bg_despacho_estudio` whenever `state.business.tier !== "solo_autonomo"` (in addition to active staff / studio flags), and show tier/headcount status chip.

4. **`CuentasPanel.tsx` (Single Pure Breakdown Helper)**:
   - Consume pure `computeMonthlyEconomyBreakdown(state, catalog)` exported from `src/engine/economy.ts` (zero duplicated tax/expense math in React!).
   - Dynamically display:
     - `"Cuota RETA (tramo)"` vs `"Autónomo societario"`
     - `"Estructura (Estudio / S.L. / Agencia)"` line (only rendered when `structuralOverhead > 0`)
     - `"Nóminas (N pers.)"` when `teamHeadcount > 1`
     - `"Provisión IRPF (~XX%)"` vs `"Imp. Sociedades (24%)"`
   - Inside `cuentas-extras-scroll`, render a compact warning row when `finances.historical_exposures` has unexpired unaudited entries (`"Ejercicios en prescripción AEAT (4 años): N"` / `"Open 4-yr tax audit window: N"`).

5. **`QuarterlyTaxModal.tsx` & `AnnualSummaryModal.tsx`**:
   - `QuarterlyTaxModal`: Show `Modelo 303 / 130` (Autónomo) vs `Modelo 303 / 202 (S.L.)`; display `sl_self_penalty` row when non-zero; render dedicated alert boxes for `elena_compliance_event` (`"warning"` / `"dropped"`) and `historical_audit_triggered` (*"Revisión de ejercicio anterior (prescripción 4 años)"*). Pinned 2-col footer preserved.
   - `AnnualSummaryModal`: Staff card displays `"{headcount} personas"` + total payroll and business tier badge.

6. **`VictoryModal.tsx`, `EndRunScreen.tsx`, `ShareCard`, `LandingScreen.tsx`, `TitleScreen.tsx`, `uiStrings.ts`, `endingMetadata.ts`**:
   - Read `compiledCatalog.balance.victory_money` (`250,000 €`) dynamically across `LandingScreen`, `TitleScreen`, `VictoryModal`, `EndRunScreen`, `endingMetadata.ts`, and `uiStrings.ts` (updating all `150.000 €` / `150,000 €` / `150k` / `15 Sellos` literals to `250.000 €` / `250,000 €` / `250k` / `18 Sellos`).
   - `EndRunShareSummary` & `renderShareCardToCanvas`: include optional `businessTier` & `teamHeadcount` so `BOX [04]` showcases achieved structure (e.g., `"S.L. · 6 personas"` / `"Agencia · 9 pers."` / `"Boutique Sénior"` / `"Autónomo RETA"`), keeping exact `1080×1350` layout geometry.

---

## 9. Simulation & Balance Acceptance Criteria (`tests/simulation/monte-carlo.test.ts`)

Add a 5th bot archetype (`AgencyScaleBot` or evolve `WorkaholicGrowthBot` to actively upgrade `estudio_consolidado` → `sociedad_limitada` → `agencia_consultora` and call `expand_team`) and assert across `1,750+` seeded campaigns:
- **Zero deadlocks, zero NaN/Infinity, bit-exact replay determinism, zero starved months**.
- **`PassiveRejectBot`**: **`0%`** 120-month survival, `>= 85%` bankruptcy.
- **`ConservativeLegalBot`**: **`42%–58%`** CI test window targeting the Human Owner's **`45%–55%`** survival target (down from ~93% in v1!).
- **`AggressiveTaxDodgerBot`**: Viable high-variance path (**`20%–45%`** survival, higher average cash when surviving than v1, triggering both short-term inspections and 14–42 month `historical_audit_triggered` events!).
- **`WorkaholicGrowthBot` (Scaling / S.L. / Agency)**: Highest `avgPeakMonthlyBilling` (`>= 10,000 €/mo`), reaches `sociedad_limitada` / `agencia_consultora` and `headcount >= 4`, achieves **`10%–28%` `rich_250k`** unlock rate, with real late-game insolvency & burnout deaths.
- **`RandomBot`**: `5%–35%` survival with real bankruptcy, burnout, and moral-resignation endings.
- **Event Reachability**: `>= 90%` of compiled v2 catalog events reached across the suite, zero orphan chains, all 4 `BusinessTier` stages reached.

---

## 10. Wave 2–4 File Ownership Split (Zero-Collision Execution Plan)

Downstream workers MUST stay strictly within their assigned write-allowed paths. Notice that English locale overlays for new v2 events use **two dedicated new shards** (`content/locales/en/v2_life_and_long_arcs.yaml` and `content/locales/en/v2_scale_and_agency.yaml`), which `scripts/validate-locales.ts` and `scripts/compile-content.ts` already discover and merge automatically—guaranteeing **zero file overlap** among parallel Wave 3 content workers.

| Wave | Worker | Write-Allowed Paths (Exclusive) | Depends On | Deliverable / Exit Gate |
|---|---|---|---|---|
| **Wave 1** | `architect` *(done)* | `docs/adr/004-v2-scaling-progression-and-depth.md` | — | Complete v2 engineering spec & ADR |
| **Wave 1** | `content-auditor` | `docs/qa/v2-content-blueprint.md` | — | File-by-file audit + new event blueprint |
| **Wave 2** | `engine-dev` | `src/engine/**`, `schemas/*.schema.json` *(via `pnpm schema:emit`)*, `scripts/validate-content.ts`, `src/services/storage/**`, `src/services/achievements/definitions.ts`, `src/services/analytics/umamiAnalytics.ts`, `src/services/endings/endingMetadata.ts`, `src/store/gameStore.ts`, `content/config/balance.yaml` *(initial v2 baseline)*, `ARCHITECTURE.md`, `tests/engine/**`, `tests/services/storage.test.ts`, `tests/services/analytics.test.ts`, `tests/services/gameStore.test.ts` | Wave 1 (`ADR 004`) | Pure TS engine v2, emitted JSON schemas, `v1→v2` migrations, `pnpm schema:check && pnpm typecheck && pnpm vitest run tests/engine tests/services/storage.test.ts tests/services/analytics.test.ts` green |
| **Wave 2/3** | `ui-dev` | `src/components/**`, `src/screens/**`, `src/index.css`, `src/services/i18n/**`, `src/services/share/**`, `src/services/content/catalog.ts`, `tests/services/i18nUi.test.ts`, `tests/services/share.test.ts`, `tests/services/catalog.test.ts`, `tests/ui/**`, `docs/qa/manual-test-plan.md` | Wave 2 (`engine-dev` public exports & types) | Full v2 UI, RPG stat-check chips, multi-staff Entorno, progressive Cuentas, 250k copy/share card, updated `ux-usability.spec.ts` |
| **Wave 3** *(parallel)* | `content-fixer` | **Existing** 300 files in `content/events/*/*.yaml` (amnesia flags, `max_month` caps, Elena rebalance, "en B" EV buffs, 80–100+ RPG stat gates) + **existing** 5 shards `content/locales/en/{clientes,empleados,familia,gestor,hacienda}.yaml` | Wave 1 (`v2-content-blueprint.md`) + Wave 2 (`engine-dev` schemas) | Zero amnesia, rebalanced Elena & "en B", enriched RPG stat checks across existing 300 events |
| **Wave 3** *(parallel)* | `content-writer-life` | **New** event files only in `content/events/familia/*.yaml` and `content/events/hacienda/*.yaml` (partner/family high-stakes + 14–42m prescripción & long-horizon arcs) + **new** shard `content/locales/en/v2_life_and_long_arcs.yaml` | Wave 1 (`v2-content-blueprint.md`) + Wave 2 (`engine-dev` schemas) | ~25–30 new Familia & Hacienda long-arc events + 100% EN parity + list of new modifier/flag IDs for `resolveEventText.ts` |
| **Wave 3** *(parallel)* | `content-writer-scale` | **New** event files only in `content/events/clientes/*.yaml`, `content/events/empleados/*.yaml`, and `content/events/gestor/*.yaml` (S.L., 2–12 staff agency, Boutique Senior Solo, Year 5–10 macro shocks) + **new** shard `content/locales/en/v2_scale_and_agency.yaml` | Wave 1 (`v2-content-blueprint.md`) + Wave 2 (`engine-dev` schemas) | ~25–35 new Clientes, Empleados & Gestor scale events + 100% EN parity + list of new modifier/flag IDs for `resolveEventText.ts` |
| **Wave 4** | `sim-balancer` | `content/config/balance.yaml` *(final tuning)*, `src/services/i18n/resolveEventText.ts` *(sync any Wave 3 new modifier/flag EN labels)*, `tests/content/content.test.ts` *(update v2 catalog counts)*, `tests/simulation/monte-carlo.test.ts`, generated bundles `src/generated/content-bundle.json` & `src/content/compiled-locales.json` *(via `pnpm compile:content`)* | All Wave 2 & Wave 3 workers | `pnpm validate:content`, `pnpm validate:locales`, `pnpm compile:content`, `pnpm test:sim` hitting `ConservativeLegalBot` **45%–55%** survival & `rich_250k` target |
| **Wave 4** | `verifier` | Read-only audit + full verification run (`pnpm verify`, Playwright E2E/UX across all 4 viewports, screenshot review, zero-console-error check) — reports any defects to the owning worker | `sim-balancer` + `ui-dev` | Full `pnpm verify` green; ready for Human Owner review, commit, push & post-deploy `pnpm test:e2e:prod` |

---

## 11. Consequences & Trade-Offs

- **Positive**:
  - Solves all 8 validated systemic v1 flaws in one coherent, backward-compatible architectural step.
  - Preserves 100% `src/engine/` purity, seeded determinism, anti-softlock safety, and Zero-Scroll ergonomics on laptop/desktop/mobile.
  - Creates three genuinely distinct, viable 10-year builds: **Boutique Senior Solo** (high reputation, lean, zero payroll), **Incorporated S.L. / Multi-Staff Agency** (2–12 staff, high ceiling, high payroll risk), and **Opportunistic Grey-Zone ("en B" + Paco)** (high early liquidity, 4-year *prescripción* tension).
- **Trade-Offs / Watchpoints**:
  - Increasing `victory_money` to `250,000 €` and tightening `ConservativeLegalBot` to `45%–55%` means `sim-balancer` MUST iterate on `balance.yaml` once Wave 3 content lands (especially after Elena's free-cash events are nerfed and "en B" payoffs are buffed), because event EVs interact strongly with baseline tax/living curves.
  - `scale_with_tier: true` enforces prose without hardcoded `€` figures on opt-in scaled events so card labels and dynamically scaled chips never contradict each other; bespoke tier-gated S.L./Agency events still use rich explicit Euro prose freely.
  - Renaming `rich_150k` → `rich_250k` and `ricachon_150k` → `ricachon_250k` cleanly separates v2 telemetry and reflects the true 250k € target, at the modest cost of maintaining `LEGACY_VICTORY_BADGE_MAP` and `LEGACY_ACHIEVEMENT_KEY_MAP` permanently in `migrations.ts`.
