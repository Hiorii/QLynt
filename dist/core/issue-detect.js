(() => {
    window.QA_COPILOT = window.QA_COPILOT || {};
    const log = (...args) => console.log("[QA Copilot]", ...args);
    const getSelectedIssueKey = () => {
        try {
            const url = new URL(window.location.href);
            return url.searchParams.get("selectedIssue"); // KAN-1
        }
        catch {
            return null;
        }
    };
    const getIssueKeyFromBrowsePath = () => {
        const m = window.location.pathname.match(/^\/browse\/([A-Z0-9]+-\d+)/i);
        return m?.[1] ?? null;
    };
    const getCurrentIssueKey = () => getIssueKeyFromBrowsePath() || getSelectedIssueKey();
    const start = ({ onIssueKey, onNoIssue }) => {
        let last = null;
        const tick = () => {
            const key = getCurrentIssueKey();
            if (key && key !== last) {
                last = key;
                log("Issue detected:", key);
                onIssueKey?.(key);
            }
            if (!key && last) {
                last = null;
                onNoIssue?.();
            }
        };
        tick();
        const _pushState = history.pushState;
        history.pushState = function (...args) {
            _pushState.apply(this, args);
            setTimeout(tick, 0);
        };
        const _replaceState = history.replaceState;
        history.replaceState = function (...args) {
            _replaceState.apply(this, args);
            setTimeout(tick, 0);
        };
        window.addEventListener("popstate", () => setTimeout(tick, 0));
        setInterval(tick, 800);
    };
    window.QA_COPILOT.issueDetect = { start };
})();
