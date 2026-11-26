import type { EmoteType, PlayerInput } from "@shared/types";

export class InputManager {
  private keys = new Set<string>();
  private leftMouseDown = false;
  private rightMouseDown = false;
  private pointerX = 0;
  private pointerY = 0;
  private hasPointerMoved = false;
  private lastAngle = 0;
  private seq = 0;
  private targetEl: HTMLElement | null = null;

  private interactLatch = false;
  private abilityLatch = false;
  private pendingEmote: EmoteType | undefined;

  constructor(targetEl?: HTMLElement | null) {
    this.targetEl = targetEl ?? null;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("pointermove", this.handlePointerMove);
    if (this.targetEl) {
      this.targetEl.addEventListener("pointerdown", this.handlePointerDown);
      this.targetEl.addEventListener("contextmenu", this.handleContextMenu);
    }
    window.addEventListener("pointerup", this.handlePointerUp);
  }

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

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
      if (e.code === "Space") {
        this.abilityLatch = true;
      }
      if (e.code === "KeyE" || e.code === "KeyF") {
        this.interactLatch = true;
      }

      // Teclas 1, 2, 3, 4 para lanzar emotes animados
      if (e.code === "Digit1" || e.code === "Numpad1") {
        this.pendingEmote = "laugh";
      } else if (e.code === "Digit2" || e.code === "Numpad2") {
        this.pendingEmote = "skull";
      } else if (e.code === "Digit3" || e.code === "Numpad3") {
        this.pendingEmote = "gg";
      } else if (e.code === "Digit4" || e.code === "Numpad4") {
        this.pendingEmote = "chicken";
      }
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
    this.handlePointerMove(e);
    if (e.button === 0) {
      this.leftMouseDown = true;
    } else if (e.button === 2) {
      e.preventDefault();
      this.rightMouseDown = true;
      this.abilityLatch = true;
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (e.button === 0) {
      this.leftMouseDown = false;
    } else if (e.button === 2) {
      this.rightMouseDown = false;
    }
  };

  private handleBlur = (): void => {
    this.keys.clear();
    this.leftMouseDown = false;
    this.rightMouseDown = false;
  };

  public triggerEmote(emote: EmoteType): void {
    this.pendingEmote = emote;
  }

  public triggerAbility(): void {
    this.abilityLatch = true;
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

    const useAbility =
      this.abilityLatch || this.keys.has("Space") || this.rightMouseDown;
    this.abilityLatch = false;

    const emote = this.pendingEmote;
    this.pendingEmote = undefined;

    const input: PlayerInput = {
      up: this.keys.has("KeyW") || this.keys.has("ArrowUp"),
      down: this.keys.has("KeyS") || this.keys.has("ArrowDown"),
      left: this.keys.has("KeyA") || this.keys.has("ArrowLeft"),
      right: this.keys.has("KeyD") || this.keys.has("ArrowRight"),
      angle: this.lastAngle,
      shoot: this.leftMouseDown,
      interact,
      useAbility,
      seq: this.seq,
    };

    if (emote) {
      input.emote = emote;
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
      this.targetEl.removeEventListener("contextmenu", this.handleContextMenu);
    }
    window.removeEventListener("pointerup", this.handlePointerUp);
  }
}
