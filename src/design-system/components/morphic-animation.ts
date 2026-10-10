import type { MorphicNodes } from "./morphic.types";
import { createExitTimeline } from "./morphic-exit";
import { startMutationLoop, wrapMutantWord } from "./morphic-mutation";
import { createRevealTimeline, resetNodesToIntro, resetNodesToNeutral } from "./morphic-reveal";

export type { MorphicNodes };
export { resetNodesToIntro, resetNodesToNeutral };

const parseNum = (val: string | undefined, def: number): number => {
  const n = Number(val);
  return Number.isFinite(n) && val?.trim() !== "" ? n : def;
};

const resolveNodes = (el: HTMLElement): MorphicNodes | null => {
  const blurNode = document.getElementById(el.dataset.blurNode ?? "");
  const matrixNode = document.getElementById(el.dataset.matrixNode ?? "");
  if (
    !(blurNode instanceof SVGFEGaussianBlurElement && matrixNode instanceof SVGFEColorMatrixElement)
  )
    return null;

  const isChromatic = el.dataset.chromatic === "true";
  const getNode = <T extends Element>(id?: string): T | null =>
    id ? (document.getElementById(id) as T | null) : null;

  const filterId = (el.dataset.blurNode ?? "").replace("-blur", "");
  const exitDelay = el.dataset.exitDelay !== undefined ? parseNum(el.dataset.exitDelay, 1.5) : null;

  let phrases: string[] = [el.textContent?.trim() ?? ""];
  if (el.dataset.phrases) {
    try {
      const parsed: unknown = JSON.parse(el.dataset.phrases);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((s) => typeof s === "string")
      ) {
        phrases = parsed;
      }
    } catch {
      console.warn("[MorphicText] JSON de data-phrases inválido");
    }
  }

  let phraseRoles: string[] = [];
  if (el.dataset.phraseRoles) {
    try {
      const parsed: unknown = JSON.parse(el.dataset.phraseRoles);
      if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
        phraseRoles = parsed;
      }
    } catch {
      console.warn("[MorphicText] JSON de data-phrase-roles inválido");
    }
  }

  return {
    element: el,
    blurNode,
    matrixNode,
    cyanTopNode: isChromatic ? getNode<SVGFEOffsetElement>(el.dataset.cyanTop) : null,
    cyanBottomNode: isChromatic ? getNode<SVGFEOffsetElement>(el.dataset.cyanBottom) : null,
    isChromatic,
    shiftX: parseNum(el.dataset.shiftX, 3.5),
    shiftY: parseNum(el.dataset.shiftY, 1.5),
    delay: parseNum(el.dataset.delay, 0),
    duration: parseNum(el.dataset.duration, 1.9),
    exitDelay,
    loop: el.dataset.loop === "true",
    filterId,
    phrases,
    phraseRoles,
    mutateWord: el.dataset.mutateWord,
    textColorNode: getNode<SVGFEColorMatrixElement>(el.dataset.textColor),
    cyanLayerNode: getNode<SVGFEColorMatrixElement>(el.dataset.cyanLayer),
  };
};

export const playMorphicSequence = (nodes: MorphicNodes): void => {
  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) {
    resetNodesToNeutral(nodes);
    nodes.element.textContent = nodes.phrases[nodes.phrases.length - 1] ?? "";
    nodes.element.style.opacity = "1";
    nodes.element.dispatchEvent(new CustomEvent("morphic:complete", { bubbles: true }));
    return;
  }

  let phraseIndex = 0;
  let timerId: number | null = null;
  let coverSync: (() => void) | null = null;

  const cancelTimers = () => {
    if (timerId !== null) window.clearTimeout(timerId);
    if (coverSync) {
      document.removeEventListener("welcome:backdrop-covered", coverSync);
      coverSync = null;
    }
    document.removeEventListener("astro:before-swap", cancelTimers);
  };
  document.addEventListener("astro:before-swap", cancelTimers, { once: true });

  const runIntro = () => {
    const currentPhrase = nodes.phrases[phraseIndex] ?? "";
    const currentRole = nodes.phraseRoles[phraseIndex] ?? "";
    const isPhraseWhite = currentRole === "final";
    nodes.element.textContent = currentPhrase;
    if (nodes.mutateWord && currentPhrase.includes(nodes.mutateWord)) {
      wrapMutantWord(nodes.element, nodes.mutateWord);
    }
    nodes.textColorNode?.setAttribute(
      "values",
      isPhraseWhite
        ? "0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"
        : "0 0 0 0 0.08  0 0 0 0 0.08  0 0 0 0 0.08  0 0 0 1 0",
    );
    nodes.cyanLayerNode?.setAttribute(
      "values",
      isPhraseWhite
        ? "0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0 0"
        : "0 0 0 0 0   0 0 0 0 0.8   0 0 0 0 1   0 0 0 0.95 0",
    );
    nodes.element.style.color = isPhraseWhite ? "#ffffff" : "var(--color-fg, #1a1714)";
    resetNodesToIntro(nodes);

    nodes.element.dispatchEvent(
      new CustomEvent("morphic:phrase-start", {
        bubbles: true,
        detail: { phraseIndex, phrase: currentPhrase, role: currentRole },
      }),
    );

    const isLast = phraseIndex >= nodes.phrases.length - 1;
    const shouldExit = !isLast || (nodes.loop && nodes.exitDelay !== null);

    const tl = createRevealTimeline(nodes, () => {
      resetNodesToNeutral(nodes);
      nodes.element.dispatchEvent(
        new CustomEvent("morphic:phrase-revealed", {
          bubbles: true,
          detail: { phraseIndex, phrase: currentPhrase, role: currentRole },
        }),
      );
      if (shouldExit) {
        const delaySec = nodes.exitDelay ?? 0.8;
        timerId = window.setTimeout(runExit, delaySec * 1000);
      } else {
        nodes.element.dispatchEvent(new CustomEvent("morphic:complete", { bubbles: true }));
        if (nodes.mutateWord) startMutationLoop(nodes);
      }
    });

    tl.delay(phraseIndex === 0 ? 0.1 + nodes.delay : 0);
  };

  const runExit = () => {
    nodes.element.style.filter = `url(#${nodes.filterId})`;
    createExitTimeline(nodes, () => {
      resetNodesToNeutral(nodes);
      nodes.element.style.opacity = "0";
      const exitedIndex = phraseIndex;
      nodes.element.dispatchEvent(
        new CustomEvent("morphic:phrase-exited", {
          bubbles: true,
          detail: {
            phraseIndex: exitedIndex,
            phrase: nodes.phrases[exitedIndex] ?? "",
            role: nodes.phraseRoles[exitedIndex] ?? "",
          },
        }),
      );
      phraseIndex = (phraseIndex + 1) % nodes.phrases.length;
      if (nodes.phraseRoles[phraseIndex] === "final") {
        const onCovered = () => {
          if (coverSync) {
            document.removeEventListener("welcome:backdrop-covered", coverSync);
            coverSync = null;
          }
          if (timerId !== null) window.clearTimeout(timerId);
          runIntro();
        };
        coverSync = onCovered;
        document.addEventListener("welcome:backdrop-covered", onCovered, { once: true });
        timerId = window.setTimeout(onCovered, 4500);
      } else {
        timerId = window.setTimeout(runIntro, 180);
      }
    });
  };

  runIntro();
};

export const initMorphicText = (): void => {
  if (typeof window === "undefined") return;
  const els = document.querySelectorAll<HTMLElement>("[data-morphic]:not([data-morphic-mounted])");
  if (els.length === 0) return;

  const onIntersect = (entries: IntersectionObserverEntry[], obs: IntersectionObserver) => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.target instanceof HTMLElement) {
        obs.unobserve(entry.target);
        const nodes = resolveNodes(entry.target);
        if (nodes) playMorphicSequence(nodes);
      }
    }
  };

  const observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(onIntersect, { threshold: 0.15 })
      : null;

  els.forEach((el) => {
    el.dataset.morphicMounted = "true";
    const nodes = resolveNodes(el);
    if (!nodes) return;
    if (observer) observer.observe(el);
    else playMorphicSequence(nodes);
  });
};
