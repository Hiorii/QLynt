(() => {
    const log = (...args) => console.log("[QA Copilot]", ...args);
    const boot = async () => {
        // settings
        window.QA_COPILOT.state.settings = await window.QA_COPILOT.settings.load();
        log("Loaded settings:", window.QA_COPILOT.state.settings);
        // start watching SPA routes + render when issue changes
        window.QA_COPILOT.issueDetect.start({
            onIssueKey: (issueKey) => {
                window.QA_COPILOT.state.lastIssueKey = issueKey;
                log("Jira issue detected:", issueKey);
                window.QA_COPILOT.panel.renderIssue(issueKey);
            },
            onNoIssue: () => {
                window.QA_COPILOT.state.lastIssueKey = null;
                window.QA_COPILOT.panel.cleanup();
            }
        });
    };
    // namespace init
    window.QA_COPILOT = window.QA_COPILOT || {};
    window.QA_COPILOT.state = window.QA_COPILOT.state || {
        settings: null,
        lastIssueKey: null
    };
    boot();
})();
