import { DEFAULTS, type GlassConfig } from "@ybouane/liquidglass";

export type LiquidGlassSurfaceRole =
  | "cursor-pill"
  | "consent-cta"
  | "detail-action"
  | "not-found-cta";

export type LiquidGlassTone = "light" | "dark";

export interface LiquidGlassButtonState {
  hover: boolean;
  pressed: boolean;
}

export interface LiquidGlassFixedSize {
  readonly width: number;
  readonly height: number;
}

export interface LiquidGlassSurfaceOptions {
  readonly element: HTMLElement;
  readonly role: LiquidGlassSurfaceRole;
  readonly interactive?: boolean;
  readonly tone?: LiquidGlassTone;
  readonly trackScroll?: boolean;
  readonly trackLiveCanvas?: boolean;
  readonly initialEnabled?: boolean;
  readonly getFixedSize?: () => LiquidGlassFixedSize | null;
  readonly getExcludeRoot?: () => HTMLElement | null;
}

export interface LiquidGlassSurfaceHandle {
  readonly markDirty: () => void;
  readonly setTone: (tone: LiquidGlassTone) => void;
  readonly setPressed: (pressed: boolean) => void;
  readonly setEnabled: (enabled: boolean) => void;
  readonly destroy: () => void;
}

export interface LiquidGlassSampleRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export const LIQUID_GLASS_SHADOW_PAD = 20;

const ROLE_Z_RADIUS: Readonly<Record<LiquidGlassSurfaceRole, number>> = {
  "cursor-pill": 19,
  "consent-cta": 19,
  "detail-action": 16,
  "not-found-cta": 21,
};

// Pure prismatic crystal variant (user's playground reference) for dark/rich scenes.
const DARK_SURFACE_GLASS: GlassConfig = {
  ...DEFAULTS,
  blurAmount: 0,
  refraction: 0.93,
  chromAberration: 0.3,
  edgeHighlight: 0,
  specular: 0,
  fresnel: 1,
  distortion: 0,
  cornerRadius: 100,
  zRadius: 18,
  opacity: 1,
  saturation: -0.25,
  tintStrength: 0,
  brightness: 0,
  shadowOpacity: 0,
  shadowSpread: 10,
  shadowOffsetY: 1,
  floating: false,
  button: false,
  bevelMode: 0,
};

// Light-surface crystal variant: keeps zero-blur high refraction & chromatic prism
// while carving legible cool-crystal bevel depth + specular rim + soft shadow on white/bright UI.
const LIGHT_SURFACE_GLASS: GlassConfig = {
  ...DARK_SURFACE_GLASS,
  chromAberration: 0.26,
  edgeHighlight: 0.28,
  specular: 0.45,
  tintStrength: 0.48,
  brightness: -0.08,
  shadowOpacity: 0.22,
  shadowSpread: 11,
  shadowOffsetY: 3,
};

export const resolveLiquidGlassConfig = (
  role: LiquidGlassSurfaceRole,
  tone: LiquidGlassTone,
  buttonState: LiquidGlassButtonState,
): GlassConfig => {
  const isCleanCrystal = role === "cursor-pill" || tone === "dark";
  const base = isCleanCrystal ? DARK_SURFACE_GLASS : LIGHT_SURFACE_GLASS;
  const cfg: GlassConfig = { ...base, zRadius: ROLE_Z_RADIUS[role] };

  if (role === "consent-cta") {
    cfg.brightness = -0.09;
    cfg.tintStrength = 0.34;
    cfg.edgeHighlight = 0.24;
    cfg.specular = 0.36;
    cfg.shadowOpacity = 0.18;
    cfg.shadowSpread = 11;
    cfg.shadowOffsetY = 3;
  }

  if (buttonState.pressed) {
    cfg.zRadius *= 0.8;
    cfg.shadowSpread *= 1.2;
  } else if (buttonState.hover) {
    cfg.brightness += isCleanCrystal ? 0.12 : 0.035;
    if (!isCleanCrystal || role === "consent-cta") {
      cfg.edgeHighlight = Math.min(1, cfg.edgeHighlight + 0.14);
      cfg.specular = Math.min(1.2, cfg.specular + 0.18);
    }
  }

  return cfg;
};
