/* global chrome */
const storageGet = (keys) => new Promise((resolve) => {
    chrome.storage.local.get(keys, (res) => resolve(res));
});
(() => {
    window.QA_COPILOT = window.QA_COPILOT || {};
    const log = (...args) => console.log("[QA Copilot]", ...args);
    const PANEL_ID = "qa-copilot-panel";
    const createPanel = () => {
        const panel = document.createElement("div");
        panel.id = PANEL_ID;
        panel.innerHTML = `
      <div style="padding: 12px; font-family: Arial, sans-serif;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <h3 style="margin: 0;">QA Copilot (MVP)</h3>
          <button id="qa-settings-toggle" title="Settings"
            style="border:1px solid #ddd; background:#fff; border-radius:8px; padding:6px 10px; cursor:pointer;">
            ⚙️
          </button>
        </div>

        <div id="qa-copilot-issue" style="font-size: 13px; margin: 8px 0 10px; color: #555;"></div>

        <!-- Settings -->
        <div id="qa-settings" style="display:none; padding:10px; border:1px solid #eee; background:#fafafa; border-radius:10px; margin-bottom:12px;">
          <div style="font-weight:700; margin-bottom:8px;">Settings</div>

          <div style="font-size:12px; color:#555; margin-bottom:6px;">
            AC synonyms (comma separated):
          </div>
          <textarea id="qa-ac-synonyms" rows="3"
            style="width:100%; box-sizing:border-box; padding:8px; border:1px solid #ddd; border-radius:8px; font-size:12px;"></textarea>

          <div style="display:flex; flex-direction:column; gap:6px; margin-top:10px; font-size:12px;">
            <label style="display:flex; gap:8px; align-items:center;">
              <input type="checkbox" id="qa-opt-dom" />
              Detect AC from Jira fields (DOM)
            </label>
            <label style="display:flex; gap:8px; align-items:center;">
              <input type="checkbox" id="qa-opt-desc" />
              Detect AC from description (keywords / checklist)
            </label>
            <label style="display:flex; gap:8px; align-items:center;">
              <input type="checkbox" id="qa-opt-gherkin" />
              Detect AC from Gherkin (Given/When/Then)
            </label>
          </div>

          <div style="display:flex; gap:8px; margin-top:10px;">
            <button id="qa-settings-save" style="flex:1; padding:8px 10px; border:1px solid #ddd; background:#fff; border-radius:8px; cursor:pointer;">
              Save
            </button>
            <button id="qa-settings-reset" style="padding:8px 10px; border:1px solid #ddd; background:#fff; border-radius:8px; cursor:pointer;">
              Reset
            </button>
          </div>

          <div id="qa-settings-status" style="margin-top:8px; font-size:12px; color:#2f6f2f; display:none;">
            Saved ✅
          </div>
        </div>

        <!-- Ticket context -->
        <div style="margin-bottom: 12px;">
          <strong>Ticket context</strong>
          <div style="margin-top: 6px; font-size: 12px; line-height: 1.35;">
            <div><span style="color:#666;">Title:</span> <span id="qa-title"></span></div>
            <div style="margin-top:4px;"><span style="color:#666;">Has AC:</span> <span id="qa-hasac"></span></div>
            <div style="margin-top:4px;"><span style="color:#666;">Description:</span></div>
            <div id="qa-desc" style="margin-top:4px; padding:6px; background:#f7f7f7; border:1px solid #eee; border-radius:6px; max-height:140px; overflow:auto;"></div>
          </div>
        </div>

        <!-- Signals -->
        <div style="margin-bottom: 12px;">
          <strong>Quality Signals</strong>
          <ul id="qa-copilot-signals" style="padding-left: 16px; margin-top: 6px;"></ul>
        </div>

        <!-- Checklist -->
        <div style="margin-bottom: 12px;">
          <strong>Suggested regression checklist</strong>

          <div id="qa-checklist-status" style="margin-top:6px; font-size:12px; color:#666;"></div>
          <ul id="qa-checklist" style="padding-left: 16px; margin-top: 6px;"></ul>
        </div>

        <div style="margin-bottom: 12px;">
          <strong>Generated test cases</strong>
          <div id="qa-testcases-status" style="margin-top:6px; font-size:12px; color:#666;"></div>
          <div id="qa-testcases"></div>
        </div>

        <!-- Actions -->
        <div>
          <strong>Actions</strong><br/>

          <button id="qa-generate-checklist"
            style="margin-top: 6px; padding:8px 10px; border:1px solid #ddd; background:#fff; border-radius:8px; cursor:pointer;">
            Generate checklist
          </button>

          <button id="qa-generate-testcases-bulk"
            style="margin-top: 6px; padding:8px 10px; border:1px solid #ddd; background:#fff; border-radius:8px; cursor:pointer;">
            Generate ALL test cases
          </button>

          <div id="qa-selected-info" style="margin-top:6px; font-size:12px; color:#666;"></div>
        </div>
      </div>
    `;
        Object.assign(panel.style, {
            position: "fixed",
            top: "0",
            right: "0",
            width: "360px",
            height: "100vh",
            background: "#fff",
            borderLeft: "1px solid #ddd",
            zIndex: "99999",
            boxShadow: "-2px 0 6px rgba(0,0,0,0.1)",
        });
        document.body.appendChild(panel);
        wireSettingsUI(panel);
        wireActionsUI(panel);
        log("Panel injected (full + checklist)");
        return panel;
    };
    const ensurePanelMounted = () => {
        let panel = document.getElementById(PANEL_ID);
        if (!panel)
            panel = createPanel();
        return panel;
    };
    const flashSaved = (panel) => {
        const el = panel.querySelector("#qa-settings-status");
        if (!el)
            return;
        el.style.display = "block";
        setTimeout(() => {
            el.style.display = "none";
        }, 1200);
    };
    const ensureState = () => {
        const copilot = window.QA_COPILOT;
        copilot.state = copilot.state || {};
        copilot.state.testcasesByItemId = copilot.state.testcasesByItemId || {};
        copilot.state.lastGeneratedTestcase = copilot.state.lastGeneratedTestcase || null;
        copilot.state.lastChecklist = copilot.state.lastChecklist ?? null;
    };
    const severityToRisk = (sev) => {
        const s = (sev || "").toLowerCase();
        if (s === "must")
            return "HIGH";
        if (s === "should")
            return "MEDIUM";
        return "LOW";
    };
    const wireSettingsUI = (panel) => {
        ensureState();
        const copilot = window.QA_COPILOT;
        const toggleBtn = panel.querySelector("#qa-settings-toggle");
        const settingsBox = panel.querySelector("#qa-settings");
        const synonymsEl = panel.querySelector("#qa-ac-synonyms");
        const optDom = panel.querySelector("#qa-opt-dom");
        const optDesc = panel.querySelector("#qa-opt-desc");
        const optGherkin = panel.querySelector("#qa-opt-gherkin");
        const btnSave = panel.querySelector("#qa-settings-save");
        const btnReset = panel.querySelector("#qa-settings-reset");
        if (!toggleBtn || !settingsBox || !synonymsEl || !optDom || !optDesc || !optGherkin || !btnSave || !btnReset) {
            return;
        }
        const renderSettings = () => {
            const s = copilot.state.settings;
            synonymsEl.value = (s?.acSynonyms || []).join(", ");
            optDom.checked = !!s?.detectFromJiraFieldsDom;
            optDesc.checked = !!s?.detectFromDescription;
            optGherkin.checked = !!s?.detectFromGherkin;
        };
        toggleBtn.addEventListener("click", () => {
            const isOpen = settingsBox.style.display !== "none";
            settingsBox.style.display = isOpen ? "none" : "block";
            if (!isOpen)
                renderSettings();
        });
        btnSave.addEventListener("click", async () => {
            const raw = synonymsEl.value || "";
            const parsed = raw
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean);
            const defaults = copilot.settings.DEFAULT_SETTINGS;
            copilot.state.settings = {
                ...copilot.state.settings,
                acSynonyms: parsed.length ? parsed : defaults.acSynonyms,
                detectFromJiraFieldsDom: optDom.checked,
                detectFromDescription: optDesc.checked,
                detectFromGherkin: optGherkin.checked,
            };
            await copilot.settings.save(copilot.state.settings);
            flashSaved(panel);
            const key = copilot.state.lastIssueKey;
            if (key)
                renderIssue(key);
            log("Settings saved:", copilot.state.settings);
        });
        btnReset.addEventListener("click", async () => {
            copilot.state.settings = { ...copilot.settings.DEFAULT_SETTINGS };
            await copilot.settings.save(copilot.state.settings);
            flashSaved(panel);
            renderSettings();
            const key = copilot.state.lastIssueKey;
            if (key)
                renderIssue(key);
            log("Settings reset");
        });
    };
    const wireActionsUI = (panel) => {
        ensureState();
        const copilot = window.QA_COPILOT;
        const btnChecklist = panel.querySelector("#qa-generate-checklist");
        const btnBulk = panel.querySelector("#qa-generate-testcases-bulk");
        const statusEl = panel.querySelector("#qa-checklist-status");
        const checklistEl = panel.querySelector("#qa-checklist");
        const testcasesEl = panel.querySelector("#qa-testcases");
        const testcasesStatusEl = panel.querySelector("#qa-testcases-status");
        if (!btnChecklist || !btnBulk || !statusEl || !checklistEl || !testcasesEl || !testcasesStatusEl)
            return;
        const setLoading = (btn, loading, textLoading, textIdle) => {
            btn.disabled = loading;
            btn.style.opacity = loading ? "0.6" : "1";
            btn.textContent = loading ? textLoading : textIdle;
        };
        const renderChecklist = (items) => {
            checklistEl.innerHTML = "";
            (items || []).forEach((x) => {
                const li = document.createElement("li");
                li.textContent = x;
                checklistEl.appendChild(li);
            });
        };
        const renderTestcases = (results) => {
            testcasesEl.innerHTML = "";
            (results || []).forEach((r) => {
                const card = document.createElement("div");
                card.style.border = "1px solid #eee";
                card.style.borderRadius = "10px";
                card.style.padding = "10px";
                card.style.marginTop = "8px";
                card.style.background = "#fafafa";
                if (!r.ok) {
                    card.innerHTML = `
            <div style="font-weight:700; color:#b91c1c;">❌ Failed</div>
            <div style="font-size:12px; color:#555; margin-top:6px;">
              Seed: <b>${escapeHtml(r?.seed?.text || "")}</b>
            </div>
            <div style="font-size:12px; color:#b91c1c; margin-top:6px;">
              ${escapeHtml(r?.error || "Error")}
            </div>
          `;
                    testcasesEl.appendChild(card);
                    return;
                }
                const tc = r.testcase;
                const seedText = r?.seed?.text || "";
                const payloadForCopy = toTestRailPlainText(tc);
                card.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <div style="font-weight:700;">${escapeHtml(tc.title)}</div>
            <button class="qa-copy" style="border:1px solid #ddd; background:#fff; border-radius:8px; padding:6px 10px; cursor:pointer;">
              Copy (TestRail)
            </button>
          </div>
          <div style="font-size:12px; color:#555; margin-top:6px;">
            From seed: ${escapeHtml(seedText)}
          </div>
          <div style="margin-top:8px; font-size:12px;">
            <div><b>Preconditions:</b> ${escapeHtml(tc.preconditions || "None")}</div>
            <div style="margin-top:6px;"><b>Steps:</b></div>
            <ol style="margin:6px 0 0 18px; padding:0;">
              ${(tc.steps || [])
                    .map((s) => `<li style="margin-bottom:4px;"><span>${escapeHtml(s.content)}</span><br/><span style="color:#555;">Expected: ${escapeHtml(s.expected)}</span></li>`)
                    .join("")}
            </ol>
          </div>
        `;
                const copyBtn = card.querySelector(".qa-copy");
                copyBtn?.addEventListener("click", async () => {
                    try {
                        await navigator.clipboard.writeText(payloadForCopy);
                        if (copyBtn)
                            copyBtn.textContent = "Copied ✅";
                        setTimeout(() => {
                            if (copyBtn)
                                copyBtn.textContent = "Copy (TestRail)";
                        }, 1200);
                    }
                    catch (e) {
                        console.error(e);
                        if (copyBtn)
                            copyBtn.textContent = "Copy failed ❌";
                        setTimeout(() => {
                            if (copyBtn)
                                copyBtn.textContent = "Copy (TestRail)";
                        }, 1200);
                    }
                });
                testcasesEl.appendChild(card);
            });
        };
        btnChecklist.addEventListener("click", async () => {
            try {
                const key = copilot.state.lastIssueKey;
                if (!key)
                    return;
                setLoading(btnChecklist, true, "Generating…", "Generate checklist");
                statusEl.textContent = "Calling AI (Supabase)…";
                renderChecklist([]);
                testcasesEl.innerHTML = "";
                testcasesStatusEl.textContent = "";
                await new Promise((r) => setTimeout(r, 120));
                const ctx = copilot.jiraParser.extractTicketContext(key);
                const hasAC = copilot.acDetect.detectAcceptanceCriteria(ctx.title, ctx.description);
                const { qa_fn_url_checklist, qa_apikey } = await storageGet(["qa_fn_url_checklist", "qa_apikey"]);
                if (!qa_fn_url_checklist || !qa_apikey) {
                    statusEl.textContent = "Brak konfiguracji w popupie (URL checklist + apikey).";
                    return;
                }
                const payload = {
                    issueKey: key,
                    title: ctx.title || "",
                    description: ctx.description || "",
                    hasAcceptanceCriteria: !!hasAC,
                    signals: [],
                };
                const resp = await fetch(qa_fn_url_checklist, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        apikey: qa_apikey,
                        Authorization: `Bearer ${qa_apikey}`,
                    },
                    body: JSON.stringify(payload),
                });
                const data = (await resp.json().catch(() => ({})));
                if (!resp.ok || !data?.ok) {
                    console.error("Checklist function error:", { status: resp.status, data });
                    statusEl.textContent = "Błąd checklist (zobacz console) ❌";
                    return;
                }
                const items = (data.checklist?.items || []).map((x) => {
                    const sev = x.severity ? `[${x.severity}] ` : "";
                    return `${sev}${x.text ?? ""}`.trim();
                });
                copilot.state.lastChecklist = data.checklist || null;
                renderChecklist(items);
                statusEl.textContent = `Generated ${items.length} items ✅`;
            }
            catch (e) {
                console.error(e);
                statusEl.textContent = "Error generating checklist ❌";
            }
            finally {
                setLoading(btnChecklist, false, "Generating…", "Generate checklist");
            }
        });
        btnBulk.addEventListener("click", async () => {
            try {
                const key = copilot.state.lastIssueKey;
                if (!key)
                    return;
                const checklist = copilot.state.lastChecklist;
                if (!checklist?.items?.length) {
                    testcasesStatusEl.textContent = "Najpierw wygeneruj checklistę ✅";
                    return;
                }
                setLoading(btnBulk, true, "Generating…", "Generate ALL test cases");
                testcasesStatusEl.textContent = "Calling bulk AI (Supabase)…";
                testcasesEl.innerHTML = "";
                await new Promise((r) => setTimeout(r, 120));
                const ctx = copilot.jiraParser.extractTicketContext(key);
                const hasAC = copilot.acDetect.detectAcceptanceCriteria(ctx.title, ctx.description);
                const { qa_fn_url_bulk, qa_apikey } = await storageGet(["qa_fn_url_bulk", "qa_apikey"]);
                if (!qa_fn_url_bulk || !qa_apikey) {
                    testcasesStatusEl.textContent = "Brak konfiguracji w popupie (URL bulk + apikey).";
                    return;
                }
                const seeds = checklist.items.map((it) => ({
                    id: it.id,
                    text: it.text,
                    severity: it.severity,
                }));
                const payload = {
                    issueKey: key,
                    title: ctx.title || "",
                    description: ctx.description || "",
                    hasAcceptanceCriteria: !!hasAC,
                    signals: [],
                    seeds,
                    options: { maxItems: 10 },
                };
                const resp = await fetch(qa_fn_url_bulk, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        apikey: qa_apikey,
                        Authorization: `Bearer ${qa_apikey}`,
                    },
                    body: JSON.stringify(payload),
                });
                const data = (await resp.json().catch(() => ({})));
                if (!resp.ok || !data?.ok) {
                    console.error("Bulk function error:", { status: resp.status, data });
                    testcasesStatusEl.textContent = "Błąd bulk (zobacz console) ❌";
                    return;
                }
                renderTestcases((data.results || []));
                testcasesStatusEl.textContent = `Generated ${data?.stats?.ok ?? 0} test cases ✅ (errors: ${data?.stats?.errors ?? 0})`;
            }
            catch (e) {
                console.error(e);
                testcasesStatusEl.textContent = "Error generating test cases ❌";
            }
            finally {
                setLoading(btnBulk, false, "Generating…", "Generate ALL test cases");
            }
        });
    };
    function escapeHtml(s) {
        return String(s ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    function toTestRailPlainText(tc) {
        const lines = [];
        lines.push(`Title: ${tc.title}`);
        lines.push(`Preconditions: ${tc.preconditions || "None"}`);
        lines.push("");
        lines.push("Steps:");
        (tc.steps || []).forEach((s, i) => {
            lines.push(`${i + 1}. ${s.content}`);
            lines.push(`   Expected: ${s.expected}`);
        });
        return lines.join("\n");
    }
    const renderIssue = (issueKey) => {
        const panel = ensurePanelMounted();
        ensureState();
        const copilot = window.QA_COPILOT;
        const statusEl = panel.querySelector("#qa-checklist-status");
        const listEl = panel.querySelector("#qa-checklist");
        if (statusEl)
            statusEl.textContent = "";
        if (listEl)
            listEl.innerHTML = "";
        const tryParseAndRender = (attempt = 1) => {
            const ctx = copilot.jiraParser.extractTicketContext(issueKey);
            const issueEl = panel.querySelector("#qa-copilot-issue");
            const titleEl = panel.querySelector("#qa-title");
            const descEl = panel.querySelector("#qa-desc");
            const hasAcEl = panel.querySelector("#qa-hasac");
            const signalsEl = panel.querySelector("#qa-copilot-signals");
            if (issueEl)
                issueEl.textContent = `Issue: ${issueKey}`;
            if (titleEl)
                titleEl.textContent = ctx.title || "(not found yet)";
            if (descEl)
                descEl.textContent = ctx.descriptionPreview || "(empty / not found yet)";
            const hasAC = copilot.acDetect.detectAcceptanceCriteria(ctx.title, ctx.description);
            if (hasAcEl)
                hasAcEl.textContent = hasAC ? "✅ yes" : "❌ no / not detected";
            if (signalsEl) {
                signalsEl.innerHTML = "";
                const signals = [];
                if (!ctx.title)
                    signals.push("Could not read title (DOM not ready yet)");
                if (!ctx.description)
                    signals.push("No description detected");
                if (!hasAC)
                    signals.push("No acceptance criteria detected");
                if (signals.length === 0)
                    signals.push("Basic parsing OK ✅");
                signals.forEach((s) => {
                    const li = document.createElement("li");
                    li.textContent = s;
                    signalsEl.appendChild(li);
                });
            }
            log("ticketContext:", { ...ctx, hasAcceptanceCriteria: hasAC });
            const domNotReady = !ctx.title && !ctx.description;
            if (domNotReady && attempt < 5)
                setTimeout(() => tryParseAndRender(attempt + 1), 400);
        };
        tryParseAndRender();
    };
    const cleanup = () => {
        const panel = document.getElementById(PANEL_ID);
        if (panel)
            panel.remove();
    };
    // attach API
    window.QA_COPILOT = window.QA_COPILOT || {};
    window.QA_COPILOT.panel = { renderIssue, cleanup };
})();
