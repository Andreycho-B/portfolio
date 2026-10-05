import { gsap } from "gsap";
import type { MorphicNodes } from "./morphic-animation";

const GOOEY = { initSlope: 24, initOffset: -11, targetSlope: 1, targetOffset: 0 } as const;

export const createRevealTimeline = (
  nodes: MorphicNodes,
  onComplete: () => void,
): gsap.core.Timeline => {
  const { element, blurNode, matrixNode, cyanTopNode, cyanBottomNode } = nodes;
  const { isChromatic, shiftX, shiftY, duration } = nodes;

  const [rawX, rawY] = (blurNode.getAttribute("stdDeviation") ?? "20 20").split(" ").map(Number);
  const state = {
    x: Number.isFinite(rawX) ? (rawX as number) : 20,
    y: Number.isFinite(rawY) ? (rawY as number) : 20,
    slope: GOOEY.initSlope,
    offset: GOOEY.initOffset,
    chromaticProgress: 1.0,
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
        const isId = state.slope <= 1.05 && state.offset >= -0.05;
        const s = isId ? "1" : state.slope.toFixed(2);
        const o = isId ? "0" : state.offset.toFixed(2);
        const val = `${s} ${o}`;
        if (val !== prevMatrix) {
          prevMatrix = val;
          matrixNode.setAttribute("values", `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${s} ${o}`);
        }
      },
    },
    duration * 0.55,
  );

  return timeline;
};
