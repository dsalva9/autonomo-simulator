import type {
  CharacterDef,
  ChoiceSpec,
  EventDef,
  FamilyStatus,
  GameState,
  GestorTier,
  RequirementsSpec,
  TemporalModifier,
} from "../../engine/index.ts";

export type UILocale = "es-ES" | "en";
export type SupportedLocale = UILocale | (string & {});

export interface RegisterLocaleOverlayOptions {
  persistent?: boolean;
}

const baseLocaleOverlays = new Map<string, Record<string, string>>();
const localeOverlays = new Map<string, Record<string, string>>();

export function normalizeLocale(locale?: unknown): UILocale {
  if (typeof locale === "string" && locale.trim().toLowerCase().startsWith("en")) {
    return "en";
  }
  return "es-ES";
}

export function registerLocaleOverlay(
  locale: SupportedLocale,
  entries: Record<string, string>,
  options?: RegisterLocaleOverlayOptions,
): void {
  const target = options?.persistent ? baseLocaleOverlays : localeOverlays;
  const existing = target.get(locale) ?? {};
  target.set(locale, { ...existing, ...entries });
}

export function clearLocaleOverlays(): void {
  localeOverlays.clear();
}

/**
 * Resolves event copy by deterministic `<eventId>.<fieldPath>` path.
 * In default Spanish (`es-ES`), inline YAML strings act as authoritative fallback;
 * registered locale overlays override cleanly without changing event schemas.
 */
export function resolveEventText(
  locale: SupportedLocale,
  eventId: string,
  fieldPath: string,
  fallbackText: string,
): string {
  if (locale === "es-ES") {
    return localeOverlays.get(locale)?.[`${eventId}.${fieldPath}`] ?? fallbackText;
  }
  const fullKey = `${eventId}.${fieldPath}`;
  const runtimeTable = localeOverlays.get(locale);
  if (runtimeTable && fullKey in runtimeTable) {
    return runtimeTable[fullKey] ?? fallbackText;
  }
  const normalized = normalizeLocale(locale);
  const runtimeNormalized = localeOverlays.get(normalized);
  if (runtimeNormalized && fullKey in runtimeNormalized) {
    return runtimeNormalized[fullKey] ?? fallbackText;
  }
  const baseTable = baseLocaleOverlays.get(locale) ?? baseLocaleOverlays.get(normalized);
  if (baseTable && fullKey in baseTable) {
    return baseTable[fullKey] ?? fallbackText;
  }
  return fallbackText;
}

export function resolveEventTitle(event: EventDef, locale: SupportedLocale = "es-ES"): string {
  return resolveEventText(locale, event.id, "title", event.title);
}

export function resolveEventBody(event: EventDef, locale: SupportedLocale = "es-ES"): string {
  return resolveEventText(locale, event.id, "body", event.body);
}

export function resolveChoiceLabel(
  eventId: string,
  choice: ChoiceSpec,
  locale: SupportedLocale = "es-ES",
): string {
  return resolveEventText(locale, eventId, `choices.${choice.id}.label`, choice.label);
}

export function resolveChoiceResultText(
  eventId: string,
  choiceId: string,
  outcomeId: string | null,
  fallbackText: string | null,
  locale: SupportedLocale = "es-ES",
): string | null {
  if (!fallbackText) {
    return null;
  }
  const path = outcomeId
    ? `choices.${choiceId}.outcomes.${outcomeId}.result_text`
    : `choices.${choiceId}.result_text`;
  return resolveEventText(locale, eventId, path, fallbackText);
}

/**
 * Deterministic integer thousands formatter (`3500` -> `"3.500 €"` in `es-ES`, `"3,500 €"` or `"3.500 €"`).
 * Uses deterministic regex grouping to avoid Node/Chromium ICU differences on 4-digit numbers.
 */
export function formatIntegerEs(value: number, locale: SupportedLocale = "es-ES"): string {
  const rounded = Math.round(value);
  const negative = rounded < 0;
  const digits = Math.abs(rounded).toString();
  const sep = normalizeLocale(locale) === "en" ? "," : ".";
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return negative ? `-${grouped}` : grouped;
}

export function formatEuros(amount: number, locale: SupportedLocale = "es-ES"): string {
  return `${formatIntegerEs(amount, locale)} €`;
}

export function formatSignedEuros(amount: number, locale: SupportedLocale = "es-ES"): string {
  const rounded = Math.round(amount);
  if (rounded > 0) {
    return `+${formatIntegerEs(rounded, locale)} €`;
  }
  return `${formatIntegerEs(rounded, locale)} €`;
}

export function formatSignedInt(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) {
    return `+${rounded}`;
  }
  return `${rounded}`;
}

export function formatDurationMonthsEs(
  totalMonths: number,
  locale: SupportedLocale = "es-ES",
): string {
  const safeMonths = Math.max(0, Math.floor(totalMonths));
  const years = Math.floor(safeMonths / 12);
  const remMonths = safeMonths % 12;

  if (normalizeLocale(locale) === "en") {
    if (years === 0) {
      return `${remMonths} ${remMonths === 1 ? "month" : "months"}`;
    }
    const yearLabel = `${years} ${years === 1 ? "year" : "years"}`;
    if (remMonths === 0) {
      return `${yearLabel} (${safeMonths} months)`;
    }
    const monthLabel = `${remMonths} ${remMonths === 1 ? "month" : "months"}`;
    return `${yearLabel} and ${monthLabel} (${safeMonths} months)`;
  }

  if (years === 0) {
    return `${remMonths} ${remMonths === 1 ? "mes" : "meses"}`;
  }
  const yearLabel = `${years} ${years === 1 ? "año" : "años"}`;
  if (remMonths === 0) {
    return `${yearLabel} (${safeMonths} meses)`;
  }
  const monthLabel = `${remMonths} ${remMonths === 1 ? "mes" : "meses"}`;
  return `${yearLabel} y ${monthLabel} (${safeMonths} meses)`;
}

export function formatCalendarBadgeEs(
  month: number,
  locale: SupportedLocale = "es-ES",
): {
  year: number;
  monthOfYear: number;
  quarter: number;
  monthsUntilTrimestre: number;
  label: string;
  trimestreLabel: string;
  shortTrimestreBadge: string;
} {
  const safeMonth = Math.max(1, Math.floor(month));
  const year = Math.ceil(safeMonth / 12);
  const monthOfYear = ((safeMonth - 1) % 12) + 1;
  const quarter = Math.ceil(monthOfYear / 3);
  const mod = safeMonth % 3;
  const monthsUntilTrimestre = mod === 0 ? 0 : 3 - mod;

  if (normalizeLocale(locale) === "en") {
    const trimestreLabel =
      monthsUntilTrimestre === 0
        ? `Q${quarter} closes this month`
        : `Quarter in ${monthsUntilTrimestre} ${monthsUntilTrimestre === 1 ? "month" : "months"}`;
    const shortTrimestreBadge =
      monthsUntilTrimestre === 0 ? `Q${quarter} now` : `Q${quarter}·${monthsUntilTrimestre}m`;

    return {
      year,
      monthOfYear,
      quarter,
      monthsUntilTrimestre,
      label: `Year ${year} · Month ${monthOfYear}`,
      trimestreLabel,
      shortTrimestreBadge,
    };
  }

  const trimestreLabel =
    monthsUntilTrimestre === 0
      ? `Cierre T${quarter} este mes`
      : `Trimestre en ${monthsUntilTrimestre} ${monthsUntilTrimestre === 1 ? "mes" : "meses"}`;
  const shortTrimestreBadge =
    monthsUntilTrimestre === 0 ? `T${quarter} hoy` : `T${quarter}·${monthsUntilTrimestre}m`;

  return {
    year,
    monthOfYear,
    quarter,
    monthsUntilTrimestre,
    label: `Año ${year} · Mes ${monthOfYear}`,
    trimestreLabel,
    shortTrimestreBadge,
  };
}

export function translateGestorTier(tier: GestorTier, locale: SupportedLocale = "es-ES"): string {
  if (normalizeLocale(locale) === "en") {
    switch (tier) {
      case "self":
        return "Self-filed";
      case "cheap":
        return "Budget advisor";
      case "premium":
        return "Premium tax firm";
    }
  }
  switch (tier) {
    case "self":
      return "Autogestión";
    case "cheap":
      return "Gestor económico";
    case "premium":
      return "Asesoría premium";
  }
}

export function translateFamilyStatus(
  status: FamilyStatus,
  locale: SupportedLocale = "es-ES",
): string {
  if (normalizeLocale(locale) === "en") {
    switch (status) {
      case "single":
        return "Single";
      case "dating":
        return "Dating";
      case "cohabiting":
        return "Cohabiting";
      case "separated":
        return "Separated";
    }
  }
  switch (status) {
    case "single":
      return "Soltero/a";
    case "dating":
      return "En pareja";
    case "cohabiting":
      return "Conviviendo";
    case "separated":
      return "Separado/a";
  }
}

export function translateCategoryLabel(
  category: EventDef["category"],
  locale: SupportedLocale = "es-ES",
): string {
  if (normalizeLocale(locale) === "en") {
    switch (category) {
      case "clientes":
        return "Clients & gigs";
      case "hacienda":
        return "Tax Agency (AEAT)";
      case "familia":
        return "Family & downtime";
      case "empleados":
        return "Payroll & staff";
      case "gestor":
        return "Tax advisory";
    }
  }
  switch (category) {
    case "clientes":
      return "Clientes y encargos";
    case "hacienda":
      return "Agencia Tributaria";
    case "familia":
      return "Familia y descanso";
    case "empleados":
      return "Plantilla laboral";
    case "gestor":
      return "Gestoría fiscal";
  }
}

export function describeFiscalRiskTension(
  fiscalRisk: number,
  locale: SupportedLocale = "es-ES",
): {
  label: string;
  level: "calm" | "watched" | "critical";
} {
  const isEn = normalizeLocale(locale) === "en";
  if (fiscalRisk >= 55) {
    return { label: isEn ? "In the crosshairs" : "En el punto de mira", level: "critical" };
  }
  if (fiscalRisk >= 25) {
    return { label: isEn ? "Under watch" : "Vigilado", level: "watched" };
  }
  return { label: isEn ? "Low profile" : "Tranquilo", level: "calm" };
}

const CHARACTER_NAMES_EN: Readonly<Record<string, string>> = {
  cliente_corporativo_marta: "Marta (Corporate Procurement)",
  cliente_regateador: 'Borja "Mr. Exposure"',
  empleada_senior_laura: "Laura (Senior Specialist)",
  empleado_junior_dani: "Dani",
  gestor_barato_paco: 'Paco "Quick-File"',
  gestor_premium_elena: "Elena Montes, Tax Advisory",
  hacienda_inspector_gomez: "Inspector Gómez",
  pareja_alex: "Álex",
};

const CHARACTER_BIOS_EN: Readonly<Record<string, string>> = {
  cliente_corporativo_marta:
    "Multinational procurement lead with three committee layers just to approve a ballpoint pen. Speaks in buzzwords, forces you onto a 1998 vendor portal, and calls net-90 payment terms 'standard corporate policy'.",
  cliente_regateador:
    "Serial founder of 'disruptive' side hustles on a sandwich budget. Thinks every deliverable takes twenty minutes, sends four-minute voice notes at 9 p.m. on Fridays, and pays in exposure whenever allowed.",
  empleada_senior_laura:
    "Agency veteran who survived by enforcing clear boundaries and documenting everything in spotless notebooks. Charges what she is worth, spots disasters three weeks ahead, and shuts her laptop at six sharp.",
  empleado_junior_dani:
    "Fresh out of three bootcamps with forty open browser tabs, a liter-and-a-half thermos, and genuine enthusiasm. Ships plenty of work, though he has a gift for touching the wrong production folder on Friday evenings.",
  gestor_barato_paco:
    "Neighborhood bookkeeper working above a churro shop with spreadsheets inherited from 2007. Files quarterly returns at 23:58 on deadline day with a thumbs-up emoji, though for sixty euros a month you cannot ask for poetry.",
  gestor_premium_elena:
    "Relentless tax specialist who demands every numbered invoice before the fifth of the month. Her monthly retainer stings like rubbing alcohol, yet even tax auditors address her formally.",
  hacienda_inspector_gomez:
    "Veteran Tax Agency auditor with X-ray vision for Sunday restaurant receipts. Never raises his voice: a single Friday-afternoon electronic notice is enough to ruin your long weekend.",
  pareja_alex:
    "Someone with humane working hours who reminds you that weekends, offline dinners, and life beyond quarterly tax filings exist. Shows up with croquettes and hides your laptop charger when burnout looms.",
};

const CHARACTER_ROLES_ES: Readonly<Record<CharacterDef["role"], string>> = {
  cliente: "Cliente",
  gestor: "Gestoría",
  hacienda: "Inspección AEAT",
  pareja: "Entorno personal",
  empleado: "Plantilla",
};

const CHARACTER_ROLES_EN: Readonly<Record<CharacterDef["role"], string>> = {
  cliente: "Client",
  gestor: "Tax Advisor",
  hacienda: "Tax Auditor",
  pareja: "Personal Life",
  empleado: "Staff",
};

const EMPLOYEE_ROLE_LABELS_EN: Readonly<Record<string, string>> = {
  "Especialista sénior": "Senior Specialist",
  "Junior Multiusos": "All-Rounder Junior",
};

export const MODIFIER_LABELS_BY_ID_EN: Readonly<Record<string, string>> = {
  // Clientes
  mod_renting_equipo: "Work equipment lease",
  mod_iguala_recomendacion: "Word-of-mouth retainer",
  mod_iguala_sla_marta: "Priority corporate retainer",
  mod_bolsa_horas_marta: "Corporate prepaid hours",
  mod_ahorro_software_libre: "Zero-subscription toolstack",
  mod_cartera_veterana_total: "Veteran account renewal push",
  mod_cartera_curada_senior: "Curated veteran client roster",
  mod_tarifas_ipc: "Inflation-adjusted rates",
  mod_soporte_custodia: "Archive custody & maintenance",
  mod_supervision_flujo_ia: "Monthly AI workflow oversight",
  mod_consejero_externo: "External advisory board seat",
  mod_esposas_oro_vip: "24/7 VIP golden-handcuffs retainer",
  mod_iguala_vip_sana: "Bounded VIP retainer",
  mod_cliente_directivo_fiel: "Executive referral retainer",
  mod_iguala_recalculada: "Retainer repriced to real hours",
  mod_iguala_berlin_completa: "Full Berlin remote retainer",
  mod_iguala_berlin_media: "Part-time Berlin advisory",
  mod_ticket_minimo_senior: "High-margin senior positioning",
  // Empleados
  mod_ritmo_baja_estudio: "Reduced capacity on sick leave",
  protocolo_calidad_estudio: "Studio backup & QA protocol",
  mejora_salarial_plantilla: "Team raise & bonus plan",
  jornada_flexible_estudio: "Flexible hours & meeting-free Fridays",
  desmotivacion_plantilla: "Demoralized staff doing bare minimum",
  mod_equipo_veterano_motivado: "Veteran studio firing on all cylinders",
  mod_frialdad_sin_prima: "Frozen-bonus resentment",
  mod_revision_ipc_plantilla: "Consolidated annual COLA raise",
  mod_malestar_absorcion_salarial: "De-facto wage-freeze apathy",
  mod_puesto_renovado_estudio: "Fast rig & ergonomic workstation",
  mod_equipo_lento_prestado: "Slow loaner laptop bottleneck",
  mod_bolsa_externa_dani: "Monthly external support pool",
  mod_retencion_clave_estudio: "Counter-offer retention pact",
  mod_dani_formacion_aplicada: "Streamlined workflows post-training",
  mod_dani_mejora_parcial: "Partial internal tooling upgrade",
  mod_cartera_saneada_laura: "Pruned high-margin client roster",
  mod_pacto_reconciliacion_laboral: "Renewed studio working truce",
  mod_estudio_pie_calle: "Shared street-level studio",
  mod_red_senior_preferente: "Priority senior freelancer network",
  mod_remoto_estable_provincia: "Focused provincial remote setup",
  mod_pase_coworking_plantilla: "Staff coworking desk pass",
  mod_dani_semi_senior: "Dani stepped up to mid-level",
  mod_procesos_estudio_fluidos: "Streamlined team SOPs & templates",
  mod_incentivo_beneficios_anual: "Annual profit-sharing plan",
  mod_alza_seguridad_social_empresa: "Employer Social Security hike",
  // Familia
  pacto_desconexion_familiar: "Strengthened family bond",
  mod_impulso_carrera_alex: "Álex's new career chapter",
  permiso_crianza_autonomo: "Sleepless nights & parenting schedule",
  malabares_escuela_infantil: "Daycare fees & early-morning shifts",
  alquiler_gastos_compartidos: "Shared rent & utilities",
  despacho_propio_en_casa: "Dedicated studio & tidy home life",
  mod_subida_vivienda: "Rent & housing hike",
  mod_cuota_vivienda_amortizada: "Eased housing payment",
  mod_pico_luz_invierno: "Space-heater winter power spike",
  mod_habitos_salud_veterano: "Medical checkup & healthy habits",
  mod_espalda_cuidada: "Physio & ergonomic back care",
  mod_rutina_deporte_activa: "Consistent workout routine",
  mod_obras_edificio_ruido: "Building works & special assessment",
  mod_terapia_limites_sanos: "Therapy & healthy boundaries",
  mod_hogar_climatizado: "Soundproofed energy-efficient home",
  mod_taller_analogico: "Screen-free Tuesday pottery class",
  mod_permiso_bebe_casa: "Hands-on newborn care at home",
  mod_alquiler_inflado_casero: "Inflated lease-renewal rent",
  mod_suministros_optimizados: "Renegotiated home utility bills",
  mod_presidencia_escalera: "HOA presidency draining hours",
  mod_hipoteca_tipo_fijo: "Fixed-rate mortgage shield",
  mod_paseos_mascota_diarios: "Daily off-screen dog walks",
  mod_complicidad_hogar_veterano: "Quarter-proof supportive home",
  mod_semana_cuatro_dias_senior: "Veteran four-day workweek",
  // Gestor
  mod_estudio_renovado_veterano: "Upgraded studio hardware",
  mod_desgaste_equipos_veteranos: "Aging hardware on its last legs",
  mod_cuota_facturacion_digital: "Certified e-invoicing subscription",
  mod_plan_cierre_anual: "Optimized fiscal closing",
  mod_estructura_mercantil_b2b: "Incorporated B2B structure",
  mod_acreditacion_tecnica_elena: "Tax-deductible R&D accreditation",
  mod_precierre_noviembre_elena: "Cushioned annual IRPF bracket",
  mod_anexo_defensa_elena: "Tax-audit legal defense rider",
  mod_tramo_reta_calibrado: "Calibrated RETA bracket",
  mod_cobertura_social_veterana: "Enhanced social-security coverage",
  // Hacienda
  mod_fraccionamiento_apremio: "Tax-collection installment plan",
  mod_paz_fiscal_veterana: "Spotless historical tax record",
  mod_regularizacion_reta: "Contribution bracket adjustment",
  mod_mini_aplazamiento_aeat: "Interest-bearing mini tax deferral",
  mod_reta_veterano_tramo: "Veteran RETA bracket true-up",
};

export const MODIFIER_LABELS_EN: Readonly<Record<string, string>> = {
  "Renting equipo de trabajo": "Work equipment lease",
  "Iguala por boca-oreja": "Word-of-mouth retainer",
  "Iguala prioritaria corporativa": "Priority corporate retainer",
  "Bolsa de horas corporativa": "Corporate prepaid hours",
  "Herramientas sin peaje mensual": "Zero-subscription toolstack",
  "Renovación intensiva de cuentas veteranas": "Veteran account renewal push",
  "Cartera veterana seleccionada": "Curated veteran client roster",
  "Tarifas actualizadas al IPC": "Inflation-adjusted rates",
  "Mantenimiento y custodia": "Archive custody & maintenance",
  "Supervisión mensual de flujos": "Monthly AI workflow oversight",
  "Consejero externo de comité": "External advisory board seat",
  "Iguala VIP 24/7": "24/7 VIP golden-handcuffs retainer",
  "Iguala VIP con desconexión": "Bounded VIP retainer",
  "Acuerdo con nueva dirección": "Executive referral retainer",
  "Iguala reajustada a horas reales": "Retainer repriced to real hours",
  "Iguala remota con Berlín": "Full Berlin remote retainer",
  "Asesoría parcial Berlín": "Part-time Berlin advisory",
  "Posicionamiento sénior de alto margen": "High-margin senior positioning",
  "Capacidad reducida por baja médica": "Reduced capacity on sick leave",
  "Protocolo de copias y revisión en estudio": "Studio backup & QA protocol",
  "Mejora salarial e incentivos de equipo": "Team raise & bonus plan",
  "Jornada flexible y viernes sin reuniones": "Flexible hours & meeting-free Fridays",
  "Plantilla desmotivada al mínimo estricto": "Demoralized staff doing bare minimum",
  "Estudio veterano a pleno rendimiento": "Veteran studio firing on all cylinders",
  "Desencanto por prima congelada": "Frozen-bonus resentment",
  "Revisión salarial anual consolidada": "Consolidated annual COLA raise",
  "Apatía por sueldo congelado de facto": "De-facto wage-freeze apathy",
  "Equipo rápido y puesto ergonómico": "Fast rig & ergonomic workstation",
  "Ordenador antiguo haciendo cuello de botella": "Slow loaner laptop bottleneck",
  "Bolsa mensual de apoyo externo": "Monthly external support pool",
  "Compromiso reforzado frente a la competencia": "Counter-offer retention pact",
  "Flujos ágiles tras formación técnica": "Streamlined workflows post-training",
  "Mejora parcial de herramientas internas": "Partial internal tooling upgrade",
  "Cartera depurada de alta rentabilidad": "Pruned high-margin client roster",
  "Acuerdo renovado de convivencia en estudio": "Renewed studio working truce",
  "Estudio compartido a pie de calle": "Shared street-level studio",
  "Red externa preferente garantizada": "Priority senior freelancer network",
  "Trabajo remoto estable y enfocado": "Focused provincial remote setup",
  "Pase de coworking para plantilla": "Staff coworking desk pass",
  "Dani consolidado como perfil intermedio": "Dani stepped up to mid-level",
  "Procesos internos afinados en equipo": "Streamlined team SOPs & templates",
  "Participación anual en beneficios": "Annual profit-sharing plan",
  "Subida de cotización empresarial": "Employer Social Security hike",
  "Vínculo familiar reforzado": "Strengthened family bond",
  "Nueva etapa profesional de Álex": "Álex's new career chapter",
  "Noches en vela y horario reducido de crianza": "Sleepless nights & parenting schedule",
  "Escuela infantil y turnos de madrugada": "Daycare fees & early-morning shifts",
  "Alquiler y suministros compartidos": "Shared rent & utilities",
  "Despacho propio y convivencia ordenada": "Dedicated studio & tidy home life",
  "Revisión al alza de vivienda": "Rent & housing hike",
  "Cuota de vivienda aliviada": "Eased housing payment",
  "Pico de luz por calefactor": "Space-heater winter power spike",
  "Revisión médica y buenos hábitos": "Medical checkup & healthy habits",
  "Ergonomía y espalda al día": "Physio & ergonomic back care",
  "Rutina deportiva cumplida": "Consistent workout routine",
  "Obras y derrama en el bloque": "Building works & special assessment",
  "Terapia y límites saludables": "Therapy & healthy boundaries",
  "Hogar insonorizado y eficiente": "Soundproofed energy-efficient home",
  "Martes de taller sin pantallas": "Screen-free Tuesday pottery class",
  "Crianza intensiva en casa": "Hands-on newborn care at home",
  "Alquiler inflado tras renovación": "Inflated lease-renewal rent",
  "Recibos domésticos renegociados": "Renegotiated home utility bills",
  "Presidencia vecinal absorbiendo horas": "HOA presidency draining hours",
  "Cuota blindada a tipo fijo": "Fixed-rate mortgage shield",
  "Paseos diarios con tu mascota": "Daily off-screen dog walks",
  "Hogar cómplice a prueba de trimestres": "Quarter-proof supportive home",
  "Semana veterana de cuatro días": "Veteran four-day workweek",
  "Equipamiento de estudio renovado": "Upgraded studio hardware",
  "Equipos veteranos al límite": "Aging hardware on its last legs",
  "Suscripción software facturación verificable": "Certified e-invoicing subscription",
  "Cierre fiscal optimizado": "Optimized fiscal closing",
  "Estructura mercantil B2B": "Incorporated B2B structure",
  "Acreditación técnica deducible": "Tax-deductible R&D accreditation",
  "Tramo anual amortiguado": "Cushioned annual IRPF bracket",
  "Cobertura jurídica tributaria": "Tax-audit legal defense rider",
  "Tramo de cotización calibrado": "Calibrated RETA bracket",
  "Cobertura profesional reforzada": "Enhanced social-security coverage",
  "Fraccionamiento de deuda en recaudación": "Tax-collection installment plan",
  "Expediente histórico impoluto": "Spotless historical tax record",
  "Regularización tramo cuota": "Contribution bracket adjustment",
  "Miniaplazamiento con intereses": "Interest-bearing mini tax deferral",
  "Ajuste veterano de tramo RETA": "Veteran RETA bracket true-up",
};

export function translateCharacterName(
  character: Pick<CharacterDef, "id" | "name">,
  locale: SupportedLocale = "es-ES",
): string {
  if (normalizeLocale(locale) === "en") {
    return CHARACTER_NAMES_EN[character.id] ?? character.name;
  }
  return character.name;
}

export function translateCharacterBio(
  character: Pick<CharacterDef, "id" | "bio">,
  locale: SupportedLocale = "es-ES",
): string {
  if (normalizeLocale(locale) === "en") {
    return CHARACTER_BIOS_EN[character.id] ?? character.bio;
  }
  return character.bio;
}

export function translateCharacterRole(
  role: CharacterDef["role"],
  locale: SupportedLocale = "es-ES",
): string {
  if (normalizeLocale(locale) === "en") {
    return CHARACTER_ROLES_EN[role] ?? role;
  }
  return CHARACTER_ROLES_ES[role] ?? role;
}

export function translateEmployeeRoleLabel(
  roleLabel: string,
  locale: SupportedLocale = "es-ES",
): string {
  if (normalizeLocale(locale) === "en") {
    return EMPLOYEE_ROLE_LABELS_EN[roleLabel] ?? roleLabel;
  }
  return roleLabel;
}

export function translateModifierLabel(
  modifierOrLabel: string | Pick<TemporalModifier, "id" | "label">,
  locale: SupportedLocale = "es-ES",
): string {
  const fallbackLabel =
    typeof modifierOrLabel === "string" ? modifierOrLabel : modifierOrLabel.label;
  if (normalizeLocale(locale) === "en") {
    if (typeof modifierOrLabel !== "string") {
      return (
        MODIFIER_LABELS_BY_ID_EN[modifierOrLabel.id] ??
        MODIFIER_LABELS_EN[modifierOrLabel.label] ??
        fallbackLabel
      );
    }
    return (
      MODIFIER_LABELS_BY_ID_EN[modifierOrLabel] ??
      MODIFIER_LABELS_EN[modifierOrLabel] ??
      fallbackLabel
    );
  }
  return fallbackLabel;
}

const STAT_LABELS_ES: Record<keyof NonNullable<RequirementsSpec["stats"]>, string> = {
  money: "Dinero",
  moral: "Moral",
  stress: "Estrés",
  personal_life: "Vida personal",
  reputation: "Reputación",
  fiscal_risk: "Riesgo fiscal",
};

const STAT_LABELS_EN: Record<keyof NonNullable<RequirementsSpec["stats"]>, string> = {
  money: "Cash",
  moral: "Morale",
  stress: "Stress",
  personal_life: "Personal life",
  reputation: "Reputation",
  fiscal_risk: "Fiscal risk",
};

export const EXACT_FLAG_LABELS_ES: Readonly<Record<string, string>> = {
  cobro_en_b_reciente: "cobro en B reciente",
  inspeccion_en_curso: "inspección en curso",
  pareja_estable: "pareja estable",
  cliente_corporativo_activo: "cliente corporativo activo",
  cliente_fijo_activo: "cliente de iguala activo",
  cliente_internacional_activo: "cliente internacional activo",
  certificado_digital_caducado: "certificado digital caducado",
  reclamacion_judicial_activa: "reclamación judicial activa",
  sancion_hacienda_previa: "sanción previa de Hacienda",
  burnout_aviso_medico: "aviso médico por agotamiento",
  acuerdo_colaboradores_firmado: "acuerdo de colaboradores firmado",
  estudio_calle_alquilado: "estudio a pie de calle alquilado",
  estudio_propio_activo: "estudio propio activo",
  desgaste_plantilla: "desgaste en la plantilla",
  criatura_en_casa: "criatura en casa",
  impago_pendiente: "impago de cliente pendiente",
  clausula_pausa_firmada: "cláusula de pausa firmada",
  ex_pareja_alex: "ex pareja (Álex)",
  historia_con_alex: "historia previa con Álex",
  relacion_con_alex: "relación con Álex",
  web_corporativa_activa: "web corporativa activa",
  portfolio_actualizado: "portfolio actualizado",
  convivencia_estable: "convivencia estable",
  crisis_pareja_latente: "crisis de pareja latente",
  disciplina_fiscal_aprendida: "disciplina fiscal aprendida",
  dossier_sl_elena: "dossier de S.L. de Elena",
  empleada_laura_activa: "Laura (sénior) en plantilla",
  empleado_dani_activo: "Dani (junior) en plantilla",
  expediente_inspeccion_abierto: "expediente de inspección abierto",
  mudanza_reciente: "mudanza reciente",
  proveedor_corporativo_activo: "homologación de proveedor corporativo",
  registro_horario_al_dia: "registro horario al día",
  sofa_oficina_paco: "sofá deducido con Paco",
  susto_con_paco: "susto fiscal previo con Paco",
  tickets_dudosos_deducidos: "tickets dudosos deducidos",
  sociedad_limitada_activa: "sociedad limitada activa",
  homologacion_proveedor_activa: "homologación de proveedor activa",
  baja_medica_reciente: "baja médica reciente",
  auditoria_vies_superada: "auditoría VIES superada",
  regularizacion_reta_pendiente: "regularización de tramo RETA pendiente",
  mascota_en_casa: "mascota en casa",
  sin_mascota_decidido: "decisión de seguir sin mascota",
};

export const EXACT_FLAG_LABELS_EN: Readonly<Record<string, string>> = {
  cobro_en_b_reciente: "recent off-the-books payment",
  inspeccion_en_curso: "ongoing tax audit",
  pareja_estable: "steady partner",
  cliente_corporativo_activo: "active corporate client",
  cliente_fijo_activo: "active retainer client",
  cliente_internacional_activo: "active international client",
  certificado_digital_caducado: "expired digital certificate",
  reclamacion_judicial_activa: "active legal claim",
  sancion_hacienda_previa: "prior tax penalty",
  burnout_aviso_medico: "medical burnout warning",
  acuerdo_colaboradores_firmado: "signed partner network agreement",
  estudio_calle_alquilado: "rented street-level studio",
  estudio_propio_activo: "active private studio",
  desgaste_plantilla: "staff burnout tension",
  criatura_en_casa: "baby at home",
  impago_pendiente: "unpaid client invoice",
  clausula_pausa_firmada: "signed project-pause clause",
  ex_pareja_alex: "history as Álex's ex-partner",
  historia_con_alex: "prior relationship with Álex",
  relacion_con_alex: "relationship with Álex",
  web_corporativa_activa: "live business website",
  portfolio_actualizado: "updated portfolio",
  convivencia_estable: "stable cohabitation",
  crisis_pareja_latente: "simmering relationship strain",
  disciplina_fiscal_aprendida: "learned tax discipline",
  dossier_sl_elena: "Elena's incorporation dossier",
  empleada_laura_activa: "senior specialist Laura on payroll",
  empleado_dani_activo: "junior assistant Dani on payroll",
  expediente_inspeccion_abierto: "open tax audit file",
  mudanza_reciente: "recent home move",
  proveedor_corporativo_activo: "approved corporate vendor status",
  registro_horario_al_dia: "up-to-date staff time-tracking log",
  sofa_oficina_paco: "Paco's office-sofa deduction",
  susto_con_paco: "prior filing scare with Paco",
  tickets_dudosos_deducidos: "questionable receipts deducted",
  sociedad_limitada_activa: "incorporated LLC structure",
  homologacion_proveedor_activa: "approved corporate vendor onboarding",
  baja_medica_reciente: "recent medical leave",
  auditoria_vies_superada: "passed EU VAT (VIES) audit",
  regularizacion_reta_pendiente: "pending RETA bracket true-up",
  mascota_en_casa: "pet at home",
  sin_mascota_decidido: "decided against getting a pet",
};

const FLAG_WORD_GLOSSARY_EN: Readonly<Record<string, string>> = {
  abierto: "open",
  abierta: "open",
  activo: "active",
  activa: "active",
  actualizado: "updated",
  actualizada: "updated",
  acuerdo: "agreement",
  al: "up-to",
  alex: "Álex",
  alquilado: "rented",
  alquiler: "rent",
  ampliacion: "expansion",
  anual: "annual",
  aplazamiento: "deferral",
  aprendida: "learned",
  asesoria: "advisory",
  auditoria: "audit",
  aviso: "warning",
  b: "cash",
  baja: "leave",
  barato: "budget",
  bodas: "wedding",
  burnout: "burnout",
  caducado: "expired",
  calle: "street",
  carta: "letter",
  casa: "home",
  certificado: "certificate",
  cierre: "closing",
  clausula: "clause",
  cliente: "client",
  cobro: "payment",
  colaboradores: "collaborators",
  con: "with",
  convivencia: "cohabitation",
  corporativa: "corporate",
  criatura: "baby",
  dani: "Dani",
  de: "of",
  deducidos: "deducted",
  del: "of",
  desgaste: "wear",
  dia: "date",
  disciplina: "discipline",
  dossier: "dossier",
  dudosos: "questionable",
  elena: "Elena",
  estudio: "studio",
  ex: "ex",
  expediente: "file",
  firmada: "signed",
  firmado: "signed",
  historia: "history",
  homologacion: "onboarding",
  horario: "time-tracking",
  internacional: "international",
  latente: "latent",
  laura: "Laura",
  limitada: "LLC",
  medica: "medical",
  paco: "Paco",
  pausa: "pause",
  plantilla: "staff",
  portfolio: "portfolio",
  propio: "private",
  proveedor: "vendor",
  registro: "log",
  regularizacion: "true-up",
  relacion: "relationship",
  reta: "RETA",
  sl: "LLC",
  sociedad: "company",
  sofa: "sofa",
  superada: "passed",
  susto: "scare",
  tickets: "receipts",
  vies: "VIES",
  web: "website",
  conflicto: "conflict",
  contrato: "contract",
  corporativo: "corporate",
  crisis: "crisis",
  curso: "progress",
  datos: "data",
  deuda: "debt",
  digital: "digital",
  empleado: "employee",
  empleada: "employee",
  empresa: "company",
  en: "in",
  equipo: "equipment",
  especialista: "specialist",
  estable: "steady",
  extra: "extra",
  factura: "invoice",
  familia: "family",
  fijo: "retainer",
  fiscal: "tax",
  formacion: "training",
  gestor: "advisor",
  gestoria: "advisory",
  guarderia: "daycare",
  hacienda: "tax agency",
  hijo: "child",
  hogar: "household",
  impago: "unpaid invoice",
  inspeccion: "tax audit",
  judicial: "legal",
  junior: "junior",
  local: "office",
  medico: "medical",
  moroso: "late payer",
  mudanza: "relocation",
  multa: "fine",
  negociacion: "negotiation",
  nomina: "payroll",
  nuevo: "new",
  nueva: "new",
  oficina: "office",
  pago: "payment",
  pareja: "partner",
  pendiente: "pending",
  plazo: "deadline",
  portal: "portal",
  premium: "premium",
  prestamo: "loan",
  previa: "prior",
  previo: "prior",
  proyecto: "project",
  queja: "complaint",
  reciente: "recent",
  reclamacion: "claim",
  recorte: "cutback",
  reforma: "renovation",
  requerimiento: "tax notice",
  retraso: "delay",
  revision: "review",
  ruptura: "breakup",
  sancion: "penalty",
  senior: "senior",
  sin: "without",
  software: "software",
  subida: "increase",
  tarifa: "rate",
  urgente: "urgent",
  vacaciones: "vacation",
};

const CALENDAR_MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

const CALENDAR_MONTH_NAMES_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function humanizeFlag(flag: string, locale: SupportedLocale = "es-ES"): string {
  if (normalizeLocale(locale) === "en") {
    const exact = EXACT_FLAG_LABELS_EN[flag];
    if (exact) {
      return exact;
    }
    return flag
      .split("_")
      .filter(Boolean)
      .map((token) => FLAG_WORD_GLOSSARY_EN[token] ?? token)
      .join(" ");
  }
  return EXACT_FLAG_LABELS_ES[flag] ?? flag.replace(/_/g, " ");
}

/**
 * Produces human-readable localized reasons explaining why a choice's requirements
 * are not currently met by `state`.
 */
export function explainChoiceLockReasons(
  state: GameState,
  requirements?: RequirementsSpec | null,
  locale: SupportedLocale = "es-ES",
): string[] {
  if (!requirements) {
    return [];
  }

  const isEn = normalizeLocale(locale) === "en";
  const reasons: string[] = [];

  if (requirements.min_month != null && state.month < requirements.min_month) {
    reasons.push(
      isEn
        ? `Available from month ${requirements.min_month}`
        : `Disponible a partir del mes ${requirements.min_month}`,
    );
  }
  if (requirements.max_month != null && state.month > requirements.max_month) {
    reasons.push(
      isEn
        ? `Only available until month ${requirements.max_month}`
        : `Solo disponible hasta el mes ${requirements.max_month}`,
    );
  }

  if (requirements.stats) {
    const statKeys = Object.keys(requirements.stats) as (keyof NonNullable<
      RequirementsSpec["stats"]
    >)[];
    for (const key of statKeys) {
      const range = requirements.stats[key];
      if (!range) {
        continue;
      }
      const currentVal = key === "fiscal_risk" ? state.fiscal_risk : state.indicators[key];
      const label = isEn ? STAT_LABELS_EN[key] : STAT_LABELS_ES[key];
      if (range.min != null && currentVal < range.min) {
        const formattedMin = key === "money" ? formatEuros(range.min, locale) : String(range.min);
        reasons.push(
          isEn
            ? `Requires min. ${label} ${formattedMin}`
            : `Requiere ${label} mín. ${formattedMin}`,
        );
      }
      if (range.max != null && currentVal > range.max) {
        const formattedMax = key === "money" ? formatEuros(range.max, locale) : String(range.max);
        reasons.push(
          isEn
            ? `Requires max. ${label} ${formattedMax}`
            : `Requiere ${label} máx. ${formattedMax}`,
        );
      }
    }
  }

  if (requirements.required_flags) {
    for (const flag of requirements.required_flags) {
      if (!state.flags[flag]) {
        const humanized = humanizeFlag(flag, locale);
        reasons.push(isEn ? `Requires "${humanized}"` : `Requiere «${humanized}»`);
      }
    }
  }

  if (requirements.forbidden_flags) {
    for (const flag of requirements.forbidden_flags) {
      if (state.flags[flag]) {
        const humanized = humanizeFlag(flag, locale);
        reasons.push(isEn ? `Unavailable with "${humanized}"` : `No disponible con «${humanized}»`);
      }
    }
  }

  if (requirements.gestor_tiers && requirements.gestor_tiers.length > 0) {
    if (!requirements.gestor_tiers.includes(state.gestor.tier)) {
      const allowed = requirements.gestor_tiers
        .map((tier) => translateGestorTier(tier, locale))
        .join(isEn ? " or " : " o ");
      reasons.push(isEn ? `Requires advisor: ${allowed}` : `Requiere gestoría: ${allowed}`);
    }
  }

  if (requirements.family_statuses && requirements.family_statuses.length > 0) {
    if (!requirements.family_statuses.includes(state.family.status)) {
      const allowed = requirements.family_statuses
        .map((status) => translateFamilyStatus(status, locale))
        .join(isEn ? " or " : " o ");
      reasons.push(
        isEn ? `Requires family status: ${allowed}` : `Requiere situación familiar: ${allowed}`,
      );
    }
  }

  if (requirements.months_of_year && requirements.months_of_year.length > 0) {
    const currentMonthOfYear = ((Math.max(1, state.month) - 1) % 12) + 1;
    if (!requirements.months_of_year.includes(currentMonthOfYear)) {
      const monthTable = isEn ? CALENDAR_MONTH_NAMES_EN : CALENDAR_MONTH_NAMES_ES;
      const names = requirements.months_of_year
        .filter((m) => m >= 1 && m <= 12)
        .map((m) => monthTable[m - 1] ?? String(m));
      if (names.length > 0) {
        const joined = names.length === 2 ? names.join(isEn ? " or " : " o ") : names.join(", ");
        reasons.push(isEn ? `Only available in ${joined}` : `Solo disponible en ${joined}`);
      }
    }
  }

  let pushedMissingEmployee = false;
  if (requirements.has_employee != null) {
    const currentlyHasEmployee = state.employee !== null;
    if (currentlyHasEmployee !== requirements.has_employee) {
      if (requirements.has_employee) {
        pushedMissingEmployee = true;
      }
      if (isEn) {
        reasons.push(
          requirements.has_employee
            ? "Requires an employee on payroll"
            : "Maximum 1 employee on payroll",
        );
      } else {
        reasons.push(
          requirements.has_employee
            ? "Requiere tener un empleado en plantilla"
            : "Máximo 1 empleado en plantilla",
        );
      }
    }
  }

  if (requirements.employee_satisfaction) {
    const { min, max } = requirements.employee_satisfaction;
    if (min != null || max != null) {
      if (!state.employee) {
        if (!pushedMissingEmployee) {
          reasons.push(
            isEn ? "Requires an employee on payroll" : "Requiere tener un empleado en plantilla",
          );
        }
      } else {
        const currentSat = state.employee.satisfaction;
        if (min != null && currentSat < min) {
          reasons.push(
            isEn
              ? `Requires min. Staff satisfaction ${min}`
              : `Requiere Satisfacción laboral mín. ${min}`,
          );
        }
        if (max != null && currentSat > max) {
          reasons.push(
            isEn
              ? `Requires max. Staff satisfaction ${max}`
              : `Requiere Satisfacción laboral máx. ${max}`,
          );
        }
      }
    }
  }

  return reasons;
}
