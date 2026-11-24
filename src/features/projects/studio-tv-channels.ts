import { CanvasTexture, ClampToEdgeWrapping, LinearFilter, SRGBColorSpace } from "three";
import {
  paintClockChannel,
  paintSmpteChannel,
  paintTerminalChannel,
  TV_CH_H,
  TV_CH_W,
} from "./studio-tv-channel-paint";
import { createStudioTvDvd } from "./studio-tv-dvd";

export type TvChannelMode = "portfolio" | "dvd" | "smpte" | "static" | "terminal" | "clock";

export const TV_CHANNEL_ORDER: readonly TvChannelMode[] = [
  "portfolio",
  "dvd",
  "smpte",
  "static",
  "terminal",
  "clock",
];

const CHANNEL_OSD: Readonly<Record<TvChannelMode, string>> = {
  portfolio: "CH 00 · PORTAFOLIO",
  dvd: "CH 05 · DVD VIDEO",
  smpte: "CH 06 · SMPTE",
  static: "CH 07 · SIN SEÑAL",
  terminal: "CH 08 · TERMINAL",
  clock: "CH 09 · RELOJ",
};

export interface StudioTvChannelsHandle {
  readonly texture: CanvasTexture;
  readonly getChannel: () => TvChannelMode;
  readonly isRetroActive: () => boolean;
  readonly setChannel: (mode: TvChannelMode) => void;
  readonly update: (dtSeconds: number, isPoweredOn: boolean, isCloseView: boolean) => boolean;
  readonly dispose: () => void;
}

export const createStudioTvChannels = (onUpdate?: () => void): StudioTvChannelsHandle => {
  const canvas = document.createElement("canvas");
  [canvas.width, canvas.height] = [TV_CH_W, TV_CH_H];
  const ctx = canvas.getContext("2d");

  const noiseCanvas = document.createElement("canvas");
  [noiseCanvas.width, noiseCanvas.height] = [160, 112];
  const noiseCtx = noiseCanvas.getContext("2d");
  const noiseImg = noiseCtx?.createImageData(160, 112) ?? null;

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = LinearFilter;

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dvd = createStudioTvDvd(() => {
    if (st.mode === "dvd") paint(0);
    onUpdate?.();
  });

  const st = { mode: "portfolio" as TvChannelMode, elapsed: 0, osd: 0, flash: 0, accum: 0 };

  const paintStatic = (showCaption: boolean): void => {
    if (!ctx || !noiseCtx || !noiseImg) return;
    const d = noiseImg.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 230) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    noiseCtx.putImageData(noiseImg, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(noiseCanvas, 0, 0, TV_CH_W, TV_CH_H);
    ctx.imageSmoothingEnabled = true;
    if (showCaption) {
      ctx.fillStyle = "rgba(8, 12, 10, 0.72)";
      ctx.fillRect(TV_CH_W * 0.5 - 150, TV_CH_H * 0.5 - 30, 300, 60);
      ctx.fillStyle = "#6cff9a";
      ctx.font = '700 26px "Author", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("SIN SEÑAL · CH 07", TV_CH_W * 0.5, TV_CH_H * 0.5);
    }
  };

  const paint = (dt: number): void => {
    if (!ctx) return;
    if (st.flash > 0 && !prefersReduced) paintStatic(false);
    else if (st.mode === "dvd") dvd.stepAndPaint(ctx, TV_CH_W, TV_CH_H, dt, prefersReduced);
    else if (st.mode === "smpte") paintSmpteChannel(ctx, st.elapsed);
    else if (st.mode === "static") paintStatic(true);
    else if (st.mode === "terminal") paintTerminalChannel(ctx, st.elapsed);
    else if (st.mode === "clock") paintClockChannel(ctx);

    if (st.osd > 0 && st.mode !== "portfolio") {
      const alpha = Math.min(1, st.osd * 2);
      ctx.save();
      ctx.fillStyle = `rgba(6, 14, 8, ${(alpha * 0.65).toFixed(3)})`;
      ctx.fillRect(TV_CH_W - 284, 38, 238, 38);
      ctx.fillStyle = `rgba(110, 255, 140, ${alpha.toFixed(3)})`;
      ctx.font = '700 20px "Karrik", monospace';
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(CHANNEL_OSD[st.mode], TV_CH_W - 58, 57);
      ctx.restore();
    }
    texture.needsUpdate = true;
  };

  const setChannel = (mode: TvChannelMode): void => {
    st.mode = mode;
    st.osd = mode === "portfolio" ? 0 : 2.4;
    st.flash = mode === "portfolio" || prefersReduced ? 0 : 0.16;
    st.accum = 0;
    if (mode === "dvd") dvd.reset();
    if (mode !== "portfolio") paint(0);
  };

  const update = (dtSeconds: number, isPoweredOn: boolean, isCloseView: boolean): boolean => {
    if (st.mode === "portfolio" || !isPoweredOn) return false;
    const dt = Math.min(Math.max(dtSeconds, 0), 0.05);
    st.elapsed += dt;
    if (st.osd > 0) st.osd = Math.max(0, st.osd - dt);
    if (st.flash > 0) st.flash = Math.max(0, st.flash - dt);
    const fast = st.mode === "dvd" || st.mode === "static" || st.flash > 0;
    const interval = fast ? (isCloseView ? 0.016 : 0.025) : 0.25;
    st.accum += dt;
    if (st.accum >= interval) {
      const stepDt = st.accum;
      st.accum = 0;
      paint(stepDt);
    }
    return !prefersReduced || st.osd > 0 || st.mode === "clock";
  };

  return {
    texture,
    getChannel: () => st.mode,
    isRetroActive: () => st.mode !== "portfolio",
    setChannel,
    update,
    dispose: () => {
      dvd.dispose();
      texture.dispose();
    },
  };
};
