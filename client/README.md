# Bala Perdida - Especificación Técnica del Cliente (`/client`)

> **IMPORTANTE PARA EL AGENTE IA / DESARROLLADOR FRONTEND:**
> Antes de escribir cualquier línea de código, es **obligatorio** leer y respetar estrictamente los contratos compartidos definidos en [`../shared/types.ts`](../shared/types.ts). No modifiques `../shared/types.ts` sin coordinar con el backend (`feat/server`).

---

## 1. Descripción del Proyecto
**Bala Perdida** es un juego multijugador online en tiempo real de combate de tanques en laberintos 2D (inspirado en *Tank Trouble*), con física autoritativa en el servidor (rebotes de proyectiles, destrucción al primer impacto, laberintos procedurales por ronda).

El cliente se encarga exclusivamente de:
1. Interfaz de usuario (Home, Lobby de sala, HUD de partida y pantalla de fin de ronda/campeón).
2. Captura y envío continuo de inputs (`PlayerInput`) al servidor Colyseus.
3. Renderizado 2D a 60 FPS con **PixiJS v8** e interpolación suave de entidades (`players` y `bullets`).
4. Efectos visuales (partículas de explosión, chispas de rebote, trazas) y efectos de sonido con **Howler.js**.

---

## 2. Stack Tecnológico Obligatorio
- **Framework UI:** React 18+ con TypeScript
- **Bundler:** Vite (puerto por defecto `http://localhost:5173`)
- **Estilos:** Tailwind CSS
- **Motor Gráfico 2D:** PixiJS v8 (`pixi.js`)
- **Cliente Multijugador:** Colyseus.js (`colyseus.js` `^0.15.x`)
- **Audio:** Howler.js (`howler` + `@types/howler`)
- **Tipos Compartidos:** Alias `@shared/*` apuntando a `../shared/*` en `tsconfig.json` y `vite.config.ts`

---

## 3. Estructura de Carpetas Recomendada (`/client`)

```text
client/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── public/
│   └── assets/
│       ├── sfx/                 # Sonidos (shoot, bounce, explosion, round_win)
│       └── sprites/             # (Opcional) Texturas o gráficos vectoriales Pixi
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── network/
    │   └── ColyseusClient.ts    # Singleton/hook de conexión a ws://localhost:2567 y sala "tank_room"
    ├── game/
    │   ├── GameCanvas.tsx       # Contenedor React que monta y desmonta la aplicación PixiJS v8
    │   ├── PixiRenderer.ts      # Escena PixiJS: dibujo de MazeGrid, tanques, balas, partículas
    │   ├── Interpolation.ts     # Lerp de posiciones (x, y) y ángulos (shortest-angle lerp)
    │   ├── InputManager.ts      # Captura de WASD / Flechas + Espacio / Click y envío de PlayerInput
    │   └── SoundManager.ts      # Wrapper de Howler.js para efectos de sonido
    └── components/
        ├── HomeScreen.tsx       # Input de nombre, selector de color, "Crear Sala", "Unirse con Código"
        ├── LobbyScreen.tsx      # Código de sala (roomCode), lista de jugadores (2-4), botón "Listo" / "Iniciar"
        ├── GameHUD.tsx          # Marcador en vivo (scores, colores, estado vivo/muerto, código de sala)
        └── RoundEndOverlay.tsx  # Modal/overlay entre rondas mostrando ganador de la ronda o campeón (5 pts)
```

---

## 4. Conexión y Protocolo de Red (`ws://localhost:2567`)

### 4.1. Endpoint y Sala
- **Servidor WebSocket:** `import.meta.env.VITE_SERVER_URL || "ws://localhost:2567"`
- **Nombre de la sala Colyseus:** `"tank_room"`
- **Creación / Unión a sala:**
  - **Crear sala nueva:** `client.create("tank_room", { name, color, create: true })`
  - **Partida rápida (unirse o crear):** `client.joinOrCreate("tank_room", { name, color })`
  - **Unirse por código de 4 letras (`roomCode`):** `client.join("tank_room", { roomCode: code.toUpperCase(), name, color })`

### 4.2. Estado Sincronizado de la Sala (`TankRoomState`)
El servidor sincroniza vía `@colyseus/schema` una estructura compatible con `../shared/types.ts`:
- `status`: `"waiting" | "playing" | "round_end"` (`RoomStatus`)
- `roomCode`: `string` (código de 4 caracteres alfanuméricos en mayúscula, ej. `"A7K9"`)
- `mazeJson`: `string` (JSON serializado de `MazeGrid`; parsear con `JSON.parse(state.mazeJson) as MazeGrid` cada vez que cambie)
- `winnerId`: `string` (ID del último ganador o campeón de la partida, vacío si no aplica)
- `players`: `MapSchema<PlayerState>` indexado por `sessionId` (`id`, `name`, `x`, `y`, `angle`, `color`, `alive`, `score`, `ready`)
- `bullets`: `MapSchema<BulletState>` indexado por `bullet.id` (`id`, `ownerId`, `x`, `y`, `vx`, `vy`)

### 4.3. Mensajes Cliente -> Servidor (`room.send(type, payload)`)
1. **`"ready"`** (en `status === "waiting"`):
   - Payload: `{ ready?: boolean }` (si no se envía `ready`, el servidor alterna el estado actual).
2. **`"updateProfile"`** (en `status === "waiting"`):
   - Payload: `{ name?: string; color?: string }`
3. **`"startGame"`** (en `status === "waiting"`, cuando hay `>= 2` jugadores):
   - Payload: `{}`
4. **`"input"`** (en `status === "playing"`):
   - Payload estricto según `PlayerInput` de `../shared/types.ts`:
     ```ts
     {
       up: boolean;
       down: boolean;
       left: boolean;
       right: boolean;
       shoot: boolean;
       seq: number; // contador incremental por paquete enviado
     }
     ```

### 4.4. Eventos Servidor -> Cliente (`room.onMessage(type, callback)`)
Definidos en `../shared/types.ts`:
1. **`"bulletBounce"`** -> `BulletBounceEvent` (`{ x: number, y: number }`):
   - Disparar sonido de rebote y partículas de chispas en `(x, y)`.
2. **`"tankDestroyed"`** -> `TankDestroyedEvent` (`{ victimId: string, killerId: string, x: number, y: number }`):
   - Disparar animación de explosión en `(x, y)`, screen shake ligero y sonido de explosión.
3. **`"roundEnd"`** -> `RoundEndEvent` (`{ winnerId: string | null, scores: Record<string, number> }`):
   - Mostrar banner de ganador de la ronda (o empate si `winnerId === null`) durante los 3 segundos previos a la siguiente ronda.

---

## 5. Pantallas y Flujo de Usuario

1. **Home (`HomeScreen`):**
   - Campo para ingresar `name` (máx. 16 caracteres) y selector de `color` (paleta de colores vibrantes en hex, ej. `#EF4444`, `#3B82F6`, `#10B981`, `#F59E0B`, `#8B5CF6`, `#EC4899`).
   - Botón **Crear Sala**, botón **Partida Rápida** y campo + botón **Unirse con Código** (`roomCode` de 4 caracteres).
2. **Lobby (`LobbyScreen` - cuando `state.status === "waiting"`):**
   - Muestra el `roomCode` en grande con botón para copiar al portapapeles.
   - Lista de los jugadores conectados (máximo 4) con su color, nombre y estado `ready`.
   - Permite cambiar color/nombre (`"updateProfile"`), marcarse como listo (`"ready"`) o iniciar partida (`"startGame"` si hay al menos 2 jugadores).
3. **Partida & HUD (`GameHUD` + `GameCanvas` - cuando `state.status === "playing"` o `"round_end"`):**
   - **HUD Superior:** Tarjetas de cada jugador con su color, nombre, puntaje (`score` / 5) e indicador de vivo/destruido.
   - **Canvas Central (PixiJS v8):** Dimensiones del laberinto (`cols * cellSize` x `rows * cellSize`, por defecto `12 * 80 = 960px` de ancho por `8 * 80 = 640px` de alto).
   - **Overlay de Fin de Ronda (`RoundEndOverlay`):** Cuando `state.status === "round_end"`, muestra quién ganó el punto o quién alcanzó los 5 puntos para proclamarse campeón.

---

## 6. Controles, Renderizado e Interpolación

### 6.1. Controles (`InputManager`)
- **Avanzar (`up`):** `W` o `ArrowUp`
- **Retroceder (`down`):** `S` o `ArrowDown`
- **Girar izquierda (`left`):** `A` o `ArrowLeft`
- **Girar derecha (`right`):** `D` o `ArrowRight`
- **Disparar (`shoot`):** `Space` o `Click Izquierdo`
- Enviar el estado de input en cada tick de cliente (o a ~60 Hz mientras haya teclas activas / cambios de estado) incrementando `seq`.

### 6.2. Interpolación de Entidades (`Interpolation`)
- El servidor ejecuta la simulación física a 60 Hz y sincroniza cambios de estado a través de WebSockets.
- En el bucle `app.ticker` de PixiJS:
  - **Posición de tanques (`x`, `y`):** Interpolar suavemente con `lerp(current, target, 0.25)`.
  - **Rotación de tanques (`angle`):** Usar interpolación angular por el camino más corto (`shortestAngleLerp`) en radianes para evitar giros bruscos al cruzar entre `-π` y `+π`.
  - **Proyectiles (`bullets`):** Interpolar posición o extrapolar ligeramente usando `(vx, vy)` para movimiento ultra fluido.
  - **Geometría de referencia del servidor:**
    - Celda por defecto: `80 x 80 px` (`12` columnas x `8` filas = `960 x 640 px`).
    - Cuerpo del tanque: aprox. `34 x 24 px` (orientado hacia `angle = 0` a la derecha, cañón apuntando en dirección `cos(angle), sin(angle)`).
    - Radio de la bala: `4 px`.
