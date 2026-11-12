import { z } from "zod";

export const InitialIndicatorsSchema = z
  .object({
    money: z.number().int(),
    moral: z.number().int().min(0).max(100),
    stress: z.number().int().min(0).max(100),
    personal_life: z.number().int().min(0).max(100),
    reputation: z.number().int().min(0).max(100),
    fiscal_risk: z.number().int().min(0).max(100),
  })
  .strict();

export const GestorTierBalanceSchema = z
  .object({
    monthly_fee: z.number().int().min(0),
    inspection_shield: z.number().min(0).max(1),
    quarterly_error_prob: z.number().min(0).max(1),
    quarterly_error_surcharge: z.number().int().min(0),
    quarterly_error_stress: z.number().int().min(0),
  })
  .strict();

export const InspectionCurveSchema = z
  .object({
    min_fiscal_risk: z.number().int().min(0).max(100),
    max_probability: z.number().min(0).max(1),
    exponent: z.number().positive(),
    risk_decay_on_trigger: z.number().int().min(0).max(100),
    quarterly_natural_risk_decay: z.number().int().min(0).max(100),
    fallback_fine_base: z.number().int().min(0),
    fallback_fine_per_risk: z.number().min(0),
    fallback_stress_penalty: z.number().int().min(0),
  })
  .strict();

export const EndingQuotesSchema = z
  .object({
    defeat_bankruptcy: z.string().min(1).optional(),
    defeat_burnout_stress: z.string().min(1).optional(),
    defeat_resignation_moral: z.string().min(1).optional(),
    abandon_oposiciones: z.string().min(1).optional(),
    abandon_salaried: z.string().min(1).optional(),
    abandon_subsidies: z.string().min(1).optional(),
    retired_hero: z.string().min(1).optional(),
    retired_rich: z.string().min(1).optional(),
  })
  .strict();

export const BalanceConfigSchema = z
  .object({
    schema_version: z.literal(1),
    initial_indicators: InitialIndicatorsSchema,
    base_monthly_billing: z.number().int().min(0),
    base_living_cost: z.number().int().min(0),
    annual_living_cost_growth: z.number().int().min(0).optional(),
    autonomo_quota: z.number().int().min(0),
    child_monthly_cost: z.number().int().min(0),
    reputation_multiplier_min: z.number().positive(),
    reputation_multiplier_max: z.number().positive(),
    moral_multiplier_min: z.number().positive(),
    moral_multiplier_max: z.number().positive(),
    personal_life_recovery_threshold: z.number().int().min(0).max(100),
    personal_life_monthly_stress_relief: z.number().int().min(0),
    high_stat_decay_threshold: z.number().int().min(0).max(100).optional(),
    event_novelty_decay_k: z.number().min(0).optional(),
    effective_quarterly_tax_rate: z.number().min(0).max(1),
    deductible_tax_fraction: z.number().min(0).max(1),
    deferral_surcharge_pct: z.number().min(0).max(1),
    deferral_stress_penalty: z.number().int().min(0),
    negative_cash_monthly_stress: z.number().int().min(0),
    max_consecutive_negative_months: z.number().int().min(1),
    hard_debt_floor: z.number().int().max(0),
    victory_month: z.number().int().min(1),
    victory_money: z.number().int().min(1),
    gestor_tiers: z
      .object({
        self: GestorTierBalanceSchema,
        cheap: GestorTierBalanceSchema,
        premium: GestorTierBalanceSchema,
      })
      .strict(),
    default_partner_monthly_cost: z.number().int().min(0),
    default_partner_support_modifier: z.number(),
    inspection_curve: InspectionCurveSchema,
    max_history_entries: z.number().int().min(10),
    ending_quotes: EndingQuotesSchema.optional(),
  })
  .strict();

export type InitialIndicators = z.infer<typeof InitialIndicatorsSchema>;
export type GestorTierBalance = z.infer<typeof GestorTierBalanceSchema>;
export type InspectionCurve = z.infer<typeof InspectionCurveSchema>;
export type EndingQuotes = z.infer<typeof EndingQuotesSchema>;
export type BalanceConfig = z.infer<typeof BalanceConfigSchema>;
