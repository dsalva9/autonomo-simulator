import type {
  AssetManifest,
  BalanceConfig,
  CharacterDef,
  ContentCatalog,
  EventDef,
} from "../../src/engine/index.ts";

export function createFixtureBalance(): BalanceConfig {
  return {
    schema_version: 1,
    initial_indicators: {
      money: 3500,
      moral: 75,
      stress: 20,
      personal_life: 65,
      reputation: 35,
      fiscal_risk: 0,
    },
    base_monthly_billing: 2250,
    base_living_cost: 1250,
    autonomo_quota: 310,
    child_monthly_cost: 280,
    reputation_multiplier_min: 0.75,
    reputation_multiplier_max: 1.45,
    moral_multiplier_min: 0.7,
    moral_multiplier_max: 1.15,
    personal_life_recovery_threshold: 60,
    personal_life_monthly_stress_relief: 2,
    effective_quarterly_tax_rate: 0.28,
    deductible_tax_fraction: 0.28,
    deferral_surcharge_pct: 0.1,
    deferral_stress_penalty: 8,
    negative_cash_monthly_stress: 6,
    max_consecutive_negative_months: 3,
    hard_debt_floor: -5000,
    victory_month: 120,
    victory_money: 150000,
    gestor_tiers: {
      self: {
        monthly_fee: 0,
        inspection_shield: 0,
        quarterly_error_prob: 0.18,
        quarterly_error_surcharge: 180,
        quarterly_error_stress: 5,
      },
      cheap: {
        monthly_fee: 60,
        inspection_shield: 0.25,
        quarterly_error_prob: 0.08,
        quarterly_error_surcharge: 120,
        quarterly_error_stress: 3,
      },
      premium: {
        monthly_fee: 180,
        inspection_shield: 0.7,
        quarterly_error_prob: 0.01,
        quarterly_error_surcharge: 60,
        quarterly_error_stress: 1,
      },
    },
    default_partner_monthly_cost: 180,
    default_partner_support_modifier: 2,
    inspection_curve: {
      min_fiscal_risk: 25,
      max_probability: 0.65,
      exponent: 1.5,
      risk_decay_on_trigger: 35,
      quarterly_natural_risk_decay: 4,
      fallback_fine_base: 600,
      fallback_fine_per_risk: 12,
      fallback_stress_penalty: 12,
    },
    max_history_entries: 120,
    ending_quotes: {
      defeat_bankruptcy: "Bancarrota total.",
      defeat_burnout_stress: "Baja por ansiedad.",
      defeat_resignation_moral: "Vuelta a la oficina.",
      abandon_oposiciones: "Rumbo al temario.",
      abandon_salaried: "Contrato indefinido.",
      abandon_subsidies: "Cese de actividad.",
      retired_hero: "Diez años sobrevividos.",
      retired_rich: "Jubilación dorada.",
    },
  };
}

export function createFixtureManifest(): AssetManifest {
  return {
    schema_version: 1,
    default_render_mode: "vector_hd",
    assets: {
      char_cliente_regateador: {
        path: "characters/char_cliente_regateador.svg",
        category: "character",
        width: 512,
        height: 512,
        render_mode: "vector_hd",
        status: "placeholder",
      },
      char_inspector_hacienda: {
        path: "characters/char_inspector_hacienda.svg",
        category: "character",
        width: 512,
        height: 512,
        render_mode: "vector_hd",
        status: "placeholder",
      },
      char_gestor_barato_paco: {
        path: "characters/char_gestor_barato_paco.svg",
        category: "character",
        width: 512,
        height: 512,
        render_mode: "vector_hd",
        status: "placeholder",
      },
      char_gestor_premium_elena: {
        path: "characters/char_gestor_premium_elena.svg",
        category: "character",
        width: 512,
        height: 512,
        render_mode: "vector_hd",
        status: "placeholder",
      },
      char_pareja_alex: {
        path: "characters/char_pareja_alex.svg",
        category: "character",
        width: 512,
        height: 512,
        render_mode: "vector_hd",
        status: "placeholder",
      },
      char_empleado_junior_dani: {
        path: "characters/char_empleado_junior_dani.svg",
        category: "character",
        width: 512,
        height: 512,
        render_mode: "vector_hd",
        status: "placeholder",
      },
    },
    fallbacks: {
      clientes: "ui/fallback_clientes.svg",
      hacienda: "ui/fallback_hacienda.svg",
      familia: "ui/fallback_familia.svg",
      empleados: "ui/fallback_empleados.svg",
      gestor: "ui/fallback_gestor.svg",
    },
  };
}

export function createFixtureCharacters(): Record<string, CharacterDef> {
  return {
    cliente_regateador: {
      schema_version: 1,
      id: "cliente_regateador",
      name: "Cliente Regateador",
      role: "cliente",
      bio: "Quiere todo para ayer y sin IVA.",
      portrait_asset_id: "char_cliente_regateador",
    },
    hacienda_inspector_gomez: {
      schema_version: 1,
      id: "hacienda_inspector_gomez",
      name: "Inspector Gómez",
      role: "hacienda",
      bio: "Revisa hasta los tickets de café.",
      portrait_asset_id: "char_inspector_hacienda",
    },
    gestor_barato_paco: {
      schema_version: 1,
      id: "gestor_barato_paco",
      name: "Paco «El Rápido»",
      role: "gestor",
      bio: "Presenta modelos el último día a las 23:58.",
      portrait_asset_id: "char_gestor_barato_paco",
      gestor_params: {
        tier: "cheap",
        monthly_fee: 60,
        inspection_shield: 0.25,
      },
    },
    gestor_premium_elena: {
      schema_version: 1,
      id: "gestor_premium_elena",
      name: "Elena Fiscalista",
      role: "gestor",
      bio: "Asesoría blindada con cita previa.",
      portrait_asset_id: "char_gestor_premium_elena",
      gestor_params: {
        tier: "premium",
        monthly_fee: 180,
        inspection_shield: 0.7,
      },
    },
    pareja_alex: {
      schema_version: 1,
      id: "pareja_alex",
      name: "Álex",
      role: "pareja",
      bio: "Te recuerda que existe vida fuera del portátil.",
      portrait_asset_id: "char_pareja_alex",
      family_params: {
        monthly_cost: 180,
        support_modifier: 2,
      },
    },
    empleado_junior_dani: {
      schema_version: 1,
      id: "empleado_junior_dani",
      name: "Dani",
      role: "empleado",
      bio: "Entusiasta multiusos.",
      portrait_asset_id: "char_empleado_junior_dani",
      employee_params: {
        role_label: "Junior Multiusos",
        monthly_cost: 1400,
        billing_multiplier: 1.35,
      },
    },
  };
}

export function createFixtureEvents(): EventDef[] {
  return [
    {
      schema_version: 1,
      id: "clientes_pago_sin_factura",
      category: "clientes",
      title: "¿Sin factura?",
      body: "Te ofrecen pagar en mano por un encargo rápido.",
      tags: ["dinero_b"],
      character_id: "cliente_regateador",
      illustration_id: null,
      weight: 10,
      cooldown_months: 10,
      max_occurrences: null,
      choices: [
        {
          id: "aceptar_sobre",
          label: "Aceptar pago en efectivo",
          outcomes: [
            {
              id: "cobro_limpio",
              weight: 70,
              result_text: "Cobras sin rastro bancario, aunque sube la tensión.",
              effects: {
                cash_delta: 1500,
                stress: 8,
                moral: -3,
                fiscal_risk: 22,
                set_flags: ["cobro_en_b_reciente"],
                schedule_events: [
                  {
                    event_id: "hacienda_carta_certificada",
                    delay_months: 3,
                    probability: 0.65,
                  },
                ],
              },
            },
            {
              id: "regateo_final",
              weight: 30,
              result_text: "Te paga de menos en el último minuto.",
              effects: {
                cash_delta: 900,
                stress: 14,
                moral: -7,
                fiscal_risk: 18,
                set_flags: ["cobro_en_b_reciente"],
              },
            },
          ],
        },
        {
          id: "exigir_factura",
          label: "Emitir factura legal",
          result_text: "Todo facturado como toca.",
          effects: {
            billed_income: 1300,
            moral: 3,
            stress: 4,
            reputation: 3,
          },
        },
        {
          id: "declinar_trabajo",
          label: "Declinar el encargo",
          result_text: "Prefieres descansar.",
          effects: {
            stress: -6,
            personal_life: 4,
            reputation: -2,
          },
        },
      ],
    },
    {
      schema_version: 1,
      id: "hacienda_carta_certificada",
      category: "hacienda",
      title: "Notificación certificada",
      body: "Llega un requerimiento para aclarar movimientos.",
      character_id: "hacienda_inspector_gomez",
      illustration_id: null,
      requirements: {
        required_flags: ["cobro_en_b_reciente"],
      },
      weight: 3,
      cooldown_months: 12,
      max_occurrences: 3,
      choices: [
        {
          id: "recurrir_con_gestor",
          label: "Dejarlo en manos de tu gestor",
          requirements: {
            gestor_tiers: ["cheap", "premium"],
          },
          result_text: "Tu gestoría presenta alegaciones a tiempo.",
          effects: {
            deductible_expense: 250,
            stress: 4,
            fiscal_risk: -15,
            clear_flags: ["cobro_en_b_reciente"],
          },
        },
        {
          id: "pagar_recargo",
          label: "Pagar la paralela y olvidar el tema",
          result_text: "Duele en la cuenta, pero cierras el expediente.",
          effects: {
            cash_delta: -950,
            stress: 12,
            moral: -6,
            fiscal_risk: -20,
            clear_flags: ["cobro_en_b_reciente"],
          },
        },
      ],
    },
    {
      schema_version: 1,
      id: "clientes_encargo_urgente",
      category: "clientes",
      title: "Entrega urgente de viernes",
      body: "Un cliente pide cambios urgentes antes del lunes.",
      character_id: "cliente_regateador",
      illustration_id: null,
      weight: 15,
      cooldown_months: 0,
      max_occurrences: null,
      choices: [
        {
          id: "hacer_urgencia",
          label: "Aceptar con recargo de urgencia",
          result_text: "Facturas bien a cambio de ojeras.",
          effects: {
            billed_income: 950,
            stress: 9,
            moral: -2,
            reputation: 3,
          },
        },
        {
          id: "factura_a_60_dias",
          label: "Aceptar pago a 60 días",
          result_text: "Queda pendiente de cobro.",
          effects: {
            deferred_invoice: {
              amount: 1200,
              delay_months: 2,
              default_prob: 0.2,
            },
            stress: 5,
            reputation: 2,
          },
        },
        {
          id: "poner_limites",
          label: "Rechazar y desconectar",
          result_text: "Duermes ocho horas seguidas.",
          effects: {
            stress: -8,
            moral: 3,
            personal_life: 4,
            reputation: -2,
          },
        },
      ],
    },
    {
      schema_version: 1,
      id: "gestor_oferta_servicios",
      category: "gestor",
      title: "¿Contratar gestoría?",
      body: "Comparas presupuestos para no pelear más con el trimestre.",
      character_id: "gestor_barato_paco",
      illustration_id: null,
      weight: 8,
      cooldown_months: 8,
      max_occurrences: null,
      choices: [
        {
          id: "contratar_paco",
          label: "Contratar a Paco (60 €/mes)",
          result_text: "Paco lleva tus papeles con entusiasmo desigual.",
          effects: {
            set_gestor: {
              tier: "cheap",
              character_id: "gestor_barato_paco",
            },
            stress: -4,
          },
        },
        {
          id: "contratar_elena",
          label: "Contratar a Elena (180 €/mes)",
          result_text: "Elena audita hasta las grapas.",
          effects: {
            set_gestor: {
              tier: "premium",
              character_id: "gestor_premium_elena",
            },
            stress: -8,
          },
        },
        {
          id: "seguir_autogestion",
          label: "Seguir haciéndolo tú mismo",
          result_text: "Te ahorras la cuota mensual, de momento.",
          effects: {
            set_gestor: {
              tier: "self",
            },
            stress: 2,
          },
        },
      ],
    },
    {
      schema_version: 1,
      id: "familia_plan_fin_de_semana",
      category: "familia",
      title: "Plan de fin de semana",
      body: "Surge la oportunidad de desconectar un par de días.",
      character_id: "pareja_alex",
      illustration_id: null,
      weight: 12,
      cooldown_months: 0,
      max_occurrences: null,
      choices: [
        {
          id: "empezar_relacion",
          label: "Ir de escapada con Álex",
          requirements: {
            family_statuses: ["single"],
          },
          result_text: "Conectáis genial.",
          effects: {
            cash_delta: -120,
            stress: -10,
            moral: 6,
            personal_life: 8,
            set_family_status: {
              status: "dating",
              partner_character_id: "pareja_alex",
            },
          },
        },
        {
          id: "descansar_tranquilo",
          label: "Descansar sin mirar el correo",
          result_text: "Recargas pilas.",
          effects: {
            cash_delta: -50,
            stress: -7,
            moral: 3,
            personal_life: 5,
          },
        },
        {
          id: "quedarse_trabajando",
          label: "Adelantar trabajo atrasado",
          result_text: "Sacas facturas adelante a costa del finde.",
          effects: {
            billed_income: 600,
            stress: 8,
            moral: -3,
            personal_life: -6,
            reputation: 2,
          },
        },
      ],
    },
    {
      schema_version: 1,
      id: "empleados_primer_fichaje",
      category: "empleados",
      title: "Tu primer fichaje",
      body: "Dani busca incorporarse para ayudarte con la carga de proyectos.",
      character_id: "empleado_junior_dani",
      illustration_id: null,
      requirements: {
        min_month: 4,
        has_employee: false,
      },
      weight: 8,
      cooldown_months: 12,
      max_occurrences: 2,
      choices: [
        {
          id: "contratar_dani",
          label: "Contratar a Dani",
          result_text: "Ya no estás solo en el despacho.",
          effects: {
            hire_employee: {
              character_id: "empleado_junior_dani",
            },
            moral: 5,
            stress: 4,
          },
        },
        {
          id: "colaboracion_puntual",
          label: "Subcontratar solo un proyecto puntual",
          result_text: "Sacas el pico de trabajo deduciendo gasto.",
          effects: {
            billed_income: 1400,
            deductible_expense: 700,
            stress: 3,
            reputation: 3,
          },
        },
        {
          id: "seguir_solo",
          label: "Seguir en solitario",
          result_text: "Menos capacidad, pero menos gastos fijos.",
          effects: {
            stress: -3,
            moral: 1,
          },
        },
      ],
    },
  ];
}

export function createFixtureCatalog(): ContentCatalog {
  return {
    balance: createFixtureBalance(),
    characters: createFixtureCharacters(),
    events: createFixtureEvents(),
    manifest: createFixtureManifest(),
  };
}
