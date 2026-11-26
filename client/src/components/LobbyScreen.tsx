import React, { useState } from "react";
import {
  Check,
  Copy,
  LogOut,
  Play,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { AbilityType, PlayerState } from "@shared/types";
import { ABILITY_META, ABILITY_ORDER, NEON_COLORS } from "../constants";

interface LobbyScreenProps {
  roomCode: string;
  sessionId: string;
  players: Record<string, PlayerState>;
  onToggleReady: () => void;
  onStartGame: () => void;
  onUpdateColor: (color: string) => void;
  onUpdateAbility: (ability: AbilityType) => void;
  onLeaveRoom: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  roomCode,
  sessionId,
  players,
  onToggleReady,
  onStartGame,
  onUpdateColor,
  onUpdateAbility,
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
      window.prompt("Copia el enlace de invitación:", inviteUrl);
    }
  };

  return (
    <div className="relative flex h-full w-full justify-center overflow-y-auto bg-slate-950 bg-neon-grid px-4 py-6">
      <div className="pointer-events-none fixed left-1/3 top-1/4 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative z-10 my-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/92 p-6 shadow-2xl backdrop-blur-xl sm:p-7">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Users className="h-4 w-4 text-amber-400" />
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

        <div className="mb-5 rounded-2xl border border-amber-500/30 bg-slate-950/80 p-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Código de Sala
          </p>
          <div className="mt-1 font-mono text-4xl font-black tracking-[0.28em] text-amber-300">
            {roomCode || "----"}
          </div>
          <button
            type="button"
            onClick={handleCopyInvite}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20"
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

        <div className="mb-4 space-y-2">
          {playerList.map((player) => {
            const isMe = player.id === sessionId;
            const abMeta =
              ABILITY_META[player.ability] || ABILITY_META.dash;
            return (
              <div
                key={player.id}
                className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 transition ${
                  isMe
                    ? "border-amber-400/40 bg-slate-800/80"
                    : "border-slate-800 bg-slate-950/60"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-white/40"
                    style={{
                      backgroundColor: player.color,
                      boxShadow: `0 0 10px ${player.color}`,
                    }}
                  />
                  <span className="truncate text-sm font-bold text-white">
                    {player.name}
                  </span>
                  {isMe && (
                    <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                      Tú
                    </span>
                  )}
                  <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                    {abMeta.emoji} {abMeta.label.split(" ")[0]}
                  </span>
                </div>

                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    player.ready
                      ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                      : "border border-slate-700 bg-slate-800 text-slate-400"
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

        {localPlayer && (
          <div className="mb-5 space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">
                Color del personaje:
              </span>
              <div className="flex items-center gap-2">
                {NEON_COLORS.map((c) => {
                  const active =
                    localPlayer.color.toUpperCase() === c.hex.toUpperCase();
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => onUpdateColor(c.hex)}
                      title={c.name}
                      className={`h-5 w-5 rounded-full border transition ${
                        active
                          ? "scale-125 border-white"
                          : "border-white/25 opacity-70 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-bold text-slate-400">
                Tu Habilidad Activa:
              </span>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {ABILITY_ORDER.map((abId) => {
                  const meta = ABILITY_META[abId];
                  const active = localPlayer.ability === abId;
                  return (
                    <button
                      key={abId}
                      type="button"
                      onClick={() => onUpdateAbility(abId)}
                      title={meta.desc}
                      className={`flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${
                        active
                          ? "border-amber-400 bg-slate-800 text-white"
                          : "border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      <span className="text-base">{meta.emoji}</span>
                      <span className="max-w-full truncate">
                        {meta.label.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onToggleReady}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
              localPlayer?.ready
                ? "border border-emerald-400/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                : "bg-amber-400 text-slate-950 hover:bg-amber-300"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            {localPlayer?.ready ? "Cancelar Listo" : "¡Estoy Listo!"}
          </button>

          <button
            type="button"
            disabled={!canStart}
            onClick={onStartGame}
            className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-500/20 px-4 py-3 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="h-4 w-4" />
            {canStart ? "Iniciar Partida" : "Mínimo 2 Jugadores"}
          </button>
        </div>
      </div>
    </div>
  );
};
