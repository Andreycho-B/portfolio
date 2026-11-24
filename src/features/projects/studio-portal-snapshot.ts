import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  type WebGLRenderer,
} from "three";
import {
  drawFittedImage,
  drawSvgElement,
  drawTextNode,
  hasVisibleColor,
  traceRoundedRect,
} from "./studio-portal-snapshot-paint";

export interface StudioPortalSnapshotHandle {
  readonly texture: CanvasTexture;
  readonly capture: (iframe: HTMLIFrameElement) => boolean;
  readonly clear: () => void;
  readonly dispose: () => void;
}

const SNAP_W = 960;
const SNAP_H = 800;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "LINK", "META", "HEAD"]);

const shouldSkipElement = (el: Element): boolean =>
  el.classList.contains("sr-only") ||
  el.classList.contains("char-bot") ||
  el.id === "fluid-transition-overlay" ||
  el.hasAttribute("data-interactive-cursor") ||
  el.hasAttribute("data-cursor-dot");

const parseBorderRadius = (raw: string, w: number, h: number): number => {
  if (!raw) return 0;
  const val = Number.parseFloat(raw) || 0;
  return raw.trim().endsWith("%") ? (val / 100) * Math.min(w, h) : val;
};

const paintBoxDecoration = (
  ctx: CanvasRenderingContext2D,
  st: CSSStyleDeclaration,
  rect: DOMRect,
  rad: number,
): void => {
  if (hasVisibleColor(st.backgroundColor)) {
    traceRoundedRect(ctx, rect.left, rect.top, rect.width, rect.height, rad);
    ctx.fillStyle = st.backgroundColor;
    ctx.fill();
  } else if (st.backgroundImage.startsWith("linear-gradient(")) {
    const grad = ctx.createLinearGradient(0, rect.top, 0, rect.bottom);
    grad.addColorStop(0, "rgba(255,255,255,0.96)");
    grad.addColorStop(0.66, "rgba(255,255,255,0.92)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
  }
  const bw = Number.parseFloat(st.borderTopWidth) || 0;
  const bbw = Number.parseFloat(st.borderBottomWidth) || 0;
  const blw = Number.parseFloat(st.borderLeftWidth) || 0;
  if (bw > 0 && bw === bbw && bw === blw && hasVisibleColor(st.borderTopColor)) {
    traceRoundedRect(ctx, rect.left, rect.top, rect.width, rect.height, rad);
    ctx.strokeStyle = st.borderTopColor;
    ctx.lineWidth = bw;
    ctx.stroke();
    return;
  }
  if (bw > 0 && hasVisibleColor(st.borderTopColor)) {
    ctx.fillStyle = st.borderTopColor;
    ctx.fillRect(rect.left, rect.top, rect.width, bw);
  }
  if (bbw > 0 && hasVisibleColor(st.borderBottomColor)) {
    ctx.fillStyle = st.borderBottomColor;
    ctx.fillRect(rect.left, rect.bottom - bbw, rect.width, bbw);
  }
};

export const createStudioPortalSnapshot = (renderer: WebGLRenderer): StudioPortalSnapshotHandle => {
  const canvas = document.createElement("canvas");
  canvas.width = SNAP_W;
  canvas.height = SNAP_H;
  const ctx = canvas.getContext("2d");

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  const fillBlank = (): void => {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SNAP_W, SNAP_H);
    texture.needsUpdate = true;
  };
  fillBlank();

  const capture = (iframe: HTMLIFrameElement): boolean => {
    if (!ctx) return false;
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc?.body) return false;
    const viewW = win.innerWidth;
    const viewH = win.innerHeight;
    if (viewW <= 20 || viewH <= 20) return false;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bodyBg = win.getComputedStyle(doc.body).backgroundColor;
    ctx.fillStyle = hasVisibleColor(bodyBg) ? bodyBg : "#ffffff";
    ctx.fillRect(0, 0, SNAP_W, SNAP_H);
    ctx.setTransform(SNAP_W / viewW, 0, 0, SNAP_H / viewH, 0, 0);

    const range = doc.createRange();
    const fixedQueue: Element[] = [];
    const paintEl = (el: Element, collectFixed: boolean): void => {
      const tag = el.tagName.toUpperCase();
      if (SKIP_TAGS.has(tag) || shouldSkipElement(el)) return;
      const st = win.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") return;
      const op = Number.parseFloat(st.opacity);
      if (op <= 0.01) return;
      if (collectFixed && st.position === "fixed") {
        fixedQueue.push(el);
        return;
      }

      const rect = el.getBoundingClientRect();
      const clips = st.overflow === "hidden" || st.overflow === "clip" || st.overflowX === "hidden";
      if (
        clips &&
        (rect.bottom < -24 || rect.top > viewH + 24 || rect.right < -24 || rect.left > viewW + 24)
      ) {
        return;
      }

      ctx.save();
      ctx.globalAlpha *= op;
      const rad = parseBorderRadius(st.borderTopLeftRadius, rect.width, rect.height);
      if (rect.width > 0 && rect.height > 0 && rect.bottom >= -24 && rect.top <= viewH + 24) {
        paintBoxDecoration(ctx, st, rect, rad);
      }
      if (clips && rect.width > 0 && rect.height > 0) {
        traceRoundedRect(ctx, rect.left, rect.top, rect.width, rect.height, rad);
        ctx.clip();
      }
      if (tag === "IMG") {
        drawFittedImage(ctx, el as HTMLImageElement, rect, st.objectFit);
      } else if (tag === "CANVAS") {
        const srcCanvas = el as HTMLCanvasElement;
        if (srcCanvas.width > 0 && srcCanvas.height > 0) {
          try {
            ctx.drawImage(srcCanvas, rect.left, rect.top, rect.width, rect.height);
          } catch (err: unknown) {
            if (!(err instanceof DOMException)) {
              console.warn("[StudioPortalSnapshot] Canvas blit skipped:", err);
            }
          }
        }
      } else if (tag === "SVG") {
        drawSvgElement(ctx, el as SVGSVGElement, win);
      } else {
        for (const child of el.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) {
            drawTextNode(ctx, child as Text, st, range, viewW, viewH);
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            paintEl(child as Element, collectFixed);
          }
        }
      }
      ctx.restore();
    };

    paintEl(doc.body, true);
    for (const fixedEl of fixedQueue) paintEl(fixedEl, false);
    texture.needsUpdate = true;
    return true;
  };

  return { texture, capture, clear: fillBlank, dispose: () => texture.dispose() };
};
