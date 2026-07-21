// ==========================================================================
// GOOGLE APPS SCRIPT WEB APP - SOMBAT APARTMENT ENTERPRISE CLOUD BACKEND
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
      // Store full database JSON state inside cell A1 for 1-click full restore
      sheet.getRange(1, 1).setValue(JSON.stringify(requestData.data));
      
      // Write structured rows into explicit Sheet Tabs for all 8 Left-Sidebar Menus
      writeAllStructuredSheets(ss, requestData.data);

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "All left-sidebar menu data synced to Google Sheets successfully!" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid post action" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function writeAllStructuredSheets(ss, data) {
  // 1. DASHBOARD_SUMMARY Tab (หน้าหลัก)
  writeDashboardSheet(ss, data);

  // 2. ROOMS Tab (ข้อมูลห้องเช่า)
  writeRoomsSheet(ss, data.rooms || []);

  // 3. TENANTS Tab (ข้อมูลผู้เช่า + บัตรประชาชน + ทะเบียนบ้าน)
  writeTenantsSheet(ss, data.tenants || [], data.rooms || []);

  // 4. CONTRACTS Tab (จัดการสัญญาเช่า)
  writeContractsSheet(ss, data.tenants || [], data.rooms || []);

  // 5. INVOICES Tab (ระบบออกบิลค่าเช่า)
  writeInvoicesSheet(ss, data.invoices || []);

  // 6. REPAIRS Tab (ระบบแจ้งซ่อม)
  writeRepairsSheet(ss, data.repairs || []);

  // 7. ACCOUNTING_LEDGER Tab (รายรับ - รายจ่าย)
  writeLedgerSheet(ss, data.ledger || []);

  // 8. CALENDAR_EVENTS Tab (ปฏิทินงาน)
  writeEventsSheet(ss, data.events || []);

  // 9. USERS Tab (จัดการผู้ใช้งานระบบ)
  writeUsersSheet(ss, data.users || []);
}

// --------------------------------------------------------------------------
// 1. DASHBOARD SUMMARY
// --------------------------------------------------------------------------
function writeDashboardSheet(ss, data) {
  var sheet = ss.getSheetByName("DASHBOARD_SUMMARY");
  if (!sheet) {
    sheet = ss.insertSheet("DASHBOARD_SUMMARY");
    sheet.appendRow(["รายการสรุปภาพรวม", "จำนวน / มูลค่า (บาท)", "อัปเดตล่าสุด"]);
  }
  sheet.getRange("A2:C20").clearContent();

  var rooms = data.rooms || [];
  var invoices = data.invoices || [];
  var tenants = data.tenants || [];
  
  var totalRooms = rooms.length;
  var vacantRooms = rooms.filter(function(r) { return r.status === 'vacant'; }).length;
  var occupiedRooms = rooms.filter(function(r) { return r.status === 'occupied'; }).length;
  
  var totalIncome = invoices.reduce(function(sum, inv) { return sum + (inv.paidAmount || 0); }, 0);
  var totalOverdue = invoices.filter(function(inv) { return inv.status === 'unpaid'; })
                             .reduce(function(sum, inv) { return sum + (inv.outstandingAmount || 0); }, 0);

  var nowStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

  sheet.appendRow(["ห้องพักทั้งหมด", totalRooms + " ห้อง", nowStr]);
  sheet.appendRow(["ห้องว่างพร้อมเช่า", vacantRooms + " ห้อง", nowStr]);
  sheet.appendRow(["ห้องที่มีผู้เช่า", occupiedRooms + " ห้อง", nowStr]);
  sheet.appendRow(["ผู้เช่าลงทะเบียนทั้งหมด", tenants.length + " คน", nowStr]);
  sheet.appendRow(["ยอดรายรับรวมที่ได้รับแล้ว", totalIncome + " บาท", nowStr]);
  sheet.appendRow(["ยอดค้างชำระรวมคงเหลือ", totalOverdue + " บาท", nowStr]);
}

// --------------------------------------------------------------------------
// 2. ROOMS SHEET
// --------------------------------------------------------------------------
function writeRoomsSheet(ss, rooms) {
  var sheet = ss.getSheetByName("ROOMS");
  if (!sheet) {
    sheet = ss.insertSheet("ROOMS");
    sheet.appendRow(["ID ห้อง", "เลขห้อง/ชื่อห้อง", "ชั้นที่", "ค่าเช่า (บาท/เดือน)", "ผู้เช่าปัจจุบัน", "มิเตอร์ไฟล่าสุด", "มิเตอร์น้ำล่าสุด", "สถานะ"]);
  }
  sheet.getRange("A2:H100").clearContent();
  rooms.forEach(function(r) {
    var lastElec = r.lastElecMeter !== undefined ? r.lastElecMeter : 1000;
    var lastWater = r.lastWaterMeter !== undefined ? r.lastWaterMeter : 100;
    sheet.appendRow([r.id, r.name, r.floor, r.baseRent, r.currentTenantName || "-", lastElec, lastWater, r.status]);
  });
}

// --------------------------------------------------------------------------
// 3. TENANTS SHEET (WITH ID CARD & HOUSE REGISTRATION DOCUMENT LINKS)
// --------------------------------------------------------------------------
function writeTenantsSheet(ss, tenants, rooms) {
  var sheet = ss.getSheetByName("TENANTS");
  if (!sheet) {
    sheet = ss.insertSheet("TENANTS");
    sheet.appendRow(["ID ผู้เช่า", "ชื่อ-นามสกุล", "เลขบัตรประชาชน", "เบอร์โทร", "ห้องพัก", "วันเริ่มสัญญา", "วันหมดสัญญา", "เงินประกัน (บาท)", "รูปบัตรประชาชน", "รูปทะเบียนบ้าน"]);
  }
  sheet.getRange("A2:J200").clearContent();
  tenants.forEach(function(t) {
    var room = rooms.find(function(r) { return r.id === t.assignedRoomId; });
    var roomName = room ? room.name : (t.assignedRoomId || "-");
    
    var idCardDoc = (t.documents || []).find(function(d) { return d.category === 'idcard' || d.title.indexOf('บัตรประชาชน') !== -1; });
    var houseRegDoc = (t.documents || []).find(function(d) { return d.category === 'housereg' || d.title.indexOf('ทะเบียนบ้าน') !== -1; });
    
    var idCardLink = idCardDoc ? (idCardDoc.dataUrl || idCardDoc.fileName || "มีไฟล์แนบ") : "-";
    var houseRegLink = houseRegDoc ? (houseRegDoc.dataUrl || houseRegDoc.fileName || "มีไฟล์แนบ") : "-";

    sheet.appendRow([
      t.id, t.name, t.idCard, t.tel, roomName,
      t.startDate, t.endDate, t.deposit ? t.deposit.initialBail : 0,
      idCardLink, houseRegLink
    ]);
  });
}

// --------------------------------------------------------------------------
// 4. CONTRACTS SHEET
// --------------------------------------------------------------------------
function writeContractsSheet(ss, tenants, rooms) {
  var sheet = ss.getSheetByName("CONTRACTS");
  if (!sheet) {
    sheet = ss.insertSheet("CONTRACTS");
    sheet.appendRow(["ID สัญญา", "ชื่อผู้เช่า", "เลขบัตรประชาชน", "เบอร์โทร", "ห้องพัก", "วันเริ่มสัญญา", "วันหมดสัญญา", "เงินประกันสัญญา", "สถานะ"]);
  }
  sheet.getRange("A2:I200").clearContent();
  tenants.forEach(function(t) {
    var room = rooms.find(function(r) { return r.id === t.assignedRoomId; });
    var roomName = room ? room.name : "-";
    var status = "ปกติ";
    if (t.endDate) {
      var end = new Date(t.endDate);
      var now = new Date();
      if (end < now) status = "หมดสัญญา";
    }
    sheet.appendRow([
      "CTR_" + t.id, t.name, t.idCard, t.tel, roomName,
      t.startDate, t.endDate, t.deposit ? t.deposit.initialBail : 0, status
    ]);
  });
}

// --------------------------------------------------------------------------
// 5. INVOICES SHEET
// --------------------------------------------------------------------------
function writeInvoicesSheet(ss, invoices) {
  var sheet = ss.getSheetByName("INVOICES");
  if (!sheet) {
    sheet = ss.insertSheet("INVOICES");
    sheet.appendRow([
      "เลขที่บิล", "รอบเดือน", "ห้องพัก", "ชื่อผู้เช่า", "วันที่ออกบิล", "กำหนดชำระ",
      "ไฟครั้งก่อน", "ไฟครั้งนี้", "ค่าไฟฟ้า",
      "น้ำครั้งก่อน", "น้ำครั้งนี้", "ค่าน้ำประปา",
      "ค่าเช่าห้อง", "ค่าขยะ", "ยอดรวมสุทธิ (บาท)", "สถานะการชำระ"
    ]);
  }
  sheet.getRange("A2:P300").clearContent();
  invoices.forEach(function(inv) {
    sheet.appendRow([
      inv.invoiceNumber, inv.monthKey, inv.roomName, inv.tenantName, inv.issueDate, inv.dueDate,
      inv.elecPrev, inv.elecCurr, inv.elecAmount,
      inv.waterPrev, inv.waterCurr, inv.waterAmount,
      inv.rentAmount, inv.trashFee || 20, inv.totalAmount, inv.status
    ]);
  });
}

// --------------------------------------------------------------------------
// 6. REPAIRS SHEET
// --------------------------------------------------------------------------
function writeRepairsSheet(ss, repairs) {
  var sheet = ss.getSheetByName("REPAIRS");
  if (!sheet) {
    sheet = ss.insertSheet("REPAIRS");
    sheet.appendRow(["เลขที่แจ้งซ่อม", "ห้องพัก", "ผู้แจ้ง/ผู้เช่า", "หัวข้อแจ้งซ่อม", "รายละเอียด", "ค่าใช้จ่าย (บาท)", "ช่างรับผิดชอบ", "วันที่แจ้ง", "สถานะ"]);
  }
  sheet.getRange("A2:I200").clearContent();
  repairs.forEach(function(rep) {
    sheet.appendRow([
      rep.ticketNumber, rep.roomName, rep.tenantName || "-", rep.title, rep.description || "",
      rep.expenseAmount || 0, rep.assignedTechnician || "-", rep.requestDate, rep.status
    ]);
  });
}

// --------------------------------------------------------------------------
// 7. ACCOUNTING LEDGER SHEET
// --------------------------------------------------------------------------
function writeLedgerSheet(ss, ledger) {
  var sheet = ss.getSheetByName("ACCOUNTING_LEDGER");
  if (!sheet) {
    sheet = ss.insertSheet("ACCOUNTING_LEDGER");
    sheet.appendRow(["ID รายการ", "วันที่", "ประเภท", "หมวดหมู่", "รายละเอียดรายการ", "จำนวนเงิน (บาท)", "บันทึกโดย"]);
  }
  sheet.getRange("A2:G300").clearContent();
  ledger.forEach(function(l) {
    sheet.appendRow([
      l.id, l.date, l.type === 'income' ? 'รายรับ' : 'รายจ่าย', l.category, l.description, l.amount, l.recordedBy || 'admin'
    ]);
  });
}

// --------------------------------------------------------------------------
// 8. CALENDAR EVENTS SHEET
// --------------------------------------------------------------------------
function writeEventsSheet(ss, events) {
  var sheet = ss.getSheetByName("CALENDAR_EVENTS");
  if (!sheet) {
    sheet = ss.insertSheet("CALENDAR_EVENTS");
    sheet.appendRow(["ID กิจกรรม", "วันที่นัดหมาย", "หัวข้อนัดหมาย/กิจกรรม", "หมวดหมู่", "ห้องที่เกี่ยวข้อง"]);
  }
  sheet.getRange("A2:E200").clearContent();
  events.forEach(function(evt) {
    sheet.appendRow([evt.id, evt.date, evt.title, evt.category, evt.roomName || "-"]);
  });
}

// --------------------------------------------------------------------------
// 9. USERS SHEET
// --------------------------------------------------------------------------
function writeUsersSheet(ss, users) {
  var sheet = ss.getSheetByName("USERS");
  if (!sheet) {
    sheet = ss.insertSheet("USERS");
    sheet.appendRow(["ID ผู้ใช้งาน", "Username", "ชื่อที่แสดง", "บทบาทสิทธิ์"]);
  }
  sheet.getRange("A2:D50").clearContent();
  users.forEach(function(u) {
    sheet.appendRow([u.id, u.username, u.displayName, u.role]);
  });
}
