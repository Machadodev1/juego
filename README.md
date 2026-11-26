# BALA PERDIDA 🎯💥

Juego multijugador online en tiempo real de combate de tanques en laberintos 2D con física autoritativa de rebotes (estilo *Tank Trouble*).

## Estructura del Monorepo
- `/client`: Frontend en React + Vite + Tailwind CSS + PixiJS v8 + Colyseus.js + Web Audio / Howler.js (`http://localhost:5173`).
- `/server`: Servidor autoritativo en Node.js + TypeScript + Colyseus + Matter.js (`ws://localhost:2567`).
- `/shared`: Contratos e interfaces TypeScript compartidas entre cliente y servidor (`shared/types.ts`).

## Inicio Rápido (Desarrollo en Conjunto)

```bash
# 1. Instalar dependencias de servidor y cliente
npm run install:all

# 2. Levantar servidor (puerto 2567) y cliente (puerto 5173) simultáneamente
npm run dev
```

También puedes ejecutarlos en terminales separadas:

```bash
# Terminal 1 - Backend Autoritativo
cd server && npm run dev

# Terminal 2 - Cliente Web
cd client && npm run dev
```

## Compilación de Producción

```bash
npm run build
```

## Ramas de Desarrollo
- `main`: Código estable e integrado (`client` + `server` + `shared`).
- `feat/client`: Desarrollo del Frontend, renderizado 2D y cliente online.
- `feat/server`: Desarrollo del Servidor autoritativo, físicas Matter.js y salas Colyseus.
