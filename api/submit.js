import { google } from "googleapis";

/* ---------------------------------------------------------------
   FUNCTION: Generate next application number in sequence
   Format: UNILAG-CR-A000001 → UNILAG-CR-A000002 ...
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
    if (letterCode > 90) letterCode = 65; // After Z → A

    return `UNILAG-CR-${String.fromCharCode(letterCode)}${String(number).padStart(6, "0")}`;
}


/* ---------------------------------------------------------------
   MAIN HANDLER
---------------------------------------------------------------- */
export default async function handler(req, res) {

    // Only allow POST requests
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const body = req.body;

    // Required fields list
    const required = [
        "studentName", "matricNo", "institution", "supervisor", "projectTitle",
        "testDate", "concreteType", "cementType", "slump", "ageToTestDays",
        "notes", "cementContent", "waterContent", "wcRatio",
        "fineAgg", "mediumAgg", "coarseAgg"
    ];

    // Check for missing fields
    for (const key of required) {
        if (body[key] === undefined || body[key] === null || String(body[key]).trim() === "") {
            return res.status(400).json({
                success: false,
                message: `Missing required field: ${key}`,
            });
        }
    }

    // Extract fields
    const {
        studentName, matricNo, institution, supervisor, projectTitle,
        testDate, concreteType, cementType, slump, ageToTestDays,
        notes, cementContent, waterContent, wcRatio,
        fineAgg, mediumAgg, coarseAgg,
        admixtures = [], replacements = []
    } = body;

    // Convert admixtures into one string
    const admixtureString = admixtures
        .map((a, i) => `${i + 1}. ${a.name || ''} | ${a.type || ''} | ${a.dosage || ''}`)
        .join(" || ");

    // Convert SCM replacements into one string
    const replacementString = replacements
        .map((r, i) => `${i + 1}. ${r.name || ''} | ${r.percent || ''}% | ${r.quantity || ''}`)
        .join(" || ");


    /* -----------------------------------------------------------
       Setup Google Sheets Authentication
    ------------------------------------------------------------ */
    const sheetId = process.env.SHEET_ID;
    const credentials = process.env.GOOGLE_SERVICE_CREDENTIALS;

    if (!sheetId || !credentials) {
        return res.status(500).json({
            success: false,
            message: "Server not configured (missing credentials)",
        });
    }

    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(credentials),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });


    /* -----------------------------------------------------------
       Get last application number from Column A of Research Sheet
    ------------------------------------------------------------ */
    const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "Research Sheet!A:A",
    });

    const rows = existing.data.values || [];
    let lastId = null;

    for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i][0] && rows[i][0].trim()) {
            lastId = rows[i][0].trim();
            break;
        }
    }

    // Generate new application number
    const recordId = nextRecordId(lastId);
    const timestamp = new Date().toISOString();


    /* -----------------------------------------------------------
       NEW COLUMN ORDER (Option C)
       This must match your Google Sheet:
       A: App No
       B: Timestamp
       C: Student
       D: Matric
       E: Institution
       F: Supervisor
       G: Project Title
       H: Age to Test
       I: Test Date
       J: Concrete Type
       K: Cement Type
       L: Slump
       M: Cement
       N: Water
       O: W/C Ratio
       P: Fine Agg
       Q: Medium Agg
       R: Coarse Agg
       S: Admixtures
       T: Replacements
       U: Notes
    ------------------------------------------------------------ */

    const row = [[
        recordId,
        timestamp,
        studentName,
        matricNo,
        institution,
        supervisor,
        projectTitle,
        ageToTestDays,
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
    ]];


    /* -----------------------------------------------------------
       Append row into Google Sheet
    ------------------------------------------------------------ */
    await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Research Sheet!A:U",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: row },
    });


    /* -----------------------------------------------------------
       Return success + record ID
    ------------------------------------------------------------ */
    return res.status(200).json({
        success: true,
        recordId,
    });
}
