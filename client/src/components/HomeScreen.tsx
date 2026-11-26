import React, { useState } from "react";
import {
  AlertCircle,
  Crosshair,
  LogIn,
  Play,
  Plus,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { NEON_COLORS, THEME_META, THEME_ORDER } from "../constants";

interface HomeScreenProps {
  nickname: string;
  selectedColor: string;
  selectedTheme: string;
  initialRoomCode: string;
  loading: boolean;
  error: string | null;
  onNicknameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onThemeChange: (theme: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onStartLocalMode: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  nickname,
  selectedColor,
  selectedTheme,
  initialRoomCode,
  loading,
  error,
  onNicknameChange,
  onColorChange,
  onThemeChange,
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
    <div className="relative flex h-full w-full justify-center overflow-y-auto bg-slate-950 bg-neon-grid px-4 py-8">
      <div className="pointer-events-none fixed -top-32 left-1/4 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-32 right-1/4 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl" />

      <div className="relative z-10 my-auto w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-7 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-500/15 shadow-neon">
            <Crosshair className="h-7 w-7 text-cyan-300" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            BALA <span className="text-cyan-300">PERDIDA</span>
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Arena táctica 2D · 4 mapas · 7 armas · Modificadores de ronda
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tu Apodo
          </label>
          <input
            type="text"
            maxLength={16}
            value={nickname}
            onChange={(e) => onNicknameChange(e.target.value)}
            placeholder="Ej. Agente Sombra"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-sm font-medium text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
          />
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Color del Agente
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
                      ? "scale-[1.04] border-white bg-slate-800/90"
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
                  <span className="max-w-full truncate text-[9px] font-semibold text-slate-300">
                    {c.name.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Mapa
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onThemeChange("random")}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                selectedTheme === "random"
                  ? "border-white bg-slate-800/90 text-white"
                  : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-600"
              }`}
            >
              <Shuffle className="h-4 w-4 text-slate-300" />
              Aleatorio
            </button>
            {THEME_ORDER.map((t) => {
              const meta = THEME_META[t];
              const active = selectedTheme === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onThemeChange(t)}
                  title={meta.desc}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                    active
                      ? "border-white bg-slate-800/90 text-white"
                      : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-md border border-white/30"
                    style={{ backgroundColor: meta.swatch }}
                  />
                  <span className="truncate">
                    {meta.emoji} {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={loading || !nickname.trim()}
          onClick={onCreateRoom}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {loading ? "Conectando..." : "Crear Sala Online"}
        </button>

        <form onSubmit={handleJoinSubmit} className="mb-5 flex gap-2">
          <input
            type="text"
            maxLength={6}
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="CÓDIGO (EJ. A7K9)"
            className="flex-1 rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 font-mono text-sm font-bold uppercase tracking-widest text-white placeholder-slate-500 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20"
          />
          <button
            type="submit"
            disabled={loading || !roomCode.trim() || !nickname.trim()}
            className="flex items-center gap-1.5 rounded-xl border border-pink-500/50 bg-pink-500/15 px-4 py-2.5 text-sm font-bold text-pink-300 transition hover:bg-pink-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            Unirse
          </button>
        </form>

        <div className="relative my-5 flex items-center">
          <div className="flex-grow border-t border-slate-800" />
          <span className="mx-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            O entrenamiento local
          </span>
          <div className="flex-grow border-t border-slate-800" />
        </div>

        <button
          type="button"
          onClick={onStartLocalMode}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20"
        >
          <Play className="h-4 w-4" />
          Practicar en Arena con Bots (Sin Red)
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
        </button>

        <p className="mt-4 text-center text-[11px] text-slate-500">
          <span className="text-slate-300">WASD</span> mover ·{" "}
          <span className="text-slate-300">Mouse</span> apuntar ·{" "}
          <span className="text-slate-300">Click/Espacio</span> disparar ·{" "}
          <span className="text-slate-300">E</span> recoger ·{" "}
          <span className="text-slate-300">1-3/Rueda</span> cambiar arma
        </p>
      </div>
    </div>
  );
};
