(() => {
  if (window.QA_COPILOT) return;

  window.QA_COPILOT = {
    state: {
      settings: null,
      lastIssueKey: null,
      lastChecklist: null,
    },
    settings: {},
    panel: {},
    issueDetect: {},
    jiraParser: {},
    acDetect: {},
    checklist: {},
  };

  console.log("[QA Copilot] bootstrap initialized");
})();
