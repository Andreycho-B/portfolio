import { gsap } from "gsap";

type NumericSetter = (value: number) => void;

export interface CursorTransforms {
  setX: NumericSetter;
  setY: NumericSetter;
  setRot: NumericSetter;
  setScaleX: NumericSetter;
  setScaleY: NumericSetter;
  apply: (x: number, y: number, rot: number, sx: number, sy: number) => void;
}

export const initCursorTransforms = (
  cursorEl: HTMLElement,
  ringEl: HTMLElement | null,
): CursorTransforms => {
  gsap.set(cursorEl, { xPercent: -50, yPercent: -50, force3D: true });
  const rawX = gsap.quickSetter(cursorEl, "x", "px");
  const rawY = gsap.quickSetter(cursorEl, "y", "px");
  const rawRot = ringEl ? gsap.quickSetter(ringEl, "rotation", "deg") : null;
  const rawScaleX = ringEl ? gsap.quickSetter(ringEl, "scaleX") : null;
  const rawScaleY = ringEl ? gsap.quickSetter(ringEl, "scaleY") : null;

  const setX: NumericSetter = (val: number) => rawX(val);
  const setY: NumericSetter = (val: number) => rawY(val);
  const setRot: NumericSetter = (val: number) => {
    if (rawRot) rawRot(val);
  };
  const setScaleX: NumericSetter = (val: number) => {
    if (rawScaleX) rawScaleX(val);
  };
  const setScaleY: NumericSetter = (val: number) => {
    if (rawScaleY) rawScaleY(val);
  };

  const apply = (x: number, y: number, rot: number, sx: number, sy: number) => {
    setX(x);
    setY(y);
    setRot(rot);
    setScaleX(sx);
    setScaleY(sy);
  };

  return { setX, setY, setRot, setScaleX, setScaleY, apply };
};
