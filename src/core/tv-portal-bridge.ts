import type { CursorController } from "../design-system/components/cursor.types";
import type { AudioEngineContract } from "./audio.types";

export interface StudioTvPortalBridge {
  readonly audio: AudioEngineContract;
  readonly cursor: CursorController;
  readonly closeToDrum: () => void;
  readonly exitTvFocus: () => void;
  readonly navigateInTv: (targetUrl: string) => void;
  readonly syncPointer?: (clientX: number, clientY: number) => void;
}

interface StudioTvHostWindow extends Window {
  __studioTvPortalBridge?: StudioTvPortalBridge | null;
}

const attachedDocuments = new WeakSet<Document>();
const guardedDocuments = new WeakSet<Document>();

const isRootPortalPath = (pathname: string): boolean =>
  pathname === "" || pathname === "/" || pathname === "/index.html";

export const registerStudioTvBridge = (bridge: StudioTvPortalBridge | null): void => {
  if (typeof window === "undefined") return;
  (window as StudioTvHostWindow).__studioTvPortalBridge = bridge;
};

export const getStudioTvBridge = (): StudioTvPortalBridge | null => {
  if (typeof window === "undefined" || window.parent === window) return null;
  try {
    return (window.parent as StudioTvHostWindow).__studioTvPortalBridge ?? null;
  } catch (err: unknown) {
    if (!(err instanceof DOMException)) {
      console.warn("[TvPortalBridge] Failed reading parent bridge:", err);
    }
    return null;
  }
};

export const installTvPortalGuard = (): boolean => {
  const bridge = getStudioTvBridge();
  if (!bridge || typeof document === "undefined") return false;

  if (isRootPortalPath(window.location.pathname)) {
    document.documentElement.style.display = "none";
    bridge.closeToDrum();
    return true;
  }

  document.documentElement.classList.add("in-tv-portal");
  if (guardedDocuments.has(document)) return false;
  guardedDocuments.add(document);

  const onCaptureClick = (event: MouseEvent): void => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const anchor = target?.closest<HTMLAnchorElement>("a[href]");
    if (!anchor) return;
    if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
    const rawHref = anchor.getAttribute("href");
    if (!rawHref || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) return;
    let dest: URL;
    try {
      dest = new URL(anchor.href, window.location.href);
    } catch {
      return;
    }
    if (dest.origin !== window.location.origin) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    bridge.cursor.setExpanded(false);
    bridge.cursor.setMuted(false);
    bridge.cursor.setPressed(false);
    bridge.cursor.setInverted(false);
    if (isRootPortalPath(dest.pathname)) {
      bridge.closeToDrum();
    } else {
      bridge.navigateInTv(`${dest.pathname}${dest.search}${dest.hash}`);
    }
  };

  const onBeforePrep = (event: Event): void => {
    const dest = (event as Event & { readonly to?: URL }).to;
    if (!dest || dest.origin !== window.location.origin) return;
    event.preventDefault();
    if (isRootPortalPath(dest.pathname)) bridge.closeToDrum();
    else bridge.navigateInTv(`${dest.pathname}${dest.search}${dest.hash}`);
  };

  const onPopState = (): void => {
    if (isRootPortalPath(window.location.pathname)) bridge.closeToDrum();
  };

  document.addEventListener("click", onCaptureClick, { capture: true });
  document.addEventListener("astro:before-preparation", onBeforePrep);
  window.addEventListener("popstate", onPopState);
  return false;
};

export const attachTvIframeBridge = (bridge: StudioTvPortalBridge): void => {
  if (typeof document === "undefined" || attachedDocuments.has(document)) return;
  if (installTvPortalGuard()) return;
  attachedDocuments.add(document);

  const hideEl = (selector: string): void => {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) el.style.display = "none";
  };
  hideEl("[data-interactive-cursor]");
  hideEl("[data-cursor-dot]");

  const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  document.documentElement.classList.add("in-tv-portal");
  if (isFinePointer) document.documentElement.classList.add("has-custom-cursor");

  bridge.cursor.setExpanded(false);
  bridge.cursor.setMuted(false);
  bridge.cursor.setPressed(false);
  bridge.cursor.setInverted(false);

  let cachedRect: DOMRect | null = null;
  let cachedW = Math.max(1, window.innerWidth);
  let cachedH = Math.max(1, window.innerHeight);
  const invalidateRect = (): void => {
    cachedRect = null;
    cachedW = Math.max(1, window.innerWidth);
    cachedH = Math.max(1, window.innerHeight);
  };
  const readFrameRect = (): DOMRect | null => {
    const frame = window.frameElement;
    if (!frame) return null;
    cachedRect ??= frame.getBoundingClientRect();
    return cachedRect;
  };
  const forwardPointer = (event: PointerEvent): void => {
    const rect = readFrameRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const x = rect.left + (event.clientX / cachedW) * rect.width;
    const y = rect.top + (event.clientY / cachedH) * rect.height;
    bridge.cursor.setInverted(false);
    bridge.cursor.moveTo(x, y);
  };
  const onPointerEnter = (event: PointerEvent): void => {
    invalidateRect();
    forwardPointer(event);
  };
  const onPointerDown = (): void => bridge.cursor.setPressed(true);
  const onPointerUp = (): void => bridge.cursor.setPressed(false);
  const onMouseLeave = (): void => {
    bridge.cursor.setExpanded(false);
    bridge.cursor.setMuted(false);
    bridge.cursor.setPressed(false);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    bridge.exitTvFocus();
  };

  window.addEventListener("pointermove", forwardPointer, { passive: true });
  document.documentElement.addEventListener("pointerenter", onPointerEnter, { passive: true });
  window.addEventListener("resize", invalidateRect, { passive: true });
  window.parent.addEventListener("resize", invalidateRect, { passive: true });
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  document.documentElement.addEventListener("mouseleave", onMouseLeave);
  window.addEventListener("keydown", onKeyDown);

  const cleanup = (): void => {
    attachedDocuments.delete(document);
    window.removeEventListener("pointermove", forwardPointer);
    document.documentElement.removeEventListener("pointerenter", onPointerEnter);
    window.removeEventListener("resize", invalidateRect);
    window.parent.removeEventListener("resize", invalidateRect);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    document.documentElement.removeEventListener("mouseleave", onMouseLeave);
    window.removeEventListener("keydown", onKeyDown);
  };

  window.addEventListener("pagehide", cleanup, { once: true });
  document.addEventListener("astro:before-swap", cleanup, { once: true });
};
