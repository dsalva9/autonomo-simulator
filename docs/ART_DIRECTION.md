# Art Direction — Autónomo Simulator

> Canonical visual style guide, palette specification, asset roster, and AI art generation contract for **Autónomo Simulator**.
> Read alongside [ARCHITECTURE.md](../ARCHITECTURE.md) and [AGENTS.md](../AGENTS.md).

---

## 1. Visual Pillars & Reference Identity

**Autónomo Simulator** uses **Franco-Spanish Satirical Editorial Comic** (*"Línea Clara Satírica / Cómic Editorial Español"*) integrated into a **tactile cream-paper bureaucratic dossier UI**.

### 1.1 Core Aesthetic Pillars
1. **Expressive Brush-Pen Ink & Gouache Washes**:
   - Hand-inked comic linework in warm charcoal-black India ink (`#1f2421`) with organic calligraphic line-weight variation (thicker outer silhouettes and foreground props, finer interior cross-hatching and paper creases).
   - Warm watercolor, gouache, and editorial marker washes with subtle cold-press paper grain—never glossy 3D CGI, airbrushed neon gradients, or pixel art.
2. **Grounded Expressive Satire (Paco Roca / Modern Spanish Graphic Novel + *El Jueves* Bite)**:
   - Characters have **believable Spanish proportions** with sharp observational caricature in posture, wardrobe, eye bags, props, and micro-expressions.
   - Avoid grotesque rubber-hose anatomy (no four-armed gag limbs or surreal eyeballs popping out of magnifying glasses) so the same cast carries **both** sharp tax/client comedy and sincere family, partner, and burnout moments.
3. **Universal First-Person Protagonist Rule (Zero Fixed Avatar)**:
   - **Never depict a fixed protagonist face, hair, or gendered body** in desk backgrounds, category banners, milestone vignettes, or ending panels.
   - Frame scenes from a **first-person desk/eye-level POV** (or neutral cropped forearms/hands when exchanging an envelope or signing a form) so every player projects themselves into the chair.
4. **Tactile Paper Dossier Framing**:
   - Comic panels and Polaroid character portraits sit cleanly inside crisp cream-paper cards (`2px` `#1f2421` ink borders + hard offset ink shadows), keeping all narrative prose, choice labels, and HUD indicators in accessible HTML/CSS.
5. **Ethical Satire Guardrails**:
   - Satirize bureaucracy, late-paying clients, *"cuñados"*, hustle-culture absurdity, and tax anxiety—never punch down at or caricature people receiving public subsidies (e.g., `illus_final_abandono_subsidios` depicts quiet administrative relief/exhaustion rather than mockery).

---

## 2. Color System & UI Harmonization

All illustrations and SVG badges MUST harmonize with the CSS custom properties defined in `src/index.css` so raster comic art and HTML dossier surfaces feel printed on the same stock.

### 2.1 Canonical Palette Tokens

| Token / Role | Hex | Usage in UI & Illustrations |
|---|---|---|
| `--bg-desk` | `#e9decb` | Warm kraft/manila desk mat background behind cards |
| `--bg-desk-grid` | `#dacbb2` | Subtle dot-grid pattern on the desk mat |
| `--bg-paper` | `#fffdf8` | Primary dossier card stock & Polaroid photo border |
| `--bg-paper-warm` | `#f6efe0` | Secondary warm cream paper wash & ledger panels |
| `--bg-paper-muted` | `#efe4ce` | Muted folder tab / disabled control / manila file fill |
| `--ink-primary` / `--border-ink` | `#1f2421` | Primary comic ink linework, `2px` panel borders, hard drop shadows (avoid pure `#000000`) |
| `--ink-secondary` | `#373f3a` | Body copy & secondary cross-hatching |
| `--ink-muted` | `#4a524e` | Captions, metadata stamps, subtle background linework |
| `--stamp-red` | `#b42b24` | Hacienda alerts, *Números Rojos*, fines, negative deltas, red pushpins |
| `--stamp-emerald` | `#1f5c53` | Paid invoices, solvency, positive deltas, victory seals |
| `--stamp-blue` | `#264e7a` | Official *Gestoría* / AEAT paperwork accents, focus rings, abandonment banners |
| `--stamp-amber` | `#8f510d` | *Trimestre* warnings, caffeine/stress alerts, brass pushpins, uncertain roll badges |

### 2.2 Environmental Lighting Washes (Desk & Vignettes)
- **Mediterranean Morning / Normal (`bg_despacho_base`)**: Warm sunlit ochre (`#e6b86a`), slatted wooden *persiana* light stripes, terracotta pot (`#b86443`), brushed aluminum moka pot.
- **2 AM Burnout / High Stress (`bg_despacho_burnout`)**: Deep slate-indigo night shadows (`#243142`) contrasted against harsh cones of warm desk-lamp light (`#f7d98c`) and glowing red screen charts (`#b42b24`).
- **Overdraft Gloom / *Números Rojos* (`bg_despacho_numeros_rojos`)**: Desaturated overcast grey-taupe (`#9aa09d`) punctuated by `--stamp-red` (`#b42b24`) bank notice envelopes.
- **Thriving Studio (`bg_despacho_estudio`)**: Airy daylight cream (`#fbf6ea`), lush *monstera* greens (`#3d7a5a`), and `--stamp-emerald` (`#1f5c53`) upward chart accents.

---

## 3. Strict "Zero Baked-In Prose" Rule

> [!IMPORTANT]
> **Every `.webp` raster asset MUST contain ZERO legible words, sentences, speech bubbles, form titles, or character nameplates.**

1. **Why**: Prevents AI-generated text gibberish, guarantees crisp typography on `390×844` mobile screens without cropping or scaling blur, and keeps 100% of artwork reusable across future language localizations (`ARCHITECTURE.md` §5.5).
2. **How to Depict Documents & Screens in Art**:
   - Represent invoices, *Modelo 303* forms, contracts, and certified letters with **ruled ink lines, squiggled shorthand strokes, color-coded folder tabs, geometric charts, and wordless symbols** (`€`, `✓`, `✗`, `!`, wax/ink circles, magnifying glass, clock).
   - Never paint words like `"HACIENDA"`, `"FACTURA"`, `"IMPAGO"`, or `"TRIMESTRE"` inside `.webp` files—those stamps belong exclusively to HTML/CSS `.stamp-badge` overlays or crisp `.svg` UI icons where explicitly required.

---

## 4. UI Framing & Polaroid Presentation

### 4.1 Comic-Panel Dossier Integration
- **Desktop (`>= 1024px`)**: Preserves the 3-column workspace (`GameScreen.tsx`):
  - **Left Column (`SceneRenderer`)**: `16:9` comic-panel window (`2px solid #1f2421`) showing the reactive first-person desk + SVG prop overlays, paired with the active interlocutor dossier footer.
  - **Center Column (`EventStage`)**: Cream-paper Event Card (`#fffdf8`) featuring a wide `8:3` category/mood comic header strip (or `16:9` bespoke milestone panel when `event.illustration_id` is set) + pinned Polaroid portrait of the active NPC + HTML title, body, and choice buttons.
  - **Right Column (`CuentasPanel`)**: *Cuaderno de Cuentas* ledger.
- **Mobile (`< 1024px`)**:
  - Compact top desk strip (`SceneRenderer`) + thumb-friendly `EventStage` card where the category header strip and pinned Polaroid scale cleanly without pushing choice buttons off-screen.

### 4.2 Modular CSS Polaroid Frame Rule
- **Character `.webp` files (`512×512`, `1:1`) MUST depict only the square portrait illustration itself** (character bust from chest/shoulders up against a soft warm gouache backdrop—**do NOT bake the white Polaroid border or pushpin into the `.webp` pixels**).
- **UI CSS renders the Polaroid frame** (`bg-[#fffdf8] p-1.5 pb-4 border-2 border-[#1f2421] shadow-[3px_3px_0_rgba(31,36,33,0.88)]` with subtle `-1.5deg` / `+1.5deg` tilt and an SVG pushpin accent) on `EventStage` and `EntornoPanel`, while allowing compact `1:1` avatar thumbnails (`56×56px`) in mobile bars without double borders or clipped pins.

---

## 5. Technical Asset Specifications & Budgets

All production assets use `render_mode: "vector_hd"` in `assets/manifest.json` (`image-rendering: auto` smooth high-DPI scaling).

| Asset Class | Directory | Format | Dimensions | Aspect | Max File Size | Notes |
|---|---|---|---|---|---|---|
| **Desk State Backgrounds** | `assets/backgrounds/` | `.webp` | `1280×720` | `16:9` | `<= 140 KB` | Lossy WebP q80–85, `sRGB`, first-person POV, zero text |
| **Category / Mood Banners** | `assets/illustrations/` | `.webp` | `960×360` | `8:3` | `<= 90 KB` | Reusable header strips on `EventStage`, hands/props POV, zero text |
| **Milestone & Ending Panels** | `assets/illustrations/` | `.webp` | `960×540` | `16:9` | `<= 120 KB` | Bespoke comic scenes for major chains & all 8 `EndingId`s, zero text |
| **NPC Portrait Variants** | `assets/characters/` | `.webp` | `512×512` | `1:1` | `<= 65 KB` | Square bust illustration; Polaroid frame & nameplate rendered in HTML/CSS |
| **Reactive Props & UI Stamps** | `assets/ui/` | `.svg` | `256×256` *(props)* / `512×320` *(fallbacks)* | `1:1` / `8:5` | `<= 15 KB` | Valid standalone SVG (`xmlns`, `width`, `height`, `viewBox`), clean paths |

### Performance & Loading Budget
- **Total `assets/` payload target**: `<= 3.5 MB` across the full 60-asset Phase 3B catalog (`<= 2.2 MB` in Phase 1 MVP).
- **Loading strategy**: Eager-load `bg_despacho_base` and active turn assets; apply `decoding="async"` on all `<img>` tags and `loading="lazy"` on secondary drawer/ending illustrations so initial 4G interactive paint stays instant.

---

## 6. Canonical Phase 1 Asset Roster & Naming Conventions

Every asset ID in `assets/manifest.json` MUST be lowercase `snake_case` matching `<prefix>_<spanish_slug>`.

### 6.1 Reactive First-Person Desk States (`assets/backgrounds/`)
| Asset ID | Trigger Priority in `SceneRenderer` | Visual Description (First-Person Empty-Chair POV, Zero Text) |
|---|---|---|
| `bg_despacho_burnout` | 1 (`stress >= 75`) | 2 AM dark room lit by harsh desk lamp, leaning towers of folders, three stained coffee mugs, tangled charger cables, laptop showing downward red line |
| `bg_despacho_numeros_rojos` | 2 (`money < 0`) | Overcast grey morning light, stack of red-bordered bank envelopes on desk, empty coin tray, cold half-drunk coffee, tense austere clutter |
| `bg_despacho_estudio` | 3 (`employee !== null` or `money >= 25000 && reputation >= 65`) | Bright sunlit upgraded studio, dual monitors with green upward charts, espresso machine, *monstera* plant, second employee desk visible in background |
| `bg_despacho_base` | 4 *(Default)* | Modest Spanish home-office wooden desk by slatted wooden *persiana*, laptop, moka pot (*cafetera italiana*), spiral notebook, pen, terracotta plant |

### 6.2 Multi-Expression Recurring NPC Cast (`assets/characters/`)
Each recurring character in `content/characters/<id>.yaml` has **2–3 expression portraits** (`neutral` default + `stressed` / `angry` / `pleased` variants as dramatically appropriate) keeping identical facial structure, glasses, hair, and outfit across expressions:

| Character (`content/characters/`) | Neutral Default (`portrait_asset_id`) | Expression Variants (`expressions.*`) | Visual Character Bible |
|---|---|---|---|
| `cliente_regateador` | `char_cliente_regateador` | `pleased`: `char_cliente_regateador_complaciente`<br>`angry`: `char_cliente_regateador_enfadado` | Tan-suited smooth talker in indoor tinted glasses, open collar, flashing an opportunistic grin / gesturing with a manila envelope |
| `inspector_hacienda` | `char_inspector_hacienda` | `angry`: `char_inspector_hacienda_severo`<br>`pleased`: `char_inspector_hacienda_satisfecho` | Impeccable charcoal-grey civil-servant suit, rectangular glasses, receding hairline, holding a red fountain pen & magnifying glass |
| `gestor_barato_paco` | `char_gestor_barato_paco` | `stressed`: `char_gestor_barato_paco_estresado`<br>`pleased`: `char_gestor_barato_paco_confiado` | Rumpled short-sleeve dress shirt, loosened tie, reading glasses on tip of nose, juggling a pocket calculator and overflowing *carpetas* |
| `gestor_premium_elena` | `char_gestor_premium_elena` | `stressed`: `char_gestor_premium_elena_seria`<br>`pleased`: `char_gestor_premium_elena_satisfecha` | Sharp navy blazer, stylish geometric glasses, color-tabbed legal binder held with calm executive authority |
| `pareja_alex` | `char_pareja_alex` | `stressed`: `char_pareja_alex_cansado`<br>`pleased`: `char_pareja_alex_feliz` | Warm casual knit sweater, relatable affectionate demeanor; in `stressed` variant checks watch/sighs beside a cold dinner plate |
| `empleado_junior_dani` | `char_empleado_junior_dani` | `stressed`: `char_empleado_junior_dani_agobiado`<br>`pleased`: `char_empleado_junior_dani_motivado` | Olive hoodie, over-ear headphones around neck, clutching laptop & takeaway *cortado* cup |

*(Any additional NPCs introduced in Phase 1 Narrative expansion MUST follow this exact `char_<slug>` + `char_<slug>_<estado>` pattern.)*

### 6.3 Modular Category & Mood Banners (`assets/illustrations/banner_*.webp`)
Used on `EventStage` (`960×360`, `8:3`, `<= 90 KB`) whenever an event omits a bespoke `illustration_id`:
1. `banner_clientes_base` — Hands across a café/office table exchanging a project folder beside a steaming *cortado*.
2. `banner_clientes_tension` — Impatient client hand tapping a wristwatch beside an unpaid red-tabbed invoice folder and ringing smartphone.
3. `banner_hacienda_base` — Official stone-facade bureaucratic counter / mailbox slot with sealed registered envelope and brass ink stamp.
4. `banner_hacienda_inspeccion` — Magnifying glass hovering over spread ledger sheets, receipts, and a red ink pen under a stark desk lamp.
5. `banner_familia_base` — Warm Spanish apartment dining table at dusk: two plates, keys in a ceramic bowl, and a glowing laptop left half-open on the side.
6. `banner_empleados_base` — Two side-by-side studio desks exchanging sticky notes, cables, and coffee mugs.
7. `banner_gestor_base` — Gestoría desk stacked with color-tabbed *archivadores*, adding-machine paper ribbon, and blue rubber stamp.
8. `banner_familia_tension` — Wide late-night dining table crop: cold dinner plate covered in foil, two untouched glasses, tick-only wall clock at 11:30 (zero digits), and a glowing phone face-up on the tablecloth.
9. `banner_empleados_tension` — Wide studio desk crop: corkboard overloaded with blank colored sticky notes, tangled cables, blinking router LEDs, and three empty espresso cups.
10. `banner_gestor_urgencia` — Wide overhead desk crop: smoking vintage calculator with curling paper tape (abstract horizontal lines only, zero numbers), red-tabbed manila folders, and a brass desk bell.

*(Category SVG fallbacks `ui_fallback_{clientes,hacienda,familia,empleados,gestor}` remain in `assets/ui/` as lightweight emergency zero-network/test fallbacks.)*

### 6.4 Bespoke Ending Panels (`assets/illustrations/illus_final_*.webp`)
Rendered on `EndRunScreen` (`960×540`, `16:9`, first-person / environmental storytelling, zero text) for all 8 `EndingId` values:
1. `illus_final_bancarrota` (`defeat_bankruptcy`) — Cardboard moving box on an empty desk with unplugged monitor cord, red sealed envelopes, and closed *persiana*.
2. `illus_final_ansiedad` (`defeat_burnout_stress`) — Quiet sunlit park bench / clinic waiting room plant with a switched-off smartphone face-down beside a herbal tea cup, far from the chaotic desk.
3. `illus_final_desmotivacion` (`defeat_resignation_moral`) — Laptop lid closed with a sticky note symbol (wordless), moka pot packed away, keys left beside a stack of civil-service study binders.
4. `illus_final_oposiciones` (`abandon_oposiciones`) — Neat library study desk stacked with thick color-tabbed law binders, highlighters, and a ticking kitchen timer.
5. `illus_final_asalariado` (`abandon_salaried`) — Corporate office lanyard badge (wordless icon) resting beside a neat 9-to-5 monitor and a calm, clean coffee mug at 5:00 PM.
6. `illus_final_subsidios` (`abandon_subsidies`) — Peaceful kitchen table with a stamped administrative folder (wordless green checkmark seal), morning bread/coffee, and calm open window—dignified, never mocking.
7. `illus_final_heroe` (`retired_hero`) — Framed gold medal/laurel seal hanging above a tidy veteran studio wall calendar (10 crossed-off yearly grids, wordless), warm golden-hour light.
8. `illus_final_ricachon` (`retired_rich`) — Sun-drenched Mediterranean terrace table overlooking the sea, sunglasses resting beside an espresso and a closed leather ledger with a green ribbon.

### 6.5 Reactive Desk Props & UI Stamps (`assets/ui/*.svg`)
- `prop_facturas` (`256×256` SVG) — Crisp inked stack of quarterly tax folders with red/blue tabs (wordless).
- `prop_cafe` (`256×256` SVG) — Steaming ceramic mug / *cortado* glass with dark roast rings.
- `prop_numeros_rojos` (`256×256` SVG) — Tilted red warning emblem (`€` + downward arrow, wordless or graphic stamp).
- `prop_foto_familia` (`256×256` SVG) — Small wooden tabletop photo frame with warm abstract couple/family silhouette when `family.status !== "single"`.

### 6.6 Bespoke Career & Life Milestone Panels (`assets/illustrations/illus_hito_*.webp`)
Rendered on `EventStage` (`960×540`, `16:9`, `<= 120 KB`, first-person / environmental storytelling, zero text, zero protagonist face) when `event.illustration_id` is set on major narrative milestones:
1. `illus_hito_primer_trimestre` — First quarterly tax reckoning: desktop calculator with blank keys, stack of color-tabbed folders, wordless calendar grid with one red-circled box, steaming espresso under dramatic desk lamp light.
2. `illus_hito_inspeccion_hacienda` — Tax inspection across an austere official desk: civil-servant hands holding a magnifying glass over spread ledger sheets and a red fountain pen.
3. `illus_hito_primer_empleado` — Sunlit studio onboarding milestone: setting up a second workstation with monitor, welcome mug, headphones, and cropped hands shaking in foreground.
4. `illus_hito_crisis_familiar` — Dusk Spanish apartment dining table with two untouched cooling plates and house keys contrasted against cold blue laptop glow down the hallway.
5. `illus_hito_criatura_casa` — Spanish apartment table split down the middle between newborn baby items (pastel pacifier, unnumbered baby bottle, wooden rattle, slatted crib shadow) and freelance chaos (open laptop with abstract color blocks, espresso-ringed coffee cup, stacked folders).
6. `illus_hito_mudanza_oficina` — First-person view holding brass keys unlocking the glass door of a sunlit Spanish street-level studio/*local*, with blank taped cardboard moving boxes, rolled chair mat, and terracotta potted plant inside.
7. `illus_hito_conflicto_laboral` — Tense small-studio workstation in dramatic late-afternoon venetian blind (*persiana*) shadows: empty pushed-back office chair, unplugged over-ear headphones resting on a blank crimson-ribboned folder, and two espresso cups.

---

## 7. Prompt Engineering Contract for the Art Agent (`image-generator`)

Whenever an Art Agent generates `.webp` assets (converting `.jpg`/`.png` outputs from `image-generator` to `.webp` via `sharp` or Node tooling at target dimensions), use this prompt template:

```text
Franco-Spanish satirical editorial comic illustration in the tradition of Paco Roca and classic Spanish satirical comics (El Jueves), hand-inked with expressive charcoal-black brush-pen outlines (#1f2421) with varied calligraphic line weight, colored with warm watercolor and gouache washes on subtle cream cold-press paper (#f6efe0).
[SUBJECT & COMPOSITION DETAILS — grounded believable Spanish proportions, expressive posture and props; if desk/banner/ending, strictly FIRST-PERSON EMPTY-CHAIR POV with NO visible protagonist face or body].
Color harmony: warm cream paper, charcoal ink (#1f2421), muted terracotta/stamp red (#b42b24), deep teal-emerald (#1f5c53), bureaucratic navy (#264e7a), warm ochre amber (#8f510d).
STRICT REQUIREMENT — ZERO TEXT: Absolutely NO words, NO letters, NO numbers, NO speech bubbles, NO labels, NO signs, NO watermarks anywhere in the image. Represent any papers or screens solely with wordless ink lines, color tabs, or simple geometric chart arrows.
```

### Mandatory Post-Generation Visual Inspection
Before registering any `.webp` file as `"status": "ready"` in `assets/manifest.json`, the Art Agent MUST view the image via `read_file` and verify:
1. **Zero accidental text/letters/gibberish** on papers, mugs, badges, monitors, clocks, calculator tapes, or stamps.
2. **No protagonist face/body** in `bg_despacho_*`, `banner_*`, `illus_hito_*`, or `illus_final_*`.
3. **No baked-in white Polaroid frame or pushpin** inside `char_*.webp` (`1:1` full-bleed bust portrait so UI CSS frames it cleanly).
4. **Exact target pixel dimensions and `<=` KB budget** after WebP conversion.

---

## 8. Phase 1 Cross-Role Alignment Notes (Approved Contract Extensions)

To support the visual decisions locked in §§4–6 cleanly across roles during Phase 1:

1. **Asset Validator (`scripts/validate-assets.ts` — Programmer)**:
   - Extend `checkAssetFile` to validate `.webp` files in addition to `.svg`: verify the `RIFF....WEBP` magic header, parse exact pixel width/height from `VP8 ` / `VP8L` / `VP8X` chunks against `manifest.json`, and enforce per-category KB size warnings/caps.
2. **Multi-Expression Character Schema (`src/engine/schemas/character.ts` & `event.ts` — Programmer)**:
   - Add optional English-keyed `expressions` map on `CharacterSchema`:
     ```ts
     CharacterExpressionSchema = z.enum(["neutral", "stressed", "angry", "pleased"]);
     // On CharacterSchema:
     expressions: z.partialRecord(CharacterExpressionSchema, SnakeCaseIdSchema).optional()
     ```
   - Add optional `character_expression?: CharacterExpression` on `EventSchema` (and optionally `OutcomeSpecSchema` / `ChoiceSpecSchema` if needed, defaulting to `event.character_expression ?? "neutral"`), validated by `scripts/validate-content.ts` against `assets/manifest.json`, falling back gracefully to `character.portrait_asset_id`.
3. **Scene & Event Rendering (`SceneRenderer.tsx`, `EventStage.tsx`, `EndRunScreen.tsx` — Programmer)**:
   - `SceneRenderer` resolves the priority-ordered `bg_despacho_*` state (§6.1) + `prop_foto_familia` when `family.status !== "single"`.
   - `EventStage` renders the event's bespoke `illustration_id` (`16:9`) or modular category/mood `banner_*` (`8:3`), overlaid with the CSS-framed multi-expression NPC Polaroid when `event.character_id` is present.
   - `EndRunScreen` renders the corresponding `illus_final_*` comic panel above or beside the epitaph summary while keeping the `1080×1350` *Modelo 036-FIN* `<canvas>` share certificate crisp and instant.

---

## 9. Art Agent Acceptance Checklist (DoD)

- [ ] Every asset lives under `assets/{backgrounds,characters,illustrations,ui}/` and is registered in `assets/manifest.json` with `render_mode: "vector_hd"` and accurate `width`, `height`, and `status`.
- [ ] Every `.webp` file has been visually inspected via `read_file` and confirmed to have **zero baked-in text**, **consistent Style A ink + gouache**, **no fixed player avatar**, and **no baked-in Polaroid border on `char_*`**.
- [ ] Every recurring NPC has its neutral default portrait plus its registered expression variants with consistent facial features and wardrobe.
- [ ] `pnpm validate:assets` passes with zero errors and total `assets/` size stays within the `<= 3.5 MB` mobile budget.
