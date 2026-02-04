const { google } = require("googleapis");

const SHEET_ID = process.env.SHEET_ID;

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

function nextLetter(letter) {
  const toNumber = (str) => {
    let num = 0;
    for (const ch of str) {
      const c = ch.charCodeAt(0) - 64;
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

function parseRecordId(mode, recordId) {
  const pref = mode === "ratio" ? PREFIX.ratio : PREFIX.kg;
  const s = safeStr(recordId).trim().toUpperCase();
  const re = new RegExp(`^${pref.replace(/[-/\\^$*+?.()|[\\]{}]/g, "\\$&")}-([A-Z]+)(\\d{5})$`);
  const m = s.match(re);
  if (!m) return null;
  return { letter: m[1], number: parseInt(m[2], 10) };
}

function incrementLetterNumber(letter, number) {
  let l = (letter || "A").toUpperCase();
  let n = Number(number) || 1;

  n += 1;
  if (n > 99999) {
    n = 1;
    l = nextLetter(l);
  }
  return { letter: l, number: n };
}

function getGoogleAuth() {
  const rawCreds = process.env.GOOGLE_SERVICE_CREDENTIALS;

  if (!SHEET_ID || !rawCreds) {
    throw new Error("Missing env vars. Ensure SHEET_ID and GOOGLE_SERVICE_CREDENTIALS are set.");
  }

  let credentials;
  try {
    credentials = JSON.parse(rawCreds);
  } catch {
    throw new Error("Invalid GOOGLE_SERVICE_CREDENTIALS JSON");
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient(auth) {
  return google.sheets({ version: "v4", auth });
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

async function getNextRecordIdFromMaster(sheets, mode) {
  const masterName = mode === "ratio" ? SHEETS.MASTER_RATIO : SHEETS.MASTER_KG;

  const colRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${masterName}!A:A`,
  });

  const col = colRes.data.values || [];
  let last = "";
  for (let i = col.length - 1; i >= 1; i--) {
    const v = safeStr(col[i]?.[0]).trim();
    if (v) {
      last = v;
      break;
    }
  }

  if (!last) {
    return makeRecordId(mode, "A", 1);
  }

  const parsed = parseRecordId(mode, last);
  if (!parsed) {
    for (let i = col.length - 1; i >= 1; i--) {
      const v = safeStr(col[i]?.[0]).trim();
      const p = parseRecordId(mode, v);
      if (p) {
        const next = incrementLetterNumber(p.letter, p.number);
        return makeRecordId(mode, next.letter, next.number);
      }
    }
    return makeRecordId(mode, "A", 1);
  }

  const next = incrementLetterNumber(parsed.letter, parsed.number);
  return makeRecordId(mode, next.letter, next.number);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, message: "Method not allowed" });
      return;
    }

    const payload = await readJsonBody(req);
    const mode = normalizeMode(payload.inputMode);

    if (!mode) {
      res.status(400).json({ ok: false, message: "Invalid inputMode. Use 'kg' or 'ratio'." });
      return;
    }

    const requiredCommon = [
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

    for (const k of requiredCommon) {
      if (!safeStr(payload[k]).trim()) {
        res.status(400).json({ ok: false, message: `Missing required field: ${k}` });
        return;
      }
    }

    if (mode === "kg") {
      if (safeStr(payload.cementContent).trim() === "") {
        res.status(400).json({ ok: false, message: "Missing required field: cementContent" });
        return;
      }
      if (safeStr(payload.waterContent).trim() === "") {
        res.status(400).json({ ok: false, message: "Missing required field: waterContent" });
        return;
      }
    } else {
      if (safeStr(payload.ratioCement).trim() === "") {
        res.status(400).json({ ok: false, message: "Missing required field: ratioCement" });
        return;
      }
      if (safeStr(payload.ratioWater).trim() === "") {
        res.status(400).json({ ok: false, message: "Missing required field: ratioWater" });
        return;
      }
    }

    const auth = getGoogleAuth();
    const sheets = getSheetsClient(auth);

    const recordId = await getNextRecordIdFromMaster(sheets, mode);
    const timestamp = isoNow();

    const masterSheet = mode === "ratio" ? SHEETS.MASTER_RATIO : SHEETS.MASTER_KG;

    const masterRow = [
      recordId,
      timestamp,
      mode,
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
      safeNum(payload.cementContent),
      safeNum(payload.waterContent),
      safeNum(payload.fineAgg),
      safeNum(payload.coarseAgg),
      safeNum(payload.ratioCement),
      safeNum(payload.ratioFine),
      safeNum(payload.ratioCoarse),
      safeNum(payload.ratioWater),
      safeNum(payload.wcRatio),
      safeStr(payload.mixRatioString),
      safeStr(payload.notes),
    ];

    await appendRows(sheets, masterSheet, [masterRow]);

    const fineAggregates = Array.isArray(payload.fineAggregates) ? payload.fineAggregates : [];
    const fineRows = fineAggregates
      .filter((a) => safeStr(a.name).trim() !== "" || safeStr(a.qty).trim() !== "")
      .map((a) => [
        recordId,
        mode,
        safeStr(a.rowNo),
        safeStr(a.name),
        safeStr(a.qty),
        safeStr(a.unit),
      ]);
    await appendRows(sheets, SHEETS.FINE, fineRows);

    const coarseAggregates = Array.isArray(payload.coarseAggregates) ? payload.coarseAggregates : [];
    const coarseRows = coarseAggregates
      .filter((a) => safeStr(a.name).trim() !== "" || safeStr(a.qty).trim() !== "")
      .map((a) => [
        recordId,
        mode,
        safeStr(a.rowNo),
        safeStr(a.name),
        safeStr(a.qty),
        safeStr(a.unit),
      ]);
    await appendRows(sheets, SHEETS.COARSE, coarseRows);

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

    res.status(200).json({
      ok: true,
      recordId,
      timestamp,
      mode,
      message: "Saved to Google Sheets.",
    });
  } catch (err) {
    console.error("api/submit error:", err);
    res.status(500).json({ ok: false, message: err.message || "Server error" });
  }
}

module.exports = handler;
