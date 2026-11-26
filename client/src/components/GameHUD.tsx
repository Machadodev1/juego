import React, { useState } from "react";
import { LogOut, RefreshCw, Skull, Trophy, Volume2, VolumeX } from "lucide-react";
import type { PlayerState, RoomStatus, RoundEndEvent } from "@shared/types";
import { MAX_SCORE_TO_WIN } from "../constants";
import { soundManager } from "../audio/SoundManager";

interface GameHUDProps {
  mode: "online" | "local";
  roomCode?: string;
  status: RoomStatus;
  sessionId: string;
  players: Record<string, PlayerState>;
  winnerId: string;
  lastRoundEnd: RoundEndEvent | null;
  onLeave: () => void;
  onResetLocalMaze?: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  mode,
  roomCode,
  status,
  sessionId,
  players,
  winnerId,
  lastRoundEnd,
  onLeave,
  onResetLocalMaze,
}) => {
  const [muted, setMuted] = useState(() => soundManager.isMuted());
  const playerList = Object.values(players);

  const handleToggleMute = () => {
    const next = soundManager.toggleMute();
    setMuted(next);
  };

  // Determine champion if any player reached MAX_SCORE_TO_WIN
  const champion =
    playerList.find((p) => p.score >= MAX_SCORE_TO_WIN) ||
    (status === "round_end" && winnerId && players[winnerId]?.score >= MAX_SCORE_TO_WIN
      ? players[winnerId]
      : null);

  const roundWinnerId = lastRoundEnd ? lastRoundEnd.winnerId : winnerId || null;
  const roundWinner = roundWinnerId ? players[roundWinnerId] : null;

  return (
    <>
      {/* Top Bar */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 py-3">
        {/* Left badge */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/85 px-3 py-2 backdrop-blur-md">
          {mode === "local" ? (
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Modo Prueba Local
            </span>
          ) : (
            <span className="font-mono text-xs font-bold tracking-widest text-cyan-300">
              SALA {roomCode}
            </span>
          )}
        </div>

        {/* Center Scoreboard */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
          {playerList.map((p) => {
            const isMe = p.id === sessionId;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-1.5 backdrop-blur-md transition ${
                  isMe
                    ? "border-cyan-500/40 bg-slate-900/90"
                    : "border-slate-800 bg-slate-900/80"
                } ${!p.alive ? "opacity-55" : ""}`}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: p.color,
                    boxShadow: p.alive ? `0 0 8px ${p.color}` : undefined,
                  }}
                />
                <span className="max-w-[96px] truncate text-xs font-bold text-slate-100">
                  {p.name}
                </span>
                {!p.alive && <Skull className="h-3.5 w-3.5 text-rose-400" />}
                <span className="rounded-md bg-slate-950/90 px-2 py-0.5 font-mono text-xs font-black text-cyan-300">
                  {p.score}
                  {mode === "online" ? `/${MAX_SCORE_TO_WIN}` : ""}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          {mode === "local" && onResetLocalMaze && (
            <button
              type="button"
              onClick={onResetLocalMaze}
              title="Generar nuevo laberinto"
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 backdrop-blur-md transition hover:bg-emerald-500/25"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nuevo Mapa</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleMute}
            title={muted ? "Activar sonido" : "Silenciar sonido"}
            className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/85 p-2 text-slate-200 backdrop-blur-md transition hover:border-cyan-400/50 hover:text-cyan-300"
          >
            {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onLeave}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/85 px-3 py-2 text-xs font-bold text-slate-200 backdrop-blur-md transition hover:border-rose-500/50 hover:text-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Round End Banner (non-champion) */}
      {mode === "online" && status === "round_end" && !champion && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-20 flex justify-center px-4">
          <div className="rounded-2xl border border-cyan-400/40 bg-slate-900/90 px-6 py-3 text-center shadow-neon backdrop-blur-xl">
            <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">
              Fin de Ronda
            </p>
            <p className="mt-0.5 text-lg font-black text-white">
              {roundWinner ? (
                <>
                  Punto para{" "}
                  <span style={{ color: roundWinner.color }}>{roundWinner.name}</span>
                </>
              ) : (
                "¡Empate en la ronda!"
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Preparando siguiente laberinto...
            </p>
          </div>
        </div>
      )}

      {/* Champion Modal (5 points reached) */}
      {mode === "online" && status === "round_end" && champion && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/40 bg-slate-900 p-7 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/15">
              <Trophy className="h-7 w-7 text-amber-400" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
              ¡Tenemos Campeón!
            </p>
            <h2
              className="mt-1 text-3xl font-black"
              style={{ color: champion.color }}
            >
              {champion.name}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Alcanzó los {MAX_SCORE_TO_WIN} puntos de victoria
            </p>

            <div className="mt-5 space-y-2 text-left">
              {[...playerList]
                .sort((a, b) => b.score - a.score)
                .map((p, index) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-slate-500">
                        #{index + 1}
                      </span>
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-sm font-bold text-white">{p.name}</span>
                    </div>
                    <span className="font-mono text-sm font-black text-cyan-300">
                      {p.score} pts
                    </span>
                  </div>
                ))}
            </div>

            <button
              type="button"
              onClick={onLeave}
              className="mt-6 w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-neon transition hover:bg-cyan-400"
            >
              Volver al Inicio
            </button>
          </div>
        </div>
      )}
    </>
  );
};
