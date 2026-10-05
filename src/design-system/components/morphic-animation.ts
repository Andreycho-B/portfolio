import { createExitTimeline } from "./morphic-exit";
import { startMutationLoop } from "./morphic-mutation";
import { createRevealTimeline } from "./morphic-reveal";

export interface MorphicNodes {
  readonly element: HTMLElement;
  readonly blurNode: SVGFEGaussianBlurElement;
  readonly matrixNode: SVGFEColorMatrixElement;
  readonly cyanTopNode: SVGFEOffsetElement | null;
  readonly cyanBottomNode: SVGFEOffsetElement | null;
  readonly isChromatic: boolean;
  readonly shiftX: number;
  readonly shiftY: number;
  readonly delay: number;
  readonly duration: number;
  readonly exitDelay: number | null;
  readonly loop: boolean;
  readonly filterId: string;
  readonly phrases: readonly string[];
  readonly mutateWord?: string;
}

const parseNumericAttribute = (rawText: string | undefined, fallback: number): number => {
  const parsedNum = Number(rawText);
  return Number.isFinite(parsedNum) && rawText?.trim() !== "" ? parsedNum : fallback;
};

export const resetNodesToNeutral = (nodes: MorphicNodes): void => {
  nodes.blurNode.setAttribute("stdDeviation", "0 0");
  nodes.matrixNode.setAttribute("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0");
  for (const node of [nodes.cyanTopNode, nodes.cyanBottomNode]) {
    node?.setAttribute("dx", "0");
    node?.setAttribute("dy", "0");
  }
  nodes.element.style.filter = "none";
};

export const resetNodesToIntro = (nodes: MorphicNodes): void => {
  nodes.blurNode.setAttribute("stdDeviation", "20 20");
  nodes.matrixNode.setAttribute("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11");
  nodes.cyanTopNode?.setAttribute("dx", `-${nodes.shiftX}`);
  nodes.cyanTopNode?.setAttribute("dy", `-${nodes.shiftY}`);
  nodes.cyanBottomNode?.setAttribute("dx", `${(nodes.shiftX * 0.3).toFixed(2)}`);
  nodes.cyanBottomNode?.setAttribute("dy", `${(nodes.shiftY * 0.7).toFixed(2)}`);
  nodes.element.style.filter = `url(#${nodes.filterId})`;
};

const resolveNodes = (el: HTMLElement): MorphicNodes | null => {
  const blurId = el.dataset.blurNode;
  const matrixId = el.dataset.matrixNode;
  if (!blurId || !matrixId) return null;

  const blurNode = document.getElementById(blurId);
  const matrixNode = document.getElementById(matrixId);
  const isValid =
    blurNode instanceof SVGFEGaussianBlurElement && matrixNode instanceof SVGFEColorMatrixElement;
  if (!isValid) return null;

  const isChromatic = el.dataset.chromatic === "true";
  const getOffset = (id?: string): SVGFEOffsetElement | null => {
    if (!isChromatic || !id) return null;
    const node = document.getElementById(id);
    return node instanceof SVGFEOffsetElement ? node : null;
  };

  const filterId = blurId.replace("-blur", "");
  const exitDelayRaw = el.dataset.exitDelay;
  const exitDelay = exitDelayRaw !== undefined ? parseNumericAttribute(exitDelayRaw, 1.5) : null;

  let phrases: string[] = [el.textContent?.trim() ?? ""];
  if (el.dataset.phrases) {
    try {
      const parsed: unknown = JSON.parse(el.dataset.phrases);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((item) => typeof item === "string")
      ) {
        phrases = parsed;
      } else {
        console.warn("[MorphicText] data-phrases must be a non-empty string array.");
      }
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        console.warn("[MorphicText] Syntax error in data-phrases JSON:", parseError.message);
      } else {
        throw parseError;
      }
    }
  }

  return {
    element: el,
    blurNode,
    matrixNode,
    cyanTopNode: getOffset(el.dataset.cyanTop),
    cyanBottomNode: getOffset(el.dataset.cyanBottom),
    isChromatic,
    shiftX: parseNumericAttribute(el.dataset.shiftX, 3.5),
    shiftY: parseNumericAttribute(el.dataset.shiftY, 1.5),
    delay: parseNumericAttribute(el.dataset.delay, 0),
    duration: parseNumericAttribute(el.dataset.duration, 1.9),
    exitDelay,
    loop: el.dataset.loop === "true",
    filterId,
    phrases,
    mutateWord: el.dataset.mutateWord,
  };
};

export const playMorphicSequence = (nodes: MorphicNodes): void => {
  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) {
    resetNodesToNeutral(nodes);
    nodes.element.textContent = nodes.phrases[nodes.phrases.length - 1] ?? "";
    nodes.element.style.opacity = "1";
    return;
  }

  let phraseIndex = 0;
  let timerId: number | null = null;

  const cancelTimers = () => {
    if (timerId !== null) window.clearTimeout(timerId);
    document.removeEventListener("astro:before-swap", cancelTimers);
  };
  document.addEventListener("astro:before-swap", cancelTimers, { once: true });

  const runIntro = () => {
    nodes.element.textContent = nodes.phrases[phraseIndex] ?? "";
    resetNodesToIntro(nodes);

    const isLast = phraseIndex >= nodes.phrases.length - 1;
    const shouldExit = !isLast || (nodes.loop && nodes.exitDelay !== null);

    const tl = createRevealTimeline(nodes, () => {
      resetNodesToNeutral(nodes);
      if (shouldExit) {
        const exitDelaySec = nodes.exitDelay ?? 0.8;
        timerId = window.setTimeout(runExit, exitDelaySec * 1000);
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
      phraseIndex = (phraseIndex + 1) % nodes.phrases.length;
      timerId = window.setTimeout(runIntro, 180);
    });
  };

  runIntro();
};

export const initMorphicText = (): void => {
  if (typeof window === "undefined") return;
  const elements = document.querySelectorAll<HTMLElement>(
    "[data-morphic]:not([data-morphic-mounted])",
  );
  if (elements.length === 0) return;

  const observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries, obs) => {
            for (const entry of entries) {
              if (entry.isIntersecting && entry.target instanceof HTMLElement) {
                obs.unobserve(entry.target);
                const nodes = resolveNodes(entry.target);
                if (nodes) playMorphicSequence(nodes);
              }
            }
          },
          { threshold: 0.15 },
        )
      : null;

  elements.forEach((element) => {
    element.dataset.morphicMounted = "true";
    const nodes = resolveNodes(element);
    if (!nodes) return;
    if (observer) {
      observer.observe(element);
    } else {
      playMorphicSequence(nodes);
    }
  });
};
