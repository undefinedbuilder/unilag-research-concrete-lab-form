/* -----------------------------------------------------------
   UNILAG CONCRETE LAB – RESEARCH MIX FRONT-END
----------------------------------------------------------- */

const STORAGE_KEY = "unilag-concrete-lab-research-mixes";
let logoImageDataUrl = null;

/* ---------- Small helpers ---------- */

const $ = (id) => document.getElementById(id);

const setToday = (inputEl) => {
  if (!inputEl) return;
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  inputEl.value = new Date(Date.now() - tzOffset).toISOString().slice(0, 10);
};

const sanitizeFilename = (name) =>
  String(name).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

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

// Input mode is now a segmented control (buttons) to match the deployed client form UX.
let CURRENT_MODE = "kg";
const getInputMode = () => CURRENT_MODE || "kg";

const setInputMode = (mode) => {
  CURRENT_MODE = mode === "ratio" ? "ratio" : "kg";

  const kgTab = $("modeKg");
  const ratioTab = $("modeRatio");
  if (kgTab && ratioTab) {
    const isKg = CURRENT_MODE === "kg";
    kgTab.classList.toggle("is-active", isKg);
    ratioTab.classList.toggle("is-active", !isKg);
    kgTab.setAttribute("aria-selected", String(isKg));
    ratioTab.setAttribute("aria-selected", String(!isKg));
  }

  syncInputModeUI();
  // Recompute ratios when switching.
  if (CURRENT_MODE === "kg") {
    updateWCRatioFromKg();
    updateMixRatioFromKg();
  } else {
    updateWcAndMixFromRatio();
  }
};

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

/* ---------- Dynamic rows ---------- */

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
    <button type="button" class="remove-row-btn">×</button>
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
    <button type="button" class="remove-row-btn">×</button>
  `;
  row.querySelector(".remove-row-btn").onclick = () => row.remove();
  return row;
};

// Generic quantity rows for material quantities (kg/m³ and ratio mode)
// Styled using the exact same .dynamic-row / .remove-row-btn as Admixtures/SCMs.
const createQuantityRow = ({ label = "", value = "" } = {}, opts = {}) => {
  const {
    itemLabel = "Type / Description",
    valueLabel = "Quantity",
    valueStep = "0.1",
    valueMin = "0",
    valueName = "qty_value",
    labelName = "qty_label",
  } = opts;

  const row = document.createElement("div");
  row.className = "dynamic-row";
  row.innerHTML = `
    <label>
      <span class="label-line">${itemLabel}</span>
      <input type="text" name="${labelName}" value="${label}">
    </label>
    <label>
      <span class="label-line">${valueLabel} <span class="required-asterisk">*</span></span>
      <input type="number" min="${valueMin}" step="${valueStep}" name="${valueName}" value="${value}">
    </label>
    <button type="button" class="remove-row-btn">×</button>
  `;
  row.querySelector(".remove-row-btn").onclick = () => {
    row.remove();
    // Keep ratios fresh after deletes.
    if (getInputMode() === "kg") {
      updateWCRatioFromKg();
      updateMixRatioFromKg();
    } else {
      updateWcAndMixFromRatio();
    }
  };
  return row;
};

const sumContainerValues = (containerId, valueName) => {
  const el = $(containerId);
  if (!el) return NaN;
  const inputs = Array.from(el.querySelectorAll(`input[name="${valueName}"]`));
  if (!inputs.length) return NaN;
  const vals = inputs.map((i) => parseFloat(i.value));
  if (vals.some((v) => isNaN(v))) return NaN;
  return vals.reduce((a, b) => a + b, 0);
};

const readRows = (containerId, labelName, valueName) => {
  const el = $(containerId);
  if (!el) return [];
  const rows = [];
  el.querySelectorAll(".dynamic-row").forEach((row) => {
    const label = (row.querySelector(`input[name="${labelName}"]`) || {}).value || "";
    const value = (row.querySelector(`input[name="${valueName}"]`) || {}).value || "";
    if (label || value) rows.push({ label, value });
  });
  return rows;
};

/* ---------- W/C + Mix ratio ---------- */

const toggleRatioBoxes = (show) => {
  const wc = $("wcratio-box");
  const mix = $("mixratio-box");
  if (!wc || !mix) return;
  wc.style.display = mix.style.display = show ? "" : "none";
};

const updateWCRatioFromKg = () => {
  const cement = parseFloat($("cementContent").value);
  const water = sumContainerValues("water-kg-container", "water_kg_value");
  const fine = sumContainerValues("fine-kg-container", "fine_kg_value");
  const medium = sumContainerValues("medium-kg-container", "medium_kg_value");
  const coarse = sumContainerValues("coarse-kg-container", "coarse_kg_value");

  if ([cement, water, fine, medium, coarse].some((v) => isNaN(v))) {
    toggleRatioBoxes(false);
    return 0;
  }

  const ratio = water / cement;
  $("wcRatioValue").textContent = ratio.toFixed(2);
  toggleRatioBoxes(true);
  return ratio;
};

const updateMixRatioFromKg = () => {
  const cement = parseFloat($("cementContent").value);
  const fine = sumContainerValues("fine-kg-container", "fine_kg_value");
  const medium = sumContainerValues("medium-kg-container", "medium_kg_value");
  const coarse = sumContainerValues("coarse-kg-container", "coarse_kg_value");
  const water = sumContainerValues("water-kg-container", "water_kg_value");

  if ([cement, fine, medium, coarse, water].some((v) => isNaN(v))) {
    toggleRatioBoxes(false);
    return "";
  }

  const mix = `1 : ${(fine / cement).toFixed(2)} : ${(medium / cement).toFixed(
    2
  )} : ${(coarse / cement).toFixed(2)} : ${(water / cement).toFixed(2)}`;
  $("mixRatioValue").textContent = mix;
  toggleRatioBoxes(true);
  return mix;
};

const updateWcAndMixFromRatio = () => {
  const c = parseFloat($("ratioCement").value);
  const f = sumContainerValues("fine-ratio-container", "fine_ratio_value");
  const m = sumContainerValues("medium-ratio-container", "medium_ratio_value");
  const co = sumContainerValues("coarse-ratio-container", "coarse_ratio_value");
  const w = sumContainerValues("water-ratio-container", "water_ratio_value");

  if ([c, f, m, co, w].some((v) => isNaN(v))) {
    toggleRatioBoxes(false);
    return { wcRatio: 0, mixRatioString: "" };
  }

  const wc = w / c;
  const mix = `1 : ${(f / c).toFixed(2)} : ${(m / c).toFixed(
    2
  )} : ${(co / c).toFixed(2)} : ${(w / c).toFixed(2)}`;

  $("wcRatioValue").textContent = wc.toFixed(2);
  $("mixRatioValue").textContent = mix;
  toggleRatioBoxes(true);
  return { wcRatio: wc, mixRatioString: mix };
};

/* ---------- UI sync ---------- */

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

/* ---------- Validation ---------- */

const validateForm = () => {
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

  // Cement stays fixed; all other materials are dynamic rows.
  const kgFixedRequired = ["cementContent"];
  const ratioFixedRequired = ["ratioCement"]; // readonly but keeps a stable base

  document.querySelectorAll(".error").forEach((el) => el.classList.remove("error"));

  const missing = [];
  let firstBad = null;

  const checkId = (id) => {
    const el = $(id);
    if (!el) return;
    if (!String(el.value).trim()) {
      el.classList.add("error");
      missing.push(id);
      if (!firstBad) firstBad = el;
    }
  };

  commonRequired.forEach(checkId);

  if ($("concreteType")?.value === "Other") checkId("concreteTypeOther");
  if ($("cementType")?.value === "Other") checkId("cementTypeOther");

  // Fixed required field per mode
  (mode === "kg" ? kgFixedRequired : ratioFixedRequired).forEach(checkId);

  const checkDynamic = (containerId, valueName) => {
    const container = $(containerId);
    if (!container) return;
    const inputs = Array.from(container.querySelectorAll(`input[name="${valueName}"]`));
    if (!inputs.length) {
      missing.push(containerId);
      const addBtn = document.querySelector(`[data-add-for="${containerId}"]`);
      if (!firstBad && addBtn) firstBad = addBtn;
      return;
    }
    inputs.forEach((i) => {
      if (!String(i.value).trim()) {
        i.classList.add("error");
        missing.push(containerId);
        if (!firstBad) firstBad = i;
      }
    });
  };

  if (mode === "kg") {
    checkDynamic("water-kg-container", "water_kg_value");
    checkDynamic("fine-kg-container", "fine_kg_value");
    checkDynamic("medium-kg-container", "medium_kg_value");
    checkDynamic("coarse-kg-container", "coarse_kg_value");
  } else {
    checkDynamic("fine-ratio-container", "fine_ratio_value");
    checkDynamic("medium-ratio-container", "medium_ratio_value");
    checkDynamic("coarse-ratio-container", "coarse_ratio_value");
    checkDynamic("water-ratio-container", "water_ratio_value");
  }

  document.querySelectorAll("#admixtures-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="adm_name"]');
    const dosage = row.querySelector('input[name="adm_dosage"]');
    if ((!name?.value.trim() || !dosage?.value.trim()) && (name || dosage)) {
      if (name && !name.value.trim()) name.classList.add("error");
      if (dosage && !dosage.value.trim()) dosage.classList.add("error");
      missing.push("admixtures");
      if (!firstBad) firstBad = name || dosage;
    }
  });

  document.querySelectorAll("#scms-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="scm_name"]');
    const percent = row.querySelector('input[name="scm_percent"]');
    if ((!name?.value.trim() || !percent?.value.trim()) && (name || percent)) {
      if (name && !name.value.trim()) name.classList.add("error");
      if (percent && !percent.value.trim()) percent.classList.add("error");
      missing.push("scms");
      if (!firstBad) firstBad = name || percent;
    }
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

const collectFormData = () => {
  const mode = getInputMode();

  let concreteType = $("concreteType").value;
  if (concreteType === "Other") concreteType = $("concreteTypeOther").value.trim();

  let cementType = $("cementType").value;
  if (cementType === "Other") cementType = $("cementTypeOther").value.trim();

  const admixtures = [];
  document.querySelectorAll("#admixtures-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="adm_name"]').value.trim();
    const dosage = row.querySelector('input[name="adm_dosage"]').value.trim();
    if (name || dosage) admixtures.push({ name, dosage });
  });

  const scms = [];
  document.querySelectorAll("#scms-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="scm_name"]').value.trim();
    const percent = row.querySelector('input[name="scm_percent"]').value.trim();
    if (name || percent) scms.push({ name, percent });
  });

  const cementContent = Number($("cementContent").value || 0);

  // Dynamic material rows (keep both totals + row breakdowns)
  const waterKgRows = readRows("water-kg-container", "water_kg_label", "water_kg_value");
  const fineKgRows = readRows("fine-kg-container", "fine_kg_label", "fine_kg_value");
  const mediumKgRows = readRows("medium-kg-container", "medium_kg_label", "medium_kg_value");
  const coarseKgRows = readRows("coarse-kg-container", "coarse_kg_label", "coarse_kg_value");

  const waterContent = sumContainerValues("water-kg-container", "water_kg_value") || 0;
  const fineAgg = sumContainerValues("fine-kg-container", "fine_kg_value") || 0;
  const mediumAgg = sumContainerValues("medium-kg-container", "medium_kg_value") || 0;
  const coarseAgg = sumContainerValues("coarse-kg-container", "coarse_kg_value") || 0;

  const ratioCement = Number($("ratioCement").value || 1);
  const fineRatioRows = readRows("fine-ratio-container", "fine_ratio_label", "fine_ratio_value");
  const mediumRatioRows = readRows("medium-ratio-container", "medium_ratio_label", "medium_ratio_value");
  const coarseRatioRows = readRows("coarse-ratio-container", "coarse_ratio_label", "coarse_ratio_value");
  const waterRatioRows = readRows("water-ratio-container", "water_ratio_label", "water_ratio_value");

  const ratioFine = sumContainerValues("fine-ratio-container", "fine_ratio_value") || 0;
  const ratioMedium = sumContainerValues("medium-ratio-container", "medium_ratio_value") || 0;
  const ratioCoarse = sumContainerValues("coarse-ratio-container", "coarse_ratio_value") || 0;
  const ratioWater = sumContainerValues("water-ratio-container", "water_ratio_value") || 0;

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

    studentName: $("studentName").value.trim(),
    matricNumber: $("matricNumber").value.trim(),
    studentPhone: $("studentPhone").value.trim(),
    programme: $("programme").value.trim(),
    supervisorName: $("supervisorName").value.trim(),
    thesisTitle: $("thesisTitle").value.trim(),

    crushDate: $("crushDate").value,
    concreteType,
    cementType,
    slump: Number($("slump").value || 0),
    ageDays: Number($("ageDays").value || 0),
    cubesCount: Number($("cubesCount").value || 0),
    targetStrength: Number($("targetStrength").value || 0),
    notes: $("notes").value.trim(),

    cementContent,
    waterContent,
    fineAgg,
    mediumAgg,
    coarseAgg,

    // Row breakdowns (useful for PDF + later review)
    waterKgRows,
    fineKgRows,
    mediumKgRows,
    coarseKgRows,

    ratioCement,
    ratioFine,
    ratioMedium,
    ratioCoarse,
    ratioWater,

    fineRatioRows,
    mediumRatioRows,
    coarseRatioRows,
    waterRatioRows,

    admixtures,
    scms,

    wcRatio,
    mixRatioString,
  };
};

/* ---------- Local storage ---------- */

const getLocalRecords = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveLocalRecords = (records) => localStorage.setItem(STORAGE_KEY, JSON.stringify(records));

const saveLocal = (record) => {
  const list = getLocalRecords();
  list.unshift(record);
  saveLocalRecords(list);
};

/* ---------- Render saved records ---------- */

const renderSavedRecords = () => {
  const list = getLocalRecords();
  const tbody = $("mixes-table-body");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="no-data">No mixes saved yet.</td></tr>`;
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

/* ---------- Load record into form ---------- */

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

    if (id === "programme") {
      el.value = r.programme ?? r.organisationType ?? "";
    } else {
      el.value = r[key] ?? "";
    }
  });

  // Concrete type
  const cSel = $("concreteType");
  const cOther = $("concreteTypeOther");
  if (cSel) {
    const saved = r.concreteType || "";
    let matched = false;
    for (const opt of cSel.options) {
      if (opt.value === saved || opt.text === saved) {
        cSel.value = opt.value;
        matched = true;
        break;
      }
    }
    if (!matched) {
      cSel.value = saved ? "Other" : "";
      if (cOther) cOther.value = saved || "";
    } else if (cOther) {
      cOther.value = "";
    }
  }

  // Cement type
  const ctSel = $("cementType");
  const ctOther = $("cementTypeOther");
  if (ctSel) {
    const saved = r.cementType || "";
    let matched = false;
    for (const opt of ctSel.options) {
      if (opt.value === saved || opt.text === saved) {
        ctSel.value = opt.value;
        matched = true;
        break;
      }
    }
    if (!matched) {
      ctSel.value = saved ? "Other" : "";
      if (ctOther) ctOther.value = saved || "";
    } else if (ctOther) {
      ctOther.value = "";
    }
  }

  // Mode
  const mode = r.inputMode === "ratio" ? "ratio" : "kg";
  setInputMode(mode);

  const loadQuantityGroup = (containerId, opts, rowsFallback, totalFallback) => {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = "";
    const rows =
      Array.isArray(rowsFallback) && rowsFallback.length
        ? rowsFallback
        : [{ label: "", value: String(totalFallback ?? "") }];
    rows.forEach((row) => c.appendChild(createQuantityRow(row, opts)));
  };

  // Fixed cement
  $("cementContent").value = r.cementContent ?? "";
  $("ratioCement").value = r.ratioCement ?? "1";

  // Kg dynamic groups
  loadQuantityGroup(
    "water-kg-container",
    { itemLabel: "Type / Description", valueLabel: "Water (kg/m³)", valueStep: "0.1", labelName: "water_kg_label", valueName: "water_kg_value" },
    r.waterKgRows,
    r.waterContent
  );
  loadQuantityGroup(
    "fine-kg-container",
    { itemLabel: "Type / Description", valueLabel: "Fine Aggregate (kg/m³)", valueStep: "0.1", labelName: "fine_kg_label", valueName: "fine_kg_value" },
    r.fineKgRows,
    r.fineAgg
  );
  loadQuantityGroup(
    "medium-kg-container",
    { itemLabel: "Type / Description", valueLabel: "Medium Aggregate (kg/m³)", valueStep: "0.1", labelName: "medium_kg_label", valueName: "medium_kg_value" },
    r.mediumKgRows,
    r.mediumAgg
  );
  loadQuantityGroup(
    "coarse-kg-container",
    { itemLabel: "Type / Description", valueLabel: "Coarse Aggregate (kg/m³)", valueStep: "0.1", labelName: "coarse_kg_label", valueName: "coarse_kg_value" },
    r.coarseKgRows,
    r.coarseAgg
  );

  // Ratio dynamic groups
  loadQuantityGroup(
    "fine-ratio-container",
    { itemLabel: "Type / Description", valueLabel: "Fine Aggregate (ratio)", valueStep: "0.01", labelName: "fine_ratio_label", valueName: "fine_ratio_value" },
    r.fineRatioRows,
    r.ratioFine
  );
  loadQuantityGroup(
    "medium-ratio-container",
    { itemLabel: "Type / Description", valueLabel: "Medium Aggregate (ratio)", valueStep: "0.01", labelName: "medium_ratio_label", valueName: "medium_ratio_value" },
    r.mediumRatioRows,
    r.ratioMedium
  );
  loadQuantityGroup(
    "coarse-ratio-container",
    { itemLabel: "Type / Description", valueLabel: "Coarse Aggregate (ratio)", valueStep: "0.01", labelName: "coarse_ratio_label", valueName: "coarse_ratio_value" },
    r.coarseRatioRows,
    r.ratioCoarse
  );
  loadQuantityGroup(
    "water-ratio-container",
    { itemLabel: "Type / Description", valueLabel: "Water (ratio)", valueStep: "0.01", labelName: "water_ratio_label", valueName: "water_ratio_value" },
    r.waterRatioRows,
    r.ratioWater
  );

  if (mode === "kg") {
    updateWCRatioFromKg();
    updateMixRatioFromKg();
  } else {
    updateWcAndMixFromRatio();
  }

  // Admixtures
  const admC = $("admixtures-container");
  admC.innerHTML = "";
  (r.admixtures || []).forEach((a) => admC.appendChild(createAdmixtureRow(a)));

  // SCMs
  const scmC = $("scms-container");
  scmC.innerHTML = "";
  (r.scms || []).forEach((s) => scmC.appendChild(createScmRow(s)));

  syncConcreteTypeOther();
  syncCementTypeOther();
  setStatusLine("Saved record loaded into form.", "info");
};

/* ---------- PDF ---------- */
/* (Your existing PDF generation continues here — unchanged except it now uses totals) */

/* ---------- Export CSV / Submit / Reset / Modal ---------- */
/* (Your existing functions remain compatible since totals are still stored as waterContent/fineAgg/...) */

/* ---------- Reset ---------- */

const resetFormFields = () => {
  const form = $("mix-form");
  if (!form) return;
  form.reset();
  setToday($("crushDate"));
  $("ratioCement").value = "1";
  $("wcRatioValue").textContent = "0.00";
  $("mixRatioValue").textContent = "–";
  setInputMode("kg");
  syncConcreteTypeOther();
  syncCementTypeOther();

  // Clear dynamic material groups
  [
    "water-kg-container",
    "fine-kg-container",
    "medium-kg-container",
    "coarse-kg-container",
    "fine-ratio-container",
    "medium-ratio-container",
    "coarse-ratio-container",
    "water-ratio-container",
  ].forEach((id) => {
    const c = $(id);
    if (c) c.innerHTML = "";
  });

  // Seed a single row in each material group
  [
    "add-water-kg-btn",
    "add-fine-kg-btn",
    "add-medium-kg-btn",
    "add-coarse-kg-btn",
    "add-fine-ratio-btn",
    "add-medium-ratio-btn",
    "add-coarse-ratio-btn",
    "add-water-ratio-btn",
  ].forEach((btnId) => {
    const b = $(btnId);
    if (b) b.click();
  });

  $("admixtures-container").innerHTML = "";
  $("scms-container").innerHTML = "";
  setStatusLine("", "info");
};

/* ---------- Init ---------- */

document.addEventListener("DOMContentLoaded", () => {
  const ySpan = $("year");
  if (ySpan) ySpan.textContent = new Date().getFullYear();

  setToday($("crushDate"));
  loadImageAsDataURL("unilag-logo.png").then((d) => (logoImageDataUrl = d));

  $("add-admixture-btn").onclick = () => $("admixtures-container").appendChild(createAdmixtureRow());
  $("add-scm-btn").onclick = () => $("scms-container").appendChild(createScmRow());

  // Mode tabs
  $("modeKg").addEventListener("click", () => setInputMode("kg"));
  $("modeRatio").addEventListener("click", () => setInputMode("ratio"));
  setInputMode("kg");

  $("concreteType").addEventListener("change", syncConcreteTypeOther);
  $("cementType").addEventListener("change", syncCementTypeOther);
  syncConcreteTypeOther();
  syncCementTypeOther();

  // ----- Dynamic material rows: add buttons + default rows
  const bindAdd = (btnId, containerId, opts) => {
    const btn = $(btnId);
    const c = $(containerId);
    if (!btn || !c) return;
    btn.onclick = () => {
      const row = createQuantityRow({}, opts);
      // Keep ratios fresh as the user types
      row.querySelectorAll("input").forEach((i) => {
        i.addEventListener("input", () => {
          if (getInputMode() === "kg") {
            updateWCRatioFromKg();
            updateMixRatioFromKg();
          } else {
            updateWcAndMixFromRatio();
          }
        });
      });
      c.appendChild(row);
    };
    // Create an initial row
    btn.click();
  };

  bindAdd("add-water-kg-btn", "water-kg-container", {
    itemLabel: "Type / Description",
    valueLabel: "Water (kg/m³)",
    valueStep: "0.1",
    labelName: "water_kg_label",
    valueName: "water_kg_value",
  });
  bindAdd("add-fine-kg-btn", "fine-kg-container", {
    itemLabel: "Type / Description",
    valueLabel: "Fine Aggregate (kg/m³)",
    valueStep: "0.1",
    labelName: "fine_kg_label",
    valueName: "fine_kg_value",
  });
  bindAdd("add-medium-kg-btn", "medium-kg-container", {
    itemLabel: "Type / Description",
    valueLabel: "Medium Aggregate (kg/m³)",
    valueStep: "0.1",
    labelName: "medium_kg_label",
    valueName: "medium_kg_value",
  });
  bindAdd("add-coarse-kg-btn", "coarse-kg-container", {
    itemLabel: "Type / Description",
    valueLabel: "Coarse Aggregate (kg/m³)",
    valueStep: "0.1",
    labelName: "coarse_kg_label",
    valueName: "coarse_kg_value",
  });

  bindAdd("add-fine-ratio-btn", "fine-ratio-container", {
    itemLabel: "Type / Description",
    valueLabel: "Fine Aggregate (ratio)",
    valueStep: "0.01",
    labelName: "fine_ratio_label",
    valueName: "fine_ratio_value",
  });
  bindAdd("add-medium-ratio-btn", "medium-ratio-container", {
    itemLabel: "Type / Description",
    valueLabel: "Medium Aggregate (ratio)",
    valueStep: "0.01",
    labelName: "medium_ratio_label",
    valueName: "medium_ratio_value",
  });
  bindAdd("add-coarse-ratio-btn", "coarse-ratio-container", {
    itemLabel: "Type / Description",
    valueLabel: "Coarse Aggregate (ratio)",
    valueStep: "0.01",
    labelName: "coarse_ratio_label",
    valueName: "coarse_ratio_value",
  });
  bindAdd("add-water-ratio-btn", "water-ratio-container", {
    itemLabel: "Type / Description",
    valueLabel: "Water (ratio)",
    valueStep: "0.01",
    labelName: "water_ratio_label",
    valueName: "water_ratio_value",
  });

  // Cement changes affect W/C + mix
  $("cementContent").addEventListener("input", () => {
    updateWCRatioFromKg();
    updateMixRatioFromKg();
  });

  // Hook the rest of your existing buttons (submit/export/clear/etc.)
  $("mix-form").addEventListener("submit", (e) => e.preventDefault()); // replace with your submitForm if needed
});
