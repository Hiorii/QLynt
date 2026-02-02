(() => {
    window.QA_COPILOT = window.QA_COPILOT || {};
    const log = (...args) => console.log("[QA Copilot]", ...args);
    const CONFIG_KEY = "qaCopilotApiConfig";
    const getStorage = () => {
        if (typeof chrome !== "undefined" && chrome.storage?.local) {
            return chrome.storage.local;
        }
        return null;
    };
    const isConfig = (x) => {
        if (!x || typeof x !== "object")
            return false;
        const o = x;
        return typeof o.supabaseUrl === "string" && typeof o.supabaseAnonKey === "string";
    };
    const loadConfig = async () => {
        const storage = getStorage();
        if (!storage)
            return null;
        return new Promise((resolve) => {
            storage.get([CONFIG_KEY], (res) => {
                const raw = res?.[CONFIG_KEY];
                resolve(isConfig(raw) ? raw : null);
            });
        });
    };
    const saveConfig = async (cfg) => {
        const storage = getStorage();
        if (!storage)
            return;
        return new Promise((resolve) => {
            storage.set({ [CONFIG_KEY]: cfg }, () => resolve());
        });
    };
    const analyzeTicket = async (payload) => {
        const cfg = await loadConfig();
        if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) {
            return {
                ok: false,
                error: "Missing Supabase config. Set supabaseUrl + supabaseAnonKey in storage.",
            };
        }
        const base = cfg.supabaseUrl.replace(/\/$/, "");
        const url = `${base}/functions/v1/analyze-ticket`;
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${cfg.supabaseAnonKey}`,
                apikey: cfg.supabaseAnonKey,
            },
            body: JSON.stringify(payload),
        });
        const text = await res.text();
        let json = null;
        try {
            json = JSON.parse(text);
        }
        catch {
            // ignore
        }
        if (!res.ok) {
            return {
                ok: false,
                status: res.status,
                error: json?.message || json?.error || text || "Request failed",
                raw: json || text,
            };
        }
        return json || { ok: false, error: "Empty JSON response" };
    };
    window.QA_COPILOT.supabase = { loadConfig, saveConfig, analyzeTicket };
    log("supabase client ready");
})();
export {};
