// ================================================================
//  GRINGOTTS DASHBOARD — Google Apps Script
//  SETUP (do this once):
//  1. Open your Google Sheet
//  2. Extensions → Apps Script
//  3. Delete all existing code, paste this entire file
//  4. Save (Ctrl+S)
//  5. Deploy → New Deployment → Web App
//     Execute as: Me
//     Who has access: Anyone
//  6. Click Deploy → copy the Web App URL
//  7. That URL is already in your app.js as SCRIPT_URL
// ================================================================

const SHEET_NAME = "Sheet1";

// Column headers — must match exactly what's in Row 1 of your sheet
const HEADERS = ["ID","Tracking","Customer","Origin","Destination","Status","Date","Weight","Notes"];

// ── CORS helper ─────────────────────────────────────────────────
function corsResponse(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── GET — read all rows ──────────────────────────────────────────
function doGet(e) {
  try {
    const rows = getAllRows();
    return corsResponse({ ok: true, data: rows });
  } catch(err) {
    return corsResponse({ ok: false, error: err.message });
  }
}

// ── POST — handle write actions ──────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === "addShipment") {
      addRow(body.shipment);
      return corsResponse({ ok: true, action: "addShipment" });
    }
    if (action === "updateStatus") {
      updateStatus(body.id, body.status);
      return corsResponse({ ok: true, action: "updateStatus" });
    }
    return corsResponse({ ok: false, error: "Unknown action: " + action });
  } catch(err) {
    return corsResponse({ ok: false, error: err.message });
  }
}

// ── Get all rows as array of objects ────────────────────────────
function getAllRows() {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const hdrs = data[0].map(h => String(h).trim());
  return data.slice(1)
    .filter(row => row.some(cell => String(cell).trim() !== ""))
    .map((row, i) => {
      const obj = { _row: i + 2 };
      hdrs.forEach((h, j) => { obj[h] = String(row[j] || "").trim(); });
      return obj;
    });
}

// ── Add a new row ────────────────────────────────────────────────
function addRow(shipment) {
  const sheet = getSheet();
  // Ensure headers exist
  ensureHeaders(sheet);
  const row = HEADERS.map(h => shipment[h] || "");
  sheet.appendRow(row);
  SpreadsheetApp.flush();
}

// ── Update status of a row by ID ─────────────────────────────────
function updateStatus(id, newStatus) {
  const sheet  = getSheet();
  const data   = sheet.getDataRange().getValues();
  const hdrs   = data[0].map(h => String(h).trim());
  const idCol  = hdrs.indexOf("ID");
  const stCol  = hdrs.indexOf("Status");
  if (idCol < 0 || stCol < 0) throw new Error("ID or Status column not found");

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id).trim()) {
      sheet.getRange(i + 1, stCol + 1).setValue(newStatus);
      SpreadsheetApp.flush();
      return;
    }
  }
  throw new Error("Row with ID '" + id + "' not found");
}

// ── Ensure headers are in Row 1 ──────────────────────────────────
function ensureHeaders(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (firstRow.every(c => !c)) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    // Bold the header row
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    SpreadsheetApp.flush();
  }
}

// ── Get sheet ────────────────────────────────────────────────────
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Sheet '" + SHEET_NAME + "' not found");
  return sheet;
}
