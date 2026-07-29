// ==========================================================================
// GOOGLE APPS SCRIPT WEB APP - SOMBAT APARTMENT ENTERPRISE CLOUD BACKEND
// Deploy this script inside Google Sheets Apps Script editor (Extensions -> Apps Script)
// ==========================================================================

/**
 * ฟังก์ชันสำหรับล้างข้อมูลในระบบและ Google Sheets ทั้งหมดให้ว่างเปล่าเริ่มใหม่
 * ให้คุณเลือกฟังก์ชัน "clearAllDatabaseState" ในแถบเครื่องมือด้านบนของ Apps Script Editor แล้วกดปุ่ม "เรียกใช้" (Run)
 */
function clearAllDatabaseState() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. ล้างข้อมูลแผ่นงานเก็บ State หลัก (DB_STATE และ DB_STORE)
  var stateSheet = ss.getSheetByName("DB_STATE");
  if (stateSheet) {
    stateSheet.clear();
  }
  var storeSheet = ss.getSheetByName("DB_STORE");
  if (storeSheet) {
    try { ss.deleteSheet(storeSheet); } catch(e) {}
  }
  
  // 2. กำหนดโครงสร้างข้อมูลว่างเริ่มต้น
  var emptyData = {
    rooms: [],
    tenants: [],
    invoices: [],
    repairs: [],
    ledger: [],
    events: [],
    users: [],
    roomTypes: [],
    rates: { electricityRate: 8.0, waterRate: 20.0, trashFee: 20.0, customFees: [] },
    settings: {}
  };
  
  // เขียน JSON ข้อมูลว่างกลับไปที่ DB_STATE ช่อง A1
  if (!stateSheet) {
    stateSheet = ss.insertSheet("DB_STATE");
  }
  stateSheet.getRange(1, 1).setValue(JSON.stringify(emptyData));
  
  // 3. เขียนและสร้างโครงสร้างแผ่นงานภาษาไทยเปล่า (และลบแท็บอื่นๆ ที่ซ้ำซ้อนทิ้งทั้งหมด)
  writeAllStructuredSheets(ss, emptyData);
  
  Logger.log("⚡ ระบบได้ทำการล้างข้อมูลทั้งหมดใน Google Sheets และเตรียมแท็บภาษาไทยเริ่มต้นให้เรียบร้อยแล้ว!");
}

/**
 * ฟังก์ชันสำหรับกดปุ่ม "เรียกใช้" (Run) ใน Apps Script Editor 1 ครั้ง 
 * เพื่อกดปุ่ม "อนุญาตสิทธิ์" (Grant Authorization) ให้สคริปต์สามารถทำงานได้
 */
function testAuth() {
  UrlFetchApp.fetch("https://api.line.me", { muteHttpExceptions: true });
  Logger.log("ได้รับอนุญาตสิทธิ์ UrlFetchApp.fetch เรียบร้อยแล้ว!");
}

function doGet(e) {
  var action = (e && e.parameter) ? e.parameter.action : "get";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("DB_STATE");
  if (!sheet) {
    sheet = ss.insertSheet("DB_STATE");
  }
  
  if (action === "get") {
    var raw = sheet.getRange(1, 1).getValue();
    var data = {};
    try { data = JSON.parse(raw || "{}"); } catch(err) { data = {}; }

    // ดึงการแก้ไขด้วยมือจากหน้าชีตต่างๆ รวมกลับเข้าฐานข้อมูลหลัก
    data = readAndMergeSheetTabs(ss, data);

    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var contents = e ? (e.postData ? e.postData.contents : "") : "";
    if (!contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Empty POST body" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var requestData = JSON.parse(contents);
    var action = requestData ? requestData.action : "";
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. ตอบกลับ Webhook ของ LINE Messaging API
    if (requestData.events && Array.isArray(requestData.events)) {
      return handleLineWebhook(requestData.events, ss);
    }

    // 2. ส่งการแจ้งเตือนค่าเช่าทาง LINE จาก Admin Web App
    if (action === "linePushNotify") {
      var msgText = requestData.messageText;
      var invId = requestData.invoiceId;

      var data = getLatestDbData(ss);
      var settings = data.settings || {};
      var propToken = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");
      var channelToken = (settings.lineToken && settings.lineToken.trim()) 
        ? settings.lineToken.trim() 
        : ((propToken && propToken.trim()) ? propToken.trim() : DEFAULT_LINE_CHANNEL_ACCESS_TOKEN);

      if (!channelToken || channelToken === "YOUR_LINE_CHANNEL_ACCESS_TOKEN") {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "ยังไม่ได้กรอก LINE Channel Access Token ในระบบ! กรุณาไปที่เมนู 'ตั้งค่า' แล้วกรอก Token ก่อนครับ"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var pushRes = sendLinePushOrBroadcast(channelToken, msgText, invId === "ALL");
      return ContentService.createTextOutput(JSON.stringify(pushRes))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. ซิงค์และบันทึกข้อมูลหลักจากหน้าเว็บแอดมิน
    var sheet = ss.getSheetByName("DB_STATE");
    if (!sheet) {
      sheet = ss.insertSheet("DB_STATE");
    }
    
    if (action === "sync" || requestData.data) {
      sheet.getRange(1, 1).setValue(JSON.stringify(requestData.data));
      writeAllStructuredSheets(ss, requestData.data);

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "All data synced to Google Sheets successfully!" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid post action: " + action }))
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
  if (!data.roomTypes) data.roomTypes = [];
  if (!data.rates) data.rates = { electricityRate: 8.0, waterRate: 20.0, trashFee: 20.0, customFees: [] };
  if (!data.settings) data.settings = {};

  // Read SETTINGS / ตั้งค่าระบบ Tab
  var setSheet = ss.getSheetByName("ตั้งค่าระบบ") || ss.getSheetByName("SETTINGS") || ss.getSheetByName("ตั้งค่า_LINE_Bot");
  if (setSheet) {
    var setValues = setSheet.getRange("A2:C50").getValues();
    setValues.forEach(function(row) {
      var key = String(row[0]).trim();
      var val = String(row[1]).trim();
      if (key && val) {
        data.settings[key] = val;
      }
    });
  }

  // A. Read ROOM_TYPES / ประเภทห้องพัก Tab
  var rtSheet = ss.getSheetByName("ประเภทห้องพัก") || ss.getSheetByName("ROOM_TYPES");
  if (rtSheet) {
    var rtValues = rtSheet.getRange("A2:E100").getValues();
    rtValues.forEach(function(row) {
      var id = String(row[0]).trim();
      var name = String(row[1]).trim();
      if (id || name) {
        var rt = data.roomTypes.find(function(t) { return t.id === id || t.name === name; });
        if (rt) {
          if (row[1]) rt.name = String(row[1]);
          if (row[2]) rt.rentalType = (String(row[2]).indexOf('รายวัน') !== -1 || String(row[2]).indexOf('daily') !== -1) ? 'daily' : 'monthly';
          if (row[3] !== "") rt.defaultRent = Number(row[3]);
          if (row[4]) rt.description = String(row[4]);
        }
      }
    });
  }

  // B. Read RATES_AND_FEES / อัตราค่าบริการ Tab
  var ratesSheet = ss.getSheetByName("อัตราค่าบริการ") || ss.getSheetByName("RATES_AND_FEES");
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

  // C. Read ROOMS / ข้อมูลห้องพัก Tab
  var rSheet = ss.getSheetByName("ข้อมูลห้องพัก") || ss.getSheetByName("ROOMS") || ss.getSheetByName("ข้อมูลห้องเช่า");
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

  // D. Read TENANTS / ข้อมูลผู้เช่า Tab
  var tSheet = ss.getSheetByName("ข้อมูลผู้เช่า") || ss.getSheetByName("TENANTS") || ss.getSheetByName("ทะเบียนผู้เช่า");
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

  // E. Read INVOICES / รายการบิล Tab
  var invSheet = ss.getSheetByName("รายการบิล") || ss.getSheetByName("INVOICES") || ss.getSheetByName("รายการบิลค่าเช่า");
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
  // รายชื่อแผ่นงานมาตรฐานที่เราต้องการเก็บไว้ใช้งานจริง (ภาษาไทยล้วน 12 แท็บ + DB_STATE 1 แท็บ)
  var canonicalSheets = {
    "DB_STATE": true,
    "สรุปภาพรวม": true,
    "ประเภทห้องพัก": true,
    "ข้อมูลห้องพัก": true,
    "ข้อมูลผู้เช่า": true,
    "ทะเบียนสัญญา": true,
    "รายการบิล": true,
    "รายการแจ้งซ่อม": true,
    "บัญชีรายรับรายจ่าย": true,
    "ปฏิทินกิจกรรม": true,
    "ผู้ใช้งานระบบ": true,
    "อัตราค่าบริการ": true,
    "ตั้งค่าระบบ": true
  };

  // วนลูปตรวจสอบแผ่นงานทั้งหมดใน Google Sheets 
  // หากชื่อแผ่นงานใดไม่ได้อยู่ในระบบมาตรฐาน (เช่น ภาษาอังกฤษเดิม หรือแท็บขัดแย้ง/ซ้ำซ้อน) จะถูกลบทิ้งทันที
  var allSheets = ss.getSheets();
  allSheets.forEach(function(sh) {
    var name = sh.getName();
    if (!canonicalSheets[name]) {
      if (ss.getSheets().length > 1) {
        try { ss.deleteSheet(sh); } catch(e) {}
      }
    }
  });

  writeDashboardSheet(ss, data);
  writeRoomTypesSheet(ss, data.roomTypes || []);
  writeRoomsSheet(ss, data.rooms || []);
  writeTenantsSheet(ss, data.tenants || [], data.rooms || []);
  writeContractsSheet(ss, data.tenants || [], data.rooms || []);
  writeInvoicesSheet(ss, data.invoices || []);
  writeRepairsSheet(ss, data.repairs || []);
  writeLedgerSheet(ss, data.ledger || []);
  writeEventsSheet(ss, data.events || []);
  writeUsersSheet(ss, data.users || []);
  writeRatesSheet(ss, data.rates || {});
  writeSettingsSheet(ss, data.settings || {});
}

function writeSettingsSheet(ss, settings) {
  var sheet = ss.getSheetByName("ตั้งค่าระบบ");
  if (!sheet) sheet = ss.insertSheet("ตั้งค่าระบบ");
  sheet.clear();

  var headers = ["คีย์ตั้งค่า (Key)", "ค่าที่บันทึก (Value)", "คำอธิบาย (Description)"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f1f5f9");

  if (!settings) settings = {};
  var rows = [
    ["apartmentName", settings.apartmentName || "หอพักสมบัติ นนทบุรี", "ชื่อหอพัก"],
    ["lineToken", settings.lineToken || settings.lineChannelAccessToken || "", "LINE Channel Access Token (สำหรับ Bot)"],
    ["lineUserId", settings.lineUserId || "", "LINE User ID / Group ID"],
    ["lineNotifyToken", settings.lineNotifyToken || "", "LINE Notify Token"],
    ["promptPayId", settings.promptPayId || "", "หมายเลข PromptPay"],
    ["promptPayName", settings.promptPayName || "", "ชื่อบัญชี PromptPay"],
    ["promptPayBank", settings.promptPayBank || "", "ธนาคาร PromptPay"],
    ["googleSheetUrl", settings.googleSheetUrl || "", "Web App URL"]
  ];

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function writeRoomTypesSheet(ss, roomTypes) {
  var sheet = ss.getSheetByName("ประเภทห้องพัก");
  if (!sheet) sheet = ss.insertSheet("ประเภทห้องพัก");
  sheet.clear();

  var headers = ["ID ประเภท", "ชื่อประเภทห้องเช่า", "รูปแบบสัญญา", "อัตราค่าเช่า (บาท)", "รายละเอียด"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f1f5f9");

  if (!roomTypes || roomTypes.length === 0) return;

  var rows = roomTypes.map(function(rt) {
    var typeStr = rt.rentalType === 'daily' ? "สัญญารายวัน (Daily)" : "สัญญารายเดือน (Monthly)";
    return [rt.id || "", rt.name || "", typeStr, rt.defaultRent || 0, rt.description || ""];
  });
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function writeRatesSheet(ss, rates) {
  var sheet = ss.getSheetByName("อัตราค่าบริการ");
  if (!sheet) sheet = ss.insertSheet("อัตราค่าบริการ");
  sheet.clear();

  var headers = ["ID รายการ", "ชื่อรายการค่าใช้จ่าย", "ประเภทการคิดเงิน", "อัตราค่าบริการ (บาท)", "หมายเหตุ"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f1f5f9");

  var rows = [
    ["RATE_ELEC", "ค่าไฟฟ้าหลัก", "บาท / ยูนิต", rates.electricityRate || 8.0, "อัตราค่าไฟฟ้าหลัก"],
    ["RATE_WATER", "ค่าน้ำประปาหลัก", "บาท / ยูนิต", rates.waterRate || 20.0, "อัตราค่าน้ำประปาหลัก"],
    ["RATE_TRASH", "ค่าขยะ / สาธารณูปโภค", "บาท / เดือน", rates.trashFee !== undefined ? rates.trashFee : 20.0, "ค่าขยะประจำเดือน"]
  ];

  var customFees = rates.customFees || [];
  customFees.forEach(function(fee) {
    var unitStr = fee.unitType === 'monthly' ? "บาท / เดือน" : "บาท / ยูนิต";
    rows.push([fee.id, fee.name, unitStr, fee.amount, fee.note || ""]);
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function writeDashboardSheet(ss, data) {
  var sheet = ss.getSheetByName("สรุปภาพรวม");
  if (!sheet) sheet = ss.insertSheet("สรุปภาพรวม");
  sheet.clear();

  var headers = ["รายการสรุปภาพรวม", "จำนวน / มูลค่า (บาท)", "อัปเดตล่าสุด"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f1f5f9");

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

  var rows = [
    ["ห้องพักทั้งหมด", totalRooms + " ห้อง", nowStr],
    ["ห้องว่างพร้อมเช่า", vacantRooms + " ห้อง", nowStr],
    ["ห้องที่มีผู้เช่า", occupiedRooms + " ห้อง", nowStr],
    ["ผู้เช่าลงทะเบียนทั้งหมด", tenants.length + " คน", nowStr],
    ["ยอดรายรับรวมที่ได้รับแล้ว", totalIncome + " บาท", nowStr],
    ["ยอดค้างชำระรวมคงเหลือ", totalOverdue + " บาท", nowStr]
  ];

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function writeRoomsSheet(ss, rooms) {
  var sheet = ss.getSheetByName("ข้อมูลห้องพัก");
  if (!sheet) sheet = ss.insertSheet("ข้อมูลห้องพัก");
  sheet.clear();

  var headers = ["ID ห้อง", "เลขห้อง/ชื่อห้อง", "ชั้นที่", "ค่าเช่า (บาท)", "ผู้เช่าปัจจุบัน", "มิเตอร์ไฟล่าสุด", "มิเตอร์น้ำล่าสุด", "สถานะ"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f1f5f9");

  if (!rooms || rooms.length === 0) return;

  var rows = rooms.map(function(r) {
    var lastElec = r.lastElecMeter !== undefined ? r.lastElecMeter : 1000;
    var lastWater = r.lastWaterMeter !== undefined ? r.lastWaterMeter : 100;
    return [r.id || "", r.name || "", r.floor || 1, r.baseRent || 0, r.currentTenantName || "-", lastElec, lastWater, r.status || "vacant"];
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function writeTenantsSheet(ss, tenants, rooms) {
  var sheet = ss.getSheetByName("ข้อมูลผู้เช่า");
  if (!sheet) sheet = ss.insertSheet("ข้อมูลผู้เช่า");
  sheet.clear();

  var headers = ["ID ผู้เช่า", "ชื่อ-นามสกุล", "เลขบัตรประชาชน", "เบอร์โทร", "ห้องพัก", "วันเริ่มสัญญา", "วันหมดสัญญา", "เงินประกัน (บาท)", "รูปบัตรประชาชน", "รูปทะเบียนบ้าน"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f1f5f9");

  if (!tenants || tenants.length === 0) return;

  var rows = tenants.map(function(t) {
    var room = rooms.find(function(r) { return r.id === t.assignedRoomId; });
    var roomName = room ? room.name : (t.assignedRoomId || "-");
    var idCardDoc = (t.documents || []).find(function(d) { return d.category === 'idcard' || d.title.indexOf('บัตรประชาชน') !== -1; });
    var houseRegDoc = (t.documents || []).find(function(d) { return d.category === 'housereg' || d.title.indexOf('ทะเบียนบ้าน') !== -1; });
    var idCardLink = idCardDoc ? (idCardDoc.dataUrl || idCardDoc.fileName || "มีไฟล์แนบ") : "-";
    var houseRegLink = houseRegDoc ? (houseRegDoc.dataUrl || houseRegDoc.fileName || "มีไฟล์แนบ") : "-";

    return [
      t.id || "", t.name || "", t.idCard || "", t.tel || "", roomName,
      t.startDate || "", t.endDate || "", t.deposit ? t.deposit.initialBail : 0,
      idCardLink, houseRegLink
    ];
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function writeContractsSheet(ss, tenants, rooms) {
  var sheet = ss.getSheetByName("ทะเบียนสัญญา");
  if (!sheet) sheet = ss.insertSheet("ทะเบียนสัญญา");
  sheet.clear();

  var headers = ["ID สัญญา", "ชื่อผู้เช่า", "เลขบัตรประชาชน", "เบอร์โทร", "ห้องพัก", "วันเริ่มสัญญา", "วันหมดสัญญา", "เงินประกันสัญญา", "สถานะ"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f1f5f9");

  if (!tenants || tenants.length === 0) return;

  var rows = tenants.map(function(t) {
    var room = rooms.find(function(r) { return r.id === t.assignedRoomId; });
    var roomName = room ? room.name : "-";
    var status = "ปกติ";
    if (t.endDate) {
      var end = new Date(t.endDate);
      var now = new Date();
      if (end < now) status = "หมดสัญญา";
    }
    return [
      "CTR_" + t.id, t.name || "", t.idCard || "", t.tel || "", roomName,
      t.startDate || "", t.endDate || "", t.deposit ? t.deposit.initialBail : 0, status
    ];
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function writeInvoicesSheet(ss, invoices) {
  var sheet = ss.getSheetByName("รายการบิล");
  if (!sheet) sheet = ss.insertSheet("รายการบิล");
  sheet.clear();

  var headers = [
    "เลขที่บิล", "รอบเดือน", "ห้องพัก", "ชื่อผู้เช่า", "วันที่ออกบิล", "กำหนดชำระ",
    "ไฟครั้งก่อน", "ไฟครั้งนี้", "ค่าไฟฟ้า",
    "น้ำครั้งก่อน", "น้ำครั้งนี้", "ค่าน้ำประปา",
    "ค่าเช่าห้อง", "ค่าขยะ", "ยอดรวมสุทธิ (บาท)", "สถานะการชำระ"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f1f5f9");

  if (!invoices || invoices.length === 0) return;

  var rows = invoices.map(function(inv) {
    var statusStr = (inv.status === 'paid') ? 'ชำระแล้ว' : 'ค้างชำระ';
    return [
      inv.invoiceNumber || "", inv.monthKey || "", inv.roomName || "", inv.tenantName || "", inv.issueDate || "", inv.dueDate || "",
      inv.elecPrev || 0, inv.elecCurr || 0, inv.elecAmount || 0,
      inv.waterPrev || 0, inv.waterCurr || 0, inv.waterAmount || 0,
      inv.rentAmount || 0, inv.trashFee || 20, inv.totalAmount || 0, statusStr
    ];
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function writeRepairsSheet(ss, repairs) {
  var sheet = ss.getSheetByName("รายการแจ้งซ่อม");
  if (!sheet) sheet = ss.insertSheet("รายการแจ้งซ่อม");
  sheet.clear();

  var headers = ["เลขที่แจ้งซ่อม", "ห้องพัก", "ผู้แจ้ง/ผู้เช่า", "หัวข้อแจ้งซ่อม", "รายละเอียด", "ค่าใช้จ่าย (บาท)", "ช่างรับผิดชอบ", "วันที่แจ้ง", "สถานะ"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f1f5f9");

  if (!repairs || repairs.length === 0) return;

  var rows = repairs.map(function(rep) {
    return [
      rep.ticketNumber || "", rep.roomName || "", rep.tenantName || "-", rep.title || "", rep.description || "",
      rep.expenseAmount || 0, rep.assignedTechnician || "-", rep.requestDate || "", rep.status || "pending"
    ];
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function writeLedgerSheet(ss, ledger) {
  var sheet = ss.getSheetByName("บัญชีรายรับรายจ่าย");
  if (!sheet) sheet = ss.insertSheet("บัญชีรายรับรายจ่าย");
  sheet.clear();

  var headers = ["ID รายการ", "วันที่", "ประเภท", "หมวดหมู่", "รายละเอียดรายการ", "จำนวนเงิน (บาท)", "บันทึกโดย"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f1f5f9");

  if (!ledger || ledger.length === 0) return;

  var rows = ledger.map(function(l) {
    return [
      l.id || "", l.date || "", l.type === 'income' ? 'รายรับ' : 'รายจ่าย', l.category || "", l.description || "", l.amount || 0, l.recordedBy || 'admin'
    ];
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function writeEventsSheet(ss, events) {
  var sheet = ss.getSheetByName("ปฏิทินกิจกรรม");
  if (!sheet) sheet = ss.insertSheet("ปฏิทินกิจกรรม");
  sheet.clear();

  var headers = ["ID กิจกรรม", "วันที่นัดหมาย", "หัวข้อนัดหมาย/กิจกรรม", "หมวดหมู่", "ห้องที่เกี่ยวข้อง"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f1f5f9");

  if (!events || events.length === 0) return;

  var rows = events.map(function(evt) {
    return [evt.id || "", evt.date || "", evt.title || "", evt.category || "", evt.roomName || "-"];
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function writeUsersSheet(ss, users) {
  var sheet = ss.getSheetByName("ผู้ใช้งานระบบ");
  if (!sheet) sheet = ss.insertSheet("ผู้ใช้งานระบบ");
  sheet.clear();

  var headers = ["ID ผู้ใช้งาน", "Username", "ชื่อที่แสดง", "บทบาทสิทธิ์"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f1f5f9");

  if (!users || users.length === 0) return;

  var rows = users.map(function(u) {
    return [u.id || "", u.username || "", u.displayName || "", u.role || "staff"];
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

// ==========================================================================
// LINE BOT WEBHOOK HANDLER ENGINE
// ==========================================================================
var DEFAULT_LINE_CHANNEL_ACCESS_TOKEN = "YOUR_LINE_CHANNEL_ACCESS_TOKEN";

function handleLineWebhook(events, ss) {
  var propToken = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  var channelToken = (propToken && propToken.trim()) ? propToken.trim() : DEFAULT_LINE_CHANNEL_ACCESS_TOKEN;

  events.forEach(function(event) {
    if (event.type === "message") {
      var replyToken = event.replyToken;
      var userMsg = event.message.text ? event.message.text.trim() : "";
      var msgType = event.message.type;

      // 1. กรณีผู้เช่าส่งรูปสลิป
      if (msgType === "image") {
        var replyText = "🙏 ขอบคุณสำหรับสลิปการโอนเงินครับ!\n\nระบบได้รับรูปภาพสลิปเรียบร้อยแล้ว เจ้าหน้าที่จะทำการตรวจสอบและอัปเดตสถานะบิลให้อย่างเร่งด่วนครับ\n\n📲 ตรวจสอบสถานะบิลล่าสุดของคุณได้ทันที:\nhttps://sombat-apartment.vercel.app/tenant.html";
        sendLineReply(replyToken, replyText, channelToken);
        return;
      }

      // 2. กรณีผู้เช่าส่งข้อความตัวอักษร
      if (msgType === "text") {
        var cleanMsg = userMsg.toLowerCase().replace(/ห้อง|\s+/g, "");
        var data = getLatestDbData(ss);
        var invoices = data.invoices || [];

        // ค้นหาบิลประจำห้อง
        var matchedInv = invoices.find(function(inv) {
          var rName = String(inv.roomName || "").toLowerCase().replace(/ห้อง|\s+/g, "");
          var rId = String(inv.roomId || "").toLowerCase().replace(/ห้อง|\s+/g, "");
          return rName === cleanMsg || rId === cleanMsg || (cleanMsg.length > 0 && rName.indexOf(cleanMsg) !== -1);
        });

        if (matchedInv) {
          var isPaid = matchedInv.status === 'paid';
          var statusText = isPaid ? "✅ ชำระเงินเรียบร้อยแล้ว" : "🔴 รอชำระเงิน";
          var replyText = "🏠 หอพักสมบัติ นนทบุรี (ห้อง " + matchedInv.roomName + ")\n" +
            "----------------------------------------\n" +
            "👤 ผู้เช่า: " + (matchedInv.tenantName || "ผู้เช่า") + "\n" +
            "📅 ประจำเดือน: " + (matchedInv.monthKey || "ล่าสุด") + "\n" +
            "⚡ ค่าไฟ: ฿" + Number(matchedInv.elecAmount || 0).toLocaleString() + "\n" +
            "💧 ค่าน้ำ: ฿" + Number(matchedInv.waterAmount || 0).toLocaleString() + "\n" +
            "💰 ยอดบิลสุทธิ: ฿" + Number(matchedInv.totalAmount || 0).toLocaleString() + "\n" +
            "📌 สถานะ: " + statusText + "\n\n" +
            "📲 ตรวจสอบรายละเอียดเต็มและแนบสลิป:\n" +
            "https://sombat-apartment.vercel.app/tenant.html";
          
          sendLineReply(replyToken, replyText, channelToken);
          return;
        }

        // ค้นหาด้วยคำคีย์เวิร์ด บิล, เช็ค, น้ำ, ไฟ, ยอด
        if (cleanMsg.indexOf("บิล") !== -1 || cleanMsg.indexOf("น้ำ") !== -1 || cleanMsg.indexOf("ไฟ") !== -1 || cleanMsg.indexOf("ยอด") !== -1 || cleanMsg.indexOf("เช็ค") !== -1) {
          var replyText = "🏠 หอพักสมบัติ นนทบุรี\n\n📢 ระบบตรวจสอบบิลผ่าน LINE Bot\n\nกรุณาพิมพ์ \"เลขห้องพัก\" ของคุณ (เช่น S101 หรือ 101) เพื่อตรวจสอบยอดบิลประจำเดือนครับ\n\nหรือกดลิงก์เข้าสู่ระบบผู้เช่าเพื่อชำระเงินและแนบสลิป:\nhttps://sombat-apartment.vercel.app/tenant.html";
          sendLineReply(replyToken, replyText, channelToken);
          return;
        }

        // ข้อความต้อนรับและคำแนะนำการใช้งาน
        var replyText = "🏠 ยินดีต้อนรับสู่ LINE Official หอพักสมบัติ นนทบุรี\n\n" +
          "🔹 พิมพ์ \"เลขห้องพัก\" (เช่น S101 หรือ 101) เพื่อเช็คยอดบิล\n" +
          "🔹 พิมพ์ \"บิล\" เพื่อรับคำแนะนำการใช้งาน\n\n" +
          "📲 เข้าสู่ระบบผู้เช่า (ดูบิล / ชำระเงิน / แนบสลิป):\n" +
          "https://sombat-apartment.vercel.app/tenant.html";
        sendLineReply(replyToken, replyText, channelToken);
      }
    }
  });

  return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "LINE Event Processed" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sendLineReply(replyToken, textMessage, channelToken) {
  if (!replyToken || !channelToken || channelToken === "YOUR_LINE_CHANNEL_ACCESS_TOKEN") {
    Logger.log("LINE Reply skipped: Channel Access Token not configured.");
    return;
  }
  try {
    var url = "https://api.line.me/v2/bot/message/reply";
    var payload = {
      replyToken: replyToken,
      messages: [{ type: "text", text: textMessage }]
    };
    var options = {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + channelToken },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    UrlFetchApp.fetch(url, options);
  } catch(err) {
    Logger.log("Error sending LINE reply: " + err.toString());
  }
}

function getLatestDbData(ss) {
  var sheet = ss.getSheetByName("DB_STATE");
  if (!sheet) return {};
  var raw = sheet.getRange(1, 1).getValue();
  try {
    return JSON.parse(raw || "{}");
  } catch(e) {
    return {};
  }
}

function sendLinePushOrBroadcast(channelToken, messageText, isBroadcast) {
  try {
    var url = "https://api.line.me/v2/bot/message/broadcast";
    var payload = {
      messages: [{ type: "text", text: messageText }]
    };

    var options = {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + channelToken },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var respCode = response.getResponseCode();
    var respText = response.getContentText();

    if (respCode === 200) {
      return { status: "success", message: "⚡ ส่งข้อความ LINE แจ้งเตือนเข้าโทรศัพท์ผู้เช่าเรียบร้อยแล้ว!" };
    } else {
      var errJson = {};
      try { errJson = JSON.parse(respText); } catch(e){}
      return { status: "error", message: "LINE API Error (" + respCode + "): " + (errJson.message || respText) };
    }
  } catch(err) {
    return { status: "error", message: err.toString() };
  }
}
