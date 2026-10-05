import { createExitTimeline } from "./morphic-exit";
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
}

const parseNum = (val: string | undefined, fallback: number): number => {
  const num = Number(val);
  return Number.isFinite(num) && val?.trim() !== "" ? num : fallback;
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
  const exitDelay = exitDelayRaw !== undefined ? parseNum(exitDelayRaw, 1.5) : null;

  let phrases: string[] = [el.textContent?.trim() ?? ""];
  if (el.dataset.phrases) {
    try {
      const parsed = JSON.parse(el.dataset.phrases);
      if (Array.isArray(parsed) && parsed.length > 0) phrases = parsed;
    } catch {
      // Fallback a textContent original
    }
  }

  return {
    element: el,
    blurNode,
    matrixNode,
    cyanTopNode: getOffset(el.dataset.cyanTop),
    cyanBottomNode: getOffset(el.dataset.cyanBottom),
    isChromatic,
    shiftX: parseNum(el.dataset.shiftX, 3.5),
    shiftY: parseNum(el.dataset.shiftY, 1.5),
    delay: parseNum(el.dataset.delay, 0),
    duration: parseNum(el.dataset.duration, 1.9),
    exitDelay,
    loop: el.dataset.loop === "true",
    filterId,
    phrases,
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

  const runIntro = () => {
    nodes.element.textContent = nodes.phrases[phraseIndex] ?? "";
    resetNodesToIntro(nodes);

    const isLast = phraseIndex >= nodes.phrases.length - 1;
    const shouldExit = !isLast || (nodes.loop && nodes.exitDelay !== null);

    const tl = createRevealTimeline(nodes, () => {
      resetNodesToNeutral(nodes);
      if (shouldExit) {
        const delay = nodes.exitDelay ?? 1.5;
        setTimeout(runExit, delay * 1000);
      } else {
        nodes.element.dispatchEvent(new CustomEvent("morphic:complete", { bubbles: true }));
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
      setTimeout(runIntro, 600);
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
              if (entry.isIntersecting) {
                obs.unobserve(entry.target);
                const nodes = resolveNodes(entry.target as HTMLElement);
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
