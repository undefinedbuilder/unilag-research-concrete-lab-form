import { google } from "googleapis";

/* ---------------------------------------------------------------
   GENERATE NEXT APPLICATION NUMBER
---------------------------------------------------------------- */
function nextRecordId(lastId, modeLetter) {
  if (!lastId) return `UNILAG-CR-${modeLetter}000001`;

  const match = lastId.match(/^UNILAG-CR-[KR](\d{6})$/);
  if (!match) return `UNILAG-CR-${modeLetter}000001`;

  let number = parseInt(match[1], 10) + 1;
  if (number > 999999) {
    number = 1;
  }

  return `UNILAG-CR-${modeLetter}${String(number).padStart(6, "0")}`;
}

function computeKgMixRatio(cementContent, waterContent, fineAgg, mediumAgg, coarseAgg) {
  const cement = Number(cementContent);
  const water = Number(waterContent);
  const fine = Number(fineAgg);
  const medium = Number(mediumAgg);
  const coarse = Number(coarseAgg);

  if (!cement || cement <= 0 || [water, fine, medium, coarse].some(v => isNaN(v))) {
    return "";
  }

  const fineRatio = fine / cement;
  const mediumRatio = medium / cement;
  const coarseRatio = coarse / cement;
  const waterRatio = water / cement;

  return `1 : ${fineRatio.toFixed(2)} : ${mediumRatio.toFixed(2)} : ${coarseRatio.toFixed(
    2
  )} : ${waterRatio.toFixed(2)}`;
}

function computeRatioMix(ratioCement, ratioFine, ratioMedium, ratioCoarse, ratioWater) {
  const c = Number(ratioCement);
  const f = Number(ratioFine);
  const m = Number(ratioMedium);
  const co = Number(ratioCoarse);
  const w = Number(ratioWater);

  if (!c || c <= 0 || [f, m, co, w].some(v => isNaN(v))) {
    return { mixRatioString: "", wcRatio: 0 };
  }

  const fineN = f / c;
  const mediumN = m / c;
  const coarseN = co / c;
  const waterN = w / c;
  const wcRatio = w / c;

  const mixRatioString = `1 : ${fineN.toFixed(2)} : ${mediumN.toFixed(2)} : ${coarseN.toFixed(
    2
  )} : ${waterN.toFixed(2)}`;

  return { mixRatioString, wcRatio };
}

/* ---------------------------------------------------------------
   MAIN HANDLER
---------------------------------------------------------------- */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  const body = req.body;
  const inputMode = body.inputMode;

  if (inputMode !== "kg" && inputMode !== "ratio") {
    return res.status(400).json({
      success: false,
      message: "Invalid input mode"
    });
  }

  const commonRequired = [
    "studentName",
    "matricNo",
    "institution",
    "supervisor",
    "projectTitle",
    "crushDate",
    "concreteType",
    "cementType",
    "slump",
    "ageDays",
    "cubesCount",
    "notes"
  ];

  for (const key of commonRequired) {
    if (
      body[key] === undefined ||
      body[key] === null ||
      String(body[key]).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: `Missing required field: ${key}`
      });
    }
  }

  if (inputMode === "kg") {
    const kgRequired = [
      "cementContent",
      "waterContent",
      "fineAgg",
      "mediumAgg",
      "coarseAgg"
    ];
    for (const key of kgRequired) {
      if (
        body[key] === undefined ||
        body[key] === null ||
        String(body[key]).trim() === ""
      ) {
        return res.status(400).json({
          success: false,
          message: `Missing required field (kg/m3 mode): ${key}`
        });
      }
    }
  } else {
    const ratioRequired = [
      "ratioCement",
      "ratioFine",
      "ratioMedium",
      "ratioCoarse",
      "ratioWater"
    ];
    for (const key of ratioRequired) {
      if (
        body[key] === undefined ||
        body[key] === null ||
        String(body[key]).trim() === ""
      ) {
        return res.status(400).json({
          success: false,
          message: `Missing required field (ratio mode): ${key}`
        });
      }
    }
  }

  const {
    studentName,
    matricNo,
    institution,
    supervisor,
    projectTitle,
    crushDate,
    concreteType,
    cementType,
    slump,
    ageDays,
    cubesCount,
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
    admixtures = [],
    scms = []
  } = body;

  const sheetId = process.env.SHEET_ID;
  const credentials = process.env.GOOGLE_SERVICE_CREDENTIALS;

  if (!sheetId || !credentials) {
    return res.status(500).json({
      success: false,
      message: "Server not configured (missing credentials)"
    });
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const sheets = google.sheets({ version: "v4", auth });

  const modeLetter = inputMode === "kg" ? "K" : "R";
  const mainSheetName = inputMode === "kg" ? "Research Sheet (Kg/m3)" : "Research Sheet (Ratios)";

  /* -----------------------------------------------------------
     FETCH LAST APPLICATION NUMBER
  ------------------------------------------------------------ */
  let lastId = null;

  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${mainSheetName}!A:A`
    });

    const rows = existing.data.values || [];
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i][0] && rows[i][0].trim()) {
        lastId = rows[i][0].trim();
        break;
      }
    }
  } catch (err) {
    console.error("Error reading last recordId:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to read existing records"
    });
  }

  const recordId = nextRecordId(lastId, modeLetter);
  const timestamp = new Date().toISOString();

  let wcRatioNumber = 0;
  let mixRatioString = "";

  if (inputMode === "kg") {
    const cementNum = Number(cementContent);
    const waterNum = Number(waterContent);
    if (cementNum && cementNum > 0 && !isNaN(waterNum)) {
      wcRatioNumber = waterNum / cementNum;
    } else {
      wcRatioNumber = 0;
    }
    mixRatioString = computeKgMixRatio(
      cementContent,
      waterContent,
      fineAgg,
      mediumAgg,
      coarseAgg
    );
  } else {
    const result = computeRatioMix(
      ratioCement,
      ratioFine,
      ratioMedium,
      ratioCoarse,
      ratioWater
    );
    wcRatioNumber = result.wcRatio;
    mixRatioString = result.mixRatioString;
  }

  /* -----------------------------------------------------------
     ROW FORMAT FOR GOOGLE SHEETS (KG/M3 OR RATIOS)
  ------------------------------------------------------------ */
  let mainRow;

  if (inputMode === "kg") {
    mainRow = [
      [
        recordId,
        timestamp,
        studentName,
        matricNo,
        institution,
        supervisor,
        projectTitle,
        ageDays,
        cubesCount,
        crushDate,
        concreteType,
        cementType,
        slump,
        cementContent,
        waterContent,
        wcRatioNumber,
        mixRatioString,
        fineAgg,
        mediumAgg,
        coarseAgg,
        notes
      ]
    ];
  } else {
    mainRow = [
      [
        recordId,
        timestamp,
        studentName,
        matricNo,
        institution,
        supervisor,
        projectTitle,
        ageDays,
        cubesCount,
        crushDate,
        concreteType,
        cementType,
        slump,
        ratioCement,
        ratioFine,
        ratioMedium,
        ratioCoarse,
        ratioWater,
        wcRatioNumber,
        mixRatioString,
        notes
      ]
    ];
  }

  /* -----------------------------------------------------------
     APPEND ROW TO MAIN GOOGLE SHEET
  ------------------------------------------------------------ */
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${mainSheetName}!A:U`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: mainRow }
    });
  } catch (err) {
    console.error("Error appending main row:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to save main record"
    });
  }

  /* -----------------------------------------------------------
     APPEND ROWS TO RESEARCH ADMIXTURES
  ------------------------------------------------------------ */
  if (Array.isArray(admixtures) && admixtures.length > 0) {
    const admRows = admixtures.map((a, index) => [
      recordId,
      timestamp,
      inputMode,
      studentName,
      index + 1,
      a.name || "",
      a.type || "",
      a.dosage || ""
    ]);

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Research Admixtures!A:H",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: admRows }
      });
    } catch (err) {
      console.error("Error appending admixtures rows:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to save admixtures"
      });
    }
  }

  /* -----------------------------------------------------------
     APPEND ROWS TO RESEARCH SCMS
  ------------------------------------------------------------ */
  if (Array.isArray(scms) && scms.length > 0) {
    const scmRows = scms.map((s, index) => [
      recordId,
      timestamp,
      inputMode,
      studentName,
      index + 1,
      s.name || "",
      s.percent || "",
      s.quantity || ""
    ]);

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Research SCMs!A:H",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: scmRows }
      });
    } catch (err) {
      console.error("Error appending SCM rows:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to save SCMs"
      });
    }
  }

  /* -----------------------------------------------------------
     RETURN SUCCESS
  ------------------------------------------------------------ */
  return res.status(200).json({
    success: true,
    recordId,
    mixRatioString,
    wcRatio: wcRatioNumber
  });
}