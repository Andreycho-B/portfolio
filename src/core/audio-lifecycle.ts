let pendingSuspendTimer: number | null = null;

export const cancelPendingSuspend = (): void => {
  if (pendingSuspendTimer !== null) {
    window.clearTimeout(pendingSuspendTimer);
    pendingSuspendTimer = null;
  }
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
        void audioContext.suspend().catch(() => {});
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
