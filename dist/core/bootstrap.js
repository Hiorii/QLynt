const ensureObject = (v) => (typeof v === "object" && v !== null ? v : {});
(() => {
    // zawsze trzymaj obiekt, ale nie wymagaj pełnej implementacji tutaj
    const existing = ensureObject(window.QA_COPILOT);
    window.QA_COPILOT = {
        ...existing,
        state: {
            settings: null,
            lastIssueKey: null,
            lastChecklist: null,
            ...(existing.state ?? {}),
        },
    };
    console.log("[QA Copilot] bootstrap initialized");
})();
export {};
