export type AudioMode = "uninitialized" | "muted" | "active";

export interface AudioSystem {
  readonly getMode: () => AudioMode;
  readonly initialize: (enableSound: boolean) => Promise<boolean>;
  readonly playThresholdClick: () => void;
  readonly playReleaseSound: () => void;
  readonly setVolume: (targetVolume: number) => void;
}

class ProceduralAudioEngine implements AudioSystem {
  private mode: AudioMode = "uninitialized";
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientDroneGain: GainNode | null = null;

  public getMode(): AudioMode {
    return this.mode;
  }

  public async initialize(enableSound: boolean): Promise<boolean> {
    if (!enableSound) {
      this.mode = "muted";
      return true;
    }

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn("[Audio] Web Audio API not supported in this browser.");
        this.mode = "muted";
        return false;
      }

      if (!this.audioContext) {
        this.audioContext = new AudioCtxClass();
      }

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      this.setupAudioGraph();
      this.startAmbientTexture();
      this.mode = "active";
      return true;
    } catch (contextError) {
      if (contextError instanceof Error) {
        console.warn("[Audio] AudioContext unlock deferred or rejected:", contextError.message);
      }
      this.mode = "muted";
      return false;
    }
  }

  private setupAudioGraph(): void {
    if (!this.audioContext) return;
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.setValueAtTime(0.7, this.audioContext.currentTime);
    this.masterGain.connect(this.audioContext.destination);

    this.ambientDroneGain = this.audioContext.createGain();
    this.ambientDroneGain.gain.setValueAtTime(0, this.audioContext.currentTime);
    this.ambientDroneGain.connect(this.masterGain);
  }

  private startAmbientTexture(): void {
    if (!this.audioContext || !this.ambientDroneGain) return;
    const now = this.audioContext.currentTime;

    // Capa 1: Frecuencia fundamental cálida (55Hz - A1)
    const baseOsc = this.audioContext.createOscillator();
    baseOsc.type = "sine";
    baseOsc.frequency.setValueAtTime(55, now);

    // Filtro pasa bajos suave
    const filter = this.audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(280, now);

    // LFO lento para micro-evolución procedural
    const lfo = this.audioContext.createOscillator();
    const lfoGain = this.audioContext.createGain();
    lfo.frequency.setValueAtTime(0.12, now);
    lfoGain.gain.setValueAtTime(60, now);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    baseOsc.connect(filter);
    filter.connect(this.ambientDroneGain);

    baseOsc.start(now);
    lfo.start(now);

    // Entrada gradual de 3 segundos
    this.ambientDroneGain.gain.linearRampToValueAtTime(0.35, now + 3);
  }

  public playThresholdClick(): void {
    if (this.mode !== "active" || !this.audioContext || !this.masterGain) return;
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const clickGain = this.audioContext.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);

    clickGain.gain.setValueAtTime(0.15, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(clickGain);
    clickGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playReleaseSound(): void {
    if (this.mode !== "active" || !this.audioContext || !this.masterGain) return;
    const now = this.audioContext.currentTime;

    // Resonancia de vidrio / cristal al soltar y entrar
    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    const releaseGain = this.audioContext.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";
    osc1.frequency.setValueAtTime(440, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.35);

    osc2.frequency.setValueAtTime(660, now);
    osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.35);

    releaseGain.gain.setValueAtTime(0.22, now);
    releaseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(releaseGain);
    osc2.connect(releaseGain);
    releaseGain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.52);
    osc2.stop(now + 0.52);
  }

  public setVolume(targetVolume: number): void {
    if (!this.audioContext || !this.masterGain) return;
    const now = this.audioContext.currentTime;
    const safeVolume = Math.max(0, Math.min(1, targetVolume));
    this.masterGain.gain.linearRampToValueAtTime(safeVolume, now + 0.1);
  }
}

let audioInstance: AudioSystem | null = null;

export const getAudioSystem = (): AudioSystem => {
  if (!audioInstance) {
    audioInstance = new ProceduralAudioEngine();
  }
  return audioInstance;
};
