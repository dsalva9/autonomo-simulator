import { Briefcase, Heart, ShieldCheck, Users } from "lucide-react";
import type { GameState, RenderMode } from "../../engine/index.ts";
import { compiledCatalog, resolveCharacterPortraitAsset } from "../../services/content/catalog.ts";
import {
  formatEuros,
  translateFamilyStatus,
  translateGestorTier,
} from "../../services/i18n/resolveEventText.ts";

export interface EntornoPanelProps {
  state: GameState;
}

function renderModeClass(mode: RenderMode): string {
  return mode === "pixel_art" ? "render-pixel-art" : "render-vector-hd";
}

export function EntornoPanel({ state }: EntornoPanelProps) {
  const { characters, manifest } = compiledCatalog;

  const gestorChar = state.gestor.character_id ? characters[state.gestor.character_id] : undefined;
  const gestorPortrait = resolveCharacterPortraitAsset(manifest, gestorChar);

  const partnerChar = state.family.partner_character_id
    ? characters[state.family.partner_character_id]
    : undefined;
  const partnerPortrait = resolveCharacterPortraitAsset(manifest, partnerChar);

  const employeeChar = state.employee ? characters[state.employee.character_id] : undefined;
  const employeePortrait = resolveCharacterPortraitAsset(manifest, employeeChar);

  return (
    <section
      data-testid="panel-entorno"
      aria-label="Entorno personal y profesional"
      className="paper-dossier rounded-xl overflow-hidden bg-[#fffdf8]"
    >
      <div className="dossier-header">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-4 h-4 text-[#264e7a] shrink-0" aria-hidden="true" />
          <h2 className="font-editorial font-bold text-base text-[#1f2421] truncate">
            Red de Apoyo
          </h2>
        </div>
        <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#efe4ce] text-[#373f3a] shrink-0">
          ENTORNO
        </span>
      </div>

      <div className="divide-y divide-[#1f2421]/14">
        {/* Row 1: Gestoría */}
        <div className="px-3.5 py-2.5 flex items-center gap-3">
          <div className="w-11 shrink-0 flex items-center justify-center">
            {gestorPortrait ? (
              <div
                data-testid="entorno-polaroid-gestor"
                className="polaroid-card p-1 pb-1.5 rounded-[3px]"
              >
                <span className="polaroid-pin polaroid-pin-sm" aria-hidden="true" />
                <img
                  src={gestorPortrait.url}
                  alt={gestorChar?.name ?? "Gestoría"}
                  width={gestorPortrait.width}
                  height={gestorPortrait.height}
                  decoding="async"
                  className={`w-9 h-9 aspect-square object-cover border border-[#1f2421]/35 bg-[#f6efe0] ${renderModeClass(
                    gestorPortrait.render_mode,
                  )}`}
                />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-lg border border-[#1f2421]/25 bg-[#f6efe0] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[#8f510d]" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-xs space-y-0.5">
            <div className="stamp-badge text-[10px] text-[#8f510d] leading-none">
              GESTORÍA FISCAL
            </div>
            <p className="font-bold text-[#1f2421] truncate">
              {gestorChar ? gestorChar.name : translateGestorTier(state.gestor.tier)}
            </p>
            <p className="font-bureau text-[11px] text-[#4a524e] tabular-nums truncate">
              {formatEuros(state.gestor.monthly_fee)}/mes · Escudo{" "}
              {Math.round(state.gestor.inspection_shield * 100)}%
            </p>
          </div>
        </div>

        {/* Row 2: Familia / Pareja */}
        <div className="px-3.5 py-2.5 flex items-center gap-3">
          <div className="w-11 shrink-0 flex items-center justify-center">
            {partnerPortrait ? (
              <div
                data-testid="entorno-polaroid-partner"
                className="polaroid-card p-1 pb-1.5 rounded-[3px]"
              >
                <span className="polaroid-pin polaroid-pin-sm" aria-hidden="true" />
                <img
                  src={partnerPortrait.url}
                  alt={partnerChar?.name ?? "Pareja"}
                  width={partnerPortrait.width}
                  height={partnerPortrait.height}
                  decoding="async"
                  className={`w-9 h-9 aspect-square object-cover border border-[#1f2421]/35 bg-[#f6efe0] ${renderModeClass(
                    partnerPortrait.render_mode,
                  )}`}
                />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-lg border border-[#1f2421]/25 bg-[#f6efe0] flex items-center justify-center">
                <Heart className="w-5 h-5 text-[#b42b24]" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-xs space-y-0.5">
            <div className="stamp-badge text-[10px] text-[#b42b24] leading-none">VIDA PERSONAL</div>
            <p className="font-bold text-[#1f2421] truncate">
              {translateFamilyStatus(state.family.status)}
              {partnerChar ? ` · ${partnerChar.name}` : ""}
            </p>
            <p className="font-bureau text-[11px] text-[#4a524e] tabular-nums truncate">
              Hijos: {state.family.children_count} · {formatEuros(state.family.monthly_cost)}/mes
            </p>
          </div>
        </div>

        {/* Row 3: Empleado (max 1) */}
        <div className="px-3.5 py-2.5 flex items-center gap-3">
          <div className="w-11 shrink-0 flex items-center justify-center">
            {state.employee && employeePortrait ? (
              <div
                data-testid="entorno-polaroid-employee"
                className="polaroid-card p-1 pb-1.5 rounded-[3px]"
              >
                <span className="polaroid-pin polaroid-pin-sm" aria-hidden="true" />
                <img
                  src={employeePortrait.url}
                  alt={employeeChar?.name ?? state.employee.role_label}
                  width={employeePortrait.width}
                  height={employeePortrait.height}
                  decoding="async"
                  className={`w-9 h-9 aspect-square object-cover border border-[#1f2421]/35 bg-[#f6efe0] ${renderModeClass(
                    employeePortrait.render_mode,
                  )}`}
                />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-lg border border-[#1f2421]/25 bg-[#f6efe0] flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[#1f5c53]" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-xs space-y-0.5">
            <div className="stamp-badge text-[10px] text-[#1f5c53] leading-none">
              PLANTILLA (MÁX. 1)
            </div>
            {state.employee ? (
              <>
                <p className="font-bold text-[#1f2421] truncate">
                  {employeeChar ? `${employeeChar.name} · ` : ""}
                  {state.employee.role_label}
                </p>
                <p className="font-bureau text-[11px] text-[#4a524e] tabular-nums truncate">
                  {formatEuros(state.employee.monthly_cost)}/mes · Fact. ×
                  {state.employee.billing_multiplier.toFixed(2).replace(".", ",")}
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-[#1f2421] truncate">Sin empleados en nómina</p>
                <p className="text-[11px] text-[#4a524e] truncate">
                  En solitario · Cero nóminas fijas
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
