import type { Camera, Mesh, Object3D } from "three";
import { playNokiaPiezoTone } from "./studio-nokia-audio";
import {
  bindNokiaScreenSurface,
  composeNokiaContactFrame,
  createNokiaLcdSurface,
  formatLocalHM,
} from "./studio-nokia-contact";
import { paintNokiaLcdCanvas } from "./studio-nokia-font";
import type { StudioNokiaHardwareHandle } from "./studio-nokia-hardware";
import { createStudioNokiaHint } from "./studio-nokia-hint";
import {
  createStudioNokiaHotspots,
  type NokiaActionResult,
  type NokiaScreenMode,
  type StudioNokiaPhoneHandle,
} from "./studio-nokia-hotspots";
import {
  type NokiaButtonId,
  type NokiaMoveDir,
  resolveSnakeInputDir,
  SNAKE_DIR_TO_BUTTON,
} from "./studio-nokia-keypad";
import { createNokiaSnakeEngine } from "./studio-nokia-snake";

export type {
  NokiaActionResult,
  NokiaScreenMode,
  NokiaScreenZone,
  StudioNokiaPhoneHandle,
  StudioSceneNokiaApi,
} from "./studio-nokia-hotspots";
export type { NokiaButtonId } from "./studio-nokia-keypad";

export const createStudioNokiaScreen = (onUpdate?: () => void): StudioNokiaPhoneHandle => {
  const hardwareModPromise = import("./studio-nokia-hardware");
  const { ctx, texture } = createNokiaLcdSurface();
  const snake = createNokiaSnakeEngine();
  const hotspots = createStudioNokiaHotspots();
  const hint = createStudioNokiaHint(onUpdate);
  let hardware: StudioNokiaHardwareHandle | null = null;
  let buttonMeshes: readonly Mesh[] = [];
  const st = {
    mode: "contact" as NokiaScreenMode,
    focused: false,
    disposed: false,
    notice: null as string | null,
    noticeTimer: null as number | null,
    minuteTimer: null as number | null,
  };
  const paintNow = (notify: boolean): void => {
    if (st.disposed || !ctx) return;
    const f =
      st.mode === "snake"
        ? snake.renderToBuffer()
        : composeNokiaContactFrame(formatLocalHM(new Date()), st.notice);
    paintNokiaLcdCanvas(ctx, f);
    texture.needsUpdate = true;
    if (notify) onUpdate?.();
  };
  const flashNotice = (label: string, ms = 1400): void => {
    st.notice = label;
    if (st.noticeTimer !== null) window.clearTimeout(st.noticeTimer);
    st.noticeTimer = window.setTimeout(() => {
      [st.noticeTimer, st.notice] = [null, null];
      paintNow(true);
    }, ms);
    paintNow(true);
  };
  const scheduleNextMinute = (): void => {
    if (st.disposed || st.minuteTimer !== null) return;
    st.minuteTimer = window.setTimeout(
      () => {
        st.minuteTimer = null;
        if (st.mode === "contact") paintNow(true);
        scheduleNextMinute();
      },
      60_000 - (Date.now() % 60_000) + 50,
    );
  };
  const attachModel = async (nokiaRoot: Object3D, parentGroup: Object3D): Promise<void> => {
    const hwMod = await hardwareModPromise;
    if (st.disposed) return;
    hardware = hwMod.createStudioNokiaHardware(nokiaRoot);
    buttonMeshes = [...hotspots.meshes, ...hardware.buttonMeshes];
    parentGroup.add(hardware.root, hotspots.root, hint.mesh);
    paintNow(false);
    bindNokiaScreenSurface(nokiaRoot, texture);
    scheduleNextMinute();
  };
  const enterSnake = (sound: boolean): void => {
    st.mode = "snake";
    snake.showStart();
    playNokiaPiezoTone("key", sound);
    paintNow(true);
  };
  const launchSnakeGame = (sound: boolean, initialDir?: NokiaMoveDir): void => {
    snake.startGame(initialDir);
    playNokiaPiezoTone("snake_start", sound);
    paintNow(true);
  };
  const pressButton = (id: NokiaButtonId, sound: boolean): NokiaActionResult => {
    hardware?.triggerPress(id);
    if (id === "call") {
      if (st.mode === "snake") {
        if (snake.getPhase() === "play") enterSnake(sound);
        else launchSnakeGame(sound);
        return "handled";
      }
      playNokiaPiezoTone("call", sound);
      flashNotice("LLAMANDO...");
      return "whatsapp";
    }
    if (id === "snake") {
      if (st.mode === "contact") enterSnake(sound);
      else if (snake.getPhase() !== "play") launchSnakeGame(sound);
      else {
        playNokiaPiezoTone("key", sound);
        snake.turnClockwise();
        paintNow(true);
      }
      return "handled";
    }
    if (id === "back") {
      if (st.mode === "snake") {
        st.mode = "contact";
        playNokiaPiezoTone("back", sound);
        paintNow(true);
        return "handled";
      }
      playNokiaPiezoTone("key", sound);
      flashNotice("COPIADO");
      return "copied";
    }
    const dir = resolveSnakeInputDir(id);
    if (st.mode === "snake" && dir) steerSnake(dir, sound);
    else playNokiaPiezoTone("key", sound);
    return "handled";
  };
  const steerSnake = (dir: NokiaMoveDir, sound: boolean): boolean => {
    if (st.mode !== "snake") return false;
    hardware?.triggerPress(SNAKE_DIR_TO_BUTTON[dir]);
    hint.flashDirection(dir);
    if (snake.getPhase() !== "play") {
      launchSnakeGame(sound, dir);
      return true;
    }
    playNokiaPiezoTone("key", sound);
    snake.steer(dir);
    paintNow(true);
    return true;
  };
  const handleKey = (key: string, sound: boolean): boolean => {
    if (st.mode !== "snake") {
      if (key !== "Enter" && key !== " " && key !== "s" && key !== "S") return false;
      pressButton("snake", sound);
      return true;
    }
    if (key === "Backspace" || key === "Enter" || key === " ") {
      pressButton(key === "Backspace" ? "back" : "call", sound);
      return true;
    }
    const dir = resolveSnakeInputDir(key);
    return dir ? steerSnake(dir, sound) : false;
  };
  const update = (dt: number, sound: boolean, camera: Camera, zoomProg: number): boolean => {
    const inSnake = st.mode === "snake";
    const h = hardware?.update(dt) ?? false;
    const s = hotspots.update(dt, camera, st.focused, zoomProg, inSnake);
    const t = hint.update(dt, camera, st.focused, zoomProg, inSnake);
    if (!inSnake || !st.focused) return h || s || t;
    const evt = snake.stepTime(dt);
    if (evt !== "none") {
      if (evt === "eat" || evt === "gameover") playNokiaPiezoTone(evt, sound);
      paintNow(false);
    }
    return true;
  };
  return {
    attachModel,
    getMode: () => st.mode,
    setFocused: (focused) => {
      st.focused = focused;
      if (!focused) hotspots.setHovered(null);
      if (focused && st.mode === "snake") paintNow(true);
    },
    setHoveredButton: hotspots.setHovered,
    getButtonMeshes: () => buttonMeshes,
    resolveButtonId: (o) => hotspots.resolveButtonId(o) ?? hardware?.resolveButtonId(o) ?? null,
    pressButton,
    steerSnake,
    handleKey,
    update,
    dispose: () => {
      st.disposed = true;
      for (const t of [st.minuteTimer, st.noticeTimer]) if (t !== null) window.clearTimeout(t);
      for (const r of [hotspots, hint, hardware, texture]) r?.dispose();
    },
  };
};
