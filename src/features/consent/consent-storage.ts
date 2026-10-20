const CONSENT_TTL = 1800000;
const CONSENT_KEY = "portfolio_consent_time";
const SOUND_KEY = "portfolio_sound_enabled";

export const isRecentConsent = (): boolean => {
  try {
    return Date.now() - Number(localStorage.getItem(CONSENT_KEY) || 0) < CONSENT_TTL;
  } catch {
    return false;
  }
};

export const getStoredSoundPreference = (): boolean => {
  try {
    return localStorage.getItem(SOUND_KEY) !== "false";
  } catch {
    return true;
  }
};

export const saveConsentPreference = (enableSound: boolean): void => {
  try {
    localStorage.setItem(CONSENT_KEY, Date.now().toString());
    localStorage.setItem(SOUND_KEY, enableSound ? "true" : "false");
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(12);
    }
  } catch {}
};
