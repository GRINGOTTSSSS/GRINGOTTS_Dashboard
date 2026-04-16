// ================================================================
//  GRINGOTTS DASHBOARD — Google Apps Script
//  METHOD: Everything via GET requests (URL parameters)
//  This completely bypasses the POST/CORS redirect problem.
//
//  SETUP:
//  1. Open your Google Sheet
//  2. Extensions → Apps Script
//  3. Delete ALL code, paste this entire file
//  4. Save (Ctrl+S)
//  5. Deploy → New Deployment
//     Type: Web App
//     Execute as: Me
//     Who has access: Anyone (anonymous)
//  6. Copy the Web App URL → paste into app.js as SCRIPT_URL
//  7. Every time you edit this script, do:
//     Deploy → Manage Deployments → edit → New version → Deploy
// ================================================================

const SHEET_NAME = "Sheet1";
const HEADERS    = ["ID","Tracking","Customer","Origin","Destination","Status","Date","Weight","Notes"];

function doGet(e) {
  const action = e.parameter.action || "ping";

  try {
    let result;

    if (action === "ping") {
      result = { ok: true, message: "Apps Script is working!" };
    }
    else if (action === "getAll") {
      result = { ok: true, data: getAllRows() };
    }
    else if (action === "updateStatus") {
      const id     = e.parameter.id     || "";
      const status = e.parameter.status || "";
      if (!id || !status) throw new Error("Missing id or status parameter");
      updateStatus(id, status);
      result = { ok: true, action: "updateStatus", id: id, status: status };
    }
    else if (action === "addShipment") {
      const encoded = e.parameter.data || "";
      if (!encoded) throw new Error("Missing data parameter");
      const shipment = JSON.parse(decodeURIComponent(encoded));
      addRow(shipment);
      result = { ok: true, action: "addShipment", id: shipment.ID };
    }
    else {
      result = { ok: false, error: "Unknown action: " + action };
    }

    return buildResponse(result);

  } catch(err) {
    return buildResponse({ ok: false, error: err.message });
  }
}

// ── Build response with CORS headers ─────────────────────────────
function buildResponse(data) {
  const json   = JSON.stringify(data);
  const output = ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── Get all rows ──────────────────────────────────────────────────
function getAllRows() {
  const sheet = getSheet();
  const last  = sheet.getLastRow();
  if (last < 2) return [];
  const data = sheet.getDataRange().getValues();
  const hdrs = data[0].map(h => String(h).trim());
  const out  = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row.every(function(c){ return String(c).trim() === ""; })) continue;
    var obj = { _row: i + 1 };
    hdrs.forEach(function(h, j){ obj[h] = String(row[j] || "").trim(); });
    out.push(obj);
  }
  return out;
}

// ── Add new row ───────────────────────────────────────────────────
function addRow(shipment) {
  const sheet = getSheet();
  ensureHeaders(sheet);
  const row = HEADERS.map(function(h){ return shipment[h] !== undefined ? shipment[h] : ""; });
  sheet.appendRow(row);
  SpreadsheetApp.flush();
}

// ── Update status by ID ───────────────────────────────────────────
function updateStatus(id, newStatus) {
  const sheet  = getSheet();
  const data   = sheet.getDataRange().getValues();
  const hdrs   = data[0].map(function(h){ return String(h).trim(); });
  const idCol  = hdrs.indexOf("ID");
  const stCol  = hdrs.indexOf("Status");

  if (idCol < 0) throw new Error("No 'ID' column in row 1. Check headers.");
  if (stCol < 0) throw new Error("No 'Status' column in row 1. Check headers.");

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id).trim()) {
      sheet.getRange(i + 1, stCol + 1).setValue(newStatus);
      SpreadsheetApp.flush();
      return;
    }
  }
  throw new Error("ID '" + id + "' not found in sheet");
}

// ── Ensure headers in row 1 ───────────────────────────────────────
function ensureHeaders(sheet) {
  var firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (firstRow.every(function(c){ return !String(c).trim(); })) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    SpreadsheetApp.flush();
  }
}

// ── Get sheet by name ─────────────────────────────────────────────
function getSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Sheet '" + SHEET_NAME + "' not found");
  return sheet;
}
