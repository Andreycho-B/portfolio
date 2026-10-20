import { gsap } from "gsap";

export interface DrumIntroElements {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly metaBar: HTMLElement | null;
  readonly titleElement: HTMLElement | null;
  readonly detailsRow: HTMLElement | null;
  readonly pagination: HTMLElement | null;
  readonly actionColumn: HTMLElement | null;
  readonly blurNode: SVGFEGaussianBlurElement | null;
  readonly onSettleDrum: () => void;
  readonly onUpdateIntroProgress: (progress: number) => void;
  readonly onPlayArrivalSound: () => void;
}

export const playDrumIntroAnimation = (
  elements: DrumIntroElements,
  soundEnabled: boolean,
): gsap.core.Timeline => {
  const {
    root,
    canvas,
    metaBar,
    titleElement,
    detailsRow,
    pagination,
    actionColumn,
    blurNode,
    onSettleDrum,
    onUpdateIntroProgress,
    onPlayArrivalSound,
  } = elements;

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.hidden = false;

  if (prefersReduced) {
    onSettleDrum();
    onUpdateIntroProgress(1);
    if (soundEnabled) onPlayArrivalSound();
    gsap.set(
      [canvas, metaBar, titleElement, detailsRow, pagination, actionColumn].filter(
        (el): el is HTMLElement => el !== null,
      ),
      { opacity: 1, x: 0, y: 0, scale: 1 },
    );
    if (blurNode) {
      blurNode.setAttribute("stdDeviation", "0 0");
    }
    return gsap.timeline();
  }

  const editorialTargets = [titleElement, detailsRow].filter(
    (el): el is HTMLElement => el !== null,
  );

  const tl = gsap.timeline();

  tl.set(canvas, { opacity: 0, scale: 0.96 });
  if (editorialTargets.length > 0) {
    tl.set(editorialTargets, { opacity: 0, y: 32 });
  }
  if (metaBar) tl.set(metaBar, { opacity: 0, y: -16 });
  if (pagination) tl.set(pagination, { opacity: 0, scale: 0.9 });
  if (actionColumn) tl.set(actionColumn, { opacity: 0, x: 20 });
  if (blurNode) tl.set(blurNode, { attr: { stdDeviation: "24 0" } });

  tl.call(
    () => {
      onSettleDrum();
      if (soundEnabled) onPlayArrivalSound();
    },
    [],
    0.05,
  );

  const introState = { progress: 0 };
  tl.to(
    introState,
    {
      progress: 1,
      duration: 2.2,
      ease: "power2.out",
      onUpdate: () => {
        onUpdateIntroProgress(introState.progress);
      },
    },
    0.05,
  );

  tl.to(
    canvas,
    {
      opacity: 1,
      scale: 1,
      duration: 1.6,
      ease: "sine.out",
    },
    0.05,
  );

  if (blurNode) {
    tl.to(
      blurNode,
      {
        attr: { stdDeviation: "0 0" },
        duration: 1.6,
        ease: "power2.out",
      },
      0.15,
    );
  }

  if (editorialTargets.length > 0) {
    tl.to(
      editorialTargets,
      {
        opacity: 1,
        y: 0,
        duration: 1.4,
        stagger: 0.1,
        ease: "power3.out",
      },
      0.15,
    );
  }

  if (metaBar) {
    tl.to(
      metaBar,
      {
        opacity: 1,
        y: 0,
        duration: 1.1,
        ease: "power2.out",
      },
      0.35,
    );
  }

  if (pagination) {
    tl.to(
      pagination,
      {
        opacity: 1,
        scale: 1,
        duration: 1.2,
        ease: "power3.out",
      },
      0.4,
    );
  }

  if (actionColumn) {
    tl.to(
      actionColumn,
      {
        opacity: 1,
        x: 0,
        duration: 1.2,
        ease: "power3.out",
      },
      0.45,
    );
  }

  return tl;
};
