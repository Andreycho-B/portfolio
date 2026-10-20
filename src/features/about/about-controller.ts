import { getAudioSystem } from "../../core/audio";
import { destroySmoothScroll, initSmoothScroll } from "../../core/smooth-scroll";
import { getCursorController } from "../../design-system/components/cursor-controller";
import { initSoundToggle } from "../projects/sound-toggle";
import {
  initIncomingFluidWipe,
  navigateWithFluidWipe,
} from "../transitions/fluid-transition-controller";
import { initAboutHeroEntrance } from "./about-hero-entrance";
import { initAboutStackMorph } from "./about-stack-morph";
import { initMascotLogo } from "./mascot-logo-controller";

export const initAboutPage = (): void => {
  const stage = document.querySelector<HTMLElement>(".about-page-stage");
  if (!stage || stage.dataset.pageInit === "true") return;
  stage.dataset.pageInit = "true";

  initIncomingFluidWipe();

  const lenis = initSmoothScroll();

  const audio = getAudioSystem();
  let soundEnabled = true;
  try {
    soundEnabled = localStorage.getItem("portfolio_sound_enabled") !== "false";
  } catch {}
  void audio.initialize(soundEnabled);

  const cursor = getCursorController();
  cursor.enable();

  const cleanupSoundToggle = initSoundToggle(document.body);

  const backTriggers = document.querySelectorAll<HTMLAnchorElement>(
    "[data-back-trigger], .back-nav-arrow, .footer-back-link",
  );
  backTriggers.forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      cursor.setExpanded(false);
      cursor.setPressed(false);
      navigateWithFluidWipe({ targetUrl: "/" });
    });
  });

  const cursorExpandEls = document.querySelectorAll<HTMLElement>("[data-cursor-expand]");
  cursorExpandEls.forEach((el) => {
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
    ".nav-pill-btn, .footer-inline-link, .sound-toggle-btn, .back-nav-arrow, .footer-back-link",
  );
  interactiveEls.forEach((el) => {
    el.addEventListener("mouseenter", () => {
      audio.playTactileFeedback("tick", 0.35);
    });
    el.addEventListener("click", () => {
      audio.playTactileFeedback("click", 0.65);
    });
  });

  const revealTargets = document.querySelectorAll<HTMLElement>("[data-reveal]");
  let observer: IntersectionObserver | null = null;
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    revealTargets.forEach((t) => {
      observer?.observe(t);
    });
  } else {
    revealTargets.forEach((t) => {
      t.classList.add("is-revealed");
    });
  }

  const mascotHandle = initMascotLogo(lenis);
  const cleanupHeroEntrance = initAboutHeroEntrance({
    lenis,
    onBlink: (double) => mascotHandle?.triggerBlink(double),
  });
  const cleanupStackMorph = initAboutStackMorph();

  document.addEventListener(
    "astro:before-swap",
    () => {
      cursor.setExpanded(false);
      cursor.setPressed(false);
      destroySmoothScroll();
      cleanupSoundToggle();
      if (mascotHandle) mascotHandle.cleanup();
      cleanupHeroEntrance();
      cleanupStackMorph();
      observer?.disconnect();
    },
    { once: true },
  );
};
