export {}; // ważne – robi z pliku moduł TS


(() => {
  window.QA_COPILOT = window.QA_COPILOT || {};

  // ---------- TYPES ----------
  type QACopilotSettings = {
    acSynonyms: string[];
    detectFromJiraFieldsDom: boolean;
    detectFromDescription: boolean;
    detectFromGherkin: boolean;
  };

  // ---------- DEFAULTS ----------
  const DEFAULT_SETTINGS: QACopilotSettings = {
    acSynonyms: ["acceptance criteria", "kryteria akceptacji", "ac", "dod"],
    detectFromJiraFieldsDom: true,
    detectFromDescription: true,
    detectFromGherkin: true,
  };

  const SETTINGS_KEY = "qaCopilotSettings";

  // ---------- STORAGE ----------
  const getStorage = (): chrome.storage.LocalStorageArea | null => {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      return chrome.storage.local;
    }
    return null;
  };

  // ---------- NORMALIZER ----------
  const normalizeSettings = (raw: unknown): QACopilotSettings => {
    if (typeof raw !== "object" || raw === null) {
      return { ...DEFAULT_SETTINGS };
    }

    const s = raw as Partial<QACopilotSettings>;

    return {
      acSynonyms: Array.isArray(s.acSynonyms)
        ? s.acSynonyms.filter((x) => typeof x === "string")
        : DEFAULT_SETTINGS.acSynonyms,

      detectFromJiraFieldsDom:
        typeof s.detectFromJiraFieldsDom === "boolean"
          ? s.detectFromJiraFieldsDom
          : DEFAULT_SETTINGS.detectFromJiraFieldsDom,

      detectFromDescription:
        typeof s.detectFromDescription === "boolean"
          ? s.detectFromDescription
          : DEFAULT_SETTINGS.detectFromDescription,

      detectFromGherkin:
        typeof s.detectFromGherkin === "boolean"
          ? s.detectFromGherkin
          : DEFAULT_SETTINGS.detectFromGherkin,
    };
  };

  // ---------- API ----------
  const load = async (): Promise<QACopilotSettings> => {
    const storage = getStorage();
    if (!storage) return { ...DEFAULT_SETTINGS };

    return new Promise<QACopilotSettings>((resolve) => {
      storage.get([SETTINGS_KEY], (res) => {
        resolve(normalizeSettings(res?.[SETTINGS_KEY]));
      });
    });
  };

  const save = async (settings: QACopilotSettings): Promise<void> => {
    const storage = getStorage();
    if (!storage) return;

    return new Promise<void>((resolve) => {
      storage.set({ [SETTINGS_KEY]: settings }, () => resolve());
    });
  };

  // ---------- EXPORT TO GLOBAL ----------
  window.QA_COPILOT.settings = {
    load,
    save,
    DEFAULT_SETTINGS,
  };
})();
