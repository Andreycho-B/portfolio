import { type MorphicNodes, resolveMorphicNodes } from "./morphic.types";
import { createExitTimeline } from "./morphic-exit";
import { startMutationLoop, wrapMutantWord } from "./morphic-mutation";
import { createRevealTimeline, resetNodesToIntro, resetNodesToNeutral } from "./morphic-reveal";

export type { MorphicNodes };
export { resetNodesToIntro, resetNodesToNeutral };

const playMorphicSequence = (nodes: MorphicNodes): void => {
  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) {
    const lastIdx = Math.max(0, nodes.phrases.length - 1);
    const finalPhrase = nodes.phrases[lastIdx] ?? "";
    const finalRole = nodes.phraseRoles[lastIdx] ?? "";
    resetNodesToNeutral(nodes);
    nodes.element.textContent = finalPhrase;
    if (nodes.mutateWord && finalPhrase.includes(nodes.mutateWord)) {
      wrapMutantWord(nodes.element, nodes.mutateWord);
    }
    if (finalRole === "final") {
      nodes.element.style.color = "#ffffff";
    }
    nodes.element.style.opacity = "1";
    nodes.element.dataset.morphicComplete = "true";
    nodes.element.dispatchEvent(new CustomEvent("morphic:complete", { bubbles: true }));
    return;
  }

  let phraseIndex = 0;
  let timerId: number | null = null;
  let coverSync: (() => void) | null = null;

  const cancelTimers = () => {
    if (timerId !== null) window.clearTimeout(timerId);
    if (coverSync) {
      document.removeEventListener("welcome:backdrop-covered", coverSync);
      coverSync = null;
    }
    document.removeEventListener("astro:before-swap", cancelTimers);
  };
  document.addEventListener("astro:before-swap", cancelTimers, { once: true });

  const runIntro = () => {
    const currentPhrase = nodes.phrases[phraseIndex] ?? "";
    const currentRole = nodes.phraseRoles[phraseIndex] ?? "";
    const isPhraseWhite = currentRole === "final";
    nodes.element.textContent = currentPhrase;
    if (nodes.mutateWord && currentPhrase.includes(nodes.mutateWord)) {
      wrapMutantWord(nodes.element, nodes.mutateWord);
    }
    nodes.textColorNode?.setAttribute(
      "values",
      isPhraseWhite
        ? "0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"
        : "0 0 0 0 0.08  0 0 0 0 0.08  0 0 0 0 0.08  0 0 0 1 0",
    );
    nodes.cyanLayerNode?.setAttribute(
      "values",
      isPhraseWhite
        ? "0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0 0"
        : "0 0 0 0 0   0 0 0 0 0.8   0 0 0 0 1   0 0 0 0.95 0",
    );
    nodes.element.style.color = isPhraseWhite ? "#ffffff" : "var(--color-fg, #1a1714)";
    resetNodesToIntro(nodes);

    nodes.element.dispatchEvent(
      new CustomEvent("morphic:phrase-start", {
        bubbles: true,
        detail: { phraseIndex, phrase: currentPhrase, role: currentRole },
      }),
    );

    const isLast = phraseIndex >= nodes.phrases.length - 1;
    const shouldExit = !isLast || (nodes.loop && nodes.exitDelay !== null);

    const tl = createRevealTimeline(nodes, () => {
      resetNodesToNeutral(nodes);
      nodes.element.dispatchEvent(
        new CustomEvent("morphic:phrase-revealed", {
          bubbles: true,
          detail: { phraseIndex, phrase: currentPhrase, role: currentRole },
        }),
      );
      if (shouldExit) {
        const delaySec = nodes.exitDelay ?? 0.8;
        timerId = window.setTimeout(runExit, delaySec * 1000);
      } else {
        nodes.element.dataset.morphicComplete = "true";
        nodes.element.dispatchEvent(new CustomEvent("morphic:complete", { bubbles: true }));
        if (nodes.mutateWord) startMutationLoop(nodes);
      }
    });

    tl.delay(phraseIndex === 0 ? 0.1 + nodes.delay : 0);
  };

  const runExit = () => {
    nodes.element.style.filter = `url(#${nodes.filterId})`;
    createExitTimeline(nodes, () => {
      resetNodesToNeutral(nodes);
      nodes.element.style.opacity = "0";
      const exitedIndex = phraseIndex;
      nodes.element.dispatchEvent(
        new CustomEvent("morphic:phrase-exited", {
          bubbles: true,
          detail: {
            phraseIndex: exitedIndex,
            phrase: nodes.phrases[exitedIndex] ?? "",
            role: nodes.phraseRoles[exitedIndex] ?? "",
          },
        }),
      );
      phraseIndex = (phraseIndex + 1) % nodes.phrases.length;
      if (nodes.phraseRoles[phraseIndex] === "final") {
        const onCovered = () => {
          if (coverSync) {
            document.removeEventListener("welcome:backdrop-covered", coverSync);
            coverSync = null;
          }
          if (timerId !== null) window.clearTimeout(timerId);
          runIntro();
        };
        coverSync = onCovered;
        document.addEventListener("welcome:backdrop-covered", onCovered, { once: true });
        timerId = window.setTimeout(onCovered, 4500);
      } else {
        timerId = window.setTimeout(runIntro, 180);
      }
    });
  };

  runIntro();
};

export const initMorphicText = (): void => {
  if (typeof window === "undefined") return;
  const els = document.querySelectorAll<HTMLElement>("[data-morphic]:not([data-morphic-mounted])");
  if (els.length === 0) return;

  const onIntersect = (entries: IntersectionObserverEntry[], obs: IntersectionObserver) => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.target instanceof HTMLElement) {
        obs.unobserve(entry.target);
        const nodes = resolveMorphicNodes(entry.target);
        if (nodes) playMorphicSequence(nodes);
      }
    }
  };

  const observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(onIntersect, { threshold: 0.15 })
      : null;

  if (observer) {
    document.addEventListener("astro:before-swap", () => observer.disconnect(), { once: true });
  }

  els.forEach((el) => {
    el.dataset.morphicMounted = "true";
    const nodes = resolveMorphicNodes(el);
    if (!nodes) return;
    if (observer) observer.observe(el);
    else playMorphicSequence(nodes);
  });
};
