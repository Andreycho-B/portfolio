import { Mesh, type Object3D } from "three";

const TWO_PI = Math.PI * 2;
// Measured clockwise rest angles (rad from 12 o'clock) baked into wall_clock_2k.gltf meshes.
const HOUR_REST_RAD_CW = -0.92811;
const MINUTE_REST_RAD_CW = 0.99487;
const SECOND_REST_RAD_CW = 2.97631;

interface LocalClockParts {
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

export interface StudioColombiaClockHandle {
  readonly attachModel: (clockRoot: Object3D) => void;
  readonly dispose: () => void;
}

const readLocalTime = (now: Date): LocalClockParts => ({
  hours: now.getHours() % 24,
  minutes: now.getMinutes(),
  seconds: now.getSeconds(),
});

const applyHandRotation = (hand: Object3D | null, restRadCW: number, targetRadCW: number): void => {
  if (!hand) return;
  hand.rotation.z = restRadCW - targetRadCW;
  hand.updateMatrix();
  hand.updateMatrixWorld(true);
};

export const createStudioColombiaClock = (onTick?: () => void): StudioColombiaClockHandle => {
  let hourHand: Object3D | null = null;
  let minuteHand: Object3D | null = null;
  let secondHand: Object3D | null = null;
  let tickTimer: number | null = null;
  let lastSecondKey = -1;
  let isDisposed = false;

  const syncHands = (notify: boolean): void => {
    if (isDisposed || (!hourHand && !minuteHand && !secondHand)) return;
    const now = new Date();
    const { hours, minutes, seconds } = readLocalTime(now);
    const key = hours * 3600 + minutes * 60 + seconds;
    if (key === lastSecondKey) return;
    lastSecondKey = key;

    const secFrac = seconds / 60;
    const minFrac = (minutes + secFrac) / 60;
    const hourFrac = ((hours % 12) + minutes / 60 + seconds / 3600) / 12;

    applyHandRotation(hourHand, HOUR_REST_RAD_CW, hourFrac * TWO_PI);
    applyHandRotation(minuteHand, MINUTE_REST_RAD_CW, minFrac * TWO_PI);
    applyHandRotation(secondHand, SECOND_REST_RAD_CW, secFrac * TWO_PI);

    if (notify) onTick?.();
  };

  const scheduleNextTick = (): void => {
    if (isDisposed || tickTimer !== null) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const delayMs = 1000 - (Date.now() % 1000) + 16;
    tickTimer = window.setTimeout(() => {
      tickTimer = null;
      syncHands(true);
      scheduleNextTick();
    }, delayMs);
  };

  const onVisibilityChange = (): void => {
    if (isDisposed) return;
    if (document.visibilityState === "hidden") {
      if (tickTimer !== null) {
        window.clearTimeout(tickTimer);
        tickTimer = null;
      }
      return;
    }
    syncHands(true);
    scheduleNextTick();
  };

  const attachModel = (clockRoot: Object3D): void => {
    if (isDisposed) return;
    clockRoot.traverse((node) => {
      if (node.name === "wall_clock_hours_hand") hourHand = node;
      else if (node.name === "wall_clock_minute_hand") minuteHand = node;
      else if (node.name === "wall_clock_second_hand") secondHand = node;
      else return;
      // Moving hands must not bake frozen shadows onto the dial when shadowMap.autoUpdate=false.
      if (node instanceof Mesh) node.castShadow = false;
    });
    syncHands(false);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    scheduleNextTick();
  };

  const dispose = (): void => {
    isDisposed = true;
    if (tickTimer !== null) {
      window.clearTimeout(tickTimer);
      tickTimer = null;
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    hourHand = minuteHand = secondHand = null;
  };

  return { attachModel, dispose };
};
