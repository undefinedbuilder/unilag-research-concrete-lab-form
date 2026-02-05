import { google } from "googleapis";

const SHEET_ID = process.env.SHEET_ID;

const SHEETS = {
  MASTER_RATIO: ["Research Master Sheet - Ratio", "Research Master Sheet - ratio", "Master Sheet - Ratio"],
  MASTER_KG: ["Research Master Sheet - Kg/m3", "Research Master Sheet - kg/m3", "Master Sheet - Kg/m3", "Master Sheet - kg/m3"],
  FINE: ["Research Fine Aggregates", "Research Fine Aggregate", "Fine Aggregates", "Research Fine aggregates"],
  COARSE: ["Research Coarse Aggregates", "Research Coarse Aggregate", "Coarse Aggregates", "Research Coarse aggregates"],
  ADMIX: ["Research Admixtures", "Admixtures", "Research Admixture"],
  SCMS: ["Research SCMs", "SCMs", "Research SCM", "Research Scms"],
};

const PREFIX = {
  ratio: "UNILAG-CLR",
  kg: "UNILAG-CLK",
};

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

function normalizeMode(inputMode) {
  const m = safeStr(inputMode).trim().toLowerCase();
  if (m === "ratio") return "ratio";
  if (m === "kg" || m === "kgm3" || m === "kg/m3" || m === "kgm^3") return "kg";
  return "";
}

function pad5(n) {
  return String(n).padStart(5, "0");
}

function toNumberAlpha(str) {
  let num = 0;
  for (const ch of str) {
    const c = ch.charCodeAt(0) - 64;
    num = num * 26 + c;
  }
  return num;
}

function toLetters(num) {
  let s = "";
  while (num > 0) {
    const rem = (num - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
}

function nextLetter(letter) {
  const current = (letter || "A").toUpperCase();
  return toLetters(toNumberAlpha(current) + 1);
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

function isoNow() {
  return new Date().toISOString();
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function buildAuth() {
  const rawCreds = process.env.GOOGLE_SERVICE_CREDENTIALS;

  if (rawCreds) {
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

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error("Missing Google credentials env vars");
  }

  privateKey = privateKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function sheetsClient(auth) {
  return google.sheets({ version: "v4", auth });
}

function normName(s) {
  return safeStr(s).toLowerCase().replace(/\s+/g, " ").trim();
}

function quoteSheetName(name) {
  const n = safeStr(name);
  return `'${n.replace(/'/g, "''")}'`;
}

async function getSheetTitleMap(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const titles = (meta.data.sheets || [])
    .map((s) => s.properties?.title)
    .filter(Boolean);

  const map = new Map();
  for (const t of titles) {
    map.set(normName(t), t);
  }
  return map;
}

function pickSheetTitle(candidates, titleMap) {
  for (const c of candidates) {
    const hit = titleMap.get(normName(c));
    if (hit) return hit;
  }
  return "";
}

async function getColumnAValues(sheets, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${quoteSheetName(sheetName)}!A:A`,
  });
  return res.data.values || [];
}

async function getNextRecordIdFromMaster(sheets, masterSheetName, mode) {
  const col = await getColumnAValues(sheets, masterSheetName);
  let last = "";

  for (let i = col.length - 1; i >= 1; i--) {
    const v = safeStr(col[i]?.[0]).trim();
    if (v) {
      last = v;
      break;
    }
  }

  if (!last) return makeRecordId(mode, "A", 1);

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

async function appendRows(sheets, sheetName, rows) {
  if (!rows.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${quoteSheetName(sheetName)}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, message: "Method not allowed" });
      return;
    }

    if (!SHEET_ID) {
      res.status(500).json({ ok: false, message: "Missing SHEET_ID" });
      return;
    }

    const payload = await readJsonBody(req);
    const mode = normalizeMode(payload.inputMode);

    if (!mode) {
      res.status(400).json({ ok: false, message: "Invalid inputMode" });
      return;
    }

    const auth = buildAuth();
    const sheets = sheetsClient(auth);

    const titleMap = await getSheetTitleMap(sheets);

    const masterSheet =
      mode === "ratio"
        ? pickSheetTitle(SHEETS.MASTER_RATIO, titleMap)
        : pickSheetTitle(SHEETS.MASTER_KG, titleMap);

    if (!masterSheet) {
      res.status(500).json({ ok: false, message: "Master sheet tab not found" });
      return;
    }

    const fineSheet = pickSheetTitle(SHEETS.FINE, titleMap);
    const coarseSheet = pickSheetTitle(SHEETS.COARSE, titleMap);
    const admixtureSheet = pickSheetTitle(SHEETS.ADMIX, titleMap);
    const scmsSheet = pickSheetTitle(SHEETS.SCMS, titleMap);

    const recordId = await getNextRecordIdFromMaster(sheets, masterSheet, mode);
    const timestamp = isoNow();

    const wcValue = mode === "ratio" ? safeNum(payload.ratioWater) : safeNum(payload.wcRatio);

    const masterRow = [
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
      safeNum(payload.cementContent),
      safeNum(payload.waterContent),
      wcValue,
      safeStr(payload.mixRatioString),
      safeStr(payload.notes),
    ];

    await appendRows(sheets, masterSheet, [masterRow]);

    const commonA = recordId;
    const commonB = timestamp;
    const commonC = safeStr(payload.studentName);
    const commonD = safeStr(payload.matricNumber);

    const fineAggregates = Array.isArray(payload.fineAggregates) ? payload.fineAggregates : [];
    if (fineSheet) {
      const rows = fineAggregates
        .filter((a) => safeStr(a?.name).trim() || safeStr(a?.qty).trim() || safeStr(a?.unit).trim())
        .map((a) => [
          commonA,
          commonB,
          commonC,
          commonD,
          safeStr(a?.rowNo),
          safeStr(a?.name),
          safeStr(a?.qty),
          safeStr(a?.unit),
        ]);
      await appendRows(sheets, fineSheet, rows);
    }

    const coarseAggregates = Array.isArray(payload.coarseAggregates) ? payload.coarseAggregates : [];
    if (coarseSheet) {
      const rows = coarseAggregates
        .filter((a) => safeStr(a?.name).trim() || safeStr(a?.qty).trim() || safeStr(a?.unit).trim())
        .map((a) => [
          commonA,
          commonB,
          commonC,
          commonD,
          safeStr(a?.rowNo),
          safeStr(a?.name),
          safeStr(a?.qty),
          safeStr(a?.unit),
        ]);
      await appendRows(sheets, coarseSheet, rows);
    }

    const admixtures = Array.isArray(payload.admixtures) ? payload.admixtures : [];
    if (admixtureSheet) {
      const rows = admixtures
        .filter((a) => safeStr(a?.name).trim() || safeStr(a?.dosage).trim())
        .map((a, idx) => [
          commonA,
          commonB,
          commonC,
          commonD,
          idx + 1,
          safeStr(a?.name),
          safeStr(a?.dosage),
        ]);
      await appendRows(sheets, admixtureSheet, rows);
    }

    const scms = Array.isArray(payload.scms) ? payload.scms : [];
    if (scmsSheet) {
      const rows = scms
        .filter((s) => safeStr(s?.name).trim() || safeStr(s?.percent).trim())
        .map((s, idx) => [
          commonA,
          commonB,
          commonC,
          commonD,
          idx + 1,
          safeStr(s?.name),
          safeStr(s?.percent),
        ]);
      await appendRows(sheets, scmsSheet, rows);
    }

    res.status(200).json({ ok: true, recordId, timestamp });
  } catch (err) {
    res.status(500).json({ ok: false, message: err?.message || "Server error" });
  }
}
