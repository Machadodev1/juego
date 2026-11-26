import Matter from "matter-js";
import {
  BulletBounceEvent,
  BulletState,
  MazeGrid,
  PlayerInput,
  TankDestroyedEvent,
} from "@shared/types";

export interface PhysicsCallbacks {
  onBulletBounce?: (event: BulletBounceEvent) => void;
  onTankDestroyed?: (event: TankDestroyedEvent) => void;
  onBulletRemoved?: (bulletId: string) => void;
}

interface InternalBullet {
  id: string;
  ownerId: string;
  body: Matter.Body;
  createdAt: number;
  speed: number;
}

interface InternalTank {
  id: string;
  body: Matter.Body;
  alive: boolean;
  lastShootTime: number;
  lastShootInput: boolean;
}

const CATEGORY_WALL = 0x0001;
const CATEGORY_TANK = 0x0002;
const CATEGORY_BULLET = 0x0004;

export class PhysicsEngine {
  public static readonly TANK_WIDTH = 34;
  public static readonly TANK_HEIGHT = 24;
  public static readonly TANK_FORWARD_SPEED = 3.2;
  public static readonly TANK_BACKWARD_SPEED = 2.2;
  public static readonly TANK_TURN_SPEED = 0.065; // radianes por tick (60Hz)
  public static readonly WALL_THICKNESS = 6;

  public static readonly BULLET_RADIUS = 4;
  public static readonly BULLET_SPEED = 5.5;
  public static readonly BULLET_TTL_MS = 8000;
  public static readonly MAX_BULLETS_PER_TANK = 5;
  public static readonly SELF_HIT_GRACE_MS = 150;
  public static readonly SHOOT_COOLDOWN_MS = 180;

  private engine: Matter.Engine;
  private world: Matter.World;
  private callbacks: PhysicsCallbacks;

  private wallBodies: Matter.Body[] = [];
  private tanks: Map<string, InternalTank> = new Map();
  private bullets: Map<string, InternalBullet> = new Map();
  private bulletsToDestroy: Set<string> = new Set();
  private tanksToDestroy: Array<{
    victimId: string;
    killerId: string;
    x: number;
    y: number;
  }> = [];
  private bulletsToNormalize: Set<string> = new Set();
  private bulletCounter: number = 0;

  constructor(callbacks: PhysicsCallbacks = {}) {
    this.callbacks = callbacks;
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
    });
    this.world = this.engine.world;

    this.registerCollisionEvents();
  }

  /**
   * Construye los cuerpos estáticos para los muros del laberinto evitando duplicar
   * muros compartidos entre celdas contiguas.
   */
  public buildMazeWalls(maze: MazeGrid): void {
    this.clearWalls();

    const { rows, cols, cellSize, cells } = maze;
    const thickness = PhysicsEngine.WALL_THICKNESS;

    const wallOptions: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      restitution: 1,
      friction: 0,
      frictionStatic: 0,
      frictionAir: 0,
      inertia: Infinity,
      label: "wall",
      collisionFilter: {
        category: CATEGORY_WALL,
        mask: CATEGORY_TANK | CATEGORY_BULLET,
      },
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cells[r][c];
        const x0 = c * cellSize;
        const y0 = r * cellSize;

        // Muro superior (solo fila 0 para no duplicar con bottom de la fila anterior)
        if (r === 0 && cell.walls.top) {
          const topWall = Matter.Bodies.rectangle(
            x0 + cellSize / 2,
            y0,
            cellSize + thickness,
            thickness,
            wallOptions
          );
          this.wallBodies.push(topWall);
        }

        // Muro izquierdo (solo columna 0 para no duplicar con right de la columna anterior)
        if (c === 0 && cell.walls.left) {
          const leftWall = Matter.Bodies.rectangle(
            x0,
            y0 + cellSize / 2,
            thickness,
            cellSize + thickness,
            wallOptions
          );
          this.wallBodies.push(leftWall);
        }

        // Muro derecho (todas las celdas)
        if (cell.walls.right) {
          const rightWall = Matter.Bodies.rectangle(
            x0 + cellSize,
            y0 + cellSize / 2,
            thickness,
            cellSize + thickness,
            wallOptions
          );
          this.wallBodies.push(rightWall);
        }

        // Muro inferior (todas las celdas)
        if (cell.walls.bottom) {
          const bottomWall = Matter.Bodies.rectangle(
            x0 + cellSize / 2,
            y0 + cellSize,
            cellSize + thickness,
            thickness,
            wallOptions
          );
          this.wallBodies.push(bottomWall);
        }
      }
    }

    Matter.Composite.add(this.world, this.wallBodies);
  }

  /**
   * Crea o reposiciona el cuerpo físico de un tanque.
   */
  public spawnTank(id: string, x: number, y: number, angle: number): void {
    this.removeTank(id);

    const body = Matter.Bodies.rectangle(
      x,
      y,
      PhysicsEngine.TANK_WIDTH,
      PhysicsEngine.TANK_HEIGHT,
      {
        label: `tank:${id}`,
        restitution: 0, // Sin rebotar en muros: deslizamiento limpio
        friction: 0,
        frictionStatic: 0,
        frictionAir: 0,
        inertia: Infinity, // Rotación controlada exclusivamente por input angular
        chamfer: { radius: 4 },
        collisionFilter: {
          category: CATEGORY_TANK,
          mask: CATEGORY_WALL | CATEGORY_TANK | CATEGORY_BULLET,
        },
      }
    );

    Matter.Body.setAngle(body, angle);
    Matter.Composite.add(this.world, body);

    this.tanks.set(id, {
      id,
      body,
      alive: true,
      lastShootTime: 0,
      lastShootInput: false,
    });
  }

  public removeTank(id: string): void {
    const existing = this.tanks.get(id);
    if (existing) {
      Matter.Composite.remove(this.world, existing.body);
      this.tanks.delete(id);
    }
  }

  public setTankAlive(id: string, alive: boolean): void {
    const tank = this.tanks.get(id);
    if (!tank) return;
    tank.alive = alive;
    if (!alive) {
      Matter.Composite.remove(this.world, tank.body);
    }
  }

  /**
   * Procesa el PlayerInput de un tanque para el frame actual:
   * rotación angular, velocidad lineal y disparo.
   */
  public applyPlayerInput(playerId: string, input: PlayerInput, now: number = Date.now()): BulletState | null {
    const tank = this.tanks.get(playerId);
    if (!tank || !tank.alive) {
      return null;
    }

    const { body } = tank;

    // 1. Rotación angular controlada
    let nextAngle = body.angle;
    if (input.left && !input.right) {
      nextAngle -= PhysicsEngine.TANK_TURN_SPEED;
    } else if (input.right && !input.left) {
      nextAngle += PhysicsEngine.TANK_TURN_SPEED;
    }

    // Normalizar ángulo en [-PI, PI]
    nextAngle = Math.atan2(Math.sin(nextAngle), Math.cos(nextAngle));
    Matter.Body.setAngle(body, nextAngle);
    Matter.Body.setAngularVelocity(body, 0);

    // 2. Movimiento lineal (avance / retroceso)
    let linearSpeed = 0;
    if (input.up && !input.down) {
      linearSpeed = PhysicsEngine.TANK_FORWARD_SPEED;
    } else if (input.down && !input.up) {
      linearSpeed = -PhysicsEngine.TANK_BACKWARD_SPEED;
    }

    const vx = Math.cos(nextAngle) * linearSpeed;
    const vy = Math.sin(nextAngle) * linearSpeed;
    Matter.Body.setVelocity(body, { x: vx, y: vy });

    // 3. Disparo (detectar flanco de subida o disparo con cooldown respetando máx 5 balas activas)
    let spawnedBullet: BulletState | null = null;
    const triggerPull = input.shoot && !tank.lastShootInput;
    const cooldownReady = now - tank.lastShootTime >= PhysicsEngine.SHOOT_COOLDOWN_MS;

    if (triggerPull && cooldownReady) {
      spawnedBullet = this.trySpawnBullet(tank, now);
    }
    tank.lastShootInput = input.shoot;

    return spawnedBullet;
  }

  /**
   * Intenta disparar una bala desde la punta del cañón del tanque.
   */
  public trySpawnBullet(tank: InternalTank, now: number = Date.now()): BulletState | null {
    const activeByOwner = this.countBulletsForOwner(tank.id);
    if (activeByOwner >= PhysicsEngine.MAX_BULLETS_PER_TANK) {
      return null;
    }

    tank.lastShootTime = now;

    const angle = tank.body.angle;
    const muzzleOffset = PhysicsEngine.TANK_WIDTH / 2 + PhysicsEngine.BULLET_RADIUS + 2;
    const spawnX = tank.body.position.x + Math.cos(angle) * muzzleOffset;
    const spawnY = tank.body.position.y + Math.sin(angle) * muzzleOffset;
    const vx = Math.cos(angle) * PhysicsEngine.BULLET_SPEED;
    const vy = Math.sin(angle) * PhysicsEngine.BULLET_SPEED;

    const bulletId = `b_${++this.bulletCounter}_${now}`;
    const body = Matter.Bodies.circle(
      spawnX,
      spawnY,
      PhysicsEngine.BULLET_RADIUS,
      {
        label: `bullet:${bulletId}`,
        restitution: 1,
        friction: 0,
        frictionStatic: 0,
        frictionAir: 0,
        inertia: Infinity,
        slop: 0,
        collisionFilter: {
          category: CATEGORY_BULLET,
          mask: CATEGORY_WALL | CATEGORY_TANK, // Las balas no colisionan entre sí
        },
      }
    );

    Matter.Body.setVelocity(body, { x: vx, y: vy });
    Matter.Composite.add(this.world, body);

    this.bullets.set(bulletId, {
      id: bulletId,
      ownerId: tank.id,
      body,
      createdAt: now,
      speed: PhysicsEngine.BULLET_SPEED,
    });

    return {
      id: bulletId,
      ownerId: tank.id,
      x: spawnX,
      y: spawnY,
      vx,
      vy,
    };
  }

  public countBulletsForOwner(ownerId: string): number {
    let count = 0;
    for (const bullet of this.bullets.values()) {
      if (bullet.ownerId === ownerId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Avanza la simulación física un paso (`deltaMs`, por defecto 16.666 ms a 60 Hz),
   * procesa expiraciones TTL de 8s, normaliza velocidades de balas y ejecuta bajas.
   */
  public update(deltaMs: number = 1000 / 60, now: number = Date.now()): void {
    Matter.Engine.update(this.engine, deltaMs);

    // 1. Procesar destrucciones de tanques detectadas durante las colisiones
    if (this.tanksToDestroy.length > 0) {
      const pendingKills = [...this.tanksToDestroy];
      this.tanksToDestroy = [];

      for (const kill of pendingKills) {
        const tank = this.tanks.get(kill.victimId);
        if (tank && tank.alive) {
          this.setTankAlive(kill.victimId, false);
          this.callbacks.onTankDestroyed?.({
            victimId: kill.victimId,
            killerId: kill.killerId,
            x: kill.x,
            y: kill.y,
          });
        }
      }
    }

    // 2. Verificar TTL (8 segundos) de las balas activas
    for (const [bulletId, bullet] of this.bullets.entries()) {
      if (now - bullet.createdAt >= PhysicsEngine.BULLET_TTL_MS) {
        this.bulletsToDestroy.add(bulletId);
      }
    }

    // 3. Eliminar balas destruidas o expiradas
    if (this.bulletsToDestroy.size > 0) {
      for (const bulletId of this.bulletsToDestroy) {
        this.removeBullet(bulletId);
      }
      this.bulletsToDestroy.clear();
    }

    // 4. Normalizar siempre la velocidad de todas las balas activas para que
    // mantengan rapidez constante tras cualquier rebote elástico en muros
    for (const bullet of this.bullets.values()) {
      this.normalizeBulletVelocity(bullet);
    }
    this.bulletsToNormalize.clear();

    // 5. Asegurar que los tanques no acumulen rotación residual por colisión con muros
    for (const tank of this.tanks.values()) {
      if (tank.alive) {
        Matter.Body.setAngularVelocity(tank.body, 0);
      }
    }
  }

  private normalizeBulletVelocity(bullet: InternalBullet): void {
    const vel = bullet.body.velocity;
    const currentSpeed = Math.hypot(vel.x, vel.y);

    if (currentSpeed < 0.0001) {
      // Caso degenerado: reasignar dirección aleatoria manteniendo velocidad constante
      const randomAngle = Math.random() * Math.PI * 2;
      Matter.Body.setVelocity(bullet.body, {
        x: Math.cos(randomAngle) * bullet.speed,
        y: Math.sin(randomAngle) * bullet.speed,
      });
      return;
    }

    if (Math.abs(currentSpeed - bullet.speed) > 0.001) {
      const scale = bullet.speed / currentSpeed;
      Matter.Body.setVelocity(bullet.body, {
        x: vel.x * scale,
        y: vel.y * scale,
      });
    }
  }

  public removeBullet(bulletId: string): void {
    const bullet = this.bullets.get(bulletId);
    if (!bullet) return;

    Matter.Composite.remove(this.world, bullet.body);
    this.bullets.delete(bulletId);
    this.callbacks.onBulletRemoved?.(bulletId);
  }

  public clearBullets(): void {
    for (const bulletId of Array.from(this.bullets.keys())) {
      this.removeBullet(bulletId);
    }
    this.bulletsToDestroy.clear();
    this.bulletsToNormalize.clear();
  }

  public clearWalls(): void {
    if (this.wallBodies.length > 0) {
      Matter.Composite.remove(this.world, this.wallBodies);
      this.wallBodies = [];
    }
  }

  public resetRound(): void {
    this.clearBullets();
    for (const tank of this.tanks.values()) {
      Matter.Composite.remove(this.world, tank.body);
    }
    this.tanks.clear();
    this.tanksToDestroy = [];
  }

  public getTankTransform(id: string): { x: number; y: number; angle: number; alive: boolean } | null {
    const tank = this.tanks.get(id);
    if (!tank) return null;
    return {
      x: tank.body.position.x,
      y: tank.body.position.y,
      angle: tank.body.angle,
      alive: tank.alive,
    };
  }

  public getActiveBullets(): BulletState[] {
    const list: BulletState[] = [];
    for (const bullet of this.bullets.values()) {
      list.push({
        id: bullet.id,
        ownerId: bullet.ownerId,
        x: bullet.body.position.x,
        y: bullet.body.position.y,
        vx: bullet.body.velocity.x,
        vy: bullet.body.velocity.y,
      });
    }
    return list;
  }

  private registerCollisionEvents(): void {
    // Usamos beforeUpdate / collisionStart / collisionEnd para gestionar impactos
    Matter.Events.on(this.engine, "collisionStart", (event) => {
      const now = Date.now();

      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;
        const bulletBody = this.extractBodyByPrefix(bodyA, bodyB, "bullet:");
        if (!bulletBody) continue;

        const otherBody = bulletBody === bodyA ? bodyB : bodyA;
        const bulletId = bulletBody.label.slice("bullet:".length);
        const bullet = this.bullets.get(bulletId);
        if (!bullet) continue;

        if (otherBody.label === "wall") {
          // Rebote elástico en muro: normalizar velocidad y notificar evento bulletBounce
          this.bulletsToNormalize.add(bulletId);
          this.callbacks.onBulletBounce?.({
            x: bulletBody.position.x,
            y: bulletBody.position.y,
          });
        } else if (otherBody.label.startsWith("tank:")) {
          const victimId = otherBody.label.slice("tank:".length);
          const victimTank = this.tanks.get(victimId);
          if (!victimTank || !victimTank.alive) continue;

          // Ignorar el propio tanque durante los primeros 150 ms tras disparar
          const elapsedMs = now - bullet.createdAt;
          if (victimId === bullet.ownerId && elapsedMs < PhysicsEngine.SELF_HIT_GRACE_MS) {
            continue;
          }

          // Destruir bala y marcar tanque como destruido
          this.bulletsToDestroy.add(bulletId);
          this.tanksToDestroy.push({
            victimId,
            killerId: bullet.ownerId,
            x: victimTank.body.position.x,
            y: victimTank.body.position.y,
          });
        }
      }
    });

    Matter.Events.on(this.engine, "collisionEnd", (event) => {
      for (const pair of event.pairs) {
        const bulletBody = this.extractBodyByPrefix(pair.bodyA, pair.bodyB, "bullet:");
        if (!bulletBody) continue;
        const bulletId = bulletBody.label.slice("bullet:".length);
        const bullet = this.bullets.get(bulletId);
        if (bullet) {
          this.normalizeBulletVelocity(bullet);
        }
      }
    });
  }

  private extractBodyByPrefix(
    bodyA: Matter.Body,
    bodyB: Matter.Body,
    prefix: string
  ): Matter.Body | null {
    if (bodyA.label.startsWith(prefix)) return bodyA;
    if (bodyB.label.startsWith(prefix)) return bodyB;
    return null;
  }
}
