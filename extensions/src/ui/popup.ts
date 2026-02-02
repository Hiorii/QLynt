export {};

/* global chrome */

const KEYS = {
  FN_URL_CHECKLIST: "qa_fn_url_checklist",
  FN_URL_BULK: "qa_fn_url_bulk",
  APIKEY: "qa_apikey",
} as const;

type Keys = typeof KEYS[keyof typeof KEYS];

type StorageShape = {
  [KEYS.FN_URL_CHECKLIST]?: string;
  [KEYS.FN_URL_BULK]?: string;
  [KEYS.APIKEY]?: string;
};

const elFnUrlChecklist =
  document.getElementById("fnUrl") as HTMLInputElement | null;
const elFnUrlBulk =
  document.getElementById("fnUrlBulk") as HTMLInputElement | null;
const elApiKey =
  document.getElementById("anonKey") as HTMLInputElement | null; // nazwa zostaje, ale używamy jako apikey do gate
const btnSave = document.getElementById("save") as HTMLButtonElement | null;
const btnClear = document.getElementById("clear") as HTMLButtonElement | null;
const statusEl = document.getElementById("status") as HTMLElement | null;

function flashSaved() {
  if (!statusEl) return;
  statusEl.style.display = "block";
  setTimeout(() => {
    if (!statusEl) return;
    statusEl.style.display = "none";
  }, 1200);
}

function load() {
  if (!elFnUrlChecklist || !elFnUrlBulk || !elApiKey) return;

  chrome.storage.local.get(
    [KEYS.FN_URL_CHECKLIST, KEYS.FN_URL_BULK, KEYS.APIKEY],
    (res: StorageShape) => {
      elFnUrlChecklist.value = res[KEYS.FN_URL_CHECKLIST] || "";
      elFnUrlBulk.value = res[KEYS.FN_URL_BULK] || "";
      elApiKey.value = res[KEYS.APIKEY] || "";
    }
  );
}

btnSave?.addEventListener("click", () => {
  if (!elFnUrlChecklist || !elFnUrlBulk || !elApiKey) return;

  const fnChecklist = (elFnUrlChecklist.value || "").trim();
  const fnBulk = (elFnUrlBulk.value || "").trim();
  const apikey = (elApiKey.value || "").trim();

  const payload: StorageShape = {
    [KEYS.FN_URL_CHECKLIST]: fnChecklist,
    [KEYS.FN_URL_BULK]: fnBulk,
    [KEYS.APIKEY]: apikey,
  };

  chrome.storage.local.set(payload, () => flashSaved());
});

btnClear?.addEventListener("click", () => {
  if (!elFnUrlChecklist || !elFnUrlBulk || !elApiKey) return;

  chrome.storage.local.remove(
    [KEYS.FN_URL_CHECKLIST, KEYS.FN_URL_BULK, KEYS.APIKEY] as Keys[],
    () => {
      elFnUrlChecklist.value = "";
      elFnUrlBulk.value = "";
      elApiKey.value = "";
      flashSaved();
    }
  );
});

load();
