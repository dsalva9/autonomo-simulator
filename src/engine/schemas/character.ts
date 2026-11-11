import { z } from "zod";
import { SnakeCaseIdSchema } from "./asset-manifest.ts";

export const CharacterRoleSchema = z.enum(["cliente", "hacienda", "gestor", "pareja", "empleado"]);

export const CharacterExpressionSchema = z.enum(["neutral", "stressed", "angry", "pleased"]);

export const CharacterExpressionsMapSchema = z
  .object({
    neutral: SnakeCaseIdSchema.optional(),
    stressed: SnakeCaseIdSchema.optional(),
    angry: SnakeCaseIdSchema.optional(),
    pleased: SnakeCaseIdSchema.optional(),
  })
  .strict();

export const GestorPaidTierSchema = z.enum(["cheap", "premium"]);

export const GestorParamsSchema = z
  .object({
    tier: GestorPaidTierSchema,
    monthly_fee: z.number().int().min(0),
    inspection_shield: z.number().min(0).max(1),
  })
  .strict();

export const EmployeeParamsSchema = z
  .object({
    role_label: z.string().min(1),
    monthly_cost: z.number().int().min(0),
    billing_multiplier: z.number().positive(),
  })
  .strict();

export const FamilyParamsSchema = z
  .object({
    monthly_cost: z.number().int().min(0),
    support_modifier: z.number(),
  })
  .strict();

export const CharacterSchema = z
  .object({
    schema_version: z.literal(1),
    id: SnakeCaseIdSchema,
    name: z.string().min(1),
    role: CharacterRoleSchema,
    bio: z.string().min(1),
    portrait_asset_id: SnakeCaseIdSchema,
    expressions: CharacterExpressionsMapSchema.nullable().optional(),
    gestor_params: GestorParamsSchema.nullable().optional(),
    employee_params: EmployeeParamsSchema.nullable().optional(),
    family_params: FamilyParamsSchema.nullable().optional(),
  })
  .strict()
  .superRefine((char, ctx) => {
    if (char.role === "gestor" && char.gestor_params == null) {
      ctx.addIssue({
        code: "custom",
        path: ["gestor_params"],
        message: "Character with role 'gestor' must define gestor_params.",
      });
    }
    if (char.role !== "gestor" && char.gestor_params != null) {
      ctx.addIssue({
        code: "custom",
        path: ["gestor_params"],
        message: "Only characters with role 'gestor' may define gestor_params.",
      });
    }

    if (char.role === "empleado" && char.employee_params == null) {
      ctx.addIssue({
        code: "custom",
        path: ["employee_params"],
        message: "Character with role 'empleado' must define employee_params.",
      });
    }
    if (char.role !== "empleado" && char.employee_params != null) {
      ctx.addIssue({
        code: "custom",
        path: ["employee_params"],
        message: "Only characters with role 'empleado' may define employee_params.",
      });
    }

    if (char.role === "pareja" && char.family_params == null) {
      ctx.addIssue({
        code: "custom",
        path: ["family_params"],
        message: "Character with role 'pareja' must define family_params.",
      });
    }
    if (char.role !== "pareja" && char.family_params != null) {
      ctx.addIssue({
        code: "custom",
        path: ["family_params"],
        message: "Only characters with role 'pareja' may define family_params.",
      });
    }
  });

export type CharacterRole = z.infer<typeof CharacterRoleSchema>;
export type CharacterExpression = z.infer<typeof CharacterExpressionSchema>;
export type CharacterExpressionsMap = z.infer<typeof CharacterExpressionsMapSchema>;
export type GestorPaidTier = z.infer<typeof GestorPaidTierSchema>;
export type GestorParams = z.infer<typeof GestorParamsSchema>;
export type EmployeeParams = z.infer<typeof EmployeeParamsSchema>;
export type FamilyParams = z.infer<typeof FamilyParamsSchema>;
export type CharacterDef = z.infer<typeof CharacterSchema>;
