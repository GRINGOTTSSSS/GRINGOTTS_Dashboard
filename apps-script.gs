// ============================================================
// GRINGOT SHIPMENT DASHBOARD - Google Apps Script
// SETUP INSTRUCTIONS:
// 1. Open your Google Sheet
// 2. Click Extensions > Apps Script
// 3. Delete all existing code and paste this entire file
// 4. Click Save, then Deploy > New Deployment
// 5. Choose "Web App", set access to "Anyone"
// 6. Click Deploy, copy the Web App URL
// 7. Paste that URL into app.js where it says APPS_SCRIPT_URL
// ============================================================

const SHEET_NAME = "Sheet1";

// Column mapping (adjust if your columns are different)
const COLS = {
  ID: 1,
  TRACKING: 2,
  CUSTOMER: 3,
  ORIGIN: 4,
  DESTINATION: 5,
  STATUS: 6,
  DATE: 7,
  WEIGHT: 8,
  NOTES: 9
};

function doGet(e) {
  const action = e.parameter.action;
  if (action === "getAll") {
    return getAll();
  }
  return ContentService.createTextOutput(JSON.stringify({ error: "Unknown action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;

  if (action === "updateStatus") {
    return updateStatus(data.id, data.status);
  } else if (action === "addShipment") {
    return addShipment(data.shipment);
  } else if (action === "deleteShipment") {
    return deleteShipment(data.id);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: "Unknown action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    return ok([]);
  }

  const headers = data[0];
  const rows = data.slice(1).map((row, i) => {
    const obj = {};
    headers.forEach((h, j) => { obj[h] = row[j]; });
    obj._row = i + 2; // 1-indexed, +1 for header
    return obj;
  });

  return ok(rows);
}

function updateStatus(id, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf("ID") + 1;
  const statusCol = headers.indexOf("Status") + 1;

  if (idCol === 0 || statusCol === 0) return error("Columns not found");

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol - 1]) === String(id)) {
      sheet.getRange(i + 1, statusCol).setValue(status);
      return ok({ updated: true });
    }
  }
  return error("Row not found");
}

function addShipment(shipment) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const row = headers.map(h => shipment[h] !== undefined ? shipment[h] : "");
  sheet.appendRow(row);
  return ok({ added: true });
}

function deleteShipment(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf("ID") + 1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol - 1]) === String(id)) {
      sheet.deleteRow(i + 1);
      return ok({ deleted: true });
    }
  }
  return error("Row not found");
}

function ok(data) {
  return ContentService.createTextOutput(JSON.stringify({ success: true, data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function error(msg) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
