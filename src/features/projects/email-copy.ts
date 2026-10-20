import { gsap } from "gsap";

export const initEmailCopy = (root: HTMLElement): (() => void) => {
  const link = root.querySelector<HTMLElement>("[data-email-link]");
  const textEl = root.querySelector<HTMLElement>("[data-email-text]");
  if (!link || !textEl) return () => {};

  const defaultText = textEl.textContent || "RONDONANDREY42@GMAIL.COM";
  let timeoutId: number | null = null;
  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const handleClick = (e: MouseEvent): void => {
    e.preventDefault();
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText("rondonandrey42@gmail.com");

    if (timeoutId !== null) window.clearTimeout(timeoutId);

    if (prefersReduced) {
      textEl.textContent = "COPIADO";
      timeoutId = window.setTimeout(() => {
        textEl.textContent = defaultText;
        timeoutId = null;
      }, 2000);
      return;
    }

    gsap.killTweensOf(textEl);
    gsap
      .timeline()
      .to(textEl, {
        y: -6,
        opacity: 0,
        duration: 0.12,
        ease: "power2.in",
        onComplete: () => {
          textEl.textContent = "COPIADO";
          gsap.set(textEl, { y: 6, opacity: 0 });
        },
      })
      .to(textEl, {
        y: 0,
        opacity: 1,
        duration: 0.24,
        ease: "back.out(2.2)",
      });

    timeoutId = window.setTimeout(() => {
      gsap
        .timeline()
        .to(textEl, {
          y: -6,
          opacity: 0,
          duration: 0.12,
          ease: "power2.in",
          onComplete: () => {
            textEl.textContent = defaultText;
            gsap.set(textEl, { y: 6, opacity: 0 });
          },
        })
        .to(textEl, {
          y: 0,
          opacity: 1,
          duration: 0.2,
          ease: "power2.out",
        });
      timeoutId = null;
    }, 2000);
  };

  link.addEventListener("click", handleClick);
  return () => {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    gsap.killTweensOf(textEl);
    link.removeEventListener("click", handleClick);
  };
};
