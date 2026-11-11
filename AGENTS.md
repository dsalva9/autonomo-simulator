# Agent Instructions — Autónomo Simulator

Canonical governance for AI agents collaborating on **Autónomo Simulator**.
Read [ARCHITECTURE.md](./ARCHITECTURE.md) for state/schema contracts and [Autonomo_Simulator_PRD_v1.md](./Autonomo_Simulator_PRD_v1.md) for product requirements.

## 1. Global Rules & Language Split

- **Code, Types, YAML Schema Keys, Docs, Commits, Proposals, ADRs**: **English** only.
- **Player-Facing Copy & Domain Content IDs** (`event.id`, `choice.id`, `character.id`, flags): **Spanish (`es-ES`)** in `snake_case` (e.g., `cliente_pago_sin_factura`).
- **Package Manager**: **pnpm** exclusively (`pnpm install`, never `npm` or `yarn`).
- **Strict Boundaries**: Every agent operates under one assigned role per task and MUST NOT create, edit, or delete files outside its write-allowed paths without explicit Human Owner approval.

## 2. Commands

### Fast Scoped Commands (Prefer During Iteration)
| Task | Command |
|---|---|
| Typecheck project | `pnpm tsc --noEmit` |
| Lint / format single path | `pnpm biome check --write path/to/file.ts` |
| Run single test file | `pnpm vitest run tests/engine/economy.test.ts` |
| Validate YAML content & refs | `pnpm validate:content` |
| Validate asset manifest & files | `pnpm validate:assets` |
| Emit JSON Schemas from Zod | `pnpm schema:emit` |
| Run headless balance sims | `pnpm test:sim` |
| Production build | `pnpm build` |
| Run Playwright UI / QA (local `dist/`) | `pnpm test:e2e` |
| Run Playwright UI / QA (live Vercel prod: `https://autonomo-simulator.vercel.app/`) | `pnpm test:e2e:prod` |

> **Custom Preview URL Override**: Pass `PLAYWRIGHT_BASE_URL` when targeting a branch preview URL (PowerShell: `$env:PLAYWRIGHT_BASE_URL="https://<preview-url>"; pnpm test:e2e:prod` · macOS/Linux: `PLAYWRIGHT_BASE_URL=https://<preview-url> pnpm test:e2e:prod`).

### Pre-Commit / Completion Gate
```bash
pnpm verify
```
Runs `schema:check` -> `validate:assets` -> `validate:content` -> `typecheck` -> `lint` -> `test` -> `build` -> `test:e2e` (local `dist/`), followed after `git push` / Vercel CD deployment by `pnpm test:e2e:prod` against `https://autonomo-simulator.vercel.app/`.

## 3. Roles & Directory Ownership

| Role | Write-Allowed Paths | Forbidden Paths (Read-Only) |
|---|---|---|
| **Programmer** | `src/`, `schemas/` *(via `schema:emit`)*, `scripts/`, `tests/`, `docs/adr/`, `docs/qa/`, root build configs (`package.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `playwright.prod.config.ts`, `biome.json`) | `content/events/`, `content/characters/`, `assets/` *(except initial Phase 0 bootstrap placeholders)* |
| **Narrative** | `content/events/`, `content/characters/`, `docs/proposals/` | `src/`, `schemas/`, `scripts/`, `assets/`, `content/config/` |
| **Art** | `assets/` *(including `assets/manifest.json`)*, `docs/proposals/` | `src/`, `schemas/`, `scripts/`, `content/` |
| **Human Owner** | All paths; sole approver of `AGENTS.md`, `ARCHITECTURE.md`, `Autonomo_Simulator_PRD_v1.md`, `docs/ART_DIRECTION.md`, `content/config/balance.yaml`, and engine/schema merges | — |

*Future optional roles*: **Balance Agent** (`content/config/balance.yaml`, `tests/simulation/`) and **QA Agent** (`tests/`). Do not spin them up unless requested by the Human Owner.

## 4. Role Contracts

### Programmer Agent
- **Engine Purity**: `src/engine/` MUST remain 100% pure TypeScript. NEVER import React, Zustand, DOM APIs, `IndexedDB`, `Math.random()`, or `Date.now()` inside `src/engine/`. Route all randomness through the seeded `PrngState`.
- **State Split**: Keep game rules in `src/engine/`, reactive run/save wiring in `src/store/gameStore.ts`, and ephemeral UI state in `src/store/uiStore.ts`.
- **Schema Authority**: Edit Zod schemas in `src/engine/schemas/`, then run `pnpm schema:emit`—NEVER hand-edit `schemas/*.schema.json`.
- **No Hardcoded Stories**: NEVER embed narrative events or Spanish story text inside `src/engine/`.
- **UX & Viewport Ergonomics**:
  - **Zero Desktop Yo-Yo Scroll**: On standard laptop (`1366×768`) and desktop (`1440×900`) viewports, the entire 3-column workspace and active turn loop (`month-economy-strip`, `event-card` banner/title/body, all `choice-btn-*`, and `outcome-panel` + `outcome-continue-btn`) MUST fit 100% inside the visible viewport at `scrollY === 0` (`scrollHeight <= innerHeight + 2`) so players never scroll down to find choices or scroll back up to read results. Primary CTAs on `TitleScreen` (fresh + resumable run), `AbandonRunModal`, `QuarterlyTaxModal`, and `EndRunScreen` MUST also sit 100% above the fold without scrolling.
  - **No Scroll Masking in Tests**: NEVER mask desktop layout overflow in Playwright specs by calling `scrollIntoViewIfNeeded()` before clicking primary desktop turn actions.
  - **Scroll-Reset, Non-Occlusion & Legibility**: Reset `window.scrollTo({ top: 0 })` automatically on turn-state transitions (`event -> outcome -> next event`) whenever `window.scrollY > 0` (preventing stranded mid-scroll states on mobile `360×780` / `390×844` or zoomed viewports); verify via `document.elementFromPoint` that interactive controls are never occluded by sticky HUDs, fixed mobile nav bars, Polaroids, or `AchievementToast`; forbid silent narrative/choice text truncation (`scrollHeight <= clientHeight`, never `text-overflow: ellipsis` on story/choices); and maintain legibility & touch floors (`>= 17px` event title, `>= 13.5px` body/choices, `>= 12px` HUD money, `>= 48px` choice/tab height, `>= 6px` inter-button gap).
- **Architecture Decisions**: Record non-trivial structural or contract changes in `docs/adr/NNN-slug.md` and keep `ARCHITECTURE.md` synchronized.

### Narrative Agent
- **Contract Compliance**: Every file in `content/events/<category>/<id>.yaml` and `content/characters/<id>.yaml` MUST validate against `schemas/event.schema.json` / `schemas/character.schema.json`.
- **No Invented Mechanics**: Use ONLY the closed catalog of requirement and effect primitives defined in `ARCHITECTURE.md` §5.3. Need a new effect, stat, or condition? Create `docs/proposals/NNN-slug.md` and stop—NEVER invent YAML fields or edit `src/`.
- **Economy Discipline**:
  - Use `billed_income` for legal invoiced work (accrues quarterly tax and increments `lifetime_billed`).
  - Use `cash_delta` for untaxed cash (*"en B"*), gifts, personal costs, or non-deductible fines.
  - Use `deductible_expense` for business costs that reduce quarterly tax accrual.
- **Anti-Softlock Rule**: Every event MUST define `>= 2` choices, and **at least 1 choice MUST have no conditional `requirements`**.
- **Asset Decoupling**: Reference existing `character_id` (`content/characters/`) and optional `illustration_id` (`assets/manifest.json`). Omit `illustration_id` (`null`) if bespoke art does not exist yet so the UI uses category fallbacks; request custom art via `docs/proposals/NNN-slug.md`.
- **Tone & Guardrails**:
  - Cynical, recognizable Spanish *autónomo* satire—risky choices MAY succeed via weighted `outcomes[]` (no automatic punishment moralism).
  - Keep generic freelance framing (no locked initial profession).
  - NEVER write actionable real-world tax-evasion instructions or present simplified game tax rules as legal advice.
  - NEVER punch down at or caricature people receiving public subsidies in abandonment endings.

### Art Agent
- **Style Guide**: Follow `docs/ART_DIRECTION.md` for palette, resolution, framing, and format. Until `docs/ART_DIRECTION.md` is finalized, produce clean, modular placeholders with explicit `render_mode` (`"vector_hd"` or `"pixel_art"`).
- **Manifest Registry**: Every file added to `assets/` MUST be registered in `assets/manifest.json` with stable `snake_case` ID, relative path, dimensions, `render_mode`, and `status` (`"placeholder"` or `"ready"`).
- **Zero-Touch Upgrades**: Replace placeholder art with final art strictly by updating files in `assets/` and flipping `status: "ready"` in `assets/manifest.json`—NEVER edit `src/` or `content/`.

## 5. Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| React components | `PascalCase.tsx` | `src/components/hud/IndicatorBar.tsx` |
| Engine / service modules | `camelCase.ts` or `kebab-case.ts` | `src/engine/economy.ts` |
| Event YAML file & `id` | `<category>_<spanish_slug>.yaml` (`id` matches filename stem) | `content/events/hacienda/hacienda_carta_certificada.yaml` |
| Character YAML file & `id` | `<role>_<spanish_slug>.yaml` | `content/characters/gestor_barato_paco.yaml` |
| Narrative flags | `snake_case` (Spanish) | `cobro_en_b_reciente`, `pareja_estable` |
| Asset IDs in `manifest.json` | `<type>_<spanish_slug>` | `char_gestor_barato_paco`, `bg_despacho_base` |
| Proposals & ADRs | `NNN-english-kebab-slug.md` (3-digit zero-padded) | `docs/proposals/001-client-retainer-modifier.md` |

## 6. Git, Worktrees & Handoff Protocol

### Branching & Worktree Isolation
- `main` is trunk and MUST stay green (`pnpm verify` passing).
- Every task uses a role-prefixed branch (and separate `git worktree` when multiple agents run concurrently):
  - Programmer: `engine/<slug>` or `ui/<slug>`
  - Narrative: `content/<slug>`
  - Art: `art/<slug>`
- **Human Review Gate**: Engine logic (`src/engine/`), schema changes (`schemas/`), and balance parameters (`content/config/`) require explicit Human Owner review before merging to `main`.

### Commit Format & Attribution
Use Conventional Commits (`feat(engine): ...`, `fix(ui): ...`, `content(clientes): ...`, `art(characters): ...`, `docs(adr): ...`).
Every AI-authored commit MUST include a trailer with the active model's real name:
```text
Co-Authored-By: <Agent Model Name> <noreply@agent.local>
```

### Cross-Agent Proposal Template (`docs/proposals/NNN-slug.md`)
```markdown
# Proposal NNN: <Short Title>
- **Author Role**: Narrative | Art
- **Target Role**: Programmer | Art | Human Owner
- **Status**: proposed | approved | rejected | implemented

## Motivation
- One-bullet reason existing primitives/assets cannot express this.

## Requested Contract / Asset
- Exact effect/condition shape or asset ID, dimensions, and mood.

## Example Usage
```yaml
# Concrete YAML snippet showing intended usage
```

## Acceptance Criteria
- [ ] Testable criterion 1
```

### ADR Template (`docs/adr/NNN-slug.md`)
```markdown
# ADR NNN: <Decision Title>
- **Status**: accepted | superseded-by-MMM
- **Date**: YYYY-MM-DD

## Context
- Constraint or problem being solved.

## Decision
- Concrete architectural choice made.

## Consequences
- Trade-offs and impacted modules/contracts.
```

## 7. Mandatory Completion Pipeline & Definition of Done (DoD)

Every completed feature, slice, or fix MUST execute this full end-to-end pipeline before finishing:
1. **Code & Contract Checks**: Run `schema:check`, `validate:assets`, `validate:content`, `typecheck`, and `lint` (`biome check`).
2. **Automated Tests**: Create/update unit, content, simulation, and Playwright regression tests as needed, and run the full automated test suite (`pnpm test`).
3. **Production Build & Local Playwright E2E + Usability/UX QA (Pre-Commit / Pre-Push)**:
   - Document/update human-readable manual QA and UX scenarios in `docs/qa/manual-test-plan.md` (covering narrow mobile `360×780`, mobile `390×844`, compact laptop `1366×768`, and desktop `1440×900`, user flows, edge cases, persistence, and usability invariants).
   - Maintain and execute `tests/ui/ux-usability.spec.ts` on every major UI, layout, modal, HUD, or content-presentation change to catch obvious UX regressions (yo-yo scrolling, below-the-fold CTAs, toast/sticky-bar click occlusion, stranded mobile scroll position, silent text clipping, cramped tap targets, or keyboard friction) without needing to play a full 120-month run.
   - Run `pnpm build` to emit a clean `dist/`, then execute Playwright E2E + UX Usability + manual QA scenarios locally via `pnpm test:e2e` (against `dist/` via `pnpm preview`) with screenshot & zero-console/page/HTTP-error verification **before** commit/push.
4. **Commit & Push**: Stage changes, commit using Conventional Commits + `Co-Authored-By`, and `git push` to GitHub (`origin`).
5. **Live Vercel Production Playwright QA (Post-Deploy)**: Once Vercel CD finishes deploying to `https://autonomo-simulator.vercel.app/`, run `pnpm test:e2e:prod` to verify all Playwright E2E + UX Usability + manual QA scenarios pass against the live production URL with zero console/page/HTTP errors.

### Programmer DoD
- [ ] Zero boundary violations (`src/engine/` remains pure; no hardcoded content).
- [ ] `pnpm schema:emit` run if Zod schemas changed; `ARCHITECTURE.md` / `docs/adr/` updated if contracts changed.
- [ ] Automated unit/simulation/UI tests and Playwright UX Usability checks (`tests/ui/ux-usability.spec.ts` across `360×780`, `390×844`, `1366×768`, and `1440×900`) added or updated and passing with zero yo-yo scroll, zero occluded hit targets, and zero silent text truncation.
- [ ] Manual QA & UX scenarios updated in `docs/qa/manual-test-plan.md` and executed via Playwright **both** locally (`pnpm test:e2e` against `dist/`) before commit/push **and** against the live Vercel deployment (`https://autonomo-simulator.vercel.app/` via `pnpm test:e2e:prod`) after push/deployment, with zero console/page/HTTP errors.
- [ ] `pnpm verify` (including `pnpm build` and local `pnpm test:e2e`) passes before commit/push, changes are committed and pushed to `origin`, and post-deploy `pnpm test:e2e:prod` passes against `https://autonomo-simulator.vercel.app/`.

### Narrative DoD
- [ ] Files live solely under `content/events/` or `content/characters/` (plus optional `docs/proposals/`).
- [ ] Every event has `>= 2` choices and `>= 1` unconditional choice; `billed_income` vs `cash_delta` used accurately.
- [ ] `pnpm validate:content` and `pnpm test:sim` pass with zero broken IDs, orphan chains, or deadlocks.

### Art DoD
- [ ] Files live solely under `assets/` and match `docs/ART_DIRECTION.md` specs.
- [ ] Every added/updated file is registered in `assets/manifest.json` with accurate metadata and status.
- [ ] `pnpm validate:assets` passes with zero missing or mismatched files.
