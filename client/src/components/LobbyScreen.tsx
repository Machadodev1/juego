import React, { useState } from "react";
import { Check, Copy, LogOut, Play } from "lucide-react";
import type { AbilityType, PlayerState } from "@shared/types";
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
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copy invite link:", inviteUrl);
    }
  };

  return (
    <div className="relative z-10 flex h-full w-full justify-center overflow-y-auto bg-slate-950/85 bg-tactical-grid px-4 py-6 backdrop-blur-md">
      <div className="my-auto w-full max-w-3xl rounded-lg border border-slate-700/80 bg-slate-900/95 p-5 shadow-2xl sm:p-6">
        {/* Encabezado Táctico */}
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-950">
              <ReticleLogoSVG className="h-6 w-6" />
            </div>
            <div>
              <div className="font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
                // SQUAD STAGING AREA ({playerList.length}/4)
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="rounded border border-amber-500/40 bg-slate-950 px-2.5 py-0.5 font-display text-base font-bold uppercase tracking-widest text-amber-400">
                  ROOM CODE: {roomCode || "----"}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleCopyInvite()}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-display text-xs font-bold uppercase tracking-wider transition ${
              copied
                ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-400"
                : "border-slate-700 bg-slate-800 text-slate-200 hover:border-amber-500/60 hover:text-amber-400"
            }`}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                <span>COPIED!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>COPY LINK</span>
              </>
            )}
          </button>
        </header>

        {/* Grid de Jugadores 2x2 (4 cupos fijos) */}
        <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, slotIdx) => {
            const player = playerList[slotIdx];

            if (!player) {
              return (
                <div
                  key={`empty-${slotIdx}`}
                  className="flex min-h-[112px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/45 p-4 text-center"
                >
                  <span className="font-display text-xs font-semibold uppercase tracking-widest text-slate-500">
                    SLOT 0{slotIdx + 1} // OPEN
                  </span>
                  <span className="mt-1 font-display text-sm font-bold uppercase tracking-wider text-slate-600">
                    WAITING FOR PLAYER...
                  </span>
                </div>
              );
            }

            const isMe = player.id === sessionId;
            const abMeta = ABILITY_META[player.ability] || ABILITY_META.dash;

            return (
              <div
                key={player.id}
                className={`flex min-h-[112px] items-center justify-between gap-3 rounded-lg border p-4 transition ${
                  isMe
                    ? "border-amber-500/60 bg-slate-800/80"
                    : "border-slate-700/80 bg-slate-950/80"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="bg-visor-reticle flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-950">
                    <OperatorTopDownSVG
                      color={player.color}
                      size={56}
                      withWeapon={false}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-base font-bold uppercase tracking-wide text-white">
                        {player.name}
                      </span>
                      {isMe && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          YOU
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider text-slate-300">
                      <AbilityVectorIcon
                        ability={player.ability}
                        className="h-3.5 w-3.5 text-amber-400"
                      />
                      <span>{abMeta.code}</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-display text-xs font-bold uppercase tracking-widest ${
                      player.ready
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                        : "border-slate-700 bg-slate-800/90 text-slate-400"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        player.ready ? "bg-emerald-400" : "bg-slate-500"
                      }`}
                    />
                    {player.ready ? "READY" : "WAITING"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Barra Compacta de Ajuste Rápido de Loadout del Operador Local */}
        {localPlayer && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/75 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="font-display text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                COLOR:
              </span>
              <div className="flex items-center gap-1.5">
                {TACTICAL_COLORS.map((c) => {
                  const active =
                    localPlayer.color.toUpperCase() === c.hex.toUpperCase();
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => onUpdateColor(c.hex)}
                      title={c.name}
                      className={`h-6 w-6 rounded border transition ${
                        active
                          ? "scale-110 border-amber-400 ring-1 ring-amber-400/60"
                          : "border-slate-700 opacity-75 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="mr-1 font-display text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                MODULE:
              </span>
              {ABILITY_ORDER.map((abId) => {
                const meta = ABILITY_META[abId];
                const active = localPlayer.ability === abId;
                return (
                  <button
                    key={abId}
                    type="button"
                    onClick={() => onUpdateAbility(abId)}
                    title={`${meta.code} (${meta.cooldownLabel})`}
                    className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider transition ${
                      active
                        ? "border-amber-500 bg-amber-500/15 text-amber-400"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <AbilityVectorIcon ability={abId} className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{meta.code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Barra Inferior: LEAVE a la izquierda + READY UP grande en ámbar a la derecha */}
        <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onLeaveRoom}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-5 py-3.5 font-display text-sm font-bold uppercase tracking-wider text-slate-200 transition hover:border-rose-500/50 hover:bg-rose-950/60 hover:text-rose-200"
          >
            <LogOut className="h-4 w-4" />
            LEAVE
          </button>

          <div className="flex flex-1 items-center justify-end gap-3">
            {canStart && (
              <button
                type="button"
                onClick={onStartGame}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-3.5 font-display text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:border-amber-500 hover:text-amber-400"
                title="Forzar inicio inmediato con los jugadores presentes"
              >
                <Play className="h-3.5 w-3.5" />
                FORCE DEPLOY
              </button>
            )}

            <button
              type="button"
              onClick={onToggleReady}
              className={`min-w-[210px] flex-1 rounded-lg border-b-4 px-6 py-3.5 font-display text-base font-bold uppercase tracking-wider text-slate-950 transition-all active:translate-y-0.5 active:border-b-0 sm:flex-initial ${
                localPlayer?.ready
                  ? "border-emerald-700 bg-emerald-500 hover:bg-emerald-400"
                  : "border-amber-700 bg-amber-500 hover:bg-amber-400"
              }`}
            >
              {localPlayer?.ready ? "✓ READY — WAITING" : "READY UP"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
