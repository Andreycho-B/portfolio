let pendingSuspendTimer: number | null = null;

export const cancelPendingSuspend = (): void => {
  if (pendingSuspendTimer !== null) {
    window.clearTimeout(pendingSuspendTimer);
    pendingSuspendTimer = null;
  }
};

export const createMasterGainChain = (ctx: AudioContext): GainNode => {
  const now = ctx.currentTime;
  const dcBlocker = ctx.createBiquadFilter();
  dcBlocker.type = "highpass";
  dcBlocker.frequency.setValueAtTime(30, now);
  dcBlocker.Q.setValueAtTime(Math.SQRT1_2, now);

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-2.5, now);
  limiter.knee.setValueAtTime(0, now);
  limiter.ratio.setValueAtTime(20, now);
  limiter.attack.setValueAtTime(0.0005, now);
  limiter.release.setValueAtTime(0.04, now);

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.7, now);
  masterGain.connect(dcBlocker);
  dcBlocker.connect(limiter);
  limiter.connect(ctx.destination);
  return masterGain;
};

export const gracefulMute = (
  audioContext: AudioContext | null,
  masterGain: GainNode | null,
  durationSec = 0.03,
): void => {
  if (!audioContext || !masterGain) return;
  cancelPendingSuspend();

  const now = audioContext.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(0.0001, now + durationSec);

  pendingSuspendTimer = window.setTimeout(
    () => {
      pendingSuspendTimer = null;
      if (audioContext.state === "running") {
        void audioContext.suspend().catch((err: unknown) => {
          console.warn("[AudioLifecycle] Suspend failed:", err);
        });
      }
    },
    Math.floor(durationSec * 1000) + 15,
  );
};

export const bindTeardownAndVisibility = (
  onTeardownRamp: () => void,
  onVisibilityChange: () => void,
): (() => void) => {
  if (typeof window === "undefined") return () => {};

  for (const evt of ["pagehide", "beforeunload"] as const) {
    window.addEventListener(evt, onTeardownRamp, { capture: true });
  }
  document.addEventListener("astro:before-swap", onTeardownRamp, { once: true });
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    cancelPendingSuspend();
    for (const evt of ["pagehide", "beforeunload"] as const) {
      window.removeEventListener(evt, onTeardownRamp, { capture: true });
    }
    document.removeEventListener("astro:before-swap", onTeardownRamp);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
};
