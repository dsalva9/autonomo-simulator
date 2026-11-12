import { type SupportedLocale, type UILocale, normalizeLocale } from "./resolveEventText.ts";

export interface UiStrings {
  locale: UILocale;
  app: {
    loadingBadge: string;
    loadingTitle: string;
  };
  localeToggle: {
    ariaLabel: string;
    title: string;
  };
  title: {
    corruptTitle: string;
    corruptBody: (reason: string) => string;
    corruptDismiss: string;
    headerFormBadge: string;
    headerCountryBadge: string;
    taglineQuote: string;
    heroLeadBeforeAmount: string;
    heroLeadAfterAmount: string;
    stampTop: string;
    stampMain: string;
    stampBottom: string;
    activeDossierBadge: string;
    seedPrefix: string;
    calendarLabel: string;
    cashInHandLabel: string;
    continueBtn: string;
    continueTitle: string;
    newRunHeading: string;
    box01Badge: string;
    seedInputLabel: string;
    seedPlaceholder: string;
    startRunBtn: string;
    startRunTitle: string;
    replaceActiveNote: string;
    settingsHeading: string;
    settingsBadge: string;
    reducedMotionTitle: string;
    reducedMotionDesc: string;
    reducedMotionTitleAttr: string;
    reducedMotionOn: string;
    reducedMotionAuto: string;
    sfxTitle: string;
    sfxDesc: string;
    sfxTitleAttr: string;
    sfxMutedLabel: string;
    sfxActiveLabel: string;
    fastPacingTitle: string;
    fastPacingDesc: string;
    fastPacingTitleAttr: string;
    fastPacingOn: string;
    fastPacingNormal: string;
    archiveTablistAria: string;
    hallTabLabel: (count: number) => string;
    hallTabTitle: string;
    achievementsTabLabel: (unlocked: number, total: number) => string;
    achievementsTabTitle: string;
    emptyHallTitle: string;
    emptyHallBody: string;
    hallCashPrefix: string;
    hallBilledPrefix: string;
    achievementUnlockedBadge: string;
    achievementPendingBadge: string;
  };
  hud: {
    liveMoney: string;
    liveMoral: string;
    liveStress: string;
    livePersonalLife: string;
    liveReputation: string;
    sfxAria: string;
    sfxLabel: string;
    sfxTitleMuted: string;
    sfxTitleActive: string;
    fastAria: string;
    fastLabel: string;
    fastTitleOn: string;
    fastTitleOff: string;
    homeAria: string;
    homeLabel: string;
    homeTitle: string;
    abandonAria: string;
    abandonShort: string;
    abandonLong: string;
    abandonTitle: string;
    cashLabel: string;
    overdraftLong: (cur: number, max: number) => string;
    overdraftShort: (cur: number, max: number) => string;
    quarterReserveLong: string;
    quarterReserveShort: string;
    netFreeCash: string;
    taxAgencyPrefix: string;
    indicatorsSectionAria: string;
    moralLabel: string;
    moralShort: string;
    stressLabel: string;
    stressShort: string;
    personalLifeLabel: string;
    personalLifeShort: string;
    reputationLabel: string;
    reputationShort: string;
  };
  game: {
    decisionDeskAria: string;
    mobileNavAria: string;
    tabs: {
      despacho: string;
      cuentas: string;
      entorno: string;
      historial: string;
    };
  };
  eventStage: {
    recurringLongPrefix: string;
    recurringShortPrefix: string;
    monthLabel: (month: number) => string;
    fixedCashLabel: string;
    billedShort: string;
    fixedCostsShort: string;
    vatIrpfShort: string;
    invoicePaid: (amount: string) => string;
    invoiceDefaulted: (amount: string) => string;
    dossierClosedBadge: string;
    rulingRecordedBadge: string;
    decisionTakenLabel: string;
    defaultResultFallback: string;
    deltaCash: string;
    deltaMoral: string;
    deltaStress: string;
    deltaPersonalLife: string;
    deltaReputation: string;
    deltaTaxTension: string;
    taxTensionUp: string;
    taxTensionDown: string;
    futureConsequencesBadge: string;
    continueToFinalCert: string;
    continueToQuarter: string;
    continueBtn: string;
    enterKeyLabel: string;
    dossierPrefix: string;
    pendingEventsCount: (extra: number) => string;
    sceneAltPrefix: (categoryLabel: string) => string;
    choicesAria: string;
    uncertaintyBadge: string;
    lockedPrefix: string;
    lockedFallback: string;
    processingMonth: (month: number) => string;
  };
  scene: {
    sectionAria: string;
    heading: string;
    deskAlt: string;
    propOverdraftAlt: string;
    propInvoicesAlt: string;
    propFamilyAlt: string;
    propCoffeeAlt: string;
    dossierOnDesk: string;
    caffeineActive: string;
    statusAtLimit: string;
    statusOverdraft: string;
    statusUnderPressure: string;
    statusOperational: string;
    roleTaxAgency: string;
    rolePersonalBond: string;
  };
  cuentas: {
    sectionAria: string;
    heading: string;
    badge: string;
    baselineBilling: string;
    livingCost: string;
    autonomoQuota: string;
    gestorRetainer: string;
    familyCosts: string;
    payrollLabel: (roleLabel: string) => string;
    tempEffects: string;
    marginBeforeTax: string;
    estTaxProvision: (pct: number) => string;
    marginAfterTax: string;
    quarterProvisionHeading: string;
    quarterBilled: string;
    accruedTaxes: string;
    lifetimeBilled: string;
    activeDeferralHeading: (dueMonth: number) => string;
    principalWord: string;
    surchargeWord: string;
    deferredInvoicesHeading: (count: number) => string;
    noPendingPayments: string;
    defaultRiskPct: (pct: number) => string;
    temporalModifiersHeading: (count: number) => string;
    remainingMonths: (months: number) => string;
    modBilledShort: string;
    modExpenseShort: string;
    modMoralShort: string;
    modStressShort: string;
    perMonthSuffix: string;
  };
  entorno: {
    sectionAria: string;
    heading: string;
    badge: string;
    gestorFallbackAlt: string;
    gestorHeader: string;
    perMonth: string;
    shieldPct: (pct: number) => string;
    partnerFallbackAlt: string;
    personalLifeHeader: string;
    childrenAndCost: (children: number, costFormatted: string) => string;
    staffHeader: string;
    billingMultiplier: (mult: number) => string;
    noEmployeesTitle: string;
    noEmployeesSub: string;
  };
  historial: {
    sectionAria: string;
    heading: string;
    entriesCountBadge: (count: number) => string;
    careerSealsHeading: string;
    timelineAria: string;
    monthLabel: (month: number) => string;
    entryMonthStart: string;
    entryDecisionFallback: string;
    entryDecisionRecordedFallback: string;
    entryInvoicePaid: string;
    entryInvoiceDefaulted: string;
    entryQuarterlyTax: string;
    entryInspection: string;
    entryVictoryUnlocked: (summary: string) => string;
    entryVictoryFallback: string;
    entryAnnualSummary: string;
    entryGameOverFallback: string;
  };
  toast: {
    defaultCode: string;
    multipleUnlocked: (count: number) => string;
    singleUnlocked: (code: string) => string;
    dismissAria: string;
  };
  modals: {
    quarterly: {
      formBadge: string;
      heading: (month: number, quarter: number) => string;
      mandatoryBadge: string;
      intro: string;
      quarterBilled: string;
      gestorErrorSurcharge: string;
      directAuditFine: string;
      currentQuarterDue: string;
      priorDeferralDue: string;
      totalDueToday: string;
      cashBeforePay: string;
      auditDetectedHeading: string;
      auditScheduledBody: string;
      auditImmediateBody: string;
      overdraftWarningBefore: string;
      overdraftLabel: string;
      overdraftImmediateBankruptcy: string;
      overdraftThreeMonthRule: string;
      payFullBtn: string;
      requestDeferralBtn: string;
      stressWord: string;
      lockedPrefix: string;
      deferDisabledExisting: string;
      deferDisabledNonPositive: string;
      deferSummary: (accrued: string, dueMonth: number, priorDueFormatted?: string) => string;
    };
    victory: {
      diplomaBadge: string;
      richHeadline: string;
      heroHeadline: string;
      richSubheadline: string;
      heroSubheadline: string;
      sealedBadgeHeading: string;
      timeContributedLabel: string;
      liquidityLabel: string;
      endlessGuaranteeNote: string;
      continueEndlessBtn: string;
      enterKeyLabel: string;
      retireBtn: string;
    };
    annual: {
      formBadge: string;
      heading: (year: number, month: number) => string;
      intro: string;
      grossBilled: string;
      operatingPersonalExpenses: string;
      quarterlyTaxesPaid: string;
      netCashChange: string;
      yearEndCash: string;
      structureHeading: string;
      gestorCardLabel: string;
      familyCardLabel: string;
      staffCardLabel: string;
      soloLabel: string;
      perMonthSuffix: string;
      childrenCountPrefix: (count: number) => string;
      highlightsHeading: string;
      closeBtn: (year: number, nextYear: number) => string;
      enterKeyLabel: string;
    };
    abandon: {
      heading: string;
      closeAria: string;
      closeTitle: string;
      prompt: string;
      oposicionesTitle: string;
      oposicionesDesc: string;
      salariedTitle: string;
      salariedDesc: string;
      ceseTitle: string;
      ceseDesc: string;
    };
  };
  endRun: {
    timeSurvivedLabel: string;
    finalCashLabel: string;
    officialBillingLabel: string;
    seedLabel: string;
    victoryBadgesHeading: string;
    shareBtn: string;
    shareTitle: string;
    copyBtn: string;
    copyTitle: string;
    downloadBtn: string;
    downloadTitle: string;
    newRunBtn: string;
    newRunTitle: string;
    returnTitleBtn: string;
    returnTitleAttr: string;
    officialCertBadge: string;
    canvasAria: string;
    feedbackCopied: string;
    feedbackCopyFailed: string;
    feedbackDownloaded: (filename: string) => string;
    feedbackDownloadFailed: string;
    feedbackClipboardFallback: string;
    feedbackShared: string;
  };
}

const ES_STRINGS: UiStrings = {
  locale: "es-ES",
  app: {
    loadingBadge: "MODELO 036 · CARGANDO",
    loadingTitle: "Abriendo carpeta fiscal...",
  },
  localeToggle: {
    ariaLabel: "Cambiar idioma a inglés",
    title: "Cambiar idioma ES / EN (L)",
  },
  title: {
    corruptTitle: "Expediente en curso dañado · Copia de seguridad archivada",
    corruptBody: (reason) =>
      `Se detectó un formato inválido en el guardado automático (${reason}). Tu Salón de Caídos y tus logros siguen intactos.`,
    corruptDismiss: "Entendido",
    headerFormBadge: "MODELO 036 · DECLARACIÓN CENSAL DE ALTA EN EL RETA",
    headerCountryBadge: "EJERCICIO FISCAL · ESPAÑA",
    taglineQuote: "«Sé tu propio jefe. Descubre por qué era mala idea.»",
    heroLeadBeforeAmount:
      "Sobrevive diez años (120 meses) entre presupuestos regateados, facturas a sesenta días, cuotas mensuales implacables y cierres trimestrales de IVA e IRPF. O acumula ",
    heroLeadAfterAmount: " limpios antes de que el estrés o los números rojos te tumben.",
    stampTop: "VENTANILLA ÚNICA",
    stampMain: "120 MESES",
    stampBottom: "SIN RED SALARIAL",
    activeDossierBadge: "EXPEDIENTE ACTIVO",
    seedPrefix: "Semilla",
    calendarLabel: "Calendario",
    cashInHandLabel: "Dinero en caja",
    continueBtn: "Continuar partida",
    continueTitle: "Continuar expediente activo (C o Intro)",
    newRunHeading: "Nueva alta en el RETA",
    box01Badge: "CASILLA 01",
    seedInputLabel: "Semilla reproducible (opcional)",
    seedPlaceholder: "Ej. AUT-2026-PACO (vacío = aleatoria)",
    startRunBtn: "Nueva alta en el RETA",
    startRunTitle: "Iniciar nueva partida en el RETA (N)",
    replaceActiveNote:
      "Nota: iniciar una nueva alta reemplazará el expediente actualmente en curso.",
    settingsHeading: "Ajustes de despacho",
    settingsBadge: "PREFERENCIAS",
    reducedMotionTitle: "Movimiento reducido",
    reducedMotionDesc: "Lectura estática sin inclinaciones ni animaciones.",
    reducedMotionTitleAttr: "Alternar movimiento reducido (R)",
    reducedMotionOn: "Reducido: SÍ",
    reducedMotionAuto: "Automático",
    sfxTitle: "Sonido de oficina",
    sfxDesc: "Sellos, papel y timbre en decisiones y trimestres.",
    sfxTitleAttr: "Alternar sonido de oficina (M)",
    sfxMutedLabel: "Silenciado",
    sfxActiveLabel: "Activo",
    fastPacingTitle: "Modo ágil",
    fastPacingDesc: "Avanza directamente al siguiente trámite salvo fin de partida.",
    fastPacingTitleAttr: "Alternar modo ágil (F)",
    fastPacingOn: "Ágil: SÍ",
    fastPacingNormal: "Normal",
    archiveTablistAria: "Archivo del jugador",
    hallTabLabel: (count) => `Salón de Caídos (${count})`,
    hallTabTitle: "Salón de Caídos (1)",
    achievementsTabLabel: (unlocked, total) => `Logros (${unlocked}/${total})`,
    achievementsTabTitle: "Logros desbloqueados (2)",
    emptyHallTitle: "Archivo provincial sin expedientes cerrados",
    emptyHallBody:
      "Tus jubilaciones gloriosas, abandonos a tiempo y bancarrotas quedarán registradas aquí con su cotización oficial.",
    hallCashPrefix: "Caja",
    hallBilledPrefix: "Facturado",
    achievementUnlockedBadge: "SELLADO",
    achievementPendingBadge: "PENDIENTE",
  },
  hud: {
    liveMoney: "Dinero",
    liveMoral: "Moral",
    liveStress: "Estrés",
    livePersonalLife: "Vida personal",
    liveReputation: "Reputación",
    sfxAria: "Sonido de oficina",
    sfxLabel: "Sonido",
    sfxTitleMuted: "Sonido silenciado — activar (M)",
    sfxTitleActive: "Sonido activo — silenciar (M)",
    fastAria: "Modo ágil",
    fastLabel: "Modo ágil",
    fastTitleOn: "Modo ágil activado — volver a lectura normal (F)",
    fastTitleOff: "Activar Modo ágil — avanzar sin pausa intermedia (F)",
    homeAria: "Volver al inicio",
    homeLabel: "Inicio",
    homeTitle: "Volver al inicio conservando el expediente en curso (I)",
    abandonAria: "Darse de baja voluntaria",
    abandonShort: "Baja",
    abandonLong: "Darse de baja",
    abandonTitle: "Tramitar baja voluntaria Modelo 036 (B)",
    cashLabel: "Caja:",
    overdraftLong: (cur, max) => `NÚMEROS ROJOS (${cur}/${max})`,
    overdraftShort: (cur, max) => `ROJOS ${cur}/${max}`,
    quarterReserveLong: "Reserva Trimestre:",
    quarterReserveShort: "Res.:",
    netFreeCash: "Libre:",
    taxAgencyPrefix: "Hacienda:",
    indicatorsSectionAria: "Indicadores personales y de negocio",
    moralLabel: "Moral",
    moralShort: "Moral",
    stressLabel: "Estrés",
    stressShort: "Estrés",
    personalLifeLabel: "Vida personal",
    personalLifeShort: "Vida",
    reputationLabel: "Reputación",
    reputationShort: "Reput.",
  },
  game: {
    decisionDeskAria: "Mesa de decisiones",
    mobileNavAria: "Secciones del despacho",
    tabs: {
      despacho: "Despacho",
      cuentas: "Cuentas",
      entorno: "Entorno",
      historial: "Historial",
    },
  },
  eventStage: {
    recurringLongPrefix: "Liquidación fija · ",
    recurringShortPrefix: "Liq. ",
    monthLabel: (month) => `Mes ${month}`,
    fixedCashLabel: "Caja fija:",
    billedShort: "Fact.: ",
    fixedCostsShort: "Fijos: ",
    vatIrpfShort: "IVA/IRPF: ",
    invoicePaid: (amount) => `✓ Factura cobrada: +${amount}`,
    invoiceDefaulted: (amount) => `✗ Factura impagada (${amount})`,
    dossierClosedBadge: "Expediente cerrado",
    rulingRecordedBadge: "Resolución registrada",
    decisionTakenLabel: "Decisión tomada: ",
    defaultResultFallback:
      "La decisión queda anotada en tu libro de contabilidad y el mes sigue su curso.",
    deltaCash: "Caja",
    deltaMoral: "Moral",
    deltaStress: "Estrés",
    deltaPersonalLife: "Vida personal",
    deltaReputation: "Reputación",
    deltaTaxTension: "Tensión Hacienda",
    taxTensionUp: "Aumenta ▲",
    taxTensionDown: "Se relaja ▼",
    futureConsequencesBadge: "⏳ Tendrá consecuencias más adelante",
    continueToFinalCert: "Ver certificado final del expediente",
    continueToQuarter: "Continuar al cierre trimestral",
    continueBtn: "Continuar",
    enterKeyLabel: "Intro",
    dossierPrefix: "EXP.",
    pendingEventsCount: (extra) => `+${extra} pendiente${extra > 1 ? "s" : ""}`,
    sceneAltPrefix: (categoryLabel) => `Escena de ${categoryLabel}`,
    choicesAria: "Opciones de decisión",
    uncertaintyBadge: "Incertidumbre",
    lockedPrefix: "Bloqueado:",
    lockedFallback: "No cumples los requisitos actuales",
    processingMonth: (month) => `Procesando trámite administrativo del mes ${month}...`,
  },
  scene: {
    sectionAria: "Escena del despacho",
    heading: "El Despacho",
    deskAlt: "Despacho de autónomo",
    propOverdraftAlt: "Aviso bancario de números rojos",
    propInvoicesAlt: "Facturas pendientes del trimestre",
    propFamilyAlt: "Fotografía familiar sobre el escritorio",
    propCoffeeAlt: "Taza de café por estrés elevado",
    dossierOnDesk: "Expediente en mesa",
    caffeineActive: "Cafeína activa",
    statusAtLimit: "Al límite",
    statusOverdraft: "Descubierto",
    statusUnderPressure: "Bajo presión",
    statusOperational: "Operativo",
    roleTaxAgency: "Agencia Tributaria",
    rolePersonalBond: "Vínculo personal",
  },
  cuentas: {
    sectionAria: "Cuaderno de Cuentas",
    heading: "Cuaderno de Cuentas",
    badge: "LIBRO REGISTRO",
    baselineBilling: "Facturación base mensual",
    livingCost: "Coste de vida básico",
    autonomoQuota: "Cuota fija RETA",
    gestorRetainer: "Iguala de gestoría",
    familyCosts: "Gastos familiares",
    payrollLabel: (roleLabel) => `Nómina (${roleLabel})`,
    tempEffects: "Efectos temporales",
    marginBeforeTax: "Margen antes de impuestos",
    estTaxProvision: (pct) => `Provisión fiscal est. (${pct}%)`,
    marginAfterTax: "Margen tras provisión fiscal",
    quarterProvisionHeading: "PROVISIÓN TRIMESTRAL (IVA + IRPF)",
    quarterBilled: "Facturado trimestre:",
    accruedTaxes: "Impuestos devengados:",
    lifetimeBilled: "Facturación oficial acum.:",
    activeDeferralHeading: (dueMonth) => `APLAZAMIENTO ACTIVO (VENCE MES ${dueMonth})`,
    principalWord: "Principal",
    surchargeWord: "recargo",
    deferredInvoicesHeading: (count) => `Facturas a plazo (${count})`,
    noPendingPayments: "Sin cobros pendientes",
    defaultRiskPct: (pct) => `· Impago ${pct}%`,
    temporalModifiersHeading: (count) => `Efectos temporales (${count})`,
    remainingMonths: (months) => `${months} ${months === 1 ? "mes" : "meses"}`,
    modBilledShort: "Fact.",
    modExpenseShort: "Gasto",
    modMoralShort: "Moral",
    modStressShort: "Estrés",
    perMonthSuffix: "/m",
  },
  entorno: {
    sectionAria: "Entorno personal y profesional",
    heading: "Red de Apoyo",
    badge: "ENTORNO",
    gestorFallbackAlt: "Gestoría",
    gestorHeader: "GESTORÍA FISCAL",
    perMonth: "/mes",
    shieldPct: (pct) => `Escudo ${pct}%`,
    partnerFallbackAlt: "Pareja",
    personalLifeHeader: "VIDA PERSONAL",
    childrenAndCost: (children, costFormatted) => `Hijos: ${children} · ${costFormatted}/mes`,
    staffHeader: "PLANTILLA (MÁX. 1)",
    billingMultiplier: (mult) => `Fact. ×${mult.toFixed(2).replace(".", ",")}`,
    noEmployeesTitle: "Sin empleados en nómina",
    noEmployeesSub: "En solitario · Cero nóminas fijas",
  },
  historial: {
    sectionAria: "Historial de decisiones y logros",
    heading: "Diario de Expediente",
    entriesCountBadge: (count) => `${count} APUNTES`,
    careerSealsHeading: "Sellos de carrera",
    timelineAria: "Apuntes recientes del expediente",
    monthLabel: (month) => `Mes ${month}`,
    entryMonthStart: "Cierre de ingresos y gastos fijos mensuales",
    entryDecisionFallback: "Decisión tomada",
    entryDecisionRecordedFallback: "Decisión registrada",
    entryInvoicePaid: "Factura a plazo cobrada con éxito",
    entryInvoiceDefaulted: "Impago en factura emitida a plazo",
    entryQuarterlyTax: "Liquidación trimestral presentada",
    entryInspection: "Requerimiento / actuación de inspección fiscal",
    entryVictoryUnlocked: (summary) => `Sello conquistado: ${summary}`,
    entryVictoryFallback: "Hito de supervivencia",
    entryAnnualSummary: "Cierre contable de ejercicio anual",
    entryGameOverFallback: "Fin del expediente",
  },
  toast: {
    defaultCode: "SELLO",
    multipleUnlocked: (count) => `${count} SELLOS DESBLOQUEADOS`,
    singleUnlocked: (code) => `SELLO DESBLOQUEADO · ${code}`,
    dismissAria: "Cerrar aviso de logro",
  },
  modals: {
    quarterly: {
      formBadge: "MODELO 303 / 130 · AUTOLIQUIDACIÓN",
      heading: (month, quarter) => `El Trimestre · Mes ${month} (T${quarter})`,
      mandatoryBadge: "OBLIGATORIO",
      intro:
        "Llega el día 20 y toca ajustar cuentas con la Agencia Tributaria por lo facturado en los últimos tres meses.",
      quarterBilled: "Facturación oficial del trimestre:",
      gestorErrorSurcharge: "Recargo por error al rellenar casillas:",
      directAuditFine: "Sanción directa de comprobación tributaria:",
      currentQuarterDue: "Cuota del trimestre actual:",
      priorDeferralDue: "Aplazamiento anterior vencido (inaplazable):",
      totalDueToday: "Total a ingresar hoy:",
      cashBeforePay: "Caja disponible antes del pago:",
      auditDetectedHeading: "Actuación de Hacienda detectada",
      auditScheduledBody:
        "Un inspector ha abierto expediente sobre tus cuentas: recibirás notificación certificada el próximo mes.",
      auditImmediateBody:
        "Se ha girado liquidación sancionadora inmediata sobre este cierre trimestral.",
      overdraftWarningBefore: "Pagar al contado dejará tu cuenta en ",
      overdraftLabel: "(Números rojos).",
      overdraftImmediateBankruptcy:
        "¡Supera el descubierto máximo permitido y provocará bancarrota inmediata!",
      overdraftThreeMonthRule: "Recuerda que encadenar 3 meses en negativo provoca insolvencia.",
      payFullBtn: "Pagar liquidación íntegra al contado",
      requestDeferralBtn: "Solicitar aplazamiento al próximo trimestre",
      stressWord: "Estrés",
      lockedPrefix: "Bloqueado:",
      deferDisabledExisting: "Ya tienes un aplazamiento pendiente de liquidar.",
      deferDisabledNonPositive: "No hay cuota devengada positiva que aplazar este trimestre.",
      deferSummary: (accrued, dueMonth, priorDueFormatted) =>
        `Pospone ${accrued} hasta el mes ${dueMonth}${
          priorDueFormatted
            ? ` (se cobrará hoy el aplazamiento vencido de ${priorDueFormatted})`
            : "."
        }`,
    },
    victory: {
      diplomaBadge: "DIPLOMA DE SUPERVIVENCIA AUTÓNOMA",
      richHeadline: "¡Ricachón!",
      heroHeadline: "«¡Eres un héroe!»",
      richSubheadline:
        "Has superado los 150.000 € limpios en tu cuenta corriente sin que Hacienda ni los clientes acaben contigo.",
      heroSubheadline:
        "Has sobrevivido diez años completos (120 meses) dado de alta en el RETA. En tu gestoría te han enmarcado el Modelo 036.",
      sealedBadgeHeading: "SELLO CONQUISTADO Y BLINDADO EN TU CERTIFICADO",
      timeContributedLabel: "Tiempo cotizado:",
      liquidityLabel: "Liquidez:",
      endlessGuaranteeNote:
        "Aunque decidas continuar en Modo Infinito y caigas más adelante, este sello aparecerá en tu certificado final.",
      continueEndlessBtn: "Seguir cotizando en Modo Infinito",
      enterKeyLabel: "Intro",
      retireBtn: "Retirarse por todo lo alto y emitir certificado",
    },
    annual: {
      formBadge: "MODELO 390 · RESUMEN CONTABLE ANUAL",
      heading: (year, month) => `Cierre del Año ${year} (Mes ${month})`,
      intro:
        "Otro año natural superado sin cerrar la persiana. Balance oficial y estructura al cierre del ejercicio:",
      grossBilled: "Facturación bruta del año:",
      operatingPersonalExpenses: "Gastos operativos y personales:",
      quarterlyTaxesPaid: "Impuestos trimestrales abonados:",
      netCashChange: "Variación neta de tesorería:",
      yearEndCash: "Liquidez al cierre del año:",
      structureHeading: "RESUMEN DE ESTRUCTURA AL CIERRE",
      gestorCardLabel: "Gestoría",
      familyCardLabel: "Familia",
      staffCardLabel: "Plantilla",
      soloLabel: "En solitario",
      perMonthSuffix: "/mes",
      childrenCountPrefix: (count) => `${count} ${count === 1 ? "hijo" : "hijos"} · `,
      highlightsHeading: "Momentos memorables del año",
      closeBtn: (year, nextYear) => `Archivar Año ${year} y abrir Año ${nextYear}`,
      enterKeyLabel: "Intro",
    },
    abandon: {
      heading: "Tramitar baja voluntaria (Modelo 036)",
      closeAria: "Cerrar ventana",
      closeTitle: "Cancelar y volver al despacho (Esc)",
      prompt: "¿Cómo quieres cerrar definitivamente esta partida y emitir tu certificado final?",
      oposicionesTitle: "📚 Encerrarse a preparar oposiciones",
      oposicionesDesc: "Cambias las facturas urgentes por el temario y los subrayadores.",
      salariedTitle: "💼 Volver a un empleo asalariado en oficina",
      salariedDesc: "Vuelves a tener jefe, pero recuperas las vacaciones pagadas.",
      ceseTitle: "📄 Solicitar el cese de actividad",
      ceseDesc: "Cierras la persiana tras comprobar la letra pequeña de emprender.",
    },
  },
  endRun: {
    timeSurvivedLabel: "Tiempo sobrevivido",
    finalCashLabel: "Liquidez final",
    officialBillingLabel: "Facturación oficial",
    seedLabel: "Semilla",
    victoryBadgesHeading: "Sellos de victoria conquistados en esta carrera",
    shareBtn: "Compartir",
    shareTitle: "Compartir certificado (S)",
    copyBtn: "Copiar resumen",
    copyTitle: "Copiar resumen al portapapeles (C)",
    downloadBtn: "Descargar PNG",
    downloadTitle: "Descargar certificado PNG (D)",
    newRunBtn: "Nueva alta en el RETA",
    newRunTitle: "Iniciar nueva partida en el RETA (N o Intro)",
    returnTitleBtn: "Inicio y Salón de Caídos",
    returnTitleAttr: "Volver al inicio y Salón de Caídos (I o Esc)",
    officialCertBadge: "CERTIFICADO OFICIAL",
    canvasAria: "Certificado de supervivencia autónoma Modelo 036-FIN",
    feedbackCopied: "¡Resumen copiado al portapapeles! Listo para pegar en WhatsApp o Telegram.",
    feedbackCopyFailed: "No se pudo acceder al portapapeles en este navegador.",
    feedbackDownloaded: (filename) => `Certificado PNG descargado (${filename}).`,
    feedbackDownloadFailed: "No se pudo generar la descarga PNG.",
    feedbackClipboardFallback:
      "¡Resumen copiado al portapapeles! (Compartir nativo no disponible en este dispositivo).",
    feedbackShared: "¡Certificado compartido con éxito!",
  },
};

const EN_STRINGS: UiStrings = {
  locale: "en",
  app: {
    loadingBadge: "FORM 036 · LOADING",
    loadingTitle: "Opening tax dossier...",
  },
  localeToggle: {
    ariaLabel: "Switch language to Spanish",
    title: "Switch language ES / EN (L)",
  },
  title: {
    corruptTitle: "Active dossier corrupted · Backup archived",
    corruptBody: (reason) =>
      `An invalid format was detected in your autosave (${reason}). Your Hall of the Fallen and achievements remain intact.`,
    corruptDismiss: "Got it",
    headerFormBadge: "FORM 036 · SELF-EMPLOYMENT CENSUS REGISTRATION",
    headerCountryBadge: "FISCAL YEAR · SPAIN",
    taglineQuote: '"Be your own boss. Find out why it was a terrible idea."',
    heroLeadBeforeAmount:
      "Survive ten full years (120 months) of haggled quotes, net-60 invoices, relentless monthly fees, and quarterly VAT & income tax filings. Or stack ",
    heroLeadAfterAmount: " clear in the bank before burnout or overdrafts take you down.",
    stampTop: "ONE-STOP DESK",
    stampMain: "120 MONTHS",
    stampBottom: "NO SALARY NET",
    activeDossierBadge: "ACTIVE DOSSIER",
    seedPrefix: "Seed",
    calendarLabel: "Calendar",
    cashInHandLabel: "Cash on hand",
    continueBtn: "Continue run",
    continueTitle: "Resume active dossier (C or Enter)",
    newRunHeading: "Register as Self-Employed",
    box01Badge: "BOX 01",
    seedInputLabel: "Reproducible seed (optional)",
    seedPlaceholder: "e.g. AUT-2026-PACO (blank = random)",
    startRunBtn: "Register as Self-Employed",
    startRunTitle: "Start a new self-employed run (N)",
    replaceActiveNote: "Note: starting a new registration will replace your active dossier.",
    settingsHeading: "Office settings",
    settingsBadge: "PREFERENCES",
    reducedMotionTitle: "Reduced motion",
    reducedMotionDesc: "Static layout without tilts or transitions.",
    reducedMotionTitleAttr: "Toggle reduced motion (R)",
    reducedMotionOn: "Reduced: ON",
    reducedMotionAuto: "Automatic",
    sfxTitle: "Office audio",
    sfxDesc: "Rubber stamps, paper rustle, and desk bell cues.",
    sfxTitleAttr: "Toggle office audio (M)",
    sfxMutedLabel: "Muted",
    sfxActiveLabel: "Active",
    fastPacingTitle: "Fast pacing",
    fastPacingDesc: "Jump straight to the next month unless the run ends.",
    fastPacingTitleAttr: "Toggle fast pacing (F)",
    fastPacingOn: "Fast: ON",
    fastPacingNormal: "Normal",
    archiveTablistAria: "Player archive",
    hallTabLabel: (count) => `Hall of the Fallen (${count})`,
    hallTabTitle: "Hall of the Fallen (1)",
    achievementsTabLabel: (unlocked, total) => `Achievements (${unlocked}/${total})`,
    achievementsTabTitle: "Unlocked achievements (2)",
    emptyHallTitle: "Provincial archive has no closed dossiers yet",
    emptyHallBody:
      "Your glorious retirements, timely exits, and bankruptcies will be logged here with their official record.",
    hallCashPrefix: "Cash",
    hallBilledPrefix: "Billed",
    achievementUnlockedBadge: "SEALED",
    achievementPendingBadge: "LOCKED",
  },
  hud: {
    liveMoney: "Cash",
    liveMoral: "Morale",
    liveStress: "Stress",
    livePersonalLife: "Personal life",
    liveReputation: "Reputation",
    sfxAria: "Office audio",
    sfxLabel: "Audio",
    sfxTitleMuted: "Audio muted — unmute (M)",
    sfxTitleActive: "Audio active — mute (M)",
    fastAria: "Fast pacing",
    fastLabel: "Fast mode",
    fastTitleOn: "Fast pacing active — return to normal reading (F)",
    fastTitleOff: "Enable Fast pacing — skip outcome pause (F)",
    homeAria: "Return to title",
    homeLabel: "Home",
    homeTitle: "Return to title keeping active dossier saved (I)",
    abandonAria: "Voluntary deregistration",
    abandonShort: "Quit",
    abandonLong: "Deregister",
    abandonTitle: "File voluntary Form 036 deregistration (B)",
    cashLabel: "Cash:",
    overdraftLong: (cur, max) => `OVERDRAFT (${cur}/${max})`,
    overdraftShort: (cur, max) => `RED ${cur}/${max}`,
    quarterReserveLong: "Quarter Reserve:",
    quarterReserveShort: "Res.:",
    netFreeCash: "Net:",
    taxAgencyPrefix: "Tax Office:",
    indicatorsSectionAria: "Personal and business indicators",
    moralLabel: "Morale",
    moralShort: "Morale",
    stressLabel: "Stress",
    stressShort: "Stress",
    personalLifeLabel: "Personal life",
    personalLifeShort: "Life",
    reputationLabel: "Reputation",
    reputationShort: "Rep.",
  },
  game: {
    decisionDeskAria: "Decision desk",
    mobileNavAria: "Office sections",
    tabs: {
      despacho: "Desk",
      cuentas: "Ledger",
      entorno: "Network",
      historial: "Logbook",
    },
  },
  eventStage: {
    recurringLongPrefix: "Monthly baseline · ",
    recurringShortPrefix: "Base ",
    monthLabel: (month) => `Month ${month}`,
    fixedCashLabel: "Net fixed:",
    billedShort: "Billed: ",
    fixedCostsShort: "Fixed: ",
    vatIrpfShort: "VAT/Tax: ",
    invoicePaid: (amount) => `✓ Invoice paid: +${amount}`,
    invoiceDefaulted: (amount) => `✗ Invoice defaulted (${amount})`,
    dossierClosedBadge: "Dossier closed",
    rulingRecordedBadge: "Outcome logged",
    decisionTakenLabel: "Chosen action: ",
    defaultResultFallback: "Your decision is recorded in the ledger and the month rolls on.",
    deltaCash: "Cash",
    deltaMoral: "Morale",
    deltaStress: "Stress",
    deltaPersonalLife: "Personal life",
    deltaReputation: "Reputation",
    deltaTaxTension: "Tax Audit Heat",
    taxTensionUp: "Rises ▲",
    taxTensionDown: "Cools ▼",
    futureConsequencesBadge: "⏳ Will have consequences later",
    continueToFinalCert: "View final dossier certificate",
    continueToQuarter: "Proceed to quarterly tax filing",
    continueBtn: "Continue",
    enterKeyLabel: "Enter",
    dossierPrefix: "FILE",
    pendingEventsCount: (extra) => `+${extra} pending`,
    sceneAltPrefix: (categoryLabel) => `Scene for ${categoryLabel}`,
    choicesAria: "Decision choices",
    uncertaintyBadge: "Risky roll",
    lockedPrefix: "Locked:",
    lockedFallback: "Current requirements not met",
    processingMonth: (month) => `Processing administrative paperwork for month ${month}...`,
  },
  scene: {
    sectionAria: "Office scene",
    heading: "The Desk",
    deskAlt: "Freelancer desk",
    propOverdraftAlt: "Bank overdraft warning notice",
    propInvoicesAlt: "Pending quarterly invoices stack",
    propFamilyAlt: "Family photo frame on desk",
    propCoffeeAlt: "High-stress coffee mug",
    dossierOnDesk: "Active file on desk",
    caffeineActive: "High caffeine",
    statusAtLimit: "At breaking point",
    statusOverdraft: "In the red",
    statusUnderPressure: "Under pressure",
    statusOperational: "Operational",
    roleTaxAgency: "Tax Agency",
    rolePersonalBond: "Personal bond",
  },
  cuentas: {
    sectionAria: "Account Ledger",
    heading: "Account Ledger",
    badge: "BOOKKEEPING",
    baselineBilling: "Baseline monthly billing",
    livingCost: "Basic living cost",
    autonomoQuota: "Monthly RETA fee",
    gestorRetainer: "Advisor retainer",
    familyCosts: "Household expenses",
    payrollLabel: (roleLabel) => `Payroll (${roleLabel})`,
    tempEffects: "Temporary modifiers",
    marginBeforeTax: "Pre-tax monthly margin",
    estTaxProvision: (pct) => `Est. tax reserve (${pct}%)`,
    marginAfterTax: "Margin after tax reserve",
    quarterProvisionHeading: "QUARTERLY TAX RESERVE (VAT + IRPF)",
    quarterBilled: "Quarter billed:",
    accruedTaxes: "Accrued tax due:",
    lifetimeBilled: "Lifetime official billing:",
    activeDeferralHeading: (dueMonth) => `ACTIVE DEFERRAL (DUE MONTH ${dueMonth})`,
    principalWord: "Principal",
    surchargeWord: "surcharge",
    deferredInvoicesHeading: (count) => `Net-terms invoices (${count})`,
    noPendingPayments: "No pending invoices",
    defaultRiskPct: (pct) => `· Default ${pct}%`,
    temporalModifiersHeading: (count) => `Temporary modifiers (${count})`,
    remainingMonths: (months) => `${months} ${months === 1 ? "mo" : "mos"}`,
    modBilledShort: "Billed",
    modExpenseShort: "Cost",
    modMoralShort: "Morale",
    modStressShort: "Stress",
    perMonthSuffix: "/mo",
  },
  entorno: {
    sectionAria: "Personal and professional network",
    heading: "Support Network",
    badge: "NETWORK",
    gestorFallbackAlt: "Tax advisor",
    gestorHeader: "TAX ADVISORY",
    perMonth: "/mo",
    shieldPct: (pct) => `Shield ${pct}%`,
    partnerFallbackAlt: "Partner",
    personalLifeHeader: "PERSONAL LIFE",
    childrenAndCost: (children, costFormatted) => `Kids: ${children} · ${costFormatted}/mo`,
    staffHeader: "STAFF (MAX 1)",
    billingMultiplier: (mult) => `Billing ×${mult.toFixed(2)}`,
    noEmployeesTitle: "No employees on payroll",
    noEmployeesSub: "Solo operator · Zero fixed payroll",
  },
  historial: {
    sectionAria: "Decision log and achievements",
    heading: "Dossier Logbook",
    entriesCountBadge: (count) => `${count} ENTRIES`,
    careerSealsHeading: "Career seals",
    timelineAria: "Recent dossier entries",
    monthLabel: (month) => `Month ${month}`,
    entryMonthStart: "Monthly recurring billing & expenses closed",
    entryDecisionFallback: "Decision taken",
    entryDecisionRecordedFallback: "Decision logged",
    entryInvoicePaid: "Deferred client invoice paid in full",
    entryInvoiceDefaulted: "Client defaulted on deferred invoice",
    entryQuarterlyTax: "Quarterly tax return filed",
    entryInspection: "Tax Agency audit notice / action",
    entryVictoryUnlocked: (summary) => `Seal unlocked: ${summary}`,
    entryVictoryFallback: "Survival milestone",
    entryAnnualSummary: "Annual fiscal year closed",
    entryGameOverFallback: "Dossier closed",
  },
  toast: {
    defaultCode: "SEAL",
    multipleUnlocked: (count) => `${count} SEALS UNLOCKED`,
    singleUnlocked: (code) => `SEAL UNLOCKED · ${code}`,
    dismissAria: "Dismiss achievement notice",
  },
  modals: {
    quarterly: {
      formBadge: "FORM 303 / 130 · QUARTERLY RETURN",
      heading: (month, quarter) => `The Quarter · Month ${month} (Q${quarter})`,
      mandatoryBadge: "MANDATORY",
      intro:
        "The 20th has arrived: time to settle up with the Tax Agency for everything invoiced over the last three months.",
      quarterBilled: "Official quarterly billing:",
      gestorErrorSurcharge: "Filing error surcharge:",
      directAuditFine: "Direct tax audit penalty:",
      currentQuarterDue: "Current quarter tax due:",
      priorDeferralDue: "Prior deferred tax due (non-deferrable):",
      totalDueToday: "Total payable today:",
      cashBeforePay: "Available cash before payment:",
      auditDetectedHeading: "Tax Agency audit triggered",
      auditScheduledBody:
        "An auditor opened a file on your accounts: expect a certified notice next month.",
      auditImmediateBody:
        "An immediate penalty assessment has been added to this quarterly return.",
      overdraftWarningBefore: "Paying in full will leave your account at ",
      overdraftLabel: "(In the red).",
      overdraftImmediateBankruptcy:
        "Exceeds the maximum overdraft limit and will trigger immediate bankruptcy!",
      overdraftThreeMonthRule: "Remember: 3 consecutive months in the red triggers insolvency.",
      payFullBtn: "Pay full tax settlement upfront",
      requestDeferralBtn: "Request deferral until next quarter",
      stressWord: "Stress",
      lockedPrefix: "Locked:",
      deferDisabledExisting: "You already have an active tax deferral pending settlement.",
      deferDisabledNonPositive: "No positive accrued tax liability to defer this quarter.",
      deferSummary: (accrued, dueMonth, priorDueFormatted) =>
        `Defers ${accrued} until month ${dueMonth}${
          priorDueFormatted
            ? ` (today's matured deferral of ${priorDueFormatted} is still charged)`
            : "."
        }`,
    },
    victory: {
      diplomaBadge: "SELF-EMPLOYED SURVIVAL DIPLOMA",
      richHeadline: "Rolling in It!",
      heroHeadline: '"Self-Employed Hero!"',
      richSubheadline:
        "You cleared 150,000 € in net bank cash without the Tax Agency or your clients finishing you off.",
      heroSubheadline:
        "You survived ten full years (120 months) registered as self-employed. Your tax advisor framed your Form 036.",
      sealedBadgeHeading: "VICTORY SEAL LOCKED INTO YOUR CERTIFICATE",
      timeContributedLabel: "Time contributed:",
      liquidityLabel: "Cash:",
      endlessGuaranteeNote:
        "Even if you continue in Endless Mode and fall later on, this seal is permanently stamped on your final certificate.",
      continueEndlessBtn: "Keep filing in Endless Mode",
      enterKeyLabel: "Enter",
      retireBtn: "Retire on top and issue final certificate",
    },
    annual: {
      formBadge: "FORM 390 · ANNUAL FISCAL SUMMARY",
      heading: (year, month) => `Year ${year} Closing (Month ${month})`,
      intro:
        "Another calendar year survived without pulling down the shutters. Official balance and setup at year-end:",
      grossBilled: "Annual gross billing:",
      operatingPersonalExpenses: "Operating & personal expenses:",
      quarterlyTaxesPaid: "Quarterly taxes paid:",
      netCashChange: "Net treasury change:",
      yearEndCash: "Year-end cash balance:",
      structureHeading: "YEAR-END OPERATING SETUP",
      gestorCardLabel: "Advisor",
      familyCardLabel: "Household",
      staffCardLabel: "Staff",
      soloLabel: "Solo",
      perMonthSuffix: "/mo",
      childrenCountPrefix: (count) => `${count} ${count === 1 ? "child" : "children"} · `,
      highlightsHeading: "Memorable moments of the year",
      closeBtn: (year, nextYear) => `Archive Year ${year} & open Year ${nextYear}`,
      enterKeyLabel: "Enter",
    },
    abandon: {
      heading: "File voluntary deregistration (Form 036)",
      closeAria: "Close dialog",
      closeTitle: "Cancel and return to desk (Esc)",
      prompt: "How do you want to permanently close this run and issue your final certificate?",
      oposicionesTitle: "📚 Lock yourself in to study civil-service exams",
      oposicionesDesc: "Trade rush Friday invoices for study binders and pastel highlighters.",
      salariedTitle: "💼 Return to a salaried office job",
      salariedDesc: "You have a boss again, but paid vacations are back on the menu.",
      ceseTitle: "📄 File for cessation of activity",
      ceseDesc: "Pull down the shutters after experiencing the fine print of freelancing.",
    },
  },
  endRun: {
    timeSurvivedLabel: "Time survived",
    finalCashLabel: "Final cash",
    officialBillingLabel: "Official billing",
    seedLabel: "Seed",
    victoryBadgesHeading: "Victory seals earned in this career",
    shareBtn: "Share",
    shareTitle: "Share certificate (S)",
    copyBtn: "Copy summary",
    copyTitle: "Copy summary to clipboard (C)",
    downloadBtn: "Download PNG",
    downloadTitle: "Download PNG certificate (D)",
    newRunBtn: "Register as Self-Employed",
    newRunTitle: "Start a new self-employed run (N or Enter)",
    returnTitleBtn: "Home & Hall of the Fallen",
    returnTitleAttr: "Return to home & Hall of the Fallen (I or Esc)",
    officialCertBadge: "OFFICIAL CERTIFICATE",
    canvasAria: "Self-employed survival certificate Form 036-END",
    feedbackCopied: "Summary copied to clipboard! Ready to paste on WhatsApp or Telegram.",
    feedbackCopyFailed: "Could not access the clipboard in this browser.",
    feedbackDownloaded: (filename) => `PNG certificate downloaded (${filename}).`,
    feedbackDownloadFailed: "Could not generate the PNG download.",
    feedbackClipboardFallback:
      "Summary copied to clipboard! (Native sharing is unavailable on this device).",
    feedbackShared: "Certificate shared successfully!",
  },
};

export function getUiStrings(locale: SupportedLocale = "es-ES"): UiStrings {
  return normalizeLocale(locale) === "en" ? EN_STRINGS : ES_STRINGS;
}
