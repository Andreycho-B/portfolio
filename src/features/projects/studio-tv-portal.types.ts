import type { PerspectiveCamera } from "three";
import type { AudioEngineContract } from "../../core/audio.types";
import type { CursorController } from "../../design-system/components/cursor.types";
import type { StudioTvPortalVisuals } from "./studio-crt-aperture";

export interface StudioTvPortalDeps {
  readonly container: HTMLElement;
  readonly camera: PerspectiveCamera;
  readonly audio: AudioEngineContract;
  readonly cursor: CursorController;
  readonly isTvFocused: () => boolean;
  readonly captureSnapshot: (iframe: HTMLIFrameElement) => boolean;
  readonly onExitTvFocus: () => void;
  readonly onPortalChange: (syncRender?: boolean) => void;
  readonly onPointerEnter?: () => void;
  readonly onPointerMove?: (nx: number, ny: number) => void;
}

export interface StudioTvPortalHandle {
  readonly open: (targetUrl: string) => void;
  readonly suspend: () => void;
  readonly resume: () => void;
  readonly closeToDrum: () => void;
  readonly stepVisuals: (dt: number, poweredOn: boolean) => StudioTvPortalVisuals;
  readonly hasActivePage: () => boolean;
  readonly getActiveUrl: () => string | null;
  readonly isInteractive: () => boolean;
  readonly isTuning: () => boolean;
  readonly syncBounds: (camera: PerspectiveCamera) => void;
  readonly dispose: () => void;
}
