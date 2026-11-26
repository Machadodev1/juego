import React, { useEffect, useRef, useState } from "react";
import type { PlayerState, RoundEndEvent } from "@shared/types";
import {
  COLOR_STORAGE_KEY,
  NEON_COLORS,
  NICKNAME_STORAGE_KEY,
} from "./constants";
import { colyseusClient, type TankRoomSnapshot } from "./network/ColyseusClient";
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
    () => localStorage.getItem(NICKNAME_STORAGE_KEY) || "Piloto"
  );
  const [selectedColor, setSelectedColor] = useState<string>(
    () => localStorage.getItem(COLOR_STORAGE_KEY) || NEON_COLORS[0].hex
  );
  const [initialRoomCode] = useState<string>(() => getInitialRoomParam());

  const [snapshot, setSnapshot] = useState<TankRoomSnapshot | null>(() =>
    colyseusClient.getSnapshot()
  );
  const [lastRoundEnd, setLastRoundEnd] = useState<RoundEndEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [localMode, setLocalMode] = useState(false);
  const [localPlayers, setLocalPlayers] = useState<Record<string, PlayerState>>({});
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
      await colyseusClient.createRoom(nickname.trim() || "Piloto", selectedColor);
    } catch (err) {
      setError(
        err instanceof Error
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
        nickname.trim() || "Piloto",
        selectedColor
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `No se pudo unir a la sala ${code}: ${err.message}`
          : `No se pudo unir a la sala ${code}.`
      );
    } finally {
      setLoading(false);
    }
  };

  // Auto-join if ?room=XXXX is present in the invite URL
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
    setLocalPlayers({
      "local-player": {
        id: "local-player",
        name: nickname.trim() || "Piloto",
        x: 120,
        y: 120,
        angle: 0,
        color: selectedColor,
        alive: true,
        score: 0,
        ready: true,
      },
    });
    setLocalMode(true);
  };

  const handleLeave = async () => {
    if (localMode) {
      localArenaRef.current = null;
      setLocalMode(false);
      setLocalPlayers({});
      return;
    }
    await colyseusClient.leaveRoom();
    setLastRoundEnd(null);
  };

  const handleResetLocalMaze = () => {
    if (localArenaRef.current) {
      localArenaRef.current.resetMaze();
      setLocalPlayers({ ...localArenaRef.current.players });
    }
  };

  // 1. Local Sandbox Arena
  if (localMode) {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
        <GameHUD
          mode="local"
          status="playing"
          sessionId="local-player"
          players={localPlayers}
          winnerId=""
          lastRoundEnd={null}
          onLeave={() => void handleLeave()}
          onResetLocalMaze={handleResetLocalMaze}
        />
        <GameCanvas
          mode="local"
          maze={null}
          players={localPlayers}
          bullets={{}}
          localSessionId="local-player"
          isPlaying={true}
          localArenaRef={localArenaRef}
          onLocalScoreChange={setLocalPlayers}
        />
      </div>
    );
  }

  // 2. Home Screen
  if (!snapshot) {
    return (
      <HomeScreen
        nickname={nickname}
        selectedColor={selectedColor}
        initialRoomCode={initialRoomCode}
        loading={loading}
        error={error}
        onNicknameChange={handleNicknameChange}
        onColorChange={handleColorChange}
        onCreateRoom={() => void handleCreateRoom()}
        onJoinRoom={(code) => void handleJoinRoom(code)}
        onStartLocalMode={handleStartLocalMode}
      />
    );
  }

  // 3. Lobby Screen
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
        onLeaveRoom={() => void handleLeave()}
      />
    );
  }

  // 4. Active Game / Round End
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
      <GameHUD
        mode="online"
        roomCode={snapshot.roomCode}
        status={snapshot.status}
        sessionId={snapshot.sessionId}
        players={snapshot.players}
        winnerId={snapshot.winnerId}
        lastRoundEnd={lastRoundEnd}
        onLeave={() => void handleLeave()}
      />
      <GameCanvas
        mode="online"
        maze={snapshot.maze}
        players={snapshot.players}
        bullets={snapshot.bullets}
        localSessionId={snapshot.sessionId}
        isPlaying={snapshot.status === "playing"}
      />
    </div>
  );
};

export default App;
