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
  (document.querySelector('input[name="inputMode"]:checked') || {}).value || "kg";

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

// Generic material row (used for kg/m³ and ratio modes)
const createMaterialRow = (opts = {}) => {
  const {
    mode = "kg", // "kg" | "ratio"
    kind = "cement", // cement|water|fine|medium|coarse
    data = {},
  } = opts;

  const row = document.createElement("div");
  row.className = "dynamic-row";
  row.dataset.mode = mode;
  row.dataset.kind = kind;

  const unitLabel = mode === "kg" ? "kg/m³" : "ratio";
  const qtyStep = mode === "kg" ? "0.1" : "0.01";
  const qtyPlaceholder = mode === "kg" ? "e.g., 350" : "e.g., 2.50";

  row.innerHTML = `
    <label>
      <span class="label-line">Description</span>
      <input type="text" name="mat_desc" value="${(data.desc || "").replace(/"/g, "&quot;")}" placeholder="e.g., River sand / 12.5mm / Batch 2">
    </label>
    <label>
      <span class="label-line">Quantity (${unitLabel}) <span class="required-asterisk">*</span></span>
      <input type="number" min="0" step="${qtyStep}" name="mat_qty" value="${data.qty ?? ""}" placeholder="${qtyPlaceholder}">
    </label>
    <button type="button" class="remove-row-btn">×</button>
  `;

  row.querySelector(".remove-row-btn").onclick = () => {
    row.remove();
    if (mode === "kg") {
      updateWCRatioFromKg();
      updateMixRatioFromKg();
    } else {
      updateWcAndMixFromRatio();
    }
  };

  // Live updates
  const qtyInput = row.querySelector('input[name="mat_qty"]');
  qtyInput.addEventListener("input", () => {
    if (mode === "kg") {
      updateWCRatioFromKg();
      updateMixRatioFromKg();
    } else {
      updateWcAndMixFromRatio();
    }
  });

  return row;
};

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

// Helper: read rows from a container
const readMaterialRows = (containerId) => {
  const el = $(containerId);
  if (!el) return [];
  const rows = [];
  el.querySelectorAll(".dynamic-row").forEach((row) => {
    const desc = (row.querySelector('input[name="mat_desc"]')?.value || "").trim();
    const qtyRaw = row.querySelector('input[name="mat_qty"]')?.value;
    const qty = qtyRaw === "" ? NaN : Number(qtyRaw);
    rows.push({ desc, qty });
  });
  return rows;
};

// Helper: sum numeric qty from rows
const sumQty = (rows) =>
  rows.reduce((acc, r) => acc + (typeof r.qty === "number" && !isNaN(r.qty) ? r.qty : 0), 0);

/* ---------- W/C + Mix ratio ---------- */

const toggleRatioBoxes = (show) => {
  const wc = $("wcratio-box");
  const mix = $("mixratio-box");
  if (!wc || !mix) return;
  wc.style.display = mix.style.display = show ? "" : "none";
};

const updateWCRatioFromKg = () => {
  const cement = sumQty(readMaterialRows("cement-kg-container"));
  const water = sumQty(readMaterialRows("water-kg-container"));
  const fine = sumQty(readMaterialRows("fine-kg-container"));
  const medium = sumQty(readMaterialRows("medium-kg-container"));
  const coarse = sumQty(readMaterialRows("coarse-kg-container"));

  // keep legacy hidden inputs in sync (for backward compatibility)
  $("cementContent").value = cement || "";
  $("waterContent").value = water || "";
  $("fineAgg").value = fine || "";
  $("mediumAgg").value = medium || "";
  $("coarseAgg").value = coarse || "";

  if (!cement || !water || [fine, medium, coarse].some((v) => typeof v !== "number")) {
    if (!cement || !water) {
      toggleRatioBoxes(false);
      return 0;
    }
  }

  const ratio = cement ? water / cement : 0;
  $("wcRatioValue").textContent = ratio.toFixed(2);
  toggleRatioBoxes(true);
  return ratio;
};

const updateMixRatioFromKg = () => {
  const cement = sumQty(readMaterialRows("cement-kg-container"));
  const fine = sumQty(readMaterialRows("fine-kg-container"));
  const medium = sumQty(readMaterialRows("medium-kg-container"));
  const coarse = sumQty(readMaterialRows("coarse-kg-container"));
  const water = sumQty(readMaterialRows("water-kg-container"));

  if (!cement) {
    toggleRatioBoxes(false);
    return "";
  }

  const mix = `1 : ${(fine / cement).toFixed(2)} : ${(medium / cement).toFixed(2)} : ${(coarse / cement).toFixed(2)} : ${(water / cement).toFixed(2)}`;
  $("mixRatioValue").textContent = mix;
  toggleRatioBoxes(true);
  return mix;
};

const updateWcAndMixFromRatio = () => {
  const c = sumQty(readMaterialRows("cement-ratio-container")) || 1;
  const f = sumQty(readMaterialRows("fine-ratio-container"));
  const m = sumQty(readMaterialRows("medium-ratio-container"));
  const co = sumQty(readMaterialRows("coarse-ratio-container"));
  const w = sumQty(readMaterialRows("water-ratio-container"));

  // keep legacy hidden ratio inputs in sync
  $("ratioCement").value = c;
  $("ratioFine").value = f || "";
  $("ratioMedium").value = m || "";
  $("ratioCoarse").value = co || "";
  $("ratioWater").value = w || "";

  if (!c || [f, m, co, w].some((v) => typeof v !== "number")) {
    if (!c) {
      toggleRatioBoxes(false);
      return { wcRatio: 0, mixRatioString: "" };
    }
  }

  const wc = c ? w / c : 0;
  const mix = `1 : ${(f / c).toFixed(2)} : ${(m / c).toFixed(2)} : ${(co / c).toFixed(2)} : ${(w / c).toFixed(2)}`;

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

  // Materials are now dynamic rows, so we validate containers instead of single IDs
  const kgContainers = [
    "cement-kg-container",
    "water-kg-container",
    "fine-kg-container",
    "medium-kg-container",
    "coarse-kg-container",
  ];

  const ratioContainers = [
    "cement-ratio-container",
    "fine-ratio-container",
    "medium-ratio-container",
    "coarse-ratio-container",
    "water-ratio-container",
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

  // Validate dynamic material rows
  const validateMaterialContainer = (containerId) => {
    const c = $(containerId);
    if (!c) return;
    const rows = c.querySelectorAll(".dynamic-row");
    if (!rows.length) {
      missing.push(containerId);
      if (!firstBad) firstBad = c;
      return;
    }
    rows.forEach((row) => {
      const qty = row.querySelector('input[name="mat_qty"]');
      if (!qty) return;
      if (!String(qty.value).trim()) {
        qty.classList.add("error");
        missing.push(containerId);
        if (!firstBad) firstBad = qty;
      }
    });
  };

  (mode === "kg" ? kgContainers : ratioContainers).forEach(validateMaterialContainer);

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

  const kgBreakdown = {
    cement: readMaterialRows("cement-kg-container"),
    water: readMaterialRows("water-kg-container"),
    fine: readMaterialRows("fine-kg-container"),
    medium: readMaterialRows("medium-kg-container"),
    coarse: readMaterialRows("coarse-kg-container"),
  };

  const ratioBreakdown = {
    cement: readMaterialRows("cement-ratio-container"),
    water: readMaterialRows("water-ratio-container"),
    fine: readMaterialRows("fine-ratio-container"),
    medium: readMaterialRows("medium-ratio-container"),
    coarse: readMaterialRows("coarse-ratio-container"),
  };

  const cementContent = sumQty(kgBreakdown.cement);
  const waterContent = sumQty(kgBreakdown.water);
  const fineAgg = sumQty(kgBreakdown.fine);
  const mediumAgg = sumQty(kgBreakdown.medium);
  const coarseAgg = sumQty(kgBreakdown.coarse);

  const ratioCement = sumQty(ratioBreakdown.cement) || 1;
  const ratioFine = sumQty(ratioBreakdown.fine);
  const ratioMedium = sumQty(ratioBreakdown.medium);
  const ratioCoarse = sumQty(ratioBreakdown.coarse);
  const ratioWater = sumQty(ratioBreakdown.water);

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

    kgBreakdown,
    ratioBreakdown,

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

  const setMaterialContainer = (containerId, rows, fallbackTotal) => {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = "";
    if (Array.isArray(rows) && rows.length) {
      rows.forEach((x) =>
        c.appendChild(
          createMaterialRow({
            mode: containerId.includes("-ratio-") ? "ratio" : "kg",
            data: x,
          })
        )
      );
      return;
    }
    // legacy fallback: one row with total
    if (typeof fallbackTotal !== "undefined" && fallbackTotal !== null && fallbackTotal !== "") {
      c.appendChild(
        createMaterialRow({
          mode: containerId.includes("-ratio-") ? "ratio" : "kg",
          data: { desc: "", qty: fallbackTotal },
        })
      );
    } else {
      c.appendChild(
        createMaterialRow({
          mode: containerId.includes("-ratio-") ? "ratio" : "kg",
          data: {},
        })
      );
    }
  };

  const kgB = r.kgBreakdown || {};
  setMaterialContainer("cement-kg-container", kgB.cement, r.cementContent);
  setMaterialContainer("water-kg-container", kgB.water, r.waterContent);
  setMaterialContainer("fine-kg-container", kgB.fine, r.fineAgg);
  setMaterialContainer("medium-kg-container", kgB.medium, r.mediumAgg);
  setMaterialContainer("coarse-kg-container", kgB.coarse, r.coarseAgg);

  const rb = r.ratioBreakdown || {};
  setMaterialContainer("cement-ratio-container", rb.cement, r.ratioCement ?? 1);
  setMaterialContainer("fine-ratio-container", rb.fine, r.ratioFine);
  setMaterialContainer("medium-ratio-container", rb.medium, r.ratioMedium);
  setMaterialContainer("coarse-ratio-container", rb.coarse, r.ratioCoarse);
  setMaterialContainer("water-ratio-container", rb.water, r.ratioWater);

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
    const printLines = (title, total, rows) => {
      doc.text(`${title}: ${total}`, margin, y);
      y += 14;
      const cleanRows = (rows || []).filter(
        (r) =>
          (r?.desc || "").trim() ||
          (typeof r?.qty === "number" && !isNaN(r.qty))
      );
      // Only print breakdown when there is useful detail
      if (cleanRows.length > 1 || cleanRows.some((r) => (r.desc || "").trim())) {
        cleanRows.forEach((r) => {
          const d = (r.desc || "").trim() ? ` – ${r.desc.trim()}` : "";
          doc.text(`   • ${r.qty ?? ""}${d}`, margin, y);
          y += 14;
        });
      }
    };

    printLines("Cement", data.cementContent, data.kgBreakdown?.cement);
    printLines("Water", data.waterContent, data.kgBreakdown?.water);
    printLines("Fine Aggregate", data.fineAgg, data.kgBreakdown?.fine);
    printLines("Medium Aggregate", data.mediumAgg, data.kgBreakdown?.medium);
    printLines("Coarse Aggregate", data.coarseAgg, data.kgBreakdown?.coarse);
  } else {
    const printLines = (title, total, rows) => {
      doc.text(`${title}: ${total}`, margin, y);
      y += 14;
      const cleanRows = (rows || []).filter(
        (r) =>
          (r?.desc || "").trim() ||
          (typeof r?.qty === "number" && !isNaN(r.qty))
      );
      if (cleanRows.length > 1 || cleanRows.some((r) => (r.desc || "").trim())) {
        cleanRows.forEach((r) => {
          const d = (r.desc || "").trim() ? ` – ${r.desc.trim()}` : "";
          doc.text(`   • ${r.qty ?? ""}${d}`, margin, y);
          y += 14;
        });
      }
    };

    printLines("Cement", data.ratioCement, data.ratioBreakdown?.cement);
    printLines("Fine Aggregate", data.ratioFine, data.ratioBreakdown?.fine);
    printLines("Medium Aggregate", data.ratioMedium, data.ratioBreakdown?.medium);
    printLines("Coarse Aggregate", data.ratioCoarse, data.ratioBreakdown?.coarse);
    printLines("Water", data.ratioWater, data.ratioBreakdown?.water);
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
  const notesLines = doc.splitTextToSize(data.notes || "", pageW - margin * 2);
  doc.text(notesLines, margin, y);

  const filename = `${sanitizeFilename(data.studentName || "Student")}_${sanitizeFilename(
    data.thesisTitle || "ResearchMix"
  )}.pdf`;
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
    "KgBreakdown",
    "RatioBreakdown",
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
      JSON.stringify(r.kgBreakdown || {}),
      JSON.stringify(r.ratioBreakdown || {}),
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

    setStatusLine("Submitted successfully.", "success");
  } else {
    setStatusLine("Saved locally and PDF generated, but could not submit to server.", "error");
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

  // Reset dynamic materials
  const materialContainers = [
    "cement-kg-container",
    "water-kg-container",
    "fine-kg-container",
    "medium-kg-container",
    "coarse-kg-container",
    "cement-ratio-container",
    "water-ratio-container",
    "fine-ratio-container",
    "medium-ratio-container",
    "coarse-ratio-container",
  ];
  materialContainers.forEach((id) => {
    const c = $(id);
    if (c) c.innerHTML = "";
  });

  // Defaults after clearing
  $("cement-kg-container")?.appendChild(createMaterialRow({ mode: "kg", kind: "cement" }));
  $("water-kg-container")?.appendChild(createMaterialRow({ mode: "kg", kind: "water" }));
  $("fine-kg-container")?.appendChild(createMaterialRow({ mode: "kg", kind: "fine" }));
  $("medium-kg-container")?.appendChild(createMaterialRow({ mode: "kg", kind: "medium" }));
  $("coarse-kg-container")?.appendChild(createMaterialRow({ mode: "kg", kind: "coarse" }));

  $("cement-ratio-container")?.appendChild(createMaterialRow({ mode: "ratio", kind: "cement", data: { qty: 1 } }));
  $("water-ratio-container")?.appendChild(createMaterialRow({ mode: "ratio", kind: "water" }));
  $("fine-ratio-container")?.appendChild(createMaterialRow({ mode: "ratio", kind: "fine" }));
  $("medium-ratio-container")?.appendChild(createMaterialRow({ mode: "ratio", kind: "medium" }));
  $("coarse-ratio-container")?.appendChild(createMaterialRow({ mode: "ratio", kind: "coarse" }));

  $("wcRatioValue").textContent = "0.00";
  $("mixRatioValue").textContent = "–";
  syncInputModeUI();
  syncConcreteTypeOther();
  syncCementTypeOther();
  $("admixtures-container").innerHTML = "";
  $("scms-container").innerHTML = "";
  updateWCRatioFromKg();
  updateMixRatioFromKg();
  updateWcAndMixFromRatio();
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

  $("add-admixture-btn").onclick = () =>
    $("admixtures-container").appendChild(createAdmixtureRow());
  $("add-scm-btn").onclick = () =>
    $("scms-container").appendChild(createScmRow());

  // Material dynamic rows (Kg/m³ + Ratios)
  const materialBtnMap = [
    ["add-cement-kg-btn", "cement-kg-container", { mode: "kg", kind: "cement" }],
    ["add-water-kg-btn", "water-kg-container", { mode: "kg", kind: "water" }],
    ["add-fine-kg-btn", "fine-kg-container", { mode: "kg", kind: "fine" }],
    ["add-medium-kg-btn", "medium-kg-container", { mode: "kg", kind: "medium" }],
    ["add-coarse-kg-btn", "coarse-kg-container", { mode: "kg", kind: "coarse" }],

    ["add-cement-ratio-btn", "cement-ratio-container", { mode: "ratio", kind: "cement" }],
    ["add-water-ratio-btn", "water-ratio-container", { mode: "ratio", kind: "water" }],
    ["add-fine-ratio-btn", "fine-ratio-container", { mode: "ratio", kind: "fine" }],
    ["add-medium-ratio-btn", "medium-ratio-container", { mode: "ratio", kind: "medium" }],
    ["add-coarse-ratio-btn", "coarse-ratio-container", { mode: "ratio", kind: "coarse" }],
  ];

  materialBtnMap.forEach(([btnId, containerId, cfg]) => {
    const btn = $(btnId);
    const container = $(containerId);
    if (!btn || !container) return;
    btn.onclick = () => container.appendChild(createMaterialRow({ ...cfg }));
  });

  // Ensure at least one row exists per container on first load
  const ensureOneRow = (containerId, cfg, seed) => {
    const c = $(containerId);
    if (!c) return;
    if (!c.querySelector(".dynamic-row")) {
      c.appendChild(createMaterialRow({ ...cfg, data: seed || {} }));
    }
  };

  // Kg defaults
  ensureOneRow("cement-kg-container", { mode: "kg", kind: "cement" });
  ensureOneRow("water-kg-container", { mode: "kg", kind: "water" });
  ensureOneRow("fine-kg-container", { mode: "kg", kind: "fine" });
  ensureOneRow("medium-kg-container", { mode: "kg", kind: "medium" });
  ensureOneRow("coarse-kg-container", { mode: "kg", kind: "coarse" });

  // Ratio defaults (cement starts at 1)
  ensureOneRow("cement-ratio-container", { mode: "ratio", kind: "cement" }, { desc: "", qty: 1 });
  ensureOneRow("fine-ratio-container", { mode: "ratio", kind: "fine" });
  ensureOneRow("medium-ratio-container", { mode: "ratio", kind: "medium" });
  ensureOneRow("coarse-ratio-container", { mode: "ratio", kind: "coarse" });
  ensureOneRow("water-ratio-container", { mode: "ratio", kind: "water" });

  $("modeKg").addEventListener("change", syncInputModeUI);
  $("modeRatio").addEventListener("change", syncInputModeUI);
  syncInputModeUI();

  $("concreteType").addEventListener("change", syncConcreteTypeOther);
  $("cementType").addEventListener("change", syncCementTypeOther);
  syncConcreteTypeOther();
  syncCementTypeOther();

  // Initialize derived displays
  updateWCRatioFromKg();
  updateMixRatioFromKg();
  updateWcAndMixFromRatio();

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
