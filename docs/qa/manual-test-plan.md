# Manual Test Plan — Autónomo Simulator (Phase 3.6)

Human-readable and Playwright-automated QA scenarios validating Phase 0–3.6 gameplay, the 300-event (`clientes: 90`, `hacienda: 56`, `familia: 57`, `empleados: 48`, `gestor: 49`) / 8-character catalog, full Spanish (`es-ES`) and English (`en`, `2,518` keys + full EN temporal modifier map) localization (`ES | EN` switcher + `L` hotkey), two-step cashflow & tax-adjusted liquidity (`Caja` vs `Libre`), 60 `"ready"` Style A Franco-Spanish editorial comic `.webp` & reactive `.svg` assets, Phase 3.6 spatial reorganization (`< 1024px` zero-scroll `Despacho` vs live `Entorno` diorama, `< 768px` `[⚙]` utility sheet, `667×375` `58px` left rail, `>= 1024px` `lg:` symmetric `100dvh` 2-column/3-column workspace through `1920×1080`), procedural Web Audio & *Modo ágil* 2.0, Year-10 `AnnualSummaryModal` → `VictoryModal` sequencing, Endless Mode (`0.5x` post-M120 living-cost taper + *Jubilarse con honores*), offline PWA + OpenGraph + portable `itch.io` bundle (`pnpm package:itch`), IndexedDB persistence, 15 achievements, and illustrated `1080×1350` shareable certificate generation.

---

## 1. Execution Environments & Viewports

All targets below are **mandatory** verification gates for user-facing releases (execute Local Preview + Portable Zip before commit/push, and Live Production Vercel after push/deployment):

| Mandatory Target | Stage | Command | URL / Artifact |
|---|---|---|---|
| **Local Preview (`dist/`)** | Pre-commit / pre-push & CI (`.github/workflows/verify.yml`) | `pnpm build && pnpm test:e2e` | `http://localhost:4173` |
| **Portable `itch.io` Zip** | Pre-release / CI artifact | `pnpm package:itch` (or `pnpm build:itch`) | `release/autonomo-simulator-web.zip` |
| **Live Production (Vercel)** | Post-push / post-deploy | `pnpm test:e2e:prod` | `https://autonomo-simulator.vercel.app/` |

> **Custom Preview URL Override**: To verify a Vercel preview URL before merging, set `PLAYWRIGHT_BASE_URL` (PowerShell: `$env:PLAYWRIGHT_BASE_URL="https://<preview-url>"; pnpm test:e2e:prod` · macOS/Linux: `PLAYWRIGHT_BASE_URL=https://<preview-url> pnpm test:e2e:prod`).

### Mandatory Target Viewports
- **Portrait Phones (`360 × 640`, `375 × 667`, `360 × 780`, `390 × 844`, `412 × 915`)**: Handset profiles verifying zero horizontal clip, `< 768px` `[⚙]` utility sheet (`mobile-utility-menu-btn` → `mobile-utility-sheet`) for the 5 secondary HUD buttons (`ES|EN`, `Sonido`, `Ágil`, `Inicio`, `Baja`), zero-scroll `Despacho` turn loop (`scene-bg` unmounted on `Despacho`; all `choice-btn-*` and `outcome-continue-btn` strictly above `mobile-desk-nav` at `scrollY === 0`), live `16:9` `SceneRenderer` showcase (`>= 140px` tall) inside `Entorno` (`mobile-tab-entorno`), and `0px` HUD delta-pill overlap.
- **Phone Landscape (`667 × 375`)**: Landscape handset profile verifying condensed HUD, `58px` vertical left rail `.mobile-desk-nav`, and zero-scroll `Despacho` choices + `outcome-continue-btn` inside `innerHeight` at `scrollY === 0`.
- **Compact Desktop 2-Column (`1024 × 768`)**: `lg: >= 1024px` desktop breakpoint (`mobile-desk-nav` hidden) rendering a symmetric `100dvh` 2-column workspace (`EventStage` on left + 3-tab Right folder `desktop-right-tab-entorno|cuentas|historial` on right) with `<= 2px` top/bottom baseline alignment and `scrollHeight <= innerHeight + 2`.
- **Short-Height 3-Column Desktop (`1152 × 720`, `1280 × 600`, `1280 × 720`, `1366 × 650`)**: Real-world taskbar/DPI desktop tiers (`>= 1120px` 3-column grid; `< 740px` height uses 2-tab Right folder `desktop-right-tab-cuentas|historial`, `max-height: 700px` uses `2×2` 4-choice layout) with `scrollHeight <= innerHeight + 2` at `scrollY === 0`.
- **Standard Laptop (`1366 × 768`) & Desktop (`1440 × 900`, `1920 × 1080`)**: Full symmetric `100dvh` 3-column workspace (`SceneRenderer` + `EntornoPanel` on Left, docked `month-economy-strip` + `EventStage` in Center, stacked `CuentasPanel` + `HistorialPanel` on Right) with `<= 2px` column top/bottom alignment, `<= 2px` `event-card` → `outcome-panel` top-edge delta, single-row non-wrapping HUD Command Band 1 on `1920 × 1080`, and zero page scrollbar.

### Global Invariants (All Scenarios)
- **Zero Console Errors**: Browser `console.error` count MUST remain `0`.
- **Zero Uncaught Exceptions**: Browser `pageerror` count MUST remain `0`.
- **Zero Failed Asset / HTTP Requests**: Every HTTP response MUST be `< 400` (`200` / `304`), and every visible `<img>` element MUST finish decoding with `naturalWidth > 0`.
- **Usability & UX Invariants (Enforced on Every Major Change via `tests/ui/ux-usability.spec.ts`)**:
  - **Zero Desktop Yo-Yo Scroll & Symmetric Baselines**: On `1024×768`, `1152×720`, `1280×600`, `1280×720`, `1366×650`, `1366×768`, `1440×900`, and `1920×1080`, `documentElement.scrollHeight <= innerHeight + 2` at `window.scrollY === 0`, all visible workspace columns align within `<= 2px` at top and bottom, `event-card` → `outcome-panel` top-edge delta is `<= 2px`, and all narrative/choice/outcome controls fit inside `[headerBottom, innerHeight]` **without** calling `scrollIntoViewIfNeeded()`.
  - **Zero Mobile `Despacho` Scroll & `Entorno` Diorama Separation**: On `375×667`, `360×780`, `390×844`, `412×915`, and `667×375`, `scene-bg` renders exclusively inside `Entorno` (`mobile-tab-entorno`), keeping all `Despacho` choices and `outcome-continue-btn` strictly above `mobile-desk-nav` (or inside `innerHeight` on `667×375`) at `scrollY === 0`, while resetting `window.scrollY` to `0` on turn transitions.
  - **Above-the-Fold Primary CTAs**: Primary actions on `TitleScreen` (both Fresh `0`-run and Veteran resumable/archived runs), all 5 modals (`AbandonRunModal`, `QuarterlyTaxModal`, `AnnualSummaryModal`, `VictoryModal`, `confirm-overwrite-run-modal`), and `EndRunScreen` (`end-new-run-btn` & `end-return-title-btn` across `360×780`, `390×844`, `1366×768`, `1440×900`) MUST sit 100% inside the visible viewport at `scrollY === 0`.
  - **Unoccluded Hit Targets, Non-Overlapping HUD Deltas, Repeat-Key Guard & Readable Copy**: `document.elementFromPoint(cx, cy)` MUST hit every interactive button/tab (with `AchievementToast` at `z-40` deferred while modals are open and non-occluding on `EndRunScreen`); HUD `[data-testid$="-delta"]` pills MUST have `0px` overlap with sibling indicator numbers; held keys (`event.repeat === true`) MUST NOT auto-fire choices/outcomes on `GameScreen`; effective WCAG AA contrast MUST satisfy `>= 4.5:1`; narrative/choice text MUST NEVER truncate silently (`scrollHeight <= clientHeight + 2`, `textOverflow !== "ellipsis"`).

---

## 2. Core Loop & Persistence Scenarios (`tests/ui/phase0.spec.ts`)

### QA-01: Title Screen, Seeded Alta en el RETA & Initial Month 1 State
- **Preconditions**: Fresh browser context with empty `IndexedDB` (`autonomo:active_run` unset).
- **Steps**:
  1. Open the application root URL.
  2. Verify `TitleScreen` (`[data-testid="title-screen"]`) displays official header (`MODELO 036`), title **Autónomo Simulator**, quote *«Sé tu propio jefe. Descubre por qué era mala idea.»*, and tabs for **Salón de Caídos (0)** and **Logros (0/15)**.
  3. Enter reproducible seed `FASE0-QA-2026` into `[data-testid="seed-input"]`.
  4. Click **Nueva alta en el RETA** (`[data-testid="start-run-btn"]`).
- **Expected Result**:
  - Transitions to `GameScreen` (`[data-testid="game-screen"]`).
  - Top `IndicatorBar` shows `Año 1 · Mes 1`, `Trimestre en 2 meses`, positive `Caja` (`3.052 €` after Month 1 recurring `+452 €` net cashflow on `2.600 €` starting capital), `Reserva Trimestre: -520 € · Libre: 2.532 €`, and bounded gauges (`Moral`, `Estrés`, `Vida personal`, `Reputación`).
  - `EventStage` displays the docked Month 1 recurring economy strip (`month-economy-strip`) and an active narrative `[data-testid="event-card"]` with at least 2 choices and at least 1 enabled choice.

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
  - **Branch B**: Cash is preserved for current quarter tax, `Estrés` increases by deferral penalty, game advances to `Año 1 · Mes 4`, achievement `aplazamiento_solicitado` (*Patada Hacia Adelante*) unlocks, and `Cuaderno de Cuentas` displays `[data-testid="ledger-deferred-tax"]` maturing at `Mes 6` (+10% surcharge).

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

### QA-05: Responsive Workspace — Mobile `Despacho` / `Entorno` Separation (`390×844`) vs Desktop 3-Column (`1440×900`)
- **Preconditions**: Active run on `GameScreen`.
- **Steps**:
  1. Measure bounding box height of every `[data-testid^="choice-btn-"]`.
  2. **On Mobile (`390×844`)**: Verify `scene-bg` is NOT mounted on `Despacho` (`mobile-tab-despacho`), verify bottom tab bar (`Despacho`, `Cuentas`, `Entorno`, `Historial`) has height `>= 48px`, switch to `mobile-tab-entorno`, and verify `[data-testid="scene-bg"]` + `EntornoPanel` render cleanly inside `Entorno`.
  3. **On Desktop (`1440×900`)**: Verify `SceneRenderer` (`scene-bg` + `scene-subject-art`), `EntornoPanel`, `EventStage`, `CuentasPanel`, and `HistorialPanel` render simultaneously across 3 symmetric `100dvh` columns (`mobile-desk-nav` hidden).
- **Expected Result**:
  - Every choice button has rendered height `>= 48px` on both viewports, with zero horizontal overflow.

---

### QA-06 & QA-07: Keyboard Shortcuts (`1`–`9`, `Enter`, `Escape`), Voluntary Exit & `1080×1350` Canvas Certificate
- **Preconditions**: Active seeded run (`FASE0-KEYBOARD-END`) on `GameScreen`.
- **Steps**:
  1. Press numeric key `1` to pick Choice 1, then press `Enter` on `outcome-panel`.
  2. Open `AbandonRunModal` (clicking `[data-testid="abandon-run-btn"]` directly on `>= 768px` or opening `[data-testid="mobile-utility-menu-btn"]` → `[data-testid="abandon-run-btn"]` on `< 768px`), press `Escape` to close, then re-open and select `[data-testid="abandon-oposiciones-btn"]`.
  3. Inspect `EndRunScreen` (`[data-testid="end-run-screen"]`), `[data-testid="end-run-illustration"]`, `[data-testid="share-canvas"]`, and click **Copiar resumen** (`[data-testid="copy-summary-btn"]`).
  4. Click **Inicio y Salón de Caídos** (`[data-testid="end-return-title-btn"]`).
- **Expected Result**:
  - `<canvas>` renders at exact `1080 × 1350` internal resolution with valid PNG output; finished run archives into **Salón de Caídos** and clears the active run slot.

---

## 3. Phase 1 Art, Polaroids, Achievements & Endings Scenarios (`tests/ui/phase1.spec.ts`)

### QA-08: Style A `.webp` Reactive Desk States & `.svg` Desk Props
- **Preconditions**: Active runs exercising calm desk (`P35-PACO-493`), dating/family (`P36-ALEX-24`), and high-stress escalation (`P36-BURN-35`). On `< 1024px`, switch to `mobile-tab-entorno` when inspecting `scene-bg` and `scene-prop-*`, then switch back to `mobile-tab-despacho` to play turns.
- **Steps**:
  1. Start `P35-PACO-493`, hire Paco (`contratar_paco_barato`), advance to Month 2 (`entrega_express_contado`), and inspect `[data-testid="scene-bg"]` and `[data-testid="scene-prop-facturas"]`.
  2. In `P36-ALEX-24`, resolve Month 1 (`familia_cita_con_alex` → `apostar_por_citas_con_alex`) and inspect `[data-testid="scene-prop-familia"]`.
  3. In `P36-BURN-35`, escalate stress past `50` (verify `[data-testid="scene-prop-cafe"]`) and past `75` (verify `[data-testid="scene-bg"]` switches `data-asset-id` to `bg_despacho_burnout`).
- **Expected Result**:
  - Desk `.webp` backgrounds decode at `1280 × 720` and `.svg` props decode at `256 × 256` with HTTP `200`, `status: "ready"`, and zero broken images.

---

### QA-09: Modular `8:3` Category Banners vs `16:9` Bespoke Milestone Panels
- **Preconditions**: Seed `P35-PACO-493` (standard event) and `P36-BURN-35` on a milestone event (`hacienda_carta_certificada`), alongside the 60-asset `"ready"` catalog.
- **Steps**:
  1. On `P35-PACO-493` Month 1 (`gestor_oferta_servicios`), inspect `[data-testid="event-banner-art"]`.
  2. On `hacienda_carta_certificada`, inspect `[data-testid="event-banner-art"]`.
- **Expected Result**:
  - Standard events render modular `8:3` banner (`data-banner-kind="banner"`, `960 × 360` `.webp`).
  - Milestone events with `illustration_id` render bespoke `16:9` comic scene (`data-banner-kind="milestone"`, `960 × 540` `.webp`).

---

### QA-10: Multi-Expression NPC CSS Polaroids, Nameplate & Zero Choice-Button Overlap
- **Preconditions**: Seed `P35-PACO-493` on both Desktop (`1440×900`) and Mobile (`390×844`).
- **Steps**:
  1. Select `contratar_paco_barato` on Month 1 and inspect `[data-testid="entorno-polaroid-gestor"]` inside `EntornoPanel`.
  2. Advance through Month 3 Trimestre to Month 4 (`gestor_paco_espantada_benidorm`) and inspect `[data-testid="event-character-polaroid"]`, `data-expression="pleased"`, `data-asset-id="char_gestor_barato_paco_confiado"`, `[data-testid="event-character-polaroid-img"]`, and `figcaption` nameplate.
  3. Measure document-space bounding boxes of `event-character-polaroid` and every `[data-testid^="choice-btn-"]` on both `1440×900` and `390×844`.
- **Expected Result**:
  - Square `512 × 512` `.webp` bust portrait sits inside crisp HTML/CSS Polaroid frame (`#fffdf8`, `2px solid #1f2421`, red pushpin, visible Spanish nameplate).
  - Zero bounding-box overlap between the Polaroid card and any choice button on both `1440×900` desktop and `390×844` mobile.
  - Hiring Paco renders miniature CSS Polaroid thumbnail in `EntornoPanel`.

---

### QA-11: Accessibility Reduced-Motion Override & Achievement Catalog Preservation
- **Preconditions**: Fresh `TitleScreen` with OS `prefers-reduced-motion: no-preference`.
- **Steps**:
  1. Click **Logros (0/15)** (`[data-testid="title-tab-achievements"]`) and inspect `[data-testid="achievements-list"]`.
  2. Click `[data-testid="toggle-reduced-motion"]` (`Reducido: SÍ`), then start a run with an NPC card (`P36-ALEX-24`).
  3. Inspect `getComputedStyle(polaroid).transform` on `[data-testid="event-character-polaroid"]`.
- **Expected Result**:
  - `achievements-list` preserves all 9 original Phase 1 achievement IDs within the expanded 15-achievement catalog.
  - Root container carries `data-reduced-motion="true"`, flattening `.polaroid-card` CSS transform to `none` (`matrix(1, 0, 0, 1, 0, 0)`).

---

### QA-12: Deterministic Burnout Game Over, Bespoke `16:9` Ending Comic Panel & Achievement Sync
- **Preconditions**: Seed `P36-BURN-35` played deterministically through `defeat_burnout_stress`.
- **Steps**:
  1. Complete the deterministic high-stress escalation path (`P36-BURN-35`) until `stress >= 100`, acknowledge the fatal `outcome-panel`, and enter `EndRunScreen`.
  2. Inspect `[data-testid="end-run-illustration"]`, `[data-testid="end-run-quote"]`, fiscal breakdown cards, and `[data-testid="share-canvas"]`.
  3. Click `[data-testid="end-return-title-btn"]` and open **Logros**.
- **Expected Result**:
  - `EndRunScreen` renders `illus_final_ansiedad` (`960 × 540` `16:9` `.webp`, `naturalWidth > 0`), satirical quote, duration, final cash, lifetime official billing, and `1080 × 1350` `<canvas>` PNG certificate.
  - Returning to `TitleScreen` shows `primer_trimestre` stamped `SELLADO` (and `superviviente_hacienda` unlocks strictly when a `hacienda_*` event was resolved in a non-ended run).

---

### QA-13: Live Vercel Production Parity (`https://autonomo-simulator.vercel.app/`)
- **Preconditions**: Latest `main` deployed via Vercel CD.
- **Steps**:
  1. Execute `pnpm test:e2e:prod` running `tests/ui/phase0.spec.ts`, `tests/ui/phase1.spec.ts`, `tests/ui/phase2.spec.ts`, and `tests/ui/ux-usability.spec.ts` across `desktop-chromium` (`1024×768`, `1152×720`, `1280×600`, `1280×720`, `1366×650`, `1366×768`, `1440×900`, `1920×1080`) and `mobile-chromium` (`360×640`, `375×667`, `360×780`, `390×844`, `412×915`, `667×375`) against `https://autonomo-simulator.vercel.app/`.
- **Expected Result**:
  - 100% of E2E and Usability/UX specs pass against live HTTPS production with HTTP `200`/`304` on all `.webp`/`.svg`/PWA/OG assets, zero `console.error`, and zero `pageerror` events.

---

## 4. Phase 2 Cashflow Timing, Tidy Geometry, PWA & Share Card Scenarios (`tests/ui/phase2.spec.ts`)

### QA-14: Two-Step Cashflow Timing & Tax-Adjusted Liquidity (`Caja` vs `Libre`)
- **Preconditions**: Fresh seeded run (`P35-CASH-158`) with `fastPacing` disabled (`Normal`).
- **Steps**:
  1. Start `P35-CASH-158` (`initial_indicators.money = 2.600 €` + Month 1 net recurring `+452 €`) and inspect `[data-testid="indicator-money"]`, `[data-testid="indicator-net-cash"]`, and `[data-testid="ledger-net-after-tax"]` in `CuentasPanel`.
  2. Select cash-reducing choice `escapada_desconexion_total` (`-90 €`) on Month 1 and inspect HUD **before** clicking **Continuar**.
  3. Click `[data-testid="outcome-continue-btn"]` and inspect HUD transition to Month 2 (`Caja: 3.445 €`).
  4. Select cash-increasing choice `exigir_euros_aunque_sea_en_dos_plazos` (`+600 €`) on Month 2 and inspect HUD **before** clicking **Continuar**, then acknowledge.
- **Expected Result**:
  - Month 1 HUD displays `Caja: 3.052 €` alongside `Reserva Trimestre: -520 € · Libre: 2.532 €`, and `CuentasPanel` displays `Margen tras provisión fiscal: -79 €` (`[data-testid="ledger-net-after-tax"]`).
  - While `[data-testid="outcome-panel"]` is open on Month `N`, `[data-testid="indicator-calendar"]` remains on `Año 1 · Mes N` (never jumping prematurely to `N+1`), `[data-testid="indicator-money-value"]` reflects the immediate post-choice balance (`2.962 €` then `4.045 €`), and `[data-testid="indicator-money-delta"]` shows `-90 €` (red `#9e221b`) on cash loss and `+600 €` (green `#1f5c53`) on cash gain.
  - Only clicking `[data-testid="outcome-continue-btn"]` advances `indicator-calendar` to `Mes N+1` and applies the next month's recurring cashflow.

---

### QA-15: Narrow Mobile (`360×780`) & Mobile (`390×844`) Zero-Clip & Alignment Geometry Audit
- **Preconditions**: Browser resized explicitly to `{ width: 360, height: 780 }` and `{ width: 390, height: 844 }`.
- **Steps**:
  1. Measure `document.documentElement.scrollWidth <= window.innerWidth` and hero rubber-stamp (`VENTANILLA ÚNICA`) bounding box on `TitleScreen`.
  2. Start `P35-EN-LOCALE-134` and measure sticky `<header>` (`IndicatorBar`) height, the `y`-coordinates of all 4 micro-gauges (`indicator-moral`, `indicator-stress`, `indicator-personal-life`, `indicator-reputation`), and horizontal containment of `indicator-money`, `indicator-net-cash`, `mobile-utility-menu-btn`, `event-character-polaroid`, `event-card`, all `choice-btn-*`, and all 4 bottom navigation tabs (`mobile-tab-*`).
  3. Cycle through `Despacho`, `Cuentas`, `Entorno`, and `Historial` tabs, open `mobile-utility-menu-btn` → `AbandonRunModal`, advance to Month 3 `QuarterlyTaxModal`, and complete voluntary exit to `EndRunScreen`, checking `scrollWidth <= innerWidth` and modal viewport containment at every stop.
- **Expected Result**:
  - Zero horizontal overflow (`scrollWidth <= innerWidth`) across every screen, tab, utility sheet, and modal on both `360×780` and `390×844`.
  - Every audited element satisfies `box.x >= 0 && box.x + box.width <= viewportWidth + 0.5`; every choice button and mobile tab satisfies `box.height >= 48`.
  - Mobile `IndicatorBar` height is `<= 140px`, and all 4 micro-gauges sit on the exact same horizontal row (`Math.max(...ys) - Math.min(...ys) <= 2`).

---

### QA-16: Strict 3-Column Desktop Tidy Alignment & 15-Seal `HistorialPanel` Audit (`1440×900`)
- **Preconditions**: Desktop viewport `{ width: 1440, height: 900 }`, active run (`P35-BANNER-139`) scrolled to top (`scrollY === 0`).
- **Steps**:
  1. Assert `document.documentElement.scrollWidth <= 1440` and `document.documentElement.scrollHeight <= 902`.
  2. Measure bounding boxes of Left column (`[data-testid="scene-renderer"]` + `EntornoPanel`), Center column (`[data-testid="event-card"]` with docked `[data-testid="month-economy-strip"]`), and Right column (`[data-testid="panel-cuentas"]` + `[data-testid="panel-historial"]`).
  3. Inspect `[data-testid="panel-historial"]` career seals counter (`Sellos de carrera 0/15`), `.historial-seals-grid > span` 15-item grid, and `scrollWidth <= clientWidth + 1`.
- **Expected Result**:
  - Strict 3-track horizontal non-overlap (`leftBox.x + leftBox.width <= centerBox.x + 1` and `centerBox.x + centerBox.width <= rightBox.x + 1`) within `1440px`.
  - Symmetrical top edges across all 3 columns (`Math.max(topLeft, topCenter, topRight) - Math.min(topLeft, topCenter, topRight) <= 2`).
  - `HistorialPanel` renders all `15` career seals cleanly alongside `CuentasPanel` without horizontal overflow.

---

### QA-17: Fast Pacing (*Modo ágil*) & Procedural Web Audio Mute Toggles
- **Preconditions**: Active run (`P35-CASH-158`) at Month 1 on `GameScreen`.
- **Steps**:
  1. Toggle `[data-testid="toggle-sfx-btn"]` twice (directly on `>= 768px` or via `[data-testid="mobile-utility-menu-btn"]` on `< 768px`), checking `aria-pressed` and `localStorage["autonomo:sfx_muted"]`.
  2. Toggle `[data-testid="toggle-fast-pacing-btn"]` (`aria-pressed="true"`, surfacing `mobile-utility-fast-indicator` `⚡` on `< 768px`), then click non-terminal Month 1 choice `quedarse_adelantando_entregas`.
- **Expected Result**:
  - `toggle-sfx-btn` flips cleanly between active (`aria-pressed="true"`, `sfx_muted="false"`) and muted (`aria-pressed="false"`, `sfx_muted="true"`).
  - With *Modo ágil* enabled, clicking a deterministic 1-outcome choice skips `outcome-panel` and advances immediately to `Año 1 · Mes 2`'s `event-card`.

---

### QA-18: Offline PWA Manifest, Service Worker Precache & OpenGraph Social Assets
- **Preconditions**: Production build (`dist/`) or live Vercel deployment.
- **Steps**:
  1. Inspect `<link rel="manifest" href="./manifest.webmanifest">` and `<meta property="og:image" content="...og-preview.png">` in document `<head>`.
  2. Issue HTTP `GET` requests to `./manifest.webmanifest`, `./icons/icon-192.png`, `./icons/icon-512.png`, `./og-preview.png`, and `./sw.js`.
- **Expected Result**:
  - All endpoints return HTTP `200`; `manifest.webmanifest` parses as valid `standalone` JSON containing `192x192` and `512x512` icons; `og-preview.png` serves the `1200×630` PNG social card; `sw.js` contains the injected `PRECACHE_URLS` offline asset manifest.

---

### QA-19: Illustrated `1080×1350` Share Card & Expanded 15-Achievement Catalog
- **Preconditions**: Fresh `TitleScreen` → active run exited via `AbandonRunModal` (`abandon_oposiciones`) to `EndRunScreen`.
- **Steps**:
  1. On `TitleScreen`, open **Logros (0/15)** (`[data-testid="title-tab-achievements"]`) and verify all 15 `achievement-item-*` rows render (`primer_trimestre`, `primer_ano`, `gestor_contratado`, `aplazamiento_solicitado`, `numeros_rojos_superados`, `superviviente_hacienda`, `colchon_10k`, `primer_empleado`, `familia_formada`, `criatura_en_casa`, `cinco_anos`, `facturacion_100k`, `heroe_120m`, `ricachon_150k`, `modo_infinito`).
  2. Trigger voluntary exit (`abandon-oposiciones-btn`) and inspect `[data-testid="end-run-illustration"]` (`960 × 540`) and `[data-testid="share-canvas"]` (`1080 × 1350`).
- **Expected Result**:
  - `loadAndRenderShareCard` preloads the ending `.webp` illustration and composites a multi-color framed `16:9` (`512 × 288`) comic vignette (`ANEXO GRÁFICO [00]`) onto the `1080 × 1350` `<canvas>` with zero text overlap and valid PNG output.

---

## 5. Usability & User Experience (UX) Audit Scenarios (`tests/ui/ux-usability.spec.ts`)

Fast, deterministic UX checks executed on every major change so obvious usability regressions (yo-yo scrolling, below-the-fold buttons, toast/header click occlusion, stranded scroll state, silent text clipping, or broken column baselines) are caught immediately without playing a 120-month run.

### QA-20: Zero Desktop Yo-Yo Scroll — Event Banner, Body, All Choices & Outcome Fit 100% Above the Fold (`1366×768` & `1440×900`)
- **Preconditions**: Desktop Chromium resized to both `1366 × 768` (laptop) and `1440 × 900` (desktop), seeded run `P35-M4-HITO-72`.
- **Steps**:
  1. Play Months 1 through 3, settle Trimestre (`trimestre-defer-btn`), and reach Month 4 (`hacienda_carta_certificada` featuring a `16:9` milestone comic banner + NPC Inspector Polaroid + 3 choices).
  2. On every active event card and every post-choice `outcome-panel`, measure `window.scrollY`, `document.documentElement.scrollHeight`, `window.innerHeight`, and the live viewport bounding boxes of `event-title`, `event-body`, every `choice-btn-*`, `outcome-panel`, `outcome-result-text`, and `outcome-continue-btn` **without** calling `scrollIntoViewIfNeeded()`.
- **Expected Result**:
  - `window.scrollY === 0` and `scrollHeight <= innerHeight + 2` across all turns (the entire 3-column workspace fits inside a single screen with zero page scrollbar).
  - Every audited narrative element, choice button, outcome summary, and **Continuar** button sits 100% inside `[headerBottom, viewportHeight]` on both `1366×768` and `1440×900`—zero scrolling down to find choices and zero scrolling back up to read results.

---

### QA-21: Above-the-Fold Primary CTA Audit Across `TitleScreen`, Modals & `EndRunScreen` (`1366×768` & `1440×900`)
- **Preconditions**: Desktop Chromium at `1366 × 768` and `1440 × 900`.
- **Steps**:
  1. Inspect fresh `TitleScreen` (`seed-input`, `start-run-btn`), start `FASE0-TRIMESTRE-PAY`, return to `TitleScreen` so `continue-run-card` is mounted alongside new-run controls, and measure `continue-run-btn` + `start-run-btn` without scrolling.
  2. Resume run, open `AbandonRunModal`, and measure all 3 voluntary exit options (`abandon-oposiciones-btn`, `abandon-salaried-btn`, `abandon-cese-btn`).
  3. Advance to Month 3 `QuarterlyTaxModal` and measure `trimestre-pay-btn` + `trimestre-defer-btn`.
  4. Exit to `EndRunScreen` and measure `end-run-title`, `end-run-illustration`, `share-canvas`, `share-native-btn`, `copy-summary-btn`, `download-card-btn`, `end-new-run-btn`, and `end-return-title-btn` at `scrollY === 0`.
- **Expected Result**:
  - 100% of primary CTAs and visual anchors across every screen and modal sit completely inside `[0, viewportHeight]` without requiring vertical scroll on either `1366×768` or `1440×900`.

---

### QA-22: Mobile Bottom-Nav Clearance & Automatic Scroll-Reset on Turn Transitions (`360×780` & `390×844`)
- **Preconditions**: Mobile Chromium resized to `360 × 780` and `390 × 844`, seeded run `P35-BANNER-139`.
- **Steps**:
  1. Compare the bottom edge of the last `choice-btn-*` against the top edge of the fixed `nav[data-testid="mobile-desk-nav"]` (`Secciones del despacho`).
  2. Click the bottom choice button, then inspect `window.scrollY` and the viewport bounds of `outcome-result-text` and `outcome-continue-btn`.
  3. Click `outcome-continue-btn` and inspect `window.scrollY` + `event-title` on Month 2.
- **Expected Result**:
  - `lastChoice.bottom <= bottomNav.top - 4` (never tucked behind the fixed bottom tab bar).
  - Transitioning `choice -> outcome` and `outcome -> next event` automatically keeps `window.scrollY === 0`, placing `outcome-result-text`, `outcome-continue-btn`, and the next month's `event-title` cleanly between the sticky header and fixed bottom nav.

---

### QA-23: Hit-Target Non-Occlusion (`elementFromPoint` + Live `AchievementToast`), Effective WCAG AA Contrast, Zero Silent Text Truncation, Legibility Floor & Spacing
- **Preconditions**: Executed in both `desktop-chromium` (`1366×768`) and `mobile-chromium` (`390×844`) using seed `P35-BANNER-139`.
- **Steps**:
  1. Check `scrollHeight <= clientHeight + 2`, `scrollWidth <= clientWidth + 2`, and `textOverflow !== "ellipsis"` on `event-title`, `event-body`, every `choice-btn-*`, and `outcome-result-text`.
  2. Measure computed `fontSize` and effective WCAG AA (`>= 4.5:1`) contrast (accounting for cumulative ancestor CSS `opacity`) on `event-title`, `event-body`, and `indicator-money-value`, plus vertical gaps between consecutive `choice-btn-*` buttons.
  3. Evaluate `document.elementFromPoint(cx, cy)` on HUD action buttons (directly on `>= 768px`, and inside `mobile-utility-sheet` via `mobile-utility-menu-btn` on `< 768px`), all `choice-btn-*`, and mobile tabs (`mobile-tab-*`).
  4. Click `contratar_paco_barato` to trigger live `[data-testid="achievement-toast"]` (*Delega y Rezarás*) alongside `outcome-panel`, and immediately evaluate `document.elementFromPoint(cx, cy)` on `outcome-continue-btn`.
- **Expected Result**:
  - Zero silent text clipping or ellipsis on gameplay narrative/choices/outcomes; `event-title >= 17px`, `event-body >= 13.5px`, `indicator-money-value >= 12px`, effective contrast `>= 4.5:1`; choice buttons `>= 48px` tall with `>= 6px` inter-button gaps.
  - Every tested control receives pointer hits at its visual center—including `outcome-continue-btn` while `AchievementToast` is actively displayed on both mobile and desktop.

---

### QA-24: Full Desktop Zero-Mouse Keyboard Navigation Across `TitleScreen`, `GameScreen`, Modals & `EndRunScreen` (`1366×768`)
- **Preconditions**: Desktop Chromium at `1366 × 768`, zero mouse clicks (`locator.click()` forbidden).
- **Steps**:
  1. On `TitleScreen`, switch archive tabs via `2` / `1` and WAI-ARIA `ArrowRight` / `ArrowLeft` on `role="tablist"`, `Tab` into `title-archive-panel`, toggle `R` (reduced motion), `M` (sound), and `F` (*Modo ágil*), press `S` to focus `seed-input`, type `FASE0-TRIMESTRE-PAY`, press `Escape` to blur, and press `Enter` to start the run.
  2. On Month 1 `GameScreen`, cycle choices with `ArrowDown` / `ArrowUp`, confirm with `Enter`, focus `outcome-continue-btn` with `ArrowDown` and advance with `Space`; press `I` to return to `TitleScreen` and `C` to resume the active run.
  3. Advance to Month 3 `QuarterlyTaxModal`, verify `trimestre-pay-btn` auto-focus, press `Tab` across modal controls to assert focus remains trapped inside `trimestre-modal` (`<main inert>`), cycle options with `ArrowDown` / `ArrowUp`, and settle with `1` (dismissing `AchievementToast` with `Escape`).
  4. Toggle *Modo ágil* with `F` and play by keyboard to Month 12 `AnnualSummaryModal`; verify `annual-summary-close-btn` auto-focus + `Tab` trap, and close with `Enter` into Año 2.
  5. Press `B` to open `AbandonRunModal`, press `Tab` to assert focus remains trapped inside `abandon-modal`, press `Escape` to cancel, press `B` again, and select salaried exit via `ArrowDown` + `Enter`.
  6. On `EndRunScreen`, verify `end-new-run-btn` auto-focus, navigate actions with `ArrowRight` / `ArrowLeft`, press `C` to copy summary (`share-feedback` visible), press `Escape` to return to `TitleScreen` (`hall-of-fame-list` updated), and press `N` to launch a new run.
- **Expected Result**:
  - Every screen, preference, archive tab, turn choice, outcome, Trimestre/Annual/Abandon modal, and end-of-run certificate action completes 100% by keyboard with strict modal focus trapping, zero console/page errors, and `window.scrollY === 0` throughout.

---

### QA-25: Year-10 `AnnualSummaryModal` → `VictoryModal` Sequencing, Focus Trap & Above-the-Fold Layout (`1366×768`)
- **Preconditions**: Desktop Chromium at `1366 × 768`, active run staged at Month 120 Q40 (`quarterly_tax`) / `victory_prompt` (`pending_victory_badge: "hero_120m"` / `"rich_150k"`).
- **Steps**:
  1. At Month 120 Q40, settle `QuarterlyTaxModal` (`trimestre-pay-btn`) and verify `AnnualSummaryModal` (`[data-testid="annual-summary-modal"]` for Año 10) opens **before** `VictoryModal`; dismiss `AnnualSummaryModal` via `[data-testid="annual-summary-close-btn"]` (`Enter`) and verify `VictoryModal` (`[data-testid="victory-modal"]`) opens immediately next.
  2. Verify `victory-continue-btn` and `victory-retire-btn` fit 100% inside `[0, 768]`, verify `victory-continue-btn` is auto-focused, press `Tab` 4 times to assert focus remains trapped inside `victory-modal`, press `ArrowDown` to focus `victory-retire-btn`, and press `Enter` to retire.
- **Expected Result**:
  - Year 10 never skips its `AnnualSummaryModal` (`quarterly_tax` → `annual_summary` → `victory_prompt`), `VictoryModal` traps keyboard focus cleanly, supports `ArrowDown` / `ArrowUp` and `1` / `2` shortcuts, and retires to `EndRunScreen` displaying `[data-testid="end-run-victory-badges"]`.

---

### QA-26: Full English (`en`) Localization, `ES <-> EN` Toggle + `L` Hotkey, Reload Persistence, Modifier Translation & Zero-Scroll UX (`1366×768` & `360×780`)
- **Preconditions**: Executed in both `desktop-chromium` (`1366 × 768`) and `mobile-chromium` (`360 × 780`), using deterministic seed `P35-EN-LOCALE-134`.
- **Steps**:
  1. On `TitleScreen`, verify default `<html lang="es">`, click `[data-testid="locale-toggle-btn"]` (`ES | EN`), verify `<html lang="en">` and English CTAs/tabs (`Register as Self-Employed`, `Hall of the Fallen (0)`, `Achievements (0/15)`), and toggle `EN -> ES -> EN` using the `L` hotkey.
  2. Start `P35-EN-LOCALE-134` and verify English HUD (`Year 1 · Month 1`, comma-formatted `3,052 €` and `Net: 2,532 €`), toggle `EN -> ES -> EN` via `L` and `locale-toggle-btn` (inside `mobile-utility-sheet` on `360×780`), and verify English event copy (`clientes_encargo_urgente`) + translated NPC Polaroid (`Borja "Mr. Exposure"`).
  3. On `1366×768` desktop, verify `window.scrollY === 0`, `scrollHeight <= innerHeight + 2`, all narrative/choice/outcome controls fit 100% inside `[headerBottom, 768]` without `scrollIntoViewIfNeeded()`, hit targets are unoccluded (`document.elementFromPoint`), narrative/choice text has zero silent truncation, and English side panels (`Account Ledger`, `Support Network`, `Dossier Logbook`) are visible. On `360×780` mobile, verify `scrollWidth <= 360`, unoccluded `Office sections` bottom tabs (`Desk`, `Ledger`, `Network`, `Logbook`), zero-scroll `Desk` choices above `mobile-desk-nav`, and automatic `scrollY === 0` reset on turn transitions.
  4. Select `entrega_express_contado`, verify English `outcome-panel` + `Continue`, advance to `Year 1 · Month 2`, reload the browser (`page.reload()`), verify `<html lang="en">` + `Continue run` (`Year 1 · Month 2`) persist in IndexedDB, and resume.
  5. Advance through Month 2 (`familia_gimnasio_abandonado` → `ir_dos_dias_fijos_a_entrenar`) and Month 3 (`instalar_lector_dni_electronico`), settle the English `QuarterlyTaxModal` (`FORM 303 / 130`), and inspect `[data-testid="panel-cuentas"]`.
- **Expected Result**:
  - `ES | EN` switching works instantaneously via both `[data-testid="locale-toggle-btn"]` and `L`, persists across reloads, maintains 100% single-screen `1366×768` zero-scroll & `360×780` zero-clip ergonomics, and renders all active temporal modifiers in idiomatic English (`Consistent workout routine`, never raw Spanish).

---

### QA-27: Real Non-Fullscreen Windows Laptop (`1366×650`) & `1080p @ 150% DPI` (`1280×600`) Zero-Scroll Turn Loop + `2×2` 4-Choice Grid
- **Preconditions**: Desktop Chromium resized to `{ width: 1366, height: 650 }` and `{ width: 1280, height: 600 }`.
- **Steps**:
  1. Start `P35-M4-HITO-72` and audit active event cards (`event-title`, `event-body`, all `choice-btn-*`) and post-choice `outcome-panel` + `outcome-continue-btn` at `scrollY === 0` without calling `scrollIntoViewIfNeeded()`.
  2. Stage a 4-choice event (`familia_encrucijada_agotamiento` with one locked choice) and measure `scrollHeight`, `innerHeight`, `choice-btn-0` vs `choice-btn-1` side-by-side geometry (`2×2` grid), and WCAG AA effective contrast on the locked reason line.
- **Expected Result**:
  - `window.scrollY === 0` and `scrollHeight <= innerHeight + 2` across both `1366×650` and `1280×600` viewports on 2-, 3-, and 4-choice cards as well as `outcome-panel`.
  - 4-choice events arrange cleanly into a `2×2` grid on compact-height desktop viewports, and locked choice explanation copy satisfies effective WCAG AA contrast (`>= 4.5:1`) even with ancestor `opacity`.

---

### QA-28: Multi-Resolution Desktop `1024×768` 2-Column, Compact Phone (`360×640`) & Phone Landscape Left-Rail (`667×375`) Usability
- **Preconditions**: Chromium resized sequentially to `{ width: 1024, height: 768 }`, `{ width: 360, height: 640 }`, and `{ width: 667, height: 375 }`, seeded run `P35-BANNER-139`.
- **Steps**:
  1. At `1024×768`, verify `mobile-desk-nav` is hidden, measure `event-card` width (`>= 500px`), `scrollHeight <= 770`, and Right-column 3-tab folder switching (`desktop-right-tab-entorno`, `desktop-right-tab-cuentas`, `desktop-right-tab-historial`).
  2. At `360×640` and `667×375`, measure `scrollWidth <= innerWidth`; verify `360×640` keeps choices above the bottom `.mobile-desk-nav` bar and `667×375` docks `.mobile-desk-nav` as a `58px` vertical left rail (`width <= 64`, `x === 0`) so choices clear the full `375px` height; verify `elementFromPoint` non-occlusion and automatic `window.scrollY === 0` reset on `choice -> outcome -> next event`.
- **Expected Result**:
  - `1024×768` renders a zero-scroll symmetric 2-column desktop workspace with full Right-folder access to `Entorno`, `Cuentas`, and `Historial`.
  - `360×640` and `667×375` maintain zero horizontal overflow, unoccluded touch targets, and automatic scroll-reset on every turn transition.

---

### QA-29: *Modo Ágil* 2.0 — Choice Stake Hints, Mandatory Pause on `Dices` Multi-Outcome Choices & Auto-Settled Affordable Quarters
- **Preconditions**: Desktop Chromium at `1366 × 768`, *Modo ágil* enabled (`toggle-fast-pacing-btn` `aria-pressed="true"`), seeded run `P35-AGIL-1`.
- **Steps**:
  1. Inspect `[data-testid^="choice-stakes-"]` badges on Month 1 (`clientes_agencia_marketing_humo`).
  2. Click weighted multi-outcome `Dices` choice `meter_dinero_por_probar` (`55% / 45%`) while *Modo ágil* is active.
  3. Click `outcome-continue-btn` to advance to Month 2, resolve Month 2 (`seguir_autogestion` — single deterministic outcome, skipped automatically), and resolve Month 3 (`separar_cuenta_impuestos` — affordable Q1 Trimestre).
- **Expected Result**:
  - Choice buttons surface scannable upfront stake hints (`€` cost/income, `B` untaxed cash, `🎲` multi-outcome roll).
  - *Modo ágil* **pauses** on `outcome-panel` whenever a weighted multi-outcome (`outcomes.length > 1`) choice is rolled so the player never misses the RNG verdict, while still skipping deterministic 1-outcome filler turns.
  - At Month 3 with sufficient cash (`money >= accrued_tax_liability`) and zero matured deferred debt, *Modo ágil* auto-settles Q1 without opening `trimestre-modal`, advances straight to `Año 1 · Mes 4`, unlocks `primer_trimestre`, and displays `[data-testid="auto-settled-quarter-receipt"]` in `EventStage`.

---

### QA-30: `TitleScreen` Overwrite Guard (`confirm-overwrite-run-modal`), Endless Mode Taper (`2.013 €` at M128) & *Jubilarse con honores*, and Fatal `outcome-panel` Reload Persistence
- **Preconditions**: Desktop Chromium at `1366 × 768`.
- **Steps**:
  1. Start `P35-CASH-158`, return to `TitleScreen`, click `start-run-btn` while `continue-run-card` is active, test `cancel-overwrite-run-btn` (preserves saved run) and `confirm-overwrite-run-btn` (starts fresh run cleanly).
  2. Stage an Endless Mode run at Month 128 (`endless_mode: true`, `earned_victories: ["hero_120m", "rich_150k"]`), verify post-M120 `0.5x` living-cost taper (`2.013 €` living cost at M128 in `CuentasPanel`), open `AbandonRunModal`, verify `[data-testid="retire-honorable-section"]`, and click `[data-testid="retire-honorable-confirm-btn"]`.
  3. Stage a near-burnout run (`stress: 95` on `clientes_encargo_urgente`), select `entrega_express_contado` (`+9` stress -> `104` fatal burnout), verify `outcome-panel` displays the narrative `result_text` before `EndRunScreen`, reload the browser (`page.reload()`), and click `continue-run-btn`.
- **Expected Result**:
  - `TitleScreen` prevents accidental active-run loss with `confirm-overwrite-run-modal` (100% above the fold).
  - Endless Mode tapers post-M120 living-cost inflation (`effectiveYears = 9 + (yearsElapsed - 9) * 0.5`) and replaces punitive defeat exits with **Jubilarse con honores**, routing cleanly to `EndRunScreen` with victory reason (`retired_rich` / `retired_hero`) and preserved `end-run-victory-badges`.
  - Reloading on a fatal `outcome-panel` restores the exact pending fatal `outcome-panel` (`Año 1 · Mes 1`) first rather than skipping the story climax, then transitions to `EndRunScreen` upon clicking `outcome-continue-btn`.

---

### QA-31: Phase 3.6 Desktop Zero-Scroll & Symmetrical Column Baselines (`1024×768`, `1152×720`, `1280×720`, `1366×768`, `1440×900`, `1920×1080`)
- **Preconditions**: Desktop Chromium resized sequentially across all 6 desktop viewports (`1024×768`, `1152×720`, `1280×720`, `1366×768`, `1440×900`, `1920×1080`).
- **Steps**:
  1. Audit `TitleScreen` in both Fresh (`0` runs) and Veteran (active saved run + archived Hall of Fame runs) states at `window.scrollY === 0`.
  2. Enter `GameScreen` (`P35-M4-HITO-72`), verify `mobile-desk-nav` is hidden, measure `documentElement.scrollHeight <= innerHeight + 2`, measure top-edge and bottom-edge `y`-coordinates of all visible workspace columns (`Left` / `Center` / `Right`), click Choice 0 without scrolling, and measure `outcome-panel` top-edge vs `event-card` top-edge (`<= 2px` jump).
  3. Verify `HistorialPanel` (`Diario de Expediente`) is simultaneously visible below `CuentasPanel` on `1366×768`, `1440×900`, and `1920×1080`, and accessible via `desktop-right-tab-historial` on `1024×768`, `1152×720`, and `1280×720`.
  4. On `1920×1080`, measure HUD Command Band 1 height (`<= 40px`) and vertical center alignment (`<= 4px`) across Calendar, Treasury Strip, and Toolbar.
- **Expected Result**:
  - `scrollHeight <= innerHeight + 2` on both Fresh/Veteran `TitleScreen` and `GameScreen` across all 6 desktop viewports, with `start-run-btn` and `continue-run-btn` 100% above the fold.
  - Visible workspace columns align within `<= 2px` at both top and bottom baselines, `event-card` → `outcome-panel` top-edge jump is `<= 2px`, and `1920×1080` keeps HUD Command Band 1 on a single non-wrapping horizontal row.

---

### QA-32: Phase 3.6 Mobile & Landscape Zero-Scroll `Despacho` Loop + `Entorno` Diorama Showcase (`375×667`, `360×780`, `390×844`, `412×915`, `667×375`)
- **Preconditions**: Mobile Chromium resized across `375×667`, `360×780`, `390×844`, `412×915`, and `667×375`, seeded run `P35-M4-HITO-72` (including 3-choice `16:9` milestone card + NPC Polaroid at Month 4).
- **Steps**:
  1. On `Despacho` (`mobile-tab-despacho`), assert `[data-testid="scene-bg"]` is NOT mounted (`count === 0` or hidden) and measure every `choice-btn-*` at `window.scrollY === 0` without scrolling.
  2. Click a choice at `window.scrollY === 0` and measure `outcome-continue-btn` against `mobile-desk-nav` (portrait) or `innerHeight` (`667×375` landscape left rail).
  3. Tap `[data-testid="mobile-tab-entorno"]` and measure `[data-testid="scene-bg"]` bounding box height.
- **Expected Result**:
  - At `window.scrollY === 0` on `Despacho`, 100% of choice buttons and `outcome-continue-btn` sit strictly above `mobile-desk-nav` on portrait phones (`375×667`, `360×780`, `390×844`, `412×915`) and inside `innerHeight` on `667×375` landscape.
  - Switching to `Entorno` displays the live `16:9` `scene-bg` diorama showcase (`>= 140px` height on standard portrait phones `360×780` / `390×844` / `412×915`, `>= 115px` on compact `375×667`, and `>= 105px` on `667×375` landscape) alongside `EntornoPanel` NPC Polaroids.

---

### QA-33: Phase 3.6 Repeat-Key Guard (`H2-06`), HUD Delta Non-Overlap (`H2-03`) & Above-the-Fold `EndRunScreen` CTAs (`H2-02`)
- **Preconditions**: Executed across `360×780`, `390×844`, `1366×768`, and `1440×900`.
- **Steps**:
  1. (`H2-06`) On `GameScreen`, focus `choice-btn-0` and dispatch synthetic `KeyboardEvent("keydown", { key: "Enter", repeat: true })` (plus `"1"` with `repeat: true`), verifying `outcome-panel` does NOT open; repeat on `outcome-continue-btn` with `repeat: true`, verifying the turn does NOT advance until a non-repeat keypress.
  2. (`H2-03`) On `360×780` and `390×844`, select a multi-stat choice (`P35-CASH-158`) and measure bounding boxes of every visible `[data-testid$="-delta"]` pill against its sibling numeric indicator value (`indicator-money-value` and gauge `%`/`/100` readout).
  3. (`H2-02`) Enter `EndRunScreen` with a freshly unlocked `AchievementToast` active across `360×780`, `390×844`, `1366×768`, and `1440×900`, and measure viewport bounds + `document.elementFromPoint(cx, cy)` on `[data-testid="end-new-run-btn"]` and `[data-testid="end-return-title-btn"]` at `window.scrollY === 0`.
- **Expected Result**:
  - Held keys (`event.repeat === true`) never auto-fire choices or advance outcomes prematurely.
  - HUD delta pills have `0px` bounding-box intersection with sibling numeric indicator values on narrow mobile viewports.
  - Both `end-new-run-btn` and `end-return-title-btn` sit 100% inside `[0, innerHeight]` at `scrollY === 0` and pass center-point hit-testing with zero `AchievementToast` occlusion across mobile and desktop.
