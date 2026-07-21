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
    var raw = sheet.getRange(1, 1).getValue();
    var data = {};
    try { data = JSON.parse(raw || "{}"); } catch(err) { data = {}; }

    // Automatically read and merge any manual edits made directly in Google Sheets tabs!
    data = readAndMergeSheetTabs(ss, data);

    return ContentService.createTextOutput(JSON.stringify(data))
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
      sheet.getRange(1, 1).setValue(JSON.stringify(requestData.data));
      writeAllStructuredSheets(ss, requestData.data);

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "All data synced to Google Sheets successfully!" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid post action" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================================================
// 1. READ & MERGE MANUAL EDITS FROM GOOGLE SHEETS TABS BACK TO JSON
// ==========================================================================
function readAndMergeSheetTabs(ss, data) {
  if (!data.rooms) data.rooms = [];
  if (!data.tenants) data.tenants = [];
  if (!data.invoices) data.invoices = [];
  if (!data.repairs) data.repairs = [];
  if (!data.ledger) data.ledger = [];
  if (!data.events) data.events = [];
  if (!data.users) data.users = [];
  if (!data.rates) data.rates = { electricityRate: 8.0, waterRate: 20.0, trashFee: 20.0, customFees: [] };

  // A. Read RATES_AND_FEES Tab
  var ratesSheet = ss.getSheetByName("RATES_AND_FEES");
  if (ratesSheet) {
    var rateValues = ratesSheet.getRange("A2:E100").getValues();
    rateValues.forEach(function(row) {
      var id = String(row[0]).trim();
      var name = String(row[1]).trim();
      var val = Number(row[3]);
      if (id === 'RATE_ELEC') data.rates.electricityRate = val || 8.0;
      else if (id === 'RATE_WATER') data.rates.waterRate = val || 20.0;
      else if (id === 'RATE_TRASH') data.rates.trashFee = val || 20.0;
      else if (id.indexOf('fee_') === 0 && name) {
        var existing = (data.rates.customFees || []).find(function(f) { return f.id === id; });
        if (existing) {
          existing.name = name;
          existing.amount = val || 0;
          if (row[4]) existing.note = String(row[4]);
        }
      }
    });
  }

  // B. Read ROOMS Tab
  var rSheet = ss.getSheetByName("ROOMS");
  if (rSheet) {
    var rValues = rSheet.getRange("A2:H100").getValues();
    rValues.forEach(function(row) {
      var id = String(row[0]).trim();
      var name = String(row[1]).trim();
      if (id || name) {
        var room = data.rooms.find(function(r) { return r.id === id || r.name === name; });
        if (room) {
          if (row[2]) room.floor = Number(row[2]);
          if (row[3]) room.baseRent = Number(row[3]);
          if (row[4] && row[4] !== "-") room.currentTenantName = String(row[4]);
          if (row[5] !== "") room.lastElecMeter = Number(row[5]);
          if (row[6] !== "") room.lastWaterMeter = Number(row[6]);
          if (row[7]) room.status = String(row[7]).trim();
        }
      }
    });
  }

  // C. Read TENANTS Tab
  var tSheet = ss.getSheetByName("TENANTS");
  if (tSheet) {
    var tValues = tSheet.getRange("A2:J200").getValues();
    tValues.forEach(function(row) {
      var id = String(row[0]).trim();
      var name = String(row[1]).trim();
      if (id || name) {
        var t = data.tenants.find(function(item) { return item.id === id || item.name === name; });
        if (t) {
          if (row[1]) t.name = String(row[1]).trim();
          if (row[2]) t.idCard = String(row[2]).trim();
          if (row[3]) t.tel = String(row[3]).trim();
          if (row[5]) t.startDate = formatDateString(row[5]);
          if (row[6]) t.endDate = formatDateString(row[6]);
        }
      }
    });
  }

  // D. Read INVOICES Tab
  var invSheet = ss.getSheetByName("INVOICES");
  if (invSheet) {
    var invValues = invSheet.getRange("A2:P300").getValues();
    invValues.forEach(function(row) {
      var invNum = String(row[0]).trim();
      if (invNum) {
        var inv = data.invoices.find(function(i) { return i.invoiceNumber === invNum; });
        if (inv) {
          if (row[6] !== "") inv.elecPrev = Number(row[6]);
          if (row[7] !== "") inv.elecCurr = Number(row[7]);
          if (row[8] !== "") inv.elecAmount = Number(row[8]);
          if (row[9] !== "") inv.waterPrev = Number(row[9]);
          if (row[10] !== "") inv.waterCurr = Number(row[10]);
          if (row[11] !== "") inv.waterAmount = Number(row[11]);
          if (row[12] !== "") inv.rentAmount = Number(row[12]);
          if (row[13] !== "") inv.trashFee = Number(row[13]);
          if (row[14] !== "") inv.totalAmount = Number(row[14]);
          if (row[15]) {
            var statusStr = String(row[15]).trim().toLowerCase();
            if (statusStr === 'paid' || statusStr === 'ชำระแล้ว') {
              inv.status = 'paid';
              inv.paidAmount = inv.totalAmount;
              inv.outstandingAmount = 0;
            } else if (statusStr === 'unpaid' || statusStr === 'ค้างชำระ') {
              inv.status = 'unpaid';
              inv.paidAmount = 0;
              inv.outstandingAmount = inv.totalAmount;
            }
          }
        }
      }
    });
  }

  // E. Read REPAIRS Tab
  var repSheet = ss.getSheetByName("REPAIRS");
  if (repSheet) {
    var repValues = repSheet.getRange("A2:I200").getValues();
    repValues.forEach(function(row) {
      var ticketNum = String(row[0]).trim();
      if (ticketNum) {
        var rep = data.repairs.find(function(r) { return r.ticketNumber === ticketNum; });
        if (rep) {
          if (row[3]) rep.title = String(row[3]);
          if (row[4]) rep.description = String(row[4]);
          if (row[5] !== "") rep.expenseAmount = Number(row[5]);
          if (row[6]) rep.assignedTechnician = String(row[6]);
          if (row[8]) {
            var st = String(row[8]).trim().toLowerCase();
            if (st === 'completed' || st === 'เสร็จสิ้น') rep.status = 'completed';
            else rep.status = 'pending';
          }
        }
      }
    });
  }

  return data;
}

function formatDateString(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "GMT+7", "yyyy-MM-dd");
  }
  return String(val).slice(0, 10);
}

// ==========================================================================
// 2. WRITE STRUCTURED SHEETS
// ==========================================================================
function writeAllStructuredSheets(ss, data) {
  writeDashboardSheet(ss, data);
  writeRoomsSheet(ss, data.rooms || []);
  writeTenantsSheet(ss, data.tenants || [], data.rooms || []);
  writeContractsSheet(ss, data.tenants || [], data.rooms || []);
  writeInvoicesSheet(ss, data.invoices || []);
  writeRepairsSheet(ss, data.repairs || []);
  writeLedgerSheet(ss, data.ledger || []);
  writeEventsSheet(ss, data.events || []);
  writeUsersSheet(ss, data.users || []);
  writeRatesSheet(ss, data.rates || {});
}

function writeRatesSheet(ss, rates) {
  var sheet = ss.getSheetByName("RATES_AND_FEES");
  if (!sheet) {
    sheet = ss.insertSheet("RATES_AND_FEES");
    sheet.appendRow(["ID รายการ", "ชื่อรายการค่าใช้จ่าย", "ประเภทการคิดเงิน", "อัตราค่าบริการ (บาท)", "หมายเหตุ"]);
  }
  sheet.getRange("A2:E100").clearContent();

  sheet.appendRow(["RATE_ELEC", "ค่าไฟฟ้าหลัก", "บาท / ยูนิต", rates.electricityRate || 8.0, "อัตราค่าไฟฟ้าหลัก"]);
  sheet.appendRow(["RATE_WATER", "ค่าน้ำประปาหลัก", "บาท / ยูนิต", rates.waterRate || 20.0, "อัตราค่าน้ำประปาหลัก"]);
  sheet.appendRow(["RATE_TRASH", "ค่าขยะ / สาธารณูปโภค", "บาท / เดือน", rates.trashFee !== undefined ? rates.trashFee : 20.0, "ค่าขยะประจำเดือน"]);

  var customFees = rates.customFees || [];
  customFees.forEach(function(fee) {
    var unitStr = fee.unitType === 'monthly' ? "บาท / เดือน" : "บาท / ยูนิต";
    sheet.appendRow([fee.id, fee.name, unitStr, fee.amount, fee.note || ""]);
  });
}

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
