import type {
  AmbientTextureHandle,
  AudioEngineContract,
  AudioMode,
  TactileFeedbackType,
} from "./audio.types";
import { synthesizeProjectArrival } from "./audio-arrival";
import { bindTeardownAndVisibility, cancelPendingSuspend, gracefulMute } from "./audio-lifecycle";
import { startOrganicDrone } from "./audio-synthesis";
import {
  synthesizeIosSelectionClick,
  synthesizeIosWheelTick,
  synthesizeJellyPop,
  triggerHapticDetent,
} from "./audio-tactile";

export class ProceduralAudioEngine implements AudioEngineContract {
  private mode: AudioMode = "uninitialized";
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientHandle: AmbientTextureHandle | null = null;
  private unbindLifecycle: (() => void) | null = null;
  private isGraphSetup = false;
  private lastTactileTime = 0;
  private userMuted = false;

  constructor() {
    if (typeof window !== "undefined" && window.AudioContext) {
      try {
        this.audioContext = new window.AudioContext();
      } catch {}
    }
  }

  public getMode(): AudioMode {
    return this.mode;
  }
  public isMuted(): boolean {
    return this.mode === "muted" || this.userMuted;
  }

  public async initialize(enableSound: boolean): Promise<boolean> {
    if (!enableSound) {
      this.mode = "muted";
      this.userMuted = true;
      gracefulMute(this.audioContext, this.masterGain);
      return true;
    }
    this.userMuted = false;

    try {
      if (!this.audioContext) {
        const AudioCtxClass = window.AudioContext;
        if (!AudioCtxClass) {
          this.mode = "muted";
          return false;
        }
        this.audioContext = new AudioCtxClass();
      }

      this.ensureGraph();
      this.setupLifecycle();
      cancelPendingSuspend();

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume().catch(() => {});
      }

      if (this.audioContext.state === "suspended") {
        this.mode = "pending_gesture";
        this.attachDeferredUnlock();
        return false;
      }

      this.mode = "active";
      this.startAmbient();
      this.rampMasterTo(0.7, 0.25);
      return true;
    } catch {
      this.mode = "pending_gesture";
      this.attachDeferredUnlock();
      return false;
    }
  }

  private setupLifecycle(): void {
    if (this.unbindLifecycle) return;
    this.unbindLifecycle = bindTeardownAndVisibility(
      () => gracefulMute(this.audioContext, this.masterGain, 0.015),
      () => {
        if (this.isMuted() || !this.audioContext) return;
        if (document.hidden) {
          this.rampMasterTo(0.0001, 0.25);
        } else {
          if (this.audioContext.state === "suspended") void this.audioContext.resume();
          this.rampMasterTo(0.7, 0.35);
        }
      },
    );
  }

  private ensureGraph(): void {
    if (!this.audioContext || this.isGraphSetup) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const dcBlocker = ctx.createBiquadFilter();
    dcBlocker.type = "highpass";
    dcBlocker.frequency.setValueAtTime(30, now);
    dcBlocker.Q.setValueAtTime(Math.SQRT1_2, now);

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-2.5, now);
    limiter.knee.setValueAtTime(0, now);
    limiter.ratio.setValueAtTime(20, now);
    limiter.attack.setValueAtTime(0.0005, now);
    limiter.release.setValueAtTime(0.04, now);

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.7, now);

    this.masterGain.connect(dcBlocker);
    dcBlocker.connect(limiter);
    limiter.connect(ctx.destination);
    this.isGraphSetup = true;
  }

  private startAmbient(): void {
    if (!this.audioContext || !this.masterGain || this.ambientHandle) return;
    this.ambientHandle = startOrganicDrone(this.audioContext, this.masterGain);
  }

  private attachDeferredUnlock(): void {
    const unlock = async () => {
      for (const evt of ["pointerdown", "keydown", "wheel"] as const)
        window.removeEventListener(evt, unlock);
      if (this.mode === "pending_gesture" && !this.userMuted) {
        if (this.audioContext?.state === "suspended")
          await this.audioContext.resume().catch(() => {});
        if (this.audioContext?.state === "running") {
          this.mode = "active";
          this.startAmbient();
          cancelPendingSuspend();
          this.rampMasterTo(0.7, 0.35);
        }
      }
    };
    for (const evt of ["pointerdown", "keydown", "wheel"] as const) {
      window.addEventListener(evt, unlock, { once: true, passive: true });
    }
  }

  private rampMasterTo(target: number, durationSec: number): void {
    if (!this.audioContext || !this.masterGain) return;
    const now = this.audioContext.currentTime;
    const safeTarget = Math.max(0.0001, Math.min(1, target));
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(safeTarget, now + durationSec);
  }

  public toggleMute(): boolean {
    this.userMuted = !this.userMuted;
    try {
      localStorage.setItem("portfolio_sound_enabled", this.userMuted ? "false" : "true");
    } catch {}

    if (!this.userMuted && !this.masterGain) {
      void this.initialize(true);
      return false;
    }
    if (!this.audioContext || !this.masterGain) return this.userMuted;
    if (this.userMuted) {
      this.rampMasterTo(0.0001, 0.04);
      this.mode = "muted";
    } else {
      if (this.audioContext.state === "suspended") void this.audioContext.resume();
      this.rampMasterTo(0.7, 0.25);
      this.mode = "active";
    }
    return this.userMuted;
  }

  public setMasterVolume(level: number): void {
    this.rampMasterTo(Math.max(0, Math.min(1, level)), 0.08);
  }

  public playReleaseSound(): void {
    triggerHapticDetent(10);
    if (!this.isMuted() && this.audioContext && this.masterGain)
      synthesizeIosSelectionClick(this.audioContext, this.masterGain);
  }

  public playProjectArrivalSound(): void {
    if (!this.isMuted() && this.audioContext && this.masterGain)
      synthesizeProjectArrival(this.audioContext, this.masterGain);
  }

  public playTactileFeedback(type: TactileFeedbackType, velocity = 0): void {
    const isWheel = type === "wheel_tick";
    const isTick = isWheel || type === "tick";
    if (this.isMuted() || !this.audioContext || !this.masterGain) return;
    const now = performance.now();
    const throttleMs = isWheel ? 28 : isTick ? 40 : 75;
    if (now - this.lastTactileTime < throttleMs) return;
    this.lastTactileTime = now;
    triggerHapticDetent(isTick ? 5 : 8);
    if (isTick) synthesizeIosWheelTick(this.audioContext, this.masterGain, velocity);
    else if (type === "click") synthesizeIosSelectionClick(this.audioContext, this.masterGain);
    else if (type === "jelly_pop") synthesizeJellyPop(this.audioContext, this.masterGain);
  }

  public triggerProximityAura(intensity = 1.0): void {
    if (!this.isMuted() && this.audioContext && this.ambientHandle)
      this.ambientHandle.triggerProximityAura(intensity);
  }

  public stop(): void {
    if (this.ambientHandle) {
      this.ambientHandle.stop();
      this.ambientHandle = null;
    }
    this.unbindLifecycle?.();
    this.unbindLifecycle = null;
    gracefulMute(this.audioContext, this.masterGain, 0.04);
  }
}

let audioInstance: AudioEngineContract | null = null;
export const getAudioSystem = (): AudioEngineContract =>
  (audioInstance ??= new ProceduralAudioEngine());
