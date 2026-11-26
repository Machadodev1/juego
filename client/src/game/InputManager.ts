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

  constructor(targetEl?: HTMLElement | null) {
    this.targetEl = targetEl ?? null;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("pointermove", this.handlePointerMove);
    if (this.targetEl) {
      this.targetEl.addEventListener("pointerdown", this.handlePointerDown);
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
    this.keys.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

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

    return {
      up: this.keys.has("KeyW") || this.keys.has("ArrowUp"),
      down: this.keys.has("KeyS") || this.keys.has("ArrowDown"),
      left: this.keys.has("KeyA") || this.keys.has("ArrowLeft"),
      right: this.keys.has("KeyD") || this.keys.has("ArrowRight"),
      angle: this.lastAngle,
      shoot: this.keys.has("Space") || this.mouseDown,
      interact: this.keys.has("KeyE") || this.keys.has("KeyF"),
      seq: this.seq,
    };
  }

  public destroy(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    window.removeEventListener("pointermove", this.handlePointerMove);
    if (this.targetEl) {
      this.targetEl.removeEventListener("pointerdown", this.handlePointerDown);
    }
    window.removeEventListener("pointerup", this.handlePointerUp);
  }
}
