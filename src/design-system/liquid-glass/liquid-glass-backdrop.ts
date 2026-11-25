import { hasVisibleColor } from "../../features/projects/studio-portal-snapshot-paint";
import type { LiquidGlassSampleRect } from "./liquid-glass.types";
import { paintDomRegion } from "./liquid-glass-dom-paint";
import { drawLiveCanvasRegion } from "./liquid-glass-live-canvas";

const paintConsentSkyFallback = (
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
): void => {
  const grad = ctx.createLinearGradient(0, 0, viewW * 0.72, viewH);
  grad.addColorStop(0, "#0065f0");
  grad.addColorStop(0.38, "#1682ff");
  grad.addColorStop(0.62, "#60b0ff");
  grad.addColorStop(0.82, "#c2e2ff");
  grad.addColorStop(1, "#ffffff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
};

const paintLiveTvPortalRegion = (
  ctx: CanvasRenderingContext2D,
  sampleRect: LiquidGlassSampleRect,
): void => {
  const portalEl = document.querySelector<HTMLElement>("[data-studio-tv-portal].is-live");
  if (!portalEl || portalEl.hidden) return;
  const portalRect = portalEl.getBoundingClientRect();
  const overlaps =
    portalRect.right > sampleRect.left &&
    portalRect.left < sampleRect.left + sampleRect.width &&
    portalRect.bottom > sampleRect.top &&
    portalRect.top < sampleRect.top + sampleRect.height;
  if (!overlaps) return;

  const iframe = portalEl.querySelector<HTMLIFrameElement>("iframe");
  if (!iframe) return;
  let win: Window | null = null;
  let doc: Document | null = null;
  try {
    win = iframe.contentWindow;
    doc = iframe.contentDocument;
  } catch {
    return;
  }
  if (!win || !doc?.body) return;

  const virtualW = Math.max(1, win.innerWidth);
  const virtualH = Math.max(1, win.innerHeight);
  const scaleX = portalRect.width / virtualW;
  const scaleY = portalRect.height / virtualH;
  if (scaleX <= 0.01 || scaleY <= 0.01) return;

  const localSample: LiquidGlassSampleRect = {
    left: (sampleRect.left - portalRect.left) / scaleX,
    top: (sampleRect.top - portalRect.top) / scaleY,
    width: sampleRect.width / scaleX,
    height: sampleRect.height / scaleY,
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(portalRect.left, portalRect.top, portalRect.width, portalRect.height);
  ctx.clip();
  ctx.translate(portalRect.left, portalRect.top);
  ctx.scale(scaleX, scaleY);
  const bg = win.getComputedStyle(doc.body).backgroundColor;
  ctx.fillStyle = hasVisibleColor(bg) ? bg : "#ffffff";
  ctx.fillRect(localSample.left, localSample.top, localSample.width, localSample.height);
  paintDomRegion({
    doc,
    win,
    ctx,
    sampleRect: localSample,
    excludeEl: null,
  });
  ctx.restore();
};

let cachedConsentEl: HTMLElement | null = null;
let cachedProjectsEl: HTMLElement | null = null;
let cachedStudioCanvas: HTMLCanvasElement | null = null;

const getConsentEl = (): HTMLElement | null => {
  if (cachedConsentEl?.isConnected) return cachedConsentEl;
  cachedConsentEl = document.querySelector<HTMLElement>("[data-consent-screen]");
  return cachedConsentEl;
};

const getProjectsNodes = (): {
  readonly projectsEl: HTMLElement | null;
  readonly studioCanvas: HTMLCanvasElement | null;
} => {
  if (!cachedProjectsEl?.isConnected) {
    cachedProjectsEl = document.querySelector<HTMLElement>("[data-projects-section]");
    cachedStudioCanvas = null;
  }
  if (cachedProjectsEl && !cachedStudioCanvas?.isConnected) {
    cachedStudioCanvas = cachedProjectsEl.querySelector<HTMLCanvasElement>("[data-drum-canvas]");
  }
  return { projectsEl: cachedProjectsEl, studioCanvas: cachedStudioCanvas };
};

export const paintLiquidGlassBackdrop = (
  targetCanvas: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  sampleRect: LiquidGlassSampleRect,
  dpr: number,
  excludeEl: HTMLElement | null,
  skipFixedDom: boolean,
): void => {
  const pxW = Math.max(1, Math.round(sampleRect.width * dpr));
  const pxH = Math.max(1, Math.round(sampleRect.height * dpr));
  if (targetCanvas.width !== pxW || targetCanvas.height !== pxH) {
    targetCanvas.width = pxW;
    targetCanvas.height = pxH;
  }

  targetCtx.setTransform(1, 0, 0, 1, 0, 0);
  targetCtx.fillStyle = "#ffffff";
  targetCtx.fillRect(0, 0, pxW, pxH);

  targetCtx.setTransform(dpr, 0, 0, dpr, -sampleRect.left * dpr, -sampleRect.top * dpr);

  const consentEl = getConsentEl();
  const consentVisible =
    consentEl !== null &&
    consentEl.style.display !== "none" &&
    !document.documentElement.classList.contains("skip-consent");
  if (consentVisible && consentEl) {
    if (consentEl.dataset.backdropActive === "true") {
      paintConsentSkyFallback(targetCtx, window.innerWidth, window.innerHeight);
    }
    const cloudCanvas = consentEl.querySelector<HTMLCanvasElement>("[data-cloud-canvas]");
    if (cloudCanvas) {
      drawLiveCanvasRegion(targetCtx, cloudCanvas, sampleRect);
    }
    const contentEl = consentEl.querySelector<HTMLElement>("[data-consent-content]");
    if (contentEl && excludeEl !== contentEl) {
      paintDomRegion({
        doc: document,
        win: window,
        ctx: targetCtx,
        sampleRect,
        excludeEl,
        rootNode: contentEl,
        skipFixed: true,
      });
    }
    return;
  }

  const { projectsEl, studioCanvas } = getProjectsNodes();
  if (projectsEl && !projectsEl.hidden) {
    if (studioCanvas) {
      drawLiveCanvasRegion(targetCtx, studioCanvas, sampleRect);
    }
    paintLiveTvPortalRegion(targetCtx, sampleRect);
    return;
  }

  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  if (hasVisibleColor(bodyBg) && bodyBg !== "rgb(255, 255, 255)") {
    targetCtx.fillStyle = bodyBg;
    targetCtx.fillRect(sampleRect.left, sampleRect.top, sampleRect.width, sampleRect.height);
  }
  paintDomRegion({
    doc: document,
    win: window,
    ctx: targetCtx,
    sampleRect,
    excludeEl,
    skipFixed: skipFixedDom,
  });
};
