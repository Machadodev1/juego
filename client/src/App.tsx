import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
  AbilityType,
  EmoteType,
  KillFeedEvent,
  LootItemState,
  PlayerState,
  RoundEndEvent,
  RoundModifier,
} from "@shared/types";
import {
  ABILITY_ORDER,
  ABILITY_STORAGE_KEY,
  COLOR_STORAGE_KEY,
  NEON_COLORS,
  NICKNAME_STORAGE_KEY,
} from "./constants";
import {
  colyseusClient,
  type TankRoomSnapshot,
} from "./network/ColyseusClient";
import { soundManager } from "./audio/SoundManager";
import { HomeScreen } from "./components/HomeScreen";
import { LobbyScreen } from "./components/LobbyScreen";
import { GameHUD, type KillFeedEntry } from "./components/GameHUD";
import { GameCanvas } from "./game/GameCanvas";
import type { InputManager } from "./game/InputManager";
import type { LocalArena } from "./game/LocalArena";

function getInitialRoomParam(): string {
  const params = new URLSearchParams(window.location.search);
  return (params.get("room") || "").trim().toUpperCase();
}

function getInitialAbility(): AbilityType {
  const raw = localStorage.getItem(ABILITY_STORAGE_KEY) as AbilityType | null;
  if (raw && ABILITY_ORDER.includes(raw)) return raw;
  return "dash";
}

export const App: React.FC = () => {
  const [nickname, setNickname] = useState<string>(
    () => localStorage.getItem(NICKNAME_STORAGE_KEY) || "Jugador"
  );
  const [selectedColor, setSelectedColor] = useState<string>(
    () => localStorage.getItem(COLOR_STORAGE_KEY) || NEON_COLORS[0].hex
  );
  const [selectedAbility, setSelectedAbility] = useState<AbilityType>(() =>
    getInitialAbility()
  );
  const [initialRoomCode] = useState<string>(() => getInitialRoomParam());

  const [snapshot, setSnapshot] = useState<TankRoomSnapshot | null>(() =>
    colyseusClient.getSnapshot()
  );
  const [lastRoundEnd, setLastRoundEnd] = useState<RoundEndEvent | null>(null);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [localMode, setLocalMode] = useState(false);
  const [localModifier, setLocalModifier] = useState<RoundModifier>("normal");
  const [localMapDims, setLocalMapDims] = useState({ w: 1600, h: 1200, storm: 1100 });
  const [localPlayers, setLocalPlayers] = useState<Record<string, PlayerState>>(
    {}
  );
  const [localLootItems, setLocalLootItems] = useState<
    Record<string, LootItemState>
  >({});

  const localArenaRef = useRef<LocalArena | null>(null);
  const inputManagerRef = useRef<InputManager | null>(null);
  const autoJoinedRef = useRef(false);
  const killSeqRef = useRef(0);

  const pushKillFeed = useCallback((ev: KillFeedEvent) => {
    const id = `kf_${++killSeqRef.current}_${Date.now()}`;
    setKillFeed((prev) => [{ ...ev, id }, ...prev].slice(0, 5));
    window.setTimeout(() => {
      setKillFeed((prev) => prev.filter((item) => item.id !== id));
    }, 5500);
  }, []);

  const handleNicknameChange = (name: string) => {
    setNickname(name);
    localStorage.setItem(NICKNAME_STORAGE_KEY, name);
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    localStorage.setItem(COLOR_STORAGE_KEY, color);
  };

  const handleAbilityChange = (ability: AbilityType) => {
    setSelectedAbility(ability);
    localStorage.setItem(ABILITY_STORAGE_KEY, ability);
  };

  useEffect(() => {
    const unsubState = colyseusClient.subscribeState((next) => {
      setSnapshot(next);
      if (next && next.status === "playing") {
        setLastRoundEnd(null);
      }
    });

    const unsubRoundEnd = colyseusClient.onRoundEnd((ev) => {
      setLastRoundEnd(ev);
      soundManager.playRoundWin();
    });

    const unsubKillFeed = colyseusClient.onKillFeed((ev) => {
      pushKillFeed(ev);
    });

    const unsubDisconnect = colyseusClient.onDisconnect((reason) => {
      if (reason) setError(reason);
    });

    return () => {
      unsubState();
      unsubRoundEnd();
      unsubKillFeed();
      unsubDisconnect();
    };
  }, [pushKillFeed]);

  const handleCreateRoom = async () => {
    setError(null);
    setLoading(true);
    try {
      await colyseusClient.createRoom(
        nickname.trim() || "Jugador",
        selectedColor,
        selectedAbility
      );
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `No se pudo crear la sala: ${err.message}`
          : "No se pudo conectar con el servidor."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (code: string) => {
    setError(null);
    setLoading(true);
    try {
      await colyseusClient.joinRoomByCode(
        code,
        nickname.trim() || "Jugador",
        selectedColor,
        selectedAbility
      );
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `No se pudo unir a la sala ${code}: ${err.message}`
          : `No se pudo unir a la sala ${code}.`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialRoomCode && !autoJoinedRef.current && !snapshot && !localMode) {
      autoJoinedRef.current = true;
      void handleJoinRoom(initialRoomCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoomCode]);

  const handleStartLocalMode = () => {
    setError(null);
    setKillFeed([]);
    localArenaRef.current = null;
    setLocalLootItems({});
    setLocalPlayers({
      "local-player": {
        id: "local-player",
        name: nickname.trim() || "Jugador",
        x: 170,
        y: 170,
        angle: 0,
        color: selectedColor,
        hp: 100,
        maxHp: 100,
        shield: 0,
        maxShield: 50,
        alive: true,
        isDowned: false,
        downedTimerMs: 0,
        score: 0,
        streak: 0,
        hasBounty: false,
        ready: true,
        weapon: "pistol",
        ability: selectedAbility,
        abilityCooldownMs: 0,
        shieldActive: false,
        hasHotPotato: false,
        hotPotatoTimerMs: 0,
        isInvisible: false,
        isAirborne: false,
      },
    });
    setLocalMode(true);
  };

  const handleLeave = async () => {
    if (localMode) {
      localArenaRef.current = null;
      setLocalMode(false);
      setLocalPlayers({});
      setLocalLootItems({});
      setKillFeed([]);
      return;
    }
    await colyseusClient.leaveRoom();
    setLastRoundEnd(null);
    setKillFeed([]);
  };

  const handleTriggerEmote = useCallback(
    (emote: EmoteType) => {
      if (localMode) {
        inputManagerRef.current?.triggerEmote(emote);
      } else {
        colyseusClient.sendEmote(emote);
      }
    },
    [localMode]
  );

  const handleTriggerAbility = useCallback(() => {
    inputManagerRef.current?.triggerAbility();
  }, []);

  const handleLocalStateSync = useCallback(
    (
      players: Record<string, PlayerState>,
      modifier: RoundModifier,
      lootItems: Record<string, LootItemState>,
      mapWidth: number,
      mapHeight: number,
      stormRadius: number
    ) => {
      setLocalPlayers(players);
      setLocalModifier(modifier);
      setLocalLootItems(lootItems);
      setLocalMapDims({ w: mapWidth, h: mapHeight, storm: stormRadius });
    },
    []
  );

  // 1. Modo de Prueba Local (Sin Servidor)
  if (localMode) {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
        <GameHUD
          mode="local"
          status="playing"
          modifier={localModifier}
          sessionId="local-player"
          players={localPlayers}
          lootItems={localLootItems}
          killFeed={killFeed}
          lastRoundEnd={null}
          onLeave={() => void handleLeave()}
          onTriggerEmote={handleTriggerEmote}
          onTriggerAbility={handleTriggerAbility}
          onResetLocalArena={() => {
            localArenaRef.current?.resetArena();
          }}
          onCycleLocalWeapon={() => {
            localArenaRef.current?.cycleWeapon();
          }}
          onCycleLocalModifier={() => {
            localArenaRef.current?.cycleModifier();
          }}
          onSelectLocalAbility={(ab) => {
            handleAbilityChange(ab);
            localArenaRef.current?.setLocalAbility(ab);
          }}
        />
        <GameCanvas
          mode="local"
          mapWidth={localMapDims.w}
          mapHeight={localMapDims.h}
          stormRadius={localMapDims.storm}
          stormX={localMapDims.w / 2}
          stormY={localMapDims.h / 2}
          modifier={localModifier}
          obstacles={{}}
          hazardZones={{}}
          lootItems={localLootItems}
          players={localPlayers}
          bullets={{}}
          localSessionId="local-player"
          localAbility={selectedAbility}
          isPlaying={true}
          inputManagerRef={inputManagerRef}
          localArenaRef={localArenaRef}
          onLocalStateSync={handleLocalStateSync}
          onKillFeed={pushKillFeed}
        />
      </div>
    );
  }

  // 2. Pantalla de Inicio
  if (!snapshot) {
    return (
      <HomeScreen
        nickname={nickname}
        selectedColor={selectedColor}
        selectedAbility={selectedAbility}
        initialRoomCode={initialRoomCode}
        loading={loading}
        error={error}
        onNicknameChange={handleNicknameChange}
        onColorChange={handleColorChange}
        onAbilityChange={handleAbilityChange}
        onCreateRoom={() => void handleCreateRoom()}
        onJoinRoom={(code) => void handleJoinRoom(code)}
        onStartLocalMode={handleStartLocalMode}
      />
    );
  }

  // 3. Sala de Espera (Lobby)
  if (snapshot.status === "waiting") {
    return (
      <LobbyScreen
        roomCode={snapshot.roomCode}
        sessionId={snapshot.sessionId}
        players={snapshot.players}
        onToggleReady={() => colyseusClient.toggleReady()}
        onStartGame={() => colyseusClient.startGame()}
        onUpdateColor={(color) => {
          handleColorChange(color);
          colyseusClient.updateProfile({ color });
        }}
        onUpdateAbility={(ability) => {
          handleAbilityChange(ability);
          colyseusClient.updateProfile({ ability });
        }}
        onLeaveRoom={() => void handleLeave()}
      />
    );
  }

  // 4. Arena Multijugador Online
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
      <GameHUD
        mode="online"
        roomCode={snapshot.roomCode}
        status={snapshot.status}
        modifier={snapshot.modifier}
        sessionId={snapshot.sessionId}
        players={snapshot.players}
        lootItems={snapshot.lootItems}
        killFeed={killFeed}
        lastRoundEnd={lastRoundEnd}
        onLeave={() => void handleLeave()}
        onTriggerEmote={handleTriggerEmote}
        onTriggerAbility={handleTriggerAbility}
      />
      <GameCanvas
        mode="online"
        mapWidth={snapshot.mapWidth}
        mapHeight={snapshot.mapHeight}
        stormRadius={snapshot.stormRadius}
        stormX={snapshot.stormX}
        stormY={snapshot.stormY}
        modifier={snapshot.modifier}
        obstacles={snapshot.obstacles}
        hazardZones={snapshot.hazardZones}
        lootItems={snapshot.lootItems}
        players={snapshot.players}
        bullets={snapshot.bullets}
        localSessionId={snapshot.sessionId}
        isPlaying={snapshot.status === "playing"}
        inputManagerRef={inputManagerRef}
      />
    </div>
  );
};

export default App;
