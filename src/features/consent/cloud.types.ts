export interface CloudCursorState {
  x: number;
  y: number;
  strength: number;
}

export type TextClearZone = readonly [number, number, number, number];

export interface CloudClearZoneTargets {
  readonly contentEl: HTMLElement | null;
  readonly actionsEl: HTMLElement | null;
}

export interface CloudControllerHandle {
  readonly destroy: () => void;
  readonly reveal: () => void;
}

export interface CloudWebGLRenderer {
  readonly render: (
    time: number,
    opacity: number,
    cursor: CloudCursorState,
    textClearZone: TextClearZone,
    actionZone: TextClearZone,
    pixelScale: number,
  ) => void;
  readonly resize: (width: number, height: number) => void;
  readonly destroy: () => void;
}
