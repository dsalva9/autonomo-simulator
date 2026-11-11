import { z } from "zod";
import { EventCategorySchema, SnakeCaseIdSchema } from "./asset-manifest.ts";
import { CharacterExpressionSchema } from "./character.ts";

export const GestorTierSchema = z.enum(["self", "cheap", "premium"]);

export const FamilyStatusSchema = z.enum(["single", "dating", "cohabiting", "separated"]);

export const AbandonEndingSchema = z.enum([
  "abandon_oposiciones",
  "abandon_salaried",
  "abandon_subsidies",
]);

export const StatRangeSchema = z
  .object({
    min: z.number().nullable().optional(),
    max: z.number().nullable().optional(),
  })
  .strict()
  .superRefine((range, ctx) => {
    if (range.min != null && range.max != null && range.min > range.max) {
      ctx.addIssue({
        code: "custom",
        message: "Stat requirement min cannot exceed max.",
      });
    }
  });

export const StatsRequirementSchema = z
  .object({
    money: StatRangeSchema.optional(),
    moral: StatRangeSchema.optional(),
    stress: StatRangeSchema.optional(),
    personal_life: StatRangeSchema.optional(),
    reputation: StatRangeSchema.optional(),
    fiscal_risk: StatRangeSchema.optional(),
  })
  .strict();

export const RequirementsSpecSchema = z
  .object({
    min_month: z.number().int().min(1).nullable().optional(),
    max_month: z.number().int().min(1).nullable().optional(),
    stats: StatsRequirementSchema.nullable().optional(),
    required_flags: z.array(z.string().min(1)).nullable().optional(),
    forbidden_flags: z.array(z.string().min(1)).nullable().optional(),
    gestor_tiers: z.array(GestorTierSchema).nullable().optional(),
    family_statuses: z.array(FamilyStatusSchema).nullable().optional(),
    has_employee: z.boolean().nullable().optional(),
  })
  .strict()
  .superRefine((req, ctx) => {
    if (req.min_month != null && req.max_month != null && req.min_month > req.max_month) {
      ctx.addIssue({
        code: "custom",
        path: ["min_month"],
        message: "min_month cannot exceed max_month.",
      });
    }
  });

export const DeferredInvoiceSpecSchema = z
  .object({
    amount: z.number().positive(),
    delay_months: z.number().int().min(1),
    default_prob: z.number().min(0).max(1),
  })
  .strict();

export const ScheduleEventSpecSchema = z
  .object({
    event_id: SnakeCaseIdSchema,
    delay_months: z.number().int().min(0),
    probability: z.number().min(0).max(1).optional(),
  })
  .strict();

export const AddModifierSpecSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    remaining_months: z.number().int().min(1),
    monthly_billed_delta: z.number().optional(),
    monthly_expense_delta: z.number().optional(),
    monthly_moral_delta: z.number().optional(),
    monthly_stress_delta: z.number().optional(),
  })
  .strict();

export const SetGestorSpecSchema = z
  .object({
    tier: GestorTierSchema,
    character_id: SnakeCaseIdSchema.nullable().optional(),
  })
  .strict();

export const SetFamilyStatusSpecSchema = z
  .object({
    status: FamilyStatusSchema,
    partner_character_id: SnakeCaseIdSchema.nullable().optional(),
  })
  .strict();

export const HireEmployeeSpecSchema = z
  .object({
    character_id: SnakeCaseIdSchema,
  })
  .strict();

export const DismissEmployeeSpecSchema = z
  .object({
    severance_cost: z.number().min(0),
  })
  .strict();

export const EffectsSpecSchema = z
  .object({
    billed_income: z.number().min(0).optional(),
    cash_delta: z.number().optional(),
    deductible_expense: z.number().min(0).optional(),
    deferred_invoice: DeferredInvoiceSpecSchema.optional(),
    moral: z.number().optional(),
    stress: z.number().optional(),
    personal_life: z.number().optional(),
    reputation: z.number().optional(),
    fiscal_risk: z.number().optional(),
    set_flags: z.array(z.string().min(1)).optional(),
    clear_flags: z.array(z.string().min(1)).optional(),
    schedule_events: z.array(ScheduleEventSpecSchema).optional(),
    add_modifier: AddModifierSpecSchema.optional(),
    set_gestor: SetGestorSpecSchema.optional(),
    set_family_status: SetFamilyStatusSpecSchema.optional(),
    add_child: z.number().int().min(1).optional(),
    hire_employee: HireEmployeeSpecSchema.optional(),
    dismiss_employee: DismissEmployeeSpecSchema.optional(),
    trigger_ending: AbandonEndingSchema.optional(),
  })
  .strict();

export const OutcomeSpecSchema = z
  .object({
    id: SnakeCaseIdSchema,
    weight: z.number().positive(),
    result_text: z.string().min(1),
    effects: EffectsSpecSchema,
  })
  .strict();

export const ChoiceSpecSchema = z
  .object({
    id: SnakeCaseIdSchema,
    label: z.string().min(1),
    requirements: RequirementsSpecSchema.nullable().optional(),
    result_text: z.string().min(1).nullable().optional(),
    effects: EffectsSpecSchema.nullable().optional(),
    outcomes: z.array(OutcomeSpecSchema).min(1).nullable().optional(),
  })
  .strict()
  .superRefine((choice, ctx) => {
    const hasEffects = choice.effects != null;
    const hasOutcomes = Array.isArray(choice.outcomes) && choice.outcomes.length > 0;
    if (hasEffects === hasOutcomes) {
      ctx.addIssue({
        code: "custom",
        path: ["effects"],
        message: "Choice must define exactly one of 'effects' or non-empty 'outcomes' (XOR).",
      });
    }
    if (choice.outcomes) {
      const seen = new Set<string>();
      for (const outcome of choice.outcomes) {
        if (seen.has(outcome.id)) {
          ctx.addIssue({
            code: "custom",
            path: ["outcomes"],
            message: `Duplicate outcome id '${outcome.id}' inside choice '${choice.id}'.`,
          });
        }
        seen.add(outcome.id);
      }
    }
  });

export type GestorTier = z.infer<typeof GestorTierSchema>;
export type FamilyStatus = z.infer<typeof FamilyStatusSchema>;
export type AbandonEndingId = z.infer<typeof AbandonEndingSchema>;
export type StatRange = z.infer<typeof StatRangeSchema>;
export type StatsRequirement = z.infer<typeof StatsRequirementSchema>;
export type RequirementsSpec = z.infer<typeof RequirementsSpecSchema>;
export type DeferredInvoiceSpec = z.infer<typeof DeferredInvoiceSpecSchema>;
export type ScheduleEventSpec = z.infer<typeof ScheduleEventSpecSchema>;
export type AddModifierSpec = z.infer<typeof AddModifierSpecSchema>;
export type SetGestorSpec = z.infer<typeof SetGestorSpecSchema>;
export type SetFamilyStatusSpec = z.infer<typeof SetFamilyStatusSpecSchema>;
export type HireEmployeeSpec = z.infer<typeof HireEmployeeSpecSchema>;
export type DismissEmployeeSpec = z.infer<typeof DismissEmployeeSpecSchema>;
export type EffectsSpec = z.infer<typeof EffectsSpecSchema>;
export type OutcomeSpec = z.infer<typeof OutcomeSpecSchema>;
export type ChoiceSpec = z.infer<typeof ChoiceSpecSchema>;

export function hasActiveRequirements(req?: RequirementsSpec | null): boolean {
  if (!req) {
    return false;
  }
  if (req.min_month != null || req.max_month != null) {
    return true;
  }
  if (req.stats) {
    for (const statRange of Object.values(req.stats)) {
      if (statRange && (statRange.min != null || statRange.max != null)) {
        return true;
      }
    }
  }
  if (req.required_flags && req.required_flags.length > 0) {
    return true;
  }
  if (req.forbidden_flags && req.forbidden_flags.length > 0) {
    return true;
  }
  if (req.gestor_tiers && req.gestor_tiers.length > 0) {
    return true;
  }
  if (req.family_statuses && req.family_statuses.length > 0) {
    return true;
  }
  if (req.has_employee != null) {
    return true;
  }
  return false;
}

export const EventSchema = z
  .object({
    schema_version: z.literal(1),
    id: SnakeCaseIdSchema,
    category: EventCategorySchema,
    title: z.string().min(1),
    body: z.string().min(1),
    tags: z.array(z.string().min(1)).optional(),
    character_id: SnakeCaseIdSchema.nullable().optional(),
    character_expression: CharacterExpressionSchema.nullable().optional(),
    illustration_id: SnakeCaseIdSchema.nullable().optional(),
    requirements: RequirementsSpecSchema.nullable().optional(),
    weight: z.number().min(0),
    cooldown_months: z.number().int().min(0),
    max_occurrences: z.number().int().min(1).nullable().optional(),
    exclusive_with: z.array(SnakeCaseIdSchema).optional(),
    choices: z.array(ChoiceSpecSchema).min(2),
  })
  .strict()
  .superRefine((event, ctx) => {
    const seenChoiceIds = new Set<string>();
    let hasUnconditionalChoice = false;

    for (const choice of event.choices) {
      if (seenChoiceIds.has(choice.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["choices"],
          message: `Duplicate choice id '${choice.id}' in event '${event.id}'.`,
        });
      }
      seenChoiceIds.add(choice.id);

      if (!hasActiveRequirements(choice.requirements)) {
        hasUnconditionalChoice = true;
      }
    }

    if (!hasUnconditionalChoice) {
      ctx.addIssue({
        code: "custom",
        path: ["choices"],
        message: `Event '${event.id}' must define at least one unconditional choice (anti-softlock rule).`,
      });
    }
  });

export type EventDef = z.infer<typeof EventSchema>;
