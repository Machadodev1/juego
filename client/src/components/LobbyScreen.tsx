import React, { useState } from "react";
import { Check, Copy, LogOut, Play, ShieldCheck, Users } from "lucide-react";
import type { PlayerState } from "@shared/types";
import { NEON_COLORS } from "../constants";

interface LobbyScreenProps {
  roomCode: string;
  sessionId: string;
  players: Record<string, PlayerState>;
  onToggleReady: () => void;
  onStartGame: () => void;
  onUpdateColor: (color: string) => void;
  onLeaveRoom: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  roomCode,
  sessionId,
  players,
  onToggleReady,
  onStartGame,
  onUpdateColor,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);

  const playerList = Object.values(players);
  const localPlayer = players[sessionId];
  const canStart = playerList.length >= 2;

  const handleCopyInvite = async () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
      window.prompt("Copia el enlace de invitación:", inviteUrl);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-slate-950 bg-neon-grid px-4 py-8">
      <div className="pointer-events-none absolute top-1/4 left-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/90 p-7 shadow-2xl backdrop-blur-xl">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            <Users className="h-4 w-4 text-cyan-400" />
            Sala de Espera ({playerList.length}/4)
          </div>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-rose-500/50 hover:text-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            Salir
          </button>
        </div>

        {/* Room Code */}
        <div className="mb-6 rounded-2xl border border-cyan-500/30 bg-slate-950/80 p-5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Código de Sala
          </p>
          <div className="mt-1 font-mono text-4xl font-black tracking-[0.28em] text-cyan-300">
            {roomCode || "----"}
          </div>
          <button
            type="button"
            onClick={handleCopyInvite}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/20"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-300">¡Enlace Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar Enlace de Invitación
              </>
            )}
          </button>
        </div>

        {/* Players List */}
        <div className="mb-6 space-y-2.5">
          {playerList.map((player) => {
            const isMe = player.id === sessionId;
            return (
              <div
                key={player.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition ${
                  isMe
                    ? "border-cyan-500/40 bg-slate-800/80"
                    : "border-slate-800 bg-slate-950/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-4 w-4 rounded-full border border-white/40"
                    style={{
                      backgroundColor: player.color,
                      boxShadow: `0 0 10px ${player.color}`,
                    }}
                  />
                  <span className="text-sm font-bold text-white">
                    {player.name}
                  </span>
                  {isMe && (
                    <span className="rounded-md bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-300">
                      Tú
                    </span>
                  )}
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    player.ready
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  {player.ready ? (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5" />
                      LISTO
                    </>
                  ) : (
                    "ESPERANDO"
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Quick color switch in lobby */}
        {localPlayer && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-400">Cambiar color:</span>
            <div className="flex items-center gap-2">
              {NEON_COLORS.map((c) => {
                const active = localPlayer.color.toUpperCase() === c.hex.toUpperCase();
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => onUpdateColor(c.hex)}
                    title={c.name}
                    className={`h-5 w-5 rounded-full border transition ${
                      active ? "scale-125 border-white" : "border-white/25 opacity-70 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onToggleReady}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
              localPlayer?.ready
                ? "border border-emerald-400/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                : "bg-cyan-500 text-slate-950 shadow-neon hover:bg-cyan-400"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            {localPlayer?.ready ? "Cancelar Listo" : "¡Estoy Listo!"}
          </button>

          <button
            type="button"
            disabled={!canStart}
            onClick={onStartGame}
            className="flex items-center justify-center gap-2 rounded-xl border border-pink-500/50 bg-pink-500/20 px-4 py-3 text-sm font-bold text-pink-200 transition hover:bg-pink-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="h-4 w-4" />
            {canStart ? "Iniciar Partida" : "Mínimo 2 Jugadores"}
          </button>
        </div>
      </div>
    </div>
  );
};
