# BALA PERDIDA 🎯🔥

Juego multijugador online **Top-Down Arena Shooter 2D** (estilo *ZombsRoyale.io*) hasta para 4 jugadores por sala, con cajas de botín destructibles, armas variadas y modificadores de ronda sobre un servidor autoritativo.

## Estructura del Monorepo
- `/client`: Frontend en React + Vite + Tailwind CSS + PixiJS v8 + Colyseus.js + Howler.js (`http://localhost:5173`).
- `/server`: Servidor autoritativo en Node.js + TypeScript + Colyseus + Matter.js (`ws://localhost:2567`).
- `/shared`: Fuente única de verdad de contratos e interfaces TypeScript (`shared/types.ts`).
- `vercel.json`: Configuración de **Vercel Services** (`client` + `server` bajo `/api/(.*)` y `/(.*)`).

## Inicio Rápido (Desarrollo Local)

```bash
# 1. Instalar dependencias de servidor y cliente
npm run install:all

# 2. Levantar servidor (puerto 2567) y cliente (puerto 5173) simultáneamente
npm run dev
```

## Compilación de Producción

```bash
npm run build
```

## Mecánicas de Juego (v1)
- **Arena Abierta (`1600x1200`):** 4 puntos de aparición seguros en las esquinas, rocas indestructibles, árboles con copa frondosa y cajas de madera destructibles (`40 HP`).
- **Armas y Botín:** Pistola inicial, Escopeta (`5` perdigones en abanico), Rifle de Asalto, Francotirador (`65 DMG`) y Botiquines (`+35 HP`).
- **Modificadores por Ronda:** `normal`, `speed_boost` (`1.4x`), `ricochet` (hasta 2 rebotes), `vampire` (`+25 HP` por eliminación) y `double_damage` (`2x`).
