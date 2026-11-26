import React, { useState } from "react";
import {
  AlertCircle,
  Crosshair,
  LogIn,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";
import type { AbilityType } from "@shared/types";
import { ABILITY_META, ABILITY_ORDER, NEON_COLORS } from "../constants";

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
  const [roomCode, setRoomCode] = useState(initialRoomCode);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    onJoinRoom(roomCode.trim().toUpperCase());
  };

  return (
    <div className="relative flex h-full w-full justify-center overflow-y-auto bg-slate-950 bg-neon-grid px-4 py-6">
      <div className="pointer-events-none fixed -top-32 left-1/4 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-32 right-1/4 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl" />

      <div className="relative z-10 my-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/92 p-6 shadow-2xl backdrop-blur-xl sm:p-7">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-2.5 flex h-13 w-13 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/15 p-3 shadow-lg">
            <Crosshair className="h-7 w-7 text-amber-300" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            BALA <span className="text-amber-400">PERDIDA</span>
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-400 sm:text-sm">
            Arena Battle Royale 2D Caótica · Armas Doradas · Habilidades · Mutadores Locos
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
            Tu Apodo
          </label>
          <input
            type="text"
            maxLength={16}
            value={nickname}
            onChange={(e) => onNicknameChange(e.target.value)}
            placeholder="Ej. Capitán Caos"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-sm font-medium text-white placeholder-slate-500 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
            Color del Personaje
          </label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {NEON_COLORS.map((c) => {
              const active =
                selectedColor.toUpperCase() === c.hex.toUpperCase();
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => onColorChange(c.hex)}
                  title={c.name}
                  className={`group flex flex-col items-center gap-1 rounded-xl border p-2 transition ${
                    active
                      ? "scale-[1.04] border-white bg-slate-800/95"
                      : "border-slate-800 bg-slate-950/60 hover:border-slate-600"
                  }`}
                >
                  <span
                    className="h-6 w-6 rounded-full border-2 border-slate-950 ring-1 ring-white/40 transition-transform group-hover:scale-110"
                    style={{
                      backgroundColor: c.hex,
                      boxShadow: active ? `0 0 14px ${c.glow}` : undefined,
                    }}
                  />
                  <span className="max-w-full truncate text-[9px] font-bold text-slate-300">
                    {c.name.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
            Habilidad Inicial (Espacio / Click Derecho)
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ABILITY_ORDER.map((abId) => {
              const meta = ABILITY_META[abId];
              const active = selectedAbility === abId;
              return (
                <button
                  key={abId}
                  type="button"
                  onClick={() => onAbilityChange(abId)}
                  className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                    active
                      ? "border-amber-400 bg-slate-800/95 shadow-md"
                      : "border-slate-800 bg-slate-950/60 hover:border-slate-600"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-lg">
                    {meta.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-bold text-white">
                        {meta.label}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-amber-300">
                        {meta.cooldownSec}s
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">
                      {meta.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={loading || !nickname.trim()}
          onClick={onCreateRoom}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {loading ? "Conectando..." : "Crear Sala"}
        </button>

        <form onSubmit={handleJoinSubmit} className="mb-4 flex gap-2">
          <input
            type="text"
            maxLength={6}
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="CÓDIGO (EJ. A7K9)"
            className="flex-1 rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 font-mono text-sm font-bold uppercase tracking-widest text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
          />
          <button
            type="submit"
            disabled={loading || !roomCode.trim() || !nickname.trim()}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-4 py-2.5 text-sm font-bold text-cyan-300 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            Unirse
          </button>
        </form>

        <div className="relative my-4 flex items-center">
          <div className="flex-grow border-t border-slate-800" />
          <span className="mx-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            O prueba sin servidor
          </span>
          <div className="flex-grow border-t border-slate-800" />
        </div>

        <button
          type="button"
          onClick={onStartLocalMode}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/20"
        >
          <Play className="h-4 w-4" />
          Modo de Prueba Local (Sin Servidor)
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
        </button>

        <p className="mt-4 text-center text-[11px] text-slate-500">
          <span className="text-slate-300">WASD</span> mover ·{" "}
          <span className="text-slate-300">Click Izq.</span> disparar ·{" "}
          <span className="text-slate-300">Espacio/Click Der.</span> habilidad ·{" "}
          <span className="text-slate-300">1-4</span> emotes
        </p>
      </div>
    </div>
  );
};
