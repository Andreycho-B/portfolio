import {
  drawLcdBitmap,
  drawLcdText,
  fillLcdRect,
  LCD_H,
  LCD_W,
  measureLcdText,
  type PixelBuffer,
  setLcdPixel,
} from "./studio-nokia-font";
import type { SnakePhase } from "./studio-nokia-snake";

export interface SnakeGridCell {
  readonly x: number;
  readonly y: number;
}

interface SnakeFrameSnapshot {
  readonly snake: readonly SnakeGridCell[];
  readonly food: SnakeGridCell;
  readonly score: number;
  readonly bestScore: number;
  readonly phase: SnakePhase;
  readonly tickCount: number;
}

const FIELD_X = 2;
const FIELD_Y = 10;
const TILE = 4;
const FOOD_DIAMOND: readonly string[] = [".#.", "#.#", ".#."];

const SNAKE_LOGO: readonly string[] = [
  ".#####..##...#...####...##..##..######.....###..###",
  "##......###..#..##..##..##.##...##..........#....#.",
  ".####...####.#..##..##..####....#####.......#....#.",
  "....##..##.###..######..##.##...##..........#....#.",
  "....##..##..##..##..##..##..##..##..........#....#.",
  "#####...##...#..##..##..##..##..######.....###..###",
];

const START_SNAKE: readonly string[] = [
  "............###############..................",
  "............#.#.###.#.###.#..................",
  "............###############..................",
  "............###.........###.........#####....",
  "............#.#.........#.#........###.##....",
  "............###.........###........#######...",
  "............###.........###........#######...",
  "............#.#.........#.#........######....",
  "###############.........#################....",
  ".#.#.###.#.###..........#.#.###.#.###.###....",
  "###############.........################.....",
];

const drawStartPill = (buf: PixelBuffer, label: string, y: number, blinkOn: boolean): void => {
  const pillW = 42;
  const pillX = Math.round((LCD_W - pillW) * 0.5);
  fillLcdRect(buf, pillX + 1, y, pillW - 2, 1, 1);
  fillLcdRect(buf, pillX, y + 1, pillW, 7, 1);
  fillLcdRect(buf, pillX + 1, y + 8, pillW - 2, 1, 1);
  const tx = Math.round((LCD_W - measureLcdText(label, "mini")) * 0.5);
  drawLcdText(buf, label, tx, y + 2, "mini", 0);
  if (blinkOn) {
    setLcdPixel(buf, pillX + 4, y + 3, 0);
    setLcdPixel(buf, pillX + 5, y + 4, 0);
    setLcdPixel(buf, pillX + 4, y + 5, 0);
    setLcdPixel(buf, pillX + pillW - 5, y + 3, 0);
    setLcdPixel(buf, pillX + pillW - 6, y + 4, 0);
    setLcdPixel(buf, pillX + pillW - 5, y + 5, 0);
  }
};

const renderStartScreen = (buf: PixelBuffer, tickCount: number): PixelBuffer => {
  fillLcdRect(buf, 1, 1, LCD_W - 2, 1);
  fillLcdRect(buf, 1, LCD_H - 2, LCD_W - 2, 1);
  fillLcdRect(buf, 1, 1, 1, LCD_H - 2);
  fillLcdRect(buf, LCD_W - 2, 1, 1, LCD_H - 2);

  drawLcdBitmap(buf, SNAKE_LOGO, 16, 5);
  drawLcdBitmap(buf, START_SNAKE, 14, 15);

  const blinkOn = tickCount % 2 === 0;
  if (blinkOn) {
    setLcdPixel(buf, 57, 20);
    setLcdPixel(buf, 58, 20);
    setLcdPixel(buf, 59, 19);
    setLcdPixel(buf, 59, 21);
  }
  drawLcdBitmap(buf, FOOD_DIAMOND, 64, 19);
  drawStartPill(buf, "START", 34, blinkOn);
  return buf;
};

const snakeFrameBuf = new Uint8Array(LCD_W * LCD_H);

export const renderNokiaSnakeFrame = (state: SnakeFrameSnapshot): PixelBuffer => {
  const buf = snakeFrameBuf;
  buf.fill(0);
  if (state.phase === "start") return renderStartScreen(buf, state.tickCount);

  const scoreStr = String(state.score).padStart(4, "0");
  drawLcdText(buf, scoreStr, 2, 1, "mini");
  const rightTag = state.bestScore > 0 ? `HI ${String(state.bestScore).padStart(4, "0")}` : "SNAKE";
  drawLcdText(buf, rightTag, LCD_W - 2 - measureLcdText(rightTag, "mini"), 1, "mini");
  fillLcdRect(buf, 0, 7, LCD_W, 1);

  fillLcdRect(buf, 1, 9, LCD_W - 2, 1);
  fillLcdRect(buf, 1, LCD_H - 2, LCD_W - 2, 1);
  fillLcdRect(buf, 1, 9, 1, LCD_H - 10);
  fillLcdRect(buf, LCD_W - 2, 9, 1, LCD_H - 10);

  if (state.tickCount % 4 !== 3) {
    drawLcdBitmap(buf, FOOD_DIAMOND, FIELD_X + state.food.x * TILE, FIELD_Y + state.food.y * TILE);
  }

  for (let i = 0; i < state.snake.length; i += 1) {
    const seg = state.snake[i];
    if (!seg) continue;
    const px = FIELD_X + seg.x * TILE;
    const py = FIELD_Y + seg.y * TILE;
    fillLcdRect(buf, px, py, 3, 3);
    if (i > 0 && i % 2 === 1) buf[(py + 1) * LCD_W + (px + 1)] = 0;
    const prev = state.snake[i - 1];
    if (prev && Math.abs(prev.x - seg.x) + Math.abs(prev.y - seg.y) === 1) {
      if (prev.x > seg.x) setLcdPixel(buf, px + 3, py + 1);
      else if (prev.x < seg.x) setLcdPixel(buf, px - 1, py + 1);
      else if (prev.y > seg.y) setLcdPixel(buf, px + 1, py + 3);
      else setLcdPixel(buf, px + 1, py - 1);
    }
  }

  if (state.phase === "gameover") {
    fillLcdRect(buf, 12, 13, 60, 31, 0);
    fillLcdRect(buf, 12, 13, 60, 1);
    fillLcdRect(buf, 12, 43, 60, 1);
    fillLcdRect(buf, 12, 13, 1, 31);
    fillLcdRect(buf, 71, 13, 1, 31);
    const msg = "GAME OVER";
    drawLcdText(buf, msg, Math.round((LCD_W - measureLcdText(msg, "mini")) * 0.5), 16, "mini");
    drawLcdText(
      buf,
      scoreStr,
      Math.round((LCD_W - measureLcdText(scoreStr, "mini")) * 0.5),
      24,
      "mini",
    );
    drawStartPill(buf, "START", 32, state.tickCount % 2 === 0);
  }
  return buf;
};
