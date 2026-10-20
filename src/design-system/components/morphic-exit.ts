import { gsap } from "gsap";
import { GOOEY } from "./morphic.types";
import type { MorphicNodes } from "./morphic-animation";

export const createExitTimeline = (
  nodes: MorphicNodes,
  onComplete: () => void,
): gsap.core.Timeline => {
  const { element, blurNode, matrixNode, cyanTopNode, cyanBottomNode } = nodes;
  const { isChromatic, shiftX, shiftY, duration } = nodes;
  const exitDuration = Math.min(1.1, duration * 0.65);

  const state = {
    x: 0,
    y: 0,
    slope: GOOEY.targetSlope,
    offset: GOOEY.targetOffset,
    chromaticProgress: 0,
  };

  let prevBlur = "";
  let prevMatrix = "";
  const timeline = gsap.timeline({ onComplete });

  timeline.to(
    state,
    {
      slope: GOOEY.initSlope,
      offset: GOOEY.initOffset,
      duration: exitDuration * 0.45,
      ease: "power2.inOut",
      onUpdate: () => {
        const formattedSlope = state.slope.toFixed(2);
        const formattedOffset = state.offset.toFixed(2);
        const nextMatrix = `${formattedSlope} ${formattedOffset}`;
        if (nextMatrix !== prevMatrix) {
          prevMatrix = nextMatrix;
          matrixNode.setAttribute(
            "values",
            `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${formattedSlope} ${formattedOffset}`,
          );
        }
      },
    },
    0,
  );

  if (isChromatic && (cyanTopNode || cyanBottomNode)) {
    timeline.to(
      state,
      {
        chromaticProgress: 1.0,
        duration: exitDuration * 0.7,
        ease: "power3.in",
        onUpdate: () => {
          const sx = shiftX * state.chromaticProgress;
          const sy = shiftY * state.chromaticProgress;
          cyanTopNode?.setAttribute("dx", (-sx).toFixed(2));
          cyanTopNode?.setAttribute("dy", (-sy).toFixed(2));
          cyanBottomNode?.setAttribute("dx", (sx * 0.3).toFixed(2));
          cyanBottomNode?.setAttribute("dy", (sy * 0.7).toFixed(2));
        },
      },
      exitDuration * 0.15,
    );
  }

  timeline.to(
    state,
    {
      x: 18,
      y: 18,
      duration: exitDuration * 0.75,
      ease: "power3.in",
      onUpdate: () => {
        const nextBlur = `${state.x.toFixed(1)} ${state.y.toFixed(1)}`;
        if (nextBlur !== prevBlur) {
          prevBlur = nextBlur;
          blurNode.setAttribute("stdDeviation", nextBlur);
        }
      },
    },
    exitDuration * 0.15,
  );

  timeline.to(
    state,
    {
      offset: -22,
      duration: exitDuration * 0.5,
      ease: "power2.in",
      onUpdate: () => {
        const formattedSlope = state.slope.toFixed(2);
        const formattedOffset = state.offset.toFixed(2);
        const nextMatrix = `${formattedSlope} ${formattedOffset}`;
        if (nextMatrix !== prevMatrix) {
          prevMatrix = nextMatrix;
          matrixNode.setAttribute(
            "values",
            `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${formattedSlope} ${formattedOffset}`,
          );
        }
      },
    },
    exitDuration * 0.5,
  );

  timeline.to(
    element,
    { opacity: 0, duration: exitDuration * 0.25, ease: "power1.in" },
    exitDuration * 0.75,
  );

  return timeline;
};
