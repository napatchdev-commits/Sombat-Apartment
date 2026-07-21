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
      
      // Also write structured rows into "TENANTS_SHEET" and "INVOICES_SHEET" if requested
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
  // Sync Tenants Sheet Tab
  if (data.tenants) {
    var tSheet = ss.getSheetByName("TENANTS");
    if (!tSheet) {
      tSheet = ss.insertSheet("TENANTS");
      tSheet.appendRow(["ID", "ชื่อ-นามสกุล", "เลขบัตรประชาชน", "เบอร์โทร", "วันเริ่มสัญญา", "วันหมดสัญญา", "เงินประกัน"]);
    }
    // Update contents
    tSheet.getRange("A2:G100").clearContent();
    data.tenants.forEach(function(t) {
      tSheet.appendRow([t.id, t.name, t.idCard, t.tel, t.startDate, t.endDate, t.deposit ? t.deposit.initialBail : 0]);
    });
  }

  // Sync Invoices Sheet Tab
  if (data.invoices) {
    var invSheet = ss.getSheetByName("INVOICES");
    if (!invSheet) {
      invSheet = ss.insertSheet("INVOICES");
      invSheet.appendRow(["เลขที่บิล", "รอบเดือน", "ห้อง", "ผู้เช่า", "ยอดรวม", "ยอดชำระแล้ว", "สถานะ"]);
    }
    invSheet.getRange("A2:G200").clearContent();
    data.invoices.forEach(function(inv) {
      invSheet.appendRow([inv.invoiceNumber, inv.monthKey, inv.roomName, inv.tenantName, inv.totalAmount, inv.paidAmount, inv.status]);
    });
  }
}
