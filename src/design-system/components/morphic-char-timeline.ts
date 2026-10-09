import { gsap } from "gsap";
import type { MutantFont } from "./morphic-mutation";

export interface FilterRef {
  readonly id: string;
  readonly blur: SVGFEGaussianBlurElement;
  readonly matrix: SVGFEColorMatrixElement;
  readonly top: SVGFEOffsetElement | null;
  readonly bot: SVGFEOffsetElement | null;
}

const buildFilterSvg = (filterId: string): string =>
  `<feGaussianBlur id="${filterId}-b" in="SourceGraphic" stdDeviation="0 0" result="blur" /><feColorMatrix id="${filterId}-m" in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="core" /><feOffset id="${filterId}-t" in="core" dx="0" dy="0" result="top" /><feOffset id="${filterId}-bt" in="core" dx="0" dy="0" result="bot" /><feMerge result="c"><feMergeNode in="top" /><feMergeNode in="bot" /></feMerge><feColorMatrix in="c" mode="matrix" values="0 0 0 0 0  0 0 0 0 0.8  0 0 0 0 1  0 0 0 0.95 0" result="cyan" /><feColorMatrix in="core" mode="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" result="white" /><feMerge><feMergeNode in="cyan" /><feMergeNode in="white" /></feMerge>`;

export const createFilterRef = (defs: SVGDefsElement, filterId: string): FilterRef | null => {
  if (!document.getElementById(filterId)) {
    const filterEl = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filterEl.setAttribute("id", filterId);
    filterEl.setAttribute("x", "-80%");
    filterEl.setAttribute("y", "-80%");
    filterEl.setAttribute("width", "260%");
    filterEl.setAttribute("height", "260%");
    filterEl.setAttribute("color-interpolation-filters", "sRGB");
    filterEl.innerHTML = buildFilterSvg(filterId);
    defs.appendChild(filterEl);
  }
  const blur = document.getElementById(`${filterId}-b`);
  const matrix = document.getElementById(`${filterId}-m`);
  if (!(blur instanceof SVGFEGaussianBlurElement && matrix instanceof SVGFEColorMatrixElement)) {
    return null;
  }
  const top = document.getElementById(`${filterId}-t`);
  const bot = document.getElementById(`${filterId}-bt`);
  return {
    id: filterId,
    blur,
    matrix,
    top: top instanceof SVGFEOffsetElement ? top : null,
    bot: bot instanceof SVGFEOffsetElement ? bot : null,
  };
};

export const createCharTimeline = (
  charEl: HTMLElement,
  ref: FilterRef,
  font: MutantFont,
): gsap.core.Timeline => {
  const animState = { blur: 0, slope: 1, offset: 0, dx: 0, dy: 0 };
  let prevBlur = "";
  let prevMatrix = "";
  let prevDx = "";
  let prevDy = "";
  const tl = gsap.timeline();

  const syncFilter = () => {
    const blurFormatted = `${animState.blur.toFixed(1)} ${animState.blur.toFixed(1)}`;
    if (blurFormatted !== prevBlur) {
      prevBlur = blurFormatted;
      ref.blur.setAttribute("stdDeviation", blurFormatted);
    }
    const matrixFormatted = `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${animState.slope.toFixed(1)} ${animState.offset.toFixed(1)}`;
    if (matrixFormatted !== prevMatrix) {
      prevMatrix = matrixFormatted;
      ref.matrix.setAttribute("values", matrixFormatted);
    }
    const dxFormatted = animState.dx.toFixed(1);
    const dyFormatted = animState.dy.toFixed(1);
    if (dxFormatted !== prevDx || dyFormatted !== prevDy) {
      prevDx = dxFormatted;
      prevDy = dyFormatted;
      ref.top?.setAttribute("dx", dxFormatted);
      ref.top?.setAttribute("dy", dyFormatted);
      ref.bot?.setAttribute("dx", (-animState.dx * 0.35).toFixed(1));
      ref.bot?.setAttribute("dy", (-animState.dy * 0.7).toFixed(1));
    }
  };

  const resetFilter = () => {
    charEl.style.filter = "none";
    ref.blur.setAttribute("stdDeviation", "0 0");
    ref.matrix.setAttribute("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0");
    ref.top?.setAttribute("dx", "0");
    ref.top?.setAttribute("dy", "0");
    ref.bot?.setAttribute("dx", "0");
    ref.bot?.setAttribute("dy", "0");
  };

  tl.to(
    animState,
    {
      blur: 12,
      slope: 22,
      offset: -9,
      dx: -2.4,
      dy: -1.2,
      duration: 0.22,
      ease: "power2.out",
      onStart: () => {
        charEl.style.filter = `url(#${ref.id})`;
      },
      onUpdate: syncFilter,
    },
    0,
  );
  tl.to(charEl, { y: -4.5, scale: 1.04, duration: 0.22, ease: "power2.out" }, 0);
  tl.call(
    () => {
      charEl.style.fontFamily = `'${font}', var(--font-display)`;
      charEl.style.fontWeight = font === "Author" ? "900" : "400";
    },
    undefined,
    0.22,
  );
  tl.to(
    animState,
    {
      blur: 0,
      slope: 1,
      offset: 0,
      dx: 0,
      dy: 0,
      duration: 0.26,
      ease: "power2.out",
      onUpdate: syncFilter,
      onComplete: resetFilter,
    },
    0.22,
  );
  tl.to(charEl, { y: 0, scale: 1, duration: 0.26, ease: "power2.out" }, 0.22);
  return tl;
};
