export const CONSENT_TTL = 1800000;
export const CONSENT_KEY = "portfolio_consent_time";
export const SOUND_KEY = "portfolio_sound_enabled";

export const isRecentConsent = (): boolean => {
  try {
    const item = localStorage.getItem(CONSENT_KEY);
    return item ? Date.now() - Number(item) < CONSENT_TTL : false;
  } catch (err) {
    console.warn("[ConsentStorage] Failed to read consent timestamp:", err);
    return false;
  }
};

export const getStoredSoundPreference = (): boolean => {
  try {
    return localStorage.getItem(SOUND_KEY) !== "false";
  } catch (err) {
    console.warn("[ConsentStorage] Failed to read sound preference:", err);
    return true;
  }
};

export const saveConsentPreference = (enableSound: boolean): void => {
  try {
    localStorage.setItem(CONSENT_KEY, Date.now().toString());
    localStorage.setItem(SOUND_KEY, enableSound ? "true" : "false");
  } catch (err) {
    console.warn("[ConsentStorage] Failed to save consent preferences:", err);
  }
};
