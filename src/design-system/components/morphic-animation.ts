import { gsap } from "gsap";

const GOOEY = { initSlope: 24, initOffset: -11, targetSlope: 1, targetOffset: 0 } as const;

interface MorphicNodes {
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
  for (const node of [nodes.cyanTopNode, nodes.cyanBottomNode]) {
    node?.setAttribute("dx", "0");
    node?.setAttribute("dy", "0");
  }
  nodes.element.style.filter = "none";
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
  };
};

const playMorphicReveal = (nodes: MorphicNodes): void => {
  const { element, blurNode, matrixNode, cyanTopNode, cyanBottomNode } = nodes;
  const { isChromatic, shiftX, shiftY, delay, duration } = nodes;

  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    resetNodesToNeutral(nodes);
    element.style.opacity = "1";
    return;
  }

  const [rawX, rawY] = (blurNode.getAttribute("stdDeviation") ?? "20 20").split(" ").map(Number);
  const state: AnimationState = {
    x: Number.isFinite(rawX) ? (rawX as number) : 20,
    y: Number.isFinite(rawY) ? (rawY as number) : 20,
    slope: GOOEY.initSlope,
    offset: GOOEY.initOffset,
    chromaticProgress: 1.0,
  };

  let prevBlur = "";
  let prevMatrix = "";

  const timeline = gsap.timeline({
    delay: 0.1 + delay,
    onComplete: () => resetNodesToNeutral(nodes),
  });

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
        const val = `${bx.toFixed(1)} ${by.toFixed(1)}`;
        if (val !== prevBlur) {
          prevBlur = val;
          blurNode.setAttribute("stdDeviation", val);
        }
      },
    },
    0,
  );

  if (isChromatic && (cyanTopNode || cyanBottomNode)) {
    timeline.to(
      state,
      {
        chromaticProgress: 0,
        duration: duration * 0.85,
        ease: "power3.out",
        onUpdate: () => {
          const sx = shiftX * state.chromaticProgress;
          const sy = shiftY * state.chromaticProgress;
          cyanTopNode?.setAttribute("dx", (-sx).toFixed(2));
          cyanTopNode?.setAttribute("dy", (-sy).toFixed(2));
          cyanBottomNode?.setAttribute("dx", (sx * 0.3).toFixed(2));
          cyanBottomNode?.setAttribute("dy", (sy * 0.7).toFixed(2));
        },
      },
      0,
    );
  }

  timeline.to(
    state,
    {
      slope: GOOEY.targetSlope,
      offset: GOOEY.targetOffset,
      duration: duration * 0.45,
      ease: "power2.inOut",
      onUpdate: () => {
        const isIdentity = state.slope <= 1.05 && state.offset >= -0.05;
        const s = isIdentity ? "1" : state.slope.toFixed(2);
        const o = isIdentity ? "0" : state.offset.toFixed(2);
        const val = `${s} ${o}`;
        if (val !== prevMatrix) {
          prevMatrix = val;
          matrixNode.setAttribute("values", `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${s} ${o}`);
        }
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
