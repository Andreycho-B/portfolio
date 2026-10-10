import type {
  AmbientTextureHandle,
  AudioEngineContract,
  AudioMode,
  TactileFeedbackType,
} from "./audio.types";
import { bindTeardownAndVisibility, gracefulMute } from "./audio-lifecycle";
import {
  startOrganicDrone,
  synthesizeInharmonicGlass,
  synthesizeTactileImpulse,
} from "./audio-synthesis";

export class ProceduralAudioEngine implements AudioEngineContract {
  private mode: AudioMode = "uninitialized";
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientHandle: AmbientTextureHandle | null = null;
  private isGraphSetup = false;
  private lastTactileTime = 0;
  private userMuted = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const AudioCtxClass = window.AudioContext;
        if (AudioCtxClass) {
          this.audioContext = new AudioCtxClass();
        }
      } catch {
        // Ignorar si el navegador restringe AudioContext antes del gesto
      }
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
    if (this.mode === "active" && this.audioContext?.state === "running") return true;

    try {
      if (!this.audioContext) {
        const AudioCtxClass = window.AudioContext;
        if (!AudioCtxClass) {
          console.warn("[Audio] Este navegador no soporta la Web Audio API.");
          this.mode = "muted";
          return false;
        }
        this.audioContext = new AudioCtxClass();
      }

      if (this.audioContext.state === "suspended") await this.audioContext.resume();

      this.ensureGraph();
      this.startAmbient();
      this.mode = "active";
      bindTeardownAndVisibility(
        () => gracefulMute(this.audioContext, this.masterGain, 0.015),
        () => {
          if (this.isMuted()) return;
          this.rampMasterTo(document.hidden ? 0.0001 : 0.7, document.hidden ? 0.25 : 0.35);
        },
      );
      return true;
    } catch (error) {
      console.warn("[Audio] Fallo en initialize:", error);
      this.mode = "pending_gesture";
      this.attachDeferredUnlock();
      return false;
    }
  }

  private ensureGraph(): void {
    if (!this.audioContext || this.isGraphSetup) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Filtro Highpass a 22Hz (DC-Blocker): Elimina offset DC que produce el pop al desconectar
    const dcBlocker = ctx.createBiquadFilter();
    dcBlocker.type = "highpass";
    dcBlocker.frequency.setValueAtTime(22, now);
    dcBlocker.Q.setValueAtTime(Math.SQRT1_2, now);

    // Limitador suave: Previene cualquier distorsión o saturación digital
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-3, now);
    limiter.knee.setValueAtTime(6, now);
    limiter.ratio.setValueAtTime(8, now);
    limiter.attack.setValueAtTime(0.003, now);
    limiter.release.setValueAtTime(0.1, now);

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.7, now);
    this.masterGain.connect(limiter);
    limiter.connect(dcBlocker);
    dcBlocker.connect(ctx.destination);
    this.isGraphSetup = true;
  }

  private startAmbient(): void {
    if (!this.audioContext || !this.masterGain || this.ambientHandle) return;
    this.ambientHandle = startOrganicDrone(this.audioContext, this.masterGain);
  }

  private attachDeferredUnlock(): void {
    const unlock = async () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      if (this.mode === "pending_gesture" && !this.userMuted) await this.initialize(true);
    };
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true, passive: true });
  }

  private rampMasterTo(target: number, durationSec: number): void {
    if (!this.audioContext || !this.masterGain) return;
    const now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(target, now + durationSec);
  }

  public toggleMute(): boolean {
    this.userMuted = !this.userMuted;
    if (!this.audioContext || !this.masterGain) return this.userMuted;

    if (this.userMuted) {
      this.rampMasterTo(0, 0.04);
      this.mode = "muted";
    } else {
      if (this.audioContext.state === "suspended") void this.audioContext.resume();
      this.rampMasterTo(0.7, 0.3);
      this.mode = "active";
    }
    return this.userMuted;
  }

  public setMasterVolume(level: number): void {
    this.rampMasterTo(Math.max(0, Math.min(1, level)), 0.08);
  }

  public playReleaseSound(): void {
    if (this.isMuted() || !this.audioContext || !this.masterGain) return;
    synthesizeInharmonicGlass(this.audioContext, this.masterGain, 432);
  }

  public playTactileFeedback(type: TactileFeedbackType): void {
    if (this.isMuted() || !this.audioContext || !this.masterGain) return;
    const now = performance.now();
    if (now - this.lastTactileTime < 80) return;
    this.lastTactileTime = now;

    const isTap = type === "glass_tap" || type === "gravitational_release";
    synthesizeTactileImpulse(this.audioContext, this.masterGain, isTap);
  }

  public stop(): void {
    if (this.ambientHandle) {
      this.ambientHandle.stop();
      this.ambientHandle = null;
    }
    gracefulMute(this.audioContext, this.masterGain, 0.04);
  }
}

let audioInstance: AudioEngineContract | null = null;
export const getAudioSystem = (): AudioEngineContract => {
  if (!audioInstance) audioInstance = new ProceduralAudioEngine();
  return audioInstance;
};
