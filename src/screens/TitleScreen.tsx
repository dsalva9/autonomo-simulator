import {
  AlertCircle,
  Award,
  CheckCircle2,
  FilePlus2,
  FolderArchive,
  Play,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { playUiSound } from "../services/audio/soundEffects.ts";
import {
  formatCalendarBadgeEs,
  formatDurationMonthsEs,
  formatEuros,
} from "../services/i18n/resolveEventText.ts";
import { ENDING_METADATA, VICTORY_BADGE_LABELS } from "../services/share/shareResult.ts";
import { ACHIEVEMENT_CATALOG } from "../services/storage/index.ts";
import { useGameStore } from "../store/gameStore.ts";
import { useUIStore } from "../store/uiStore.ts";

export function TitleScreen() {
  const activeRun = useGameStore((s) => s.activeRun);
  const profile = useGameStore((s) => s.profile);
  const corruptedSaveNotice = useGameStore((s) => s.corruptedSaveNotice);
  const startRun = useGameStore((s) => s.startRun);
  const continueRun = useGameStore((s) => s.continueRun);
  const dismissCorruptNotice = useGameStore((s) => s.dismissCorruptNotice);
  const setReducedMotionPreference = useGameStore((s) => s.setReducedMotionPreference);

  const activeTitleTab = useUIStore((s) => s.activeTitleTab);
  const setActiveTitleTab = useUIStore((s) => s.setActiveTitleTab);
  const reducedMotionOverride = useUIStore((s) => s.reducedMotionOverride);
  const sfxMuted = useUIStore((s) => s.sfxMuted);
  const toggleSfxMuted = useUIStore((s) => s.toggleSfxMuted);
  const fastPacing = useUIStore((s) => s.fastPacing);
  const toggleFastPacing = useUIStore((s) => s.toggleFastPacing);

  const [seedInput, setSeedInput] = useState("");
  const seedInputRef = useRef<HTMLInputElement | null>(null);
  const hallTabRef = useRef<HTMLButtonElement | null>(null);
  const achievementsTabRef = useRef<HTMLButtonElement | null>(null);

  const hasResumableRun = activeRun !== null && activeRun.ending === null;
  const resumableCalendar = hasResumableRun ? formatCalendarBadgeEs(activeRun.month) : null;

  const handleStartNewRun = () => {
    playUiSound("stamp_thud", { muted: sfxMuted });
    void startRun(seedInput);
  };

  const handleStartFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    handleStartNewRun();
  };

  const handleContinueRun = () => {
    playUiSound("paper_choice", { muted: sfxMuted });
    continueRun();
  };

  const handleToggleReducedMotion = () => {
    void setReducedMotionPreference(reducedMotionOverride === true ? null : true);
  };

  const handleToggleSfx = () => {
    const willBeUnmuted = sfxMuted;
    toggleSfxMuted();
    if (willBeUnmuted) {
      playUiSound("paper_choice", { muted: false });
    }
  };

  const handleToggleFastPacing = () => {
    toggleFastPacing();
    playUiSound("paper_choice", { muted: sfxMuted });
  };

  const handleArchiveTabKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    const nextTab =
      event.key === "Home"
        ? "hall_of_fame"
        : event.key === "End"
          ? "achievements"
          : activeTitleTab === "hall_of_fame"
            ? "achievements"
            : "hall_of_fame";
    setActiveTitleTab(nextTab);
    if (nextTab === "hall_of_fame") {
      hallTabRef.current?.focus({ preventScroll: true });
    } else {
      achievementsTabRef.current?.focus({ preventScroll: true });
    }
  };

  const keyboardActionsRef = useRef({
    hasResumableRun,
    corruptedSaveNotice,
    handleContinueRun,
    handleStartNewRun,
    handleToggleReducedMotion,
    handleToggleSfx,
    handleToggleFastPacing,
    setActiveTitleTab,
    dismissCorruptNotice,
  });
  keyboardActionsRef.current = {
    hasResumableRun,
    corruptedSaveNotice,
    handleContinueRun,
    handleStartNewRun,
    handleToggleReducedMotion,
    handleToggleSfx,
    handleToggleFastPacing,
    setActiveTitleTab,
    dismissCorruptNotice,
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        if (event.key === "Escape") {
          event.preventDefault();
          target.blur();
        }
        return;
      }

      const actions = keyboardActionsRef.current;

      if (event.key === "Enter") {
        if (target && (target.tagName === "BUTTON" || target.tagName === "A")) {
          return;
        }
        event.preventDefault();
        if (actions.hasResumableRun) {
          actions.handleContinueRun();
        } else {
          actions.handleStartNewRun();
        }
        return;
      }

      if (event.key === "Escape") {
        if (actions.corruptedSaveNotice) {
          event.preventDefault();
          actions.dismissCorruptNotice();
        } else if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "c" && actions.hasResumableRun) {
        event.preventDefault();
        actions.handleContinueRun();
      } else if (key === "n") {
        event.preventDefault();
        actions.handleStartNewRun();
      } else if (key === "s" || event.key === "/") {
        event.preventDefault();
        seedInputRef.current?.focus({ preventScroll: true });
        seedInputRef.current?.select();
      } else if (event.key === "1") {
        event.preventDefault();
        actions.setActiveTitleTab("hall_of_fame");
      } else if (event.key === "2") {
        event.preventDefault();
        actions.setActiveTitleTab("achievements");
      } else if (key === "r") {
        event.preventDefault();
        actions.handleToggleReducedMotion();
      } else if (key === "m") {
        event.preventDefault();
        actions.handleToggleSfx();
      } else if (key === "f") {
        event.preventDefault();
        actions.handleToggleFastPacing();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const unlockedCount = ACHIEVEMENT_CATALOG.filter((ach) =>
    Boolean(profile.achievements[ach.id]),
  ).length;

  return (
    <main
      data-testid="title-screen"
      className="min-h-screen px-3.5 sm:px-5 py-4 sm:py-5 max-w-6xl mx-auto space-y-3.5 sm:space-y-4"
    >
      {/* Corrupt Save Recovery Banner */}
      {corruptedSaveNotice && (
        <div
          data-testid="corrupt-save-alert"
          role="alert"
          className="paper-dossier rounded-xl border-2 border-[#b42b24] bg-[#fdf0ef] p-4 flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 text-sm text-[#1f2421]">
            <AlertCircle className="w-5 h-5 text-[#b42b24] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-bold text-[#b42b24]">
                Expediente en curso dañado · Copia de seguridad archivada
              </p>
              <p className="text-xs text-[#373f3a] mt-0.5">
                Se detectó un formato inválido en el guardado automático ({corruptedSaveNotice}). Tu
                Salón de Caídos y tus logros siguen intactos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissCorruptNotice}
            className="font-bureau text-xs font-bold px-2.5 py-1 rounded border border-[#1f2421] bg-[#fffdf8] shrink-0 cursor-pointer"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Hero Bureaucratic Header Card */}
      <section className="paper-dossier rounded-2xl overflow-hidden">
        <div className="bg-[#1f2421] text-[#fffdf8] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#1f2421]">
          <span className="stamp-badge text-[11px] sm:text-xs text-[#fce592]">
            MODELO 036 · DECLARACIÓN CENSAL DE ALTA EN EL RETA
          </span>
          <span className="font-bureau text-[11px] sm:text-xs text-[#efe4ce]">
            EJERCICIO FISCAL · ESPAÑA
          </span>
        </div>

        <div className="p-4 sm:p-5 bg-gradient-to-br from-[#fffdf8] via-[#fffdf8] to-[#f6efe0] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <h1 className="font-editorial text-2xl sm:text-4xl font-bold text-[#1f2421] tracking-tight">
              Autónomo Simulator
            </h1>
            <blockquote className="border-l-4 border-[#b42b24] pl-3 py-0.5 font-editorial italic text-sm sm:text-lg text-[#373f3a]">
              «Sé tu propio jefe. Descubre por qué era mala idea.»
            </blockquote>
            <p className="text-xs sm:text-sm text-[#4a524e] leading-relaxed">
              Sobrevive diez años (120 meses) entre presupuestos regateados, facturas a sesenta
              días, cuotas mensuales implacables y cierres trimestrales de IVA e IRPF. O acumula{" "}
              <strong className="font-bureau text-[#1f5c53] tabular-nums">150.000 €</strong> limpios
              antes de que el estrés o los números rojos te tumben.
            </p>
          </div>

          {/* Official Tilted Rubber Stamp — safe margin prevents clipping on narrow 360px phones */}
          <div className="self-start lg:self-center shrink-0 mx-1.5 my-0.5 rotate-[-2.5deg] rounded-xl border-4 border-[#b42b24] bg-[#fdf0ef] px-4 py-2.5 text-center shadow-xs">
            <p className="stamp-badge text-[10px] sm:text-[11px] text-[#b42b24]">
              VENTANILLA ÚNICA
            </p>
            <p className="font-bureau text-base sm:text-lg font-black text-[#b42b24] tabular-nums">
              120 MESES
            </p>
            <p className="font-bureau text-[10px] sm:text-[11px] font-bold text-[#373f3a]">
              SIN RED SALARIAL
            </p>
          </div>
        </div>
      </section>

      {/* Main Action Grid: Play & Settings (Left) + Archive (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Play Actions & Desk Preferences */}
        <div className="lg:col-span-5 space-y-3">
          {hasResumableRun && resumableCalendar && (
            <section
              data-testid="continue-run-card"
              className="paper-dossier rounded-xl overflow-hidden bg-[#e8f5f1]"
            >
              <div className="dossier-header !bg-[#d7ede6] !border-[#1f5c53]/25">
                <span className="stamp-badge text-[11px] px-2 py-0.5 rounded bg-[#1f5c53] text-[#fffdf8]">
                  EXPEDIENTE ACTIVO
                </span>
                <span className="font-bureau text-xs font-bold text-[#373f3a] truncate">
                  Semilla: {activeRun.prng.seed}
                </span>
              </div>

              <div className="p-3.5 space-y-2.5">
                <div className="grid grid-cols-2 divide-x divide-[#1f2421]/14 rounded-lg border border-[#1f2421]/25 bg-[#fffdf8] text-xs">
                  <div className="p-2">
                    <span className="text-[#4a524e] block text-[11px]">Calendario</span>
                    <strong
                      data-testid="continue-run-calendar"
                      className="font-editorial text-sm text-[#1f2421]"
                    >
                      {resumableCalendar.label}
                    </strong>
                  </div>
                  <div className="p-2">
                    <span className="text-[#4a524e] block text-[11px]">Dinero en caja</span>
                    <strong
                      data-testid="continue-run-money"
                      className={`font-bureau text-sm tabular-nums whitespace-nowrap ${
                        activeRun.indicators.money < 0 ? "text-[#b42b24]" : "text-[#1f5c53]"
                      }`}
                    >
                      {formatEuros(activeRun.indicators.money)}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="continue-run-btn"
                  title="Continuar expediente activo (C o Intro)"
                  onClick={handleContinueRun}
                  className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] font-bold text-base px-4 py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Play className="w-5 h-5 fill-current shrink-0" aria-hidden="true" />
                  <span>Continuar partida</span>
                  <kbd className="hidden xl:inline-block ml-1 font-bureau text-xs px-1.5 py-0.5 rounded bg-[#fffdf8]/20">
                    C
                  </kbd>
                </button>
              </div>
            </section>
          )}

          {/* New Run Card */}
          <form
            onSubmit={handleStartFormSubmit}
            className="paper-dossier rounded-xl overflow-hidden bg-[#fffdf8]"
          >
            <div className="dossier-header">
              <h2 className="font-editorial text-base font-bold text-[#1f2421] flex items-center gap-2">
                <FilePlus2 className="w-4 h-4 text-[#b42b24] shrink-0" aria-hidden="true" />
                Nueva alta en el RETA
              </h2>
              <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#fcf4df] text-[#8f510d]">
                CASILLA 01
              </span>
            </div>

            <div className="p-3.5 space-y-2.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="seed-input"
                    className="block text-xs font-bold text-[#373f3a] uppercase tracking-wide"
                  >
                    Semilla reproducible (opcional)
                  </label>
                  <kbd className="hidden xl:inline-block font-bureau text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#efe4ce] text-[#373f3a]">
                    S
                  </kbd>
                </div>
                <input
                  ref={seedInputRef}
                  id="seed-input"
                  data-testid="seed-input"
                  type="text"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  placeholder="Ej. AUT-2026-PACO (vacío = aleatoria)"
                  maxLength={40}
                  className="w-full min-h-11 rounded-lg border-2 border-[#1f2421]/55 bg-[#f6efe0] px-3.5 py-2 font-bureau text-sm text-[#1f2421] placeholder:text-[#4a524e]/70"
                />
              </div>

              <button
                type="submit"
                data-testid="start-run-btn"
                title="Iniciar nueva partida en el RETA (N)"
                className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#b42b24] hover:bg-[#96221c] text-[#fffdf8] font-bold text-base px-4 py-3 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <Sparkles className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Nueva alta en el RETA</span>
                <kbd className="hidden xl:inline-block ml-1 font-bureau text-xs px-1.5 py-0.5 rounded bg-[#fffdf8]/20">
                  N
                </kbd>
              </button>

              {hasResumableRun && (
                <p className="text-xs text-[#8f510d] text-center">
                  Nota: iniciar una nueva alta reemplazará el expediente actualmente en curso.
                </p>
              )}
            </div>
          </form>

          {/* Compact Desk Preferences Card: Motion, Sound & Fast Pacing */}
          <section className="paper-dossier rounded-xl overflow-hidden bg-[#fffdf8]">
            <div className="dossier-header">
              <h2 className="font-editorial text-base font-bold text-[#1f2421] flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#373f3a] shrink-0" aria-hidden="true" />
                Ajustes de despacho
              </h2>
              <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#efe4ce] text-[#373f3a]">
                PREFERENCIAS
              </span>
            </div>

            <div className="divide-y divide-[#1f2421]/14 text-xs">
              <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[#1f2421]">Movimiento reducido</p>
                  <p className="text-[11px] text-[#4a524e]">
                    Lectura estática sin inclinaciones ni animaciones.
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="toggle-reduced-motion"
                  title="Alternar movimiento reducido (R)"
                  onClick={handleToggleReducedMotion}
                  aria-pressed={reducedMotionOverride === true}
                  className={`min-h-9 px-3 py-1.5 rounded-lg border font-bureau font-bold shrink-0 cursor-pointer ${
                    reducedMotionOverride === true
                      ? "border-[#1f5c53] bg-[#e8f5f1] text-[#1f5c53]"
                      : "border-[#1f2421]/45 bg-[#f6efe0] text-[#1f2421]"
                  }`}
                >
                  {reducedMotionOverride === true ? "Reducido: SÍ" : "Automático"}
                </button>
              </div>

              <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[#1f2421]">Sonido de oficina</p>
                  <p className="text-[11px] text-[#4a524e]">
                    Sellos, papel y timbre en decisiones y trimestres.
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="toggle-sfx-title-btn"
                  title="Alternar sonido de oficina (M)"
                  aria-pressed={!sfxMuted}
                  onClick={handleToggleSfx}
                  className={`min-h-9 px-3 py-1.5 rounded-lg border font-bureau font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    !sfxMuted
                      ? "border-[#1f5c53] bg-[#e8f5f1] text-[#1f5c53]"
                      : "border-[#1f2421]/45 bg-[#f6efe0] text-[#4a524e]"
                  }`}
                >
                  {sfxMuted ? (
                    <VolumeX className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{sfxMuted ? "Silenciado" : "Activo"}</span>
                </button>
              </div>

              <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[#1f2421]">Modo ágil</p>
                  <p className="text-[11px] text-[#4a524e]">
                    Avanza directamente al siguiente trámite salvo fin de partida.
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="toggle-fast-pacing-title-btn"
                  title="Alternar modo ágil (F)"
                  aria-pressed={fastPacing}
                  onClick={handleToggleFastPacing}
                  className={`min-h-9 px-3 py-1.5 rounded-lg border font-bureau font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    fastPacing
                      ? "border-[#8f510d] bg-[#fcf4df] text-[#8f510d]"
                      : "border-[#1f2421]/45 bg-[#f6efe0] text-[#1f2421]"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{fastPacing ? "Ágil: SÍ" : "Normal"}</span>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Salón de Caídos & 15 Logros */}
        <section className="lg:col-span-7 paper-dossier rounded-xl overflow-hidden bg-[#fffdf8]">
          <div
            role="tablist"
            aria-label="Archivo del jugador"
            onKeyDown={handleArchiveTabKeyDown}
            className="grid grid-cols-2 border-b-2 border-[#1f2421]/25 bg-[#efe4ce]"
          >
            <button
              ref={hallTabRef}
              id="title-tab-hall-of-fame"
              type="button"
              role="tab"
              tabIndex={activeTitleTab === "hall_of_fame" ? 0 : -1}
              aria-selected={activeTitleTab === "hall_of_fame"}
              aria-controls="title-archive-panel"
              data-testid="title-tab-hall-of-fame"
              title="Salón de Caídos (1)"
              onClick={() => setActiveTitleTab("hall_of_fame")}
              className={`min-h-12 px-3 sm:px-4 py-3 font-editorial font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer ${
                activeTitleTab === "hall_of_fame"
                  ? "bg-[#fffdf8] text-[#1f2421] shadow-[inset_0_-3px_0_0_#b42b24]"
                  : "text-[#4a524e] hover:bg-[#f6efe0]"
              }`}
            >
              <FolderArchive className="w-4 h-4 text-[#b42b24] shrink-0" aria-hidden="true" />
              <span className="truncate">Salón de Caídos ({profile.hall_of_fame.length})</span>
            </button>
            <button
              ref={achievementsTabRef}
              id="title-tab-achievements"
              type="button"
              role="tab"
              tabIndex={activeTitleTab === "achievements" ? 0 : -1}
              aria-selected={activeTitleTab === "achievements"}
              aria-controls="title-archive-panel"
              data-testid="title-tab-achievements"
              title="Logros desbloqueados (2)"
              onClick={() => setActiveTitleTab("achievements")}
              className={`min-h-12 px-3 sm:px-4 py-3 font-editorial font-bold text-sm sm:text-base flex items-center justify-center gap-2 border-l-2 border-[#1f2421]/25 cursor-pointer ${
                activeTitleTab === "achievements"
                  ? "bg-[#fffdf8] text-[#1f2421] shadow-[inset_0_-3px_0_0_#1f5c53]"
                  : "text-[#4a524e] hover:bg-[#f6efe0]"
              }`}
            >
              <Award className="w-4 h-4 text-[#1f5c53] shrink-0" aria-hidden="true" />
              <span className="truncate">
                Logros ({unlockedCount}/{ACHIEVEMENT_CATALOG.length})
              </span>
            </button>
          </div>

          <div
            id="title-archive-panel"
            role="tabpanel"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA APG Tabs pattern & WCAG 2.1.1 scrollable tabpanel
            tabIndex={0}
            aria-labelledby={
              activeTitleTab === "hall_of_fame"
                ? "title-tab-hall-of-fame"
                : "title-tab-achievements"
            }
            data-testid="title-archive-panel"
            className="p-4 max-h-[480px] overflow-y-auto dossier-scroll"
          >
            {activeTitleTab === "hall_of_fame" ? (
              <div data-testid="hall-of-fame-list" className="space-y-2.5">
                {profile.hall_of_fame.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-[#1f2421]/20 bg-[#f6efe0] p-8 text-center space-y-1.5">
                    <p className="font-editorial font-bold text-base text-[#1f2421]">
                      Archivo provincial sin expedientes cerrados
                    </p>
                    <p className="text-xs text-[#4a524e] max-w-md mx-auto">
                      Tus jubilaciones gloriosas, abandonos a tiempo y bancarrotas quedarán
                      registradas aquí con su cotización oficial.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {profile.hall_of_fame.map((run) => {
                      const meta = ENDING_METADATA[run.ending_id];
                      return (
                        <li
                          key={run.run_id}
                          className="rounded-lg border border-[#1f2421]/25 bg-[#f6efe0] p-3.5 space-y-1.5 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-editorial font-bold text-sm text-[#1f2421]">
                              {meta.title}
                            </span>
                            <span
                              className={`stamp-badge text-[10px] px-2 py-0.5 rounded border ${
                                meta.tone === "victory"
                                  ? "bg-[#e8f5f1] text-[#1f5c53] border-[#1f5c53]/40"
                                  : meta.tone === "abandon"
                                    ? "bg-[#ebf2fa] text-[#264e7a] border-[#264e7a]/40"
                                    : "bg-[#fdf0ef] text-[#b42b24] border-[#b42b24]/40"
                              }`}
                            >
                              {meta.stampText}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 font-bureau font-bold text-[#373f3a] tabular-nums">
                            <span>⏱ {formatDurationMonthsEs(run.months_survived)}</span>
                            <span>💶 Caja: {formatEuros(run.final_money)}</span>
                            <span>🧾 Facturado: {formatEuros(run.lifetime_billed)}</span>
                          </div>
                          {run.earned_victories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {run.earned_victories.map((badge) => (
                                <span
                                  key={badge}
                                  className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#e8f5f1] text-[#1f5c53] border border-[#1f5c53]/40"
                                >
                                  ★ {VICTORY_BADGE_LABELS[badge].shortSeal}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="italic text-[#4a524e]">«{run.summary_quote}»</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : (
              <ul data-testid="achievements-list" className="space-y-2">
                {ACHIEVEMENT_CATALOG.map((ach) => {
                  const unlockedAt = profile.achievements[ach.id];
                  return (
                    <li
                      key={ach.id}
                      data-testid={`achievement-item-${ach.id}`}
                      className={`rounded-lg border p-3 flex items-start justify-between gap-3 ${
                        unlockedAt
                          ? "border-[#1f5c53] bg-[#e8f5f1]"
                          : "border-[#1f2421]/20 bg-[#f6efe0] opacity-85"
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="stamp-badge text-[10px] px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8]">
                            {ach.code}
                          </span>
                          <h3 className="font-editorial font-bold text-sm text-[#1f2421]">
                            {ach.title}
                          </h3>
                        </div>
                        <p className="text-xs text-[#373f3a] leading-snug">{ach.description}</p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 stamp-badge text-[10px] px-2 py-1 rounded ${
                          unlockedAt ? "bg-[#1f5c53] text-[#fffdf8]" : "bg-[#efe4ce] text-[#4a524e]"
                        }`}
                      >
                        {unlockedAt ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            SELLADO
                          </>
                        ) : (
                          "PENDIENTE"
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
