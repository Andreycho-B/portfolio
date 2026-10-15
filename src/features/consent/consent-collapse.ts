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
      cursor.pulse();
    },
  });

  // 1. Arrastre gravitacional ascendente de controles inferiores
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

  if (cloudCanvas) {
    // Degradado ascendente: la máscara vive en el CSS; GSAP solo coreografía
    // la variable --wipe-edge desde su valor de reposo (100) hasta -wipe-soft
    const wipeSoftBand = Number.parseFloat(
      getComputedStyle(cloudCanvas).getPropertyValue("--wipe-soft"),
    );
    if (Number.isFinite(wipeSoftBand)) {
      tl.to(
        cloudCanvas,
        {
          "--wipe-edge": -wipeSoftBand,
          duration: 1.8,
          ease: "power2.inOut",
        },
        0.2,
      );
    } else {
      console.warn("[ConsentScreen] Variable --wipe-soft no definida; se omite el degradado");
    }
  }

  if (vignette) {
    tl.to(
      vignette,
      {
        y: -80,
        opacity: 0,
        duration: 0.35,
        ease: "power2.in",
      },
      0.1,
    );
  }

  if (blueBox) {
    // La caja ya está cubierta por el canvas opaco: ocultarla al inicio evita
    // que su degradado eléctrico se transparente durante la salida hacia el crema
    tl.set(blueBox, { opacity: 0 }, 0);
  }

  // 2. Micro-anticipación y compresión elástica previa
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

  // 3. Succión exponencial hiperbólica con deformación y motion blur
  if (line1 && line2) {
    tl.to(
      line1,
      {
        yPercent: -135,
        scaleX: 1.8,
        scaleY: 0.04,
        opacity: 0,
        filter: "blur(8px)",
        duration: 0.52,
        ease: "expo.in",
        transformOrigin: "50% 0%",
        force3D: true,
      },
      0.16,
    );

    tl.to(
      line2,
      {
        yPercent: -135,
        scaleX: 1.9,
        scaleY: 0.03,
        opacity: 0,
        filter: "blur(10px)",
        duration: 0.52,
        ease: "expo.in",
        transformOrigin: "50% 0%",
        force3D: true,
      },
      0.175,
    );
  } else {
    tl.to(
      contentElement,
      {
        yPercent: -135,
        scaleX: 2.0,
        scaleY: 0.02,
        opacity: 0,
        filter: "blur(10px)",
        duration: 0.55,
        ease: "expo.in",
        transformOrigin: "50% 0%",
        force3D: true,
      },
      0.16,
    );
  }

  // Desvanecimiento final de seguridad del contenedor
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
