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

const getInputMode = () =>
  (document.querySelector('input[name="inputMode"]:checked') || {}).value ||
  "kg";

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


/* ---------- Dynamic rows (kg fine/coarse aggregates) ---------- */

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
    syncCoarseKgTotal();
  };

  return row;
};

const ensureDefaultAggregateRows = () => {
  const fineC = $("fine-kg-container");
  const coarseC = $("coarse-kg-container");
  const fineR = $("fine-ratio-container");
  const coarseR = $("coarse-ratio-container");

  if (fineC && !fineC.querySelector(".dynamic-row")) fineC.appendChild(createFineKgRow());
  if (coarseC && !coarseC.querySelector(".dynamic-row"))
    coarseC.appendChild(createCoarseKgRow());

  if (fineR && !fineR.querySelector(".dynamic-row")) fineR.appendChild(createFineRatioRow());
  if (coarseR && !coarseR.querySelector(".dynamic-row"))
    coarseR.appendChild(createCoarseRatioRow());

  syncFineKgTotal();
  syncCoarseKgTotal();
  syncFineRatioTotal();
  syncCoarseRatioTotal();
};

const syncFineKgTotal = () => {
  const c = $("fine-kg-container");
  const totalEl = $("fineAgg");
  if (!c || !totalEl) return;

  let seen = false;
  let anyBlank = false;
  let total = 0;

  c.querySelectorAll(".dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="fine_name"]')?.value.trim() || "";
    const qtyRaw = row.querySelector('input[name="fine_qty"]')?.value;

    if (name || qtyRaw !== "") seen = true;

    if (!name || qtyRaw === "") anyBlank = true;

    const qty = parseFloat(qtyRaw);
    if (!isNaN(qty)) total += qty;
  });

  if (!seen || anyBlank) totalEl.value = "";
  else totalEl.value = String(total);

  updateWCRatioFromKg();
  updateMixRatioFromKg();
};

const syncCoarseKgTotal = () => {
  const c = $("coarse-kg-container");
  const totalEl = $("coarseAgg");
  if (!c || !totalEl) return;

  let seen = false;
  let anyBlank = false;
  let total = 0;

  c.querySelectorAll(".dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="coarse_name"]')?.value.trim() || "";
    const qtyRaw = row.querySelector('input[name="coarse_qty"]')?.value;

    if (name || qtyRaw !== "") seen = true;

    if (!name || qtyRaw === "") anyBlank = true;

    const qty = parseFloat(qtyRaw);
    if (!isNaN(qty)) total += qty;
  });

  if (!seen || anyBlank) totalEl.value = "";
  else totalEl.value = String(total);

  updateWCRatioFromKg();
  updateMixRatioFromKg();
};

/* ---------- Dynamic rows (ratio fine/coarse aggregates) ---------- */

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
    syncCoarseRatioTotal();
  };

  return row;
};

const syncFineRatioTotal = () => {
  const c = $("fine-ratio-container");
  const totalEl = $("ratioFine");
  if (!c || !totalEl) return;

  let seen = false;
  let anyBlank = false;
  let total = 0;

  c.querySelectorAll(".dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="rfine_name"]')?.value.trim() || "";
    const qtyRaw = row.querySelector('input[name="rfine_qty"]')?.value;

    if (name || qtyRaw !== "") seen = true;
    if (!name || qtyRaw === "") anyBlank = true;

    const qty = parseFloat(qtyRaw);
    if (!isNaN(qty)) total += qty;
  });

  if (!seen || anyBlank) totalEl.value = "";
  else totalEl.value = String(total);

  updateWcAndMixFromRatio();
};

const syncCoarseRatioTotal = () => {
  const c = $("coarse-ratio-container");
  const totalEl = $("ratioCoarse");
  if (!c || !totalEl) return;

  let seen = false;
  let anyBlank = false;
  let total = 0;

  c.querySelectorAll(".dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="rcoarse_name"]')?.value.trim() || "";
    const qtyRaw = row.querySelector('input[name="rcoarse_qty"]')?.value;

    if (name || qtyRaw !== "") seen = true;
    if (!name || qtyRaw === "") anyBlank = true;

    const qty = parseFloat(qtyRaw);
    if (!isNaN(qty)) total += qty;
  });

  if (!seen || anyBlank) totalEl.value = "";
  else totalEl.value = String(total);

  updateWcAndMixFromRatio();
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
  const water = parseFloat($("waterContent").value);
  const fine = parseFloat($("fineAgg").value);
  const medium = parseFloat($("mediumAgg").value);
  const coarse = parseFloat($("coarseAgg").value);

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
  const fine = parseFloat($("fineAgg").value);
  const medium = parseFloat($("mediumAgg").value);
  const coarse = parseFloat($("coarseAgg").value);
  const water = parseFloat($("waterContent").value);

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
  const f = parseFloat($("ratioFine").value);
  const m = parseFloat($("ratioMedium").value);
  const co = parseFloat($("ratioCoarse").value);
  const w = parseFloat($("ratioWater").value);

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

  const kgRequired = [
    "cementContent",
    "waterContent",
    "fineAgg",
    "mediumAgg",
    "coarseAgg",
  ];

  const ratioRequired = [
    "ratioCement",
    "ratioFine",
    "ratioMedium",
    "ratioCoarse",
    "ratioWater",
  ];

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

  (mode === "kg" ? kgRequired : ratioRequired).forEach(checkId);

  // Extra validation for dynamic fine/coarse aggregate rows
  if (mode === "kg") {
    const fineC = $("fine-kg-container");
    const coarseC = $("coarse-kg-container");
    let firstRowBad = null;

    const validateRows = (container, nameSel, qtySel) => {
      const rows = container ? Array.from(container.querySelectorAll(".dynamic-row")) : [];
      if (!rows.length) {
        missing.push("aggregates");
        if (container) container.classList.add("error");
        if (!firstRowBad && container) firstRowBad = container;
        return;
      }
      rows.forEach((row) => {
        const nameEl = row.querySelector(nameSel);
        const qtyEl = row.querySelector(qtySel);
        const name = nameEl?.value.trim() || "";
        const qty = qtyEl?.value ?? "";
        if (!name) {
          nameEl?.classList.add("error");
          missing.push("aggregates");
          if (!firstRowBad) firstRowBad = nameEl;
        }
        if (qty === "") {
          qtyEl?.classList.add("error");
          missing.push("aggregates");
          if (!firstRowBad) firstRowBad = qtyEl;
        }
      });
    };

    validateRows(fineC, 'input[name="fine_name"]', 'input[name="fine_qty"]');
    validateRows(coarseC, 'input[name="coarse_name"]', 'input[name="coarse_qty"]');

    if (firstRowBad && !firstBad) firstBad = firstRowBad;
  }

  if (mode === "ratio") {
    const fineC = $("fine-ratio-container");
    const coarseC = $("coarse-ratio-container");
    let firstRowBad = null;

    const validateRows = (container, nameSel, qtySel) => {
      const rows = container ? Array.from(container.querySelectorAll(".dynamic-row")) : [];
      if (!rows.length) {
        missing.push("aggregateRatios");
        if (container) container.classList.add("error");
        if (!firstRowBad && container) firstRowBad = container;
        return;
      }
      rows.forEach((row) => {
        const nameEl = row.querySelector(nameSel);
        const qtyEl = row.querySelector(qtySel);
        const name = nameEl?.value.trim() || "";
        const qty = qtyEl?.value ?? "";
        if (!name) {
          nameEl?.classList.add("error");
          missing.push("aggregateRatios");
          if (!firstRowBad) firstRowBad = nameEl;
        }
        if (qty === "") {
          qtyEl?.classList.add("error");
          missing.push("aggregateRatios");
          if (!firstRowBad) firstRowBad = qtyEl;
        }
      });
    };

    validateRows(fineC, 'input[name="rfine_name"]', 'input[name="rfine_qty"]');
    validateRows(coarseC, 'input[name="rcoarse_name"]', 'input[name="rcoarse_qty"]');

    if (firstRowBad && !firstBad) firstBad = firstRowBad;
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


  const fineKgMaterials = [];
  document.querySelectorAll("#fine-kg-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="fine_name"]')?.value.trim() || "";
    const qty = row.querySelector('input[name="fine_qty"]')?.value ?? "";
    if (name || qty !== "") fineKgMaterials.push({ name, qty });
  });

  const coarseKgMaterials = [];
  document.querySelectorAll("#coarse-kg-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="coarse_name"]')?.value.trim() || "";
    const qty = row.querySelector('input[name="coarse_qty"]')?.value ?? "";
    if (name || qty !== "") coarseKgMaterials.push({ name, qty });
  });

  const ratioFineMaterials = [];
  document.querySelectorAll("#fine-ratio-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="rfine_name"]')?.value.trim() || "";
    const qty = row.querySelector('input[name="rfine_qty"]')?.value ?? "";
    if (name || qty !== "") ratioFineMaterials.push({ name, qty });
  });

  const ratioCoarseMaterials = [];
  document.querySelectorAll("#coarse-ratio-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="rcoarse_name"]')?.value.trim() || "";
    const qty = row.querySelector('input[name="rcoarse_qty"]')?.value ?? "";
    if (name || qty !== "") ratioCoarseMaterials.push({ name, qty });
  });


  const cementContent = Number($("cementContent").value || 0);
  const waterContent = Number($("waterContent").value || 0);
  const fineAgg = Number($("fineAgg").value || 0);
  const mediumAgg = Number($("mediumAgg").value || 0);
  const coarseAgg = Number($("coarseAgg").value || 0);

  const ratioCement = Number($("ratioCement").value || 0);
  const ratioFine = Number($("ratioFine").value || 0);
  const ratioMedium = Number($("ratioMedium").value || 0);
  const ratioCoarse = Number($("ratioCoarse").value || 0);
  const ratioWater = Number($("ratioWater").value || 0);

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

    ratioCement,
    ratioFine,
    ratioMedium,
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

/* ---------- Local storage ---------- */

const getLocalRecords = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveLocalRecords = (list) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

const saveLocal = (record) => {
  const list = getLocalRecords();
  list.push(record);
  saveLocalRecords(list);
};

/* ---------- Table render ---------- */

const renderSavedRecords = () => {
  const list = getLocalRecords();
  const tbody = $("mixes-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!list.length) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="no-data">No mixes saved yet.</td></tr>';
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

    // handle legacy records that still used "organisationType"
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
  if (mode === "kg") $("modeKg").checked = true;
  else $("modeRatio").checked = true;
  syncInputModeUI();


  // Kg inputs
  $("cementContent").value = r.cementContent ?? "";

  // Kg inputs
  $("cementContent").value = r.cementContent ?? "";
  $("waterContent").value = r.waterContent ?? "";
  $("mediumAgg").value = r.mediumAgg ?? "";

  // Fine aggregate rows (kg/m³)
  const fineKgC = $("fine-kg-container");
  if (fineKgC) {
    fineKgC.innerHTML = "";
    if (Array.isArray(r.fineKgMaterials) && r.fineKgMaterials.length) {
      r.fineKgMaterials.forEach((it) =>
        fineKgC.appendChild(createFineKgRow({ name: it.name, qty: it.qty }))
      );
    } else {
      // Backward compatibility: use saved total as a single row
      fineKgC.appendChild(
        createFineKgRow({ name: "Fine Aggregate", qty: r.fineAgg ?? "" })
      );
    }
  }

  // Coarse aggregate rows (kg/m³)
  const coarseKgC = $("coarse-kg-container");
  if (coarseKgC) {
    coarseKgC.innerHTML = "";
    if (Array.isArray(r.coarseKgMaterials) && r.coarseKgMaterials.length) {
      r.coarseKgMaterials.forEach((it) =>
        coarseKgC.appendChild(createCoarseKgRow({ name: it.name, qty: it.qty }))
      );
    } else {
      coarseKgC.appendChild(
        createCoarseKgRow({ name: "Coarse Aggregate", qty: r.coarseAgg ?? "" })
      );
    }
  }

  // Ensure hidden totals are synced for kg mode
  syncFineKgTotal();
  syncCoarseKgTotal();


  // Ratio inputs
  $("ratioCement").value = r.ratioCement ?? "1";
  $("ratioMedium").value = r.ratioMedium ?? "";
  $("ratioWater").value = r.ratioWater ?? "";

  // Fine aggregate rows (ratio)
  const fineRatioC = $("fine-ratio-container");
  if (fineRatioC) {
    fineRatioC.innerHTML = "";
    if (Array.isArray(r.ratioFineMaterials) && r.ratioFineMaterials.length) {
      r.ratioFineMaterials.forEach((it) =>
        fineRatioC.appendChild(createFineRatioRow({ name: it.name, qty: it.qty }))
      );
    } else {
      fineRatioC.appendChild(
        createFineRatioRow({ name: "Fine Aggregate", qty: r.ratioFine ?? "" })
      );
    }
  }

  // Coarse aggregate rows (ratio)
  const coarseRatioC = $("coarse-ratio-container");
  if (coarseRatioC) {
    coarseRatioC.innerHTML = "";
    if (Array.isArray(r.ratioCoarseMaterials) && r.ratioCoarseMaterials.length) {
      r.ratioCoarseMaterials.forEach((it) =>
        coarseRatioC.appendChild(createCoarseRatioRow({ name: it.name, qty: it.qty }))
      );
    } else {
      coarseRatioC.appendChild(
        createCoarseRatioRow({ name: "Coarse Aggregate", qty: r.ratioCoarse ?? "" })
      );
    }
  }

  // Sync hidden totals for ratio mode
  syncFineRatioTotal();
  syncCoarseRatioTotal();

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

const generatePDF = async (data) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "A4" });

  const pageW = 595;
  const margin = 32;
  let y = 40;

  if (logoImageDataUrl) doc.addImage(logoImageDataUrl, "PNG", margin, y, 60, 60);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("CONCRETE LABORATORY – UNIVERSITY OF LAGOS", margin + 80, y + 20);
  doc.setFontSize(10);
  doc.text("Research Mix Cube Test Intake Form", margin + 80, y + 38);
  y += 80;

  if (data.recordId) {
    doc.setFont("helvetica", "bold");
    doc.text(`Application No: ${data.recordId}`, margin, y);
    y += 18;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Student & Research Details", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  [
    `Student Name: ${data.studentName}`,
    `Matriculation Number: ${data.matricNumber}`,
    `Programme: ${data.programme}`,
    `Supervisor: ${data.supervisorName}`,
    `Student Phone: ${data.studentPhone}`,
    `Project / Thesis Title: ${data.thesisTitle}`,
  ].forEach((line) => {
    doc.text(line, margin, y);
    y += 14;
  });
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Test Information", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  [
    `Crushing Date: ${data.crushDate}`,
    `Concrete Type: ${data.concreteType}`,
    `Cement Type: ${data.cementType}`,
    `Slump / Flow (mm): ${data.slump}`,
    `Age at Testing (days): ${data.ageDays}`,
    `Number of Cubes: ${data.cubesCount}`,
    `Target Strength (MPa): ${data.targetStrength}`,
  ].forEach((line) => {
    doc.text(line, margin, y);
    y += 14;
  });
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text(
    data.inputMode === "ratio"
      ? "Material Quantities (Ratios by Cement)"
      : "Material Quantities (kg/m³)",
    margin,
    y
  );
  y += 16;
  doc.setFont("helvetica", "normal");

  if (data.inputMode === "kg") {
    [
      `Cement: ${data.cementContent}`,
      `Water: ${data.waterContent}`,
      `Fine Aggregate: ${data.fineAgg}`,
      `Medium Aggregate: ${data.mediumAgg}`,
      `Coarse Aggregate: ${data.coarseAgg}`,
    ].forEach((line) => {
      doc.text(line, margin, y);
      y += 14;
    });
  } else {
    [
      `Cement: ${data.ratioCement}`,
      `Fine Aggregate: ${data.ratioFine}`,
      `Medium Aggregate: ${data.ratioMedium}`,
      `Coarse Aggregate: ${data.ratioCoarse}`,
      `Water: ${data.ratioWater}`,
    ].forEach((line) => {
      doc.text(line, margin, y);
      y += 14;
    });
  }

  const wcRatio =
    typeof data.wcRatio === "number" && !isNaN(data.wcRatio)
      ? data.wcRatio.toFixed(2)
      : String(data.wcRatio || "");
  doc.text(`W/C Ratio: ${wcRatio}`, margin, y);
  y += 14;
  doc.text(`Mix Ratio: ${data.mixRatioString || ""}`, margin, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.text("Admixtures", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  if (data.admixtures?.length) {
    data.admixtures.forEach((a, i) => {
      doc.text(`${i + 1}. ${a.name || ""} | ${a.dosage || ""} L/100kg`, margin, y);
      y += 14;
    });
  } else {
    doc.text("None", margin, y);
    y += 14;
  }
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("SCMs", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  if (data.scms?.length) {
    data.scms.forEach((s, i) => {
      doc.text(`${i + 1}. ${s.name || ""} | ${s.percent || ""}%`, margin, y);
      y += 14;
    });
  } else {
    doc.text("None", margin, y);
    y += 14;
  }
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Notes", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  const notesLines = doc.splitTextToSize(
    data.notes || "",
    pageW - margin * 2
  );
  doc.text(notesLines, margin, y);

  const filename = `${sanitizeFilename(
    data.studentName || "Student"
  )}_${sanitizeFilename(data.thesisTitle || "ResearchMix")}.pdf`;
  doc.save(filename);
};

/* ---------- CSV & clear ---------- */

const exportCsv = () => {
  const list = getLocalRecords();
  if (!list.length) return;

  const headers = [
    "RecordId",
    "InputMode",
    "StudentName",
    "MatricNumber",
    "StudentPhone",
    "Programme",
    "SupervisorName",
    "ThesisTitle",
    "CrushDate",
    "ConcreteType",
    "CementType",
    "Slump",
    "AgeDays",
    "CubesCount",
    "TargetStrength",
    "CementContent",
    "WaterContent",
    "FineAgg",
    "MediumAgg",
    "CoarseAgg",
    "RatioCement",
    "RatioFine",
    "RatioMedium",
    "RatioCoarse",
    "RatioWater",
    "WCRatio",
    "MixRatio",
    "Notes",
    "SavedAt",
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
      r.mediumAgg ?? "",
      r.coarseAgg ?? "",
      r.ratioCement ?? "",
      r.ratioFine ?? "",
      r.ratioMedium ?? "",
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

/* ---------- Submit ---------- */

const submitForm = async (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  setStatusLine("Submitting...", "info");
  const data = collectFormData();

  if (!logoImageDataUrl) logoImageDataUrl = await loadImageAsDataURL("unilag-logo.png");

  let apiResult = null;
  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) apiResult = await res.json();
    else console.error("API error", res.status);
  } catch (err) {
    console.error("Network error submitting to API:", err);
  }

  if (apiResult?.success) {
    if (typeof apiResult.wcRatio !== "undefined") {
      data.wcRatio = apiResult.wcRatio;
      if (!isNaN(apiResult.wcRatio))
        $("wcRatioValue").textContent = apiResult.wcRatio.toFixed(2);
    }
    if (apiResult.mixRatioString) {
      data.mixRatioString = apiResult.mixRatioString;
      $("mixRatioValue").textContent = apiResult.mixRatioString;
    }

    data.recordId = apiResult.recordId;
    const modal = $("appModal");
    const modalNumber = $("modalNumber");
    if (modal && modalNumber) {
      modalNumber.textContent = apiResult.recordId;
      modal.classList.remove("hidden");
    }
    setStatusLine("Submitted and saved locally.", "success");
  } else {
    setStatusLine(
      "Saved locally and PDF generated, but could not submit to server.",
      "error"
    );
  }

  const localRecord = { ...data, recordId: data.recordId || null, savedAt: new Date().toISOString() };
  saveLocal(localRecord);
  renderSavedRecords();

  await generatePDF(data);
};

/* ---------- Reset ---------- */

const resetFormFields = () => {
  const form = $("mix-form");
  if (!form) return;
  form.reset();
  setToday($("crushDate"));
  $("ratioCement").value = "1";
  $("wcRatioValue").textContent = "0.00";
  $("mixRatioValue").textContent = "–";

  // Clear dynamic groups
  $("admixtures-container").innerHTML = "";
  $("scms-container").innerHTML = "";

  const fineKgC = $("fine-kg-container");
  const coarseKgC = $("coarse-kg-container");
  const fineRatioC = $("fine-ratio-container");
  const coarseRatioC = $("coarse-ratio-container");

  if (fineKgC) fineKgC.innerHTML = "";
  if (coarseKgC) coarseKgC.innerHTML = "";
  if (fineRatioC) fineRatioC.innerHTML = "";
  if (coarseRatioC) coarseRatioC.innerHTML = "";

  if ($("fineAgg")) $("fineAgg").value = "";
  if ($("coarseAgg")) $("coarseAgg").value = "";
  if ($("ratioFine")) $("ratioFine").value = "";
  if ($("ratioCoarse")) $("ratioCoarse").value = "";

  syncInputModeUI();
  syncConcreteTypeOther();
  syncCementTypeOther();

  ensureDefaultAggregateRows();
  setStatusLine("", "info");
};


/* ---------- Modal ---------- */

const initModal = () => {
  const modal = $("appModal");
  const closeBtn = $("modalClose");
  if (!modal || !closeBtn) return;
  const close = () => modal.classList.add("hidden");
  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
};

/* ---------- Init ---------- */

document.addEventListener("DOMContentLoaded", () => {
  const ySpan = $("year");
  if (ySpan) ySpan.textContent = new Date().getFullYear();

  setToday($("crushDate"));
  loadImageAsDataURL("unilag-logo.png").then((d) => (logoImageDataUrl = d));


  // Aggregate rows (Fine/Coarse) – dynamic like admixtures
  const addFineKgBtn = $("add-fine-kg-btn");
  if (addFineKgBtn) {
    addFineKgBtn.onclick = () => {
      const c = $("fine-kg-container");
      if (c) c.appendChild(createFineKgRow());
      syncFineKgTotal();
    };
  }

  const addCoarseKgBtn = $("add-coarse-kg-btn");
  if (addCoarseKgBtn) {
    addCoarseKgBtn.onclick = () => {
      const c = $("coarse-kg-container");
      if (c) c.appendChild(createCoarseKgRow());
      syncCoarseKgTotal();
    };
  }

  const addFineRatioBtn = $("add-fine-ratio-btn");
  if (addFineRatioBtn) {
    addFineRatioBtn.onclick = () => {
      const c = $("fine-ratio-container");
      if (c) c.appendChild(createFineRatioRow());
      syncFineRatioTotal();
    };
  }

  const addCoarseRatioBtn = $("add-coarse-ratio-btn");
  if (addCoarseRatioBtn) {
    addCoarseRatioBtn.onclick = () => {
      const c = $("coarse-ratio-container");
      if (c) c.appendChild(createCoarseRatioRow());
      syncCoarseRatioTotal();
    };
  }

  ensureDefaultAggregateRows();

  $("add-admixture-btn").onclick = () =>
    $("admixtures-container").appendChild(createAdmixtureRow());
  $("add-scm-btn").onclick = () =>
    $("scms-container").appendChild(createScmRow());

  $("modeKg").addEventListener("change", syncInputModeUI);
  $("modeRatio").addEventListener("change", syncInputModeUI);
  syncInputModeUI();

  $("concreteType").addEventListener("change", syncConcreteTypeOther);
  $("cementType").addEventListener("change", syncCementTypeOther);
  syncConcreteTypeOther();
  syncCementTypeOther();

  ["cementContent", "waterContent"].forEach((id) =>
    $(id).addEventListener("input", () => {
      updateWCRatioFromKg();
      updateMixRatioFromKg();
    })
  );
  ["fineAgg", "mediumAgg", "coarseAgg"].forEach((id) =>
    $(id).addEventListener("input", () => {
      updateWCRatioFromKg();
      updateMixRatioFromKg();
    })
  );

  ["ratioCement", "ratioFine", "ratioMedium", "ratioCoarse", "ratioWater"].forEach(
    (id) => $(id).addEventListener("input", updateWcAndMixFromRatio)
  );

  $("mix-form").addEventListener("submit", submitForm);
  $("reset-form-btn").addEventListener("click", resetFormFields);
  $("export-csv-btn").addEventListener("click", exportCsv);
  $("clear-all-btn").addEventListener("click", clearAllRecords);

  $("mixes-table-body").addEventListener("click", (e) => {
    const tr = e.target.closest("tr");
    if (!tr || tr.classList.contains("no-data")) return;
    const idx = tr.dataset.index;
    if (idx === undefined) return;
    const record = getLocalRecords()[idx];
    if (record) loadRecordIntoForm(record);
  });

  initModal();
  renderSavedRecords();

});
