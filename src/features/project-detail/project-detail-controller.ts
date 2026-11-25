import { gsap } from "gsap";
import { getAudioSystem } from "../../core/audio";
import { destroySmoothScroll, initSmoothScroll } from "../../core/smooth-scroll";
import { getCursorController } from "../../design-system/components/cursor-controller";
import { bindCursorExpandTriggers } from "../../design-system/components/cursor-events";
import { getStoredSoundPreference } from "../consent/consent-storage";
import { initSoundToggle } from "../projects/sound-toggle";
import {
  initIncomingFluidWipe,
  isModifiedClick,
  navigateWithFluidWipe,
} from "../transitions/fluid-transition-controller";
import { initMorphicTitles } from "./detail-title-morph";
import { initSpecimensTilt } from "./project-tilt-fx";
import { splitChars } from "./tech-icons";

const hydrateRollTracks = (prefersReduced: boolean): void => {
  if (prefersReduced) return;
  const tracks = document.querySelectorAll<HTMLElement>("[data-roll-text]");
  for (const track of tracks) {
    if (track.dataset.rollHydrated === "true") continue;
    const text = track.textContent?.trim() ?? "";
    if (!text) continue;
    const parent = track.parentElement;
    if (parent && !parent.hasAttribute("aria-label")) {
      const sr = document.createElement("span");
      sr.className = "sr-only";
      sr.textContent = text;
      parent.insertBefore(sr, track);
    }
    const frag = document.createDocumentFragment();
    for (const { char, index } of splitChars(text)) {
      const cell = document.createElement("span");
      cell.className = "roll-char";
      cell.style.setProperty("--i", String(index));
      const top = document.createElement("span");
      top.className = "char-top";
      top.textContent = char;
      const bot = document.createElement("span");
      bot.className = "char-bot";
      bot.textContent = char;
      cell.append(top, bot);
      frag.appendChild(cell);
    }
    track.setAttribute("aria-hidden", "true");
    track.dataset.rollHydrated = "true";
    track.replaceChildren(frag);
  }
};

export const initProjectDetailPage = (): void => {
  const stage = document.querySelector<HTMLElement>(".project-detail-stage");
  if (!stage || stage.dataset.pageInit === "true") return;
  stage.dataset.pageInit = "true";

  initIncomingFluidWipe();
  initSmoothScroll();

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  hydrateRollTracks(prefersReduced);

  const heroSpecimen = document.querySelector<HTMLElement>(".hero-specimen-card");
  if (heroSpecimen && !prefersReduced) {
    gsap.fromTo(
      heroSpecimen,
      { scale: 1.07, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.85, ease: "power3.out", delay: 0.08 },
    );
  }

  const audio = getAudioSystem();
  void audio.initialize(getStoredSoundPreference());

  const cursor = getCursorController();
  cursor.enable();

  const cleanupSoundToggle = initSoundToggle(document.body);
  const cleanupCursorExpand = bindCursorExpandTriggers(document.body, cursor);

  const interactiveEls = document.querySelectorAll<HTMLElement>(
    ".back-trigger, .action-pill, .external-bullet-link, .stack-item, .next-project-link-card, .sound-toggle-btn",
  );
  interactiveEls.forEach((el) => {
    el.addEventListener("mouseenter", () => audio.playTactileFeedback("tick", 0.35));
    el.addEventListener("click", () => audio.playTactileFeedback("click", 0.65));
  });

  const tiltController = initSpecimensTilt(document.body);

  const backTrigger = document.querySelector<HTMLAnchorElement>(".back-trigger");
  backTrigger?.addEventListener("click", (e) => {
    if (isModifiedClick(e)) return;
    e.preventDefault();
    cursor.setExpanded(false);
    cursor.setPressed(false);
    navigateWithFluidWipe({ targetUrl: "/" });
  });

  const nextLink = document.querySelector<HTMLAnchorElement>("[data-next-portal-link]");
  nextLink?.addEventListener("click", (e) => {
    if (isModifiedClick(e)) return;
    const href = nextLink.getAttribute("href");
    if (!href) return;
    e.preventDefault();
    navigateWithFluidWipe({ targetUrl: href });
  });

  const cleanupMorphicTitles = initMorphicTitles();

  const revealTargets = document.querySelectorAll<HTMLElement>("[data-reveal]");
  let observer: IntersectionObserver | null = null;
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    revealTargets.forEach((target) => {
      observer?.observe(target);
    });
  } else {
    revealTargets.forEach((target) => {
      target.classList.add("is-revealed");
    });
  }

  const techStage = document.getElementById("tech-gravity-stage");
  let techGravityDestroy: (() => void) | null = null;
  let isDisposed = false;
  if (techStage) {
    void import("./tech-gravity-engine")
      .then(({ initTechGravity }) => {
        if (isDisposed || !techStage.isConnected) return;
        const instance = initTechGravity(techStage);
        if (instance) techGravityDestroy = instance.destroy;
      })
      .catch((err: unknown) => {
        console.warn("[ProjectDetail] TechGravity load warning:", err);
      });
  }

  document.addEventListener(
    "astro:before-swap",
    () => {
      isDisposed = true;
      cursor.setExpanded(false);
      cursor.setPressed(false);
      cursor.setInverted(false);
      destroySmoothScroll();
      cleanupSoundToggle();
      cleanupCursorExpand();
      cleanupMorphicTitles();
      tiltController.destroy();
      techGravityDestroy?.();
      observer?.disconnect();
    },
    { once: true },
  );
};
