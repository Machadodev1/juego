import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
  ArenaTheme,
  LootItemState,
  PlayerState,
  RoundEndEvent,
  RoundModifier,
} from "@shared/types";
import {
  COLOR_STORAGE_KEY,
  NEON_COLORS,
  NICKNAME_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "./constants";
import {
  colyseusClient,
  type TankRoomSnapshot,
} from "./network/ColyseusClient";
import { soundManager } from "./audio/SoundManager";
import { HomeScreen } from "./components/HomeScreen";
import { LobbyScreen } from "./components/LobbyScreen";
import { GameHUD } from "./components/GameHUD";
import { GameCanvas } from "./game/GameCanvas";
import type { LocalArena } from "./game/LocalArena";

function getInitialRoomParam(): string {
  const params = new URLSearchParams(window.location.search);
  return (params.get("room") || "").trim().toUpperCase();
}

export const App: React.FC = () => {
  const [nickname, setNickname] = useState<string>(
    () => localStorage.getItem(NICKNAME_STORAGE_KEY) || "Agente"
  );
  const [selectedColor, setSelectedColor] = useState<string>(
    () => localStorage.getItem(COLOR_STORAGE_KEY) || NEON_COLORS[0].hex
  );
  const [selectedTheme, setSelectedTheme] = useState<string>(
    () => localStorage.getItem(THEME_STORAGE_KEY) || "random"
  );
  const [initialRoomCode] = useState<string>(() => getInitialRoomParam());

  const [snapshot, setSnapshot] = useState<TankRoomSnapshot | null>(() =>
    colyseusClient.getSnapshot()
  );
  const [lastRoundEnd, setLastRoundEnd] = useState<RoundEndEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [localMode, setLocalMode] = useState(false);
  const [localModifier, setLocalModifier] = useState<RoundModifier>("normal");
  const [localTheme, setLocalTheme] = useState<ArenaTheme>("cyber_outpost");
  const [localPlayers, setLocalPlayers] = useState<Record<string, PlayerState>>(
    {}
  );
  const [localLootItems, setLocalLootItems] = useState<
    Record<string, LootItemState>
  >({});
  const localArenaRef = useRef<LocalArena | null>(null);
  const autoJoinedRef = useRef(false);

  const handleNicknameChange = (name: string) => {
    setNickname(name);
    localStorage.setItem(NICKNAME_STORAGE_KEY, name);
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    localStorage.setItem(COLOR_STORAGE_KEY, color);
  };

  const handleThemeChange = (theme: string) => {
    setSelectedTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
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

    const unsubDisconnect = colyseusClient.onDisconnect((reason) => {
      if (reason) setError(reason);
    });

    return () => {
      unsubState();
      unsubRoundEnd();
      unsubDisconnect();
    };
  }, []);

  const handleCreateRoom = async () => {
    setError(null);
    setLoading(true);
    try {
      await colyseusClient.createRoom(
        nickname.trim() || "Agente",
        selectedColor,
        selectedTheme
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
        nickname.trim() || "Agente",
        selectedColor
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
    localArenaRef.current = null;
    setLocalLootItems({});
    setLocalPlayers({
      "local-player": {
        id: "local-player",
        name: nickname.trim() || "Agente",
        x: 180,
        y: 180,
        angle: 0,
        color: selectedColor,
        hp: 100,
        maxHp: 100,
        alive: true,
        score: 0,
        ready: true,
        weapon: "pistol",
        inventory: ["pistol"],
        activeSlot: 0,
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
      return;
    }
    await colyseusClient.leaveRoom();
    setLastRoundEnd(null);
  };

  const handleResetLocalArena = () => {
    if (localArenaRef.current) {
      localArenaRef.current.resetArena(false);
      setLocalPlayers({ ...localArenaRef.current.players });
      setLocalModifier(localArenaRef.current.modifier);
      setLocalTheme(localArenaRef.current.theme);
      setLocalLootItems({ ...localArenaRef.current.lootItems });
    }
  };

  const handleSelectLocalTheme = useCallback((nextTheme: ArenaTheme) => {
    if (localArenaRef.current) {
      localArenaRef.current.setPreferredTheme(nextTheme);
      localArenaRef.current.resetArena(true);
      setLocalPlayers({ ...localArenaRef.current.players });
      setLocalModifier(localArenaRef.current.modifier);
      setLocalTheme(localArenaRef.current.theme);
      setLocalLootItems({ ...localArenaRef.current.lootItems });
    }
  }, []);

  const handleLocalSelectSlot = useCallback((slot: number) => {
    if (localArenaRef.current) {
      localArenaRef.current.selectSlot(slot);
      setLocalPlayers({ ...localArenaRef.current.players });
    }
  }, []);

  const handleOnlineSelectSlot = useCallback((slot: number) => {
    colyseusClient.selectSlot(slot);
  }, []);

  const handleLocalStateSync = useCallback(
    (
      players: Record<string, PlayerState>,
      modifier: RoundModifier,
      theme: ArenaTheme,
      lootItems: Record<string, LootItemState>
    ) => {
      setLocalPlayers(players);
      setLocalModifier(modifier);
      setLocalTheme(theme);
      setLocalLootItems(lootItems);
    },
    []
  );

  // 1. Modo Arena Práctica Local
  if (localMode) {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
        <GameHUD
          mode="local"
          status="playing"
          theme={localTheme}
          modifier={localModifier}
          sessionId="local-player"
          players={localPlayers}
          lootItems={localLootItems}
          lastRoundEnd={null}
          onLeave={() => void handleLeave()}
          onSelectSlot={handleLocalSelectSlot}
          onResetLocalArena={handleResetLocalArena}
          onSelectLocalTheme={handleSelectLocalTheme}
        />
        <GameCanvas
          mode="local"
          mapWidth={1600}
          mapHeight={1200}
          theme={localTheme}
          modifier={localModifier}
          obstacles={{}}
          lootItems={localLootItems}
          players={localPlayers}
          bullets={{}}
          localSessionId="local-player"
          isPlaying={true}
          localTheme={selectedTheme}
          localArenaRef={localArenaRef}
          onLocalStateSync={handleLocalStateSync}
        />
      </div>
    );
  }

  // 2. Pantalla Principal (Home)
  if (!snapshot) {
    return (
      <HomeScreen
        nickname={nickname}
        selectedColor={selectedColor}
        selectedTheme={selectedTheme}
        initialRoomCode={initialRoomCode}
        loading={loading}
        error={error}
        onNicknameChange={handleNicknameChange}
        onColorChange={handleColorChange}
        onThemeChange={handleThemeChange}
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
        theme={snapshot.theme}
        preferredTheme={snapshot.preferredTheme}
        onSelectTheme={(t) => colyseusClient.selectTheme(t)}
        onToggleReady={() => colyseusClient.toggleReady()}
        onStartGame={() => colyseusClient.startGame()}
        onUpdateColor={(color) => {
          handleColorChange(color);
          colyseusClient.updateProfile({ color });
        }}
        onLeaveRoom={() => void handleLeave()}
      />
    );
  }

  // 4. Combate en Arena Online / Fin de Ronda
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
      <GameHUD
        mode="online"
        roomCode={snapshot.roomCode}
        status={snapshot.status}
        theme={snapshot.theme}
        modifier={snapshot.modifier}
        sessionId={snapshot.sessionId}
        players={snapshot.players}
        lootItems={snapshot.lootItems}
        lastRoundEnd={lastRoundEnd}
        onLeave={() => void handleLeave()}
        onSelectSlot={handleOnlineSelectSlot}
      />
      <GameCanvas
        mode="online"
        mapWidth={snapshot.mapWidth}
        mapHeight={snapshot.mapHeight}
        theme={snapshot.theme}
        modifier={snapshot.modifier}
        obstacles={snapshot.obstacles}
        lootItems={snapshot.lootItems}
        players={snapshot.players}
        bullets={snapshot.bullets}
        localSessionId={snapshot.sessionId}
        isPlaying={snapshot.status === "playing"}
      />
    </div>
  );
};

export default App;
