import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import type { AbilityType } from "@shared/types";
import {
  ABILITY_META,
  ABILITY_ORDER,
  TACTICAL_COLORS,
} from "../constants";
import {
  AbilityVectorIcon,
  OperatorTopDownSVG,
  ReticleLogoSVG,
} from "./TacticalIcons";

interface HomeScreenProps {
  nickname: string;
  selectedColor: string;
  selectedAbility: AbilityType;
  initialRoomCode: string;
  loading: boolean;
  error: string | null;
  onNicknameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onAbilityChange: (ability: AbilityType) => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onStartLocalMode: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  nickname,
  selectedColor,
  selectedAbility,
  initialRoomCode,
  loading,
  error,
  onNicknameChange,
  onColorChange,
  onAbilityChange,
  onCreateRoom,
  onJoinRoom,
  onStartLocalMode,
}) => {
  const [roomCode, setRoomCode] = useState(initialRoomCode.slice(0, 4));

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = roomCode.trim().toUpperCase();
    if (!cleaned) return;
    onJoinRoom(cleaned);
  };

  const activeColorMeta =
    TACTICAL_COLORS.find(
      (c) => c.hex.toUpperCase() === selectedColor.toUpperCase()
    ) || TACTICAL_COLORS[0];

  const activeAbilityMeta = ABILITY_META[selectedAbility] || ABILITY_META.dash;

  return (
    <div className="relative z-10 flex h-full w-full justify-center overflow-y-auto bg-slate-950/85 bg-tactical-grid px-4 py-6 backdrop-blur-md">
      <div className="my-auto w-full max-w-5xl">
        {/* Barra Superior */}
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700/80 bg-slate-900/95 px-5 py-3.5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-950">
              <ReticleLogoSVG className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-wider text-white sm:text-3xl">
                BALA <span className="text-amber-500">PERDIDA</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-display text-xs font-bold uppercase tracking-widest text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              2D TACTICAL ARENA
            </span>
          </div>
        </header>

        {error && (
          <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-red-500/50 bg-red-950/70 px-4 py-3 text-xs font-medium text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Layout de 2 Paneles Tácticos Equilibrados */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* PANEL IZQUIERDO: OPERATOR & LOADOUT */}
          <section className="flex flex-col rounded-lg border border-slate-700/80 bg-slate-900/95 p-5 shadow-2xl lg:col-span-7">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
                // OPERATOR &amp; LOADOUT
              </span>
              <span className="font-display text-[11px] uppercase tracking-widest text-slate-500">
                UNIT READY
              </span>
            </div>

            {/* Visor de Operador + Identificador */}
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="bg-visor-reticle relative flex h-36 items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-950/90 sm:col-span-5">
                <span className="absolute left-2.5 top-2 font-display text-[10px] uppercase tracking-widest text-slate-500">
                  TOP-DOWN VISOR
                </span>
                <OperatorTopDownSVG color={selectedColor} size={108} withWeapon />
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between font-display text-[10px] uppercase tracking-wider text-slate-400">
                  <span>{activeColorMeta.code}</span>
                  <span className="text-amber-400">{activeAbilityMeta.code}</span>
                </div>
              </div>

              <div className="flex flex-col justify-between sm:col-span-7">
                <div>
                  <label className="mb-1.5 block font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
                    OPERATOR IDENTIFIER
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={nickname}
                    onChange={(e) => onNicknameChange(e.target.value)}
                    placeholder="ENTER CALLSIGN"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-medium text-white placeholder-slate-500 outline-none transition focus:border-amber-500"
                  />
                </div>

                {/* Selector de Color (6 bloques rectangulares tácticos) */}
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
                      COLOR SPECIFICATION
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      {activeColorMeta.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {TACTICAL_COLORS.map((c) => {
                      const active =
                        selectedColor.toUpperCase() === c.hex.toUpperCase();
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => onColorChange(c.hex)}
                          title={c.name}
                          className={`group relative flex h-9 items-center justify-center rounded border transition ${
                            active
                              ? "border-amber-400 bg-slate-800 ring-1 ring-amber-400/60"
                              : "border-slate-700 bg-slate-950 hover:border-slate-500"
                          }`}
                        >
                          <span
                            className="h-5 w-full mx-1.5 rounded-sm border border-slate-950/60"
                            style={{ backgroundColor: c.hex }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Selector de Habilidad Activa (4 tarjetas en fila) */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
                  TACTICAL MODULE
                </span>
                <span className="font-display text-[11px] uppercase tracking-wider text-slate-500">
                  TRIGGER: SPACE / RMB
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {ABILITY_ORDER.map((abId) => {
                  const meta = ABILITY_META[abId];
                  const active = selectedAbility === abId;
                  return (
                    <button
                      key={abId}
                      type="button"
                      onClick={() => onAbilityChange(abId)}
                      className={`relative flex flex-col justify-between rounded-lg border p-3 text-left transition ${
                        active
                          ? "border-amber-500 bg-slate-800/90 shadow-amber"
                          : "border-slate-800 bg-slate-950/80 hover:border-slate-600"
                      }`}
                    >
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded border ${
                              active
                                ? "border-amber-500/50 bg-amber-500/15 text-amber-400"
                                : "border-slate-800 bg-slate-900 text-slate-300"
                            }`}
                          >
                            <AbilityVectorIcon ability={abId} className="h-4 w-4" />
                          </span>
                          {active && (
                            <span className="rounded bg-amber-500 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider text-slate-950">
                              ACTIVE
                            </span>
                          )}
                        </div>

                        <div className="font-display text-sm font-bold uppercase tracking-wider text-white">
                          {meta.code}
                        </div>
                        <div className="font-display text-[11px] font-semibold text-amber-400">
                          {meta.cooldownLabel}
                        </div>
                      </div>

                      <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
                        {meta.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* PANEL DERECHO: DEPLOYMENT */}
          <section className="flex flex-col justify-between rounded-lg border border-slate-700/80 bg-slate-900/95 p-5 shadow-2xl lg:col-span-5">
            <div>
              <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
                  // DEPLOYMENT
                </span>
                <span className="font-display text-[11px] uppercase tracking-widest text-emerald-400">
                  MAX 4 OPERATORS
                </span>
              </div>

              {/* Acción Principal: CREATE ROOM */}
              <div className="mb-5">
                <p className="mb-2 text-xs text-slate-400">
                  Inicia una instancia multijugador privada y comparte el código táctico de 4 caracteres con tu escuadrón.
                </p>
                <button
                  type="button"
                  disabled={loading || !nickname.trim()}
                  onClick={onCreateRoom}
                  className="w-full rounded-lg border-b-4 border-amber-700 bg-amber-500 px-5 py-4 font-display text-base font-bold uppercase tracking-wider text-slate-950 transition-all hover:bg-amber-400 active:translate-y-0.5 active:border-b-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "CONNECTING..." : "▶ CREATE ROOM"}
                </button>
              </div>

              {/* Escuadrón Privado: JOIN WITH CODE */}
              <div className="mb-5 rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                <label className="mb-2 block font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
                  JOIN WITH CODE
                </label>
                <form onSubmit={handleJoinSubmit} className="flex gap-2.5">
                  <input
                    type="text"
                    maxLength={4}
                    value={roomCode}
                    onChange={(e) =>
                      setRoomCode(
                        e.target.value
                          .replace(/[^a-zA-Z0-9]/g, "")
                          .toUpperCase()
                          .slice(0, 4)
                      )
                    }
                    placeholder="K8P2"
                    className="w-full flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-center font-display text-lg font-bold uppercase tracking-[0.3em] text-white placeholder-slate-600 outline-none transition focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={loading || roomCode.trim().length < 4 || !nickname.trim()}
                    className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-white transition hover:border-amber-500 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    JOIN →
                  </button>
                </form>
              </div>
            </div>

            {/* Modo Práctica: SOLO PRACTICE // BOTS */}
            <div>
              <div className="mb-2 font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
                OFFLINE TRAINING
              </div>
              <button
                type="button"
                onClick={onStartLocalMode}
                className="group flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950/90 px-4 py-3.5 text-left transition hover:border-amber-500/70 hover:bg-slate-800/80"
              >
                <div>
                  <div className="font-display text-sm font-bold uppercase tracking-wider text-slate-100 group-hover:text-amber-400">
                    SOLO PRACTICE // BOTS
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    Prueba armas especiales, trampas, mutadores y habilidades sin red
                  </div>
                </div>
                <span className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 font-display text-xs font-bold text-amber-400 group-hover:border-amber-500/50">
                  ENTER
                </span>
              </button>

              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/90 pt-3 font-display text-[11px] uppercase tracking-wider text-slate-500">
                <span>WASD: MOVE</span>
                <span>LMB: FIRE</span>
                <span>SPACE/RMB: MODULE</span>
                <span>1-4: EMOTES</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
