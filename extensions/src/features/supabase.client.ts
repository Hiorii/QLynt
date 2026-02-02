export {}; // robi z pliku moduł => usuwa "Duplicate identifier" między plikami

(() => {
  window.QA_COPILOT = window.QA_COPILOT || {};

  const log = (...args: unknown[]) => console.log("[QA Copilot]", ...args);

  const CONFIG_KEY = "qaCopilotApiConfig";

  const getStorage = (): chrome.storage.LocalStorageArea | null => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      return chrome.storage.local;
    }
    return null;
  };

  const isConfig = (x: unknown): x is QACopilotSupabaseConfig => {
    if (!x || typeof x !== "object") return false;
    const o = x as any;
    return typeof o.supabaseUrl === "string" && typeof o.supabaseAnonKey === "string";
  };

  const loadConfig = async (): Promise<QACopilotSupabaseConfig | null> => {
    const storage = getStorage();
    if (!storage) return null;

    return new Promise<QACopilotSupabaseConfig | null>((resolve) => {
      storage.get([CONFIG_KEY], (res) => {
        const raw = (res as any)?.[CONFIG_KEY];
        resolve(isConfig(raw) ? raw : null);
      });
    });
  };

  const saveConfig = async (cfg: QACopilotSupabaseConfig): Promise<void> => {
    const storage = getStorage();
    if (!storage) return;

    return new Promise<void>((resolve) => {
      storage.set({ [CONFIG_KEY]: cfg }, () => resolve());
    });
  };

  const analyzeTicket = async (payload: unknown): Promise<any> => {
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
    let json: any = null;

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

  window.QA_COPILOT.supabase = { loadConfig, saveConfig, analyzeTicket };

  log("supabase client ready");
})();
