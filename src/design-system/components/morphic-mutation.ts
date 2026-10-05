import { gsap } from "gsap";
import type { MorphicNodes } from "./morphic-animation";

export const MUTANT_FONTS = [
  "Pilowlava",
  "Lithops",
  "Kaeru Kaeru",
  "Flor de Ruina",
  "Karrik",
  "Author",
] as const;

export type MutantFont = (typeof MUTANT_FONTS)[number];

interface FilterRef {
  readonly id: string;
  readonly blur: SVGFEGaussianBlurElement;
  readonly matrix: SVGFEColorMatrixElement;
  readonly top: SVGFEOffsetElement | null;
  readonly bot: SVGFEOffsetElement | null;
}

const buildFilterSvg = (filterId: string): string =>
  `<feGaussianBlur id="${filterId}-b" in="SourceGraphic" stdDeviation="0 0" result="blur" /><feColorMatrix id="${filterId}-m" in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="core" /><feOffset id="${filterId}-t" in="core" dx="0" dy="0" result="top" /><feOffset id="${filterId}-bt" in="core" dx="0" dy="0" result="bot" /><feMerge result="c"><feMergeNode in="top" /><feMergeNode in="bot" /></feMerge><feColorMatrix in="c" mode="matrix" values="0 0 0 0 0  0 0 0 0 0.8  0 0 0 0 1  0 0 0 0.95 0" result="cyan" /><feColorMatrix in="core" mode="matrix" values="0 0 0 0 0.08  0 0 0 0 0.08  0 0 0 0 0.08  0 0 0 1 0" result="black" /><feMerge><feMergeNode in="cyan" /><feMergeNode in="black" /></feMerge>`;

const createFilterRef = (defs: SVGDefsElement, filterId: string): FilterRef | null => {
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
  const blurNode = document.getElementById(`${filterId}-b`);
  const matrixNode = document.getElementById(`${filterId}-m`);
  const isValid =
    blurNode instanceof SVGFEGaussianBlurElement && matrixNode instanceof SVGFEColorMatrixElement;
  if (!isValid) return null;

  const top = document.getElementById(`${filterId}-t`);
  const bot = document.getElementById(`${filterId}-bt`);
  return {
    id: filterId,
    blur: blurNode,
    matrix: matrixNode,
    top: top instanceof SVGFEOffsetElement ? top : null,
    bot: bot instanceof SVGFEOffsetElement ? bot : null,
  };
};

const wrapMutantWord = (element: HTMLElement, targetWord: string): HTMLElement[] => {
  const currentText = element.textContent ?? "";
  const wordIndex = currentText.indexOf(targetWord);
  if (wordIndex === -1) return [];

  const textBefore = currentText.slice(0, wordIndex);
  const textAfter = currentText.slice(wordIndex + targetWord.length);
  const charSpans = targetWord
    .split("")
    .map((char, charIdx) => `<span class="morphic-char" data-idx="${charIdx}">${char}</span>`)
    .join("");

  element.innerHTML = `${textBefore}<span class="morphic-mutant-word">${charSpans}</span>${textAfter}`;
  return Array.from(element.querySelectorAll<HTMLElement>(".morphic-char"));
};

const createCharTimeline = (
  charEl: HTMLElement,
  ref: FilterRef,
  font: MutantFont,
): gsap.core.Timeline => {
  const animState = { blur: 0, slope: 1, offset: 0, dx: 0, dy: 0 };
  let prevBlur = "";
  let prevMatrix = "";
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
    ref.top?.setAttribute("dx", animState.dx.toFixed(1));
    ref.top?.setAttribute("dy", animState.dy.toFixed(1));
    ref.bot?.setAttribute("dx", (-animState.dx * 0.35).toFixed(1));
    ref.bot?.setAttribute("dy", (-animState.dy * 0.7).toFixed(1));
  };

  const resetFilter = () => {
    charEl.style.filter = "none";
    ref.blur.setAttribute("stdDeviation", "0 0");
    ref.matrix.setAttribute("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0");
  };

  tl.to(
    animState,
    {
      blur: 13,
      slope: 24,
      offset: -10,
      dx: -2.8,
      dy: -1.4,
      duration: 0.21,
      ease: "power2.out",
      onStart: () => {
        charEl.style.filter = `url(#${ref.id})`;
      },
      onUpdate: syncFilter,
    },
    0,
  );
  tl.to(charEl, { y: -5, scale: 1.05, duration: 0.21, ease: "power2.out" }, 0);
  tl.call(
    () => {
      charEl.style.fontFamily = `'${font}', var(--font-display)`;
      charEl.style.fontWeight = font === "Author" ? "900" : "400";
    },
    undefined,
    0.21,
  );
  tl.to(
    animState,
    {
      blur: 0,
      slope: 1,
      offset: 0,
      dx: 0,
      dy: 0,
      duration: 0.21,
      ease: "power2.in",
      onUpdate: syncFilter,
      onComplete: resetFilter,
    },
    0.21,
  );
  tl.to(charEl, { y: 0, scale: 1, duration: 0.21, ease: "power2.in" }, 0.21);
  return tl;
};

export const startMutationLoop = (nodes: MorphicNodes): void => {
  const targetWord = nodes.mutateWord;
  const defs = nodes.blurNode.closest("svg")?.querySelector("defs");
  if (!targetWord || !(defs instanceof SVGDefsElement)) return;

  const charEls = wrapMutantWord(nodes.element, targetWord);
  if (charEls.length === 0) return;

  const refs = charEls
    .map((_, charIdx) => createFilterRef(defs, `${nodes.filterId}-c${charIdx}`))
    .filter((filterRef): filterRef is FilterRef => filterRef !== null);
  if (refs.length !== charEls.length) return;

  let wave = 0;
  let active = false;

  const runWave = () => {
    if (active) return;
    active = true;
    const master = gsap.timeline({
      onComplete: () => {
        active = false;
        wave = (wave + 1) % MUTANT_FONTS.length;
      },
    });
    charEls.forEach((charEl, charIdx) => {
      const ref = refs[charIdx];
      if (!ref) return;
      const font = MUTANT_FONTS[(charIdx + wave) % MUTANT_FONTS.length] ?? "Pilowlava";
      master.add(createCharTimeline(charEl, ref, font), charIdx * 0.08);
    });
  };

  setTimeout(runWave, 850);
  const intervalId = window.setInterval(() => {
    if (!document.hidden) runWave();
  }, 4200);

  const mutantWordEl = nodes.element.querySelector<HTMLElement>(".morphic-mutant-word");
  mutantWordEl?.addEventListener("mouseenter", runWave);

  const cleanup = () => {
    window.clearInterval(intervalId);
    mutantWordEl?.removeEventListener("mouseenter", runWave);
    document.removeEventListener("astro:before-swap", cleanup);
  };

  document.addEventListener("astro:before-swap", cleanup, { once: true });
};
