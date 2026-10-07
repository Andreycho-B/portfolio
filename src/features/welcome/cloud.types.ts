export interface CloudCursorState {
  x: number;
  y: number;
  strength: number;
}

export type TextClearZone = readonly [number, number, number, number];

export interface CloudControllerHandle {
  readonly destroy: () => void;
  readonly reveal: () => void;
}
