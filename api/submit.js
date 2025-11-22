import { google } from "googleapis";

/* ---------------------- HELPERS ---------------------- */

const REQUIRED_COMMON = [
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

const REQUIRED_KG = [
  "cementContent",
  "waterContent",
  "fineAgg",
  "mediumAgg",
  "coarseAgg",
];

const REQUIRED_RATIO = [
  "ratioCement",
  "ratioFine",
  "ratioMedium",
  "ratioCoarse",
  "ratioWater",
];

const missingField = (body, list) => {
  for (const key of list) {
    const v = body[key];
    if (v === undefined || v === null || String(v).trim() === "") return key;
  }
  return null;
};

const nextRecordId = (lastId, modeLetter) => {
  if (!lastId) return `UNILAG-CL-${modeLetter}000001`;
  const m = lastId.match(/^UNILAG-CL-[KR](\d{6})$/);
  if (!m) return `UNILAG-CL-${modeLetter}000001`;
  const num = (parseInt(m[1]) + 1).toString().padStart(6, "0");
  return `UNILAG-CL-${modeLetter}${num}`;
};

const kgRatioCalc = (c, w, f, m, co) => {
  c = Number(c);
  w = Number(w);
  f = Number(f);
  m = Number(m);
  co = Number(co);

  if (!c || c <= 0 || [w, f, m, co].some((x) => isNaN(x)))
    return { wcRatio: 0, mixRatioString: "" };

  const r = (x) => (x / c).toFixed(2);
  return {
    wcRatio: w / c,
    mixRatioString: `1 : ${r(f)} : ${r(m)} : ${r(co)} : ${r(w)}`,
  };
};

const ratioCalc = (c, f, m, co, w) => {
  c = Number(c);
  f = Number(f);
  m = Number(m);
  co = Number(co);
  w = Number(w);

  if (!c || c <= 0 || [f, m, co, w].some((x) => isNaN(x)))
    return { wcRatio: 0, mixRatioString: "" };

  const r = (x) => (x / c).toFixed(2);
  return {
    wcRatio: w / c,
    mixRatioString: `1 : ${r(f)} : ${r(m)} : ${r(co)} : ${r(w)}`,
  };
};

/* ---------------------- MAIN HANDLER ---------------------- */

export default async function handler(req, res) {
  /* ---------- METHOD CHECK ---------- */
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const body = req.body || {};
  const mode = body.inputMode;

  if (!["kg", "ratio"].includes(mode)) {
    return res.status(400).json({ success: false, message: "Invalid input mode" });
  }

  /* ---------- REQUIRED FIELDS CHECK ---------- */
  let missing = missingField(body, REQUIRED_COMMON);
  if (!missing) {
    missing =
      mode === "kg"
        ? missingField(body, REQUIRED_KG)
        : missingField(body, REQUIRED_RATIO);
  }
  if (missing) {
    return res.status(400).json({
      success: false,
      message: `Missing required field: ${missing}`,
    });
  }

  /* ---------- DESTRUCTURE ---------- */
  const {
    studentName,
    matricNumber,
    studentPhone,
    programme,
    supervisorName,
    thesisTitle,
    crushDate,
    concreteType,
    cementType,
    slump,
    ageDays,
    cubesCount,
    targetStrength,
    notes,
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
  } = body;

  /* ---------- ENVIRONMENT VARIABLES ---------- */
  const sheetId = process.env.SHEET_ID;
  const creds = process.env.GOOGLE_SERVICE_CREDENTIALS;
  if (!sheetId || !creds) {
    return res.status(500).json({
      success: false,
      message: "Server misconfigured: Missing sheet or credentials",
    });
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(creds),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const modeLetter = mode === "kg" ? "K" : "R";
  const mainSheet =
    mode === "kg" ? "Research Sheet (Kg/m3)" : "Research Sheet (Ratios)";

  /* ---------- FIND LAST RECORD ID ---------- */
  let lastId = null;
  try {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${mainSheet}!A:A`,
    });
    const rows = r.data.values || [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const cell = rows[i][0];
      if (cell && typeof cell === "string" && cell.trim()) {
        lastId = cell.trim();
        break;
      }
    }
  } catch (err) {
    console.error("Error reading last recordID:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to read existing records",
    });
  }

  const recordId = nextRecordId(lastId, modeLetter);
  const timestamp = new Date().toISOString();

  /* ---------- COMPUTE RATIOS ---------- */
  let wcRatio = 0;
  let mixRatioString = "";
  if (mode === "kg") {
    ({ wcRatio, mixRatioString } = kgRatioCalc(
      cementContent,
      waterContent,
      fineAgg,
      mediumAgg,
      coarseAgg
    ));
  } else {
    ({ wcRatio, mixRatioString } = ratioCalc(
      ratioCement,
      ratioFine,
      ratioMedium,
      ratioCoarse,
      ratioWater
    ));
  }

  /* ---------- BUILD MAIN ROW ---------- */
  const commonCols = [
    recordId,
    timestamp,
    studentName,
    matricNumber,
    studentPhone,
    programme,
    supervisorName,
    thesisTitle,
    crushDate,
    concreteType,
    cementType,
    slump,
    ageDays,
    cubesCount,
    targetStrength,
  ];

  const mixColsKg = [
    cementContent,
    waterContent,
    fineAgg,
    mediumAgg,
    coarseAgg,
    wcRatio,
    mixRatioString,
    notes,
  ];

  const mixColsRatio = [
    ratioCement,
    ratioFine,
    ratioMedium,
    ratioCoarse,
    ratioWater,
    wcRatio,
    mixRatioString,
    notes,
  ];

  const mainRow = [
    [...commonCols, ...(mode === "kg" ? mixColsKg : mixColsRatio)],
  ];

  /* ---------- SAVE MAIN ROW ---------- */
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${mainSheet}!A:W`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: mainRow },
    });
  } catch (err) {
    console.error("Error saving main row:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to save main record" });
  }

  /* ---------- SAVE ADMIXTURES ---------- */
  if (Array.isArray(admixtures) && admixtures.length) {
    const rows = admixtures.map((a, i) => [
      recordId,
      timestamp,
      studentName,
      matricNumber,
      i + 1,
      a.name || "",
      a.dosage || "",
    ]);

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Research Admixtures!A:G",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });
    } catch (err) {
      console.error("Error saving admixtures:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to save admixtures" });
    }
  }

  /* ---------- SAVE SCMs ---------- */
  if (Array.isArray(scms) && scms.length) {
    const rows = scms.map((s, i) => [
      recordId,
      timestamp,
      studentName,
      matricNumber,
      i + 1,
      s.name || "",
      s.percent || "",
    ]);

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Research SCMs!A:G",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });
    } catch (err) {
      console.error("Error saving SCMs:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to save SCMs" });
    }
  }

  /* ---------- DONE ---------- */
  return res.status(200).json({
    success: true,
    recordId,
    mixRatioString,
    wcRatio,
  });
}