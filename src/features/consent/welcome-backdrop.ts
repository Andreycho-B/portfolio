import { gsap } from "gsap";

export interface WelcomeBackdropHandle {
  readonly expand: () => void;
  readonly destroy: () => void;
}

export const initWelcomeBackdrop = (rootEl: HTMLElement): WelcomeBackdropHandle | null => {
  const boxEl = rootEl.querySelector<HTMLElement>("[data-blue-box]");
  if (!boxEl) return null;

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let timeline: gsap.core.Timeline | null = null;
  let isExpanded = false;

  const expand = () => {
    if (isExpanded) return;
    isExpanded = true;

    if (prefersReduced) {
      rootEl.dataset.backdropActive = "true";
      boxEl.classList.add("is-expanding");
      gsap.set(boxEl, {
        opacity: 1,
        width: "130vmax",
        height: "130vmax",
        borderRadius: "0px",
      });
      document.dispatchEvent(new CustomEvent("welcome:backdrop-covered"));
      return;
    }

    // Dimensiones rectangulares esbeltas (aspecto > 3:1)
    const lineLength = Math.min(Math.max(window.innerWidth * 0.46, 520), window.innerWidth * 0.9);
    const rectHeight = 160;
    const initialScaleY = 3 / rectHeight;

    // Inicialización precisa en GPU (sin provocar reflow en cada tick)
    gsap.set(boxEl, {
      width: lineLength,
      height: rectHeight,
      xPercent: -50,
      yPercent: -50,
      scaleX: 0,
      scaleY: initialScaleY,
      opacity: 1,
      borderRadius: 0,
      force3D: true,
      transformOrigin: "50% 50%",
    });

    timeline = gsap.timeline({
      onComplete: () => {
        timeline = null;
      },
    });

    // Pausa deliberada con pantalla vacía: asegura espacio 100% limpio tras la salida de "Soy Andrey"
    timeline.to({}, { duration: 0.35 });

    // Fase 1: Nace la línea azul en el centro limpio y abre horizontalmente a 120 FPS vía GPU
    timeline.to(boxEl, {
      scaleX: 1,
      duration: 1.35,
      ease: "power2.inOut",
      force3D: true,
    });

    // Fase 2: Abre verticalmente manteniendo el ancho exacto (rectángulo limpio sin reflows)
    timeline.to(boxEl, {
      scaleY: 1,
      duration: 0.65,
      ease: "power2.out",
      force3D: true,
    });

    // Fase 3: Pausa deliberada en la forma rectangular limpia
    timeline.to({}, { duration: 0.65 });

    // Cobertura completa viewport calculada para GPU scale
    const targetScaleX = (window.innerWidth * 1.5) / lineLength;
    const targetScaleY = (window.innerHeight * 1.5) / rectHeight;
    const finalScale = Math.max(targetScaleX, targetScaleY);

    // Fase 4: Expansión elástica a toda la pantalla con peso e inercia física (120 FPS)
    timeline.to(boxEl, {
      scaleX: finalScale,
      scaleY: finalScale,
      duration: 1.35,
      ease: "power3.inOut",
      force3D: true,
      onStart: () => {
        boxEl.classList.add("is-expanding");
        gsap.delayedCall(0.7, () => {
          rootEl.dataset.backdropActive = "true";
          document.dispatchEvent(new CustomEvent("welcome:backdrop-covered"));
        });
      },
    });
  };

  // Se activa ÚNICAMENTE después de que 'Soy Andrey' se haya ido completamente
  const onPhraseExited = (evt: Event) => {
    const customEvt = evt as CustomEvent<{ phraseIndex: number; phrase: string; role: string }>;
    const detail = customEvt.detail;
    if (detail && detail.role === "identity") {
      expand();
    }
  };

  document.addEventListener("morphic:phrase-exited", onPhraseExited);

  const destroy = () => {
    if (timeline) {
      timeline.kill();
      timeline = null;
    }
    document.removeEventListener("morphic:phrase-exited", onPhraseExited);
  };

  document.addEventListener("astro:before-swap", destroy, { once: true });

  return { expand, destroy };
};
