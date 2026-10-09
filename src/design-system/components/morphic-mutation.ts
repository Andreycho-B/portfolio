import { gsap } from "gsap";
import type { MorphicNodes } from "./morphic-animation";
import { createCharTimeline, createFilterRef, type FilterRef } from "./morphic-char-timeline";

export const MUTANT_FONTS = [
  "Pilowlava",
  "Lithops",
  "Kaeru Kaeru",
  "Flor de Ruina",
  "Karrik",
  "Author",
] as const;

export type MutantFont = (typeof MUTANT_FONTS)[number];

export const MUTATION_MATRIX: readonly (readonly MutantFont[])[] = [
  [
    "Pilowlava",
    "Author",
    "Flor de Ruina",
    "Kaeru Kaeru",
    "Karrik",
    "Lithops",
    "Author",
    "Pilowlava",
  ],
  [
    "Kaeru Kaeru",
    "Lithops",
    "Author",
    "Pilowlava",
    "Flor de Ruina",
    "Karrik",
    "Kaeru Kaeru",
    "Lithops",
  ],
  [
    "Flor de Ruina",
    "Karrik",
    "Pilowlava",
    "Lithops",
    "Kaeru Kaeru",
    "Author",
    "Flor de Ruina",
    "Karrik",
  ],
  [
    "Lithops",
    "Kaeru Kaeru",
    "Karrik",
    "Flor de Ruina",
    "Author",
    "Pilowlava",
    "Lithops",
    "Kaeru Kaeru",
  ],
  [
    "Author",
    "Flor de Ruina",
    "Kaeru Kaeru",
    "Karrik",
    "Lithops",
    "Author",
    "Pilowlava",
    "Flor de Ruina",
  ],
] as const;

export const wrapMutantWord = (element: HTMLElement, targetWord: string): HTMLElement[] => {
  const currentText = element.textContent ?? "";
  const wordIndex = currentText.indexOf(targetWord);
  if (wordIndex === -1) return [];

  const textBefore = currentText.slice(0, wordIndex).trim();
  const textAfter = currentText.slice(wordIndex + targetWord.length);
  const charSpans = targetWord
    .split("")
    .map((char, charIdx) => `<span class="morphic-char" data-idx="${charIdx}">${char}</span>`)
    .join("");

  const beforeHtml = textBefore
    ? `<span class="morphic-line" data-morphic-line="1">${textBefore}</span>`
    : "";
  const mutantHtml = `<span class="morphic-line" data-morphic-line="2"><span class="morphic-mutant-word">${charSpans}</span></span>`;

  element.innerHTML = `${beforeHtml}${mutantHtml}${textAfter}`;
  return Array.from(element.querySelectorAll<HTMLElement>(".morphic-char"));
};

const preloadMutantFonts = (): Promise<unknown> =>
  typeof document !== "undefined" && "fonts" in document
    ? Promise.allSettled(MUTANT_FONTS.map((font) => document.fonts.load(`1rem "${font}"`)))
    : Promise.resolve();

export const startMutationLoop = (nodes: MorphicNodes): void => {
  const targetWord = nodes.mutateWord;
  const defs = nodes.blurNode.closest("svg")?.querySelector("defs");
  if (!targetWord || !(defs instanceof SVGDefsElement)) return;

  const existingChars = Array.from(nodes.element.querySelectorAll<HTMLElement>(".morphic-char"));
  const charEls =
    existingChars.length > 0 ? existingChars : wrapMutantWord(nodes.element, targetWord);
  if (charEls.length === 0) return;

  const refs = charEls
    .map((_, charIdx) => createFilterRef(defs, `${nodes.filterId}-c${charIdx}`))
    .filter((filterRef): filterRef is FilterRef => filterRef !== null);
  if (refs.length !== charEls.length) return;

  let waveIndex = 0;
  let active = false;
  let currentMaster: gsap.core.Timeline | null = null;
  let intervalId: number | null = null;
  let initialTimeoutId: number | null = null;

  type WaveOrigin = "start" | "end" | "center";

  const createStagger = (from: WaveOrigin = "start") =>
    gsap.utils.distribute({
      base: 0,
      amount: 0.44,
      from,
      ease: "sine.inOut",
    });

  const runWave = (from: WaveOrigin = "start") => {
    if (active) return;
    active = true;
    currentMaster = gsap.timeline({
      onComplete: () => {
        active = false;
      },
    });

    const currentPattern = MUTATION_MATRIX[waveIndex % MUTATION_MATRIX.length] ?? MUTANT_FONTS;
    waveIndex = (waveIndex + 1) % MUTATION_MATRIX.length;

    const stagger = createStagger(from);
    charEls.forEach((charEl, charIdx) => {
      const ref = refs[charIdx];
      if (!ref) return;
      const font = currentPattern[charIdx % currentPattern.length] ?? "Pilowlava";
      currentMaster?.add(createCharTimeline(charEl, ref, font), stagger(charIdx, charEl, charEls));
    });
  };

  const resetInterval = () => {
    if (intervalId !== null) window.clearInterval(intervalId);
    intervalId = window.setInterval(() => {
      if (!document.hidden) runWave("start");
    }, 4200);
  };

  const mutantWordEl = nodes.element.querySelector<HTMLElement>(".morphic-mutant-word");

  const onHover = (e: MouseEvent) => {
    if (!mutantWordEl) {
      runWave("start");
      resetInterval();
      return;
    }
    const rect = mutantWordEl.getBoundingClientRect();
    const relX = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
    const direction: WaveOrigin = relX > 0.65 ? "end" : relX < 0.35 ? "start" : "center";
    runWave(direction);
    resetInterval();
  };

  mutantWordEl?.addEventListener("mouseenter", onHover);

  const fontsReady =
    typeof document !== "undefined" && "fonts" in document
      ? document.fonts.ready
      : Promise.resolve();

  void fontsReady.then(async () => {
    await preloadMutantFonts();
    initialTimeoutId = window.setTimeout(() => {
      runWave("start");
      resetInterval();
    }, 850);
  });

  const cleanup = () => {
    if (initialTimeoutId !== null) window.clearTimeout(initialTimeoutId);
    if (intervalId !== null) window.clearInterval(intervalId);
    mutantWordEl?.removeEventListener("mouseenter", onHover);
    currentMaster?.kill();
    for (const charEl of charEls) gsap.killTweensOf(charEl);
  };

  document.addEventListener("astro:before-swap", cleanup, { once: true });
  document.addEventListener("consent:completed", cleanup, { once: true });
};
