import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { TankRoom } from "./rooms/TankRoom";

dotenv.config();

const PORT = Number(process.env.PORT) || 2567;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const app = express();

const allowedOrigins = CORS_ORIGIN.split(",").map((o) => o.trim());

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

app.get("/health", (_req, res) => {
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
});

// Registrar la sala multijugador "tank_room" permitiendo filtrar por código de sala ("roomCode")
gameServer.define("tank_room", TankRoom).filterBy(["roomCode"]);

gameServer.listen(PORT).then(() => {
  console.log(`🚀 [Bala Perdida Server] Escuchando en ws://localhost:${PORT}`);
  console.log(`🌐 [CORS] Permitido para: ${CORS_ORIGIN}`);
});
