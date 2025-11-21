# UNILAG Concrete Laboratory – Student Research Mix Intake & PDF Report System

---

## What the System Does (End-to-End)

1. **Student fills the Research Mix Form** (`index.html`) with all required research details: personal info, project info, mix design, quantities, admixtures, SCMs, slump, age, notes, etc.

2. **Styling and Layout** (`style.css`) ensures a modern, responsive and accessible interface consistent with academic laboratory standards.

3. **Client-Side Logic** (`script.js`) manages:
   - Input validation for all required fields (numeric fields may be `0`).
   - Dynamic rows for *Chemical Admixtures* and *Partial Cement Replacements (SCMs)*.
   - Automatic calculation of the **Water–Cement Ratio**.
   - Local saving of submitted mixes in **browser Local Storage**.
   - Table view of all locally saved mixes.
   - Ability to reload past mixes into the form.
   - CSV export of all saved mixes.
   - Clean error summaries and status indicators.
   - Sending the full payload to the server endpoint (`/api/submit`).
   - Receiving the server-generated **Application Number**.
   - Automatic generation of a structured **PDF report** using jsPDF.
   - Display of a modal showing the assigned **Application Number**.

4. **Serverless API Endpoint** (`/api/submit` in `submit.js`):
   - Accepts **POST** only.
   - Validates presence of all mandatory fields.
   - Reads the **last used Application Number** from Column A of the Google Sheet.
   - Generates the next ID in the format:
     ```
     UNILAG-CR-A000001 → UNILAG-CR-A000002 → … → UNILAG-CR-A999999
     → UNILAG-CR-B000001 → … → UNILAG-CR-Z999999 → rolls back to A000001
     ```
   - Appends the full record into `Research Sheet!A:V`, including timestamp and derived water–cement ratio.
   - Returns `{ success: true, recordId }` back to the browser.

5. **Dependencies** (`package.json`) include:
   - `googleapis` for interacting with Google Sheets.

---

## Environment & Deployment

### Required Environment Variables
Ensure these are set in the deployment platform (e.g., Vercel):

- `GOOGLE_SERVICE_CREDENTIALS`  
  The complete Google Service Account JSON as a single string.

- `SHEET_ID`  
  The Google Sheet ID from the spreadsheet URL.

If either is missing, the API returns:
Server not configured (missing credentials)

---

## Google Sheet Setup

Create a Google Sheet with a tab named:

### **Research Sheet**

Ensure columns A–V follow this order (matching the appended row):

1. Application Number  
2. Timestamp  
3. Student Name  
4. Matric / Reg. No.  
5. Institution  
6. Supervisor  
7. Project Title  
8. Age to Test (days)  
9. Cubes Count  
10. Testing Date  
11. Concrete Type  
12. Cement Type  
13. Slump (mm)  
14. Cement Content (kg/m³)  
15. Water Content (kg/m³)  
16. Water–Cement Ratio  
17. Fine Aggregate (kg/m³)  
18. Medium Aggregate (kg/m³)  
19. Coarse Aggregate (kg/m³)  
20. Admixtures (flattened string)  
21. Replacements (flattened string)  
22. Notes  

> The API writes to `Research Sheet!A:V`.  
> Rename or adjust only if you modify the code.

---

## Notes on Validation, Reliability & Safety

- All required fields must be completed before submission.  
- “Other” selections for Concrete Type or Cement Type require a custom input.  
- Admixture/SCM rows are validated unless the user explicitly types “Nil.”  
- The server performs second-level validation for safety.  
- On server errors, the application:
  - Displays an error
  - Stops PDF generation
  - Does NOT assign an application number  
  This prevents invalid or unsaved records from being exported.

- Local Storage ensures offline preservation of mixes.  
- CSV export enables easy data extraction for laboratory use.

---

## Local Storage & CSV Features

- Every successful submission is stored locally.  
- A table displays application number, student, mix type, w/c ratio, and timestamp.  
- Clicking a table row reloads that mix into the form.  
- Users can:
  - Export all saved mixes as a CSV file  
  - Clear all saved mixes  
  - Keep personal or offline archive copies effortlessly

---

## Credits

- University of Lagos – Department of Civil & Environmental Engineering, Concrete Laboratory  
- Jesuto Ilugbo – System Development & Frontend/Backend Implementation  
- jsPDF – PDF generation engine  
- Google Sheets API (`googleapis`) – Cloud data storage integration