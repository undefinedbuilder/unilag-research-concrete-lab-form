const { google } = require("googleapis");

/** ====== CONFIG ====== */
const SHEET_ID = process.env.SHEET_ID;

const SUBMIT_URL = "/api/submit"; // your frontend calls this path

const SHEETS = {
  MASTER_RATIO: "Research Master Sheet - Ratio",
  MASTER_KG: "Research Master Sheet - Kg/m3",
  FINE: "Research Fine Aggregates",
  COARSE: "Research Coarse Aggregates",
  ADMIX: "Research Admixtures",
  SCMS: "Research SCMs",
};

const PREFIX = {
  ratio: "UNILAG-CLR",
  kg: "UNILAG-CLK",
};

// How many rows of col A to fetch at once when finding the last ID.
// (We read a "tail" window to avoid pulling huge columns in large sheets.)
const LOOKBACK_ROWS = 2000;

/** ====== GOOGLE AUTH ====== */
function getGoogleAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!SHEET_ID || !clientEmail || !privateKey) {
    throw new Error(
      "Missing env vars. Ensure SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY are set."
    );
  }

  privateKey = privateKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient(auth) {
  return google.sheets({ version: "v4", auth });
}

/** ====== UTILITIES ====== */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isoNow() {
  return new Date().toISOString();
}

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

function normalizeMode(inputMode) {
  const m = safeStr(inputMode).toLowerCase();
  if (m === "ratio") return "ratio";
  if (m === "kg" || m === "kg/m3" || m === "kgm3") return "kg";
  return "";
}

function pad5(n) {
  return String(n).padStart(5, "0");
}

// Excel-style letters increment: A->B->...->Z->AA->AB...
function nextLetter(letter) {
  const toNumber = (str) => {
    let num = 0;
    for (const ch of str) {
      const c = ch.charCodeAt(0) - 64; // 'A' => 1
      num = num * 26 + c;
    }
    return num;
  };
  const toLetters = (num) => {
    let s = "";
    while (num > 0) {
      const rem = (num - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      num = Math.floor((num - 1) / 26);
    }
    return s;
  };

  const current = (letter || "A").toUpperCase();
  return toLetters(toNumber(current) + 1);
}

function makeRecordId(mode, letter, number) {
  const pref = mode === "ratio" ? PREFIX.ratio : PREFIX.kg;
  return `${pref}-${letter}${pad5(number)}`;
}

/**
 * Parse IDs like:
 * - UNILAG-CLR-A00001
 * - UNILAG-CLK-A00001
 * Supports multi-letter: UNILAG-CLR-AA00001
 */
function parseRecordId(mode, recordId) {
  const pref = mode === "ratio" ? PREFIX.ratio : PREFIX.kg;
  const s = safeStr(recordId).trim().toUpperCase();

  // expected: PREFIX-LETTERS+5DIGITS
  // e.g. UNILAG-CLR-A00001
  const re = new RegExp(`^${pref.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}-([A-Z]+)(\\d{5})$`);
  const m = s.match(re);
  if (!m) return null;

  return { letter: m[1], number: parseInt(m[2], 10) };
}

/** ====== SHEET SETUP ====== */

async function getSheetIdByName(sheets, title) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: "sheets.properties",
  });

  const found = (meta.data.sheets || []).find(
    (s) => s.properties && s.properties.title === title
  );

  return found ? found.properties.sheetId : null;
}

async function ensureSheetExists(sheets, title, headers) {
  const existingId = await getSheetIdByName(sheets, title);
  if (existingId !== null) return existingId;

  const createRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });

  const newSheetId = createRes.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (newSheetId === undefined) throw new Error(`Failed to create sheet: ${title}`);

  if (Array.isArray(headers) && headers.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${title}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }

  return newSheetId;
}

async function ensureHeadersIfEmpty(sheets, sheetName, headers) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A1:Z1`,
  });

  const row = (res.data.values && res.data.values[0]) || [];
  const empty = row.length === 0 || row.every((c) => safeStr(c).trim() === "");
  if (!empty) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers] },
  });
}

/** ====== APPEND HELPERS ====== */
async function appendRow(sheets, sheetName, rowValues) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [rowValues] },
  });
}

async function appendRows(sheets, sheetName, rows) {
  if (!rows.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

/** ====== ID GENERATION (NO COUNTER SHEET) ======
 * Reads the last application number from master sheet column A and increments it.
 * For efficiency, we fetch a tail window. If the sheet is small, it's enough.
 */
async function getNextRecordIdFromMaster(sheets, mode) {
  const masterName = mode === "ratio" ? SHEETS.MASTER_RATIO : SHEETS.MASTER_KG;

  // 1) Determine last row number (approx) using get spreadsheet values in A:A is heavy,
  // so we use a "tail" window by trying to locate the last filled cell.
  // We’ll do: read A:A and take last non-empty if sheet is not huge (but could be).
  // Better: use Sheets API "values.get" on A:A and take last; it returns only populated rows.
  // That’s okay for moderate size sheets. If your sheet becomes massive, tell me and I’ll optimize further.
  const colRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${masterName}!A:A`,
  });

  const col = colRes.data.values || [];
  // col includes header row at index 0 typically
  // Find last non-empty value from bottom
  let last = "";
  for (let i = col.length - 1; i >= 1; i--) {
    const v = safeStr(col[i]?.[0]).trim();
    if (v) {
      last = v;
      break;
    }
  }

  // If none found, start at A00001
  if (!last) {
    return makeRecordId(mode, "A", 1);
  }

  const parsed = parseRecordId(mode, last);
  if (!parsed) {
    // If column A contains unexpected values, we still try to find the last valid ID by scanning backwards
    for (let i = col.length - 1; i >= 1; i--) {
      const v = safeStr(col[i]?.[0]).trim();
      const p = parseRecordId(mode, v);
      if (p) {
        const next = incrementLetterNumber(p.letter, p.number);
        return makeRecordId(mode, next.letter, next.number);
      }
    }
    // If still nothing parseable:
    return makeRecordId(mode, "A", 1);
  }

  const next = incrementLetterNumber(parsed.letter, parsed.number);
  return makeRecordId(mode, next.letter, next.number);
}

function incrementLetterNumber(letter, number) {
  let nextNum = (Number.isFinite(number) ? number : 0) + 1;
  let nextLet = (letter || "A").toUpperCase() || "A";

  if (nextNum > 99999) {
    nextNum = 1;
    nextLet = nextLetter(nextLet);
  }

  return { letter: nextLet, number: nextNum };
}

/** ====== MAIN HANDLER ====== */
async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, message: "Method not allowed. Use POST." });
      return;
    }

    const payload = req.body || {};
    const mode = normalizeMode(payload.inputMode);

    if (!mode) {
      res.status(400).json({ ok: false, message: "Invalid inputMode. Expected 'ratio' or 'kg'." });
      return;
    }

    const auth = getGoogleAuth();
    const sheets = getSheetsClient(auth);

    // Ensure all sheets exist
    await ensureSheetExists(sheets, SHEETS.MASTER_RATIO);
    await ensureSheetExists(sheets, SHEETS.MASTER_KG);
    await ensureSheetExists(sheets, SHEETS.FINE);
    await ensureSheetExists(sheets, SHEETS.COARSE);
    await ensureSheetExists(sheets, SHEETS.ADMIX);
    await ensureSheetExists(sheets, SHEETS.SCMS);

    // Headers (recommended)
    await ensureHeadersIfEmpty(sheets, SHEETS.MASTER_RATIO, [
      "Application No",
      "Timestamp",
      "Student Name",
      "Matric Number",
      "Student Phone",
      "Programme",
      "Supervisor Name",
      "Thesis Title",
      "Crush Date",
      "Concrete Type",
      "Cement Type",
      "Slump/Flow (mm)",
      "Age (days)",
      "No. of Cubes",
      "Target Strength (MPa)",
      "Ratio Cement",
      "Ratio Water",
      "Mix Ratio",
      "Notes",
    ]);

    await ensureHeadersIfEmpty(sheets, SHEETS.MASTER_KG, [
      "Application No",
      "Timestamp",
      "Student Name",
      "Matric Number",
      "Student Phone",
      "Programme",
      "Supervisor Name",
      "Thesis Title",
      "Crush Date",
      "Concrete Type",
      "Cement Type",
      "Slump/Flow (mm)",
      "Age (days)",
      "No. of Cubes",
      "Target Strength (MPa)",
      "Cement (kg/m3)",
      "Water (kg/m3)",
      "Fine Total (kg/m3)",
      "Coarse Total (kg/m3)",
      "W/C Ratio",
      "Mix Ratio",
      "Notes",
    ]);

    await ensureHeadersIfEmpty(sheets, SHEETS.FINE, [
      "Application No",
      "Mode",
      "Row No",
      "Fine Aggregate Name",
      "Quantity",
      "Unit",
    ]);

    await ensureHeadersIfEmpty(sheets, SHEETS.COARSE, [
      "Application No",
      "Mode",
      "Row No",
      "Coarse Aggregate Name",
      "Quantity",
      "Unit",
    ]);

    await ensureHeadersIfEmpty(sheets, SHEETS.ADMIX, [
      "Application No",
      "Mode",
      "Row No",
      "Admixture Name",
      "Dosage (L/100kg cement)",
    ]);

    await ensureHeadersIfEmpty(sheets, SHEETS.SCMS, [
      "Application No",
      "Mode",
      "Row No",
      "SCM Name",
      "Percent (%)",
    ]);

    // Generate recordId by checking last ID in the MASTER sheet for the selected mode
    // NOTE: if concurrent submissions are common, duplicates can happen.
    const recordId = await getNextRecordIdFromMaster(sheets, mode);
    const timestamp = isoNow();

    /** ====== MASTER SHEET ROW ====== */
    const common = [
      recordId,
      timestamp,
      safeStr(payload.studentName),
      safeStr(payload.matricNumber),
      safeStr(payload.studentPhone),
      safeStr(payload.programme),
      safeStr(payload.supervisorName),
      safeStr(payload.thesisTitle),
      safeStr(payload.crushDate),
      safeStr(payload.concreteType),
      safeStr(payload.cementType),
      safeNum(payload.slump),
      safeNum(payload.ageDays),
      safeNum(payload.cubesCount),
      safeNum(payload.targetStrength),
    ];

    if (mode === "ratio") {
      const masterRatioRow = [
        ...common,
        safeNum(payload.ratioCement || 1),
        safeNum(payload.ratioWater),
        safeStr(payload.mixRatioString),
        safeStr(payload.notes),
      ];
      await appendRow(sheets, SHEETS.MASTER_RATIO, masterRatioRow);
    } else {
      const masterKgRow = [
        ...common,
        safeNum(payload.cementContent),
        safeNum(payload.waterContent),
        safeNum(payload.fineAgg),
        safeNum(payload.coarseAgg),
        safeNum(payload.wcRatio),
        safeStr(payload.mixRatioString),
        safeStr(payload.notes),
      ];
      await appendRow(sheets, SHEETS.MASTER_KG, masterKgRow);
    }

    /** ====== DETAIL SHEETS ======
     * Application No is FIRST column on all sheets.
     */

    // Fine aggregates
    const fineAgg = Array.isArray(payload.fineAggregates) ? payload.fineAggregates : [];
    const fineRows = fineAgg
      .filter((r) => safeStr(r.name).trim() !== "" || safeStr(r.qty).trim() !== "")
      .map((r, idx) => [
        recordId,
        mode,
        safeNum(r.rowNo || idx + 1),
        safeStr(r.name),
        safeStr(r.qty),
        safeStr(r.unit),
      ]);
    await appendRows(sheets, SHEETS.FINE, fineRows);

    // Coarse aggregates
    const coarseAgg = Array.isArray(payload.coarseAggregates) ? payload.coarseAggregates : [];
    const coarseRows = coarseAgg
      .filter((r) => safeStr(r.name).trim() !== "" || safeStr(r.qty).trim() !== "")
      .map((r, idx) => [
        recordId,
        mode,
        safeNum(r.rowNo || idx + 1),
        safeStr(r.name),
        safeStr(r.qty),
        safeStr(r.unit),
      ]);
    await appendRows(sheets, SHEETS.COARSE, coarseRows);

    // Admixtures
    const admixtures = Array.isArray(payload.admixtures) ? payload.admixtures : [];
    const admixtureRows = admixtures
      .filter((a) => safeStr(a.name).trim() !== "" || safeStr(a.dosage).trim() !== "")
      .map((a, idx) => [
        recordId,
        mode,
        idx + 1,
        safeStr(a.name),
        safeStr(a.dosage),
      ]);
    await appendRows(sheets, SHEETS.ADMIX, admixtureRows);

    // SCMs
    const scms = Array.isArray(payload.scms) ? payload.scms : [];
    const scmRows = scms
      .filter((s) => safeStr(s.name).trim() !== "" || safeStr(s.percent).trim() !== "")
      .map((s, idx) => [
        recordId,
        mode,
        idx + 1,
        safeStr(s.name),
        safeStr(s.percent),
      ]);
    await appendRows(sheets, SHEETS.SCMS, scmRows);

    // Respond
    res.status(200).json({
      ok: true,
      recordId,
      timestamp,
      mode,
      message: "Saved to Google Sheets.",
    });
  } catch (err) {
    console.error("submit.js error:", err);
    res.status(500).json({
      ok: false,
      message: err.message || "Server error",
    });
  }
}

/** ====== EXPORT ====== */
// Express:
// app.use(express.json());
// app.post('/api/submit', handler);
module.exports = handler;
