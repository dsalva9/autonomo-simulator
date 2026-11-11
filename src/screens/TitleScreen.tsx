import {
  AlertCircle,
  Award,
  CheckCircle2,
  FilePlus2,
  FolderArchive,
  Play,
  Sparkles,
} from "lucide-react";
import { type FormEvent, useState } from "react";
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

  const [seedInput, setSeedInput] = useState("");

  const hasResumableRun = activeRun !== null && activeRun.ending === null;
  const resumableCalendar = hasResumableRun ? formatCalendarBadgeEs(activeRun.month) : null;

  const handleStartFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    void startRun(seedInput);
  };

  const unlockedCount = ACHIEVEMENT_CATALOG.filter((ach) =>
    Boolean(profile.achievements[ach.id]),
  ).length;

  return (
    <main
      data-testid="title-screen"
      className="min-h-screen px-4 py-6 sm:py-10 max-w-5xl mx-auto space-y-6"
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
            className="font-bureau text-xs font-bold px-2.5 py-1 rounded border border-[#1f2421] bg-[#fffdf8] cursor-pointer"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Hero Bureaucratic Header Card */}
      <section className="paper-dossier rounded-2xl overflow-hidden">
        <div className="bg-[#1f2421] text-[#fffdf8] px-5 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#1f2421]">
          <span className="stamp-badge text-xs text-[#fce592]">
            MODELO 036 · DECLARACIÓN CENSAL DE ALTA EN EL RETA
          </span>
          <span className="font-bureau text-xs text-[#efe4ce]">EJERCICIO FISCAL · ESPAÑA</span>
        </div>

        <div className="p-6 sm:p-8 bg-gradient-to-br from-[#fffdf8] via-[#fffdf8] to-[#f6efe0] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <h1 className="font-editorial text-3xl sm:text-5xl font-bold text-[#1f2421] tracking-tight">
              Autónomo Simulator
            </h1>
            <blockquote className="border-l-4 border-[#b42b24] pl-4 py-1 font-editorial italic text-lg sm:text-xl text-[#373f3a]">
              «Sé tu propio jefe. Descubre por qué era mala idea.»
            </blockquote>
            <p className="text-sm sm:text-base text-[#4a524e] leading-relaxed">
              Sobrevive diez años (120 meses) entre presupuestos regateados, facturas a sesenta
              días, cuotas mensuales implacables y cierres trimestrales de IVA e IRPF. O acumula{" "}
              <strong className="font-bureau text-[#1f5c53]">150.000 €</strong> limpios antes de que
              el estrés o los números rojos te tumben.
            </p>
          </div>

          {/* Official Tilted Rubber Stamp */}
          <div className="self-start lg:self-center shrink-0 rotate-[-3deg] rounded-xl border-4 border-[#b42b24] bg-[#fdf0ef] px-5 py-3 text-center shadow-xs">
            <p className="stamp-badge text-[11px] text-[#b42b24]">VENTANILLA ÚNICA</p>
            <p className="font-bureau text-lg font-black text-[#b42b24]">120 MESES</p>
            <p className="font-bureau text-[11px] font-bold text-[#373f3a]">SIN RED SALARIAL</p>
          </div>
        </div>
      </section>

      {/* Main Action Grid: Continue / New Run + Archive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Play Actions */}
        <div className="lg:col-span-5 space-y-5">
          {hasResumableRun && resumableCalendar && (
            <section
              data-testid="continue-run-card"
              className="paper-dossier rounded-xl p-5 bg-[#e8f5f1] border-2 border-[#1f2421] space-y-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="stamp-badge text-xs px-2 py-0.5 rounded bg-[#1f5c53] text-[#fffdf8]">
                  EXPEDIENTE ACTIVO
                </span>
                <span className="font-bureau text-xs font-bold text-[#373f3a]">
                  Semilla: {activeRun.prng.seed}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-[#1f2421]/30 bg-[#fffdf8] p-3 text-xs">
                <div>
                  <span className="text-[#4a524e] block">Calendario</span>
                  <strong
                    data-testid="continue-run-calendar"
                    className="font-editorial text-sm text-[#1f2421]"
                  >
                    {resumableCalendar.label}
                  </strong>
                </div>
                <div>
                  <span className="text-[#4a524e] block">Dinero en caja</span>
                  <strong
                    data-testid="continue-run-money"
                    className={`font-bureau text-sm ${
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
                onClick={continueRun}
                className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] font-bold text-base px-4 py-3 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Play className="w-5 h-5 fill-current" aria-hidden="true" />
                Continuar partida
              </button>
            </section>
          )}

          {/* New Run Card */}
          <form
            onSubmit={handleStartFormSubmit}
            className="paper-dossier rounded-xl p-5 space-y-4 bg-[#fffdf8]"
          >
            <div className="flex items-center justify-between border-b border-[#1f2421]/20 pb-2.5">
              <h2 className="font-editorial text-lg font-bold text-[#1f2421] flex items-center gap-2">
                <FilePlus2 className="w-5 h-5 text-[#b42b24]" aria-hidden="true" />
                Nueva alta en el RETA
              </h2>
              <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#fcf4df] text-[#8f510d]">
                CASILLA 01
              </span>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="seed-input"
                className="block text-xs font-bold text-[#373f3a] uppercase tracking-wide"
              >
                Semilla reproducible (opcional)
              </label>
              <input
                id="seed-input"
                data-testid="seed-input"
                type="text"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                placeholder="Ej. AUT-2026-PACO (vacío = aleatoria)"
                maxLength={40}
                className="w-full min-h-11 rounded-lg border-2 border-[#1f2421]/60 bg-[#f6efe0] px-3.5 py-2 font-bureau text-sm text-[#1f2421] placeholder:text-[#4a524e]/70"
              />
            </div>

            <button
              type="submit"
              data-testid="start-run-btn"
              className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#b42b24] hover:bg-[#96221c] text-[#fffdf8] font-bold text-base px-4 py-3 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              <Sparkles className="w-5 h-5" aria-hidden="true" />
              Nueva alta en el RETA
            </button>

            {hasResumableRun && (
              <p className="text-xs text-[#8f510d] text-center">
                Nota: iniciar una nueva alta reemplazará el expediente actualmente en curso.
              </p>
            )}
          </form>

          {/* Accessibility & Motion Toggle */}
          <section className="paper-dossier-warm rounded-xl p-4 flex items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-bold text-[#1f2421]">Preferencia de movimiento</p>
              <p className="text-[#4a524e]">
                Desactiva transiciones si prefieres lectura estática.
              </p>
            </div>
            <button
              type="button"
              data-testid="toggle-reduced-motion"
              onClick={() =>
                void setReducedMotionPreference(reducedMotionOverride === true ? null : true)
              }
              aria-pressed={reducedMotionOverride === true}
              className={`min-h-10 px-3 py-1.5 rounded-lg border-2 font-bureau font-bold cursor-pointer ${
                reducedMotionOverride === true
                  ? "border-[#1f5c53] bg-[#e8f5f1] text-[#1f5c53]"
                  : "border-[#1f2421]/50 bg-[#fffdf8] text-[#1f2421]"
              }`}
            >
              {reducedMotionOverride === true ? "Reducido: SÍ" : "Automático"}
            </button>
          </section>
        </div>

        {/* Right Column: Salón de Caídos & Logros */}
        <section className="lg:col-span-7 paper-dossier rounded-xl overflow-hidden bg-[#fffdf8]">
          <div
            role="tablist"
            aria-label="Archivo del jugador"
            className="grid grid-cols-2 border-b-2 border-[#1f2421] bg-[#efe4ce]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTitleTab === "hall_of_fame"}
              data-testid="title-tab-hall-of-fame"
              onClick={() => setActiveTitleTab("hall_of_fame")}
              className={`min-h-12 px-4 py-3 font-editorial font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer ${
                activeTitleTab === "hall_of_fame"
                  ? "bg-[#fffdf8] text-[#1f2421] border-b-2 border-[#b42b24]"
                  : "text-[#4a524e] hover:bg-[#f6efe0]"
              }`}
            >
              <FolderArchive className="w-4 h-4 text-[#b42b24]" aria-hidden="true" />
              Salón de Caídos ({profile.hall_of_fame.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTitleTab === "achievements"}
              data-testid="title-tab-achievements"
              onClick={() => setActiveTitleTab("achievements")}
              className={`min-h-12 px-4 py-3 font-editorial font-bold text-sm sm:text-base flex items-center justify-center gap-2 border-l-2 border-[#1f2421] cursor-pointer ${
                activeTitleTab === "achievements"
                  ? "bg-[#fffdf8] text-[#1f2421] border-b-2 border-[#1f5c53]"
                  : "text-[#4a524e] hover:bg-[#f6efe0]"
              }`}
            >
              <Award className="w-4 h-4 text-[#1f5c53]" aria-hidden="true" />
              Logros ({unlockedCount}/{ACHIEVEMENT_CATALOG.length})
            </button>
          </div>

          <div className="p-5">
            {activeTitleTab === "hall_of_fame" ? (
              <div data-testid="hall-of-fame-list" className="space-y-3">
                {profile.hall_of_fame.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-[#1f2421]/25 bg-[#f6efe0] p-6 text-center space-y-1.5">
                    <p className="font-editorial font-bold text-base text-[#1f2421]">
                      Archivo provincial sin expedientes cerrados
                    </p>
                    <p className="text-xs text-[#4a524e]">
                      Tus jubilaciones gloriosas, abandonos a tiempo y bancarrotas quedarán
                      registradas aquí.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {profile.hall_of_fame.map((run) => {
                      const meta = ENDING_METADATA[run.ending_id];
                      return (
                        <li
                          key={run.run_id}
                          className="rounded-lg border-2 border-[#1f2421]/40 bg-[#f6efe0] p-3.5 space-y-1.5 text-xs"
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
                          <div className="flex flex-wrap gap-x-4 gap-y-1 font-bureau font-bold text-[#373f3a]">
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
              <ul data-testid="achievements-list" className="space-y-2.5">
                {ACHIEVEMENT_CATALOG.map((ach) => {
                  const unlockedAt = profile.achievements[ach.id];
                  return (
                    <li
                      key={ach.id}
                      data-testid={`achievement-item-${ach.id}`}
                      className={`rounded-lg border-2 p-3.5 flex items-start justify-between gap-3 ${
                        unlockedAt
                          ? "border-[#1f5c53] bg-[#e8f5f1]"
                          : "border-[#1f2421]/25 bg-[#f6efe0] opacity-80"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="stamp-badge text-[10px] px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8]">
                            {ach.code}
                          </span>
                          <h3 className="font-editorial font-bold text-sm text-[#1f2421]">
                            {ach.title}
                          </h3>
                        </div>
                        <p className="text-xs text-[#373f3a]">{ach.description}</p>
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
