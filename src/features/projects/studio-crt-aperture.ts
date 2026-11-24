import { type PerspectiveCamera, Vector3 } from "three";
import type { CursorController } from "../../design-system/components/cursor.types";
import type { StudioFluidWaveVec } from "./studio-crt-fluid-wipe";

const [CRT_MID_Y, CRT_HALF_W, CRT_HALF_H, SIDE_STEPS, CUTOUT_RATE] = [0.165, 1.026, 0.8557, 8, 18];
const [APERTURE_TOP_Y, APERTURE_BOT_Y] = [1.0207, -0.6907];
export const CRT_VIRTUAL_W = 1280;
export const CRT_VIRTUAL_H = 1068;

const buildApertureRing3D = (): readonly Vector3[] => {
  const pts2d: [number, number][] = [];
  const pushLin = (x0: number, y0: number, x1: number, y1: number, n: number): void => {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      pts2d.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  };
  const [w, top, bot] = [CRT_HALF_W, APERTURE_TOP_Y, APERTURE_BOT_Y];
  pushLin(-w, top, w, top, SIDE_STEPS);
  pushLin(w, top, w, bot, SIDE_STEPS);
  pushLin(w, bot, -w, bot, SIDE_STEPS);
  pushLin(-w, bot, -w, top, SIDE_STEPS);
  return pts2d.map(([x, y]) => {
    const u = x / CRT_HALF_W;
    const v = (y - CRT_MID_Y) / CRT_HALF_H;
    return new Vector3(x, y, 0.8218 + 0.3024 * Math.cos(u * 1.22) * Math.cos(v * 1.06));
  });
};

const APERTURE_RING_3D = buildApertureRing3D();

export interface CrtPortalApertureSync {
  readonly sync: (portalEl: HTMLElement, camera: PerspectiveCamera) => void;
}

export interface StudioTvPortalVisuals {
  readonly mode: number;
  readonly cutout: number;
  readonly wave: StudioFluidWaveVec;
  readonly animating: boolean;
}

export const isRootPortalRoute = (rawUrl: string): boolean => {
  if (!rawUrl || rawUrl === "about:blank") return false;
  try {
    const u = new URL(rawUrl, window.location.origin);
    return u.origin === window.location.origin && /^\/?(index\.html)?$/.test(u.pathname);
  } catch {
    return rawUrl === "/";
  }
};

export const replacePortalFrameUrl = (iframeEl: HTMLIFrameElement, targetUrl: string): void => {
  const next =
    targetUrl === "about:blank" ? targetUrl : new URL(targetUrl, window.location.origin).href;
  try {
    if (iframeEl.contentWindow) iframeEl.contentWindow.location.replace(next);
    else iframeEl.src = next;
  } catch (err: unknown) {
    if (!(err instanceof DOMException)) console.warn("[StudioTvPortal] Nav fallback:", err);
    iframeEl.src = next;
  }
};

export const readPortalFrameHref = (iframeEl: HTMLIFrameElement): string => {
  try {
    return iframeEl.contentWindow?.location.href ?? "";
  } catch (err: unknown) {
    if (!(err instanceof DOMException)) console.warn("[StudioTvPortal] Frame inspect:", err);
    return "";
  }
};

export const resetPortalCursor = (cursor: CursorController, clearInv = false): void => {
  cursor.setExpanded(false);
  cursor.setMuted(false);
  cursor.setPressed(false);
  if (clearInv) cursor.setInverted(false);
};

export const syncPortalDomVisibility = (
  container: HTMLElement,
  portalEl: HTMLElement,
  hasPage: boolean,
  live: boolean,
  tuning = false,
): void => {
  portalEl.hidden = !hasPage;
  portalEl.classList.toggle("is-live", hasPage && live);
  portalEl.classList.toggle("is-parked", hasPage && !live);
  portalEl.classList.toggle("is-tuning", hasPage && tuning);
  container.classList.toggle("has-live-portal", hasPage && live && !tuning);
};

export const stepPortalVisualState = (
  state: { displayMode: 0 | 1; live: boolean; cutout: number },
  dt: number,
  poweredOn: boolean,
  reducedMotion: boolean,
  wave: StudioFluidWaveVec,
  wipeActive: boolean,
): StudioTvPortalVisuals => {
  const tCut = state.live && poweredOn ? 1 : 0;
  if (reducedMotion || dt <= 0) {
    state.cutout = tCut;
  } else {
    state.cutout += (tCut - state.cutout) * (1 - Math.exp(-CUTOUT_RATE * dt));
    if (Math.abs(tCut - state.cutout) < 0.004) state.cutout = tCut;
  }
  return {
    mode: state.displayMode,
    cutout: state.cutout,
    wave,
    animating: state.cutout !== tCut || wipeActive,
  };
};

export interface CrtPortalDom {
  readonly portalEl: HTMLDivElement;
  readonly iframeEl: HTMLIFrameElement;
}

export const createCrtPortalDom = (container: HTMLElement): CrtPortalDom => {
  const portalEl = document.createElement("div");
  portalEl.className = "studio-tv-portal";
  portalEl.hidden = true;
  portalEl.setAttribute("data-studio-tv-portal", "");
  const iframeEl = document.createElement("iframe");
  iframeEl.className = "studio-tv-portal-frame";
  iframeEl.title = "Contenido interactivo del portafolio en el televisor";
  iframeEl.src = "about:blank";
  const glassEl = document.createElement("div");
  glassEl.className = "studio-tv-portal-glass";
  glassEl.setAttribute("aria-hidden", "true");
  portalEl.append(iframeEl, glassEl);
  container.appendChild(portalEl);
  return { portalEl, iframeEl };
};

export const createCrtPortalAperture = (): CrtPortalApertureSync => {
  const scratch = new Vector3();
  const projectedX = new Float64Array(APERTURE_RING_3D.length);
  const projectedY = new Float64Array(APERTURE_RING_3D.length);
  let lastKey = "";
  const sync = (portalEl: HTMLElement, camera: PerspectiveCamera): void => {
    const [viewW, viewH] = [window.innerWidth, window.innerHeight];
    if (viewW <= 0 || viewH <= 0) return;
    if (viewW < 768) {
      if (lastKey === "mobile-sheet") return;
      lastKey = "mobile-sheet";
      portalEl.classList.add("is-mobile-sheet");
      portalEl.style.cssText = "";
      const frame = portalEl.firstElementChild as HTMLElement | null;
      if (frame) frame.style.transform = "";
      return;
    }
    portalEl.classList.remove("is-mobile-sheet");
    camera.updateMatrixWorld();
    let [minX, minY] = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    let [maxX, maxY] = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (let i = 0; i < APERTURE_RING_3D.length; i++) {
      const pt = APERTURE_RING_3D[i];
      if (!pt) continue;
      scratch.copy(pt).project(camera);
      const sx = (scratch.x * 0.5 + 0.5) * viewW;
      const sy = (1 - (scratch.y * 0.5 + 0.5)) * viewH;
      [projectedX[i], projectedY[i]] = [sx, sy];
      if (sx < minX) minX = sx;
      if (sx > maxX) maxX = sx;
      if (sy < minY) minY = sy;
      if (sy > maxY) maxY = sy;
    }
    const width = Math.max(120, maxX - minX);
    const height = Math.max(120, maxY - minY);
    const key = `${minX.toFixed(1)}|${minY.toFixed(1)}|${width.toFixed(1)}|${height.toFixed(1)}`;
    if (key === lastKey) return;
    lastKey = key;

    portalEl.style.left = `${minX.toFixed(1)}px`;
    portalEl.style.top = `${minY.toFixed(1)}px`;
    portalEl.style.width = `${width.toFixed(1)}px`;
    portalEl.style.height = `${height.toFixed(1)}px`;
    const frame = portalEl.firstElementChild as HTMLElement | null;
    if (frame) {
      frame.style.transform = `scale(${(width / CRT_VIRTUAL_W).toFixed(5)}, ${(height / CRT_VIRTUAL_H).toFixed(5)})`;
    }

    const polyParts: string[] = [];
    for (let i = 0; i < APERTURE_RING_3D.length; i++) {
      const rx = ((((projectedX[i] ?? minX) - minX) / width) * 100).toFixed(2);
      const ry = ((((projectedY[i] ?? minY) - minY) / height) * 100).toFixed(2);
      polyParts.push(`${rx}% ${ry}%`);
    }
    portalEl.style.clipPath = `polygon(${polyParts.join(",")})`;
  };

  return { sync };
};
