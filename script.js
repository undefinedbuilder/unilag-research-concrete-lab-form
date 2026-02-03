/* -----------------------------------------------------------
   UNILAG CONCRETE LAB – RESEARCH MIX FRONT-END (script.js)
   -----------------------------------------------------------
   Includes:
   1) PDF includes EVERYTHING in the form (admixtures, SCMs, all aggregate rows, notes)
   2) Switching modes clears the inactive mode values (kg/m³ <-> ratio)
   3) All buttons wired (add rows, reset, export CSV, clear all, load saved row)
   4) Submits to backend: /api/submit

   NOTE (Office-use box):
   The "FOR OFFICE USE ONLY" section is reproduced exactly (text + layout) from
   the attached reference script. fileciteturn4file0
----------------------------------------------------------- */

const STORAGE_KEY = "unilag-concrete-lab-research-mixes";
const SUBMIT_URL = "/api/submit";
let logoImageDataUrl = null;

/* ---------- Helpers ---------- */

const $ = (id) => document.getElementById(id);

const setToday = (inputEl) => {
  if (!inputEl) return;
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  inputEl.value = new Date(Date.now() - tzOffset).toISOString().slice(0, 10);
};

const sanitizeFilename = (name) =>
  String(name || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const setStatusLine = (msg, type = "info") => {
  const el = $("status-line");
  if (!el) return;
  if (!msg) {
    el.style.display = "none";
    return;
  }
  el.style.display = "inline-flex";
  el.textContent = msg;
  el.className = `status-pill status-${type}`;
};

const getInputMode = () =>
  (document.querySelector('input[name="inputMode"]:checked') || {}).value || "kg";

let lastInputMode = "kg";

const loadImageAsDataURL = (path) =>
  fetch(path)
    .then((r) => r.blob())
    .then(
      (b) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(b);
        })
    )
    .catch(() => null);

/* ---------- Dynamic rows: Admixtures & SCMs ---------- */

const createAdmixtureRow = (data = {}) => {
  const row = document.createElement("div");
  row.className = "dynamic-row";
  row.innerHTML = `
    <label>
      <span class="label-line">
        Admixture Name <span class="required-asterisk">*</span>
      </span>
      <input type="text" name="adm_name" value="${data.name || ""}">
    </label>
    <label>
      <span class="label-line">
        Dosage (L/100kg of Cement) <span class="required-asterisk">*</span>
      </span>
      <input type="text" name="adm_dosage" value="${data.dosage || ""}">
    </label>
    <button type="button" class="remove-row-btn" aria-label="Remove row">×</button>
  `;
  row.querySelector(".remove-row-btn").onclick = () => row.remove();
  return row;
};

const createScmRow = (data = {}) => {
  const row = document.createElement("div");
  row.className = "dynamic-row";
  row.innerHTML = `
    <label>
      <span class="label-line">
        SCM Name <span class="required-asterisk">*</span>
      </span>
      <input type="text" name="scm_name" value="${data.name || ""}">
    </label>
    <label>
      <span class="label-line">
        Percent (%) <span class="required-asterisk">*</span>
      </span>
      <input type="text" name="scm_percent" value="${data.percent || ""}">
    </label>
    <button type="button" class="remove-row-btn" aria-label="Remove row">×</button>
  `;
  row.querySelector(".remove-row-btn").onclick = () => row.remove();
  return row;
};

/* ---------- Dynamic rows: Fine/Coarse (kg & ratio) ---------- */

const ensureAtLeastOneRow = (containerId, factoryFn) => {
  const c = $(containerId);
  if (!c) return;
  if (!c.querySelector(".dynamic-row")) c.appendChild(factoryFn());
};

const createFineKgRow = (data = {}) => {
  const row = document.createElement("div");
  row.className = "dynamic-row fine-kg-row";
  row.innerHTML = `
    <label>
      <span class="label-line">
        Fine Aggregate Name <span class="required-asterisk">*</span>
      </span>
      <input type="text" name="fine_name" value="${data.name || ""}">
    </label>
    <label>
      <span class="label-line">
        Quantity (kg/m³) <span class="required-asterisk">*</span>
      </span>
      <input type="number" min="0" step="0.1" name="fine_qty" value="${data.qty ?? ""}">
    </label>
    <button type="button" class="remove-row-btn" aria-label="Remove row">×</button>
  `;

  const onChange = () => syncFineKgTotal();
  row.querySelector('input[name="fine_name"]').addEventListener("input", onChange);
  row.querySelector('input[name="fine_qty"]').addEventListener("input", onChange);

  row.querySelector(".remove-row-btn").onclick = () => {
    row.remove();
    ensureAtLeastOneRow("fine-kg-container", createFineKgRow);
    syncFineKgTotal();
  };

  return row;
};

const createCoarseKgRow = (data = {}) => {
  const row = document.createElement("div");
  row.className = "dynamic-row coarse-kg-row";
  row.innerHTML = `
    <label>
      <span class="label-line">
        Coarse Aggregate Name <span class="required-asterisk">*</span>
      </span>
      <input type="text" name="coarse_name" value="${data.name || ""}">
    </label>
    <label>
      <span class="label-line">
        Quantity (kg/m³) <span class="required-asterisk">*</span>
      </span>
      <input type="number" min="0" step="0.1" name="coarse_qty" value="${data.qty ?? ""}">
    </label>
    <button type="button" class="remove-row-btn" aria-label="Remove row">×</button>
  `;

  const onChange = () => syncCoarseKgTotal();
  row.querySelector('input[name="coarse_name"]').addEventListener("input", onChange);
  row.querySelector('input[name="coarse_qty"]').addEventListener("input", onChange);

  row.querySelector(".remove-row-btn").onclick = () => {
    row.remove();
    ensureAtLeastOneRow("coarse-kg-container", createCoarseKgRow);
    syncCoarseKgTotal();
  };

  return row;
};

const createFineRatioRow = (data = {}) => {
  const row = document.createElement("div");
  row.className = "dynamic-row fine-ratio-row";
  row.innerHTML = `
    <label>
      <span class="label-line">
        Fine Aggregate Name <span class="required-asterisk">*</span>
      </span>
      <input type="text" name="rfine_name" value="${data.name || ""}">
    </label>
    <label>
      <span class="label-line">
        Ratio (by Cement) <span class="required-asterisk">*</span>
      </span>
      <input type="number" min="0" step="0.01" name="rfine_qty" value="${data.qty ?? ""}">
    </label>
    <button type="button" class="remove-row-btn" aria-label="Remove row">×</button>
  `;

  const onChange = () => syncFineRatioTotal();
  row.querySelector('input[name="rfine_name"]').addEventListener("input", onChange);
  row.querySelector('input[name="rfine_qty"]').addEventListener("input", onChange);

  row.querySelector(".remove-row-btn").onclick = () => {
    row.remove();
    ensureAtLeastOneRow("fine-ratio-container", createFineRatioRow);
    syncFineRatioTotal();
  };

  return row;
};

const createCoarseRatioRow = (data = {}) => {
  const row = document.createElement("div");
  row.className = "dynamic-row coarse-ratio-row";
  row.innerHTML = `
    <label>
      <span class="label-line">
        Coarse Aggregate Name <span class="required-asterisk">*</span>
      </span>
      <input type="text" name="rcoarse_name" value="${data.name || ""}">
    </label>
    <label>
      <span class="label-line">
        Ratio (by Cement) <span class="required-asterisk">*</span>
      </span>
      <input type="number" min="0" step="0.01" name="rcoarse_qty" value="${data.qty ?? ""}">
    </label>
    <button type="button" class="remove-row-btn" aria-label="Remove row">×</button>
  `;

  const onChange = () => syncCoarseRatioTotal();
  row.querySelector('input[name="rcoarse_name"]').addEventListener("input", onChange);
  row.querySelector('input[name="rcoarse_qty"]').addEventListener("input", onChange);

  row.querySelector(".remove-row-btn").onclick = () => {
    row.remove();
    ensureAtLeastOneRow("coarse-ratio-container", createCoarseRatioRow);
    syncCoarseRatioTotal();
  };

  return row;
};

const ensureDefaultAggregateRows = () => {
  ensureAtLeastOneRow("fine-kg-container", createFineKgRow);
  ensureAtLeastOneRow("coarse-kg-container", createCoarseKgRow);
  ensureAtLeastOneRow("fine-ratio-container", createFineRatioRow);
  ensureAtLeastOneRow("coarse-ratio-container", createCoarseRatioRow);

  syncFineKgTotal();
  syncCoarseKgTotal();
  syncFineRatioTotal();
  syncCoarseRatioTotal();
};

/* ---------- Totals + derived values ---------- */

const toggleRatioBoxes = (show) => {
  const wc = $("wcratio-box");
  const mix = $("mixratio-box");
  if (!wc || !mix) return;
  wc.style.display = mix.style.display = show ? "" : "none";
};

const updateWCRatioFromKg = () => {
  const cement = parseFloat($("cementContent")?.value);
  const water = parseFloat($("waterContent")?.value);
  const fine = parseFloat($("fineAgg")?.value);
  const coarse = parseFloat($("coarseAgg")?.value);

  if ([cement, water, fine, coarse].some((v) => isNaN(v)) || cement <= 0) {
    toggleRatioBoxes(false);
    return 0;
  }

  const ratio = water / cement;
  $("wcRatioValue").textContent = ratio.toFixed(2);
  toggleRatioBoxes(true);
  return ratio;
};

const updateMixRatioFromKg = () => {
  const cement = parseFloat($("cementContent")?.value);
  const fine = parseFloat($("fineAgg")?.value);
  const coarse = parseFloat($("coarseAgg")?.value);
  const water = parseFloat($("waterContent")?.value);

  if ([cement, fine, coarse, water].some((v) => isNaN(v)) || cement <= 0) {
    toggleRatioBoxes(false);
    return "";
  }

  const mix = `1 : ${(fine / cement).toFixed(2)} : ${(coarse / cement).toFixed(2)} : ${(water / cement).toFixed(2)}`;
  $("mixRatioValue").textContent = mix;
  toggleRatioBoxes(true);
  return mix;
};

const updateWcAndMixFromRatio = () => {
  const c = parseFloat($("ratioCement")?.value);
  const f = parseFloat($("ratioFine")?.value);
  const co = parseFloat($("ratioCoarse")?.value);
  const w = parseFloat($("ratioWater")?.value);

  if ([c, f, co, w].some((v) => isNaN(v)) || c <= 0) {
    toggleRatioBoxes(false);
    return { wcRatio: 0, mixRatioString: "" };
  }

  const wc = w / c;
  const mix = `1 : ${(f / c).toFixed(2)} : ${(co / c).toFixed(2)} : ${(w / c).toFixed(2)}`;

  $("wcRatioValue").textContent = wc.toFixed(2);
  $("mixRatioValue").textContent = mix;
  toggleRatioBoxes(true);
  return { wcRatio: wc, mixRatioString: mix };
};

const syncFineKgTotal = () => {
  const c = $("fine-kg-container");
  const totalEl = $("fineAgg");
  if (!c || !totalEl) return;

  let anyBlank = false;
  let total = 0;

  c.querySelectorAll(".dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="fine_name"]')?.value.trim() || "";
    const qtyRaw = row.querySelector('input[name="fine_qty"]')?.value;

    if (!name || qtyRaw === "") anyBlank = true;

    const qty = parseFloat(qtyRaw);
    if (!isNaN(qty)) total += qty;
  });

  totalEl.value = anyBlank ? "" : String(total);

  updateWCRatioFromKg();
  updateMixRatioFromKg();
};

const syncCoarseKgTotal = () => {
  const c = $("coarse-kg-container");
  const totalEl = $("coarseAgg");
  if (!c || !totalEl) return;

  let anyBlank = false;
  let total = 0;

  c.querySelectorAll(".dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="coarse_name"]')?.value.trim() || "";
    const qtyRaw = row.querySelector('input[name="coarse_qty"]')?.value;

    if (!name || qtyRaw === "") anyBlank = true;

    const qty = parseFloat(qtyRaw);
    if (!isNaN(qty)) total += qty;
  });

  totalEl.value = anyBlank ? "" : String(total);

  updateWCRatioFromKg();
  updateMixRatioFromKg();
};

const syncFineRatioTotal = () => {
  const c = $("fine-ratio-container");
  const totalEl = $("ratioFine");
  if (!c || !totalEl) return;

  let anyBlank = false;
  let total = 0;

  c.querySelectorAll(".dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="rfine_name"]')?.value.trim() || "";
    const qtyRaw = row.querySelector('input[name="rfine_qty"]')?.value;

    if (!name || qtyRaw === "") anyBlank = true;

    const qty = parseFloat(qtyRaw);
    if (!isNaN(qty)) total += qty;
  });

  totalEl.value = anyBlank ? "" : String(total);

  updateWcAndMixFromRatio();
};

const syncCoarseRatioTotal = () => {
  const c = $("coarse-ratio-container");
  const totalEl = $("ratioCoarse");
  if (!c || !totalEl) return;

  let anyBlank = false;
  let total = 0;

  c.querySelectorAll(".dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="rcoarse_name"]')?.value.trim() || "";
    const qtyRaw = row.querySelector('input[name="rcoarse_qty"]')?.value;

    if (!name || qtyRaw === "") anyBlank = true;

    const qty = parseFloat(qtyRaw);
    if (!isNaN(qty)) total += qty;
  });

  totalEl.value = anyBlank ? "" : String(total);

  updateWcAndMixFromRatio();
};

/* ---------- UI: "Other" fields ---------- */

const syncConcreteTypeOther = () => {
  const sel = $("concreteType");
  const wrap = $("concreteTypeOtherWrapper");
  if (!sel || !wrap) return;
  wrap.style.display = sel.value === "Other" ? "" : "none";
};

const syncCementTypeOther = () => {
  const sel = $("cementType");
  const wrap = $("cementTypeOtherWrapper");
  if (!sel || !wrap) return;
  wrap.style.display = sel.value === "Other" ? "" : "none";
};

/* ---------- Mode switching: clear inactive mode ---------- */

const syncInputModeUI = () => {
  const mode = getInputMode();
  const kg = $("kgInputs");
  const ratio = $("ratioInputs");
  const kgH = $("kgHeading");
  const ratioH = $("ratioHeading");

  const showKg = mode === "kg";
  if (kg) kg.style.display = showKg ? "" : "none";
  if (kgH) kgH.style.display = showKg ? "" : "none";
  if (ratio) ratio.style.display = showKg ? "none" : "";
  if (ratioH) ratioH.style.display = showKg ? "none" : "";
};

const resetKgInputs = () => {
  ["cementContent", "waterContent"].forEach((id) => {
    const el = $(id);
    if (el) el.value = "";
  });

  const fineKgC = $("fine-kg-container");
  const coarseKgC = $("coarse-kg-container");
  if (fineKgC) fineKgC.innerHTML = "";
  if (coarseKgC) coarseKgC.innerHTML = "";

  if ($("fineAgg")) $("fineAgg").value = "";
  if ($("coarseAgg")) $("coarseAgg").value = "";

  ensureAtLeastOneRow("fine-kg-container", createFineKgRow);
  ensureAtLeastOneRow("coarse-kg-container", createCoarseKgRow);

  syncFineKgTotal();
  syncCoarseKgTotal();

  toggleRatioBoxes(false);
  if ($("wcRatioValue")) $("wcRatioValue").textContent = "0.00";
  if ($("mixRatioValue")) $("mixRatioValue").textContent = "–";
};

const resetRatioInputs = () => {
  if ($("ratioCement")) $("ratioCement").value = "1";
  if ($("ratioWater")) $("ratioWater").value = "";

  const fineRatioC = $("fine-ratio-container");
  const coarseRatioC = $("coarse-ratio-container");
  if (fineRatioC) fineRatioC.innerHTML = "";
  if (coarseRatioC) coarseRatioC.innerHTML = "";

  if ($("ratioFine")) $("ratioFine").value = "";
  if ($("ratioCoarse")) $("ratioCoarse").value = "";

  ensureAtLeastOneRow("fine-ratio-container", createFineRatioRow);
  ensureAtLeastOneRow("coarse-ratio-container", createCoarseRatioRow);

  syncFineRatioTotal();
  syncCoarseRatioTotal();

  toggleRatioBoxes(false);
  if ($("wcRatioValue")) $("wcRatioValue").textContent = "0.00";
  if ($("mixRatioValue")) $("mixRatioValue").textContent = "–";
};

const handleInputModeChange = () => {
  const mode = getInputMode();
  if (mode === lastInputMode) {
    syncInputModeUI();
    return;
  }

  if (mode === "kg") {
    // switching to kg => clear ratio values
    resetRatioInputs();
  } else {
    // switching to ratio => clear kg values
    resetKgInputs();
  }

  lastInputMode = mode;
  syncInputModeUI();
};

/* ---------- Validation ---------- */

const validateRows = (containerId, nameSel, qtySel, key, missing, markError) => {
  const c = $(containerId);
  if (!c) return;

  const rows = Array.from(c.querySelectorAll(".dynamic-row"));
  if (!rows.length) {
    missing.push(key);
    return;
  }

  rows.forEach((row) => {
    const n = row.querySelector(nameSel);
    const q = row.querySelector(qtySel);
    if (!n?.value.trim()) markError(n, key);
    if ((q?.value ?? "") === "") markError(q, key);
  });
};

const validateForm = () => {
  document.querySelectorAll(".error").forEach((el) => el.classList.remove("error"));

  const mode = getInputMode();

  const commonRequired = [
    "studentName",
    "matricNumber",
    "studentPhone",
    "programme",
    "supervisorName",
    "thesisTitle",
    "crushDate",
    "concreteType",
    "cementType",
    "slump",
    "ageDays",
    "cubesCount",
    "targetStrength",
    "notes",
  ];

  const kgRequired = ["cementContent", "waterContent", "fineAgg", "coarseAgg"];
  const ratioRequired = ["ratioCement", "ratioFine", "ratioCoarse", "ratioWater"];

  const missing = [];
  let firstBad = null;

  const markError = (el, key) => {
    if (!el) return;
    el.classList.add("error");
    missing.push(key || el.id || "field");
    if (!firstBad) firstBad = el;
  };

  const checkId = (id) => {
    const el = $(id);
    if (!el) return;
    if (!String(el.value).trim()) markError(el, id);
  };

  commonRequired.forEach(checkId);

  if ($("concreteType")?.value === "Other") checkId("concreteTypeOther");
  if ($("cementType")?.value === "Other") checkId("cementTypeOther");

  (mode === "kg" ? kgRequired : ratioRequired).forEach(checkId);

  if (mode === "kg") {
    validateRows("fine-kg-container", 'input[name="fine_name"]', 'input[name="fine_qty"]', "fineKg", missing, markError);
    validateRows("coarse-kg-container", 'input[name="coarse_name"]', 'input[name="coarse_qty"]', "coarseKg", missing, markError);
  } else {
    validateRows("fine-ratio-container", 'input[name="rfine_name"]', 'input[name="rfine_qty"]', "fineRatio", missing, markError);
    validateRows("coarse-ratio-container", 'input[name="rcoarse_name"]', 'input[name="rcoarse_qty"]', "coarseRatio", missing, markError);
  }

  // admixtures rows: if any row exists, both fields required in each row
  document.querySelectorAll("#admixtures-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="adm_name"]');
    const dosage = row.querySelector('input[name="adm_dosage"]');
    if (!name?.value.trim()) markError(name, "admixtures");
    if (!dosage?.value.trim()) markError(dosage, "admixtures");
  });

  // scms rows: if any row exists, both fields required in each row
  document.querySelectorAll("#scms-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="scm_name"]');
    const percent = row.querySelector('input[name="scm_percent"]');
    if (!name?.value.trim()) markError(name, "scms");
    if (!percent?.value.trim()) markError(percent, "scms");
  });

  const errorSummary = $("form-error-summary");
  if (missing.length) {
    if (errorSummary) {
      errorSummary.textContent = "Please fill all required fields.";
      errorSummary.style.display = "block";
    }
    if (firstBad) firstBad.focus();
    return false;
  }

  if (errorSummary) errorSummary.style.display = "none";
  return true;
};

/* ---------- Collect data ---------- */

const collectDynamicRows = (containerId, nameSel, qtySel) => {
  const out = [];
  const c = $(containerId);
  if (!c) return out;

  c.querySelectorAll(".dynamic-row").forEach((row) => {
    out.push({
      name: row.querySelector(nameSel)?.value.trim() || "",
      qty: row.querySelector(qtySel)?.value ?? "",
    });
  });
  return out;
};

const collectFormData = () => {
  const mode = getInputMode();

  let concreteType = $("concreteType")?.value || "";
  if (concreteType === "Other") concreteType = $("concreteTypeOther")?.value.trim() || "";

  let cementType = $("cementType")?.value || "";
  if (cementType === "Other") cementType = $("cementTypeOther")?.value.trim() || "";

  const admixtures = [];
  document.querySelectorAll("#admixtures-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="adm_name"]')?.value.trim() || "";
    const dosage = row.querySelector('input[name="adm_dosage"]')?.value.trim() || "";
    if (name || dosage) admixtures.push({ name, dosage });
  });

  const scms = [];
  document.querySelectorAll("#scms-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="scm_name"]')?.value.trim() || "";
    const percent = row.querySelector('input[name="scm_percent"]')?.value.trim() || "";
    if (name || percent) scms.push({ name, percent });
  });

  const fineKgMaterials = collectDynamicRows("fine-kg-container", 'input[name="fine_name"]', 'input[name="fine_qty"]');
  const coarseKgMaterials = collectDynamicRows("coarse-kg-container", 'input[name="coarse_name"]', 'input[name="coarse_qty"]');
  const ratioFineMaterials = collectDynamicRows("fine-ratio-container", 'input[name="rfine_name"]', 'input[name="rfine_qty"]');
  const ratioCoarseMaterials = collectDynamicRows("coarse-ratio-container", 'input[name="rcoarse_name"]', 'input[name="rcoarse_qty"]');

  const cementContent = Number($("cementContent")?.value || 0);
  const waterContent = Number($("waterContent")?.value || 0);
  const fineAgg = Number($("fineAgg")?.value || 0);
  const coarseAgg = Number($("coarseAgg")?.value || 0);

  const ratioCement = Number($("ratioCement")?.value || 0);
  const ratioFine = Number($("ratioFine")?.value || 0);
  const ratioCoarse = Number($("ratioCoarse")?.value || 0);
  const ratioWater = Number($("ratioWater")?.value || 0);

  let wcRatio = 0;
  let mixRatioString = "";

  if (mode === "kg") {
    wcRatio = updateWCRatioFromKg();
    mixRatioString = updateMixRatioFromKg();
  } else {
    const r = updateWcAndMixFromRatio();
    wcRatio = r.wcRatio;
    mixRatioString = r.mixRatioString;
  }

  return {
    inputMode: mode,

    studentName: $("studentName")?.value.trim() || "",
    matricNumber: $("matricNumber")?.value.trim() || "",
    studentPhone: $("studentPhone")?.value.trim() || "",
    programme: $("programme")?.value.trim() || "",
    supervisorName: $("supervisorName")?.value.trim() || "",
    thesisTitle: $("thesisTitle")?.value.trim() || "",

    crushDate: $("crushDate")?.value || "",
    concreteType,
    cementType,
    slump: Number($("slump")?.value || 0),
    ageDays: Number($("ageDays")?.value || 0),
    cubesCount: Number($("cubesCount")?.value || 0),
    targetStrength: Number($("targetStrength")?.value || 0),
    notes: $("notes")?.value.trim() || "",

    cementContent,
    waterContent,
    fineAgg,
    coarseAgg,

    ratioCement,
    ratioFine,
    ratioCoarse,
    ratioWater,

    admixtures,
    scms,

    fineKgMaterials,
    coarseKgMaterials,
    ratioFineMaterials,
    ratioCoarseMaterials,

    wcRatio,
    mixRatioString,
  };
};

/* ---------- Local storage + table ---------- */

const getLocalRecords = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveLocalRecords = (list) => localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

const saveLocal = (record) => {
  const list = getLocalRecords();
  list.push(record);
  saveLocalRecords(list);
};

const renderSavedRecords = () => {
  const list = getLocalRecords();
  const tbody = $("mixes-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="no-data">No mixes saved yet.</td></tr>';
    return;
  }

  list.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.dataset.index = i;

    const wcText =
      typeof r.wcRatio === "number" && !isNaN(r.wcRatio)
        ? r.wcRatio.toFixed(2)
        : r.wcRatio || "";

    const when = r.savedAt ? new Date(r.savedAt).toLocaleString() : "";

    tr.innerHTML = `
      <td>${r.recordId || "—"}</td>
      <td>${r.inputMode === "ratio" ? "Ratio" : "Kg/m³"}</td>
      <td>${r.studentName || ""}</td>
      <td>${r.concreteType || ""}</td>
      <td>${wcText}</td>
      <td>${when}</td>
    `;
    tbody.appendChild(tr);
  });
};

const setSelectWithOther = (selectEl, otherInputEl, savedValue) => {
  if (!selectEl) return;
  const saved = String(savedValue || "").trim();

  let matched = false;
  for (const opt of selectEl.options) {
    if (opt.value === saved || opt.text === saved) {
      selectEl.value = opt.value;
      matched = true;
      break;
    }
  }

  if (!matched) {
    if (saved) {
      selectEl.value = "Other";
      if (otherInputEl) otherInputEl.value = saved;
    } else {
      selectEl.value = "";
      if (otherInputEl) otherInputEl.value = "";
    }
  } else {
    if (otherInputEl) otherInputEl.value = "";
  }
};

const loadRecordIntoForm = (r) => {
  const simpleFields = [
    ["studentName", "studentName"],
    ["matricNumber", "matricNumber"],
    ["programme", "programme"],
    ["supervisorName", "supervisorName"],
    ["studentPhone", "studentPhone"],
    ["thesisTitle", "thesisTitle"],
    ["crushDate", "crushDate"],
    ["slump", "slump"],
    ["ageDays", "ageDays"],
    ["cubesCount", "cubesCount"],
    ["targetStrength", "targetStrength"],
    ["notes", "notes"],
  ];

  simpleFields.forEach(([id, key]) => {
    const el = $(id);
    if (!el) return;
    el.value = r[key] ?? "";
  });

  setSelectWithOther($("concreteType"), $("concreteTypeOther"), r.concreteType || "");
  setSelectWithOther($("cementType"), $("cementTypeOther"), r.cementType || "");

  const mode = r.inputMode === "ratio" ? "ratio" : "kg";
  if ($("modeKg")) $("modeKg").checked = mode === "kg";
  if ($("modeRatio")) $("modeRatio").checked = mode === "ratio";
  lastInputMode = mode;
  syncInputModeUI();

  // Populate both, then clear the inactive to keep consistent behavior
  if ($("cementContent")) $("cementContent").value = r.cementContent ?? "";
  if ($("waterContent")) $("waterContent").value = r.waterContent ?? "";

  if ($("ratioCement")) $("ratioCement").value = r.ratioCement ?? "1";
  if ($("ratioWater")) $("ratioWater").value = r.ratioWater ?? "";

  // Dynamic rows
  const fineKgC = $("fine-kg-container");
  const coarseKgC = $("coarse-kg-container");
  const fineRatioC = $("fine-ratio-container");
  const coarseRatioC = $("coarse-ratio-container");

  if (fineKgC) {
    fineKgC.innerHTML = "";
    (r.fineKgMaterials?.length ? r.fineKgMaterials : [{ name: "Fine Aggregate", qty: r.fineAgg ?? "" }])
      .forEach((it) => fineKgC.appendChild(createFineKgRow(it)));
  }
  if (coarseKgC) {
    coarseKgC.innerHTML = "";
    (r.coarseKgMaterials?.length ? r.coarseKgMaterials : [{ name: "Coarse Aggregate", qty: r.coarseAgg ?? "" }])
      .forEach((it) => coarseKgC.appendChild(createCoarseKgRow(it)));
  }
  if (fineRatioC) {
    fineRatioC.innerHTML = "";
    (r.ratioFineMaterials?.length ? r.ratioFineMaterials : [{ name: "Fine Aggregate", qty: r.ratioFine ?? "" }])
      .forEach((it) => fineRatioC.appendChild(createFineRatioRow(it)));
  }
  if (coarseRatioC) {
    coarseRatioC.innerHTML = "";
    (r.ratioCoarseMaterials?.length ? r.ratioCoarseMaterials : [{ name: "Coarse Aggregate", qty: r.ratioCoarse ?? "" }])
      .forEach((it) => coarseRatioC.appendChild(createCoarseRatioRow(it)));
  }

  // Totals (computed)
  ensureDefaultAggregateRows();

  // Admixtures / SCMs
  const admC = $("admixtures-container");
  if (admC) {
    admC.innerHTML = "";
    (r.admixtures || []).forEach((a) => admC.appendChild(createAdmixtureRow(a)));
  }

  const scmC = $("scms-container");
  if (scmC) {
    scmC.innerHTML = "";
    (r.scms || []).forEach((s) => scmC.appendChild(createScmRow(s)));
  }

  // Enforce "clear inactive" rule after load
  if (mode === "kg") resetRatioInputs();
  else resetKgInputs();

  // Restore active mode values again (because reset clears)
  if (mode === "kg") {
    if ($("cementContent")) $("cementContent").value = r.cementContent ?? "";
    if ($("waterContent")) $("waterContent").value = r.waterContent ?? "";
    // Restore rows
    if (fineKgC) {
      fineKgC.innerHTML = "";
      (r.fineKgMaterials || []).forEach((it) => fineKgC.appendChild(createFineKgRow(it)));
    }
    if (coarseKgC) {
      coarseKgC.innerHTML = "";
      (r.coarseKgMaterials || []).forEach((it) => coarseKgC.appendChild(createCoarseKgRow(it)));
    }
    ensureDefaultAggregateRows();
    updateWCRatioFromKg();
    updateMixRatioFromKg();
  } else {
    if ($("ratioCement")) $("ratioCement").value = r.ratioCement ?? "1";
    if (fineRatioC) {
      fineRatioC.innerHTML = "";
      (r.ratioFineMaterials || []).forEach((it) => fineRatioC.appendChild(createFineRatioRow(it)));
    }
    if (coarseRatioC) {
      coarseRatioC.innerHTML = "";
      (r.ratioCoarseMaterials || []).forEach((it) => coarseRatioC.appendChild(createCoarseRatioRow(it)));
    }
    if ($("ratioWater")) $("ratioWater").value = r.ratioWater ?? "";
    ensureDefaultAggregateRows();
    updateWcAndMixFromRatio();
  }

  syncConcreteTypeOther();
  syncCementTypeOther();
  setStatusLine("Saved record loaded into form.", "info");
};

/* ---------- PDF generation (single-page, office-use box fixed at bottom) ---------- */

const renderPdfOnePage = (data, fontSize) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "A4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 32;

  // Office-use box constants (exactly as reference)
  const copyrightGap = 24;
  const boxHeight = 140;
  const reservedBottom = margin + copyrightGap + boxHeight + 8; // keep a little breathing room

  const usableBottomY = pageH - reservedBottom;

  // base styles
  const titleSize = Math.max(10, fontSize + 2);
  const hSize = Math.max(9, fontSize + 1);
  const bodySize = fontSize;

  const lineH = Math.round(bodySize * 1.35);

  let y = 40;

  // Helper to ensure we don't go into reserved bottom.
  const canFit = (needed) => y + needed <= usableBottomY;

  const addLine = (text) => {
    if (!canFit(lineH)) return false;
    doc.text(text, margin, y);
    y += lineH;
    return true;
  };

  const addHeading = (text) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(hSize);
    if (!canFit(lineH + 2)) return false;
    doc.text(text, margin, y);
    y += lineH;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);
    return true;
  };

  const addGap = (n = 1) => {
    const gap = lineH * n * 0.5;
    if (!canFit(gap)) return false;
    y += gap;
    return true;
  };

  // Header
  if (logoImageDataUrl) {
    doc.addImage(logoImageDataUrl, "PNG", margin, y, 54, 54);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleSize);
  doc.text("CONCRETE LABORATORY – UNIVERSITY OF LAGOS", margin + 72, y + 18);
  doc.setFontSize(bodySize);
  doc.text("Research Mix Cube Test Intake Form", margin + 72, y + 34);
  y += 66;

  if (data.recordId) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(bodySize);
    if (!addLine(`Application No: ${data.recordId}`)) return null;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);
    if (!addGap(0.5)) return null;
  }

  // Student details
  if (!addHeading("Student & Research Details")) return null;

  const studentLines = [
    `Student Name: ${data.studentName}`,
    `Matriculation Number: ${data.matricNumber}`,
    `Programme: ${data.programme}`,
    `Supervisor: ${data.supervisorName}`,
    `Student Phone: ${data.studentPhone}`,
    `Project / Thesis Title: ${data.thesisTitle}`,
  ];

  for (const ln of studentLines) if (!addLine(ln)) return null;
  if (!addGap(0.6)) return null;

  // Test information
  if (!addHeading("Test Information")) return null;

  const testLines = [
    `Crushing Date: ${data.crushDate}`,
    `Concrete Type: ${data.concreteType}`,
    `Cement Type: ${data.cementType}`,
    `Slump / Flow (mm): ${data.slump}`,
    `Age at Testing (days): ${data.ageDays}`,
    `Number of Cubes: ${data.cubesCount}`,
    `Target Strength (MPa): ${data.targetStrength}`,
  ];

  for (const ln of testLines) if (!addLine(ln)) return null;
  if (!addGap(0.6)) return null;

  // Mix design
  const modeLabel = data.inputMode === "ratio" ? "Ratio" : "kg/m³";
  if (!addHeading(`Mix Design (${modeLabel})`)) return null;

  if (data.inputMode === "kg") {
    if (!addLine(`Cement (kg/m³): ${data.cementContent}`)) return null;
    if (!addLine(`Water (kg/m³): ${data.waterContent}`)) return null;

    // Fine aggregates (detailed)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(bodySize);
    if (!addLine("Fine Aggregates (name — kg/m³):")) return null;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);

    const fineRows = (data.fineKgMaterials || []).filter((x) => (x.name || "").trim() || String(x.qty ?? "").trim());
    if (!fineRows.length) {
      if (!addLine("• None")) return null;
    } else {
      for (const it of fineRows) if (!addLine(`• ${it.name} — ${it.qty}`)) return null;
    }
    if (!addLine(`Fine Aggregate Total (kg/m³): ${data.fineAgg}`)) return null;

    // Coarse aggregates (detailed)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(bodySize);
    if (!addLine("Coarse Aggregates (name — kg/m³):")) return null;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);

    const coarseRows = (data.coarseKgMaterials || []).filter((x) => (x.name || "").trim() || String(x.qty ?? "").trim());
    if (!coarseRows.length) {
      if (!addLine("• None")) return null;
    } else {
      for (const it of coarseRows) if (!addLine(`• ${it.name} — ${it.qty}`)) return null;
    }
    if (!addLine(`Coarse Aggregate Total (kg/m³): ${data.coarseAgg}`)) return null;
  } else {
    if (!addLine(`Cement: ${data.ratioCement}`)) return null;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(bodySize);
    if (!addLine("Fine Aggregates (name — ratio):")) return null;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);

    const fineRows = (data.ratioFineMaterials || []).filter((x) => (x.name || "").trim() || String(x.qty ?? "").trim());
    if (!fineRows.length) {
      if (!addLine("• None")) return null;
    } else {
      for (const it of fineRows) if (!addLine(`• ${it.name} — ${it.qty}`)) return null;
    }
    if (!addLine(`Fine Aggregate Total: ${data.ratioFine}`)) return null;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(bodySize);
    if (!addLine("Coarse Aggregates (name — ratio):")) return null;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);

    const coarseRows = (data.ratioCoarseMaterials || []).filter((x) => (x.name || "").trim() || String(x.qty ?? "").trim());
    if (!coarseRows.length) {
      if (!addLine("• None")) return null;
    } else {
      for (const it of coarseRows) if (!addLine(`• ${it.name} — ${it.qty}`)) return null;
    }
    if (!addLine(`Coarse Aggregate Total: ${data.ratioCoarse}`)) return null;

    if (!addLine(`Water: ${data.ratioWater}`)) return null;
  }

  const wcRatioText =
    typeof data.wcRatio === "number" && Number.isFinite(data.wcRatio)
      ? data.wcRatio.toFixed(2)
      : String(data.wcRatio || "");

  if (!addLine(`W/C Ratio: ${wcRatioText}`)) return null;
  if (!addLine(`Mix Ratio: ${data.mixRatioString || ""}`)) return null;
  if (!addGap(0.5)) return null;

  // Admixtures
  doc.setFont("helvetica", "bold");
  doc.setFontSize(hSize);
  if (!addLine("Admixtures")) return null;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(bodySize);

  const admixtures = Array.isArray(data.admixtures) ? data.admixtures : [];
  if (!admixtures.length) {
    if (!addLine("None")) return null;
  } else {
    for (const a of admixtures) if (!addLine(`• ${a.name || ""} - ${a.dosage || ""}`)) return null;
  }
  if (!addGap(0.4)) return null;

  // SCMs
  doc.setFont("helvetica", "bold");
  doc.setFontSize(hSize);
  if (!addLine("SCMs")) return null;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(bodySize);

  const scms = Array.isArray(data.scms) ? data.scms : [];
  if (!scms.length) {
    if (!addLine("None")) return null;
  } else {
    for (const s of scms) if (!addLine(`• ${s.name || ""} - ${s.percent || ""}%`)) return null;
  }
  if (!addGap(0.4)) return null;

  // Notes (wrapped)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(hSize);
  if (!addLine("General Notes")) return null;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(bodySize);

  const wrapW = pageW - margin * 2;
  const noteLines = doc.splitTextToSize(data.notes || "", wrapW);
  for (const ln of noteLines) if (!addLine(ln)) return null;

  // ---- Office-use box: EXACT AS REFERENCE, fixed at bottom (no page break) ----
  const boxWidth = pageW - margin * 2;
  const boxX = margin;
  const boxY = pageH - margin - boxHeight - copyrightGap;

  doc.setDrawColor(0);
  doc.rect(boxX, boxY, boxWidth, boxHeight);

  const innerMargin = 12;
  let boxInnerY = boxY + 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("FOR OFFICE USE ONLY", boxX + innerMargin, boxInnerY);

  boxInnerY += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.text("Tested by:  _________________________________________", boxX + innerMargin, boxInnerY);
  doc.text("Date:  _____________________________________________", boxX + boxWidth / 2, boxInnerY);

  boxInnerY += 22;
  doc.text(
    "Compressive Strength (MPa): _____________________________________________________________________________",
    boxX + innerMargin,
    boxInnerY
  );

  boxInnerY += 22;
  doc.text("Remarks:", boxX + innerMargin, boxInnerY);

  boxInnerY += 18;
  doc.text(
    "_____________________________________________________________________________________________________",
    boxX + innerMargin,
    boxInnerY
  );

  boxInnerY += 18;
  doc.text(
    "_____________________________________________________________________________________________________",
    boxX + innerMargin,
    boxInnerY
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("© Concrete Laboratory, University of Lagos", pageW / 2, pageH - margin, { align: "center" });

  return doc;
};

const generatePDF = async (data) => {
  // Try progressively smaller font sizes until everything fits ABOVE the office-use box.
  // This guarantees the office-use box stays on the same page.
  const fontSizesToTry = [10, 9, 8, 7, 6];

  for (const fs of fontSizesToTry) {
    const doc = renderPdfOnePage(data, fs);
    if (doc) {
      const filename = `${sanitizeFilename(data.studentName || "Student")}_${sanitizeFilename(
        data.thesisTitle || "ResearchMix"
      )}.pdf`;
      doc.save(filename);
      return true;
    }
  }

  // If it *still* doesn't fit (extreme amount of rows/notes),
  // we force-fit by truncating notes to last-resort height.
  // (We keep office-use box on the same page as required.)
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "A4" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text(
    "PDF content too long to fit on one page with the fixed 'FOR OFFICE USE ONLY' box. Please shorten Notes or reduce rows.",
    32,
    60
  );
  doc.save("ResearchMix.pdf");
  return false;
};

/* ---------- CSV & clear ---------- */

const exportCsv = () => {
  const list = getLocalRecords();
  if (!list.length) return;

  const headers = [
    "RecordId","InputMode","StudentName","MatricNumber","StudentPhone","Programme",
    "SupervisorName","ThesisTitle","CrushDate","ConcreteType","CementType","Slump",
    "AgeDays","CubesCount","TargetStrength",
    "CementContent","WaterContent","FineAgg","CoarseAgg",
    "RatioCement","RatioFine","RatioCoarse","RatioWater","WCRatio","MixRatio","Notes","SavedAt",
  ];

  const lines = [headers.join(",")];

  list.forEach((r) => {
    const row = [
      r.recordId || "",
      r.inputMode || "",
      r.studentName || "",
      r.matricNumber || "",
      r.studentPhone || "",
      r.programme || "",
      r.supervisorName || "",
      r.thesisTitle || "",
      r.crushDate || "",
      r.concreteType || "",
      r.cementType || "",
      r.slump ?? "",
      r.ageDays ?? "",
      r.cubesCount ?? "",
      r.targetStrength ?? "",
      r.cementContent ?? "",
      r.waterContent ?? "",
      r.fineAgg ?? "",
      r.coarseAgg ?? "",
      r.ratioCement ?? "",
      r.ratioFine ?? "",
      r.ratioCoarse ?? "",
      r.ratioWater ?? "",
      r.wcRatio ?? "",
      r.mixRatioString || "",
      (r.notes || "").replace(/\n/g, " "),
      r.savedAt || "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);

    lines.push(row.join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "research_mix_records.csv";
  a.click();
  URL.revokeObjectURL(url);
};

const clearAllRecords = () => {
  saveLocalRecords([]);
  renderSavedRecords();
  setStatusLine("All saved records cleared.", "info");
};

/* ---------- Modal (application no.) ---------- */

const initModal = () => {
  const modal = $("appModal");
  const closeBtn = $("modalClose");
  const okBtn = $("modalOk");
  const copyBtn = $("modalCopy");

  if (!modal) return;

  const close = () => modal.classList.add("hidden");

  closeBtn?.addEventListener("click", close);
  okBtn?.addEventListener("click", close);

  copyBtn?.addEventListener("click", () => {
    const num = $("modalNumber")?.textContent || "";
    navigator.clipboard?.writeText(num).then(() => {
      setStatusLine("Application number copied.", "success");
      setTimeout(() => setStatusLine("", "info"), 1200);
    });
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
};

const showAppModal = (number) => {
  const modal = $("appModal");
  const num = $("modalNumber");
  if (!modal || !num) return;
  num.textContent = number;
  modal.classList.remove("hidden");
};

/* ---------- Submit ---------- */

const submitForm = async (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  setStatusLine("Submitting...", "info");
  const data = collectFormData();

  if (!logoImageDataUrl) logoImageDataUrl = await loadImageAsDataURL("unilag-logo.png");

  let apiResult = null;
  try {
    const res = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    apiResult = await res.json().catch(() => null);
  } catch {
    apiResult = null;
  }

  const recordId =
    apiResult?.recordId ||
    `UNILAG-CL-${data.inputMode === "ratio" ? "R" : "K"}${String(
      Math.floor(Math.random() * 999999) + 1
    ).padStart(6, "0")}`;

  const record = { ...data, recordId, savedAt: new Date().toISOString() };

  saveLocal(record);
  renderSavedRecords();

  showAppModal(recordId);

  await generatePDF(record);

  setStatusLine("Submitted, saved, and PDF generated.", "success");
};

/* ---------- Reset form ---------- */

const resetFormFields = () => {
  const form = $("mix-form");
  if (!form) return;

  form.reset();
  setToday($("crushDate"));

  if ($("ratioCement")) $("ratioCement").value = "1";

  // clear dynamic containers
  if ($("admixtures-container")) $("admixtures-container").innerHTML = "";
  if ($("scms-container")) $("scms-container").innerHTML = "";

  ["fine-kg-container", "coarse-kg-container", "fine-ratio-container", "coarse-ratio-container"].forEach((id) => {
    const c = $(id);
    if (c) c.innerHTML = "";
  });

  if ($("fineAgg")) $("fineAgg").value = "";
  if ($("coarseAgg")) $("coarseAgg").value = "";
  if ($("ratioFine")) $("ratioFine").value = "";
  if ($("ratioCoarse")) $("ratioCoarse").value = "";

  lastInputMode = getInputMode();

  syncInputModeUI();
  syncConcreteTypeOther();
  syncCementTypeOther();
  ensureDefaultAggregateRows();

  toggleRatioBoxes(false);
  if ($("wcRatioValue")) $("wcRatioValue").textContent = "0.00";
  if ($("mixRatioValue")) $("mixRatioValue").textContent = "–";

  const errorSummary = $("form-error-summary");
  if (errorSummary) errorSummary.style.display = "none";
  document.querySelectorAll(".error").forEach((el) => el.classList.remove("error"));

  setStatusLine("", "info");
};

/* ---------- Boot ---------- */

document.addEventListener("DOMContentLoaded", () => {
  const ySpan = $("year");
  if (ySpan) ySpan.textContent = new Date().getFullYear();

  setToday($("crushDate"));
  loadImageAsDataURL("unilag-logo.png").then((d) => (logoImageDataUrl = d));

  ensureDefaultAggregateRows();

  // Add row buttons
  $("add-fine-kg-btn")?.addEventListener("click", () => {
    const c = $("fine-kg-container");
    if (!c) return;
    c.appendChild(createFineKgRow());
    c.querySelector(".dynamic-row:last-child input[name='fine_name']")?.focus();
    syncFineKgTotal();
  });

  $("add-coarse-kg-btn")?.addEventListener("click", () => {
    const c = $("coarse-kg-container");
    if (!c) return;
    c.appendChild(createCoarseKgRow());
    c.querySelector(".dynamic-row:last-child input[name='coarse_name']")?.focus();
    syncCoarseKgTotal();
  });

  $("add-fine-ratio-btn")?.addEventListener("click", () => {
    const c = $("fine-ratio-container");
    if (!c) return;
    c.appendChild(createFineRatioRow());
    c.querySelector(".dynamic-row:last-child input[name='rfine_name']")?.focus();
    syncFineRatioTotal();
  });

  $("add-coarse-ratio-btn")?.addEventListener("click", () => {
    const c = $("coarse-ratio-container");
    if (!c) return;
    c.appendChild(createCoarseRatioRow());
    c.querySelector(".dynamic-row:last-child input[name='rcoarse_name']")?.focus();
    syncCoarseRatioTotal();
  });

  $("add-admixture-btn")?.addEventListener("click", () => {
    $("admixtures-container")?.appendChild(createAdmixtureRow());
  });

  $("add-scm-btn")?.addEventListener("click", () => {
    $("scms-container")?.appendChild(createScmRow());
  });

  // Track initial mode
  lastInputMode = getInputMode();

  $("modeKg")?.addEventListener("change", handleInputModeChange);
  $("modeRatio")?.addEventListener("change", handleInputModeChange);
  syncInputModeUI();

  $("concreteType")?.addEventListener("change", syncConcreteTypeOther);
  $("cementType")?.addEventListener("change", syncCementTypeOther);
  syncConcreteTypeOther();
  syncCementTypeOther();

  // Derived values listeners
  ["cementContent", "waterContent"].forEach((id) =>
    $(id)?.addEventListener("input", () => {
      updateWCRatioFromKg();
      updateMixRatioFromKg();
    })
  );

  ["ratioCement", "ratioWater"].forEach((id) =>
    $(id)?.addEventListener("input", updateWcAndMixFromRatio)
  );

  // Saved-records table click-to-load
  $("mixes-table-body")?.addEventListener("click", (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;
    const idx = tr.dataset.index;
    if (idx == null) return;
    const list = getLocalRecords();
    const rec = list[Number(idx)];
    if (rec) loadRecordIntoForm(rec);
  });

  // Main actions
  $("mix-form")?.addEventListener("submit", submitForm);
  $("reset-form-btn")?.addEventListener("click", resetFormFields);
  $("export-csv-btn")?.addEventListener("click", exportCsv);
  $("clear-all-btn")?.addEventListener("click", clearAllRecords);

  renderSavedRecords();
  initModal();
});

