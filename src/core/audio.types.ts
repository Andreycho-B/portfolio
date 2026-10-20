export type AudioMode = "uninitialized" | "pending_gesture" | "active" | "muted";

export type TactileFeedbackType = "wheel_tick" | "jelly_pop" | "click" | "tick";

export interface AudioEngineContract {
  readonly getMode: () => AudioMode;
  readonly isMuted: () => boolean;
  readonly initialize: (enableSound: boolean) => Promise<boolean>;
  readonly toggleMute: () => boolean;
  readonly setMasterVolume: (level: number) => void;
  readonly playReleaseSound: () => void;
  readonly playProjectArrivalSound: () => void;
  readonly playTactileFeedback: (type: TactileFeedbackType, velocity?: number) => void;
  readonly triggerProximityAura: (intensity?: number) => void;
  readonly stop: () => void;
}

export interface GlassHarmonicSpec {
  readonly ratio: number;
  readonly gainRatio: number;
  readonly decayDuration: number;
}

export interface AmbientTextureHandle {
  readonly gainNode: GainNode;
  readonly triggerProximityAura: (intensity?: number) => void;
  readonly stop: () => void;
}
