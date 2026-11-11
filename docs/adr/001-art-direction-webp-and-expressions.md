# ADR 001: Art Direction WebP Asset Pipeline and Multi-Expression NPC Contracts
- **Status**: accepted
- **Date**: 2026-11-11

## Context
- Phase 0 shipped lightweight SVG placeholders and single-portrait NPCs (`CharacterDef.portrait_asset_id`) while visual direction remained open (`ARCHITECTURE.md` §16.5).
- Phase 1 locks `docs/ART_DIRECTION.md` around Franco-Spanish satirical editorial comic illustrations (*Línea Clara Satírica*) delivered as `.webp` raster panels/portraits alongside crisp standalone `.svg` reactive props and category fallbacks, all constrained to a `<= 2.2 MB` mobile asset budget.
- Recurring NPCs (`cliente`, `hacienda`, `gestor`, `pareja`, `empleado`) appear across tonally distinct scenes—from opportunistic deals to tax inspections and burnout crises—requiring expression variants without duplicating character definitions or coupling Narrative YAML authoring to physical file paths.

## Decision
- **Multi-Expression Schema Extension (`src/engine/schemas/character.ts`, `src/engine/schemas/event.ts`)**:
  - Define `CharacterExpressionSchema = z.enum(["neutral", "stressed", "angry", "pleased"])` and `CharacterExpressionsMapSchema` mapping optional expression keys to `snake_case` logical asset IDs on `CharacterSchema.expressions`.
  - Add optional `character_expression` (`CharacterExpressionSchema.nullable().optional()`) to `EventSchema`. UI resolves `character.expressions?.[expression] ?? character.portrait_asset_id` so omitting an expression variant gracefully falls back to the character's default portrait.
  - Re-emit `schemas/character.schema.json` and `schemas/event.schema.json` via `pnpm schema:emit`.
- **Zero-Dependency WebP & Budget Asset Validation (`scripts/validate-assets.ts`)**:
  - Restrict `assets/manifest.json` entries to `.svg` and `.webp` files only.
  - Parse `.webp` RIFF containers directly in Node (`RIFF....WEBP` magic header plus `VP8 ` lossy keyframe, `VP8L` lossless, and `VP8X` extended chunk headers) to assert exact pixel `width` and `height` parity against `assets/manifest.json` without native image decoding dependencies in CI.
  - Enforce hard byte ceilings per category (`background <= 145 KB`, `illustration <= 125 KB`, `character <= 70 KB`, `ui <= 20 KB`) and a `<= 2.2 MB` (`2.2 * 1024 * 1024` bytes) ceiling across the `assets/` payload.
- **Semantic Content Cross-Checks (`scripts/validate-content.ts`)**:
  - Verify every asset ID in `character.expressions` exists in `assets/manifest.json` with `category: "character"`.
  - Reject events that specify a non-null `character_expression` when `character_id` is omitted or `null`.

## Consequences
- **Zero Engine Runtime Coupling**: `src/engine/` remains 100% pure TypeScript; expression keys travel as validated declarative metadata on `CharacterDef` and `EventDef`.
- **Fast Deterministic CI Gates**: `pnpm validate:assets` catches wrong dimensions, misnamed formats, corrupt WebP containers, and mobile bundle bloat in milliseconds using pure `Buffer` inspection.
- **Graceful Incremental Content**: Existing Phase 0 fixtures and events without `expressions` or `character_expression` remain valid without migration churn, while Phase 1 characters and events gain full multi-expression comic staging.
