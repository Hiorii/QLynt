(() => {
    window.QA_COPILOT = window.QA_COPILOT || {};
    // ---------- DEFAULTS ----------
    const DEFAULT_SETTINGS = {
        acSynonyms: ["acceptance criteria", "kryteria akceptacji", "ac", "dod"],
        detectFromJiraFieldsDom: true,
        detectFromDescription: true,
        detectFromGherkin: true,
    };
    const SETTINGS_KEY = "qaCopilotSettings";
    // ---------- STORAGE ----------
    const getStorage = () => {
        if (typeof chrome !== "undefined" &&
            chrome.storage &&
            chrome.storage.local) {
            return chrome.storage.local;
        }
        return null;
    };
    // ---------- NORMALIZER ----------
    const normalizeSettings = (raw) => {
        if (typeof raw !== "object" || raw === null) {
            return { ...DEFAULT_SETTINGS };
        }
        const s = raw;
        return {
            acSynonyms: Array.isArray(s.acSynonyms)
                ? s.acSynonyms.filter((x) => typeof x === "string")
                : DEFAULT_SETTINGS.acSynonyms,
            detectFromJiraFieldsDom: typeof s.detectFromJiraFieldsDom === "boolean"
                ? s.detectFromJiraFieldsDom
                : DEFAULT_SETTINGS.detectFromJiraFieldsDom,
            detectFromDescription: typeof s.detectFromDescription === "boolean"
                ? s.detectFromDescription
                : DEFAULT_SETTINGS.detectFromDescription,
            detectFromGherkin: typeof s.detectFromGherkin === "boolean"
                ? s.detectFromGherkin
                : DEFAULT_SETTINGS.detectFromGherkin,
        };
    };
    // ---------- API ----------
    const load = async () => {
        const storage = getStorage();
        if (!storage)
            return { ...DEFAULT_SETTINGS };
        return new Promise((resolve) => {
            storage.get([SETTINGS_KEY], (res) => {
                resolve(normalizeSettings(res?.[SETTINGS_KEY]));
            });
        });
    };
    const save = async (settings) => {
        const storage = getStorage();
        if (!storage)
            return;
        return new Promise((resolve) => {
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
export {};
