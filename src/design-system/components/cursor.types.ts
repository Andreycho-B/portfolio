export interface CursorController {
  readonly enable: () => void;
  readonly disable: () => void;
  readonly setExpanded: (expanded: boolean, label?: string) => void;
  readonly setMuted: (muted: boolean) => void;
  readonly setPressed: (pressed: boolean) => void;
  readonly setInverted: (inverted: boolean) => void;
  readonly pulse: () => void;
  readonly destroy: () => void;
}

export const NOOP_CONTROLLER: CursorController = {
  enable: () => {},
  disable: () => {},
  setExpanded: () => {},
  setMuted: () => {},
  setPressed: () => {},
  setInverted: () => {},
  pulse: () => {},
  destroy: () => {},
};

export interface CursorInternalState {
  enabled: boolean;
  hasPos: boolean;
  moving: boolean;
  expanded: boolean;
  muted: boolean;
  pressed: boolean;
  inverted: boolean;
  angle: number;
  morphUntil: number;
  rafId: number | null;
  lastTime: number;
}

export const createCursorState = (): CursorInternalState => ({
  enabled: false,
  hasPos: false,
  moving: false,
  expanded: false,
  muted: false,
  pressed: false,
  inverted: false,
  angle: 0,
  morphUntil: 0,
  rafId: null,
  lastTime: 0,
});
