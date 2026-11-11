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
      className="paper-dossier rounded-xl p-4 space-y-3.5"
    >
      <div className="flex items-center justify-between border-b-2 border-[#1f2421]/20 pb-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#264e7a]" aria-hidden="true" />
          <h2 className="font-editorial font-bold text-base text-[#1f2421]">Red de Apoyo</h2>
        </div>
        <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#efe4ce] text-[#373f3a]">
          ENTORNO
        </span>
      </div>

      {/* Gestoría Card */}
      <div className="rounded-lg border border-[#1f2421]/35 bg-[#f6efe0] p-3 flex items-start gap-3">
        {gestorPortrait ? (
          <div
            data-testid="entorno-polaroid-gestor"
            className="polaroid-card shrink-0 p-1 pb-2 rounded-[3px] mt-0.5"
          >
            <span className="polaroid-pin polaroid-pin-sm" aria-hidden="true" />
            <img
              src={gestorPortrait.url}
              alt={gestorChar?.name ?? "Gestoría"}
              width={gestorPortrait.width}
              height={gestorPortrait.height}
              loading="lazy"
              decoding="async"
              className={`w-11 h-11 aspect-square object-cover border border-[#1f2421]/35 bg-[#f6efe0] ${renderModeClass(
                gestorPortrait.render_mode,
              )}`}
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-md border border-[#1f2421]/40 bg-[#fffdf8] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-[#8f510d]" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1 text-xs space-y-0.5">
          <div className="stamp-badge text-[10px] text-[#8f510d]">GESTORÍA FISCAL</div>
          <p className="font-bold text-[#1f2421] truncate">
            {gestorChar ? gestorChar.name : translateGestorTier(state.gestor.tier)}
          </p>
          <p className="font-bureau text-[11px] text-[#373f3a]">
            Cuota: {formatEuros(state.gestor.monthly_fee)}/mes · Escudo:{" "}
            {Math.round(state.gestor.inspection_shield * 100)}%
          </p>
        </div>
      </div>

      {/* Familia / Pareja Card */}
      <div className="rounded-lg border border-[#1f2421]/35 bg-[#f6efe0] p-3 flex items-start gap-3">
        {partnerPortrait ? (
          <div
            data-testid="entorno-polaroid-partner"
            className="polaroid-card shrink-0 p-1 pb-2 rounded-[3px] mt-0.5"
          >
            <span className="polaroid-pin polaroid-pin-sm" aria-hidden="true" />
            <img
              src={partnerPortrait.url}
              alt={partnerChar?.name ?? "Pareja"}
              width={partnerPortrait.width}
              height={partnerPortrait.height}
              loading="lazy"
              decoding="async"
              className={`w-11 h-11 aspect-square object-cover border border-[#1f2421]/35 bg-[#f6efe0] ${renderModeClass(
                partnerPortrait.render_mode,
              )}`}
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-md border border-[#1f2421]/40 bg-[#fffdf8] flex items-center justify-center shrink-0">
            <Heart className="w-6 h-6 text-[#b42b24]" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1 text-xs space-y-0.5">
          <div className="stamp-badge text-[10px] text-[#b42b24]">VIDA PERSONAL</div>
          <p className="font-bold text-[#1f2421]">
            {translateFamilyStatus(state.family.status)}
            {partnerChar ? ` · ${partnerChar.name}` : ""}
          </p>
          <p className="font-bureau text-[11px] text-[#373f3a]">
            Hijos: {state.family.children_count} · Gasto: {formatEuros(state.family.monthly_cost)}
            /mes
          </p>
        </div>
      </div>

      {/* Empleado Card (max 1) */}
      <div className="rounded-lg border border-[#1f2421]/35 bg-[#f6efe0] p-3 flex items-start gap-3">
        {state.employee && employeePortrait ? (
          <div
            data-testid="entorno-polaroid-employee"
            className="polaroid-card shrink-0 p-1 pb-2 rounded-[3px] mt-0.5"
          >
            <span className="polaroid-pin polaroid-pin-sm" aria-hidden="true" />
            <img
              src={employeePortrait.url}
              alt={employeeChar?.name ?? state.employee.role_label}
              width={employeePortrait.width}
              height={employeePortrait.height}
              loading="lazy"
              decoding="async"
              className={`w-11 h-11 aspect-square object-cover border border-[#1f2421]/35 bg-[#f6efe0] ${renderModeClass(
                employeePortrait.render_mode,
              )}`}
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-md border border-[#1f2421]/40 bg-[#fffdf8] flex items-center justify-center shrink-0">
            <Briefcase className="w-6 h-6 text-[#1f5c53]" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1 text-xs space-y-0.5">
          <div className="stamp-badge text-[10px] text-[#1f5c53]">PLANTILLA (MÁX. 1)</div>
          {state.employee ? (
            <>
              <p className="font-bold text-[#1f2421] truncate">
                {employeeChar ? `${employeeChar.name} · ` : ""}
                {state.employee.role_label}
              </p>
              <p className="font-bureau text-[11px] text-[#373f3a]">
                Coste: {formatEuros(state.employee.monthly_cost)}/mes · Facturación ×
                {state.employee.billing_multiplier.toFixed(2).replace(".", ",")}
              </p>
            </>
          ) : (
            <>
              <p className="font-bold text-[#1f2421]">Sin empleados en nómina</p>
              <p className="text-[11px] text-[#4a524e]">
                Trabajas en solitario: menos capacidad, cero nóminas fijas.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
