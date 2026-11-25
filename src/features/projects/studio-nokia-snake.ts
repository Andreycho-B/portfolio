import type { PixelBuffer } from "./studio-nokia-font";
import type { NokiaMoveDir } from "./studio-nokia-keypad";
import { renderNokiaSnakeFrame, type SnakeGridCell } from "./studio-nokia-snake-render";

type SnakeDir = NokiaMoveDir;
export type SnakePhase = "start" | "play" | "gameover";
type SnakeTickEvent = "none" | "step" | "eat" | "gameover";

const COLS = 20;
const ROWS = 9;
const STEP_SEC = 0.145;
const IDLE_BLINK_SEC = 0.48;

const DIR_DELTA: Readonly<Record<SnakeDir, SnakeGridCell>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Readonly<Record<SnakeDir, SnakeDir>> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const CW_ORDER: readonly SnakeDir[] = ["up", "right", "down", "left"];
const wrap = (v: number, max: number): number => ((v % max) + max) % max;

interface NokiaSnakeEngine {
  readonly getPhase: () => SnakePhase;
  readonly showStart: () => void;
  readonly startGame: (initialDir?: SnakeDir) => void;
  readonly steer: (dir: SnakeDir) => void;
  readonly turnClockwise: () => void;
  readonly stepTime: (dtSeconds: number) => SnakeTickEvent;
  readonly renderToBuffer: () => PixelBuffer;
}

export const createNokiaSnakeEngine = (): NokiaSnakeEngine => {
  let snake: SnakeGridCell[] = [];
  let dir: SnakeDir = "right";
  const dirQueue: SnakeDir[] = [];
  let food: SnakeGridCell = { x: 14, y: 4 };
  let score = 0;
  let bestScore = 0;
  let phase: SnakePhase = "start";
  let timer = 0;
  let tickCount = 0;

  const occupies = (x: number, y: number, ignoreTail = false): boolean => {
    const end = ignoreTail ? snake.length - 1 : snake.length;
    for (let i = 0; i < end; i += 1) {
      const s = snake[i];
      if (s && s.x === x && s.y === y) return true;
    }
    return false;
  };

  const spawnFood = (): void => {
    const free: SnakeGridCell[] = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) if (!occupies(x, y)) free.push({ x, y });
    }
    if (free.length === 0) return;
    food = free[(tickCount * 7 + score * 3 + free.length) % free.length] ?? { x: 10, y: 4 };
  };

  const initBoard = (): void => {
    snake = [
      { x: 8, y: 4 },
      { x: 7, y: 4 },
      { x: 6, y: 4 },
      { x: 5, y: 4 },
      { x: 4, y: 4 },
    ];
    dir = "right";
    dirQueue.length = 0;
    score = 0;
    timer = 0;
    tickCount = 0;
    spawnFood();
  };

  const showStart = (): void => {
    initBoard();
    phase = "start";
  };

  const startGame = (initialDir?: SnakeDir): void => {
    initBoard();
    phase = "play";
    if (initialDir && initialDir !== OPPOSITE[dir] && initialDir !== dir) {
      dirQueue.push(initialDir);
    }
  };

  const steer = (nextDir: SnakeDir): void => {
    if (phase !== "play") {
      startGame(nextDir);
      return;
    }
    const reference = dirQueue[dirQueue.length - 1] ?? dir;
    if (nextDir !== reference && nextDir !== OPPOSITE[reference] && dirQueue.length < 2) {
      dirQueue.push(nextDir);
    }
  };

  const turnClockwise = (): void => {
    if (phase !== "play") {
      startGame();
      return;
    }
    const reference = dirQueue[dirQueue.length - 1] ?? dir;
    const idx = CW_ORDER.indexOf(reference);
    steer(CW_ORDER[(idx + 1) % CW_ORDER.length] ?? "right");
  };

  const stepTime = (dtSeconds: number): SnakeTickEvent => {
    timer += dtSeconds;
    if (phase !== "play") {
      if (timer < IDLE_BLINK_SEC) return "none";
      timer -= IDLE_BLINK_SEC;
      tickCount += 1;
      return "step";
    }
    if (timer < STEP_SEC) return "none";
    timer -= STEP_SEC;
    tickCount += 1;
    const next = dirQueue.shift();
    if (next) dir = next;
    const head = snake[0];
    if (!head) return "none";
    const d = DIR_DELTA[dir];
    const nx = wrap(head.x + d.x, COLS);
    const ny = wrap(head.y + d.y, ROWS);
    const eating = nx === food.x && ny === food.y;
    if (occupies(nx, ny, !eating)) {
      phase = "gameover";
      timer = 0;
      tickCount = 0;
      return "gameover";
    }
    snake.unshift({ x: nx, y: ny });
    if (eating) {
      score += 7;
      if (score > bestScore) bestScore = score;
      spawnFood();
      return "eat";
    }
    snake.pop();
    return "step";
  };

  showStart();
  return {
    getPhase: () => phase,
    showStart,
    startGame,
    steer,
    turnClockwise,
    stepTime,
    renderToBuffer: () =>
      renderNokiaSnakeFrame({ snake, food, score, bestScore, phase, tickCount }),
  };
};
