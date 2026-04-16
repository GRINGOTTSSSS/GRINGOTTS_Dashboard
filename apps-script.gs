// ================================================================
//  GRINGOTTS DASHBOARD — Google Apps Script (CORS FIXED)
//
//  SETUP:
//  1. Open your Google Sheet
//  2. Extensions → Apps Script
//  3. Delete ALL existing code, paste this entire file
//  4. Save (Ctrl+S)
//  5. Deploy → New Deployment
//     Type: Web App
//     Execute as: Me
//     Who has access: Anyone
//  6. Click Deploy → copy the Web App URL
//  7. Paste URL in app.js as SCRIPT_URL
// ================================================================

const SHEET_NAME = "Sheet1";
const HEADERS    = ["ID","Tracking","Customer","Origin","Destination","Status","Date","Weight","Notes"];

// ── CORS headers must be on EVERY response ───────────────────────
function addCorsHeaders(output) {
  return output
    .setHeader("Access-Control-Allow-Origin",  "*")
    .setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function makeResponse(data) {
  return addCorsHeaders(
    ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON)
  );
}

// ── OPTIONS preflight (browsers send this before POST) ───────────
function doOptions(e) {
  return addCorsHeaders(
    ContentService.createTextOutput("")
  );
}

// ── GET ───────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const rows = getAllRows();
    return makeResponse({ ok: true, data: rows });
  } catch(err) {
    return makeResponse({ ok: false, error: err.message });
  }
}

// ── POST ──────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === "addShipment") {
      addRow(body.shipment);
      return makeResponse({ ok: true, action: "addShipment" });
    }

    if (action === "updateStatus") {
      updateStatus(String(body.id), String(body.status));
      return makeResponse({ ok: true, action: "updateStatus" });
    }

    return makeResponse({ ok: false, error: "Unknown action: " + action });

  } catch(err) {
    return makeResponse({ ok: false, error: err.message });
  }
}

// ── Get all rows ──────────────────────────────────────────────────
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

// ── Add new row ───────────────────────────────────────────────────
function addRow(shipment) {
  const sheet = getSheet();
  ensureHeaders(sheet);
  const row = HEADERS.map(h => shipment[h] !== undefined ? shipment[h] : "");
  sheet.appendRow(row);
  SpreadsheetApp.flush();
}

// ── Update status by ID ───────────────────────────────────────────
function updateStatus(id, newStatus) {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  const hdrs  = data[0].map(h => String(h).trim());
  const idCol = hdrs.indexOf("ID");
  const stCol = hdrs.indexOf("Status");

  if (idCol < 0) throw new Error("Column 'ID' not found in row 1");
  if (stCol < 0) throw new Error("Column 'Status' not found in row 1");

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === id) {
      sheet.getRange(i + 1, stCol + 1).setValue(newStatus);
      SpreadsheetApp.flush();
      return;
    }
  }
  throw new Error("ID '" + id + "' not found in sheet");
}

// ── Ensure Row 1 has correct headers ─────────────────────────────
function ensureHeaders(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), HEADERS.length);
  const firstRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (firstRow.every(c => !String(c).trim())) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    SpreadsheetApp.flush();
  }
}

// ── Get sheet ─────────────────────────────────────────────────────
function getSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Sheet named '" + SHEET_NAME + "' not found");
  return sheet;
}
