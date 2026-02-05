import { google } from "googleapis";

const SHEET_RATIO_CANDIDATES = ["Research Master Sheet - Ratio", "Client Master Sheet - Ratio"];
const SHEET_KGM3_CANDIDATES = ["Research Master Sheet - Kg/m3", "Client Master Sheet - kg/m3", "Client Master Sheet - Kg/m3"];

const SHEET_FINE_CANDIDATES = ["Research Fine Aggregates", "Client Fine Aggregates"];
const SHEET_COARSE_CANDIDATES = ["Research Coarse Aggregates", "Client Coarse Aggregates"];
const SHEET_ADMIXTURES_CANDIDATES = ["Research Admixtures", "Client Admixtures"];
const SHEET_SCMS_CANDIDATES = ["Research SCMs", "Client SCMs"];

function isMissing(v) {
  return v === undefined || v === null || String(v).trim() === "";
}

function normalizeMode(m) {
  const s = String(m || "").trim().toLowerCase();
  if (s === "ratio") return "ratio";
  if (s === "kg" || s === "kgm3" || s === "kg/m3" || s === "kgm^3" || s === "kgm-3") return "kgm3";
  return "";
}

function nextRecordId(lastId, prefix) {
  if (!lastId) return `${prefix}-000001`;
  const match = String(lastId).trim().match(new RegExp(`^${prefix}-(\\d{6})$`));
  if (!match) return `${prefix}-000001`;
  const n = parseInt(match[1], 10) + 1;
  return `${prefix}-${String(n).padStart(6, "0")}`;
}

async function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_CREDENTIALS;
  if (isMissing(process.env.SHEET_ID) || isMissing(raw)) {
    throw new Error("Missing env vars");
  }
  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error("Invalid GOOGLE_SERVICE_CREDENTIALS");
  }
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function listSheets(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tabs = (meta.data.sheets || []).map((s) => s.properties?.title).filter(Boolean);
  return new Set(tabs);
}

function pickExistingSheet(candidates, sheetSet) {
  for (const name of candidates) {
    if (sheetSet.has(name)) return name;
  }
  return "";
}

async function getLastRecordId(sheets, spreadsheetId, sheetName, prefix) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`,
  });

  const values = res.data.values || [];
  for (let i = values.length - 1; i >= 1; i--) {
    const v = values[i]?.[0];
    if (!isMissing(v) && String(v).trim().startsWith(prefix)) return String(v).trim();
  }
  return "";
}

async function appendRows(sheets, spreadsheetId, sheetName, rows) {
  if (!rows.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const mode = normalizeMode(body.inputMode);

    if (!mode) {
      return res.status(400).json({ success: false, message: "Invalid inputMode" });
    }

    const spreadsheetId = process.env.SHEET_ID;

    const auth = await getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const sheetSet = await listSheets(sheets, spreadsheetId);

    const masterSheet =
      mode === "kgm3"
        ? pickExistingSheet(SHEET_KGM3_CANDIDATES, sheetSet)
        : pickExistingSheet(SHEET_RATIO_CANDIDATES, sheetSet);

    if (!masterSheet) {
      return res.status(500).json({ success: false, message: "Master sheet tab not found" });
    }

    const fineSheet = pickExistingSheet(SHEET_FINE_CANDIDATES, sheetSet);
    const coarseSheet = pickExistingSheet(SHEET_COARSE_CANDIDATES, sheetSet);
    const admixtureSheet = pickExistingSheet(SHEET_ADMIXTURES_CANDIDATES, sheetSet);
    const scmsSheet = pickExistingSheet(SHEET_SCMS_CANDIDATES, sheetSet);

    const prefix = mode === "kgm3" ? "UNILAG-CLK" : "UNILAG-CLR";
    const lastId = await getLastRecordId(sheets, spreadsheetId, masterSheet, prefix);
    const recordId = nextRecordId(lastId, prefix);
    const timestamp = new Date().toISOString();

    const wcRatio = body.wcRatio ?? "";
    const mixRatioString = body.mixRatioString ?? "";

    const masterRow = [
      recordId,
      timestamp,
      body.inputMode ?? "",
      body.studentName ?? "",
      body.matricNumber ?? "",
      body.studentPhone ?? "",
      body.programme ?? "",
      body.supervisorName ?? "",
      body.thesisTitle ?? "",
      body.crushDate ?? "",
      body.concreteType ?? "",
      body.cementType ?? "",
      body.slump ?? "",
      body.ageDays ?? "",
      body.cubesCount ?? "",
      body.targetStrength ?? "",
      body.cementContent ?? "",
      body.waterContent ?? "",
      body.fineAgg ?? "",
      body.coarseAgg ?? "",
      body.ratioCement ?? "",
      body.ratioFine ?? "",
      body.ratioCoarse ?? "",
      body.ratioWater ?? "",
      wcRatio,
      mixRatioString,
      body.notes ?? "",
    ];

    await appendRows(sheets, spreadsheetId, masterSheet, [masterRow]);

    const fineAggregates = Array.isArray(body.fineAggregates) ? body.fineAggregates : [];
    const coarseAggregates = Array.isArray(body.coarseAggregates) ? body.coarseAggregates : [];
    const admixtures = Array.isArray(body.admixtures) ? body.admixtures : [];
    const scms = Array.isArray(body.scms) ? body.scms : [];

    if (fineSheet) {
      const rows = fineAggregates
        .filter((a) => !isMissing(a?.name) || !isMissing(a?.qty))
        .map((a) => [recordId, body.inputMode ?? "", a?.rowNo ?? "", a?.name ?? "", a?.qty ?? "", a?.unit ?? ""]);
      await appendRows(sheets, spreadsheetId, fineSheet, rows);
    }

    if (coarseSheet) {
      const rows = coarseAggregates
        .filter((a) => !isMissing(a?.name) || !isMissing(a?.qty))
        .map((a) => [recordId, body.inputMode ?? "", a?.rowNo ?? "", a?.name ?? "", a?.qty ?? "", a?.unit ?? ""]);
      await appendRows(sheets, spreadsheetId, coarseSheet, rows);
    }

    if (admixtureSheet) {
      const rows = admixtures
        .filter((a) => !isMissing(a?.name) || !isMissing(a?.dosage))
        .map((a, idx) => [recordId, body.inputMode ?? "", idx + 1, a?.name ?? "", a?.dosage ?? ""]);
      await appendRows(sheets, spreadsheetId, admixtureSheet, rows);
    }

    if (scmsSheet) {
      const rows = scms
        .filter((s) => !isMissing(s?.name) || !isMissing(s?.percent))
        .map((s, idx) => [recordId, body.inputMode ?? "", idx + 1, s?.name ?? "", s?.percent ?? ""]);
      await appendRows(sheets, spreadsheetId, scmsSheet, rows);
    }

    return res.status(200).json({ success: true, recordId, timestamp });
  } catch (e) {
    return res.status(500).json({ success: false, message: e?.message || "Server error" });
  }
}
