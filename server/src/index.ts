import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { TankRoom } from "./rooms/TankRoom";

dotenv.config();

const isVercel = Boolean(process.env.VERCEL);
const PORT = Number(process.env.PORT) || 2567;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const allowedOrigins = CORS_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (process.env.VERCEL_URL) {
  allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
}
if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  allowedOrigins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
}

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(express.json());

app.get(["/", "/health", "/api/health", "/api"], (_req, res) => {
  res.json({
    status: "ok",
    game: "Bala Perdida",
    mode: "arena_shooter_2d",
    version: "1.0.0",
  });
});

const httpServer = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
  }),
  greet: !isVercel,
  gracefullyShutdown: !isVercel,
});

// Registrar la sala multijugador "tank_room" permitiendo filtrar por código ("roomCode")
gameServer.define("tank_room", TankRoom).filterBy(["roomCode"]);

// Usar rutas Express nativas para matchmaking (soporta desarrollo local en :2567 y proxy /api)
httpServer.removeAllListeners("request");
httpServer.on("request", app);

let matchMakerAcceptPromise: Promise<void> | null = null;
function ensureMatchMakerReady(): Promise<void> {
  if (!matchMakerAcceptPromise) {
    matchMakerAcceptPromise = Promise.resolve(matchMaker.accept());
  }
  return matchMakerAcceptPromise;
}

function parseClientOptions(body: unknown): Record<string, unknown> {
  if (!body) return {};
  if (Buffer.isBuffer(body)) {
    const text = body.toString("utf8").trim();
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  }
  if (typeof body === "string") {
    const text = body.trim();
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  }
  if (typeof body === "object") {
    return body as Record<string, unknown>;
  }
  return {};
}

const handleMatchMakePost: express.RequestHandler = async (req, res) => {
  try {
    await ensureMatchMakerReady();
    const method = req.params.method;
    const roomName = req.params.roomName || "";
    const clientOptions = parseClientOptions(req.body);
    const authHeader = req.headers.authorization;
    const token =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : "";

    const response = await matchMaker.controller.invokeMethod(
      method,
      roomName,
      clientOptions,
      { token, request: req }
    );
    res.status(200).json(response);
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code ?? 500;
    const message = err instanceof Error ? err.message : "Matchmaking failed";
    res.status(200).json({ code, error: message });
  }
};

const handleMatchMakeGet: express.RequestHandler = async (req, res) => {
  try {
    await ensureMatchMakerReady();
    const roomName = req.params.roomName || "";
    const rooms = await matchMaker.controller.getAvailableRooms(roomName);
    res.status(200).json(rooms);
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code ?? 500;
    const message = err instanceof Error ? err.message : "Matchmaking failed";
    res.status(200).json({ code, error: message });
  }
};

app.post(
  ["/matchmake/:method/:roomName", "/api/matchmake/:method/:roomName"],
  handleMatchMakePost
);
app.post(["/matchmake/:method", "/api/matchmake/:method"], handleMatchMakePost);
app.get(
  ["/matchmake/:roomName", "/api/matchmake/:roomName", "/matchmake", "/api/matchmake"],
  handleMatchMakeGet
);

if (isVercel) {
  void ensureMatchMakerReady();
} else {
  matchMakerAcceptPromise = gameServer.listen(PORT).then(() => {
    console.log(`🚀 [Bala Perdida Arena Server] Escuchando en ws://localhost:${PORT}`);
    console.log(`🌐 [CORS] Permitido para: ${CORS_ORIGIN}`);
  });
}

export default httpServer;
