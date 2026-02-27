import { google } from "googleapis";

const SHEET_ID = process.env.SHEET_ID;

const SHEETS = {
  MASTER_RATIO: ["Research Master Sheet - Ratio"],
  MASTER_KG: ["Research Master Sheet - Kg/m3"],
  FINE: ["Research Fine Aggregates", "Research Fine Aggregate", "Fine Aggregates", "Fine Aggregate"],
  COARSE: ["Research Coarse Aggregates", "Research Coarse Aggregate", "Coarse Aggregates", "Coarse Aggregate"],
  ADMIX: ["Research Admixtures"],
  SCMS: ["Research SCMs"],
};

const PREFIX = {
  ratio: "UNILAG-RSH-CLR",
  kg: "UNILAG-RSH-CLK",
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
  if (m === "kg" || m === "kgm3" || m === "kg/m3") return "kg";
  return "";
}

function pad5(n) {
  return String(n).padStart(5, "0");
}

function toNumberAlpha(str) {
  let num = 0;
  for (const ch of str) {
    num = num * 26 + (ch.charCodeAt(0) - 64);
  }
  return num;
}

function toLetters(num) {
  let s = "";
  while (num > 0) {
    const r = (num - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
}

function nextLetter(letter) {
  return toLetters(toNumberAlpha((letter || "A").toUpperCase()) + 1);
}

function makeRecordId(mode, letter, number) {
  return `${PREFIX[mode]}-${letter}${pad5(number)}`;
}

function parseRecordId(mode, recordId) {
  const s = safeStr(recordId).trim().toUpperCase();
  const re = new RegExp(`^${PREFIX[mode]}-([A-Z]+)(\\d{5})$`);
  const m = s.match(re);
  if (!m) return null;
  return { letter: m[1], number: parseInt(m[2], 10) };
}

function incrementLetterNumber(letter, number) {
  let n = number + 1;
  let l = letter;
  if (n > 99999) {
    n = 1;
    l = nextLetter(letter);
  }
  return { letter: l, number: n };
}

function isoNow() {
  return new Date().toISOString();
}

function quote(name) {
  return `'${name.replace(/'/g, "''")}'`;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function buildAuth() {
  const raw = process.env.GOOGLE_SERVICE_CREDENTIALS;
  const creds = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function sheetsClient(auth) {
  return google.sheets({ version: "v4", auth });
}

async function getSheetMap(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const map = new Map();
  (meta.data.sheets || []).forEach((s) => {
    map.set(s.properties.title.toLowerCase(), s.properties.title);
  });
  return map;
}

function pickSheet(candidates, map) {
  for (const c of candidates) {
    const hit = map.get(c.toLowerCase());
    if (hit) return hit;
  }
  return "";
}

async function getNextId(sheets, sheetName, mode) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${quote(sheetName)}!A:A`,
  });

  const rows = res.data.values || [];
  for (let i = rows.length - 1; i >= 1; i--) {
    const p = parseRecordId(mode, rows[i]?.[0]);
    if (p) {
      const n = incrementLetterNumber(p.letter, p.number);
      return makeRecordId(mode, n.letter, n.number);
    }
  }
  return makeRecordId(mode, "A", 1);
}

async function appendRows(sheets, sheet, rows) {
  if (!rows.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${quote(sheet)}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false });
      return;
    }

    const body = await readBody(req);
    const mode = normalizeMode(body.inputMode);
    if (!mode) {
      res.status(400).json({ ok: false });
      return;
    }

    const auth = buildAuth();
    const sheets = sheetsClient(auth);
    const map = await getSheetMap(sheets);

    const master = pickSheet(
      mode === "ratio" ? SHEETS.MASTER_RATIO : SHEETS.MASTER_KG,
      map
    );

    const recordId = await getNextId(sheets, master, mode);
    const ts = isoNow();

    const wcVal = mode === "ratio" ? safeNum(body.ratioWater) : safeNum(body.wcRatio);

    if (mode == "ratio") {
      await appendRows(sheets, master, [[
        recordId,
        ts,
        safeStr(body.studentName),
        safeStr(body.matricNumber),
        safeStr(body.studentPhone),
        safeStr(body.programme),
        safeStr(body.supervisorName),
        safeStr(body.thesisTitle),
        safeStr(body.crushDate),
        safeStr(body.concreteType),
        safeStr(body.cementType),
        safeNum(body.slump),
        safeNum(body.ageDays),
        safeNum(body.cubesCount),
        safeNum(body.targetStrength),
        safeNum(body.cementContent),
        wcVal,
        safeStr(body.mixRatioString),
        safeStr(body.notes),
      ]]);
      
    } else {
      await appendRows(sheets, master, [[
        recordId,
        ts,
        safeStr(body.studentName),
        safeStr(body.matricNumber),
        safeStr(body.studentPhone),
        safeStr(body.programme),
        safeStr(body.supervisorName),
        safeStr(body.thesisTitle),
        safeStr(body.crushDate),
        safeStr(body.concreteType),
        safeStr(body.cementType),
        safeNum(body.slump),
        safeNum(body.ageDays),
        safeNum(body.cubesCount),
        safeNum(body.targetStrength),
        safeNum(body.cementContent),
        safeNum(body.waterContent),
        wcVal,
        safeStr(body.mixRatioString),
        safeStr(body.notes),
      ]]);
    }

    const common = [recordId, ts, safeStr(body.studentName), safeStr(body.matricNumber)];

    const pushList = async (key, sheetKey, mapper) => {
      const arr = Array.isArray(body[key]) ? body[key] : [];
      const sheet = pickSheet(SHEETS[sheetKey], map);
      if (!sheet) return;
      const rows = arr
        .filter(mapper.filter)
        .map(mapper.map);
      await appendRows(sheets, sheet, rows);
    };

    await pushList("fineAggregates", "FINE", {
      filter: (a) => a?.name || a?.qty,
      map: (a) => [...common, a.rowNo, a.name, a.qty, a.unit],
    });

    await pushList("coarseAggregates", "COARSE", {
      filter: (a) => a?.name || a?.qty,
      map: (a) => [...common, a.rowNo, a.name, a.qty, a.unit],
    });

    await pushList("admixtures", "ADMIX", {
      filter: (a) => a?.name || a?.dosage,
      map: (a, i) => [...common, i + 1, a.name, a.dosage],
    });

    await pushList("scms", "SCMS", {
      filter: (a) => a?.name || a?.percent,
      map: (a, i) => [...common, i + 1, a.name, a.percent],
    });

    res.status(200).json({ ok: true, recordId });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
}