import type { PlayerInput } from "@shared/types";

export class InputManager {
  private keys = new Set<string>();
  private mouseDown = false;
  private seq = 0;
  private targetEl: HTMLElement | null = null;

  constructor(targetEl?: HTMLElement | null) {
    this.targetEl = targetEl ?? null;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
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

  private handlePointerDown = (e: PointerEvent): void => {
    if (e.button === 0) {
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

  public pollInput(): PlayerInput {
    this.seq += 1;
    return {
      up: this.keys.has("KeyW") || this.keys.has("ArrowUp"),
      down: this.keys.has("KeyS") || this.keys.has("ArrowDown"),
      left: this.keys.has("KeyA") || this.keys.has("ArrowLeft"),
      right: this.keys.has("KeyD") || this.keys.has("ArrowRight"),
      shoot: this.keys.has("Space") || this.mouseDown,
      seq: this.seq,
    };
  }

  public destroy(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    if (this.targetEl) {
      this.targetEl.removeEventListener("pointerdown", this.handlePointerDown);
    }
    window.removeEventListener("pointerup", this.handlePointerUp);
  }
}
