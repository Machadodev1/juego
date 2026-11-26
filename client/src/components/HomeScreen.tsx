import React, { useState } from "react";
import { Crosshair, Play, Plus, LogIn, Sparkles, AlertCircle } from "lucide-react";
import { NEON_COLORS } from "../constants";

interface HomeScreenProps {
  nickname: string;
  selectedColor: string;
  initialRoomCode: string;
  loading: boolean;
  error: string | null;
  onNicknameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onStartLocalMode: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  nickname,
  selectedColor,
  initialRoomCode,
  loading,
  error,
  onNicknameChange,
  onColorChange,
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
    <div className="relative flex min-h-screen w-full items-center justify-center bg-slate-950 bg-neon-grid px-4 py-8 overflow-y-auto">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-1/4 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-7 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/15 shadow-neon">
            <Crosshair className="h-7 w-7 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            BALA <span className="text-emerald-400">PERDIDA</span>
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Arena Battle Royale 2D · Cajas de Botín · Armas & Modificadores
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
            placeholder="Ej. CazadorX"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-sm font-medium text-white placeholder-slate-500 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Color del Personaje
          </label>
          <div className="grid grid-cols-4 gap-2.5">
            {NEON_COLORS.map((c) => {
              const active =
                selectedColor.toUpperCase() === c.hex.toUpperCase();
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => onColorChange(c.hex)}
                  title={c.name}
                  className={`group flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition ${
                    active
                      ? "border-white bg-slate-800/90 scale-[1.03]"
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
                  <span className="text-[10px] font-medium text-slate-300 truncate max-w-full">
                    {c.name.split(" ")[0]}
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
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
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
          Controles: <span className="text-slate-300">WASD</span> mover ·{" "}
          <span className="text-slate-300">Mouse</span> apuntar ·{" "}
          <span className="text-slate-300">Click/Espacio</span> disparar ·{" "}
          <span className="text-slate-300">E</span> recoger
        </p>
      </div>
    </div>
  );
};
