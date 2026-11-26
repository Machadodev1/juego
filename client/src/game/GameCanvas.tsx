import React, { useEffect, useRef } from "react";
import { Application, Container, Graphics } from "pixi.js";
import type {
  AbilityType,
  BulletHitEvent,
  BulletState,
  CrateDestroyedEvent,
  EmoteEvent,
  ExplosionEvent,
  HazardZoneState,
  KillFeedEvent,
  LootItemState,
  ObstacleState,
  PlayerEliminatedEvent,
  PlayerState,
  RoundModifier,
} from "@shared/types";
import { colyseusClient } from "../network/ColyseusClient";
import { soundManager } from "../audio/SoundManager";
import { ArenaRenderer } from "./ArenaRenderer";
import { TankRenderer } from "./TankRenderer";
import { BulletRenderer } from "./BulletRenderer";
import { EffectsManager } from "./EffectsManager";
import { InputManager } from "./InputManager";
import { LocalArena } from "./LocalArena";
import { hexToNumber, lerp } from "./Interpolation";

interface GameCanvasProps {
  mode: "online" | "local";
  mapWidth: number;
  mapHeight: number;
  stormRadius: number;
  stormX: number;
  stormY: number;
  modifier: RoundModifier;
  obstacles: Record<string, ObstacleState>;
  hazardZones: Record<string, HazardZoneState>;
  lootItems: Record<string, LootItemState>;
  players: Record<string, PlayerState>;
  bullets: Record<string, BulletState>;
  localSessionId: string;
  localAbility?: AbilityType;
  isPlaying: boolean;
  inputManagerRef?: React.MutableRefObject<InputManager | null>;
  localArenaRef?: React.MutableRefObject<LocalArena | null>;
  onLocalStateSync?: (
    players: Record<string, PlayerState>,
    modifier: RoundModifier,
    lootItems: Record<string, LootItemState>,
    mapWidth: number,
    mapHeight: number,
    stormRadius: number
  ) => void;
  onKillFeed?: (ev: KillFeedEvent) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  mode,
  mapWidth,
  mapHeight,
  stormRadius,
  stormX,
  stormY,
  modifier,
  obstacles,
  hazardZones,
  lootItems,
  players,
  bullets,
  localSessionId,
  localAbility = "dash",
  isPlaying,
  inputManagerRef,
  localArenaRef,
  onLocalStateSync,
  onKillFeed,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef({
    mapWidth,
    mapHeight,
    stormRadius,
    stormX,
    stormY,
    modifier,
    obstacles,
    hazardZones,
    lootItems,
    players,
    bullets,
    localSessionId,
    localAbility,
    isPlaying,
  });
  stateRef.current = {
    mapWidth,
    mapHeight,
    stormRadius,
    stormX,
    stormY,
    modifier,
    obstacles,
    hazardZones,
    lootItems,
    players,
    bullets,
    localSessionId,
    localAbility,
    isPlaying,
  };

  const onLocalSyncRef = useRef(onLocalStateSync);
  onLocalSyncRef.current = onLocalStateSync;
  const onKillFeedRef = useRef(onKillFeed);
  onKillFeedRef.current = onKillFeed;

  useEffect(() => {
    const containerEl = hostRef.current;
    if (!containerEl) return;

    let destroyed = false;
    let app: Application | null = null;
    let inputManager: InputManager | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const worldContainer = new Container();
    const minimapContainer = new Container();
    const minimapGfx = new Graphics();
    minimapContainer.addChild(minimapGfx);

    const arenaRenderer = new ArenaRenderer();
    const agentRenderer = new TankRenderer();
    const bulletRenderer = new BulletRenderer();
    const effectsManager = new EffectsManager();

    worldContainer.addChild(
      arenaRenderer.groundContainer,
      arenaRenderer.hazardGroundContainer,
      arenaRenderer.padContainer,
      arenaRenderer.lootContainer,
      arenaRenderer.obstacleContainer,
      agentRenderer.container,
      bulletRenderer.container,
      arenaRenderer.canopyContainer,
      arenaRenderer.smokeContainer,
      arenaRenderer.stormContainer,
      effectsManager.container
    );

    const prevBulletIds = new Set<string>();
    const prevLootIds = new Set<string>();
    const prevHpMap = new Map<string, number>();
    let prevAbilityCd = 0;

    let camX = mapWidth / 2;
    let camY = mapHeight / 2;

    const unsubHit = colyseusClient.onBulletHit((ev: BulletHitEvent) => {
      effectsManager.spawnBulletHit(ev.x, ev.y, ev.targetType, ev.damage);
      soundManager.playHit(ev.targetType);
    });

    const unsubExplosion = colyseusClient.onExplosion((ev: ExplosionEvent) => {
      effectsManager.spawnAreaExplosion(ev);
      soundManager.playExplosion(ev.kind);
    });

    const unsubCrate = colyseusClient.onCrateDestroyed(
      (ev: CrateDestroyedEvent) => {
        effectsManager.spawnCrateDebris(ev.x, ev.y, Boolean(ev.isGolden));
        soundManager.playCrateBreak(Boolean(ev.isGolden));
      }
    );

    const unsubEliminated = colyseusClient.onPlayerEliminated(
      (ev: PlayerEliminatedEvent) => {
        const victimColor =
          stateRef.current.players[ev.victimId]?.color || "#EF4444";
        effectsManager.spawnPlayerExplosion(ev.x, ev.y, victimColor);
        soundManager.playExplosion("barrel");
      }
    );

    const unsubEmote = colyseusClient.onEmote((ev: EmoteEvent) => {
      effectsManager.spawnEmote(ev.playerId, ev.x, ev.y, ev.emote);
      soundManager.playEmote(ev.emote);
    });

    const drawMinimap = (
      viewW: number,
      mW: number,
      mH: number,
      sX: number,
      sY: number,
      sR: number,
      activeObstacles: Record<string, ObstacleState>,
      activePlayers: Record<string, PlayerState>,
      meId: string
    ) => {
      const miniW = 156;
      const miniH = Math.round(miniW * (mH / mW));
      minimapContainer.position.set(viewW - miniW - 16, 62);

      minimapGfx.clear();
      minimapGfx
        .roundRect(0, 0, miniW, miniH, 8)
        .fill({ color: 0x0f1f17, alpha: 0.85 });
      minimapGfx
        .roundRect(0, 0, miniW, miniH, 8)
        .stroke({ width: 2, color: 0x475569, alpha: 0.95 });

      const sx = miniW / mW;
      const sy = miniH / mH;

      for (const obs of Object.values(activeObstacles)) {
        const c =
          obs.type === "golden_crate"
            ? 0xfacc15
            : obs.type === "explosive_barrel"
            ? 0xef4444
            : obs.type === "jump_pad"
            ? 0x22d3ee
            : obs.type === "rock"
            ? 0x64748b
            : 0x22c55e;
        minimapGfx
          .circle(obs.x * sx, obs.y * sy, Math.max(1.8, obs.radius * sx))
          .fill({ color: c, alpha: 0.8 });
      }

      for (const p of Object.values(activePlayers)) {
        if (!p.alive) continue;
        const isMe = p.id === meId;
        if (p.isInvisible && !isMe) continue;
        minimapGfx
          .circle(p.x * sx, p.y * sy, isMe ? 4.2 : 3.2)
          .fill({ color: isMe ? 0xfef08a : hexToNumber(p.color) });
      }

      // Anillo de tormenta en el minimapa
      const scaledR = Math.min(miniW * 1.4, sR * sx);
      minimapGfx
        .circle(sX * sx, sY * sy, scaledR)
        .stroke({ width: 1.5, color: 0xf87171, alpha: 0.85 });
    };

    const initPixi = async () => {
      const pixiApp = new Application();
      await pixiApp.init({
        background: "#0f1f17",
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        width: containerEl.clientWidth || 1280,
        height: containerEl.clientHeight || 720,
      });

      if (destroyed) {
        pixiApp.destroy(true, { children: true });
        return;
      }

      app = pixiApp;
      containerEl.innerHTML = "";
      containerEl.appendChild(pixiApp.canvas);
      pixiApp.canvas.style.display = "block";
      pixiApp.canvas.style.width = "100%";
      pixiApp.canvas.style.height = "100%";

      pixiApp.stage.addChild(worldContainer, minimapContainer);
      inputManager = new InputManager(pixiApp.canvas);
      if (inputManagerRef) {
        inputManagerRef.current = inputManager;
      }

      if (mode === "local" && localArenaRef && !localArenaRef.current) {
        const localPlayer = Object.values(stateRef.current.players)[0];
        localArenaRef.current = new LocalArena(
          localPlayer?.name || "Jugador",
          localPlayer?.color || "#22D3EE",
          stateRef.current.localAbility,
          {
            onShoot: (pid, x, y, angle, color, weapon) => {
              agentRenderer.triggerRecoil(pid, weapon === "sniper" ? 11 : 7);
              effectsManager.spawnMuzzleFlash(x, y, angle, color);
              soundManager.playShoot(weapon);
            },
            onBulletHit: (ev, victimId) => {
              if (victimId) {
                agentRenderer.triggerHitFlash(victimId);
              }
              effectsManager.spawnBulletHit(ev.x, ev.y, ev.targetType, ev.damage);
              soundManager.playHit(ev.targetType);
            },
            onExplosion: (ev) => {
              effectsManager.spawnAreaExplosion(ev);
              soundManager.playExplosion(ev.kind);
            },
            onCrateDestroyed: (ev) => {
              effectsManager.spawnCrateDebris(ev.x, ev.y, Boolean(ev.isGolden));
              soundManager.playCrateBreak(Boolean(ev.isGolden));
            },
            onPickup: () => {
              soundManager.playPickup();
            },
            onAbilityUsed: (ability) => {
              soundManager.playAbility(ability);
            },
            onEmote: (ev) => {
              effectsManager.spawnEmote(ev.playerId, ev.x, ev.y, ev.emote);
              soundManager.playEmote(ev.emote);
            },
            onEliminated: (ev, kf) => {
              const victimColor =
                localArenaRef.current?.players[ev.victimId]?.color || "#EF4444";
              effectsManager.spawnPlayerExplosion(ev.x, ev.y, victimColor);
              soundManager.playExplosion("barrel");
              onKillFeedRef.current?.(kf);
            },
          }
        );

        const la = localArenaRef.current;
        onLocalSyncRef.current?.(
          { ...la.players },
          la.modifier,
          { ...la.lootItems },
          la.mapWidth,
          la.mapHeight,
          la.stormRadius
        );
      }

      resizeObserver = new ResizeObserver(() => {
        if (!app || destroyed) return;
        const viewW = containerEl.clientWidth || window.innerWidth;
        const viewH = containerEl.clientHeight || window.innerHeight;
        app.renderer.resize(viewW, viewH);
      });
      resizeObserver.observe(containerEl);

      let hudSyncAccum = 0;

      pixiApp.ticker.add((ticker) => {
        const dtSeconds = ticker.deltaMS / 1000;
        const viewW = pixiApp.renderer.width;
        const viewH = pixiApp.renderer.height;

        let activeMapW = stateRef.current.mapWidth || 1600;
        let activeMapH = stateRef.current.mapHeight || 1200;
        let activeStormX = stateRef.current.stormX || activeMapW / 2;
        let activeStormY = stateRef.current.stormY || activeMapH / 2;
        let activeStormR = stateRef.current.stormRadius || 1100;
        let activeObstacles = stateRef.current.obstacles;
        let activeHazards = stateRef.current.hazardZones;
        let activeLoot = stateRef.current.lootItems;
        let activePlayers = stateRef.current.players;
        let activeBullets = stateRef.current.bullets;
        let activeSessionId = stateRef.current.localSessionId;
        const playing = stateRef.current.isPlaying;

        const worldScale = Math.max(0.75, Math.min(viewW / 1280, 1.12));
        let localAimAngle: number | undefined;

        if (mode === "local" && localArenaRef?.current) {
          const arena = localArenaRef.current;
          activeMapW = arena.mapWidth;
          activeMapH = arena.mapHeight;
          activeStormX = arena.stormX;
          activeStormY = arena.stormY;
          activeStormR = arena.stormRadius;
          activeSessionId = arena.localId;

          const meVisual =
            agentRenderer.getVisualPosition(activeSessionId) ||
            arena.players[activeSessionId] || { x: 800, y: 600 };

          const offsetX = viewW / 2 - camX * worldScale;
          const offsetY = viewH / 2 - camY * worldScale;

          if (playing && inputManager) {
            const input = inputManager.pollInput(
              meVisual.x,
              meVisual.y,
              offsetX,
              offsetY,
              worldScale
            );
            localAimAngle = input.angle;
            arena.step(input, dtSeconds);
          }

          activeObstacles = arena.obstacles;
          activeHazards = arena.hazardZones;
          activeLoot = arena.lootItems;
          activePlayers = arena.players;
          activeBullets = arena.bullets;

          hudSyncAccum += dtSeconds;
          if (hudSyncAccum >= 0.08) {
            hudSyncAccum = 0;
            onLocalSyncRef.current?.(
              { ...arena.players },
              arena.modifier,
              { ...arena.lootItems },
              arena.mapWidth,
              arena.mapHeight,
              Math.round(arena.stormRadius)
            );
          }
        } else {
          const me = activePlayers[activeSessionId];

          if (playing && inputManager && me && me.alive) {
            const meVisual =
              agentRenderer.getVisualPosition(activeSessionId) || me;
            const offsetX = viewW / 2 - camX * worldScale;
            const offsetY = viewH / 2 - camY * worldScale;
            const input = inputManager.pollInput(
              meVisual.x,
              meVisual.y,
              offsetX,
              offsetY,
              worldScale
            );
            localAimAngle = input.angle;
            colyseusClient.sendInput(input);
          }

          // Sonido de habilidad al detectar inicio de cooldown local
          if (me) {
            if (me.abilityCooldownMs > prevAbilityCd + 500) {
              soundManager.playAbility(me.ability);
            }
            prevAbilityCd = me.abilityCooldownMs;
          }

          // Hit flash al bajar HP/Shield de cualquier jugador en modo online
          for (const [pid, p] of Object.entries(activePlayers)) {
            const totalVital = p.hp + p.shield;
            const prevVital = prevHpMap.get(pid);
            if (prevVital !== undefined && totalVital < prevVital && p.alive) {
              agentRenderer.triggerHitFlash(pid);
            }
            prevHpMap.set(pid, totalVital);
          }

          // Destello, retroceso y audio para nuevos proyectiles
          let playedShotThisFrame = false;
          for (const [bid, bullet] of Object.entries(activeBullets)) {
            if (!prevBulletIds.has(bid)) {
              const owner = activePlayers[bullet.ownerId];
              if (owner) {
                agentRenderer.triggerRecoil(
                  owner.id,
                  bullet.weaponType === "sniper" ? 11 : 7
                );
                effectsManager.spawnMuzzleFlash(
                  bullet.x,
                  bullet.y,
                  owner.angle,
                  owner.color
                );
              }
              if (!playedShotThisFrame) {
                soundManager.playShoot(bullet.weaponType);
                playedShotThisFrame = true;
              }
            }
          }
          prevBulletIds.clear();
          for (const bid of Object.keys(activeBullets)) {
            prevBulletIds.add(bid);
          }

          for (const oldLootId of prevLootIds) {
            if (!activeLoot[oldLootId]) {
              soundManager.playPickup();
              break;
            }
          }
          prevLootIds.clear();
          for (const lid of Object.keys(activeLoot)) {
            prevLootIds.add(lid);
          }
        }

        // Seguimiento suave de cámara
        const me = activePlayers[activeSessionId];
        const meVisualPos =
          agentRenderer.getVisualPosition(activeSessionId) || me || {
            x: activeMapW / 2,
            y: activeMapH / 2,
          };

        if (me && me.alive) {
          camX = lerp(camX, meVisualPos.x, 0.14);
          camY = lerp(camY, meVisualPos.y, 0.14);
        } else {
          const aliveOther = Object.values(activePlayers).find((p) => p.alive);
          const targetX = aliveOther ? aliveOther.x : activeMapW / 2;
          const targetY = aliveOther ? aliveOther.y : activeMapH / 2;
          camX = lerp(camX, targetX, 0.08);
          camY = lerp(camY, targetY, 0.08);
        }

        worldContainer.scale.set(worldScale);
        const baseOffsetX = viewW / 2 - camX * worldScale;
        const baseOffsetY = viewH / 2 - camY * worldScale;

        arenaRenderer.renderMapBase(activeMapW, activeMapH);
        arenaRenderer.syncHazards(activeHazards, activeSessionId);
        arenaRenderer.syncObstacles(
          activeObstacles,
          activePlayers,
          activeSessionId,
          dtSeconds
        );
        arenaRenderer.syncLoot(
          activeLoot,
          dtSeconds,
          me?.x,
          me?.y,
          Boolean(me && me.alive && !me.isDowned)
        );
        arenaRenderer.renderStorm(activeStormX, activeStormY, activeStormR);

        const lerpAlpha = Math.min(1, 0.34 * (ticker.deltaTime || 1));
        agentRenderer.sync(
          activePlayers,
          activeSessionId,
          lerpAlpha,
          dtSeconds,
          localAimAngle
        );

        bulletRenderer.sync(activeBullets, dtSeconds, activePlayers);
        effectsManager.update(
          dtSeconds,
          worldContainer,
          baseOffsetX,
          baseOffsetY,
          (pid) => agentRenderer.getVisualPosition(pid)
        );

        drawMinimap(
          viewW,
          activeMapW,
          activeMapH,
          activeStormX,
          activeStormY,
          activeStormR,
          activeObstacles,
          activePlayers,
          activeSessionId
        );
      });
    };

    void initPixi();

    return () => {
      destroyed = true;
      unsubHit();
      unsubExplosion();
      unsubCrate();
      unsubEliminated();
      unsubEmote();
      resizeObserver?.disconnect();
      inputManager?.destroy();
      if (inputManagerRef) {
        inputManagerRef.current = null;
      }
      arenaRenderer.reset();
      agentRenderer.clear();
      bulletRenderer.clear();
      effectsManager.clear();
      minimapGfx.destroy();
      if (app) {
        app.destroy(true, { children: true });
      }
    };
  }, [mode, localArenaRef, inputManagerRef]);

  return (
    <div
      ref={hostRef}
      className="relative h-full w-full overflow-hidden bg-slate-950 cursor-crosshair select-none"
    />
  );
};
