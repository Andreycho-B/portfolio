import type {
  AmbientTextureHandle,
  AudioEngineContract,
  AudioMode,
  ChairBreathAction,
  TactileFeedbackType,
} from "./audio.types";
import { synthesizeProjectArrival } from "./audio-arrival";
import { type BeachAmbientHandle, startBeachAmbient } from "./audio-beach-ambient";
import { dispatchChairBreath } from "./audio-chair-breath";
import {
  bindTeardownAndVisibility,
  cancelPendingSuspend,
  createMasterGainChain,
  gracefulMute,
  persistMutePreference,
  rampGainTo,
  tryResumeAudioContext,
} from "./audio-lifecycle";
import { startOrganicDrone } from "./audio-synthesis";
import {
  dispatchTactileSynthesis,
  synthesizeIosSelectionClick,
  triggerHapticDetent,
} from "./audio-tactile";
import { synthesizeWheelTick } from "./audio-wheel-tick";
import { getStudioTvBridge } from "./tv-portal-bridge";

const UNLOCK_EVENTS = ["pointerdown", "keydown", "wheel"] as const;
const MASTER_TARGET = 0.7;

class ProceduralAudioEngine implements AudioEngineContract {
  private mode: AudioMode = "uninitialized";
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientHandle: AmbientTextureHandle | null = null;
  private beachHandle: BeachAmbientHandle | null = null;
  private unbindLifecycle: (() => void) | null = null;
  private unlockPending = false;
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
  private activatePlayback(fadeSec = 0.25): void {
    if (this.userMuted || !this.audioContext || !this.masterGain) return;
    cancelPendingSuspend();
    this.mode = "active";
    this.ambientHandle ??= startOrganicDrone(this.audioContext, this.masterGain);
    this.beachHandle ??= startBeachAmbient(this.audioContext, this.masterGain);
    rampGainTo(this.audioContext, this.masterGain, MASTER_TARGET, fadeSec);
  }
  public async initialize(enableSound: boolean): Promise<boolean> {
    if (!enableSound) {
      this.mode = "muted";
      this.userMuted = true;
      gracefulMute(this.audioContext, this.masterGain);
      return true;
    }
    this.userMuted = false;
    const AudioCtxClass = typeof window !== "undefined" ? window.AudioContext : undefined;
    if (!AudioCtxClass) {
      this.mode = "muted";
      return false;
    }
    if (this.mode === "muted" || this.mode === "uninitialized") this.mode = "pending_gesture";
    try {
      this.audioContext ??= new AudioCtxClass();
      this.masterGain ??= createMasterGainChain(this.audioContext);
      this.setupLifecycle();
      cancelPendingSuspend();
      const running = await tryResumeAudioContext(this.audioContext);
      if (this.userMuted) return true;
      if (running) {
        this.activatePlayback(0.25);
        return true;
      }
      this.mode = "pending_gesture";
      this.attachDeferredUnlock();
      return false;
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
      () => gracefulMute(this.audioContext, this.masterGain, 0.02),
      () => {
        if (this.isMuted() || !this.audioContext) return;
        if (document.hidden) {
          gracefulMute(this.audioContext, this.masterGain, 0.2);
          return;
        }
        cancelPendingSuspend();
        this.resumeContext();
        rampGainTo(this.audioContext, this.masterGain, MASTER_TARGET, 0.35);
      },
    );
  }
  private attachDeferredUnlock(): void {
    if (this.unlockPending) return;
    this.unlockPending = true;
    const unlock = async () => {
      this.unlockPending = false;
      for (const evt of UNLOCK_EVENTS) window.removeEventListener(evt, unlock);
      if (this.mode !== "pending_gesture" || this.userMuted || !this.audioContext) return;
      try {
        if (this.audioContext.state === "suspended") await this.audioContext.resume();
        if (!this.userMuted && this.audioContext.state === "running") this.activatePlayback(0.35);
      } catch (err) {
        if (!(err instanceof DOMException)) console.warn("[AudioEngine] Unlock failed:", err);
      }
    };
    for (const evt of UNLOCK_EVENTS) {
      window.addEventListener(evt, unlock, { once: true, passive: true });
    }
  }
  public toggleMute(): boolean {
    this.userMuted = !this.userMuted;
    persistMutePreference(this.userMuted);
    if (!this.userMuted && !this.masterGain) {
      void this.initialize(true);
      return false;
    }
    if (!this.audioContext || !this.masterGain) return this.userMuted;
    if (this.userMuted) {
      this.mode = "muted";
      gracefulMute(this.audioContext, this.masterGain, 0.055);
    } else {
      cancelPendingSuspend();
      this.resumeContext();
      this.activatePlayback(0.22);
    }
    return this.userMuted;
  }
  public setMasterVolume(level: number): void {
    rampGainTo(this.audioContext, this.masterGain, Math.max(0, Math.min(1, level)), 0.08);
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
    else dispatchTactileSynthesis(this.audioContext, this.masterGain, type);
  }
  public triggerProximityAura(intensity = 1.0): void {
    if (!this.isMuted() && this.audioContext && this.ambientHandle) {
      this.ambientHandle.triggerProximityAura(intensity);
    }
  }
  public triggerChairBreath(action: ChairBreathAction): void {
    dispatchChairBreath(action, this.audioContext, this.masterGain, this.isMuted());
  }
  public stop(): void {
    dispatchChairBreath("stop", this.audioContext, null, true);
    for (const h of [this.ambientHandle, this.beachHandle]) h?.stop();
    this.ambientHandle = this.beachHandle = null;
    this.unbindLifecycle?.();
    this.unbindLifecycle = null;
    gracefulMute(this.audioContext, this.masterGain, 0.04);
  }
}

let audioInstance: AudioEngineContract | null = null;
export const getAudioSystem = (): AudioEngineContract => {
  const shared = getStudioTvBridge()?.audio;
  if (shared) return shared;
  if (!audioInstance) audioInstance = new ProceduralAudioEngine();
  return audioInstance;
};
