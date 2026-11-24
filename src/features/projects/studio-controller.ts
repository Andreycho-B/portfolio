import { getAudioSystem } from "../../core/audio";
import { getCursorController } from "../../design-system/components/cursor-controller";
import { notifyLiquidGlassLiveFrame } from "../../design-system/liquid-glass/liquid-glass-engine";
import { observeCanvasResize } from "./drum.types";
import { DrumAutoplayController } from "./drum-autoplay";
import { DrumScrollPhysics } from "./drum-scroll-physics";
import type { StudioSceneHandle } from "./studio.types";
import { createStudioEntryHint, type StudioEntryHintHandle } from "./studio-entry-hint";
import {
  clearStudioHoverState,
  createInitialStudioState,
  type StudioControllerState,
  stepStudioFrame,
  syncStudioDrumScene,
  syncStudioHoverState,
  toStudioSlotIndex,
} from "./studio-hover-sync";
import { bindStudioInputs } from "./studio-input-bindings";
import { StudioPowerController } from "./studio-power-state";
import type { StudioFocusTarget } from "./studio-prop-focus";
import { bindStudioSoundToggle, type StudioSoundToggleHandle } from "./studio-sound-toggle";
import { createStudioTvPortal, type StudioTvPortalHandle } from "./studio-tv-portal";

export class StudioController {
  private st: StudioControllerState = createInitialStudioState();
  private tickState = { prevPos: 0, lastDetentPos: 0 };
  private readonly physics = new DrumScrollPhysics();
  private readonly autoplay = new DrumAutoplayController({ onWake: () => this.requestFrame() });
  private readonly power = new StudioPowerController();
  private readonly audio = getAudioSystem();
  private readonly cursor = getCursorController();
  private readonly soundToggle: StudioSoundToggleHandle;
  private readonly entryHint: StudioEntryHintHandle;
  private readonly tvPortal: StudioTvPortalHandle;
  private readonly cleanups: readonly (() => void)[];
  private lifecycle: "paused" | "running" | "destroyed";

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly scene: StudioSceneHandle,
    deferStart = false,
  ) {
    this.lifecycle = deferStart ? "paused" : "running";
    const root = canvas.closest<HTMLElement>("[data-projects-section]") ?? document.body;
    const req = (): void => this.requestFrame();
    const clearHover = (): void => {
      this.st.zone = clearStudioHoverState(scene, this.cursor);
    };
    const refreshHud = (): void => this.refreshHud(true);
    this.soundToggle = bindStudioSoundToggle(root, this.audio, this.cursor, clearHover, refreshHud);
    this.entryHint = createStudioEntryHint(root);
    this.tvPortal = createStudioTvPortal({
      container: root,
      camera: scene.camera,
      audio: this.audio,
      cursor: this.cursor,
      isTvFocused: () => this.st.focus === "tv",
      captureSnapshot: (iframe) => scene.capturePortalSnapshot(iframe),
      onExitTvFocus: () => this.applyFocusTarget(null),
      onPortalChange: (syncRender) => this.onPortalChanged(syncRender),
      onPointerEnter: clearHover,
      onPointerMove: (nx, ny) => {
        [this.st.x, this.st.y] = [nx, ny];
        scene.setGlassPointer(nx, ny);
      },
    });
    this.syncViewport(deferStart);
    this.cleanups = [
      this.soundToggle.dispose,
      this.entryHint.dispose,
      observeCanvasResize(canvas, () => this.syncViewport(false)),
      bindStudioInputs({
        canvas,
        scene,
        physics: this.physics,
        autoplay: this.autoplay,
        power: this.power,
        audio: this.audio,
        cursor: this.cursor,
        getFocusTarget: () => this.st.focus,
        getActiveIndex: () => toStudioSlotIndex(this.physics.currentPosition),
        isTvPortalOpen: () => this.tvPortal.hasActivePage(),
        openInTv: (url) => {
          scene.setTvChannel("portfolio");
          this.tvPortal.open(url);
        },
        closeTvPortal: () => this.tvPortal.closeToDrum(),
        setFocusTarget: (t) => this.applyFocusTarget(t),
        setDragging: (d) => {
          this.st.dragging = d;
        },
        updatePointerHover: (nx, ny, clear) => this.handlePointerHover(nx, ny, clear),
        onPointerLeave: () => {
          clearHover();
          scene.setPointerNormalized(0, 0);
          scene.setGlassPointer(0, 0);
          req();
        },
        refreshHud,
        requestFrame: req,
      }),
    ];
    scene.setPowerState(this.power.powerProgress, this.power.buttonDepression);
    syncStudioDrumScene(scene, this.physics, this.audio, this.st.intro);
    if (!deferStart) req();
  }
  private refreshHud(reset = true): void {
    this.syncHover(reset);
    this.requestFrame();
  }
  private syncViewport(silent = false): void {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.scene.resize(w || innerWidth, h || innerHeight);
    if (this.tvPortal.isInteractive()) this.tvPortal.syncBounds(this.scene.camera);
    if (!silent) this.refreshHud(false);
  }
  private applyFocusTarget(t: StudioFocusTarget | null): void {
    if (t !== "tv" && this.tvPortal.hasActivePage()) this.tvPortal.suspend();
    const { scene, tvPortal } = this;
    const [prevFocus, st] = [this.st.focus, this.st];
    [st.focus, st.chairBreathPlayed] = [t, false];
    if (t !== null) this.entryHint.dismiss();
    if (t === "chair") this.audio.triggerChairBreath("preload");
    else if (prevFocus === "chair") this.audio.triggerChairBreath("stop");
    scene.setFocusTarget(t);
    if (t === "tv" && tvPortal.hasActivePage() && scene.isFocusSettled()) tvPortal.resume();
    this.refreshHud(true);
  }
  private onPortalChanged(syncRender = false): void {
    if (this.tvPortal.isInteractive()) {
      this.st.zone = clearStudioHoverState(this.scene, this.cursor);
      this.scene.setPointerNormalized(0, 0);
    } else this.syncHover(true);
    const v = this.tvPortal.stepVisuals(0, this.power.isPoweredOn);
    this.scene.setTvPortalState(v.mode, v.cutout, v.wave);
    if (syncRender) {
      this.scene.render();
      notifyLiquidGlassLiveFrame(this.canvas);
    }
    this.requestFrame();
  }
  private handlePointerHover(nx: number, ny: number, clear?: boolean): void {
    [this.st.x, this.st.y] = [nx, ny];
    if (this.lifecycle !== "running") return;
    const livePortal = this.tvPortal.isInteractive();
    if (livePortal) this.scene.setGlassPointer(nx, ny);
    else this.scene.setPointerNormalized(nx, ny);
    if (clear) this.st.zone = clearStudioHoverState(this.scene, this.cursor);
    else if (!this.st.dragging) this.syncHover();
    if (!livePortal) this.requestFrame();
  }
  private syncHover(reset = false): void {
    this.soundToggle.sync();
    if (this.lifecycle !== "running" || this.soundToggle.isHovered()) return;
    const { scene, cursor, power, audio, st, tvPortal, physics } = this;
    const [active, idx] = [tvPortal.hasActivePage(), toStudioSlotIndex(physics.currentPosition)];
    st.zone = syncStudioHoverState(scene, cursor, power, audio, st, active, idx, reset);
  }
  public playIntroSettling(offsetSlots = -1.2): void {
    if (this.lifecycle === "destroyed") return;
    this.lifecycle = "running";
    this.cursor.setInverted(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startPos = reduced ? 0 : offsetSlots;
    this.st.intro = reduced ? 1 : 0;
    this.physics.setInitialPosition(startPos);
    this.tickState = { prevPos: startPos, lastDetentPos: Math.round(startPos * 2) * 0.5 };
    this.scene.playIntroOrbit();
    if (reduced) this.entryHint.reveal();
    syncStudioDrumScene(this.scene, this.physics, this.audio, this.st.intro);
    this.requestFrame();
  }
  public requestFrame(): void {
    if (this.lifecycle !== "running" || this.st.raf !== null) return;
    this.st.lastTime = performance.now();
    this.st.raf = requestAnimationFrame(this.tick);
  }
  private readonly tick = (now: number): void => {
    const { st, tickState, scene, physics, autoplay, power, audio, tvPortal, entryHint } = this;
    const syncHover = (): void => this.syncHover();
    const alive = stepStudioFrame(
      { st, tickState, scene, physics, autoplay, power, audio, tvPortal, entryHint, syncHover },
      now,
    );
    notifyLiquidGlassLiveFrame(this.canvas);
    this.st.raf = alive ? requestAnimationFrame(this.tick) : null;
  };
  public destroy(): void {
    this.lifecycle = "destroyed";
    if (this.st.raf !== null) cancelAnimationFrame(this.st.raf);
    for (const fn of this.cleanups) fn();
    this.st.zone = clearStudioHoverState(this.scene, this.cursor);
    this.audio.triggerChairBreath("stop");
    this.cursor.setInverted(false);
    for (const p of [this.tvPortal, this.power, this.autoplay, this.physics, this.scene])
      p.dispose();
  }
}
