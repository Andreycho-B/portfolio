import { PROFILE } from "../../core/profile";
import type { StudioSceneHandle, StudioScreenZone } from "./studio.types";
import type { NokiaButtonId, NokiaMoveDir } from "./studio-nokia-keypad";

const SNAKE_SWIPE_MIN_PX = 24;

export const handleNokiaSnakeSwipe = (
  scene: StudioSceneHandle,
  clientX: number,
  clientY: number,
  anchor: { sx: number; sy: number },
  soundEnabled: boolean,
): boolean => {
  const dx = clientX - anchor.sx;
  const dy = clientY - anchor.sy;
  if (Math.hypot(dx, dy) < SNAKE_SWIPE_MIN_PX) return false;
  const dir: NokiaMoveDir =
    Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  if (!scene.steerNokiaSnake(dir, soundEnabled)) return false;
  anchor.sx = clientX;
  anchor.sy = clientY;
  return true;
};

export const classifyNokiaHoverZone = (
  scene: StudioSceneHandle,
  nx: number,
  ny: number,
): StudioScreenZone | null => {
  const btn = scene.pickNokiaButton(nx, ny);
  scene.setHoveredNokiaButton(btn);
  if (btn === null) return null;
  const inSnake = scene.getNokiaMode() === "snake";
  if (btn === "call") return inSnake ? "nokia_key" : "phone";
  if (btn === "snake") return inSnake ? "nokia_key" : "nokia_snake";
  if (btn === "back") return inSnake ? "nokia_back" : "email";
  return "nokia_key";
};

export const executeNokiaButtonClick = (
  scene: StudioSceneHandle,
  buttonId: NokiaButtonId,
  soundEnabled: boolean,
): void => {
  const outcome = scene.pressNokiaButton(buttonId, soundEnabled);
  if (outcome === "whatsapp") {
    window.open(PROFILE.whatsappUrl, "_blank", "noopener,noreferrer");
    return;
  }
  if (outcome === "copied" && typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard
      .writeText(PROFILE.phone)
      .catch((err: unknown) =>
        console.warn("[StudioNokiaInput] Phone clipboard copy failed:", err),
      );
  }
};
