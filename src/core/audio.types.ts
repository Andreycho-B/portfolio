export type AudioMode = "uninitialized" | "pending_gesture" | "active" | "muted";

export type TactileFeedbackType = "soft_hover" | "glass_tap" | "gravitational_release";

export interface AudioEngineContract {
  readonly getMode: () => AudioMode;
  readonly isMuted: () => boolean;
  readonly initialize: (enableSound: boolean) => Promise<boolean>;
  readonly toggleMute: () => boolean;
  readonly setMasterVolume: (level: number) => void;
  readonly playReleaseSound: () => void;
  readonly playTactileFeedback: (type: TactileFeedbackType) => void;
  readonly stop: () => void;
}

export interface GlassHarmonicSpec {
  readonly ratio: number;
  readonly gainRatio: number;
  readonly decayDuration: number;
}

export interface AmbientTextureHandle {
  readonly gainNode: GainNode;
  readonly stop: () => void;
}
