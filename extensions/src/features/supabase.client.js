(() => {
  window.QA_COPILOT = window.QA_COPILOT || {};
  const log = (...args) => console.log("[QA Copilot]", ...args);

  const CONFIG_KEY = "qaCopilotApiConfig";

  const getStorage = () =>
    typeof chrome !== "undefined" && chrome.storage && chrome.storage.local
      ? chrome.storage.local
      : null;

  const loadConfig = async () => {
    const storage = getStorage();
    if (!storage) return null;

    return new Promise((resolve) => {
      storage.get([CONFIG_KEY], (res) => resolve(res?.[CONFIG_KEY] || null));
    });
  };

  const saveConfig = async (cfg) => {
    const storage = getStorage();
    if (!storage) return;

    return new Promise((resolve) => {
      storage.set({ [CONFIG_KEY]: cfg }, () => resolve());
    });
  };

  const analyzeTicket = async (payload) => {
    const cfg = await loadConfig();

    if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) {
      return {
        ok: false,
        error:
          "Missing Supabase config. Set supabaseUrl + supabaseAnonKey in storage.",
      };
    }

    const url = `${cfg.supabaseUrl.replace(/\/$/, "")}/functions/v1/analyze-ticket`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // w Supabase najczęściej działają oba naraz:
        Authorization: `Bearer ${cfg.supabaseAnonKey}`,
        apikey: cfg.supabaseAnonKey,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
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

  window.QA_COPILOT.supabase = {
    loadConfig,
    saveConfig,
    analyzeTicket,
  };

  log("supabase client ready");
})();
