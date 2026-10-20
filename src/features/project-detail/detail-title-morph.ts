import { gsap } from "gsap";

const animateMercuryMorph = (
  el: HTMLElement,
  filterId: string,
  nodeId: string,
  delay = 0,
): void => {
  const node = document.getElementById(nodeId) as SVGFEGaussianBlurElement | null;
  if (!node) return;

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) {
    el.style.opacity = "1";
    el.style.transform = "none";
    el.style.filter = "";
    return;
  }

  el.style.filter = `url(#${filterId})`;
  const blurProxy = { blur: 22 };
  node.setAttribute("stdDeviation", "22 22");
  gsap.set(el, { opacity: 0, y: 32 });

  const tl = gsap.timeline({
    delay,
    onComplete: () => {
      el.style.filter = "";
      node.setAttribute("stdDeviation", "0 0");
    },
  });
  tl.to(
    blurProxy,
    {
      blur: 0,
      duration: 1.45,
      ease: "power2.out",
      onUpdate: () => {
        node.setAttribute("stdDeviation", `${blurProxy.blur} ${blurProxy.blur}`);
      },
    },
    0,
  );

  tl.to(
    el,
    {
      opacity: 1,
      duration: 1.15,
      ease: "sine.out",
    },
    0,
  );

  tl.to(
    el,
    {
      y: 0,
      duration: 1.45,
      ease: "power3.out",
    },
    0,
  );
};

export const initMorphicTitles = (): void => {
  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const heroTitle = document.querySelector<HTMLElement>("[data-project-title]");
  if (heroTitle) {
    if (prefersReduced) {
      heroTitle.style.opacity = "1";
      heroTitle.style.transform = "none";
    } else {
      animateMercuryMorph(heroTitle, "detail-title-blur-filter", "detail-title-blur-node", 0.15);
    }
  }

  const morphicTitles = document.querySelectorAll<HTMLElement>("[data-morphic-title]");
  if (prefersReduced || !("IntersectionObserver" in window)) {
    morphicTitles.forEach((t) => {
      t.style.opacity = "1";
      t.style.transform = "none";
    });
    return;
  }

  const morphObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const target = entry.target as HTMLElement;
        const type = target.dataset.morphicTitle;
        morphObserver.unobserve(target);
        if (type === "overview") {
          animateMercuryMorph(target, "detail-overview-blur-filter", "detail-overview-blur-node");
        } else if (type === "statement") {
          animateMercuryMorph(target, "detail-statement-blur-filter", "detail-statement-blur-node");
        } else if (type === "next") {
          animateMercuryMorph(target, "detail-next-blur-filter", "detail-next-blur-node");
        }
      });
    },
    { threshold: 0.05, rootMargin: "0px 0px 40px 0px" },
  );

  morphicTitles.forEach((t) => {
    morphObserver.observe(t);
  });
};
