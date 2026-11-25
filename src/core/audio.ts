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

const UNLOCK_EVENTS = ["pointerdown", "keydown"] as const;
const MASTER_TARGET = 0.7;
const hasUserGesture = (): boolean =>
  typeof navigator === "undefined" ||
  !("userActivation" in navigator) ||
  navigator.userActivation.hasBeenActive;

class ProceduralAudioEngine implements AudioEngineContract {
  private mode: AudioMode = "uninitialized";
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientHandle: AmbientTextureHandle | null = null;
  private beachHandle: BeachAmbientHandle | null = null;
  private unbindLifecycle: (() => void) | null = null;
  private unlockPending = false;
  private lastTickTime = 0;
  private lastActionTime = 0;
  private lastActionType: TactileFeedbackType | null = null;
  private userMuted = false;

  public getMode = (): AudioMode => this.mode;
  public isMuted = (): boolean => this.mode === "muted" || this.userMuted;
  private resumeContext(): void {
    if (this.audioContext?.state === "suspended" && hasUserGesture()) {
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
  private deferUntilGesture(): false {
    this.mode = "pending_gesture";
    this.attachDeferredUnlock();
    return false;
  }
  public async initialize(enableSound: boolean): Promise<boolean> {
    if (!enableSound) {
      [this.mode, this.userMuted] = ["muted", true];
      gracefulMute(this.audioContext, this.masterGain);
      return true;
    }
    this.userMuted = false;
    const AudioCtxClass = typeof window !== "undefined" ? window.AudioContext : undefined;
    if (!AudioCtxClass) {
      this.mode = "muted";
      return false;
    }
    if (!this.audioContext && !hasUserGesture()) return this.deferUntilGesture();
    if (this.mode === "muted" || this.mode === "uninitialized") this.mode = "pending_gesture";
    try {
      this.audioContext ??= new AudioCtxClass();
      this.masterGain ??= createMasterGainChain(this.audioContext);
      this.setupLifecycle();
      cancelPendingSuspend();
      const running = await tryResumeAudioContext(this.audioContext);
      if (this.userMuted) return true;
      if (!running) return this.deferUntilGesture();
      this.activatePlayback(0.25);
      return true;
    } catch (err) {
      if (!(err instanceof DOMException)) console.warn("[AudioEngine] Init deferred:", err);
      return this.deferUntilGesture();
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
    const unlock = () => {
      this.unlockPending = false;
      for (const evt of UNLOCK_EVENTS) window.removeEventListener(evt, unlock);
      if (this.mode === "pending_gesture" && !this.userMuted) void this.initialize(true);
    };
    for (const evt of UNLOCK_EVENTS)
      window.addEventListener(evt, unlock, { once: true, passive: true });
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
    this.runSynthesis(synthesizeIosSelectionClick);
  }
  public playProjectArrivalSound(): void {
    this.runSynthesis(synthesizeProjectArrival);
  }
  public runSynthesis(task: (ctx: AudioContext, destination: GainNode) => void): void {
    if (this.isMuted() || !this.audioContext || !this.masterGain) return;
    this.resumeContext();
    task(this.audioContext, this.masterGain);
  }
  public playTactileFeedback(type: TactileFeedbackType, velocity = 0): void {
    if (this.isMuted() || !this.audioContext || !this.masterGain) return;
    this.resumeContext();
    const now = performance.now();
    if (type === "wheel_tick" || type === "tick") {
      if (now - this.lastTickTime < 36) return;
      this.lastTickTime = now;
      triggerHapticDetent(5);
      synthesizeWheelTick(this.audioContext, this.masterGain, velocity);
      return;
    }
    const isSubtle = type === "hover_hotspot" || type === "hover_button" || type === "dvd_corner";
    if (!isSubtle) {
      if (this.lastActionType === type && now - this.lastActionTime < 45) return;
      [this.lastActionTime, this.lastActionType] = [now, type];
      triggerHapticDetent(8);
    }
    dispatchTactileSynthesis(this.audioContext, this.masterGain, type);
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
  audioInstance ??= new ProceduralAudioEngine();
  return audioInstance;
};
