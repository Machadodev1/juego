import React, { useEffect, useMemo, useState } from "react";
import {
  LogOut,
  RefreshCw,
  Trophy,
  UserCheck,
  Volume2,
  VolumeX,
} from "lucide-react";
import type {
  AbilityType,
  EmoteType,
  KillFeedEvent,
  LootItemState,
  PlayerState,
  RoomStatus,
  RoundEndEvent,
  RoundModifier,
  WeaponType,
} from "@shared/types";
import {
  ABILITY_META,
  EMOTE_LIST,
  MAX_SCORE_TO_WIN,
  MODIFIER_META,
  WEAPON_META,
} from "../constants";
import { soundManager } from "../audio/SoundManager";
import { LOOT_PICKUP_RADIUS } from "../game/ArenaRenderer";
import { AbilityVectorIcon, WeaponSilhouetteSVG } from "./TacticalIcons";

export interface KillFeedEntry extends KillFeedEvent {
  id: string;
}

interface GameHUDProps {
  mode: "online" | "local";
  roomCode?: string;
  status: RoomStatus;
  modifier: RoundModifier;
  sessionId: string;
  players: Record<string, PlayerState>;
  lootItems?: Record<string, LootItemState>;
  killFeed: KillFeedEntry[];
  lastRoundEnd: RoundEndEvent | null;
  onLeave: () => void;
  onTriggerEmote: (emote: EmoteType) => void;
  onTriggerAbility: () => void;
  onResetLocalArena?: () => void;
  onCycleLocalWeapon?: () => void;
  onCycleLocalModifier?: () => void;
  onSelectLocalAbility?: (ability: AbilityType) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  mode,
  status,
  modifier,
  sessionId,
  players,
  lootItems = {},
  killFeed,
  lastRoundEnd,
  onLeave,
  onTriggerEmote,
  onTriggerAbility,
  onResetLocalArena,
  onCycleLocalWeapon,
  onCycleLocalModifier,
}) => {
  const [muted, setMuted] = useState(() => soundManager.isMuted());
  const [showRoundAnnouncement, setShowRoundAnnouncement] = useState(true);
  const [deployCountdown, setDeployCountdown] = useState(3.6);

  // Anuncio táctico limpio durante los primeros 3 segundos de cada ronda
  useEffect(() => {
    if (status === "playing") {
      setShowRoundAnnouncement(true);
      const timer = window.setTimeout(() => {
        setShowRoundAnnouncement(false);
      }, 3000);
      return () => window.clearTimeout(timer);
    }
    setShowRoundAnnouncement(false);
  }, [modifier, status]);

  // Cuenta regresiva en el overlay de fin de ronda (3.6s en servidor)
  useEffect(() => {
    if (mode !== "online" || status !== "round_end") {
      setDeployCountdown(3.6);
      return;
    }
    setDeployCountdown(3.6);
    const interval = window.setInterval(() => {
      setDeployCountdown((prev) => Math.max(0, +(prev - 0.1).toFixed(1)));
    }, 100);
    return () => window.clearInterval(interval);
  }, [mode, status, lastRoundEnd]);

  const playerList = Object.values(players);
  const totalCount = Math.max(1, playerList.length);
  const aliveCount = playerList.filter((p) => p.alive).length;
  const localPlayer = players[sessionId];

  const getDisplayScore = (p: PlayerState): number => {
    if (status === "round_end" && lastRoundEnd?.scores[p.id] !== undefined) {
      return lastRoundEnd.scores[p.id];
    }
    return p.score;
  };

  const localWins = localPlayer ? getDisplayScore(localPlayer) : 0;
  const modInfo = MODIFIER_META[modifier] || MODIFIER_META.normal;

  const activeWeapon: WeaponType = localPlayer?.weapon || "pistol";
  const weaponInfo = WEAPON_META[activeWeapon] || WEAPON_META.pistol;

  const activeAbility: AbilityType = localPlayer?.ability || "dash";
  const abilityInfo = ABILITY_META[activeAbility] || ABILITY_META.dash;
  const maxCdMs = abilityInfo.cooldownSec * 1000;
  const remCdMs = Math.max(0, localPlayer?.abilityCooldownMs ?? 0);
  const cdRatio = maxCdMs > 0 ? Math.min(1, remCdMs / maxCdMs) : 0;

  const handleToggleMute = () => {
    const next = soundManager.toggleMute();
    setMuted(next);
  };

  const nearbyLoot = useMemo(() => {
    if (!localPlayer || !localPlayer.alive || localPlayer.isDowned) return null;
    let closest: LootItemState | null = null;
    let bestSq = LOOT_PICKUP_RADIUS * LOOT_PICKUP_RADIUS;
    for (const item of Object.values(lootItems)) {
      const dSq =
        (localPlayer.x - item.x) ** 2 + (localPlayer.y - item.y) ** 2;
      if (dSq <= bestSq) {
        bestSq = dSq;
        closest = item;
      }
    }
    return closest;
  }, [localPlayer, lootItems]);

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
  const hpBarHex = hp < 25 ? "#EF4444" : hp < 50 ? "#F59E0B" : "#10B981";

  const shield = Math.max(0, Math.round(localPlayer?.shield ?? 0));
  const maxShield = localPlayer?.maxShield ?? 50;

  const downedPercent = localPlayer?.isDowned
    ? Math.max(0, Math.min(100, (localPlayer.downedTimerMs / 4000) * 100))
    : 0;

  const recentKills = killFeed.slice(0, 3);

  return (
    <>
      {/* 1. ESQUINA SUPERIOR IZQUIERDA: Contador Compacto (ALIVE + WINS) */}
      <div className="pointer-events-none fixed left-4 top-3 z-20 flex flex-col items-start gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/95 px-3 py-1.5 shadow-lg backdrop-blur-md">
            <UserCheck className="h-4 w-4 text-emerald-400" />
            <span className="font-display text-xs font-bold uppercase tracking-wider text-slate-300">
              ALIVE:{" "}
              <span className="text-white">
                {aliveCount} / {totalCount}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/95 px-3 py-1.5 shadow-lg backdrop-blur-md">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-slate-300">
              WINS:{" "}
              <span className="text-amber-400">
                {localWins}
                {mode === "online" ? ` / ${MAX_SCORE_TO_WIN}` : ""}
              </span>
            </span>
          </div>
        </div>

        {/* Controles discretos de laboratorio únicamente en modo práctica local */}
        {mode === "local" && (
          <div className="pointer-events-auto flex items-center gap-1.5">
            {onCycleLocalWeapon && (
              <button
                type="button"
                onClick={onCycleLocalWeapon}
                className="rounded border border-slate-700 bg-slate-900/90 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-slate-300 transition hover:border-amber-500 hover:text-amber-400"
              >
                CYCLE WEAPON
              </button>
            )}
            {onCycleLocalModifier && (
              <button
                type="button"
                onClick={onCycleLocalModifier}
                className="rounded border border-slate-700 bg-slate-900/90 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-slate-300 transition hover:border-amber-500 hover:text-amber-400"
              >
                NEXT MUTATOR
              </button>
            )}
            {onResetLocalArena && (
              <button
                type="button"
                onClick={onResetLocalArena}
                title="Reset Arena"
                className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900/90 px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-slate-300 transition hover:border-amber-500 hover:text-amber-400"
              >
                <RefreshCw className="h-3 w-3" />
                RESET
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. CENTRO SUPERIOR: Badge Compacto del Modificador + Anuncio Táctico 3s */}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-20 flex flex-col items-center px-4">
        <div
          title={modInfo.desc}
          className={`inline-flex items-center gap-2 rounded-lg border bg-slate-900/95 px-3.5 py-1.5 font-display text-xs font-bold uppercase tracking-widest shadow-lg backdrop-blur-md ${modInfo.accentClass}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          <span>ROUND: {modInfo.code}</span>
        </div>

        {showRoundAnnouncement && status === "playing" && (
          <div className="mt-2.5 w-full max-w-md rounded-lg border border-amber-500/50 bg-slate-900/95 px-5 py-3 text-center shadow-2xl backdrop-blur-md">
            <div className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400">
              // TACTICAL DIRECTIVE ACTIVE
            </div>
            <div className="mt-0.5 font-display text-xl font-bold uppercase tracking-wider text-white">
              {modInfo.code}
            </div>
            <p className="mt-0.5 text-xs text-slate-300">{modInfo.desc}</p>
          </div>
        )}
      </div>

      {/* 3. ESQUINA SUPERIOR DERECHA: Botones Audio/Salir + Killfeed Minimalista (máx 3) */}
      <div className="pointer-events-none fixed right-4 top-3 z-20 flex flex-col items-end">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleMute}
            title={muted ? "Unmute Audio" : "Mute Audio"}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/95 text-slate-300 shadow-lg backdrop-blur-md transition hover:border-amber-500/60 hover:text-amber-400"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-red-400" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onLeave}
            title="Leave Match"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/95 px-2.5 font-display text-xs font-bold uppercase tracking-wider text-slate-300 shadow-lg backdrop-blur-md transition hover:border-red-500/60 hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">EXIT</span>
          </button>
        </div>

        {/* Killfeed minimalista debajo del minimapa táctico (máx 3 líneas) */}
        {recentKills.length > 0 && (
          <div className="mt-[146px] flex flex-col items-end gap-1">
            {recentKills.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-1.5 rounded border border-slate-800/90 bg-slate-900/92 px-2.5 py-1 text-[11px] shadow-md backdrop-blur-sm"
              >
                <span className="max-w-[82px] truncate font-medium text-slate-200">
                  {entry.killerName}
                </span>
                <span className="font-display text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  [{entry.weapon.toUpperCase()}]
                </span>
                <span className="max-w-[82px] truncate font-medium text-red-400">
                  {entry.victimName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. CENTRO INFERIOR: Combat Dock Unificado */}
      {localPlayer && (
        <div className="pointer-events-none fixed inset-x-0 bottom-3.5 z-20 flex flex-col items-center gap-2 px-3">
          {/* Alertas contextuales compactas encima del Dock */}
          {localPlayer.alive && localPlayer.hasHotPotato && (
            <div className="rounded-lg border border-red-500/80 bg-red-950/90 px-4 py-1.5 font-display text-xs font-bold uppercase tracking-widest text-amber-300 shadow-lg backdrop-blur-md">
              HOT POTATO ARMED //{" "}
              {(localPlayer.hotPotatoTimerMs / 1000).toFixed(1)}S — SHOOT RIVAL
              TO TRANSFER
            </div>
          )}

          {nearbyLoot && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/60 bg-slate-900/95 px-3 py-1 text-xs font-medium text-slate-200 shadow-lg backdrop-blur-md">
              <kbd className="rounded bg-amber-500 px-1.5 py-0.5 font-display text-[11px] font-bold text-slate-950">
                E
              </kbd>
              {nearbyLoot.kind === "medkit" ? (
                <span className="font-display uppercase tracking-wider">
                  MEDKIT (+35 HP)
                </span>
              ) : nearbyLoot.kind === "shield" ? (
                <span className="font-display uppercase tracking-wider text-sky-400">
                  SHIELD CELL (+{nearbyLoot.amount ?? 25})
                </span>
              ) : (
                <span className="font-display uppercase tracking-wider">
                  EQUIP{" "}
                  <span className="text-amber-400">
                    {WEAPON_META[nearbyLoot.weaponType || "rifle"].code}
                  </span>
                </span>
              )}
            </div>
          )}

          {/* DOCK TÁCTICO UNIFICADO */}
          <div className="pointer-events-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700/80 bg-slate-900/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-md sm:flex-nowrap">
            {/* IZQUIERDA: Tarjeta Compacta del Arma Equipada */}
            <div
              className={`flex w-36 shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2 ${
                weaponInfo.isSpecial
                  ? "border-amber-500/60 bg-slate-950"
                  : "border-slate-800 bg-slate-950/90"
              }`}
            >
              <div
                className={
                  weaponInfo.isSpecial ? "text-amber-400" : "text-slate-200"
                }
              >
                <WeaponSilhouetteSVG
                  weapon={localPlayer.isDowned ? "pistol" : activeWeapon}
                  className="h-6 w-12"
                />
              </div>
              <div className="min-w-0">
                <div className="truncate font-display text-xs font-bold uppercase tracking-wider text-white">
                  {localPlayer.isDowned ? "SIDEARM" : weaponInfo.code}
                </div>
                <div className="truncate font-display text-[9px] uppercase tracking-widest text-slate-400">
                  {localPlayer.isDowned ? "8 DMG" : weaponInfo.shortStats}
                </div>
              </div>
            </div>

            {/* CENTRO: Escudo Segmentado (50) encima de Vida (100 HP) o LAST STAND */}
            <div className="min-w-[180px] flex-1 space-y-2">
              {localPlayer.isDowned ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-display text-xs font-bold uppercase tracking-widest text-red-400">
                    <span className="animate-pulse">
                      LAST STAND // HIT TO REVIVE
                    </span>
                    <span>
                      {(localPlayer.downedTimerMs / 1000).toFixed(1)}S
                    </span>
                  </div>
                  <div className="h-4 w-full overflow-hidden rounded border border-red-500/60 bg-red-950/80 p-0.5">
                    <div
                      className="h-full animate-pulse rounded-sm bg-red-500 transition-all duration-100"
                      style={{ width: `${downedPercent}%` }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {/* Barra Segmentada de Escudo (5 segmentos de 10 = 50) */}
                  <div>
                    <div className="mb-0.5 flex items-center justify-between font-display text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-sky-400">SHIELD</span>
                      <span className="text-sky-300">
                        {shield} / {maxShield}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {Array.from({ length: 5 }).map((_, idx) => {
                        const segMin = idx * 10;
                        const segFill = Math.max(
                          0,
                          Math.min(100, ((shield - segMin) / 10) * 100)
                        );
                        return (
                          <div
                            key={idx}
                            className="h-2 overflow-hidden rounded-sm border border-slate-800 bg-slate-950"
                          >
                            <div
                              className="h-full bg-sky-500 transition-all duration-150"
                              style={{ width: `${segFill}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Barra de Vida (Esmeralda -> Ámbar < 50 -> Rojo < 25) */}
                  <div>
                    <div className="mb-0.5 flex items-center justify-between font-display text-[11px] font-bold uppercase tracking-wider">
                      <span className="text-slate-300">INTEGRITY</span>
                      <span className="text-white">
                        {hp} / {maxHp} HP
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded border border-slate-800 bg-slate-950">
                      <div
                        className="h-full transition-all duration-150"
                        style={{
                          width: `${hpPercent}%`,
                          backgroundColor: hpBarHex,
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* DERECHA: Módulo Cuadrado de Habilidad (SPACE) + 4 Teclas de Emotes */}
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onTriggerAbility}
                disabled={
                  remCdMs > 0 || !localPlayer.alive || localPlayer.isDowned
                }
                title={`${abilityInfo.code} (${abilityInfo.cooldownLabel}) — SPACE / RMB`}
                className={`relative flex h-12 w-12 flex-col items-center justify-center overflow-hidden rounded-lg border transition ${
                  remCdMs > 0
                    ? "border-slate-700 bg-slate-950 text-slate-500"
                    : "border-amber-500/70 bg-slate-950 text-amber-400 hover:bg-slate-800"
                }`}
              >
                {remCdMs > 0 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 bg-amber-500/15 transition-all duration-100"
                    style={{ height: `${(1 - cdRatio) * 100}%` }}
                  />
                )}
                {remCdMs > 0 ? (
                  <span className="relative z-10 font-display text-xs font-bold text-amber-400">
                    {(remCdMs / 1000).toFixed(1)}s
                  </span>
                ) : (
                  <AbilityVectorIcon
                    ability={activeAbility}
                    className="relative z-10 h-5 w-5"
                  />
                )}
                <span className="relative z-10 mt-0.5 font-display text-[8px] font-bold uppercase tracking-widest text-slate-400">
                  SPACE
                </span>
              </button>

              <div className="grid grid-cols-4 gap-1">
                {EMOTE_LIST.map((em) => (
                  <button
                    key={em.id}
                    type="button"
                    onClick={() => onTriggerEmote(em.id)}
                    title={`Emote ${em.label} (${em.key})`}
                    className="relative flex h-12 w-9 flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-xs font-bold text-slate-200 transition hover:border-amber-500/60 hover:bg-slate-800"
                  >
                    <span className="font-display text-[8px] font-bold text-slate-500">
                      {em.key}
                    </span>
                    <span className="mt-0.5 text-sm leading-none">
                      {em.icon}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. OVERLAY TÁCTICO DE FIN DE RONDA / PARTIDA */}
      {mode === "online" && status === "round_end" && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-slate-700/90 bg-slate-900/95 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-display text-xs font-semibold uppercase tracking-widest text-slate-400">
                {champion ? "// MATCH COMPLETE" : "// ROUND REPORT"}
              </span>
              <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-display text-xs font-bold uppercase tracking-wider text-amber-400">
                NEXT DEPLOY: {deployCountdown.toFixed(1)}S
              </span>
            </div>

            <div className="mb-5 text-center">
              {champion ? (
                <>
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg border border-amber-500/50 bg-amber-500/15">
                    <Trophy className="h-6 w-6 text-amber-400" />
                  </div>
                  <div className="font-display text-xs font-bold uppercase tracking-widest text-amber-400">
                    ARENA CHAMPION
                  </div>
                  <h2
                    className="mt-0.5 font-display text-3xl font-bold uppercase tracking-wide"
                    style={{ color: champion.color }}
                  >
                    {champion.name}
                  </h2>
                </>
              ) : roundWinner ? (
                <>
                  <div className="font-display text-xs font-bold uppercase tracking-widest text-emerald-400">
                    ROUND WINNER (+1 WIN)
                  </div>
                  <h2
                    className="mt-1 font-display text-2xl font-bold uppercase tracking-wide"
                    style={{ color: roundWinner.color }}
                  >
                    {roundWinner.name}
                  </h2>
                </>
              ) : (
                <>
                  <div className="font-display text-xs font-bold uppercase tracking-widest text-slate-400">
                    STALEMATE
                  </div>
                  <h2 className="mt-1 font-display text-xl font-bold uppercase tracking-wide text-white">
                    NO SURVIVORS
                  </h2>
                </>
              )}
            </div>

            <div className="space-y-2">
              {[...playerList]
                .sort((a, b) => getDisplayScore(b) - getDisplayScore(a))
                .map((p, index) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-display text-xs font-bold text-slate-500">
                        0{index + 1}
                      </span>
                      <span
                        className="h-3 w-3 rounded-sm border border-slate-950"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="font-display text-sm font-bold uppercase tracking-wide text-white">
                        {p.name}
                      </span>
                    </div>
                    <span className="font-display text-sm font-bold text-amber-400">
                      {getDisplayScore(p)} / {MAX_SCORE_TO_WIN}
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
