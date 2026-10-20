import { getHiddenBottomPath } from "./fluid-curve-math";

export interface FluidOverlayHandle {
  readonly overlayElement: HTMLElement;
  readonly leadPathElement: SVGPathElement;
  readonly bodyPathElement: SVGPathElement;
  setPointerEvents: (active: boolean) => void;
  setLeadPath: (d: string) => void;
  setBodyPath: (d: string) => void;
  destroy: () => void;
}

const OVERLAY_ID = "fluid-transition-overlay";
const SVG_NS = "http://www.w3.org/2000/svg";

let activeHandle: FluidOverlayHandle | null = null;

export const getOrCreateFluidOverlay = (): FluidOverlayHandle => {
  if (activeHandle && document.body.contains(activeHandle.overlayElement)) {
    return activeHandle;
  }

  let overlayElement = document.getElementById(OVERLAY_ID);
  if (!overlayElement) {
    overlayElement = document.createElement("div");
    overlayElement.id = OVERLAY_ID;
    overlayElement.setAttribute("aria-hidden", "true");
    overlayElement.style.position = "fixed";
    overlayElement.style.inset = "0";
    overlayElement.style.zIndex = "999999";
    overlayElement.style.pointerEvents = "none";
    overlayElement.style.overflow = "hidden";
    overlayElement.style.willChange = "transform";
    document.body.appendChild(overlayElement);
  }

  let svgElement = overlayElement.querySelector<SVGSVGElement>("svg");
  let leadPathElement = overlayElement.querySelector<SVGPathElement>(".fluid-layer-lead");
  let bodyPathElement = overlayElement.querySelector<SVGPathElement>(".fluid-layer-body");

  if (!svgElement || !leadPathElement || !bodyPathElement) {
    overlayElement.innerHTML = "";
    svgElement = document.createElementNS(SVG_NS, "svg");
    svgElement.setAttribute("viewBox", "0 0 100 100");
    svgElement.setAttribute("preserveAspectRatio", "none");
    svgElement.style.width = "100%";
    svgElement.style.height = "100%";
    svgElement.style.display = "block";

    leadPathElement = document.createElementNS(SVG_NS, "path");
    leadPathElement.setAttribute("class", "fluid-layer-lead");
    leadPathElement.setAttribute("d", getHiddenBottomPath());
    leadPathElement.setAttribute("fill", "#1a1714");
    leadPathElement.setAttribute("vector-effect", "non-scaling-stroke");

    bodyPathElement = document.createElementNS(SVG_NS, "path");
    bodyPathElement.setAttribute("class", "fluid-layer-body");
    bodyPathElement.setAttribute("d", getHiddenBottomPath());
    bodyPathElement.setAttribute("fill", "var(--color-bg, #ffffff)");
    bodyPathElement.setAttribute("vector-effect", "non-scaling-stroke");

    svgElement.appendChild(leadPathElement);
    svgElement.appendChild(bodyPathElement);
    overlayElement.appendChild(svgElement);
  }

  const setPointerEvents = (active: boolean) => {
    if (overlayElement) {
      overlayElement.style.pointerEvents = active ? "auto" : "none";
    }
  };

  const setLeadPath = (d: string) => {
    if (leadPathElement) {
      leadPathElement.setAttribute("d", d);
    }
  };

  const setBodyPath = (d: string) => {
    if (bodyPathElement) {
      bodyPathElement.setAttribute("d", d);
    }
  };

  const destroy = () => {
    overlayElement?.parentElement?.removeChild(overlayElement);
    activeHandle = null;
  };

  activeHandle = {
    overlayElement,
    leadPathElement,
    bodyPathElement,
    setPointerEvents,
    setLeadPath,
    setBodyPath,
    destroy,
  };

  return activeHandle;
};
