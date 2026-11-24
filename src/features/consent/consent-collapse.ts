import { gsap } from "gsap";
import type { CursorController } from "../../design-system/components/cursor.types";
import type { CloudControllerHandle } from "./cloud.types";
import type { WelcomeBackdropHandle } from "./welcome-backdrop";

export interface ConsentCollapseTargets {
  readonly screenElement: HTMLElement;
  readonly contentElement: HTMLElement;
  readonly promptElement: HTMLElement;
  readonly actionsElement: HTMLElement;
  readonly cloudCanvas: HTMLCanvasElement | null;
  readonly blueBox: HTMLElement | null;
  readonly vignette: HTMLElement | null;
  readonly cursor: CursorController;
  readonly backdrop: WelcomeBackdropHandle | null;
  readonly cloud: CloudControllerHandle | null;
}

export const executeCollapseTimeline = (
  targets: ConsentCollapseTargets,
  enableSound: boolean,
): void => {
  const { screenElement, contentElement, promptElement, actionsElement } = targets;
  const { cloudCanvas, blueBox, vignette, cursor, backdrop, cloud } = targets;

  const line1 = contentElement.querySelector<HTMLElement>('[data-morphic-line="1"]');
  const line2 = contentElement.querySelector<HTMLElement>('[data-morphic-line="2"]');

  document.dispatchEvent(new CustomEvent("consent:collapse-start"));
  cursor.setExpanded(false);

  const tl = gsap.timeline({
    onComplete: () => {
      backdrop?.destroy();
      cloud?.destroy();
      screenElement.style.display = "none";
      screenElement.style.pointerEvents = "none";
      screenElement.dispatchEvent(
        new CustomEvent("consent:completed", {
          bubbles: true,
          detail: { soundEnabled: enableSound },
        }),
      );
      cursor.setInverted(false);
      cursor.setExpanded(false);
    },
  });

  tl.call(
    () => {
      document.dispatchEvent(
        new CustomEvent("consent:reveal", {
          bubbles: true,
          detail: { soundEnabled: enableSound },
        }),
      );
    },
    [],
    0.16,
  );
  tl.call(() => cursor.setInverted(false), [], 0.45);

  tl.to(
    promptElement,
    {
      y: -24,
      opacity: 0,
      duration: 0.24,
      ease: "power2.in",
      force3D: true,
    },
    0,
  );

  tl.to(
    actionsElement,
    {
      y: -16,
      opacity: 0,
      duration: 0.24,
      ease: "power2.in",
      force3D: true,
    },
    0,
  );

  if (cloud) {
    const wipeProxy = { edge: 1 };
    tl.to(
      wipeProxy,
      {
        edge: -0.45,
        duration: 0.9,
        ease: "power2.inOut",
        onUpdate: () => cloud.setWipeEdge(wipeProxy.edge),
      },
      0.14,
    );
  } else if (cloudCanvas) {
    tl.to(
      cloudCanvas,
      {
        opacity: 0,
        duration: 0.65,
        ease: "power2.inOut",
      },
      0.14,
    );
  }

  if (vignette) {
    tl.to(
      vignette,
      {
        y: -80,
        opacity: 0,
        duration: 0.35,
        ease: "power2.in",
        force3D: true,
      },
      0.1,
    );
  }

  if (blueBox) {
    tl.set(blueBox, { opacity: 0 }, 0);
  }

  tl.to(
    contentElement,
    {
      scale: 0.97,
      y: 8,
      duration: 0.16,
      ease: "power1.in",
      force3D: true,
    },
    0,
  );

  if (line1 && line2) {
    tl.to(
      line1,
      {
        yPercent: -120,
        scaleX: 1.35,
        scaleY: 0.12,
        opacity: 0,
        filter: "blur(8px)",
        duration: 0.68,
        ease: "power2.inOut",
        transformOrigin: "50% 0%",
        force3D: true,
      },
      0.16,
    );

    tl.to(
      line2,
      {
        yPercent: -120,
        scaleX: 1.4,
        scaleY: 0.1,
        opacity: 0,
        filter: "blur(9px)",
        duration: 0.68,
        ease: "power2.inOut",
        transformOrigin: "50% 0%",
        force3D: true,
      },
      0.18,
    );
  } else {
    tl.to(
      contentElement,
      {
        yPercent: -120,
        scaleX: 1.4,
        scaleY: 0.1,
        opacity: 0,
        filter: "blur(9px)",
        duration: 0.7,
        ease: "power2.inOut",
        transformOrigin: "50% 0%",
        force3D: true,
      },
      0.16,
    );
  }

  tl.to(
    contentElement,
    {
      opacity: 0,
      duration: 0.2,
      ease: "power2.in",
    },
    0.55,
  );
};
