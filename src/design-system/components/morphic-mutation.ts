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

const buildFilterSvg = (fid: string): string =>
  `<feGaussianBlur id="${fid}-b" in="SourceGraphic" stdDeviation="0 0" result="blur" /><feColorMatrix id="${fid}-m" in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="core" /><feOffset id="${fid}-t" in="core" dx="0" dy="0" result="top" /><feOffset id="${fid}-bt" in="core" dx="0" dy="0" result="bot" /><feMerge result="c"><feMergeNode in="top" /><feMergeNode in="bot" /></feMerge><feColorMatrix in="c" mode="matrix" values="0 0 0 0 0  0 0 0 0 0.8  0 0 0 0 1  0 0 0 0.95 0" result="cyan" /><feColorMatrix in="core" mode="matrix" values="0 0 0 0 0.08  0 0 0 0 0.08  0 0 0 0 0.08  0 0 0 1 0" result="black" /><feMerge><feMergeNode in="cyan" /><feMergeNode in="black" /></feMerge>`;

const createFilterRef = (defs: SVGDefsElement, fid: string): FilterRef | null => {
  if (!document.getElementById(fid)) {
    const f = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    f.setAttribute("id", fid);
    f.setAttribute("x", "-80%");
    f.setAttribute("y", "-80%");
    f.setAttribute("width", "260%");
    f.setAttribute("height", "260%");
    f.setAttribute("color-interpolation-filters", "sRGB");
    f.innerHTML = buildFilterSvg(fid);
    defs.appendChild(f);
  }
  const blur = document.getElementById(`${fid}-b`);
  const matrix = document.getElementById(`${fid}-m`);
  if (!(blur instanceof SVGFEGaussianBlurElement) || !(matrix instanceof SVGFEColorMatrixElement)) {
    return null;
  }
  return {
    id: fid,
    blur,
    matrix,
    top: document.getElementById(`${fid}-t`) as SVGFEOffsetElement | null,
    bot: document.getElementById(`${fid}-bt`) as SVGFEOffsetElement | null,
  };
};

const wrapMutantWord = (el: HTMLElement, targetWord: string): HTMLElement[] => {
  const current = el.textContent ?? "";
  if (!current.includes(targetWord)) return [];
  const [before] = current.split(targetWord);
  const spans = targetWord
    .split("")
    .map((c, i) => `<span class="morphic-char" data-idx="${i}">${c}</span>`)
    .join("");
  el.innerHTML = `${before}<span class="morphic-mutant-word">${spans}</span>`;
  return Array.from(el.querySelectorAll<HTMLElement>(".morphic-char"));
};

const createCharTimeline = (
  charEl: HTMLElement,
  ref: FilterRef,
  font: MutantFont,
): gsap.core.Timeline => {
  const s = { blur: 0, slope: 1, offset: 0, dx: 0, dy: 0 };
  let prevB = "";
  let prevM = "";
  const tl = gsap.timeline();

  const sync = () => {
    const b = `${s.blur.toFixed(1)} ${s.blur.toFixed(1)}`;
    if (b !== prevB) {
      prevB = b;
      ref.blur.setAttribute("stdDeviation", b);
    }
    const m = `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${s.slope.toFixed(1)} ${s.offset.toFixed(1)}`;
    if (m !== prevM) {
      prevM = m;
      ref.matrix.setAttribute("values", m);
    }
    ref.top?.setAttribute("dx", s.dx.toFixed(1));
    ref.top?.setAttribute("dy", s.dy.toFixed(1));
    ref.bot?.setAttribute("dx", (-s.dx * 0.35).toFixed(1));
    ref.bot?.setAttribute("dy", (-s.dy * 0.7).toFixed(1));
  };

  const resetFilter = () => {
    charEl.style.filter = "none";
    ref.blur.setAttribute("stdDeviation", "0 0");
    ref.matrix.setAttribute("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0");
  };

  tl.to(
    s,
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
      onUpdate: sync,
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
    s,
    {
      blur: 0,
      slope: 1,
      offset: 0,
      dx: 0,
      dy: 0,
      duration: 0.21,
      ease: "power2.in",
      onUpdate: sync,
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
    .map((_, i) => createFilterRef(defs, `${nodes.filterId}-c${i}`))
    .filter((r): r is FilterRef => r !== null);
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

    charEls.forEach((charEl, i) => {
      const ref = refs[i];
      if (!ref) return;
      const font = MUTANT_FONTS[(i + wave) % (MUTANT_FONTS.length - 1)] ?? "Pilowlava";
      master.add(createCharTimeline(charEl, ref, font), i * 0.08);
    });
  };

  setTimeout(runWave, 850);
  const intervalId = window.setInterval(() => {
    if (!document.hidden) runWave();
  }, 4200);

  nodes.element.querySelector(".morphic-mutant-word")?.addEventListener("mouseenter", runWave);
  nodes.element.addEventListener(
    "astro:before-swap",
    () => {
      window.clearInterval(intervalId);
    },
    { once: true },
  );
};
