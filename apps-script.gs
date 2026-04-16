// ================================================================
//  GRINGOTTS DASHBOARD — Google Apps Script
//
//  HOW TO INSTALL:
//  1. Open your Google Sheet
//  2. Click Extensions → Apps Script
//  3. You will see a code editor open
//  4. Select ALL the existing code (Ctrl+A) and DELETE it
//  5. Copy and paste THIS entire file into the editor
//  6. Press Ctrl+S to save — name it anything e.g. "Gringotts"
//  7. Click "Deploy" button (top right) → "New deployment"
//  8. Click the gear icon ⚙ next to "Type" → select "Web app"
//  9. Settings:
//       Description: Gringotts Dashboard
//       Execute as:  Me
//       Who has access: Anyone
// 10. Click "Deploy"
// 11. Click "Authorize access" → choose your Google account → Allow
// 12. Copy the Web app URL shown (looks like:
//     https://script.google.com/macros/s/LONG_ID_HERE/exec)
// 13. Open index.html in a text editor
// 14. Find this line near the top of the <script> section:
//       const SCRIPT_URL = "https://script.google.com/...";
// 15. Replace the URL inside quotes with your new URL
// 16. Save index.html and upload to GitHub
//
//  TO TEST: Open your Apps Script URL in browser and add ?action=ping
//  Example: https://script.google.com/.../exec?action=ping
//  You should see: {"ok":true,"message":"Apps Script is working!"}
// ================================================================

var SHEET_NAME = "Sheet1";
var HEADERS    = ["ID","Tracking","Customer","Origin","Destination","Status","Date","Weight","Notes"];

// All requests come in as GET with ?action=... parameters
function doGet(e) {
  var action = e.parameter.action || "ping";

  try {
    if (action === "ping") {
      return respond({ ok: true, message: "Apps Script is working!" });
    }

    if (action === "updateStatus") {
      var id     = e.parameter.id     || "";
      var status = e.parameter.status || "";
      if (!id)     return respond({ ok: false, error: "Missing: id" });
      if (!status) return respond({ ok: false, error: "Missing: status" });
      updateStatus(id, status);
      return respond({ ok: true, action: "updateStatus", id: id, status: status });
    }

    if (action === "addShipment") {
      var encoded = e.parameter.data || "";
      if (!encoded) return respond({ ok: false, error: "Missing: data" });
      var shipment = JSON.parse(decodeURIComponent(encoded));
      addRow(shipment);
      return respond({ ok: true, action: "addShipment", id: shipment.ID });
    }

    return respond({ ok: false, error: "Unknown action: " + action });

  } catch(err) {
    return respond({ ok: false, error: err.message });
  }
}

// Build a JSON response
function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Get all rows as objects
function getAllRows() {
  var sheet = getSheet();
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var hdrs = data[0].map(function(h){ return String(h).trim(); });
  var out  = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row.every(function(c){ return String(c).trim() === ""; })) continue;
    var obj = {};
    hdrs.forEach(function(h, j){ obj[h] = String(row[j] || "").trim(); });
    obj._row = i + 1;
    out.push(obj);
  }
  return out;
}

// Add a new row to the sheet
function addRow(shipment) {
  var sheet = getSheet();
  ensureHeaders(sheet);
  var row = HEADERS.map(function(h){
    return shipment[h] !== undefined ? String(shipment[h]) : "";
  });
  sheet.appendRow(row);
  SpreadsheetApp.flush();
}

// Find row by ID and update Status column
function updateStatus(id, newStatus) {
  var sheet  = getSheet();
  var data   = sheet.getDataRange().getValues();
  var hdrs   = data[0].map(function(h){ return String(h).trim(); });
  var idCol  = hdrs.indexOf("ID");
  var stCol  = hdrs.indexOf("Status");

  if (idCol < 0) throw new Error("No 'ID' column found in row 1 of your sheet");
  if (stCol < 0) throw new Error("No 'Status' column found in row 1 of your sheet");

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id).trim()) {
      sheet.getRange(i + 1, stCol + 1).setValue(newStatus);
      SpreadsheetApp.flush();
      return;
    }
  }
  throw new Error("Shipment ID '" + id + "' was not found in the sheet");
}

// Make sure row 1 has the correct headers
function ensureHeaders(sheet) {
  var range    = sheet.getRange(1, 1, 1, HEADERS.length);
  var firstRow = range.getValues()[0];
  if (firstRow.every(function(c){ return !String(c).trim(); })) {
    range.setValues([HEADERS]);
    range.setFontWeight("bold");
    SpreadsheetApp.flush();
  }
}

// Get the Sheet1 tab
function getSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(
    "Tab named '" + SHEET_NAME + "' not found. " +
    "Make sure your sheet tab at the bottom is named Sheet1"
  );
  return sheet;
}
