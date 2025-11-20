# UNILAG Concrete Research Mix Tracker

This application allows Civil Engineering students to enter their concrete mix details, save them locally, submit to Google Sheets, and automatically download a structured PDF summary.

---

## 🚀 What the System Does

1. **User fills the form** in the browser.
2. **Frontend validates** that all required fields are filled.
3. **Admixtures and SCMs** can be added as dynamic rows.
4. When submitted:
   - Data is **saved to Google Sheets** through the serverless API.
   - A **unique Application Number** is generated.
   - A **PDF report** is created automatically.
   - The mix is **saved locally** in the browser for quick reuse.
5. All saved mixes appear in a table, where:
   - You can **reload** any mix into the form.
   - You can **export all mixes** to CSV.
   - You can **clear** all local mixes.

---

## 🗂️ Project Files

| File | Purpose |
|------|---------|
| `index.html` | Form layout + saved mixes table |
| `style.css` | UI styling, responsiveness, error styles |
| `script.js` | Validation, dynamic rows, PDF creation, localStorage |
| `/api/submit.js` | Saves submitted data to Google Sheets |
| `package.json` | Google Sheets API dependency |

---

## 🔧 Requirements

You must set the following environment variables:

SHEET_ID=<your Google Sheet ID>
GOOGLE_SERVICE_CREDENTIALS=<full JSON of service account>

The Google Sheet must have a tab named **Sheet1**.

---

## 📄 Google Sheet Format

The API writes rows in the range **A:T** in the following order:

1. Application Number  
2. Timestamp  
3. Student Name  
4. Matric No  
5. Institution  
6. Supervisor  
7. Project Title  
8. Age to Test (days)  
9. Casting Date  
10. Concrete Type  
11. Cement Type  
12. Slump (mm)  
13. Cement (kg/m³)  
14. Water (kg/m³)  
15. Fine Agg  
16. Medium Agg  
17. Coarse Agg  
18. Admixtures (compiled string)  
19. Replacements (compiled string)  
20. Notes  

---

## 📦 Local Saving

All mixes are also stored in the browser via **localStorage**, so refreshing does not lose data.

---

## 🧾 PDF Generation

The app automatically generates a clean, single-page PDF that includes:

- UNILAG Logo
- Student & project details
- Mix overview
- Materials
- Admixtures
- SCM replacements
- Notes
- Footer message

---

## 👨‍💻 Credits

Designed and implemented by **Jesuto Ilugbo** for  
**The Concrete Laboratory, Department of Civil & Environmental Engineering, University of Lagos**.

