# Manual Test Plan — Autónomo Simulator (Phase 0)

Human-readable and Playwright-automated QA scenarios validating Phase 0 architecture, gameplay loop, responsive UX, IndexedDB persistence, and shareable certificate generation.

---

## 1. Execution Environments & Viewports

| Target | Command | URL |
|---|---|---|
| **Local Production Preview** | `pnpm build && pnpm test:e2e` | `http://localhost:4173` |
| **Live Deployed Build** | `PLAYWRIGHT_BASE_URL=https://<deployed-url> pnpm test:e2e` | `https://<deployed-url>` |

### Mandatory Target Viewports
- **Mobile (`mobile-chromium`)**: `390 × 844` (Pixel 7 touch profile; sticky compact HUD, compact office scene strip, `>= 48px` touch choice buttons, 4-tab bottom navigation bar).
- **Desktop (`desktop-chromium`)**: `1440 × 900` (Desktop Chrome; dedicated 3-column workspace with live `16:9` office scene + `Entorno` on left, narrative `EventStage` in center, and `Cuaderno de Cuentas` + `Diario de Expediente` on right).

### Global Invariants (All Scenarios)
- **Zero Console Errors**: Browser `console.error` count MUST remain `0`.
- **Zero Uncaught Exceptions**: Browser `pageerror` count MUST remain `0`.
- **Asset Integrity**: Every visible `<img>` element MUST finish loading with `naturalWidth > 0`.

---

## 2. Test Scenarios

### QA-01: Title Screen, Seeded Alta en el RETA & Initial Month 1 State
- **Preconditions**: Fresh browser context with empty `IndexedDB` (`autonomo:active_run` unset).
- **Steps**:
  1. Open the application root URL.
  2. Verify `TitleScreen` (`[data-testid="title-screen"]`) displays the official header (`MODELO 036`), title **Autónomo Simulator**, premise quote *«Sé tu propio jefe. Descubre por qué era mala idea.»*, and tabs for **Salón de Caídos** and **Logros (0/5)**.
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
  1. Inspect `[data-testid^="choice-btn-"]` buttons; if any choice is locked (`disabled`), verify a clear Spanish lock reason (`Bloqueado: Requiere...`) is visible inline without hover.
  2. Click the first eligible choice button (`[data-testid="choice-btn-0"]`).
  3. Inspect the **Outcome Resolution** view (`[data-testid="outcome-panel"]`).
  4. Click **Continuar** (`[data-testid="outcome-continue-btn"]`).
- **Expected Result**:
  - Selecting a choice does **not** skip past the outcome text: `[data-testid="outcome-panel"]` displays the Spanish `result_text` (`[data-testid="outcome-result-text"]`), applied stat delta pills, and HUD `+`/`-` delta badges (`aria-live="polite"`).
  - Clicking **Continuar** dismisses the outcome banner and advances cleanly to the next queued event or Month 2.

---

### QA-03: Month 1 → Month 3 Progression & *El Trimestre* (Pay vs Aplazamiento)
- **Preconditions**: Fresh seeded run (`FASE0-TRIMESTRE-QA`).
- **Steps**:
  1. Resolve monthly events from Month 1 through Month 3 by selecting eligible choices and confirming each outcome banner.
  2. Upon completing Month 3's event(s), verify **QuarterlyTaxModal** (`[data-testid="trimestre-modal"]`) opens automatically.
  3. **Branch A (Pay in Full)**: Click `[data-testid="trimestre-pay-btn"]`.
  4. **Branch B (1-Time Deferral)**: In a separate seeded run, reach Month 3 and click `[data-testid="trimestre-defer-btn"]`.
- **Expected Result**:
  - **Branch A**: Accrued quarterly tax is deducted from `Caja`, modal closes, game advances to `Año 1 · Mes 4`, and milestone achievement `primer_trimestre` (*Bautismo Trimestral*) is unlocked.
  - **Branch B**: Cash is not deducted for current quarter tax, `Estrés` increases by deferral penalty, game advances to `Año 1 · Mes 4`, and `Cuaderno de Cuentas` displays `[data-testid="ledger-deferred-tax"]` maturing at `Mes 6` (+10% surcharge).

---

### QA-04: Mid-Run Page Reload & IndexedDB Exact `GameState` Restoration
- **Preconditions**: Active seeded run (`FASE0-RELOAD-PERSIST`) advanced to `Año 1 · Mes 2` on `GameScreen`.
- **Steps**:
  1. Record exact text of `[data-testid="indicator-calendar"]`, `[data-testid="indicator-money"]`, all 4 gauges, and `data-event-id` / `[data-testid="event-title"]`.
  2. Trigger browser reload (`F5` / `page.reload()`).
  3. On `TitleScreen`, inspect `[data-testid="continue-run-card"]`.
  4. Click **Continuar partida** (`[data-testid="continue-run-btn"]`).
- **Expected Result**:
  - After reload, `TitleScreen` displays **Continuar partida** with the exact saved `Año 1 · Mes 2` and `Dinero`.
  - Clicking **Continuar partida** restores the exact `GameState` on `GameScreen`—identical cash, gauges, month, and drawn `data-event-id` without re-rolling RNG.

---

### QA-05: Responsive Workspace — Mobile Touch (`390×844`) vs Desktop 3-Column (`1440×900`)
- **Preconditions**: Active run on `GameScreen`.
- **Steps**:
  1. Measure bounding box height of every `[data-testid^="choice-btn-"]`.
  2. **On Mobile (`390×844`)**:
     - Verify bottom tab bar (`Despacho`, `Cuentas`, `Entorno`, `Historial`) is visible and each tab has height `>= 48px`.
     - Tap `Cuentas` (`[data-testid="mobile-tab-cuentas"]`), `Entorno` (`[data-testid="mobile-tab-entorno"]`), `Historial` (`[data-testid="mobile-tab-historial"]`), and return to `Despacho` (`[data-testid="mobile-tab-despacho"]`).
  3. **On Desktop (`1440×900`)**:
     - Verify `SceneRenderer`, `EntornoPanel`, `EventStage`, `CuentasPanel`, and `HistorialPanel` are all simultaneously visible in the 3-column grid without bottom mobile tabs.
- **Expected Result**:
  - Every choice button has rendered height `>= 48px` on both viewports.
  - Mobile tabs switch panels cleanly with zero horizontal overflow; Desktop shows all 3 columns side-by-side.

---

### QA-06: Keyboard Shortcuts (`1`–`9`, `Enter`, `Escape`) & Accessibility
- **Preconditions**: Active run on `GameScreen` with focus on `document.body`.
- **Steps**:
  1. Press numeric key `1` (or first eligible choice index `1`–`9`) on keyboard.
  2. Verify `[data-testid="outcome-panel"]` appears, then press `Enter`.
  3. Click `[data-testid="abandon-run-btn"]` to open voluntary exit modal, then press `Escape`.
- **Expected Result**:
  - Numeric key selects the corresponding eligible choice; `Enter` confirms the outcome and advances to the next card; `Escape` closes the non-mandatory voluntary exit modal.

---

### QA-07: End of Run, `1080×1350` Canvas Certificate, Copy Text & Hall of Fame
- **Preconditions**: Active run on `GameScreen`.
- **Steps**:
  1. Open `[data-testid="abandon-run-btn"]` and select `[data-testid="abandon-oposiciones-btn"]` (*Encerrarse a preparar oposiciones*).
  2. Verify `EndRunScreen` (`[data-testid="end-run-screen"]`) renders headline, satirical quote, time survived, final money, and lifetime billed.
  3. Inspect `[data-testid="share-canvas"]` dimensions and PNG output.
  4. Click **Copiar resumen** (`[data-testid="copy-summary-btn"]`) and verify confirmation notice (`[data-testid="share-feedback"]`).
  5. Click **Volver al inicio y Salón de Caídos** (`[data-testid="end-return-title-btn"]`).
- **Expected Result**:
  - `<canvas>` renders at exact `1080 × 1350` internal resolution with non-empty PNG output.
  - Active save slot (`autonomo:active_run`) is cleared (`Continuar partida` no longer shown on `TitleScreen`), and the finished run appears in **Salón de Caídos** (`[data-testid="hall-of-fame-list"]`).
