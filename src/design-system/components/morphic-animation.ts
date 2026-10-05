import { gsap } from "gsap";

const GOOEY_INITIAL_SLOPE = 24;
const GOOEY_INITIAL_OFFSET = -11;
const GOOEY_TARGET_SLOPE = 1;
const GOOEY_TARGET_OFFSET = 0;

interface MorphicNodes {
  readonly element: HTMLElement;
  readonly blurNode: SVGFEGaussianBlurElement;
  readonly matrixNode: SVGFEColorMatrixElement;
  readonly cyanOffsetNode: SVGFEOffsetElement | null;
  readonly isChromatic: boolean;
  readonly shiftX: number;
  readonly shiftY: number;
  readonly delay: number;
  readonly duration: number;
}

interface AnimationState {
  x: number;
  y: number;
  slope: number;
  offset: number;
  chromaticProgress: number;
}

const parseNum = (val: string | undefined, fallback: number): number => {
  const num = Number(val);
  return Number.isFinite(num) && val?.trim() !== "" ? num : fallback;
};

const resetNodesToNeutral = (nodes: MorphicNodes): void => {
  nodes.blurNode.setAttribute("stdDeviation", "0 0");
  nodes.matrixNode.setAttribute("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0");
  nodes.cyanOffsetNode?.setAttribute("dx", "0");
  nodes.cyanOffsetNode?.setAttribute("dy", "0");
  nodes.element.style.filter = "none";
};

const resolveNodes = (el: HTMLElement): MorphicNodes | null => {
  const blurId = el.dataset.blurNode;
  const matrixId = el.dataset.matrixNode;
  if (!blurId || !matrixId) return null;

  const blurNode = document.getElementById(blurId);
  const matrixNode = document.getElementById(matrixId);
  if (
    !(blurNode instanceof SVGFEGaussianBlurElement) ||
    !(matrixNode instanceof SVGFEColorMatrixElement)
  ) {
    return null;
  }

  const isChromatic = el.dataset.chromatic === "true";
  const cyanId = el.dataset.cyanOffset;
  const cyanEl = isChromatic && cyanId ? document.getElementById(cyanId) : null;

  return {
    element: el,
    blurNode,
    matrixNode,
    cyanOffsetNode: cyanEl instanceof SVGFEOffsetElement ? cyanEl : null,
    isChromatic,
    shiftX: parseNum(el.dataset.shiftX, 3.5),
    shiftY: parseNum(el.dataset.shiftY, 1.5),
    delay: parseNum(el.dataset.delay, 0),
    duration: parseNum(el.dataset.duration, 1.9),
  };
};

const playMorphicReveal = (nodes: MorphicNodes): void => {
  const {
    element,
    blurNode,
    matrixNode,
    cyanOffsetNode,
    isChromatic,
    shiftX,
    shiftY,
    delay,
    duration,
  } = nodes;

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) {
    resetNodesToNeutral(nodes);
    element.style.opacity = "1";
    return;
  }

  const [rawX, rawY] = (blurNode.getAttribute("stdDeviation") ?? "20 20").split(" ").map(Number);
  const state: AnimationState = {
    x: typeof rawX === "number" && Number.isFinite(rawX) ? rawX : 20,
    y: typeof rawY === "number" && Number.isFinite(rawY) ? rawY : 20,
    slope: GOOEY_INITIAL_SLOPE,
    offset: GOOEY_INITIAL_OFFSET,
    chromaticProgress: 1.0,
  };

  const timeline = gsap.timeline({
    delay: 0.1 + delay,
    onComplete: () => resetNodesToNeutral(nodes),
  });

  // 1. Desvanecimiento de desenfoque anisotrópico
  timeline.to(
    state,
    {
      x: 0,
      y: 0,
      duration,
      ease: "power3.out",
      onUpdate: () => {
        const bx = state.x < 0.35 ? 0 : state.x;
        const by = state.y < 0.35 ? 0 : state.y;
        blurNode.setAttribute("stdDeviation", `${bx.toFixed(1)} ${by.toFixed(1)}`);
      },
    },
    0,
  );

  // 2. Colapso de dispersión cian durante la masa
  if (isChromatic && cyanOffsetNode) {
    timeline.to(
      state,
      {
        chromaticProgress: 0,
        duration: duration * 0.85,
        ease: "power3.out",
        onUpdate: () => {
          const sx = (shiftX * state.chromaticProgress).toFixed(2);
          const sy = (shiftY * state.chromaticProgress).toFixed(2);
          cyanOffsetNode.setAttribute("dx", `-${sx}`);
          cyanOffsetNode.setAttribute("dy", `-${sy}`);
        },
      },
      0,
    );
  }

  // 3. Relajación de tensión líquida a matriz identidad
  timeline.to(
    state,
    {
      slope: GOOEY_TARGET_SLOPE,
      offset: GOOEY_TARGET_OFFSET,
      duration: duration * 0.45,
      ease: "power2.inOut",
      onUpdate: () => {
        const isIdentity = state.slope <= 1.05 && state.offset >= -0.05;
        const s = isIdentity ? "1" : state.slope.toFixed(2);
        const o = isIdentity ? "0" : state.offset.toFixed(2);
        matrixNode.setAttribute("values", `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${s} ${o}`);
      },
    },
    duration * 0.55,
  );
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
                if (nodes) playMorphicReveal(nodes);
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
      playMorphicReveal(nodes);
    }
  });
};
