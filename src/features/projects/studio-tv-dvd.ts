const DVD_COLORS = [
  "#e6ec5c",
  "#48f4ff",
  "#ff62cf",
  "#66ff8e",
  "#ff9a46",
  "#ffffff",
  "#96a8ff",
] as const;
const [BADGE_W, BADGE_H, SPEED_X, SPEED_Y] = [208, 198, 138, 102];

interface StudioTvDvdHandle {
  readonly reset: () => void;
  readonly stepAndPaint: (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dtSeconds: number,
    prefersReduced: boolean,
  ) => void;
  readonly dispose: () => void;
}

const buildTintedLogo = (img: HTMLImageElement, color: string): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  [c.width, c.height] = [img.naturalWidth || 180, img.naturalHeight || 220];
  const cx = c.getContext("2d");
  if (!cx) return c;
  cx.drawImage(img, 0, 0, c.width, c.height);
  cx.globalCompositeOperation = "source-in";
  cx.fillStyle = color;
  cx.fillRect(0, 0, c.width, c.height);
  return c;
};

const drawDvdEmblem = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  tintedLogo: HTMLCanvasElement | null,
): void => {
  const cx = x + BADGE_W * 0.5;
  ctx.save();
  if (tintedLogo && tintedLogo.height > 0) {
    const logoH = 88;
    const logoW = (tintedLogo.width / tintedLogo.height) * logoH;
    ctx.drawImage(tintedLogo, cx - logoW * 0.5, y + 2, logoW, logoH);
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.save();
  ctx.translate(cx, y + 132);
  ctx.transform(1, 0, -0.24, 1, 0, 0);
  ctx.font = '900 58px "Author", "Arial Black", sans-serif';
  ctx.fillText("DVD", 0, 0);
  ctx.restore();

  ctx.beginPath();
  ctx.ellipse(cx - 2, y + 150, 74, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0814e6";
  ctx.beginPath();
  ctx.ellipse(cx - 2, y + 150, 22, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.font = '700 20px "Author", "Karrik", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const letters = ["V", "I", "D", "E", "O"];
  for (let i = 0; i < letters.length; i += 1) {
    ctx.fillText(letters[i] ?? "", cx - 55 + (i / 4) * 110, y + 168);
  }
  ctx.restore();
};

export const createStudioTvDvd = (
  onReady?: () => void,
  onCornerHit?: () => void,
): StudioTvDvdHandle => {
  const st = { x: 274, y: 172, vx: SPEED_X, vy: SPEED_Y, c: 0, corners: 0, flash: 0, dead: false };
  let logoImg: HTMLImageElement | null = null;
  let backdropCanvas: HTMLCanvasElement | null = null;
  const tintCache = new Map<string, HTMLCanvasElement>();

  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    if (st.dead) return;
    logoImg = img;
    tintCache.clear();
    onReady?.();
  };
  img.src = "/logo.webp";

  const getTinted = (color: string): HTMLCanvasElement | null => {
    if (!logoImg) return null;
    const hit = tintCache.get(color);
    if (hit) return hit;
    const created = buildTintedLogo(logoImg, color);
    tintCache.set(color, created);
    return created;
  };

  const reset = (): void => {
    [st.x, st.y, st.vx, st.vy, st.c, st.flash] = [274, 172, SPEED_X, SPEED_Y, 0, 0];
  };

  const stepAndPaint = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dtSeconds: number,
    prefersReduced: boolean,
  ): void => {
    const [padX, padY] = [36, 34];
    const [maxX, maxY] = [w - padX - BADGE_W, h - padY - BADGE_H];

    if (!prefersReduced && dtSeconds > 0) {
      const dt = Math.min(dtSeconds, 0.05);
      st.x += st.vx * dt;
      st.y += st.vy * dt;
      let hit = false;
      if (st.x <= padX || st.x >= maxX) {
        st.x = st.x <= padX ? padX : maxX;
        st.vx = st.x <= padX ? Math.abs(st.vx) : -Math.abs(st.vx);
        hit = true;
      }
      if (st.y <= padY || st.y >= maxY) {
        st.y = st.y <= padY ? padY : maxY;
        st.vy = st.y <= padY ? Math.abs(st.vy) : -Math.abs(st.vy);
        hit = true;
      }
      if (hit) {
        st.c = (st.c + 1) % DVD_COLORS.length;
        if (Math.min(st.x - padX, maxX - st.x) < 16 && Math.min(st.y - padY, maxY - st.y) < 16) {
          st.corners += 1;
          st.flash = 1;
          onCornerHit?.();
        }
      }
      if (st.flash > 0) st.flash = Math.max(0, st.flash - dt * 1.4);
    } else if (prefersReduced) {
      [st.x, st.y] = [(w - BADGE_W) * 0.5, (h - BADGE_H) * 0.5];
    }

    if (!backdropCanvas || backdropCanvas.width !== w || backdropCanvas.height !== h) {
      const bc = document.createElement("canvas");
      [bc.width, bc.height] = [w, h];
      const bCtx = bc.getContext("2d");
      if (bCtx) {
        const grad = bCtx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, w * 0.68);
        grad.addColorStop(0, "#101cff");
        grad.addColorStop(1, "#050bb8");
        bCtx.fillStyle = grad;
        bCtx.fillRect(0, 0, w, h);
      }
      backdropCanvas = bc;
    }
    ctx.drawImage(backdropCanvas, 0, 0);

    if (st.flash > 0.01) {
      ctx.fillStyle = `rgba(255, 245, 160, ${(st.flash * 0.24).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }

    const color = DVD_COLORS[st.c] ?? "#e6ec5c";
    drawDvdEmblem(ctx, st.x, st.y, color, getTinted(color));

    if (st.corners > 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
      ctx.font = '600 18px "Karrik", monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(`ESQUINA ×${st.corners}`, 48, h - 42);
    }
  };

  return {
    reset,
    stepAndPaint,
    dispose: () => {
      st.dead = true;
      img.onload = null;
      tintCache.clear();
    },
  };
};
