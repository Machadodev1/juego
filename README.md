# BALA PERDIDA ⚡🎯

Juego multijugador online **Arena Táctica Sci-Fi 2D** hasta para 4 agentes por sala, con estética cyber-táctica propia, 4 escenarios temáticos con clima dinámico, cápsulas de suministro destructibles, inventario de 3 armas y modificadores de ronda sobre un servidor autoritativo.

## Estructura del Monorepo
- `/client`: Frontend en React + Vite + Tailwind CSS + PixiJS v8 + Colyseus.js + Web Audio (`http://localhost:5173`).
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

## Mapas Temáticos y Mecánicas
- **4 Escenarios con Ambiente Dinámico (`1600x1200`):**
  - ⚡ **Estación Cyber (`cyber_outpost`):** Cubierta hexagonal metálica, pilones energéticos y domos holográficos.
  - 🌙 **Bosque Nocturno (`midnight`):** Visibilidad focal nocturna, cristales violetas luminosos y luciérnagas.
  - ❄️ **Tundra Ártica (`arctic`):** Placas de hielo glacial, ventisca de nieve, pinos helados y cápsulas térmicas.
  - 🏜️ **Dunas Solares (`desert`):** Mesetas de arenisca, ráfagas de arena y cactus florales.
- **7 Armas y Selector de 3 Ranuras:**
  - **Pistola Táctica** (arma inicial), **Subfusil**, **Escopeta**, **Rifle de Asalto**, **Ráfaga Triple**, **Cañón de Plasma** (rebote natural) y **Francotirador** (`65 DMG`), además de **Botiquines** (`+35 HP`).
  - Recolección manual acercándose al arma y pulsando **`E`** (sin recoger armas accidentalmente al caminar encima).
  - Cambio instantáneo entre las 3 ranuras con **`1` / `2` / `3`**, **rueda del ratón**, **`Q` / `R`** o haciendo clic en el HUD.
- **Modificadores por Ronda:** `normal`, `speed_boost` (`1.4x`), `ricochet` (`+2` rebotes), `vampire` (`+25 HP` por eliminación) y `double_damage` (`2x`).
