import { gsap } from "gsap";
import type { MorphicNodes } from "./morphic-animation";

export const resetNodesToNeutral = (nodes: MorphicNodes): void => {
  nodes.blurNode.setAttribute("stdDeviation", "0 0");
  nodes.matrixNode.setAttribute("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0");
  nodes.cyanTopNode?.setAttribute("dx", "0");
  nodes.cyanTopNode?.setAttribute("dy", "0");
  nodes.cyanBottomNode?.setAttribute("dx", "0");
  nodes.cyanBottomNode?.setAttribute("dy", "0");
  nodes.element.style.filter = "none";
};

export const resetNodesToIntro = (nodes: MorphicNodes): void => {
  const isWhite = nodes.textColorNode?.getAttribute("values")?.includes("0 0 0 0 1") ?? false;
  nodes.blurNode.setAttribute("stdDeviation", isWhite ? "6 6" : "20 20");
  nodes.matrixNode.setAttribute(
    "values",
    isWhite
      ? "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 10 -3"
      : "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11",
  );
  if (!isWhite) {
    nodes.cyanTopNode?.setAttribute("dx", `-${nodes.shiftX}`);
    nodes.cyanTopNode?.setAttribute("dy", `-${nodes.shiftY}`);
    nodes.cyanBottomNode?.setAttribute("dx", `${(nodes.shiftX * 0.3).toFixed(2)}`);
    nodes.cyanBottomNode?.setAttribute("dy", `${(nodes.shiftY * 0.7).toFixed(2)}`);
  } else {
    nodes.cyanTopNode?.setAttribute("dx", "0");
    nodes.cyanTopNode?.setAttribute("dy", "0");
    nodes.cyanBottomNode?.setAttribute("dx", "0");
    nodes.cyanBottomNode?.setAttribute("dy", "0");
  }
  nodes.element.style.filter = `url(#${nodes.filterId})`;
};

const GOOEY = { initSlope: 24, initOffset: -11, targetSlope: 1, targetOffset: 0 } as const;

export const createRevealTimeline = (
  nodes: MorphicNodes,
  onComplete: () => void,
): gsap.core.Timeline => {
  const { element, blurNode, matrixNode, cyanTopNode, cyanBottomNode } = nodes;
  const { isChromatic, shiftX, shiftY, duration } = nodes;
  const isWhite = nodes.textColorNode?.getAttribute("values")?.includes("0 0 0 0 1") ?? false;

  const stdAttr = blurNode.getAttribute("stdDeviation")?.trim() ?? "20 20";
  const stdParts = stdAttr.split(/\s+/).map(Number);
  const parsedX = stdParts[0];
  const parsedY = stdParts[1] ?? parsedX;
  const initialX = typeof parsedX === "number" && Number.isFinite(parsedX) ? parsedX : 20;
  const initialY = typeof parsedY === "number" && Number.isFinite(parsedY) ? parsedY : initialX;

  const state = {
    x: initialX,
    y: initialY,
    slope: isWhite ? 10 : GOOEY.initSlope,
    offset: isWhite ? -3 : GOOEY.initOffset,
    chromaticProgress: isWhite ? 0 : 1.0,
  };

  let prevBlur = "";
  let prevMatrix = "";
  const timeline = gsap.timeline({ onComplete });
  const fadeDur = Math.min(0.7, duration * 0.4);

  timeline.fromTo(
    element,
    { opacity: 0 },
    { opacity: 1, duration: fadeDur, ease: "power2.out" },
    0.1,
  );

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
        const nextBlur = `${bx.toFixed(1)} ${by.toFixed(1)}`;
        if (nextBlur !== prevBlur) {
          prevBlur = nextBlur;
          blurNode.setAttribute("stdDeviation", nextBlur);
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
        const isId = state.slope <= 1.05 && state.offset >= -0.05;
        const s = isId ? "1" : state.slope.toFixed(2);
        const o = isId ? "0" : state.offset.toFixed(2);
        const nextMatrix = `${s} ${o}`;
        if (nextMatrix !== prevMatrix) {
          prevMatrix = nextMatrix;
          matrixNode.setAttribute("values", `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${s} ${o}`);
        }
      },
    },
    duration * 0.55,
  );

  return timeline;
};
