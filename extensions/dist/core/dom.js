(() => {
    window.QA_COPILOT = window.QA_COPILOT || {};
    const normalize = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
    const textFrom = (el) => (el?.textContent || "").trim();
    const firstMatchText = (selectors) => {
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            const t = textFrom(el);
            if (t)
                return t;
        }
        return "";
    };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // Wait until a selector appears (useful for Jira SPA async rendering)
    const waitFor = async (selector, { timeoutMs = 5000, intervalMs = 200 } = {}) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const el = document.querySelector(selector);
            if (el)
                return el;
            await sleep(intervalMs);
        }
        return null;
    };
    window.QA_COPILOT.dom = {
        normalize,
        textFrom,
        firstMatchText,
        sleep,
        waitFor
    };
})();
