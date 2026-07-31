// ==========================================================================
// GOOGLE APPS SCRIPT WEB APP - SOMBAT APARTMENT ENTERPRISE CLOUD BACKEND
// Deploy this script inside Google Sheets Apps Script editor (Extensions -> Apps Script)
// ==========================================================================

function AAA_AUTHORIZE_DRIVE_API() {
  Logger.log("เริ่มกระตุ้นการยืนยันสิทธิ์...");
  try {
    var folders = DriveApp.getFolders();
    if (folders.hasNext()) {
      Logger.log("สิทธิ์การใช้งาน DriveApp ปกติ: เรียบร้อย");
    }
    if (typeof Drive !== 'undefined' && Drive.Files) {
      Logger.log("สิทธิ์การใช้งาน Drive API ขั้นสูง: เรียบร้อย");
    }
  } catch (e) {
    Logger.log("พบข้อผิดพลาด: " + e.toString());
  }
}

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

/**
 * [ความปลอดภัย] ตั้งค่า API Secret Key เพื่อป้องกันไม่ให้บุคคลภายนอกที่ไม่รู้รหัสลับ
 * เรียกใช้ Web App นี้โดยตรง (ยิง GET/POST ข้ามหน้าเว็บแอดมิน) แล้วสั่งแก้ไข/อ่านข้อมูลได้ตามใจชอบ
 * วิธีใช้: เลือกฟังก์ชันนี้ในแถบเครื่องมือด้านบนแล้วกด "เรียกใช้" (Run) เพียงครั้งเดียว
 * จากนั้นเปิด Logger (ดู > บันทึก) เพื่อคัดลอกรหัสลับที่สร้างขึ้น แล้วนำไปใส่ในฝั่ง Frontend
 * ให้ส่งค่านี้มาเป็น "apiKey" แนบไปกับทุก request (ทั้ง query string ของ GET และ body JSON ของ POST)
 */
function setApiSecretKey() {
  var secret = Utilities.getUuid() + "-" + Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty("API_SECRET_KEY", secret);
  Logger.log("✅ ตั้งค่า API_SECRET_KEY เรียบร้อยแล้ว");
  Logger.log("🔑 รหัสลับของคุณคือ: " + secret);
  Logger.log("⚠️ กรุณาคัดลอกรหัสลับนี้ไปใส่ในโค้ดฝั่ง Frontend (เว็บแอดมิน) เป็นค่า apiKey ที่ส่งมาพร้อมทุกคำขอ มิฉะนั้นเว็บแอดมินจะเรียกใช้งานระบบไม่ได้อีกต่อไป");
}

/**
 * ตรวจสอบว่าคำขอ (Request) มี API Key ตรงกับที่ตั้งค่าไว้ใน Script Properties หรือไม่
 * หากยังไม่เคยรัน setApiSecretKey() เลย (ยังไม่มีการตั้งค่ารหัสลับ) จะปล่อยผ่านชั่วคราวพร้อมเตือนใน Log
 * เพื่อไม่ให้ระบบที่ deploy อยู่แล้วหยุดทำงานกะทันหัน แต่ควรรีบตั้งค่าโดยเร็วที่สุดเพื่อความปลอดภัย
 */
function isRequestAuthorized(providedKey) {
  var secret = PropertiesService.getScriptProperties().getProperty("API_SECRET_KEY");
  if (!secret) {
    Logger.log("⚠️⚠️⚠️ คำเตือนความปลอดภัย: ยังไม่ได้ตั้งค่า API_SECRET_KEY ระบบยังเปิดให้เรียกใช้ได้โดยไม่ต้องยืนยันตัวตน กรุณารันฟังก์ชัน setApiSecretKey() โดยด่วน!");
    return true;
  }
  return !!providedKey && providedKey === secret;
}

/**
 * [ความปลอดภัย] ตั้งค่า API Key แยกต่างหากสำหรับ "พอร์ทัลผู้เช่า" (tenant-app.js)
 * ต้องใช้รหัสคนละตัวกับ API_SECRET_KEY ของแอดมินโดยเด็ดขาด เพราะไฟล์ tenant-app.js เป็นไฟล์
 * ฝั่ง Frontend ที่เปิดเผยต่อสาธารณะ (ใครก็เปิดดูซอร์สโค้ดผ่านเบราว์เซอร์ได้) ถ้าใช้รหัสเดียวกับแอดมิน
 * จะเท่ากับเปิดเผยรหัสที่มีสิทธิ์เขียนทับฐานข้อมูลทั้งหมดให้คนภายนอกเห็นไปด้วย
 */
function setTenantApiKey() {
  var secret = Utilities.getUuid() + "-" + Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty("TENANT_API_KEY", secret);
  Logger.log("✅ ตั้งค่า TENANT_API_KEY เรียบร้อยแล้ว (สำหรับพอร์ทัลผู้เช่าเท่านั้น)");
  Logger.log("🔑 รหัสลับสำหรับผู้เช่าคือ: " + secret);
  Logger.log("⚠️ นำรหัสนี้ไปใส่ในไฟล์ tenant-app.js เท่านั้น ห้ามนำ API_SECRET_KEY (รหัสของแอดมิน) มาใส่ในไฟล์นี้เด็ดขาด");
}

function isTenantRequestAuthorized(providedKey) {
  var secret = PropertiesService.getScriptProperties().getProperty("TENANT_API_KEY");
  if (!secret) {
    Logger.log("⚠️⚠️⚠️ คำเตือนความปลอดภัย: ยังไม่ได้ตั้งค่า TENANT_API_KEY กรุณารันฟังก์ชัน setTenantApiKey() โดยด่วน!");
    return true;
  }
  return !!providedKey && providedKey === secret;
}

function jsonError(message) {
  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var action = (e && e.parameter) ? e.parameter.action : "get";
  var mergeParam = (e && e.parameter) ? e.parameter.merge : "";
  var providedKey = (e && e.parameter) ? e.parameter.apiKey : "";

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("DB_STATE");
  if (!sheet) {
    sheet = ss.insertSheet("DB_STATE");
  }

  // [พอร์ทัลผู้เช่า] คืนค่าเฉพาะรายชื่อห้อง (ไม่มีชื่อผู้เช่า/เลขบัตร/บิล) ใช้แสดงใน dropdown ก่อนล็อกอิน
  if (action === "getRoomList") {
    if (!isTenantRequestAuthorized(providedKey)) {
      return jsonError("Unauthorized: apiKey ไม่ถูกต้องหรือไม่ได้ระบุมา");
    }
    var listData = getLatestDbData(ss);
    var publicRooms = (listData.rooms || []).map(function(r) {
      // จงใจไม่ส่ง currentTenantName ออกไป เพราะเป็นข้อมูลระบุตัวตนผู้เช่าที่ไม่ควรเห็นได้ก่อนล็อกอิน
      return {
        id: r.id,
        name: r.name,
        floor: r.floor || 1,
        baseRent: r.baseRent || 0,
        lastElecMeter: r.lastElecMeter,
        lastWaterMeter: r.lastWaterMeter
      };
    });
    var listSettings = listData.settings || {};
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      rooms: publicRooms,
      apartmentName: listSettings.apartmentName || ""
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // [พอร์ทัลผู้เช่า] ยืนยันตัวตนด้วยเลขบัตรประชาชน + ห้องพัก ฝั่ง Server แล้วคืนค่าเฉพาะบิลของผู้เช่าคนนั้น
  // (ไม่คืนข้อมูลผู้เช่าคนอื่น/บิลของห้องอื่นออกไปเด็ดขาด ต่างจาก action=get ที่คืนฐานข้อมูลทั้งก้อน)
  if (action === "getTenantBill") {
    if (!isTenantRequestAuthorized(providedKey)) {
      return jsonError("Unauthorized: apiKey ไม่ถูกต้องหรือไม่ได้ระบุมา");
    }
    var idCardParam = String((e.parameter.idCard || "")).replace(/[^0-9]/g, "");
    var roomIdParam = e.parameter.roomId || "";
    if (idCardParam.length !== 13 || !roomIdParam) {
      return jsonError("ข้อมูลไม่ครบถ้วน กรุณาระบุเลขบัตรประชาชนและห้องพักให้ถูกต้อง");
    }

    var tenantData = getLatestDbData(ss);
    var tTenants = tenantData.tenants || [];
    var tInvoices = tenantData.invoices || [];
    var tRooms = tenantData.rooms || [];

    var tenantForRoom = tTenants.find(function(t) { return t.assignedRoomId === roomIdParam; });
    if (!tenantForRoom) {
      return jsonError("ไม่พบข้อมูลผู้เช่าลงทะเบียนในห้องพักนี้ กรุณาติดต่อผู้ดูแลระบบ");
    }
    var cleanTenantIdCard = String(tenantForRoom.idCard || "").replace(/[^0-9]/g, "");
    if (cleanTenantIdCard !== idCardParam) {
      return jsonError("เลขบัตรประชาชนไม่ถูกต้องสำหรับห้องพักที่เลือก กรุณาตรวจสอบอีกครั้ง");
    }

    var tRoom = tRooms.find(function(r) { return r.id === roomIdParam; }) || {};
    var matchedInvoices = tInvoices.filter(function(inv) {
      var cleanInvIdCard = String(inv.idCard || "").replace(/[^0-9]/g, "");
      if (cleanInvIdCard && cleanInvIdCard === idCardParam) return true;
      return inv.roomId === roomIdParam;
    });

    var tRepairs = tenantData.repairs || [];
    var matchedRepairs = tRepairs.filter(function(rep) {
      return rep.roomId === roomIdParam || rep.roomName === tRoom.name;
    });

    var tSettings = tenantData.settings || {};
    var safeSettings = {
      apartmentName: tSettings.apartmentName || "",
      promptPayId: tSettings.promptPayId || "",
      promptPayName: tSettings.promptPayName || "",
      promptPayBank: tSettings.promptPayBank || ""
    };

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      tenant: {
        id: tenantForRoom.id,
        name: tenantForRoom.name,
        idCard: tenantForRoom.idCard,
        tel: tenantForRoom.tel || "",
        assignedRoomId: roomIdParam
      },
      room: tRoom,
      invoices: matchedInvoices,
      repairs: matchedRepairs,
      events: tenantData.events || [],
      settings: safeSettings
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // [แอดมินเท่านั้น] Action อื่นๆ ทั้งหมด (โดยเฉพาะ action=get ที่คืนฐานข้อมูลทั้งก้อน) ต้องใช้ apiKey สิทธิ์เต็มของแอดมิน
  if (!isRequestAuthorized(providedKey)) {
    return jsonError("Unauthorized: apiKey ไม่ถูกต้องหรือไม่ได้ระบุมา");
  }
  
  if (action === "get") {
    var data = getLatestDbData(ss);

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

    // [พอร์ทัลผู้เช่า] บันทึกการชำระเงิน (โอน/เงินสด) ใช้รหัส TENANT_API_KEY ที่สิทธิ์จำกัดกว่า
    // Server จะยืนยันตัวตนผู้เช่าด้วยเลขบัตร+ห้องพักเองอีกครั้ง และแก้ไขเฉพาะบิลของผู้เช่าคนนั้นเท่านั้น
    // (ไม่รับ state ก้อนใหญ่จาก client เหมือน action=sync ของแอดมิน เพื่อไม่ให้ผู้เช่าเขียนทับข้อมูลคนอื่นได้)
    if (action === "submitTenantPayment") {
      if (!isTenantRequestAuthorized(requestData.apiKey)) {
        return jsonError("Unauthorized: apiKey ไม่ถูกต้องหรือไม่ได้ระบุมา");
      }
      return submitTenantPayment(ss, requestData);
    }

    if (action === "submitTenantRepair") {
      if (!isTenantRequestAuthorized(requestData.apiKey)) {
        return jsonError("Unauthorized: apiKey ไม่ถูกต้องหรือไม่ได้ระบุมา");
      }
      return submitTenantRepair(ss, requestData);
    }

    // [ความปลอดภัย] ตรวจสอบ API Key ก่อนอนุญาตให้ดำเนินการใดๆ ต่อ (ยกเว้น LINE Webhook และ submitTenantPayment ด้านบน)
    // ป้องกันไม่ให้บุคคลภายนอกที่ไม่รู้รหัสลับยิง POST เข้ามาสั่งแก้ไขข้อมูล เช่น ปลอมสถานะบิลเป็น "ชำระแล้ว" โดยไม่มีสลิปจริง
    if (!isRequestAuthorized(requestData.apiKey)) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unauthorized: apiKey ไม่ถูกต้องหรือไม่ได้ระบุมา" }))
        .setMimeType(ContentService.MimeType.JSON);
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
            } else if (inv.slipUrl.indexOf("data:") === 0) {
              slipVal = "สลิปโอนเงิน (Base64)";
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

      // [ความปลอดภัย] ล็อกการทำงานเพื่อป้องกัน Race Condition กรณีมีคำขอ sync เข้ามาพร้อมกันหลายคำขอ
      // ซึ่งอาจทำให้การตรวจสอบสลิปซ้ำ (duplicate slip) หลุดรอดออกไปได้หากไม่ล็อกไว้
      var syncLock = LockService.getScriptLock();
      try {
        syncLock.waitLock(30000);
      } catch (lockErr) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ระบบกำลังประมวลผลคำขออื่นอยู่ กรุณาลองใหม่อีกครั้งในอีกสักครู่" }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      try {
        if (syncData && syncData.invoices && Array.isArray(syncData.invoices)) {
          // [ความปลอดภัย] ดึงประวัติ "สลิปที่เคยใช้แล้ว" ตัวจริงจากฐานข้อมูลบนสเปรดชีต แทนที่จะเชื่อค่าที่ client ส่งมาเอง
          // เพราะ client (หรือผู้ไม่ประสงค์ดี) อาจตัดหรือแก้ไข usedSlipHashes/usedReferenceIds ใน payload
          // เพื่อทำให้สลิปเก่าที่เคยใช้แล้วผ่านการตรวจสอบซ้ำได้อีกครั้ง
          var persistedData = getLatestDbData(ss) || {};
          var persistedSettings = persistedData.settings || {};
          if (!syncData.settings) syncData.settings = {};
          syncData.settings.usedSlipHashes = Array.isArray(persistedSettings.usedSlipHashes) ? persistedSettings.usedSlipHashes.slice() : [];
          syncData.settings.usedReferenceIds = Array.isArray(persistedSettings.usedReferenceIds) ? persistedSettings.usedReferenceIds.slice() : [];

          for (var i = 0; i < syncData.invoices.length; i++) {
            var inv = syncData.invoices[i];

            // คำนวณค่าปรับค้างชำระอัตโนมัติหากยังไม่ชำระเงิน
            if (inv.status === 'unpaid') {
              inv.fineAmount = getLateFeeAmount(inv.dueDate, inv.status, inv.fineAmount);
              var tf = inv.trashFee !== undefined ? Number(inv.trashFee) : 20;
              inv.totalAmount = (inv.rentAmount || 0) + (inv.elecAmount || 0) + (inv.waterAmount || 0) + tf + (inv.fineAmount || 0);
              inv.outstandingAmount = inv.totalAmount - (inv.paidAmount || 0);
            }

            if (inv.slipUrl && inv.slipUrl.indexOf("data:") === 0) {
              var filename = "slip_" + (inv.roomName || "room") + "_" + (inv.monthKey || "month") + "_" + Date.now();
              var driveUrl;
              try {
                driveUrl = saveBase64ImageToDrive(inv.slipUrl, filename);
              } catch (driveErr) {
                throw new Error("บันทึกรูปสลิปลง Google Drive ไม่สำเร็จ (" + driveErr.toString() + ") กรุณาตรวจสอบพื้นที่ Drive คงเหลือ/สิทธิ์การใช้งาน แล้วลองใหม่อีกครั้ง");
              }
              inv.slipUrl = driveUrl;
            }
          }
        }

        saveStateSafely(sheet, syncData);
        writeAllStructuredSheets(ss, syncData);

        return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "All data synced to Google Sheets successfully!" }))
          .setMimeType(ContentService.MimeType.JSON);
      } finally {
        syncLock.releaseLock();
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid post action: " + action }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================================================
// TENANT PORTAL: SUBMIT PAYMENT (SCOPED - AFFECTS ONLY THE VERIFIED TENANT'S OWN INVOICE)
// ==========================================================================
/**
 * รับการชำระเงินจากพอร์ทัลผู้เช่า (tenant-app.js)
 * - ยืนยันตัวตนผู้เช่าด้วยเลขบัตรประชาชน + ห้องพัก จากข้อมูลจริงในระบบ (ไม่เชื่อ client)
 * - ตรวจสอบว่าบิลที่จะจ่ายเป็นของผู้เช่าคนนั้นจริง ป้องกันการจ่าย/มาร์คบิลห้องอื่นให้เป็น "จ่ายแล้ว"
 * - ใช้ getLatestDbData() ดึงข้อมูลจริงจากชีตมาแก้ไข ไม่รับ state ก้อนใหญ่จาก client เหมือน action=sync
 * - ข้อความแจ้งเตือน LINE ถูกสร้างขึ้นเองที่ฝั่ง Server เท่านั้น ผู้เช่าไม่สามารถกำหนดข้อความเองได้
 */
function submitTenantPayment(ss, requestData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return jsonError("ระบบกำลังประมวลผลคำขออื่นอยู่ กรุณาลองใหม่อีกครั้งในอีกสักครู่");
  }

  try {
    var idCardRaw = requestData.idCard || "";
    var roomId = requestData.roomId || "";
    var invoiceNumber = requestData.invoiceNumber || "";
    var paymentMethod = requestData.paymentMethod === "cash" ? "cash" : "transfer";
    var slipDataUrl = requestData.slipDataUrl || "";

    var cleanIdCard = String(idCardRaw).replace(/[^0-9]/g, "");
    if (cleanIdCard.length !== 13 || !roomId || !invoiceNumber) {
      return jsonError("ข้อมูลไม่ครบถ้วน ไม่สามารถบันทึกการชำระเงินได้");
    }

    var dbState = getLatestDbData(ss) || {};
    var tenants = dbState.tenants || [];
    var invoices = dbState.invoices || [];
    var rooms = dbState.rooms || [];

    // ยืนยันตัวตนผู้เช่าอีกครั้งฝั่ง Server ห้ามเชื่อแค่สิ่งที่ client อ้างว่าตัวเองคือใคร
    var tenantForRoom = tenants.find(function(t) { return t.assignedRoomId === roomId; });
    if (!tenantForRoom) {
      return jsonError("ไม่พบข้อมูลผู้เช่าของห้องนี้ในระบบ");
    }
    var cleanTenantIdCard = String(tenantForRoom.idCard || "").replace(/[^0-9]/g, "");
    if (cleanTenantIdCard !== cleanIdCard) {
      return jsonError("เลขบัตรประชาชนไม่ถูกต้อง ไม่สามารถชำระเงินแทนผู้เช่าห้องนี้ได้");
    }

    // ค้นหาบิลที่จะจ่าย และตรวจสอบว่าเป็นของผู้เช่าคนนี้จริง (กันจ่ายบิลแทนห้องอื่น)
    var invIdx = -1;
    for (var i = 0; i < invoices.length; i++) {
      if (invoices[i].invoiceNumber !== invoiceNumber) continue;
      var invIdCardClean = String(invoices[i].idCard || "").replace(/[^0-9]/g, "");
      var belongsToTenant = (invIdCardClean && invIdCardClean === cleanIdCard) || invoices[i].roomId === roomId;
      if (belongsToTenant) { invIdx = i; break; }
    }
    if (invIdx === -1) {
      return jsonError("ไม่พบบิลนี้ หรือบิลนี้ไม่ได้เป็นของห้องพักที่ล็อกอินอยู่");
    }

    var inv = invoices[invIdx];
    var room = rooms.find(function(r) { return r.id === roomId; }) || {};
    var todayStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");

    if (!dbState.settings) dbState.settings = {};
    dbState.settings.usedSlipHashes = Array.isArray(dbState.settings.usedSlipHashes) ? dbState.settings.usedSlipHashes : [];
    dbState.settings.usedReferenceIds = Array.isArray(dbState.settings.usedReferenceIds) ? dbState.settings.usedReferenceIds : [];

    if (paymentMethod === "transfer") {
      if (!slipDataUrl || slipDataUrl.indexOf("data:") !== 0) {
        return jsonError("กรุณาแนบรูปภาพสลิปโอนเงินให้ถูกต้อง");
      }
      inv.slipUrl = slipDataUrl;

      var filename = "slip_" + (inv.roomName || room.name || "room") + "_" + (inv.monthKey || "month") + "_" + Date.now();
      var driveUrl;
      try {
        driveUrl = saveBase64ImageToDrive(inv.slipUrl, filename);
      } catch (driveErr) {
        return jsonError("บันทึกรูปสลิปลง Google Drive ไม่สำเร็จ กรุณาลองอัปโหลดใหม่อีกครั้ง (หากยังไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ)");
      }
      inv.slipUrl = driveUrl;
      inv.status = "pending";
    } else {
      inv.slipUrl = "cash";
      inv.status = "pending";
    }

    inv.paidAmount = 0;
    inv.outstandingAmount = inv.totalAmount;
    inv.paymentDate = "";

    var dbSheet = ss.getSheetByName("DB_STATE");
    if (!dbSheet) dbSheet = ss.insertSheet("DB_STATE");
    saveStateSafely(dbSheet, dbState);
    writeAllStructuredSheets(ss, dbState);

    // แจ้งเตือนแอดมินผ่าน LINE ด้วยข้อความที่ Server สร้างขึ้นเอง (ผู้เช่ากำหนดข้อความเองไม่ได้ ป้องกันการยิงข้อความสแปม/หลอกลวง)
    try {
      var lineSettings = dbState.settings || {};
      var propToken = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");
      var channelToken = (lineSettings.lineToken && lineSettings.lineToken.trim())
        ? lineSettings.lineToken.trim()
        : ((propToken && propToken.trim()) ? propToken.trim() : DEFAULT_LINE_CHANNEL_ACCESS_TOKEN);
      var methodLabel = paymentMethod === "cash" ? "เงินสด" : "โอนเงิน (แนบสลิปแล้ว)";
      var msg = "🏠 " + (lineSettings.apartmentName || "หอพักสมบัติ นนทบุรี") + "\n\n📢 ผู้เช่าห้อง " +
        (inv.roomName || room.name || roomId) + " (" + (inv.tenantName || tenantForRoom.name || "ผู้เช่า") +
        ") ได้แจ้งชำระเงินเข้ามาแล้วด้วยวิธี " + methodLabel + "\nยอดเงิน: ฿" + Number(inv.totalAmount || 0).toLocaleString() +
        "\n\nกรุณาตรวจสอบและอนุมัติชำระเงินในระบบแอดมิน";
      if (channelToken && channelToken !== "YOUR_LINE_CHANNEL_ACCESS_TOKEN") {
        sendLinePushOrBroadcast(channelToken, msg, true);
      }
    } catch (notifyErr) {
      Logger.log("LINE notify after tenant payment failed: " + notifyErr.toString());
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "บันทึกการชำระเงินเรียบร้อยแล้ว", invoice: inv }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return jsonError(err.toString());
  } finally {
    lock.releaseLock();
  }
}

function submitTenantRepair(ss, requestData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return jsonError("ระบบกำลังประมวลผลคำขออื่นอยู่ กรุณาลองใหม่อีกครั้งในอีกสักครู่");
  }

  try {
    var idCardRaw = requestData.idCard || "";
    var roomId = requestData.roomId || "";
    var title = requestData.title || "";
    var description = requestData.description || "";
    var imageUrl = requestData.imageUrl || "";

    var cleanIdCard = String(idCardRaw).replace(/[^0-9]/g, "");
    if (cleanIdCard.length !== 13 || !roomId || !title) {
      return jsonError("ข้อมูลไม่ครบถ้วน กรุณากรอกหัวข้อแจ้งซ่อมและรายละเอียดให้ถูกต้อง");
    }

    var dbState = getLatestDbData(ss) || {};
    var tenants = dbState.tenants || [];
    var rooms = dbState.rooms || [];
    var repairs = dbState.repairs || [];

    var tenant = tenants.find(function(t) { return t.assignedRoomId === roomId; });
    if (!tenant) {
      return jsonError("ไม่พบข้อมูลผู้เช่าของห้องพักนี้");
    }
    var cleanTenantIdCard = String(tenant.idCard || "").replace(/[^0-9]/g, "");
    if (cleanTenantIdCard !== cleanIdCard) {
      return jsonError("เลขบัตรประชาชนไม่ถูกต้อง");
    }

    var room = rooms.find(function(r) { return r.id === roomId; }) || { name: roomId };

    // Process image if any (e.g. save to Google Drive)
    var driveUrl = "";
    if (imageUrl && imageUrl.indexOf("data:") === 0) {
      try {
        var filename = "repair_" + room.name + "_" + Date.now();
        driveUrl = saveBase64ImageToDrive(imageUrl, filename);
      } catch (driveErr) {
        Logger.log("Save repair image to Drive failed: " + driveErr.toString());
      }
    }

    // Generate ticket number MR-69-XXXX
    var ticketSeq = repairs.length + 1;
    var ticketNumber = "MR-69-" + String(ticketSeq).padStart(4, "0");

    var newRepair = {
      id: "rep_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      ticketNumber: ticketNumber,
      roomId: roomId,
      roomName: room.name,
      tenantName: tenant.name,
      title: title,
      description: description,
      expenseAmount: 0,
      assignedTechnician: "-",
      requestDate: new Date().toISOString().slice(0, 10),
      status: "pending",
      imageUrl: driveUrl || imageUrl
    };

    repairs.push(newRepair);
    dbState.repairs = repairs;

    // Save state
    var dbStateSheet = ss.getSheetByName("DB_STATE");
    if (dbStateSheet) {
      saveStateSafely(dbStateSheet, dbState);
    }
    writeRepairsSheet(ss, repairs);

    // Notify landlord via LINE
    try {
      var lineSettings = dbState.settings || {};
      var propToken = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");
      var channelToken = (lineSettings.lineToken && lineSettings.lineToken.trim())
        ? lineSettings.lineToken.trim()
        : ((propToken && propToken.trim()) ? propToken.trim() : DEFAULT_LINE_CHANNEL_ACCESS_TOKEN);
      
      var msg = "🏠 " + (lineSettings.apartmentName || "หอพักสมบัติ นนทบุรี") + "\n\n🔧 แจ้งซ่อมใหม่จากผู้เช่า\n" +
                "--------------------------\n" +
                "ห้อง: " + room.name + "\n" +
                "ผู้แจ้ง: " + tenant.name + "\n" +
                "หัวข้อ: " + title + "\n" +
                "รายละเอียด: " + description + "\n" +
                "เลขใบแจ้งซ่อม: " + ticketNumber;
      if (driveUrl) {
        msg += "\n🔗 ดูรูปภาพ: " + driveUrl;
      }
      
      if (channelToken && channelToken !== "YOUR_LINE_CHANNEL_ACCESS_TOKEN") {
        sendLinePushOrBroadcast(channelToken, msg, true);
      }
    } catch (notifyErr) {
      Logger.log("Notify landlord for new repair failed: " + notifyErr.toString());
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "ส่งใบแจ้งซ่อมเรียบร้อยแล้ว", repair: newRepair }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return jsonError(err.toString());
  } finally {
    lock.releaseLock();
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
        var isPending = (statusStr === 'pending' || statusStr === 'รอตรวจสอบ');
        
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
          inv.slipUrl = (function(val) {
            var s = String(val || "").trim();
            if (s.indexOf("http") === 0 || s.indexOf("data:") === 0) return s;
            return "";
          })(row[17]);
          if (row[16]) {
            if (isPaid) {
              inv.status = 'paid';
              inv.paidAmount = totalAmt;
              inv.outstandingAmount = 0;
            } else if (isPending) {
              inv.status = 'pending';
              inv.paidAmount = 0;
              inv.outstandingAmount = totalAmt;
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
            status: isPaid ? 'paid' : (isPending ? 'pending' : 'unpaid'),
            paidAmount: isPaid ? totalAmt : 0,
            outstandingAmount: isPaid ? 0 : totalAmt,
            slipUrl: (function(val) {
              var s = String(val || "").trim();
              if (s.indexOf("http") === 0 || s.indexOf("data:") === 0) return s;
              return "";
            })(row[17])
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
  if (!data || !data.rooms || !Array.isArray(data.rooms) || data.rooms.length === 0) {
    Logger.log("⚠️ Blocked writeAllStructuredSheets: incoming state has 0 rooms. Preventing data loss.");
    return;
  }
  // รายชื่อแผ่นงานมาตรฐานที่เราต้องการเก็บไว้ใช้งานจริง (ภาษาไทยล้วน 12 แท็บ + DB_STATE 1 แท็บ + จดเลขอ่านน้ำไฟ 1 แท็บ)
  var canonicalSheets = {
    "DB_STATE": true,
    "DB_STATE_BACKUP": true,
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

  if (!rooms || rooms.length === 0) {
    if (sheet.getLastRow() > 1) {
      Logger.log("⚠️ บล็อกการเขียนทับแท็บ 'ข้อมูลห้องพัก' ด้วยค่าว่าง");
      return;
    }
  }

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

  if (!tenants || tenants.length === 0) {
    if (sheet.getLastRow() > 1) {
      Logger.log("⚠️ บล็อกการเขียนทับแท็บ 'ข้อมูลผู้เช่า' ด้วยค่าว่าง");
      return;
    }
  }

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

  if (!tenants || tenants.length === 0) {
    if (sheet.getLastRow() > 1) {
      Logger.log("⚠️ บล็อกการเขียนทับแท็บ 'ทะเบียนสัญญา' ด้วยค่าว่าง");
      return;
    }
  }

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

  if (!invoices || invoices.length === 0) {
    if (sheet.getLastRow() > 1) {
      Logger.log("⚠️ บล็อกการเขียนทับแท็บ 'รายการบิล' ด้วยค่าว่าง");
      return;
    }
  }

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
    var statusStr = (inv.status === 'paid') ? 'ชำระแล้ว' : ((inv.status === 'pending') ? 'รอตรวจสอบ' : 'ค้างชำระ');
    var slipVal = "";
    if (inv.slipUrl) {
      if (inv.slipUrl === 'cash') {
        slipVal = "ชำระเงินสด";
      } else if (inv.slipUrl.indexOf("data:") === 0) {
        slipVal = "สลิปโอนเงิน (Base64)";
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

  if (!repairs || repairs.length === 0) {
    if (sheet.getLastRow() > 1) {
      Logger.log("⚠️ บล็อกการเขียนทับแท็บ 'รายการแจ้งซ่อม' ด้วยค่าว่าง");
      return;
    }
  }

  sheet.clear();

  var headers = ["เลขที่แจ้งซ่อม", "ห้องพัก", "ผู้แจ้ง/ผู้เช่า", "หัวข้อแจ้งซ่อม", "รายละเอียด", "ค่าใช้จ่าย (บาท)", "ช่างรับผิดชอบ", "วันที่แจ้ง", "สถานะ", "รูปภาพแนบ"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f1f5f9");

  if (!repairs || repairs.length === 0) return;

  var rows = repairs.map(function(rep) {
    return [
      rep.ticketNumber || "", rep.roomName || "", rep.tenantName || "-", rep.title || "", rep.description || "",
      rep.expenseAmount || 0, rep.assignedTechnician || "-", rep.requestDate || "", rep.status || "pending", rep.imageUrl || ""
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

  if (!ledger || ledger.length === 0) {
    if (sheet.getLastRow() > 1) {
      Logger.log("⚠️ บล็อกการเขียนทับแท็บ 'บัญชีรายรับรายจ่าย' ด้วยค่าว่าง");
      return;
    }
  }

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

  if (!events || events.length === 0) {
    if (sheet.getLastRow() > 1) {
      Logger.log("⚠️ บล็อกการเขียนทับแท็บ 'ปฏิทินกิจกรรม' ด้วยค่าว่าง");
      return;
    }
  }

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

  if (!users || users.length === 0) {
    if (sheet.getLastRow() > 1) {
      Logger.log("⚠️ บล็อกการเขียนทับแท็บ 'ผู้ใช้งานระบบ' ด้วยค่าว่าง");
      return;
    }
  }

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
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return {};
  var values = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  // กรองเฉพาะค่าที่ไม่ว่างเปล่าและเชื่อมต่อกันเป็น String เดียวกัน
  var raw = "";
  for (var i = 0; i < values.length; i++) {
    if (values[i] !== undefined && values[i] !== null && values[i] !== "") {
      raw += String(values[i]);
    }
  }
  try {
    var parsed = JSON.parse(raw || "{}");
    if (parsed && parsed.rooms && Array.isArray(parsed.rooms) && parsed.rooms.length > 0) {
      return parsed;
    }
    // ข้อมูลหลักอ่านได้แต่ไม่มีห้องพักเลย (ผิดปกติ) ลองกู้จากสำรองอัตโนมัติก่อนคืนค่าว่างเปล่า
    Logger.log("⚠️ DB_STATE ไม่มีข้อมูลห้องพัก (ผิดปกติ) กำลังลองอ่านจากสำรอง DB_STATE_BACKUP...");
    var recovered = readBackupDbState(ss);
    return recovered || parsed || {};
  } catch(e) {
    // [แก้ปัญหาข้อมูลหายปริศนา] เดิมโค้ดจุดนี้จะคืนค่า {} ว่างเปล่าทันทีที่ parse ไม่สำเร็จ
    // ซึ่งทำให้ทุกฟังก์ชันที่เรียกใช้ getLatestDbData() เข้าใจผิดว่า "ฐานข้อมูลว่างเปล่าจริงๆ"
    // แล้วเขียนทับด้วยข้อมูลว่างจนดูเหมือนข้อมูลหายทั้งระบบ ตอนนี้จึงลองกู้จากสำรองก่อนเสมอ
    Logger.log("❌ DB_STATE เสียหาย อ่านเป็น JSON ไม่สำเร็จ (" + e.toString() + ") กำลังลองอ่านจากสำรอง...");
    var recoveredOnError = readBackupDbState(ss);
    return recoveredOnError || {};
  }
}

/**
 * อ่านข้อมูลสำรองล่าสุดจากแท็บ DB_STATE_BACKUP (ใช้ตอน DB_STATE หลักเสียหายหรือว่างเปล่าผิดปกติ)
 * หมายเหตุ: ฟังก์ชันนี้แค่ "อ่าน" มาให้ระบบใช้งานต่อได้ทันที ไม่ได้เขียนทับ DB_STATE หลักให้อัตโนมัติ
 * ถ้าต้องการกู้คืนถาวรจริงๆ ให้รันฟังก์ชัน restoreDbStateFromBackup() เองอีกที
 */
function readBackupDbState(ss) {
  var backupSheet = ss.getSheetByName("DB_STATE_BACKUP");
  if (!backupSheet) return null;
  var lastCol = backupSheet.getLastColumn();
  if (lastCol < 1) return null;
  var values = backupSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var raw = "";
  for (var i = 0; i < values.length; i++) {
    if (values[i] !== undefined && values[i] !== null && values[i] !== "") raw += String(values[i]);
  }
  try {
    var parsed = JSON.parse(raw || "{}");
    if (parsed && parsed.rooms && Array.isArray(parsed.rooms) && parsed.rooms.length > 0) {
      Logger.log("✅ กู้ข้อมูลจากสำรองมาให้ใช้งานชั่วคราวสำเร็จ (ห้องพัก " + parsed.rooms.length + " ห้อง) — ยังไม่ได้เขียนทับ DB_STATE หลัก");
      return parsed;
    }
  } catch (e) {}
  return null;
}

/**
 * [กู้ข้อมูลฉุกเฉิน] รันฟังก์ชันนี้ด้วยตัวเอง (เลือกจากแถบเครื่องมือด้านบนแล้วกด Run) หาก DB_STATE หลักเสียหาย/ข้อมูลหาย
 * จะคัดลอกข้อมูลจากสำรองล่าสุดใน DB_STATE_BACKUP กลับเข้า DB_STATE หลัก และเขียนข้อมูลลงแท็บที่มองเห็นได้ทั้งหมดใหม่
 */
function restoreDbStateFromBackup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var recovered = readBackupDbState(ss);
  if (!recovered) {
    Logger.log("❌ ไม่พบข้อมูลสำรองที่ใช้งานได้ใน DB_STATE_BACKUP กู้คืนไม่สำเร็จ");
    return;
  }
  var dbSheet = ss.getSheetByName("DB_STATE");
  if (!dbSheet) dbSheet = ss.insertSheet("DB_STATE");
  saveStateSafely(dbSheet, recovered);
  writeAllStructuredSheets(ss, recovered);
  Logger.log("✅ กู้คืนข้อมูลจากสำรองสำเร็จ! ห้องพัก " + recovered.rooms.length + " ห้อง, ผู้เช่า " +
    (recovered.tenants || []).length + " คน, บิล " + (recovered.invoices || []).length + " รายการ");
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
  // [ความปลอดภัย/เสถียรภาพ] เดิมถ้าขั้นตอนนี้ล้มเหลว โค้ดจะ "คืนค่า base64Data ตัวเดิม" กลับไปแทน
  // ซึ่งแปลว่ารูปสลิปทั้งรูป (อาจยาวหลายแสนตัวอักษร) จะถูกเก็บเป็นข้อความลงในชีต DB_STATE โดยตรง
  // ทำให้ไฟล์บวมและเพิ่มความเสี่ยงข้อมูล JSON เสียหาย (ดูปัญหาที่เคยแก้ใน saveStateSafely/getLatestDbData)
  // ตอนนี้ถ้าบันทึกลง Drive ไม่สำเร็จ จะโยน error ออกไปแทน เพื่อให้ฝั่งที่เรียกใช้ปฏิเสธการชำระเงินนั้น
  // อย่างชัดเจนและให้ผู้เช่าลองอัปโหลดใหม่ แทนที่จะแอบเก็บรูปเป็นข้อความยาวๆ ไว้ในชีตอย่างเงียบๆ
  return "https://docs.google.com/uc?export=download&id=" + file.getId();
}

/**
 * ฟังก์ชันหลักในการตรวจสอบความถูกต้องของสลิปชำระเงิน (OCR + QR Code Decoded)
// ลบระบบตรวจสอบสลิปอัตโนมัติออกทั้งหมด เรียบร้อยเเล้ว เหลือเฉพาะการอัปโหลดไฟล์ไปบันทึกบน Google Drive
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

/**
 * ฟังก์ชันบันทึกข้อมูล JSON State หลัก (DB_STATE) ลงในสเปรดชีตอย่างปลอดภัย
 * เนื่องจากเซลล์ของ Google Sheets มีขีดจำกัดไม่เกิน 50,000 ตัวอักษรต่อหนึ่งเซลล์
 * ฟังก์ชันนี้จะทำการแบ่งสตริง JSON ออกเป็นส่วนๆ (Chunks) ส่วนละ 45,000 ตัวอักษร
 * แล้วกระจายเขียนเรียงคอลัมน์ไปทางขวา (A1, B1, C1, D1...) ป้องกันข้อจำกัดนี้โดยตรง
 */
function saveStateSafely(sheet, data) {
  try {
    if (!data || !data.rooms || !Array.isArray(data.rooms) || data.rooms.length === 0) {
      Logger.log("⚠️ Blocked saveStateSafely: incoming state has 0 rooms. Preventing data loss.");
      return;
    }

    // [ความปลอดภัย] สำรองข้อมูลชุดล่าสุดที่ยังใช้งานได้ไว้ก่อนเขียนทับทุกครั้ง (เก็บไว้แค่ชุดเดียว ล่าสุดเสมอ)
    // เผื่อกรณีการเขียนครั้งใหม่เกิดเสียหายโดยไม่คาดคิด จะสามารถกู้คืนได้ทันทีด้วย restoreDbStateFromBackup()
    try {
      backupCurrentDbState(sheet.getParent());
    } catch (backupErr) {
      Logger.log("⚠️ สำรองข้อมูลก่อนบันทึกไม่สำเร็จ (ยังคงบันทึกข้อมูลใหม่ต่อไป): " + backupErr.toString());
    }

    sheet.clear();
    var jsonStr = JSON.stringify(data);
    var chunkSize = 45000;
    var rowValues = [];
    
    for (var i = 0; i < jsonStr.length; i += chunkSize) {
      rowValues.push(jsonStr.substring(i, i + chunkSize));
    }
    
    if (rowValues.length > 0) {
      var range = sheet.getRange(1, 1, 1, rowValues.length);
      // [แก้ต้นเหตุปัญหาข้อมูลหายปริศนา] ต้องบังคับให้เซลล์เป็นชนิดข้อความ (Plain Text) เสมอ ก่อนใส่ค่า
      // มิฉะนั้น Google Sheets จะสุ่มตรวจพบว่าบางท่อนของ JSON ที่ตัดมาพอดีเป็นตัวเลขล้วนๆ (เช่นเลขบิล/ยอดเงิน/วันที่ติดกันยาวๆ)
      // แล้วแปลงเซลล์นั้นเป็นชนิด Number ให้อัตโนมัติ (ตัดเลข 0 นำหน้าทิ้ง/ปัดเป็น Scientific Notation) ทำให้ JSON เสียหาย
      // ทันทีที่อ่านกลับมาแล้ว JSON.parse ล้มเหลว ระบบเข้าใจผิดว่าฐานข้อมูลว่างเปล่าและเขียนทับข้อมูลจนดูเหมือนหายทั้งระบบ
      range.setNumberFormat("@");
      range.setValues([rowValues]);
      Logger.log("✅ บันทึก JSON State ลงสเปรดชีตอย่างปลอดภัยสำเร็จ: จำนวน " + rowValues.length + " คอลัมน์ (ความยาวรวม: " + jsonStr.length + " อักขระ)");
    }
  } catch(e) {
    Logger.log("❌ เกิดข้อผิดพลาดใน saveStateSafely: " + e.toString());
  }
}

/**
 * คัดลอกข้อมูล DB_STATE ปัจจุบัน (ก่อนจะถูกเขียนทับ) ไปเก็บไว้ที่แท็บ DB_STATE_BACKUP
 * จะสำรองก็ต่อเมื่อข้อมูลปัจจุบันยัง parse เป็น JSON ที่ถูกต้องและมีห้องพักอยู่จริงเท่านั้น (กันสำรองข้อมูลเสียทับของดี)
 */
function backupCurrentDbState(ss) {
  var liveSheet = ss.getSheetByName("DB_STATE");
  if (!liveSheet) return;
  var lastCol = liveSheet.getLastColumn();
  if (lastCol < 1) return;
  var values = liveSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var raw = "";
  for (var i = 0; i < values.length; i++) {
    if (values[i] !== undefined && values[i] !== null && values[i] !== "") raw += String(values[i]);
  }
  if (!raw) return;

  try {
    var parsed = JSON.parse(raw);
    if (!parsed || !parsed.rooms || !Array.isArray(parsed.rooms) || parsed.rooms.length === 0) return;
  } catch (e) {
    return; // ข้อมูลเดิมเสียอยู่แล้ว ไม่ต้องเอาไปสำรองทับของดีที่อาจสำรองไว้ก่อนหน้า
  }

  var backupSheet = ss.getSheetByName("DB_STATE_BACKUP");
  if (!backupSheet) backupSheet = ss.insertSheet("DB_STATE_BACKUP");
  backupSheet.clear();
  var chunkSize = 45000;
  var rowValues = [];
  for (var j = 0; j < raw.length; j += chunkSize) {
    rowValues.push(raw.substring(j, j + chunkSize));
  }
  if (rowValues.length > 0) {
    var backupRange = backupSheet.getRange(1, 1, 1, rowValues.length);
    backupRange.setNumberFormat("@");
    backupRange.setValues([rowValues]);
    backupSheet.getRange(2, 1).setValue("สำรองล่าสุดเมื่อ: " + Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss"));
  }
}

/**
 * ฟังก์ชันเรียกเพื่อให้ Google Apps Script กระตุ้นป๊อปอัปให้ผู้ใช้กดยอมรับสิทธิ์การเข้าใช้งาน Drive API (OAuth Consent)
 * เนื่องจากระบบมีความปลอดภัยและเรียกใช้ API ใหม่เพื่อประมวลผล OCR
 */
function authorizeProjectScopes() {
  Logger.log("เริ่มกระตุ้นการยืนยันสิทธิ์...");
  try {
    var folders = DriveApp.getFolders();
    if (folders.hasNext()) {
      Logger.log("สิทธิ์การใช้งาน DriveApp ปกติ: เรียบร้อย");
    }
    if (typeof Drive !== 'undefined' && Drive.Files) {
      Logger.log("สิทธิ์การใช้งาน Drive API ขั้นสูง: เรียบร้อย");
    }
  } catch (e) {
    Logger.log("พบข้อผิดพลาด: " + e.toString());
  }
}