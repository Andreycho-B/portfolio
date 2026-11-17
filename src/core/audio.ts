import type {
  AmbientTextureHandle,
  AudioEngineContract,
  AudioMode,
  TactileFeedbackType,
} from "./audio.types";
import { synthesizeProjectArrival } from "./audio-arrival";
import {
  bindTeardownAndVisibility,
  cancelPendingSuspend,
  createMasterGainChain,
  gracefulMute,
} from "./audio-lifecycle";
import { startOrganicDrone } from "./audio-synthesis";
import {
  synthesizeIosSelectionClick,
  synthesizeJellyPop,
  triggerHapticDetent,
} from "./audio-tactile";
import { synthesizeWheelTick } from "./audio-wheel-tick";

const UNLOCK_EVENTS = ["pointerdown", "keydown", "wheel"] as const;

class ProceduralAudioEngine implements AudioEngineContract {
  private mode: AudioMode = "uninitialized";
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientHandle: AmbientTextureHandle | null = null;
  private unbindLifecycle: (() => void) | null = null;
  private lastTactileTime = 0;
  private userMuted = false;

  public getMode(): AudioMode {
    return this.mode;
  }
  public isMuted(): boolean {
    return this.mode === "muted" || this.userMuted;
  }

  private resumeContext(): void {
    if (this.audioContext?.state === "suspended") {
      void this.audioContext.resume().catch((err: unknown) => {
        console.warn("[AudioEngine] Resume failed:", err);
      });
    }
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
      const AudioCtxClass = typeof window !== "undefined" ? window.AudioContext : undefined;
      if (!AudioCtxClass) {
        this.mode = "muted";
        return false;
      }
      this.audioContext ??= new AudioCtxClass();
      this.masterGain ??= createMasterGainChain(this.audioContext);
      this.setupLifecycle();
      cancelPendingSuspend();

      if (this.audioContext.state === "suspended") await this.audioContext.resume();
      this.mode = "active";
      if (!this.ambientHandle) {
        this.ambientHandle = startOrganicDrone(this.audioContext, this.masterGain);
      }
      this.rampMasterTo(0.7, 0.25);
      return true;
    } catch (err) {
      if (!(err instanceof DOMException)) console.warn("[AudioEngine] Init deferred:", err);
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
          return;
        }
        this.resumeContext();
        this.rampMasterTo(0.7, 0.35);
      },
    );
  }

  private attachDeferredUnlock(): void {
    const unlock = async () => {
      for (const evt of UNLOCK_EVENTS) window.removeEventListener(evt, unlock);
      if (this.mode !== "pending_gesture" || this.userMuted || !this.audioContext) return;
      try {
        if (this.audioContext.state === "suspended") await this.audioContext.resume();
        if (this.audioContext.state === "running" && this.masterGain) {
          this.mode = "active";
          this.ambientHandle ??= startOrganicDrone(this.audioContext, this.masterGain);
          cancelPendingSuspend();
          this.rampMasterTo(0.7, 0.35);
        }
      } catch (err) {
        if (!(err instanceof DOMException)) console.warn("[AudioEngine] Unlock failed:", err);
      }
    };
    for (const evt of UNLOCK_EVENTS) {
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
    } catch (err) {
      console.warn("[AudioEngine] Failed to persist mute preference:", err);
    }

    if (!this.userMuted && !this.masterGain) {
      void this.initialize(true);
      return false;
    }
    if (!this.audioContext || !this.masterGain) return this.userMuted;
    if (this.userMuted) {
      this.rampMasterTo(0.0001, 0.04);
      this.mode = "muted";
    } else {
      this.resumeContext();
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
    if (!this.isMuted() && this.audioContext && this.masterGain) {
      synthesizeIosSelectionClick(this.audioContext, this.masterGain);
    }
  }

  public playProjectArrivalSound(): void {
    if (!this.isMuted() && this.audioContext && this.masterGain) {
      synthesizeProjectArrival(this.audioContext, this.masterGain);
    }
  }

  public playTactileFeedback(type: TactileFeedbackType, velocity = 0): void {
    const isTick = type === "wheel_tick" || type === "tick";
    if (this.isMuted() || !this.audioContext || !this.masterGain) return;
    const now = performance.now();
    if (now - this.lastTactileTime < (isTick ? 40 : 75)) return;
    this.lastTactileTime = now;
    triggerHapticDetent(isTick ? 5 : 8);
    if (isTick) synthesizeWheelTick(this.audioContext, this.masterGain, velocity);
    else if (type === "click") synthesizeIosSelectionClick(this.audioContext, this.masterGain);
    else if (type === "jelly_pop") synthesizeJellyPop(this.audioContext, this.masterGain);
  }

  public triggerProximityAura(intensity = 1.0): void {
    if (!this.isMuted() && this.audioContext && this.ambientHandle) {
      this.ambientHandle.triggerProximityAura(intensity);
    }
  }

  public stop(): void {
    this.ambientHandle?.stop();
    this.ambientHandle = null;
    this.unbindLifecycle?.();
    this.unbindLifecycle = null;
    gracefulMute(this.audioContext, this.masterGain, 0.04);
  }
}

let audioInstance: AudioEngineContract | null = null;
export const getAudioSystem = (): AudioEngineContract =>
  (audioInstance ??= new ProceduralAudioEngine());
