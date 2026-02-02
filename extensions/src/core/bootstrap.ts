export {};

const ensureObject = <T extends object>(v: unknown): T =>
  (typeof v === "object" && v !== null ? (v as T) : ({} as T));


(() => {
  // zawsze trzymaj obiekt, ale nie wymagaj pełnej implementacji tutaj
  const existing = ensureObject<Partial<QACopilotAPI>>(window.QA_COPILOT);

  window.QA_COPILOT = {
    ...existing,
    state: {
      settings: null,
      lastIssueKey: null,
      lastChecklist: null,
      ...(existing.state ?? {}),
    },
  } as Partial<QACopilotAPI>;

  console.log("[QA Copilot] bootstrap initialized");
})();
