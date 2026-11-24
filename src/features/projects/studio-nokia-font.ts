// Authentic Nokia 3310 (PCD8544 84x48) monochrome dot-matrix bitmap glyphs & canvas painter.

export type PixelBuffer = Uint8Array;

export const LCD_W = 84;
export const LCD_H = 48;
export const LCD_CELL_PX = 6;
export const LCD_PAD_PX = 10;
export const LCD_CANVAS_W = LCD_W * LCD_CELL_PX + LCD_PAD_PX * 2;
export const LCD_CANVAS_H = LCD_H * LCD_CELL_PX + LCD_PAD_PX * 2;

const FONT_5X7: Readonly<Record<string, readonly string[]>> = {
  "0": [".###.", "#..##", "#.#.#", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "..##.", ".#...", "#....", "#####"],
  "3": [".###.", "#...#", "....#", "..##.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "####.", "#...#", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  " ": ["...", "...", "...", "...", "...", "...", "..."],
};

const FONT_MINI: Readonly<Record<string, readonly string[]>> = {
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###", "..#", "###", "#..", "###"],
  "3": ["###", "..#", "###", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "###", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", "..#", ".#.", ".#."],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "###"],
  ":": [".", "#", ".", "#", "."],
  ".": [".", ".", ".", ".", "#"],
  " ": ["..", "..", "..", "..", ".."],
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
  N: ["#..#", "##.#", "#.##", "#..#", "#..#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", ".#."],
  V: ["#.#", "#.#", "#.#", ".#.", ".#."],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  a: ["...", ".##", "#.#", "#.#", ".##"],
  l: ["#", "#", "#", "#", "#"],
  m: [".....", "##.#.", "#.#.#", "#.#.#", "#.#.#"],
  r: ["...", "##.", "#..", "#..", "#.."],
};

export const setLcdPixel = (buf: PixelBuffer, x: number, y: number, val: 0 | 1 = 1): void => {
  if (x < 0 || x >= LCD_W || y < 0 || y >= LCD_H) return;
  buf[y * LCD_W + x] = val;
};

export const fillLcdRect = (
  buf: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  val: 0 | 1 = 1,
): void => {
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) setLcdPixel(buf, x + dx, y + dy, val);
  }
};

export const drawLcdBitmap = (
  buf: PixelBuffer,
  rows: readonly string[],
  x: number,
  y: number,
  val: 0 | 1 = 1,
): void => {
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r] ?? "";
    for (let c = 0; c < row.length; c += 1) {
      if (row[c] === "#") setLcdPixel(buf, x + c, y + r, val);
    }
  }
};

export const measureLcdText = (text: string, size: "large" | "mini"): number => {
  const table = size === "large" ? FONT_5X7 : FONT_MINI;
  let width = 0;
  for (let i = 0; i < text.length; i += 1) {
    const glyph = table[text[i] ?? " "] ?? table[" "] ?? ["..."];
    width += (glyph[0]?.length ?? 3) + (i > 0 ? 1 : 0);
  }
  return width;
};

export const drawLcdText = (
  buf: PixelBuffer,
  text: string,
  x: number,
  y: number,
  size: "large" | "mini",
  val: 0 | 1 = 1,
): void => {
  const table = size === "large" ? FONT_5X7 : FONT_MINI;
  let cursorX = x;
  for (let i = 0; i < text.length; i += 1) {
    const glyph = table[text[i] ?? " "] ?? table[" "] ?? ["..."];
    drawLcdBitmap(buf, glyph, cursorX, y, val);
    cursorX += (glyph[0]?.length ?? 3) + 1;
  }
};

let cachedLcdBase: HTMLCanvasElement | null = null;

const getLcdBaseCanvas = (): HTMLCanvasElement => {
  if (cachedLcdBase) return cachedLcdBase;
  const c = document.createElement("canvas");
  c.width = LCD_CANVAS_W;
  c.height = LCD_CANVAS_H;
  const bCtx = c.getContext("2d");
  if (bCtx) {
    const bg = bCtx.createRadialGradient(
      LCD_CANVAS_W * 0.5,
      LCD_CANVAS_H * 0.48,
      LCD_CANVAS_W * 0.08,
      LCD_CANVAS_W * 0.5,
      LCD_CANVAS_H * 0.5,
      LCD_CANVAS_W * 0.62,
    );
    bg.addColorStop(0, "#85a846");
    bg.addColorStop(0.72, "#95b94f");
    bg.addColorStop(1, "#709038");
    bCtx.fillStyle = bg;
    bCtx.fillRect(0, 0, LCD_CANVAS_W, LCD_CANVAS_H);

    bCtx.fillStyle = "rgba(25, 36, 15, 0.055)";
    for (let y = 0; y < LCD_H; y += 1) {
      const py = LCD_PAD_PX + y * LCD_CELL_PX;
      for (let x = 0; x < LCD_W; x += 1) {
        bCtx.fillRect(LCD_PAD_PX + x * LCD_CELL_PX, py, LCD_CELL_PX - 1, LCD_CELL_PX - 1);
      }
    }

    bCtx.strokeStyle = "rgba(18, 28, 10, 0.36)";
    bCtx.lineWidth = 8;
    bCtx.strokeRect(2, 2, LCD_CANVAS_W - 4, LCD_CANVAS_H - 4);
  }
  cachedLcdBase = c;
  return c;
};

export const paintNokiaLcdCanvas = (ctx: CanvasRenderingContext2D, buf: PixelBuffer): void => {
  ctx.drawImage(getLcdBaseCanvas(), 0, 0);

  for (const [fill, offset] of [
    ["rgba(22, 34, 12, 0.25)", 1.6],
    ["#18230e", 0],
  ] as const) {
    ctx.fillStyle = fill;
    for (let y = 0; y < LCD_H; y += 1) {
      const py = LCD_PAD_PX + y * LCD_CELL_PX + offset;
      for (let x = 0; x < LCD_W; x += 1) {
        if (buf[y * LCD_W + x] === 1) {
          ctx.fillRect(LCD_PAD_PX + x * LCD_CELL_PX + offset, py, LCD_CELL_PX - 1, LCD_CELL_PX - 1);
        }
      }
    }
  }
};
