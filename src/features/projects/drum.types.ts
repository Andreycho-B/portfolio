import type { ProjectTitleMorphController } from "./project-title-morph";

export interface FrontCardBounds {
  readonly widthRatio: number;
  readonly heightRatio: number;
}

export interface DrumWebGLHandle {
  setRotation: (slotPosition: number) => void;
  setScrollVelocity: (velocitySlotsPerSecond: number) => void;
  setIntroProgress: (progress: number) => void;
  render: () => void;
  resize: (widthPx: number, heightPx: number) => void;
  getFrontCardBounds: () => FrontCardBounds;
  dispose: () => void;
}

export interface DrumControllerElements {
  readonly root: HTMLElement;
  readonly viewport: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly morphController: ProjectTitleMorphController;
  readonly webglScene: DrumWebGLHandle | null;
  readonly onOpenActive: () => void;
}
