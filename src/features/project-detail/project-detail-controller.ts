import { gsap } from "gsap";
import { getAudioSystem } from "../../core/audio";
import { destroySmoothScroll, initSmoothScroll } from "../../core/smooth-scroll";
import { getCursorController } from "../../design-system/components/cursor-controller";
import { initSoundToggle } from "../projects/sound-toggle";
import {
  initIncomingFluidWipe,
  navigateWithFluidWipe,
} from "../transitions/fluid-transition-controller";
import { initMorphicTitles } from "./detail-title-morph";
import { initSpecimensTilt } from "./project-tilt-fx";
import { initTechGravity } from "./tech-gravity-engine";

export const initProjectDetailPage = (): void => {
  initIncomingFluidWipe();

  initSmoothScroll();

  const curtain = document.getElementById("detail-entrance-curtain");
  if (curtain) {
    gsap.to(curtain, {
      transform: "scaleY(0)",
      duration: 0.75,
      ease: "expo.out",
    });
  }

  const heroSpecimen = document.querySelector<HTMLElement>(".hero-specimen-card");
  if (heroSpecimen) {
    gsap.fromTo(
      heroSpecimen,
      { scale: 1.07, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.85, ease: "power3.out", delay: 0.08 },
    );
  }

  const audio = getAudioSystem();
  let soundEnabled = true;
  try {
    soundEnabled = localStorage.getItem("portfolio_sound_enabled") !== "false";
  } catch {}
  void audio.initialize(soundEnabled);

  const cursor = getCursorController();
  cursor.enable();

  const cleanupSoundToggle = initSoundToggle(document.body);

  const cursorExpandElements = document.querySelectorAll<HTMLElement>("[data-cursor-expand]");
  cursorExpandElements.forEach((el) => {
    const label = el.dataset.cursorExpand;
    el.addEventListener("mouseenter", () => {
      cursor.setExpanded(true, label);
    });
    el.addEventListener("mouseleave", () => {
      cursor.setExpanded(false);
    });
    el.addEventListener("pointerleave", () => {
      cursor.setExpanded(false);
    });
    el.addEventListener("click", () => {
      cursor.setExpanded(false);
      cursor.setPressed(false);
    });
  });

  const interactiveEls = document.querySelectorAll<HTMLElement>(
    ".back-trigger, .action-pill, .external-bullet-link, .stack-item, .next-project-link-card, .sound-toggle-btn",
  );

  interactiveEls.forEach((el) => {
    el.addEventListener("mouseenter", () => {
      audio.playTactileFeedback("tick", 0.35);
    });
    el.addEventListener("click", () => {
      audio.playTactileFeedback("click", 0.65);
    });
  });

  const tiltController = initSpecimensTilt(document.body);

  const backTrigger = document.querySelector<HTMLAnchorElement>(".back-trigger");
  if (backTrigger) {
    backTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      cursor.setExpanded(false);
      cursor.setPressed(false);
      navigateWithFluidWipe({ targetUrl: "/" });
    });
  }

  const nextLink = document.querySelector<HTMLAnchorElement>("[data-next-portal-link]");
  if (nextLink) {
    nextLink.addEventListener("click", (e) => {
      const href = nextLink.getAttribute("href");
      if (!href) return;
      e.preventDefault();
      navigateWithFluidWipe({ targetUrl: href });
    });
  }

  initMorphicTitles();

  const revealTargets = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            target.classList.add("is-revealed");
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    revealTargets.forEach((target) => {
      observer.observe(target);
    });
  } else {
    revealTargets.forEach((target) => {
      target.classList.add("is-revealed");
    });
  }

  const techStage = document.getElementById("tech-gravity-stage");
  const techGravity = techStage ? initTechGravity(techStage) : null;

  const cleanup = () => {
    cursor.setExpanded(false);
    cursor.setPressed(false);
    cursor.setInverted(false);
    destroySmoothScroll();
    cleanupSoundToggle();
    tiltController.destroy();
    if (techGravity) techGravity.destroy();
  };
  document.addEventListener("astro:before-swap", cleanup, { once: true });
};
