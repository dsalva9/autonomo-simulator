# Manual Test Plan — Autónomo Simulator (Phase 2)

Human-readable and Playwright-automated QA scenarios validating Phase 0–2 gameplay, the 60-event / 8-character Spanish catalog, two-step cashflow & tax-adjusted liquidity (`Caja` vs `Libre`), Style A Franco-Spanish editorial comic `.webp` art & reactive `.svg` props, zero-clip mobile/desktop geometry, procedural Web Audio & *Modo ágil* preferences, offline PWA + OpenGraph metadata, IndexedDB persistence, 15 achievements, and illustrated `1080×1350` shareable certificate generation.

---

## 1. Execution Environments & Viewports

Both targets below are **mandatory** Playwright verification gates for every user-facing change (execute Local Preview before commit/push, and Live Production Vercel after push/deployment):

| Mandatory Target | Stage | Command | URL |
|---|---|---|---|
| **Local Preview (`dist/`)** | Pre-commit / pre-push | `pnpm build && pnpm test:e2e` | `http://localhost:4173` |
| **Live Production (Vercel)** | Post-push / post-deploy | `pnpm test:e2e:prod` | `https://autonomo-simulator.vercel.app/` |

> **Custom Preview URL Override**: To verify a Vercel preview URL before merging, set `PLAYWRIGHT_BASE_URL` (PowerShell: `$env:PLAYWRIGHT_BASE_URL="https://<preview-url>"; pnpm test:e2e:prod` · macOS/Linux: `PLAYWRIGHT_BASE_URL=https://<preview-url> pnpm test:e2e:prod`).

### Mandatory Target Viewports
- **Narrow Mobile Audit**: `360 × 780` (compact Android handset profile verifying zero horizontal clip on tilted stamps, Polaroids, HUD treasury strip, modals, and bottom navigation).
- **Mobile (`mobile-chromium`)**: `390 × 844` (Pixel 7 touch profile; sticky compact HUD `<= 140px` with 4-column aligned micro-gauges, slim 1-line office subject strip, in-flow NPC Polaroid above title/body, `>= 48px` touch choice buttons, 4-tab bottom navigation bar).
- **Desktop (`desktop-chromium`)**: `1440 × 900` (Desktop Chrome; aligned 3-column workspace with live `16:9` office scene + `Entorno` Polaroids on left, narrative `EventStage` with `8:3` / `16:9` comic headers in center, and `Cuaderno de Cuentas` + `Diario de Expediente` on right).

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
  2. Verify `TitleScreen` (`[data-testid="title-screen"]`) displays official header (`MODELO 036`), title **Autónomo Simulator**, quote *«Sé tu propio jefe. Descubre por qué era mala idea.»*, and tabs for **Salón de Caídos (0)** and **Logros (0/15)**.
  3. Enter reproducible seed `FASE0-QA-2026` into `[data-testid="seed-input"]`.
  4. Click **Nueva alta en el RETA** (`[data-testid="start-run-btn"]`).
- **Expected Result**:
  - Transitions to `GameScreen` (`[data-testid="game-screen"]`).
  - Top `IndicatorBar` shows `Año 1 · Mes 1`, `Trimestre en 2 meses`, positive `Caja` (`3.216 €` after Month 1 recurring billing/expenses on `2.600 €` starting capital), `Reserva Trimestre: -620 € · Libre: 2.596 €`, and bounded gauges (`Moral`, `Estrés`, `Vida personal`, `Reputación`).
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

### QA-05: Responsive Workspace — Mobile Touch (`390×844`) vs Desktop 3-Column (`1440×900`)
- **Preconditions**: Active run on `GameScreen`.
- **Steps**:
  1. Measure bounding box height of every `[data-testid^="choice-btn-"]`.
  2. **On Mobile (`390×844`)**: Verify slim `[data-testid="scene-subject-mobile-art"]` is visible (`scene-subject-art` hidden) and bottom tab bar (`Despacho`, `Cuentas`, `Entorno`, `Historial`) has height `>= 48px` and switches panels cleanly.
  3. **On Desktop (`1440×900`)**: Verify `SceneRenderer` (`scene-subject-art` visible, `scene-subject-mobile-art` hidden), `EntornoPanel`, `EventStage`, `CuentasPanel`, and `HistorialPanel` render simultaneously across 3 columns.
- **Expected Result**:
  - Every choice button has rendered height `>= 48px` on both viewports, with zero horizontal overflow.

---

### QA-06 & QA-07: Keyboard Shortcuts (`1`–`9`, `Enter`, `Escape`), Voluntary Exit & `1080×1350` Canvas Certificate
- **Preconditions**: Active seeded run (`FASE0-KEYBOARD-END`) on `GameScreen`.
- **Steps**:
  1. Press numeric key `1` to pick Choice 1, then press `Enter` on `outcome-panel`.
  2. Click `[data-testid="abandon-run-btn"]`, press `Escape` to close, then re-open and select `[data-testid="abandon-oposiciones-btn"]`.
  3. Inspect `EndRunScreen` (`[data-testid="end-run-screen"]`), `[data-testid="end-run-illustration"]`, `[data-testid="share-canvas"]`, and click **Copiar resumen** (`[data-testid="copy-summary-btn"]`).
  4. Click **Inicio y Salón de Caídos** (`[data-testid="end-return-title-btn"]`).
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

### QA-11: Accessibility Reduced-Motion Override & Achievement Catalog Preservation
- **Preconditions**: Fresh `TitleScreen` with OS `prefers-reduced-motion: no-preference`.
- **Steps**:
  1. Click **Logros (0/15)** (`[data-testid="title-tab-achievements"]`) and inspect `[data-testid="achievements-list"]`.
  2. Click `[data-testid="toggle-reduced-motion"]` (`Reducido: SÍ`), then start a run with an NPC card (`FASE1-ALEX-3`).
  3. Inspect `getComputedStyle(polaroid).transform` on `[data-testid="event-character-polaroid"]`.
- **Expected Result**:
  - `achievements-list` preserves all 9 original Phase 1 achievement IDs within the expanded 15-achievement catalog.
  - Root container carries `data-reduced-motion="true"`, flattening `.polaroid-card` CSS transform to `none` (`matrix(1, 0, 0, 1, 0, 0)`).

---

### QA-12: Deterministic Burnout Game Over, Bespoke `16:9` Ending Comic Panel & Achievement Sync
- **Preconditions**: Seed `FASE1-BURNOUT-1601` played through Month 6 (`defeat_burnout_stress`).
- **Steps**:
  1. Complete the high-stress escalation path through Month 6 (`priorizar_cartera_clientes` → `firmar_acta_en_conformidad` → `campana_caza_clientes_verano`) and settle Month 6 Trimestre (`[data-testid="trimestre-pay-btn"]`).
  2. Inspect `[data-testid="end-run-illustration"]`, `[data-testid="end-run-quote"]`, fiscal breakdown cards, and `[data-testid="share-canvas"]`.
  3. Click `[data-testid="end-return-title-btn"]` and open **Logros**.
- **Expected Result**:
  - `EndRunScreen` renders `illus_final_ansiedad` (`960 × 540` `16:9` `.webp`, `naturalWidth > 0`), satirical quote, duration, final cash, lifetime official billing, and `1080 × 1350` `<canvas>` PNG certificate.
  - Returning to `TitleScreen` shows `primer_trimestre` and `superviviente_hacienda` stamped `SELLADO`.

---

### QA-13: Live Vercel Production Parity (`https://autonomo-simulator.vercel.app/`)
- **Preconditions**: Latest `main` deployed via Vercel CD.
- **Steps**:
  1. Execute `pnpm test:e2e:prod` running `tests/ui/phase0.spec.ts`, `tests/ui/phase1.spec.ts`, and `tests/ui/phase2.spec.ts` across `desktop-chromium` (`1440×900`) and `mobile-chromium` (`390×844`) against `https://autonomo-simulator.vercel.app/`.
- **Expected Result**:
  - 100% of E2E specs pass against live HTTPS production with HTTP `200`/`304` on all `.webp`/`.svg`/PWA/OG assets, zero `console.error`, and zero `pageerror` events.

---

## 4. Phase 2 Cashflow Timing, Tidy Geometry, PWA & Share Card Scenarios (`tests/ui/phase2.spec.ts`)

### QA-14: Two-Step Cashflow Timing & Tax-Adjusted Liquidity (`Caja` vs `Libre`)
- **Preconditions**: Fresh seeded run (`FASE2-CASH-3`) with `fastPacing` disabled (`Normal`).
- **Steps**:
  1. Start `FASE2-CASH-3` (`initial_indicators.money = 2.600 €` + Month 1 net recurring `+616 €`) and inspect `[data-testid="indicator-money"]`, `[data-testid="indicator-net-cash"]`, and `[data-testid="ledger-net-after-tax"]` in `CuentasPanel`.
  2. Select cash-reducing choice `escapada_desconexion_total` (`-90 €`) on Month 1 and inspect HUD **before** clicking **Continuar**.
  3. Click `[data-testid="outcome-continue-btn"]` and inspect HUD transition to Month 2.
  4. Select cash-increasing choice `exigir_factura_legal` (`+1.400 €`) on Month 2 and inspect HUD **before** clicking **Continuar**, then acknowledge.
- **Expected Result**:
  - Month 1 HUD displays `Caja: 3.216 €` alongside `Reserva Trimestre: -620 € · Libre: 2.596 €`, and `CuentasPanel` displays `Margen tras provisión fiscal: -4 €` (`[data-testid="ledger-net-after-tax"]`).
  - While `[data-testid="outcome-panel"]` is open on Month `N`, `[data-testid="indicator-calendar"]` remains on `Año 1 · Mes N` (never jumping prematurely to `N+1`), `[data-testid="indicator-money-value"]` reflects the immediate post-choice balance (`3.126 €` then `5.200 €`), and `[data-testid="indicator-money-delta"]` shows `-90 €` (red `#b42b24`) on cash loss and `+1.400 €` (green `#1f5c53`) on cash gain.
  - Only clicking `[data-testid="outcome-continue-btn"]` advances `indicator-calendar` to `Mes N+1` and applies the next month's recurring cashflow.

---

### QA-15: Narrow Mobile (`360×780`) & Mobile (`390×844`) Zero-Clip & Alignment Geometry Audit
- **Preconditions**: Browser resized explicitly to `{ width: 360, height: 780 }` and `{ width: 390, height: 844 }`.
- **Steps**:
  1. Measure `document.documentElement.scrollWidth <= window.innerWidth` and hero rubber-stamp (`VENTANILLA ÚNICA`) bounding box on `TitleScreen`.
  2. Start `FASE1-BANNER-1` and measure sticky `<header>` (`IndicatorBar`) height, the `y`-coordinates of all 4 micro-gauges (`indicator-moral`, `indicator-stress`, `indicator-personal-life`, `indicator-reputation`), and horizontal containment of `indicator-money`, `indicator-net-cash`, `event-character-polaroid`, `event-card`, all `choice-btn-*`, and all 4 bottom navigation tabs (`mobile-tab-*`).
  3. Cycle through `Despacho`, `Cuentas`, `Entorno`, and `Historial` tabs, open `AbandonRunModal`, advance to Month 3 `QuarterlyTaxModal`, and complete voluntary exit to `EndRunScreen`, checking `scrollWidth <= innerWidth` and modal viewport containment at every stop.
- **Expected Result**:
  - Zero horizontal overflow (`scrollWidth <= innerWidth`) across every screen, tab, and modal on both `360×780` and `390×844`.
  - Every audited element satisfies `box.x >= 0 && box.x + box.width <= viewportWidth + 0.5`; every choice button and mobile tab satisfies `box.height >= 48`.
  - Mobile `IndicatorBar` height is `<= 140px`, and all 4 micro-gauges sit on the exact same horizontal row (`Math.max(...ys) - Math.min(...ys) <= 2`).

---

### QA-16: Strict 3-Column Desktop Tidy Alignment & 15-Seal `HistorialPanel` Audit (`1440×900`)
- **Preconditions**: Desktop viewport `{ width: 1440, height: 900 }`, active run (`FASE1-BANNER-1`) scrolled to top (`scrollY === 0`).
- **Steps**:
  1. Assert `document.documentElement.scrollWidth <= 1440`.
  2. Measure bounding boxes of Left column (`[data-testid="scene-renderer"]`), Center column (`[data-testid="month-economy-strip"]` and `[data-testid="event-card"]`), and Right column (`[data-testid="panel-cuentas"]`).
  3. Inspect `[data-testid="panel-historial"]` career seals counter (`Sellos de carrera 0/15`), 15-item 2-column grid, and `scrollWidth <= clientWidth + 1`.
- **Expected Result**:
  - Strict 3-track horizontal non-overlap (`leftBox.x + leftBox.width <= centerBox.x + 1` and `centerBox.x + centerBox.width <= rightBox.x + 1`) within `1440px`.
  - Aligned top edges across all 3 columns (`Math.max(topLeft, topCenter, topRight) - Math.min(topLeft, topCenter, topRight) <= 4`).
  - `HistorialPanel` renders all `15` career seals cleanly without horizontal overflow.

---

### QA-17: Fast Pacing (*Modo ágil*) & Procedural Web Audio Mute Toggles
- **Preconditions**: Active run (`FASE2-CASH-3`) at Month 1 on `GameScreen`.
- **Steps**:
  1. Click `[data-testid="toggle-sfx-btn"]` twice, checking `aria-pressed` and `localStorage["autonomo:sfx_muted"]`.
  2. Click `[data-testid="toggle-fast-pacing-btn"]` (`aria-pressed="true"`), then click non-terminal Month 1 choice `quedarse_adelantando_entregas`.
- **Expected Result**:
  - `toggle-sfx-btn` flips cleanly between active (`aria-pressed="true"`, `sfx_muted="false"`) and muted (`aria-pressed="false"`, `sfx_muted="true"`).
  - With *Modo ágil* enabled, clicking a non-terminal choice skips `outcome-panel` and advances immediately to `Año 1 · Mes 2`'s `event-card`.

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
