(() => {
  window.QA_COPILOT = window.QA_COPILOT || {};

  const DEFAULT_SETTINGS = {
    acSynonyms: ["acceptance criteria", "kryteria akceptacji", "ac", "dod"],
    detectFromJiraFieldsDom: true,
    detectFromDescription: true,
    detectFromGherkin: true
  };

  const SETTINGS_KEY = "qaCopilotSettings";

  const getStorage = () =>
    typeof chrome !== "undefined" && chrome.storage && chrome.storage.local
      ? chrome.storage.local
      : null;

  const load = async () => {
    const storage = getStorage();
    if (!storage) return { ...DEFAULT_SETTINGS };

    return new Promise((resolve) => {
      storage.get([SETTINGS_KEY], (res) => {
        const s = res?.[SETTINGS_KEY] || {};
        resolve({ ...DEFAULT_SETTINGS, ...s });
      });
    });
  };

  const save = async (settings) => {
    const storage = getStorage();
    if (!storage) return;

    return new Promise((resolve) => {
      storage.set({ [SETTINGS_KEY]: settings }, () => resolve());
    });
  };

  window.QA_COPILOT.settings = { load, save, DEFAULT_SETTINGS };
})();
