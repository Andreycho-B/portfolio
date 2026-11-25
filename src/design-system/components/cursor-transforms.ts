import { gsap } from "gsap";

type NumericSetter = (value: number) => void;

interface CursorTransforms {
  setX: NumericSetter;
  setY: NumericSetter;
  setRot: NumericSetter;
  setScaleX: NumericSetter;
  setScaleY: NumericSetter;
  setDot: (x: number, y: number) => void;
  syncAnchor: (x: number, y: number, expanded: boolean, muted: boolean) => boolean;
  apply: (x: number, y: number, rot: number, sx: number, sy: number) => void;
  resetRing: () => void;
  pulseRing: () => void;
}

export const initCursorTransforms = (
  cursorEl: HTMLElement,
  ringEl: HTMLElement | null,
  dotEl: HTMLElement | null,
): CursorTransforms => {
  gsap.set(cursorEl, { xPercent: 0, yPercent: 0, force3D: true });
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

  let lastTx = "";
  let lastTy = "";

  const syncAnchor = (x: number, y: number, expanded: boolean, muted: boolean): boolean => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
    const vh = typeof window !== "undefined" ? window.innerHeight : 1080;
    const isMute = muted && !expanded;
    const flipX = x + (isMute ? 60 : 162) > vw;
    const flipY = y + 64 > vh;
    const nextTx = isMute ? (flipX ? "-36px" : "12px") : flipX ? "-134px" : "14px";
    const nextTy = isMute ? (flipY ? "-36px" : "12px") : flipY ? "-36px" : "14px";
    if (nextTx === lastTx && nextTy === lastTy) return false;
    lastTx = nextTx;
    lastTy = nextTy;
    cursorEl.style.setProperty("--pill-tx", nextTx);
    cursorEl.style.setProperty("--pill-ty", nextTy);
    return true;
  };

  const setDot = (x: number, y: number): void => {
    if (!dotEl) return;
    dotEl.style.translate = `${x}px ${y}px`;
  };

  const apply = (x: number, y: number, rot: number, sx: number, sy: number) => {
    setX(x);
    setY(y);
    setRot(rot);
    setScaleX(sx);
    setScaleY(sy);
  };

  const resetRing = (): void => {
    if (!ringEl) return;
    gsap.to(ringEl, {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 0.14,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const pulseRing = (): void => {
    if (!ringEl) return;
    gsap.fromTo(
      ringEl,
      { scale: 0.9 },
      { scale: 1, duration: 0.2, ease: "back.out(1.4)", overwrite: "auto", force3D: true },
    );
  };

  return {
    setX,
    setY,
    setRot,
    setScaleX,
    setScaleY,
    setDot,
    syncAnchor,
    apply,
    resetRing,
    pulseRing,
  };
};
