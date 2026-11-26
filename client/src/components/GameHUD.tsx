import React, { useState } from "react";
import {
  Heart,
  LogOut,
  RefreshCw,
  Skull,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import type {
  PlayerState,
  RoomStatus,
  RoundEndEvent,
  RoundModifier,
} from "@shared/types";
import { MAX_SCORE_TO_WIN, MODIFIER_META, WEAPON_META } from "../constants";
import { soundManager } from "../audio/SoundManager";

interface GameHUDProps {
  mode: "online" | "local";
  roomCode?: string;
  status: RoomStatus;
  modifier: RoundModifier;
  sessionId: string;
  players: Record<string, PlayerState>;
  lastRoundEnd: RoundEndEvent | null;
  onLeave: () => void;
  onResetLocalArena?: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  mode,
  roomCode,
  status,
  modifier,
  sessionId,
  players,
  lastRoundEnd,
  onLeave,
  onResetLocalArena,
}) => {
  const [muted, setMuted] = useState(() => soundManager.isMuted());
  const playerList = Object.values(players);
  const localPlayer = players[sessionId];
  const modInfo = MODIFIER_META[modifier] || MODIFIER_META.normal;
  const weaponInfo =
    WEAPON_META[localPlayer?.weapon || "pistol"] || WEAPON_META.pistol;

  const handleToggleMute = () => {
    const next = soundManager.toggleMute();
    setMuted(next);
  };

  // Usar puntajes de lastRoundEnd si están presentes para detectar campeón de 5 puntos
  const getDisplayScore = (p: PlayerState): number => {
    if (status === "round_end" && lastRoundEnd?.scores[p.id] !== undefined) {
      return lastRoundEnd.scores[p.id];
    }
    return p.score;
  };

  const champion =
    status === "round_end"
      ? playerList.find((p) => getDisplayScore(p) >= MAX_SCORE_TO_WIN) || null
      : null;

  const roundWinner = lastRoundEnd?.winnerId
    ? players[lastRoundEnd.winnerId]
    : null;

  const hp = Math.max(0, Math.round(localPlayer?.hp ?? 0));
  const maxHp = localPlayer?.maxHp ?? 100;
  const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));

  return (
    <>
      {/* Barra superior: Sala, Modificador de Ronda, Marcador y Controles */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 backdrop-blur-md">
            {mode === "local" ? (
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Arena Práctica
              </span>
            ) : (
              <span className="font-mono text-xs font-bold tracking-widest text-emerald-300">
                SALA {roomCode}
              </span>
            )}
          </div>

          <div
            title={modInfo.desc}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold backdrop-blur-md ${modInfo.pillClass}`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{modInfo.label}</span>
          </div>
        </div>

        {/* Marcador central de jugadores */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
          {playerList.map((p) => {
            const isMe = p.id === sessionId;
            const scoreVal = getDisplayScore(p);
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 backdrop-blur-md transition ${
                  isMe
                    ? "border-emerald-400/50 bg-slate-900/90"
                    : "border-slate-800 bg-slate-900/80"
                } ${!p.alive ? "opacity-55" : ""}`}
              >
                <span
                  className="h-3 w-3 rounded-full border border-slate-950"
                  style={{
                    backgroundColor: p.color,
                    boxShadow: p.alive ? `0 0 8px ${p.color}` : undefined,
                  }}
                />
                <span className="max-w-[92px] truncate text-xs font-bold text-slate-100">
                  {p.name}
                </span>
                {!p.alive ? (
                  <Skull className="h-3.5 w-3.5 text-rose-400" />
                ) : (
                  <span className="text-[10px] font-semibold text-emerald-400">
                    {Math.round(p.hp)}HP
                  </span>
                )}
                <span className="rounded-md bg-slate-950/90 px-2 py-0.5 font-mono text-xs font-black text-amber-300">
                  {scoreVal}
                  {mode === "online" ? `/${MAX_SCORE_TO_WIN}` : ""}
                </span>
              </div>
            );
          })}
        </div>

        {/* Botones superiores derechos */}
        <div className="pointer-events-auto flex items-center gap-2">
          {mode === "local" && onResetLocalArena && (
            <button
              type="button"
              onClick={onResetLocalArena}
              title="Generar nueva arena y modificador"
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 backdrop-blur-md transition hover:bg-amber-500/25"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nueva Arena</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleMute}
            title={muted ? "Activar sonido" : "Silenciar sonido"}
            className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/85 p-2 text-slate-200 backdrop-blur-md transition hover:border-emerald-400/50 hover:text-emerald-300"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
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

      {/* Barra inferior estilo ZombsRoyale: Salud (izquierda) y Arma Equipada (derecha) */}
      {localPlayer && (
        <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 px-4 py-4">
          {/* Barra de Salud (100 HP) */}
          <div className="w-64 rounded-2xl border border-slate-800 bg-slate-950/85 p-3 shadow-xl backdrop-blur-md">
            <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Heart className="h-3.5 w-3.5 fill-emerald-400" />
                SALUD
              </span>
              <span className="font-mono text-white">
                {hp} / {maxHp}
              </span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${hpPercent}%`,
                  backgroundColor:
                    hpPercent > 55
                      ? "#22C55E"
                      : hpPercent > 28
                      ? "#EAB308"
                      : "#EF4444",
                }}
              />
            </div>
          </div>

          {/* Ranura de Arma Equipada */}
          <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/85 px-4 py-3 shadow-xl backdrop-blur-md">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl border-2 font-mono text-xs font-black text-slate-950"
              style={{
                backgroundColor: weaponInfo.badgeColor,
                borderColor: "#ffffff55",
              }}
            >
              {localPlayer.weapon.slice(0, 3).toUpperCase()}
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-white">
                {weaponInfo.label}
              </div>
              <div className="text-[11px] font-medium text-slate-400">
                {weaponInfo.shortStats}
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Banner entre rondas */}
      {mode === "online" && status === "round_end" && !champion && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-20 flex justify-center px-4">
          <div className="rounded-2xl border border-emerald-400/40 bg-slate-900/92 px-6 py-3.5 text-center shadow-2xl backdrop-blur-xl">
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">
              Fin de Ronda
            </p>
            <p className="mt-0.5 text-lg font-black text-white">
              {roundWinner ? (
                <>
                  Sobreviviente:{" "}
                  <span style={{ color: roundWinner.color }}>
                    {roundWinner.name}
                  </span>{" "}
                  (+1 pto)
                </>
              ) : (
                "¡Doble eliminación sin sobrevivientes!"
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Generando nueva arena y modificador...
            </p>
          </div>
        </div>
      )}

      {/* Modal de Campeón al llegar a 5 puntos */}
      {mode === "online" && status === "round_end" && champion && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/40 bg-slate-900 p-7 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/15">
              <Trophy className="h-7 w-7 text-amber-400" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
              ¡Victoria Real en la Arena!
            </p>
            <h2
              className="mt-1 text-3xl font-black"
              style={{ color: champion.color }}
            >
              {champion.name}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Alcanzó los {MAX_SCORE_TO_WIN} puntos · Nueva partida en breve...
            </p>

            <div className="mt-5 space-y-2 text-left">
              {[...playerList]
                .sort((a, b) => getDisplayScore(b) - getDisplayScore(a))
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
                      <span className="text-sm font-bold text-white">
                        {p.name}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-black text-amber-300">
                      {getDisplayScore(p)} pts
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
