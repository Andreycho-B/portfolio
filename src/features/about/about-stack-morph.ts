import { gsap } from "gsap";

export const initAboutStackMorph = (): (() => void) => {
  const rows = document.querySelectorAll<HTMLElement>(".editorial-stack-row");
  if (rows.length === 0) return () => {};

  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cleanups: (() => void)[] = [];

  rows.forEach((row, index) => {
    const title = row.querySelector<HTMLElement>(".stack-row-title");
    const blurNode = document.getElementById(
      `about-morphic-blur-${index}`,
    ) as SVGFEGaussianBlurElement | null;

    if (!title || !blurNode || prefersReduced) {
      if (title) {
        title.style.opacity = "1";
        title.style.transform = "none";
        title.style.filter = "";
      }
      return;
    }

    const filterId = `about-morphic-filter-${index}`;
    let activeTl: gsap.core.Timeline | null = null;
    let isRevealed = false;

    gsap.set(title, { opacity: 0, y: 28 });

    const triggerRevealMorph = () => {
      if (isRevealed) return;
      isRevealed = true;

      title.style.filter = `url(#${filterId})`;
      const blurProxy = { blur: 18 };
      blurNode.setAttribute("stdDeviation", "18 18");

      activeTl = gsap.timeline({
        onComplete: () => {
          title.style.filter = "";
          blurNode.setAttribute("stdDeviation", "0 0");
          activeTl = null;
        },
      });

      activeTl.to(
        blurProxy,
        {
          blur: 0,
          duration: 1.35,
          ease: "power2.out",
          onUpdate: () => {
            blurNode.setAttribute("stdDeviation", `${blurProxy.blur} ${blurProxy.blur}`);
          },
        },
        0,
      );

      activeTl.to(title, { opacity: 1, duration: 1.0, ease: "sine.out" }, 0);
      activeTl.to(title, { y: 0, duration: 1.35, ease: "power3.out" }, 0);
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              triggerRevealMorph();
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2, rootMargin: "0px 0px -40px 0px" },
      );
      observer.observe(row);
      cleanups.push(() => observer.disconnect());
    } else {
      triggerRevealMorph();
    }
  });

  return () => {
    cleanups.forEach((fn) => {
      fn();
    });
  };
};
