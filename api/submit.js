import { google } from "googleapis";

/* ---------------------------------------------------------------
   GENERATE NEXT APPLICATION NUMBER
---------------------------------------------------------------- */
function nextRecordId(lastId) {
  if (!lastId) return "UNILAG-CR-A000001";

  const match = lastId.match(/^UNILAG-CR-([A-Z])(\d{6})$/);
  if (!match) return "UNILAG-CR-A000001";

  let letterCode = match[1].charCodeAt(0);
  let number = parseInt(match[2], 10) + 1;

  if (number > 999999) {
    number = 1;
    letterCode++;
  }
  if (letterCode > 90) {
    letterCode = 65;
  }

  return `UNILAG-CR-${String.fromCharCode(letterCode)}${String(number).padStart(
    6,
    "0"
  )}`;
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

  const required = [
    "studentName",
    "matricNo",
    "institution",
    "supervisor",
    "projectTitle",
    "testDate",
    "concreteType",
    "cementType",
    "slump",
    "ageToTestDays",
    "cubesCount",
    "notes",
    "cementContent",
    "waterContent",
    "wcRatio",
    "fineAgg",
    "mediumAgg",
    "coarseAgg"
  ];

  for (const key of required) {
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

  const {
    studentName,
    matricNo,
    institution,
    supervisor,
    projectTitle,
    testDate,
    concreteType,
    cementType,
    slump,
    ageToTestDays,
    cubesCount,
    notes,
    cementContent,
    waterContent,
    wcRatio,
    fineAgg,
    mediumAgg,
    coarseAgg,
    admixtures = [],
    replacements = []
  } = body;

  const admixtureString = admixtures
    .map(
      (a, i) =>
        `${i + 1}. ${a.name || ""} | ${a.type || ""} | ${a.dosage || ""}`
    )
    .join(" || ");

  const replacementString = replacements
    .map(
      (r, i) =>
        `${i + 1}. ${r.name || ""} | ${r.percent || ""}% | ${r.quantity || ""}`
    )
    .join(" || ");

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

  /* -----------------------------------------------------------
     FETCH LAST APPLICATION NUMBER
  ------------------------------------------------------------ */
  let lastId = null;

  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Research Sheet!A:A"
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

  const recordId = nextRecordId(lastId);
  const timestamp = new Date().toISOString();

  /* -----------------------------------------------------------
     ROW FORMAT FOR GOOGLE SHEET (RESEARCH SHEET)
  ------------------------------------------------------------ */
  const row = [
    [
      recordId,
      timestamp,
      studentName,
      matricNo,
      institution,
      supervisor,
      projectTitle,
      ageToTestDays,
      cubesCount,
      testDate,
      concreteType,
      cementType,
      slump,
      cementContent,
      waterContent,
      wcRatio,
      fineAgg,
      mediumAgg,
      coarseAgg,
      admixtureString,
      replacementString,
      notes
    ]
  ];

  /* -----------------------------------------------------------
     APPEND ROW TO GOOGLE SHEET
  ------------------------------------------------------------ */
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Research Sheet!A:V",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: row }
    });
  } catch (err) {
    console.error("Error appending row:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to save record"
    });
  }

  /* -----------------------------------------------------------
     RETURN SUCCESS
  ------------------------------------------------------------ */
  return res.status(200).json({
    success: true,
    recordId
  });
}