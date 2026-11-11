# Manual Test Plan — Autónomo Simulator (Phase 1 MVP)

Human-readable and Playwright-automated QA scenarios validating Phase 1 MVP gameplay, the 42-event / 8-character Spanish catalog, Style A Franco-Spanish editorial comic `.webp` art & reactive `.svg` props, CSS Polaroids, accessibility, IndexedDB persistence, and shareable certificate generation.

---

## 1. Execution Environments & Viewports

Both targets below are **mandatory** Playwright verification gates for every user-facing change (execute Local Preview before commit/push, and Live Production Vercel after push/deployment):

| Mandatory Target | Stage | Command | URL |
|---|---|---|---|
| **Local Preview (`dist/`)** | Pre-commit / pre-push | `pnpm build && pnpm test:e2e` | `http://localhost:4173` |
| **Live Production (Vercel)** | Post-push / post-deploy | `pnpm test:e2e:prod` | `https://autonomo-simulator.vercel.app/` |

> **Custom Preview URL Override**: To verify a Vercel preview URL before merging, set `PLAYWRIGHT_BASE_URL` (PowerShell: `$env:PLAYWRIGHT_BASE_URL="https://<preview-url>"; pnpm test:e2e:prod` · macOS/Linux: `PLAYWRIGHT_BASE_URL=https://<preview-url> pnpm test:e2e:prod`).

### Mandatory Target Viewports
- **Mobile (`mobile-chromium`)**: `390 × 844` (Pixel 7 touch profile; sticky compact HUD, compact office scene strip, in-flow NPC Polaroid above title/body, `>= 48px` touch choice buttons, 4-tab bottom navigation bar).
- **Desktop (`desktop-chromium`)**: `1440 × 900` (Desktop Chrome; dedicated 3-column workspace with live `16:9` office scene + `Entorno` Polaroids on left, narrative `EventStage` with `8:3` / `16:9` comic headers in center, and `Cuaderno de Cuentas` + `Diario de Expediente` on right).

### Global Invariants (All Scenarios)
- **Zero Console Errors**: Browser `console.error` count MUST remain `0`.
- **Zero Uncaught Exceptions**: Browser `pageerror` count MUST remain `0`.
- **Zero Failed Asset / HTTP Requests**: Every HTTP response MUST be `< 400` (`200` / `304`), and every visible `<img>` element MUST finish decoding with `naturalWidth > 0`.

---

## 2. Core Loop & Persistence Scenarios (`tests/ui/phase0.spec.ts`)

### QA-01: Title Screen, Seeded Alta en el RETA & Initial Month 1 State
- **Preconditions**: Fresh browser context with empty `IndexedDB` (`autonomo:active_run` unset).
- **Steps**:
  1. Open the application root URL.
  2. Verify `TitleScreen` (`[data-testid="title-screen"]`) displays official header (`MODELO 036`), title **Autónomo Simulator**, quote *«Sé tu propio jefe. Descubre por qué era mala idea.»*, and tabs for **Salón de Caídos (0)** and **Logros (0/9)**.
  3. Enter reproducible seed `FASE0-QA-2026` into `[data-testid="seed-input"]`.
  4. Click **Nueva alta en el RETA** (`[data-testid="start-run-btn"]`).
- **Expected Result**:
  - Transitions to `GameScreen` (`[data-testid="game-screen"]`).
  - Top `IndicatorBar` shows `Año 1 · Mes 1`, `Trimestre en 2 meses`, positive `Caja` (`€`), and bounded gauges (`Moral`, `Estrés`, `Vida personal`, `Reputación`).
  - `EventStage` displays Month 1 recurring economy strip and an active narrative `[data-testid="event-card"]` with at least 2 choices and at least 1 enabled choice.

---

### QA-02: Choice Selection, Outcome Resolution Banner & Delta Badges
- **Preconditions**: Active run in `event_resolution` phase at Month 1.
- **Steps**:
  1. Inspect `[data-testid^="choice-btn-"]` buttons; if any choice is locked (`disabled`), verify a clear Spanish lock reason (`Bloqueado: ...`) is visible inline without hover.
  2. Click the first eligible choice button (`[data-testid="choice-btn-0"]`).
  3. Inspect the **Outcome Resolution** view (`[data-testid="outcome-panel"]`).
  4. Click **Continuar** (`[data-testid="outcome-continue-btn"]`).
- **Expected Result**:
  - `[data-testid="outcome-panel"]` displays the Spanish `result_text` (`[data-testid="outcome-result-text"]`), applied stat delta pills, and HUD `+`/`-` delta badges (`aria-live="polite"`).
  - Clicking **Continuar** dismisses the outcome banner and advances cleanly to the next queued event or Month 2.

---

### QA-03: Month 1 → Month 3 Progression & *El Trimestre* (Pay vs Aplazamiento)
- **Preconditions**: Fresh seeded run (`FASE0-TRIMESTRE-PAY` / `FASE0-TRIMESTRE-DEFER`).
- **Steps**:
  1. Resolve monthly events from Month 1 through Month 3.
  2. Upon completing Month 3's event(s), verify **QuarterlyTaxModal** (`[data-testid="trimestre-modal"]`) opens automatically.
  3. **Branch A (Pay in Full)**: Click `[data-testid="trimestre-pay-btn"]`.
  4. **Branch B (1-Time Deferral)**: In a second seeded run (`FASE0-TRIMESTRE-DEFER`), reach Month 3 and click `[data-testid="trimestre-defer-btn"]`.
- **Expected Result**:
  - **Branch A**: Accrued quarterly tax is deducted from `Caja`, modal closes, game advances to `Año 1 · Mes 4`, and achievement `primer_trimestre` (*Bautismo Trimestral*) unlocks.
  - **Branch B**: Cash is preserved for current quarter tax, `Estrés` increases by deferral penalty, game advances to `Año 1 · Mes 4`, and `Cuaderno de Cuentas` displays `[data-testid="ledger-deferred-tax"]` maturing at `Mes 6` (+10% surcharge).

---

### QA-04: Mid-Run Page Reload & IndexedDB Exact `GameState` Restoration
- **Preconditions**: Active seeded run (`FASE0-RELOAD-PERSIST`) advanced to `Año 1 · Mes 2` on `GameScreen`.
- **Steps**:
  1. Record exact text of `[data-testid="indicator-calendar"]`, `[data-testid="indicator-money-value"]`, all 4 gauges, and `data-event-id` / `[data-testid="event-title"]`.
  2. Trigger browser reload (`F5` / `page.reload()`).
  3. On `TitleScreen`, inspect `[data-testid="continue-run-card"]` and click **Continuar partida** (`[data-testid="continue-run-btn"]`).
- **Expected Result**:
  - `TitleScreen` displays **Continuar partida** with exact saved `Año 1 · Mes 2` and `Dinero en caja`.
  - Resuming restores identical cash, gauges, month, and drawn `data-event-id` without re-rolling RNG.

---

### QA-05: Responsive Workspace — Mobile Touch (`390×844`) vs Desktop 3-Column (`1440×900`)
- **Preconditions**: Active run on `GameScreen`.
- **Steps**:
  1. Measure bounding box height of every `[data-testid^="choice-btn-"]`.
  2. **On Mobile (`390×844`)**: Verify bottom tab bar (`Despacho`, `Cuentas`, `Entorno`, `Historial`) has height `>= 48px` and switches panels cleanly.
  3. **On Desktop (`1440×900`)**: Verify `SceneRenderer`, `EntornoPanel`, `EventStage`, `CuentasPanel`, and `HistorialPanel` render simultaneously across 3 columns.
- **Expected Result**:
  - Every choice button has rendered height `>= 48px` on both viewports, with zero horizontal overflow.

---

### QA-06 & QA-07: Keyboard Shortcuts (`1`–`9`, `Enter`, `Escape`), Voluntary Exit & `1080×1350` Canvas Certificate
- **Preconditions**: Active seeded run (`FASE0-KEYBOARD-END`) on `GameScreen`.
- **Steps**:
  1. Press numeric key `1` to pick Choice 1, then press `Enter` on `outcome-panel`.
  2. Click `[data-testid="abandon-run-btn"]`, press `Escape` to close, then re-open and select `[data-testid="abandon-oposiciones-btn"]`.
  3. Inspect `EndRunScreen` (`[data-testid="end-run-screen"]`), `[data-testid="end-run-illustration"]`, `[data-testid="share-canvas"]`, and click **Copiar resumen** (`[data-testid="copy-summary-btn"]`).
  4. Click **Volver al inicio y Salón de Caídos** (`[data-testid="end-return-title-btn"]`).
- **Expected Result**:
  - `<canvas>` renders at exact `1080 × 1350` internal resolution with valid PNG output; finished run archives into **Salón de Caídos** and clears the active run slot.

---

## 3. Phase 1 Art, Polaroids, Achievements & Endings Scenarios (`tests/ui/phase1.spec.ts`)

### QA-08: Style A `.webp` Reactive Desk States & `.svg` Desk Props
- **Preconditions**: Active runs exercising calm desk (`FASE1-BANNER-1`), dating/family (`FASE1-ALEX-3`), and high-stress escalation (`FASE1-BURNOUT-1601`).
- **Steps**:
  1. Start `FASE1-BANNER-1` and inspect `[data-testid="scene-bg"]` and `[data-testid="scene-prop-facturas"]`.
  2. In `FASE1-ALEX-3`, advance to Month 2 (`familia_cita_con_alex`), select `apostar_por_citas_con_alex`, and inspect `[data-testid="scene-prop-familia"]`.
  3. In `FASE1-BURNOUT-1601`, escalate stress past `50` (verify `[data-testid="scene-prop-cafe"]`) and past `75` (verify `[data-testid="scene-bg"]` switches `data-asset-id` to `bg_despacho_burnout`).
- **Expected Result**:
  - Desk `.webp` backgrounds decode at `1280 × 720` and `.svg` props decode at `256 × 256` with HTTP `200` and zero broken images.

---

### QA-09: Modular `8:3` Category Banners vs `16:9` Bespoke Milestone Panels
- **Preconditions**: Seed `FASE1-BANNER-1` (standard event) and `FASE1-BURNOUT-1601` at Month 4 (`hacienda_carta_certificada`).
- **Steps**:
  1. On `FASE1-BANNER-1` Month 1 (`gestor_oferta_servicios`), inspect `[data-testid="event-banner-art"]`.
  2. On `FASE1-BURNOUT-1601` Month 4 (`hacienda_carta_certificada`), inspect `[data-testid="event-banner-art"]`.
- **Expected Result**:
  - Standard events render modular `8:3` banner (`data-banner-kind="banner"`, `960 × 360` `.webp`).
  - Milestone events with `illustration_id` render bespoke `16:9` comic scene (`data-banner-kind="milestone"`, `960 × 540` `.webp`).

---

### QA-10: Multi-Expression NPC CSS Polaroids, Nameplate & Zero Choice-Button Overlap
- **Preconditions**: Seed `FASE1-BANNER-1` on both Desktop (`1440×900`) and Mobile (`390×844`).
- **Steps**:
  1. Inspect `[data-testid="event-character-polaroid"]`, `data-expression="pleased"`, `data-asset-id="char_gestor_barato_paco_confiado"`, `[data-testid="event-character-polaroid-img"]`, and `figcaption` nameplate.
  2. Measure document-space bounding boxes of `event-character-polaroid` and every `[data-testid^="choice-btn-"]` on both `1440×900` and `390×844`.
  3. Select `contratar_paco_barato` and inspect `[data-testid="entorno-polaroid-gestor"]` inside `EntornoPanel`.
- **Expected Result**:
  - Square `512 × 512` `.webp` bust portrait sits inside crisp HTML/CSS Polaroid frame (`#fffdf8`, `2px solid #1f2421`, red pushpin, visible Spanish nameplate).
  - Zero bounding-box overlap between the Polaroid card and any choice button on both `1440×900` desktop and `390×844` mobile.
  - Hiring Paco renders miniature CSS Polaroid thumbnail in `EntornoPanel`.

---

### QA-11: Accessibility Reduced-Motion Override & Full 9-Achievement Catalog
- **Preconditions**: Fresh `TitleScreen` with OS `prefers-reduced-motion: no-preference`.
- **Steps**:
  1. Click **Logros (0/9)** (`[data-testid="title-tab-achievements"]`) and inspect `[data-testid="achievements-list"]`.
  2. Click `[data-testid="toggle-reduced-motion"]` (`Reducido: SÍ`), then start a run with an NPC card (`FASE1-ALEX-3`).
  3. Inspect `getComputedStyle(polaroid).transform` on `[data-testid="event-character-polaroid"]`.
- **Expected Result**:
  - `achievements-list` displays all 9 Phase 1 achievements (`primer_trimestre`, `primer_ano`, `gestor_contratado`, `superviviente_hacienda`, `primer_empleado`, `familia_formada`, `cinco_anos`, `heroe_120m`, `ricachon_150k`).
  - Root container carries `data-reduced-motion="true"`, flattening `.polaroid-card` CSS transform to `none` (`matrix(1, 0, 0, 1, 0, 0)`).

---

### QA-12: Deterministic Burnout Game Over, Bespoke `16:9` Ending Comic Panel & Achievement Sync
- **Preconditions**: Seed `FASE1-BURNOUT-1601` played through Month 5 (`defeat_burnout_stress`).
- **Steps**:
  1. Complete the 6-choice high-stress path through Month 5 and click `[data-testid="outcome-continue-btn"]` (*Ver certificado final del expediente*).
  2. Inspect `[data-testid="end-run-illustration"]`, `[data-testid="end-run-quote"]`, fiscal breakdown cards, and `[data-testid="share-canvas"]`.
  3. Click `[data-testid="end-return-title-btn"]` and open **Logros**.
- **Expected Result**:
  - `EndRunScreen` renders `illus_final_ansiedad` (`960 × 540` `16:9` `.webp`, `naturalWidth > 0`), satirical quote, duration, final cash, lifetime official billing, and `1080 × 1350` `<canvas>` PNG certificate.
  - Returning to `TitleScreen` shows `primer_trimestre` and `superviviente_hacienda` stamped `SELLADO`.

---

### QA-13: Live Vercel Production Parity (`https://autonomo-simulator.vercel.app/`)
- **Preconditions**: Latest `main` deployed via Vercel CD.
- **Steps**:
  1. Execute `pnpm test:e2e:prod` running both `tests/ui/phase0.spec.ts` and `tests/ui/phase1.spec.ts` across `desktop-chromium` (`1440×900`) and `mobile-chromium` (`390×844`) against `https://autonomo-simulator.vercel.app/`.
- **Expected Result**:
  - 100% of E2E specs pass against live HTTPS production with HTTP `200`/`304` on all `.webp`/`.svg` assets, zero `console.error`, and zero `pageerror` events.
