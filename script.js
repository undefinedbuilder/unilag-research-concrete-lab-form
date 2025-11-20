/* ------------------------------------------------------------
   1. GLOBAL VARIABLES
------------------------------------------------------------ */
const STORAGE_KEY = "concrete-mixes";   // localStorage key
let logoImage = null;                   // for PDF logo


/* ------------------------------------------------------------
   2. CREATE DYNAMIC ROWS FOR ADMIXTURES & REPLACEMENTS
------------------------------------------------------------ */

// Create a single admixture row
function createAdmixtureRow(data = {}) {
    const row = document.createElement("div");
    row.className = "dynamic-row";

    row.innerHTML = `
        <label>
            <span class="label-line">Admixture Name <span class="required-asterisk">*</span></span>
            <input type="text" placeholder="e.g. CostaMix 200M" name="adm_name" value="${data.name || ''}">
        </label>

        <label>
            <span class="label-line">Type <span class="required-asterisk">*</span></span>
            <input type="text" placeholder="e.g. PCE or Nil" name="adm_type" value="${data.type || ''}">
        </label>

        <label>
            <span class="label-line">Dosage (L/100kg of Cement) <span class="required-asterisk">*</span></span>
            <input type="text" name="adm_dosage" value="${data.dosage || ''}">
        </label>

        <button type="button" class="remove-row-btn">×</button>
    `;

    row.querySelector(".remove-row-btn").onclick = () => row.remove();
    return row;
}

// Create a single SCM replacement row
function createReplacementRow(data = {}) {
    const row = document.createElement("div");
    row.className = "dynamic-row";

    row.innerHTML = `
        <label>
            <span class="label-line">Cement Replacment Name <span class="required-asterisk">*</span></span>
            <input type="text" placeholder="e.g. Fly Ash" name="rep_name" value="${data.name || ''}">
        </label>

        <label>
            <span class="label-line">Percent (%) <span class="required-asterisk">*</span></span>
            <input type="text" name="rep_percent" value="${data.percent || ''}">
        </label>

        <label>
            <span class="label-line">Quantity (kg/m³) <span class="required-asterisk">*</span></span>
            <input type="text" name="rep_quantity" value="${data.quantity || ''}">
        </label>

        <button type="button" class="remove-row-btn">×</button>
    `;

    row.querySelector(".remove-row-btn").onclick = () => row.remove();
    return row;
}

/* ------------------------------------------------------------
   3. WATER–CEMENT RATIO CALCULATION
------------------------------------------------------------ */
function updateWCRatio() {
    const cement = parseFloat(document.getElementById("cementContent").value);
    const water  = parseFloat(document.getElementById("waterContent").value);

    let ratio = 0;

    // Only compute when both values are valid
    if (!isNaN(cement) && cement > 0 && !isNaN(water)) {
        ratio = water / cement;
    }

    document.getElementById("wcRatioValue").textContent = ratio.toFixed(2);
    return ratio;
}


/* ------------------------------------------------------------
   4. VALIDATION – CHECK REQUIRED FIELDS
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

    // Clear old highlights
    document.querySelectorAll(".error").forEach(e => e.classList.remove("error"));

    fields.forEach(id => {
        const el = document.getElementById(id);
        if (!el.value.trim()) {
            el.classList.add("error");
            missing.push(id);
            if (!firstInvalid) firstInvalid = el;
        }
    });

    // Require custom Concrete Type when "Other" is selected
    if (document.getElementById("concreteType").value === "Other") {
    const other = document.getElementById("concreteTypeOther").value.trim();
    if (!other) {
        document.getElementById("concreteTypeOther").classList.add("error");
        missing.push("Custom Concrete Type");
    }
    }

    // Require custom Cement Type when "Other" is selected
    if (document.getElementById("cementType").value === "Other") {
    const other = document.getElementById("cementTypeOther").value.trim();
    if (!other) {
        document.getElementById("cementTypeOther").classList.add("error");
        missing.push("Custom Cement Type");
    }
    }

    // At least one admixture row must have values
    const admFirst = document.querySelector("#admixtures-container .dynamic-row");
    if (admFirst) {
        admFirst.querySelectorAll("input").forEach(inp => {
            if (!inp.value.trim()) {
                inp.classList.add("error");
                missing.push("Admixture field");
            }
        });
    }

    // At least one replacement row must have values
    const repFirst = document.querySelector("#replacements-container .dynamic-row");
    if (repFirst) {
        repFirst.querySelectorAll("input").forEach(inp => {
            if (!inp.value.trim()) {
                inp.classList.add("error");
                missing.push("Replacement field");
            }
        });
    }

    const summary = document.getElementById("form-error-summary");

    if (missing.length > 0) {
        summary.style.display = "block";
        summary.textContent = "Please fill the required fields.";
        firstInvalid.focus();
        return false;
    }

    summary.style.display = "none";
    return true;
}


/* ------------------------------------------------------------
   5. CONVERT FORM DATA INTO A CLEAN OBJECT
------------------------------------------------------------ */
function collectFormData() {
    const admixtures = [];
    const replacements = [];

    // Collect admixtures
    document.querySelectorAll("#admixtures-container .dynamic-row").forEach(row => {
        const name = row.querySelector('input[name="adm_name"]').value.trim();
        const type = row.querySelector('input[name="adm_type"]').value.trim();
        const dosage = row.querySelector('input[name="adm_dosage"]').value.trim();

        if (name || type || dosage) {
            admixtures.push({ name, type, dosage });
        }
    });

    // Collect replacements
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
   6. SAVE TO LOCALSTORAGE
------------------------------------------------------------ */
function saveLocal(mix) {
    let mixes = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    mixes.push(mix);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mixes));
}


/* ------------------------------------------------------------
   7. RENDER SAVED MIX TABLE
------------------------------------------------------------ */
function renderSavedMixes() {
    const mixes = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const body = document.getElementById("mixes-table-body");

    body.innerHTML = "";

    if (mixes.length === 0) {
        body.innerHTML = `<tr><td colspan="6" class="no-data">No mixes saved yet.</td></tr>`;
        return;
    }

    mixes.forEach(m => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${m.applicationNumber}</td>
            <td>${m.studentName}</td>
            <td>${m.concreteType}</td>
            <td>${m.slump}</td>
            <td>${m.wcRatio.toFixed(2)}</td>
            <td>${m.timestamp}</td>
        `;

        body.appendChild(row);
    });
}


/* ------------------------------------------------------------
   8. GENERATE PDF
------------------------------------------------------------ */
async function generatePDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text("UNILAG Concrete Research Mix Summary", 20, 20);

    // Basic fields
    let y = 40;
    const line = txt => { doc.text(txt, 20, y); y += 10; };

    line(`Student: ${data.studentName}`);
    line(`Matric No: ${data.matricNo}`);
    line(`Institution: ${data.institution}`);
    line(`Supervisor: ${data.supervisor}`);
    line(`Project Title: ${data.projectTitle}`);

    y += 5;
    line(`Concrete Type: ${data.concreteType}`);
    line(`Cement Type: ${data.cementType}`);
    line(`Slump: ${data.slump} mm`);
    line(`Age to test: ${data.ageToTestDays} days`);
    line(`Casting Date: ${data.testDate}`);

    y += 5;
    line(`Cement: ${data.cementContent} kg/m³`);
    line(`Water: ${data.waterContent} kg/m³`);
    line(`Water–Cement Ratio: ${data.wcRatio.toFixed(2)}`);
    line(`Fine Agg: ${data.fineAgg} kg/m³`);
    line(`Medium Agg: ${data.mediumAgg} kg/m³`);
    line(`Coarse Agg: ${data.coarseAgg} kg/m³`);

    doc.save(`ConcreteMix_${data.studentName}.pdf`);
}


/* ------------------------------------------------------------
   9. HANDLE FORM SUBMISSION
------------------------------------------------------------ */
async function submitForm(event) {
    event.preventDefault();

    if (!validateForm()) return;

    const data = collectFormData();

    document.getElementById("status-line").textContent = "Saving to server...";

    // Call API
    let response;
    try {
        response = await fetch("/api/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
    } catch {
        document.getElementById("status-line").textContent = "Network error.";
        return;
    }

    const result = await response.json();

    if (!result.success) {
        document.getElementById("status-line").textContent = "Failed to save.";
        return;
    }

    // Add application number
    data.applicationNumber = result.recordId;
    data.timestamp = new Date().toLocaleString();

    // Save locally
    saveLocal(data);
    renderSavedMixes();

    // Generate PDF
    generatePDF(data);

    document.getElementById("status-line").textContent =
        `Saved successfully! App No: ${result.recordId}`;
}


/* ------------------------------------------------------------
   10. INITIAL SETUP (runs when page loads)
------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {

    // Preload logo for PDF
    logoImage = new Image();
    logoImage.src = "unilag-logo.png";

    // Insert initial rows
    document.getElementById("admixtures-container")
        .appendChild(createAdmixtureRow());
    document.getElementById("replacements-container")
        .appendChild(createReplacementRow());

    // Show "Specify Cement Type" when "Other" is selected
    document.getElementById("concreteType").onchange = function () {
    const wrapper = document.getElementById("concreteTypeOtherWrapper");

    if (this.value === "Other") {
        wrapper.style.display = "block";
    } else {
        wrapper.style.display = "none";
        document.getElementById("concreteTypeOther").value = "";
    }
    };

    // Show "Specify Cement Type" when "Other" is selected
    document.getElementById("cementType").onchange = function () {
    const wrapper = document.getElementById("cementTypeOtherWrapper");

    if (this.value === "Other") {
        wrapper.style.display = "block";
    } else {
        wrapper.style.display = "none";
        document.getElementById("cementTypeOther").value = "";
    }
    };

    // Live W/C ratio update
    document.getElementById("cementContent").oninput = updateWCRatio;
    document.getElementById("waterContent").oninput = updateWCRatio;

    // Buttons
    document.getElementById("mix-form").onsubmit = submitForm;

    document.getElementById("add-admixture-btn").onclick = () =>
        document.getElementById("admixtures-container")
            .appendChild(createAdmixtureRow());

    document.getElementById("add-replacement-btn").onclick = () =>
        document.getElementById("replacements-container")
            .appendChild(createReplacementRow());

    document.getElementById("reset-form-btn").onclick = () =>
        document.getElementById("mix-form").reset();

    // Render saved table on load
    renderSavedMixes();

    // Footer year
    document.getElementById("year").textContent = new Date().getFullYear();
});