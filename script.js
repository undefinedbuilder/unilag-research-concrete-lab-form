/* -----------------------------------------------------------
   UNILAG CONCRETE LAB – RESEARCH MIX FRONT-END (script.js)
   -----------------------------------------------------------*/

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

const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
};

const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "");

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

/* ---------- W/C + Mix ratio display ---------- */

const toggleRatioBoxes = (show) => {
  const wc = $("wcratio-box");
  const mix = $("mixratio-box");
  if (!wc || !mix) return;
  wc.style.display = mix.style.display = show ? "" : "none";
};

/**
 * Build mix ratio string from current kg rows:
 *   1:<fine1/cement>:<fine2/cement>:<coarse1/cement>:...
 * (2dp, no spaces, no water)
 */
const buildMixRatioFromKgRows = () => {
  const cement = toNum($("cementContent")?.value);
  if (!Number.isFinite(cement) || cement <= 0) return "";

  const fineC = $("fine-kg-container");
  const coarseC = $("coarse-kg-container");
  if (!fineC || !coarseC) return "";

  const parts = ["1"];

  const readRows = (container, qtySelector) => {
    const vals = [];
    container.querySelectorAll(".dynamic-row").forEach((row) => {
      const qtyRaw = row.querySelector(qtySelector)?.value;
      const qty = toNum(qtyRaw);
      if (!Number.isFinite(qty) || qtyRaw === "") vals.push(NaN);
      else vals.push(qty);
    });
    return vals;
  };

  const fineVals = readRows(fineC, 'input[name="fine_qty"]');
  const coarseVals = readRows(coarseC, 'input[name="coarse_qty"]');

  // must have at least 1 row each and all rows filled
  if (!fineVals.length || !coarseVals.length) return "";
  if (fineVals.some((v) => !Number.isFinite(v)) || coarseVals.some((v) => !Number.isFinite(v))) return "";

  fineVals.forEach((v) => parts.push(fmt2(v / cement)));
  coarseVals.forEach((v) => parts.push(fmt2(v / cement)));

  return parts.join(":");
};

/**
 * Build mix ratio string from ratio rows:
 *   1:<fine1>:<fine2>:<coarse1>:...
 * (2dp, no spaces, no water)
 */
const buildMixRatioFromRatioRows = () => {
  const fineC = $("fine-ratio-container");
  const coarseC = $("coarse-ratio-container");
  if (!fineC || !coarseC) return "";

  const parts = ["1"];

  const readRows = (container, qtySelector) => {
    const vals = [];
    container.querySelectorAll(".dynamic-row").forEach((row) => {
      const qtyRaw = row.querySelector(qtySelector)?.value;
      const qty = toNum(qtyRaw);
      if (!Number.isFinite(qty) || qtyRaw === "") vals.push(NaN);
      else vals.push(qty);
    });
    return vals;
  };

  const fineVals = readRows(fineC, 'input[name="rfine_qty"]');
  const coarseVals = readRows(coarseC, 'input[name="rcoarse_qty"]');

  if (!fineVals.length || !coarseVals.length) return "";
  if (fineVals.some((v) => !Number.isFinite(v)) || coarseVals.some((v) => !Number.isFinite(v))) return "";

  fineVals.forEach((v) => parts.push(fmt2(v)));
  coarseVals.forEach((v) => parts.push(fmt2(v)));

  return parts.join(":");
};

const updateWCRatioFromKg = () => {
  const water = toNum($("waterContent")?.value);
  const cement = toNum($("cementContent")?.value);
  const wc = water / cement;
  if ($("wcRatioValue")) $("wcRatioValue").textContent = Number.isFinite(wc) ? wc.toFixed(2) : "0.00";
};

const updateMixRatioFromKg = () => {
  const mix = buildMixRatioFromKgRows();
  if ($("mixRatioValue")) $("mixRatioValue").textContent = mix || "–";
};

const updateWcAndMixFromRatio = () => {
  const w = toNum($("ratioWater")?.value);
  if ($("wcRatioValue")) $("wcRatioValue").textContent = Number.isFinite(w) ? w.toFixed(2) : "0.00";
  const mix = buildMixRatioFromRatioRows();
  if ($("mixRatioValue")) $("mixRatioValue").textContent = mix || "–";
};

/* ---------- Aggregate totals sync (hidden totals) ---------- */

const syncFineKgTotal = () => {
  const c = $("fine-kg-container");
  if (!c) return;

  let total = 0;
  let anyBlank = false;

  c.querySelectorAll(".dynamic-row").forEach((row) => {
    const v = row.querySelector('input[name="fine_qty"]')?.value;
    if (v === "" || v == null) anyBlank = true;
    const n = toNum(v);
    if (Number.isFinite(n)) total += n;
  });

  if ($("fineAgg")) $("fineAgg").value = anyBlank ? "" : total.toFixed(2);

  if (getInputMode() === "kg") {
    updateMixRatioFromKg();
  }
};

const syncCoarseKgTotal = () => {
  const c = $("coarse-kg-container");
  if (!c) return;

  let total = 0;
  let anyBlank = false;

  c.querySelectorAll(".dynamic-row").forEach((row) => {
    const v = row.querySelector('input[name="coarse_qty"]')?.value;
    if (v === "" || v == null) anyBlank = true;
    const n = toNum(v);
    if (Number.isFinite(n)) total += n;
  });

  if ($("coarseAgg")) $("coarseAgg").value = anyBlank ? "" : total.toFixed(2);

  if (getInputMode() === "kg") {
    updateMixRatioFromKg();
  }
};

const syncFineRatioTotal = () => {
  const c = $("fine-ratio-container");
  if (!c) return;

  let total = 0;
  let anyBlank = false;

  c.querySelectorAll(".dynamic-row").forEach((row) => {
    const v = row.querySelector('input[name="rfine_qty"]')?.value;
    if (v === "" || v == null) anyBlank = true;
    const n = toNum(v);
    if (Number.isFinite(n)) total += n;
  });

  if ($("ratioFine")) $("ratioFine").value = anyBlank ? "" : total.toFixed(2);

  if (getInputMode() === "ratio") {
    updateWcAndMixFromRatio();
  }
};

const syncCoarseRatioTotal = () => {
  const c = $("coarse-ratio-container");
  if (!c) return;

  let total = 0;
  let anyBlank = false;

  c.querySelectorAll(".dynamic-row").forEach((row) => {
    const v = row.querySelector('input[name="rcoarse_qty"]')?.value;
    if (v === "" || v == null) anyBlank = true;
    const n = toNum(v);
    if (Number.isFinite(n)) total += n;
  });

  if ($("ratioCoarse")) $("ratioCoarse").value = anyBlank ? "" : total.toFixed(2);

  if (getInputMode() === "ratio") {
    updateWcAndMixFromRatio();
  }
};

/* ---------- Mode toggle (kg vs ratio) ---------- */

const syncInputModeUI = () => {
  const mode = getInputMode();
  const kgBox = $("kg-section");
  const ratioBox = $("ratio-section");

  if (kgBox) kgBox.style.display = mode === "kg" ? "" : "none";
  if (ratioBox) ratioBox.style.display = mode === "ratio" ? "" : "none";

  toggleRatioBoxes(mode === "kg" || mode === "ratio");

  if (mode === "kg") {
    updateWCRatioFromKg();
    updateMixRatioFromKg();
  } else {
    updateWcAndMixFromRatio();
  }
};

const handleInputModeChange = () => {
  const mode = getInputMode();

  // if switching modes, clear any computed hidden totals in the other mode
  if (mode !== lastInputMode) {
    if (mode === "kg") {
      if ($("ratioFine")) $("ratioFine").value = "";
      if ($("ratioCoarse")) $("ratioCoarse").value = "";
    } else {
      if ($("fineAgg")) $("fineAgg").value = "";
      if ($("coarseAgg")) $("coarseAgg").value = "";
    }
  }

  lastInputMode = mode;
  syncInputModeUI();
};

/* ---------- Concrete type / Cement type "Other" ---------- */

const syncConcreteTypeOther = () => {
  const sel = $("concreteType");
  const otherWrap = $("concreteTypeOtherWrapper");
  if (!sel || !otherWrap) return;
  const show = sel.value === "Other";
  otherWrap.style.display = show ? "" : "none";
  if (!show && $("concreteTypeOther")) $("concreteTypeOther").value = "";
};

const syncCementTypeOther = () => {
  const sel = $("cementType");
  const otherWrap = $("cementTypeOtherWrapper");
  if (!sel || !otherWrap) return;
  const show = sel.value === "Other";
  otherWrap.style.display = show ? "" : "none";
  if (!show && $("cementTypeOther")) $("cementTypeOther").value = "";
};

/* ---------- Validation ---------- */

const markError = (el) => {
  if (!el) return;
  el.classList.add("error");
};

const clearError = (el) => {
  if (!el) return;
  el.classList.remove("error");
};

const validateForm = () => {
  const requiredIds = [
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
  ];

  const mode = getInputMode();

  const errors = [];

  requiredIds.forEach((id) => {
    const el = $(id);
    const v = (el?.value || "").trim();
    clearError(el);
    if (!v) {
      markError(el);
      errors.push(`Please fill ${id}.`);
    }
  });

  // concreteType other
  if ($("concreteType")?.value === "Other") {
    const el = $("concreteTypeOther");
    const v = (el?.value || "").trim();
    clearError(el);
    if (!v) {
      markError(el);
      errors.push("Please specify concrete type (Other).");
    }
  }

  // cementType other
  if ($("cementType")?.value === "Other") {
    const el = $("cementTypeOther");
    const v = (el?.value || "").trim();
    clearError(el);
    if (!v) {
      markError(el);
      errors.push("Please specify cement type (Other).");
    }
  }

  const validateDynamicRows = (containerId, fieldSelectors, labelPrefix) => {
    const c = $(containerId);
    if (!c) return;

    const rows = Array.from(c.querySelectorAll(".dynamic-row"));
    if (!rows.length) {
      errors.push(`${labelPrefix}: please add at least one row.`);
      return;
    }

    rows.forEach((row, idx) => {
      fieldSelectors.forEach((sel) => {
        const el = row.querySelector(sel);
        const v = (el?.value || "").trim();
        clearError(el);
        if (!v) {
          markError(el);
          errors.push(`${labelPrefix} row ${idx + 1}: please fill all fields.`);
        }
      });
    });
  };

  if (mode === "kg") {
    const cementEl = $("cementContent");
    const waterEl = $("waterContent");
    const cement = toNum(cementEl?.value);
    const water = toNum(waterEl?.value);

    clearError(cementEl);
    clearError(waterEl);

    if (!Number.isFinite(cement) || cement <= 0) {
      markError(cementEl);
      errors.push("Cement content must be a positive number.");
    }

    if (!Number.isFinite(water) || water < 0) {
      markError(waterEl);
      errors.push("Water content must be a number (0 or more).");
    }

    validateDynamicRows(
      "fine-kg-container",
      ['input[name="fine_name"]', 'input[name="fine_qty"]'],
      "Fine aggregate"
    );
    validateDynamicRows(
      "coarse-kg-container",
      ['input[name="coarse_name"]', 'input[name="coarse_qty"]'],
      "Coarse aggregate"
    );
  } else {
    const ratioWaterEl = $("ratioWater");
    const ratioWater = toNum(ratioWaterEl?.value);
    clearError(ratioWaterEl);
    if (!Number.isFinite(ratioWater) || ratioWater < 0) {
      markError(ratioWaterEl);
      errors.push("Water ratio must be a number (0 or more).");
    }

    validateDynamicRows(
      "fine-ratio-container",
      ['input[name="rfine_name"]', 'input[name="rfine_qty"]'],
      "Fine aggregate (ratio)"
    );
    validateDynamicRows(
      "coarse-ratio-container",
      ['input[name="rcoarse_name"]', 'input[name="rcoarse_qty"]'],
      "Coarse aggregate (ratio)"
    );
  }

  // admixtures + scms validation (if any rows exist, require both fields)
  const validateOptionalRows = (containerId, selectors, labelPrefix) => {
    const c = $(containerId);
    if (!c) return;
    const rows = Array.from(c.querySelectorAll(".dynamic-row"));
    rows.forEach((row, idx) => {
      const allEmpty = selectors.every((sel) => {
        const el = row.querySelector(sel);
        const v = (el?.value || "").trim();
        return !v;
      });

      if (!allEmpty) {
        selectors.forEach((sel) => {
          const el = row.querySelector(sel);
          const v = (el?.value || "").trim();
          clearError(el);
          if (!v) {
            markError(el);
            errors.push(`${labelPrefix} row ${idx + 1}: please fill all fields.`);
          }
        });
      }
    });
  };

  validateOptionalRows(
    "admixtures-container",
    ['input[name="adm_name"]', 'input[name="adm_dosage"]'],
    "Admixture"
  );

  validateOptionalRows(
    "scms-container",
    ['input[name="scm_name"]', 'input[name="scm_percent"]'],
    "SCM"
  );

  const errorSummary = $("form-error-summary");
  if (errorSummary) {
    if (errors.length) {
      errorSummary.style.display = "";
      errorSummary.innerHTML = `<strong>Please fix the following:</strong><ul>${errors
        .map((e) => `<li>${e}</li>`)
        .join("")}</ul>`;
    } else {
      errorSummary.style.display = "none";
      errorSummary.innerHTML = "";
    }
  }

  return errors.length === 0;
};

/* ---------- Local storage save/load ---------- */

const getLocalRecords = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveLocalRecords = (records) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records || []));
};

const saveLocal = (record) => {
  const list = getLocalRecords();
  list.unshift(record);
  saveLocalRecords(list);
};

const renderSavedRecords = () => {
  const body = $("mixes-table-body");
  if (!body) return;

  const list = getLocalRecords();

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="6" class="no-data">No mixes saved yet.</td></tr>`;
    return;
  }

  body.innerHTML = list
    .map((r, idx) => {
      const student = r.studentName || "–";
      const type = r.concreteType || "–";
      const wc = r.inputMode === "ratio" ? r.ratioWater : r.wcRatio;
      const wcTxt = wc != null && wc !== "" ? Number(wc).toFixed(2) : "–";
      const saved = r.savedAt ? new Date(r.savedAt).toLocaleString() : "–";
      const app = r.recordId || "–";
      const mode = r.inputMode === "ratio" ? "Ratio" : "kg/m³";

      return `
        <tr data-index="${idx}">
          <td>${app}</td>
          <td>${mode}</td>
          <td>${student}</td>
          <td>${type}</td>
          <td>${wcTxt}</td>
          <td>${saved}</td>
        </tr>
      `;
    })
    .join("");
};

const loadRecordIntoForm = (rec) => {
  if (!rec) return;

  // mode
  if (rec.inputMode === "ratio") {
    $("modeRatio") && ($("modeRatio").checked = true);
  } else {
    $("modeKg") && ($("modeKg").checked = true);
  }
  syncInputModeUI();

  // simple ids
  [
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
    "cementContent",
    "waterContent",
    "ratioWater",
    "notes",
  ].forEach((id) => {
    if ($(id) && rec[id] != null) $(id).value = rec[id];
  });

  // "Other" fields
  if ($("concreteTypeOther") && rec.concreteTypeOther != null) $("concreteTypeOther").value = rec.concreteTypeOther;
  if ($("cementTypeOther") && rec.cementTypeOther != null) $("cementTypeOther").value = rec.cementTypeOther;

  syncConcreteTypeOther();
  syncCementTypeOther();

  // dynamic containers
  if ($("admixtures-container")) $("admixtures-container").innerHTML = "";
  if ($("scms-container")) $("scms-container").innerHTML = "";

  if (Array.isArray(rec.admixtures)) {
    rec.admixtures.forEach((a) => $("admixtures-container")?.appendChild(createAdmixtureRow(a)));
  }

  if (Array.isArray(rec.scms)) {
    rec.scms.forEach((s) => $("scms-container")?.appendChild(createScmRow(s)));
  }

  // aggregates containers
  ["fine-kg-container", "coarse-kg-container", "fine-ratio-container", "coarse-ratio-container"].forEach((id) => {
    const c = $(id);
    if (c) c.innerHTML = "";
  });

  if (Array.isArray(rec.fineKgRows)) {
    rec.fineKgRows.forEach((r) => $("fine-kg-container")?.appendChild(createFineKgRow(r)));
  }
  if (Array.isArray(rec.coarseKgRows)) {
    rec.coarseKgRows.forEach((r) => $("coarse-kg-container")?.appendChild(createCoarseKgRow(r)));
  }
  if (Array.isArray(rec.fineRatioRows)) {
    rec.fineRatioRows.forEach((r) => $("fine-ratio-container")?.appendChild(createFineRatioRow(r)));
  }
  if (Array.isArray(rec.coarseRatioRows)) {
    rec.coarseRatioRows.forEach((r) => $("coarse-ratio-container")?.appendChild(createCoarseRatioRow(r)));
  }

  ensureDefaultAggregateRows();

  // totals + derived
  if (rec.inputMode === "kg") {
    updateWCRatioFromKg();
    updateMixRatioFromKg();
  } else {
    updateWcAndMixFromRatio();
  }

  setStatusLine("Loaded saved mix into form.", "info");
};

/* ---------- Collect data for submit ---------- */

const collectDynamicList = (containerId, nameKey, valueKey) => {
  const c = $(containerId);
  if (!c) return [];
  const rows = [];
  Array.from(c.querySelectorAll(".dynamic-row")).forEach((row) => {
    const name = (row.querySelector(`input[name="${nameKey}"]`)?.value || "").trim();
    const val = (row.querySelector(`input[name="${valueKey}"]`)?.value || "").trim();
    rows.push({ name, [valueKey.includes("dosage") ? "dosage" : valueKey.includes("percent") ? "percent" : "qty"]: val });
  });
  return rows;
};

const collectAggregateRows = (containerId, nameField, qtyField, unit) => {
  const c = $(containerId);
  if (!c) return [];
  const rows = [];
  Array.from(c.querySelectorAll(".dynamic-row")).forEach((row, idx) => {
    const name = (row.querySelector(`input[name="${nameField}"]`)?.value || "").trim();
    const qty = (row.querySelector(`input[name="${qtyField}"]`)?.value || "").trim();
    rows.push({ rowNo: idx + 1, name, qty, unit });
  });
  return rows;
};

const collectFormData = () => {
  const mode = getInputMode();

  const concreteType = $("concreteType")?.value || "";
  const cementType = $("cementType")?.value || "";

  const concreteTypeOther = $("concreteTypeOther")?.value || "";
  const cementTypeOther = $("cementTypeOther")?.value || "";

  const cementContent = mode === "kg" ? $("cementContent")?.value || "" : "";
  const waterContent = mode === "kg" ? $("waterContent")?.value || "" : "";

  const fineAgg = mode === "kg" ? $("fineAgg")?.value || "" : "";
  const coarseAgg = mode === "kg" ? $("coarseAgg")?.value || "" : "";

  const ratioCement = mode === "ratio" ? "1" : "";
  const ratioFine = mode === "ratio" ? $("ratioFine")?.value || "" : "";
  const ratioCoarse = mode === "ratio" ? $("ratioCoarse")?.value || "" : "";
  const ratioWater = mode === "ratio" ? $("ratioWater")?.value || "" : "";

  const wcRatio = mode === "kg" ? (toNum(waterContent) / toNum(cementContent)).toFixed(2) : "";

  const mixRatioString = mode === "kg" ? buildMixRatioFromKgRows() : buildMixRatioFromRatioRows();

  const fineKgRows = collectAggregateRows("fine-kg-container", "fine_name", "fine_qty", "kg/m³");
  const coarseKgRows = collectAggregateRows("coarse-kg-container", "coarse_name", "coarse_qty", "kg/m³");
  const fineRatioRows = collectAggregateRows("fine-ratio-container", "rfine_name", "rfine_qty", "ratio");
  const coarseRatioRows = collectAggregateRows("coarse-ratio-container", "rcoarse_name", "rcoarse_qty", "ratio");

  const fineAggregates = mode === "kg" ? fineKgRows : fineRatioRows;
  const coarseAggregates = mode === "kg" ? coarseKgRows : coarseRatioRows;

  const admixtures = collectDynamicList("admixtures-container", "adm_name", "adm_dosage").map((a) => ({
    name: a.name,
    dosage: a.dosage,
  }));

  const scms = collectDynamicList("scms-container", "scm_name", "scm_percent").map((s) => ({
    name: s.name,
    percent: s.percent,
  }));

  return {
    inputMode: mode,

    studentName: $("studentName")?.value || "",
    matricNumber: $("matricNumber")?.value || "",
    studentPhone: $("studentPhone")?.value || "",
    programme: $("programme")?.value || "",
    supervisorName: $("supervisorName")?.value || "",
    thesisTitle: $("thesisTitle")?.value || "",
    crushDate: $("crushDate")?.value || "",

    concreteType,
    concreteTypeOther: concreteType === "Other" ? concreteTypeOther : "",

    cementType,
    cementTypeOther: cementType === "Other" ? cementTypeOther : "",

    slump: $("slump")?.value || "",
    ageDays: $("ageDays")?.value || "",
    cubesCount: $("cubesCount")?.value || "",
    targetStrength: $("targetStrength")?.value || "",

    cementContent,
    waterContent,
    fineAgg,
    coarseAgg,

    ratioCement,
    ratioFine,
    ratioCoarse,
    ratioWater,

    wcRatio,
    mixRatioString,

    fineAggregates,
    coarseAggregates,
    admixtures,
    scms,

    notes: $("notes")?.value || "",
  };
};

/* ---------- PDF generation (one-page fixed layout) ---------- */

const renderPdfOnePage = (data, fontSize) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "A4" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const margin = 28;

  const boxX = pageW - 210;
  const boxY = 50;
  const boxW = 182;
  const boxH = 120;

  doc.setDrawColor(0);
  doc.setLineWidth(0.7);
  doc.rect(boxX, boxY, boxW, boxH);

  doc.setFontSize(fontSize + 2);
  doc.text("FOR OFFICE USE ONLY", boxX + 10, boxY + 18);

  doc.setFontSize(fontSize);
  doc.text("Application No:", boxX + 10, boxY + 40);
  doc.line(boxX + 10, boxY + 46, boxX + boxW - 10, boxY + 46);

  doc.text("Date Received:", boxX + 10, boxY + 70);
  doc.line(boxX + 10, boxY + 76, boxX + boxW - 10, boxY + 76);

  doc.text("Officer's Name:", boxX + 10, boxY + 100);
  doc.line(boxX + 10, boxY + 106, boxX + boxW - 10, boxY + 106);

  if (logoImageDataUrl) {
    try {
      doc.addImage(logoImageDataUrl, "PNG", margin, 40, 44, 44);
    } catch {}
  }

  doc.setFontSize(fontSize + 7);
  doc.setFont("helvetica", "bold");
  doc.text("UNIVERSITY OF LAGOS", margin + 54, 56);

  doc.setFontSize(fontSize + 3);
  doc.setFont("helvetica", "bold");
  doc.text("DEPARTMENT OF CIVIL & ENVIRONMENTAL ENGINEERING", margin + 54, 76);

  doc.setFontSize(fontSize + 2);
  doc.setFont("helvetica", "bold");
  doc.text("CONCRETE LABORATORY", margin + 54, 94);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.text("Research Mix Intake Form", margin + 54, 112);

  let y = 150;

  const lineGap = Math.max(12, fontSize * 1.25);

  const leftColX = margin;
  const rightColX = margin + 280;

  const label = (txt, x, yy) => {
    doc.setFont("helvetica", "bold");
    doc.text(txt, x, yy);
    doc.setFont("helvetica", "normal");
  };

  const field = (txt, x, yy) => {
    const t = String(txt || "–");
    doc.text(t, x, yy);
  };

  label("Student Name:", leftColX, y);
  field(data.studentName, leftColX + 95, y);

  label("Matric No:", rightColX, y);
  field(data.matricNumber, rightColX + 70, y);

  y += lineGap;

  label("Phone:", leftColX, y);
  field(data.studentPhone, leftColX + 55, y);

  label("Programme:", rightColX, y);
  field(data.programme, rightColX + 80, y);

  y += lineGap;

  label("Supervisor:", leftColX, y);
  field(data.supervisorName, leftColX + 80, y);

  label("Crush Date:", rightColX, y);
  field(data.crushDate, rightColX + 80, y);

  y += lineGap;

  label("Thesis Title:", leftColX, y);
  field(data.thesisTitle, leftColX + 80, y);

  y += lineGap;

  const concreteTypeFull =
    data.concreteType === "Other" ? `${data.concreteType} (${data.concreteTypeOther})` : data.concreteType;

  const cementTypeFull =
    data.cementType === "Other" ? `${data.cementType} (${data.cementTypeOther})` : data.cementType;

  label("Concrete Type:", leftColX, y);
  field(concreteTypeFull, leftColX + 95, y);

  label("Cement Type:", rightColX, y);
  field(cementTypeFull, rightColX + 85, y);

  y += lineGap;

  label("Slump (mm):", leftColX, y);
  field(data.slump, leftColX + 90, y);

  label("Age (days):", rightColX, y);
  field(data.ageDays, rightColX + 80, y);

  y += lineGap;

  label("Cubes:", leftColX, y);
  field(data.cubesCount, leftColX + 50, y);

  label("Target Strength (MPa):", rightColX, y);
  field(data.targetStrength, rightColX + 150, y);

  y += lineGap + 8;

  doc.setFont("helvetica", "bold");
  doc.text("Mix Components", leftColX, y);
  doc.setFont("helvetica", "normal");

  y += lineGap;

  const mode = data.inputMode === "ratio" ? "ratio" : "kg/m³";
  doc.text(`Input Mode: ${mode}`, leftColX, y);

  y += lineGap;

  if (data.inputMode === "kg") {
    label("Cement (kg/m³):", leftColX, y);
    field(data.cementContent, leftColX + 110, y);

    label("Water (kg/m³):", rightColX, y);
    field(data.waterContent, rightColX + 105, y);

    y += lineGap;

    label("Fine Agg (kg/m³):", leftColX, y);
    field(data.fineAgg, leftColX + 120, y);

    label("Coarse Agg (kg/m³):", rightColX, y);
    field(data.coarseAgg, rightColX + 140, y);

    y += lineGap;

    label("W/C Ratio:", leftColX, y);
    field(data.wcRatio, leftColX + 75, y);

    label("Mix Ratio:", rightColX, y);
    field(data.mixRatioString, rightColX + 70, y);
  } else {
    label("Cement:", leftColX, y);
    field("1", leftColX + 45, y);

    label("Water Ratio:", rightColX, y);
    field(data.ratioWater, rightColX + 95, y);

    y += lineGap;

    label("Fine Ratio (Total):", leftColX, y);
    field(data.ratioFine, leftColX + 130, y);

    label("Coarse Ratio (Total):", rightColX, y);
    field(data.ratioCoarse, rightColX + 150, y);

    y += lineGap;

    label("W/C Ratio:", leftColX, y);
    field(data.ratioWater, leftColX + 75, y);

    label("Mix Ratio:", rightColX, y);
    field(data.mixRatioString, rightColX + 70, y);
  }

  y += lineGap + 10;

  const listBlock = (title, items, lineFmt) => {
    if (!items || !items.length) return;
    doc.setFont("helvetica", "bold");
    doc.text(title, leftColX, y);
    doc.setFont("helvetica", "normal");
    y += lineGap;

    items.forEach((it) => {
      doc.text(lineFmt(it), leftColX + 10, y);
      y += lineGap;
    });

    y += 4;
  };

  listBlock(
    "Fine Aggregates:",
    data.fineAggregates || [],
    (a) => `${a.rowNo}. ${a.name} — ${a.qty} (${a.unit})`
  );

  listBlock(
    "Coarse Aggregates:",
    data.coarseAggregates || [],
    (a) => `${a.rowNo}. ${a.name} — ${a.qty} (${a.unit})`
  );

  listBlock(
    "Admixtures:",
    data.admixtures || [],
    (a) => `${a.name} — ${a.dosage}`
  );

  listBlock(
    "SCMs:",
    data.scms || [],
    (s) => `${s.name} — ${s.percent}%`
  );

  if (data.notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", leftColX, y);
    doc.setFont("helvetica", "normal");
    y += lineGap;

    const split = doc.splitTextToSize(String(data.notes), pageW - margin * 2);
    split.forEach((ln) => {
      doc.text(ln, leftColX, y);
      y += lineGap;
    });
  }

  if (y > pageH - margin) return null;

  return doc;
};

const generatePDF = async (data) => {
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
  let resOk = false;

  try {
    const res = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    resOk = res.ok;
    apiResult = await res.json().catch(() => null);
  } catch {
    apiResult = null;
    resOk = false;
  }

  // BACKEND IS SOURCE OF TRUTH FOR recordId (sequential)
  if (!resOk || !apiResult?.recordId) {
    const msg =
      apiResult?.message
        ? `Failed: ${apiResult.message}`
        : "Failed to submit. Backend did not return an application number (recordId).";
    setStatusLine(msg, "error");
    return;
  }

  const recordId = apiResult.recordId;

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

  // enforce cement=1 in ratio mode
  if ($("ratioCement")) $("ratioCement").value = "1";

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

/* ---------- Cement fixed at 1 in ratio mode ---------- */

const enforceRatioCementIsOne = () => {
  const el = $("ratioCement");
  if (!el) return;

  el.value = "1";
  el.setAttribute("readonly", "readonly");

  const force = () => {
    if (el.value !== "1") el.value = "1";
  };

  ["input", "change", "blur", "keyup"].forEach((evt) => el.addEventListener(evt, force));
};

/* ---------- Boot ---------- */

document.addEventListener("DOMContentLoaded", () => {
  const ySpan = $("year");
  if (ySpan) ySpan.textContent = new Date().getFullYear();

  setToday($("crushDate"));
  loadImageAsDataURL("unilag-logo.png").then((d) => (logoImageDataUrl = d));

  enforceRatioCementIsOne();
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

  $("ratioWater")?.addEventListener("input", updateWcAndMixFromRatio);
  // mix ratio responds to dynamic row changes via syncFineRatioTotal/syncCoarseRatioTotal

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
