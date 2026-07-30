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
  saveStateSafely(stateSheet, emptyData);
  
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
  DriveApp.getRootFolder(); // บังคับให้ระบบแสดงหน้าต่างอนุญาตสิทธิ์เข้าถึง Google Drive
  SpreadsheetApp.getActiveSpreadsheet(); // บังคับให้ระบบแสดงหน้าต่างอนุญาตสิทธิ์เข้าถึง Google Sheets
  Logger.log("ได้รับอนุญาตสิทธิ์การใช้งาน Google Drive, Google Sheets และ LINE API เรียบร้อยแล้ว!");
}

function doGet(e) {
  var action = (e && e.parameter) ? e.parameter.action : "get";
  var mergeParam = (e && e.parameter) ? e.parameter.merge : "";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("DB_STATE");
  if (!sheet) {
    sheet = ss.insertSheet("DB_STATE");
  }
  
  if (action === "get") {
    var raw = sheet.getRange(1, 1).getValue();
    var data = {};
    try { data = JSON.parse(raw || "{}"); } catch(err) { data = {}; }

    // ทำการดึงและผสานข้อมูลจากแผ่นงานด้วยมือ เฉพาะเมื่อกดปุ่มดึงข้อมูลโดยระบุ &merge=true
    if (mergeParam === "true" || mergeParam === true) {
      data = readAndMergeSheetTabs(ss, data);
      // เซฟข้อมูลที่ผสานกลับเข้าไปใน DB_STATE เสมอ
      saveStateSafely(sheet, data);
    }

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

    if (action === "archiveInvoices") {
      var monthKey = requestData.monthKey;
      var archiveInvoices = requestData.invoices || [];
      if (!monthKey) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Missing monthKey parameter" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var sheetName = "สำรองบิล_" + monthKey;
      var archiveSheet = ss.getSheetByName(sheetName);
      if (archiveSheet) {
        archiveSheet.clear();
      } else {
        archiveSheet = ss.insertSheet(sheetName);
      }
      
      var headers = [
        "เลขที่บิล", "รอบเดือน", "ห้องพัก", "ชื่อผู้เช่า", "วันที่ออกบิล", "กำหนดชำระ",
        "ไฟครั้งก่อน", "ไฟครั้งนี้", "ค่าไฟฟ้า",
        "น้ำครั้งก่อน", "น้ำครั้งนี้", "ค่าน้ำประปา",
        "ค่าเช่าห้อง", "ค่าขยะ", "ยอดรวมสุทธิ (บาท)", "สถานะการชำระ", "หลักฐานการโอนเงิน (สลิป)"
      ];
      archiveSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#e2e8f0");
      
      if (archiveInvoices.length > 0) {
        var rows = archiveInvoices.map(function(inv) {
          var statusStr = (inv.status === 'paid') ? 'ชำระแล้ว' : 'ค้างชำระ';
          var slipVal = "";
          if (inv.slipUrl) {
            if (inv.slipUrl === 'cash') {
              slipVal = "ชำระเงินสด";
            } else {
              slipVal = inv.slipUrl;
            }
          }
          return [
            inv.invoiceNumber || "", inv.monthKey || "", inv.roomName || "", inv.tenantName || "", inv.issueDate || "", inv.dueDate || "",
            inv.elecPrev || 0, inv.elecCurr || 0, inv.elecAmount || 0,
            inv.waterPrev || 0, inv.waterCurr || 0, inv.waterAmount || 0,
            inv.rentAmount || 0, inv.trashFee !== undefined ? inv.trashFee : 20, inv.totalAmount || 0, statusStr, slipVal
          ];
        });
        archiveSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "ระบบสำรองบิลรอบเดือน " + monthKey + " ลงแผ่นงานเรียบร้อยแล้ว!" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. ซิงค์และบันทึกข้อมูลหลักจากหน้าเว็บแอดมิน
    var sheet = ss.getSheetByName("DB_STATE");
    if (!sheet) {
      sheet = ss.insertSheet("DB_STATE");
    }
    
    if (action === "sync" || requestData.data) {
      var syncData = requestData.data;
      if (syncData && syncData.invoices && Array.isArray(syncData.invoices)) {
        for (var i = 0; i < syncData.invoices.length; i++) {
          var inv = syncData.invoices[i];
          
          // คำนวณค่าปรับค้างชำระอัตโนมัติหากยังไม่ชำระเงิน
          if (inv.status === 'unpaid') {
            inv.fineAmount = getLateFeeAmount(inv.dueDate, inv.status, inv.fineAmount);
            inv.totalAmount = (inv.rentAmount || 0) + (inv.elecAmount || 0) + (inv.waterAmount || 0) + (inv.trashFee || 0) + (inv.fineAmount || 0);
            inv.outstandingAmount = inv.totalAmount - (inv.paidAmount || 0);
          }

          if (inv.slipUrl && inv.slipUrl.indexOf("data:") === 0) {
            // Run automatic payment slip verification
            var verifyResult = verifyPaymentSlip(inv, syncData);
            if (verifyResult.error) {
              throw new Error(verifyResult.message);
            }
            
            // If verification passes, save to Google Drive & replace base64 with Drive URL
            var filename = "slip_" + (inv.roomName || "room") + "_" + (inv.monthKey || "month") + "_" + Date.now();
            var driveUrl = saveBase64ImageToDrive(inv.slipUrl, filename);
            inv.slipUrl = driveUrl;
            
            // Clean up temporary client payload fields
            delete inv.slipHash;
            delete inv.qrPayload;
          }
        }
      }

      saveStateSafely(sheet, syncData);
      writeAllStructuredSheets(ss, syncData);

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
    var foundRtKeys = {};
    rtValues.forEach(function(row) {
      var id = String(row[0]).trim();
      var name = String(row[1]).trim();
      if (id || name) {
        foundRtKeys[id] = true;
        if (name) foundRtKeys[name] = true;
        
        var rt = data.roomTypes.find(function(t) { return t.id === id || t.name === name; });
        if (rt) {
          if (row[1]) rt.name = String(row[1]);
          if (row[2]) rt.rentalType = (String(row[2]).indexOf('รายวัน') !== -1 || String(row[2]).indexOf('daily') !== -1) ? 'daily' : 'monthly';
          if (row[3] !== "") rt.defaultRent = Number(row[3]);
          if (row[4]) rt.description = String(row[4]);
        } else {
          var newRt = {
            id: id || ("type_" + Date.now()),
            name: name || id,
            rentalType: (String(row[2]).indexOf('รายวัน') !== -1 || String(row[2]).indexOf('daily') !== -1) ? 'daily' : 'monthly',
            defaultRent: Number(row[3]) || 3500,
            description: String(row[4]) || ""
          };
          data.roomTypes.push(newRt);
        }
      }
    });
    // ลบประเภทห้องที่ไม่มีอยู่ในสเปรดชีต
    data.roomTypes = data.roomTypes.filter(function(rt) {
      return foundRtKeys[rt.id] || foundRtKeys[rt.name];
    });
  }

  // B. Read RATES_AND_FEES / อัตราค่าบริการ Tab
  var ratesSheet = ss.getSheetByName("อัตราค่าบริการ") || ss.getSheetByName("RATES_AND_FEES");
  if (ratesSheet) {
    var rateValues = ratesSheet.getRange("A2:E100").getValues();
    rateValues.forEach(function(row) {
      var id = String(row[0]).trim();
      var name = String(row[1]).trim();
      var rawVal = row[3];
      var val = Number(rawVal);
      if (id === 'RATE_ELEC') data.rates.electricityRate = (rawVal !== "" ? val : 8.0);
      else if (id === 'RATE_WATER') data.rates.waterRate = (rawVal !== "" ? val : 20.0);
      else if (id === 'RATE_TRASH') data.rates.trashFee = (rawVal !== "" ? val : 20.0);
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
    var foundRoomKeys = {};
    rValues.forEach(function(row) {
      var id = String(row[0]).trim();
      var name = String(row[1]).trim();
      if (id || name) {
        foundRoomKeys[id] = true;
        if (name) foundRoomKeys[name] = true;

        var room = data.rooms.find(function(r) { return r.id === id || r.name === name; });
        if (room) {
          if (row[2] !== "") room.floor = Number(row[2]);
          if (row[3] !== "") room.baseRent = Number(row[3]);
          if (row[4] && row[4] !== "-") room.currentTenantName = String(row[4]);
          if (row[5] !== "") room.lastElecMeter = Number(row[5]);
          if (row[6] !== "") room.lastWaterMeter = Number(row[6]);
          if (row[7]) room.status = String(row[7]).trim();
        } else {
          var defaultTypeId = (data.roomTypes && data.roomTypes.length > 0) ? data.roomTypes[0].id : "normal";
          var newRoom = {
            id: id || name || ("rm_" + Date.now()),
            name: name || id,
            floor: (row[2] !== "") ? Number(row[2]) : 1,
            typeId: defaultTypeId,
            baseRent: (row[3] !== "") ? Number(row[3]) : 3500,
            status: String(row[7]).trim() || "vacant",
            currentTenantName: (row[4] && row[4] !== "-") ? String(row[4]) : "",
            lastElecMeter: Number(row[5]) || 0,
            lastWaterMeter: Number(row[6]) || 0
          };
          data.rooms.push(newRoom);
        }
      }
    });
    // ลบห้องที่ไม่มีอยู่ในสเปรดชีต
    data.rooms = data.rooms.filter(function(r) {
      return foundRoomKeys[r.id] || foundRoomKeys[r.name];
    });
  }

  // D. Read TENANTS / ข้อมูลผู้เช่า Tab
  var tSheet = ss.getSheetByName("ข้อมูลผู้เช่า") || ss.getSheetByName("TENANTS") || ss.getSheetByName("ทะเบียนผู้เช่า");
  if (tSheet) {
    var tValues = tSheet.getRange("A2:J200").getValues();
    var foundTenantKeys = {};
    tValues.forEach(function(row) {
      var id = String(row[0]).trim();
      var name = String(row[1]).trim();
      if (id || name) {
        foundTenantKeys[id] = true;
        if (name) foundTenantKeys[name] = true;

        var t = data.tenants.find(function(item) { return item.id === id || item.name === name; });
        if (t) {
          if (row[1]) t.name = String(row[1]).trim();
          if (row[2]) t.idCard = String(row[2]).trim();
          if (row[3]) t.tel = String(row[3]).trim();
          if (row[5]) t.startDate = formatDateString(row[5]);
          if (row[6]) t.endDate = formatDateString(row[6]);
        } else {
          var newT = {
            id: id || name || ("t_" + Date.now()),
            name: name || id,
            idCard: String(row[2]).trim(),
            tel: String(row[3]).trim(),
            assignedRoomId: "",
            status: "active",
            startDate: formatDateString(row[5]),
            endDate: formatDateString(row[6])
          };
          data.tenants.push(newT);
        }
      }
    });
    // ลบผู้เช่าที่ไม่มีอยู่ในสเปรดชีต
    data.tenants = data.tenants.filter(function(t) {
      return foundTenantKeys[t.id] || foundTenantKeys[t.name];
    });
  }

  // E. Read INVOICES / รายการบิล Tab
  var invSheet = ss.getSheetByName("รายการบิล") || ss.getSheetByName("INVOICES") || ss.getSheetByName("รายการบิลค่าเช่า");
  if (invSheet) {
    var invValues = invSheet.getRange("A2:R300").getValues();
    var foundInvNumbers = {};
    invValues.forEach(function(row) {
      var invNum = String(row[0]).trim();
      if (invNum) {
        foundInvNumbers[invNum] = true;

        var inv = data.invoices.find(function(i) { return i.invoiceNumber === invNum; });
        var statusStr = String(row[16] || "").trim().toLowerCase();
        
        var rentAmt = Number(row[12]) || 0;
        var trashAmt = Number(row[13]) || 0;
        var sheetFine = Number(row[14]) || 0;
        
        var isPaid = (statusStr === 'paid' || statusStr === 'ชำระแล้ว');
        
        // คำนวณค่าปรับค้างชำระอัตโนมัติหากยังไม่ชำระเงิน
        var calculatedFine = sheetFine;
        if (!isPaid) {
          calculatedFine = getLateFeeAmount(formatDateString(row[5]), 'unpaid', sheetFine);
        }
        
        var elecAmount = Number(row[8]) || 0;
        var waterAmount = Number(row[11]) || 0;
        var totalAmt = rentAmt + elecAmount + waterAmount + trashAmt + calculatedFine;
        
        if (inv) {
          if (row[6] !== "") inv.elecPrev = Number(row[6]);
          if (row[7] !== "") inv.elecCurr = Number(row[7]);
          inv.elecAmount = elecAmount;
          if (row[9] !== "") inv.waterPrev = Number(row[9]);
          if (row[10] !== "") inv.waterCurr = Number(row[10]);
          inv.waterAmount = waterAmount;
          inv.rentAmount = rentAmt;
          inv.trashFee = trashAmt;
          inv.fineAmount = calculatedFine;
          inv.totalAmount = totalAmt;
          if (row[16]) {
            if (isPaid) {
              inv.status = 'paid';
              inv.paidAmount = totalAmt;
              inv.outstandingAmount = 0;
            } else {
              inv.status = 'unpaid';
              inv.paidAmount = 0;
              inv.outstandingAmount = totalAmt;
            }
          }
        } else {
          var newInv = {
            id: "inv_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            invoiceNumber: invNum,
            monthKey: String(row[1]).trim(),
            roomName: String(row[2]).trim(),
            tenantName: String(row[3]).trim(),
            issueDate: formatDateString(row[4]),
            dueDate: formatDateString(row[5]),
            elecPrev: Number(row[6]) || 0,
            elecCurr: Number(row[7]) || 0,
            elecAmount: elecAmount,
            waterPrev: Number(row[9]) || 0,
            waterCurr: Number(row[10]) || 0,
            waterAmount: waterAmount,
            rentAmount: rentAmt,
            trashFee: trashAmt,
            fineAmount: calculatedFine,
            totalAmount: totalAmt,
            status: isPaid ? 'paid' : 'unpaid',
            paidAmount: isPaid ? totalAmt : 0,
            outstandingAmount: isPaid ? 0 : totalAmt,
            slipUrl: String(row[17] || "")
          };
          data.invoices.push(newInv);
        }
      }
    });
    // ลบบิลที่ไม่มีอยู่ในสเปรดชีต
    data.invoices = data.invoices.filter(function(inv) {
      return foundInvNumbers[inv.invoiceNumber];
    });
  }

  // Read meter readings from "จดเลขอ่านน้ำไฟ"
  var readingsSheet = ss.getSheetByName("จดเลขอ่านน้ำไฟ");
  if (readingsSheet && readingsSheet.getLastRow() > 1) {
    var readingsValues = readingsSheet.getRange(2, 1, readingsSheet.getLastRow() - 1, 5).getValues();
    data.tempMeterReadings = [];
    readingsValues.forEach(function(row) {
      var rName = String(row[0]).trim();
      if (rName) {
        data.tempMeterReadings.push({
          roomName: rName,
          elecCurr: row[1] !== "" ? Number(row[1]) : null,
          waterCurr: row[2] !== "" ? Number(row[2]) : null,
          monthKey: String(row[3]).trim(),
          fineAmount: row[4] !== "" ? Number(row[4]) : 0
        });
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
  // รายชื่อแผ่นงานมาตรฐานที่เราต้องการเก็บไว้ใช้งานจริง (ภาษาไทยล้วน 12 แท็บ + DB_STATE 1 แท็บ + จดเลขอ่านน้ำไฟ 1 แท็บ)
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
    "ตั้งค่าระบบ": true,
    "จดเลขอ่านน้ำไฟ": true
  };

  // วนลูปตรวจสอบแผ่นงานทั้งหมดใน Google Sheets 
  // หากชื่อแผ่นงานใดไม่ได้อยู่ในระบบมาตรฐาน (เช่น ภาษาอังกฤษเดิม หรือแท็บขัดแย้ง/ซ้ำซ้อน) จะถูกลบทิ้งทันที
  var allSheets = ss.getSheets();
  allSheets.forEach(function(sh) {
    var name = sh.getName();
    if (name.indexOf("สำรองบิล_") === 0) {
      return; // ห้ามลบแท็บแผ่นงานสำรองข้อมูลเด็ดขาด
    }
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
  writeMeterReadingsSheet(ss, data.rooms || []);
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

  var sortedRooms = rooms.slice().sort(sortRoomsCustom);

  var rows = sortedRooms.map(function(r) {
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
    var idCardDoc = (t.documents || []).find(function(d) { return d.category === 'idcard' || (d.title && d.title.indexOf('บัตรประชาชน') !== -1); });
    var houseRegDoc = (t.documents || []).find(function(d) { return d.category === 'housereg' || (d.title && d.title.indexOf('ทะเบียนบ้าน') !== -1); });
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
    "ค่าเช่าห้อง", "ค่าขยะ", "ค่าปรับ", "ยอดรวมสุทธิ (บาท)", "สถานะการชำระ", "หลักฐานการโอนเงิน (สลิป)"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f1f5f9");

  if (!invoices || invoices.length === 0) return;

  var rows = invoices.map(function(inv) {
    var statusStr = (inv.status === 'paid') ? 'ชำระแล้ว' : 'ค้างชำระ';
    var slipVal = "";
    if (inv.slipUrl) {
      if (inv.slipUrl === 'cash') {
        slipVal = "ชำระเงินสด";
      } else {
        slipVal = inv.slipUrl;
      }
    }
    return [
      inv.invoiceNumber || "", inv.monthKey || "", inv.roomName || "", inv.tenantName || "", inv.issueDate || "", inv.dueDate || "",
      inv.elecPrev || 0, inv.elecCurr || 0, inv.elecAmount || 0,
      inv.waterPrev || 0, inv.waterCurr || 0, inv.waterAmount || 0,
      inv.rentAmount || 0, inv.trashFee !== undefined ? inv.trashFee : 20, inv.fineAmount || 0, inv.totalAmount || 0, statusStr, slipVal
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

// ==========================================================================
// บัญชีรายรับรายจ่าย
// ==========================================================================
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
    var responseText = response.getContentText();

    if (respCode === 200) {
      return { status: "success", message: "⚡ ส่งข้อความ LINE แจ้งเตือนเข้าโทรศัพท์ผู้เช่าเรียบร้อยแล้ว!" };
    } else {
      var errJson = {};
      try { errJson = JSON.parse(responseText); } catch(e){}
      return { status: "error", message: "LINE API Error (" + respCode + "): " + (errJson.message || responseText) };
    }
  } catch(err) {
    return { status: "error", message: err.toString() };
  }
}

/**
 * ฟังก์ชันแปลงสลิปโอนเงิน Base64 เป็นไฟล์ใน Google Drive
 * และคืนค่าเป็น Direct URL ที่สามารถกดเปิดดูรูปและลิงก์โดยตรงได้จากหน้าชีตแอดมิน
 */
function saveBase64ImageToDrive(base64Data, filename) {
  try {
    var split = base64Data.split(',');
    var contentType = split[0].match(/:(.*?);/)[1];
    var byteString = split[1];
    
    var decoded = Utilities.base64Decode(byteString);
    var blob = Utilities.newBlob(decoded, contentType, filename);
    
    // ค้นหาหรือสร้างโฟลเดอร์ชื่อ Sombat_Apartment_Slips ใน Google Drive
    var folderName = "Sombat_Apartment_Slips";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    var file = folder.createFile(blob);
    // ตั้งค่าสิทธิ์ให้ผู้ที่มีลิงก์เข้าดูรูปภาพได้โดยตรง
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // คืนค่าเป็น Direct Image URL เพื่อให้นำไปแสดงในแท็ก <img> ของระบบแอดมินได้ทันที
    return "https://docs.google.com/uc?export=download&id=" + file.getId();
  } catch (e) {
    Logger.log("Error saving base64 to Drive: " + e.toString());
    return base64Data; // คืนค่าตัวเดิมหากเกิดข้อผิดพลาด
  }
}

/**
 * ฟังก์ชันหลักในการตรวจสอบความถูกต้องของสลิปชำระเงิน (OCR + QR Code Decoded)
 * ป้องกันสลิปซ้ำ และเช็คชื่อบัญชีปลายทาง นางสมผิว น้ำวน (ธ.กรุงศรี 2401346663)
 */
function verifyPaymentSlip(inv, syncData) {
  var slipHash = inv.slipHash || "";
  var qrPayload = inv.qrPayload || "";
  var invoiceAmount = inv.totalAmount || 0;
  
  if (!syncData.settings) syncData.settings = {};
  if (!syncData.settings.usedSlipHashes) syncData.settings.usedSlipHashes = [];
  if (!syncData.settings.usedReferenceIds) syncData.settings.usedReferenceIds = [];
  
  // 1. ตรวจสอบ Image Hash ป้องกันอัปโหลดไฟล์ภาพซ้ำซ้อน
  if (slipHash) {
    if (syncData.settings.usedSlipHashes.indexOf(slipHash) !== -1) {
      return { error: true, message: "สลิปนี้เคยถูกนำมาใช้ชำระเงินในระบบแล้ว (ตรวจพบไฟล์ภาพซ้ำ)" };
    }
  }
  
  // 2. ดึงข้อมูลตัวหนังสือจากภาพ (OCR) โดยแปลงภาพเป็น Google Doc ชั่วคราว
  var ocrText = "";
  try {
    var blob = dataURItoBlob(inv.slipUrl);
    ocrText = performOcrOnImageBlob(blob);
  } catch (e) {
    Logger.log("OCR failed: " + e.toString());
  }
  
  // ตรวจสอบชื่อบัญชีปลายทางผู้รับโอน ("สมผิว" หรือ "น้ำวน")
  var hasReceiverName = (ocrText.indexOf("สมผิว") !== -1 || ocrText.indexOf("น้ำวน") !== -1 || ocrText.toLowerCase().indexOf("somphiw") !== -1 || ocrText.toLowerCase().indexOf("namwon") !== -1);
  // ตรวจสอบเลขบัญชีผู้รับเงิน ("2401346663" หรือ "240-1-34666-3")
  var hasReceiverAccount = (ocrText.indexOf("2401346663") !== -1 || ocrText.indexOf("240-1-34666-3") !== -1);
  
  // 3. แกะเลขอ้างอิง Reference ID และ ยอดเงินโอน
  var refId = "";
  var amountFound = 0;
  
  // 3.1 ดึงจาก QR Code (ถ้ามี)
  if (qrPayload) {
    var parsedQr = parseThaiQrPayload(qrPayload);
    if (parsedQr.refId) refId = parsedQr.refId;
    if (parsedQr.amount) amountFound = parsedQr.amount;
  }
  
  // 3.2 ดึงจาก OCR (กรณีเป็นไฟล์ PDF หรือหา QR ไม่เจอ)
  if (!refId) {
    refId = extractReferenceIdFromText(ocrText);
  }
  if (!amountFound) {
    amountFound = extractAmountFromText(ocrText, invoiceAmount);
  }
  
  // 4. ตรวจสอบความถูกต้องเปรียบเทียบกับเงื่อนไขในระบบ
  
  // 4.1 ตรวจสอบ Reference ID ซ้ำ (ป้องกันผู้เช่าใช้ QR หรือเลขอ้างอิงเดียวกันมาจ่ายซ้ำ)
  if (refId) {
    if (syncData.settings.usedReferenceIds.indexOf(refId) !== -1) {
      return { error: true, message: "เลขที่อ้างอิงธุรกรรมธนาคารนี้ (" + refId + ") เคยใช้ชำระเงินแล้ว (ตรวจจับการใช้สลิปซ้ำ)" };
    }
  }
  
  // 4.2 ตรวจสอบยอดเงินโอน (ต้องตรงกับยอดจริงในบิล 100%)
  if (amountFound > 0 && Math.abs(amountFound - invoiceAmount) > 0.01) {
    return { error: true, message: "ยอดเงินโอนบนสลิป (฿" + amountFound.toFixed(2) + ") ไม่ตรงกับยอดค้างชำระของบิลนี้ (฿" + invoiceAmount.toFixed(2) + ")" };
  }
  
  // 4.3 ตรวจสอบผู้รับโอนเงินปลายทาง (นางสมผิว น้ำวน หรือ ธ.กรุงศรี 240-1-34666-3)
  if (ocrText && !hasReceiverName && !hasReceiverAccount) {
    return { error: true, message: "ไม่พบข้อมูลชื่อบัญชี 'นางสมผิว น้ำวน' หรือเลขบัญชีปลายทาง '240-1-34666-3' บนสลิปนี้ กรุณาโอนเงินเข้าบัญชีที่ถูกต้องของหอพัก" };
  }
  
  // 5. บันทึกเข้าระบบประวัติสำเร็จ
  if (slipHash) {
    syncData.settings.usedSlipHashes.push(slipHash);
  }
  if (refId) {
    syncData.settings.usedReferenceIds.push(refId);
  }
  
  return { error: false, refId: refId, amountFound: amountFound };
}

function dataURItoBlob(dataURI) {
  var split = dataURI.split(',');
  var contentType = split[0].match(/:(.*?);/)[1];
  var byteString = Utilities.base64Decode(split[1]);
  return Utilities.newBlob(byteString, contentType, "temp_slip");
}

function performOcrOnImageBlob(blob) {
  var resource = {
    title: blob.getName(),
    mimeType: blob.getContentType()
  };
  var options = {
    ocr: true,
    ocrLanguage: "th"
  };
  
  // แปลงภาพเป็น Google Doc ชั่วคราว (จะรัน OCR อัตโนมัติโดย Drive Service)
  var docFile = Drive.Files.insert(resource, blob, options);
  var doc = DocumentApp.openById(docFile.id);
  var text = doc.getBody().getText();
  
  // ลบไฟล์ชั่วคราวทิ้งทันทีหลังอ่านข้อความเสร็จ
  try {
    Drive.Files.remove(docFile.id);
  } catch (e) {
    Logger.log("Cleanup temp doc failed: " + e.toString());
  }
  
  return text;
}

function parseThaiQrPayload(payload) {
  var result = { refId: "", amount: 0 };
  if (!payload) return result;
  
  // กรณีเป็น URL
  if (payload.indexOf("http") === 0) {
    var matches = payload.match(/[a-zA-Z0-9]{12,}/g);
    if (matches && matches.length > 0) {
      result.refId = matches[matches.length - 1];
    }
    return result;
  }
  
  // กรณีเป็นรหัส EMVCo มาตรฐาน
  if (payload.indexOf("000201") === 0) {
    var matches = payload.match(/[a-zA-Z0-9]{12,}/g);
    if (matches && matches.length > 0) {
      result.refId = matches[0];
    }
  }
  
  return result;
}

function extractReferenceIdFromText(text) {
  if (!text) return "";
  var patterns = [
    /(?:เลขที่อ้างอิง|เลขอ้างอิง|เลขที่รายการ|Ref|Transaction|Ref\.?\s?No\.?|Txn\s?ID)\s?:?\s?([a-zA-Z0-9\-\s]{10,25})/i,
    /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/
  ];
  
  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match && match[1]) {
      return match[1].replace(/[\s\-]/g, "");
    }
  }
  
  var matches = text.match(/[A-Z0-9]{12,25}/g);
  if (matches) {
    for (var j = 0; j < matches.length; j++) {
      if (isNaN(Number(matches[j]))) continue;
      return matches[j];
    }
  }
  
  return "";
}

function extractAmountFromText(text, targetAmount) {
  if (!text) return 0;
  var matches = text.match(/\b\d{1,3}(,\d{3})*\.\d{2}\b/g);
  if (matches) {
    for (var i = 0; i < matches.length; i++) {
      var num = Number(matches[i].replace(/,/g, ""));
      if (Math.abs(num - targetAmount) < 0.01) {
        return num;
      }
    }
    var maxNum = 0;
    for (var j = 0; j < matches.length; j++) {
      var numVal = Number(matches[j].replace(/,/g, ""));
      if (numVal > maxNum) maxNum = numVal;
    }
    return maxNum;
  }
  return 0;
}

/**
 * ฟังก์ชันสร้างและอัปเดตแท็บแผ่นงาน "จดเลขอ่านน้ำไฟ" เพื่อรองรับการจดมิเตอร์มือถือ
 */
function writeMeterReadingsSheet(ss, rooms) {
  var sheet = ss.getSheetByName("จดเลขอ่านน้ำไฟ");
  if (!sheet) sheet = ss.insertSheet("จดเลขอ่านน้ำไฟ");
  
  var headers = ["เลขห้อง", "มิเตอร์ไฟครั้งนี้ (ใหม่)", "มิเตอร์น้ำครั้งนี้ (ใหม่)", "รอบเดือน (เช่น 2026-07)", "ค่าปรับ (ถ้ามี)"];
  
  // ดึงค่าปัจจุบันที่แอดมินกรอกค้างไว้ในชีตก่อนเพื่อนำมาซิงค์ป้องกันข้อมูลเดิมหาย
  var currentValues = [];
  if (sheet.getLastRow() > 1) {
    currentValues = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  }
  
  var existingMap = {};
  currentValues.forEach(function(row) {
    var rName = String(row[0]).trim();
    if (rName) {
      existingMap[rName] = { elec: row[1], water: row[2], month: row[3], fine: row[4] };
    }
  });
  
  // เรียงลำดับห้องพักตามรูปแบบเดียวกันกับหน้าเว็บแอดมิน
  var sortedRooms = (rooms || []).slice().sort(sortRoomsCustom);
  
  var rows = sortedRooms.map(function(r) {
    var existing = existingMap[r.name] || {};
    return [
      r.name,
      existing.elec !== undefined ? existing.elec : "",
      existing.water !== undefined ? existing.water : "",
      existing.month !== undefined ? existing.month : "",
      existing.fine !== undefined ? existing.fine : ""
    ];
  });
  
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#e2e8f0");
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

/**
 * ฟังก์ชันเรียงลำดับห้องพักตามลำดับตัวอักษรของชื่อห้อง โดยให้กลุ่มห้องพักมาตรฐาน (S01, S02) ขึ้นก่อน
 * และชื่อห้องภาษาไทย (เช่น กรรณิการ์, แสงเงินแสงทอง) อยู่ลำดับถัดไป เพื่อให้ตรงกับแผงควบคุมระบบแอดมิน
 */
function sortRoomsCustom(a, b) {
  var nameA = String(a.name || '').trim();
  var nameB = String(b.name || '').trim();
  
  var isSA = /^s/i.test(nameA);
  var isSB = /^s/i.test(nameB);
  
  if (isSA && !isSB) return -1;
  if (!isSA && isSB) return 1;
  if (isSA && isSB) {
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  }
  
  var isNamedA = /^[^A-Za-z0-9]/i.test(nameA) || nameA.indexOf("บ้าน") === 0 || nameA.indexOf("เรือน") === 0;
  var isNamedB = /^[^A-Za-z0-9]/i.test(nameB) || nameB.indexOf("บ้าน") === 0 || nameB.indexOf("เรือน") === 0;
  
  if (isNamedA && !isNamedB) return 1;
  if (!isNamedA && isNamedB) return -1;
  
  return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * คำนวณค่าปรับค้างชำระจ่ายล่าช้าอัตโนมัติตามกำหนด:
 * - หากเกินวันครบกำหนดชำระแล้ว และอยู่ในวันที่ 5 - 15 ของรอบการชำระ: ปรับ 200 บาท
 * - หากเกินวันครบกำหนดชำระแล้ว และอยู่ในวันที่ 16 - สิ้นเดือน: ปรับ 300 บาท
 * - หากยังไม่เลยกำหนดชำระ: ปรับ 0 บาท
 */
function getLateFeeAmount(dueDateStr, status, currentFine) {
  var currentFineNum = Number(currentFine || 0);
  if (status === 'paid') {
    return currentFineNum;
  }
  
  if (!dueDateStr) return currentFineNum;
  
  try {
    var dueParts = dueDateStr.split('-');
    if (dueParts.length < 3) return currentFineNum;
    var dueYear = parseInt(dueParts[0], 10);
    var dueMonth = parseInt(dueParts[1], 10);
    var dueDay = parseInt(dueParts[2], 10);
    
    var dueDate = new Date(dueYear, dueMonth - 1, dueDay);
    var today = new Date();
    
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (today <= dueDate) {
      return currentFineNum; // ยังไม่เลยวันครบกำหนดจ่าย ให้ใช้ค่าปรับที่ระบุไว้ในจดเลข (ถ้ามี)
    }
    
    var todayYear = today.getFullYear();
    var todayMonth = today.getMonth() + 1;
    
    var lateFee = 0;
    // หากข้ามเดือนมาแล้ว ถือว่าเลยวันที่ 16 ของรอบบิลนั้นๆ แน่นอน ให้คิดค่าปรับสูงสุด 300 บาท
    if (todayYear > dueYear || (todayYear === dueYear && todayMonth > dueMonth)) {
      lateFee = 300;
    } else {
      var todayDay = today.getDate();
      if (todayDay >= 5 && todayDay <= 15) {
        lateFee = 200;
      } else if (todayDay >= 16) {
        lateFee = 300;
      } else {
        lateFee = 200; // กรณีพิเศษ: เลยกำหนดแต่วันปัจจุบันเป็นวันที่ 1-4
      }
    }
    
    // อัปเดตเฉพาะเมื่อค่าปรับสะสมปัจจุบันน้อยกว่าเกณฑ์ค่าปรับจ่ายล่าช้า
    // ป้องกันการสะสมเพิ่มขึ้นเรื่อยๆ ทุกครั้งที่ซิงค์ และยังเคารพค่าปรับอื่นๆ ที่แอดมินใส่ไว้สูงกว่าด้วย
    if (currentFineNum < lateFee) {
      return lateFee;
    }
    
    return currentFineNum;
  } catch(e) {
    return currentFineNum;
  }
}