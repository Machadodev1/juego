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
const CORS_ORIGIN = process.env.CORS_ORIGIN || "";

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

app.get(["/health", "/api/health", "/api"], (_req, res) => {
  res.json({
    status: "ok",
    game: "Bala Perdida",
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

// Registrar la sala multijugador "tank_room" permitiendo filtrar por código de sala ("roomCode")
gameServer.define("tank_room", TankRoom).filterBy(["roomCode"]);

if (isVercel) {
  // En Vercel Functions / vercel dev no se invoca .listen(); activamos el matchMaker directamente
  void matchMaker.accept();
} else {
  gameServer.listen(PORT).then(() => {
    console.log(`🚀 [Bala Perdida Server] Escuchando en ws://localhost:${PORT}`);
  });
}

export { app, httpServer, gameServer };
export default httpServer;
