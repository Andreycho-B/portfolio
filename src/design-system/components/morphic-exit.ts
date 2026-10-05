import { gsap } from "gsap";
import type { MorphicNodes } from "./morphic-animation";

const GOOEY = { initSlope: 24, initOffset: -11, targetSlope: 1, targetOffset: 0 } as const;

export const createExitTimeline = (
  nodes: MorphicNodes,
  onComplete: () => void,
): gsap.core.Timeline => {
  const { element, blurNode, matrixNode, cyanTopNode, cyanBottomNode } = nodes;
  const { isChromatic, shiftX, shiftY, duration } = nodes;

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

  // 1. Re-licuefacción inicial
  timeline.to(
    state,
    {
      slope: GOOEY.initSlope,
      offset: GOOEY.initOffset,
      duration: duration * 0.45,
      ease: "power2.inOut",
      onUpdate: () => {
        const s = state.slope.toFixed(2);
        const o = state.offset.toFixed(2);
        const val = `${s} ${o}`;
        if (val !== prevMatrix) {
          prevMatrix = val;
          matrixNode.setAttribute("values", `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${s} ${o}`);
        }
      },
    },
    0,
  );

  // 2. Expansión cromática cian (borde superior e inferior)
  if (isChromatic && (cyanTopNode || cyanBottomNode)) {
    timeline.to(
      state,
      {
        chromaticProgress: 1.0,
        duration: duration * 0.7,
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
      duration * 0.15,
    );
  }

  // 3. Re-difusión de desenfoque
  timeline.to(
    state,
    {
      x: 18,
      y: 18,
      duration: duration * 0.75,
      ease: "power3.in",
      onUpdate: () => {
        const val = `${state.x.toFixed(1)} ${state.y.toFixed(1)}`;
        if (val !== prevBlur) {
          prevBlur = val;
          blurNode.setAttribute("stdDeviation", val);
        }
      },
    },
    duration * 0.15,
  );

  // 4. Contracción y reducción de la masa líquida hasta el fondo
  timeline.to(
    state,
    {
      offset: -22,
      duration: duration * 0.5,
      ease: "power2.in",
      onUpdate: () => {
        const s = state.slope.toFixed(2);
        const o = state.offset.toFixed(2);
        const val = `${s} ${o}`;
        if (val !== prevMatrix) {
          prevMatrix = val;
          matrixNode.setAttribute("values", `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${s} ${o}`);
        }
      },
    },
    duration * 0.5,
  );

  // 5. Desvanecimiento hacia fondo limpio
  timeline.to(
    element,
    { opacity: 0, duration: duration * 0.25, ease: "power1.in" },
    duration * 0.75,
  );

  return timeline;
};
