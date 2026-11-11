import { z } from "zod";

export const SnakeCaseIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/, "Must be lowercase snake_case");

export const RenderModeSchema = z.enum(["vector_hd", "pixel_art"]);

export const AssetCategorySchema = z.enum(["character", "background", "illustration", "ui"]);

export const AssetStatusSchema = z.enum(["placeholder", "ready"]);

export const EventCategorySchema = z.enum([
  "clientes",
  "hacienda",
  "familia",
  "empleados",
  "gestor",
]);

export const AssetEntrySchema = z
  .object({
    path: z.string().min(1),
    category: AssetCategorySchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    render_mode: RenderModeSchema,
    status: AssetStatusSchema,
  })
  .strict();

export const AssetFallbacksSchema = z
  .object({
    clientes: z.string().min(1),
    hacienda: z.string().min(1),
    familia: z.string().min(1),
    empleados: z.string().min(1),
    gestor: z.string().min(1),
  })
  .strict();

export const AssetManifestSchema = z
  .object({
    schema_version: z.literal(1),
    default_render_mode: RenderModeSchema,
    assets: z.record(z.string().min(1), AssetEntrySchema),
    fallbacks: AssetFallbacksSchema,
  })
  .strict();

export type RenderMode = z.infer<typeof RenderModeSchema>;
export type AssetCategory = z.infer<typeof AssetCategorySchema>;
export type AssetStatus = z.infer<typeof AssetStatusSchema>;
export type EventCategory = z.infer<typeof EventCategorySchema>;
export type AssetEntry = z.infer<typeof AssetEntrySchema>;
export type AssetFallbacks = z.infer<typeof AssetFallbacksSchema>;
export type AssetManifest = z.infer<typeof AssetManifestSchema>;
