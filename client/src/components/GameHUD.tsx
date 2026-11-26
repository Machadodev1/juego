import React, { useMemo, useState } from "react";
import {
  Heart,
  LogOut,
  Map as MapIcon,
  RefreshCw,
  Skull,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import type {
  ArenaTheme,
  LootItemState,
  PlayerState,
  RoomStatus,
  RoundEndEvent,
  RoundModifier,
  WeaponType,
} from "@shared/types";
import {
  MAX_INVENTORY_SLOTS,
  MAX_SCORE_TO_WIN,
  MODIFIER_META,
  THEME_META,
  THEME_ORDER,
  WEAPON_META,
} from "../constants";
import { soundManager } from "../audio/SoundManager";
import { LOOT_PICKUP_RADIUS } from "../game/ArenaRenderer";

interface GameHUDProps {
  mode: "online" | "local";
  roomCode?: string;
  status: RoomStatus;
  theme: ArenaTheme;
  modifier: RoundModifier;
  sessionId: string;
  players: Record<string, PlayerState>;
  lootItems?: Record<string, LootItemState>;
  lastRoundEnd: RoundEndEvent | null;
  onLeave: () => void;
  onSelectSlot: (slot: number) => void;
  onResetLocalArena?: () => void;
  onSelectLocalTheme?: (theme: ArenaTheme) => void;
}

const WeaponIcon: React.FC<{ weapon: WeaponType; color: string }> = ({
  weapon,
  color,
}) => {
  switch (weapon) {
    case "smg":
      return (
        <svg viewBox="0 0 44 22" className="h-6 w-11">
          <rect x="6" y="6" width="26" height="6" rx="2" fill={color} />
          <rect x="30" y="7.5" width="8" height="3" rx="1" fill="#f8fafc" />
          <rect x="18" y="11" width="4.5" height="8" rx="1" fill={color} />
          <rect x="10" y="11" width="4" height="6" rx="1" fill="#cbd5e1" />
        </svg>
      );
    case "shotgun":
      return (
        <svg viewBox="0 0 44 22" className="h-6 w-11">
          <rect x="5" y="6" width="33" height="3.5" rx="1.5" fill={color} />
          <rect x="5" y="10.5" width="33" height="3.5" rx="1.5" fill={color} />
          <rect x="5" y="6" width="9" height="9" rx="1.5" fill="#f8fafc" opacity="0.85" />
        </svg>
      );
    case "rifle":
      return (
        <svg viewBox="0 0 44 22" className="h-6 w-11">
          <rect x="4" y="7" width="35" height="5" rx="2" fill={color} />
          <rect x="16" y="4" width="9" height="2.5" rx="1" fill="#f8fafc" />
          <rect x="18" y="12" width="5" height="7" rx="1" fill={color} />
        </svg>
      );
    case "burst":
      return (
        <svg viewBox="0 0 44 22" className="h-6 w-11">
          <rect x="6" y="4.5" width="32" height="3" rx="1.5" fill={color} />
          <rect x="6" y="9" width="32" height="3" rx="1.5" fill={color} />
          <rect x="6" y="13.5" width="32" height="3" rx="1.5" fill={color} />
        </svg>
      );
    case "plasma":
      return (
        <svg viewBox="0 0 44 22" className="h-6 w-11">
          <circle cx="16" cy="11" r="6.5" fill={color} />
          <circle cx="16" cy="11" r="3" fill="#ffffff" />
          <rect x="21" y="8" width="16" height="6" rx="2.5" fill={color} />
        </svg>
      );
    case "sniper":
      return (
        <svg viewBox="0 0 44 22" className="h-6 w-11">
          <rect x="3" y="9" width="38" height="4" rx="1.5" fill={color} />
          <circle cx="20" cy="5.5" r="3" stroke="#f8fafc" strokeWidth="1.8" fill="none" />
          <rect x="12" y="13" width="4.5" height="6" rx="1" fill={color} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 44 22" className="h-6 w-11">
          <rect x="11" y="6.5" width="21" height="5.5" rx="2" fill={color} />
          <rect x="13" y="11.5" width="5" height="7" rx="1.2" fill={color} />
          <rect x="29" y="8" width="4" height="2.5" rx="0.8" fill="#f8fafc" />
        </svg>
      );
  }
};

export const GameHUD: React.FC<GameHUDProps> = ({
  mode,
  roomCode,
  status,
  theme,
  modifier,
  sessionId,
  players,
  lootItems = {},
  lastRoundEnd,
  onLeave,
  onSelectSlot,
  onResetLocalArena,
  onSelectLocalTheme,
}) => {
  const [muted, setMuted] = useState(() => soundManager.isMuted());
  const playerList = Object.values(players);
  const localPlayer = players[sessionId];
  const modInfo = MODIFIER_META[modifier] || MODIFIER_META.normal;
  const themeInfo = THEME_META[theme] || THEME_META.cyber_outpost;
  const activeWeapon: WeaponType = localPlayer?.weapon || "pistol";
  const weaponInfo = WEAPON_META[activeWeapon] || WEAPON_META.pistol;
  const inventory: WeaponType[] = localPlayer?.inventory?.length
    ? localPlayer.inventory
    : ["pistol"];

  const handleToggleMute = () => {
    const next = soundManager.toggleMute();
    setMuted(next);
  };

  const handleSlotClick = (slot: number) => {
    soundManager.playSwitchWeapon();
    onSelectSlot(slot);
  };

  // Detectar si hay un objeto de botín cercano para mostrar aviso interactivo [E] en el HUD
  const nearbyLoot = useMemo(() => {
    if (!localPlayer || !localPlayer.alive) return null;
    let closest: LootItemState | null = null;
    let bestDistSq = LOOT_PICKUP_RADIUS * LOOT_PICKUP_RADIUS;
    for (const item of Object.values(lootItems)) {
      const dSq =
        (localPlayer.x - item.x) ** 2 + (localPlayer.y - item.y) ** 2;
      if (dSq <= bestDistSq) {
        bestDistSq = dSq;
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

  return (
    <>
      {/* Barra superior */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-2.5 px-4 py-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2 shadow-lg backdrop-blur-md">
            {mode === "local" ? (
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Práctica
              </span>
            ) : (
              <span className="font-mono text-xs font-bold tracking-widest text-cyan-300">
                SALA {roomCode}
              </span>
            )}
          </div>

          {mode === "local" && onSelectLocalTheme ? (
            <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/90 p-1 shadow-lg backdrop-blur-md">
              {THEME_ORDER.map((t) => {
                const tMeta = THEME_META[t];
                const isCur = theme === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onSelectLocalTheme(t)}
                    title={`Cambiar a ${tMeta.label}`}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                      isCur
                        ? "bg-slate-800 text-white ring-1 ring-white/40"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                    }`}
                  >
                    <span>{tMeta.emoji}</span>
                    <span className="hidden lg:inline">
                      {tMeta.label.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              title={themeInfo.desc}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-xs font-bold text-slate-100 shadow-lg backdrop-blur-md"
            >
              <MapIcon className="h-3.5 w-3.5 text-sky-300" />
              <span>
                {themeInfo.emoji} {themeInfo.label}
              </span>
            </div>
          )}

          <div
            title={modInfo.desc}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold shadow-lg backdrop-blur-md ${modInfo.pillClass}`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{modInfo.label}</span>
          </div>
        </div>

        {/* Marcador central */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
          {playerList.map((p) => {
            const isMe = p.id === sessionId;
            const scoreVal = getDisplayScore(p);
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 shadow-lg backdrop-blur-md transition ${
                  isMe
                    ? "border-cyan-400/50 bg-slate-900/95"
                    : "border-slate-800 bg-slate-900/85"
                } ${!p.alive ? "opacity-55" : ""}`}
              >
                <span
                  className="h-3 w-3 rounded-full border border-slate-950"
                  style={{
                    backgroundColor: p.color,
                    boxShadow: p.alive ? `0 0 8px ${p.color}` : undefined,
                  }}
                />
                <span className="max-w-[90px] truncate text-xs font-bold text-slate-100">
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

        {/* Controles superiores derechos */}
        <div className="pointer-events-auto flex items-center gap-2">
          {mode === "local" && onResetLocalArena && (
            <button
              type="button"
              onClick={onResetLocalArena}
              title="Regenerar obstáculos y modificador"
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 shadow-lg backdrop-blur-md transition hover:bg-amber-500/25"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Regenerar</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleMute}
            title={muted ? "Activar sonido" : "Silenciar sonido"}
            className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950/90 p-2 text-slate-200 shadow-lg backdrop-blur-md transition hover:border-cyan-400/50 hover:text-cyan-300"
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

      {/* Barra inferior: Salud | Selector de 3 Armas + Aviso [E] | Detalle Arma */}
      {localPlayer && (
        <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 px-4 py-4">
          {/* Salud */}
          <div className="w-48 shrink-0 rounded-2xl border border-slate-800 bg-slate-950/90 p-3 shadow-xl backdrop-blur-md sm:w-60">
            <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Heart className="h-3.5 w-3.5 fill-emerald-400" />
                BLINDAJE / HP
              </span>
              <span className="font-mono text-white">
                {hp} / {maxHp}
              </span>
            </div>
            <div className="h-3.5 w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
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

          {/* Centro: Aviso interactivo [E] + Selector de 3 ranuras */}
          <div className="pointer-events-auto flex flex-col items-center gap-2">
            {nearbyLoot && (
              <div className="flex items-center gap-2 rounded-xl border border-cyan-400/50 bg-slate-950/95 px-3.5 py-1.5 text-xs font-bold text-white shadow-neon backdrop-blur-md">
                <kbd className="rounded-md border border-slate-600 bg-slate-800 px-2 py-0.5 font-mono text-xs font-black text-cyan-300">
                  E
                </kbd>
                {nearbyLoot.kind === "medkit" ? (
                  <span>Recoger Botiquín (+35 HP)</span>
                ) : (
                  <span>
                    {inventory.length >= MAX_INVENTORY_SLOTS &&
                    !inventory.includes(nearbyLoot.weaponType || "rifle")
                      ? "Cambiar por "
                      : "Equipar "}
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

            <div className="flex items-end gap-2 rounded-2xl border border-slate-800 bg-slate-950/90 p-2 shadow-xl backdrop-blur-md">
              {Array.from({ length: MAX_INVENTORY_SLOTS }).map((_, slot) => {
                const weapon = inventory[slot];
                const meta = weapon ? WEAPON_META[weapon] : null;
                const isActive = localPlayer.activeSlot === slot && !!weapon;

                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={!weapon || !localPlayer.alive}
                    onClick={() => handleSlotClick(slot)}
                    title={
                      meta
                        ? `${meta.label} — ${meta.shortStats} (Tecla ${slot + 1})`
                        : "Ranura vacía — acércate a un arma y pulsa E"
                    }
                    className={`relative flex h-[66px] w-[78px] flex-col items-center justify-center gap-0.5 rounded-xl border-2 transition sm:w-[86px] ${
                      isActive
                        ? "-translate-y-1 border-white bg-slate-800/95 shadow-lg"
                        : weapon
                        ? "border-slate-700 bg-slate-900/85 hover:border-slate-400 hover:bg-slate-800/90"
                        : "cursor-default border-dashed border-slate-800 bg-slate-950/50 opacity-55"
                    }`}
                    style={
                      isActive && meta
                        ? { boxShadow: `0 0 18px ${meta.badgeHex}77` }
                        : undefined
                    }
                  >
                    <span className="absolute left-1.5 top-1 font-mono text-[10px] font-black text-slate-400">
                      {slot + 1}
                    </span>
                    {weapon && meta ? (
                      <>
                        <WeaponIcon weapon={weapon} color={meta.badgeHex} />
                        <span className="max-w-[74px] truncate text-[9px] font-bold uppercase tracking-wide text-slate-100">
                          {meta.label}
                        </span>
                      </>
                    ) : (
                      <span className="font-mono text-xs font-bold text-slate-700">
                        VACÍO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="rounded-md bg-slate-950/75 px-2.5 py-0.5 text-[10px] font-semibold text-slate-400 backdrop-blur-sm">
              <span className="text-slate-200">1-3 / Rueda / Click</span> elegir
              arma · <span className="text-cyan-300">E</span> recoger del suelo
            </div>
          </div>

          {/* Panel derecho de estadísticas del arma activa (visible en pantallas medianas/grandes) */}
          <div className="hidden w-60 shrink-0 items-center justify-end gap-3 rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 shadow-xl backdrop-blur-md md:flex">
            <div className="text-right">
              <div
                className="text-xs font-black uppercase tracking-wider"
                style={{ color: weaponInfo.badgeHex }}
              >
                {weaponInfo.label}
              </div>
              <div className="text-[11px] font-medium text-slate-400">
                {weaponInfo.shortStats}
              </div>
            </div>
            <div className="flex h-11 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900">
              <WeaponIcon weapon={activeWeapon} color={weaponInfo.badgeHex} />
            </div>
          </div>
        </footer>
      )}

      {/* Banner entre rondas */}
      {mode === "online" && status === "round_end" && !champion && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-20 flex justify-center px-4">
          <div className="rounded-2xl border border-cyan-400/40 bg-slate-900/92 px-6 py-3.5 text-center shadow-2xl backdrop-blur-xl">
            <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">
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
              Rotando escenario y modificador...
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
              ¡Campeón de la Arena!
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
