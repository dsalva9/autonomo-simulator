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

export const BusinessTierBalanceSchema = z
  .object({
    billing_multiplier: z.number().positive(),
    event_stakes_multiplier: z.number().positive(),
    monthly_structural_overhead: z.number().int().min(0),
    gestor_fee_multiplier: z.number().positive(),
    max_team_size: z.number().int().min(0).max(12),
    hard_debt_floor: z.number().int().max(0),
    corporate_tax_regime: z.boolean(),
    societario_quota: z.number().int().min(0).optional(),
  })
  .strict();

export const BusinessTiersConfigSchema = z
  .object({
    solo_autonomo: BusinessTierBalanceSchema,
    estudio_consolidado: BusinessTierBalanceSchema,
    sociedad_limitada: BusinessTierBalanceSchema,
    agencia_consultora: BusinessTierBalanceSchema,
  })
  .strict();

export const RetaBracketSchema = z
  .object({
    max_monthly_profit: z.number().nullable(),
    monthly_quota: z.number().int().min(0),
  })
  .strict();

export const IrpfBracketSchema = z
  .object({
    up_to_monthly_profit: z.number().nullable(),
    marginal_rate: z.number().min(0).max(1),
  })
  .strict();

export const TeamScalingBalanceSchema = z
  .object({
    default_staff_monthly_cost: z.number().int().min(800).max(6000),
    base_additional_seat_multiplier: z.number().positive(),
    seat_diminishing_factor: z.number().min(0.5).max(1),
    boutique_solo_min_reputation: z.number().int().min(0).max(100),
    boutique_solo_min_month: z.number().int().min(1),
    boutique_solo_max_bonus: z.number().min(0).max(2),
  })
  .strict();

export const ActDifficultySchema = z
  .object({
    act2_start_month: z.number().int().min(1),
    act3_start_month: z.number().int().min(1),
    act1_living_cost_growth: z.number().int().min(0),
    act2_living_cost_growth: z.number().int().min(0),
    act3_living_cost_growth: z.number().int().min(0),
    act2_market_squeeze: z.number().min(0.5).max(1.5),
    act3_market_squeeze: z.number().min(0.5).max(1.5),
    act3_monthly_stress_pressure: z.number().int().min(0).max(10),
  })
  .strict();

export const GestorComplianceSchema = z
  .object({
    premium_warning_fiscal_risk: z.number().int().min(0).max(100),
    premium_drop_fiscal_risk: z.number().int().min(0).max(100),
    sl_self_quarterly_penalty: z.number().int().min(0),
    sl_self_error_prob: z.number().min(0).max(1),
  })
  .strict();

export const PrescripcionConfigSchema = z
  .object({
    window_months: z.number().int().min(12),
    min_audit_age_months: z.number().int().min(1),
    max_audit_age_months: z.number().int().min(1),
    min_risk_points_recorded: z.number().int().min(1),
    base_quarterly_prob: z.number().min(0).max(1),
    prob_per_risk_point: z.number().min(0).max(1),
    max_quarterly_prob: z.number().min(0).max(1),
    gestor_shield_effectiveness: z.number().min(0).max(1),
    fallback_fine_rate: z.number().min(0).max(2),
    fallback_fine_min: z.number().int().min(0),
  })
  .strict();

export const PartnerPressureConfigSchema = z
  .object({
    neglect_personal_life_threshold: z.number().int().min(0).max(100),
    synergy_personal_life_threshold: z.number().int().min(0).max(100),
    crisis_weight_multiplier: z.number().positive(),
    critical_crisis_weight_multiplier: z.number().positive(),
    synergy_weight_multiplier: z.number().positive(),
    tier_event_weight_multiplier: z.number().positive(),
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
    corporate_tax_rate: z.number().min(0).max(1).optional(),
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
    business_tiers: BusinessTiersConfigSchema.optional(),
    reta_brackets: z.array(RetaBracketSchema).min(1).optional(),
    irpf_brackets: z.array(IrpfBracketSchema).min(1).optional(),
    team_scaling: TeamScalingBalanceSchema.optional(),
    act_difficulty: ActDifficultySchema.optional(),
    gestor_compliance: GestorComplianceSchema.optional(),
    prescripcion: PrescripcionConfigSchema.optional(),
    partner_pressure: PartnerPressureConfigSchema.optional(),
    max_history_entries: z.number().int().min(10),
    ending_quotes: EndingQuotesSchema.optional(),
  })
  .strict();

export type InitialIndicators = z.infer<typeof InitialIndicatorsSchema>;
export type GestorTierBalance = z.infer<typeof GestorTierBalanceSchema>;
export type InspectionCurve = z.infer<typeof InspectionCurveSchema>;
export type EndingQuotes = z.infer<typeof EndingQuotesSchema>;
export type BusinessTierBalance = z.infer<typeof BusinessTierBalanceSchema>;
export type BusinessTiersConfig = z.infer<typeof BusinessTiersConfigSchema>;
export type RetaBracket = z.infer<typeof RetaBracketSchema>;
export type IrpfBracket = z.infer<typeof IrpfBracketSchema>;
export type TeamScalingBalance = z.infer<typeof TeamScalingBalanceSchema>;
export type ActDifficultyConfig = z.infer<typeof ActDifficultySchema>;
export type GestorComplianceConfig = z.infer<typeof GestorComplianceSchema>;
export type PrescripcionConfig = z.infer<typeof PrescripcionConfigSchema>;
export type PartnerPressureConfig = z.infer<typeof PartnerPressureConfigSchema>;
export type BalanceConfig = z.infer<typeof BalanceConfigSchema>;
