import {
  drawFittedImage,
  drawSvgElement,
  drawTextNode,
  hasVisibleColor,
  traceRoundedRect,
} from "../../features/projects/studio-portal-snapshot-paint";
import type { LiquidGlassSampleRect } from "./liquid-glass.types";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "LINK", "META", "HEAD"]);

const rectsOverlap = (a: DOMRect, b: LiquidGlassSampleRect, pad = 2): boolean =>
  a.right >= b.left - pad &&
  a.left <= b.left + b.width + pad &&
  a.bottom >= b.top - pad &&
  a.top <= b.top + b.height + pad;

const shouldSkipNode = (el: Element, excludeEl: HTMLElement | null): boolean => {
  if (excludeEl && (el === excludeEl || excludeEl.contains(el))) return true;
  if (el.classList.contains("liquid-glass-surface-canvas")) return true;
  if (el.classList.contains("sr-only") || el.classList.contains("char-bot")) return true;
  if (el.id === "fluid-transition-overlay") return true;
  if (el.hasAttribute("data-interactive-cursor") || el.hasAttribute("data-cursor-dot")) return true;
  return false;
};

const parseRadius = (raw: string, w: number, h: number): number => {
  if (!raw) return 0;
  const val = Number.parseFloat(raw) || 0;
  return raw.trim().endsWith("%") ? (val / 100) * Math.min(w, h) : val;
};

const paintBoxStyle = (
  ctx: CanvasRenderingContext2D,
  st: CSSStyleDeclaration,
  rect: DOMRect,
  radius: number,
): void => {
  if (hasVisibleColor(st.backgroundColor)) {
    traceRoundedRect(ctx, rect.left, rect.top, rect.width, rect.height, radius);
    ctx.fillStyle = st.backgroundColor;
    ctx.fill();
  }
  const bw = Number.parseFloat(st.borderTopWidth) || 0;
  const bbw = Number.parseFloat(st.borderBottomWidth) || 0;
  const blw = Number.parseFloat(st.borderLeftWidth) || 0;
  if (bw > 0 && bw === bbw && bw === blw && hasVisibleColor(st.borderTopColor)) {
    traceRoundedRect(ctx, rect.left, rect.top, rect.width, rect.height, radius);
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

interface DomRegionPaintOptions {
  readonly doc: Document;
  readonly win: Window;
  readonly ctx: CanvasRenderingContext2D;
  readonly sampleRect: LiquidGlassSampleRect;
  readonly excludeEl: HTMLElement | null;
  readonly rootNode?: Element;
  readonly skipFixed?: boolean;
}

export const paintDomRegion = (options: DomRegionPaintOptions): void => {
  const { doc, win, ctx, sampleRect, excludeEl, rootNode, skipFixed = false } = options;
  const startNode = rootNode ?? doc.body;
  if (!startNode) return;

  const viewW = win.innerWidth;
  const viewH = win.innerHeight;
  const range = doc.createRange();
  const fixedQueue: Element[] = [];

  const walk = (el: Element, collectFixed: boolean): void => {
    const tag = el.tagName.toUpperCase();
    if (SKIP_TAGS.has(tag) || shouldSkipNode(el, excludeEl)) return;

    const st = win.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") return;
    const opacity = Number.parseFloat(st.opacity);
    if (opacity <= 0.01) return;

    if (collectFixed && st.position === "fixed") {
      if (!skipFixed) fixedQueue.push(el);
      return;
    }

    const rect = el.getBoundingClientRect();
    const isRoot = el === doc.body || el === startNode;
    const clips =
      st.overflow === "hidden" ||
      st.overflow === "clip" ||
      st.overflowX === "hidden" ||
      st.overflowY === "hidden";

    if (!isRoot && rect.width > 0 && rect.height > 0 && !rectsOverlap(rect, sampleRect, 14)) {
      if (clips || tag === "SECTION" || tag === "ARTICLE" || tag === "FOOTER" || tag === "ASIDE") {
        return;
      }
      if (tag === "IMG" || tag === "CANVAS" || tag === "SVG" || tag === "P" || tag === "SPAN") {
        return;
      }
    }

    ctx.save();
    ctx.globalAlpha *= opacity;

    const radius = parseRadius(st.borderTopLeftRadius, rect.width, rect.height);
    if (!isRoot && rect.width > 0 && rect.height > 0 && rectsOverlap(rect, sampleRect, 6)) {
      paintBoxStyle(ctx, st, rect, radius);
    }
    if (clips && rect.width > 0 && rect.height > 0) {
      traceRoundedRect(ctx, rect.left, rect.top, rect.width, rect.height, radius);
      ctx.clip();
    }

    if (tag === "IMG") {
      if (rectsOverlap(rect, sampleRect, 6)) {
        drawFittedImage(ctx, el as HTMLImageElement, rect, st.objectFit);
      }
    } else if (tag === "CANVAS") {
      const src = el as HTMLCanvasElement;
      if (src.width > 0 && src.height > 0 && rectsOverlap(rect, sampleRect, 6)) {
        try {
          ctx.drawImage(src, rect.left, rect.top, rect.width, rect.height);
        } catch (err: unknown) {
          if (!(err instanceof DOMException)) {
            console.warn("[LiquidGlassDomPaint] Canvas blit skipped:", err);
          }
        }
      }
    } else if (tag === "SVG") {
      if (rectsOverlap(rect, sampleRect, 6)) {
        drawSvgElement(ctx, el as SVGSVGElement, win);
      }
    } else {
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          drawTextNode(ctx, child as Text, st, range, viewW, viewH);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child as Element, collectFixed);
        }
      }
    }

    ctx.restore();
  };

  walk(startNode, true);
  if (!skipFixed) {
    for (const fixedEl of fixedQueue) {
      walk(fixedEl, false);
    }
  }
};
