// ==========================================================================
// GOOGLE APPS SCRIPT WEB APP - SOMBAT APARTMENT CLOUD BACKEND
// Deploy this script inside Google Sheets Apps Script editor (Extensions -> Apps Script)
// ==========================================================================

function doGet(e) {
  var action = e.parameter ? e.parameter.action : "get";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("DB_STATE");
  if (!sheet) {
    sheet = ss.insertSheet("DB_STATE");
  }
  
  if (action === "get") {
    var data = sheet.getRange(1, 1).getValue();
    return ContentService.createTextOutput(data || "{}")
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("DB_STATE");
    if (!sheet) {
      sheet = ss.insertSheet("DB_STATE");
    }
    
    if (action === "sync") {
      // Store full database JSON state inside cell A1
      sheet.getRange(1, 1).setValue(JSON.stringify(requestData.data));
      
      // Write structured rows into ROOMS_METER, TENANTS, and INVOICES sheets
      writeStructuredSheets(ss, requestData.data);

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Data synced to Google Sheets successfully!" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid post action" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function writeStructuredSheets(ss, data) {
  // 1. Sync Rooms & Meter Readings Sheet Tab
  if (data.rooms) {
    var rSheet = ss.getSheetByName("ROOMS_METER");
    if (!rSheet) {
      rSheet = ss.insertSheet("ROOMS_METER");
      rSheet.appendRow(["ID ห้อง", "เลขห้อง", "ผู้เช่าปัจจุบัน", "มิเตอร์ไฟล่าสุด", "มิเตอร์น้ำล่าสุด", "ค่าเช่า (บาท)", "สถานะ"]);
    }
    rSheet.getRange("A2:G100").clearContent();
    data.rooms.forEach(function(r) {
      var lastElec = r.lastElecMeter !== undefined ? r.lastElecMeter : 1000;
      var lastWater = r.lastWaterMeter !== undefined ? r.lastWaterMeter : 100;
      rSheet.appendRow([r.id, r.name, r.currentTenantName || "-", lastElec, lastWater, r.baseRent, r.status]);
    });
  }

  // 2. Sync Tenants Sheet Tab
  if (data.tenants) {
    var tSheet = ss.getSheetByName("TENANTS");
    if (!tSheet) {
      tSheet = ss.insertSheet("TENANTS");
      tSheet.appendRow(["ID", "ชื่อ-นามสกุล", "เลขบัตรประชาชน", "เบอร์โทร", "วันเริ่มสัญญา", "วันหมดสัญญา", "เงินประกัน"]);
    }
    tSheet.getRange("A2:G100").clearContent();
    data.tenants.forEach(function(t) {
      tSheet.appendRow([t.id, t.name, t.idCard, t.tel, t.startDate, t.endDate, t.deposit ? t.deposit.initialBail : 0]);
    });
  }

  // 3. Sync Invoices Sheet Tab
  if (data.invoices) {
    var invSheet = ss.getSheetByName("INVOICES");
    if (!invSheet) {
      invSheet = ss.insertSheet("INVOICES");
      invSheet.appendRow(["เลขที่บิล", "รอบเดือน", "ห้อง", "ผู้เช่า", "มิเตอร์ไฟครั้งก่อน", "มิเตอร์ไฟครั้งนี้", "มิเตอร์น้ำครั้งก่อน", "มิเตอร์น้ำครั้งนี้", "ยอดรวม", "สถานะ"]);
    }
    invSheet.getRange("A2:J200").clearContent();
    data.invoices.forEach(function(inv) {
      invSheet.appendRow([
        inv.invoiceNumber, inv.monthKey, inv.roomName, inv.tenantName,
        inv.elecPrev, inv.elecCurr, inv.waterPrev, inv.waterCurr,
        inv.totalAmount, inv.status
      ]);
    });
  }
}
