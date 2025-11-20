/* ------------------------------------------------------------
   GLOBAL CONSTANTS AND SIMPLE HELPERS
------------------------------------------------------------ */
const STORAGE_KEY = "concrete-mixes";
let logoImageDataUrl = null;

function loadImageAsDataURL(path) {
    return fetch(path)
        .then(resp => {
            if (!resp.ok) throw new Error("image load failed");
            return resp.blob();
        })
        .then(blob => new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        }))
        .catch(() => null);
}

function sanitizeFilename(name) {
    return String(name)
        .replace(/[\\/:*?"<>|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function setDateToToday(inputEl) {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    const todayLocal = new Date(Date.now() - tzOffset).toISOString().slice(0, 10);
    inputEl.value = todayLocal;
}


/* ------------------------------------------------------------
   CREATE DYNAMIC ROWS FOR ADMIXTURES AND REPLACEMENTS
------------------------------------------------------------ */
function createAdmixtureRow(data = {}) {
    const row = document.createElement("div");
    row.className = "dynamic-row";

    row.innerHTML = `
        <label>
            <span class="label-line">Admixture Name <span class="required-asterisk">*</span></span>
            <input type="text" placeholder="e.g. CostaMix 200M" name="adm_name" value="${data.name || ""}">
        </label>

        <label>
            <span class="label-line">Type <span class="required-asterisk">*</span></span>
            <input type="text" placeholder="e.g. PCE or Nil" name="adm_type" value="${data.type || ""}">
        </label>

        <label>
            <span class="label-line">Dosage (L/100kg of Cement) <span class="required-asterisk">*</span></span>
            <input type="text" name="adm_dosage" value="${data.dosage || ""}">
        </label>

        <button type="button" class="remove-row-btn">×</button>
    `;

    row.querySelector(".remove-row-btn").onclick = () => row.remove();
    return row;
}

function createReplacementRow(data = {}) {
    const row = document.createElement("div");
    row.className = "dynamic-row";

    row.innerHTML = `
        <label>
            <span class="label-line">Cement Replacment Name <span class="required-asterisk">*</span></span>
            <input type="text" placeholder="e.g. Fly Ash" name="rep_name" value="${data.name || ""}">
        </label>

        <label>
            <span class="label-line">Percent (%) <span class="required-asterisk">*</span></span>
            <input type="text" name="rep_percent" value="${data.percent || ""}">
        </label>

        <label>
            <span class="label-line">Quantity (kg/m³) <span class="required-asterisk">*</span></span>
            <input type="text" name="rep_quantity" value="${data.quantity || ""}">
        </label>

        <button type="button" class="remove-row-btn">×</button>
    `;

    row.querySelector(".remove-row-btn").onclick = () => row.remove();
    return row;
}


/* ------------------------------------------------------------
   WATER–CEMENT RATIO CALCULATION
------------------------------------------------------------ */
function updateWCRatio() {
    const cement = parseFloat(document.getElementById("cementContent").value);
    const water  = parseFloat(document.getElementById("waterContent").value);

    let ratio = 0;

    if (!isNaN(cement) && cement > 0 && !isNaN(water)) {
        ratio = water / cement;
    }

    document.getElementById("wcRatioValue").textContent = ratio.toFixed(2);
    return ratio;
}


/* ------------------------------------------------------------
   VALIDATION
------------------------------------------------------------ */
function validateForm() {
    const fields = [
        "studentName", "matricNo", "institution", "supervisor",
        "projectTitle", "testDate", "concreteType", "cementType",
        "slump", "ageToTestDays", "notes", "cementContent",
        "waterContent", "fineAgg", "mediumAgg", "coarseAgg"
    ];

    let missing = [];
    let firstInvalid = null;

    document.querySelectorAll(".error").forEach(e => e.classList.remove("error"));

    fields.forEach(id => {
        const el = document.getElementById(id);
        if (!el.value.trim()) {
            el.classList.add("error");
            missing.push(id);
            if (!firstInvalid) firstInvalid = el;
        }
    });

    if (document.getElementById("concreteType").value === "Other") {
        const other = document.getElementById("concreteTypeOther").value.trim();
        if (!other) {
            document.getElementById("concreteTypeOther").classList.add("error");
            missing.push("Custom Concrete Type");
            if (!firstInvalid) firstInvalid = document.getElementById("concreteTypeOther");
        }
    }

    if (document.getElementById("cementType").value === "Other") {
        const other = document.getElementById("cementTypeOther").value.trim();
        if (!other) {
            document.getElementById("cementTypeOther").classList.add("error");
            missing.push("Custom Cement Type");
            if (!firstInvalid) firstInvalid = document.getElementById("cementTypeOther");
        }
    }

    const admFirst = document.querySelector("#admixtures-container .dynamic-row");
    if (admFirst) {
        admFirst.querySelectorAll("input").forEach(inp => {
            if (!inp.value.trim()) {
                inp.classList.add("error");
                missing.push("Admixture field");
                if (!firstInvalid) firstInvalid = inp;
            }
        });
    }

    const repFirst = document.querySelector("#replacements-container .dynamic-row");
    if (repFirst) {
        repFirst.querySelectorAll("input").forEach(inp => {
            if (!inp.value.trim()) {
                inp.classList.add("error");
                missing.push("Replacement field");
                if (!firstInvalid) firstInvalid = inp;
            }
        });
    }

    const summary = document.getElementById("form-error-summary");

    if (missing.length > 0) {
        summary.style.display = "block";
        summary.textContent = "Please fill the required fields.";
        if (firstInvalid) firstInvalid.focus();
        return false;
    }

    summary.style.display = "none";
    return true;
}


/* ------------------------------------------------------------
   COLLECT FORM DATA
------------------------------------------------------------ */
function collectFormData() {
    const admixtures = [];
    const replacements = [];

    document.querySelectorAll("#admixtures-container .dynamic-row").forEach(row => {
        const name = row.querySelector('input[name="adm_name"]').value.trim();
        const type = row.querySelector('input[name="adm_type"]').value.trim();
        const dosage = row.querySelector('input[name="adm_dosage"]').value.trim();

        if (name || type || dosage) {
            admixtures.push({ name, type, dosage });
        }
    });

    document.querySelectorAll("#replacements-container .dynamic-row").forEach(row => {
        const name = row.querySelector('input[name="rep_name"]').value.trim();
        const percent = row.querySelector('input[name="rep_percent"]').value.trim();
        const quantity = row.querySelector('input[name="rep_quantity"]').value.trim();

        if (name || percent || quantity) {
            replacements.push({ name, percent, quantity });
        }
    });

    return {
        studentName: document.getElementById("studentName").value.trim(),
        matricNo: document.getElementById("matricNo").value.trim(),
        institution: document.getElementById("institution").value.trim(),
        supervisor: document.getElementById("supervisor").value.trim(),
        projectTitle: document.getElementById("projectTitle").value.trim(),

        testDate: document.getElementById("testDate").value,

        concreteType:
            document.getElementById("concreteType").value === "Other"
                ? document.getElementById("concreteTypeOther").value.trim()
                : document.getElementById("concreteType").value,

        cementType:
            document.getElementById("cementType").value === "Other"
                ? document.getElementById("cementTypeOther").value.trim()
                : document.getElementById("cementType").value,

        slump: Number(document.getElementById("slump").value),
        ageToTestDays: Number(document.getElementById("ageToTestDays").value),

        notes: document.getElementById("notes").value.trim(),

        cementContent: Number(document.getElementById("cementContent").value),
        waterContent: Number(document.getElementById("waterContent").value),
        wcRatio: updateWCRatio(),

        fineAgg: Number(document.getElementById("fineAgg").value),
        mediumAgg: Number(document.getElementById("mediumAgg").value),
        coarseAgg: Number(document.getElementById("coarseAgg").value),

        admixtures,
        replacements
    };
}


/* ------------------------------------------------------------
   LOCAL STORAGE
------------------------------------------------------------ */
function getLocalMixes() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveLocalMixes(mixes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mixes));
}

function saveLocal(mix) {
    const mixes = getLocalMixes();
    mixes.push(mix);
    saveLocalMixes(mixes);
}


/* ------------------------------------------------------------
   RENDER SAVED MIXES AND LOAD BACK INTO FORM
------------------------------------------------------------ */
function renderSavedMixes() {
    const mixes = getLocalMixes();
    const body = document.getElementById("mixes-table-body");

    body.innerHTML = "";

    if (mixes.length === 0) {
        body.innerHTML = `<tr><td colspan="6" class="no-data">No mixes saved yet.</td></tr>`;
        return;
    }

    mixes.forEach((m, index) => {
        const row = document.createElement("tr");
        row.dataset.index = String(index);

        row.innerHTML = `
            <td>${m.applicationNumber || "-"}</td>
            <td>${m.studentName}</td>
            <td>${m.concreteType}</td>
            <td>${m.slump}</td>
            <td>${m.wcRatio.toFixed(2)}</td>
            <td>${m.timestamp}</td>
        `;

        body.appendChild(row);
    });
}

function loadMixIntoForm(mix) {
    document.getElementById("studentName").value = mix.studentName || "";
    document.getElementById("matricNo").value = mix.matricNo || "";
    document.getElementById("institution").value = mix.institution || "";
    document.getElementById("supervisor").value = mix.supervisor || "";
    document.getElementById("projectTitle").value = mix.projectTitle || "";
    document.getElementById("testDate").value = mix.testDate || "";
    document.getElementById("slump").value = mix.slump ?? "";
    document.getElementById("ageToTestDays").value = mix.ageToTestDays ?? "";
    document.getElementById("notes").value = mix.notes || "";

    const concreteSelect = document.getElementById("concreteType");
    const concreteOtherWrapper = document.getElementById("concreteTypeOtherWrapper");
    const concreteOther = document.getElementById("concreteTypeOther");
    if ([...concreteSelect.options].some(o => o.value === mix.concreteType)) {
        concreteSelect.value = mix.concreteType;
        concreteOtherWrapper.style.display = "none";
        concreteOther.value = "";
    } else {
        concreteSelect.value = "Other";
        concreteOtherWrapper.style.display = "block";
        concreteOther.value = mix.concreteType || "";
    }

    const cementSelect = document.getElementById("cementType");
    const cementOtherWrapper = document.getElementById("cementTypeOtherWrapper");
    const cementOther = document.getElementById("cementTypeOther");
    if ([...cementSelect.options].some(o => o.value === mix.cementType)) {
        cementSelect.value = mix.cementType;
        cementOtherWrapper.style.display = "none";
        cementOther.value = "";
    } else {
        cementSelect.value = "Other";
        cementOtherWrapper.style.display = "block";
        cementOther.value = mix.cementType || "";
    }

    document.getElementById("cementContent").value = mix.cementContent ?? "";
    document.getElementById("waterContent").value = mix.waterContent ?? "";
    document.getElementById("fineAgg").value = mix.fineAgg ?? "";
    document.getElementById("mediumAgg").value = mix.mediumAgg ?? "";
    document.getElementById("coarseAgg").value = mix.coarseAgg ?? "";

    const admContainer = document.getElementById("admixtures-container");
    admContainer.innerHTML = "";
    if (mix.admixtures && mix.admixtures.length) {
        mix.admixtures.forEach(a => admContainer.appendChild(createAdmixtureRow(a)));
    } else {
        admContainer.appendChild(createAdmixtureRow());
    }

    const repContainer = document.getElementById("replacements-container");
    repContainer.innerHTML = "";
    if (mix.replacements && mix.replacements.length) {
        mix.replacements.forEach(r => repContainer.appendChild(createReplacementRow(r)));
    } else {
        repContainer.appendChild(createReplacementRow());
    }

    updateWCRatio();
}


/* ------------------------------------------------------------
   PDF GENERATION IN LAB FORMAT
------------------------------------------------------------ */
async function generatePDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "A4" });

    const pageW = 595;
    const pageH = 842;
    const margin = 32;
    const gapX = 12;

    const topY = 40;
    const logoW = 56;
    const logoH = 56;
    const textX = margin + logoW + gapX;
    const textW = pageW - margin - textX;

    let drewLogo = false;
    if (logoImageDataUrl) {
        try {
            doc.addImage(logoImageDataUrl, "PNG", margin, topY, logoW, logoH);
            drewLogo = true;
        } catch {
            drewLogo = false;
        }
    }
    if (!drewLogo) {
        doc.setDrawColor(100);
        doc.rect(margin, topY, logoW, logoH);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("UNILAG", margin + logoW / 2, topY + logoH / 2 + 3, { align: "center" });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("DEPARTMENT OF CIVIL AND ENVIRONMENTAL ENGINEERING", textX, topY + 14, { maxWidth: textW });
    doc.setFontSize(10);
    doc.text("FACULTY OF ENGINEERING", textX, topY + 30, { maxWidth: textW });
    doc.text("CONCRETE LABORATORY (RESEARCH MIX)", textX, topY + 46, { maxWidth: textW });

    doc.setDrawColor(40);
    doc.line(margin, topY + logoH + 10, pageW - margin, topY + logoH + 10);

    const bodyStartY = topY + logoH + 26;
    let y = bodyStartY;
    const lh = 14;
    const leftColX = margin;
    const rightColX = 315;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);

    if (data.applicationNumber) {
        doc.text(`Application Number: ${data.applicationNumber}`, margin, y);
        y += lh;
    }
    doc.text(`Date/Time Generated: ${new Date().toLocaleString()}`, margin, y); y += lh;
    doc.text(`Testing Date: ${data.testDate}`, margin, y); y += lh + 4;

    doc.setFont("helvetica", "bold");
    doc.text("Student & Project Details", leftColX, y); y += lh;
    doc.setFont("helvetica", "normal");
    doc.text(`Student: ${data.studentName}`, leftColX, y); y += lh;
    doc.text(`Matric / Reg. No.: ${data.matricNo}`, leftColX, y); y += lh;
    doc.text(`Institution: ${data.institution}`, leftColX, y); y += lh;
    doc.text(`Supervisor: ${data.supervisor}`, leftColX, y); y += lh;
    doc.text(`Project Title: ${data.projectTitle}`, leftColX, y); y += lh + 4;

    doc.setFont("helvetica", "bold");
    doc.text("Mix Design Overview", leftColX, y); y += lh;
    doc.setFont("helvetica", "normal");
    doc.text(`Concrete Type: ${data.concreteType}`, leftColX, y);
    doc.text(`Cement Type: ${data.cementType}`, rightColX, y); y += lh;
    doc.text(`Slump / Flow (mm): ${data.slump}`, leftColX, y);
    doc.text(`Age to Test (days): ${data.ageToTestDays}`, rightColX, y); y += lh + 4;

    doc.setFont("helvetica", "bold");
    doc.text("Material Quantities (kg/m³)", leftColX, y); y += lh;
    doc.setFont("helvetica", "normal");
    const rows = [
        ["Cement", data.cementContent],
        ["Water", data.waterContent],
        ["Fine Aggregate", data.fineAgg],
        ["Medium Aggregate", data.mediumAgg],
        ["Coarse Aggregate", data.coarseAgg]
    ];
    rows.forEach(([k, v]) => {
        doc.text(`${k}: ${Number(v).toFixed(2)}`, leftColX, y);
        y += lh;
    });
    doc.text(`Derived Water–Cement Ratio: ${data.wcRatio.toFixed(2)}`, leftColX, y); y += lh + 4;

    doc.setFont("helvetica", "bold");
    doc.text("Chemical Admixtures", leftColX, y); y += lh;
    doc.setFont("helvetica", "normal");
    if (data.admixtures && data.admixtures.length) {
        data.admixtures.forEach((a, idx) => {
            const line = `${idx + 1}. ${a.name || ""} | ${a.type || ""} | ${a.dosage || ""}`;
            doc.text(line, leftColX, y);
            y += lh;
        });
    } else {
        doc.text("None specified.", leftColX, y); y += lh;
    }

    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Partial Cement Replacements", leftColX, y); y += lh;
    doc.setFont("helvetica", "normal");
    if (data.replacements && data.replacements.length) {
        data.replacements.forEach((r, idx) => {
            const line = `${idx + 1}. ${r.name || ""} | ${r.percent || ""}% | ${r.quantity || ""} kg/m³`;
            doc.text(line, leftColX, y);
            y += lh;
        });
    } else {
        doc.text("None specified.", leftColX, y); y += lh;
    }

    if (data.notes && data.notes.trim().length > 0) {
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.text("General Notes", leftColX, y); y += lh;
        doc.setFont("helvetica", "normal");
        const wrapped = doc.splitTextToSize(data.notes, pageW - margin * 2);
        doc.text(wrapped, leftColX, y);
        y += wrapped.length * (lh - 2);
    }

    const boxHeight = 78;
    const boxY = pageH - 32 - boxHeight;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setDrawColor(0);
    doc.rect(32, boxY, pageW - 32 * 2, boxHeight);
    doc.text("FOR OFFICE USE ONLY", 40, boxY + 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const line1 = "Recorded Compressive Strength Results: ______________________________";
    const line2 = "Tested on: ____________________";
    const line3 = "Remarks: ___________________________________________________________";
    doc.text(line1, 40, boxY + 34);
    doc.text(line2, 40, boxY + 50);
    doc.text(line3, 40, boxY + 66);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
        "This document was generated electronically by the Concrete Laboratory, University of Lagos (Research Mix Tracker).",
        pageW / 2,
        pageH - 10,
        { align: "center" }
    );

    const student = sanitizeFilename(data.studentName || "Student");
    const date = sanitizeFilename(data.testDate || new Date().toISOString().slice(0, 10));
    doc.save(`${student}_${date}.pdf`);
}


/* ------------------------------------------------------------
   CSV EXPORT AND CLEAR ALL
------------------------------------------------------------ */
function exportCsv() {
    const mixes = getLocalMixes();
    if (!mixes.length) return;

    const headers = [
        "ApplicationNumber",
        "Timestamp",
        "StudentName",
        "MatricNo",
        "Institution",
        "Supervisor",
        "ProjectTitle",
        "TestingDate",
        "ConcreteType",
        "CementType",
        "Slump_mm",
        "AgeToTest_days",
        "Cement_kgm3",
        "Water_kgm3",
        "WCRatio",
        "FineAgg_kgm3",
        "MediumAgg_kgm3",
        "CoarseAgg_kgm3",
        "Admixtures",
        "Replacements",
        "Notes"
    ];

    const lines = [headers.join(",")];

    mixes.forEach(m => {
        const adm = (m.admixtures || [])
            .map((a, i) => `${i + 1}. ${a.name || ""} | ${a.type || ""} | ${a.dosage || ""}`)
            .join(" || ");
        const rep = (m.replacements || [])
            .map((r, i) => `${i + 1}. ${r.name || ""} | ${r.percent || ""}% | ${r.quantity || ""}`)
            .join(" || ");

        const row = [
            m.applicationNumber || "",
            m.timestamp || "",
            m.studentName || "",
            m.matricNo || "",
            m.institution || "",
            m.supervisor || "",
            m.projectTitle || "",
            m.testDate || "",
            m.concreteType || "",
            m.cementType || "",
            m.slump ?? "",
            m.ageToTestDays ?? "",
            m.cementContent ?? "",
            m.waterContent ?? "",
            m.wcRatio ?? "",
            m.fineAgg ?? "",
            m.mediumAgg ?? "",
            m.coarseAgg ?? "",
            adm,
            rep,
            (m.notes || "").replace(/\r?\n/g, " ")
        ].map(v => `"${String(v).replace(/"/g, '""')}"`);

        lines.push(row.join(","));
    });

    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "unilag_research_mixes.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function clearAllMixes() {
    saveLocalMixes([]);
    renderSavedMixes();
}


/* ------------------------------------------------------------
   APPLICATION NUMBER MODAL
------------------------------------------------------------ */
function openModal(appNo) {
    const modal = document.getElementById("appModal");
    const modalNumber = document.getElementById("modalNumber");
    if (!modal || !modalNumber) return;
    modalNumber.textContent = appNo;
    setTimeout(() => modal.classList.remove("hidden"), 80);
}

function closeModal() {
    const modal = document.getElementById("appModal");
    if (!modal) return;
    modal.classList.add("hidden");
}


/* ------------------------------------------------------------
   FORM SUBMISSION
------------------------------------------------------------ */
async function submitForm(event) {
    event.preventDefault();

    if (!validateForm()) return;

    const data = collectFormData();
    const statusLine = document.getElementById("status-line");
    statusLine.textContent = "Saving to server...";

    let response;
    try {
        response = await fetch("/api/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
    } catch {
        statusLine.textContent = "Network error. Please check your connection and try again.";
        return;
    }

    const result = await response.json();

    if (!result.success) {
        statusLine.textContent = "Failed to save to Google Sheets. Please try again.";
        return;
    }

    data.applicationNumber = result.recordId;
    data.timestamp = new Date().toLocaleString();

    saveLocal(data);
    renderSavedMixes();

    if (!logoImageDataUrl) {
        logoImageDataUrl = await loadImageAsDataURL("unilag-logo.png");
    }
    await generatePDF(data);

    openModal(data.applicationNumber);
    statusLine.textContent = `Saved successfully. Application Number: ${data.applicationNumber}`;
}


/* ------------------------------------------------------------
   PAGE INITIALISATION
------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
    const testDateEl = document.getElementById("testDate");
    setDateToToday(testDateEl);

    loadImageAsDataURL("unilag-logo.png").then(d => {
        logoImageDataUrl = d;
    });

    document.getElementById("admixtures-container")
        .appendChild(createAdmixtureRow());
    document.getElementById("replacements-container")
        .appendChild(createReplacementRow());

    document.getElementById("concreteType").onchange = function () {
        const wrapper = document.getElementById("concreteTypeOtherWrapper");
        if (this.value === "Other") {
            wrapper.style.display = "block";
        } else {
            wrapper.style.display = "none";
            document.getElementById("concreteTypeOther").value = "";
        }
    };

    document.getElementById("cementType").onchange = function () {
        const wrapper = document.getElementById("cementTypeOtherWrapper");
        if (this.value === "Other") {
            wrapper.style.display = "block";
        } else {
            wrapper.style.display = "none";
            document.getElementById("cementTypeOther").value = "";
        }
    };

    document.getElementById("cementContent").oninput = updateWCRatio;
    document.getElementById("waterContent").oninput = updateWCRatio;

    document.getElementById("mix-form").onsubmit = submitForm;

    document.getElementById("add-admixture-btn").onclick = () =>
        document.getElementById("admixtures-container")
            .appendChild(createAdmixtureRow());

    document.getElementById("add-replacement-btn").onclick = () =>
        document.getElementById("replacements-container")
            .appendChild(createReplacementRow());

    document.getElementById("reset-form-btn").onclick = () => {
        document.getElementById("mix-form").reset();
        setDateToToday(testDateEl);

        document.getElementById("admixtures-container").innerHTML = "";
        document.getElementById("replacements-container").innerHTML = "";
        document.getElementById("admixtures-container")
            .appendChild(createAdmixtureRow());
        document.getElementById("replacements-container")
            .appendChild(createReplacementRow());
        updateWCRatio();
        document.getElementById("form-error-summary").style.display = "none";
        document.getElementById("status-line").textContent = "";
    };

    document.getElementById("export-csv-btn").onclick = exportCsv;
    document.getElementById("clear-all-btn").onclick = clearAllMixes;

    document.getElementById("mixes-table-body").onclick = (e) => {
        const row = e.target.closest("tr");
        if (!row || row.classList.contains("no-data")) return;
        const idx = row.dataset.index;
        if (idx == null) return;
        const mixes = getLocalMixes();
        const mix = mixes[Number(idx)];
        if (mix) {
            loadMixIntoForm(mix);
            document.getElementById("status-line").textContent =
                `Loaded mix with Application Number: ${mix.applicationNumber || "N/A"}`;
        }
    };

    document.getElementById("modalClose").onclick = closeModal;
    document.getElementById("appModal").addEventListener("click", e => {
        if (e.target === e.currentTarget) closeModal();
    });
    window.addEventListener("keydown", e => {
        if (e.key === "Escape") closeModal();
    });

    renderSavedMixes();

    document.getElementById("year").textContent = new Date().getFullYear();
});