import type { PlayerInput } from "@shared/types";

export class InputManager {
  private keys = new Set<string>();
  private mouseDown = false;
  private pointerX = 0;
  private pointerY = 0;
  private hasPointerMoved = false;
  private lastAngle = 0;
  private seq = 0;
  private targetEl: HTMLElement | null = null;

  // Selector de armas: la tecla 1-3 o la rueda del ratón piden cambiar de ranura (un solo disparo)
  private pendingSlot: number | undefined;
  private inventoryLen = 1;
  private activeSlot = 0;

  // Botón de interacción: latch para que un toque rápido de E nunca se pierda entre frames
  private interactLatch = false;

  constructor(targetEl?: HTMLElement | null) {
    this.targetEl = targetEl ?? null;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("pointermove", this.handlePointerMove);
    if (this.targetEl) {
      this.targetEl.addEventListener("pointerdown", this.handlePointerDown);
      this.targetEl.addEventListener("wheel", this.handleWheel, { passive: true });
    }
    window.addEventListener("pointerup", this.handlePointerUp);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    if (
      e.code === "Space" ||
      e.code === "ArrowUp" ||
      e.code === "ArrowDown" ||
      e.code === "ArrowLeft" ||
      e.code === "ArrowRight"
    ) {
      e.preventDefault();
    }

    if (!e.repeat) {
      if (e.code === "Digit1" || e.code === "Numpad1") this.pendingSlot = 0;
      else if (e.code === "Digit2" || e.code === "Numpad2") this.pendingSlot = 1;
      else if (e.code === "Digit3" || e.code === "Numpad3") this.pendingSlot = 2;
      else if (e.code === "KeyQ") this.cycleSlot(-1);
      else if (e.code === "KeyR" || e.code === "Tab") {
        if (e.code === "Tab") e.preventDefault();
        this.cycleSlot(1);
      }

      if (e.code === "KeyE" || e.code === "KeyF") {
        this.interactLatch = true;
      }
    }

    this.keys.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private handleWheel = (e: WheelEvent): void => {
    if (e.deltaY === 0) return;
    this.cycleSlot(e.deltaY > 0 ? 1 : -1);
  };

  private cycleSlot(dir: number): void {
    if (this.inventoryLen <= 1) return;
    const base = this.pendingSlot ?? this.activeSlot;
    this.pendingSlot =
      (base + dir + this.inventoryLen) % this.inventoryLen;
  }

  private handlePointerMove = (e: PointerEvent): void => {
    if (this.targetEl) {
      const rect = this.targetEl.getBoundingClientRect();
      this.pointerX = e.clientX - rect.left;
      this.pointerY = e.clientY - rect.top;
    } else {
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
    }
    this.hasPointerMoved = true;
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (e.button === 0) {
      this.handlePointerMove(e);
      this.mouseDown = true;
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (e.button === 0) {
      this.mouseDown = false;
    }
  };

  private handleBlur = (): void => {
    this.keys.clear();
    this.mouseDown = false;
  };

  /** El lienzo informa cuántas ranuras tiene el jugador y cuál está activa. */
  public setInventoryContext(length: number, activeSlot: number): void {
    this.inventoryLen = Math.max(1, length);
    this.activeSlot = activeSlot;
  }

  public getPointerScreenPos(): { x: number; y: number; active: boolean } {
    return {
      x: this.pointerX,
      y: this.pointerY,
      active: this.hasPointerMoved,
    };
  }

  public pollInput(
    playerWorldX = 800,
    playerWorldY = 600,
    cameraOffsetX = 0,
    cameraOffsetY = 0,
    worldScale = 1
  ): PlayerInput {
    this.seq += 1;

    if (this.hasPointerMoved && worldScale > 0) {
      const worldMouseX = (this.pointerX - cameraOffsetX) / worldScale;
      const worldMouseY = (this.pointerY - cameraOffsetY) / worldScale;
      this.lastAngle = Math.atan2(
        worldMouseY - playerWorldY,
        worldMouseX - playerWorldX
      );
    }

    const interact =
      this.interactLatch || this.keys.has("KeyE") || this.keys.has("KeyF");
    this.interactLatch = false;

    const weaponSlot = this.pendingSlot;
    this.pendingSlot = undefined;

    const input: PlayerInput = {
      up: this.keys.has("KeyW") || this.keys.has("ArrowUp"),
      down: this.keys.has("KeyS") || this.keys.has("ArrowDown"),
      left: this.keys.has("KeyA") || this.keys.has("ArrowLeft"),
      right: this.keys.has("KeyD") || this.keys.has("ArrowRight"),
      angle: this.lastAngle,
      shoot: this.keys.has("Space") || this.mouseDown,
      interact,
      seq: this.seq,
    };
    if (weaponSlot !== undefined) {
      input.weaponSlot = weaponSlot;
    }
    return input;
  }

  public destroy(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    window.removeEventListener("pointermove", this.handlePointerMove);
    if (this.targetEl) {
      this.targetEl.removeEventListener("pointerdown", this.handlePointerDown);
      this.targetEl.removeEventListener("wheel", this.handleWheel);
    }
    window.removeEventListener("pointerup", this.handlePointerUp);
  }
}
