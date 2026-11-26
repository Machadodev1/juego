# BALA PERDIDA 💥🎯

**Top-Down Arena Shooter 2D caótico estilo ZombsRoyale.io** hasta para 4 jugadores por sala, con armas doradas especiales, habilidades activas, trampas interactivas en el mapa, Último Aliento, zona de tormenta y 10 mutadores locos por ronda sobre un servidor autoritativo.

## Estructura del Monorepo
- `/shared`: Fuente única de verdad de contratos TypeScript (`shared/types.ts`).
- `/server`: Servidor autoritativo en Node.js + TypeScript + Colyseus + Matter.js (`ws://localhost:2567`, sala `"tank_room"`).
- `/client`: Frontend en React + Vite + Tailwind CSS + PixiJS v8 + Colyseus.js + Howler.js (`http://localhost:5173`).
- `vercel.json`: Configuración lista para **Vercel Services** (`client` + `server`).

## Inicio Rápido

```bash
# 1. Instalar dependencias en /server y /client
npm run install:all

# 2. Levantar servidor (:2567) y cliente (:5173) simultáneamente
npm run dev

# 3. Compilar ambos paquetes para producción
npm run build
```

## Mecánicas Principales
- **9 Armas:** `pistol`, `shotgun`, `rifle`, `sniper` + 5 armas doradas en la Caja Dorada central (`impulse_gun`, `flamethrower`, `saw_disc` boomerang, `bee_cannon` teledirigido y `grappling_hook`).
- **4 Habilidades Activas (`Espacio` / `Click Derecho`):** `dash`, `energy_shield` (refleja balas frontales), `proximity_mine` y `smoke_grenade`.
- **Entorno Caótico:** Caja Dorada central (`80 HP`), Barriles Explosivos con reacción en cadena, Barriles de Aceite inflamables, Arbustos de sigilo, Trampolines con onda sísmica al aterrizar y Cajas Trampa (*Mimics*) que persiguen y explotan.
- **Último Aliento, Bounty y Tormenta:** Gateo de `4s` al caer a `0 HP` con posibilidad de revivir (`30 HP`) acertando un tiro, recompensa de líder (`2+` victorias seguidas) y anillo de tormenta a partir de los `35s`.
- **10 Mutadores por Ronda:** `normal`, `speed_boost`, `ricochet`, `vampire`, `double_damage`, `hot_potato`, `sniper_zero_g`, `tiny_shotgun`, `all_invisible` y `giant_bullets`.
