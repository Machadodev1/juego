import React, { useEffect, useMemo, useState } from "react";
import {
  Crown,
  Flame,
  Heart,
  LogOut,
  RefreshCw,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  Wand2,
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
  ABILITY_ORDER,
  EMOTE_LIST,
  MAX_SCORE_TO_WIN,
  MODIFIER_META,
  WEAPON_META,
} from "../constants";
import { soundManager } from "../audio/SoundManager";
import { LOOT_PICKUP_RADIUS } from "../game/ArenaRenderer";

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
  roomCode,
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
  onSelectLocalAbility,
}) => {
  const [muted, setMuted] = useState(() => soundManager.isMuted());
  const [showMutatorBanner, setShowMutatorBanner] = useState(true);

  useEffect(() => {
    if (status === "playing") {
      setShowMutatorBanner(true);
      const timer = window.setTimeout(() => {
        setShowMutatorBanner(false);
      }, 3300);
      return () => window.clearTimeout(timer);
    }
  }, [modifier, status]);

  const playerList = Object.values(players);
  const localPlayer = players[sessionId];
  const modInfo = MODIFIER_META[modifier] || MODIFIER_META.normal;

  const activeWeapon: WeaponType = localPlayer?.weapon || "pistol";
  const weaponInfo = WEAPON_META[activeWeapon] || WEAPON_META.pistol;

  const activeAbility: AbilityType = localPlayer?.ability || "dash";
  const abilityInfo = ABILITY_META[activeAbility] || ABILITY_META.dash;
  const maxCdMs = abilityInfo.cooldownSec * 1000;
  const remCdMs = Math.max(0, localPlayer?.abilityCooldownMs ?? 0);
  const cdProgress = maxCdMs > 0 ? Math.min(1, remCdMs / maxCdMs) : 0;

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

  const shield = Math.max(0, Math.round(localPlayer?.shield ?? 0));
  const maxShield = localPlayer?.maxShield ?? 50;
  const shieldPercent = Math.max(0, Math.min(100, (shield / maxShield) * 100));

  const circleCircumference = 2 * Math.PI * 24;

  return (
    <>
      {/* Barra Superior */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-2 px-4 py-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2 shadow-lg backdrop-blur-md">
            {mode === "local" ? (
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Prueba Local
              </span>
            ) : (
              <span className="font-mono text-xs font-black tracking-widest text-amber-300">
                SALA {roomCode}
              </span>
            )}
          </div>

          <div
            title={modInfo.desc}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold shadow-lg backdrop-blur-md ${modInfo.pillClass}`}
          >
            <span>{modInfo.emoji}</span>
            <span>{modInfo.label}</span>
          </div>

          {/* Herramientas rápidas de laboratorio en Modo Local */}
          {mode === "local" && (
            <div className="flex flex-wrap items-center gap-1.5">
              {onCycleLocalWeapon && (
                <button
                  type="button"
                  onClick={onCycleLocalWeapon}
                  className="flex items-center gap-1 rounded-xl border border-amber-500/40 bg-slate-950/90 px-2.5 py-2 text-[11px] font-bold text-amber-300 shadow-lg hover:bg-slate-900"
                >
                  <Swords className="h-3.5 w-3.5" />
                  Siguiente Arma
                </button>
              )}
              {onCycleLocalModifier && (
                <button
                  type="button"
                  onClick={onCycleLocalModifier}
                  className="flex items-center gap-1 rounded-xl border border-purple-500/40 bg-slate-950/90 px-2.5 py-2 text-[11px] font-bold text-purple-300 shadow-lg hover:bg-slate-900"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Cambiar Mutador
                </button>
              )}
              {onSelectLocalAbility && (
                <div className="hidden items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/90 p-1 lg:flex">
                  {ABILITY_ORDER.map((ab) => (
                    <button
                      key={ab}
                      type="button"
                      onClick={() => onSelectLocalAbility(ab)}
                      title={ABILITY_META[ab].label}
                      className={`rounded-lg px-2 py-1 text-xs transition ${
                        activeAbility === ab
                          ? "bg-amber-400/20 ring-1 ring-amber-400"
                          : "opacity-65 hover:opacity-100"
                      }`}
                    >
                      {ABILITY_META[ab].emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Marcador de Jugadores */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
          {playerList.map((p) => {
            const isMe = p.id === sessionId;
            const scoreVal = getDisplayScore(p);
            return (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 shadow-lg backdrop-blur-md transition ${
                  isMe
                    ? "border-amber-400/60 bg-slate-900/95"
                    : "border-slate-800 bg-slate-900/85"
                } ${!p.alive ? "opacity-50" : ""}`}
              >
                <span
                  className="h-3 w-3 rounded-full border border-slate-950"
                  style={{
                    backgroundColor: p.color,
                    boxShadow: p.alive ? `0 0 8px ${p.color}` : undefined,
                  }}
                />
                <span className="max-w-[84px] truncate text-xs font-bold text-slate-100">
                  {p.name}
                </span>
                {p.hasBounty && (
                  <Crown className="h-3.5 w-3.5 text-amber-400" />
                )}
                {!p.alive ? (
                  <Skull className="h-3.5 w-3.5 text-rose-400" />
                ) : p.isDowned ? (
                  <span className="text-[10px] font-black text-rose-400">
                    CAÍDO
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-400">
                    {Math.round(p.hp)}
                    {p.shield > 0 ? `+${Math.round(p.shield)}` : ""}
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

        {/* Controles Superiores Derechos */}
        <div className="pointer-events-auto flex items-center gap-2">
          {mode === "local" && onResetLocalArena && (
            <button
              type="button"
              onClick={onResetLocalArena}
              title="Regenerar escenario"
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 shadow-lg backdrop-blur-md transition hover:bg-emerald-500/25"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Regenerar</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleMute}
            title={muted ? "Activar sonido" : "Silenciar sonido"}
            className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950/90 p-2 text-slate-200 shadow-lg backdrop-blur-md transition hover:border-amber-400/50 hover:text-amber-300"
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
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-xs font-bold text-slate-200 shadow-lg backdrop-blur-md transition hover:border-rose-500/50 hover:text-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Anuncio Gigante del Mutador de Ronda al empezar */}
      {showMutatorBanner && status === "playing" && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-20 flex justify-center px-4">
          <div
            className={`w-full max-w-lg rounded-2xl border border-white/20 bg-gradient-to-r px-6 py-3.5 text-center shadow-2xl backdrop-blur-xl ${modInfo.bannerGradient}`}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">
              Mutador de Ronda
            </p>
            <h2 className="mt-0.5 text-2xl font-black text-white sm:text-3xl">
              {modInfo.emoji} {modInfo.label}
            </h2>
            <p className="mt-0.5 text-xs font-medium text-slate-200">
              {modInfo.desc}
            </p>
          </div>
        </div>
      )}

      {/* Killfeed en la esquina superior derecha (debajo del minimapa) */}
      {killFeed.length > 0 && (
        <aside className="pointer-events-none fixed right-4 top-[192px] z-20 flex w-68 flex-col items-end gap-1.5">
          {killFeed.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/88 px-3 py-1.5 text-[11px] font-bold text-slate-200 shadow-lg backdrop-blur-md"
            >
              <span className="max-w-[85px] truncate text-amber-300">
                {entry.killerName}
              </span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] uppercase text-cyan-300">
                {entry.weapon}
              </span>
              <span className="max-w-[85px] truncate text-rose-300">
                {entry.victimName}
              </span>
            </div>
          ))}
        </aside>
      )}

      {/* Alertas Centrales de Estado Crítico (Último Aliento / Papa Caliente) */}
      {localPlayer?.alive && localPlayer.isDowned && (
        <div className="pointer-events-none fixed inset-x-0 bottom-36 z-20 flex justify-center px-4">
          <div className="animate-pulse rounded-2xl border border-rose-500/70 bg-rose-950/90 px-5 py-2.5 text-center shadow-2xl backdrop-blur-md">
            <p className="text-sm font-black uppercase tracking-wider text-rose-200">
              ¡ÚLTIMO ALIENTO! ({(localPlayer.downedTimerMs / 1000).toFixed(1)}s)
            </p>
            <p className="text-xs font-semibold text-rose-300">
              ¡Acierta un disparo a un rival para revivir con 30 HP!
            </p>
          </div>
        </div>
      )}

      {localPlayer?.alive && localPlayer.hasHotPotato && (
        <div className="pointer-events-none fixed inset-x-0 bottom-36 z-20 flex justify-center px-4">
          <div className="animate-bounce rounded-2xl border border-amber-400 bg-orange-950/92 px-5 py-2 text-center shadow-2xl">
            <p className="flex items-center justify-center gap-1.5 text-sm font-black text-amber-300">
              <Flame className="h-4 w-4 text-orange-400" />
              ¡TIENES LA PAPA CALIENTE! (
              {(localPlayer.hotPotatoTimerMs / 1000).toFixed(1)}s) — ¡Dispara a otro!
            </p>
          </div>
        </div>
      )}

      {/* Barra Inferior: Vida + Escudo | Habilidad Circular + Emotes + Aviso [E] | Arma */}
      {localPlayer && (
        <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-end justify-between gap-3 px-4 py-3.5">
          {/* Barras de Escudo (50) y Salud (100) */}
          <div className="w-52 shrink-0 space-y-2 rounded-2xl border border-slate-800 bg-slate-950/92 p-3 shadow-xl backdrop-blur-md sm:w-64">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1 text-sky-400">
                  <Shield className="h-3.5 w-3.5 fill-sky-400/30" />
                  ESCUDO
                </span>
                <span className="font-mono text-sky-200">
                  {shield} / {maxShield}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-md border border-slate-800 bg-slate-900">
                <div
                  className="h-full bg-sky-400 transition-all duration-150"
                  style={{ width: `${shieldPercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Heart className="h-3.5 w-3.5 fill-emerald-400" />
                  VIDA
                </span>
                <span className="font-mono text-white">
                  {hp} / {maxHp}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-md border border-slate-800 bg-slate-900">
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
          </div>

          {/* Centro: Aviso [E] + Habilidad Circular + Emotes Rápidos (1-4) */}
          <div className="pointer-events-auto flex flex-col items-center gap-2">
            {nearbyLoot && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-400/60 bg-slate-950/95 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-md">
                <kbd className="rounded bg-amber-400 px-2 py-0.5 font-mono text-xs font-black text-slate-950">
                  E
                </kbd>
                {nearbyLoot.kind === "medkit" ? (
                  <span>Recoger Botiquín (+35 HP)</span>
                ) : nearbyLoot.kind === "shield" ? (
                  <span>
                    Recoger Escudo (+{nearbyLoot.amount ?? 25} Shield)
                  </span>
                ) : (
                  <span>
                    Equipar{" "}
                    <span
                      style={{
                        color:
                          WEAPON_META[nearbyLoot.weaponType || "rifle"]
                            .badgeHex,
                      }}
                    >
                      {WEAPON_META[nearbyLoot.weaponType || "rifle"].label}
                    </span>
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/92 px-3.5 py-2 shadow-xl backdrop-blur-md">
              {/* Icono Circular de Habilidad con Recarga Radial */}
              <button
                type="button"
                onClick={onTriggerAbility}
                disabled={remCdMs > 0 || !localPlayer.alive || localPlayer.isDowned}
                title={`${abilityInfo.label}: ${abilityInfo.desc} (Espacio o Click Derecho)`}
                className="relative flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 transition hover:scale-105 disabled:cursor-default"
              >
                <svg className="absolute inset-0 h-14 w-14 -rotate-90">
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    stroke="#1e293b"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    stroke={remCdMs > 0 ? "#64748b" : abilityInfo.accentHex}
                    strokeWidth="4"
                    strokeDasharray={circleCircumference}
                    strokeDashoffset={circleCircumference * cdProgress}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
                <span className="text-xl">{abilityInfo.emoji}</span>
                {remCdMs > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/75 font-mono text-xs font-black text-amber-300">
                    {(remCdMs / 1000).toFixed(1)}
                  </span>
                )}
              </button>

              <div className="hidden pr-1 sm:block">
                <div className="text-xs font-black text-white">
                  {abilityInfo.label}
                </div>
                <div className="text-[10px] font-semibold text-slate-400">
                  Espacio / Click Der.
                </div>
              </div>

              <div className="h-9 w-px bg-slate-800" />

              {/* Emotes Rápidos 1-4 */}
              <div className="flex items-center gap-1.5">
                {EMOTE_LIST.map((em) => (
                  <button
                    key={em.id}
                    type="button"
                    onClick={() => onTriggerEmote(em.id)}
                    title={`Emote ${em.label} (Tecla ${em.key})`}
                    className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-base font-black text-white transition hover:-translate-y-0.5 hover:border-amber-400"
                  >
                    <span className="absolute left-1 top-0.5 font-mono text-[9px] font-bold text-slate-400">
                      {em.key}
                    </span>
                    <span>{em.icon}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tarjeta de Arma Equipada */}
          <div
            className={`hidden w-60 shrink-0 items-center justify-end gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md md:flex ${
              weaponInfo.isSpecial
                ? "border-amber-400/60 bg-slate-950/95"
                : "border-slate-800 bg-slate-950/92"
            }`}
          >
            <div className="text-right">
              <div className="flex items-center justify-end gap-1">
                {weaponInfo.isSpecial && (
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                )}
                <span
                  className="text-xs font-black uppercase tracking-wider"
                  style={{ color: weaponInfo.badgeHex }}
                >
                  {weaponInfo.label}
                </span>
              </div>
              <div className="text-[11px] font-medium text-slate-400">
                {localPlayer.isDowned
                  ? "8 DMG · Pistola de Último Aliento"
                  : weaponInfo.shortStats}
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Banner de Fin de Ronda */}
      {mode === "online" && status === "round_end" && !champion && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-20 flex justify-center px-4">
          <div className="rounded-2xl border border-amber-400/40 bg-slate-900/95 px-6 py-3.5 text-center shadow-2xl backdrop-blur-xl">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
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
                "¡Caos total sin sobrevivientes!"
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Preparando nueva arena y próximo mutador loco...
            </p>
          </div>
        </div>
      )}

      {/* Modal de Campeón */}
      {mode === "online" && status === "round_end" && champion && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/40 bg-slate-900 p-7 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/15">
              <Trophy className="h-7 w-7 text-amber-400" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
              ¡Rey del Caos!
            </p>
            <h2
              className="mt-1 text-3xl font-black"
              style={{ color: champion.color }}
            >
              {champion.name}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Alcanzó los {MAX_SCORE_TO_WIN} puntos · Reiniciando partida...
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
