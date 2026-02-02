/* global chrome */
const KEYS = {
    FN_URL_CHECKLIST: "qa_fn_url_checklist",
    FN_URL_BULK: "qa_fn_url_bulk",
    APIKEY: "qa_apikey",
};
const elFnUrlChecklist = document.getElementById("fnUrl");
const elFnUrlBulk = document.getElementById("fnUrlBulk");
const elApiKey = document.getElementById("anonKey"); // nazwa zostaje, ale używamy jako apikey do gate
const btnSave = document.getElementById("save");
const btnClear = document.getElementById("clear");
const statusEl = document.getElementById("status");
function flashSaved() {
    if (!statusEl)
        return;
    statusEl.style.display = "block";
    setTimeout(() => {
        if (!statusEl)
            return;
        statusEl.style.display = "none";
    }, 1200);
}
function load() {
    if (!elFnUrlChecklist || !elFnUrlBulk || !elApiKey)
        return;
    chrome.storage.local.get([KEYS.FN_URL_CHECKLIST, KEYS.FN_URL_BULK, KEYS.APIKEY], (res) => {
        elFnUrlChecklist.value = res[KEYS.FN_URL_CHECKLIST] || "";
        elFnUrlBulk.value = res[KEYS.FN_URL_BULK] || "";
        elApiKey.value = res[KEYS.APIKEY] || "";
    });
}
btnSave?.addEventListener("click", () => {
    if (!elFnUrlChecklist || !elFnUrlBulk || !elApiKey)
        return;
    const fnChecklist = (elFnUrlChecklist.value || "").trim();
    const fnBulk = (elFnUrlBulk.value || "").trim();
    const apikey = (elApiKey.value || "").trim();
    const payload = {
        [KEYS.FN_URL_CHECKLIST]: fnChecklist,
        [KEYS.FN_URL_BULK]: fnBulk,
        [KEYS.APIKEY]: apikey,
    };
    chrome.storage.local.set(payload, () => flashSaved());
});
btnClear?.addEventListener("click", () => {
    if (!elFnUrlChecklist || !elFnUrlBulk || !elApiKey)
        return;
    chrome.storage.local.remove([KEYS.FN_URL_CHECKLIST, KEYS.FN_URL_BULK, KEYS.APIKEY], () => {
        elFnUrlChecklist.value = "";
        elFnUrlBulk.value = "";
        elApiKey.value = "";
        flashSaved();
    });
});
load();
