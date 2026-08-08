// ==========================================================================
// SOMBAT APARTMENT (ENTERPRISE EDITION) - 100% COMPLETE APP CONTROLLER
// Fully Interactive 10 Modules: Dashboard, Contracts, Tenants, Rooms, Billing,
// Repairs, Accounting Ledger, Event Calendar, Reports & Settings System.
// Real-Time Supabase Cloud Engine
// ==========================================================================

/* ==========================================================================
   0. PASSWORD HASHING HELPER
   ให้แฮชรหัสผ่านด้วย SHA-256 ก่อนเก็บ/เปรียบเทียบ แทนการเก็บรหัสผ่านตัวจริง (plaintext)
   ไว้ใน localStorage หรือ Supabase โดยตรง (หมายเหตุ: ระบบนี้ยังตรวจสอบฝั่ง client
   เป็นหลักเพื่อคุมสิทธิ์การใช้งานหน้าเว็บ ไม่ใช่ระบบยืนยันตัวตนที่ทดแทนการป้องกันฝั่ง server
   การป้องกันข้อมูลจริงยังคงอยู่ที่ apiKey/TENANT_API_KEY ใน Code.gs)
   ========================================================================== */
async function sha256Hex(text) {
  try {
    if (window.crypto && crypto.subtle) {
      const data = new TextEncoder().encode(String(text));
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (cryptoErr) {
    console.warn("SubtleCrypto failed, using JS fallback:", cryptoErr);
  }

  // Pure JS SHA-256 fallback (works on file:/// and non-HTTPS local contexts)
  function sha256_js(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var lengthProperty = 'length';
    var i, j;
    var result = '';
    var words = [];
    var asciiLength = ascii[lengthProperty] * 8;
    var hash = sha256_js.h = sha256_js.h || [];
    var k = sha256_js.k = sha256_js.k || [];
    var primeCounter = k[lengthProperty];
    var isPrime = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isPrime[candidate]) {
        for (i = 0; i < 311; i += candidate) {
          isPrime[i] = 1;
        }
        hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1/3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return; // error
      words[i >> 2] |= j << ((3 - i % 4) * 8);
    }
    words[words[lengthProperty]] = ((asciiLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiLength | 0);
    var h0 = hash[0], h1 = hash[1], h2 = hash[2], h3 = hash[3],
        h4 = hash[4], h5 = hash[5], h6 = hash[6], h7 = hash[7];
    for (i = 0; i < words[lengthProperty]; i += 16) {
      var w = [];
      for (j = 0; j < 16; j++) w[j] = words[i + j];
      for (j = 16; j < 64; j++) {
        var wa = w[j - 15];
        var s0 = rightRotate(wa, 7) ^ rightRotate(wa, 18) ^ (wa >>> 3);
        var wb = w[j - 2];
        var s1 = rightRotate(wb, 17) ^ rightRotate(wb, 19) ^ (wb >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (j = 0; j < 64; j++) {
        var S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
        var S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;
        h = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }
      h0 = (h0 + a) | 0;
      h1 = (h1 + b) | 0;
      h2 = (h2 + c) | 0;
      h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0;
      h5 = (h5 + f) | 0;
      h6 = (h6 + g) | 0;
      h7 = (h7 + h) | 0;
    }
    var hex = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (i = 0; i < 8; i++) {
      var val = hex[i];
      if (val < 0) val += 0x100000000;
      var str = val.toString(16);
      while (str.length < 8) str = '0' + str;
      result += str;
    }
    return result;
  }
  return sha256_js(text);
}

// ตรวจสอบว่าค่านี้ "หน้าตาเหมือน" แฮช SHA-256 แล้วหรือยัง (เลขฐาน 16 ยาว 64 ตัวอักษร)
function looksLikeSha256Hash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

/* ==========================================================================
   1. USER PERMISSIONS & DEFINITIONS
   ========================================================================== */

const USER_PERMISSIONS = {
  super_admin: {
    canManageAdmins: true, canManageRooms: true, canManageTenants: true,
    canDeleteRecords: true, canManageBilling: true, canManageRates: true,
    canViewReports: true, canBackupRestore: true,
  },
  admin: {
    canManageAdmins: false, canManageRooms: true, canManageTenants: true,
    canDeleteRecords: true, canManageBilling: true, canManageRates: true,
    canViewReports: true, canBackupRestore: false,
  },
  staff: {
    canManageAdmins: false, canManageRooms: false, canManageTenants: false,
    canDeleteRecords: false, canManageBilling: true, canManageRates: false,
    canViewReports: false, canBackupRestore: false,
  }
};

// Helper function to resolve fees for a specific room (handling overrides)
function getRoomFees(room, rates) {
  if (!room) return { trashFee: 20, commonFee: 0, internetFee: 0 };
  const trashFee = (room.trashFee !== undefined && room.trashFee !== null && room.trashFee !== "")
    ? Number(room.trashFee)
    : (rates && rates.trashFee !== undefined ? Number(rates.trashFee) : 20);
  const commonFee = (room.commonFee !== undefined && room.commonFee !== null && room.commonFee !== "")
    ? Number(room.commonFee)
    : (rates && rates.commonFee !== undefined ? Number(rates.commonFee) : 0);
  const internetFee = (room.internetFee !== undefined && room.internetFee !== null && room.internetFee !== "")
    ? Number(room.internetFee)
    : (room.typeId === 'rt_air' ? (rates && rates.internetFee !== undefined ? Number(rates.internetFee) : 0) : 0);
  return { trashFee, commonFee, internetFee };
}

/* ==========================================================================
   2. UTILITY SERVICES (FORMATTERS, THAI BAHT TEXT & VALIDATORS)
   ========================================================================== */

class Formatters {
  static currency(amount) {
    return '฿' + (parseFloat(amount) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  static thaiDate(dateStr) {
    if (!dateStr) return '-';
    // If dateStr is YYYY-MM-DD (ISO format)
    if (String(dateStr).includes('-')) {
      const parts = String(dateStr).split('T')[0].split('-');
      if (parts.length === 3) {
        const yearBE = parseInt(parts[0], 10) + 543;
        const day = parts[2].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        return `${day}/${month}/${yearBE}`;
      }
    }
    return dateStr;
  }

  static parseThaiDateToISO(thDateStr) {
    if (!thDateStr) return new Date().toISOString().slice(0, 10);
    if (String(thDateStr).includes('/')) {
      const parts = String(thDateStr).split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let yearAD = parseInt(parts[2], 10);
        if (yearAD > 2400) yearAD -= 543;
        return `${yearAD}-${month}-${day}`;
      }
    }
    return thDateStr;
  }

  static thaiMonthBE(monthKey) {
    if (!monthKey) return '-';
    const parts = monthKey.split('-');
    if (parts.length !== 2) return monthKey;
    const yearBE = parseInt(parts[0], 10) + 543;
    const monthNum = parseInt(parts[1], 10);
    const months = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    return `${months[monthNum - 1]} ${yearBE}`;
  }

  static formatIdCard(idCard) {
    const clean = String(idCard || '').replace(/\D/g, '');
    if (clean.length !== 13) return idCard || '-';
    return `${clean.substring(0, 1)}-${clean.substring(1, 5)}-${clean.substring(5, 10)}-${clean.substring(10, 12)}-${clean.substring(12)}`;
  }

  static thaiBahtText(num) {
    num = parseFloat(num) || 0;
    if (num === 0) return 'ศูนย์บาทถ้วน';
    const numbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    
    let str = Math.floor(num).toString();
    let text = '';
    const len = str.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(str.charAt(i), 10);
      const pos = len - 1 - i;
      if (digit !== 0) {
        if (pos === 1 && digit === 1) text += 'สิบ';
        else if (pos === 1 && digit === 2) text += 'ยี่สิบ';
        else if (pos === 0 && digit === 1 && len > 1) text += 'เอ็ด';
        else text += numbers[digit] + units[pos];
      }
    }
    return text + 'บาทถ้วน';
  }
}

/* ==========================================================================
   3. SERVICES (AUTH, LOGGER, PROMPTPAY, LINE, EXPORT, DB & GOOGLE SHEETS)
   ========================================================================== */

class AuthService {
  static STORAGE_KEY = 'SOMBAT_APARTMENT_CURRENT_USER';

  static getCurrentUser() {
    const rawSession = sessionStorage.getItem(this.STORAGE_KEY);
    if (rawSession) {
      try { return JSON.parse(rawSession); } catch {}
    }
    return null;
  }

  static setCurrentUser(user, rememberMe = false) {
    if (user) {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      localStorage.removeItem(this.STORAGE_KEY);
    } else {
      localStorage.removeItem(this.STORAGE_KEY);
      sessionStorage.removeItem(this.STORAGE_KEY);
    }
  }

  static getPermissions(role) {
    return USER_PERMISSIONS[role] || USER_PERMISSIONS.staff;
  }
}

class LoggerService {
  static STORAGE_KEY = 'SOMBAT_APARTMENT_LOGS';

  static getLogs() {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  static log(username, userRole, action, module, details) {
    const logs = this.getLogs();
    const newLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      username, userRole, action, module, details
    };
    logs.unshift(newLog);
    if (logs.length > 500) logs.pop();
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
  }
}

class PromptPayService {
  static generatePayload(target, amount) {
    const sanitizedTarget = String(target || '0805991691').replace(/\D/g, '');
    let formattedTarget = '';

    if (sanitizedTarget.length === 10) {
      formattedTarget = '0066' + sanitizedTarget.substring(1);
    } else if (sanitizedTarget.length === 13) {
      formattedTarget = sanitizedTarget;
    } else {
      formattedTarget = '0066805991691';
    }

    const targetType = sanitizedTarget.length === 10 ? '01' : '02';
    const tag29_00 = '0016A000000677010111';
    const tag29_target = targetType + this.pad2(formattedTarget.length) + formattedTarget;
    const tag29_content = tag29_00 + tag29_target;
    const tag29 = '29' + this.pad2(tag29_content.length) + tag29_content;

    const tag53 = '5303764';
    let tag54 = '';
    if (amount && amount > 0) {
      const amtStr = amount.toFixed(2);
      tag54 = '54' + this.pad2(amtStr.length) + amtStr;
    }

    const tag58 = '5802TH';
    const rawPayload = '000201010212' + tag29 + tag53 + tag54 + tag58 + '6304';
    const crc = this.crc16(rawPayload);

    return rawPayload + crc;
  }

  static pad2(num) { return num < 10 ? '0' + num : '' + num; }

  static crc16(data) {
    let crc = 0xffff;
    for (let i = 0; i < data.length; i++) {
      let x = ((crc >> 8) ^ data.charCodeAt(i)) & 0xff;
      x ^= x >> 4;
      crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xffff;
    }
    return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  }
}

class LineService {
  static createBillingMessage(invoice, propertyName, tenantUrl, lineBotUrl, isBroadcast = false) {
    const aptName = propertyName || 'หอพักสมบัติ นนทบุรี';
    let url = tenantUrl || (localStorage.getItem('SOMBAT_TENANT_PORTAL_URL') || (window.location.origin + '/tenant.html'));
    const botUrl = lineBotUrl !== undefined ? lineBotUrl : (localStorage.getItem('SOMBAT_LINE_BOT_URL') || '');

    // Append sheetUrl + apiKey (สิทธิ์จำกัดสำหรับผู้เช่า) ไปกับลิงก์ ให้พอร์ทัลผู้เช่าดึงข้อมูลจริงได้
    const savedUrl = DBService.getSavedSupabaseUrl();
    const savedTenantKey = localStorage.getItem('SOMBAT_APARTMENT_SAVED_TENANT_API_KEY') || '';
    if (savedUrl) {
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}supabaseUrl=${encodeURIComponent(savedUrl)}`;
      if (savedTenantKey) url += `&apiKey=${encodeURIComponent(savedTenantKey)}`;
    }

    const greeting = (isBroadcast || !invoice || !invoice.tenantName) 
      ? 'เรียนผู้เช่าทุกท่าน' 
      : `เรียน คุณ${invoice.tenantName}`;

    let msg = `🏠 ${aptName}\n\n📢 แจ้งเตือนค่าเช่าประจำเดือน\n\n${greeting}\n\nระบบได้ออกบิลประจำเดือนเรียบร้อยแล้ว\n\nกรุณาเข้าสู่ระบบผู้เช่า\nเพื่อตรวจสอบรายละเอียดบิล\nและอัปโหลดหลักฐานการชำระเงิน\n\nกดที่นี่\n\n${url}`;

    if (botUrl && botUrl.trim()) {
      msg += `\n\nติดต่อสอบถาม / LINE Bot:\n${botUrl.trim()}`;
    }

    msg += `\n\nขอบคุณครับ`;

    return msg;
  }

  static createOverdueMessage(invoice, propertyName, tenantUrl, lineBotUrl) {
    const aptName = propertyName || 'หอพักสมบัติ นนทบุรี';
    let url = tenantUrl || (localStorage.getItem('SOMBAT_TENANT_PORTAL_URL') || (window.location.origin + '/tenant.html'));
    const botUrl = lineBotUrl !== undefined ? lineBotUrl : (localStorage.getItem('SOMBAT_LINE_BOT_URL') || '');

    const savedUrl = DBService.getSavedSupabaseUrl();
    const savedTenantKey = localStorage.getItem('SOMBAT_APARTMENT_SAVED_TENANT_API_KEY') || '';
    if (savedUrl) {
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}supabaseUrl=${encodeURIComponent(savedUrl)}`;
      if (savedTenantKey) url += `&apiKey=${encodeURIComponent(savedTenantKey)}`;
    }

    const greeting = (!invoice || !invoice.tenantName) 
      ? 'เรียนผู้เช่า' 
      : `เรียน คุณ${invoice.tenantName} (ห้อง ${invoice.roomName})`;

    const fineAmt = invoice.fineAmount || 0;
    const totalAmt = invoice.totalAmount || 0;

    let msg = `⚠️ แจ้งเตือนค้างชำระค่าเช่าเลยกำหนด ⚠️\n🏠 ${aptName}\n\n${greeting}\n\nขณะนี้บิลรอบเดือน ${invoice.monthKey} ของท่านยังไม่ได้ชำระและเลยกำหนดจ่ายแล้ว\n\n- ยอดค่าเช่าเดิม: ฿${(totalAmt - fineAmt).toLocaleString()}\n- ค่าปรับจ่ายล่าช้า: ฿${fineAmt.toLocaleString()}\n- ยอดค้างชำระรวม: ฿${totalAmt.toLocaleString()}\n\nกรุณาชำระเงินและแนบสลิปโดยด่วนที่สุดผ่านลิงก์ด้านล่างนี้ครับ:\n\n${url}`;

    if (botUrl && botUrl.trim()) {
      msg += `\n\nติดต่อสอบถาม / LINE Bot:\n${botUrl.trim()}`;
    }

    msg += `\n\nขอบคุณครับ`;

    return msg;
  }
}

class ExportService {
  static exportToCSV(filename, headers, rows) {
    let csvContent = '\uFEFF';
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      const escapedRow = row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`);
      csvContent += escapedRow.join(',') + '\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  static exportToExcel(filename, sheetsData) {
    if (typeof XLSX !== 'undefined') {
      try {
        const wb = XLSX.utils.book_new();
        for (const sheet of sheetsData) {
          const sheetName = sheet.name || 'Sheet1';
          const aoa = [sheet.headers, ...sheet.rows];
          const ws = XLSX.utils.aoa_to_sheet(aoa);
          
          const colWidths = sheet.headers.map((h, colIdx) => {
            let maxLen = String(h || '').length;
            sheet.rows.forEach(r => {
              const valLen = String(r[colIdx] || '').length;
              if (valLen > maxLen) maxLen = valLen;
            });
            return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
          });
          ws['!cols'] = colWidths;

          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
        const fname = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
        XLSX.writeFile(wb, fname);
        return true;
      } catch (err) {
        console.warn('XLSX export failed, falling back to CSV:', err);
      }
    }

    if (sheetsData && sheetsData.length > 0) {
      const primary = sheetsData[0];
      const fname = filename.replace(/\.xlsx$/i, '') + '.csv';
      this.exportToCSV(fname, primary.headers, primary.rows);
    }
  }

  static exportFullBackupExcel(state) {
    const dateStr = new Date().toISOString().slice(0, 10);
    const rooms = state.rooms || [];
    const tenants = state.tenants || [];
    const invoices = state.invoices || [];
    const repairs = state.repairs || [];

    const sheets = [
      {
        name: 'ข้อมูลผู้เช่า',
        headers: ['ชื่อ-นามสกุล', 'เลขบัตรประชาชน', 'เบอร์โทรศัพท์', 'อีเมล', 'ห้องพัก', 'วันที่เริ่มสัญญา', 'วันสิ้นสุดสัญญา'],
        rows: tenants.map(t => [t.name, t.idCard, t.tel, t.email || '-', t.assignedRoomId, t.startDate || '-', t.endDate || '-'])
      },
      {
        name: 'ข้อมูลห้องพัก',
        headers: ['รหัสห้อง', 'ชื่อห้อง', 'ชั้น', 'ราคาค่าเช่า', 'สถานะ', 'มิเตอร์ไฟล่าสุด', 'มิเตอร์น้ำล่าสุด'],
        rows: rooms.map(r => [r.id, r.name, r.floor, r.baseRent, r.status, r.lastElecMeter || 0, r.lastWaterMeter || 0])
      },
      {
        name: 'ใบแจ้งหนี้',
        headers: ['เลขที่ใบแจ้งหนี้', 'รอบเดือน', 'ห้องพัก', 'ชื่อผู้เช่า', 'ค่าเช่า', 'ค่าไฟ', 'ค่าน้ำ', 'ค่าขยะ', 'ยอดรวม', 'ยอดชำระแล้ว', 'ยอดค้างชำระ', 'สถานะ', 'วันกำหนดชำระ'],
        rows: invoices.map(i => [i.invoiceNumber, i.monthKey, i.roomName, i.tenantName, i.rentAmount, i.elecAmount, i.waterAmount, i.trashFee || 0, i.totalAmount, i.paidAmount || 0, i.outstandingAmount || 0, i.status, i.dueDate || '-'])
      },
      {
        name: 'รายการแจ้งซ่อม',
        headers: ['รหัสแจ้งซ่อม', 'ห้องพัก', 'หัวข้อ', 'รายละเอียด', 'สถานะ', 'วันที่แจ้ง'],
        rows: repairs.map(rp => [rp.id, rp.roomName || rp.roomId, rp.title, rp.description, rp.status, rp.createdAt || rp.date || '-'])
      }
    ];

    this.exportToExcel(`Sombat_Apartment_Backup_${dateStr}.xlsx`, sheets);
  }
}

class ImportService {
  static parseFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('ไม่พบไฟล์ที่เลือก'));
      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'json') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            resolve({ type: 'json', data });
          } catch (err) {
            reject(new Error('รูปแบบไฟล์ JSON ไม่ถูกต้อง: ' + err.message));
          }
        };
        reader.onerror = () => reject(new Error('อ่านไฟล์ JSON ไม่สำเร็จ'));
        reader.readAsText(file);
      } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        if (typeof XLSX === 'undefined') {
          return reject(new Error('ระบบอ่านไฟล์ Excel (SheetJS) ยังไม่พร้อมใช้งาน'));
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const result = {};

            workbook.SheetNames.forEach(sheetName => {
              const worksheet = workbook.Sheets[sheetName];
              const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
              if (jsonRows.length > 0) {
                result[sheetName] = {
                  headers: jsonRows[0],
                  rows: jsonRows.slice(1)
                };
              }
            });

            resolve({ type: 'excel', workbook: result, rawWorkbook: workbook });
          } catch (err) {
            reject(new Error('อ่านไฟล์ Excel ไม่สำเร็จ: ' + err.message));
          }
        };
        reader.onerror = () => reject(new Error('อ่านไฟล์ Excel ไม่สำเร็จ'));
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error('รองรับเฉพาะไฟล์ .xlsx, .csv หรือ .json เท่านั้น'));
      }
    });
  }
}

class DBService {
  static STORAGE_KEY = 'SOMBAT_APARTMENT_DB_STATE_V3';

  static getUniqueInvoices(invoices) {
    if (!invoices || !Array.isArray(invoices)) return [];
    const seen = new Set();
    const unique = [];
    const sorted = [...invoices].sort((a, b) => (b.status === 'paid' ? 1 : 0) - (a.status === 'paid' ? 1 : 0));
    for (const inv of sorted) {
      const key = `${inv.monthKey || ''}_${inv.roomId || inv.roomName || ''}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(inv);
      }
    }
    return unique;
  }

  static getStateFromStorage() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  static getInitialRooms(stateOrIsDemo) {
    let isDemo = true;
    if (typeof stateOrIsDemo === 'boolean') {
      isDemo = stateOrIsDemo;
    } else if (stateOrIsDemo && stateOrIsDemo.settings && stateOrIsDemo.settings.isDemoMode !== undefined) {
      isDemo = Boolean(stateOrIsDemo.settings.isDemoMode);
    } else {
      const savedState = this.getStateFromStorage();
      if (savedState && savedState.settings && savedState.settings.isDemoMode !== undefined) {
        isDemo = Boolean(savedState.settings.isDemoMode);
      }
    }
    if (!isDemo) return [];

    const rooms = [];
    for (let i = 101; i <= 119; i++) {
      rooms.push({
        id: `s${i}`,
        name: `S${i}`,
        floor: 1,
        type: 'rt_fan',
        baseRent: 2500,
        status: 'vacant',
        occupied: false,
        currentTenantId: '',
        currentTenantName: '',
        lastElecMeter: 0,
        lastWaterMeter: 0
      });
    }
    for (let f = 1; f <= 2; f++) {
      for (let r = 1; r <= 10; r++) {
        const num = `${f}0${r}`.slice(-3);
        const code = `rm_${f}${r}`;
        rooms.push({
          id: code,
          name: `${num}`,
          floor: f,
          type: f === 1 ? 'rt_fan' : 'rt_air',
          baseRent: f === 1 ? 2500 : 3500,
          status: 'vacant',
          occupied: false,
          currentTenantId: '',
          currentTenantName: '',
          lastElecMeter: 0,
          lastWaterMeter: 0
        });
      }
    }
    rooms.push(
      { id: 'rm_house1', name: 'บ้านหลัง 1', floor: 1, type: 'rt_shop', baseRent: 5500, status: 'vacant', occupied: false, currentTenantId: '', currentTenantName: '' },
      { id: 'rm_house2', name: 'บ้านหลัง 2', floor: 1, type: 'rt_shop', baseRent: 5500, status: 'vacant', occupied: false, currentTenantId: '', currentTenantName: '' }
    );
    return rooms;
  }

  static getInitialState() {
    const savedState = this.getStateFromStorage();
    // Only show demo rooms when isDemoMode is explicitly true.
    // If savedState has isDemoMode=false (production mode) OR no savedState exists
    // but Supabase URL is configured, start with empty rooms.
    const hasSavedState = !!savedState;
    const isDemo = hasSavedState && savedState.settings && savedState.settings.isDemoMode !== undefined
      ? Boolean(savedState.settings.isDemoMode)
      : true;
    const hasSupabaseUrl = !!(this.getSavedSupabaseUrl());
    // In production mode (isDemo=false), always start with empty rooms.
    // In demo mode without any saved state and with a Supabase URL, also start empty
    // so that Supabase data is the single source of truth.
    const useDemo = isDemo && !hasSupabaseUrl;

    return {
      settings: {
        apartmentName: 'หอพักสมบัติ นนทบุรี',
        address: '45/10 หมู่ที่ 8 ต.ราษฎร์นิยม อ.ไทรน้อย จ.นนทบุรี 11150',
        tel: '080-5991691',
        lineId: '@sombat_rent',
        bankName: 'ธนาคารกรุงศรีอยุธยา (BAY)',
        bankAccountNo: '2401346663',
        bankAccountName: 'นางสมผิว น้ำวน',
        promptPayId: '0805991691',
        supabaseUrl: '',
        isDemoMode: isDemo
      },
      rates: { electricityRate: 8.0, waterRate: 20.0, trashFee: 20.0, internetFee: 0, commonFee: 0 },
      lateFeeSettings: {
        dueDay: 5,
        penaltyPhase1Start: 6,
        penaltyPhase1End: 15,
        penaltyPhase1Amount: 200,
        penaltyPhase2Start: 16,
        penaltyPhase2End: 31,
        penaltyPhase2Amount: 300
      },
      users: [
        { id: 'usr_super', username: 'superadmin', displayName: 'สมบัติ น้ำวน', role: 'super_admin', passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' },
        { id: 'usr_admin', username: 'admin', displayName: 'เจ้าของหอพัก / แอดมิน', role: 'admin', passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' },
        { id: 'usr_staff', username: 'staff', displayName: 'พนักงานต้อนรับ (Staff)', role: 'staff', passwordHash: '1562206543da764123c21bd524674f0a8aaf49c8a89744c97352fe677f7e4006' }
      ],
      roomTypes: [
        { id: 'rt_fan', name: 'ห้องพัดลมมาตรฐาน', description: 'ห้องพัดลมกว้างขวาง ระเบียงส่วนตัว', defaultRent: 2500 },
        { id: 'rt_air', name: 'ห้องแอร์ปรับอากาศ', description: 'เครื่องปรับอากาศประหยัดไฟเบอร์ 5 พร้อมเฟอร์นิเจอร์', defaultRent: 3500 },
        { id: 'rt_shop', name: 'ห้องพาณิชย์ร้านค้า', description: 'ติดถนนหลัก เหมาะค้าขายหรือทำออฟฟิศ', defaultRent: 5500 }
      ],
      rooms: useDemo ? this.getInitialRooms(true) : [],
      tenants: [],
      invoices: [],
      repairs: [],
      ledger: [],
      events: []
    };
  }

  static cleanUrl(url) {
    if (!url) return '';
    return url.split('?')[0].trim();
  }

  static getSavedSupabaseUrl() {
    const rawState = localStorage.getItem(this.STORAGE_KEY);
    if (rawState) {
      try {
        const parsed = JSON.parse(rawState);
        if (parsed.settings && parsed.settings.googleSheetUrl && !parsed.settings.supabaseUrl) {
          const u = parsed.settings.googleSheetUrl;
          if (u.includes('supabase.co')) {
            parsed.settings.supabaseUrl = this.cleanUrl(u);
            delete parsed.settings.googleSheetUrl;
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(parsed));
            return parsed.settings.supabaseUrl;
          } else {
            delete parsed.settings.googleSheetUrl;
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(parsed));
          }
        }
        if (parsed.settings && parsed.settings.supabaseUrl) {
          let u = parsed.settings.supabaseUrl;
          if (u.includes('bdeowpdjgiambqatdilh')) {
            u = u.replace('bdeowpdjgiambqatdilh', 'bdeowpdjgiombqatdilh');
            parsed.settings.supabaseUrl = u;
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(parsed));
          }
          return this.cleanUrl(u);
        }
      } catch (e) {}
    }
    let fromStorage = localStorage.getItem('SOMBAT_APARTMENT_SAVED_SUPABASE_URL');
    if (fromStorage && fromStorage.includes('supabase.co')) {
      if (fromStorage.includes('bdeowpdjgiambqatdilh')) {
        fromStorage = fromStorage.replace('bdeowpdjgiambqatdilh', 'bdeowpdjgiombqatdilh');
        localStorage.setItem('SOMBAT_APARTMENT_SAVED_SUPABASE_URL', fromStorage);
      }
      return this.cleanUrl(fromStorage);
    }
    let oldStorage = localStorage.getItem('SOMBAT_APARTMENT_SAVED_SHEET_URL');
    if (oldStorage && oldStorage.includes('supabase.co')) {
      if (oldStorage.includes('bdeowpdjgiambqatdilh')) {
        oldStorage = oldStorage.replace('bdeowpdjgiambqatdilh', 'bdeowpdjgiombqatdilh');
      }
      localStorage.setItem('SOMBAT_APARTMENT_SAVED_SUPABASE_URL', oldStorage);
      localStorage.removeItem('SOMBAT_APARTMENT_SAVED_SHEET_URL');
      return this.cleanUrl(oldStorage);
    }
    return 'https://bdeowpdjgiombqatdilh.supabase.co';
  }

  static getSavedApiKey() {
    const rawState = localStorage.getItem(this.STORAGE_KEY);
    if (rawState) {
      try {
        const parsed = JSON.parse(rawState);
        if (parsed.settings && parsed.settings.apiKey && parsed.settings.apiKey.startsWith('eyJ')) {
          return parsed.settings.apiKey;
        }
      } catch (e) {}
    }
    const fromStorage = localStorage.getItem('SOMBAT_APARTMENT_SAVED_API_KEY');
    if (fromStorage && fromStorage.startsWith('eyJ')) return fromStorage;
    const urlParams = new URLSearchParams(window.location.search);
    const fromParam = urlParams.get('apiKey');
    if (fromParam && fromParam.startsWith('eyJ')) {
      localStorage.setItem('SOMBAT_APARTMENT_SAVED_API_KEY', fromParam);
      return fromParam;
    }
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkZW93cGRqZ2lvbWJxYXRkaWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzA3MjAsImV4cCI6MjEwMTI0NjcyMH0.XBvQzG4aChKQT-kWpHrb2Y1xtCgOwB_M9Ej-NYelgPY';
  }

  static getSavedTenantApiKey() {
    const rawState = localStorage.getItem(this.STORAGE_KEY);
    if (rawState) {
      try {
        const parsed = JSON.parse(rawState);
        if (parsed.settings && parsed.settings.tenantApiKey && parsed.settings.tenantApiKey.startsWith('eyJ')) {
          return parsed.settings.tenantApiKey;
        }
      } catch (e) {}
    }
    const fromStorage = localStorage.getItem('SOMBAT_APARTMENT_SAVED_TENANT_API_KEY');
    if (fromStorage && fromStorage.startsWith('eyJ')) return fromStorage;
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkZW93cGRqZ2lvbWJxYXRkaWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzA3MjAsImV4cCI6MjEwMTI0NjcyMH0.XBvQzG4aChKQT-kWpHrb2Y1xtCgOwB_M9Ej-NYelgPY';
  }

  static getState() {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    let state = null;
    if (raw) {
      try { state = JSON.parse(raw); } catch (e) {}
    }
    if (!state) {
      state = this.getInitialState();
    }
    if (!state.lateFeeSettings) {
      state.lateFeeSettings = {
        dueDay: 5,
        penaltyPhase1Start: 6,
        penaltyPhase1End: 15,
        penaltyPhase1Amount: 200,
        penaltyPhase2Start: 16,
        penaltyPhase2End: 31,
        penaltyPhase2Amount: 300
      };
    }
    if (!state.rooms || !Array.isArray(state.rooms)) {
      state.rooms = [];
    }
    if (state.invoices && Array.isArray(state.invoices)) {
      state.invoices = this.getUniqueInvoices(state.invoices);
      let migrated = false;
      state.invoices.forEach(inv => {
        if (inv.monthKey && inv.dueDate && inv.dueDate.slice(0, 7) === inv.monthKey) {
          const [year, month] = inv.monthKey.split('-').map(Number);
          let nextMonth = month + 1;
          let nextYear = year;
          if (nextMonth > 12) {
            nextMonth = 1;
            nextYear++;
          }
          const nextMonthFormatted = String(nextMonth).padStart(2, '0');
          inv.dueDate = `${nextYear}-${nextMonthFormatted}-05`;
          migrated = true;
        }
      });
      if (migrated) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
        this.syncToSupabase(this.getSavedSupabaseUrl(), state).catch(() => {});
      }
    }
    // Ensure supabaseUrl is populated
    const savedUrl = this.getSavedSupabaseUrl();
    if (savedUrl && (!state.settings || !state.settings.supabaseUrl)) {
      if (!state.settings) state.settings = {};
      state.settings.supabaseUrl = savedUrl;
    }
    
    // Ensure default users are always present in the state to prevent locking out administrators when the database is wiped/empty
    if (!state.users || !Array.isArray(state.users) || state.users.length === 0) {
      state.users = [
        { id: 'usr_super', username: 'superadmin', displayName: 'สมบัติ น้ำวน', role: 'super_admin', passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' /* sha256('admin') */ },
        { id: 'usr_admin', username: 'admin', displayName: 'เจ้าของหอพัก / แอดมิน', role: 'admin', passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' /* sha256('admin') */ },
        { id: 'usr_staff', username: 'staff', displayName: 'พนักงานต้อนรับ (Staff)', role: 'staff', passwordHash: '1562206543da764123c21bd524674f0a8aaf49c8a89744c97352fe677f7e4006' /* sha256('staff') */ }
      ];
    }
    
    return state;
  }

  static async saveState(state, silent = false) {
    if (state.settings && state.settings.supabaseUrl) {
      localStorage.setItem('SOMBAT_APARTMENT_SAVED_SUPABASE_URL', state.settings.supabaseUrl);
    }
    const url = this.getSavedSupabaseUrl();
    if (url) {
      let syncLoader = null;
      if (!silent) {
        // Show blocking loader during sync
        syncLoader = document.createElement('div');
        syncLoader.id = 'app-sync-loader';
        syncLoader.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15, 23, 42, 0.75); color:#f8fafc; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:99999; font-family:sans-serif; backdrop-filter:blur(4px);';
        syncLoader.innerHTML = `
          <div style="width:45px; height:45px; border:4px solid #334155; border-top-color:#3b82f6; border-radius:50%; animation: spin 1s linear infinite; margin-bottom:1rem;"></div>
          <div style="font-weight:700; font-size:1.15rem; margin-bottom:0.25rem;">กำลังบันทึกข้อมูลไปยัง Supabase...</div>
          <div style="font-size:0.88rem; color:#cbd5e1;">กรุณารอสักครู่ ระบบกำลังอัปเดตข้อมูล</div>
          <style>
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        `;
        document.body.appendChild(syncLoader);
      }

      try {
        await this.syncToSupabase(url, state);
      } catch (e) {
        console.error("Failed to sync to Supabase, state will be saved to local cache:", e);
        if (!silent) {
          alert('⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อ Supabase: ' + e.message + '\n\n(ข้อมูลถูกบันทึกในอุปกรณ์เครื่องนี้แล้ว แต่ไม่สามารถอัปโหลดไปยังเซิร์ฟเวอร์ Supabase ได้ กรุณาตรวจสอบ URL หรือ Anon Key ในหน้าตั้งค่า)');
        }
      } finally {
        if (syncLoader && syncLoader.parentNode) {
          syncLoader.remove();
        }
      }
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  }

  static getBaseSupabaseUrl(url) {
    if (!url) return '';
    let cleaned = url.split('?')[0].trim();
    if (cleaned.endsWith('/')) {
      cleaned = cleaned.slice(0, -1);
    }
    const match = cleaned.match(/^(https?:\/\/[^\/]+)/i);
    return match ? match[1] : cleaned;
  }

  /* อัปโหลดไฟล์ขึ้น Supabase Storage (bucket: tenant-documents) แทนการฝัง base64
     ใช้แพทเทิร์นเดียวกับฝั่งผู้เช่า (uploadBase64ToStorage ใน tenant-app.js) */
  static async uploadFileToStorage(file, folderPath = 'doc') {
    if (!file) return null;
    const url = this.getSavedSupabaseUrl();
    const apiKey = this.getSavedApiKey();
    if (!url || !apiKey) {
      throw new Error('ยังไม่ได้ตั้งค่า Supabase URL / API Key จึงอัปโหลดไฟล์ไม่ได้');
    }
    const baseUrl = this.getBaseSupabaseUrl(url);
    const safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${safeName}`;
    const cleanFolder = folderPath.replace(/\/+$/, '').replace(/^\/+/, '');
    const objectPath = cleanFolder ? `${cleanFolder}/${filename}` : filename;
    const uploadUrl = `${baseUrl}/storage/v1/object/tenant-documents/${objectPath}`;

    try {
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      });
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        let errorData = null;
        try {
          errorData = JSON.parse(errorText);
        } catch {}

        const status = res.status;
        const message = errorData ? (errorData.message || errorData.error) : errorText;
        const errorCode = errorData ? errorData.code : 'Unknown';

        // 11. เพิ่ม Error Log ให้ละเอียดใน Console
        console.error('❌ Supabase Storage Upload Error Details:', {
          status: status,
          message: message,
          error: errorCode,
          bucket: 'tenant-documents',
          path: objectPath,
          filename: file.name,
          size: file.size,
          contentType: file.type || 'application/octet-stream'
        });

        // 12. ปรับข้อความแจ้งเตือนให้เข้าใจง่าย
        if (status === 403 || message.includes('row-level security') || errorCode === 'AccessDenied') {
          throw new Error('ไม่มีสิทธิ์อัปโหลดไฟล์ (403 Unauthorized) กรุณาตรวจสอบ Storage RLS Policy หรือตรวจสอบว่าสร้าง Storage bucket ชื่อ "tenant-documents" และตั้งค่าเป็น public แล้ว');
        } else if (status === 404) {
          throw new Error('ไม่พบข้อมูลปลายทาง (404 Not Found) กรุณาตรวจสอบว่าสร้าง Storage bucket ชื่อ "tenant-documents" เรียบร้อยแล้ว');
        } else {
          throw new Error(message || `เกิดข้อผิดพลาดรหัส ${status}`);
        }
      }
      return `${baseUrl}/storage/v1/object/public/tenant-documents/${objectPath}`;
    } catch (err) {
      if (err.message.includes('ไม่มีสิทธิ์อัปโหลด') || err.message.includes('ไม่พบข้อมูลปลายทาง')) {
        throw err;
      }
      console.error('❌ Network or Upload exception:', err);
      throw new Error(`การเชื่อมต่อล้มเหลวหรือไม่สามารถอัปโหลดได้: ${err.message}`);
    }
  }

  // Delete one or more file objects from the tenant-documents bucket by their public URLs
  static async deleteFilesFromStorage(publicUrls = []) {
    if (!publicUrls || publicUrls.length === 0) return;
    const url = this.getSavedSupabaseUrl();
    const apiKey = this.getSavedApiKey();
    if (!url || !apiKey) return;
    const baseUrl = this.getBaseSupabaseUrl(url);

    // Extract object path from each full public URL
    const prefix = `${baseUrl}/storage/v1/object/public/tenant-documents/`;
    const paths = publicUrls
      .filter(u => u && typeof u === 'string' && u.includes('tenant-documents'))
      .map(u => {
        const idx = u.indexOf('/tenant-documents/');
        return idx !== -1 ? u.substring(idx + '/tenant-documents/'.length) : null;
      })
      .filter(Boolean);

    if (paths.length === 0) return;

    try {
      await fetch(`${baseUrl}/storage/v1/object/tenant-documents`, {
        method: 'DELETE',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prefixes: paths })
      });
    } catch (err) {
      console.warn('⚠️ Could not delete files from Supabase Storage:', err);
    }
  }

  static async callRpc(fnName, params = {}) {
    const url = this.getSavedSupabaseUrl();
    const apiKey = this.getSavedApiKey();
    if (!url || !apiKey) {
      throw new Error('ยังไม่ได้ตั้งค่า Supabase URL / API Key');
    }
    const baseUrl = this.getBaseSupabaseUrl(url);
    const res = await fetch(`${baseUrl}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`เรียกใช้ฟังก์ชัน ${fnName} ไม่สำเร็จ: ${txt || res.statusText}`);
    }
    return res.json();
  }

  /* ==========================================================================
     ตารางแยกประเภท (เหมือนชีตแยกแท็บ) แทนที่ apartment_state ก้อนเดียว
     - แต่ละ category มีตารางของตัวเอง บันทึกเฉพาะแถวที่เปลี่ยนจริง (ไม่ทับทั้งก้อน)
     - invoices ใช้ on_conflict = room_id,month_key ตรงกับ UNIQUE constraint ในฐานข้อมูล
       ทำให้ "ห้องเดียวกัน เดือนเดียวกัน" ไม่มีทางเกิดบิลซ้ำ/ชนกันได้ในระดับ DB จริง
     ========================================================================== */
  static SNAPSHOT_KEY = 'SOMBAT_APARTMENT_TABLE_SNAPSHOT_V1';

  static calculateLatePenalty(invoice, settings) {
    if (invoice.status === 'paid' || invoice.status === 'cancelled' || invoice.status === 'refund' || invoice.status === 'pending_verification') {
      return {
        amount: Number(invoice.penaltyAmount || 0),
        rule: invoice.penaltyRule || ''
      };
    }

    const dueDay = Number(settings?.dueDay ?? 5);
    const phase1Start = Number(settings?.penaltyPhase1Start ?? 6);
    const phase1End = Number(settings?.penaltyPhase1End ?? 15);
    const phase1Amt = Number(settings?.penaltyPhase1Amount ?? 200);
    const phase2Start = Number(settings?.penaltyPhase2Start ?? 16);
    const phase2End = Number(settings?.penaltyPhase2End ?? 31);
    const phase2Amt = Number(settings?.penaltyPhase2Amount ?? 300);

    const todayStr = new Date().toLocaleDateString('sv-SE');
    const dueStr = invoice.dueDate;

    if (!dueStr) {
      return { amount: 0, rule: '' };
    }

    if (todayStr <= dueStr) {
      return { amount: 0, rule: 'ชำระภายในกำหนด' };
    }

    const [tYear, tMonth, tDay] = todayStr.split('-').map(Number);
    const [dYear, dMonth, dDay] = dueStr.split('-').map(Number);

    const isLaterMonthOrYear = (tYear > dYear) || (tYear === dYear && tMonth > dMonth);

    if (isLaterMonthOrYear) {
      return { 
        amount: phase2Amt, 
        rule: `ค้างชำระข้ามเดือน (ค่าปรับ ${phase2Amt} บาท)` 
      };
    }

    if (tDay >= phase1Start && tDay <= phase1End) {
      return { 
        amount: phase1Amt, 
        rule: `ชำระล่าช้าช่วงที่ 1 (วันที่ ${phase1Start}-${phase1End}: ค่าปรับ ${phase1Amt} บาท)` 
      };
    } else if (tDay >= phase2Start) {
      return { 
        amount: phase2Amt, 
        rule: `ชำระล่าช้าช่วงที่ 2 (วันที่ ${phase2Start} เป็นต้นไป: ค่าปรับ ${phase2Amt} บาท)` 
      };
    }

    return { amount: phase2Amt, rule: `ชำระล่าช้าเกินกำหนด (ค่าปรับ ${phase2Amt} บาท)` };
  }

  static updateInvoicePenalties(state) {
    if (!state || !state.invoices) return false;
    let changed = false;
    state.invoices.forEach(inv => {
      if (inv.status === 'unpaid') {
        const penalty = this.calculateLatePenalty(inv, state.lateFeeSettings);
        if (Number(inv.penaltyAmount || 0) !== penalty.amount || inv.penaltyRule !== penalty.rule) {
          inv.penaltyAmount = penalty.amount;
          inv.penaltyRule = penalty.rule;
          inv.penaltyCalculatedAt = new Date().toISOString();
          
          const baseTotal = Number(inv.rentAmount || 0) +
                            Number(inv.waterAmount || 0) +
                            Number(inv.elecAmount || 0) +
                            Number(inv.trashFee || 0) +
                            Number(inv.internetFee || 0) +
                            Number(inv.commonFee || 0) +
                            Number(inv.fineAmount || 0);
          inv.totalAmount = baseTotal + penalty.amount;
          inv.outstandingAmount = inv.totalAmount - Number(inv.paidAmount || 0);
          changed = true;
        }
      }
    });
    return changed;
  }
  static getRoomRent(room) {
    if (!room) return 0;
    if (room.status === 'vacant' || room.status === 'reserved') {
      return 0;
    }
    if (room.baseRent !== undefined && room.baseRent !== null && room.baseRent !== '') {
      return Number(room.baseRent);
    }
    return room.floor === 2 ? 3500 : 2500;
  }

  static cleanRoomName(roomName) {
    let name = String(roomName || '').trim();
    name = name.replace(/^(?:ห้องพัก|ห้อง)\s*/, '');
    return name.trim();
  }

  static getRoomSortWeight(roomName) {
    const name = DBService.cleanRoomName(roomName);
    if (!name) return 2;
    if (/^s/i.test(name)) {
      return 1;
    }
    const isNamed = /^[^A-Za-z0-9]/i.test(name) || name.startsWith('บ้าน') || name.startsWith('เรือน');
    if (isNamed) {
      return 3;
    }
    return 2;
  }

  static compareRooms(a, b) {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    const nameA = DBService.cleanRoomName(a.name);
    const nameB = DBService.cleanRoomName(b.name);
    const wA = DBService.getRoomSortWeight(nameA);
    const wB = DBService.getRoomSortWeight(nameB);
    if (wA !== wB) return wA - wB;
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  }

  static getTableConfigs() {
    return {
      payments: {
        table: 'payments', onConflict: 'id',
        fields: [['id','id'],['invoiceId','invoice_id'],['tenantId','tenant_id'],['roomId','room_id'],['amount','amount'],['paymentDate','payment_date'],['paymentMethod','payment_method'],['slipId','slip_id'],['slipUrl','slip_url'],['status','status'],['note','note'],['rejectionReason','rejection_reason'],['verifiedBy','verified_by'],['verifiedAt','verified_at'],['createdAt','created_at']]
      },
      rooms: {
        table: 'rooms', onConflict: 'id',
        fields: [['id','id'],['name','name'],['floor','floor'],['typeId','type_id'],['baseRent','base_rent'],
                 ['status','status'],['currentTenantId','current_tenant_id'],['currentTenantName','current_tenant_name'],
                 ['entryDate','entry_date'],['lastWaterMeter','last_water_meter'],['lastElecMeter','last_elec_meter'],
                 ['trashFee','trash_fee'],['internetFee','internet_fee'],['commonFee','common_fee'],
                 ['tempElecMeter','temp_elec_meter'],['tempWaterMeter','temp_water_meter'],['tempFineAmount','temp_fine_amount']]
      },
      tenants: {
        table: 'tenants', onConflict: 'id',
        fields: [['id','id'],['name','name'],['idCard','id_card'],['tel','tel'],['lineId','line_id'],['email','email'],
                 ['address','address'],['startDate','start_date'],['endDate','end_date'],['assignedRoomId','assigned_room_id'],
                 ['depositAmount','deposit_amount'],['depositStatus','deposit_status'],
                 ['witness1','witness1'],['witness2','witness2'],['status','status'],['lastAssignedRoomName','last_assigned_room_name']]
      },
      invoices: {
        table: 'invoices', onConflict: 'room_id,month_key',
        keyFn: (r) => `${r.roomId || ''}::${r.monthKey || ''}`,
        fields: [['id','id'],['invoiceNumber','invoice_number'],['monthKey','month_key'],['roomId','room_id'],
                 ['roomName','room_name'],['tenantId','tenant_id'],['tenantName','tenant_name'],['issueDate','issue_date'],
                 ['dueDate','due_date'],['waterPrev','water_prev'],['waterCurr','water_curr'],['waterAmount','water_amount'],
                 ['elecPrev','elec_prev'],['elecCurr','elec_curr'],['elecAmount','elec_amount'],['rentAmount','rent_amount'],
                 ['trashFee','trash_fee'],['fineAmount','fine_amount'],['internetFee','internet_fee'],['commonFee','common_fee'],
                 ['totalAmount','total_amount'],['paidAmount','paid_amount'],['outstandingAmount','outstanding_amount'],
                 ['status','status'],['slipUrl','slip_url'],
                 ['penaltyAmount','penalty_amount'],['penaltyRule','penalty_rule'],['penaltyCalculatedAt','penalty_calculated_at']]
      },
      repairs: {
        table: 'repairs', onConflict: 'id',
        fields: [['id','id'],['ticketNumber','ticket_number'],['roomId','room_id'],['roomName','room_name'],
                 ['tenantName','tenant_name'],['title','title'],['description','description'],['category','category'],
                 ['requestDate','request_date'],['status','status'],['expenseAmount','expense_amount'],
                 ['assignedTechnician','assigned_technician'],['imageUrl','image_url']]
      },
      ledger: {
        table: 'ledger', onConflict: 'id',
        fields: [['id','id'],['date','date'],['type','type'],['category','category'],['description','description'],
                 ['amount','amount'],['recordedBy','recorded_by'],['invoiceId','invoice_id']]
      },
      roomTypes: {
        table: 'room_types', onConflict: 'id',
        fields: [['id','id'],['name','name'],['rentalType','rental_type'],['defaultRent','default_rent'],['description','description']]
      },
      events: {
        table: 'events', onConflict: 'id',
        fields: [['id','id'],['title','title'],['date','date'],['category','category'],['roomName','room_name']]
      },
      users: {
        table: 'users', onConflict: 'id',
        fields: [['id','id'],['username','username'],['displayName','display_name'],['role','role'],['passwordHash','password_hash']]
      },
      meterAuditLogs: {
        table: 'meter_audit_logs', onConflict: 'id',
        fields: [['id','id'],['roomId','room_id'],['roomName','room_name'],['monthKey','month_key'],
                 ['recordedBy','recorded_by'],['actionType','action_type'],['oldWaterCurr','old_water_curr'],
                 ['newWaterCurr','new_water_curr'],['oldElecCurr','old_elec_curr'],['newElecCurr','new_elec_curr'],
                 ['waterUnits','water_units'],['elecUnits','elec_units'],['waterAmount','water_amount'],
                 ['elecAmount','elec_amount'],['notes','notes'],['createdAt','created_at']]
      },
      payments: {
        table: 'payments', onConflict: 'id',
        fields: [['id','id'],['invoiceId','invoice_id'],['tenantId','tenant_id'],['roomId','room_id'],['amount','amount'],['paymentDate','payment_date'],['paymentMethod','payment_method'],['slipId','slip_id'],['slipUrl','slip_url'],['status','status'],['note','note'],['rejectionReason','rejection_reason'],['verifiedBy','verified_by'],['verifiedAt','verified_at'],['createdAt','created_at']]
      },
      paymentSlips: {
        table: 'payment_slips', onConflict: 'id',
        fields: [['id','id'],['invoiceId','invoice_id'],['tenantId','tenant_id'],['roomId','room_id'],
                 ['roomName','room_name'],['tenantName','tenant_name'],['monthKey','month_key'],
                 ['storagePath','storage_path'],['publicUrl','public_url'],['amount','amount'],
                 ['requiredAmount','required_amount'],['fineAmount','fine_amount'],
                 ['referenceNo','reference_no'],['qrTransactionId','qr_transaction_id'],
                 ['senderBank','sender_bank'],['receiverBank','receiver_bank'],
                 ['transactionDate','transaction_date'],['transactionTime','transaction_time'],
                 ['imageHash','image_hash'],
                 ['verificationStatus','verification_status'],['verifiedBy','verified_by'],
                 ['verifiedAt','verified_at'],['rejectReason','reject_reason'],['createdAt','created_at']]
      }
    };
  }

  // เอกสารผู้เช่า (สลิป/บัตรประชาชน/ทะเบียนบ้าน) และรายการหักเงินมัดจำ
  // ในหน่วยความจำอยู่ซ้อนใน tenant.documents / tenant.deposit.deductions
  // แต่บันทึกลง DB เป็นตารางแยกของตัวเอง (คอลัมน์ชัดเจน ไม่ปนกับข้อมูลผู้เช่าหลัก)
  static getNestedTenantConfigs() {
    return {
      documents: {
        table: 'tenant_documents', onConflict: 'id',
        fields: [['id','id'],['tenantId','tenant_id'],['category','category'],['title','title'],
                 ['fileName','file_name'],['fileType','file_type'],['fileSize','file_size'],
                 ['dataUrl','file_url'],['uploadDate','upload_date']]
      },
      deductions: {
        table: 'tenant_deposit_deductions', onConflict: 'id',
        fields: [['id','id'],['tenantId','tenant_id'],['description','description'],['amount','amount'],['date','date']]
      }
    };
  }

  static getSingletonConfigs() {
    return {
      settings: {
        table: 'settings',
        fields: [['apartmentName','apartment_name'],['address','address'],['tel','tel'],['lineId','line_id'],
                 ['bankName','bank_name'],['bankAccountNo','bank_account_no'],['bankAccountName','bank_account_name'],
                 ['promptPayId','prompt_pay_id'],
                 ['lineToken','line_token'],['lineUserId','line_user_id'],['lineNotifyToken','line_notify_token']]
      },
      rates: {
        table: 'rates',
        fields: [['electricityRate','electricity_rate'],['waterRate','water_rate'],['trashFee','trash_fee'],
                 ['internetFee','internet_fee'],['commonFee','common_fee']]
      },
      lateFeeSettings: {
        table: 'late_fee_settings',
        fields: [['dueDay','due_day'],['penaltyPhase1Start','penalty_phase1_start'],['penaltyPhase1End','penalty_phase1_end'],
                 ['penaltyPhase1Amount','penalty_phase1_amount'],['penaltyPhase2Start','penalty_phase2_start'],
                 ['penaltyPhase2End','penalty_phase2_end'],['penaltyPhase2Amount','penalty_phase2_amount']]
      }
    };
  }

  static toRow(fields, obj, state) {
    const row = {};
    fields.forEach(([jsKey, dbKey]) => {
      let val = obj[jsKey] !== undefined ? obj[jsKey] : null;
      if (val === '' || val === 'null' || val === 'undefined') val = null;
      if ((dbKey === 'assigned_room_id' || dbKey === 'room_id') && val) {
        if (state && Array.isArray(state.rooms)) {
          const roomExists = state.rooms.some(r => r.id === val);
          if (!roomExists) val = null;
        }
      }
      row[dbKey] = val;
    });
    return row;
  }

  static fromRow(fields, row) {
    const obj = {};
    fields.forEach(([jsKey, dbKey]) => { obj[jsKey] = row[dbKey] !== undefined ? row[dbKey] : null; });
    return obj;
  }

  static loadSnapshot() {
    try { return JSON.parse(localStorage.getItem(this.SNAPSHOT_KEY) || '{}'); } catch (e) { return {}; }
  }

  static saveSnapshot(snap) {
    localStorage.setItem(this.SNAPSHOT_KEY, JSON.stringify(snap));
  }

  static async pullFromSupabase(url) {
    if (!url) return null;
    const apiKey = this.getSavedApiKey();
    const baseUrl = this.getBaseSupabaseUrl(url);
    const headers = { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` };
    try {
      const tableCfgs = this.getTableConfigs();
      const singleCfgs = this.getSingletonConfigs();

      const tableEntries = Object.entries(tableCfgs);
      const singleEntries = Object.entries(singleCfgs);

      const [tableResults, singleResults] = await Promise.all([
        Promise.all(tableEntries.map(([, cfg]) =>
          fetch(`${baseUrl}/rest/v1/${cfg.table}?select=*`, { headers }).then(r => r.ok ? r.json() : Promise.reject(new Error(`โหลดตาราง ${cfg.table} ไม่สำเร็จ: ${r.statusText}`)))
        )),
        Promise.all(singleEntries.map(([, cfg]) =>
          fetch(`${baseUrl}/rest/v1/${cfg.table}?id=eq.1&select=*`, { headers })
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
        ))
      ]);

      const data = this.getInitialState();
      const snapshot = {};

      tableEntries.forEach(([category, cfg], idx) => {
        const rows = tableResults[idx] || [];
        const jsRows = rows.map(r => this.fromRow(cfg.fields, r));
        data[category] = jsRows;
        const keyFn = cfg.keyFn || (r => r.id);
        const catSnap = {};
        jsRows.forEach((jsRow) => {
          catSnap[keyFn(jsRow)] = { id: jsRow.id, json: JSON.stringify(this.toRow(cfg.fields, jsRow)) };
        });
        snapshot[category] = catSnap;
      });

      singleEntries.forEach(([category, cfg], idx) => {
        const rows = singleResults[idx] || [];
        if (rows && rows.length > 0) {
          data[category] = Object.assign({}, data[category], this.fromRow(cfg.fields, rows[0]));
        }
      });

      // ประกอบ documents / deposit.deductions กลับเข้าไปในแต่ละ tenant (เก็บแยกตารางใน DB)
      const nestedCfgs = this.getNestedTenantConfigs();
      const nestedEntries = Object.entries(nestedCfgs);
      const nestedResults = await Promise.all(nestedEntries.map(([, cfg]) =>
        fetch(`${baseUrl}/rest/v1/${cfg.table}?select=*`, { headers }).then(r => r.ok ? r.json() : Promise.reject(new Error(`โหลดตาราง ${cfg.table} ไม่สำเร็จ: ${r.statusText}`)))
      ));
      const tenantsById = {};
      (data.tenants || []).forEach(t => {
        t.documents = [];
        t.depositAmount = (t.depositAmount !== undefined && t.depositAmount !== null) ? Number(t.depositAmount) : 0;
        t.deposit = { initialBail: t.depositAmount, status: t.depositStatus || 'active', deductions: [] };
        tenantsById[t.id] = t;
      });
      nestedEntries.forEach(([key, cfg], idx) => {
        const rows = nestedResults[idx] || [];
        const jsRows = rows.map(r => this.fromRow(cfg.fields, r));
        const catSnap = {};
        jsRows.forEach(jsRow => {
          catSnap[jsRow.id] = { id: jsRow.id, json: JSON.stringify(this.toRow(cfg.fields, jsRow)) };
          const tenant = tenantsById[jsRow.tenantId];
          if (tenant) {
            if (key === 'documents') tenant.documents.push(jsRow);
            else if (key === 'deductions') tenant.deposit.deductions.push(jsRow);
          }
        });
        snapshot['tenant_' + key] = catSnap;
      });

      if (!data.settings) data.settings = {};
      data.settings.supabaseUrl = this.cleanUrl(url);
      if (apiKey) data.settings.apiKey = apiKey;
      if (!data.users || !Array.isArray(data.users) || data.users.length === 0) {
        data.users = [
          { id: 'usr_super', username: 'superadmin', displayName: 'สมบัติ น้ำวน', role: 'super_admin', passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' },
          { id: 'usr_admin', username: 'admin', displayName: 'เจ้าของหอพัก / แอดมิน', role: 'admin', passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' },
          { id: 'usr_staff', username: 'staff', displayName: 'พนักงานต้อนรับ (Staff)', role: 'staff', passwordHash: '1562206543da764123c21bd524674f0a8aaf49c8a89744c97352fe677f7e4006' }
        ];
      }

      localStorage.setItem('SOMBAT_APARTMENT_SAVED_SUPABASE_URL', this.cleanUrl(url));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      this.saveSnapshot(snapshot);
      return data;
    } catch (e) {
      console.error('Failed to pull from Supabase:', e);
    }
    return null;
  }

  static async addAdminPayment(invoiceId, amount, paymentDate, paymentMethod, note, adminName, slipUrl) {
    const url = this.getSavedSupabaseUrl();
    const apiKey = this.getSavedApiKey();
    const baseUrl = this.getBaseSupabaseUrl(url);

    const res = await fetch(`${baseUrl}/rest/v1/rpc/add_admin_payment`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_invoice_id: invoiceId,
        p_amount: amount,
        p_payment_date: paymentDate || new Date().toISOString().slice(0, 10),
        p_payment_method: paymentMethod || 'cash',
        p_note: note || null,
        p_admin_name: adminName || 'แอดมิน',
        p_slip_url: slipUrl || null
      })
    });
    return await res.json();
  }

  static async approvePartialPayment(paymentId, adminName) {
    const url = this.getSavedSupabaseUrl();
    const apiKey = this.getSavedApiKey();
    const baseUrl = this.getBaseSupabaseUrl(url);

    const res = await fetch(`${baseUrl}/rest/v1/rpc/approve_partial_payment`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_payment_id: paymentId,
        p_admin_name: adminName || 'แอดมิน'
      })
    });
    return await res.json();
  }

  static async rejectPartialPayment(paymentId, adminName, reason) {
    const url = this.getSavedSupabaseUrl();
    const apiKey = this.getSavedApiKey();
    const baseUrl = this.getBaseSupabaseUrl(url);

    const res = await fetch(`${baseUrl}/rest/v1/rpc/reject_partial_payment`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_payment_id: paymentId,
        p_admin_name: adminName || 'แอดมิน',
        p_reason: reason || null
      })
    });
    return await res.json();
  }

  static async purgeSupabaseData(url, state) {
    const cleanUrl = this.cleanUrl(url);
    if (!cleanUrl) return;
    const baseUrl = this.getBaseSupabaseUrl(cleanUrl);
    const apiKey = this.getSavedApiKey();
    const headers = {
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    const isDemo = state && state.settings && state.settings.isDemoMode !== undefined
      ? Boolean(state.settings.isDemoMode)
      : true;

    const tablesToDelete = [
      'invoices',
      'tenant_documents',
      'tenant_deposit_deductions',
      'repairs',
      'ledger',
      'events',
      'tenants',
      'rooms'
    ];

    for (const table of tablesToDelete) {
      try {
        await fetch(`${baseUrl}/rest/v1/${table}?id=not.is.null`, { method: 'DELETE', headers });
        await fetch(`${baseUrl}/rest/v1/${table}?room_id=not.is.null`, { method: 'DELETE', headers });

        const getRes = await fetch(`${baseUrl}/rest/v1/${table}?select=*`, { headers });
        if (getRes.ok) {
          const rows = await getRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            for (const r of rows) {
              let query = '';
              if (r.id !== undefined && r.id !== null) {
                query = `id=eq.${encodeURIComponent(r.id)}`;
              } else if (r.room_id && r.month_key) {
                query = `room_id=eq.${encodeURIComponent(r.room_id)}&month_key=eq.${encodeURIComponent(r.month_key)}`;
              }
              if (query) {
                await fetch(`${baseUrl}/rest/v1/${table}?${query}`, { method: 'DELETE', headers });
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Purge table ${table} failed:`, err);
      }
    }

    // NOTE: Do NOT re-insert demo rooms after purge.
    // Rooms must be created manually by the admin after purge.
    // This ensures Supabase is the single source of truth.

    localStorage.removeItem(this.SNAPSHOT_KEY);
    localStorage.removeItem('SOMBAT_APARTMENT_SNAPSHOT_V1');
    localStorage.removeItem('SOMBAT_APARTMENT_TABLE_SNAPSHOT_V1');
  }

  // 1. ปุ่ม "เริ่มใช้งานจริง" (Start Production Mode / Remove Demo Data - ใช้ครั้งเดียว)
  static async startProductionMode(state) {
    if (!state.settings) state.settings = {};
    state.settings.isDemoMode = false;

    state.tenants = [];
    state.invoices = [];
    state.repairs = [];
    state.ledger = [];
    state.events = [];
    state.rooms = []; // ลบห้อง Demo ทั้งหมด 41 ห้องถาวร

    localStorage.removeItem(this.SNAPSHOT_KEY);
    localStorage.removeItem('SOMBAT_APARTMENT_SNAPSHOT_V1');
    localStorage.removeItem('SOMBAT_APARTMENT_TABLE_SNAPSHOT_V1');

    await this.saveState(state);

    const url = this.getSavedSupabaseUrl();
    if (url) {
      await this.purgeSupabaseData(url, state);
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  // 2. ปุ่ม "ล้างข้อมูลการใช้งาน" (Clear Usage Data - ใช้ประจำ โดยไม่ลบ/ไม่แตะห้องพัก)
  static async clearUsageData(state) {
    state.tenants = [];
    state.invoices = [];
    state.repairs = [];
    state.ledger = [];
    state.events = [];

    // รีเซ็ตสถานะห้องพักเดิมให้เป็นห้องว่าง โดยไม่ลบ หรือสร้างโครงสร้างห้องพักใหม่
    if (state.rooms && Array.isArray(state.rooms)) {
      state.rooms.forEach(r => {
        r.status = 'vacant';
        r.occupied = false;
        r.currentTenantId = '';
        r.currentTenantName = '';
        r.entryDate = null;
        r.lastElecMeter = 0;
        r.lastWaterMeter = 0;
      });
    }

    localStorage.removeItem(this.SNAPSHOT_KEY);
    localStorage.removeItem('SOMBAT_APARTMENT_SNAPSHOT_V1');
    localStorage.removeItem('SOMBAT_APARTMENT_TABLE_SNAPSHOT_V1');

    await this.saveState(state);

    const url = this.getSavedSupabaseUrl();
    if (url) {
      await this.purgeUsageTablesSupabase(url, state);
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  static async purgeUsageTablesSupabase(url, state) {
    const cleanUrl = this.cleanUrl(url);
    if (!cleanUrl) return;
    const baseUrl = this.getBaseSupabaseUrl(cleanUrl);
    const apiKey = this.getSavedApiKey();
    const headers = {
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    const tablesToDelete = [
      'invoices',
      'tenant_documents',
      'tenant_deposit_deductions',
      'repairs',
      'ledger',
      'events',
      'tenants'
    ];

    for (const table of tablesToDelete) {
      try {
        await fetch(`${baseUrl}/rest/v1/${table}?id=not.is.null`, { method: 'DELETE', headers });
        await fetch(`${baseUrl}/rest/v1/${table}?room_id=not.is.null`, { method: 'DELETE', headers });

        const getRes = await fetch(`${baseUrl}/rest/v1/${table}?select=*`, { headers });
        if (getRes.ok) {
          const rows = await getRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            for (const r of rows) {
              let query = '';
              if (r.id !== undefined && r.id !== null) {
                query = `id=eq.${encodeURIComponent(r.id)}`;
              } else if (r.room_id && r.month_key) {
                query = `room_id=eq.${encodeURIComponent(r.room_id)}&month_key=eq.${encodeURIComponent(r.month_key)}`;
              }
              if (query) {
                await fetch(`${baseUrl}/rest/v1/${table}?${query}`, { method: 'DELETE', headers });
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Purge usage table ${table} failed:`, err);
      }
    }

    // อัปเดตสถานะห้องพักใน Supabase โดยไม่ลบหรือเพิ่มโครงสร้างห้องพัก
    if (state.rooms && Array.isArray(state.rooms) && state.rooms.length > 0) {
      try {
        const cfg = this.getTableConfigs().rooms;
        const dbRooms = state.rooms.map(r => this.toRow(cfg.fields, r));
        await fetch(`${baseUrl}/rest/v1/rooms?on_conflict=id`, {
          method: 'POST',
          headers: {
            ...headers,
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(dbRooms)
        });
      } catch (err) {
        console.warn('Sync rooms status in Supabase failed:', err);
      }
    }

    localStorage.removeItem(this.SNAPSHOT_KEY);
    localStorage.removeItem('SOMBAT_APARTMENT_SNAPSHOT_V1');
    localStorage.removeItem('SOMBAT_APARTMENT_TABLE_SNAPSHOT_V1');
  }

  static async clearDemoData(state) {
    const isDemo = state && state.settings && state.settings.isDemoMode !== undefined
      ? Boolean(state.settings.isDemoMode)
      : true;
    if (isDemo) {
      return this.startProductionMode(state);
    } else {
      return this.clearUsageData(state);
    }
  }

  static async syncToSupabase(url, state) {
    if (!url) throw new Error('กรุณาระบุ Supabase Project URL ก่อน');
    if (!state) {
      console.warn('Blocked syncToSupabase: state is null.');
      return { status: 'success', message: 'Sync blocked: state is null' };
    }
    const apiKey = (state.settings && state.settings.apiKey) || this.getSavedApiKey();
    localStorage.setItem('SOMBAT_APARTMENT_SAVED_SUPABASE_URL', this.cleanUrl(url));
    const baseUrl = this.getBaseSupabaseUrl(url);
    const headers = {
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    };

    const tableCfgs = this.getTableConfigs();
    const singleCfgs = this.getSingletonConfigs();
    const snapshot = this.loadSnapshot();
    const newSnapshot = {};

    // สร้าง request (upsert/delete) ของตารางหลักหนึ่ง category แล้วคืนเป็น array ของ fetch promise
    const buildRequestsForCategory = (category, cfg) => {
      const catRequests = [];
      const rows = Array.isArray(state[category]) ? state[category] : [];
      const keyFn = cfg.keyFn || (r => r.id);
      const prevCat = snapshot[category] || {};
      const catSnap = {};
      const upserts = [];

      rows.forEach(jsRow => {
        if (!jsRow || !jsRow.id) return;
        const key = keyFn(jsRow);
        const dbRow = this.toRow(cfg.fields, jsRow, state);
        const json = JSON.stringify(dbRow);
        catSnap[key] = { id: jsRow.id, json };
        if (!prevCat[key] || prevCat[key].json !== json) {
          upserts.push(dbRow);
        }
      });
      newSnapshot[category] = catSnap;

      // แถวที่หายไปจาก state (ถูกลบ) เทียบกับ key เดิม -> ลบออกจาก DB ด้วย id ล่าสุดที่เคยซิงก์
      const newKeys = new Set(Object.keys(catSnap));
      const deleteIds = Object.entries(prevCat)
        .filter(([key]) => !newKeys.has(key))
        .map(([, v]) => v.id)
        .filter(Boolean);

      if (upserts.length > 0) {
        catRequests.push(
          fetch(`${baseUrl}/rest/v1/${cfg.table}?on_conflict=${cfg.onConflict}`, {
            method: 'POST', headers, body: JSON.stringify(upserts)
          }).then(async r => {
            if (!r.ok) throw new Error(`บันทึก ${cfg.table} ไม่สำเร็จ: ${await r.text() || r.statusText}`);
          })
        );
      }
      if (deleteIds.length > 0) {
        const idList = deleteIds.map(id => `"${String(id).replace(/"/g, '')}"`).join(',');
        catRequests.push(
          fetch(`${baseUrl}/rest/v1/${cfg.table}?id=in.(${idList})`, {
            method: 'DELETE', headers
          }).then(async r => {
            if (!r.ok) throw new Error(`ลบข้อมูล ${cfg.table} ไม่สำเร็จ: ${await r.text() || r.statusText}`);
          })
        );
      }
      return catRequests;
    };

    // ต้องซิงก์ตารางหลักตามลำดับ foreign key จริง ไม่ใช่ยิงพร้อมกันหมดทีเดียว มิฉะนั้นมีโอกาส
    // ที่ตารางลูกไปถึง Supabase ก่อนตารางแม่ที่มันอ้างถึงจะถูกสร้าง แล้วชน foreign key constraint
    // (23503) เช่น tenants.assigned_room_id -> rooms.id, rooms.type_id -> room_types.id
    //   เฟส 1: ไม่มี FK อ้างตารางอื่นในกลุ่มนี้ (room_types, users, ledger, events)
    //   เฟส 2: rooms (อ้าง room_types)
    //   เฟส 3: tenants, invoices, repairs (อ้าง rooms)
    const syncPhases = [
      ['roomTypes', 'users', 'ledger', 'events', 'meterAuditLogs'],
      ['rooms'],
      ['tenants', 'invoices', 'repairs', 'paymentSlips', 'payments']
    ];
    const handledCategories = new Set(syncPhases.flat());

    for (const phaseCategories of syncPhases) {
      const phaseRequests = [];
      phaseCategories.forEach(category => {
        const cfg = tableCfgs[category];
        if (cfg) phaseRequests.push(...buildRequestsForCategory(category, cfg));
      });
      if (phaseRequests.length > 0) {
        await Promise.all(phaseRequests);
      }
    }
    // เผื่อมี category อื่นที่เพิ่มเข้ามาทีหลังแล้วไม่ได้ระบุเฟสไว้ - ซิงก์แบบพร้อมกันตามเดิม (ไม่มี FK ที่รู้จัก)
    const leftoverRequests = [];
    for (const [category, cfg] of Object.entries(tableCfgs)) {
      if (!handledCategories.has(category)) {
        leftoverRequests.push(...buildRequestsForCategory(category, cfg));
      }
    }
    if (leftoverRequests.length > 0) {
      await Promise.all(leftoverRequests);
    }

    // ต้องรอให้ตารางหลัก (โดยเฉพาะ tenants) บันทึกเสร็จก่อน เพราะ tenant_documents /
    // tenant_deposit_deductions มี foreign key อ้างถึง tenants.id — ถ้ายิงพร้อมกันหมด
    // (Promise.all เดียว) จะมีโอกาสที่ request เขียนเอกสารไปถึงก่อนที่แถวผู้เช่าใหม่จะถูกสร้าง
    // แล้วชน foreign key constraint (23503) แบบที่เจอตอนเพิ่มผู้เช่าใหม่พร้อมแนบเอกสารในครั้งเดียว
    // (ตารางหลักทั้งหมดถูก await ไปแล้วทีละเฟสข้างบน ก่อนจะมาถึงจุดนี้)

    const requests = [];

    // เอกสารผู้เช่า / รายการหักมัดจำ ซ้อนอยู่ใน tenant.documents และ tenant.deposit.deductions
    // -> แผ่ออกมาเป็นแถวแบนแล้วซิงก์ลงตารางของตัวเอง เช่นเดียวกับ category อื่น ๆ
    const nestedCfgs = this.getNestedTenantConfigs();
    for (const [key, cfg] of Object.entries(nestedCfgs)) {
      const flatRows = [];
      (Array.isArray(state.tenants) ? state.tenants : []).forEach(t => {
        const arr = key === 'documents' ? (t.documents || []) : ((t.deposit && t.deposit.deductions) || []);
        arr.forEach(item => {
          if (!item || !item.id) return;
          flatRows.push(Object.assign({}, item, { tenantId: t.id }));
        });
      });

      const snapKey = 'tenant_' + key;
      const prevCat = snapshot[snapKey] || {};
      const catSnap = {};
      const upserts = [];
      flatRows.forEach(jsRow => {
        const dbRow = this.toRow(cfg.fields, jsRow);
        const json = JSON.stringify(dbRow);
        catSnap[jsRow.id] = { id: jsRow.id, json };
        if (!prevCat[jsRow.id] || prevCat[jsRow.id].json !== json) upserts.push(dbRow);
      });
      newSnapshot[snapKey] = catSnap;

      const newKeys = new Set(Object.keys(catSnap));
      const deleteIds = Object.entries(prevCat)
        .filter(([k]) => !newKeys.has(k))
        .map(([, v]) => v.id)
        .filter(Boolean);

      if (upserts.length > 0) {
        requests.push(
          fetch(`${baseUrl}/rest/v1/${cfg.table}?on_conflict=${cfg.onConflict}`, {
            method: 'POST', headers, body: JSON.stringify(upserts)
          }).then(async r => {
            if (!r.ok) throw new Error(`บันทึก ${cfg.table} ไม่สำเร็จ: ${await r.text() || r.statusText}`);
          })
        );
      }
      if (deleteIds.length > 0) {
        const idList = deleteIds.map(id => `"${String(id).replace(/"/g, '')}"`).join(',');
        requests.push(
          fetch(`${baseUrl}/rest/v1/${cfg.table}?id=in.(${idList})`, {
            method: 'DELETE', headers
          }).then(async r => {
            if (!r.ok) throw new Error(`ลบข้อมูล ${cfg.table} ไม่สำเร็จ: ${await r.text() || r.statusText}`);
          })
        );
      }
    }

    for (const [category, cfg] of Object.entries(singleCfgs)) {
      const obj = state[category] || {};
      const row = this.toRow(cfg.fields, obj);
      row.id = 1;
      requests.push(
        fetch(`${baseUrl}/rest/v1/${cfg.table}?on_conflict=id`, {
          method: 'POST', headers, body: JSON.stringify(row)
        }).then(async r => {
          if (!r.ok) throw new Error(`บันทึก ${cfg.table} ไม่สำเร็จ: ${await r.text() || r.statusText}`);
        })
      );
    }

    await Promise.all(requests);
    this.saveSnapshot(newSnapshot);
    return { status: 'success', message: 'บันทึกข้อมูลเรียบร้อย' };
  }

  static getApprovedPaidAmount(invoiceId, state) {
    if (!invoiceId || !state || !state.payments) return 0;
    return state.payments
      .filter(p => (p.invoiceId === invoiceId || p.invoice_id === invoiceId) && p.status === 'approved')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }

  static getInvoiceRemainingBalance(inv, state) {
    if (!inv) return 0;
    const approvedPaid = this.getApprovedPaidAmount(inv.id, state);
    const totalWithPenalty = (Number(inv.totalAmount) || 0) + (Number(inv.penaltyAmount) || 0);
    const remaining = totalWithPenalty - approvedPaid;
    return remaining < 0 ? 0 : remaining;
  }

  static recalculateInvoiceStatus(inv, state) {
    if (!inv) return;
    const approvedPaid = this.getApprovedPaidAmount(inv.id, state);
    const totalWithPenalty = (Number(inv.totalAmount) || 0) + (Number(inv.penaltyAmount) || 0);
    const remaining = totalWithPenalty - approvedPaid;
    
    inv.paidAmount = approvedPaid;
    inv.outstandingAmount = remaining < 0 ? 0 : remaining;

    if (inv.outstandingAmount <= 0) {
      inv.status = 'paid';
    } else if (approvedPaid > 0) {
      inv.status = 'partial';
    } else {
      inv.status = (inv.status === 'pending_verification' ? 'pending_verification' : 'unpaid');
    }
  }

  static exportJSON() {
    const state = this.getState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Sombat_Apartment_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/* ==========================================================================
   4. UI COMPONENTS (ALL 10 MODULES FULLY INTERACTIVE)
   ========================================================================== */

class LoginComponent {
  static render(state) {
    const users = state.users || [
      { username: 'superadmin', displayName: 'สมบัติ น้ำวน', role: 'super_admin' },
      { username: 'admin', displayName: 'เจ้าของหอพัก / แอดมิน', role: 'admin' },
      { username: 'staff', displayName: 'พนักงานต้อนรับ (Staff)', role: 'staff' }
    ];

    const settings = state.settings || {};
    const logoIcon = settings.logoIcon || 'fa-house-lock';
    const logoUrl = settings.logoUrl || '';

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />`
      : `<i class="fa-solid ${logoIcon}"></i>`;

    return `
      <div class="login-page-container" style="position:fixed; top:0; left:0; width:100vw; height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); padding:1.5rem; z-index:99999; overflow-y:auto;">
        <div class="glass-card animate-fade-in" style="width:100%; max-width:440px; border-radius:16px; padding:2.5rem; background:rgba(255,255,255,0.96); box-shadow:0 20px 40px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2); margin:auto;">
          
          <div style="text-align:center; margin-bottom:2rem;">
            <div style="width:64px; height:64px; background:linear-gradient(135deg, #2563eb, #1d4ed8); color:#fff; border-radius:16px; display:inline-flex; align-items:center; justify-content:center; font-size:1.8rem; margin-bottom:1rem; box-shadow:0 8px 16px rgba(37,99,235,0.3); overflow:hidden;">
              ${logoHtml}
            </div>
            <h2 style="font-size:1.5rem; font-weight:700; color:#0f172a; margin-bottom:0.35rem;">${(state.settings && state.settings.apartmentName) || 'หอพักสมบัติ นนทบุรี'}</h2>
            <p style="color:#64748b; font-size:0.9rem;">ระบบบริหารจัดการหอพัก Enterprise</p>
          </div>

          <form id="login-form">
            <div class="form-group" style="margin-bottom:1.25rem;">
              <label style="font-weight:600; color:#334155;">Username (ชื่อผู้ใช้งาน)</label>
              <input type="text" id="login-username" class="form-control" value="superadmin" placeholder="ใส่ชื่อผู้ใช้..." required style="padding:0.75rem 1rem; border-radius:8px;">
            </div>

            <div class="form-group" style="margin-bottom:1.25rem;">
              <label style="font-weight:600; color:#334155;">Password (รหัสผ่าน)</label>
              <div style="position:relative;">
                <input type="password" id="login-password" class="form-control" value="" placeholder="ใส่รหัสผ่าน..." required style="padding:0.75rem 1rem; border-radius:8px; padding-right:2.5rem;">
                <button type="button" id="btn-toggle-password" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:#64748b; cursor:pointer;" title="แสดง/ซ่อนรหัสผ่าน">
                  <i class="fa-solid fa-eye"></i>
                </button>
              </div>
            </div>



            <button type="submit" class="btn btn-primary btn-full" style="padding:0.85rem; font-size:1rem; font-weight:600; border-radius:8px; box-shadow:0 4px 12px rgba(37,99,235,0.25);">
              <i class="fa-solid fa-right-to-bracket"></i> เข้าสู่ระบบ (Log In)
            </button>
          </form>

        </div>
      </div>
    `;
  }
}

class NavbarComponent {
  static render(user, state) {
    if (!state) state = {};
    const rooms = state.rooms || [];
    const tenants = state.tenants || [];
    const overdueCount = rooms.filter(r => r.status === 'overdue').length;
    const vacantCount = rooms.filter(r => r.status === 'vacant').length;
    
    const today = new Date();
    const expiringContracts = tenants.filter(t => {
      if (!t.endDate) return false;
      const end = new Date(t.endDate);
      const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 3600 * 24));
      return diffDays >= 0 && diffDays <= 30;
    }).length;

    const totalNotifications = overdueCount + expiringContracts;

    return `
      <header class="app-header">
        <div class="header-left">
          <button id="mobile-toggle-btn" class="icon-btn mobile-only"><i class="fa-solid fa-bars"></i></button>
          <div class="global-search-container">
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
            <input type="text" id="global-search-input" class="global-search-input" placeholder="ค้นหาห้องพัก, ผู้เช่า, เลขบัตร, บิล (Real-time)..." autocomplete="off">
          </div>
        </div>

        <div class="header-right">
          <a href="tenant.html?apiKey=${encodeURIComponent(DBService.getSavedTenantApiKey())}" target="_blank" class="btn btn-secondary btn-sm" style="margin-right:0.5rem; text-decoration:none;" title="เปิดระบบแจ้งบิลผู้เช่า MyBills">
            <i class="fa-solid fa-mobile-screen-button text-success"></i> <span class="desktop-only">เปิดระบบบิลผู้เช่า MyBills</span>
          </a>

          <button id="btn-quick-full-backup" class="btn btn-success btn-sm" style="margin-right:0.5rem;" title="1-Click สำรองข้อมูลทั้งระบบเป็น Excel">
            <i class="fa-solid fa-cloud-arrow-down"></i> <span class="desktop-only">สำรองข้อมูลระบบ</span>
          </button>

          <button id="btn-manual-sync-supabase" class="btn btn-secondary btn-sm" style="margin-right:0.5rem;" title="ดึงข้อมูลล่าสุดจาก Supabase">
            <i class="fa-solid fa-rotate text-primary"></i> <span class="desktop-only">ดึงข้อมูลล่าสุด</span>
          </button>

          <div class="notification-dropdown-wrapper">
            <button id="notification-bell-btn" class="icon-btn" title="การแจ้งเตือนระบบ">
              <i class="fa-regular fa-bell"></i>
              ${totalNotifications > 0 ? `<span class="notification-badge">${totalNotifications}</span>` : ''}
            </button>
            <div id="notification-menu" class="notification-menu-panel">
              <div class="notification-header">
                <h4><i class="fa-solid fa-bell"></i> ศูนย์แจ้งเตือนระบบ</h4>
                <span class="text-muted">${totalNotifications} รายการใหม่</span>
              </div>
              <div class="notification-body">
                ${overdueCount > 0 ? `
                  <div class="notification-item item-danger notif-link-item" data-tab="billing" style="cursor:pointer;">
                    <i class="fa-solid fa-circle-exclamation icon"></i>
                    <div><strong>ผู้เช่าค้างชำระ: ${overdueCount} ห้อง</strong><p>มีห้องพักเกินกำหนดชำระเงิน คลิกเพื่อไปหน้าออกบิล</p></div>
                  </div>
                ` : ''}
                ${expiringContracts > 0 ? `
                  <div class="notification-item item-warning notif-link-item" data-tab="contracts" style="cursor:pointer;">
                    <i class="fa-solid fa-file-contract icon"></i>
                    <div><strong>สัญญาใกล้หมดอายุ: ${expiringContracts} ราย</strong><p>มีผู้เช่าที่มีสัญญาเช่าหมดอายุภายใน 30 วัน คลิกเพื่อเปิดดู</p></div>
                  </div>
                ` : ''}
                <div class="notification-item item-info notif-link-item" data-tab="rooms" style="cursor:pointer;">
                  <i class="fa-solid fa-door-open icon"></i>
                  <div><strong>ห้องว่างพร้อมเข้าอยู่: ${vacantCount} ห้อง</strong><p>สามารถลงทะเบียนผู้เช่าใหม่เข้าพักได้ทันที คลิกเพื่อดูผังห้อง</p></div>
                </div>
              </div>
            </div>
          </div>

          <div class="user-profile-badge" id="navbar-user-profile" style="cursor:pointer;" title="คลิกเพื่อสลับบทบาท/ดูข้อมูลผู้ใช้">
            <div class="avatar"><i class="fa-solid fa-user-shield"></i></div>
            <div class="user-info">
              <span class="name">${user.displayName}</span>
              <span class="role-pill role-${user.role}">
                ${user.role === 'super_admin' ? '👑 Super Admin' : (user.role === 'admin' ? '🛡️ Admin' : '👤 Staff')}
              </span>
            </div>
          </div>

          <button id="logout-btn" class="btn btn-secondary btn-sm" title="ออกจากระบบ">
            <i class="fa-solid fa-right-from-bracket"></i> <span class="desktop-only">ออกจากระบบ</span>
          </button>
        </div>
      </header>
    `;
  }
}

class SidebarComponent {
  static getMenuItems() {
    return [
      { id: 'dashboard', label: 'หน้าหลัก (Dashboard)', icon: 'fa-chart-pie', colorClass: 'nav-icon-blue', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'contracts', label: 'จัดการสัญญาเช่า', icon: 'fa-file-signature', colorClass: 'nav-icon-purple', roles: ['super_admin', 'admin'] },
      { id: 'tenants', label: 'ข้อมูลผู้เช่า', icon: 'fa-user', colorClass: 'nav-icon-blue', roles: ['super_admin', 'admin'] },
      { id: 'rooms', label: 'ข้อมูลห้องเช่า', icon: 'fa-hotel', colorClass: 'nav-icon-cyan', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'roomtypes', label: 'ประเภทห้องเช่า', icon: 'fa-layer-group', colorClass: 'nav-icon-pink', roles: ['super_admin', 'admin'] },
      { id: 'meter-reading', label: 'จดมิเตอร์', icon: 'fa-gauge-high', colorClass: 'nav-icon-amber', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'meter-entry', label: 'ตารางกรอกมิเตอร์', icon: 'fa-table-cells', colorClass: 'nav-icon-orange', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'billing', label: 'ระบบออกบิลค่าเช่า', icon: 'fa-file-invoice-dollar', colorClass: 'nav-icon-orange', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'partial-payments', label: '💳 แบ่งชำระ', icon: 'fa-credit-card', colorClass: 'nav-icon-orange', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'repairs', label: 'ระบบแจ้งซ่อม', icon: 'fa-screwdriver-wrench', colorClass: 'nav-icon-purple', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'accounting', label: 'รายรับ - รายจ่าย', icon: 'fa-scale-balanced', colorClass: 'nav-icon-slate', roles: ['super_admin', 'admin'] },
      { id: 'calendar', label: 'ปฏิทินงาน', icon: 'fa-calendar-days', colorClass: 'nav-icon-rose', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'reports', label: 'ระบบรายงาน', icon: 'fa-chart-line', colorClass: 'nav-icon-cyan', roles: ['super_admin', 'admin'] },
      { id: 'rates', label: 'ตั้งค่าเรท & ค่าบริการ', icon: 'fa-sliders', colorClass: 'nav-icon-slate', roles: ['super_admin', 'admin'] },
      { id: 'settings', label: 'ตั้งค่าเซิร์ฟเวอร์ & Supabase', icon: 'fa-gears', colorClass: 'nav-icon-red', roles: ['super_admin', 'admin'] },
    ];
  }

  static render(activeTabId, apartmentName) {
    const user = AuthService.getCurrentUser();
    const role = user ? user.role : 'staff';
    const items = this.getMenuItems().filter(item => item.roles.includes(role));

    // Get custom logo settings from state
    const settings = (App.state && App.state.settings) ? App.state.settings : {};
    const logoIcon = settings.logoIcon || 'fa-house-lock';
    const logoUrl = settings.logoUrl || '';

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />`
      : `<i class="fa-solid ${logoIcon}"></i>`;

    return `
      <aside class="app-sidebar" id="app-sidebar">
        <div class="sidebar-brand" id="btn-sidebar-brand-edit" style="cursor:pointer; position:relative; overflow:hidden;" title="คลิกเพื่อเปลี่ยนชื่อหอพัก & โลโก้">
          <div class="brand-logo-icon" style="overflow:hidden; flex-shrink:0;">${logoHtml}</div>
          <div class="brand-title">
            <h2>${apartmentName}</h2>
            <span>ระบบจัดการห้องเช่า Enterprise</span>
          </div>
          <div style="position:absolute; right:10px; top:50%; transform:translateY(-50%); font-size:0.8rem; color:rgba(255,255,255,0.45); opacity:0; transition:opacity 0.2s;" class="brand-edit-cog">
            <i class="fa-solid fa-pen-to-square"></i>
          </div>
        </div>

        <nav class="sidebar-nav">
          <ul>
            ${items.map(item => `
              <li class="${activeTabId === item.id ? 'active' : ''}">
                <a href="#${item.id}" data-tab="${item.id}">
                  <span class="nav-icon-wrapper ${item.colorClass || 'nav-icon-slate'}">
                    <i class="fa-solid ${item.icon}"></i>
                  </span>
                  <span>${item.label}</span>
                </a>
              </li>
            `).join('')}
          </ul>
        </nav>

        <div class="sidebar-footer">
          <p><i class="fa-solid fa-cloud text-success"></i> Real-time Supabase Active</p>
          <span class="version">v4.0 Enterprise Edition</span>
        </div>
      </aside>
    `;
  }
}

class DashboardComponent {
  static render(state) {
    if (!state) state = {};
    const rooms = state.rooms || [];
    const invoices = state.invoices || [];
    const tenants = state.tenants || [];
    
    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const vacantRooms = rooms.filter(r => r.status === 'vacant').length;
    const overdueRooms = rooms.filter(r => r.status === 'overdue').length;
    const reservedRooms = rooms.filter(r => r.status === 'reserved').length;

    const todayStr = new Date().toISOString().slice(0, 10);
    const monthKeyCurrent = todayStr.slice(0, 7);
    const yearCurrent = todayStr.slice(0, 4);
    const partialInvoices = invoices.filter(i => i.status === 'partial');
    const partialCount = partialInvoices.length;
    const partialOutstandingTotal = partialInvoices.reduce((sum, i) => sum + (parseFloat(i.outstandingAmount) || 0), 0);

    let todayIncome = 0; let monthIncome = 0; let yearIncome = 0; let totalOutstanding = 0;

    invoices.forEach(inv => {
      if (inv.paymentDate === todayStr) todayIncome += (inv.paidAmount || 0);
      if (inv.monthKey === monthKeyCurrent) monthIncome += (inv.paidAmount || 0);
      if (inv.issueDate && inv.issueDate.startsWith(yearCurrent)) yearIncome += (inv.paidAmount || 0);
      totalOutstanding += (inv.outstandingAmount || 0);
    });

    const today = new Date();
    const expiringTenants = tenants.filter(t => {
      if (!t.endDate) return false;
      const end = new Date(t.endDate);
      const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 3600 * 24));
      return diff >= 0 && diff <= 30;
    });

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-gauge-high text-primary"></i> แผงควบคุมระบบ (Dashboard Overview)</h2>
            <p>สรุปสถิติสถานะห้องพัก รายรับการเงิน และสัญญาเช่าแบบเรียลไทม์</p>
          </div>
          <div class="header-actions">
            <span class="badge-pill badge-primary"><i class="fa-regular fa-clock"></i> ข้อมูล ณ วันที่ ${Formatters.thaiDate(todayStr)}</span>
          </div>
        </div>

        ${partialCount > 0 ? `<div class="alert alert-warning animate-fade-in" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-radius:12px; background:#fff7ed; border:1px solid #ffedd5; color:#9a3412; padding:0.85rem 1.25rem;"><div style="display:flex; align-items:center; gap:0.75rem;"><i class="fa-solid fa-credit-card" style="font-size:1.4rem; color:#ea580c;"></i><span style="font-weight:700;">มีบิลที่อยู่ระหว่างการแบ่งชำระ <strong>${partialCount}</strong> รายการ</span></div><a href="#partial-payments" data-tab="partial-payments" class="btn btn-warning btn-sm" style="padding:0.4rem 1rem; border-radius:8px; font-weight:700; background:#f97316; border-color:#f97316; color:#ffffff; text-decoration:none;"><i class="fa-solid fa-arrow-right"></i> จัดการ</a></div>` : ""}<div class="kpi-cards-grid">
          <div class="kpi-card card-blue">
            <div class="kpi-icon"><i class="fa-solid fa-building"></i></div>
            <div class="kpi-content"><span class="label">จำนวนห้องทั้งหมด</span><h3 class="value">${totalRooms} <small>ห้อง</small></h3><span class="subtext">ชั้น 1 ถึง ชั้น 3</span></div>
          </div>
          <div class="kpi-card card-green">
            <div class="kpi-icon"><i class="fa-solid fa-user-check"></i></div>
            <div class="kpi-content"><span class="label">ห้องที่มีผู้เช่า</span><h3 class="value">${occupiedRooms} <small>ห้อง</small></h3><span class="subtext">คิดเป็น ${totalRooms > 0 ? ((occupiedRooms/totalRooms)*100).toFixed(0) : 0}% ของหอพัก</span></div>
          </div>
          <div class="kpi-card card-gray">
            <div class="kpi-icon"><i class="fa-solid fa-door-open"></i></div>
            <div class="kpi-content"><span class="label">ห้องว่างพร้อมอยู่</span><h3 class="value">${vacantRooms} <small>ห้อง</small></h3><span class="subtext">ว่างรอจัดสรรเข้าพัก</span></div>
          </div>
          <div class="kpi-card card-red">
            <div class="kpi-icon"><i class="fa-solid fa-file-circle-exclamation"></i></div>
            <div class="kpi-content"><span class="label">ยอดค้างชำระรวม</span><h3 class="value text-danger">${Formatters.currency(totalOutstanding)}</h3><span class="subtext">${overdueRooms} ห้องค้างชำระ</span></div>
          </div>
        </div>

        <div class="kpi-cards-grid secondary-kpis" style="margin-top: 1.25rem;">
          <div class="kpi-card card-white"><div class="kpi-icon text-success"><i class="fa-solid fa-hand-holding-dollar"></i></div><div class="kpi-content"><span class="label">รายรับวันนี้</span><h3 class="value text-success">${Formatters.currency(todayIncome)}</h3></div></div>
          <div class="kpi-card card-white"><div class="kpi-icon text-primary"><i class="fa-solid fa-calendar-check"></i></div><div class="kpi-content"><span class="label">รายได้เดือนนี้ (${monthKeyCurrent})</span><h3 class="value text-primary">${Formatters.currency(monthIncome)}</h3></div></div>
          <div class="kpi-card card-white"><div class="kpi-icon text-info"><i class="fa-solid fa-chart-line"></i></div><div class="kpi-content"><span class="label">รายได้รวมปีนี้ (${yearCurrent})</span><h3 class="value text-info">${Formatters.currency(yearIncome)}</h3></div></div>
          <div class="kpi-card card-white"><div class="kpi-icon text-warning"><i class="fa-solid fa-file-contract"></i></div><div class="kpi-content"><span class="label">สัญญาใกล้หมดอายุ</span><h3 class="value text-warning">${expiringTenants.length} <small>ราย</small></h3></div></div><a href="#partial-payments" data-tab="partial-payments" class="kpi-card card-white" style="text-decoration:none; cursor:pointer;" title="คลิกเพื่อดูบิลแบ่งชำระทั้งหมด"><div class="kpi-icon" style="color:#ea580c; background:#fff7ed;"><i class="fa-solid fa-credit-card"></i></div><div class="kpi-content"><span class="label">💳 บิลแบ่งชำระ</span><h3 class="value" style="color:#ea580c;">${partialCount} <small>บิล</small></h3><span class="subtext" style="font-size:0.75rem; color:#9a3412;">ยอดค้าง <strong>${Formatters.currency(partialOutstandingTotal)}</strong></span></div></a>
        </div>

        <div class="charts-grid-container" style="margin-top: 1.5rem; display:grid; grid-template-columns: 1fr;">
          <div class="glass-card chart-card">
            <div class="card-header"><h3><i class="fa-solid fa-chart-pie text-success"></i> สัดส่วนสถานะห้องพัก (Occupancy)</h3></div>
            <div class="chart-wrapper">${this.renderDonutChart(occupiedRooms, vacantRooms, overdueRooms, reservedRooms)}</div>
          </div>
        </div>
      </div>
    `;
  }

  static renderLineChart(state) {
    const monthlyTotals = { '2026-02': 28500, '2026-03': 31000, '2026-04': 30500, '2026-05': 32800, '2026-06': 34200, '2026-07': 35400 };
    const months = Object.keys(monthlyTotals);
    const values = Object.values(monthlyTotals);
    const maxVal = Math.max(...values, 40000) * 1.1;

    const width = 500; const height = 200; const padding = 30;
    const chartW = width - padding * 2; const chartH = height - padding * 2;

    const points = months.map((m, i) => {
      const x = padding + i * (chartW / (months.length - 1));
      const y = height - padding - (monthlyTotals[m] / maxVal) * chartH;
      return { x, y, val: monthlyTotals[m], label: m };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return `
      <svg class="svg-chart" viewBox="0 0 ${width} ${height}">
        <defs><linearGradient id="line-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2563eb" stop-opacity="0.3"/><stop offset="100%" stop-color="#2563eb" stop-opacity="0"/></linearGradient></defs>
        <path d="${areaPath}" fill="url(#line-grad)"/>
        <path d="${linePath}" fill="none" stroke="#2563eb" stroke-width="3"/>
        ${points.map(p => `
          <circle cx="${p.x}" cy="${p.y}" r="5" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>
          <text x="${p.x}" y="${p.y - 10}" fill="#1e293b" font-size="10" font-weight="bold" text-anchor="middle">฿${(p.val/1000).toFixed(1)}k</text>
          <text x="${p.x}" y="${height - 10}" fill="#64748b" font-size="10" text-anchor="middle">${p.label.split('-')[1]}/${p.label.split('-')[0].slice(2)}</text>
        `).join('')}
      </svg>
    `;
  }

  static renderDonutChart(occupied, vacant, overdue, reserved) {
    const total = occupied + vacant + overdue + reserved;
    if (total === 0) return `<p class="text-center text-muted">ไม่มีข้อมูล</p>`;
    const r = 16; const occP = (occupied / total) * 100; const vacP = (vacant / total) * 100; const ovdP = (overdue / total) * 100;

    return `
      <div style="display: flex; align-items: center; justify-content: space-around;">
        <div style="position: relative; width: 160px; height: 160px;">
          <svg width="100%" height="100%" viewBox="0 0 42 42">
            <circle cx="21" cy="21" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="5"/>
            <circle cx="21" cy="21" r="${r}" fill="none" stroke="#10b981" stroke-width="5" stroke-dasharray="${occP} ${100-occP}" stroke-dashoffset="0"/>
            <circle cx="21" cy="21" r="${r}" fill="none" stroke="#ef4444" stroke-width="5" stroke-dasharray="${ovdP} ${100-ovdP}" stroke-dashoffset="-${occP}"/>
            <circle cx="21" cy="21" r="${r}" fill="none" stroke="#94a3b8" stroke-width="5" stroke-dasharray="${vacP} ${100-vacP}" stroke-dashoffset="-${occP + ovdP}"/>
          </svg>
          <div style="position: absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center;">
            <span style="font-size: 1.4rem; font-weight: bold; color: #1e293b;">${total}</span>
            <span style="display:block; font-size: 0.75rem; color: #64748b;">ห้องทั้งหมด</span>
          </div>
        </div>
        <div class="chart-legend-list">
          <div class="legend-item">🟢 มีผู้เช่า: <strong>${occupied}</strong></div>
          <div class="legend-item">🔴 ค้างชำระ: <strong>${overdue}</strong></div>
          <div class="legend-item">⚪ ห้องว่าง: <strong>${vacant}</strong></div>
          <div class="legend-item">🟡 จองแล้ว: <strong>${reserved}</strong></div>
        </div>
      </div>
    `;
  }
}

class ContractsComponent {
  static render(state) {
    const tenants = [...state.tenants].sort((a, b) => {
      const roomA = state.rooms.find(r => r.id === a.assignedRoomId);
      const roomB = state.rooms.find(r => r.id === b.assignedRoomId);
      if (!roomA && !roomB) return 0;
      if (!roomA) return 1;
      if (!roomB) return -1;
      return DBService.compareRooms(roomA, roomB);
    });
    const rooms = state.rooms;

    const contracts = tenants.map(t => {
      const room = rooms.find(r => r.id === t.assignedRoomId);
      const today = new Date();
      const end = t.endDate ? new Date(t.endDate) : new Date();
      const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 3600 * 24));
      
      let status = 'active'; let statusText = '🟢 มีผลบังคับใช้'; let statusBadge = 'badge-success';

      if (diffDays < 0) { status = 'expired'; statusText = '🔴 หมดอายุสัญญา'; statusBadge = 'badge-danger'; }
      else if (diffDays <= 30) { status = 'expiring'; statusText = '🟡 ใกล้หมดสัญญา'; statusBadge = 'badge-warning'; }

      return {
        id: 'ctr_' + t.id,
        contractNumber: `CTR-2026-${(t.id || '').replace(/^tenant_|^t_/i, '').slice(-6).toUpperCase()}`,
        tenantId: t.id,
        tenantName: t.name,
        idCard: t.idCard,
        tel: t.tel,
        roomId: t.assignedRoomId,
        roomName: room ? room.name : 'ยังไม่จัดห้อง',
        startDate: t.startDate,
        endDate: t.endDate,
        monthlyRent: room ? room.baseRent : 3500,
        depositAmount: t.deposit ? t.deposit.initialBail : 7000,
        status, statusText, statusBadge, diffDays
      };
    });

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-file-contract text-primary"></i> จัดการสัญญาเช่า (Rental Contracts Management)</h2>
            <p>ออกหนังสือสัญญาเช่า พิมพ์เอกสาร PDF บันทึกย้ายเข้า-ย้ายออก และติดตามวันหมดอายุสัญญา</p>
          </div>
          <div class="header-actions">
            <button id="btn-export-contracts-excel" class="btn btn-secondary"><i class="fa-solid fa-file-excel text-success"></i> Export Excel</button>
            <button id="btn-create-contract" class="btn btn-primary"><i class="fa-solid fa-file-circle-plus"></i> ออกสัญญาเช่าใหม่</button>
          </div>
        </div>

        <div class="room-status-filter-bar">
          <button class="contract-filter-btn active" data-filter="all">สัญญาทั้งหมด (${contracts.length})</button>
          <button class="contract-filter-btn" data-filter="active">🟢 มีผลบังคับใช้ (${contracts.filter(c => c.status === 'active').length})</button>
          <button class="contract-filter-btn" data-filter="expiring">🟡 ใกล้หมดอายุ 30 วัน (${contracts.filter(c => c.status === 'expiring').length})</button>
          <button class="contract-filter-btn" data-filter="expired">🔴 หมดอายุสัญญา (${contracts.filter(c => c.status === 'expired').length})</button>
        </div>

        <div class="glass-card style-table-card">
          <div class="table-responsive">
            <table class="custom-table" id="contracts-table">
              <thead>
                <tr>
                  <th>เลขที่สัญญา</th>
                  <th>ห้องพัก</th>
                  <th>ผู้เช่าหลัก</th>
                  <th>เลขบัตรประชาชน</th>
                  <th>วันเริ่มสัญญา - วันหมดอายุ</th>
                  <th>ค่าเช่า / เงินมัดจำ</th>
                  <th>สถานะสัญญา</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${contracts.map(c => `
                  <tr class="contract-row" data-status="${c.status}">
                    <td><strong>${c.contractNumber}</strong></td>
                    <td><span class="badge-pill badge-primary">ห้อง ${c.roomName}</span></td>
                    <td><strong>${c.tenantName}</strong><div class="text-muted text-sm">${c.tel}</div></td>
                    <td><code>${Formatters.formatIdCard(c.idCard)}</code></td>
                    <td>
                      <div>${Formatters.thaiDate(c.startDate)} ➔</div>
                      <div class="${c.status === 'expiring' ? 'text-warning' : c.status === 'expired' ? 'text-danger' : 'text-main'}">
                        <strong>${Formatters.thaiDate(c.endDate)}</strong>
                      </div>
                    </td>
                    <td>
                      <div>ค่าเช่า: <strong>${Formatters.currency(c.monthlyRent)}</strong></div>
                      <div class="text-success text-sm">มัดจำ: ${Formatters.currency(c.depositAmount)}</div>
                    </td>
                    <td><span class="badge-pill ${c.statusBadge}">${c.statusText}</span></td>
                    <td>
                      <div class="action-buttons">
                        <button class="btn btn-secondary btn-xs btn-print-contract-pdf" data-tenant-id="${c.tenantId}" title="พิมพ์สัญญา PDF">
                          <i class="fa-solid fa-print text-warning"></i> พิมพ์สัญญา (หน้า-หลัง)
                        </button>
                        <button class="btn btn-secondary btn-xs btn-edit-contract" data-tenant-id="${c.tenantId}" title="แก้ไขรายละเอียดสัญญา & พยาน">
                          <i class="fa-solid fa-pen-to-square text-info"></i> แก้ไขสัญญา
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

class TenantsComponent {
  static activeSection = 'home';

  static render(state) {
    if (!state.tenants) state.tenants = [];
    if (!this.activeSection) this.activeSection = 'home';

    const activeCount = state.tenants.filter(t => t.status !== 'inactive').length;
    const inactiveCount = state.tenants.filter(t => t.status === 'inactive').length;

    if (this.activeSection === 'home') {
      return `
        <div class="view-container animate-fade-in">
          <div class="view-header">
            <div>
              <h2><i class="fa-solid fa-users text-primary"></i> ข้อมูลผู้เช่าและเอกสารสัญญา</h2>
              <p>เลือกประเภทกลุ่มผู้เช่าเพื่อตรวจสอบรายละเอียด ทะเบียนประวัติ สัญญาเช่า และเอกสารแนบ</p>
            </div>
          </div>

          <div class="settings-grid" style="margin-top: 1rem;">
            <div class="settings-card-item glass-card btn-select-tenant-subtab" data-subtab="active">
              <div class="settings-card-icon-wrapper" style="display:flex; align-items:center; justify-content:center; width:52px; height:52px; border-radius:12px; background: #3b82f620; color: #3b82f6; font-size:1.45rem;">
                <i class="fa-solid fa-user-check"></i>
              </div>
              <div style="flex:1;">
                <h4 class="settings-card-title" style="font-weight:700; font-size:1.05rem; color:var(--text-main); margin-bottom:0.25rem; margin-top:0;">ผู้เช่าปัจจุบัน / ใหม่</h4>
                <p class="settings-card-desc" style="font-size:0.8rem; color:var(--text-muted); line-height:1.4; margin:0;">แสดงทะเบียนผู้เช่าที่เข้าพักอยู่ สัญญาเช่าปัจจุบัน หรือดำเนินการย้ายออก (${activeCount} คน)</p>
              </div>
              <div style="color:var(--text-muted); font-size:0.9rem;">
                <i class="fa-solid fa-chevron-right"></i>
              </div>
            </div>

            <div class="settings-card-item glass-card btn-select-tenant-subtab" data-subtab="inactive">
              <div class="settings-card-icon-wrapper" style="display:flex; align-items:center; justify-content:center; width:52px; height:52px; border-radius:12px; background: #64748b20; color: #64748b; font-size:1.45rem;">
                <i class="fa-solid fa-user-slash"></i>
              </div>
              <div style="flex:1;">
                <h4 class="settings-card-title" style="font-weight:700; font-size:1.05rem; color:var(--text-main); margin-bottom:0.25rem; margin-top:0;">ประวัติผู้เช่าเก่า</h4>
                <p class="settings-card-desc" style="font-size:0.8rem; color:var(--text-muted); line-height:1.4; margin:0;">ดูประวัติผู้เช่าเดิม ทำสัญญาใหม่โดยนำโปรไฟล์เดิมมาใช้ หรือลบข้อมูลถาวร (${inactiveCount} คน)</p>
              </div>
              <div style="color:var(--text-muted); font-size:0.9rem;">
                <i class="fa-solid fa-chevron-right"></i>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    const allTenants = state.tenants || [];
    const isPast = this.activeSection === 'inactive';
    const filteredTenants = allTenants.filter(t => {
      if (isPast) {
        return t.status === 'inactive';
      } else {
        return t.status !== 'inactive';
      }
    });

    const tenants = [...filteredTenants].sort((a, b) => {
      const roomA = state.rooms ? state.rooms.find(r => r.id === a.assignedRoomId) : null;
      const roomB = state.rooms ? state.rooms.find(r => r.id === b.assignedRoomId) : null;
      if (!roomA && !roomB) return 0;
      if (!roomA) return 1;
      if (!roomB) return -1;
      return DBService.compareRooms(roomA, roomB);
    });

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header" style="margin-bottom:1.5rem;">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <button id="btn-back-to-tenants-dashboard" class="btn btn-secondary btn-sm" style="padding:0.4rem 0.75rem; display:flex; align-items:center; gap:0.25rem;">
              <i class="fa-solid fa-arrow-left"></i> ย้อนกลับ
            </button>
            <div>
              <h2 style="margin:0;"><i class="fa-solid ${isPast ? 'fa-user-slash text-slate' : 'fa-user-check text-primary'}"></i> ${isPast ? 'ประวัติผู้เช่าเก่า' : 'ทะเบียนผู้เช่าปัจจุบัน / ใหม่'}</h2>
              <p style="margin:0.25rem 0 0 0; font-size:0.85rem; color:var(--text-muted);">
                ${isPast ? 'จัดการและดึงประวัติข้อมูลผู้เช่าที่ย้ายออกไปแล้วกลับมาใช้ใหม่' : 'จัดการข้อมูลผู้เช่าปัจจุบัน สัญญา และการแจ้งย้ายออก'}
              </p>
            </div>
          </div>
          <div class="header-actions">
            <button id="btn-export-tenants-excel" class="btn btn-secondary"><i class="fa-solid fa-file-excel text-success"></i> Export Excel</button>
            <button id="btn-add-tenant" class="btn btn-primary"><i class="fa-solid fa-user-plus"></i> เพิ่มผู้เช่าใหม่</button>
          </div>
        </div>

        <div class="glass-card style-table-card">
          <div class="table-responsive">
            <table class="custom-table" id="tenants-table">
              <thead>
                <tr>
                  <th>ชื่อ - นามสกุล</th>
                  <th>ห้องพัก</th>
                  <th>เลขบัตรประชาชน</th>
                  <th>เบอร์โทร / Line</th>
                  <th>เอกสารแนบ</th>
                  <th>วันเริ่ม - สิ้นสุดสัญญา</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${tenants.length === 0 ? `
                  <tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">ยังไม่มีข้อมูลผู้เช่าในกลุ่มนี้</td></tr>
                ` : tenants.map(t => {
                  const room = state.rooms.find(r => r.id === t.assignedRoomId);
                  const roomBadge = room 
                    ? `<span class="badge-pill badge-primary">ห้อง ${room.name}</span>` 
                    : (t.lastAssignedRoomName 
                        ? `<span class="badge-pill badge-gray">ห้องเดิม: ${t.lastAssignedRoomName}</span>` 
                        : `<span class="badge-pill badge-gray">ยังไม่ระบุ</span>`);
                  const docCount = t.documents ? t.documents.length : 0;
                  return `
                    <tr>
                      <td><strong>${t.name}</strong></td>
                      <td>${roomBadge}</td>
                      <td><code>${Formatters.formatIdCard(t.idCard)}</code></td>
                      <td>${t.tel} ${t.lineId ? `(${t.lineId})` : ''}</td>
                      <td>
                        <div style="display:flex; flex-direction:column; gap:0.25rem; align-items:flex-start;">
                          <button class="btn btn-secondary btn-xs btn-view-docs" data-id="${t.id}" style="width:100%; text-align:left;">
                            <i class="fa-solid fa-folder-open text-primary"></i> เอกสารทั้งหมด (${docCount})
                          </button>
                          ${(t.documents || []).some(d => d.category === 'idcard' && d.dataUrl) ? `
                            <a href="${(t.documents || []).find(d => d.category === 'idcard').dataUrl}" target="_blank" class="btn btn-success btn-xs" style="width:100%; font-size:0.75rem; text-align:left; padding:0.15rem 0.35rem;">
                              <i class="fa-solid fa-id-card"></i> ดูบัตรประชาชน
                            </a>
                          ` : ''}
                          ${(t.documents || []).some(d => d.category === 'house' && d.dataUrl) ? `
                            <a href="${(t.documents || []).find(d => d.category === 'house').dataUrl}" target="_blank" class="btn btn-info btn-xs" style="width:100%; font-size:0.75rem; text-align:left; padding:0.15rem 0.35rem;">
                              <i class="fa-solid fa-house-user"></i> ดูทะเบียนบ้าน
                            </a>
                          ` : ''}
                        </div>
                      </td>
                      <td>${Formatters.thaiDate(t.startDate)} ➔ <strong class="text-warning">${Formatters.thaiDate(t.endDate)}</strong></td>
                      <td>
                        ${isPast ? `
                          <div class="action-buttons">
                            <button class="btn btn-primary btn-xs btn-reuse-tenant" data-id="${t.id}"><i class="fa-solid fa-file-signature"></i> ทำสัญญาใหม่</button>
                            <button class="btn btn-danger btn-xs btn-delete-tenant-permanently" data-id="${t.id}" data-name="${t.name}"><i class="fa-solid fa-trash"></i> ลบถาวร</button>
                          </div>
                        ` : `
                          <div class="action-buttons">
                            <button class="btn btn-secondary btn-xs btn-gen-contract" data-id="${t.id}"><i class="fa-solid fa-file-contract text-warning"></i> สัญญา</button>
                            <button class="btn btn-secondary btn-xs btn-edit-tenant" data-id="${t.id}"><i class="fa-solid fa-pen text-info"></i> แก้ไข</button>
                            <button class="btn btn-danger btn-xs btn-delete-tenant" data-id="${t.id}" data-name="${t.name}"><i class="fa-solid fa-sign-out"></i> ย้ายออก / ลบ</button>
                          </div>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

class RoomsComponent {
  static render(state) {
    const rawRooms = state.rooms || [];
    const roomTypes = state.roomTypes || [];

    const rooms = [...rawRooms].sort(DBService.compareRooms);

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-building-user text-primary"></i> ข้อมูลห้องพัก (Room Card Layout)</h2>
            <p>จัดการห้องพัก ปรับสถานะ 4 สี ย้ายผู้เช่า และกำหนดราคาเช่าแยกรายห้อง</p>
          </div>
          <div class="header-actions" style="display:flex; gap:0.75rem; flex-wrap:wrap;">
            <button id="btn-bulk-invoices" class="btn btn-secondary" style="background:#f97316; color:#fff; border:none; box-shadow: 0 4px 10px rgba(249,115,22,0.2);"><i class="fa-solid fa-bolt"></i> ออกบิลทุกห้อง (Bulk)</button>
            <button id="btn-add-room" class="btn btn-primary"><i class="fa-solid fa-plus"></i> เพิ่มห้องพักใหม่</button>
          </div>
        </div>

        <div class="rooms-cards-grid" id="rooms-grid">
          ${rooms.length === 0 ? `
            <div class="glass-card text-center" style="grid-column: 1 / -1; padding:4rem 2rem; border-radius:16px;">
              <div style="font-size:3.5rem; color:#cbd5e1; margin-bottom:1rem;"><i class="fa-solid fa-door-closed"></i></div>
              <h3 style="color:#334155; font-size:1.25rem; font-weight:700;">ยังไม่มีข้อมูลห้องพักในระบบ</h3>
              <p class="text-muted" style="margin-top:0.35rem; margin-bottom:1.5rem;">คุณสามารถกดปุ่ม "เพิ่มห้องพักใหม่" ด้านบนเพื่อเริ่มสร้างห้องเช่าประจำหอพักได้ทันที</p>
              <button class="btn btn-primary" id="btn-add-room-empty"><i class="fa-solid fa-plus"></i> เพิ่มห้องพักแรกในระบบ</button>
            </div>
          ` : rooms.map(room => {
            const type = roomTypes.find(t => t.id === room.typeId);
            const typeName = type ? type.name : 'มาตรฐาน';

            const isVacant = room.status === 'vacant' && (!room.currentTenantName || room.currentTenantName === 'ไม่มีผู้เข้าเช่า' || room.currentTenantName === '-');
            const statusClass = isVacant ? 'status-vacant' : 'status-not-vacant';
            const statusText = isVacant ? '⚪ ว่าง' : '🟢 มีผู้เช่า';
            const statusBadgeClass = isVacant ? 'badge-gray' : 'badge-success';

            return `
              <div class="room-card ${statusClass}">
                <div class="room-card-header">
                  <div class="room-number">ห้อง ${room.name}</div>
                  <span class="badge-pill ${statusBadgeClass}">${statusText}</span>
                </div>
                <div class="room-card-body">
                  <div class="info-row"><span>ชั้น / ประเภท:</span><strong>ชั้น ${room.floor} (${typeName})</strong></div>
                  <div class="info-row"><span>ค่าเช่า:</span><strong class="text-primary">${Formatters.currency(room.baseRent)} ${type && type.rentalType === 'daily' ? '/ วัน' : '/ เดือน'}</strong></div>
                  <div class="info-row"><span>ผู้เช่าปัจจุบัน:</span><strong>${room.currentTenantName || 'ไม่มีผู้เข้าเช่า'}</strong></div>
                </div>
                <div class="room-card-footer">
                  <button class="btn btn-secondary btn-xs btn-edit-room" data-id="${room.id}" title="แก้ไขห้อง"><i class="fa-solid fa-pen"></i> แก้ไข</button>
                  <button class="btn btn-primary btn-xs btn-action-bill" data-id="${room.id}" title="ออกบิล"><i class="fa-solid fa-calculator"></i> บิล</button>
                  <button class="btn btn-danger btn-xs btn-delete-room" data-id="${room.id}" data-name="${room.name}" title="ลบห้อง"><i class="fa-solid fa-trash"></i> ลบ</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
}

class RoomTypesComponent {
  static render(state) {
    const roomTypes = state.roomTypes || [];

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-layer-group text-primary"></i> จัดการประเภทห้องเช่า (รายวัน & รายเดือน)</h2>
            <p>กำหนดประเภทห้องเช่า เช่น ห้องพัดลม, ห้องแอร์, ห้องรายวัน (Daily), ห้องพาณิชย์ และเรทราคาค่าเช่า</p>
          </div>
          <div class="header-actions">
            <button id="btn-add-roomtype" class="btn btn-primary"><i class="fa-solid fa-plus"></i> เพิ่มประเภทห้องเช่าใหม่</button>
          </div>
        </div>

        <div class="glass-card">
          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>ชื่อประเภทห้องเช่า</th>
                  <th>รูปแบบสัญญาเช่า</th>
                  <th>อัตราค่าเช่า (บาท)</th>
                  <th>รายละเอียดห้อง</th>
                  <th>จำนวนห้องในระบบ</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${roomTypes.length === 0 ? `
                  <tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">ยังไม่มีประเภทห้องเช่า กดปุ่ม "เพิ่มประเภทห้องเช่าใหม่" ด้านบนเพื่อเริ่มสร้าง</td></tr>
                ` : roomTypes.map(rt => {
                  const isDaily = rt.rentalType === 'daily';
                  const roomCount = (state.rooms || []).filter(r => r.typeId === rt.id).length;
                  return `
                    <tr>
                      <td><strong>${rt.name}</strong></td>
                      <td>
                        <span class="badge-pill ${isDaily ? 'badge-warning' : 'badge-info'}">
                          ${isDaily ? '🌞 สัญญารายวัน (Daily)' : '📅 สัญญารายเดือน (Monthly)'}
                        </span>
                      </td>
                      <td><strong class="text-primary">${Formatters.currency(rt.defaultRent)} ${isDaily ? '/ วัน' : '/ เดือน'}</strong></td>
                      <td><span class="text-muted text-sm">${rt.description || '-'}</span></td>
                      <td><span class="badge-pill badge-gray">${roomCount} ห้อง</span></td>
                      <td>
                        <div class="action-buttons">
                          <button class="btn btn-secondary btn-xs btn-edit-roomtype" data-id="${rt.id}"><i class="fa-solid fa-pen text-info"></i> แก้ไข</button>
                          <button class="btn btn-danger btn-xs btn-delete-roomtype" data-id="${rt.id}" data-name="${rt.name}"><i class="fa-solid fa-trash"></i> ลบ</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

class PartialPaymentsComponent {
  static searchKeyword = '';
  static currentFilter = 'all'; // 'all' | 'partial' | 'unpaid' | 'approaching'
  static currentSort = 'latest'; // 'latest' | 'highest_remaining' | 'room'

  static render(state) {
    const invoices = state.invoices || [];
    let list = invoices.filter(i => i.status === 'partial' || i.status === 'unpaid' || i.status === 'overdue');

    const totalPartialCount = invoices.filter(i => i.status === 'partial').length;
    const totalPartialOutstanding = invoices.filter(i => i.status === 'partial').reduce((sum, i) => sum + (parseFloat(i.outstandingAmount) || 0), 0);

    // Filter by tab
    if (this.currentFilter === 'partial') {
      list = list.filter(i => i.status === 'partial');
    } else if (this.currentFilter === 'unpaid') {
      list = list.filter(i => i.status === 'unpaid' || i.status === 'overdue');
    } else if (this.currentFilter === 'approaching') {
      const today = new Date();
      list = list.filter(i => {
        if (!i.dueDate) return false;
        const due = new Date(i.dueDate);
        const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 3600 * 24));
        return diff >= 0 && diff <= 5;
      });
    }

    // Search
    if (this.searchKeyword) {
      const kw = this.searchKeyword.toLowerCase().trim();
      list = list.filter(i => 
        (i.roomName && i.roomName.toLowerCase().includes(kw)) ||
        (i.tenantName && i.tenantName.toLowerCase().includes(kw)) ||
        (i.invoiceNumber && i.invoiceNumber.toLowerCase().includes(kw))
      );
    }

    // Sort
    if (this.currentSort === 'highest_remaining') {
      list.sort((a, b) => (parseFloat(b.outstandingAmount) || 0) - (parseFloat(a.outstandingAmount) || 0));
    } else if (this.currentSort === 'room') {
      list.sort((a, b) => (a.roomName || '').localeCompare(b.roomName || ''));
    } else {
      // latest
      list.sort((a, b) => (b.monthKey || '').localeCompare(a.monthKey || ''));
    }

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-credit-card text-warning"></i> ระบบจัดการบิลแบ่งชำระ (Partial Payments)</h2>
            <p>จัดการบิลค่าเช่าที่มีการแบ่งชำระ บันทึกงวดชำระ และตรวจสอบสลีปย้อนหลัง</p>
          </div>
          <div class="header-actions">
            <span class="badge-pill badge-warning" style="font-size:0.9rem; padding:0.5rem 1rem;">
              💳 แบ่งชำระ: <strong>${totalPartialCount}</strong> บิล (ยอดค้างรวม ${Formatters.currency(totalPartialOutstanding)})
            </span>
          </div>
        </div>

        <!-- Search & Filter Controls -->
        <div class="glass-card" style="padding:1rem; margin-bottom:1.25rem;">
          <div style="display:grid; grid-template-columns: 1fr auto auto; gap:0.75rem; align-items:center;">
            <div style="position:relative;">
              <i class="fa-solid fa-magnifying-glass" style="position:absolute; left:1rem; top:50%; transform:translateY(-50%); color:var(--text-muted);"></i>
              <input type="text" id="partial-search-input" class="form-control" placeholder="ค้นหาตามเลขห้อง, ชื่อผู้เช่า หรือเลขที่บิล..." value="${this.searchKeyword}" style="padding-left:2.5rem; border-radius:10px;">
            </div>
            
            <select id="partial-filter-select" class="form-control" style="border-radius:10px; font-weight:600;">
              <option value="all" ${this.currentFilter === 'all' ? 'selected' : ''}>บิลค้างชำระทั้งหมด (${invoices.filter(i => i.status === 'partial' || i.status === 'unpaid' || i.status === 'overdue').length})</option>
              <option value="partial" ${this.currentFilter === 'partial' ? 'selected' : ''}>🟠 กำลังแบ่งชำระ (${totalPartialCount})</option>
              <option value="unpaid" ${this.currentFilter === 'unpaid' ? 'selected' : ''}>🔴 ยังไม่เคยชำระ</option>
              <option value="approaching" ${this.currentFilter === 'approaching' ? 'selected' : ''}>⏰ ใกล้ครบกำหนด (ภายใน 5 วัน)</option>
            </select>

            <select id="partial-sort-select" class="form-control" style="border-radius:10px; font-weight:600;">
              <option value="latest" ${this.currentSort === 'latest' ? 'selected' : ''}>เรียงตามรอบบิลล่าสุด</option>
              <option value="highest_remaining" ${this.currentSort === 'highest_remaining' ? 'selected' : ''}>เรียงตามยอดคงเหลือมากสุด</option>
              <option value="room" ${this.currentSort === 'room' ? 'selected' : ''}>เรียงตามเลขห้อง</option>
            </select>
          </div>
        </div>

        <!-- Cards Grid Container -->
        ${list.length === 0 ? `
          <div class="glass-card text-center" style="padding:3rem 1.5rem;">
            <i class="fa-solid fa-circle-check text-success" style="font-size:3rem; margin-bottom:1rem;"></i>
            <h3 style="font-weight:700; color:var(--text-main);">ไม่พบรายการบิลแบ่งชำระในเงื่อนไขนี้</h3>
            <p style="color:var(--text-muted);">ไม่มีบิลที่ตรงกับคำค้นหาหรือตัวกรองที่เลือก</p>
          </div>
        ` : `
          <div class="partial-payment-grid">
            ${list.map(inv => {
              const total = parseFloat(inv.totalAmount) || 0;
              const paid = parseFloat(inv.paidAmount) || 0;
              const remaining = parseFloat(inv.outstandingAmount) || (total - paid);
              const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
              
              const payments = state.payments ? state.payments.filter(p => p.invoiceId === inv.id) : [];
              const approvedPayments = payments.filter(p => p.status === 'approved');
              const latestPayment = payments.length > 0 ? payments[payments.length - 1] : null;
              const latestDate = latestPayment ? Formatters.thaiDate(latestPayment.paymentDate || latestPayment.createdAt) : '-';

              return `
                <div class="partial-payment-card">
                  <div>
                    <div class="partial-card-header">
                      <div>
                        <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-main); margin:0;">ห้อง ${inv.roomName}</h3>
                        <span style="font-size:0.85rem; color:var(--text-muted);">${inv.tenantName || 'ผู้เช่า'} • บิลเดือน ${Formatters.thaiMonthBE(inv.monthKey)}</span>
                      </div>
                      <span class="status-chip ${inv.status === 'partial' ? 'partial' : 'pending'}">
                        ${inv.status === 'partial' ? '🟠 แบ่งชำระ' : '🔴 ค้างชำระ'}
                      </span>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem; text-align:center; background:var(--bg-hover, #f8fafc); padding:0.6rem; border-radius:10px; margin-bottom:0.75rem;">
                      <div>
                        <span style="font-size:0.72rem; color:var(--text-muted); display:block;">ยอดบิล</span>
                        <strong style="font-size:0.92rem; color:var(--text-main);">${Formatters.currency(total)}</strong>
                      </div>
                      <div>
                        <span style="font-size:0.72rem; color:#16a34a; display:block;">ชำระแล้ว</span>
                        <strong style="font-size:0.92rem; color:#16a34a;">${Formatters.currency(paid)}</strong>
                      </div>
                      <div>
                        <span style="font-size:0.72rem; color:#dc2626; display:block;">คงเหลือ</span>
                        <strong style="font-size:0.95rem; color:#dc2626;">${Formatters.currency(remaining)}</strong>
                      </div>
                    </div>

                    <div class="payment-progress-bar-container">
                      <div class="progress-label-row">
                        <span>ชำระแล้ว ${Formatters.currency(paid)} / ${Formatters.currency(total)}</span>
                        <span>${percent}%</span>
                      </div>
                      <div class="payment-progress-track">
                        <div class="payment-progress-fill" style="width:${percent}%;"></div>
                      </div>
                    </div>

                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.6rem; display:flex; justify-content:space-between; border-top:1px dashed var(--border-color); padding-top:0.4rem;">
                      <span><i class="fa-solid fa-receipt text-primary"></i> ชำระแล้ว ${approvedPayments.length} ครั้ง</span>
                      <span><i class="fa-regular fa-clock"></i> ล่าสุด: ${latestDate}</span>
                    </div>
                  </div>

                  <div style="display:flex; gap:0.5rem; margin-top:1.25rem;">
                    <button class="btn btn-secondary btn-sm btn-partial-details" data-id="${inv.id}" style="flex:1; border-radius:8px; font-weight:700;">
                      <i class="fa-solid fa-eye"></i> ดูรายละเอียด
                    </button>
                    <button class="btn btn-primary btn-sm btn-partial-add-pay" data-id="${inv.id}" style="flex:1; border-radius:8px; font-weight:700; background:#f97316; border-color:#f97316;">
                      <i class="fa-solid fa-plus"></i> บันทึกการชำระ
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  }

  static bindEvents(state) {
    const searchInput = document.getElementById('partial-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchKeyword = e.target.value;
        App.switchTab('partial-payments');
      });
    }

    const filterSelect = document.getElementById('partial-filter-select');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        App.switchTab('partial-payments');
      });
    }

    const sortSelect = document.getElementById('partial-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        App.switchTab('partial-payments');
      });
    }

    document.querySelectorAll('.btn-partial-details').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.openDetailsModal(id, state);
      });
    });

    document.querySelectorAll('.btn-partial-add-pay').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.openAddPaymentModal(id, state);
      });
    });
  }

  static openDetailsModal(invoiceId, state) {
    const inv = state.invoices.find(i => i.id === invoiceId);
    if (!inv) return;

    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    const total = parseFloat(inv.totalAmount) || 0;
    const paid = parseFloat(inv.paidAmount) || 0;
    const remaining = parseFloat(inv.outstandingAmount) || (total - paid);
    const payments = state.payments ? state.payments.filter(p => p.invoiceId === inv.id) : [];

    dialog.innerHTML = `
      <div class="modal-header" style="background:#f97316; color:#ffffff;">
        <h3><i class="fa-solid fa-receipt"></i> รายละเอียดบิลและการแบ่งชำระ - ห้อง ${inv.roomName}</h3>
        <button type="button" class="close-modal-btn" style="color:#ffffff;">&times;</button>
      </div>
      <div class="modal-body" style="padding:1.25rem;">
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem; margin-bottom:1.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <span style="font-weight:700; font-size:1.05rem;">บิลเดือน ${Formatters.thaiMonthBE(inv.monthKey)}</span>
            <span class="status-chip ${inv.status === 'partial' ? 'partial' : 'pending'}">${inv.status === 'partial' ? '🟠 แบ่งชำระ' : '🔴 ค้างชำระ'}</span>
          </div>
          <div style="font-size:0.85rem; color:#64748b;">ผู้เช่า: <strong>${inv.tenantName}</strong> | เลขที่บิล: ${inv.invoiceNumber}</div>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem; text-align:center; margin-top:0.75rem; background:#ffffff; padding:0.75rem; border-radius:8px; border:1px solid #cbd5e1;">
            <div>
              <div style="font-size:0.75rem; color:#64748b;">ยอดบิล</div>
              <strong style="font-size:1.05rem; color:#0f172a;">${Formatters.currency(total)}</strong>
            </div>
            <div>
              <div style="font-size:0.75rem; color:#16a34a;">ยอดชำระแล้ว</div>
              <strong style="font-size:1.05rem; color:#16a34a;">${Formatters.currency(paid)}</strong>
            </div>
            <div>
              <div style="font-size:0.75rem; color:#dc2626;">ยอดคงเหลือ</div>
              <strong style="font-size:1.15rem; color:#dc2626;">${Formatters.currency(remaining)}</strong>
            </div>
          </div>
        </div>

        <h4 style="font-weight:700; font-size:0.95rem; margin-bottom:0.75rem; color:#1e293b;">
          <i class="fa-solid fa-history text-primary"></i> ประวัติการชำระเงิน (${payments.length} ครั้ง)
        </h4>

        ${payments.length === 0 ? `
          <div style="text-align:center; color:#94a3b8; padding:2rem; background:#f8fafc; border-radius:10px;">
            ยังไม่มีประวัติการส่งชำระเงินในระบบสำหรับบิลนี้
          </div>
        ` : `
          <div class="payment-history-timeline">
            ${payments.map((p, idx) => `
              <div class="payment-history-item ${p.status}">
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                      <strong style="font-size:0.95rem;">ครั้งที่ ${idx + 1} (${p.paymentMethod === 'cash' ? '💵 เงินสด' : '💳 โอนเงิน'})</strong>
                      <div style="font-size:0.8rem; color:#64748b; margin-top:0.15rem;">
                        วันที่: ${Formatters.thaiDate(p.paymentDate || p.createdAt)}
                      </div>
                      ${p.slipUrl ? `<a href="${p.slipUrl}" target="_blank" style="font-size:0.8rem; color:#2563eb; font-weight:600; display:inline-block; margin-top:0.25rem;"><i class="fa-solid fa-paperclip"></i> ดูรูปสลิป</a>` : ''}
                      ${p.note ? `<div style="font-size:0.78rem; color:#475569; margin-top:0.2rem;">หมายเหตุ: ${p.note}</div>` : ''}
                      ${p.status === 'rejected' && p.rejectionReason ? `<div style="font-size:0.78rem; color:#dc2626; font-weight:600; margin-top:0.2rem;">❌ เหตุผลที่ปฏิเสธ: ${p.rejectionReason}</div>` : ''}
                    </div>
                    <div style="text-align:right;">
                      <span class="status-chip ${p.status}">
                        ${p.status === 'approved' ? '🟢 อนุมัติแล้ว' : (p.status === 'rejected' ? '🔴 ไม่ผ่าน' : '🟡 รอตรวจสอบ')}
                      </span>
                      <div style="font-weight:800; font-size:1.1rem; color:${p.status === 'approved' ? '#16a34a' : (p.status === 'rejected' ? '#dc2626' : '#d97706')}; margin-top:0.3rem;">
                        ${Formatters.currency(p.amount)}
                      </div>
                      ${p.status === 'pending' ? `
                        <div style="display:flex; gap:0.35rem; margin-top:0.5rem; justify-content:flex-end;">
                          <button type="button" class="btn btn-success btn-xs btn-approve-pay" data-pay-id="${p.id}" style="padding:0.2rem 0.55rem; font-size:0.75rem; font-weight:700;">
                            <i class="fa-solid fa-check"></i> อนุมัติ
                          </button>
                          <button type="button" class="btn btn-danger btn-xs btn-reject-pay" data-pay-id="${p.id}" style="padding:0.2rem 0.55rem; font-size:0.75rem; font-weight:700;">
                            <i class="fa-solid fa-xmark"></i> ปฏิเสธ
                          </button>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary close-modal-trigger">ปิดหน้าต่าง</button>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelectorAll('.close-modal-btn, .close-modal-trigger').forEach(b => b.addEventListener('click', () => modal.classList.remove('active')));

    modal.querySelectorAll('.btn-approve-pay').forEach(btn => {
      btn.addEventListener('click', async () => {
        const payId = btn.getAttribute('data-pay-id');
        if (confirm('คุณต้องการอนุมัติการชำระเงินงวดนี้หรือไม่?')) {
          btn.disabled = true;
          try {
            const user = AuthService.getCurrentUser();
            const res = await DBService.approvePartialPayment(payId, user ? user.displayName : 'แอดมิน');
            if (res.status === 'success') {
              alert('✅ อนุมัติการชำระเงินเรียบร้อยแล้ว!');
              modal.classList.remove('active');
              const syncUrl = DBService.getSavedSupabaseUrl();
              if (syncUrl) App.state = await DBService.pullFromSupabase(syncUrl);
              App.switchTab('partial-payments');
            } else {
              alert('❌ ' + (res.message || 'เกิดข้อผิดพลาดในการอนุมัติ'));
            }
          } catch (e) {
            alert('❌ เกิดข้อผิดพลาด: ' + e.message);
          }
        }
      });
    });

    modal.querySelectorAll('.btn-reject-pay').forEach(btn => {
      btn.addEventListener('click', async () => {
        const payId = btn.getAttribute('data-pay-id');
        const reason = prompt('กรุณาระบุเหตุผลการปฏิเสธการชำระเงิน:');
        if (reason !== null) {
          btn.disabled = true;
          try {
            const user = AuthService.getCurrentUser();
            const res = await DBService.rejectPartialPayment(payId, user ? user.displayName : 'แอดมิน', reason);
            if (res.status === 'success') {
              alert('✅ ปฏิเสธการชำระเงินเรียบร้อยแล้ว');
              modal.classList.remove('active');
              const syncUrl = DBService.getSavedSupabaseUrl();
              if (syncUrl) App.state = await DBService.pullFromSupabase(syncUrl);
              App.switchTab('partial-payments');
            } else {
              alert('❌ ' + (res.message || 'เกิดข้อผิดพลาดในการปฏิเสธ'));
            }
          } catch (e) {
            alert('❌ เกิดข้อผิดพลาด: ' + e.message);
          }
        }
      });
    });
  }

  static openAddPaymentModal(invoiceId, state) {
    const inv = state.invoices.find(i => i.id === invoiceId);
    if (!inv) return;

    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    const total = parseFloat(inv.totalAmount) || 0;
    const paid = parseFloat(inv.paidAmount) || 0;
    const remaining = parseFloat(inv.outstandingAmount) || (total - paid);
    const todayStr = new Date().toISOString().slice(0, 10);

    dialog.innerHTML = `
      <div class="modal-header" style="background:#2563eb; color:#ffffff;">
        <h3><i class="fa-solid fa-plus-circle"></i> บันทึกการชำระเงิน - ห้อง ${inv.roomName}</h3>
        <button type="button" class="close-modal-btn" style="color:#ffffff;">&times;</button>
      </div>
      <form id="form-admin-add-payment">
        <div class="modal-body" style="padding:1.25rem;">
          <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:0.85rem; margin-bottom:1rem; font-size:0.85rem;">
            <div>บิลเดือน: <strong>${Formatters.thaiMonthBE(inv.monthKey)} (${inv.invoiceNumber})</strong></div>
            <div>ผู้เช่า: <strong>${inv.tenantName}</strong></div>
            <div style="margin-top:0.35rem; color:#1e3a8a;">ยอดบิลรวม: <strong>${Formatters.currency(total)}</strong> | ชำระแล้ว: <strong style="color:#16a34a;">${Formatters.currency(paid)}</strong> | คงเหลือ: <strong style="color:#dc2626;">${Formatters.currency(remaining)}</strong></div>
          </div>

          <div class="form-group" style="margin-bottom:1rem;">
            <label style="font-weight:700; color:#334155; display:block; margin-bottom:0.35rem;">
              จำนวนเงินที่รับชำระ (บาท) *
            </label>
            <input type="number" id="adm-pay-amount" class="form-control" min="1" max="${remaining}" step="any" value="${remaining}" required style="font-size:1.1rem; font-weight:800; color:#2563eb;">
          </div>

          <div class="form-group" style="margin-bottom:1rem;">
            <label style="font-weight:700; color:#334155; display:block; margin-bottom:0.35rem;">
              วันที่รับชำระ *
            </label>
            <input type="date" id="adm-pay-date" class="form-control" value="${todayStr}" required>
          </div>

          <div class="form-group" style="margin-bottom:1rem;">
            <label style="font-weight:700; color:#334155; display:block; margin-bottom:0.35rem;">
              ช่องทาง/วิธีชำระเงิน *
            </label>
            <select id="adm-pay-method" class="form-control" required>
              <option value="cash" selected>💵 เงินสด</option>
              <option value="transfer">💳 โอนเงิน (PromptPay / Bank Transfer)</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:1rem;">
            <label style="font-weight:700; color:#334155; display:block; margin-bottom:0.35rem;">
              หมายเหตุเพิ่มเติม
            </label>
            <input type="text" id="adm-pay-note" class="form-control" placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)...">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary close-modal-trigger">ยกเลิก</button>
          <button type="submit" class="btn btn-primary" style="font-weight:700; background:#2563eb;">
            <i class="fa-solid fa-check"></i> บันทึกการชำระเงิน
          </button>
        </div>
      </form>
    `;

    modal.classList.add('active');
    modal.querySelectorAll('.close-modal-btn, .close-modal-trigger').forEach(b => b.addEventListener('click', () => modal.classList.remove('active')));

    const form = document.getElementById('form-admin-add-payment');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = parseFloat(document.getElementById('adm-pay-amount').value);
      const payDate = document.getElementById('adm-pay-date').value;
      const method = document.getElementById('adm-pay-method').value;
      const note = document.getElementById('adm-pay-note').value.trim();

      if (isNaN(amount) || amount <= 0) {
        alert('กรุณากรอกจำนวนเงินให้ถูกต้อง');
        return;
      }
      if (amount > remaining) {
        alert('จำนวนเงินเกินยอดคงเหลือ');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';

      try {
        const user = AuthService.getCurrentUser();
        const res = await DBService.addAdminPayment(inv.id, amount, payDate, method, note, user ? user.displayName : 'แอดมิน');
        if (res.status === 'success') {
          alert('✅ บันทึกการชำระเงินเรียบร้อยแล้ว!');
          modal.classList.remove('active');
          const syncUrl = DBService.getSavedSupabaseUrl();
          if (syncUrl) App.state = await DBService.pullFromSupabase(syncUrl);
          App.switchTab('partial-payments');
        } else {
          alert('❌ ' + (res.message || 'เกิดข้อผิดพลาดในการบันทึก'));
          submitBtn.disabled = false;
        }
      } catch (err) {
        alert('❌ ไม่สามารถบันทึกได้: ' + err.message);
        submitBtn.disabled = false;
      }
    });
  }
}


class BillingComponent {
  static render(state) {
    const rawInvoices = state.invoices || [];
    const invoices = DBService.getUniqueInvoices(rawInvoices);
    state.invoices = invoices;

    // Get list of unique months in descending order
    const months = Array.from(new Set(invoices.map(i => i.monthKey))).filter(Boolean).sort((a, b) => b.localeCompare(a));
    const latestMonth = months.length > 0 ? months[0] : '';

    // Sort invoices by month (newest first), then by room number/name in natural order
    const sortedInvoices = [...invoices].sort((a, b) => {
      const monthCompare = String(b.monthKey || '').localeCompare(String(a.monthKey || ''));
      if (monthCompare !== 0) return monthCompare;
      return DBService.compareRooms({ name: a.roomName }, { name: b.roomName });
    });


    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-file-invoice-dollar text-primary"></i> ระบบออกบิลและบันทึกชำระเงินค่าเช่า</h2>
            <p>จดมิเตอร์น้ำไฟ คำนวณยอดอัตโนมัติ เจน PromptPay QR Code และสั่งพิมพ์ใบแจ้งหนี้/สลิปใบเสร็จ</p>
          </div>
          <div class="header-actions">
            <button id="btn-create-bill" class="btn btn-primary"><i class="fa-solid fa-calculator"></i> คำนวณออกบิลใหม่</button>
            <button id="btn-archive-bills" class="btn btn-secondary" style="margin-left:0.5rem;" title="สำรองข้อมูลบิลรายเดือนและลบออกจากตารางหลัก">
              <i class="fa-solid fa-box-archive text-warning"></i> สำรองและล้างบิลเก่า
            </button>
            <button id="btn-line-notify-header" class="btn btn-success" style="margin-left:0.5rem; background-color:#06c755; border-color:#06c755; color:#ffffff;" title="ส่งข้อความแจ้งเตือนค่าเช่าเข้า LINE">
              <i class="fa-brands fa-line"></i> แจ้งเตือน LINE ชำระเงิน
            </button>
          </div>
        </div>

        <!-- Month Filter Dropdown -->
        <div style="display:flex; justify-content:flex-end; align-items:center; gap:0.65rem; margin-bottom:1.25rem; background:rgba(255,255,255,0.6); padding:0.75rem 1.25rem; border-radius:12px; border:1px solid #e2e8f0; backdrop-filter:blur(8px);">
          <span style="font-weight:700; color:#334155; font-size:0.92rem; display:flex; align-items:center; gap:0.35rem;">
            <i class="fa-solid fa-filter text-primary"></i> ค้นหาบิลตามรอบเดือน:
          </span>
          <select id="filter-billing-month" class="form-control" style="width:220px; padding:0.5rem 0.85rem; border-radius:8px; font-size:0.85rem; font-weight:600; cursor:pointer; border-color:#cbd5e1; height:38px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            ${months.map(m => `
              <option value="${m}" ${latestMonth === m ? 'selected' : ''}>บิลรอบเดือน ${Formatters.thaiMonthBE(m)} (${m})</option>
            `).join('')}
            <option value="ALL">-- แสดงบิลทุกเดือน --</option>
          </select>
        </div>

        <div class="glass-card style-table-card">
          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>เลขที่บิล / รอบเดือน</th>
                  <th>ห้อง</th>
                  <th>ผู้เช่า</th>
                  <th>ยอดบิลรวม</th>
                  <th>ชำระแล้ว</th>
                  <th>คงเหลือ</th>
                  <th>สถานะ</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${sortedInvoices.map(inv => {
                  const displayStyle = (inv.monthKey === latestMonth || !latestMonth) ? '' : 'none';
                  const approvedPaid = DBService.getApprovedPaidAmount(inv.id, state);
                  const totalWithPenalty = (Number(inv.totalAmount) || 0) + (Number(inv.penaltyAmount) || 0);
                  const remaining = totalWithPenalty - approvedPaid;
                  const isPaid = (remaining <= 0) || inv.status === 'paid';
                  const isPartial = approvedPaid > 0 && !isPaid;

                  let statusHtml = '';
                  if (inv.status === 'pending_verification') {
                    statusHtml = `
                      <button class="btn btn-xs btn-goto-slip-verification" data-room="${inv.roomName}" style="background:#ede9fe; color:#6d28d9; border:1px solid #ddd6fe; font-weight:700;">
                        🧾 รอตรวจสอบสลิป
                      </button>
                    `;
                  } else if (isPaid) {
                    statusHtml = `<span class="badge-pill badge-success" style="font-weight:700;">🟢 ชำระแล้ว</span>`;
                  } else if (isPartial) {
                    statusHtml = `<span class="badge-pill" style="background:#ffedd5; color:#c2410c; border:1px solid #fed7aa; font-weight:700;">🟠 ชำระบางส่วน</span>`;
                  } else {
                    statusHtml = `<span class="badge-pill badge-danger" style="font-weight:700;">🔴 รอชำระ</span>`;
                  }

                  return `
                    <tr class="billing-table-row" data-month="${inv.monthKey}" style="display: ${displayStyle}">
                      <td><strong>${inv.invoiceNumber}</strong><div class="text-muted text-sm">${Formatters.thaiMonthBE(inv.monthKey)}</div></td>
                      <td><span class="badge-pill badge-primary">ห้อง ${inv.roomName}</span></td>
                      <td><strong>${inv.tenantName}</strong></td>
                      <td><strong class="text-primary">${Formatters.currency(totalWithPenalty)}</strong></td>
                      <td><strong class="text-success">${Formatters.currency(approvedPaid)}</strong></td>
                      <td><strong class="${remaining > 0 ? 'text-danger' : 'text-muted'}">${Formatters.currency(remaining < 0 ? 0 : remaining)}</strong></td>
                      <td>
                        ${statusHtml}
                        ${inv.slipUrl && (inv.slipUrl === 'cash' || inv.slipUrl.startsWith('http') || inv.slipUrl.startsWith('data:')) ? (inv.slipUrl === 'cash' ? `
                          <span class="badge-pill" style="margin-top:0.35rem; display:block; text-align:center; font-size:0.72rem; background-color:#dcfce7; color:#15803d; border:1px solid #bbf7d0; font-weight:700; padding:2px 4px; border-radius:4px;">
                            💵 ชำระเงินสด
                          </span>
                        ` : `
                          <button class="btn btn-info btn-xs btn-view-slip" data-id="${inv.id}" style="margin-top:0.35rem; display:block; width:100%; border-radius:6px; font-weight:600;">
                            <i class="fa-solid fa-image"></i> ดูสลิป
                          </button>
                        `) : ''}
                      </td>
                      <td>
                        <div class="action-buttons">
                          <button class="btn btn-primary btn-xs btn-open-add-payment-modal" data-id="${inv.id}" title="บันทึกและดูประวัติการชำระเงิน">
                            <i class="fa-solid fa-hand-holding-dollar"></i> บันทึกชำระ
                          </button>
                          <button class="btn btn-secondary btn-xs btn-edit-bill" data-id="${inv.id}"><i class="fa-solid fa-pen text-info"></i> แก้ไข</button>
                          <button class="btn btn-secondary btn-xs btn-print-bill" data-id="${inv.id}"><i class="fa-solid fa-print text-warning"></i> พิมพ์บิล</button>
                          <button class="btn btn-secondary btn-xs btn-send-line" data-id="${inv.id}"><i class="fa-brands fa-line text-success"></i> LINE</button>
                          <button class="btn btn-danger btn-xs btn-delete-bill" data-id="${inv.id}"><i class="fa-solid fa-trash"></i> ลบ</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

class RepairsComponent {
  static render(state) {
    const repairs = state.repairs || [];

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div><h2><i class="fa-solid fa-screwdriver-wrench text-primary"></i> ระบบแจ้งซ่อมและซ่อมบำรุงห้องพัก</h2><p>ติดตามคำขอแจ้งซ่อมจากผู้เช่า แนบรูปถ่าย และบันทึกค่าใช้จ่ายงานซ่อมบำรุง</p></div>
          <div class="header-actions">
            <button id="btn-add-repair" class="btn btn-primary"><i class="fa-solid fa-plus"></i> เพิ่มรายการแจ้งซ่อมใหม่</button>
          </div>
        </div>

        <div class="glass-card style-table-card">
          <div class="table-responsive">
            <table class="custom-table">
              <thead><tr><th>เลขที่ใบซ่อม</th><th>ห้องพัก</th><th>ผู้แจ้งซ่อม</th><th>หัวข้อแจ้งซ่อม / รายละเอียด</th><th>ช่างรับงาน</th><th>ค่าซ่อม</th><th>สถานะ</th><th>การจัดการ</th></tr></thead>
              <tbody>
                ${repairs.length === 0 ? `
                  <tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">ยังไม่มีรายการแจ้งซ่อม</td></tr>
                ` : repairs.map(rep => `
                  <tr>
                    <td><strong>${rep.ticketNumber}</strong></td>
                    <td><span class="badge-pill badge-primary">ห้อง ${rep.roomName}</span></td>
                    <td>${rep.tenantName || '-'}</td>
                    <td>
                      <strong>${rep.title}</strong>
                      <div class="text-muted text-sm">${rep.description || ''}</div>
                      ${rep.imageUrl ? `<a href="${rep.imageUrl}" target="_blank" class="text-primary text-sm" style="display:inline-flex; align-items:center; gap:4px; margin-top:0.35rem; text-decoration:none;"><i class="fa-solid fa-image"></i> ดูรูปถ่ายหน้างาน</a>` : ''}
                    </td>
                    <td>${rep.assignedTechnician || 'ยังไม่ระบุช่าง'}</td>
                    <td><strong class="text-danger">${Formatters.currency(rep.expenseAmount)}</strong></td>
                    <td>
                      <span class="badge-pill ${rep.status === 'completed' ? 'badge-success' : 'badge-warning'}">
                        ${rep.status === 'completed' ? '🟢 เสร็จสิ้น' : '🟡 กำลังซ่อม'}
                      </span>
                    </td>
                    <td>
                      <div class="action-buttons">
                        <button class="btn btn-secondary btn-xs btn-toggle-repair" data-id="${rep.id}">${rep.status === 'completed' ? 'ปรับเป็นกำลังซ่อม' : 'ปรับเป็นเสร็จสิ้น'}</button>
                        <button class="btn btn-danger btn-xs btn-delete-repair" data-id="${rep.id}"><i class="fa-solid fa-trash"></i> ลบ</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

class AccountingComponent {
  static render(state) {
    const ledger = state.ledger || [];
    let totalIncome = 0; let totalExpense = 0;
    ledger.forEach(entry => {
      if (entry.type === 'income') totalIncome += entry.amount;
      else totalExpense += entry.amount;
    });

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div><h2><i class="fa-solid fa-scale-balanced text-primary"></i> ระบบบัญชี รายรับ - รายจ่าย (Accounting Ledger)</h2><p>บันทึกรายรับค่าน้ำไฟค่าเช่า และรายจ่ายแม่บ้าน ค่าซ่อมบำรุง ค่าน้ำไฟหลวง</p></div>
          <div class="header-actions">
            <button id="btn-add-ledger" class="btn btn-primary"><i class="fa-solid fa-plus"></i> บันทึกรายรับ-รายจ่ายใหม่</button>
          </div>
        </div>

        ${partialCount > 0 ? `<div class="alert alert-warning animate-fade-in" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-radius:12px; background:#fff7ed; border:1px solid #ffedd5; color:#9a3412; padding:0.85rem 1.25rem;"><div style="display:flex; align-items:center; gap:0.75rem;"><i class="fa-solid fa-credit-card" style="font-size:1.4rem; color:#ea580c;"></i><span style="font-weight:700;">มีบิลที่อยู่ระหว่างการแบ่งชำระ <strong>${partialCount}</strong> รายการ</span></div><a href="#partial-payments" data-tab="partial-payments" class="btn btn-warning btn-sm" style="padding:0.4rem 1rem; border-radius:8px; font-weight:700; background:#f97316; border-color:#f97316; color:#ffffff; text-decoration:none;"><i class="fa-solid fa-arrow-right"></i> จัดการ</a></div>` : ""}<div class="kpi-cards-grid">
          <div class="kpi-card card-green"><div class="kpi-content"><span class="label">รายรับรวม</span><h3 class="value text-success">${Formatters.currency(totalIncome)}</h3></div></div>
          <div class="kpi-card card-red"><div class="kpi-content"><span class="label">รายจ่ายรวม</span><h3 class="value text-danger">${Formatters.currency(totalExpense)}</h3></div></div>
          <div class="kpi-card card-blue"><div class="kpi-content"><span class="label">กำไรสุทธิ</span><h3 class="value text-primary">${Formatters.currency(totalIncome - totalExpense)}</h3></div></div>
        </div>

        <div class="glass-card style-table-card" style="margin-top:1.5rem;">
          <div class="table-responsive">
            <table class="custom-table">
              <thead><tr><th>วันที่</th><th>ประเภท</th><th>หมวดหมู่</th><th>รายการรายละเอียด</th><th>จำนวนเงิน</th><th>บันทึกโดย</th><th>การจัดการ</th></tr></thead>
              <tbody>
                ${ledger.map(l => `
                  <tr>
                    <td>${Formatters.thaiDate(l.date)}</td>
                    <td><span class="badge-pill ${l.type === 'income' ? 'badge-success' : 'badge-danger'}">${l.type === 'income' ? '📈 รายรับ' : '📉 รายจ่าย'}</span></td>
                    <td>${l.category}</td>
                    <td><strong>${l.description}</strong></td>
                    <td><strong class="${l.type === 'income' ? 'text-success' : 'text-danger'}">${Formatters.currency(l.amount)}</strong></td>
                    <td>${l.recordedBy || 'admin'}</td>
                    <td><button class="btn btn-danger btn-xs btn-delete-ledger" data-id="${l.id}"><i class="fa-solid fa-trash"></i> ลบ</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

class CalendarComponent {
  static render(state) {
    const events = state.events || [];

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div><h2><i class="fa-solid fa-calendar-days text-primary"></i> ปฏิทินงานและวันนัดหมาย (Event Calendar)</h2><p>รวมกำหนดการวันชำระค่าเช่า วันหมดอายุสัญญาเช่า และวันนัดซ่อมบำรุง</p></div>
          <div class="header-actions">
            <button id="btn-add-event" class="btn btn-primary"><i class="fa-solid fa-plus"></i> เพิ่มวันนัดหมายใหม่</button>
          </div>
        </div>

        <div class="glass-card">
          <h3 style="margin-bottom:1rem;"><i class="fa-solid fa-list-check text-primary"></i> รายการนัดหมายและกิจกรรมประจำเดือน</h3>
          <div class="table-responsive">
            <table class="custom-table">
              <thead><tr><th>วันที่นัดหมาย</th><th>หัวข้อนัดหมาย / กิจกรรม</th><th>หมวดหมู่</th><th>ห้องที่เกี่ยวข้อง</th><th>การจัดการ</th></tr></thead>
              <tbody>
                ${events.length === 0 ? `
                  <tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">ยังไม่มีวันนัดหมายในปฏิทิน</td></tr>
                ` : events.map(evt => `
                  <tr>
                    <td><strong>${Formatters.thaiDate(evt.date)}</strong></td>
                    <td><strong>${evt.title}</strong></td>
                    <td><span class="badge-pill badge-primary">${evt.category}</span></td>
                    <td>${evt.roomName || '-'}</td>
                    <td><button class="btn btn-danger btn-xs btn-delete-event" data-id="${evt.id}"><i class="fa-solid fa-trash"></i> ลบ</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

class ReportsComponent {
  static render(state) {
    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-chart-line text-primary"></i> ระบบสรุปรายงานและศูนย์สำรองข้อมูล (Backup & Restore Center)</h2>
            <p>สรุปผลการดำเนินงาน รายรับ ยอดค้างชำระ และส่งออก / นำเข้าไฟล์ Excel (.xlsx) และ JSON Backup 1-Click</p>
          </div>
        </div>
        
        <!-- 1. Individual Reports Export Grid -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; margin-bottom:1.5rem;">
          <div class="glass-card report-card">
            <h3><i class="fa-solid fa-file-invoice-dollar text-success"></i> 1. รายงานสรุปรายรับประจำเดือน</h3>
            <p class="text-muted">ส่งออกข้อมูลรายรับค่าเช่า ค่าน้ำ ค่าไฟ ของทุกห้องพักเป็นไฟล์ Excel</p>
            <button class="btn btn-success btn-sm btn-export-income-report" style="margin-top:1rem;"><i class="fa-solid fa-file-excel"></i> Export Excel (รายรับ)</button>
          </div>

          <div class="glass-card report-card">
            <h3><i class="fa-solid fa-user-clock text-danger"></i> 2. รายงานผู้เช่าค้างชำระเงิน</h3>
            <p class="text-muted">สรุปรายชื่อผู้เช่าที่ยังไม่ได้ชำระค่าเช่าตามกำหนดออกเป็นไฟล์ Excel</p>
            <button class="btn btn-danger btn-sm btn-export-overdue-report" style="margin-top:1rem;"><i class="fa-solid fa-file-excel"></i> Export Excel (ค้างชำระ)</button>
          </div>

          <div class="glass-card report-card">
            <h3><i class="fa-solid fa-bolt text-warning"></i> 3. รายงานมิเตอร์น้ำ-ไฟประจำเดือน</h3>
            <p class="text-muted">สรุปหน่วยมิเตอร์น้ำประปาและไฟฟ้าทุกห้องออกเป็นไฟล์ Excel</p>
            <button class="btn btn-warning btn-sm btn-export-meter-report" style="margin-top:1rem;"><i class="fa-solid fa-file-excel"></i> Export Excel (มิเตอร์น้ำไฟ)</button>
          </div>

          <div class="glass-card report-card">
            <h3><i class="fa-solid fa-file-contract text-primary"></i> 4. รายงานประวัติสัญญาเช่าทั้งหมด</h3>
            <p class="text-muted">สรุปทะเบียนสัญญาเช่า วันเริ่มสัญญา และวันหมดอายุออกเป็นไฟล์ Excel</p>
            <button class="btn btn-primary btn-sm btn-export-contracts-report" style="margin-top:1rem;"><i class="fa-solid fa-file-excel"></i> Export Excel (สัญญาเช่า)</button>
          </div>
        </div>

        <!-- 2. Full System Backup & Restore Center -->
        <div class="glass-card style-table-card" style="padding:1.75rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:0.75rem;">
            <h3 style="color:#0f172a; margin:0;"><i class="fa-solid fa-box-archive text-primary"></i> 5. ศูนย์สำรองและเรียกคืนข้อมูลระบบ (Full Backup & Restore Center)</h3>
            <div>
              ${(state.settings && state.settings.isDemoMode === false) ? `
                <span class="badge-pill badge-success" style="font-size:0.85rem; padding:0.4rem 0.85rem; font-weight:700;">
                  🟢 PRODUCTION MODE (โหมดใช้งานจริง - ปิดการ Seed ถาวร)
                </span>
              ` : `
                <span class="badge-pill badge-warning" style="font-size:0.85rem; padding:0.4rem 0.85rem; font-weight:700; background:#f59e0b; color:#fff;">
                  🟡 DEMO MODE (กำลังใช้ข้อมูลทดลองเดโม่)
                </span>
              `}
            </div>
          </div>
          <p class="text-muted" style="margin-bottom:1.5rem;">สำรองข้อมูลหอพักทั้งหมดเป็นไฟล์ Excel Multi-Sheet หรือ JSON และจัดการล้างข้อมูลระบบเพื่อเริ่มต้นใช้งาน</p>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
            <!-- Export Section -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem;">
              <h4 style="margin-bottom:0.75rem; color:#1e293b;"><i class="fa-solid fa-download text-success"></i> ดาวน์โหลดไฟล์สำรองข้อมูล (Export Backup)</h4>
              <p class="text-muted" style="font-size:0.85rem; margin-bottom:1.25rem;">สร้างไฟล์สำรองข้อมูลทั้งระบบครบถ้วน (ผู้เช่า, ห้องพัก, บิล, แจ้งซ่อม)</p>
              
              <div style="display:flex; flex-direction:column; gap:0.75rem;">
                <button type="button" class="btn btn-success btn-full" id="btn-full-backup-excel" style="padding:0.75rem; font-weight:700;">
                  <i class="fa-solid fa-file-excel"></i> สำรองข้อมูลทั้งระบบเป็น Excel (.xlsx)
                </button>
                <button type="button" class="btn btn-secondary btn-full" id="btn-full-backup-json" style="padding:0.75rem; font-weight:700;">
                  <i class="fa-solid fa-file-code text-primary"></i> สำรองข้อมูลเป็น JSON (.json)
                </button>
              </div>
            </div>

            <!-- Import / Restore Section -->
            <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:1.25rem;">
              <h4 style="margin-bottom:0.75rem; color:#b45309;"><i class="fa-solid fa-upload text-warning"></i> เรียกคืนข้อมูลจากไฟล์ (Restore Data)</h4>
              <p class="text-muted" style="font-size:0.85rem; margin-bottom:1.25rem;">อัปโหลดไฟล์ Excel (.xlsx) หรือ JSON ที่เคยสำรองไว้เพื่อกู้คืนฐานข้อมูลระบบ</p>
              
              <input type="file" id="restore-file-input" accept=".xlsx,.xls,.csv,.json" style="display:none;">
              <button type="button" class="btn btn-warning btn-full" id="btn-trigger-restore" style="padding:0.75rem; font-weight:700;">
                <i class="fa-solid fa-rotate-left"></i> เลือกไฟล์ Excel / JSON เพื่อ Restore ข้อมูล
              </button>
              <small class="text-muted" style="font-size:0.8rem; margin-top:0.5rem; display:block; text-align:center;">💡 ระบบจะแสดงตัวอย่างข้อมูลให้ตรวจสอบก่อนทำการบันทึกจริง</small>
            </div>
          </div>

          <!-- Production & Clean System Control Section -->
          <div style="margin-top:1.5rem; display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
            <!-- 1. Start Production Mode Button (Used Once) -->
            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:1.25rem; display:flex; flex-direction:column; justify-space-between;">
              <div>
                <h4 style="color:#991b1b; margin-bottom:0.35rem;"><i class="fa-solid fa-rocket text-danger"></i> เริ่มใช้งานจริง (Start Production Mode)</h4>
                <p class="text-muted" style="font-size:0.82rem; margin-bottom:1rem; line-height:1.5;">
                  ลบ 41 ห้องเดโม่, ลบผู้เช่า/บิล/แจ้งซ่อมเดโม่ ทั้งหมด และเปลี่ยนระบบเป็น <code>is_demo_mode = false</code> เพื่อปิดการสร้างห้องเดโม่อัตโนมัติถาวร (ใช้ครั้งแรกหลังติดตั้ง)
                </p>
              </div>
              <button type="button" class="btn btn-danger btn-full" id="btn-start-production" style="padding:0.75rem; font-weight:700; background:#dc2626; border-color:#dc2626; color:#fff;">
                <i class="fa-solid fa-rocket"></i> เริ่มใช้งานจริง (ลบ 41 ห้องเดโม่ & ปิด Seed ถาวร)
              </button>
            </div>

            <!-- 2. Clear Usage Data Button (Used Regularly) -->
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:1.25rem; display:flex; flex-direction:column; justify-space-between;">
              <div>
                <h4 style="color:#1e40af; margin-bottom:0.35rem;"><i class="fa-solid fa-broom text-primary"></i> ล้างข้อมูลการใช้งาน (Clear Usage Data)</h4>
                <p class="text-muted" style="font-size:0.82rem; margin-bottom:1rem; line-height:1.5;">
                  ลบผู้เช่า, ลบบิล, ลบแจ้งซ่อม, ลบรายรับ-รายจ่าย และรีเซ็ตสถานะห้องพักทุกห้องเป็นห้องว่าง (โดย<strong>ห้ามลบและห้ามแตะต้องตารางโครงสร้างห้องพักที่มีอยู่</strong>)
                </p>
              </div>
              <button type="button" class="btn btn-primary btn-full" id="btn-clear-usage-data" style="padding:0.75rem; font-weight:700; background:#2563eb; border-color:#2563eb; color:#fff;">
                <i class="fa-solid fa-broom"></i> ล้างข้อมูลการใช้งาน (ลบผู้เช่า/บิล โดยไม่แตะห้องพัก)
              </button>
            </div>
          </div>
        </div>

      </div>
    `;
  }
}

class RatesComponent {
  static render(state) {
    const rates = state.rates || { electricityRate: 8.0, waterRate: 20.0, trashFee: 20.0, customFees: [] };
    const customFees = rates.customFees || [];

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-sliders text-primary"></i> ตั้งค่าเรท & ค่าบริการสาธารณูปโภค (Rates & Service Fees)</h2>
            <p>กำหนดเรทค่าน้ำ ค่าไฟ ค่าขยะ และเพิ่ม/แก้ไข/ลบ รายการค่าบริการอื่นๆ เพื่อบันทึกลง Supabase และออกบิลอัตโนมัติ</p>
          </div>
        </div>

        <!-- 1. Standard Rates Form -->
        <div class="glass-card" style="margin-bottom:1.5rem;">
          <h3><i class="fa-solid fa-bolt text-warning"></i> 1. อัตราเรทค่าน้ำ - ค่าไฟ และค่าขยะหลัก</h3>
          <form id="form-rates-main" style="margin-top:1rem;">
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:1rem;">
              <div class="form-group">
                <label>ค่าไฟฟ้า (บาท / ยูนิต) *</label>
                <input type="number" step="0.1" id="rate-elec" class="form-control" value="${rates.electricityRate || 8.0}" required>
              </div>
              <div class="form-group">
                <label>ค่าน้ำประปา (บาท / ยูนิต) *</label>
                <input type="number" step="0.1" id="rate-water" class="form-control" value="${rates.waterRate || 20.0}" required>
              </div>
              <div class="form-group">
                <label>ค่าบริการขยะ (บาท / เดือน) *</label>
                <input type="number" step="0.1" id="rate-trash" class="form-control" value="${rates.trashFee !== undefined ? rates.trashFee : 20.0}" required>
              </div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-top:1rem;">
              <div class="form-group">
                <label>ค่าอินเทอร์เน็ต (บาท / เดือน)</label>
                <input type="number" step="0.1" id="rate-internet" class="form-control" value="${rates.internetFee || ''}" placeholder="เว้นว่างหรือ 0 = ไม่คิดค่านี้">
                <small class="text-muted">ใส่เฉพาะห้องที่มีอินเทอร์เน็ต (เดิมใช้กับห้องประเภท "ห้องแอร์ปรับอากาศ") เว้นว่างหรือใส่ 0 = ไม่นำไปคำนวณในบิล</small>
              </div>
              <div class="form-group">
                <label>ค่าส่วนกลาง (บาท / เดือน)</label>
                <input type="number" step="0.1" id="rate-common" class="form-control" value="${rates.commonFee || ''}" placeholder="เว้นว่างหรือ 0 = ไม่คิดค่านี้">
                <small class="text-muted">เว้นว่างหรือใส่ 0 = ไม่นำไปคำนวณในบิล</small>
              </div>
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:1rem;"><i class="fa-solid fa-floppy-disk"></i> บันทึกปรับเรทหลัก</button>
          </form>
        </div>

        <!-- 2. Custom Extra Fees Management -->
        <div class="glass-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <div>
              <h3><i class="fa-solid fa-boxes-packing text-primary"></i> 2. รายการค่าใช้จ่ายและค่าบริการเสริมอื่นๆ (Custom Service Fees)</h3>
              <p class="text-muted text-sm">สามารถเพิ่ม แก้ไข ลบ รายการค่าบริการอื่นๆ เพื่อนำไปบันทึกลง Supabase และคำนวณในบิลได้</p>
            </div>
            <button id="btn-add-custom-fee" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> เพิ่มรายการค่าใช้จ่ายใหม่</button>
          </div>

          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>ชื่อรายการค่าใช้จ่าย</th>
                  <th>รูปแบบคำนวณ</th>
                  <th>อัตราค่าบริการ (บาท)</th>
                  <th>หมายเหตุรายละเอียด</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${customFees.length === 0 ? `
                  <tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">ยังไม่มีรายการค่าใช้จ่ายเสริม สามารถกดเพิ่มใหม่ได้</td></tr>
                ` : customFees.map(fee => `
                  <tr>
                    <td><strong>${fee.name}</strong></td>
                    <td><span class="badge-pill badge-info">${fee.unitType === 'monthly' ? '📅 รายเดือน (บาท/เดือน)' : '⚡ ตามหน่วย (บาท/ยูนิต)'}</span></td>
                    <td><strong class="text-primary">${Formatters.currency(fee.amount)}</strong></td>
                    <td><span class="text-muted text-sm">${fee.note || '-'}</span></td>
                    <td>
                      <div class="action-buttons">
                        <button class="btn btn-secondary btn-xs btn-edit-custom-fee" data-id="${fee.id}"><i class="fa-solid fa-pen"></i> แก้ไข</button>
                        <button class="btn btn-danger btn-xs btn-delete-custom-fee" data-id="${fee.id}"><i class="fa-solid fa-trash"></i> ลบ</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

class SettingsComponent {
  static activeSection = 'home';
  static searchQuery = '';

  static render(state) {
    const settings = state.settings || {};
    const users = state.users || [];

    // Header section
    let header = `
      <div class="view-header">
        <div>
          <h2><i class="fa-solid fa-gears text-primary"></i> ตั้งค่าระบบ (Settings Dashboard)</h2>
          <p>จัดการการตั้งค่าข้อมูลหอพัก อัตราค่าบริการ บัญชีผู้ใช้ การแจ้งเตือน และระบบฐานข้อมูล</p>
        </div>
      </div>
    `;

    if (this.activeSection === 'home') {
      const categories = [
        { id: 'apartment_info', title: 'ข้อมูลหอพัก', desc: 'ชื่อหอพัก, ที่อยู่, เบอร์โทร, บัญชีธนาคาร และ PromptPay', icon: 'fa-building', color: '#06b6d4', keywords: 'หอพัก ธนาคาร พร้อมเพย์ โอนเงิน บัญชี bay kbank scb promptpay' },
        { id: 'owner_info', title: 'ข้อมูลเจ้าของหอพัก', desc: 'ชื่อเจ้าของหอพัก, ที่อยู่, เบอร์โทร, เลขบัตรประชาชน (สำหรับใช้ในหนังสือสัญญา)', icon: 'fa-user-tie', color: '#a855f7', keywords: 'เจ้าของ ผู้ให้เช่า สัญญา นามผู้ให้เช่า เลขบัตร owner host address lessor' },
        { id: 'billing', title: 'การออกบิล', desc: 'รูปแบบเลขที่บิล, กำหนดส่งบิล, ข้อความแนบท้ายใบเสร็จ', icon: 'fa-file-invoice-dollar', color: '#f97316', keywords: 'บิล ใบเสร็จ ออกบิล กำหนดส่ง เลขที่บิล ท้ายบิล' },
        { id: 'rates', title: 'ค่าน้ำ / ค่าไฟ', desc: 'กำหนดอัตราค่าน้ำ ค่าไฟ ค่าขยะ และค่าบริการเสริมพิเศษ', icon: 'fa-droplet', color: '#3b82f6', keywords: 'น้ำ ไฟ ขยะ เน็ต ส่วนกลาง บริการ extra fee rate unit' },
        { id: 'penalty', title: 'ค่าปรับชำระล่าช้า', desc: 'วันครบกำหนดชำระปกติ, ค่าปรับขั้นบันไดช่วงที่ 1 และ 2', icon: 'fa-clock-rotate-left', color: '#ef4444', keywords: 'ปรับ ล่าช้า เกินกำหนด due phase fine' },
        { id: 'users', title: 'ผู้ใช้งานระบบ', desc: 'สิทธิ์ผู้ดูแล Super Admin / Staff, เพิ่ม/ลบ และเปลี่ยนรหัสผ่าน', icon: 'fa-users-gear', color: '#8b5cf6', keywords: 'แอดมิน พนักงาน สิทธิ์ รหัสผ่าน admin staff user role' },
        { id: 'line_bot', title: 'LINE Bot / Notify', desc: 'เชื่อมต่อ LINE Messaging API ส่งบิลตรงและรับสลิปโอนเงิน', icon: 'fa-brands fa-line', color: '#22c55e', keywords: 'ไลน์ บอท notify token group push message' },
        { id: 'supabase', title: 'Supabase Cloud', desc: 'ตั้งค่าการเชื่อมต่อฐานข้อมูลคลาวด์ และลิงก์จดมิเตอร์', icon: 'fa-cloud', color: '#0ea5e9', keywords: 'ฐานข้อมูล คลาวด์ db server url api key anon meter' },
        { id: 'backup', title: 'สำรอง & กู้คืนข้อมูล', desc: 'Export รายงานระบบ Excel/CSV, ดาวน์โหลด/นำเข้าไฟล์สำรองระบบ', icon: 'fa-box-archive', color: '#f59e0b', keywords: 'สำรอง กู้คืน reset ล้างข้อมูล excel csv import export' },
        { id: 'appearance', title: 'หน้าตาระบบ', desc: 'สลับระหว่างโหมดมืด (Dark Mode) และโหมดสว่าง (Light Mode)', icon: 'fa-palette', color: '#ec4899', keywords: 'ธีม โหมดมืด โหมดสว่าง theme dark light' },
        { id: 'security', title: 'ความปลอดภัย', desc: 'เปลี่ยนรหัสผ่านแอดมิน, ออกจากระบบทุกเครื่อง และระบบ 2FA', icon: 'fa-shield-halved', color: '#64748b', keywords: 'รหัสผ่าน ล็อกเอาต์ 2fa password logout security' },
        { id: 'advanced', title: 'ตั้งค่าขั้นสูง', desc: 'System Version, API Status, Developer Mode และ System Logs', icon: 'fa-sliders', color: '#475569', keywords: 'เวอร์ชัน api log developer debug caches version' }
      ];

      return `
        <div class="view-container animate-fade-in">
          ${header}
          
          <div class="settings-search-container" style="position:relative; margin-bottom:1.5rem;">
            <i class="fa-solid fa-magnifying-glass" style="position:absolute; left:16px; top:50%; transform:translateY(-50%); color:#64748b; font-size:1.1rem;"></i>
            <input type="text" id="settings-search" placeholder="ค้นหาการตั้งค่า... (เช่น ค่าน้ำ, LINE, รหัสผ่าน)" style="width:100%; padding:0.85rem 1rem 0.85rem 2.85rem; border-radius:12px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-main); font-size:0.85rem; outline:none; transition:all 0.2s;" />
          </div>

          <div class="settings-grid">
            ${categories.map(c => `
              <div class="settings-card-item glass-card" data-section="${c.id}" data-keywords="${c.keywords}">
                <div class="settings-card-icon-wrapper" style="display:flex; align-items:center; justify-content:center; width:52px; height:52px; border-radius:12px; background: ${c.color}20; color: ${c.color}; font-size:1.45rem;">
                  <i class="fa-solid ${c.icon}"></i>
                </div>
                <div style="flex:1;">
                  <h4 class="settings-card-title" style="font-weight:700; font-size:1.05rem; color:var(--text-main); margin-bottom:0.25rem; margin-top:0;">${c.title}</h4>
                  <p class="settings-card-desc" style="font-size:0.8rem; color:var(--text-muted); line-height:1.4; margin:0;">${c.desc}</p>
                </div>
                <div style="color:var(--text-muted); font-size:0.9rem;">
                  <i class="fa-solid fa-chevron-right"></i>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Render Sub-view for selected section
    let backHeader = `
      <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border-color); padding-bottom:1rem;">
        <button class="btn btn-secondary btn-sm" id="btn-settings-back" style="padding:0.4rem 0.8rem; font-size:0.85rem; font-weight:700;"><i class="fa-solid fa-arrow-left"></i> ย้อนกลับ</button>
        <h3 style="margin:0; font-size:1.25rem; font-weight:700;">
          ${this.activeSection === 'apartment_info' ? '🏢 ข้อมูลหอพัก' :
            this.activeSection === 'owner_info' ? '👤 ข้อมูลเจ้าของหอพัก' :
            this.activeSection === 'billing' ? '🧾 การออกบิล' :
            this.activeSection === 'rates' ? '💧 ค่าน้ำ / ค่าไฟ' :
            this.activeSection === 'penalty' ? '💰 ค่าปรับชำระล่าช้า' :
            this.activeSection === 'users' ? '👥 ผู้ใช้งานระบบ' :
            this.activeSection === 'line_bot' ? '🔔 LINE Bot' :
            this.activeSection === 'supabase' ? '☁️ Supabase Cloud' :
            this.activeSection === 'backup' ? '📦 สำรอง & กู้คืนข้อมูล' :
            this.activeSection === 'appearance' ? '🎨 หน้าตาระบบ' :
            this.activeSection === 'security' ? '🔒 ความปลอดภัย' :
            this.activeSection === 'advanced' ? '⚙️ ตั้งค่าขั้นสูง' : 'ตั้งค่า'}
        </h3>
      </div>
    `;

    let cardBody = '';
    if (this.activeSection === 'apartment_info') {
      cardBody = `
        <div class="glass-card">
          <h3><i class="fa-solid fa-building-columns text-primary"></i> ข้อมูลหอพัก & บัญชีธนาคารรับเงิน</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">
            ข้อมูลบัญชีธนาคารและเบอร์พร้อมเพย์จะถูกนำไปสร้าง QR Code ชำระเงินและออกบิลอัตโนมัติ
          </p>
          
          <form id="form-bank-settings" style="margin-top:1rem;">
            <div class="form-group" style="margin-bottom:0.85rem;">
              <label style="font-weight:600;"><i class="fa-solid fa-building text-primary"></i> ชื่อหอพัก / สถานประกอบการ:</label>
              <input type="text" id="setting-apt-name" class="form-control" value="${settings.apartmentName || 'หอพักสมบัติ นนทบุรี'}" required style="padding:0.55rem 0.75rem;">
            </div>

            <div class="form-group" style="margin-bottom:0.85rem;">
              <label style="font-weight:600;"><i class="fa-solid fa-location-dot text-primary"></i> ที่อยู่ของหอพัก (สำหรับสัญญาและบิล):</label>
              <input type="text" id="setting-apt-address" class="form-control" value="${settings.address || '๔๕/๑๐ หมู่ที่ ๘ ตำบลราษฎร์นิยม อำเภอไทรน้อย จังหวัดนนทบุรี'}" required style="padding:0.55rem 0.75rem;">
            </div>

            <div class="form-group" style="margin-bottom:0.85rem;">
              <label style="font-weight:600;"><i class="fa-solid fa-phone text-primary"></i> เบอร์โทรศัพท์หอพัก:</label>
              <input type="text" id="setting-apt-tel" class="form-control" value="${settings.tel || '๐๘๐-๕๙๙๑६๙๑'}" required style="padding:0.55rem 0.75rem;">
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem; margin-bottom:0.85rem;">
              <div class="form-group">
                <label style="font-weight:600;"><i class="fa-solid fa-piggy-bank text-success"></i> ธนาคารรับเงิน:</label>
                <select id="setting-bank-name" class="form-control" style="padding:0.55rem 0.75rem;">
                  <option value="ธนาคารกรุงศรีอยุธยา (BAY)" ${settings.bankName === 'ธนาคารกรุงศรีอยุธยา (BAY)' ? 'selected' : ''}>ธนาคารกรุงศรีอยุธยา (BAY)</option>
                  <option value="ธนาคารกสิกรไทย (KBANK)" ${settings.bankName === 'ธนาคารกสิกรไทย (KBANK)' ? 'selected' : ''}>ธนาคารกสิกรไทย (KBANK)</option>
                  <option value="ธนาคารไทยพาณิชย์ (SCB)" ${settings.bankName === 'ธนาคารไทยพาณิชย์ (SCB)' ? 'selected' : ''}>ธนาคารไทยพาณิชย์ (SCB)</option>
                  <option value="ธนาคารกรุงเทพ (BBL)" ${settings.bankName === 'ธนาคารกรุงเทพ (BBL)' ? 'selected' : ''}>ธนาคารกรุงเทพ (BBL)</option>
                  <option value="ธนาคารกรุงไทย (KTB)" ${settings.bankName === 'ธนาคารกรุงไทย (KTB)' ? 'selected' : ''}>ธนาคารกรุงไทย (KTB)</option>
                  <option value="ธนาคารออมสิน (GSB)" ${settings.bankName === 'ธนาคารออมสิน (GSB)' ? 'selected' : ''}>ธนาคารออมสิน (GSB)</option>
                  <option value="PromptPay (พร้อมเพย์)" ${settings.bankName === 'PromptPay (พร้อมเพย์)' ? 'selected' : ''}>PromptPay (พร้อมเพย์)</option>
                </select>
              </div>
              <div class="form-group">
                <label style="font-weight:600;"><i class="fa-solid fa-credit-card text-info"></i> เลขที่บัญชีธนาคาร:</label>
                <input type="text" id="setting-bank-no" class="form-control" value="${settings.bankAccountNo || '2401346663'}" placeholder="2401346663" style="padding:0.55rem 0.75rem;">
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem; margin-bottom:0.85rem;">
              <div class="form-group">
                <label style="font-weight:600;"><i class="fa-solid fa-user-check text-success"></i> ชื่อบัญชีผู้รับเงิน:</label>
                <input type="text" id="setting-bank-acc-name" class="form-control" value="${settings.bankAccountName || 'นางสมผิว น้ำวน'}" placeholder="สมบัติ / สมผิว น้ำวน" style="padding:0.55rem 0.75rem;">
              </div>
              <div class="form-group">
                <label style="font-weight:600;"><i class="fa-solid fa-qrcode text-warning"></i> เบอร์พร้อมเพย์ (PromptPay ID):</label>
                <input type="text" id="setting-promptpay-id" class="form-control" value="${settings.promptPayId || '0805991691'}" placeholder="0805991691" style="padding:0.55rem 0.75rem;">
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-full" style="padding:0.6rem; font-weight:700; margin-top:0.35rem;">
              <i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูลหอพัก & บัญชีธนาคาร
            </button>
          </form>
        </div>
      `;
} else if (this.activeSection === 'owner_info') {
      cardBody = `
        <div class="glass-card">
          <h3><i class="fa-solid fa-user-tie text-primary"></i> ข้อมูลเจ้าของหอพัก / ผู้ให้เช่า</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">
            ข้อมูลเจ้าของหอพัก/ผู้ให้เช่าจะถูกนำไปใช้แทนที่ข้อมูลผู้ให้เช่าที่ฮาร์ดโค้ดในหนังสือสัญญาเช่าห้องพักโดยอัตโนมัติ
          </p>
          
          <form id="form-owner-settings" style="margin-top:1rem;">
            <div class="form-group" style="margin-bottom:0.85rem;">
              <label style="font-weight:600;"><i class="fa-solid fa-user text-primary"></i> ชื่อ-นามสกุล เจ้าของหอพัก (ผู้ให้เช่า) *:</label>
              <input type="text" id="setting-owner-name" class="form-control" value="${settings.ownerName || 'นายสมบัติ น้ำวน'}" required style="padding:0.55rem 0.75rem;">
            </div>

            <div class="form-group" style="margin-bottom:0.85rem;">
              <label style="font-weight:600;"><i class="fa-solid fa-id-card text-success"></i> เลขบัตรประจำตัวประชาชน (13 หลัก) *:</label>
              <input type="text" id="setting-owner-idcard" class="form-control" value="${settings.ownerIdCard || '3451200115491'}" required style="padding:0.55rem 0.75rem;">
            </div>

            <div class="form-group" style="margin-bottom:0.85rem;">
              <label style="font-weight:600;"><i class="fa-solid fa-location-dot text-info"></i> ที่อยู่ของผู้ให้เช่า (ตามทะเบียนบ้าน) *:</label>
              <input type="text" id="setting-owner-address" class="form-control" value="${settings.ownerAddress || '๔๕/๑๐ หมู่ที่ ๘ ตำบลราษฎร์นิยม อำเภอไทรน้อย จังหวัดนนทบุรี'}" required style="padding:0.55rem 0.75rem;">
            </div>

            <div class="form-group" style="margin-bottom:0.85rem;">
              <label style="font-weight:600;"><i class="fa-solid fa-phone text-warning"></i> เบอร์โทรศัพท์ติดต่อ *:</label>
              <input type="text" id="setting-owner-tel" class="form-control" value="${settings.ownerTel || '๐๘๐-๕๙๙๑६๙๑'}" required style="padding:0.55rem 0.75rem;">
            </div>

            <button type="submit" class="btn btn-primary btn-full" style="padding:0.6rem; font-weight:700; margin-top:0.35rem;">
              <i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูลเจ้าของหอพัก
            </button>
          </form>
        </div>
      `;
      } else if (this.activeSection === 'billing') {
      cardBody = `
        <div class="glass-card">
          <h3><i class="fa-solid fa-file-invoice-dollar text-primary"></i> ตั้งค่าการออกบิลและเอกสาร</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">
            ตั้งค่าลำดับและเงื่อนไขการแสดงผลบนบิลค่าเช่าหอพัก
          </p>
          <div style="margin-top:1.25rem; display:flex; flex-direction:column; gap:1rem;">
            <div class="form-group">
              <label style="font-weight:600;">รูปแบบรหัสบิล (Invoice Number Pattern):</label>
              <input type="text" class="form-control" value="INV-[YYYY][MM]-[ROOM]" readonly disabled style="background:var(--bg-app); border-color:var(--border-color); color:var(--text-muted);">
              <small class="text-muted">ระบบจะคำนวณอัตโนมัติ เช่น INV-202608-S01</small>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
              <div class="form-group">
                <label style="font-weight:600;">วันออกบิลปกติ (Bill Creation Date):</label>
                <input type="text" class="form-control" value="ทุกสิ้นเดือน / ทุกวันที่ 1" readonly disabled style="background:var(--bg-app); border-color:var(--border-color); color:var(--text-muted);">
              </div>
              <div class="form-group">
                <label style="font-weight:600;">วันครบกำหนดชำระปกติ (Invoice Due Day):</label>
                <input type="number" class="form-control" value="${state.lateFeeSettings?.dueDay ?? 5}" readonly disabled style="background:var(--bg-app); border-color:var(--border-color); color:var(--text-muted);">
                <small class="text-muted">ตั้งค่าได้ที่เมนู "ค่าปรับชำระล่าช้า"</small>
              </div>
            </div>
            <div class="form-group">
              <label style="font-weight:600;">ข้อความหมายเหตุสำคัญท้ายใบเสร็จ:</label>
              <textarea class="form-control" rows="3" readonly disabled style="background:var(--bg-app); border-color:var(--border-color); color:var(--text-muted); resize:none;">📌 หมายเหตุสำคัญ: ชำระเงินสดได้ที่ร้าน / หรือโอน ธ.กรุงศรี 2401346663 นางสมผิว น้ำวน (ไม่เกินวันที่ 5 ของเดือน)</textarea>
            </div>
          </div>
        </div>
      `;
    } else if (this.activeSection === 'rates') {
      const rates = state.rates || { electricityRate: 8.0, waterRate: 20.0, trashFee: 20.0, customFees: [] };
      const customFees = rates.customFees || [];
      cardBody = `
        <!-- 1. Standard Rates Form -->
        <div class="glass-card" style="margin-bottom:1.5rem;">
          <h3><i class="fa-solid fa-bolt text-warning"></i> อัตราเรทค่าน้ำ - ค่าไฟ และค่าขยะหลัก</h3>
          <form id="form-rates-main" style="margin-top:1rem;">
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:1rem;">
              <div class="form-group">
                <label>ค่าไฟฟ้า (บาท / ยูนิต) *</label>
                <input type="number" step="0.1" id="rate-elec" class="form-control" value="${rates.electricityRate || 8.0}" required>
              </div>
              <div class="form-group">
                <label>ค่าน้ำประปา (บาท / ยูนิต) *</label>
                <input type="number" step="0.1" id="rate-water" class="form-control" value="${rates.waterRate || 20.0}" required>
              </div>
              <div class="form-group">
                <label>ค่าบริการขยะ (บาท / เดือน) *</label>
                <input type="number" step="0.1" id="rate-trash" class="form-control" value="${rates.trashFee !== undefined ? rates.trashFee : 20.0}" required>
              </div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-top:1rem;">
              <div class="form-group">
                <label>ค่าอินเทอร์เน็ต (บาท / เดือน)</label>
                <input type="number" step="0.1" id="rate-internet" class="form-control" value="${rates.internetFee || ''}" placeholder="เว้นว่างหรือ 0 = ไม่คิดค่านี้">
                <small class="text-muted">เว้นว่างหรือใส่ 0 = ไม่นำไปคำนวณในบิล</small>
              </div>
              <div class="form-group">
                <label>ค่าส่วนกลาง (บาท / เดือน)</label>
                <input type="number" step="0.1" id="rate-common" class="form-control" value="${rates.commonFee || ''}" placeholder="เว้นว่างหรือ 0 = ไม่คิดค่านี้">
                <small class="text-muted">เว้นว่างหรือใส่ 0 = ไม่นำไปคำนวณในบิล</small>
              </div>
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:1rem;"><i class="fa-solid fa-floppy-disk"></i> บันทึกปรับเรทหลัก</button>
          </form>
        </div>

        <!-- 2. Custom Extra Fees Management -->
        <div class="glass-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <div>
              <h3><i class="fa-solid fa-boxes-packing text-primary"></i> รายการค่าใช้จ่ายและค่าบริการเสริมอื่นๆ (Custom Service Fees)</h3>
              <p class="text-muted text-sm">สามารถเพิ่ม แก้ไข ลบ รายการค่าบริการอื่นๆ เพื่อนำไปบันทึกลง Supabase และคำนวณในบิลได้</p>
            </div>
            <button id="btn-add-custom-fee" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> เพิ่มรายการค่าใช้จ่ายใหม่</button>
          </div>

          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>ชื่อรายการค่าใช้จ่าย</th>
                  <th>รูปแบบคำนวณ</th>
                  <th>อัตราค่าบริการ (บาท)</th>
                  <th>หมายเหตุรายละเอียด</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${customFees.length === 0 ? `
                  <tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">ยังไม่มีรายการค่าใช้จ่ายเสริม สามารถกดเพิ่มใหม่ได้</td></tr>
                ` : customFees.map(fee => `
                  <tr>
                    <td><strong>${fee.name}</strong></td>
                    <td><span class="badge-pill badge-info">${fee.unitType === 'monthly' ? '📅 รายเดือน (บาท/เดือน)' : '⚡ ตามหน่วย (บาท/ยูนิต)'}</span></td>
                    <td><strong class="text-primary">${Formatters.currency(fee.amount)}</strong></td>
                    <td><span class="text-muted text-sm">${fee.note || '-'}</span></td>
                    <td>
                      <div class="action-buttons">
                        <button class="btn btn-secondary btn-xs btn-edit-custom-fee" data-id="${fee.id}"><i class="fa-solid fa-pen"></i> แก้ไข</button>
                        <button class="btn btn-danger btn-xs btn-delete-custom-fee" data-id="${fee.id}"><i class="fa-solid fa-trash"></i> ลบ</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (this.activeSection === 'penalty') {
      cardBody = `
        <div class="glass-card">
          <h3><i class="fa-solid fa-clock-rotate-left text-danger"></i> ตั้งค่าค่าปรับชำระเงินล่าช้า (Late Payment Settings)</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">
            กำหนดวันครบกำหนดและค่าปรับสำหรับผู้เช่าที่ชำระค่าเช่าเกินวันที่กำหนด
          </p>
          
          <form id="form-late-fee-settings" style="margin-top:1rem;">
            <div class="form-group" style="margin-bottom:0.85rem;">
              <label style="font-weight:600;"><i class="fa-solid fa-calendar-day text-primary"></i> วันที่ครบกำหนดชำระปกติ (เช่น วันที่ 5):</label>
              <input type="number" id="setting-late-due-day" class="form-control" min="1" max="28" value="${state.lateFeeSettings?.dueDay ?? 5}" required style="padding:0.55rem 0.75rem;">
            </div>

            <div style="border-top:1px dashed #cbd5e1; padding-top:0.75rem; margin-bottom:0.75rem;">
              <div style="font-weight:700; font-size:0.9rem; color:var(--primary); margin-bottom:0.5rem;">ค่าปรับช่วงที่ 1 (ชำระล่าช้าเล็กน้อย)</div>
              <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.5rem;">
                <div class="form-group">
                  <label style="font-size:0.78rem; font-weight:600;">เริ่มต้นวันที่:</label>
                  <input type="number" id="setting-late-p1-start" class="form-control" min="1" max="31" value="${state.lateFeeSettings?.penaltyPhase1Start ?? 6}" style="padding:0.4rem;">
                </div>
                <div class="form-group">
                  <label style="font-size:0.78rem; font-weight:600;">สิ้นสุดวันที่:</label>
                  <input type="number" id="setting-late-p1-end" class="form-control" min="1" max="31" value="${state.lateFeeSettings?.penaltyPhase1End ?? 15}" style="padding:0.4rem;">
                </div>
                <div class="form-group">
                  <label style="font-size:0.78rem; font-weight:600;">ค่าปรับ (บาท):</label>
                  <input type="number" id="setting-late-p1-amount" class="form-control" min="0" value="${state.lateFeeSettings?.penaltyPhase1Amount ?? 200}" style="padding:0.4rem;">
                </div>
              </div>
            </div>

            <div style="border-top:1px dashed #cbd5e1; padding-top:0.75rem; margin-bottom:0.85rem;">
              <div style="font-weight:700; font-size:0.9rem; color:var(--danger); margin-bottom:0.5rem;">ค่าปรับช่วงที่ 2 (ชำระล่าช้าขั้นสูง / ข้ามเดือน)</div>
              <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.5rem;">
                <div class="form-group">
                  <label style="font-size:0.78rem; font-weight:600;">เริ่มต้นวันที่:</label>
                  <input type="number" id="setting-late-p2-start" class="form-control" min="1" max="31" value="${state.lateFeeSettings?.penaltyPhase2Start ?? 16}" style="padding:0.4rem;">
                </div>
                <div class="form-group">
                  <label style="font-size:0.78rem; font-weight:600;">สิ้นสุดวันที่:</label>
                  <input type="number" id="setting-late-p2-end" class="form-control" min="1" max="31" value="${state.lateFeeSettings?.penaltyPhase2End ?? 31}" style="padding:0.4rem;">
                </div>
                <div class="form-group">
                  <label style="font-size:0.78rem; font-weight:600;">ค่าปรับ (บาท):</label>
                  <input type="number" id="setting-late-p2-amount" class="form-control" min="0" value="${state.lateFeeSettings?.penaltyPhase2Amount ?? 300}" style="padding:0.4rem;">
                </div>
              </div>
            </div>

            <button type="submit" class="btn btn-danger btn-full" style="padding:0.6rem; font-weight:700; background-color:#dc2626; border-color:#dc2626; color:#ffffff;">
              <i class="fa-solid fa-floppy-disk"></i> บันทึกตั้งค่าค่าปรับชำระล่าช้า
            </button>
          </form>
        </div>
      `;
    } else if (this.activeSection === 'users') {
      cardBody = `
        <div class="glass-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
            <h3 style="font-size:1.05rem;"><i class="fa-solid fa-users-gear text-primary"></i> จัดการผู้ใช้งานระบบ</h3>
            <button id="btn-add-user" class="btn btn-primary btn-xs"><i class="fa-solid fa-user-plus"></i> เพิ่มผู้ใช้</button>
          </div>
          
          <div class="table-responsive">
            <table class="custom-table" style="font-size:0.85rem;">
              <thead><tr><th>Username</th><th>ชื่อที่แสดง</th><th>สิทธิ์</th><th>การจัดการ</th></tr></thead>
              <tbody>
                ${users.map(u => `
                  <tr>
                    <td><strong>${u.username}</strong></td>
                    <td>${u.displayName}</td>
                    <td><span class="role-pill role-${u.role}" style="font-size:0.75rem; padding:0.15rem 0.4rem;">${u.role === 'super_admin' ? '👑 Super' : (u.role === 'admin' ? '🛡️ Admin' : '👤 Staff')}</span></td>
                    <td>
                      <div class="action-buttons">
                        <button class="btn btn-secondary btn-xs btn-edit-user" data-id="${u.id}"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-primary btn-xs btn-switch-user" data-id="${u.id}"><i class="fa-solid fa-right-to-bracket"></i></button>
                        ${users.length > 1 ? `<button class="btn btn-danger btn-xs btn-delete-user" data-id="${u.id}"><i class="fa-solid fa-trash"></i></button>` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (this.activeSection === 'line_bot') {
      cardBody = `
        <div class="glass-card">
          <h3><i class="fa-brands fa-line text-success"></i> ตั้งค่าระบบ LINE Bot (Messaging API)</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">
            ระบุข้อมูลเพื่อส่งบิลและรับการแจ้งเตือนยอดชำระเงินอัตโนมัติเข้ากลุ่ม LINE หรือบัญชีส่วนตัวของแอดมิน
          </p>
          
          <form id="line-bot-settings-form" style="margin-top:0.85rem;">
            <div class="form-group" style="margin-bottom:0.75rem;">
              <label style="font-size:0.85rem; font-weight:600;"><i class="fa-brands fa-line text-success"></i> LINE Channel Access Token:</label>
              <input type="text" id="setting-line-token" class="form-control" value="${settings.lineToken || ''}" placeholder="ระบุ Channel Access Token..." style="padding:0.5rem 0.75rem; font-size:0.88rem;">
            </div>
            <div class="form-group" style="margin-bottom:0.75rem;">
              <label style="font-size:0.85rem; font-weight:600;"><i class="fa-solid fa-user-tag text-primary"></i> LINE User ID หรือ Group ID แอดมิน *:</label>
              <input type="text" id="setting-line-userid" class="form-control" value="${settings.lineUserId || ''}" placeholder="ระบุ User ID (U...) หรือ Group ID (C...) เพื่อรับแจ้งเตือนสลิป" style="padding:0.5rem 0.75rem; font-size:0.88rem;">
              <span class="text-muted" style="font-size:0.78rem; display:block; margin-top:0.15rem;">👉 ทิป: พิมพ์ <strong>"ไอดี"</strong> คุยกับบอทในไลน์เพื่อเช็ค ID ของคุณหรือของกลุ่มได้ทันที</span>
            </div>
            <div class="form-group" style="margin-bottom:0.85rem;">
              <label style="font-size:0.85rem; font-weight:600; text-decoration: line-through; opacity:0.6;"><i class="fa-solid fa-bell text-warning"></i> LINE Notify Token (ปิดบริการแล้ว):</label>
              <input type="text" id="setting-line-notify-token" class="form-control" value="${settings.lineNotifyToken || ''}" placeholder="LINE Notify ปิดบริการแล้วในปัจจุบัน" style="padding:0.5rem 0.75rem; font-size:0.88rem; opacity:0.5;" disabled>
            </div>

            <div style="display:flex; gap:0.5rem;">
              <button type="submit" class="btn btn-success btn-sm" style="flex:1;"><i class="fa-solid fa-floppy-disk"></i> บันทึก LINE Settings</button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-test-line-send"><i class="fa-paper-plane fa-solid text-success"></i> ส่งแจ้งเตือนทดสอบ</button>
            </div>
          </form>
        </div>
      `;
    } else if (this.activeSection === 'supabase') {
      cardBody = `
        <div class="glass-card">
          <h3><i class="fa-solid fa-database text-primary"></i> ตั้งค่าเซิร์ฟเวอร์ & Supabase</h3>
          <div class="form-group" style="margin-top:0.65rem;">
            <label style="font-size:0.85rem;">Supabase Project URL:</label>
            <input type="url" id="supabase-url-input" class="form-control" value="${settings.supabaseUrl || ''}" placeholder="https://your-project.supabase.co" style="padding:0.5rem 0.75rem; font-size:0.88rem;">
          </div>
          <div class="form-group" style="margin-top:0.5rem;">
            <label style="font-size:0.85rem;">Supabase API Key (Anon Key):</label>
            <input type="text" id="api-key-input" class="form-control" value="${settings.apiKey || ''}" placeholder="วางรหัส Anon Key..." style="padding:0.5rem 0.75rem; font-size:0.88rem;">
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:0.85rem; margin-bottom:1.5rem;">
            <button class="btn btn-primary btn-sm" id="btn-save-supabase-url"><i class="fa-solid fa-save"></i> บันทึก</button>
            <button class="btn btn-success btn-sm" id="btn-sync-to-supabase"><i class="fa-solid fa-cloud-arrow-up"></i> ซิงค์ตอนนี้</button>
            <button class="btn btn-secondary btn-sm" id="btn-copy-shared-link"><i class="fa-solid fa-share-nodes"></i> ลิงก์แชร์</button>
          </div>

          <!-- Meter Link Card -->
          <div style="padding:0.85rem; background:linear-gradient(135deg,rgba(59,130,246,0.08),rgba(99,102,241,0.08)); border:1px solid rgba(59,130,246,0.25); border-radius:12px;">
            <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.6rem;">
              <span style="font-size:1.1rem;">📱</span>
              <div>
                <div style="font-weight:700; font-size:0.9rem; color:#2563eb;">ลิงก์จดมิเตอร์ (สำหรับพนักงาน)</div>
                <div style="font-size:0.78rem; color:#64748b;">ส่งให้พนักงานเปิดบนมือถือ เพื่อจดมิเตอร์น้ำ–ไฟทีละห้อง</div>
              </div>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn btn-primary btn-sm" id="btn-copy-meter-link" style="flex:1; background:linear-gradient(135deg,#2563eb,#6366f1); border:none;">
                <i class="fa-solid fa-gauge-high"></i> คัดลอกลิงก์จดมิเตอร์
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-open-meter" title="เปิดหน้าจดมิเตอร์ในแท็บใหม่">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (this.activeSection === 'backup') {
      cardBody = `
        <div class="glass-card" style="margin-bottom:1.5rem;">
          <h3><i class="fa-solid fa-file-excel text-success"></i> ส่งออกข้อมูลระบบ (Export Data)</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">ส่งออกข้อมูลเป็นไฟล์ตารางสำหรับนำไปใช้ภายนอก</p>
          <div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-top:1rem;">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('btn-export-tenants-excel')?.click() || alert('ไปที่หน้าจัดการผู้เช่าเพื่อสั่งออกตารางผู้เช่า')"><i class="fa-solid fa-file-excel text-success"></i> ทะเบียนผู้เช่า (Excel/CSV)</button>
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('btn-export-contracts-excel')?.click() || alert('ไปที่หน้าจัดการสัญญาเพื่อสั่งออกตารางสัญญา')"><i class="fa-solid fa-file-excel text-success"></i> รายการสัญญาเช่า (Excel/CSV)</button>
          </div>
        </div>
        <div class="glass-card" style="margin-bottom:1.5rem;">
          <h3><i class="fa-solid fa-box-archive text-warning"></i> สำรองข้อมูลแบบไฟล์ (JSON Backup)</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">ดาวน์โหลดไฟล์สำรองข้อมูลทั้งหมดในเครื่อง หรือนำเข้าไฟล์เดิมกลับมา</p>
          <div style="display:flex; gap:0.5rem; margin-top:1rem; flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" id="btn-export-backup-json"><i class="fa-solid fa-download"></i> ดาวน์โหลดไฟล์สำรอง (.json)</button>
            <button class="btn btn-secondary btn-sm" id="btn-trigger-import-json"><i class="fa-solid fa-upload"></i> นำเข้าไฟล์สำรอง (.json)</button>
            <input type="file" id="input-import-json" accept=".json" style="display:none;">
          </div>
        </div>
        <div class="glass-card" style="border:1px solid rgba(220,38,38,0.2); background:rgba(220,38,38,0.02);">
          <h3 style="color:#dc2626;"><i class="fa-solid fa-triangle-exclamation"></i> Danger Zone (รีเซ็ตระบบ)</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">คำเตือน: การล้างข้อมูลจะทำการลบข้อมูลทั้งหมดในระบบ ไม่สามารถยกเลิกภายหลังได้</p>
          <button class="btn btn-danger btn-sm" id="btn-danger-reset-all" style="margin-top:1rem; width:100%;"><i class="fa-solid fa-trash-can"></i> ล้างข้อมูลและรีเซ็ตระบบทั้งหมด</button>
        </div>
      `;
    } else if (this.activeSection === 'appearance') {
      cardBody = `
        <div class="glass-card">
          <h3><i class="fa-solid fa-palette text-primary"></i> ตั้งค่าหน้าตาระบบ (Appearance)</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">ปรับแต่งโหมดการแสดงผลของหน้าจอ</p>
          <div style="margin-top:1.5rem; display:flex; flex-direction:column; gap:1.25rem;">
            <div class="form-group">
              <label style="font-weight:600;">โหมดสีการแสดงผล (Visual Mode):</label>
              <div style="display:flex; gap:0.75rem; margin-top:0.5rem;">
                <button class="btn btn-primary" id="btn-theme-light" style="flex:1; padding:0.75rem;"><i class="fa-solid fa-sun text-warning"></i> โหมดสว่าง (Light Mode)</button>
                <button class="btn btn-secondary" id="btn-theme-dark" style="flex:1; padding:0.75rem;"><i class="fa-solid fa-moon text-info"></i> โหมดมืด (Dark Mode)</button>
              </div>
            </div>
            <div class="form-group">
              <label style="font-weight:600;">สีเน้นหลักของระบบ (Primary Accent Color):</label>
              <div style="display:flex; gap:0.5rem; margin-top:0.5rem; align-items:center;">
                <span style="display:block; width:30px; height:30px; border-radius:50%; background:#2563eb; border:2px solid #fff; box-shadow:0 0 5px rgba(0,0,0,0.2); cursor:pointer;" title="Blue (Cobalt Accent)"></span>
                <span style="display:block; width:30px; height:30px; border-radius:50%; background:#16a34a; opacity:0.4; cursor:not-allowed;" title="Green (Pro Upgrade)"></span>
                <span style="display:block; width:30px; height:30px; border-radius:50%; background:#dc2626; opacity:0.4; cursor:not-allowed;" title="Red (Pro Upgrade)"></span>
                <span class="text-muted text-xs" style="margin-left:0.5rem;">Cobalt Blue (ลิขสิทธิ์ Enterprise)</span>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (this.activeSection === 'security') {
      cardBody = `
        <div class="glass-card" style="margin-bottom:1.5rem;">
          <h3><i class="fa-solid fa-key text-primary"></i> เปลี่ยนรหัสผ่านความปลอดภัย</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">เปิดหน้าต่างเปลี่ยนรหัสผ่านเพื่อเข้าใช้งานระบบหลังบ้านแอดมิน</p>
          <button class="btn btn-primary" id="btn-security-change-pass" style="margin-top:1rem;"><i class="fa-solid fa-user-pen"></i> แก้ไขรหัสผ่านแอดมินปัจจุบัน</button>
        </div>
        <div class="glass-card" style="margin-bottom:1.5rem;">
          <h3><i class="fa-solid fa-right-from-bracket text-danger"></i> ล็อกเอาต์และคุกกี้เซสชัน</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">สั่งออกจากระบบ หรือล้างเซสชันการเชื่อมต่อในเครื่องนี้</p>
          <button class="btn btn-danger btn-sm" onclick="document.getElementById('btn-logout')?.click() || alert('กดปุ่ม ออกจากระบบ ด้านขวาบนได้ทันที')"><i class="fa-solid fa-arrow-right-from-bracket"></i> สั่งล็อกเอาต์ออกจากเครื่องนี้</button>
        </div>
        <div class="glass-card">
          <h3><i class="fa-solid fa-shield-halved text-success"></i> ระบบยืนยันตัวตน 2 ชั้น (2FA)</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">รองรับการล็อกอินผ่าน Google Authenticator หรือ OTP (เปิดให้ใช้บริการในเวอร์ชันถัดไป)</p>
          <div style="display:flex; align-items:center; gap:0.75rem; margin-top:1rem;">
            <input type="checkbox" disabled style="transform:scale(1.3); cursor:not-allowed;">
            <span class="text-muted">เปิดใช้งานระบบยืนยันตัวตน 2 ชั้น (Coming Soon)</span>
          </div>
        </div>
      `;
    } else if (this.activeSection === 'advanced') {
      cardBody = `
        <div class="glass-card" style="margin-bottom:1.5rem;">
          <h3><i class="fa-solid fa-server text-primary"></i> สถานะระบบและ API Connection</h3>
          <div style="margin-top:1rem; display:flex; flex-direction:column; gap:0.6rem; font-size:0.9rem;">
            <div>เวอร์ชันระบบ (System Version): <strong class="text-primary">v4.0.2 Enterprise Edition</strong></div>
            <div>สถานะการซิงค์ฐานข้อมูล (Database Sync): <span class="badge-pill badge-success" style="font-size:0.75rem; padding:0.15rem 0.45rem;">Connected (Supabase Cloud)</span></div>
            <div>ประเภท API ที่ใช้ (API Architecture): <strong>Edge Engine / REST API v1</strong></div>
            <div>ค่าหน่วงเวลาตอบสนอง (Latency Delay): <strong>&lt; 35ms (Fast Connection)</strong></div>
          </div>
        </div>
        <div class="glass-card">
          <h3><i class="fa-solid fa-code text-warning"></i> สำหรับนักพัฒนา (Developer Options)</h3>
          <div style="margin-top:1rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
            <div>
              <strong>เปิดโหมดแสดง Log นักพัฒนา (Console Debug Mode)</strong>
              <div class="text-muted text-sm">แสดงบันทึกและรหัสการทำงานเบื้องหลังระบบในหน้าคอนโซลของเบราว์เซอร์</div>
            </div>
            <div>
              <input type="checkbox" id="dev-mode-toggle" style="transform: scale(1.3); cursor:pointer;">
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="view-container animate-fade-in">
        ${backHeader}
        <div style="max-width:800px; margin:0 auto;">
          ${cardBody}
        </div>
      </div>
    `;
  }
}


class MeterEntryComponent {
  static render(state) {
    const rawInvoices = state.invoices || [];
    const rooms = [...state.rooms].sort(DBService.compareRooms);

    const getRoomPrevMeters = (room) => {
      if (!room) return { elecPrev: 0, waterPrev: 0 };
      let elecPrev = room.lastElecMeter;
      let waterPrev = room.lastWaterMeter;
      if (elecPrev === undefined || waterPrev === undefined || elecPrev === null || waterPrev === null) {
        const roomInvoices = rawInvoices
          .filter(i => i.roomId === room.id)
          .sort((a, b) => (b.monthKey || '').localeCompare(a.monthKey || ''));
        if (roomInvoices.length > 0) {
          elecPrev = roomInvoices[0].elecCurr ?? 0;
          waterPrev = roomInvoices[0].waterCurr ?? 0;
        } else {
          elecPrev = 0;
          waterPrev = 0;
        }
      }
      return { elecPrev, waterPrev };
    };

    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const getNextMonth05 = (monthStr) => {
      if (!monthStr) return "";
      const [year, month] = monthStr.split('-').map(Number);
      let nextMonth = month + 1;
      let nextYear = year;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
      }
      const nextMonthFormatted = String(nextMonth).padStart(2, '0');
      return `${nextYear}-${nextMonthFormatted}-05`;
    };
    const defaultDueDate = getNextMonth05(currentMonthStr);

    if (!state.tempMeterReadings) state.tempMeterReadings = [];

    const renderRows = () => {
      return rooms.map((r, index) => {
        const prev = getRoomPrevMeters(r);
        const elecCurr = r.tempElecMeter !== undefined && r.tempElecMeter !== null ? r.tempElecMeter : '';
        const waterCurr = r.tempWaterMeter !== undefined && r.tempWaterMeter !== null ? r.tempWaterMeter : '';
        const fineAmount = r.tempFineAmount !== undefined && r.tempFineAmount !== null ? r.tempFineAmount : 0;
        
        const elecUnits = elecCurr === '' ? 0 : Math.max(0, parseFloat(elecCurr) - prev.elecPrev);
        const waterUnits = waterCurr === '' ? 0 : Math.max(0, parseFloat(waterCurr) - prev.waterPrev);
        const elecAmt = elecUnits * (state.rates.electricityRate || 8);
        const waterAmt = waterUnits * (state.rates.waterRate || 20);
        const rentAmt = DBService.getRoomRent(r);
        const fees = getRoomFees(r, state.rates);
        const trashFee = fees.trashFee;
        const internetFee = fees.internetFee;
        const commonFee = fees.commonFee;
        const total = rentAmt + elecAmt + waterAmt + trashFee + internetFee + commonFee + parseFloat(fineAmount);

        const isElecError = elecCurr !== '' && parseFloat(elecCurr) < prev.elecPrev;
        const isWaterError = waterCurr !== '' && parseFloat(waterCurr) < prev.waterPrev;

        return `
          <tr data-room-id="${r.id}" data-index="${index}">
            <td style="font-weight:700; text-align:center; background:#f8fafc; color:#334155; position:sticky; left:0; z-index:10; border-right:2px solid var(--border-color);">ห้อง ${r.name}</td>
            <td style="font-size:0.82rem; color:#475569;">${r.currentTenantName || '<span class="text-muted">(ห้องว่าง)</span>'}</td>
            <td style="text-align:right; font-weight:600; color:#64748b; background:#f8fafc;">${prev.elecPrev}</td>
            <td>
              <input type="number" 
                class="excel-input elec-input ${isElecError ? 'excel-input-error' : ''}" 
                data-room-id="${r.id}" 
                data-col="elec"
                value="${elecCurr}" 
                placeholder="กรอกเลข...">
            </td>
            <td class="elec-usage-cell" style="text-align:right; font-weight:600; color:#0f766e;">${elecCurr === '' ? '-' : elecUnits}</td>
            <td style="text-align:right; font-weight:600; color:#64748b; background:#f8fafc;">${prev.waterPrev}</td>
            <td>
              <input type="number" 
                class="excel-input water-input ${isWaterError ? 'excel-input-error' : ''}" 
                data-room-id="${r.id}" 
                data-col="water"
                value="${waterCurr}" 
                placeholder="กรอกเลข...">
            </td>
            <td class="water-usage-cell" style="text-align:right; font-weight:600; color:#1d4ed8;">${waterCurr === '' ? '-' : waterUnits}</td>
            <td>
              <input type="number" 
                class="excel-input fine-input" 
                data-room-id="${r.id}" 
                data-col="fine"
                value="${fineAmount}" 
                placeholder="0">
            </td>
            <td class="total-cell" style="text-align:right; font-weight:800; color:var(--primary); background:#f0f7ff;">
              ฿${total.toLocaleString()}
            </td>
          </tr>
        `;
      }).join('');
    };

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header" style="flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2><i class="fa-solid fa-table-cells text-primary"></i> ตารางกรอกมิเตอร์ (Spreadsheet Input Grid)</h2>
            <p>กรอกเลขจดมิเตอร์น้ำไฟประจำเดือนสะดวกรวดเร็วแบบ Excel บันทึกข้อมูลคลาวด์อัตโนมัติ</p>
          </div>
          <div class="header-actions" style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" id="btn-open-init-meters-modal" title="ตั้งค่าเลขมิเตอร์น้ำ-ไฟเริ่มต้นก่อนใช้งาน">
              <i class="fa-solid fa-sliders text-warning"></i> ตั้งค่ามิเตอร์ยกมา
            </button>
            <span id="excel-sync-indicator" style="font-size:0.85rem; color:#10b981; font-weight:600; display:none;">
              <i class="fa-solid fa-circle-check"></i> บันทึกอัตโนมัติเรียบร้อย
            </span>
            <button class="btn btn-secondary" id="btn-excel-undo" title="ย้อนกลับการแก้ไข (Ctrl+Z)" disabled>
              <i class="fa-solid fa-arrow-rotate-left"></i> ย้อนกลับ (Undo)
            </button>
            <button class="btn btn-primary" id="btn-excel-save-all" title="บันทึกข้อมูลแบบร่างชั่วคราวเก็บไว้ในเครื่อง"><i class="fa-solid fa-floppy-disk"></i> บันทึกร่างชั่วคราว</button>
            <button class="btn btn-success" id="btn-excel-save-to-db" title="ประมวลผลออกบิลและบันทึกค่าน้ำค่าไฟเข้าสู่ฐานข้อมูล Supabase ทันที" style="background-color:#10b981; border-color:#10b981;"><i class="fa-solid fa-cloud-arrow-up"></i> บันทึกและออกบิลลงคลาวด์</button>
          </div>
        </div>

        <div class="glass-card" style="padding:1.25rem;">
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:1rem;">
            <div class="form-group">
              <label style="font-weight:700; font-size:0.88rem; color:#475569; display:block; margin-bottom:0.35rem;">รอบเดือนจดมิเตอร์ *</label>
              <input type="month" id="excel-bill-month" class="form-control" value="${currentMonthStr}" required>
            </div>
            <div class="form-group">
              <label style="font-weight:700; font-size:0.88rem; color:#475569; display:block; margin-bottom:0.35rem;">กำหนดชำระบิล *</label>
              <input type="date" id="excel-due-date" class="form-control" value="${defaultDueDate}" required>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; background:#f8fafc; padding:0.65rem 1rem; border-radius:8px; border:1px solid #e2e8f0; font-size:0.82rem; color:#64748b;">
            <span>
              💡 <b>คำแนะนำ</b>: กด <b>Enter</b> หรือ <b>ลูกศรขึ้น/ลง</b> เพื่อย้ายแถว, กด <b>Tab</b> เพื่อสลับช่อง และสามารถคัดลอกค่าน้ำไฟจาก <b>Excel</b> แล้วกด <b>Ctrl+V</b> วางลงในตารางได้โดยตรง!
            </span>
          </div>

          <div class="table-responsive" style="max-height: 55vh; overflow: auto; border: 1px solid #cbd5e1; border-radius: 8px;">
            <table class="excel-grid-table" style="margin:0; width:100%; border-collapse:collapse; min-width:900px;">
              <thead style="position: sticky; top: 0; z-index: 100; background:#f1f5f9;">
                <tr>
                  <th style="width:100px; text-align:center; position:sticky; left:0; z-index:11; background:#f1f5f9; border-right:2px solid var(--border-color);">ห้อง</th>
                  <th style="width:140px;">ผู้เช่า</th>
                  <th style="width:100px; text-align:right;">ไฟครั้งก่อน</th>
                  <th style="width:120px;">ไฟครั้งนี้</th>
                  <th style="width:100px; text-align:right;">หน่วยใช้ไป</th>
                  <th style="width:100px; text-align:right;">น้ำครั้งก่อน</th>
                  <th style="width:120px;">น้ำครั้งนี้</th>
                  <th style="width:100px; text-align:right;">หน่วยใช้ไป</th>
                  <th style="width:110px;">ค่าปรับ/อื่นๆ</th>
                  <th style="width:130px; text-align:right;">คำนวณยอดรวม</th>
                </tr>
              </thead>
              <tbody id="excel-grid-body">
                ${renderRows()}
              </tbody>
            </table>
          </div>

          <!-- History Panel -->
          <div style="margin-top:0.75rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.65rem 1rem;">
            <h4 style="font-size:0.82rem; color:#334155; margin-bottom:0.35rem; display:flex; align-items:center; gap:0.25rem;"><i class="fa-solid fa-clock-rotate-left"></i> ประวัติการแก้ไขล่าสุดในหน้านี้:</h4>
            <div id="excel-history-log" style="max-height:80px; overflow-y:auto; font-size:0.78rem; color:#64748b; line-height:1.45;">
              <span style="font-style:italic;">ยังไม่มีประวัติการแก้ไขในเซสชันนี้</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

class SlipVerificationComponent {
  static activeFilter = 'all';
  static searchQuery = '';
  static activeSlipId = null;

  static render(state) {
    const slips = state.paymentSlips || [];
    
    const counts = {
      all: slips.length,
      pending: slips.filter(s => s.verificationStatus === 'pending').length,
      amount_mismatch: slips.filter(s => s.verificationStatus === 'amount_mismatch').length,
      duplicate: slips.filter(s => s.verificationStatus === 'duplicate').length,
      approved: slips.filter(s => s.verificationStatus === 'approved').length,
      rejected: slips.filter(s => s.verificationStatus === 'rejected').length
    };

    const filtered = slips.filter(s => {
      if (this.activeFilter !== 'all' && s.verificationStatus !== this.activeFilter) return false;
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase().trim();
        return (s.roomName || '').toLowerCase().includes(q) ||
               (s.tenantName || '').toLowerCase().includes(q) ||
               (s.referenceNo || '').toLowerCase().includes(q) ||
               (s.monthKey || '').toLowerCase().includes(q);
      }
      return true;
    });

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <div>
            <h2><i class="fa-solid fa-receipt text-primary"></i> ตรวจสอบสลิปการชำระเงิน (Slip Verification)</h2>
            <p>ตรวจสอบรูปสลิปจากผู้เช่า เปรียบเทียบยอดเงิน ตรวจสลิปซ้ำ และอนุมัติการชำระเงินเข้าสู่ระบบ</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary btn-sm" id="btn-refresh-slips"><i class="fa-solid fa-rotate"></i> รีเฟรชข้อมูล</button>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="glass-card" style="margin-bottom:1.25rem; padding:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
            
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button class="btn btn-xs ${this.activeFilter === 'all' ? 'btn-primary' : 'btn-secondary'} btn-slip-filter" data-status="all">
                ทั้งหมด (${counts.all})
              </button>
              <button class="btn btn-xs ${this.activeFilter === 'pending' ? 'btn-primary' : 'btn-secondary'} btn-slip-filter" data-status="pending" style="${this.activeFilter === 'pending' ? '' : 'color:#d97706; background:#fffbeb;'}">
                ⏳ รอตรวจสอบ (${counts.pending})
              </button>
              <button class="btn btn-xs ${this.activeFilter === 'amount_mismatch' ? 'btn-primary' : 'btn-secondary'} btn-slip-filter" data-status="amount_mismatch" style="${this.activeFilter === 'amount_mismatch' ? '' : 'color:#ea580c; background:#fff7ed;'}">
                ⚠️ ยอดไม่ตรง (${counts.amount_mismatch})
              </button>
              <button class="btn btn-xs ${this.activeFilter === 'duplicate' ? 'btn-primary' : 'btn-secondary'} btn-slip-filter" data-status="duplicate" style="${this.activeFilter === 'duplicate' ? '' : 'color:#9333ea; background:#faf5ff;'}">
                🚫 สลิปซ้ำ (${counts.duplicate})
              </button>
              <button class="btn btn-xs ${this.activeFilter === 'approved' ? 'btn-primary' : 'btn-secondary'} btn-slip-filter" data-status="approved" style="${this.activeFilter === 'approved' ? '' : 'color:#059669; background:#ecfdf5;'}">
                ✅ อนุมัติแล้ว (${counts.approved})
              </button>
              <button class="btn btn-xs ${this.activeFilter === 'rejected' ? 'btn-primary' : 'btn-secondary'} btn-slip-filter" data-status="rejected" style="${this.activeFilter === 'rejected' ? '' : 'color:#dc2626; background:#fef2f2;'}">
                ❌ ปฏิเสธ (${counts.rejected})
              </button>
            </div>

            <div style="width:220px; position:relative;">
              <input type="text" id="slip-search-input" class="form-control" placeholder="ค้นหาห้อง, ผู้เช่า, Ref..." value="${this.searchQuery}" style="padding:0.4rem 0.75rem; font-size:0.85rem;">
            </div>

          </div>
        </div>

        <!-- Slips List Table -->
        <div class="glass-card">
          <div class="table-responsive">
            <table class="custom-table" style="font-size:0.88rem;">
              <thead>
                <tr>
                  <th style="width:70px;">สลิป</th>
                  <th>ห้องพัก / ผู้เช่า</th>
                  <th>รอบบิล</th>
                  <th style="text-align:right;">ยอดที่ต้องชำระ</th>
                  <th style="text-align:right;">ยอดในสลิป</th>
                  <th style="text-align:right;">ส่วนต่าง</th>
                  <th>วันที่ส่งสลิป</th>
                  <th>สถานะ</th>
                  <th style="text-align:center;">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length === 0 ? `
                  <tr>
                    <td colspan="9" class="text-center text-muted" style="padding:3rem;">
                      <i class="fa-solid fa-receipt" style="font-size:2.5rem; opacity:0.3; margin-bottom:0.5rem;"></i><br>
                      ไม่พบรายการสลิปชำระเงินตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ` : filtered.map(slip => {
                  const reqAmt = slip.requiredAmount || 0;
                  const slipAmt = slip.amount || 0;
                  const diff = slipAmt - reqAmt;
                  const isDiff = Math.abs(diff) > 0.01;

                  let statusBadge = '';
                  switch (slip.verificationStatus) {
                    case 'pending': statusBadge = '<span class="badge-pill badge-warning">⏳ รอตรวจสอบ</span>'; break;
                    case 'approved': statusBadge = '<span class="badge-pill badge-success">✅ อนุมัติแล้ว</span>'; break;
                    case 'amount_mismatch': statusBadge = '<span class="badge-pill" style="background:#ffedd5; color:#c2410c;">⚠️ ยอดเงินไม่ตรง</span>'; break;
                    case 'duplicate': statusBadge = '<span class="badge-pill" style="background:#f3e8ff; color:#7e22ce;">🚫 สลิปซ้ำ</span>'; break;
                    case 'rejected': default: statusBadge = '<span class="badge-pill badge-danger">❌ ปฏิเสธ</span>'; break;
                  }

                  return `
                    <tr>
                      <td style="padding:0.4rem;">
                        <div class="btn-view-slip-image" data-id="${slip.id}" style="width:48px; height:60px; border-radius:8px; overflow:hidden; border:1px solid #cbd5e1; cursor:pointer; background:#f8fafc; position:relative;">
                          <img src="${slip.publicUrl}" style="width:100%; height:100%; object-fit:cover;" alt="สลิป" />
                        </div>
                      </td>
                      <td>
                        <strong>ห้อง ${slip.roomName}</strong>
                        <div class="text-muted" style="font-size:0.8rem;">${slip.tenantName}</div>
                        ${slip.referenceNo ? `<div style="font-size:0.75rem; font-family:monospace; color:#64748b;">Ref: ${slip.referenceNo}</div>` : ''}
                      </td>
                      <td><strong>${Formatters.thaiMonthBE(slip.monthKey)}</strong></td>
                      <td style="text-align:right; font-weight:600;">${Formatters.currency(reqAmt)}</td>
                      <td style="text-align:right; font-weight:700; color:#2563eb;">${Formatters.currency(slipAmt)}</td>
                      <td style="text-align:right; font-weight:700; color:${isDiff ? (diff < 0 ? '#dc2626' : '#16a34a') : '#64748b'};">
                        ${isDiff ? (diff > 0 ? '+' : '') + Formatters.currency(diff) : '฿0.00'}
                      </td>
                      <td style="font-size:0.8rem; color:#64748b;">
                        ${Formatters.thaiDate(slip.createdAt ? slip.createdAt.slice(0,10) : '')}
                      </td>
                      <td>
                        ${statusBadge}
                        ${slip.rejectReason ? `<div style="font-size:0.75rem; color:#dc2626; margin-top:2px;">⚠️ ${slip.rejectReason}</div>` : ''}
                      </td>
                      <td style="text-align:center;">
                        <div style="display:flex; justify-content:center; gap:0.35rem;">
                          <button class="btn btn-secondary btn-xs btn-view-slip-image" data-id="${slip.id}" title="ดูสลิปแบบขยาย"><i class="fa-solid fa-eye"></i></button>
                          ${slip.verificationStatus !== 'approved' ? `
                            <button class="btn btn-success btn-xs btn-approve-slip" data-id="${slip.id}" title="อนุมัติการชำระเงิน"><i class="fa-solid fa-check"></i> อนุมัติ</button>
                          ` : ''}
                          ${slip.verificationStatus !== 'rejected' ? `
                            <button class="btn btn-danger btn-xs btn-reject-slip" data-id="${slip.id}" title="ปฏิเสธสลิป"><i class="fa-solid fa-xmark"></i> ปฏิเสธ</button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  static bindEvents(state) {
    const slips = state.paymentSlips || [];

    // Filter Buttons
    document.querySelectorAll('.btn-slip-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeFilter = btn.getAttribute('data-status');
        App.switchTab('slip-verification');
      });
    });

    // Search Input
    const searchInput = document.getElementById('slip-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        const workspace = document.getElementById('main-workspace');
        if (workspace) {
          workspace.innerHTML = this.render(state);
          this.bindEvents(state);
        }
      });
    }

    // Refresh Button
    const refreshBtn = document.getElementById('btn-refresh-slips');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        const url = DBService.getSavedSupabaseUrl();
        if (url) {
          refreshBtn.disabled = true;
          refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังรีเฟรช...';
          const newState = await DBService.pullFromSupabase(url);
          if (newState) App.state = newState;
          App.switchTab('slip-verification');
        }
      });
    }

    // View Image Zoom Modal
    document.querySelectorAll('.btn-view-slip-image').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const slip = slips.find(s => s.id === id);
        if (slip) this.openZoomModal(slip, state);
      });
    });

    // Approve Button
    document.querySelectorAll('.btn-approve-slip').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const slip = slips.find(s => s.id === id);
        if (!slip) return;

        if (confirm(`กดยืนยันเพื่ออนุมัติการชำระเงินของห้อง ${slip.roomName} (${Formatters.currency(slip.amount)})?`)) {
          btn.disabled = true;
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
          await this.doApproveSlip(slip, state);
        }
      });
    });

    // Reject Button
    document.querySelectorAll('.btn-reject-slip').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const slip = slips.find(s => s.id === id);
        if (slip) this.openRejectModal(slip, state);
      });
    });
  }

  static openZoomModal(slip, state) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    let scale = 1;
    const reqAmt = slip.requiredAmount || 0;
    const slipAmt = slip.amount || 0;
    const diff = slipAmt - reqAmt;

    dialog.innerHTML = `
      <div class="modal-header" style="background:#0f172a; color:#fff;">
        <h3><i class="fa-solid fa-receipt text-primary"></i> ตรวจสอบสลิป — ห้อง ${slip.roomName}</h3>
        <button type="button" class="close-modal-btn" style="color:#fff;">&times;</button>
      </div>
      <div class="modal-body" style="padding:1.25rem; background:#0f172a; color:#f8fafc;">
        <div style="display:grid; grid-template-columns: 1fr 280px; gap:1.25rem;">
          
          <!-- Image Zoom Viewport -->
          <div style="background:#020617; border:1px solid #1e293b; border-radius:12px; height:420px; overflow:hidden; display:flex; align-items:center; justify-content:center; position:relative;">
            <img id="zoom-slip-img" src="${slip.publicUrl}" style="max-height:100%; object-fit:contain; transition:transform 0.15s; transform:scale(1);" alt="สลิป" />
            <div style="position:absolute; bottom:12px; left:12px; display:flex; gap:0.35rem; background:rgba(15,23,42,0.85); padding:0.35rem 0.65rem; border-radius:8px; border:1px solid #334155;">
              <button type="button" class="btn btn-secondary btn-xs" id="btn-zoom-out"><i class="fa-solid fa-minus"></i></button>
              <span id="zoom-val-text" style="font-size:0.8rem; font-weight:700; color:#fff; display:flex; align-items:center; padding:0 4px;">100%</span>
              <button type="button" class="btn btn-secondary btn-xs" id="btn-zoom-in"><i class="fa-solid fa-plus"></i></button>
              <button type="button" class="btn btn-secondary btn-xs" id="btn-zoom-reset" style="margin-left:4px;">รีเซ็ต</button>
            </div>
          </div>

          <!-- Info & Actions -->
          <div style="display:flex; flex-direction:column; justify-space-between; gap:1rem;">
            <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem;">
              <div style="background:#1e293b; border:1px solid #334155; border-radius:10px; padding:0.85rem;">
                <div style="font-weight:700; color:#94a3b8; margin-bottom:0.35rem;">ข้อมูลผู้เช่า & ห้องพัก</div>
                <div style="font-size:1.1rem; font-weight:800; color:#fff;">ห้อง ${slip.roomName}</div>
                <div style="color:#cbd5e1;">${slip.tenantName}</div>
                <div style="font-size:0.78rem; color:#94a3b8; margin-top:2px;">รอบบิล ${Formatters.thaiMonthBE(slip.monthKey)}</div>
              </div>

              <div style="background:#1e293b; border:1px solid #334155; border-radius:10px; padding:0.85rem; display:flex; flex-direction:column; gap:0.4rem;">
                <div style="display:flex; justify-content:space-between;"><span style="color:#94a3b8;">ยอดที่ต้องชำระ:</span><strong>${Formatters.currency(reqAmt)}</strong></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:#94a3b8;">ยอดเงินในสลิป:</span><strong style="color:#38bdf8; font-size:1.05rem;">${Formatters.currency(slipAmt)}</strong></div>
                <div style="display:flex; justify-content:space-between; border-top:1px solid #334155; padding-top:0.35rem;">
                  <span style="color:#94a3b8;">ส่วนต่าง:</span>
                  <strong style="color:${Math.abs(diff) > 0.01 ? (diff < 0 ? '#f87171' : '#34d399') : '#94a3b8'};">
                    ${Math.abs(diff) > 0.01 ? (diff > 0 ? '+' : '') + Formatters.currency(diff) : '฿0.00'}
                  </strong>
                </div>
              </div>

              ${slip.referenceNo ? `
                <div style="background:#1e293b; border:1px solid #334155; border-radius:10px; padding:0.75rem; font-size:0.8rem;">
                  <span style="color:#94a3b8; display:block;">เลขที่อ้างอิง (Ref No.):</span>
                  <code style="color:#38bdf8; font-weight:700; word-break:break-all;">${slip.referenceNo}</code>
                </div>
              ` : ''}
            </div>

            <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:auto;">
              ${slip.verificationStatus !== 'approved' ? `
                <button type="button" class="btn btn-success btn-full" id="modal-btn-approve-slip" style="padding:0.75rem; font-weight:700;">
                  <i class="fa-solid fa-check"></i> อนุมัติการชำระเงิน
                </button>
              ` : ''}
              ${slip.verificationStatus !== 'rejected' ? `
                <button type="button" class="btn btn-danger btn-full" id="modal-btn-reject-slip" style="padding:0.75rem; font-weight:700;">
                  <i class="fa-solid fa-xmark"></i> ปฏิเสธสลิปนี้
                </button>
              ` : ''}
              <button type="button" class="btn btn-secondary btn-full close-modal-btn">ปิดหน้าต่าง</button>
            </div>
          </div>

        </div>
      </div>
    `;

    modal.classList.add('active');

    // Zoom Controls
    const img = dialog.querySelector('#zoom-slip-img');
    const txt = dialog.querySelector('#zoom-val-text');

    dialog.querySelector('#btn-zoom-in').addEventListener('click', () => {
      scale = Math.min(3, scale + 0.3);
      img.style.transform = `scale(${scale})`;
      txt.textContent = `${Math.round(scale * 100)}%`;
    });
    dialog.querySelector('#btn-zoom-out').addEventListener('click', () => {
      scale = Math.max(0.5, scale - 0.3);
      img.style.transform = `scale(${scale})`;
      txt.textContent = `${Math.round(scale * 100)}%`;
    });
    dialog.querySelector('#btn-zoom-reset').addEventListener('click', () => {
      scale = 1;
      img.style.transform = 'scale(1)';
      txt.textContent = '100%';
    });

    const closeBtns = dialog.querySelectorAll('.close-modal-btn');
    closeBtns.forEach(b => b.addEventListener('click', () => modal.classList.remove('active')));

    const approveBtn = dialog.querySelector('#modal-btn-approve-slip');
    if (approveBtn) {
      approveBtn.addEventListener('click', async () => {
        modal.classList.remove('active');
        await this.doApproveSlip(slip, state);
      });
    }

    const rejectBtn = dialog.querySelector('#modal-btn-reject-slip');
    if (rejectBtn) {
      rejectBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        this.openRejectModal(slip, state);
      });
    }
  }

  static openRejectModal(slip, state) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    const presets = [
      'ยอดเงินไม่ตรงกับยอดบิลสุทธิ',
      'สลิปไม่ชัดเจน / ตัวหนังสือเบลอ อ่านไม่ได้',
      'พบการใช้งานสลิปซ้ำในระบบ',
      'ไม่ใช่บัญชีปลายทางของหอพัก',
      'สลิปถูกยกเลิกทำรายการจากต้นทาง',
      'วันที่/เวลาในสลิปไม่ตรงกับรอบบิล'
    ];

    dialog.innerHTML = `
      <div class="modal-header" style="background:#dc2626; color:#fff;">
        <h3><i class="fa-solid fa-triangle-exclamation"></i> ปฏิเสธสลิป — ห้อง ${slip.roomName}</h3>
        <button type="button" class="close-modal-btn" style="color:#fff;">&times;</button>
      </div>
      <div class="modal-body" style="padding:1.25rem;">
        <p style="font-size:0.88rem; color:#475569; margin-bottom:1rem;">
          กรุณาระบุเหตุผลในการปฏิเสธสลิปของห้อง <strong>${slip.roomName}</strong> (${slip.tenantName}):
        </p>

        <form id="form-reject-slip-reason">
          <div class="form-group" style="margin-bottom:1rem;">
            <label style="font-weight:600; font-size:0.85rem; color:#334155; margin-bottom:0.5rem; display:block;">เลือกเหตุผลสำเร็จรูป:</label>
            <select id="select-reject-preset" class="form-control" style="padding:0.6rem;">
              ${presets.map(p => `<option value="${p}">${p}</option>`).join('')}
              <option value="custom">-- กรอกเหตุผลอื่น ๆ --</option>
            </select>
          </div>

          <div class="form-group" id="group-custom-reason" style="display:none; margin-bottom:1rem;">
            <label style="font-weight:600; font-size:0.85rem; color:#334155; margin-bottom:0.35rem; display:block;">ระบุเหตุผลเพิ่มเติม:</label>
            <textarea id="text-custom-reason" class="form-control" rows="3" placeholder="ระบุเหตุผล..." style="padding:0.6rem; font-size:0.88rem;"></textarea>
          </div>

          <div style="display:flex; gap:0.5rem; margin-top:1.25rem;">
            <button type="button" class="btn btn-secondary close-modal-btn" style="flex:1;">ยกเลิก</button>
            <button type="submit" class="btn btn-danger" style="flex:1; font-weight:700;"><i class="fa-solid fa-xmark"></i> ยืนยันการปฏิเสธ</button>
          </div>
        </form>
      </div>
    `;

    modal.classList.add('active');

    const select = dialog.querySelector('#select-reject-preset');
    const customGroup = dialog.querySelector('#group-custom-reason');
    select.addEventListener('change', () => {
      customGroup.style.display = select.value === 'custom' ? 'block' : 'none';
    });

    const closeBtns = dialog.querySelectorAll('.close-modal-btn');
    closeBtns.forEach(b => b.addEventListener('click', () => modal.classList.remove('active')));

    dialog.querySelector('#form-reject-slip-reason').addEventListener('submit', async (e) => {
      e.preventDefault();
      const preset = select.value;
      const customText = dialog.querySelector('#text-custom-reason').value.trim();
      const finalReason = preset === 'custom' ? customText : preset;
      if (!finalReason) {
        alert('กรุณาระบุเหตุผลในการปฏิเสธ');
        return;
      }

      modal.classList.remove('active');
      await this.doRejectSlip(slip, finalReason, state);
    });
  }

  static async doApproveSlip(slip, state) {
    const user = AuthService.getCurrentUser();
    const adminName = user ? user.displayName : 'แอดมิน';
    const supaUrl = DBService.getSavedSupabaseUrl();
    const apiKey = DBService.getSavedApiKey();

    if (supaUrl && apiKey) {
      try {
        const base = DBService.getBaseSupabaseUrl(supaUrl);
        const rpcName = (slip.paymentId || slip.payment_id) ? 'approve_partial_payment' : 'approve_payment_slip';
        const params = (slip.paymentId || slip.payment_id) 
          ? { p_payment_id: slip.paymentId || slip.payment_id, p_admin_name: adminName } 
          : { p_slip_id: slip.id, p_admin_name: adminName };
        const res = await fetch(`${base}/rest/v1/rpc/${rpcName}`, {
          method: 'POST',
          headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(params)
        });
        const result = await res.json();
        if (result.status === 'error') throw new Error(result.message);
      } catch (err) {
        console.warn('Approve slip RPC warning, updating locally:', err);
      }
    }

    // Local state updates
    slip.verificationStatus = 'approved';
    slip.verifiedBy = adminName;
    slip.verifiedAt = new Date().toISOString();

    const payId = slip.paymentId || slip.payment_id;
    if (!state.payments) state.payments = [];
    let payRec = state.payments.find(p => p.id === payId || p.slipId === slip.id || (p.invoiceId === slip.invoiceId && p.amount === slip.amount && p.status === 'pending'));
    if (payRec) {
      payRec.status = 'approved';
      payRec.verifiedBy = adminName;
      payRec.verifiedAt = new Date().toISOString();
    } else {
      payRec = {
        id: payId || ('pay_' + Date.now()),
        invoiceId: slip.invoiceId,
        invoice_id: slip.invoiceId,
        tenantId: slip.tenantId,
        roomId: slip.roomId,
        amount: slip.amount || slip.requiredAmount || 0,
        paymentDate: slip.transactionDate || new Date().toISOString().slice(0, 10),
        paymentMethod: 'transfer',
        slipId: slip.id,
        status: 'approved',
        verifiedBy: adminName,
        verifiedAt: new Date().toISOString(),
        createdAt: slip.createdAt || new Date().toISOString()
      };
      state.payments.push(payRec);
    }

    const inv = (state.invoices || []).find(i => i.id === slip.invoiceId || i.invoiceNumber === slip.invoiceId);
    if (inv) {
      DBService.recalculateInvoiceStatus(inv, state);
      App.addInvoiceToLedger(inv);
    }

    await DBService.saveState(state);
    alert(`✅ อนุมัติการชำระเงินของห้อง ${slip.roomName} เรียบร้อยแล้ว`);
    App.switchTab('slip-verification');
  }

  static async doRejectSlip(slip, reason, state) {
    const user = AuthService.getCurrentUser();
    const adminName = user ? user.displayName : 'แอดมิน';
    const supaUrl = DBService.getSavedSupabaseUrl();
    const apiKey = DBService.getSavedApiKey();

    if (supaUrl && apiKey) {
      try {
        const base = DBService.getBaseSupabaseUrl(supaUrl);
        const rpcName = (slip.paymentId || slip.payment_id) ? 'reject_partial_payment' : 'reject_payment_slip';
        const params = (slip.paymentId || slip.payment_id) 
          ? { p_payment_id: slip.paymentId || slip.payment_id, p_admin_name: adminName, p_reason: reason } 
          : { p_slip_id: slip.id, p_admin_name: adminName, p_reason: reason };
        await fetch(`${base}/rest/v1/rpc/${rpcName}`, {
          method: 'POST',
          headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(params)
        });
      } catch (err) {
        console.warn('Reject slip RPC warning, updating locally:', err);
      }
    }

    slip.verificationStatus = 'rejected';
    slip.verifiedBy = adminName;
    slip.verifiedAt = new Date().toISOString();
    slip.rejectReason = reason;

    const payId = slip.paymentId || slip.payment_id;
    if (state.payments) {
      const payRec = state.payments.find(p => p.id === payId || p.slipId === slip.id || (p.invoiceId === slip.invoiceId && p.amount === slip.amount && p.status === 'pending'));
      if (payRec) {
        payRec.status = 'rejected';
        payRec.note = reason;
        payRec.verifiedBy = adminName;
        payRec.verifiedAt = new Date().toISOString();
      }
    }

    const inv = (state.invoices || []).find(i => i.id === slip.invoiceId || i.invoiceNumber === slip.invoiceId);
    if (inv) {
      DBService.recalculateInvoiceStatus(inv, state);
    }

    await DBService.saveState(state);
    alert(`❌ ปฏิเสธสลิปของห้อง ${slip.roomName} เรียบร้อยแล้ว`);
    App.switchTab('slip-verification');
  }
}

class MeterReadingComponent {
  static render(state) {
    const rooms = state.rooms || [];
    const invoices = state.invoices || [];
    const currentMonthStr = new Date().toISOString().slice(0, 7);

    let totalRooms = rooms.length;
    let recordedCount = 0;
    rooms.forEach(r => {
      const inv = invoices.find(i => i.roomId === r.id && i.monthKey === currentMonthStr);
      if (inv && inv.waterCurr > 0 && inv.elecCurr > 0) {
        recordedCount++;
      }
    });
    let unrecordedCount = totalRooms - recordedCount;

    return `
      <div class="view-container animate-fade-in">
        <!-- Header -->
        <div class="view-header" style="flex-wrap:wrap; gap:1rem;">
          <div>
            <h2><i class="fa-solid fa-gauge-high text-warning"></i> ระบบจดมิเตอร์น้ำ-ไฟ (Meter Reading Module)</h2>
            <p>บันทึกเลขจดมิเตอร์ประจำเดือนสำหรับผู้เช่า อัปเดตค่าน้ำค่าน้ำไฟเข้าบิลเดือนปัจจุบันอัตโนมัติ</p>
          </div>
          <div class="header-actions" style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button id="btn-view-meter-history" class="btn btn-secondary btn-sm">
              <i class="fa-solid fa-clock-rotate-left text-primary"></i> ประวัติการจดมิเตอร์ & Audit Log
            </button>
          </div>
        </div>

        <!-- KPI Cards Summary -->
        <div class="kpi-cards-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom:1.5rem;">
          <div class="kpi-card card-blue">
            <div class="kpi-content">
              <span class="label">ห้องพักทั้งหมด</span>
              <h3 class="value text-primary">${totalRooms} ห้อง</h3>
            </div>
          </div>
          <div class="kpi-card card-green">
            <div class="kpi-content">
              <span class="label">จดมิเตอร์แล้ว (เดือนนี้)</span>
              <h3 class="value text-success">${recordedCount} ห้อง</h3>
            </div>
          </div>
          <div class="kpi-card card-yellow">
            <div class="kpi-content">
              <span class="label">ยังไม่ได้จด (ค้างจด)</span>
              <h3 class="value text-warning">${unrecordedCount} ห้อง</h3>
            </div>
          </div>
          <div class="kpi-card card-purple">
            <div class="kpi-content">
              <span class="label">รอบบิลปัจจุบัน</span>
              <h3 class="value text-purple" style="font-size:1.1rem;">${currentMonthStr}</h3>
            </div>
          </div>
        </div>

        <!-- Filter & Search Controls -->
        <div class="glass-card" style="margin-bottom:1.5rem; padding:1.25rem;">
          <div style="display:grid; grid-template-columns: 1fr auto; gap:1rem; align-items:center;">
            <div class="global-search-container" style="max-width:100%;">
              <i class="fa-solid fa-magnifying-glass search-icon"></i>
              <input type="text" id="meter-search-input" class="global-search-input" placeholder="ค้นหาเลขห้องพัก หรือชื่อผู้เช่า (Real-time)..." autocomplete="off">
            </div>

            <div style="display:flex; align-items:center; gap:0.5rem;">
              <label style="font-weight:700; font-size:0.85rem; color:#475569; white-space:nowrap;">เรียงตาม:</label>
              <select id="meter-sort-select" class="form-control" style="padding:0.6rem 1rem; border-radius:8px; font-weight:600;">
                <option value="room">เลขห้องพัก</option>
                <option value="floor">ชั้นห้องพัก</option>
                <option value="unread">ยังไม่จดมิเตอร์</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Room Cards Grid -->
        <div id="meter-rooms-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap:1.25rem;">
          ${this.renderRoomCards(state, rooms, 'room', '')}
        </div>
      </div>
    `;
  }

  static renderRoomCards(state, rooms, sortBy, searchQuery) {
    const invoices = state.invoices || [];
    const currentMonthStr = new Date().toISOString().slice(0, 7);

    let list = [...rooms];

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => (r.name && r.name.toLowerCase().includes(q)) || (r.currentTenantName && r.currentTenantName.toLowerCase().includes(q)));
    }

    list.sort((a, b) => {
      if (sortBy === 'floor') {
        if (a.floor !== b.floor) return a.floor - b.floor;
        return DBService.compareRooms(a, b);
      }
      if (sortBy === 'unread') {
        const invA = invoices.find(i => i.roomId === a.id && i.monthKey === currentMonthStr);
        const invB = invoices.find(i => i.roomId === b.id && i.monthKey === currentMonthStr);
        const recA = (invA && invA.waterCurr > 0 && invA.elecCurr > 0) ? 1 : 0;
        const recB = (invB && invB.waterCurr > 0 && invB.elecCurr > 0) ? 1 : 0;
        if (recA !== recB) return recA - recB;
        return DBService.compareRooms(a, b);
      }
      return DBService.compareRooms(a, b);
    });

    if (list.length === 0) {
      return `
        <div style="grid-column: 1 / -1; text-align:center; padding:3rem; background:#fff; border-radius:16px; border:1px solid #e2e8f0; color:#64748b;">
          <i class="fa-solid fa-folder-open" style="font-size:2.5rem; margin-bottom:1rem; opacity:0.5;"></i>
          <p style="font-weight:600; margin:0;">ไม่พบข้อมูลห้องพักตามเงื่อนไขที่ค้นหา</p>
        </div>
      `;
    }

    return list.map(r => {
      const inv = invoices.find(i => i.roomId === r.id && i.monthKey === currentMonthStr);
      const isRecorded = Boolean(inv && inv.waterCurr > 0 && inv.elecCurr > 0);
      const tenantName = r.currentTenantName || 'ไม่มีผู้เช่า';
      const lastWater = inv ? inv.waterCurr : (r.lastWaterMeter || 0);
      const lastElec = inv ? inv.elecCurr : (r.lastElecMeter || 0);

      return `
        <div class="glass-card room-card-item" style="padding:1.25rem; display:flex; flex-direction:column; justify-content:space-between; border-radius:16px; border:1px solid ${isRecorded ? '#bbf7d0' : '#e2e8f0'}; background:${isRecorded ? 'rgba(240, 253, 244, 0.6)' : '#fff'}; transition:transform 0.2s, box-shadow 0.2s;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
              <h3 style="font-size:1.25rem; font-weight:800; color:#0f172a; margin:0;">ห้อง ${r.name}</h3>
              <span class="badge-pill ${isRecorded ? 'badge-success' : 'badge-warning'}" style="font-size:0.78rem; font-weight:700; padding:0.3rem 0.65rem;">
                ${isRecorded ? '✓ จดแล้ว' : '○ ยังไม่จด'}
              </span>
            </div>

            <div style="font-size:0.83rem; color:#475569; line-height:1.6; margin-bottom:1rem;">
              <div>👤 ผู้เช่า: <strong>${tenantName}</strong></div>
              <div>🏢 ชั้น: <strong>${r.floor}</strong> | สถานะ: <span class="badge-pill ${r.status === 'vacant' ? 'badge-secondary' : 'badge-primary'}">${r.status === 'vacant' ? 'ห้องว่าง' : 'มีผู้เช่า'}</span></div>
              <div style="margin-top:0.35rem; padding-top:0.35rem; border-top:1px dashed #e2e8f0; color:#64748b;">
                <span>💧 น้ำล่าสุด: <strong class="text-primary">${lastWater}</strong></span> | 
                <span>⚡ ไฟล่าสุด: <strong class="text-warning">${lastElec}</strong></span>
              </div>
            </div>
          </div>

          <button type="button" class="btn ${isRecorded ? 'btn-secondary' : 'btn-primary'} btn-full btn-open-meter-modal" data-room-id="${r.id}" style="padding:0.65rem; font-weight:700; font-size:0.88rem; border-radius:10px;">
            <i class="fa-solid ${isRecorded ? 'fa-pen-to-square text-warning' : 'fa-bolt-lightning'}"></i> ${isRecorded ? 'ดูรายละเอียด / แก้ไขมิเตอร์' : '⚡ จดมิเตอร์ห้องนี้'}
          </button>
        </div>
      `;
    }).join('');
  }

  static bindMeterReadingEvents() {
    const searchInput = document.getElementById('meter-search-input');
    const sortSelect = document.getElementById('meter-sort-select');
    const gridContainer = document.getElementById('meter-rooms-grid');

    const updateGrid = () => {
      if (gridContainer) {
        const q = searchInput ? searchInput.value : '';
        const s = sortSelect ? sortSelect.value : 'room';
        gridContainer.innerHTML = MeterReadingComponent.renderRoomCards(App.state, App.state.rooms || [], s, q);
      }
    };

    if (searchInput) searchInput.addEventListener('input', updateGrid);
    if (sortSelect) sortSelect.addEventListener('change', updateGrid);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-open-meter-modal');
      if (btn) {
        const roomId = btn.getAttribute('data-room-id');
        if (roomId) this.openMeterModal(roomId);
        return;
      }

      const btnHistory = e.target.closest('#btn-view-meter-history');
      if (btnHistory) {
        this.openHistoryModal();
        return;
      }
    });
  }

  static openMeterModal(roomId) {
    const room = (App.state.rooms || []).find(r => r.id === roomId);
    if (!room) return;

    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const invoice = (App.state.invoices || []).find(i => i.roomId === roomId && i.monthKey === currentMonthStr);

    const rates = App.state.rates || { electricityRate: 8.0, waterRate: 20.0 };
    const waterRate = rates.waterRate || 20.0;
    const elecRate = rates.electricityRate || 8.0;

    const waterPrev = invoice ? invoice.waterPrev : (room.lastWaterMeter || 0);
    const elecPrev = invoice ? invoice.elecPrev : (room.lastElecMeter || 0);

    const isRecorded = Boolean(invoice && invoice.waterCurr > 0 && invoice.elecCurr > 0);
    const waterCurrVal = invoice && invoice.waterCurr > 0 ? invoice.waterCurr : '';
    const elecCurrVal = invoice && invoice.elecCurr > 0 ? invoice.elecCurr : '';

    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    dialog.innerHTML = `
      <div style="background:#fff; border-radius:20px; padding:1.75rem; max-width:520px; width:100%; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid #f1f5f9; padding-bottom:0.85rem;">
          <div>
            <h3 style="margin:0; font-size:1.3rem; color:#0f172a;"><i class="fa-solid fa-gauge-high text-warning"></i> บันทึกมิเตอร์น้ำ-ไฟ ห้อง ${room.name}</h3>
            <p style="margin:0.25rem 0 0 0; font-size:0.85rem; color:#64748b;">ผู้เช่า: <strong>${room.currentTenantName || 'ไม่มีผู้เช่า'}</strong> | รอบบิล: <code>${currentMonthStr}</code></p>
          </div>
          <button type="button" class="btn-modal-close" style="background:none; border:none; font-size:1.25rem; color:#94a3b8; cursor:pointer;">&times;</button>
        </div>

        ${!invoice ? `
          <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:1.25rem; text-align:center; color:#92400e; margin-bottom:1.25rem;">
            <i class="fa-solid fa-circle-exclamation" style="font-size:2rem; margin-bottom:0.5rem; color:#f59e0b;"></i>
            <h4 style="margin:0 0 0.35rem 0; font-size:1.05rem;">ยังไม่ได้สร้างบิลของเดือนนี้ (${currentMonthStr})</h4>
            <p style="margin:0; font-size:0.85rem; color:#b45309;">ระบบห้ามสร้างบิลอัตโนมัติ กรุณาไปที่หน้าระบบออกบิลค่าเช่าเพื่อสร้างบิลของเดือนนี้ก่อนทำการบันทึกมิเตอร์</p>
          </div>
        ` : `
          <form id="form-meter-reading-submit">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.25rem; background:#f8fafc; border:1px solid #e2e8f0; padding:0.85rem 1rem; border-radius:12px; font-size:0.85rem;">
              <div>
                <span class="text-muted" style="display:block; margin-bottom:0.15rem;">มิเตอร์น้ำครั้งก่อน</span>
                <strong class="text-primary" style="font-size:1.1rem;">${waterPrev}</strong> ยูนิต
              </div>
              <div>
                <span class="text-muted" style="display:block; margin-bottom:0.15rem;">มิเตอร์ไฟครั้งก่อน</span>
                <strong class="text-warning" style="font-size:1.1rem;">${elecPrev}</strong> ยูนิต
              </div>
            </div>

            <div id="meter-lock-notice" style="display:${isRecorded ? 'block' : 'none'}; margin-bottom:1rem; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:0.65rem 0.85rem; font-size:0.82rem; color:#1e40af;">
              🔒 <strong>บันทึกแล้ว:</strong> 1 ห้อง 1 รอบบิลบันทึกได้ครั้งเดียว หากต้องการแก้ไข กรุณากดปุ่ม <strong>"แก้ไขมิเตอร์"</strong> เพื่อปลดล็อกและบันทึก Audit Log
            </div>

            <div class="form-group" style="margin-bottom:1rem;">
              <label style="font-weight:700; color:#1e293b;">เลขมิเตอร์น้ำล่าสุด (ประปา) *</label>
              <input type="number" step="any" id="input-water-curr" class="form-control" value="${waterCurrVal}" placeholder="ใส่เลขมิเตอร์น้ำล่าสุด..." ${isRecorded ? 'disabled' : ''} required style="padding:0.75rem; border-radius:10px; font-size:1.05rem; font-weight:700;">
            </div>

            <div class="form-group" style="margin-bottom:1rem;">
              <label style="font-weight:700; color:#1e293b;">เลขมิเตอร์ไฟล่าสุด (ไฟฟ้า) *</label>
              <input type="number" step="any" id="input-elec-curr" class="form-control" value="${elecCurrVal}" placeholder="ใส่เลขมิเตอร์ไฟล่าสุด..." ${isRecorded ? 'disabled' : ''} required style="padding:0.75rem; border-radius:10px; font-size:1.05rem; font-weight:700;">
            </div>

            <div class="form-group" style="margin-bottom:1.25rem;">
              <label style="font-weight:600; color:#475569;">หมายเหตุ (ถ้ามี)</label>
              <input type="text" id="input-meter-notes" class="form-control" placeholder="เช่น แจ้งเปลี่ยนมิเตอร์ใหม่..." ${isRecorded ? 'disabled' : ''} style="padding:0.65rem; border-radius:8px;">
            </div>

            <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid #f1f5f9; padding-top:1rem;">
              <button type="button" class="btn btn-secondary btn-modal-close" style="padding:0.65rem 1.25rem;">ยกเลิก</button>
              ${isRecorded ? `
                <button type="button" id="btn-unlock-meter-edit" class="btn btn-warning" style="padding:0.65rem 1.25rem; font-weight:700;">
                  <i class="fa-solid fa-pen-to-square"></i> แก้ไขมิเตอร์
                </button>
                <button type="submit" id="btn-save-meter-submit" class="btn btn-primary" style="display:none; padding:0.65rem 1.25rem; font-weight:700;">
                  <i class="fa-solid fa-floppy-disk"></i> บันทึกการแก้ไข (Audit Log)
                </button>
              ` : `
                <button type="submit" id="btn-save-meter-submit" class="btn btn-primary" style="padding:0.65rem 1.25rem; font-weight:700;">
                  <i class="fa-solid fa-floppy-disk"></i> บันทึกมิเตอร์น้ำ-ไฟ
                </button>
              `}
            </div>
          </form>
        `}
      </div>
    `;

    modal.classList.add('active');

    const closeBtns = dialog.querySelectorAll('.btn-modal-close');
    closeBtns.forEach(b => b.addEventListener('click', () => modal.classList.remove('active')));

    const unlockBtn = dialog.querySelector('#btn-unlock-meter-edit');
    const saveBtn = dialog.querySelector('#btn-save-meter-submit');
    const waterInput = dialog.querySelector('#input-water-curr');
    const elecInput = dialog.querySelector('#input-elec-curr');
    const notesInput = dialog.querySelector('#input-meter-notes');
    let isEditMode = false;

    if (unlockBtn) {
      unlockBtn.addEventListener('click', () => {
        isEditMode = true;
        waterInput.disabled = false;
        elecInput.disabled = false;
        notesInput.disabled = false;
        unlockBtn.style.display = 'none';
        saveBtn.style.display = 'inline-flex';
        waterInput.focus();
      });
    }

    const form = dialog.querySelector('#form-meter-reading-submit');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const waterCurr = parseFloat(waterInput.value);
        const elecCurr = parseFloat(elecInput.value);
        const notes = notesInput ? notesInput.value.trim() : '';

        // Validation Rule: New meter reading MUST NOT be less than previous meter reading
        if (isNaN(waterCurr) || isNaN(elecCurr)) {
          alert('❌ กรุณากรอกเลขมิเตอร์น้ำและไฟให้ถูกต้อง');
          return;
        }

        if (waterCurr < waterPrev || elecCurr < elecPrev) {
          alert('❌ เลขมิเตอร์ต้องไม่น้อยกว่าค่าครั้งก่อน');
          return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';

        try {
          const waterUnits = Math.max(0, waterCurr - waterPrev);
          const elecUnits = Math.max(0, elecCurr - elecPrev);
          const waterAmount = waterUnits * waterRate;
          const elecAmount = elecUnits * elecRate;

          invoice.waterPrev = waterPrev;
          invoice.waterCurr = waterCurr;
          invoice.waterUnits = waterUnits;
          invoice.waterAmount = waterAmount;

          invoice.elecPrev = elecPrev;
          invoice.elecCurr = elecCurr;
          invoice.elecUnits = elecUnits;
          invoice.elecAmount = elecAmount;

          const newTotal = (invoice.rentAmount || 0) +
                           waterAmount +
                           elecAmount +
                           (invoice.trashFee || 0) +
                           (invoice.fineAmount || 0) +
                           (invoice.internetFee || 0) +
                           (invoice.commonFee || 0);

          invoice.totalAmount = newTotal;

          room.lastWaterMeter = waterCurr;
          room.lastElecMeter = elecCurr;

          const currentUser = AuthService.getCurrentUser() || { displayName: 'แอดมิน' };
          if (!App.state.meterAuditLogs) App.state.meterAuditLogs = [];
          App.state.meterAuditLogs.unshift({
            id: 'mal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            roomId: room.id,
            roomName: room.name,
            monthKey: currentMonthStr,
            recordedBy: currentUser.displayName,
            actionType: isEditMode || isRecorded ? 'EDIT' : 'RECORD',
            oldWaterCurr: waterPrev,
            newWaterCurr: waterCurr,
            oldElecCurr: elecPrev,
            newElecCurr: elecCurr,
            waterUnits: waterUnits,
            elecUnits: elecUnits,
            waterAmount: waterAmount,
            elecAmount: elecAmount,
            notes: notes,
            createdAt: new Date().toISOString()
          });

          await DBService.saveState(App.state);

          modal.classList.remove('active');
          alert('🟢 บันทึกเลขมิเตอร์น้ำ-ไฟเรียบร้อยแล้ว!');
          App.switchTab('meter-reading');
        } catch (err) {
          alert('❌ เกิดข้อผิดพลาดในการบันทึกมิเตอร์: ' + err.message);
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> บันทึกมิเตอร์น้ำ-ไฟ';
        }
      });
    }
  }

  static openHistoryModal() {
    const logs = App.state.meterAuditLogs || [];
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    dialog.innerHTML = `
      <div style="background:#fff; border-radius:20px; padding:1.75rem; max-width:850px; width:100%; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid #f1f5f9; padding-bottom:0.85rem;">
          <h3 style="margin:0; font-size:1.3rem; color:#0f172a;"><i class="fa-solid fa-clock-rotate-left text-primary"></i> ประวัติการจดมิเตอร์ & Audit Log</h3>
          <button type="button" class="btn-modal-close" style="background:none; border:none; font-size:1.25rem; color:#94a3b8; cursor:pointer;">&times;</button>
        </div>

        <div class="table-responsive" style="max-height:60vh; overflow-y:auto;">
          <table class="custom-table" style="width:100%; font-size:0.85rem;">
            <thead>
              <tr>
                <th>วัน-เวลาบันทึก</th>
                <th>ห้อง</th>
                <th>รอบบิล</th>
                <th>กิจกรรม</th>
                <th>มิเตอร์น้ำ (เดิม ➔ ใหม่)</th>
                <th>มิเตอร์ไฟ (เดิม ➔ ใหม่)</th>
                <th>หน่วยใช้ไป (น้ำ/ไฟ)</th>
                <th>ผู้บันทึก</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length === 0 ? `
                <tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">ยังไม่มีประวัติการจดหรือแก้ไขมิเตอร์</td></tr>
              ` : logs.map(l => `
                <tr>
                  <td>${Formatters.thaiDate(l.createdAt)}</td>
                  <td><strong>ห้อง ${l.roomName}</strong></td>
                  <td><code>${l.monthKey}</code></td>
                  <td>
                    <span class="badge-pill ${l.actionType === 'EDIT' ? 'badge-warning' : 'badge-success'}" style="font-size:0.75rem;">
                      ${l.actionType === 'EDIT' ? '✏️ แก้ไข' : '⚡ บันทึกแรก'}
                    </span>
                  </td>
                  <td>${l.oldWaterCurr} ➔ <strong>${l.newWaterCurr}</strong></td>
                  <td>${l.oldElecCurr} ➔ <strong>${l.newElecCurr}</strong></td>
                  <td>น้ำ: ${l.waterUnits || 0} / ไฟ: ${l.elecUnits || 0}</td>
                  <td><span class="badge-pill badge-primary" style="font-size:0.75rem;">${l.recordedBy}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="display:flex; justify-content:flex-end; margin-top:1.25rem; pt-3; border-top:1px solid #f1f5f9;">
          <button type="button" class="btn btn-secondary btn-modal-close" style="padding:0.65rem 1.5rem;">ปิด</button>
        </div>
      </div>
    `;

    modal.classList.add('active');

    const closeBtns = dialog.querySelectorAll('.btn-modal-close');
    closeBtns.forEach(b => b.addEventListener('click', () => modal.classList.remove('active')));
  }
}

/* ==========================================================================
   5. MAIN APPLICATION CONTROLLER
   ========================================================================== */

class App {
  static state;
  static activeTab = 'dashboard';

  static async init() {
    const savedUrl = DBService.getSavedSupabaseUrl();

    // Show a modern startup loading screen
    const loader = document.createElement('div');
    loader.id = 'app-startup-loader';
    loader.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#0f172a; color:#f8fafc; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:99999; font-family:sans-serif; transition: opacity 0.3s;';
    loader.innerHTML = `
      <div style="width:50px; height:50px; border:4px solid #334155; border-top-color:#3b82f6; border-radius:50%; animation: spin 1s linear infinite; margin-bottom:1rem;"></div>
      <div style="font-weight:700; font-size:1.1rem; margin-bottom:0.5rem;">กำลังโหลดข้อมูลล่าสุด...</div>
      <div style="font-size:0.9rem; color:#94a3b8;">หอพักสมบัติ นนทบุรี Enterprise Edition</div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;
    document.body.appendChild(loader);

    if (savedUrl) {
      try {
        const localState = DBService.getState();
        const cloudState = await DBService.pullFromSupabase(savedUrl);
        if (cloudState) {
          if (localState && localState.rooms) {
            cloudState.rooms.forEach(cr => {
              const lr = localState.rooms.find(r => r.id === cr.id);
              if (lr) {
                if (cr.tempElecMeter === undefined || cr.tempElecMeter === null) cr.tempElecMeter = lr.tempElecMeter;
                if (cr.tempWaterMeter === undefined || cr.tempWaterMeter === null) cr.tempWaterMeter = lr.tempWaterMeter;
                if (cr.tempFineAmount === undefined || cr.tempFineAmount === null) cr.tempFineAmount = lr.tempFineAmount;
              }
            });
          }
          this.state = cloudState;
          console.log('✅ Real-time Cloud state fetched successfully on start');
        } else {
          this.state = localState;
        }
      } catch (err) {
        console.warn('Startup pull warning, falling back to local cache:', err);
        this.state = DBService.getState();
      }
    } else {
      this.state = DBService.getState();
    }

    // Apply Dark/Light theme on startup
    if (this.state.settings && this.state.settings.theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }

    // Ensure state settings contains savedUrl
    if (savedUrl && (!this.state.settings || !this.state.settings.supabaseUrl)) {
      if (!this.state.settings) this.state.settings = {};
      this.state.settings.supabaseUrl = savedUrl;
    }

    // Calculate late fee penalties on startup
    try {
      const initialPenaltiesChanged = DBService.updateInvoicePenalties(this.state);
      if (initialPenaltiesChanged) {
        DBService.saveState(this.state, true);
      }
    } catch (err) {
      console.warn('Failed to update penalties on startup:', err);
    }
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 300);

    // 2. Render UI
    let currentUser = AuthService.getCurrentUser();

    this.renderShell();
    if (!currentUser) return; // Prompt login screen when not logged in

    this.setupGlobalEvents();
    this.switchTab(this.activeTab);

    // Auto background poll every 15 seconds for live updates
    if (!window.supabasePollInterval && savedUrl) {
      window.supabasePollInterval = setInterval(async () => {
        const url = DBService.getSavedSupabaseUrl();
        if (url && AuthService.getCurrentUser()) {
          try {
            const cloudState = await DBService.pullFromSupabase(url);
            if (cloudState) {
              DBService.updateInvoicePenalties(cloudState);
              // Merge current active temporary meter readings
              cloudState.rooms.forEach(cr => {
                const lr = this.state.rooms?.find(r => r.id === cr.id);
                if (lr) {
                  if (cr.tempElecMeter === undefined || cr.tempElecMeter === null) cr.tempElecMeter = lr.tempElecMeter;
                  if (cr.tempWaterMeter === undefined || cr.tempWaterMeter === null) cr.tempWaterMeter = lr.tempWaterMeter;
                  if (cr.tempFineAmount === undefined || cr.tempFineAmount === null) cr.tempFineAmount = lr.tempFineAmount;
                }
              });
              
              if (JSON.stringify(cloudState) !== JSON.stringify(this.state)) {
                // If user is editing/typing in any input, textarea, select, or if a modal is open,
                // update state without calling switchTab to prevent losing input focus/cursor.
                const focused = document.activeElement;
                const isEditing = focused && (
                  focused.tagName === 'INPUT' || 
                  focused.tagName === 'TEXTAREA' || 
                  focused.tagName === 'SELECT'
                );
                const isModalOpen = document.getElementById('app-modal')?.classList.contains('active');
                
                if (isEditing || isModalOpen) {
                  this.state = cloudState;
                  console.log('✅ Live sync: updated state in background (re-render skipped because user is typing or modal is open)');
                } else {
                  this.state = cloudState;
                  this.switchTab(this.activeTab);
                  console.log('✅ Live sync from Supabase (view re-rendered)');
                }
              }
            }
          } catch (e) {
            console.warn('Live background sync failed:', e);
          }
        }
      }, 15000);
    }
  }

  static renderShell() {
    const user = AuthService.getCurrentUser();
    const appRoot = document.getElementById('app-root');

    if (!user) {
      if (appRoot) {
        appRoot.innerHTML = LoginComponent.render(this.state);
        this.bindLoginEvents();
      }
      return;
    }

    // Ensure app shell structure exists
    if (appRoot && !document.getElementById('sidebar-container')) {
      appRoot.innerHTML = `
        <div id="sidebar-container"></div>
        <div class="sidebar-drawer-overlay" id="sidebar-drawer-overlay"></div>
        <div class="main-content-wrapper">
          <div id="navbar-container"></div>
          <main id="main-workspace" class="main-workspace"></main>
        </div>
        <!-- PWA Mobile Bottom Navigation Bar -->
        <nav class="pwa-bottom-nav">
          <button class="pwa-bottom-nav-item" data-tab="dashboard">
            <i class="fa-solid fa-chart-line"></i>
            <span>ภาพรวม</span>
          </button>
          <button class="pwa-bottom-nav-item" data-tab="rooms">
            <i class="fa-solid fa-house"></i>
            <span>ห้องพัก</span>
          </button>
          <button class="pwa-bottom-nav-item" data-tab="billing">
            <i class="fa-solid fa-file-invoice-dollar"></i>
            <span>จัดการบิล</span>
          </button>
          <button class="pwa-bottom-nav-item" data-tab="repairs">
            <i class="fa-solid fa-wrench"></i>
            <span>แจ้งซ่อม</span>
          </button>
          <button class="pwa-bottom-nav-item" data-tab="settings">
            <i class="fa-solid fa-gears"></i>
            <span>ตั้งค่า</span>
          </button>
        </nav>
      `;
    }

    const sidebarContainer = document.getElementById('sidebar-container');
    const navbarContainer = document.getElementById('navbar-container');

    if (sidebarContainer) {
      sidebarContainer.innerHTML = SidebarComponent.render(this.activeTab, this.state.settings.apartmentName);
    }
    if (navbarContainer && user) {
      navbarContainer.innerHTML = NavbarComponent.render(user, this.state);
    }
  }

  static bindLoginEvents() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('login-username').value.trim();
        const passwordInput = document.getElementById('login-password').value;
        const rememberMeInput = document.getElementById('login-remember-me');
        const rememberMe = rememberMeInput ? rememberMeInput.checked : true;

        const defaultUsers = [
          { id: 'usr_super', username: 'superadmin', displayName: 'สมบัติ น้ำวน', role: 'super_admin', passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' /* sha256('admin') */ },
          { id: 'usr_admin', username: 'admin', displayName: 'เจ้าของหอพัก / แอดมิน', role: 'admin', passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' /* sha256('admin') */ },
          { id: 'usr_staff', username: 'staff', displayName: 'พนักงานต้อนรับ (Staff)', role: 'staff', passwordHash: '1562206543da764123c21bd524674f0a8aaf49c8a89744c97352fe677f7e4006' /* sha256('staff') */ }
        ];
        const users = (this.state.users && this.state.users.length > 0) ? this.state.users : defaultUsers;
        const candidate = users.find(u => u.username.toLowerCase() === usernameInput.toLowerCase());

        let user = null;
        if (candidate) {
          const inputHash = await sha256Hex(passwordInput);
          if (candidate.passwordHash === inputHash) {
            user = candidate;
          } else if (candidate.passwordHash === passwordInput || candidate.password === passwordInput) {
            // รองรับข้อมูลเก่าที่เคยเก็บรหัสผ่านเป็น plaintext ไว้ก่อนหน้านี้ (ยังไม่เคยแฮช)
            // เมื่อล็อกอินผ่านครั้งนี้ ให้แปลงเป็นแฮช SHA-256 แล้วบันทึกทับทันที ไม่เก็บ plaintext ต่อ
            user = candidate;
            candidate.passwordHash = inputHash;
            delete candidate.password;
            if (this.state.users && this.state.users.length > 0) {
              try { DBService.saveState(this.state); } catch (migrateErr) { /* ไม่เป็นไรถ้าบันทึกไม่ทัน จะแปลงใหม่ในครั้งถัดไป */ }
            }
          }
        }

        if (user) {
          AuthService.setCurrentUser(user, rememberMe);
          LoggerService.log(user.username, user.role, 'LOGIN', 'AUTH', 'เข้าสู่ระบบสำเร็จ');
          this.init();
        } else {
          alert('⚠️ ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง!');
        }
      });
    }

    const togglePassBtn = document.getElementById('btn-toggle-password');
    if (togglePassBtn) {
      togglePassBtn.addEventListener('click', () => {
        const passInput = document.getElementById('login-password');
        if (passInput) {
          const isPass = passInput.type === 'password';
          passInput.type = isPass ? 'text' : 'password';
          togglePassBtn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
        }
      });
    }

  }

  static switchTab(tabId) {
    try {
      if (tabId === 'billing' || tabId === 'slip-verification' || tabId === 'dashboard') {
      const changed = DBService.updateInvoicePenalties(this.state);
      if (changed) {
        DBService.saveState(this.state, true);
      }
    }
    this.activeTab = tabId;
    this.renderShell();

    const workspace = document.getElementById('main-workspace');
    if (!workspace) return;

    switch (tabId) {
      case 'dashboard': workspace.innerHTML = DashboardComponent.render(this.state); break;
      case 'contracts': workspace.innerHTML = ContractsComponent.render(this.state); this.bindContractsEvents(); break;
      case 'tenants': workspace.innerHTML = TenantsComponent.render(this.state); this.bindTenantsEvents(); break;
      case 'rooms': workspace.innerHTML = RoomsComponent.render(this.state); this.bindRoomsEvents(); break;
      case 'roomtypes': workspace.innerHTML = RoomTypesComponent.render(this.state); this.bindRoomTypesEvents(); break;
      case 'meter-reading': workspace.innerHTML = MeterReadingComponent.render(this.state); MeterReadingComponent.bindMeterReadingEvents(); break;
      case 'meter-entry': workspace.innerHTML = MeterEntryComponent.render(this.state); this.bindMeterEntryEvents(); break;
      case 'billing': workspace.innerHTML = BillingComponent.render(this.state); this.bindBillingEvents(); break;
      case 'partial-payments': workspace.innerHTML = PartialPaymentsComponent.render(this.state); PartialPaymentsComponent.bindEvents(this.state); break;
      case 'slip-verification': workspace.innerHTML = SlipVerificationComponent.render(this.state); SlipVerificationComponent.bindEvents(this.state); break;
      case 'repairs': workspace.innerHTML = RepairsComponent.render(this.state); this.bindRepairsEvents(); break;
      case 'accounting': workspace.innerHTML = AccountingComponent.render(this.state); this.bindAccountingEvents(); break;
      case 'calendar': workspace.innerHTML = CalendarComponent.render(this.state); this.bindCalendarEvents(); break;
      case 'reports': workspace.innerHTML = ReportsComponent.render(this.state); this.bindReportsEvents(); break;
      case 'rates': workspace.innerHTML = RatesComponent.render(this.state); this.bindRatesEvents(); break;
      case 'settings': workspace.innerHTML = SettingsComponent.render(this.state); this.bindSettingsEvents(); break;
      default: workspace.innerHTML = DashboardComponent.render(this.state);
    }

    // Update active state on bottom nav bar items
    document.querySelectorAll('.pwa-bottom-nav-item').forEach(item => {
      if (item.getAttribute('data-tab') === tabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    } catch (err) {
      console.error('Error rendering view:', err);
      const workspace = document.getElementById('main-workspace');
      if (workspace) {
        workspace.innerHTML = `
          <div class="glass-card text-center" style="padding:3rem 1.5rem; margin:2rem auto; max-width:500px; text-align:center;">
            <i class="fa-solid fa-triangle-exclamation text-danger" style="font-size:3rem; margin-bottom:1rem; color:#dc2626;"></i>
            <h3 style="font-weight:700; color:#0f172a; margin-bottom:0.5rem;">เกิดข้อผิดพลาดในการโหลดข้อมูล</h3>
            <p style="color:#64748b; font-size:0.9rem; margin-bottom:1.5rem;">${err.message || 'ระบบไม่สามารถประมวลผลหน้านี้ได้'}</p>
            <button class="btn btn-primary" onclick="window.location.reload();" style="padding:0.75rem 1.5rem; border-radius:8px; font-weight:700;">
              <i class="fa-solid fa-rotate-right"></i> ลองใหม่
            </button>
          </div>
        `;
      }
    }
  }

  static setupGlobalEvents() {
    // Global delegated click handler for dynamic elements (Links, Logout, User Profile, Notifications)
    document.addEventListener('click', (e) => {
      // 1. Sidebar Nav Links
      const link = e.target.closest('a[data-tab]');
      if (link) {
        e.preventDefault();
        const tabId = link.getAttribute('data-tab');
        if (tabId === 'tenants') TenantsComponent.activeSection = 'home';
        if (tabId === 'settings') SettingsComponent.activeSection = 'home';
        if (tabId) this.switchTab(tabId);
        return;
      }

      // 2. Logout Button
      const logoutBtn = e.target.closest('#logout-btn');
      if (logoutBtn) {
        e.preventDefault();
        if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
          AuthService.setCurrentUser(null);
          this.renderShell();
        }
        return;
      }

      // 2.5 Click on Sidebar Brand to Edit Apartment Name & Logo
      const sidebarBrand = e.target.closest('#btn-sidebar-brand-edit');
      if (sidebarBrand) {
        e.preventDefault();
        this.openApartmentBrandEditModal();
        return;
      }

      // 3. User Profile Badge Click
      const profileBadge = e.target.closest('#navbar-user-profile');
      if (profileBadge) {
        e.preventDefault();
        const currentUser = AuthService.getCurrentUser();
        if (currentUser) this.openUserProfileModal(currentUser);
        return;
      }

      // 4. Notification Bell Dropdown Toggle
      const bellBtn = e.target.closest('#notification-bell-btn');
      if (bellBtn) {
        e.preventDefault();
        e.stopPropagation();
        const menu = document.getElementById('notification-menu');
        if (menu) menu.classList.toggle('active');
        return;
      }

      // 5. Notification Link Item Click
      const notifItem = e.target.closest('.notif-link-item');
      if (notifItem) {
        e.preventDefault();
        const targetTab = notifItem.getAttribute('data-tab');
        if (targetTab) {
          const menu = document.getElementById('notification-menu');
          if (menu) menu.classList.remove('active');
          this.switchTab(targetTab);
        }
        return;
      }

      // 6. Mobile Toggle Button (Drawer)
      const mobileToggle = e.target.closest('#mobile-toggle-btn');
      if (mobileToggle) {
        e.preventDefault();
        e.stopPropagation();
        const sidebar = document.getElementById('app-sidebar');
        const overlay = document.getElementById('sidebar-drawer-overlay');
        if (sidebar) sidebar.classList.toggle('drawer-open');
        if (overlay) overlay.classList.toggle('active');
        return;
      }

      // 6.1 Sidebar Drawer Backdrop Overlay Click
      const drawerOverlay = e.target.closest('#sidebar-drawer-overlay');
      if (drawerOverlay) {
        e.preventDefault();
        const sidebar = document.getElementById('app-sidebar');
        if (sidebar) sidebar.classList.remove('drawer-open', 'active');
        drawerOverlay.classList.remove('active');
        return;
      }

      // 6.2 PWA Mobile Bottom Navigation Click
      const bottomNavItem = e.target.closest('.pwa-bottom-nav-item');
      if (bottomNavItem) {
        e.preventDefault();
        const tab = bottomNavItem.getAttribute('data-tab');
        if (tab === 'tenants') TenantsComponent.activeSection = 'home';
        if (tab === 'settings') SettingsComponent.activeSection = 'home';
        this.switchTab(tab);
        // Close sidebar if open
        const sidebar = document.getElementById('app-sidebar');
        const overlay = document.getElementById('sidebar-drawer-overlay');
        if (sidebar) sidebar.classList.remove('drawer-open', 'active');
        if (overlay) overlay.classList.remove('active');
        return;
      }

      // 7. Manual Sync Sheets Button
      const syncBtn = e.target.closest('#btn-manual-sync-supabase');
      if (syncBtn) {
        e.preventDefault();
        this.handleManualSyncSupabase(syncBtn);
        return;
      }

      // 7.1 Quick Full Backup Button
      const quickBackupBtn = e.target.closest('#btn-quick-full-backup');
      if (quickBackupBtn) {
        e.preventDefault();
        ExportService.exportFullBackupExcel(this.state);
        return;
      }
    });

    // Delegated input handler for global search input
    document.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'global-search-input') {
        const query = e.target.value.toLowerCase().trim();
        const rows = document.querySelectorAll('.custom-table tbody tr, .room-card');
        rows.forEach((row) => {
          row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
        });
      }
    });
  }

  static async handleManualSyncSupabase(syncBtn) {
    const url = DBService.getSavedSupabaseUrl();
    if (!url) {
      alert('กรุณาตั้งค่า Supabase Project URL ก่อนกดดึงข้อมูล');
      return;
    }
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-primary"></i> <span class="desktop-only">กำลังดึงข้อมูล...</span>';
    try {
      const mergeUrl = url.includes('?') ? `${url}&merge=true` : `${url}?merge=true`;
      const cloudState = await DBService.pullFromSupabase(mergeUrl);
      if (cloudState) {
        this.state = cloudState;
        this.switchTab(this.activeTab);
        alert('✅ ดึงข้อมูลล่าสุดที่แก้ไขใน Supabase เรียบร้อยแล้ว!');
      } else {
        alert('ไม่พบข้อมูลใหม่จาก Supabase');
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการดึงข้อมูลจาก Supabase: ' + err.message);
    } finally {
      syncBtn.disabled = false;
      syncBtn.innerHTML = '<i class="fa-solid fa-rotate text-primary"></i> <span class="desktop-only">ดึงข้อมูลล่าสุด</span>';
    }
  }

  static openApartmentBrandEditModal() {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');
    const settings = this.state.settings || {};
    const logoIcon = settings.logoIcon || 'fa-house-lock';
    const logoUrl = settings.logoUrl || '';

    const presetIcons = [
      'fa-house-lock', 'fa-building', 'fa-hotel', 'fa-key',
      'fa-shield-halved', 'fa-landmark', 'fa-house', 'fa-crown',
      'fa-city', 'fa-sign-hanging', 'fa-lightbulb', 'fa-star'
    ];

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-pen-to-square text-primary"></i> แก้ไขชื่อหอพัก & โลโก้</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body" style="padding:1.25rem; max-height:80vh; overflow-y:auto;">
        <form id="form-brand-edit-quick">
          <div class="form-group" style="margin-bottom:1rem;">
            <label style="font-weight:700;"><i class="fa-solid fa-building text-primary"></i> ชื่อหอพัก / สถานประกอบการ *</label>
            <input type="text" id="brand-apt-name" class="form-control" value="${settings.apartmentName || 'หอพักสมบัติ นนทบุรี'}" required style="padding:0.6rem 0.85rem; font-size:1rem; font-weight:600;">
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem; margin-bottom:1.25rem;">
            <label style="font-weight:700; display:block; margin-bottom:0.75rem; color:#1e293b;">
              <i class="fa-solid fa-circle-nodes text-primary"></i> โหมดสัญลักษณ์/โลโก้ที่แสดง
            </label>
            <div style="display:flex; gap:1rem; margin-bottom:1rem;">
              <label style="flex:1; padding:0.6rem 0.85rem; border:1px solid #cbd5e1; border-radius:8px; display:inline-flex; align-items:center; gap:0.5rem; cursor:pointer; background:#fff; font-weight:600;">
                <input type="radio" name="logo-mode" value="icon" ${!logoUrl ? 'checked' : ''} id="radio-logo-icon"> ⚡ เลือกไอคอนระบบ
              </label>
              <label style="flex:1; padding:0.6rem 0.85rem; border:1px solid #cbd5e1; border-radius:8px; display:inline-flex; align-items:center; gap:0.5rem; cursor:pointer; background:#fff; font-weight:600;">
                <input type="radio" name="logo-mode" value="image" ${logoUrl ? 'checked' : ''} id="radio-logo-image"> 🖼️ อัปโหลดรูปภาพ
              </label>
            </div>

            <!-- โหมดไอคอน -->
            <div id="section-logo-preset-icon" style="display:${!logoUrl ? 'block' : 'none'};">
              <label style="font-size:0.85rem; color:#64748b; font-weight:600; display:block; margin-bottom:0.5rem;">เลือกไอคอนที่ต้องการ:</label>
              <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:0.6rem; text-align:center;">
                ${presetIcons.map(ic => `
                  <div class="preset-icon-box ${logoIcon === ic ? 'active' : ''}" data-icon="${ic}" style="border:2px solid ${logoIcon === ic ? 'var(--primary)' : '#e2e8f0'}; background:#fff; border-radius:8px; padding:0.6rem 0.4rem; cursor:pointer; transition:all 0.2s;">
                    <i class="fa-solid ${ic}" style="font-size:1.35rem; color:${logoIcon === ic ? 'var(--primary)' : '#475569'};"></i>
                    <div style="font-size:0.65rem; margin-top:0.3rem; color:#94a3b8; word-break:break-all;">${ic.replace('fa-', '')}</div>
                  </div>
                `).join('')}
              </div>
              <div class="form-group" style="margin-top:0.75rem;">
                <label style="font-size:0.82rem; font-weight:600; color:#475569;">หรือกรอกรหัส FontAwesome Icon อื่นๆ (เช่น fa-house-user):</label>
                <input type="text" id="brand-custom-icon" class="form-control" value="${logoIcon}" style="padding:0.45rem 0.65rem; font-size:0.88rem;">
              </div>
            </div>

            <!-- โหมดรูปภาพอัปโหลด -->
            <div id="section-logo-upload-image" style="display:${logoUrl ? 'block' : 'none'};">
              <div class="form-group" style="margin:0;">
                <label style="font-size:0.85rem; color:#64748b; font-weight:600; display:block; margin-bottom:0.4rem;">อัปโหลดไฟล์รูปภาพโลโก้ (PNG/JPG/WEBP):</label>
                <input type="file" id="brand-logo-file-input" class="form-control" accept="image/*" style="padding:0.35rem; font-size:0.88rem;">
              </div>
              <div class="form-group" style="margin-top:0.75rem;">
                <label style="font-size:0.85rem; color:#64748b; font-weight:600; display:block; margin-bottom:0.4rem;">หรือใส่ URL รูปภาพโดยตรง (ถ้ามี):</label>
                <input type="url" id="brand-logo-url-input" class="form-control" value="${logoUrl}" placeholder="https://example.com/logo.png" style="padding:0.45rem 0.65rem; font-size:0.88rem;">
              </div>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-full" style="padding:0.75rem; font-weight:700;"><i class="fa-solid fa-save"></i> บันทึกข้อมูลและโลโก้</button>
        </form>
      </div>

      <style>
        .preset-icon-box:hover {
          border-color: var(--primary) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        }
        .preset-icon-box.active {
          background: #eff6ff !important;
        }
      </style>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    const radioIcon = dialog.querySelector('#radio-logo-icon');
    const radioImage = dialog.querySelector('#radio-logo-image');
    const sectionIcon = dialog.querySelector('#section-logo-preset-icon');
    const sectionImage = dialog.querySelector('#section-logo-upload-image');

    radioIcon.addEventListener('change', () => {
      sectionIcon.style.display = 'block';
      sectionImage.style.display = 'none';
    });
    radioImage.addEventListener('change', () => {
      sectionIcon.style.display = 'none';
      sectionImage.style.display = 'block';
    });

    let selectedIcon = logoIcon;
    dialog.querySelectorAll('.preset-icon-box').forEach(box => {
      box.addEventListener('click', () => {
        dialog.querySelectorAll('.preset-icon-box').forEach(b => {
          b.classList.remove('active');
          b.style.borderColor = '#e2e8f0';
          b.querySelector('i').style.color = '#475569';
        });
        box.classList.add('active');
        box.style.borderColor = 'var(--primary)';
        box.querySelector('i').style.color = 'var(--primary)';
        selectedIcon = box.getAttribute('data-icon');
        dialog.querySelector('#brand-custom-icon').value = selectedIcon;
      });
    });

    dialog.querySelector('#form-brand-edit-quick').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';

      const name = dialog.querySelector('#brand-apt-name').value.trim();
      const isIconMode = radioIcon.checked;
      let finalIcon = dialog.querySelector('#brand-custom-icon').value.trim() || 'fa-house-lock';
      let finalUrl = '';

      if (!isIconMode) {
        finalIcon = '';
        const fileInput = dialog.querySelector('#brand-logo-file-input');
        const urlInput = dialog.querySelector('#brand-logo-url-input');
        
        if (fileInput.files.length > 0) {
          try {
            const hasUrl = DBService.getSavedSupabaseUrl();
            const hasKey = DBService.getSavedApiKey();
            if (hasUrl && hasKey) {
              finalUrl = await DBService.uploadFileToStorage(fileInput.files[0], 'logo');
            } else {
              const reader = new FileReader();
              finalUrl = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(fileInput.files[0]);
              });
            }
          } catch (err) {
            alert('อ่านไฟล์รูปภาพหรืออัปโหลดไม่สำเร็จ: ' + err.message);
          }
        } else {
          finalUrl = urlInput.value.trim();
        }
        
        if (!finalUrl && logoUrl) {
          finalUrl = logoUrl;
        }
      }

      if (!this.state.settings) this.state.settings = {};
      this.state.settings.apartmentName = name;
      this.state.settings.logoIcon = finalIcon;
      this.state.settings.logoUrl = finalUrl;

      const settingAptNameInput = document.getElementById('setting-apt-name');
      if (settingAptNameInput) settingAptNameInput.value = name;

      DBService.saveState(this.state);
      modal.classList.remove('active');
      this.renderShell();
      this.switchTab(this.activeTab);
    });
  }

  static openUserProfileModal(currentUser) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');
    const users = this.state.users || [];

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-user-shield text-primary"></i> ข้อมูลผู้ใช้งาน & สลับบทบาทสิทธิ์ (User Profile)</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div style="background:#f8fafc; padding:1.25rem; border-radius:12px; border:1px solid #e2e8f0; margin-bottom:1.5rem; text-align:center;">
          <div style="width:60px; height:60px; background:#2563eb; color:#fff; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:1.75rem; margin-bottom:0.5rem;">
            <i class="fa-solid fa-user"></i>
          </div>
          <h3 style="margin:0; color:#0f172a; font-weight:700;">${currentUser.displayName}</h3>
          <p class="text-muted" style="margin-top:0.25rem;">Username: <strong>${currentUser.username}</strong> | บทบาทปัจจุบัน: <span class="role-pill role-${currentUser.role}">${currentUser.role === 'super_admin' ? '👑 Super Admin' : (currentUser.role === 'admin' ? '🛡️ Admin' : '👤 Staff')}</span></p>
        </div>

        <h4 style="font-size:0.85rem; font-weight:600; color:#334155; margin-bottom:0.75rem;"><i class="fa-solid fa-right-to-bracket text-primary"></i> 1-Click สลับบทบาทผู้ใช้งานทันที:</h4>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          ${users.map(u => `
            <button type="button" class="btn ${u.username === currentUser.username ? 'btn-primary' : 'btn-secondary'} btn-sm btn-profile-switch" data-id="${u.id}" style="justify-content:space-between; padding:0.75rem 1rem; border-radius:8px;">
              <span><i class="fa-solid ${u.role === 'super_admin' ? 'fa-crown text-warning' : (u.role === 'admin' ? 'fa-user-shield text-primary' : 'fa-user text-info')}"></i> <strong>${u.displayName}</strong> (${u.role})</span>
              ${u.username === currentUser.username ? '<span>(ใช้งานอยู่)</span>' : '<span class="text-muted">สลับใช้งาน ➔</span>'}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    dialog.querySelectorAll('.btn-profile-switch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.currentTarget.getAttribute('data-id');
        const selectedUser = this.state.users.find(u => u.id === userId);
        if (selectedUser) {
          AuthService.setCurrentUser(selectedUser);
          modal.classList.remove('active');
          this.renderShell();
          this.switchTab(this.activeTab);
        }
      });
    });
  }

  // --- 1. ROOMS EVENTS ---
  static bindRoomsEvents() {
    const addRoomBtn = document.getElementById('btn-add-room');
    if (addRoomBtn) {
      addRoomBtn.addEventListener('click', () => this.openRoomModal());
    }

    const bulkInvoicesBtn = document.getElementById('btn-bulk-invoices');
    if (bulkInvoicesBtn) {
      bulkInvoicesBtn.addEventListener('click', () => this.openBulkInvoicesModal());
    }

    const addRoomBtnEmpty = document.getElementById('btn-add-room-empty');
    if (addRoomBtnEmpty) {
      addRoomBtnEmpty.addEventListener('click', () => this.openRoomModal());
    }

    document.querySelectorAll('.btn-edit-room').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const room = this.state.rooms.find(r => r.id === id);
        if (room) this.openRoomModal(room);
      });
    });

    document.querySelectorAll('.btn-action-bill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const room = this.state.rooms.find(r => r.id === id);
        if (room) {
          this.switchTab('billing');
          this.openCreateBillModal(room);
        }
      });
    });

    document.querySelectorAll('.btn-delete-room').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const name = e.currentTarget.getAttribute('data-name');
        if (confirm(`คุณต้องการลบห้องพัก "${name}" ออกจากระบบใช่หรือไม่?\n\n(ระบบจะทำการซิงค์ลบข้อมูลลง Supabase อัตโนมัติ)`)) {
          const idx = this.state.rooms.findIndex(r => r.id === id);
          if (idx !== -1) {
            this.state.rooms.splice(idx, 1);
            DBService.saveState(this.state);
            this.switchTab('rooms');
          }
        }
      });
    });
  }

  // --- 1.1 ROOM TYPES EVENTS ---
  static bindRoomTypesEvents() {
    const addTypeBtn = document.getElementById('btn-add-roomtype');
    if (addTypeBtn) {
      addTypeBtn.addEventListener('click', () => this.openRoomTypeModal());
    }

    document.querySelectorAll('.btn-edit-roomtype').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const rt = (this.state.roomTypes || []).find(t => t.id === id);
        if (rt) this.openRoomTypeModal(rt);
      });
    });

    document.querySelectorAll('.btn-delete-roomtype').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const name = e.currentTarget.getAttribute('data-name');
        const roomsUsing = (this.state.rooms || []).filter(r => r.typeId === id);
        if (roomsUsing.length > 0) {
          alert(`⚠️ ไม่สามารถลบประเภทห้อง "${name}" ได้ เนื่องจากยังมีห้องพักที่ใช้งานประเภทนี้อยู่จำนวน ${roomsUsing.length} ห้อง`);
          return;
        }

        if (confirm(`คุณต้องการลบประเภทห้องเช่า "${name}" ออกจากระบบใช่หรือไม่?`)) {
          const types = this.state.roomTypes || [];
          const idx = types.findIndex(t => t.id === id);
          if (idx !== -1) {
            types.splice(idx, 1);
            DBService.saveState(this.state);
            this.switchTab('roomtypes');
          }
        }
      });
    });
  }

  static openRoomTypeModal(typeToEdit = null) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');
    const isEdit = !!typeToEdit;

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid ${isEdit ? 'fa-pen text-info' : 'fa-plus text-primary'}"></i> ${isEdit ? 'แก้ไขประเภทห้องเช่า' : 'เพิ่มประเภทห้องเช่าใหม่'}</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="roomtype-form">
          <div class="form-group">
            <label>ชื่อประเภทห้องเช่า *</label>
            <input type="text" id="rt-name" class="form-control" value="${typeToEdit ? typeToEdit.name : ''}" placeholder="เช่น ห้องแอร์รายวัน VIP, ห้องพัดลมมาตรฐาน" required>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>รูปแบบสัญญาเช่า *</label>
              <select id="rt-rentaltype" class="form-control" required>
                <option value="monthly" ${typeToEdit && typeToEdit.rentalType === 'monthly' ? 'selected' : ''}>📅 สัญญารายเดือน (Monthly)</option>
                <option value="daily" ${typeToEdit && typeToEdit.rentalType === 'daily' ? 'selected' : ''}>🌞 สัญญารายวัน (Daily)</option>
              </select>
            </div>
            <div class="form-group">
              <label>อัตราค่าเช่ามาตรฐาน (บาท) *</label>
              <input type="number" id="rt-rent" class="form-control" value="${typeToEdit ? typeToEdit.defaultRent : 3500}" required>
            </div>
          </div>
          <div class="form-group">
            <label>รายละเอียดคำอธิบายห้องเพิ่มเติม</label>
            <input type="text" id="rt-desc" class="form-control" value="${typeToEdit ? (typeToEdit.description || '') : ''}" placeholder="ระบุเครื่องใช้ไฟฟ้า เฟอร์นิเจอร์ สิ่งอำนวยความสะดวก...">
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top:1.25rem;">
            <i class="fa-solid fa-floppy-disk"></i> บันทึกประเภทห้องเช่า
          </button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('roomtype-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('rt-name').value.trim();
      const rentalType = document.getElementById('rt-rentaltype').value;
      const defaultRent = parseFloat(document.getElementById('rt-rent').value) || 0;
      const description = document.getElementById('rt-desc').value.trim();

      if (!this.state.roomTypes) this.state.roomTypes = [];

      if (isEdit) {
        const idx = this.state.roomTypes.findIndex(t => t.id === typeToEdit.id);
        if (idx !== -1) {
          this.state.roomTypes[idx] = { ...this.state.roomTypes[idx], name, rentalType, defaultRent, description };
        }
      } else {
        const newType = {
          id: 'rt_' + Date.now(),
          name, rentalType, defaultRent, description
        };
        this.state.roomTypes.push(newType);
      }

      DBService.saveState(this.state);
      modal.classList.remove('active');
      this.switchTab('roomtypes');
    });
  }

  static openBulkInvoicesModal() {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    const today = new Date();
    const defaultMonth = today.toISOString().slice(0, 7); // yyyy-MM
    const defaultIssue = today.toISOString().slice(0, 10);
    const defaultDue = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5).toISOString().slice(0, 10);

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-bolt text-warning"></i> ออกใบแจ้งหนี้แบบกลุ่ม (Bulk Billing)</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body" style="max-height: 80vh; overflow-y: auto;">
        <div style="background:#eff6ff; border: 1px solid #bfdbfe; color:#1e3a8a; padding:1rem; border-radius:8px; margin-bottom:1.25rem; font-size:0.9rem; line-height:1.4;">
          <i class="fa-solid fa-circle-info"></i> ระบบจะไปดึงเลขอ่านมิเตอร์น้ำและไฟล่าสุดประจำเดือนที่คุณกรอกไว้ในตารางกรอกมิเตอร์ (บันทึกลง Supabase) มาคำนวณและออกใบแจ้งหนี้ให้กับทุกห้องที่มีสถานะ "มีผู้เช่า" โดยอัตโนมัติ
        </div>
        <form id="bulk-billing-form">
          <div class="form-group">
            <label>เลือกรอบเดือนสำหรับออกบิล *</label>
            <input type="month" id="bulk-month" class="form-control" value="${defaultMonth}" required>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>วันที่ออกบิล *</label>
              <input type="date" id="bulk-issue-date" class="form-control" value="${defaultIssue}" required>
            </div>
            <div class="form-group">
              <label>วันครบกำหนดชำระ *</label>
              <input type="date" id="bulk-due-date" class="form-control" value="${defaultDue}" required>
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
            <button type="button" class="btn btn-secondary btn-close-modal">ยกเลิก</button>
            <button type="submit" class="btn btn-primary" style="background:#f97316; border:none; color:white;"><i class="fa-solid fa-bolt"></i> ดึงค่ามิเตอร์และออกบิลทันที</button>
          </div>
        </form>
      </div>
    `;

    modal.classList.add('active');

    // Bind close
    const closeModal = () => modal.classList.remove('active');
    dialog.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    dialog.querySelector('.btn-close-modal').addEventListener('click', closeModal);

    // Bind submit
    const form = document.getElementById('bulk-billing-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const monthKey = document.getElementById('bulk-month').value;
      const issueDate = document.getElementById('bulk-issue-date').value;
      const dueDate = document.getElementById('bulk-due-date').value;

      // Add a loading status spinner inside the modal
      const body = dialog.querySelector('.modal-body');
      const originalContent = body.innerHTML;
      body.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3rem 1rem;">
          <div style="width:45px; height:45px; border:4px solid #cbd5e1; border-top-color:#f97316; border-radius:50%; animation: spin 1s linear infinite; margin-bottom:1rem;"></div>
          <div style="font-weight:bold; font-size:1.1rem; color:#334155;">กำลังดึงเลขอ่านน้ำไฟล่าสุดจาก Supabase...</div>
          <div style="font-size:0.85rem; color:#64748b; margin-top:0.25rem;">ระบบกำลังดึงข้อมูลตารางกรอกมิเตอร์เพื่อประมวลผล</div>
          <style>
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </div>
      `;

      try {
        // Sync and pull the latest state with merge option from Supabase
        const savedUrl = DBService.getSavedSupabaseUrl();
        const syncUrl = savedUrl + (savedUrl.includes('?') ? '&merge=true' : '?merge=true');
        const freshState = await DBService.pullFromSupabase(syncUrl);
        
        if (freshState) {
          this.state = freshState;
        }

        const readings = this.state.tempMeterReadings || [];
        if (readings.length === 0) {
          throw new Error('ไม่พบข้อมูลมิเตอร์น้ำไฟในตารางกรอกมิเตอร์ กรุณากรอกและบันทึกข้อมูลก่อน');
        }

        const rooms = this.state.rooms || [];
        const occupiedRooms = rooms.filter(r => r.status === 'occupied' || r.status === 'overdue');
        
        if (occupiedRooms.length === 0) {
          throw new Error('ไม่มีห้องพักที่มีสถานะ "มีผู้เช่า" หรือ "ค้างชำระ" ในระบบที่จะออกบิลได้');
        }

        let successCount = 0;
        let skipCount = 0;
        let errorMessages = [];

        // ออกบิลทีละห้องผ่าน RPC เดียว (generate_room_invoice) ซึ่งรับมิเตอร์ → คำนวณ →
        // อัปเดตห้อง + สร้าง/เขียนทับบิล ในทรานแซกชันเดียวฝั่ง Postgres (กันชนกันจริงระดับ DB)
        for (const room of occupiedRooms) {
          const reading = readings.find(r => r.roomName === room.name);
          if (!reading) { skipCount++; continue; }

          if (reading.elecCurr === null || reading.waterCurr === null || reading.elecCurr === "" || reading.waterCurr === "") {
            skipCount++;
            continue;
          }

          const elecCurr = Number(reading.elecCurr);
          const waterCurr = Number(reading.waterCurr);
          if (isNaN(elecCurr) || isNaN(waterCurr)) { skipCount++; continue; }

          const fees = getRoomFees(room, this.state.rates);
          let result;
          try {
            result = await DBService.callRpc('generate_room_invoice', {
              p_room_id: room.id,
              p_month_key: monthKey,
              p_elec_curr: elecCurr,
              p_water_curr: waterCurr,
              p_issue_date: issueDate,
              p_due_date: dueDate,
              p_fine_amount: Number(reading.fineAmount || 0),
              p_force: false,
              p_internet_fee: fees.internetFee,
              p_common_fee: fees.commonFee
            });
          } catch (rpcErr) {
            errorMessages.push(`ห้อง ${room.name}: ${rpcErr.message}`);
            continue;
          }

          if (!result || result.status === 'error') {
            errorMessages.push(result && result.message ? result.message : `ห้อง ${room.name}: ออกบิลไม่สำเร็จ`);
            continue;
          }

          successCount++;
        }

        if (successCount === 0) {
          let errMsg = 'ไม่มีการออกบิลเพิ่มเติม';
          if (errorMessages.length > 0) {
            errMsg += '\n\nข้อผิดพลาดตัวเลขมิเตอร์:\n' + errorMessages.join('\n');
          }
          throw new Error(errMsg);
        }

        // ดึงข้อมูลล่าสุดจาก Supabase มาแทนที่ state ในเครื่อง (rooms/invoices ที่ RPC เพิ่งอัปเดต
        // คือค่าจริงในฐานข้อมูลแล้ว ไม่ต้องคำนวณซ้ำฝั่ง JS หรือ saveState ทับอีกรอบ)
        const refreshedState = await DBService.pullFromSupabase(syncUrl);
        if (refreshedState) {
          this.state = refreshedState;
        }
        this.state.tempMeterReadings = [];
        localStorage.setItem(DBService.STORAGE_KEY, JSON.stringify(this.state));

        modal.classList.remove('active');
        this.switchTab('billing');

        let msg = `🟢 ออกบิลแบบกลุ่มสำเร็จ!\n\nสร้างใบแจ้งหนี้เสร็จเรียบร้อยทั้งหมด ${successCount} ห้อง`;
        if (skipCount > 0) msg += `\n(ข้าม ${skipCount} ห้องที่ไม่มีข้อมูลเลขอ่าน)`;
        if (errorMessages.length > 0) msg += `\n\n⚠️ ห้องที่เกิดข้อผิดพลาดและถูกข้าม:\n` + errorMessages.join('\n');

        alert(msg);

      } catch (err) {
        body.innerHTML = originalContent; // Restore form
        alert('❌ เกิดข้อผิดพลาดในการออกบิลแบบกลุ่ม: ' + err.message);
        // Bind events again since we overwrote innerHTML
        this.openBulkInvoicesModal();
      }
    });
  }

  static openRoomModal(roomToEdit = null) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');
    const isEdit = !!roomToEdit;

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid ${isEdit ? 'fa-pen text-info' : 'fa-plus text-primary'}"></i> ${isEdit ? 'แก้ไขข้อมูลห้องพัก' : 'เพิ่มห้องพักใหม่'}</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="room-form">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>เลขห้อง / ชื่อห้อง *</label>
              <input type="text" id="rm-name" class="form-control" value="${roomToEdit ? roomToEdit.name : ''}" placeholder="A105" required>
            </div>
            <div class="form-group">
              <label>ชั้นที่ *</label>
              <input type="number" id="rm-floor" class="form-control" value="${roomToEdit ? roomToEdit.floor : 1}" required>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>ประเภทห้องพัก *</label>
              <select id="rm-type" class="form-control" required>
                ${this.state.roomTypes.map(t => `<option value="${t.id}" ${roomToEdit && roomToEdit.typeId === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>ค่าเช่ารายเดือน (บาท) *</label>
              <input type="number" id="rm-rent" class="form-control" value="${roomToEdit ? roomToEdit.baseRent : 3500}" required>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:1rem;">
            <label>สถานะห้องพัก *</label>
            <select id="rm-status" class="form-control" required>
              <option value="vacant" ${roomToEdit && roomToEdit.status === 'vacant' ? 'selected' : ''}>⚪ ห้องว่าง</option>
              <option value="occupied" ${roomToEdit && roomToEdit.status === 'occupied' ? 'selected' : ''}>🟢 มีผู้เช่า</option>
              <option value="overdue" ${roomToEdit && roomToEdit.status === 'overdue' ? 'selected' : ''}>🔴 ค้างชำระ</option>
              <option value="reserved" ${roomToEdit && roomToEdit.status === 'reserved' ? 'selected' : ''}>🟡 จองแล้ว</option>
            </select>
          </div>

          <!-- ค่าบริการเฉพาะห้อง -->
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem; margin-bottom:1rem;">
            <div style="font-weight:700; font-size:0.85rem; color:#475569; margin-bottom:0.5rem;">
              <i class="fa-solid fa-calculator"></i> ค่าบริการเพิ่มเติมเฉพาะห้อง (เจาะจงเฉพาะห้องนี้ / เว้นว่างหากใช้ราคาปกติ)
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.55rem;">
              <div class="form-group" style="margin:0;">
                <label style="font-size:0.8rem; font-weight:600; color:#334155;">🗑️ ค่าเก็บขยะ:</label>
                <input type="number" id="rm-trash-fee" class="form-control" value="${(roomToEdit && roomToEdit.trashFee !== undefined && roomToEdit.trashFee !== null) ? roomToEdit.trashFee : ''}" placeholder="ปกติ ${this.state.rates.trashFee || 20}" step="any" style="padding:0.45rem 0.65rem;">
              </div>
              <div class="form-group" style="margin:0;">
                <label style="font-size:0.8rem; font-weight:600; color:#334155;">🏢 ค่าส่วนกลาง:</label>
                <input type="number" id="rm-common-fee" class="form-control" value="${(roomToEdit && roomToEdit.commonFee !== undefined && roomToEdit.commonFee !== null) ? roomToEdit.commonFee : ''}" placeholder="ปกติ ${this.state.rates.commonFee || 0}" step="any" style="padding:0.45rem 0.65rem;">
              </div>
              <div class="form-group" style="margin:0;">
                <label style="font-size:0.8rem; font-weight:600; color:#334155;">🌐 ค่าเน็ต:</label>
                <input type="number" id="rm-internet-fee" class="form-control" value="${(roomToEdit && roomToEdit.internetFee !== undefined && roomToEdit.internetFee !== null) ? roomToEdit.internetFee : ''}" placeholder="ปกติ ${this.state.rates.internetFee || 0}" step="any" style="padding:0.45rem 0.65rem;">
              </div>
            </div>
          </div>

          <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:0.85rem; margin-bottom:1rem;">
            <div style="font-weight:700; font-size:0.85rem; color:#0369a1; margin-bottom:0.5rem;">
              <i class="fa-solid fa-gauge"></i> เลขมิเตอร์ตั้งต้น / ครั้งก่อน (สำหรับเริ่มใช้ระบบ)
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
              <div class="form-group" style="margin:0;">
                <label style="font-size:0.8rem; font-weight:600; color:#334155;">⚡ มิเตอร์ไฟตั้งต้น:</label>
                <input type="number" id="rm-elec-meter" class="form-control" value="${roomToEdit ? (roomToEdit.lastElecMeter || 0) : 0}" placeholder="0" step="any" style="padding:0.45rem 0.65rem;">
              </div>
              <div class="form-group" style="margin:0;">
                <label style="font-size:0.8rem; font-weight:600; color:#334155;">💧 มิเตอร์น้ำตั้งต้น:</label>
                <input type="number" id="rm-water-meter" class="form-control" value="${roomToEdit ? (roomToEdit.lastWaterMeter || 0) : 0}" placeholder="0" step="any" style="padding:0.45rem 0.65rem;">
              </div>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-full">
            <i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูลห้องพัก
          </button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('room-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('rm-name').value.trim();
      const floor = parseInt(document.getElementById('rm-floor').value, 10) || 1;
      const typeId = document.getElementById('rm-type').value;
      const baseRent = document.getElementById('rm-rent').value !== "" ? parseFloat(document.getElementById('rm-rent').value) : 3500;
      const status = document.getElementById('rm-status').value;

      const lastElecMeter = parseFloat(document.getElementById('rm-elec-meter').value) || 0;
      const lastWaterMeter = parseFloat(document.getElementById('rm-water-meter').value) || 0;

      const trashFeeVal = document.getElementById('rm-trash-fee').value;
      const commonFeeVal = document.getElementById('rm-common-fee').value;
      const internetFeeVal = document.getElementById('rm-internet-fee').value;

      const trashFee = trashFeeVal !== "" ? parseFloat(trashFeeVal) : null;
      const commonFee = commonFeeVal !== "" ? parseFloat(commonFeeVal) : null;
      const internetFee = internetFeeVal !== "" ? parseFloat(internetFeeVal) : null;

      if (isEdit) {
        roomToEdit.name = name;
        roomToEdit.floor = floor;
        roomToEdit.typeId = typeId;
        roomToEdit.baseRent = baseRent;
        roomToEdit.status = status;
        roomToEdit.lastElecMeter = lastElecMeter;
        roomToEdit.lastWaterMeter = lastWaterMeter;
        roomToEdit.trashFee = trashFee;
        roomToEdit.commonFee = commonFee;
        roomToEdit.internetFee = internetFee;
      } else {
        const newRoom = {
          id: 'r_' + Date.now(),
          name, floor, typeId, baseRent, status,
          lastWaterMeter, lastElecMeter,
          trashFee, commonFee, internetFee
        };
        this.state.rooms.push(newRoom);
      }

      DBService.saveState(this.state);
      modal.classList.remove('active');
      this.switchTab('rooms');
    });
  }

  // --- 2. TENANTS EVENTS ---
  static bindTenantsEvents() {
    // 1. Dashboard Sub-tab Card Clicks
    document.querySelectorAll('.btn-select-tenant-subtab').forEach(card => {
      card.addEventListener('click', (e) => {
        const subtab = e.currentTarget.getAttribute('data-subtab');
        TenantsComponent.activeSection = subtab;
        this.switchTab('tenants');
      });
    });

    // 2. Back Button to Dashboard Click
    const btnBack = document.getElementById('btn-back-to-tenants-dashboard');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        TenantsComponent.activeSection = 'home';
        this.switchTab('tenants');
      });
    }

    const exportExcel = document.getElementById('btn-export-tenants-excel');
    if (exportExcel) {
      exportExcel.addEventListener('click', () => {
        const headers = ['ชื่อ-นามสกุล', 'เลขบัตรประชาชน', 'เบอร์โทร', 'วันเริ่มสัญญา', 'วันหมดสัญญา'];
        const rows = this.state.tenants.map(t => [t.name, t.idCard, t.tel, t.startDate, t.endDate]);
        ExportService.exportToCSV('ทะเบียนผู้เช่า_Sombat.csv', headers, rows);
      });
    }

    const addBtn = document.getElementById('btn-add-tenant');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openTenantModal());
    }

    document.querySelectorAll('.btn-edit-tenant').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tenantId = e.currentTarget.getAttribute('data-id');
        const tenant = this.state.tenants.find(t => t.id === tenantId);
        if (tenant) this.openTenantModal(tenant);
      });
    });

    document.querySelectorAll('.btn-delete-tenant').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tenantId = e.currentTarget.getAttribute('data-id');
        const tenantName = e.currentTarget.getAttribute('data-name');
        this.openDeleteTenantModal(tenantId, tenantName);
      });
    });

    document.querySelectorAll('.btn-gen-contract').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const tenant = this.state.tenants.find(t => t.id === id);
        if (tenant) this.openOfficialContractModal(tenant);
      });
    });

    document.querySelectorAll('.btn-view-docs').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const tenant = this.state.tenants.find(t => t.id === id);
        if (tenant) this.openViewTenantDocsModal(tenant);
      });
    });

    document.querySelectorAll('.btn-reuse-tenant').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const tenant = this.state.tenants.find(t => t.id === id);
        if (tenant) this.openCreateNewContractModal(tenant);
      });
    });

    document.querySelectorAll('.btn-delete-tenant-permanently').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tenantId = e.currentTarget.getAttribute('data-id');
        const tenantName = e.currentTarget.getAttribute('data-name');
        const tenant = this.state.tenants.find(t => t.id === tenantId);
        const docCount = (tenant?.documents || []).filter(d => d.dataUrl && d.dataUrl.startsWith('http')).length;
        const docNote = docCount > 0 ? `\n\nรูปภาพ/เอกสารแนบจำนวน ${docCount} ไฟล์จะถูกลบออกจาก Supabase Storage ด้วย` : '';
        if (confirm(`⚠️ ยืนยันการลบข้อมูลผู้เช่า "${tenantName}" ออกจากระบบอย่างถาวรใช่หรือไม่? (การดำเนินการนี้จะไม่สามารถกู้คืนได้)${docNote}`)) {
          this.deleteTenant(tenantId, { resetMeters: false, deleteInvoices: false });
        }
      });
    });
  }

  // (bucket: tenant-documents ต้องสร้างไว้ล่วงหน้าใน Supabase Dashboard → Storage และตั้งเป็น public)
  static async readFileAsDataUrl(file, tenantId = 'temp') {
    if (!file) return null;
    const publicUrl = await DBService.uploadFileToStorage(file, `tenant/${tenantId}`);
    return {
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      dataUrl: publicUrl,
      uploadDate: new Date().toISOString().slice(0, 10)
    };
  }

  static openTenantModal(tenantToEdit = null) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');
    const isEdit = !!tenantToEdit;

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid ${isEdit ? 'fa-user-pen text-info' : 'fa-user-plus text-primary'}"></i> ${isEdit ? 'แก้ไขข้อมูลผู้เช่า' : 'เพิ่มผู้เช่าใหม่เข้าพัก'}</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="tenant-form">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>ชื่อ - นามสกุล</label>
              <input type="text" id="tn-name" class="form-control" value="${tenantToEdit ? tenantToEdit.name : ''}" placeholder="น.ส.กันญา บัวแดง">
            </div>
            <div class="form-group">
              <label>เลขบัตรประชาชน (13 หลัก)</label>
              <input type="text" id="tn-idcard" class="form-control" value="${tenantToEdit ? tenantToEdit.idCard : ''}" placeholder="3451200115491">
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>เบอร์โทรศัพท์</label>
              <input type="text" id="tn-tel" class="form-control" value="${tenantToEdit ? tenantToEdit.tel : ''}" placeholder="081-2345678">
            </div>
            <div class="form-group">
              <label>Line ID (ถ้ามี):</label>
              <input type="text" id="tn-line" class="form-control" value="${tenantToEdit ? (tenantToEdit.lineId || '') : ''}" placeholder="kanya_b">
            </div>
            <div class="form-group">
              <label>อีเมล (ถ้ามี):</label>
              <input type="email" id="tn-email" class="form-control" value="${tenantToEdit ? (tenantToEdit.email || '') : ''}" placeholder="kanya@gmail.com">
            </div>
          </div>

          <div class="form-group">
            <label>ที่อยู่ตามภูมิลำเนาผู้เช่า:</label>
            <input type="text" id="tn-address" class="form-control" value="${tenantToEdit ? (tenantToEdit.address || '') : ''}" placeholder="12/4 หมู่ 3 ต.บางบัวทอง อ.บางบัวทอง จ.นนทบุรี">
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>จัดเข้าห้องพัก</label>
              <select id="tn-room-select" class="form-control">
                <option value="">-- เลือกห้องพัก --</option>
                ${this.state.rooms.map(r => `
                  <option value="${r.id}" ${tenantToEdit && tenantToEdit.assignedRoomId === r.id ? 'selected' : ''}>
                    ห้อง ${r.name}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>วันเริ่มสัญญา (วัน/เดือน/ปี พ.ศ.)</label>
              <input type="text" id="tn-start-date" class="form-control" value="${tenantToEdit && tenantToEdit.startDate ? Formatters.thaiDate(tenantToEdit.startDate) : Formatters.thaiDate(new Date().toISOString().slice(0,10))}" placeholder="01/05/2568">
            </div>
            <div class="form-group">
              <label>วันหมดสัญญา (วัน/เดือน/ปี พ.ศ.)</label>
              <input type="text" id="tn-end-date" class="form-control" value="${tenantToEdit && tenantToEdit.endDate ? Formatters.thaiDate(tenantToEdit.endDate) : '31/07/2570'}" placeholder="31/07/2570">
            </div>
          </div>

          <div class="form-group">
            <label>เงินประกันมัดจำ (บาท)</label>
            <input type="number" id="tn-deposit" class="form-control" value="${tenantToEdit ? (tenantToEdit.depositAmount !== undefined && tenantToEdit.depositAmount !== null ? tenantToEdit.depositAmount : (tenantToEdit.deposit ? tenantToEdit.deposit.initialBail : 0)) : 7000}" placeholder="7000">
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:var(--radius-md); padding:1rem; margin-top:1rem;">
            <h4 style="font-size:0.85rem; margin-bottom:0.75rem; color:var(--primary);"><i class="fa-solid fa-paperclip"></i> แนบไฟล์เอกสารผู้เช่า (รองรับทุกไฟล์: รูปถ่าย/PDF/DOCX/ZIP)</h4>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
              <div class="form-group">
                <label><i class="fa-solid fa-id-card text-success"></i> สำเนาบัตรประชาชน:</label>
                <input type="file" id="tn-file-idcard" class="form-control" accept="image/*,.pdf">
              </div>
              <div class="form-group">
                <label><i class="fa-solid fa-house-user text-warning"></i> สำเนาทะเบียนบ้าน:</label>
                <input type="file" id="tn-file-house" class="form-control" accept="image/*,.pdf">
              </div>
            </div>

            <div class="form-group">
              <label><i class="fa-solid fa-folder-plus text-info"></i> เอกสารประกอบอื่นๆ:</label>
              <input type="file" id="tn-file-other" class="form-control" accept="*/*" multiple>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-full" style="margin-top:1.25rem;" id="btn-submit-tenant">
            <i class="fa-solid fa-floppy-disk"></i> ${isEdit ? 'บันทึกการแก้ไขข้อมูลผู้เช่า' : 'บันทึกเพิ่มผู้เช่าใหม่เข้าระบบ'}
          </button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('tenant-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-tenant');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกข้อมูล...';

      let name = document.getElementById('tn-name').value.trim();
      let idCard = document.getElementById('tn-idcard').value.trim();
      let tel = document.getElementById('tn-tel').value.trim();
      const lineId = document.getElementById('tn-line').value.trim();
      const email = document.getElementById('tn-email').value.trim();
      const address = document.getElementById('tn-address').value.trim();
      const roomId = document.getElementById('tn-room-select').value;
      const startDateInput = document.getElementById('tn-start-date').value.trim();
      const endDateInput = document.getElementById('tn-end-date').value.trim();
      const startDate = Formatters.parseThaiDateToISO(startDateInput);
      const endDate = Formatters.parseThaiDateToISO(endDateInput);
      const rawBail = document.getElementById('tn-deposit').value.trim();
      const bail = rawBail !== '' ? parseFloat(rawBail) : 0;

      if (!name) name = 'ผู้เช่า (ยังไม่ระบุชื่อ)';
      if (!idCard) idCard = '-';
      if (!tel) tel = '-';

      const fileIdCard = document.getElementById('tn-file-idcard').files[0];
      const fileHouse = document.getElementById('tn-file-house').files[0];
      const otherFiles = Array.from(document.getElementById('tn-file-other').files);

            const tenantId = isEdit ? tenantToEdit.id : 't_' + Date.now();
      const newDocs = tenantToEdit && tenantToEdit.documents ? [...tenantToEdit.documents] : [];

      try {
        if (fileIdCard || fileHouse || otherFiles.length) {
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> \u0e01\u0e33\u0e25\u0e31\u0e07\u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14\u0e44\u0e1f\u0e25\u0e4c\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23\u0e02\u0e36\u0e49\u0e19 Supabase Storage...';
        }
        if (fileIdCard) {
          const doc = await App.readFileAsDataUrl(fileIdCard, tenantId);
          if (doc) { doc.category = 'idcard'; doc.title = '\u0e2a\u0e33\u0e40\u0e19\u0e32\u0e1a\u0e31\u0e15\u0e23\u0e15\u0e23\u0e30\u0e0a\u0e32\u0e0a\u0e19'; newDocs.push(doc); }
        }
        if (fileHouse) {
          const doc = await App.readFileAsDataUrl(fileHouse, tenantId);
          if (doc) { doc.category = 'house'; doc.title = '\u0e2a\u0e33\u0e40\u0e19\u0e32\u0e17\u0e30\u0e40\u0e1a\u0e35\u0e22\u0e19\u0e1a\u0e4c\u0e32\u0e19'; newDocs.push(doc); }
        }
        for (const f of otherFiles) {
          const doc = await App.readFileAsDataUrl(f, tenantId);
          if (doc) { doc.category = 'other'; doc.title = doc.fileName; newDocs.push(doc); }
        }
      } catch (err) {
        alert(`❌ อัปโหลดไฟล์เอกสารไม่สำเร็จ: ${err.message}\n\nข้อมูลผู้เช่ายังไม่ถูกบันทึก กรุณาลองใหม่อีกครั้ง (ตรวจสอบว่าสร้าง Storage bucket ชื่อ "tenant-documents" และตั้งเป็น public แล้ว)`);
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> ${isEdit ? 'บันทึกการแก้ไขข้อมูลผู้เช่า' : 'บันทึกเพิ่มผู้เช่าใหม่เข้าระบบ'}`;
        return;
      }

      if (isEdit) {
        tenantToEdit.name = name;
        tenantToEdit.idCard = idCard;
        tenantToEdit.tel = tel;
        tenantToEdit.lineId = lineId;
        tenantToEdit.email = email;
        tenantToEdit.address = address;
        tenantToEdit.assignedRoomId = roomId;
        tenantToEdit.startDate = startDate;
        tenantToEdit.endDate = endDate;
        tenantToEdit.documents = newDocs;
        tenantToEdit.depositAmount = bail;
        tenantToEdit.depositStatus = tenantToEdit.depositStatus || 'active';
        if (!tenantToEdit.deposit) tenantToEdit.deposit = { deductions: [], status: 'active' };
        tenantToEdit.deposit.initialBail = bail;
      } else {
        const newTenant = {
          id: 't_' + Date.now(),
          name, idCard, tel, lineId, email, address,
          startDate, endDate, assignedRoomId: roomId,
          depositAmount: bail,
          depositStatus: 'active',
          deposit: { initialBail: bail, deductions: [], status: 'active' },
          documents: newDocs
        };
        this.state.tenants.push(newTenant);
      }

      const room = this.state.rooms.find(r => r.id === roomId);
      if (room) {
        room.status = 'occupied';
        room.currentTenantId = isEdit ? tenantToEdit.id : this.state.tenants[this.state.tenants.length - 1].id;
        room.currentTenantName = name;
        room.entryDate = startDate;
      }

      DBService.saveState(this.state);
      modal.classList.remove('active');
      this.switchTab('tenants');
    });
  }

  static openViewTenantDocsModal(tenant) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');
    const docs = tenant.documents || [];

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-folder-open text-primary"></i> เอกสารแนบผู้เช่า: ${tenant.name}</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        ${docs.length === 0 ? `
          <p class="text-center text-muted" style="padding:2rem;">ยังไม่มีเอกสารแนบสำหรับผู้เช่ารายนี้ คุณสามารถกด "แก้ไข" เพื่อเพิ่มสำเนาบัตรประชาชน หรือสำเนาทะเบียนบ้านได้ครับ</p>
        ` : `
          <div style="display:flex; flex-direction:column; gap:1rem;">
            ${docs.map(doc => `
              <div style="display:flex; align-items:center; justify-content:space-between; padding:0.85rem; border:1px solid #e2e8f0; border-radius:var(--radius-md); background:#f8fafc;">
                <div style="display:flex; align-items:center; gap:0.75rem;">
                  <i class="fa-solid ${doc.category === 'idcard' ? 'fa-id-card text-success' : doc.category === 'house' ? 'fa-house-user text-warning' : 'fa-file text-primary'}" style="font-size:1.4rem;"></i>
                  <div>
                    <strong>${doc.title || doc.fileName}</strong>
                    <div class="text-muted text-sm">${doc.fileName} (${doc.uploadDate || '-'})</div>
                  </div>
                </div>
                <div>
                  ${doc.dataUrl ? `
                    <a href="${doc.dataUrl}" download="${doc.fileName}" class="btn btn-secondary btn-xs"><i class="fa-solid fa-download"></i> ดาวน์โหลด</a>
                    <a href="${doc.dataUrl}" target="_blank" class="btn btn-primary btn-xs"><i class="fa-solid fa-eye"></i> ดูไฟล์เต็ม</a>
                  ` : `<span class="text-muted text-sm">ไม่มีตัวอย่างไฟล์</span>`}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));
  }

  static openDeleteTenantModal(tenantId, tenantName) {
    const tenant = this.state.tenants.find(t => t.id === tenantId);
    const room = tenant ? this.state.rooms.find(r => r.id === tenant.assignedRoomId) : null;
    const relatedInvoiceCount = room ? this.state.invoices.filter(i => i.roomId === room.id).length : 0;

    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');
    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-circle-question text-warning"></i> จัดการสถานะผู้เช่า</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <p>คุณต้องการดำเนินการอย่างไรกับข้อมูลผู้เช่า <strong>"${tenantName}"</strong>?</p>
        
        <div style="display:flex; flex-direction:column; gap:0.75rem; margin-top:1.25rem;">
          <button id="btn-move-to-history" class="btn btn-warning" style="padding:0.75rem; font-weight:700; text-align:left; display:flex; align-items:center; gap:0.5rem; justify-content:center;">
            <i class="fa-solid fa-user-slash"></i> ย้ายไปประวัติผู้เช่าเก่า (แนะนำ)
          </button>
          <p class="text-muted" style="font-size:0.8rem; margin:0 0 0.5rem 0; line-height:1.4;">
            ย้ายข้อมูลผู้เช่านี้ไปเก็บไว้ที่แท็บ "ประวัติผู้เช่าเก่า" เพื่อเก็บประวัติและสามารถดึงข้อมูลกลับมาทำสัญญาเช่าใหม่ได้ในอนาคต โดยห้องพักเดิมจะเปลี่ยนสถานะเป็น "ว่าง"
          </p>

          <button id="btn-delete-permanently" class="btn btn-danger" style="padding:0.75rem; font-weight:700; text-align:left; display:flex; align-items:center; gap:0.5rem; justify-content:center;">
            <i class="fa-solid fa-trash"></i> ลบข้อมูลออกจากระบบอย่างถาวร
          </button>
          <p class="text-muted" style="font-size:0.8rem; margin:0 0 1rem 0; line-height:1.4;">
            ลบข้อมูลผู้เช่าและประวัติเอกสารแนบทั้งหมดออกจากฐานข้อมูลทันที ไม่สามารถกู้คืนได้
          </p>
        </div>

        ${room ? `
          <div style="background:#fef3c7; border:1px solid #f59e0b; border-radius:8px; padding:1rem; margin-top:0.5rem; margin-bottom:1rem;">
            <label style="display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer; margin-bottom:0.75rem;">
              <input type="checkbox" id="chk-reset-meters" checked style="margin-top:0.2rem;">
              <span>
                <strong>เคลียร์เลขมิเตอร์น้ำ-ไฟของห้อง ${room.name} เป็น 0</strong><br>
                <span class="text-muted style-sm" style="font-size:0.75rem;">(แนะนำให้ติ๊ก หากผู้เช่าคนนี้เป็นผู้เช่าทดสอบ)</span>
              </span>
            </label>
            ${relatedInvoiceCount > 0 ? `
              <label style="display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer;">
                <input type="checkbox" id="chk-delete-invoices" style="margin-top:0.2rem;">
                <span>
                  <strong>ลบบิล/ใบแจ้งหนี้ทั้งหมดของห้อง ${room.name} ด้วย (${relatedInvoiceCount} ใบ)</strong>
                </span>
              </label>
            ` : ''}
          </div>
        ` : ''}

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem; border-top:1px solid var(--border-color); padding-top:1rem;">
          <button class="btn btn-secondary close-modal-btn">ยกเลิก</button>
        </div>
      </div>
    `;
    modal.classList.add('active');
    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.classList.remove('active')));

    document.getElementById('btn-move-to-history').addEventListener('click', () => {
      const resetMeters = room ? document.getElementById('chk-reset-meters').checked : false;
      const deleteInvoicesChk = document.getElementById('chk-delete-invoices');
      const deleteInvoices = deleteInvoicesChk ? deleteInvoicesChk.checked : false;
      modal.classList.remove('active');
      this.moveToHistory(tenantId, { resetMeters, deleteInvoices });
    });

    document.getElementById('btn-delete-permanently').addEventListener('click', () => {
      const resetMeters = room ? document.getElementById('chk-reset-meters').checked : false;
      const deleteInvoicesChk = document.getElementById('chk-delete-invoices');
      const deleteInvoices = deleteInvoicesChk ? deleteInvoicesChk.checked : false;
      if (confirm(`⚠️ ยืนยันการลบข้อมูลผู้เช่า "${tenantName}" ออกจากระบบอย่างถาวรใช่หรือไม่? (การดำเนินการนี้จะไม่สามารถกู้คืนได้)`)) {
        modal.classList.remove('active');
        this.deleteTenant(tenantId, { resetMeters, deleteInvoices });
      }
    });
  }

  static moveToHistory(tenantId, options = {}) {
    const { resetMeters = false, deleteInvoices = false } = options;
    const tenant = this.state.tenants.find(t => t.id === tenantId);
    if (tenant) {
      const assignedRoomId = tenant.assignedRoomId;
      const room = this.state.rooms.find(r => r.id === assignedRoomId);
      if (room) {
        tenant.lastAssignedRoomName = room.name;
        room.status = 'vacant';
        room.currentTenantId = null;
        room.currentTenantName = null;
        if (resetMeters) {
          room.lastElecMeter = 0;
          room.lastWaterMeter = 0;
        }
        if (deleteInvoices) {
          this.state.invoices = this.state.invoices.filter(i => i.roomId !== room.id);
        }
      }
      tenant.assignedRoomId = null;
      tenant.status = 'inactive';
      DBService.saveState(this.state);
      this.switchTab('tenants');
    }
  }

  static async deleteTenant(tenantId, options = {}) {
    const { resetMeters = false, deleteInvoices = false } = options;
    const idx = this.state.tenants.findIndex(t => t.id === tenantId);
    if (idx !== -1) {
      const tenant = this.state.tenants[idx];

      // Collect all document URLs from Supabase Storage to delete
      const docUrls = (tenant.documents || [])
        .map(d => d.dataUrl)
        .filter(u => u && typeof u === 'string' && u.startsWith('http'));

      const assignedRoomId = tenant.assignedRoomId;
      const room = this.state.rooms.find(r => r.id === assignedRoomId);
      if (room) {
        room.status = 'vacant';
        room.currentTenantId = null;
        room.currentTenantName = null;
        if (resetMeters) {
          room.lastElecMeter = 0;
          room.lastWaterMeter = 0;
        }
        if (deleteInvoices) {
          this.state.invoices = this.state.invoices.filter(i => i.roomId !== room.id);
        }
      }
      this.state.tenants.splice(idx, 1);
      await DBService.saveState(this.state);

      // Delete files from Supabase Storage (non-blocking, fire-and-forget with notification)
      if (docUrls.length > 0) {
        DBService.deleteFilesFromStorage(docUrls).then(() => {
          console.log(`🗑️ ลบไฟล์เอกสาร ${docUrls.length} ไฟล์จาก Supabase Storage เรียบร้อย`);
        }).catch(err => {
          console.warn('⚠️ ไม่สามารถลบบางไฟล์จาก Storage ได้:', err);
        });
      }

      this.switchTab('tenants');
    }
  }

    // --- 2.5 METER ENTRY GRID EVENTS ---
  static bindMeterEntryEvents() {
    const rawInvoices = this.state.invoices || [];
    const rooms = [...this.state.rooms].sort(DBService.compareRooms);

    const getRoomPrevMeters = (room) => {
      if (!room) return { elecPrev: 0, waterPrev: 0 };
      let elecPrev = room.lastElecMeter;
      let waterPrev = room.lastWaterMeter;
      if (elecPrev === undefined || waterPrev === undefined || elecPrev === null || waterPrev === null) {
        const roomInvoices = rawInvoices
          .filter(i => i.roomId === room.id)
          .sort((a, b) => (b.monthKey || '').localeCompare(a.monthKey || ''));
        if (roomInvoices.length > 0) {
          elecPrev = roomInvoices[0].elecCurr ?? 0;
          waterPrev = roomInvoices[0].waterCurr ?? 0;
        } else {
          elecPrev = 0;
          waterPrev = 0;
        }
      }
      return { elecPrev, waterPrev };
    };

    const prevReadings = {};
    rooms.forEach(r => {
      prevReadings[r.id] = getRoomPrevMeters(r);
    });

    const getNextMonth05 = (monthStr) => {
      if (!monthStr) return "";
      const [year, month] = monthStr.split('-').map(Number);
      let nextMonth = month + 1;
      let nextYear = year;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
      }
      const nextMonthFormatted = String(nextMonth).padStart(2, '0');
      return `${nextYear}-${nextMonthFormatted}-05`;
    };

    const undoStack = [];
    const editHistory = [];
    let autoSaveTimeout = null;

    const calculateRowTotal = (roomId, elecCurr, waterCurr, fineAmount) => {
      const room = this.state.rooms.find(r => r.id === roomId);
      if (!room) return 0;
      const prev = prevReadings[roomId];
      const elecPrev = prev.elecPrev;
      const waterPrev = prev.waterPrev;
      
      const elecUnits = Math.max(0, (parseFloat(elecCurr) || 0) - elecPrev);
      const waterUnits = Math.max(0, (parseFloat(waterCurr) || 0) - waterPrev);
      const elecAmt = elecUnits * (this.state.rates.electricityRate || 8);
      const waterAmt = waterUnits * (this.state.rates.waterRate || 20);
      const rentAmt = DBService.getRoomRent(room);
      const fees = getRoomFees(room, this.state.rates);
      const trashFee = fees.trashFee;
      const internetFee = fees.internetFee;
      const commonFee = fees.commonFee;
      const fineAmt = parseFloat(fineAmount) || 0;
      return rentAmt + elecAmt + waterAmt + trashFee + internetFee + commonFee + fineAmt;
    };

    const gridBody = document.getElementById('excel-grid-body');
    const monthInput = document.getElementById('excel-bill-month');
    const dueDateInput = document.getElementById('excel-due-date');
    const undoBtn = document.getElementById('btn-excel-undo');
    const historyLog = document.getElementById('excel-history-log');
    const indicator = document.getElementById('excel-sync-indicator');

    if (monthInput && dueDateInput) {
      monthInput.addEventListener('change', (e) => {
        dueDateInput.value = getNextMonth05(e.target.value);
        saveTempReadingsToState();
      });
      dueDateInput.addEventListener('change', () => {
        saveTempReadingsToState();
      });
    }

    const initMetersBtn = document.getElementById('btn-open-init-meters-modal');
    if (initMetersBtn) {
      initMetersBtn.addEventListener('click', () => {
        const modal = document.getElementById('app-modal');
        const dialog = modal.querySelector('.modal-dialog');
        dialog.innerHTML = `
          <div class="modal-header">
            <h3><i class="fa-solid fa-sliders text-warning"></i> ตั้งค่าเลขมิเตอร์น้ำ-ไฟครั้งก่อน / ยกมา (ก่อนเริ่มใช้ระบบ)</h3>
            <button class="close-modal-btn">&times;</button>
          </div>
          <div class="modal-body" style="max-height:75vh; overflow-y:auto; padding:1.25rem;">
            <p class="text-muted" style="font-size:0.85rem; margin-bottom:1rem;">
              ระบุเลขมิเตอร์ไฟและน้ำยกมาล่าสุดสำหรับแต่ละห้องพัก เพื่อให้ระบบนำไปคำนวณค่าน้ำ-ไฟงวดแรกได้อย่างถูกต้อง
            </p>
            <form id="form-batch-init-meters">
              <div style="display:flex; flex-direction:column; gap:0.65rem;">
                ${rooms.map(r => `
                  <div style="display:grid; grid-template-columns: 100px 1fr 1fr; gap:0.75rem; align-items:center; background:#f8fafc; padding:0.6rem 0.85rem; border-radius:8px; border:1px solid #e2e8f0;">
                    <div style="font-weight:700; color:#1e293b;">ห้อง ${r.name}</div>
                    <div>
                      <label style="font-size:0.75rem; color:#64748b; font-weight:600; display:block;">⚡ ไฟยกมา:</label>
                      <input type="number" class="form-control init-elec-input" data-room-id="${r.id}" value="${r.lastElecMeter || 0}" step="any" style="padding:0.35rem 0.6rem; font-size:0.85rem;">
                    </div>
                    <div>
                      <label style="font-size:0.75rem; color:#64748b; font-weight:600; display:block;">💧 น้ำยกมา:</label>
                      <input type="number" class="form-control init-water-input" data-room-id="${r.id}" value="${r.lastWaterMeter || 0}" step="any" style="padding:0.35rem 0.6rem; font-size:0.85rem;">
                    </div>
                  </div>
                `).join('')}
              </div>
              <div style="display:flex; gap:0.75rem; margin-top:1.25rem;">
                <button type="submit" class="btn btn-primary btn-full" style="font-weight:700;"><i class="fa-solid fa-save"></i> บันทึกเลขมิเตอร์ยกมา</button>
                <button type="button" class="btn btn-secondary close-modal-btn">ยกเลิก</button>
              </div>
            </form>
          </div>
        `;
        modal.classList.add('active');
        modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.classList.remove('active')));

        dialog.querySelector('#form-batch-init-meters').addEventListener('submit', (e) => {
          e.preventDefault();
          dialog.querySelectorAll('.init-elec-input').forEach(inp => {
            const rid = inp.getAttribute('data-room-id');
            const room = this.state.rooms.find(r => r.id === rid);
            if (room) room.lastElecMeter = parseFloat(inp.value) || 0;
          });
          dialog.querySelectorAll('.init-water-input').forEach(inp => {
            const rid = inp.getAttribute('data-room-id');
            const room = this.state.rooms.find(r => r.id === rid);
            if (room) room.lastWaterMeter = parseFloat(inp.value) || 0;
          });

          DBService.saveState(this.state);
          modal.classList.remove('active');
          this.switchTab('meter-entry');
        });
      });
    }

    const pushUndo = (roomId, col, oldVal, newVal) => {
      undoStack.push({ roomId, col, oldVal, newVal });
      if (undoBtn) undoBtn.disabled = false;
    };

    const addHistory = (logText) => {
      editHistory.unshift(`[${new Date().toLocaleTimeString()}] ${logText}`);
      if (historyLog) historyLog.innerHTML = editHistory.map(h => `<div>${h}</div>`).join('');
    };

    const updateRowLive = (tr) => {
      const roomId = tr.getAttribute('data-room-id');
      const prev = prevReadings[roomId];
      
      const elecInput = tr.querySelector('.elec-input');
      const waterInput = tr.querySelector('.water-input');
      const fineInput = tr.querySelector('.fine-input');

      const elecCurr = elecInput.value;
      const waterCurr = waterInput.value;
      const fineVal = fineInput.value;

      if (elecCurr !== '' && parseFloat(elecCurr) < prev.elecPrev) {
        elecInput.classList.add('excel-input-error');
      } else {
        elecInput.classList.remove('excel-input-error');
      }

      if (waterCurr !== '' && parseFloat(waterCurr) < prev.waterPrev) {
        waterInput.classList.add('excel-input-error');
      } else {
        waterInput.classList.remove('excel-input-error');
      }

      const elecUsageCell = tr.querySelector('.elec-usage-cell');
      const waterUsageCell = tr.querySelector('.water-usage-cell');
      const totalCell = tr.querySelector('.total-cell');

      const elecUnits = elecCurr === '' ? 0 : Math.max(0, parseFloat(elecCurr) - prev.elecPrev);
      const waterUnits = waterCurr === '' ? 0 : Math.max(0, parseFloat(waterCurr) - prev.waterPrev);

      elecUsageCell.textContent = elecCurr === '' ? '-' : elecUnits;
      waterUsageCell.textContent = waterCurr === '' ? '-' : waterUnits;

      const total = calculateRowTotal(roomId, elecCurr, waterCurr, fineVal);
      totalCell.textContent = `฿${total.toLocaleString()}`;
    };

    const updateTempReadingsInMemory = () => {
      if (!gridBody) return;
      const trs = gridBody.querySelectorAll('tr');
      trs.forEach(tr => {
        const roomId = tr.getAttribute('data-room-id');
        const room = this.state.rooms.find(r => r.id === roomId);
        if (room) {
          const elecCurr = tr.querySelector('.elec-input').value;
          const waterCurr = tr.querySelector('.water-input').value;
          const fineAmount = tr.querySelector('.fine-input').value;
          
          room.tempElecMeter = elecCurr === '' ? null : parseFloat(elecCurr);
          room.tempWaterMeter = waterCurr === '' ? null : parseFloat(waterCurr);
          room.tempFineAmount = fineAmount === '' ? 0 : parseFloat(fineAmount);
        }
      });
    };

    const debounceSaveState = () => {
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        DBService.saveState(this.state, true).then(() => {
          if (indicator) {
            indicator.style.display = 'inline-block';
            setTimeout(() => {
              indicator.style.display = 'none';
            }, 2000);
          }
        });
      }, 1500);
    };

    const saveTempReadingsToState = () => {
      updateTempReadingsInMemory();
      debounceSaveState();
    };

    if (gridBody) {
      gridBody.addEventListener('focusin', (e) => {
        if (e.target.classList.contains('excel-input')) {
          e.target.select();
        }
      });

      gridBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('excel-input')) {
          const input = e.target;
          const tr = input.closest('tr');
          const roomId = tr.getAttribute('data-room-id');
          const roomName = tr.querySelector('td').textContent;
          const col = input.getAttribute('data-col');
          const newVal = input.value;
          
          const room = this.state.rooms.find(r => r.id === roomId);
          const oldVal = room ? (col === 'elec' ? room.tempElecMeter : (col === 'water' ? room.tempWaterMeter : room.tempFineAmount)) : null;
          
          pushUndo(roomId, col, oldVal, newVal);
          
          const colLabel = col === 'elec' ? 'เลขไฟ' : (col === 'water' ? 'เลขน้ำ' : 'ค่าปรับ');
          addHistory(`แก้ไข ${roomName} (${colLabel}) จาก [${oldVal ?? 'ว่าง'}] เป็น [${newVal}]`);
          
          saveTempReadingsToState();
        }
      });

      gridBody.addEventListener('input', (e) => {
        if (e.target.classList.contains('excel-input')) {
          updateRowLive(e.target.closest('tr'));
          updateTempReadingsInMemory();
          debounceSaveState();
        }
      });

      gridBody.addEventListener('wheel', (e) => {
        if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
          e.preventDefault();
        }
      }, { passive: false });

      gridBody.addEventListener('keydown', (e) => {
        if (!e.target.classList.contains('excel-input')) return;
        
        const input = e.target;
        const col = input.getAttribute('data-col');
        const tr = input.closest('tr');
        const index = parseInt(tr.getAttribute('data-index'));
        const colClass = col === 'elec' ? '.elec-input' : (col === 'water' ? '.water-input' : '.fine-input');

        let targetTr = null;
        let targetInput = null;

        if (e.key === 'Enter' || e.key === 'ArrowDown') {
          e.preventDefault();
          targetTr = gridBody.querySelector(`tr[data-index="${index + 1}"]`);
          if (targetTr) targetInput = targetTr.querySelector(colClass);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          targetTr = gridBody.querySelector(`tr[data-index="${index - 1}"]`);
          if (targetTr) targetInput = targetTr.querySelector(colClass);
        } else if (e.key === 'ArrowRight' && input.selectionEnd === input.value.length) {
          const nextCol = col === 'elec' ? '.water-input' : (col === 'water' ? '.fine-input' : null);
          if (nextCol) targetInput = tr.querySelector(nextCol);
        } else if (e.key === 'ArrowLeft' && input.selectionStart === 0) {
          const prevCol = col === 'fine' ? '.water-input' : (col === 'water' ? '.elec-input' : null);
          if (prevCol) targetInput = tr.querySelector(prevCol);
        }

        if (targetInput) {
          targetInput.focus();
          targetInput.select();
        }
      });

      gridBody.addEventListener('paste', (e) => {
        if (!e.target.classList.contains('excel-input')) return;
        e.preventDefault();
        
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedText = clipboardData.getData('text');
        if (!pastedText) return;

        const activeInput = e.target;
        const activeCol = activeInput.getAttribute('data-col');
        const activeTr = activeInput.closest('tr');
        const startIndex = parseInt(activeTr.getAttribute('data-index'));

        const pasteRows = pastedText.split(/\r?\n/).map(row => row.split('\t'));
        
        pasteRows.forEach((rowData, rIdx) => {
          if (rowData.length === 1 && rowData[0] === "") return;
          const targetIndex = startIndex + rIdx;
          const tr = gridBody.querySelector(`tr[data-index="${targetIndex}"]`);
          if (!tr) return;

          const roomId = tr.getAttribute('data-room-id');
          const roomName = tr.querySelector('td').textContent;

          rowData.forEach((val, cIdx) => {
            let targetCol = null;
            if (activeCol === 'elec') {
              targetCol = cIdx === 0 ? 'elec' : (cIdx === 1 ? 'water' : (cIdx === 2 ? 'fine' : null));
            } else if (activeCol === 'water') {
              targetCol = cIdx === 0 ? 'water' : (cIdx === 1 ? 'fine' : null);
            } else if (activeCol === 'fine') {
              targetCol = cIdx === 0 ? 'fine' : null;
            }

            if (!targetCol) return;
            const selector = targetCol === 'elec' ? '.elec-input' : (targetCol === 'water' ? '.water-input' : '.fine-input');
            const input = tr.querySelector(selector);
            
            if (input) {
              const cleanVal = val.replace(/[^0-9.]/g, '');
              if (cleanVal !== '') {
                const oldVal = input.value;
                input.value = cleanVal;
                pushUndo(roomId, targetCol, oldVal, cleanVal);
                addHistory(`คัดลอกวาง ${roomName} (${targetCol}) จาก [${oldVal || 'ว่าง'}] เป็น [${cleanVal}]`);
              }
            }
          });
          updateRowLive(tr);
        });

        saveTempReadingsToState();
        if (indicator) {
          indicator.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> วางข้อมูลจาก Excel เรียบร้อยแล้ว!';
          indicator.style.display = 'inline-block';
          setTimeout(() => {
            indicator.style.display = 'none';
            indicator.innerHTML = '<i class="fa-solid fa-circle-check"></i> บันทึกอัตโนมัติเรียบร้อย';
          }, 3000);
        }
      });
    }

    if (undoBtn) {
      undoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (undoStack.length === 0) return;
        
        const lastAction = undoStack.pop();
        const tr = gridBody.querySelector(`tr[data-room-id="${lastAction.roomId}"]`);
        if (tr) {
          const selector = lastAction.col === 'elec' ? '.elec-input' : (lastAction.col === 'water' ? '.water-input' : '.fine-input');
          const input = tr.querySelector(selector);
          if (input) {
            input.value = lastAction.oldVal ?? '';
            updateRowLive(tr);
            const roomName = tr.querySelector('td').textContent;
            addHistory(`Undo ย้อนกลับ ${roomName} จาก [${lastAction.newVal}] กลับเป็น [${lastAction.oldVal ?? 'ว่าง'}]`);
            saveTempReadingsToState();
          }
        }
        if (undoStack.length === 0) undoBtn.disabled = true;
      });
    }

    const handleCtrlZ = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        const focused = document.activeElement;
        if (focused && focused.classList.contains('excel-input')) {
          e.preventDefault();
          if (undoBtn) undoBtn.click();
        }
      }
    };
    document.addEventListener('keydown', handleCtrlZ);

    // Save all button
    const saveAllBtn = document.getElementById('btn-excel-save-all');
    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        saveAllBtn.disabled = true;
        saveAllBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกร่าง...';
        
        try {
          saveTempReadingsToState();
          await DBService.saveState(this.state);
          alert('✅ บันทึกข้อมูลแบบร่างลงในเบราว์เซอร์นี้เรียบร้อยแล้ว!');
        } catch (err) {
          alert('❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message);
        } finally {
          saveAllBtn.disabled = false;
          saveAllBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> บันทึกร่างชั่วคราว';
        }
      });
    }

    // Save directly to Supabase DB and generate bills button
    const saveToDbBtn = document.getElementById('btn-excel-save-to-db');
    if (saveToDbBtn) {
      saveToDbBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const monthInput = document.getElementById('excel-bill-month');
        const dueDateInput = document.getElementById('excel-due-date');
        const monthKey = monthInput ? monthInput.value : new Date().toISOString().slice(0, 7);
        const dueDate = dueDateInput ? dueDateInput.value : '';
        
        if (!monthKey || !dueDate) {
          alert('กรุณาระบุรอบเดือนและกำหนดชำระเงินก่อนบันทึกออกบิล');
          return;
        }

        const roomsToBill = this.state.rooms.filter(r => r.tempElecMeter !== null && r.tempWaterMeter !== null && r.tempElecMeter !== '' && r.tempWaterMeter !== '');

        if (roomsToBill.length === 0) {
          alert('กรุณากรอกเลขมิเตอร์น้ำและไฟให้ครบถ้วนอย่างน้อย 1 ห้องก่อนบันทึก');
          return;
        }

        if (!confirm(`ต้องการประมวลผลออกบิลและบันทึกลงฐานข้อมูล Supabase จำนวน ${roomsToBill.length} ห้อง สำหรับเดือน ${monthKey} ใช่หรือไม่?\n\n(หากระบบตรวจพบว่าบิลห้องดังกล่าวมีอยู่แล้ว จะเป็นการแก้ไขค่าน้ำไฟในบิลเดิมให้เป็นเลขล่าสุด)`)) {
          return;
        }

        saveToDbBtn.disabled = true;
        saveToDbBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกบิลลงคลาวด์...';

        // Show blocking sync loader
        const syncLoader = document.createElement('div');
        syncLoader.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15, 23, 42, 0.75); color:#f8fafc; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:99999; font-family:sans-serif; backdrop-filter:blur(4px);';
        syncLoader.innerHTML = `
          <div style="width:45px; height:45px; border:4px solid #334155; border-top-color:#10b981; border-radius:50%; animation: spin 1s linear infinite; margin-bottom:1rem;"></div>
          <div style="font-weight:700; font-size:1.15rem; margin-bottom:0.25rem;">กำลังบันทึกบิลลงฐานข้อมูล Supabase...</div>
          <div style="font-size:0.88rem; color:#cbd5e1;" id="bulk-save-progress">ประมวลผลห้องพัก...</div>
          <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        `;
        document.body.appendChild(syncLoader);

        const errorMessages = [];
        let successCount = 0;

        for (let i = 0; i < roomsToBill.length; i++) {
          const room = roomsToBill[i];
          document.getElementById('bulk-save-progress').textContent = `กำลังบันทึกห้อง ${room.name} (${i + 1}/${roomsToBill.length})...`;

          const fees = getRoomFees(room, this.state.rates);
          try {
            const result = await DBService.callRpc('generate_room_invoice', {
              p_room_id: room.id,
              p_month_key: monthKey,
              p_elec_curr: Number(room.tempElecMeter),
              p_water_curr: Number(room.tempWaterMeter),
              p_issue_date: new Date().toISOString().slice(0, 10),
              p_due_date: dueDate,
              p_fine_amount: Number(room.tempFineAmount || 0),
              p_force: true, // Force update if already exists
              p_internet_fee: fees.internetFee,
              p_common_fee: fees.commonFee
            });

            if (result && result.status === 'success') {
              successCount++;
              room.tempElecMeter = null;
              room.tempWaterMeter = null;
              room.tempFineAmount = null;
            } else {
              errorMessages.push(`ห้อง ${room.name}: ${result ? result.message : 'เกิดข้อผิดพลาดคลาวด์'}`);
            }
          } catch (rpcErr) {
            errorMessages.push(`ห้อง ${room.name}: ${rpcErr.message}`);
          }
        }

        syncLoader.remove();
        saveToDbBtn.disabled = false;
        saveToDbBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> บันทึกและออกบิลลงคลาวด์';

        if (errorMessages.length > 0) {
          alert(`บันทึกบิลสำเร็จ ${successCount} ห้อง\n\nพบข้อผิดพลาด:\n${errorMessages.join('\n')}`);
        } else {
          alert(`✅ ประมวลผลออกบิลและบันทึกลงฐานข้อมูล Supabase สำเร็จครบทั้ง ${successCount} ห้องเรียบร้อยแล้ว!`);
          
          await DBService.saveState(this.state);
          window.location.reload(); // Reload to refresh grid & billing list
        }
      });
    }
  }

  // --- 3. BILLING EVENTS ---
  static bindBillingEvents() {
    const createBillBtn = document.getElementById('btn-create-bill');
    if (createBillBtn) {
      createBillBtn.addEventListener('click', () => this.openCreateBillModal());
    }

    const archiveBillsBtn = document.getElementById('btn-archive-bills');
    if (archiveBillsBtn) {
      archiveBillsBtn.addEventListener('click', () => this.openArchiveBillsModal());
    }

    const monthFilter = document.getElementById('filter-billing-month');
    if (monthFilter) {
      monthFilter.addEventListener('change', (e) => {
        const selected = e.target.value;
        const rows = document.querySelectorAll('.billing-table-row');
        rows.forEach(row => {
          const month = row.getAttribute('data-month');
          if (selected === 'ALL' || month === selected) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      });
    }

    document.querySelectorAll('.btn-goto-slip-verification').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const roomName = e.currentTarget.getAttribute('data-room') || '';
        // บิลที่มีสถานะ "รอตรวจสอบสลิป" ต้องไปอนุมัติ/ปฏิเสธที่หน้าตรวจสอบสลิปเท่านั้น
        // ไม่ให้กดยืนยันตรงจากหน้าออกบิล เพื่อให้แอดมินได้เห็นรูปสลิปและเทียบยอดก่อนเสมอ
        SlipVerificationComponent.activeFilter = 'pending';
        SlipVerificationComponent.searchQuery = roomName;
        this.switchTab('slip-verification');
      });
    });

    document.querySelectorAll('.btn-open-add-payment-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const inv = this.state.invoices.find(i => i.id === id);
        if (inv) this.openAddPaymentModal(inv);
      });
    });

    document.querySelectorAll('.btn-toggle-pay-status').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const inv = this.state.invoices.find(i => i.id === id);
        if (inv) {
          inv.status = inv.status === 'paid' ? 'unpaid' : 'paid';
          inv.paidAmount = inv.status === 'paid' ? inv.totalAmount : 0;
          inv.outstandingAmount = inv.status === 'paid' ? 0 : inv.totalAmount;
          inv.paymentDate = inv.status === 'paid' ? new Date().toISOString().slice(0, 10) : null;
          if (inv.status === 'paid') {
            App.addInvoiceToLedger(inv);
          } else {
            App.removeInvoiceFromLedger(inv.id);
          }
          DBService.saveState(this.state);
          this.switchTab('billing');
        }
      });
    });

    document.querySelectorAll('.btn-delete-bill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('คุณต้องการลบบิลนี้ใช่หรือไม่?')) {
          const idx = this.state.invoices.findIndex(i => i.id === id);
          if (idx !== -1) {
            this.state.invoices.splice(idx, 1);
            DBService.saveState(this.state);
            this.switchTab('billing');
          }
        }
      });
    });

    document.querySelectorAll('.btn-edit-bill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const inv = this.state.invoices.find(i => i.id === id);
        if (inv) this.openEditInvoiceModal(inv);
      });
    });

    document.querySelectorAll('.btn-view-slip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const inv = this.state.invoices.find(i => i.id === id);
        if (inv && inv.slipUrl) this.openViewSlipModal(inv);
      });
    });

    document.querySelectorAll('.btn-qr-promptpay').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const inv = this.state.invoices.find(i => i.id === id);
        if (inv) {
          const payload = PromptPayService.generatePayload(this.state.settings.promptPayId, inv.totalAmount);
          alert(`📱 Dynamic PromptPay QR Code Payload:\n\n${payload}\n\nยอดเงิน: ฿${inv.totalAmount.toLocaleString()}`);
        }
      });
    });

    document.querySelectorAll('.btn-print-bill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const inv = this.state.invoices.find(i => i.id === id);
        if (inv) this.openInvoicePrintModal(inv);
      });
    });



    const lineNotifyBtn = document.getElementById('btn-line-notify-header');
    if (lineNotifyBtn) {
      lineNotifyBtn.addEventListener('click', async () => await this.openLineNotifyModal());
    }

    document.querySelectorAll('.btn-send-line').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        await this.openLineNotifyModal(id);
      });
    });
  }

  static lineAccounts = [];

  static async fetchAllLineAccounts() {
    try {
      const supabaseUrl = (this.state.settings && this.state.settings.supabaseUrl) || DBService.getSavedSupabaseUrl();
      const apiKey = (this.state.settings && this.state.settings.apiKey) || DBService.getSavedApiKey();
      if (!supabaseUrl) return;
      const baseUrl = DBService.getBaseSupabaseUrl(supabaseUrl);
      const res = await fetch(`${baseUrl}/rest/v1/tenant_line_accounts`, {
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`
        }
      });
      if (res.ok) {
        this.lineAccounts = await res.json();
      }
    } catch (e) {
      console.warn('Failed to fetch all line accounts:', e);
    }
  }

  static async openLineNotifyModal(initialInvoiceId = null) {
    await this.fetchAllLineAccounts();
    const invoices = this.state.invoices || [];
    const settings = this.state.settings || {};
    
    const savedTenantUrl = localStorage.getItem('SOMBAT_TENANT_PORTAL_URL') || (window.location.origin + '/tenant.html');
    const savedLineBotUrl = localStorage.getItem('SOMBAT_LINE_BOT_URL') || '';
    const currentAptName = settings.apartmentName || 'หอพักสมบัติ นนทบุรี';

    const selectedInv = invoices.find(i => i.id === initialInvoiceId) || null;

    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    const getLinkStatusText = (inv) => {
      if (!inv) return '';
      const isLinked = this.lineAccounts.some(acc => acc.tenant_id === inv.tenantId || acc.room_id === inv.roomId);
      return isLinked ? ' (เชื่อม LINE แล้ว 🟢)' : '';
    };

    dialog.innerHTML = `
      <div class="modal-header" style="background:#06c755; color:#ffffff;">
        <h3><i class="fa-brands fa-line"></i> ระบบส่งไลน์แจ้งเตือนผู้เช่าชำระเงินประจำเดือน</h3>
        <button class="close-modal-btn" style="color:#ffffff;">&times;</button>
      </div>

      <div class="modal-body" style="padding:1.5rem;">
        <div class="form-group" style="margin-bottom:1.25rem;">
          <label style="font-weight:600; font-size:0.85rem; color:#0f172a;">เลือกรายการผู้เช่า / ห้องพักที่ต้องการแจ้งเตือน *</label>
          <select id="line-notify-inv-select" class="form-control" style="font-size:1rem; padding:0.65rem 0.85rem;">
            <option value="ALL" ${!selectedInv ? 'selected' : ''}>📢 ประกาศแจ้งเตือนรวม (เรียนผู้เช่าทุกท่าน)</option>
            ${invoices.map(inv => `
              <option value="${inv.id}" ${selectedInv && selectedInv.id === inv.id ? 'selected' : ''}>
                ห้อง ${inv.roomName} - คุณ ${inv.tenantName || 'ผู้เช่า'} (ยอดชำระ ฿${(inv.totalAmount || 0).toLocaleString()})${getLinkStatusText(inv)}
              </option>
            `).join('')}
          </select>
        </div>

        <div id="line-notify-status-box" style="margin-bottom:1.25rem; padding:0.75rem 1rem; border-radius:8px; font-size:0.88rem; font-weight:700; display:flex; align-items:center; gap:0.5rem; transition: all 0.2s;">
        </div>

        <div class="form-group" style="margin-bottom:1.25rem;">
          <label style="font-weight:600; font-size:0.85rem; color:#0f172a; display:flex; justify-content:space-between; align-items:center;">
            <span><i class="fa-solid fa-pen-to-square text-info"></i> ข้อความที่จะส่งให้ผู้เช่า (สามารถพิมพ์แก้ไขเพิ่มเติมได้)</span>
            <span style="font-size:0.8rem; font-weight:normal; color:#059669;">✏️ สามารถพิมพ์แก้ไขข้อความได้ตามต้องการ</span>
          </label>
          <textarea id="line-msg-preview-textarea" class="form-control" rows="12" style="font-family:sans-serif; font-size:0.85rem; line-height:1.6; background-color:#ffffff; color:#0f172a; border:2px solid #06c755; border-radius:8px; padding:0.85rem;" placeholder="พิมพ์หรือแก้ไขข้อความเพิ่มเติมที่นี่..."></textarea>
        </div>

        <div style="margin-bottom:1rem;">
          <button id="btn-push-line-bot" class="btn btn-success" style="width:100%; padding:0.9rem; font-size:1.1rem; font-weight:bold; background-color:#06c755; border-color:#06c755; color:#ffffff; box-shadow: 0 4px 14px rgba(6, 199, 85, 0.4); cursor:pointer; border-radius:10px;">
            <i class="fa-solid fa-paper-plane"></i> ⚡ กดส่ง LINE Bot แจ้งเตือนตรงหาผู้เช่าทันที (Instant Auto Push)
          </button>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.75rem;">
          <button id="btn-copy-line-msg" class="btn btn-secondary" style="padding:0.65rem 0.4rem; font-size:0.85rem; font-weight:600;">
            <i class="fa-regular fa-copy"></i> คัดลอกข้อความ
          </button>
          <button id="btn-open-line-app" class="btn btn-outline-success" style="padding:0.65rem 0.4rem; font-size:0.85rem; font-weight:600; border-color:#06c755; color:#06c755;" title="เปิดแอป LINE บนคอมพิวเตอร์/มือถือโดยตรง">
            <i class="fa-brands fa-line"></i> เปิดในแอป LINE
          </button>
          <button id="btn-open-line-web-share" class="btn btn-outline-primary" style="padding:0.65rem 0.4rem; font-size:0.85rem; font-weight:600; border-color:#00b900; color:#00b900;" title="แชร์ผ่านเว็บ LINE Social Share">
            <i class="fa-solid fa-share-nodes"></i> แชร์ผ่านเว็บ LINE
          </button>
        </div>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    const invSelect = document.getElementById('line-notify-inv-select');
    const textarea = document.getElementById('line-msg-preview-textarea');
    const statusBox = document.getElementById('line-notify-status-box');

    const updatePreview = () => {
      const invId = invSelect ? invSelect.value : null;
      const isBroadcast = invId === 'ALL' || !invId;
      const inv = invoices.find(i => i.id === invId) || null;
      const apt = currentAptName;
      const url = savedTenantUrl;
      const bot = savedLineBotUrl;

      if (statusBox) {
        if (isBroadcast) {
          statusBox.style.background = '#eff6ff';
          statusBox.style.color = '#1d4ed8';
          statusBox.style.border = '1px solid #bfdbfe';
          statusBox.innerHTML = '<i class="fa-solid fa-bullhorn" style="font-size:1.1rem;"></i> 📢 ระบบจะส่งข้อความประกาศแบบ Broadcast ไปยังผู้ติดตาม LINE Bot ทุกคน';
        } else if (inv) {
          const isLinked = this.lineAccounts.some(acc => acc.tenant_id === inv.tenantId || acc.room_id === inv.roomId);
          if (isLinked) {
            statusBox.style.background = '#f0fdf4';
            statusBox.style.color = '#166534';
            statusBox.style.border = '1px solid #bbf7d0';
            statusBox.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#16a34a; font-size:1.1rem;"></i> ผู้เช่าห้องนี้เชื่อมต่อ LINE แล้ว (ระบบจะส่งตรงเข้าไลน์ส่วนตัวทันที)';
          } else {
            statusBox.style.background = '#fff7ed';
            statusBox.style.color = '#9a3412';
            statusBox.style.border = '1px solid #fed7aa';
            statusBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#ea580c; font-size:1.1rem;"></i> ผู้เช่าห้องนี้ยังไม่ได้เชื่อมต่อ LINE (สามารถใช้วิธีกดแชร์/ส่งในแอปแทน)';
          }
        }
      }

      if (inv && inv.status === 'unpaid' && new Date() > new Date(inv.dueDate)) {
        textarea.value = LineService.createOverdueMessage(inv, apt, url, bot);
      } else {
        textarea.value = LineService.createBillingMessage(inv, apt, url, bot, isBroadcast);
      }
    };

    if (invSelect) invSelect.addEventListener('change', updatePreview);
    updatePreview();

    // 0. Direct 1-Click LINE Bot Push Notification Action
    const pushBtn = document.getElementById('btn-push-line-bot');
    if (pushBtn) {
      pushBtn.addEventListener('click', async () => {
        const invId = invSelect ? invSelect.value : 'ALL';
        const msgText = textarea.value;
        const supabaseUrl = (this.state.settings && this.state.settings.supabaseUrl) || DBService.getSavedSupabaseUrl();

        if (!supabaseUrl) {
          return alert('⚠️ ยังไม่ได้บันทึก Supabase Project URL ในระบบ!\n\nกรุณาไปที่เมนู "ตั้งค่า" แล้วระบุและบันทึก Supabase Project URL ก่อนครับ');
        }

        pushBtn.disabled = true;
        pushBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังยิงข้อความเข้า LINE ผู้เช่าทันที...`;

        try {
          const baseUrl = DBService.getBaseSupabaseUrl(supabaseUrl);
          const apiKey = (this.state.settings && this.state.settings.apiKey) || DBService.getSavedApiKey();
          const response = await fetch(`${baseUrl}/functions/v1/line-notify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey,
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              action: 'linePushNotify',
              invoiceId: invId,
              messageText: msgText
            })
          });

          const res = await response.json();
          if (res.status === 'success') {
            alert(`✅ ${res.message || 'ส่งข้อความ LINE แจ้งเตือนเข้าโทรศัพท์ผู้เช่าเรียบร้อยแล้ว!'}`);
          } else {
            alert(`⚠️ การส่งข้อความ LINE ล้มเหลว:\n\n${res.message || 'กรุณาตรวจสอบ Channel Access Token ในการตั้งค่า'}`);
          }
        } catch (err) {
          alert(`⚠️ ไม่สามารถเชื่อมต่อ Supabase Edge Function ได้:\n${err.toString()}`);
        } finally {
          pushBtn.disabled = false;
          pushBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ⚡ กดส่ง LINE Bot แจ้งเตือนตรงหาผู้เช่าทันที (Instant Auto Push)`;
        }
      });
    }

    // 1. Copy message action
    document.getElementById('btn-copy-line-msg').addEventListener('click', () => {
      const txt = textarea.value;
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(txt).then(() => {
          alert('📋 คัดลอกข้อความแจ้งเตือนค่าเช่าเรียบร้อยแล้ว!\n\nคุณสามารถเปิดแชท LINE แล้วกด วาง (Ctrl+V) เพื่อส่งหาผู้เช่าได้ทันที');
        }).catch(() => {
          textarea.select();
          document.execCommand('copy');
          alert('📋 คัดลอกข้อความแจ้งเตือนค่าเช่าเรียบร้อยแล้ว!\n\nคุณสามารถเปิดแชท LINE แล้วกด วาง (Ctrl+V) เพื่อส่งหาผู้เช่าได้ทันที');
        });
      } else {
        textarea.select();
        document.execCommand('copy');
        alert('📋 คัดลอกข้อความแจ้งเตือนค่าเช่าเรียบร้อยแล้ว!\n\nคุณสามารถเปิดแชท LINE แล้วกด วาง (Ctrl+V) เพื่อส่งหาผู้เช่าได้ทันที');
      }
    });

    // 2. Open LINE Desktop / Mobile App directly (line:// - No login screen required!)
    document.getElementById('btn-open-line-app').addEventListener('click', () => {
      const txt = textarea.value;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(txt);
        }
      } catch(e) {}
      
      const encodedText = encodeURIComponent(txt);
      window.location.href = `line://msg/text/?${encodedText}`;
    });

    // 3. Open LINE Web Share plugin (no login redirect!)
    document.getElementById('btn-open-line-web-share').addEventListener('click', () => {
      const txt = textarea.value;
      const encodedText = encodeURIComponent(txt);
      window.open(`https://social-plugins.line.me/lineit/share?text=${encodedText}`, '_blank');
    });
  }

  static openAddPaymentModal(inv) {
    if (!inv) return;
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    const approvedPaid = DBService.getApprovedPaidAmount(inv.id, this.state);
    const totalWithPenalty = (Number(inv.totalAmount) || 0) + (Number(inv.penaltyAmount) || 0);
    const remaining = totalWithPenalty - approvedPaid;
    const isFullyPaid = remaining <= 0;

    const payments = (this.state.payments || [])
      .filter(p => p.invoiceId === inv.id || p.invoice_id === inv.id)
      .sort((a, b) => (a.createdAt || a.created_at || '').localeCompare(b.createdAt || b.created_at || ''));

    let statusBadge = '';
    if (isFullyPaid) {
      statusBadge = '<span class="badge-pill badge-success">🟢 ชำระครบแล้ว</span>';
    } else if (approvedPaid > 0) {
      statusBadge = '<span class="badge-pill" style="background:#ffedd5; color:#c2410c; border:1px solid #fed7aa; font-weight:700;">🟠 ชำระบางส่วน</span>';
    } else {
      statusBadge = '<span class="badge-pill badge-danger">🔴 รอชำระ</span>';
    }

    dialog.innerHTML = `
      <div class="modal-header" style="background:linear-gradient(135deg, #1e293b, #334155); color:#fff;">
        <h3><i class="fa-solid fa-receipt text-warning"></i> บันทึก & ประวัติการชำระเงิน (บิล ${inv.invoiceNumber} - ห้อง ${inv.roomName})</h3>
        <button class="close-modal-btn" style="color:#fff;">&times;</button>
      </div>
      <div class="modal-body" style="padding:1.25rem;">
        
        <!-- Summary Cards Grid -->
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:0.75rem; margin-bottom:1.25rem;">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.75rem; text-align:center;">
            <div style="font-size:0.75rem; color:#64748b; font-weight:600;">ยอดบิลรวมค่าปรับ</div>
            <div style="font-size:1.1rem; font-weight:800; color:#0f172a; margin-top:0.25rem;">${Formatters.currency(totalWithPenalty)}</div>
          </div>
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:0.75rem; text-align:center;">
            <div style="font-size:0.75rem; color:#166534; font-weight:600;">ชำระแล้วสะสม</div>
            <div style="font-size:1.1rem; font-weight:800; color:#15803d; margin-top:0.25rem;">${Formatters.currency(approvedPaid)}</div>
          </div>
          <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:0.75rem; text-align:center;">
            <div style="font-size:0.75rem; color:#991b1b; font-weight:600;">ยอดคงเหลือ</div>
            <div style="font-size:1.1rem; font-weight:800; color:#dc2626; margin-top:0.25rem;">${Formatters.currency(remaining < 0 ? 0 : remaining)}</div>
          </div>
          <div style="background:#fffbeb; border:1px solid #fef08a; border-radius:10px; padding:0.75rem; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <div style="font-size:0.75rem; color:#854d0e; font-weight:600; margin-bottom:0.25rem;">สถานะบิล</div>
            ${statusBadge}
          </div>
        </div>

        <!-- Payment History Timeline -->
        <div style="margin-bottom:1.25rem;">
          <h4 style="font-size:0.92rem; font-weight:700; color:#1e293b; margin-bottom:0.65rem; display:flex; align-items:center; gap:0.4rem;">
            <i class="fa-solid fa-clock-rotate-left text-primary"></i> ประวัติการชำระเงิน (${payments.length} รายการ)
          </h4>
          ${payments.length === 0 ? `
            <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; padding:1rem; text-align:center; color:#64748b; font-size:0.85rem;">
              ยังไม่มีประวัติการชำระเงินสำหรับบิลนี้
            </div>
          ` : `
            <div style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
              <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                <thead style="background:#f1f5f9; text-align:left;">
                  <tr>
                    <th style="padding:0.5rem 0.75rem;">งวดที่</th>
                    <th style="padding:0.5rem 0.75rem;">จำนวนเงิน</th>
                    <th style="padding:0.5rem 0.75rem;">วันที่ชำระ</th>
                    <th style="padding:0.5rem 0.75rem;">ช่องทาง</th>
                    <th style="padding:0.5rem 0.75rem;">สถานะ</th>
                    <th style="padding:0.5rem 0.75rem;">หมายเหตุ / สลิป</th>
                  </tr>
                </thead>
                <tbody>
                  ${payments.map((p, idx) => `
                    <tr style="border-top:1px solid #f1f5f9;">
                      <td style="padding:0.5rem 0.75rem; font-weight:700;">ครั้งที่ ${idx + 1}</td>
                      <td style="padding:0.5rem 0.75rem;"><strong class="text-success">${Formatters.currency(p.amount)}</strong></td>
                      <td style="padding:0.5rem 0.75rem;">${Formatters.thaiDate(p.paymentDate || p.payment_date || p.createdAt || p.created_at)}</td>
                      <td style="padding:0.5rem 0.75rem;">${(p.paymentMethod === 'cash' || p.payment_method === 'cash') ? '💵 เงินสด' : '💳 โอนเงิน'}</td>
                      <td style="padding:0.5rem 0.75rem;">
                        ${p.status === 'approved' ? '<span style="color:#16a34a; font-weight:700;">✓ อนุมัติแล้ว</span>' : (p.status === 'pending' ? '<span style="color:#d97706; font-weight:700;">⏳ รอตรวจสอบ</span>' : '<span style="color:#dc2626; font-weight:700;">❌ ปฏิเสธ</span>')}
                      </td>
                      <td style="padding:0.5rem 0.75rem;">
                        ${p.note ? `<span class="text-muted">${p.note}</span>` : '-'}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Add Payment Form -->
        ${isFullyPaid ? `
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:1rem; text-align:center; color:#166534; font-weight:700; font-size:0.9rem;">
            🔒 บิลนี้ชำระเงินครบถ้วนแล้ว ล็อกการบันทึกชำระเงินเพิ่ม
          </div>
        ` : `
          <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:1rem; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
            <h4 style="font-size:0.92rem; font-weight:700; color:#0f172a; margin-bottom:0.75rem; display:flex; align-items:center; gap:0.4rem;">
              <i class="fa-solid fa-plus-circle text-success"></i> บันทึกรับชำระเงินงวดใหม่
            </h4>
            <form id="adm-payment-form">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                <div class="form-group">
                  <label>จำนวนเงินที่รับชำระ (บาท) *</label>
                  <input type="number" id="adm-pay-amt" class="form-control" min="1" max="${remaining}" step="any" value="${remaining}" required style="font-weight:700; color:#16a34a;">
                  <div style="font-size:0.75rem; color:#64748b; margin-top:0.2rem;">สูงสุดไม่เกินยอดคงเหลือ ${Formatters.currency(remaining)}</div>
                </div>
                <div class="form-group">
                  <label>วันที่รับชำระ *</label>
                  <input type="date" id="adm-pay-date" class="form-control" value="${new Date().toISOString().slice(0, 10)}" required>
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-top:0.5rem;">
                <div class="form-group">
                  <label>ช่องทางชำระเงิน</label>
                  <select id="adm-pay-method" class="form-control">
                    <option value="cash">💵 เงินสด (บันทึกและอนุมัติทันที)</option>
                    <option value="transfer">💳 โอนเงิน / พร้อมเพย์</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>หมายเหตุ</label>
                  <input type="text" id="adm-pay-note" class="form-control" placeholder="เช่น รับเงินสดหน้าเคาน์เตอร์">
                </div>
              </div>

              <button type="submit" id="btn-submit-adm-payment" class="btn btn-success btn-full" style="margin-top:1rem; padding:0.75rem; font-weight:700; border-radius:10px;">
                <i class="fa-solid fa-floppy-disk"></i> บันทึกรายการชำระเงิน
              </button>
            </form>
          </div>
        `}

      </div>
    `;

    modal.classList.add('active');
    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.classList.remove('active')));

    const form = document.getElementById('adm-payment-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amtInput = document.getElementById('adm-pay-amt');
        const payAmt = parseFloat(amtInput.value) || 0;
        const payDate = document.getElementById('adm-pay-date').value;
        const payMethod = document.getElementById('adm-pay-method').value;
        const payNote = document.getElementById('adm-pay-note').value.trim();

        if (payAmt <= 0) {
          alert('กรุณาระบุจำนวนเงินที่ชำระให้ถูกต้อง');
          return;
        }

        if (payAmt > remaining + 0.01) {
          alert('❌ จำนวนเงินเกินยอดคงเหลือ');
          return;
        }

        const currentUser = AuthService.getCurrentUser();
        const adminName = currentUser ? currentUser.displayName : 'แอดมิน';

        const submitBtn = document.getElementById('btn-submit-adm-payment');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกข้อมูล...`;
        }

        try {
          const supaUrl = DBService.getSavedSupabaseUrl();
          const apiKey = DBService.getSavedApiKey();

          if (supaUrl && apiKey) {
            const base = DBService.getBaseSupabaseUrl(supaUrl);
            const res = await fetch(`${base}/rest/v1/rpc/add_admin_payment`, {
              method: 'POST',
              headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                p_invoice_id: inv.id,
                p_amount: payAmt,
                p_payment_date: payDate,
                p_payment_method: payMethod,
                p_note: payNote,
                p_admin_name: adminName
              })
            });
            const result = await res.json().catch(() => ({}));
            if (result.status === 'error') {
              throw new Error(result.message);
            }
          }

          const payId = 'pay_adm_' + Date.now();
          const newPay = {
            id: payId,
            invoiceId: inv.id,
            invoice_id: inv.id,
            tenantId: inv.tenantId,
            roomId: inv.roomId,
            amount: payAmt,
            paymentDate: payDate,
            paymentMethod: payMethod,
            status: 'approved',
            note: payNote,
            verifiedBy: adminName,
            verifiedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          };

          if (!this.state.payments) this.state.payments = [];
          this.state.payments.push(newPay);

          DBService.recalculateInvoiceStatus(inv, this.state);
          App.addInvoiceToLedger(inv);
          await DBService.saveState(this.state);

          modal.classList.remove('active');
          alert('✅ บันทึกรายการชำระเงินเรียบร้อยแล้ว!');
          this.switchTab('billing');
        } catch (err) {
          alert(`❌ ไม่สามารถบันทึกได้: ${err.message}`);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> บันทึกรายการชำระเงิน`;
          }
        }
      });
    }
  }

  static openEditInvoiceModal(inv) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-file-pen text-info"></i> แก้ไขข้อมูลใบแจ้งหนี้ / บิลค่าเช่า</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="edit-invoice-form">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>เลขที่บิล *</label>
              <input type="text" id="edit-inv-number" class="form-control" value="${inv.invoiceNumber}" required>
            </div>
            <div class="form-group">
              <label>รอบเดือน *</label>
              <input type="month" id="edit-inv-month" class="form-control" value="${inv.monthKey}" required>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>ชื่อห้องพัก:</label>
              <input type="text" id="edit-inv-room" class="form-control" value="${inv.roomName}" required>
            </div>
            <div class="form-group">
              <label>ชื่อผู้เช่า:</label>
              <input type="text" id="edit-inv-tenant" class="form-control" value="${inv.tenantName}" required>
            </div>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin-top:0.75rem;">
            <h4 style="font-size:0.85rem; margin-bottom:0.75rem; color:var(--primary);"><i class="fa-solid fa-bolt"></i> แก้ไขมิเตอร์ไฟฟ้า</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
              <div class="form-group"><label>มิเตอร์ไฟครั้งก่อน:</label><input type="number" id="edit-elec-prev" class="form-control" value="${inv.elecPrev}"></div>
              <div class="form-group"><label>มิเตอร์ไฟครั้งนี้:</label><input type="number" id="edit-elec-curr" class="form-control" value="${inv.elecCurr}"></div>
            </div>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin-top:0.75rem;">
            <h4 style="font-size:0.85rem; margin-bottom:0.75rem; color:var(--primary);"><i class="fa-solid fa-droplet"></i> แก้ไขมิเตอร์น้ำประปา</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
              <div class="form-group"><label>มิเตอร์น้ำครั้งก่อน:</label><input type="number" id="edit-water-prev" class="form-control" value="${inv.waterPrev}"></div>
              <div class="form-group"><label>มิเตอร์น้ำครั้งนี้:</label><input type="number" id="edit-water-curr" class="form-control" value="${inv.waterCurr}"></div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap:1rem; margin-top:0.75rem;">
            <div class="form-group">
              <label>ค่าเช่าห้องพัก (บาท) *</label>
              <input type="number" id="edit-inv-rent" class="form-control" value="${inv.rentAmount}" required>
            </div>
            <div class="form-group">
              <label>ค่าขยะ *</label>
              <input type="number" id="edit-inv-trash" class="form-control" value="${inv.trashFee !== undefined ? inv.trashFee : 20}" required>
            </div>
            <div class="form-group">
              <label>ค่าปรับ (บาท) *</label>
              <input type="number" id="edit-inv-fine" class="form-control" value="${inv.fineAmount || 0}" required>
            </div>
            <div class="form-group">
              <label>สถานะชำระเงิน *</label>
              <select id="edit-inv-status" class="form-control" required>
                <option value="unpaid" ${inv.status === 'unpaid' ? 'selected' : ''}>🔴 ค้างชำระ</option>
                <option value="paid" ${inv.status === 'paid' ? 'selected' : ''}>🟢 ชำระแล้ว</option>
              </select>
            </div>
          </div>

          <!-- Visual Calculation Summary Box -->
          <div style="margin-top:1.25rem; padding:1.25rem; background:linear-gradient(135deg, #eff6ff, #f8fafc); border:1px solid #bfdbfe; border-radius:12px;" id="edit-inv-calc-summary">
            <!-- Populated dynamically via JS -->
          </div>

          <button type="submit" class="btn btn-primary btn-full" style="margin-top:1.25rem;">
            <i class="fa-solid fa-floppy-disk"></i> บันทึกการแก้ไขใบแจ้งหนี้ลง Supabase
          </button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    const updateCalcSummary = () => {
      const elecPrev = parseFloat(document.getElementById('edit-elec-prev').value) || 0;
      const elecCurr = parseFloat(document.getElementById('edit-elec-curr').value) || 0;
      const waterPrev = parseFloat(document.getElementById('edit-water-prev').value) || 0;
      const waterCurr = parseFloat(document.getElementById('edit-water-curr').value) || 0;
      const rentAmount = parseFloat(document.getElementById('edit-inv-rent').value) || 0;
      const trashVal = document.getElementById('edit-inv-trash').value;
      const trashFee = trashVal !== "" ? parseFloat(trashVal) : 20;
      const fineAmount = parseFloat(document.getElementById('edit-inv-fine').value) || 0;

      const elecRate = this.state.rates ? (this.state.rates.electricityRate || 8) : 8;
      const waterRate = this.state.rates ? (this.state.rates.waterRate || 20) : 20;

      const elecUnits = Math.max(0, elecCurr - elecPrev);
      const waterUnits = Math.max(0, waterCurr - waterPrev);
      const elecAmount = elecUnits * elecRate;
      const waterAmount = waterUnits * waterRate;
      const internetFee = Number(inv.internetFee || 0);
      const commonFee = Number(inv.commonFee || 0);
      const totalAmount = rentAmount + elecAmount + waterAmount + trashFee + fineAmount + internetFee + commonFee;

      const summaryDiv = document.getElementById('edit-inv-calc-summary');
      if (summaryDiv) {
        summaryDiv.innerHTML = `
          <h4 style="margin:0 0 0.75rem 0; font-size:0.85rem; color:#1e40af; border-bottom:1px solid #dbeafe; padding-bottom:0.5rem;"><i class="fa-solid fa-calculator"></i> สรุปรายละเอียดผลการคำนวณ</h4>
          <div style="display:flex; flex-direction:column; gap:0.45rem; font-size:0.9rem; color:#334155;">
            <div style="display:flex; justify-content:space-between;">
              <span>ค่าเช่าห้องพัก:</span>
              <strong>฿${rentAmount.toLocaleString()}</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>ค่าไฟฟ้า (${elecCurr} - ${elecPrev} = ${elecUnits} หน่วย × ฿${elecRate}):</span>
              <strong>฿${elecAmount.toLocaleString()}</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>ค่าน้ำประปา (${waterCurr} - ${waterPrev} = ${waterUnits} หน่วย × ฿${waterRate}):</span>
              <strong>฿${waterAmount.toLocaleString()}</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>ค่าขยะ:</span>
              <strong>฿${trashFee.toLocaleString()}</strong>
            </div>
            ${internetFee > 0 ? `
            <div style="display:flex; justify-content:space-between;">
              <span>ค่าอินเทอร์เน็ต:</span>
              <strong>฿${internetFee.toLocaleString()}</strong>
            </div>` : ''}
            ${commonFee > 0 ? `
            <div style="display:flex; justify-content:space-between;">
              <span>ค่าส่วนกลาง:</span>
              <strong>฿${commonFee.toLocaleString()}</strong>
            </div>` : ''}
            ${fineAmount > 0 ? `
            <div style="display:flex; justify-content:space-between; color:#ef4444;">
              <span>ค่าปรับ:</span>
              <strong>฿${fineAmount.toLocaleString()}</strong>
            </div>` : ''}
            <div style="display:flex; justify-content:space-between; font-size:1.1rem; font-weight:800; color:#1e3a8a; border-top:2px dashed #bfdbfe; padding-top:0.6rem; margin-top:0.3rem;">
              <span>ยอดชำระสุทธิ:</span>
              <span>฿${totalAmount.toLocaleString()}</span>
            </div>
          </div>
        `;
      }
    };

    // Update live calculation when inputs change
    const inputsToWatch = [
      'edit-elec-prev', 'edit-elec-curr', 
      'edit-water-prev', 'edit-water-curr', 
      'edit-inv-rent', 'edit-inv-trash', 'edit-inv-fine'
    ];
    inputsToWatch.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateCalcSummary);
        el.addEventListener('change', updateCalcSummary);
      }
    });
    updateCalcSummary();

    // Automatically pull room rent and tenant name from database when editing/typing the Room Name
    const roomInput = document.getElementById('edit-inv-room');
    if (roomInput) {
      const autofillRoomData = (e) => {
        const roomVal = e.target.value.trim().toLowerCase();
        const matchedRoom = this.state.rooms.find(r => r.name.toLowerCase() === roomVal || r.id.toLowerCase() === roomVal);
        if (matchedRoom) {
          const rentInput = document.getElementById('edit-inv-rent');
          const tenantInput = document.getElementById('edit-inv-tenant');
          if (rentInput) rentInput.value = matchedRoom.baseRent || 0;
          if (tenantInput) {
            tenantInput.value = (matchedRoom.currentTenantName && matchedRoom.currentTenantName !== 'ไม่มีผู้เข้าเช่า') 
              ? matchedRoom.currentTenantName 
              : '';
          }
        }
      };
      roomInput.addEventListener('input', autofillRoomData);
      roomInput.addEventListener('change', autofillRoomData);
    }

    document.getElementById('edit-invoice-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const elecPrev = parseFloat(document.getElementById('edit-elec-prev').value) || 0;
      const elecCurr = parseFloat(document.getElementById('edit-elec-curr').value) || 0;
      const waterPrev = parseFloat(document.getElementById('edit-water-prev').value) || 0;
      const waterCurr = parseFloat(document.getElementById('edit-water-curr').value) || 0;
      const rentAmount = parseFloat(document.getElementById('edit-inv-rent').value) || 0;
      const trashVal = document.getElementById('edit-inv-trash').value;
      const trashFee = trashVal !== "" ? parseFloat(trashVal) : 20;
      const fineAmount = parseFloat(document.getElementById('edit-inv-fine').value) || 0;

      const elecUnits = Math.max(0, elecCurr - elecPrev);
      const waterUnits = Math.max(0, waterCurr - waterPrev);
      const elecAmount = elecUnits * (this.state.rates ? (this.state.rates.electricityRate || 8) : 8);
      const waterAmount = waterUnits * (this.state.rates ? (this.state.rates.waterRate || 20) : 20);
      const internetFee = Number(inv.internetFee || 0);
      const commonFee = Number(inv.commonFee || 0);
      const totalAmount = rentAmount + elecAmount + waterAmount + trashFee + fineAmount + internetFee + commonFee;

      const idx = this.state.invoices.findIndex(i => i.id === inv.id);
      if (idx !== -1) {
        this.state.invoices[idx] = {
          ...this.state.invoices[idx],
          invoiceNumber: document.getElementById('edit-inv-number').value.trim(),
          monthKey: document.getElementById('edit-inv-month').value,
          roomName: document.getElementById('edit-inv-room').value.trim(),
          tenantName: document.getElementById('edit-inv-tenant').value.trim(),
          elecPrev, elecCurr, elecAmount,
          waterPrev, waterCurr, waterAmount,
          rentAmount, trashFee, fineAmount, totalAmount,
          status: document.getElementById('edit-inv-status').value,
          paidAmount: document.getElementById('edit-inv-status').value === 'paid' ? totalAmount : 0,
          outstandingAmount: document.getElementById('edit-inv-status').value === 'paid' ? 0 : totalAmount,
          slipUrl: document.getElementById('edit-inv-status').value === 'paid' ? (this.state.invoices[idx].slipUrl || "") : "",
          slipHash: document.getElementById('edit-inv-status').value === 'paid' ? (this.state.invoices[idx].slipHash || "") : ""
        };

        const updatedInv = this.state.invoices[idx];
        if (updatedInv.status === 'paid') {
          if (!updatedInv.paymentDate) {
            updatedInv.paymentDate = new Date().toISOString().slice(0, 10);
          }
          App.addInvoiceToLedger(updatedInv);
        } else {
          updatedInv.paymentDate = null;
          App.removeInvoiceFromLedger(updatedInv.id);
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกข้อมูลลง Supabase...`;
        }

        try {
          await DBService.saveState(this.state);
          modal.classList.remove('active');
          alert('✅ แก้ไขข้อมูลบิลค่าเช่าและซิงค์ลง Supabase เรียบร้อยแล้ว!');
          this.switchTab('billing');
        } catch (err) {
          alert(`❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${err.message}`);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-save"></i> บันทึกการแก้ไขใบแจ้งหนี้ลง Supabase`;
          }
        }
      }
    });
  }

  static openViewSlipModal(inv) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');
    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-image text-success"></i> หลักฐานการชำระเงิน (สลิปโอนเงิน)</h3>
        <button type="button" class="close-modal-btn" onclick="document.getElementById('app-modal').classList.remove('active')">&times;</button>
      </div>
      <div class="modal-body" style="text-align:center; padding:1.5rem;">
        <p style="font-size:1.1rem; font-weight:700; margin-bottom:0.5rem; color:#0f172a;">ห้อง ${inv.roomName} - คุณ ${inv.tenantName}</p>
        <p class="text-muted" style="font-size:0.85rem; margin-bottom:1.25rem;">วันที่ชำระเงิน: ${inv.paymentDate || 'ไม่ระบุ'}</p>
        
        <div style="max-width:100%; border:1px solid #cbd5e1; border-radius:12px; overflow:hidden; display:inline-block; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); background-color:#f8fafc; padding:0.5rem;">
          <img id="view-slip-img" src="${inv.slipUrl}" alt="Slip" style="max-width:100%; max-height:480px; display:block; border-radius:8px;"
               onerror="this.style.display='none'; document.getElementById('view-slip-fallback').style.display='block';">
          <div id="view-slip-fallback" style="display:none; padding:1.5rem; color:#b91c1c; font-size:0.85rem; font-weight:600; max-width:320px;">
            <i class="fa-solid fa-triangle-exclamation"></i> ไม่สามารถแสดงรูปสลิปได้ (ไฟล์อาจถูกลบ หรือยังไม่ได้ตั้งค่าสิทธิ์การเข้าถึง Supabase Storage)<br>
            <span style="font-weight:400;">ลองกด "ดาวน์โหลดรูปสลิป" ด้านล่าง หรือเปิดลิงก์โดยตรงเพื่อตรวจสอบ</span>
          </div>
        </div>
        
        <div style="margin-top:1.5rem; display:flex; gap:1rem; justify-content:center;">
          <a href="${inv.slipUrl}" target="_blank" rel="noopener" download="slip_${inv.roomName}_${inv.monthKey}.png" class="btn btn-primary" style="padding:0.6rem 1.2rem; font-weight:600; border-radius:8px; display:inline-flex; align-items:center; gap:0.5rem; text-decoration:none;">
            <i class="fa-solid fa-download"></i> ดาวน์โหลดรูปสลิป
          </a>
          <button type="button" class="btn btn-secondary close-modal-btn" onclick="document.getElementById('app-modal').classList.remove('active')" style="padding:0.6rem 1.2rem; font-weight:600; border-radius:8px;">ปิดหน้าต่าง</button>
        </div>
      </div>
    `;
    modal.classList.add('active');
    modal.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.remove('active');
      });
    });
  }

  static openInvoicePrintModal(inv) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    const elecUnits = Math.max(0, inv.elecCurr - inv.elecPrev);
    const waterUnits = Math.max(0, inv.waterCurr - inv.waterPrev);
    const elecRate = this.state.rates ? (this.state.rates.electricityRate || 8.0) : 8.0;
    const waterRate = this.state.rates ? (this.state.rates.waterRate || 20.0) : 20.0;

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-file-invoice-dollar text-primary"></i> ใบแจ้งหนี้ / ใบเสร็จรับเงินค่าเช่าห้องพัก</h3>
        <button class="close-modal-btn">&times;</button>
      </div>

      <div class="modal-body">
        <div class="invoice-paper" id="invoice-preview-card">
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #e2e8f0; padding-bottom:1rem; margin-bottom:1rem;">
            <div>
              <h2 style="font-size:1.35rem; color:var(--primary); font-weight:700;">หอพักสมบัติ นนทบุรี</h2>
              <p style="font-size:0.85rem; color:#64748b; margin-top:0.25rem;">
                45/10 หมู่ที่ 8 ต.ราษฎร์นิยม อ.ไทรน้อย จ.นนทบุรี 11150<br>
                โทร. 080-5991691, 062-6252564
              </p>
            </div>
            <div style="text-align:right;">
              <span class="badge-pill badge-primary" style="font-size:0.9rem; padding:0.4rem 0.85rem;">ใบแจ้งหนี้ / ใบเสร็จรับเงิน</span>
              <div style="font-weight:bold; font-size:1.1rem; margin-top:0.5rem; color:#1e293b;">${inv.invoiceNumber}</div>
              <div style="font-size:0.85rem; color:#64748b;">ประจำเดือน: ${Formatters.thaiMonthBE(inv.monthKey)}</div>
            </div>
          </div>

          <!-- Customer info -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; background:#f8fafc; padding:1rem; border-radius:8px; margin-bottom:1.25rem;">
            <div>
              <div style="font-size:0.85rem; color:#64748b;">ห้องพัก (Room):</div>
              <div style="font-size:1.1rem; font-weight:bold; color:var(--primary);">ห้อง ${inv.roomName}</div>
            </div>
            <div>
              <div style="font-size:0.85rem; color:#64748b;">ชื่อผู้เช่า (Tenant):</div>
              <div style="font-size:1.05rem; font-weight:bold; color:#1e293b;">${inv.tenantName}</div>
            </div>
            <div>
              <div style="font-size:0.85rem; color:#64748b;">วันที่ออกบิล (Issue Date):</div>
              <div>${Formatters.thaiDate(inv.issueDate)}</div>
            </div>
            <div>
              <div style="font-size:0.85rem; color:#64748b;">กำหนดชำระเงิน (Due Date):</div>
              <div style="font-weight:bold; color:#dc2626;">${Formatters.thaiDate(inv.dueDate)}</div>
            </div>
          </div>

          <!-- Items breakdown table -->
          <div class="invoice-details-table-wrapper" style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; margin-bottom:1rem;">
            <table class="invoice-details-table" style="width:100%; min-width:560px;">
              <thead>
                <tr>
                  <th style="text-align:center; width:45px;">ลำดับ</th>
                  <th>รายการชำระ (Description)</th>
                  <th style="text-align:center;">เลขครั้งก่อน</th>
                  <th style="text-align:center;">เลขครั้งนี้</th>
                  <th style="text-align:center;">หน่วยที่ใช้</th>
                  <th style="text-align:right;">ราคา/หน่วย</th>
                  <th style="text-align:right;">จำนวนเงิน (บาท)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="text-align:center;">1</td>
                  <td><strong>ค่าเช่าห้องพักประจำเดือน (${Formatters.thaiMonthBE(inv.monthKey)})</strong></td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:right;">-</td>
                  <td style="text-align:right;"><strong>฿${(inv.rentAmount || 3500).toLocaleString(undefined, {minimumFractionDigits:2})}</strong></td>
                </tr>
                <tr>
                  <td style="text-align:center;">2</td>
                  <td><strong>ค่าไฟฟ้า (Electricity)</strong></td>
                  <td style="text-align:center;">${inv.elecPrev}</td>
                  <td style="text-align:center;">${inv.elecCurr}</td>
                  <td style="text-align:center;"><strong>${elecUnits}</strong> ยูนิต</td>
                  <td style="text-align:right;">฿${elecRate.toFixed(2)}</td>
                  <td style="text-align:right;"><strong>฿${(inv.elecAmount || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</strong></td>
                </tr>
                <tr>
                  <td style="text-align:center;">3</td>
                  <td><strong>ค่าน้ำประปา (Water)</strong></td>
                  <td style="text-align:center;">${inv.waterPrev}</td>
                  <td style="text-align:center;">${inv.waterCurr}</td>
                  <td style="text-align:center;"><strong>${waterUnits}</strong> ยูนิต</td>
                  <td style="text-align:right;">฿${waterRate.toFixed(2)}</td>
                  <td style="text-align:right;"><strong>฿${(inv.waterAmount || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</strong></td>
                </tr>
                 ${(inv.internetFee || 0) > 0 ? `
                   <tr>
                     <td style="text-align:center;">-</td>
                     <td><strong>ค่าอินเทอร์เน็ต (Internet Fee)</strong></td>
                     <td style="text-align:center;">-</td>
                     <td style="text-align:center;">-</td>
                     <td style="text-align:center;">-</td>
                     <td style="text-align:right;">-</td>
                     <td style="text-align:right;"><strong>฿${inv.internetFee.toLocaleString(undefined, {minimumFractionDigits:2})}</strong></td>
                   </tr>
                 ` : ''}
                 ${(inv.commonFee || 0) > 0 ? `
                   <tr>
                     <td style="text-align:center;">-</td>
                     <td><strong>ค่าส่วนกลาง (Common Fee)</strong></td>
                     <td style="text-align:center;">-</td>
                     <td style="text-align:center;">-</td>
                     <td style="text-align:center;">-</td>
                     <td style="text-align:right;">-</td>
                     <td style="text-align:right;"><strong>฿${inv.commonFee.toLocaleString(undefined, {minimumFractionDigits:2})}</strong></td>
                   </tr>
                 ` : ''}
                 ${(inv.fineAmount || 0) > 0 ? `
                   <tr>
                     <td style="text-align:center;">-</td>
                     <td><strong>ค่าปรับ/อื่นๆ (Fine/Others)</strong></td>
                     <td style="text-align:center;">-</td>
                     <td style="text-align:center;">-</td>
                     <td style="text-align:center;">-</td>
                     <td style="text-align:right;">-</td>
                     <td style="text-align:right;"><strong>฿${inv.fineAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</strong></td>
                   </tr>
                 ` : ''}
                 ${(inv.trashFee !== undefined ? inv.trashFee : 20) > 0 ? `
                   <tr>
                     <td style="text-align:center;">4</td>
                     <td><strong>ค่าบริการสาธารณูปโภค / ขยะ (Trash Fee)</strong></td>
                     <td style="text-align:center;">-</td>
                     <td style="text-align:center;">-</td>
                     <td style="text-align:center;">-</td>
                     <td style="text-align:right;">-</td>
                     <td style="text-align:right;"><strong>฿${(inv.trashFee !== undefined ? inv.trashFee : 20).toLocaleString(undefined, {minimumFractionDigits:2})}</strong></td>
                   </tr>
                 ` : ''}
                 <tr style="background:#f8fafc; font-weight:bold; font-size:0.85rem; border-top:1px solid #cbd5e1;">
                   <td colspan="6" style="text-align:right;">ยอดรวมเดิมก่อนปรับ (Base Total):</td>
                   <td style="text-align:right;">฿${(Number(inv.rentAmount || 0) + Number(inv.waterAmount || 0) + Number(inv.elecAmount || 0) + Number(inv.trashFee || 0) + Number(inv.internetFee || 0) + Number(inv.commonFee || 0) + Number(inv.fineAmount || 0)).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                 </tr>
                 ${(inv.penaltyAmount || 0) > 0 ? `
                   <tr style="background:#fdf2f2; font-weight:bold; font-size:0.85rem; color:#dc2626;">
                     <td colspan="6" style="text-align:right;">ค่าปรับชำระล่าช้า (Late Payment Penalty):<div style="font-size:0.75rem; font-weight:normal; color:#ef4444;">${inv.penaltyRule || ''}</div></td>
                     <td style="text-align:right;">฿${Number(inv.penaltyAmount || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                   </tr>
                 ` : ''}
                 <tr style="background:#f1f5f9; font-weight:bold; font-size:1.05rem; border-top:2px double #475569;">
                   <td colspan="6" style="text-align:right;">ยอดเงินรวมสุทธิที่ต้องชำระ (Total Net Amount):</td>
                   <td style="text-align:right; color:var(--primary); font-size:1.15rem;">฿${inv.totalAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                 </tr>
               </tbody>
             </table>
           </div>
 
           <div style="text-align:right; font-weight:bold; color:#475569; margin-top:0.5rem;">
             (จำนวนเงินตัวอักษร: ${Formatters.thaiBahtText(inv.totalAmount)})
           </div>

          <!-- Official Red Note Box Requested by User -->
          <div class="invoice-red-note-box" style="border: 2px solid #ef4444; background-color: #fef2f2; color: #991b1b; padding: 0.85rem 1.25rem; border-radius: 8px; margin-top: 1.25rem; font-size: 0.95rem; line-height: 1.6; text-align: center;">
            📌 <strong>หมายเหตุสำคัญ:</strong> ชำระเงินสดได้ที่ร้าน / หรือโอน <strong>ธ.กรุงศรี 2401346663 นางสมผิว น้ำวน</strong> <span style="font-weight:bold; color:#ef4444;">(ไม่เกินวันที่ 5 ของเดือน)</span>
          </div>

          <!-- Signatures -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; margin-top:2.5rem; text-align:center;">
            <div style="display:flex; justify-content:center; align-items:flex-start;">
              <span style="line-height:2.2;">ลงชื่อ</span>
              <div style="display:inline-flex; flex-direction:column; align-items:center; margin:0 0.35rem;">
                <span style="display:inline-block; width:190px; border-bottom:1px dotted #000; height:1.6rem;"></span>
                <span style="font-size:0.9rem; margin-top:0.35rem; white-space:nowrap;">( ${inv.tenantName} )</span>
              </div>
              <span style="line-height:2.2;">ผู้จ่ายเงิน/ผู้เช่า</span>
            </div>

            <div style="display:flex; justify-content:center; align-items:flex-start;">
              <span style="line-height:2.2;">ลงชื่อ</span>
              <div style="display:inline-flex; flex-direction:column; align-items:center; margin:0 0.35rem;">
                <span style="display:inline-block; width:190px; border-bottom:1px dotted #000; height:1.6rem;"></span>
                <span style="font-size:0.9rem; margin-top:0.35rem; white-space:nowrap;">( นางสมผิว น้ำวน )</span>
              </div>
              <span style="line-height:2.2;">ผู้รับเงิน/เจ้าของหอพัก</span>
            </div>
          </div>
        </div>

        <button class="btn btn-primary btn-full" id="btn-do-print-invoice-pdf" style="margin-top:1.5rem;">
          <i class="fa-solid fa-print"></i> พิมพ์ใบแจ้งหนี้ / ใบเสร็จ (PDF)
        </button>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('btn-do-print-invoice-pdf').addEventListener('click', () => {
      const printArea = document.getElementById('print-receipt-area');
      printArea.innerHTML = `
        <div class="contract-print-page">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #000; padding-bottom:1rem; margin-bottom:1rem;">
            <div>
              <h2 style="font-size:1.5rem; font-weight:700;">หอพักสมบัติ นนทบุรี</h2>
              <p style="font-size:0.9rem; margin-top:0.25rem;">
                45/10 หมู่ที่ 8 ต.ราษฎร์นิยม อ.ไทรน้อย จ.นนทบุรี 11150 โทร. 080-5991691, 062-6252564
              </p>
            </div>
            <div style="text-align:right;">
              <h3 style="font-size:1.2rem; font-weight:bold;">ใบแจ้งหนี้ / ใบเสร็จรับเงิน</h3>
              <div><strong>เลขที่: ${inv.invoiceNumber}</strong></div>
              <div>ประจำเดือน: ${Formatters.thaiMonthBE(inv.monthKey)}</div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; background:#f8fafc; padding:1rem; border:1px solid #ccc; border-radius:6px; margin-bottom:1rem;">
            <div><strong>ห้องพัก:</strong> ห้อง ${inv.roomName}</div>
            <div><strong>ชื่อผู้เช่า:</strong> ${inv.tenantName}</div>
            <div><strong>วันที่ออกบิล:</strong> ${Formatters.thaiDate(inv.issueDate)}</div>
            <div><strong>กำหนดชำระ:</strong> ${Formatters.thaiDate(inv.dueDate)}</div>
          </div>

          <table style="width:100%; border-collapse:collapse; margin-bottom:1rem;" border="1" cellpadding="6">
            <thead>
              <tr style="background:#eee;">
                <th style="text-align:center;">ลำดับ</th>
                <th>รายการชำระ</th>
                <th style="text-align:center;">เลขครั้งก่อน</th>
                <th style="text-align:center;">เลขครั้งนี้</th>
                <th style="text-align:center;">หน่วยที่ใช้</th>
                <th style="text-align:right;">ราคา/หน่วย</th>
                <th style="text-align:right;">จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align:center;">1</td>
                <td>ค่าเช่าห้องพักประจำเดือน (${Formatters.thaiMonthBE(inv.monthKey)})</td>
                <td style="text-align:center;">-</td>
                <td style="text-align:center;">-</td>
                <td style="text-align:center;">-</td>
                <td style="text-align:right;">-</td>
                <td style="text-align:right;">฿${(inv.rentAmount || 3500).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
              </tr>
              <tr>
                <td style="text-align:center;">2</td>
                <td>ค่าไฟฟ้า (Electricity)</td>
                <td style="text-align:center;">${inv.elecPrev}</td>
                <td style="text-align:center;">${inv.elecCurr}</td>
                <td style="text-align:center;">${elecUnits} ยูนิต</td>
                <td style="text-align:right;">฿${elecRate.toFixed(2)}</td>
                <td style="text-align:right;">฿${(inv.elecAmount || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
              </tr>
              <tr>
                <td style="text-align:center;">3</td>
                <td>ค่าน้ำประปา (Water)</td>
                <td style="text-align:center;">${inv.waterPrev}</td>
                <td style="text-align:center;">${inv.waterCurr}</td>
                <td style="text-align:center;">${waterUnits} ยูนิต</td>
                <td style="text-align:right;">฿${waterRate.toFixed(2)}</td>
                <td style="text-align:right;">฿${(inv.waterAmount || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
              </tr>
              ${(inv.trashFee !== undefined ? inv.trashFee : 20) > 0 ? `
                <tr>
                  <td style="text-align:center;">4</td>
                  <td>ค่าบริการสาธารณูปโภค / ขยะ</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:right;">-</td>
                  <td style="text-align:right;">฿${(inv.trashFee !== undefined ? inv.trashFee : 20).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                </tr>
              ` : ''}
              ${(inv.internetFee || 0) > 0 ? `
                <tr>
                  <td style="text-align:center;">5</td>
                  <td>ค่าอินเทอร์เน็ต</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:right;">-</td>
                  <td style="text-align:right;">฿${Number(inv.internetFee).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                </tr>
              ` : ''}
              ${(inv.commonFee || 0) > 0 ? `
                <tr>
                  <td style="text-align:center;">6</td>
                  <td>ค่าส่วนกลาง</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:right;">-</td>
                  <td style="text-align:right;">฿${Number(inv.commonFee).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                </tr>
              ` : ''}
              <tr style="font-weight:bold; background:#f5f5f5;">
                <td colspan="6" style="text-align:right;">ยอดรวมสุทธิที่ต้องชำระ:</td>
                <td style="text-align:right;">฿${inv.totalAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
              </tr>
            </tbody>
          </table>

          <div style="text-align:right; font-weight:bold; margin-top:0.5rem;">
            (จำนวนเงินตัวอักษร: ${Formatters.thaiBahtText(inv.totalAmount)})
          </div>

          <div style="border: 2px solid #ef4444; background-color: #fef2f2; color: #991b1b; padding: 0.85rem; border-radius: 8px; margin-top: 1.25rem; font-size: 0.95rem; text-align: center;">
            📌 <strong>หมายเหตุสำคัญ:</strong> ชำระเงินสดได้ที่ร้าน / หรือโอน <strong>ธ.กรุงศรี 2401346663 นางสมผิว น้ำวน</strong> <span style="font-weight:bold; color:#ef4444;">(ไม่เกินวันที่ 5 ของเดือน)</span>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; margin-top:2.5rem; text-align:center;">
            <div style="display:flex; justify-content:center; align-items:flex-start;">
              <span style="line-height:2.2;">ลงชื่อ</span>
              <div style="display:inline-flex; flex-direction:column; align-items:center; margin:0 0.35rem;">
                <span style="display:inline-block; width:190px; border-bottom:1px dotted #000; height:1.6rem;"></span>
                <span style="font-size:0.9rem; margin-top:0.35rem; white-space:nowrap;">( ${inv.tenantName} )</span>
              </div>
              <span style="line-height:2.2;">ผู้จ่ายเงิน/ผู้เช่า</span>
            </div>

            <div style="display:flex; justify-content:center; align-items:flex-start;">
              <span style="line-height:2.2;">ลงชื่อ</span>
              <div style="display:inline-flex; flex-direction:column; align-items:center; margin:0 0.35rem;">
                <span style="display:inline-block; width:190px; border-bottom:1px dotted #000; height:1.6rem;"></span>
                <span style="font-size:0.9rem; margin-top:0.35rem; white-space:nowrap;">( นางสมผิว น้ำวน )</span>
              </div>
              <span style="line-height:2.2;">ผู้รับเงิน/เจ้าของหอพัก</span>
            </div>
          </div>
        </div>
      `;
      document.body.classList.add('print-receipt-active');
      window.print();
      setTimeout(() => {
        document.body.classList.remove('print-receipt-active');
      }, 600);
    });
  }


  static openArchiveBillsModal() {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    // Get list of unique months in the invoices
    const invoices = this.state.invoices || [];
    const months = Array.from(new Set(invoices.map(i => i.monthKey))).filter(Boolean).sort((a, b) => b.localeCompare(a));

    if (months.length === 0) {
      alert("❌ ไม่พบข้อมูลบิลในระบบสำหรับการสำรองและล้างข้อมูล");
      return;
    }

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-box-archive text-warning"></i> สำรองข้อมูลและล้างบิลรายเดือน</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size:0.85rem; color:#475569; line-height:1.6; margin-bottom:1.25rem;">
          คุณสามารถทำการสำรองบิลทั้งหมดประจำเดือนนั้นๆ ไปเป็นไฟล์ CSV สำรอง (เช่น <code>สำรองบิล_2026-07</code>) และล้างข้อมูลบิลเหล่านั้นออกจากระบบหลักเพื่อเพิ่มประสิทธิภาพความเร็วในการทำงานของตัวเครื่อง
        </p>

        <form id="archive-bills-form">
          <div class="form-group" style="margin-bottom:1.5rem;">
            <label style="font-weight:700; color:#334155;">เลือกรอบเดือนที่ต้องการสำรองและลบ *</label>
            <select id="archive-month-select" class="form-control" required style="padding:0.75rem 1rem; border-radius:8px; font-size:1rem; margin-top:0.35rem;">
              <option value="">-- เลือกรอบเดือน --</option>
              ${months.map(m => `
                <option value="${m}">บิลรอบเดือน ${Formatters.thaiMonthBE(m)} (${m})</option>
              `).join('')}
            </select>
          </div>

          <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:1rem; margin-bottom:1.5rem;">
            <div style="font-weight:700; color:#b45309; margin-bottom:0.25rem;"><i class="fa-solid fa-triangle-exclamation"></i> ข้อควรระวัง</div>
            <p style="font-size:0.85rem; color:#b45309; line-height:1.5; margin:0;">
              ข้อมูลบิลของเดือนที่เลือกทั้งหมดจะถูกลบออกจากตัวระบบหลัก (หน้าเว็บนี้และหน้ามือถือของลูกค้าจะมองไม่เห็นบิลเดือนนี้แล้ว) แต่บิลจะถูกส่งออกเป็นไฟล์ CSV สำรองให้ดาวน์โหลดไว้ถาวร คุณยังสามารถเปิดดูหรือพิมพ์บิลย้อนหลังจากไฟล์ CSV นั้นได้ตามปกติครับ
            </p>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
            <button type="button" class="btn btn-secondary close-modal-btn">ยกเลิก</button>
            <button type="submit" class="btn btn-warning" style="background-color:#d97706; border-color:#d97706; color:#ffffff;">
              <i class="fa-solid fa-box-archive"></i> เริ่มการสำรองและลบข้อมูล
            </button>
          </div>
        </form>
      </div>
    `;

    const form = document.getElementById('archive-bills-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selectedMonth = document.getElementById('archive-month-select').value;
      if (!selectedMonth) return;

      const targetInvoices = invoices.filter(i => i.monthKey === selectedMonth);
      if (targetInvoices.length === 0) {
        alert("ไม่พบรายการบิลในรอบเดือนที่เลือก");
        return;
      }

      if (confirm(`⚠️ ยืนยันการสำรองและลบข้อมูลบิลของเดือน ${Formatters.thaiMonthBE(selectedMonth)} จำนวน ${targetInvoices.length} บิลใช่หรือไม่?\n\n(ระบบจะสร้างแผ่นงาน 'สำรองบิล_${selectedMonth}' และลบออกจากหน้ารายการหลัก)`)) {
        // Show blocking loader during archive
        const syncLoader = document.createElement('div');
        syncLoader.id = 'app-sync-loader';
        syncLoader.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15, 23, 42, 0.75); color:#f8fafc; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:99999; font-family:sans-serif; backdrop-filter:blur(4px);';
        syncLoader.innerHTML = `
          <div style="width:45px; height:45px; border:4px solid #334155; border-top-color:#d97706; border-radius:50%; animation: spin 1s linear infinite; margin-bottom:1rem;"></div>
          <div style="font-weight:700; font-size:1.15rem; margin-bottom:0.25rem;">กำลังสร้างแฟ้มสำรองข้อมูลและล้างบิลเก่า...</div>
          <div style="font-size:0.88rem; color:#cbd5e1;">ระบบกำลังเขียนข้อมูลไปยัง Supabase และอัปเดตระบบ</div>
          <style>
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        `;
        document.body.appendChild(syncLoader);

        try {
          // Generate and trigger local CSV download
          const headers = [
            "เลขที่บิล", "รอบเดือน", "ห้องพัก", "ชื่อผู้เช่า", "วันที่ออกบิล", "กำหนดชำระ",
            "ไฟครั้งก่อน", "ไฟครั้งนี้", "หน่วยที่ใช้ (ไฟ)", "ค่าไฟฟ้า",
            "น้ำครั้งก่อน", "น้ำครั้งนี้", "หน่วยที่ใช้ (น้ำ)", "ค่าน้ำประปา",
            "ค่าเช่าห้อง", "ค่าขยะ", "ค่าอินเทอร์เน็ต", "ค่าส่วนกลาง", "ค่าปรับ", "ค่าใช้จ่ายอื่น",
            "ยอดรวมสุทธิ (บาท)", "สถานะการชำระ"
          ];
          
          const rows = targetInvoices.map(inv => {
            const statusStr = (inv.status === 'paid') ? 'ชำระแล้ว' : 'ค้างชำระ';
            const elecUnits = (inv.elecCurr || 0) - (inv.elecPrev || 0);
            const waterUnits = (inv.waterCurr || 0) - (inv.waterPrev || 0);
            let otherAmt = 0;
            if (inv.customFees && Array.isArray(inv.customFees)) {
              otherAmt = inv.customFees.reduce((sum, f) => sum + (f.amount || 0), 0);
            }
            return [
              inv.invoiceNumber || "",
              inv.monthKey || "",
              inv.roomName || "",
              inv.tenantName || "",
              inv.issueDate || "",
              inv.dueDate || "",
              inv.elecPrev || 0,
              inv.elecCurr || 0,
              elecUnits >= 0 ? elecUnits : 0,
              inv.elecAmount || 0,
              inv.waterPrev || 0,
              inv.waterCurr || 0,
              waterUnits >= 0 ? waterUnits : 0,
              inv.waterAmount || 0,
              inv.rentAmount || 0,
              inv.trashFee !== undefined ? inv.trashFee : 20,
              inv.internetFee || 0,
              inv.commonFee || 0,
              inv.fineAmount || 0,
              otherAmt,
              inv.totalAmount || 0,
              statusStr
            ];
          });
          
          try {
            ExportService.exportToCSV(`สำรองบิล_${selectedMonth}.csv`, headers, rows);
          } catch (csvErr) {
            console.error("Local CSV download failed:", csvErr);
          }

          // Delete invoices from active state client-side
          this.state.invoices = this.state.invoices.filter(i => i.monthKey !== selectedMonth);
          
          // Save state, which syncs the clean invoices database state to Supabase
          await DBService.saveState(this.state);
          
          alert(`📦 สำรองบิลรอบเดือน ${Formatters.thaiMonthBE(selectedMonth)} สำเร็จ!\n\n1. ดาวน์โหลดเป็นไฟล์ Excel (.csv) ลงเครื่องเรียบร้อย\n2. บันทึกข้อมูลและล้างบิลเก่าออกจากระบบ Supabase เรียบร้อยครับ`);
          modal.classList.remove('active');
          this.switchTab('billing');
        } catch (err) {
          console.error("Archive request failed:", err);
          alert("❌ ไม่สามารถบันทึกข้อมูลสำรองได้: " + err.message);
        } finally {
          syncLoader.remove();
        }
      }
    });

    const closeBtns = dialog.querySelectorAll('.close-modal-btn');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => modal.classList.remove('active'));
    });

    modal.classList.add('active');
  }

  static openCreateBillModal(preselectedRoom = null) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');
    dialog.style.maxWidth = '95vw';
    dialog.style.width = '1000px';

    const getRoomPrevMeters = (room) => {
      if (!room) return { elecPrev: 0, waterPrev: 0 };
      let elecPrev = room.lastElecMeter;
      let waterPrev = room.lastWaterMeter;
      if (elecPrev === undefined || waterPrev === undefined || elecPrev === null || waterPrev === null) {
        const roomInvoices = (this.state.invoices || [])
          .filter(i => i.roomId === room.id)
          .sort((a, b) => (b.monthKey || '').localeCompare(a.monthKey || ''));
        if (roomInvoices.length > 0) {
          elecPrev = roomInvoices[0].elecCurr ?? 0;
          waterPrev = roomInvoices[0].waterCurr ?? 0;
        } else {
          elecPrev = 0;
          waterPrev = 0;
        }
      }
      return { elecPrev, waterPrev };
    };

    const getNextMonth05 = (monthStr) => {
      if (!monthStr) return "";
      const [year, month] = monthStr.split('-').map(Number);
      let nextMonth = month + 1;
      let nextYear = year;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
      }
      const nextMonthFormatted = String(nextMonth).padStart(2, '0');
      return `${nextYear}-${nextMonthFormatted}-05`;
    };

    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const defaultDueDate = getNextMonth05(currentMonthStr);
    
    // Sort and filter rooms: show only preselectedRoom if provided, otherwise all rooms
    const rooms = preselectedRoom 
      ? [preselectedRoom] 
      : [...this.state.rooms].sort(DBService.compareRooms);

    // Build map of previous readings for each room
    const prevReadings = {};
    rooms.forEach(r => {
      prevReadings[r.id] = getRoomPrevMeters(r);
    });

    // Load any existing temporary meter readings from state
    if (!this.state.tempMeterReadings) this.state.tempMeterReadings = [];

    // History stack and undo stack
    const undoStack = [];
    const editHistory = [];
    let autoSaveTimeout = null;

    // Helper to calculate total amount for a row
    const calculateRowTotal = (roomId, elecCurr, waterCurr, fineAmount) => {
      const room = this.state.rooms.find(r => r.id === roomId);
      if (!room) return 0;
      const prev = prevReadings[roomId];
      const elecPrev = prev.elecPrev;
      const waterPrev = prev.waterPrev;
      
      const elecUnits = Math.max(0, (parseFloat(elecCurr) || 0) - elecPrev);
      const waterUnits = Math.max(0, (parseFloat(waterCurr) || 0) - waterPrev);
      const elecAmt = elecUnits * (this.state.rates.electricityRate || 8);
      const waterAmt = waterUnits * (this.state.rates.waterRate || 20);
      const rentAmt = DBService.getRoomRent(room);
      const fees = getRoomFees(room, this.state.rates);
      const trashFee = fees.trashFee;
      const internetFee = fees.internetFee;
      const commonFee = fees.commonFee;
      const fineAmt = parseFloat(fineAmount) || 0;
      return rentAmt + elecAmt + waterAmt + trashFee + internetFee + commonFee + fineAmt;
    };

    const renderExcelRows = () => {
      return rooms.map((r, index) => {
        const prev = prevReadings[r.id];
        const elecCurr = r.tempElecMeter !== undefined && r.tempElecMeter !== null ? r.tempElecMeter : '';
        const waterCurr = r.tempWaterMeter !== undefined && r.tempWaterMeter !== null ? r.tempWaterMeter : '';
        const fineAmount = r.tempFineAmount !== undefined && r.tempFineAmount !== null ? r.tempFineAmount : 0;
        const total = calculateRowTotal(r.id, elecCurr, waterCurr, fineAmount);

        const isElecError = elecCurr !== '' && parseFloat(elecCurr) < prev.elecPrev;
        const isWaterError = waterCurr !== '' && parseFloat(waterCurr) < prev.waterPrev;

        return `
          <tr data-room-id="${r.id}" data-index="${index}">
            <td style="font-weight:700; text-align:center; background:#f8fafc; color:#334155;">ห้อง ${r.name}</td>
            <td style="font-size:0.82rem; color:#475569;">${r.currentTenantName || '<span class="text-muted">(ห้องว่าง)</span>'}</td>
            <td style="text-align:right; font-weight:600; color:#64748b; background:#f8fafc;">${prev.elecPrev}</td>
            <td>
              <input type="number" 
                class="excel-input elec-input ${isElecError ? 'excel-input-error' : ''}" 
                data-room-id="${r.id}" 
                data-col="elec"
                value="${elecCurr}" 
                placeholder="กรอกเลข...">
            </td>
            <td class="elec-usage-cell" style="text-align:right; font-weight:600;">${elecCurr === '' ? '-' : Math.max(0, parseFloat(elecCurr) - prev.elecPrev)}</td>
            <td style="text-align:right; font-weight:600; color:#64748b; background:#f8fafc;">${prev.waterPrev}</td>
            <td>
              <input type="number" 
                class="excel-input water-input ${isWaterError ? 'excel-input-error' : ''}" 
                data-room-id="${r.id}" 
                data-col="water"
                value="${waterCurr}" 
                placeholder="กรอกเลข...">
            </td>
            <td class="water-usage-cell" style="text-align:right; font-weight:600;">${waterCurr === '' ? '-' : Math.max(0, parseFloat(waterCurr) - prev.waterPrev)}</td>
            <td>
              <input type="number" 
                class="excel-input fine-input" 
                data-room-id="${r.id}" 
                data-col="fine"
                value="${fineAmount}" 
                placeholder="0">
            </td>
            <td class="total-cell" style="text-align:right; font-weight:800; color:var(--primary); background:#f0f7ff;">
              ฿${total.toLocaleString()}
            </td>
          </tr>
        `;
      }).join('');
    };

    dialog.innerHTML = `
      <div class="modal-header">
        <h3 style="display:flex; align-items:center; gap:0.5rem;"><i class="fa-solid fa-table text-primary"></i> กรอกค่าน้ำไฟประจำเดือน (Excel Grid View)</h3>
        <span id="excel-sync-indicator" style="font-size:0.8rem; color:#10b981; font-weight:600; margin-left:1rem; display:none;"><i class="fa-solid fa-circle-check"></i> บันทึกอัตโนมัติเรียบร้อย</span>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body" style="padding:0.75rem;">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
          <div class="form-group">
            <label style="font-weight:700;">รอบเดือนบิล *</label>
            <input type="month" id="excel-bill-month" class="form-control" value="${currentMonthStr}" required>
          </div>
          <div class="form-group">
            <label style="font-weight:700;">กำหนดชำระ *</label>
            <input type="date" id="excel-due-date" class="form-control" value="${defaultDueDate}" required>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; background:#f8fafc; padding:0.5rem 1rem; border-radius:8px; border:1px solid #e2e8f0;">
          <span style="font-size:0.8rem; color:#64748b; font-weight:600;">
            💡 เคล็ดลับ: ใช้ <b>ปุ่มลูกศร (Up/Down)</b> หรือ <b>Enter/Tab</b> เคลื่อนย้าย และสามารถ <b>ก๊อปค่าน้ำไฟจาก Excel แล้วกด Ctrl+V วางได้โดยตรง</b>
          </span>
          <button class="btn btn-secondary btn-sm" id="btn-excel-undo" title="ย้อนกลับการแก้ไข (Ctrl+Z)" disabled>
            <i class="fa-solid fa-arrow-rotate-left"></i> ย้อนกลับ (Undo)
          </button>
        </div>

        <div style="max-height: 48vh; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <table class="custom-table" style="margin:0; width:100%; border-collapse:collapse; min-width:800px;">
            <thead style="position: sticky; top: 0; z-index: 100; background:#f1f5f9;">
              <tr>
                <th style="width:100px; text-align:center;">ห้อง</th>
                <th style="width:140px;">ผู้เช่า</th>
                <th style="width:90px; text-align:right;">ไฟครั้งก่อน</th>
                <th style="width:110px;">ไฟครั้งนี้</th>
                <th style="width:90px; text-align:right;">หน่วยใช้ไป</th>
                <th style="width:90px; text-align:right;">น้ำครั้งก่อน</th>
                <th style="width:110px;">น้ำครั้งนี้</th>
                <th style="width:90px; text-align:right;">หน่วยใช้ไป</th>
                <th style="width:100px;">ค่าปรับ/อื่นๆ</th>
                <th style="width:120px; text-align:right;">ยอดรวมสุทธิ</th>
              </tr>
            </thead>
            <tbody id="excel-grid-body">
              ${renderExcelRows()}
            </tbody>
          </table>
        </div>

        <!-- History Panel -->
        <div style="margin-top:0.75rem; background:#fafafa; border:1px solid #e2e8f0; border-radius:8px; padding:0.65rem 1rem;">
          <h4 style="font-size:0.82rem; color:#334155; margin-bottom:0.35rem; display:flex; align-items:center; gap:0.25rem;"><i class="fa-solid fa-clock-rotate-left"></i> ประวัติการแก้ไขล่าสุด:</h4>
          <div id="excel-history-log" style="max-height:80px; overflow-y:auto; font-size:0.78rem; color:#64748b; line-height:1.45;">
            <span style="font-style:italic;">ยังไม่มีประวัติการแก้ไขในเซสชันนี้</span>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem; position:sticky; bottom:0; background:#ffffff; padding:0.5rem 0;">
          <button class="btn btn-secondary" id="btn-excel-close">ปิดหน้าต่าง</button>
          <button class="btn btn-primary" id="btn-excel-save-all" style="min-width:180px;"><i class="fa-solid fa-file-invoice"></i> บันทึกและออกบิลทั้งหมด</button>
        </div>
      </div>
    `;

    modal.classList.add('active');
    
    const styleTagId = 'excel-spreadsheet-styles';
    if (!document.getElementById(styleTagId)) {
      const styles = document.createElement('style');
      styles.id = styleTagId;
      styles.innerHTML = `
        .excel-input {
          width: 100%;
          border: 1px solid transparent;
          background: transparent;
          padding: 0.35rem 0.5rem;
          text-align: right;
          font-family: inherit;
          font-size: 0.9rem;
          font-weight: 600;
          color: inherit;
          border-radius: 4px;
          outline: none;
          transition: all 0.15s;
        }
        .excel-input:hover {
          border-color: #cbd5e1;
          background: #ffffff;
        }
        .excel-input:focus {
          border-color: var(--primary);
          background: #ffffff;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }
        .excel-input-error {
          border-color: var(--danger) !important;
          background-color: #fef2f2 !important;
          color: var(--danger) !important;
        }
        body.dark .excel-input:focus {
          background-color: #0d1527;
        }
        body.dark .excel-input:hover {
          border-color: #475569;
          background-color: #1e293b;
        }
      `;
      document.head.appendChild(styles);
    }

    const gridBody = document.getElementById('excel-grid-body');
    const monthInput = document.getElementById('excel-bill-month');
    const dueDateInput = document.getElementById('excel-due-date');
    const undoBtn = document.getElementById('btn-excel-undo');
    const historyLog = document.getElementById('excel-history-log');
    const indicator = document.getElementById('excel-sync-indicator');

    if (monthInput && dueDateInput) {
      monthInput.addEventListener('change', (e) => {
        dueDateInput.value = getNextMonth05(e.target.value);
      });
    }

    const pushUndo = (roomId, col, oldVal, newVal) => {
      undoStack.push({ roomId, col, oldVal, newVal });
      undoBtn.disabled = false;
    };

    const addHistory = (logText) => {
      editHistory.unshift(`[${new Date().toLocaleTimeString()}] ${logText}`);
      historyLog.innerHTML = editHistory.map(h => `<div>${h}</div>`).join('');
    };

    const updateRowLive = (tr) => {
      const roomId = tr.getAttribute('data-room-id');
      const prev = prevReadings[roomId];
      
      const elecInput = tr.querySelector('.elec-input');
      const waterInput = tr.querySelector('.water-input');
      const fineInput = tr.querySelector('.fine-input');

      const elecCurr = elecInput.value;
      const waterCurr = waterInput.value;
      const fineVal = fineInput.value;

      if (elecCurr !== '' && parseFloat(elecCurr) < prev.elecPrev) {
        elecInput.classList.add('excel-input-error');
      } else {
        elecInput.classList.remove('excel-input-error');
      }

      if (waterCurr !== '' && parseFloat(waterCurr) < prev.waterPrev) {
        waterInput.classList.add('excel-input-error');
      } else {
        waterInput.classList.remove('excel-input-error');
      }

      const elecUsageCell = tr.querySelector('.elec-usage-cell');
      const waterUsageCell = tr.querySelector('.water-usage-cell');
      const totalCell = tr.querySelector('.total-cell');

      const elecUnits = elecCurr === '' ? 0 : Math.max(0, parseFloat(elecCurr) - prev.elecPrev);
      const waterUnits = waterCurr === '' ? 0 : Math.max(0, parseFloat(waterCurr) - prev.waterPrev);

      elecUsageCell.textContent = elecCurr === '' ? '-' : elecUnits;
      waterUsageCell.textContent = waterCurr === '' ? '-' : waterUnits;

      const total = calculateRowTotal(roomId, elecCurr, waterCurr, fineVal);
      totalCell.textContent = `฿${total.toLocaleString()}`;
    };

    const updateTempReadingsInMemory = () => {
      const trs = gridBody.querySelectorAll('tr');
      trs.forEach(tr => {
        const roomId = tr.getAttribute('data-room-id');
        const room = this.state.rooms.find(r => r.id === roomId);
        if (room) {
          const elecCurr = tr.querySelector('.elec-input').value;
          const waterCurr = tr.querySelector('.water-input').value;
          const fineAmount = tr.querySelector('.fine-input').value;
          
          room.tempElecMeter = elecCurr === '' ? null : parseFloat(elecCurr);
          room.tempWaterMeter = waterCurr === '' ? null : parseFloat(waterCurr);
          room.tempFineAmount = fineAmount === '' ? 0 : parseFloat(fineAmount);
        }
      });
    };

    const debounceSaveState = () => {
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        DBService.saveState(this.state, true).then(() => {
          indicator.style.display = 'inline-block';
          setTimeout(() => {
            indicator.style.display = 'none';
          }, 2000);
        });
      }, 1500);
    };

    const saveTempReadingsToState = () => {
      updateTempReadingsInMemory();
      debounceSaveState();
    };

    gridBody.addEventListener('focusin', (e) => {
      if (e.target.classList.contains('excel-input')) {
        e.target.select();
      }
    });

    gridBody.addEventListener('change', (e) => {
      if (e.target.classList.contains('excel-input')) {
        const input = e.target;
        const tr = input.closest('tr');
        const roomId = tr.getAttribute('data-room-id');
        const roomName = tr.querySelector('td').textContent;
        const col = input.getAttribute('data-col');
        const newVal = input.value;
        
        const room = this.state.rooms.find(r => r.id === roomId);
        const oldVal = room ? (col === 'elec' ? room.tempElecMeter : (col === 'water' ? room.tempWaterMeter : room.tempFineAmount)) : null;
        
        pushUndo(roomId, col, oldVal, newVal);
        
        const colLabel = col === 'elec' ? 'เลขไฟ' : (col === 'water' ? 'เลขน้ำ' : 'ค่าปรับ');
        addHistory(`แก้ไข ${roomName} (${colLabel}) จาก [${oldVal ?? 'ว่าง'}] เป็น [${newVal}]`);
        
        saveTempReadingsToState();
      }
    });

    gridBody.addEventListener('input', (e) => {
      if (e.target.classList.contains('excel-input')) {
        updateRowLive(e.target.closest('tr'));
        updateTempReadingsInMemory();
        debounceSaveState();
      }
    });

    gridBody.addEventListener('wheel', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
        e.preventDefault();
      }
    }, { passive: false });

    gridBody.addEventListener('keydown', (e) => {
      if (!e.target.classList.contains('excel-input')) return;
      
      const input = e.target;
      const col = input.getAttribute('data-col');
      const tr = input.closest('tr');
      const index = parseInt(tr.getAttribute('data-index'));
      const colClass = col === 'elec' ? '.elec-input' : (col === 'water' ? '.water-input' : '.fine-input');

      let targetTr = null;
      let targetInput = null;

      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        targetTr = gridBody.querySelector(`tr[data-index="${index + 1}"]`);
        if (targetTr) targetInput = targetTr.querySelector(colClass);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        targetTr = gridBody.querySelector(`tr[data-index="${index - 1}"]`);
        if (targetTr) targetInput = targetTr.querySelector(colClass);
      } else if (e.key === 'ArrowRight' && input.selectionEnd === input.value.length) {
        const nextCol = col === 'elec' ? '.water-input' : (col === 'water' ? '.fine-input' : null);
        if (nextCol) targetInput = tr.querySelector(nextCol);
      } else if (e.key === 'ArrowLeft' && input.selectionStart === 0) {
        const prevCol = col === 'fine' ? '.water-input' : (col === 'water' ? '.elec-input' : null);
        if (prevCol) targetInput = tr.querySelector(prevCol);
      }

      if (targetInput) {
        targetInput.focus();
        targetInput.select();
      }
    });

    gridBody.addEventListener('paste', (e) => {
      if (!e.target.classList.contains('excel-input')) return;
      e.preventDefault();
      
      const clipboardData = e.clipboardData || window.clipboardData;
      const pastedText = clipboardData.getData('text');
      if (!pastedText) return;

      const activeInput = e.target;
      const activeCol = activeInput.getAttribute('data-col');
      const activeTr = activeInput.closest('tr');
      const startIndex = parseInt(activeTr.getAttribute('data-index'));

      const pasteRows = pastedText.split(/\r?\n/).map(row => row.split('\t'));
      
      pasteRows.forEach((rowData, rIdx) => {
        if (rowData.length === 1 && rowData[0] === "") return;
        const targetIndex = startIndex + rIdx;
        const tr = gridBody.querySelector(`tr[data-index="${targetIndex}"]`);
        if (!tr) return;

        const roomId = tr.getAttribute('data-room-id');
        const roomName = tr.querySelector('td').textContent;

        rowData.forEach((val, cIdx) => {
          let targetCol = null;
          if (activeCol === 'elec') {
            targetCol = cIdx === 0 ? 'elec' : (cIdx === 1 ? 'water' : (cIdx === 2 ? 'fine' : null));
          } else if (activeCol === 'water') {
            targetCol = cIdx === 0 ? 'water' : (cIdx === 1 ? 'fine' : null);
          } else if (activeCol === 'fine') {
            targetCol = cIdx === 0 ? 'fine' : null;
          }

          if (!targetCol) return;
          const selector = targetCol === 'elec' ? '.elec-input' : (targetCol === 'water' ? '.water-input' : '.fine-input');
          const input = tr.querySelector(selector);

          if (input) {
            const cleanVal = val.replace(/[^0-9.]/g, '');
            if (cleanVal !== '') {
              const oldVal = input.value;
              input.value = cleanVal;
              pushUndo(roomId, targetCol, oldVal, cleanVal);
              addHistory(`คัดลอกวาง ${roomName} (${targetCol}) จาก [${oldVal || 'ว่าง'}] เป็น [${cleanVal}]`);
            }
          }
        });
        updateRowLive(tr);
      });

      saveTempReadingsToState();
      if (indicator) {
        indicator.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> วางข้อมูลจาก Excel เรียบร้อยแล้ว!';
        indicator.style.display = 'inline-block';
        setTimeout(() => {
          indicator.style.display = 'none';
          indicator.innerHTML = '<i class="fa-solid fa-circle-check"></i> บันทึกอัตโนมัติเรียบร้อย';
        }, 3000);
      }
    });

    undoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (undoStack.length === 0) return;
      
      const lastAction = undoStack.pop();
      const tr = gridBody.querySelector(`tr[data-room-id="${lastAction.roomId}"]`);
      if (tr) {
        const selector = lastAction.col === 'elec' ? '.elec-input' : (lastAction.col === 'water' ? '.water-input' : '.fine-input');
        const input = tr.querySelector(selector);
        if (input) {
          input.value = lastAction.oldVal ?? '';
          updateRowLive(tr);
          const roomName = tr.querySelector('td').textContent;
          addHistory(`Undo ย้อนกลับ ${roomName} จาก [${lastAction.newVal}] กลับเป็น [${lastAction.oldVal ?? 'ว่าง'}]`);
          saveTempReadingsToState();
        }
      }
      if (undoStack.length === 0) undoBtn.disabled = true;
    });

    const handleCtrlZ = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoBtn.click();
      }
    };
    document.addEventListener('keydown', handleCtrlZ);

    const handleClose = () => {
      document.removeEventListener('keydown', handleCtrlZ);
      modal.classList.remove('active');
    };
    
    document.getElementById('btn-excel-close').addEventListener('click', handleClose);
    modal.querySelector('.close-modal-btn').addEventListener('click', handleClose);

    document.getElementById('btn-excel-save-all').addEventListener('click', async (e) => {
      e.preventDefault();
      
      const monthKey = monthInput.value;
      const dueDate = dueDateInput.value;
      if (!monthKey || !dueDate) return alert('กรุณาระบุเดือนและกำหนดชำระบิล');

      const errorInputs = gridBody.querySelectorAll('.excel-input-error');
      if (errorInputs.length > 0) {
        if (!confirm('⚠️ ตรวจพบมิเตอร์ไฟหรือน้ำน้อยกว่าครั้งก่อนในบางห้อง ต้องการละเว้นและออกบิลต่อไปใช่หรือไม่?')) {
          return;
        }
      }
      const forceOverride = errorInputs.length > 0; // ผู้ใช้ยืนยันแล้วว่าจะออกบิลต่อแม้เลขมิเตอร์น้อยกว่าเดิม

      const saveBtn = document.getElementById('btn-excel-save-all');
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกและสร้างบิลทั้งหมด...';

      try {
        const trs = Array.from(gridBody.querySelectorAll('tr'));
        let generatedCount = 0;
        const errorMessages = [];

        // ออกบิลทีละห้องผ่าน RPC เดียว (generate_room_invoice) — รับมิเตอร์ → คำนวณ →
        // อัปเดตห้อง + สร้าง/เขียนทับบิล ในทรานแซกชันเดียวฝั่ง Postgres
        for (const tr of trs) {
          const roomId = tr.getAttribute('data-room-id');
          const room = this.state.rooms.find(r => r.id === roomId);
          if (!room || (room.status !== 'occupied' && room.status !== 'overdue')) continue;

          const elecCurrVal = tr.querySelector('.elec-input').value;
          const waterCurrVal = tr.querySelector('.water-input').value;
          const fineVal = tr.querySelector('.fine-input').value;
          if (elecCurrVal === '' || waterCurrVal === '') continue;

          const elecCurr = parseFloat(elecCurrVal) || 0;
          const waterCurr = parseFloat(waterCurrVal) || 0;
          const fineAmt = parseFloat(fineVal) || 0;
          const fees = getRoomFees(room, this.state.rates);

          let result;
          try {
            result = await DBService.callRpc('generate_room_invoice', {
              p_room_id: room.id,
              p_month_key: monthKey,
              p_elec_curr: elecCurr,
              p_water_curr: waterCurr,
              p_issue_date: new Date().toISOString().slice(0, 10),
              p_due_date: dueDate,
              p_fine_amount: fineAmt,
              p_force: forceOverride,
              p_internet_fee: fees.internetFee,
              p_common_fee: fees.commonFee
            });
          } catch (rpcErr) {
            errorMessages.push(`ห้อง ${room.name}: ${rpcErr.message}`);
            continue;
          }

          if (!result || result.status === 'error') {
            errorMessages.push(result && result.message ? result.message : `ห้อง ${room.name}: ออกบิลไม่สำเร็จ`);
            continue;
          }
          generatedCount++;
        }

        if (generatedCount === 0) {
          let errMsg = 'ไม่มีการออกบิลเพิ่มเติม (ไม่มีห้องที่กรอกเลขมิเตอร์ครบ)';
          if (errorMessages.length > 0) errMsg += '\n\n' + errorMessages.join('\n');
          throw new Error(errMsg);
        }

        // ดึงข้อมูลล่าสุดจาก Supabase (rooms/invoices ที่ RPC เพิ่งอัปเดตคือค่าจริงในฐานข้อมูลแล้ว)
        const savedUrl = DBService.getSavedSupabaseUrl();
        const syncUrl = savedUrl + (savedUrl.includes('?') ? '&merge=true' : '?merge=true');
        const refreshedState = await DBService.pullFromSupabase(syncUrl);
        if (refreshedState) this.state = refreshedState;
        this.state.tempMeterReadings = [];
        localStorage.setItem(DBService.STORAGE_KEY, JSON.stringify(this.state));

        let msg = `✅ ประมวลผลออกบิลและบันทึกข้อมูลสำเร็จรวม ${generatedCount} ห้องพัก!`;
        if (errorMessages.length > 0) msg += `\n\n⚠️ ห้องที่ข้าม/เกิดข้อผิดพลาด:\n` + errorMessages.join('\n');
        alert(msg);
        handleClose();
        this.switchTab('billing');
      } catch (err) {
        alert('⚠️ เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-file-invoice"></i> บันทึกและออกบิลทั้งหมด';
      }
    });
  }

  // --- 4. REPAIRS EVENTS ---
  static bindRepairsEvents() {
    const addRepairBtn = document.getElementById('btn-add-repair');
    if (addRepairBtn) {
      addRepairBtn.addEventListener('click', () => this.openRepairModal());
    }

    document.querySelectorAll('.btn-toggle-repair').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const rep = this.state.repairs.find(r => r.id === id);
        if (rep) {
          rep.status = rep.status === 'completed' ? 'pending' : 'completed';
          DBService.saveState(this.state);
          this.switchTab('repairs');
        }
      });
    });

    document.querySelectorAll('.btn-delete-repair').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('ลบรายการแจ้งซ่อมนี้ใช่หรือไม่?')) {
          const idx = this.state.repairs.findIndex(r => r.id === id);
          if (idx !== -1) {
            this.state.repairs.splice(idx, 1);
            DBService.saveState(this.state);
            this.switchTab('repairs');
          }
        }
      });
    });
  }

  static openRepairModal() {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-screwdriver-wrench text-primary"></i> บันทึกใบแจ้งซ่อมห้องพักใหม่</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="repair-form">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>เลือกห้องพัก *</label>
              <select id="rep-room" class="form-control" required>
                ${this.state.rooms.map(r => `<option value="${r.id}">ห้อง ${r.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>หัวข้อแจ้งซ่อม *</label>
              <input type="text" id="rep-title" class="form-control" placeholder="แอร์ไม่เย็น / ท่อน้ำรั่ว" required>
            </div>
          </div>
          <div class="form-group">
            <label>รายละเอียด:</label>
            <input type="text" id="rep-desc" class="form-control" placeholder="รายละเอียดอาการชำรุด">
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>ช่างผู้ดูแล:</label>
              <input type="text" id="rep-tech" class="form-control" placeholder="ช่างสมศักดิ์ แอร์เซอร์วิส">
            </div>
            <div class="form-group">
              <label>ค่าซ่อมบำรุง (บาท):</label>
              <input type="number" id="rep-expense" class="form-control" value="0">
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top:1rem;"><i class="fa-solid fa-floppy-disk"></i> บันทึกใบแจ้งซ่อม</button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('repair-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const roomId = document.getElementById('rep-room').value;
      const room = this.state.rooms.find(r => r.id === roomId);

      const newRep = {
        id: 'rep_' + Date.now(),
        ticketNumber: `REP-2026-${Math.floor(100 + Math.random() * 900)}`,
        roomId: room ? room.id : '',
        roomName: room ? room.name : '',
        tenantName: room ? room.currentTenantName : '',
        title: document.getElementById('rep-title').value,
        description: document.getElementById('rep-desc').value,
        category: 'general',
        requestDate: new Date().toISOString().slice(0, 10),
        status: 'pending',
        expenseAmount: parseFloat(document.getElementById('rep-expense').value) || 0,
        assignedTechnician: document.getElementById('rep-tech').value
      };

      if (!this.state.repairs) this.state.repairs = [];
      this.state.repairs.unshift(newRep);
      DBService.saveState(this.state);
      modal.classList.remove('active');
      this.switchTab('repairs');
    });
  }

  // --- 5. ACCOUNTING EVENTS ---
  static bindAccountingEvents() {
    const addLedgerBtn = document.getElementById('btn-add-ledger');
    if (addLedgerBtn) {
      addLedgerBtn.addEventListener('click', () => this.openLedgerModal());
    }

    document.querySelectorAll('.btn-delete-ledger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('ลบรายการบัญชีนี้ใช่หรือไม่?')) {
          const idx = this.state.ledger.findIndex(l => l.id === id);
          if (idx !== -1) {
            this.state.ledger.splice(idx, 1);
            DBService.saveState(this.state);
            this.switchTab('accounting');
          }
        }
      });
    });
  }

  static openLedgerModal() {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-scale-balanced text-primary"></i> บันทึกรายการ รายรับ - รายจ่าย</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="ledger-form">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>ประเภทรายการ *</label>
              <select id="led-type" class="form-control" required>
                <option value="income">📈 รายรับ</option>
                <option value="expense">📉 รายจ่าย</option>
              </select>
            </div>
            <div class="form-group">
              <label>หมวดหมู่ *</label>
              <input type="text" id="led-cat" class="form-control" placeholder="ค่าเช่าห้อง / ค่าแม่บ้าน / ค่าซ่อม" required>
            </div>
          </div>
          <div class="form-group">
            <label>รายละเอียดรายการ *</label>
            <input type="text" id="led-desc" class="form-control" placeholder="รับชำระค่าเช่าห้อง A101" required>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>จำนวนเงิน (บาท) *</label>
              <input type="number" id="led-amt" class="form-control" placeholder="3500" required>
            </div>
            <div class="form-group">
              <label>วันที่ *</label>
              <input type="date" id="led-date" class="form-control" value="${new Date().toISOString().slice(0, 10)}" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top:1rem;"><i class="fa-solid fa-floppy-disk"></i> บันทึกรายการลงบัญชี</button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('ledger-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const newLed = {
        id: 'led_' + Date.now(),
        date: document.getElementById('led-date').value,
        type: document.getElementById('led-type').value,
        category: document.getElementById('led-cat').value,
        description: document.getElementById('led-desc').value,
        amount: parseFloat(document.getElementById('led-amt').value) || 0,
        recordedBy: 'admin'
      };

      if (!this.state.ledger) this.state.ledger = [];
      this.state.ledger.unshift(newLed);
      DBService.saveState(this.state);
      modal.classList.remove('active');
      this.switchTab('accounting');
    });
  }

  // --- 6. CALENDAR EVENTS ---
  static bindCalendarEvents() {
    const addEvtBtn = document.getElementById('btn-add-event');
    if (addEvtBtn) {
      addEvtBtn.addEventListener('click', () => this.openEventModal());
    }

    document.querySelectorAll('.btn-delete-event').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('ลบวันนัดหมายนี้ใช่หรือไม่?')) {
          const idx = this.state.events.findIndex(ev => ev.id === id);
          if (idx !== -1) {
            this.state.events.splice(idx, 1);
            DBService.saveState(this.state);
            this.switchTab('calendar');
          }
        }
      });
    });
  }

  static openEventModal() {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-calendar-plus text-primary"></i> เพิ่มวันนัดหมายในปฏิทิน</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="event-form">
          <div class="form-group">
            <label>หัวข้อนัดหมาย *</label>
            <input type="text" id="evt-title" class="form-control" placeholder="นัดช่างมาล้างแอร์ ชั้น 1" required>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>วันที่นัดหมาย *</label>
              <input type="date" id="evt-date" class="form-control" value="${new Date().toISOString().slice(0, 10)}" required>
            </div>
            <div class="form-group">
              <label>หมวดหมู่ *</label>
              <input type="text" id="evt-cat" class="form-control" value="ซ่อมบำรุง" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top:1rem;"><i class="fa-solid fa-floppy-disk"></i> เพิ่มวันนัดหมาย</button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('event-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const newEvt = {
        id: 'evt_' + Date.now(),
        title: document.getElementById('evt-title').value,
        date: document.getElementById('evt-date').value,
        category: document.getElementById('evt-cat').value,
        roomName: 'ทั่วไป'
      };

      if (!this.state.events) this.state.events = [];
      this.state.events.unshift(newEvt);
      DBService.saveState(this.state);
      modal.classList.remove('active');
      this.switchTab('calendar');
    });
  }

  // --- 7. REPORTS & BACKUP EVENTS ---
  static bindReportsEvents() {
    const expInc = document.querySelector('.btn-export-income-report');
    if (expInc) {
      expInc.addEventListener('click', () => {
        const headers = ['เลขที่บิล', 'รอบเดือน', 'ห้อง', 'ผู้เช่า', 'ค่าเช่า', 'ค่าไฟ', 'ค่าน้ำ', 'ค่าขยะ', 'ยอดสุทธิ', 'สถานะ'];
        const rows = this.state.invoices.map(i => [i.invoiceNumber, i.monthKey, i.roomName, i.tenantName, i.rentAmount, i.elecAmount, i.waterAmount, i.trashFee || 0, i.totalAmount, i.status === 'paid' ? 'ชำระแล้ว' : 'ค้างชำระ']);
        ExportService.exportToExcel('รายงานรายรับประจำเดือน_Sombat.xlsx', [{ name: 'รายงานรายรับ', headers, rows }]);
      });
    }

    const expOvd = document.querySelector('.btn-export-overdue-report');
    if (expOvd) {
      expOvd.addEventListener('click', () => {
        const headers = ['เลขที่บิล', 'ห้อง', 'ผู้เช่า', 'ยอดค้างชำระ', 'กำหนดชำระ'];
        const rows = this.state.invoices.filter(i => i.status === 'unpaid').map(i => [i.invoiceNumber, i.roomName, i.tenantName, i.outstandingAmount || i.totalAmount, i.dueDate]);
        ExportService.exportToExcel('รายงานผู้เช่าค้างชำระ_Sombat.xlsx', [{ name: 'ยอดค้างชำระ', headers, rows }]);
      });
    }

    const expMtr = document.querySelector('.btn-export-meter-report');
    if (expMtr) {
      expMtr.addEventListener('click', () => {
        const headers = ['ห้องพัก', 'มิเตอร์ไฟครั้งก่อน', 'มิเตอร์ไฟครั้งนี้', 'หน่วยไฟที่ใช้', 'มิเตอร์น้ำครั้งก่อน', 'มิเตอร์น้ำครั้งนี้', 'หน่วยน้ำที่ใช้'];
        const rows = this.state.invoices.map(i => [i.roomName, i.elecPrev, i.elecCurr, (i.elecCurr - i.elecPrev) || 0, i.waterPrev, i.waterCurr, (i.waterCurr - i.waterPrev) || 0]);
        ExportService.exportToExcel('รายงานมิเตอร์น้ำไฟ_Sombat.xlsx', [{ name: 'มิเตอร์น้ำไฟ', headers, rows }]);
      });
    }

    const expCtr = document.querySelector('.btn-export-contracts-report');
    if (expCtr) {
      expCtr.addEventListener('click', () => {
        const headers = ['ผู้เช่า', 'เลขบัตรประชาชน', 'เบอร์โทร', 'ห้องพัก', 'วันเริ่มสัญญา', 'วันหมดสัญญา'];
        const rows = this.state.tenants.map(t => {
          const room = this.state.rooms.find(r => r.id === t.assignedRoomId);
          return [t.name, Formatters.formatIdCard(t.idCard), t.tel, room ? room.name : '-', t.startDate || '-', t.endDate || '-'];
        });
        ExportService.exportToExcel('รายงานทะเบียนสัญญาเช่า_Sombat.xlsx', [{ name: 'ทะเบียนสัญญาเช่า', headers, rows }]);
      });
    }

    // Full Backup Excel & JSON
    const btnFullExcel = document.getElementById('btn-full-backup-excel');
    if (btnFullExcel) {
      btnFullExcel.addEventListener('click', () => {
        ExportService.exportFullBackupExcel(this.state);
      });
    }

    const btnFullJson = document.getElementById('btn-full-backup-json');
    if (btnFullJson) {
      btnFullJson.addEventListener('click', () => {
        DBService.exportJSON();
      });
    }

    // Restore Data File Input Handler
    const btnRestore = document.getElementById('btn-trigger-restore');
    const restoreInput = document.getElementById('restore-file-input');

    if (btnRestore && restoreInput) {
      btnRestore.addEventListener('click', () => restoreInput.click());

      restoreInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const parsed = await ImportService.parseFile(file);
          this.openRestorePreviewModal(parsed);
        } catch (err) {
          alert('❌ ไม่สามารถอ่านไฟล์สำรองได้: ' + err.message);
        }
        restoreInput.value = '';
      });
    }

    // 1. ปุ่ม "เริ่มใช้งานจริง" (Start Production Mode / Remove Demo Data - ใช้ครั้งเดียว)
    const btnStartProd = document.getElementById('btn-start-production');
    if (btnStartProd) {
      btnStartProd.addEventListener('click', async () => {
        if (!confirm('🚀 ยืนยันการเปลี่ยนเป็นโหมดใช้งานจริง (Start Production Mode)?\n\nระบบจะลบข้อมูลเดโม่ทั้งหมด 41 ห้อง, ผู้เช่า, บิล, แจ้งซ่อม และตั้งค่า is_demo_mode = false เพื่อปิดการสร้างห้องเดโม่อัตโนมัติถาวร ให้คุณสามารถเพิ่มห้องพักของตนเองได้ทันที')) {
          return;
        }

        btnStartProd.disabled = true;
        btnStartProd.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังลบข้อมูลเดโม่และเปลี่ยนเป็นโหมดใช้งานจริง...';

        try {
          await DBService.startProductionMode(this.state);
          alert('🟢 เปลี่ยนเป็นโหมดใช้งานจริงเรียบร้อยแล้ว! ข้อมูลเดโม่ 41 ห้องถูกลบทิ้งถาวร และระบบปิดการสร้างห้องเดโม่อัตโนมัติแล้ว คุณสามารถเพิ่มห้องพักของตนเองได้เลย');
          App.switchTab('rooms');
        } catch (err) {
          alert('❌ เกิดข้อผิดพลาดในการเปลี่ยนเป็นโหมดใช้งานจริง: ' + err.message);
          btnStartProd.disabled = false;
          btnStartProd.innerHTML = '<i class="fa-solid fa-rocket"></i> เริ่มใช้งานจริง (ลบ 41 ห้องเดโม่ & ปิด Seed ถาวร)';
        }
      });
    }

    // 2. ปุ่ม "ล้างข้อมูลการใช้งาน" (Clear Usage Data - ใช้ประจำ โดยไม่แตะห้องพัก)
    const btnClearUsage = document.getElementById('btn-clear-usage-data');
    if (btnClearUsage) {
      btnClearUsage.addEventListener('click', async () => {
        if (!confirm('🧹 ยืนยันการล้างข้อมูลการใช้งาน?\n\nระบบจะลบผู้เช่า, บิล, แจ้งซ่อม และประวัติรายรับ-รายจ่าย ทั้งหมด พร้อมรีเซ็ตสถานะห้องพักเป็นห้องว่าง (โดยห้ามลบและห้ามแตะต้องโครงสร้างห้องพักที่มีอยู่)')) {
          return;
        }

        btnClearUsage.disabled = true;
        btnClearUsage.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังล้างข้อมูลการใช้งาน...';

        try {
          await DBService.clearUsageData(this.state);
          alert('🟢 ล้างข้อมูลการใช้งานเรียบร้อยแล้ว! ผู้เช่า, บิล, แจ้งซ่อมถูกล้าง และห้องพักทุกห้องถูกรีเซ็ตเป็นห้องว่าง โดยไม่กระทบโครงสร้างห้องพัก');
          App.switchTab('rooms');
        } catch (err) {
          alert('❌ เกิดข้อผิดพลาดในการล้างข้อมูลการใช้งาน: ' + err.message);
          btnClearUsage.disabled = false;
          btnClearUsage.innerHTML = '<i class="fa-solid fa-broom"></i> ล้างข้อมูลการใช้งาน (ลบผู้เช่า/บิล โดยไม่แตะห้องพัก)';
        }
      });
    }
  }

  static openRestorePreviewModal(parsedResult) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    let previewHtml = '';
    let restoredState = null;

    if (parsedResult.type === 'json') {
      const data = parsedResult.data || {};
      const tenantCount = (data.tenants || []).length;
      const roomCount = (data.rooms || []).length;
      const invoiceCount = (data.invoices || []).length;
      const repairCount = (data.repairs || []).length;

      restoredState = data;
      previewHtml = `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem; margin-bottom:1.25rem;">
          <h4 style="margin-bottom:0.75rem; color:#0f172a;"><i class="fa-solid fa-file-code text-primary"></i> ตรวจพบข้อมูลในไฟล์ JSON Backup</h4>
          <ul style="line-height:1.8; margin-left:1.25rem; color:#334155;">
            <li><strong>รายชื่อผู้เช่า:</strong> ${tenantCount} รายการ</li>
            <li><strong>รายการห้องพัก:</strong> ${roomCount} ห้อง</li>
            <li><strong>ใบแจ้งหนี้ / ประวัติชำระ:</strong> ${invoiceCount} รายการ</li>
            <li><strong>รายการแจ้งซ่อม:</strong> ${repairCount} รายการ</li>
          </ul>
        </div>
      `;
    } else if (parsedResult.type === 'excel') {
      const wb = parsedResult.workbook || {};
      const sheetNames = Object.keys(wb);
      
      previewHtml = `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem; margin-bottom:1.25rem;">
          <h4 style="margin-bottom:0.75rem; color:#0f172a;"><i class="fa-solid fa-file-excel text-success"></i> ตรวจพบแท็บข้อมูลในไฟล์ Excel (${sheetNames.length} แท็บ)</h4>
          <ul style="line-height:1.8; margin-left:1.25rem; color:#334155;">
            ${sheetNames.map(name => `
              <li><strong>${name}:</strong> ${wb[name].rows ? wb[name].rows.length : 0} แถวข้อมูล</li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-box-archive text-warning"></i> ยืนยันการกู้คืน / นำเข้าข้อมูลระบบ (Restore Data)</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:0.85rem; font-size:0.88rem; color:#b45309; margin-bottom:1.25rem;">
          ⚠️ <strong>คำเตือน:</strong> การกู้คืนข้อมูลจะทำการอัปเดตและบันทึกฐานข้อมูลคลาวด์/ท้องถิ่นใหม่ด้วยข้อมูลจากไฟล์ กรุณาตรวจสอบความถูกต้องก่อนกดบันทึก
        </div>

        ${previewHtml}

        <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
          <button type="button" class="btn btn-secondary close-modal-btn">ยกเลิก</button>
          <button type="button" class="btn btn-warning" id="btn-confirm-do-restore" style="font-weight:700;">
            <i class="fa-solid fa-rotate-left"></i> ยืนยันกู้คืนข้อมูล
          </button>
        </div>
      </div>
    `;

    modal.classList.add('active');
    dialog.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.classList.remove('active')));

    const confirmBtn = document.getElementById('btn-confirm-do-restore');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกกู้คืน...';

        try {
          if (parsedResult.type === 'json' && restoredState) {
            this.state = { ...this.state, ...restoredState };
            await DBService.saveState(this.state);
          } else if (parsedResult.type === 'excel') {
            alert('🟢 นำเข้าไฟล์สำรอง Excel เรียบร้อยแล้ว!');
          }
          
          modal.classList.remove('active');
          alert('🟢 การกู้คืนข้อมูลสำเร็จสมบูรณ์!');
          this.render();
        } catch (err) {
          alert('❌ การกู้คืนข้อมูลล้มเหลว: ' + err.message);
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> ยืนยันกู้คืนข้อมูล';
        }
      });
    }
  }

  // --- 8. RATES & SERVICE FEES EVENTS ---
  static bindRatesEvents() {
    const mainRatesForm = document.getElementById('form-rates-main');
    if (mainRatesForm) {
      mainRatesForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.state.rates.electricityRate = parseFloat(document.getElementById('rate-elec').value) || 8.0;
        this.state.rates.waterRate = parseFloat(document.getElementById('rate-water').value) || 20.0;
        this.state.rates.trashFee = parseFloat(document.getElementById('rate-trash').value) || 20.0;
        // เว้นว่างหรือใส่ 0 = ไม่คิดค่านี้ (ไม่มี default แบบค่าเช่า/ไฟ/น้ำ/ขยะที่จำเป็นต้องมีค่า)
        this.state.rates.internetFee = parseFloat(document.getElementById('rate-internet').value) || 0;
        this.state.rates.commonFee = parseFloat(document.getElementById('rate-common').value) || 0;
        DBService.saveState(this.state);
        alert('✅ บันทึกปรับเรทค่าน้ำ ค่าไฟ และค่าขยะเรียบร้อยแล้ว!');
      });
    }

    const addFeeBtn = document.getElementById('btn-add-custom-fee');
    if (addFeeBtn) {
      addFeeBtn.addEventListener('click', () => this.openCustomFeeModal());
    }

    document.querySelectorAll('.btn-edit-custom-fee').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const fee = (this.state.rates.customFees || []).find(f => f.id === id);
        if (fee) this.openCustomFeeModal(fee);
      });
    });

    document.querySelectorAll('.btn-delete-custom-fee').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('คุณต้องการลบรายการค่าใช้จ่ายนี้ใช่หรือไม่?')) {
          const fees = this.state.rates.customFees || [];
          const idx = fees.findIndex(f => f.id === id);
          if (idx !== -1) {
            fees.splice(idx, 1);
            DBService.saveState(this.state);
            SettingsComponent.activeSection = 'rates';
            SettingsComponent.activeSection = 'users';
            this.switchTab('settings');
          }
        }
      });
    });
  }

  static openCustomFeeModal(feeToEdit = null) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');
    const isEdit = !!feeToEdit;

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid ${isEdit ? 'fa-pen text-info' : 'fa-plus text-primary'}"></i> ${isEdit ? 'แก้ไขรายการค่าใช้จ่าย' : 'เพิ่มรายการค่าใช้จ่ายใหม่'}</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="custom-fee-form">
          <div class="form-group">
            <label>ชื่อรายการค่าใช้จ่าย *</label>
            <input type="text" id="fee-name" class="form-control" value="${feeToEdit ? feeToEdit.name : ''}" placeholder="เช่น ค่าอินเทอร์เน็ต WiFi, ค่าที่จอดรถ" required>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>รูปแบบการคิดค่าบริการ *</label>
              <select id="fee-unittype" class="form-control" required>
                <option value="monthly" ${feeToEdit && feeToEdit.unitType === 'monthly' ? 'selected' : ''}>📅 คิดรายเดือน (บาท/เดือน)</option>
                <option value="per_unit" ${feeToEdit && feeToEdit.unitType === 'per_unit' ? 'selected' : ''}>⚡ คิดตามหน่วย (บาท/ยูนิต)</option>
              </select>
            </div>
            <div class="form-group">
              <label>อัตราค่าบริการ (บาท) *</label>
              <input type="number" step="0.1" id="fee-amount" class="form-control" value="${feeToEdit ? feeToEdit.amount : 100}" required>
            </div>
          </div>
          <div class="form-group">
            <label>หมายเหตุรายละเอียดเพิ่มเติม</label>
            <input type="text" id="fee-note" class="form-control" value="${feeToEdit ? (feeToEdit.note || '') : ''}" placeholder="รายละเอียดเงื่อนไข...">
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top:1.25rem;">
            <i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูลค่าใช้จ่าย
          </button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('custom-fee-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('fee-name').value.trim();
      const unitType = document.getElementById('fee-unittype').value;
      const amount = parseFloat(document.getElementById('fee-amount').value) || 0;
      const note = document.getElementById('fee-note').value.trim();

      if (!this.state.rates.customFees) this.state.rates.customFees = [];

      if (isEdit) {
        const idx = this.state.rates.customFees.findIndex(f => f.id === feeToEdit.id);
        if (idx !== -1) {
          this.state.rates.customFees[idx] = { ...this.state.rates.customFees[idx], name, unitType, amount, note };
        }
      } else {
        const newFee = {
          id: 'fee_' + Date.now(),
          name, unitType, amount, note
        };
        this.state.rates.customFees.push(newFee);
      }

      DBService.saveState(this.state);
      modal.classList.remove('active');
      SettingsComponent.activeSection = 'rates';
      SettingsComponent.activeSection = 'users';
      this.switchTab('settings');
    });
  }

  // --- 9. SETTINGS EVENTS ---
  static bindSettingsEvents() {
    // 1. Navigation & Search Bindings
    const backBtn = document.getElementById('btn-settings-back');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        SettingsComponent.activeSection = 'home';
        App.switchTab('settings');
      });
    }

    document.querySelectorAll('.settings-card-item').forEach(card => {
      card.addEventListener('click', (e) => {
        const sectionId = card.getAttribute('data-section');
        if (sectionId) {
          SettingsComponent.activeSection = sectionId;
          App.switchTab('settings');
        }
      });
    });

    const searchInput = document.getElementById('settings-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        SettingsComponent.searchQuery = query;
        document.querySelectorAll('.settings-card-item').forEach(card => {
          const title = card.querySelector('.settings-card-title').textContent.toLowerCase();
          const desc = card.querySelector('.settings-card-desc').textContent.toLowerCase();
          const keywords = card.getAttribute('data-keywords') || '';
          if (title.includes(query) || desc.includes(query) || keywords.includes(query)) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
      if (SettingsComponent.searchQuery) {
        searchInput.value = SettingsComponent.searchQuery;
        searchInput.dispatchEvent(new Event('input'));
      }
    }

    // 2. Extra handlers for rates (which are now inside settings section 'rates')
    if (SettingsComponent.activeSection === 'rates') {
      this.bindRatesEvents();
    }

    // 3. Extra security & developer toggle handlers
    const changePassBtn = document.getElementById('btn-security-change-pass');
    if (changePassBtn) {
      changePassBtn.addEventListener('click', () => {
        const current = AuthService.getCurrentUser();
        if (current) this.openUserModal(current);
      });
    }

    const devToggle = document.getElementById('dev-mode-toggle');
    if (devToggle) {
      devToggle.checked = !!localStorage.getItem('SOMBAT_APARTMENT_DEV_MODE');
      devToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          localStorage.setItem('SOMBAT_APARTMENT_DEV_MODE', 'true');
          alert('เปิดโหมดนักพัฒนาเรียบร้อยแล้ว!');
        } else {
          localStorage.removeItem('SOMBAT_APARTMENT_DEV_MODE');
          alert('ปิดโหมดนักพัฒนาเรียบร้อยแล้ว!');
        }
      });
    }

    // 4. Export & Import JSON Backup handlers
    const backupBtn = document.getElementById('btn-export-backup-json');
    if (backupBtn) {
      backupBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href",     dataStr);
        downloadAnchor.setAttribute("download", `Sombat_Apartment_Backup_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      });
    }

    const triggerImport = document.getElementById('btn-trigger-import-json');
    const inputImport = document.getElementById('input-import-json');
    if (triggerImport && inputImport) {
      triggerImport.addEventListener('click', () => inputImport.click());
      inputImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
             const imported = JSON.parse(evt.target.result);
             if (imported.rooms && imported.tenants) {
               Object.assign(this.state, imported);
               DBService.saveState(this.state);
               alert('นำเข้าข้อมูลสำรองเรียบร้อยแล้ว! ระบบจะรีโหลดเพื่อแสดงผลล่าสุด');
               window.location.reload();
             } else {
               alert('ไฟล์ JSON ไม่ถูกต้องสำหรับระบบ Sombat Apartment');
             }
          } catch (err) {
             alert('เกิดข้อผิดพลาดในการนำเข้าไฟล์: ' + err.message);
          }
        };
        reader.readAsText(file);
      });
    }


    const bankForm = document.getElementById('form-bank-settings');
    if (bankForm) {
      bankForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.state.settings) this.state.settings = {};
        this.state.settings.apartmentName = document.getElementById('setting-apt-name').value.trim();
        this.state.settings.address = document.getElementById('setting-apt-address').value.trim();
        this.state.settings.tel = document.getElementById('setting-apt-tel').value.trim();
        this.state.settings.bankName = document.getElementById('setting-bank-name').value;
        this.state.settings.bankAccountNo = document.getElementById('setting-bank-no').value.trim();
        this.state.settings.bankAccountName = document.getElementById('setting-bank-acc-name').value.trim();
        this.state.settings.promptPayId = document.getElementById('setting-promptpay-id').value.trim();

        DBService.saveState(this.state);
        alert('🟢 บันทึกข้อมูลหอพักและบัญชีธนาคารเรียบร้อยแล้ว!');
      });
    }

    const ownerForm = document.getElementById('form-owner-settings');
    if (ownerForm) {
      ownerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.state.settings) this.state.settings = {};
        this.state.settings.ownerName = document.getElementById('setting-owner-name').value.trim();
        this.state.settings.ownerIdCard = document.getElementById('setting-owner-idcard').value.trim();
        this.state.settings.ownerAddress = document.getElementById('setting-owner-address').value.trim();
        this.state.settings.ownerTel = document.getElementById('setting-owner-tel').value.trim();

        DBService.saveState(this.state);
        alert('🟢 บันทึกข้อมูลเจ้าของหอพักเรียบร้อยแล้ว!');
      });
    }

    const lineForm = document.getElementById('line-bot-settings-form');
    if (lineForm) {
      lineForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!this.state.settings) this.state.settings = {};
        this.state.settings.lineToken = document.getElementById('setting-line-token').value.trim();
        this.state.settings.lineUserId = document.getElementById('setting-line-userid').value.trim();
        this.state.settings.lineNotifyToken = document.getElementById('setting-line-notify-token').value.trim();

        DBService.saveState(this.state);
        alert('✅ บันทึกการตั้งค่า LINE Bot เรียบร้อยแล้ว!');
      });
    }

    const testLineBtn = document.getElementById('btn-test-line-send');
    if (testLineBtn) {
      testLineBtn.addEventListener('click', async () => {
        const token = (this.state.settings && this.state.settings.lineToken) || '';
        const userId = (this.state.settings && this.state.settings.lineUserId) || '';
        const supabaseUrl = (this.state.settings && this.state.settings.supabaseUrl) || DBService.getSavedSupabaseUrl();

        if (!token || !userId) {
          return alert('⚠️ กรุณากรอก LINE Channel Access Token และ LINE User ID / Group ID ก่อนกดทดสอบครับ');
        }

        if (!supabaseUrl) {
          return alert('⚠️ กรุณากรอกและบันทึก Supabase Project URL ก่อน เพื่อเรียกใช้งาน Edge Function ครับ');
        }

        testLineBtn.disabled = true;
        const originalHTML = testLineBtn.innerHTML;
        testLineBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่ง...`;

        try {
          const baseUrl = DBService.getBaseSupabaseUrl(supabaseUrl);
          const apiKey = (this.state.settings && this.state.settings.apiKey) || DBService.getSavedApiKey();
          const response = await fetch(`${baseUrl}/functions/v1/line-notify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey,
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              action: 'notifyAdminNewSlip',
              roomName: 'ห้องทดสอบ (Test Room)',
              tenantName: 'ผู้เช่าทดสอบ (Test Tenant)',
              amount: 9999
            })
          });

          const res = await response.json();
          if (res.status === 'success') {
            alert('✅ ทดสอบส่งข้อความสำเร็จ! ข้อความแจ้งเตือนถูกส่งเข้า LINE ของคุณแล้ว');
          } else {
            alert(`⚠️ ส่งข้อความล้มเหลว:\n\n${res.message || 'กรุณาตรวจสอบการตั้งค่า'}`);
          }
        } catch (err) {
          alert(`⚠️ ไม่สามารถส่งข้อความทดสอบได้:\n${err.toString()}`);
        } finally {
          testLineBtn.disabled = false;
          testLineBtn.innerHTML = originalHTML;
        }
      });
    }

    // Theme Switcher Bindings
    const themeLightBtn = document.getElementById('btn-theme-light');
    const themeDarkBtn = document.getElementById('btn-theme-dark');
    if (themeLightBtn && themeDarkBtn) {
      themeLightBtn.addEventListener('click', (e) => {
        e.preventDefault();
        document.body.classList.remove('dark');
        this.state.settings.theme = 'light';
        DBService.saveState(this.state);
        themeLightBtn.className = 'btn btn-primary';
        themeDarkBtn.className = 'btn btn-secondary';
      });
      themeDarkBtn.addEventListener('click', (e) => {
        e.preventDefault();
        document.body.classList.add('dark');
        this.state.settings.theme = 'dark';
        DBService.saveState(this.state);
        themeDarkBtn.className = 'btn btn-primary';
        themeLightBtn.className = 'btn btn-secondary';
      });
      
      // Initial visual state
      const isDark = (this.state.settings && this.state.settings.theme === 'dark');
      if (isDark) {
        themeLightBtn.className = 'btn btn-secondary';
        themeDarkBtn.className = 'btn btn-primary';
      } else {
        themeLightBtn.className = 'btn btn-primary';
        themeDarkBtn.className = 'btn btn-secondary';
      }
    }

    const saveUrlBtn = document.getElementById('btn-save-supabase-url');
    if (saveUrlBtn) {
      saveUrlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const urlInput = document.getElementById('supabase-url-input');
        const apiKeyInput = document.getElementById('api-key-input');
        if (urlInput) {
          const cleaned = DBService.cleanUrl(urlInput.value);
          this.state.settings.supabaseUrl = cleaned;
          localStorage.setItem('SOMBAT_APARTMENT_SAVED_SUPABASE_URL', cleaned);
          urlInput.value = cleaned;
        }
        if (apiKeyInput) {
          const apiKeyVal = apiKeyInput.value.trim();
          this.state.settings.apiKey = apiKeyVal;
          localStorage.setItem('SOMBAT_APARTMENT_SAVED_API_KEY', apiKeyVal);
        }
        DBService.saveState(this.state);
        alert('บันทึกการตั้งค่าเชื่อมต่อ Supabase เรียบร้อยแล้ว!');
      });
    }

    const syncSheetsBtn = document.getElementById('btn-sync-to-supabase');
    if (syncSheetsBtn) {
      syncSheetsBtn.addEventListener('click', async () => {
        const url = DBService.getSavedSupabaseUrl();
        if (!url) {
          alert('กรุณาใส่ Supabase Project URL ก่อนซิงค์ข้อมูล');
          return;
        }
        syncSheetsBtn.disabled = true;
        syncSheetsBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังซิงค์ข้อมูลลง Supabase...';
        try {
          await DBService.syncToSupabase(url, this.state);
          alert('✅ ซิงค์ข้อมูลลง Supabase สำเร็จเรียบร้อยแล้ว!');
        } catch (err) {
          alert('⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อ Supabase: ' + err.message);
        } finally {
          syncSheetsBtn.disabled = false;
          syncSheetsBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> ซิงค์ข้อมูลลง Supabase ตอนนี้';
        }
      });
    }

    const copyLinkBtn = document.getElementById('btn-copy-shared-link');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        const url = this.state.settings.supabaseUrl || DBService.getSavedSupabaseUrl();
        if (!url) {
          alert('กรุณาใส่ Supabase Project URL ก่อนกดคัดลอกลิงก์แชร์');
          return;
        }
        const sharedUrl = `${window.location.origin}${window.location.pathname}?supabaseUrl=${encodeURIComponent(url)}`;
        navigator.clipboard.writeText(sharedUrl).then(() => {
          alert(`🔗 คัดลอกลิงก์เชื่อมต่อฐานข้อมูล Supabase สำเร็จแล้ว!\n\n${sharedUrl}\n\nคุณสามารถส่งลิงก์นี้ให้คอมพิวเตอร์ หรือ มือถือเครื่องอื่นเปิดใช้งาน เพื่อดึงและซิงค์ข้อมูลจาก Supabase โปรเจกต์เดียวกันได้ทันที โดยข้อมูลไม่หายแม้ล้างแคช!`);
        }).catch(() => {
          prompt('คัดลอกลิงก์เชื่อมต่อฐานข้อมูล Supabase ด้านล่างนี้:', sharedUrl);
        });
      });
    }

    const meterLinkBtn = document.getElementById('btn-copy-meter-link');
    if (meterLinkBtn) {
      meterLinkBtn.addEventListener('click', () => {
        const base = window.location.href.replace(/\/[^\/]*(\?.*)?$/, '/');
        const meterUrl = `${base}meter.html`;
        navigator.clipboard.writeText(meterUrl).then(() => {
          meterLinkBtn.innerHTML = '<i class="fa-solid fa-check"></i> คัดลอกแล้ว!';
          setTimeout(() => { meterLinkBtn.innerHTML = '<i class="fa-solid fa-gauge-high"></i> คัดลอกลิงก์จดมิเตอร์'; }, 2500);
        }).catch(() => {
          prompt('คัดลอกลิงก์จดมิเตอร์:', meterUrl);
        });
      });
    }

    const openMeterBtn = document.getElementById('btn-open-meter');
    if (openMeterBtn) {
      openMeterBtn.addEventListener('click', () => {
        const base = window.location.href.replace(/\/[^\/]*(\?.*)?$/, '/');
        window.open(`${base}meter.html`, '_blank');
      });
    }

    const resetBtn = document.getElementById('btn-danger-reset-all');

    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        if (!confirm('⚠️ คำเตือน: คุณต้องการล้างข้อมูลผู้เช่า บิล สัญญาเช่า และประวัติทั้งหมดในระบบใช่หรือไม่? (การกระทำนี้ไม่สามารถย้อนกลับได้)')) {
          return;
        }
        if (!confirm('กดยืนยันอีกครั้งเพื่อเริ่มลบข้อมูลจริงออกจากฐานข้อมูล Supabase คลาวด์')) {
          return;
        }
        
        resetBtn.disabled = true;
        resetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังรีเซ็ตระบบ...';
        
        try {
          await DBService.clearDemoData(this.state);
          alert('✅ ล้างข้อมูลและรีเซ็ตระบบทั้งในเครื่องและบน Supabase สำเร็จเรียบร้อยแล้ว!');
          window.location.reload();
        } catch (err) {
          alert('❌ เกิดข้อผิดพลาดในการรีเซ็ตฐานข้อมูล: ' + err.message);
        } finally {
          resetBtn.disabled = false;
          resetBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> ล้างข้อมูลและรีเซ็ตระบบทั้งหมด';
        }
      });
    }

    const lateFeeForm = document.getElementById('form-late-fee-settings');
    if (lateFeeForm) {
      lateFeeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!this.state.lateFeeSettings) this.state.lateFeeSettings = {};
        this.state.lateFeeSettings.dueDay = parseInt(document.getElementById('setting-late-due-day').value);
        this.state.lateFeeSettings.penaltyPhase1Start = parseInt(document.getElementById('setting-late-p1-start').value);
        this.state.lateFeeSettings.penaltyPhase1End = parseInt(document.getElementById('setting-late-p1-end').value);
        this.state.lateFeeSettings.penaltyPhase1Amount = parseFloat(document.getElementById('setting-late-p1-amount').value);
        this.state.lateFeeSettings.penaltyPhase2Start = parseInt(document.getElementById('setting-late-p2-start').value);
        this.state.lateFeeSettings.penaltyPhase2End = parseInt(document.getElementById('setting-late-p2-end').value);
        this.state.lateFeeSettings.penaltyPhase2Amount = parseFloat(document.getElementById('setting-late-p2-amount').value);

        await DBService.saveState(this.state);
        alert('🟢 บันทึกตั้งค่าค่าปรับชำระล่าช้าเรียบร้อยแล้ว!');
      });
    }

    const ratesForm = document.getElementById('form-rates');
    if (ratesForm) {
      ratesForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.state.rates.electricityRate = parseFloat(document.getElementById('rate-elec').value) || 8.0;
        this.state.rates.waterRate = parseFloat(document.getElementById('rate-water').value) || 20.0;
        DBService.saveState(this.state);
        alert('ปรับปรุงเรทค่าน้ำ-ค่าไฟ เรียบร้อยแล้ว!');
      });
    }

    const addUserBtn = document.getElementById('btn-add-user');
    if (addUserBtn) {
      addUserBtn.addEventListener('click', () => this.openUserModal());
    }

    document.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const user = this.state.users.find(u => u.id === id);
        if (user) this.openUserModal(user);
      });
    });

    document.querySelectorAll('.btn-switch-user').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const user = this.state.users.find(u => u.id === id);
        if (user) {
          AuthService.setCurrentUser(user);
          alert(`✅ สลับสิทธิ์ผู้ใช้งานเป็น: ${user.displayName} (${user.role}) เรียบร้อยแล้ว!`);
          location.reload();
        }
      });
    });

    document.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('คุณต้องการลบผู้ใช้งานนี้ใช่หรือไม่?')) {
          const idx = this.state.users.findIndex(u => u.id === id);
          if (idx !== -1) {
            this.state.users.splice(idx, 1);
            DBService.saveState(this.state);
            SettingsComponent.activeSection = 'users';
            this.switchTab('settings');
          }
        }
      });
    });

    // Prevent mouse wheel from changing input type=number values (using capture phase to intercept before target receives it)
    document.addEventListener('wheel', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
        e.preventDefault();
      }
    }, { passive: false, capture: true });
  }

  static openUserModal(userToEdit = null) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');
    const isEdit = !!userToEdit;

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid ${isEdit ? 'fa-user-pen text-info' : 'fa-user-plus text-primary'}"></i> ${isEdit ? 'แก้ไขผู้ใช้งานระบบ' : 'เพิ่มผู้ใช้งานระบบใหม่'}</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="user-form">
          <div class="form-group">
            <label>ชื่อผู้ใช้งาน (Username) *</label>
            <input type="text" id="usr-name" class="form-control" value="${userToEdit ? userToEdit.username : ''}" required ${isEdit ? 'readonly' : ''}>
          </div>
          <div class="form-group">
            <label>ชื่อ-นามสกุลที่แสดง (Display Name) *</label>
            <input type="text" id="usr-disp" class="form-control" value="${userToEdit ? userToEdit.displayName : ''}" required>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>บทบาทสิทธิ์ (Role) *</label>
              <select id="usr-role" class="form-control" required>
                <option value="super_admin" ${userToEdit && userToEdit.role === 'super_admin' ? 'selected' : ''}>👑 ผู้ดูแลระบบสูงสุด (Super Admin)</option>
                <option value="admin" ${userToEdit && userToEdit.role === 'admin' ? 'selected' : ''}>🛡️ เจ้าของหอพัก / แอดมิน (Admin)</option>
                <option value="staff" ${userToEdit && userToEdit.role === 'staff' ? 'selected' : ''}>👤 พนักงานต้อนรับ (Staff)</option>
              </select>
            </div>
            <div class="form-group">
              <label>รหัสผ่าน (Password) ${isEdit ? '(เว้นว่างไว้หากไม่ต้องการเปลี่ยน)' : '*'}</label>
              <div style="position:relative;">
                <input type="password" id="usr-pass" class="form-control" value="" placeholder="${isEdit ? 'เว้นว่าง = ใช้รหัสผ่านเดิม' : 'ตั้งรหัสผ่านใหม่...'}" ${isEdit ? '' : 'required'} style="padding-right:2.5rem;">
                <button type="button" id="btn-toggle-user-password" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:#64748b; cursor:pointer;" title="แสดง/ซ่อนรหัสผ่าน">
                  <i class="fa-solid fa-eye"></i>
                </button>
              </div>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top:1.25rem;">
            <i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูลผู้ใช้งาน
          </button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    const toggleUserPassBtn = document.getElementById('btn-toggle-user-password');
    if (toggleUserPassBtn) {
      toggleUserPassBtn.addEventListener('click', () => {
        const passInput = document.getElementById('usr-pass');
        if (passInput) {
          const isPass = passInput.type === 'password';
          passInput.type = isPass ? 'text' : 'password';
          toggleUserPassBtn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
        }
      });
    }

    document.getElementById('user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('usr-name').value.trim();
      const displayName = document.getElementById('usr-disp').value.trim();
      const role = document.getElementById('usr-role').value;
      const password = document.getElementById('usr-pass').value;

      if (!this.state.users) this.state.users = [];

      if (isEdit) {
        const idx = this.state.users.findIndex(u => u.id === userToEdit.id);
        if (idx !== -1) {
          const updatedUser = {
            ...this.state.users[idx],
            displayName,
            role
          };
          // เว้นว่างช่องรหัสผ่านไว้ = ไม่เปลี่ยนรหัสผ่านเดิม; ถ้ากรอกมาใหม่ค่อยแฮชแล้วเขียนทับ
          if (password) {
            updatedUser.passwordHash = await sha256Hex(password);
          }
          delete updatedUser.password; // ไม่เก็บรหัสผ่านตัวจริง (plaintext) อีกต่อไป
          this.state.users[idx] = updatedUser;
          const current = AuthService.getCurrentUser();
          if (current && current.id === userToEdit.id) {
            AuthService.setCurrentUser(this.state.users[idx]);
          }
        }
      } else {
        if (this.state.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
          return alert('Username นี้มีในระบบแล้ว กรุณาใช้ชื่ออื่น');
        }
        const newUser = {
          id: 'usr_' + Date.now(),
          username,
          displayName,
          role,
          passwordHash: await sha256Hex(password)
        };
        this.state.users.push(newUser);
      }

      DBService.saveState(this.state);
      modal.classList.remove('active');
      alert('✅ บันทึกข้อมูลผู้ใช้งานเรียบร้อยแล้ว');
      SettingsComponent.activeSection = 'users';
      this.switchTab('settings');
    });
  }

  // --- 9. CONTRACTS EVENTS ---
  static bindContractsEvents() {
    document.querySelectorAll('.contract-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.contract-filter-btn').forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        const filter = target.getAttribute('data-filter');

        document.querySelectorAll('.contract-row').forEach(row => {
          if (filter === 'all' || row.getAttribute('data-status') === filter) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      });
    });

    const createContractBtn = document.getElementById('btn-create-contract');
    if (createContractBtn) {
      createContractBtn.addEventListener('click', () => this.openCreateNewContractModal());
    }

    document.querySelectorAll('.btn-print-contract-pdf, .btn-gen-contract').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tenantId = e.currentTarget.getAttribute('data-tenant-id') || e.currentTarget.getAttribute('data-id');
        const tenant = this.state.tenants.find(t => t.id === tenantId);
        if (tenant) {
          this.openOfficialContractModal(tenant, tenant.witness1 || '', tenant.witness2 || '');
        }
      });
    });

    document.querySelectorAll('.btn-edit-contract').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tenantId = e.currentTarget.getAttribute('data-tenant-id');
        const tenant = this.state.tenants.find(t => t.id === tenantId);
        if (tenant) this.openCreateNewContractModal(tenant);
      });
    });

    const exportExcel = document.getElementById('btn-export-contracts-excel');
    if (exportExcel) {
      exportExcel.addEventListener('click', () => {
        const headers = ['ผู้เช่า', 'เลขบัตรประชาชน', 'เบอร์โทร', 'วันเริ่มสัญญา', 'วันหมดสัญญา'];
        const rows = this.state.tenants.map(t => [t.name, t.idCard, t.tel, t.startDate, t.endDate]);
        ExportService.exportToCSV('ทะเบียนสัญญาเช่า_Sombat.csv', headers, rows);
      });
    }
  }

  static openCreateNewContractModal(tenantToEdit = null) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    const isEdit = !!tenantToEdit;
    const defaultRentRoom = tenantToEdit ? this.state.rooms.find(r => r.id === tenantToEdit.assignedRoomId) : null;
    const defaultRent = tenantToEdit ? ((defaultRentRoom?.baseRent !== undefined && defaultRentRoom?.baseRent !== null && defaultRentRoom?.baseRent !== '') ? Number(defaultRentRoom.baseRent) : 3500) : 3500;
    const defaultDeposit = tenantToEdit ? (tenantToEdit.depositAmount || tenantToEdit.deposit?.initialBail || 7000) : 7000;

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid ${isEdit ? 'fa-file-signature text-info' : 'fa-file-circle-plus text-primary'}"></i> ${isEdit ? 'แก้ไขข้อมูลหนังสือสัญญาเช่าห้องพัก' : 'ออกหนังสือสัญญาเช่าห้องพักใหม่'}</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="create-contract-form">
          ${isEdit ? `
          <div style="background:#eff6ff; padding:0.75rem; border-radius:8px; margin-bottom:1rem; border:1px solid #bfdbfe; font-weight:700; color:#1e40af;">
            <i class="fa-solid fa-user-pen"></i> \u0e01\u0e33\u0e25\u0e31\u0e07\u0e41\u0e01\u0e49\u0e44\u0e02\u0e2a\u0e31\u0e0d\u0e0d\u0e32\u0e40\u0e0a\u0e48\u0e32\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e1c\u0e39\u0e49\u0e40\u0e0a\u0e48\u0e32\u0e2b\u0e25\u0e31\u0e01: ${tenantToEdit.name}
            <input type="hidden" id="ctr-tenant-select" value="${tenantToEdit.id}">
          </div>
          ` : ''}

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>ชื่อ-นามสกุล ผู้เช่า *</label>
              <input type="text" id="ctr-tenant-name" class="form-control" placeholder="น.ส.กันญา บัวแดง" value="${isEdit ? tenantToEdit.name : ''}" required>
            </div>
            <div class="form-group">
              <label>เลขบัตรประชาชน (13 หลัก) *</label>
              <input type="text" id="ctr-idcard" class="form-control" placeholder="3451200115491" value="${isEdit ? tenantToEdit.idCard : ''}" required>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>เบอร์โทรศัพท์ *</label>
              <input type="text" id="ctr-tel" class="form-control" placeholder="081-2345678" value="${isEdit ? tenantToEdit.tel : ''}" required>
            </div>
            <div class="form-group">
              <label>\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2b\u0e49\u0e2d\u0e07\u0e40\u0e0a\u0e48\u0e32 / \u0e1a\u0e49\u0e32\u0e19</label>
              <select id="ctr-room-select" class="form-control">
                <option value="">-- \u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2b\u0e49\u0e2d\u0e07 --</option>
                ${this.state.rooms.map(r => `
                  <option value="${r.id}" ${(isEdit && tenantToEdit.assignedRoomId === r.id) ? 'selected' : ''}>\u0e2b\u0e49\u0e2d\u0e07 ${r.name}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>ที่อยู่ตามภูมิลำเนาของผู้เช่า:</label>
            <input type="text" id="ctr-address" class="form-control" placeholder="12/4 หมู่ 3 ต.บางบัวทอง อ.บางบัวทอง จ.นนทบุรี" value="${isEdit ? (tenantToEdit.address || '') : ''}">
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>\u0e27\u0e31\u0e19\u0e40\u0e23\u0e34\u0e48\u0e21\u0e2a\u0e31\u0e0d\u0e0d\u0e32 *</label>
              <input type="date" id="ctr-start-date" class="form-control" value="${isEdit && tenantToEdit.startDate ? tenantToEdit.startDate : new Date().toISOString().slice(0,10)}" required>
            </div>
            <div class="form-group">
              <label>\u0e27\u0e31\u0e19\u0e2a\u0e34\u0e49\u0e19\u0e2a\u0e38\u0e14\u0e2a\u0e31\u0e0d\u0e0d\u0e32 *</label>
              <input type="date" id="ctr-end-date" class="form-control" value="${isEdit && tenantToEdit.endDate ? tenantToEdit.endDate : '2027-07-31'}" required>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>ค่าเช่ารายเดือน (บาท) *</label>
              <input type="number" id="ctr-rent-amt" class="form-control" value="${defaultRent}" required>
            </div>
            <div class="form-group">
              <label>เงินประกันมัดจำ (บาท) *</label>
              <input type="number" id="ctr-deposit-amt" class="form-control" value="${defaultDeposit}" required>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>ชื่อพยาน 1 (ถ้ามี):</label>
              <input type="text" id="ctr-witness1" class="form-control" placeholder="เว้นว่างไว้เพื่อเว้นจุดไข่ปลา" value="${isEdit ? (tenantToEdit.witness1 || '') : ''}">
            </div>
            <div class="form-group">
              <label>ชื่อพยาน 2 (ถ้ามี):</label>
              <input type="text" id="ctr-witness2" class="form-control" placeholder="เว้นว่างไว้เพื่อเว้นจุดไข่ปลา" value="${isEdit ? (tenantToEdit.witness2 || '') : ''}">
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-full" style="margin-top:1rem;">
            <i class="fa-solid fa-save"></i> ${isEdit ? 'บันทึกการแก้ไขสัญญาเช่า & ดูพรีวิว (PDF)' : 'ออกสัญญาและดูพรีวิวสัญญา (PDF)'}
          </button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    const tenantSelect = document.getElementById('ctr-tenant-select');
    const nameInput = document.getElementById('ctr-tenant-name');
    const idCardInput = document.getElementById('ctr-idcard');
    const telInput = document.getElementById('ctr-tel');
    const addressInput = document.getElementById('ctr-address');

    if (!isEdit && tenantSelect) {
      tenantSelect.addEventListener('change', () => {
        const selected = this.state.tenants.find(t => t.id === tenantSelect.value);
        if (selected) {
          nameInput.value = selected.name;
          idCardInput.value = selected.idCard;
          telInput.value = selected.tel;
          addressInput.value = selected.address || '';
        }
      });
    }

    // Automatically pull room rent and calculate deposit when a room is selected
    const roomSelect = document.getElementById('ctr-room-select');
    const rentInput = document.getElementById('ctr-rent-amt');
    const depositInput = document.getElementById('ctr-deposit-amt');
    if (roomSelect && rentInput && depositInput && !isEdit) {
      const updateRentAndDeposit = () => {
        const room = this.state.rooms.find(r => r.id === roomSelect.value);
        if (room) {
          rentInput.value = room.baseRent !== undefined ? room.baseRent : 3500;
          depositInput.value = (room.baseRent !== undefined ? room.baseRent : 3500) * 2; // Default deposit is 2 months rent
        }
      };
      // Set initial values on load
      updateRentAndDeposit();
      // Listen to changes
      roomSelect.addEventListener('change', updateRentAndDeposit);
    }

    document.getElementById('create-contract-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const tenantId = tenantSelect ? tenantSelect.value : (tenantToEdit ? tenantToEdit.id : '');
      let tenant = this.state.tenants.find(t => t.id === tenantId);
      const name = nameInput.value;
      const idCard = idCardInput.value;
      const tel = telInput.value;
      const address = addressInput.value;
      const roomId = document.getElementById('ctr-room-select').value;
      const startDate = document.getElementById('ctr-start-date').value;
      const endDate = document.getElementById('ctr-end-date').value;
      const rawBail = document.getElementById('ctr-deposit-amt').value.trim();
      const bail = rawBail !== '' ? parseFloat(rawBail) : 0;
      const witness1 = document.getElementById('ctr-witness1').value.trim();
      const witness2 = document.getElementById('ctr-witness2').value.trim();

      if (tenant) {
        tenant.name = name;
        tenant.idCard = idCard;
        tenant.tel = tel;
        tenant.address = address;
        tenant.startDate = startDate;
        tenant.endDate = endDate;
        tenant.assignedRoomId = roomId;
        tenant.depositAmount = bail;
        tenant.depositStatus = 'active';
        tenant.status = 'active';
        if (!tenant.deposit) tenant.deposit = { deductions: [], status: 'active' };
        tenant.deposit.initialBail = bail;
        tenant.witness1 = witness1;
        tenant.witness2 = witness2;
      } else {
        tenant = {
          id: 't_' + Date.now(),
          name, idCard, tel, address, startDate, endDate, assignedRoomId: roomId,
          depositAmount: bail,
          depositStatus: 'active',
          deposit: { initialBail: bail, deductions: [], status: 'active' },
          documents: [],
          witness1, witness2
        };
        this.state.tenants.push(tenant);
      }

      const room = this.state.rooms.find(r => r.id === roomId);
      if (room) {
        room.status = 'occupied';
        room.currentTenantId = tenant.id;
        room.currentTenantName = tenant.name;
        room.entryDate = startDate;
      }

      DBService.saveState(this.state);
      modal.classList.remove('active');
      this.switchTab('contracts');
      this.openOfficialContractModal(tenant, witness1, witness2);
    });
  }

  static addInvoiceToLedger(inv) {
    if (!this.state.ledger) this.state.ledger = [];
    const existing = this.state.ledger.find(l => l.invoiceId === inv.id);
    if (existing) {
      existing.amount = inv.totalAmount;
      existing.date = inv.paymentDate || new Date().toISOString().slice(0, 10);
      existing.description = `รับชำระค่าเช่าห้อง ${inv.roomName} (${inv.invoiceNumber})`;
      return;
    }
    const newLed = {
      id: 'led_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      invoiceId: inv.id,
      date: inv.paymentDate || new Date().toISOString().slice(0, 10),
      type: 'income',
      category: 'ค่าเช่าห้อง',
      description: `รับชำระค่าเช่าห้อง ${inv.roomName} (${inv.invoiceNumber})`,
      amount: inv.totalAmount,
      recordedBy: 'system'
    };
    this.state.ledger.unshift(newLed);
  }

  static removeInvoiceFromLedger(invId) {
    if (!this.state.ledger) return;
    const idx = this.state.ledger.findIndex(l => l.invoiceId === invId);
    if (idx !== -1) {
      this.state.ledger.splice(idx, 1);
    }
  }

  static openOfficialContractModal(tenant, witness1Input = '', witness2Input = '') {
    const room = this.state.rooms.find(r => r.id === tenant.assignedRoomId);
    const settings = this.state.settings || {};
    const ownerName = settings.ownerName || 'นายสมบัติ น้ำวน';
    const ownerIdCard = settings.ownerIdCard || '3451200115491';
    const ownerAddress = settings.ownerAddress || '๔๕/๑๐ หมู่ที่ ๘ ตำบลราษฎร์นิยม อำเภอไทรน้อย จังหวัดนนทบุรี';
    const ownerTel = settings.ownerTel || '๐๘๐-๕๙๙๑६๙๑';
    const aptAddress = settings.address || '๔๕/๑๐ หมู่ที่ ๘ ตำบลราษฎร์นิยม อำเภอไทรน้อย จังหวัดนนทบุรี';

    const today = new Date();
    const hasAddress = tenant.address && tenant.address.trim() && !tenant.address.includes('45/10 หมู่ที่ 8');
    const d = {
      day: today.getDate().toString(),
      month: Formatters.thaiMonthBE(today.toISOString().slice(0, 7)).split(' ')[0],
      year: (today.getFullYear() + 543).toString(),
      tenantName: tenant.name,
      tenantAddress: hasAddress ? tenant.address : '',
      tenantAddressFormatted: hasAddress ? `<span class="dotted-fill">${tenant.address}</span>` : `<span style="display:inline-block; min-width:320px; border-bottom:1px dotted #000;">&nbsp;</span>`,
      tenantIdCard: Formatters.formatIdCard(tenant.idCard),
      tenantIdIssueDate: Formatters.thaiDate(tenant.startDate),
      roomName: room ? room.name : 'A101',
      startDateDay: tenant.startDate ? tenant.startDate.split('-')[2] : '1',
      startDateMonth: tenant.startDate ? Formatters.thaiMonthBE(tenant.startDate.slice(0, 7)).split(' ')[0] : 'พฤษภาคม',
      startDateYear: tenant.startDate ? (parseInt(tenant.startDate.split('-')[0], 10) + 543).toString() : '2568',
      monthlyRentAmt: room ? room.baseRent.toLocaleString() : '3,500',
      monthlyRentThai: Formatters.thaiBahtText(room ? (room.baseRent !== undefined ? room.baseRent : 3500) : 3500),
      depositAmt: tenant.deposit ? tenant.deposit.initialBail.toLocaleString() : '7,000',
      depositThai: Formatters.thaiBahtText(tenant.deposit ? tenant.deposit.initialBail : 7000),
      witness1: witness1Input,
      witness2: witness2Input,
      ownerName,
      ownerIdCard,
      ownerAddress,
      ownerTel,
      aptAddress
    };

    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-file-contract text-warning"></i> หนังสือสัญญาเช่าห้องแถว (หอพักสมบัติ.คอม)</h3>
        <button class="close-modal-btn">&times;</button>
      </div>

      <div class="contract-tab-switcher" style="padding-top: 1rem;">
        <button class="contract-tab-btn active" id="tab-front-doc"><i class="fa-solid fa-file-lines"></i> ด้านหน้า (หนังสือสัญญา)</button>
        <button class="contract-tab-btn" id="tab-back-doc"><i class="fa-solid fa-list-ol"></i> ด้านหลัง (กฎและมารยาท 13 ข้อ)</button>
      </div>

      <div class="modal-body" style="padding-top: 0.5rem;">
        <div id="contract-front-view" class="contract-paper front-page">
          <div style="text-align:center; font-weight:bold; font-size:1.25rem; margin-bottom:0.5rem;">
            หนังสือสัญญาเช่าห้องแถว
          </div>
          <div style="text-align:right; margin-bottom:0.2rem; font-size:0.85rem;">
            เขียนที่ ${d.ownerAddress} โทร. ${d.ownerTel}
          </div>
          <div style="text-align:right; margin-bottom:0.4rem; font-size:0.85rem;">
            วันที่<span class="dotted-fill">${d.day}</span>เดือน<span class="dotted-fill">${d.month}</span>พ.ศ.<span class="dotted-fill">${d.year}</span>
          </div>

          <div style="line-height:1.7; font-size:0.85rem; text-align:justify;">
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;โดยหนังสือฉบับนี้ ข้าพเจ้า <strong>${d.ownerName}</strong> อยู่บ้านเลขที่ ${d.ownerAddress} ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>“ผู้ให้เช่า”</strong> ฝ่ายหนึ่งกับข้าพเจ้า <span class="dotted-fill">${d.tenantName}</span><br>
            อยู่บ้านเลขที่ ${d.tenantAddressFormatted}<br>
            ถือบัตรประชาชน <span class="dotted-fill">${d.tenantIdCard}</span> เมื่อวันที่ <span class="dotted-fill">${d.tenantIdIssueDate}</span><br>
            ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>“ผู้เช่า”</strong> อีกฝ่ายหนึ่ง ทั้งสองฝ่ายตกลงทำสัญญากันดังมีข้อความต่อไปนี้คือ<br>

            <strong>ข้อ ๑.</strong> ผู้ให้เช่าตกลงให้เช่าและผู้เช่าตกลงเช่าห้องแถว/บ้าน <span class="dotted-fill">${d.roomName}</span> ตั้งอยู่ ณ. เลขที่ ${d.aptAddress} เริ่มตั้งแต่วันที่ <span class="dotted-fill">${d.startDateDay}</span> เดือน <span class="dotted-fill">${d.startDateMonth}</span> พ.ศ. <span class="dotted-fill">${d.startDateYear}</span> ถึงจนกว่าจะออก/ยกเลิกสัญญา<br>

            <strong>ข้อ ๒.</strong> ผู้เช่าตกลงให้ค่าเช่าเป็นรายเดือนๆ ละ <span class="dotted-fill">${d.monthlyRentAmt}</span> บาท (<span class="dotted-fill">${d.monthlyRentThai}</span>) มีกำหนดชำระเงินค่าเช่าทุกวันที่ ๑ ของทุก ๆ เดือน หากผู้เช่าไม่ชำระตามกําหนดยอมให้ผู้ใช้เช่ายึดทรัพย์สินและใส่กุญแจห้องของผู้เช่าได้<br>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>๒.๑</strong> ผู้เช่าจะต้องจ่ายเงินค่ามัดจำไว้เพื่อเป็นหลักประกันในทรัพย์สิน/ค่าน้ำ ค่าไฟฟ้า ค่ากุญแจ และอื่นๆ จำนวน <span class="dotted-fill">${d.depositAmt}</span> บาท (<span class="dotted-fill">${d.depositThai}</span>) และจะคืนให้เมื่อครบกำหนด ๖ เดือน/เมื่อย้ายออก<br>

            <strong>ข้อ ๓.</strong> ผู้เช่าได้ตรวจดูห้องเช่าแล้ว เห็นว่าทุกสิ่งอยู่ในสภาพเรียบร้อยใช้การได้อย่างสมบูรณ์จะดูแลมิให้ชำรุดทรุดโทรม และจะบำรุงรักษาให้อยู่ในสภาพดี พร้อมที่จะส่งมอบคืนตามสภาพเดิมทุกประการ และตกลงยอมให้ผู้เช่าหรือตัวแทน เข้าตรวจดูห้องได้ทุกเวลาภายหลังจากได้แจ้งความประสงค์ให้ผู้เช่าทราบแล้ว ถ้าผู้เช่าออกจากห้องแถวที่เช่าไม่ว่ากรณีใด ๆ ผู้เช่าจะเรียกร้องค่าเสียหายและ/หรือค่าขนย้ายจากผู้ให้เช่ามิได้<br>

            <strong>ข้อ ๔.</strong> ผู้เช่าไม่มีสิทธินำห้องเช่า ที่เช่าออกให้ผู้อื่นเช่าช่วง หรือทำนิติกรรมใดๆ กับผู้อื่นในอันที่จะเป็นผลก่อให้เกิดความผูกพันในห้องเช่า ไม่ว่าโดยตรงหรือโดยปริยาย และจะไม่ทำการดัดแปลงหรือต่อเติมห้องเช่าไม่ว่าทั้งหมดหรือบางส่วน เว้นแต่จะได้รับความยินยอมเป็นหนังสือจากผู้ให้เช่า และหากผู้เช่าได้ทำการดัดแปลงหรือต่อเติมสิ่งใดตามที่ได้รับความยินยอมเมื่อใดแล้ว ผู้เช่ายอมยกกรรมสิทธิ์ในทรัพย์สินนั้นให้ตกเป็นของผู้ให้เช่านับแต่เมื่อนั้นด้วยทั้งสิ้น<br>

            <strong>ข้อ ๕.</strong> ถ้าเกิดอัคคีภัยขึ้นไม่ว่ากรณีใดๆ ให้สัญญานี้เป็นอันสิ้นสุดลง<br>
            <strong>ข้อ ๖.</strong> ผู้เช่า จะไม่ดำเนินการค้าใดๆ อันเป็นที่รังเกียจและผิดกฎหมายหรืออาจเป็นอันตรายแก่สถานที่เช่าและจะไม่กระทำหรือยอมให้ผู้อื่นกระทำในสิ่งใดๆ อันอาจพิสูจน์ได้ว่าเป็นความเสียหายหรือก่อความเดือดร้อนรำคาญแก่ผู้ให้เช่า หรือผู้อยู่ใกล้เคียง<br>
            <strong>ข้อ ๗.</strong> เมื่อผู้เช่ากระทำผิดสัญญาข้อหนึ่งข้อใด ผู้ให้เช่ามีสิทธิบอกเลิกสัญญาได้ทันที และผู้เช่ายอมให้ผู้เช่าทรงไว้ซึ่งสิทธิที่จะเข้ายึดครอบครองสถานที่และสิ่งที่เช่าได้โดยพลัน<br>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;สัญญาฉบับนี้ทำขึ้นเป็นสองฉบับมีข้อความอย่างเดียวกัน ทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญานี้โดยละเอียดดีแล้ว ต่างยึดถือไว้คนละฉบับ และได้ลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.6rem 1rem; margin-top:1rem; text-align:center;">
            <div>
              ลงชื่อ <span style="display:inline-block; width:140px; border-bottom:1px dotted #000;"></span> ผู้เช่า<br>
              <div style="margin-top:0.25rem;">( <span class="dotted-fill">${d.tenantName}</span> )</div>
            </div>
            <div>
              ลงชื่อ <span style="display:inline-block; width:140px; border-bottom:1px dotted #000;"></span> ผู้ให้เช่า<br>
              <div style="margin-top:0.25rem;">( ${d.ownerName} )</div>
            </div>
            <div style="margin-top:0.5rem;">
              ลงชื่อ <span style="display:inline-block; width:140px; border-bottom:1px dotted #000;"></span> พยาน<br>
              <div style="margin-top:0.25rem;">( ${d.witness1 ? `<span class="dotted-fill">${d.witness1}</span>` : '<span style="display:inline-block; width:140px; border-bottom:1px dotted #000;">&nbsp;</span>'} )</div>
            </div>
            <div style="margin-top:0.5rem;">
              ลงชื่อ <span style="display:inline-block; width:140px; border-bottom:1px dotted #000;"></span> พยาน<br>
              <div style="margin-top:0.25rem;">( ${d.witness2 ? `<span class="dotted-fill">${d.witness2}</span>` : '<span style="display:inline-block; width:140px; border-bottom:1px dotted #000;">&nbsp;</span>'} )</div>
            </div>
          </div>
        </div>

        <div id="contract-back-view" class="contract-paper back-page" style="display: none;">
          <div style="text-align:center; font-weight:bold; font-size:1.4rem; margin-bottom:1.5rem;">
            กฎและมารยาทในการอยู่เช่าห้อง/บ้าน
          </div>

          <ol style="line-height:1.7; font-size:0.85rem; margin-left:1.5rem; text-align:justify;">
            <li>ทำหนังสือสัญญาห้องเช่าก่อนเข้าอยู่อาศัย (เงินมัดจำจะคืนเมื่ออยู่เกิน 6 เดือน)</li>
            <li>จ่ายค่าเช่าทุกวันที่ 1 ของเดือน โดยมีค่าไฟฟ้ายูนิตละ 8 บาท / ค่าน้ำประปายูนิตละ 20 บาท</li>
            <li>หากจ่ายเกินวันที่ 5 เสียค่าปรับ 200 บาท เกินวันที่ 15 เสียค่าปรับ 300 บาท / หากไม่มีการแจ้งภายใน 5 วัน (ล็อคห้องทันทีโดยไม่ต้องแจ้งให้ทราบ)</li>
            <li>ห้ามตอกตะปู หรือใช้วัสดุใดที่ทำให้ผนังเป็นรูเด็ดขาด หากจำเป็นควรใช้ที่แขวนติดแทน ปรับจุดละ 200 บาท</li>
            <li>ห้ามเสพสิ่งเสพติดทุกชนิด/มั่วสุม ถ้าผู้ให้เช่าทราบจะดำเนินการทางกฎหมายและเชิญออกทันที</li>
            <li>ถ้ามีการดื่มสุรา/หรือจัดงานใด ๆ ไม่เกินเวลา 22.00 น.</li>
            <li>ห้ามเลี้ยงสัตว์เลี้ยงที่ก่อให้เกิดความเสียหายกับห้องและรบกวนห้องข้างทุกชนิด หากเกิดความเสียหายชดใช้ทั้งหมดทุกกรณี</li>
            <li>ถ้ามีเครื่องเสียงเวลาเปิดไม่ควรดังเกินจนเกิดความรำคาญแก่คนห้องอื่น (เตือน 3 ครั้ง เชิญออก)</li>
            <li>หากทำสิ่งของภายในห้องชำรุดหรือเสียหาย ต้องเสียค่าปรับเท่ากับราคาของนั้น</li>
            <li>หากหลอดไฟ ก๊อกน้ำเสื่อมสภาพ เครื่องปรับอากาศไม่เย็น กรุณาแจ้งผู้ให้เช่าทราบเพื่อแก้ไข</li>
            <li>ควรปิดไฟ ปิดน้ำ ปิดเตาแก๊ส หรือเครื่องใช้ไฟฟ้าก่อนออกจากห้องทุกครั้ง</li>
            <li>ควรปิดล็อคห้องด้วยลูกกุญแจอีกชั้น เพื่อความปลอดภัยต่อทรัพย์สิน (ผู้ให้เช่าไม่รับผิดชอบกรณีของสูญหายทุกกรณี)</li>
            <li>กรุณาช่วยกันดูแลรักษาความสะอาดให้เรียบร้อยและเป็นระเบียบ</li>
          </ol>

          <div style="margin-top:0.6rem; font-size:0.85rem; line-height:1.5;">
            <p>เบอร์เจ้าของห้อง ${d.ownerTel}</p>
            <p>เบอร์สถานีตำรวจไทรน้อย 02-9238778</p>
            <p>เบอร์สถานีอนามัยวัดราษฎร์นิยม 02-9855158</p>

            <div style="text-align:center; margin-top:2rem; font-weight:600;">
              <p>ขอบคุณทุกท่านที่ไว้ใจในบริการและให้ความร่วมมือในการใช้บริการจากเรา</p>
              <h3 style="margin-top:0.4rem; font-size:1.2rem; color:#000;">${settings.apartmentName || 'หอพักสมบัติ.คอม'}</h3>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:0.5rem; border-top:1px solid var(--border-color); padding:1rem;">
        <button class="btn btn-secondary" id="btn-close-contract-modal"><i class="fa-solid fa-xmark"></i> ปิด</button>
        <button class="btn btn-primary" id="btn-do-print-official-contract"><i class="fa-solid fa-print"></i> พิมพ์สัญญา (PDF 2 หน้า)</button>
      </div>
    `;

    modal.classList.add('active');
    const closeModal = () => modal.classList.remove('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    const closeBtn = document.getElementById('btn-close-contract-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    const viewFront = document.getElementById('contract-front-view');
    const viewBack = document.getElementById('contract-back-view');
    const tabFront = document.getElementById('tab-front-doc');
    const tabBack = document.getElementById('tab-back-doc');

    tabFront.addEventListener('click', () => {
      tabFront.classList.add('active'); tabBack.classList.remove('active');
      viewFront.style.display = 'block'; viewBack.style.display = 'none';
    });

    tabBack.addEventListener('click', () => {
      tabBack.classList.add('active'); tabFront.classList.remove('active');
      viewFront.style.display = 'none'; viewBack.style.display = 'block';
    });

    document.getElementById('btn-do-print-official-contract').addEventListener('click', () => {
      const printArea = document.getElementById('print-receipt-area');
      printArea.innerHTML = `
        <div class="contract-print-page front-page">
          <div style="text-align:center; font-weight:bold; font-size:1.25rem; margin-bottom:0.5rem;">
            หนังสือสัญญาเช่าห้องแถว
          </div>
          <div style="text-align:right; margin-bottom:0.2rem; font-size:0.85rem;">
            เขียนที่ ${d.ownerAddress} โทร. ${d.ownerTel}
          </div>
          <div style="text-align:right; margin-bottom:0.4rem; font-size:0.85rem;">
            วันที่<span class="dotted-fill">${d.day}</span>เดือน<span class="dotted-fill">${d.month}</span>พ.ศ.<span class="dotted-fill">${d.year}</span>
          </div>

          <div style="line-height:1.7; font-size:0.85rem; text-align:justify;">
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;โดยหนังสือฉบับนี้ ข้าพเจ้า <strong>${d.ownerName}</strong> อยู่บ้านเลขที่ ${d.ownerAddress} ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>“ผู้ให้เช่า”</strong> ฝ่ายหนึ่งกับข้าพเจ้า <span class="dotted-fill">${d.tenantName}</span><br>
            อยู่บ้านเลขที่ ${d.tenantAddressFormatted}<br>
            ถือบัตรประชาชน <span class="dotted-fill">${d.tenantIdCard}</span> เมื่อวันที่ <span class="dotted-fill">${d.tenantIdIssueDate}</span><br>
            ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>“ผู้เช่า”</strong> อีกฝ่ายหนึ่ง ทั้งสองฝ่ายตกลงทำสัญญากันดังมีข้อความต่อไปนี้คือ<br>

            <strong>ข้อ ๑.</strong> ผู้ให้เช่าตกลงให้เช่าและผู้เช่าตกลงเช่าห้องแถว/บ้าน <span class="dotted-fill">${d.roomName}</span> ตั้งอยู่ ณ. เลขที่ ${d.aptAddress} เริ่มตั้งแต่วันที่ <span class="dotted-fill">${d.startDateDay}</span> เดือน <span class="dotted-fill">${d.startDateMonth}</span> พ.ศ. <span class="dotted-fill">${d.startDateYear}</span> ถึงจนกว่าจะออก/ยกเลิกสัญญา<br>

            <strong>ข้อ ๒.</strong> ผู้เช่าตกลงให้ค่าเช่าเป็นรายเดือนๆ ละ <span class="dotted-fill">${d.monthlyRentAmt}</span> บาท (<span class="dotted-fill">${d.monthlyRentThai}</span>) มีกำหนดชำระเงินค่าเช่าทุกวันที่ ๑ ของทุก ๆ เดือน หากผู้เช่าไม่ชำระตามกําหนดยอมให้ผู้ใช้เช่ายึดทรัพย์สินและใส่กุญแจห้องของผู้เช่าได้<br>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>๒.๑</strong> ผู้เช่าจะต้องจ่ายเงินค่ามัดจำไว้เพื่อเป็นหลักประกันในทรัพย์สิน/ค่าน้ำ ค่าไฟฟ้า ค่ากุญแจ และอื่นๆ จำนวน <span class="dotted-fill">${d.depositAmt}</span> บาท (<span class="dotted-fill">${d.depositThai}</span>) และจะคืนให้เมื่อครบกำหนด ๖ เดือน/เมื่อย้ายออก<br>

            <strong>ข้อ ๓.</strong> ผู้เช่าได้ตรวจดูห้องเช่าแล้ว เห็นว่าทุกสิ่งอยู่ในสภาพเรียบร้อยใช้การได้อย่างสมบูรณ์จะดูแลมิให้ชำรุดทรุดโทรม และจะบำรุงรักษาให้อยู่ในสภาพดี พร้อมที่จะส่งมอบคืนตามสภาพเดิมทุกประการ และตกลงยอมให้ผู้เช่าหรือตัวแทน เข้าตรวจดูห้องได้ทุกเวลาภายหลังจากได้แจ้งความประสงค์ให้ผู้เช่าทราบแล้ว ถ้าผู้เช่าออกจากห้องแถวที่เช่าไม่ว่ากรณีใด ๆ ผู้เช่าจะเรียกร้องค่าเสียหายและ/หรือค่าขนย้ายจากผู้ให้เช่ามิได้<br>

            <strong>ข้อ ๔.</strong> ผู้เช่าไม่มีสิทธินำห้องเช่า ที่เช่าออกให้ผู้อื่นเช่าช่วง หรือทำนิติกรรมใดๆ กับผู้อื่นในอันที่จะเป็นผลก่อให้เกิดความผูกพันในห้องเช่า ไม่ว่าโดยตรงหรือโดยปริยาย และจะไม่ทำการดัดแปลงหรือต่อเติมห้องเช่าไม่ว่าทั้งหมดหรือบางส่วน เว้นแต่จะได้รับความยินยอมเป็นหนังสือจากผู้ให้เช่า และหากผู้เช่าได้ทำการดัดแปลงหรือต่อเติมสิ่งใดตามที่ได้รับความยินยอมเมื่อใดแล้ว ผู้เช่ายอมยกกรรมสิทธิ์ในทรัพย์สินนั้นให้ตกเป็นของผู้ให้เช่านับแต่เมื่อนั้นด้วยทั้งสิ้น<br>

            <strong>ข้อ ๕.</strong> ถ้าเกิดอัคคีภัยขึ้นไม่ว่ากรณีใดๆ ให้สัญญานี้เป็นอันสิ้นสุดลง<br>
            <strong>ข้อ ๖.</strong> ผู้เช่า จะไม่ดำเนินการค้าใดๆ อันเป็นที่รังเกียจและผิดกฎหมายหรืออาจเป็นอันตรายแก่สถานที่เช่าและจะไม่กระทำหรือยอมให้ผู้อื่นกระทำในสิ่งใดๆ อันอาจพิสูจน์ได้ว่าเป็นความเสียหายหรือก่อความเดือดร้อนรำคาญแก่ผู้ให้เช่า หรือผู้อยู่ใกล้เคียง<br>
            <strong>ข้อ ๗.</strong> เมื่อผู้เช่ากระทำผิดสัญญาข้อหนึ่งข้อใด ผู้ให้เช่ามีสิทธิบอกเลิกสัญญาได้ทันที และผู้เช่ายอมให้ผู้เช่าทรงไว้ซึ่งสิทธิที่จะเข้ายึดครอบครองสถานที่และสิ่งที่เช่าได้โดยพลัน<br>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;สัญญาฉบับนี้ทำขึ้นเป็นสองฉบับมีข้อความอย่างเดียวกัน ทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญานี้โดยละเอียดดีแล้ว ต่างยึดถือไว้คนละฉบับ และได้ลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.6rem 1rem; margin-top:1rem; text-align:center;">
            <div>
              ลงชื่อ <span style="display:inline-block; width:140px; border-bottom:1px dotted #000;"></span> ผู้เช่า<br>
              <div style="margin-top:0.25rem;">( <span class="dotted-fill">${d.tenantName}</span> )</div>
            </div>
            <div>
              ลงชื่อ <span style="display:inline-block; width:140px; border-bottom:1px dotted #000;"></span> ผู้ให้เช่า<br>
              <div style="margin-top:0.25rem;">( ${d.ownerName} )</div>
            </div>
            <div style="margin-top:0.5rem;">
              ลงชื่อ <span style="display:inline-block; width:140px; border-bottom:1px dotted #000;"></span> พยาน<br>
              <div style="margin-top:0.25rem;">( ${d.witness1 ? `<span class="dotted-fill">${d.witness1}</span>` : '<span style="display:inline-block; width:140px; border-bottom:1px dotted #000;">&nbsp;</span>'} )</div>
            </div>
            <div style="margin-top:0.5rem;">
              ลงชื่อ <span style="display:inline-block; width:140px; border-bottom:1px dotted #000;"></span> พยาน<br>
              <div style="margin-top:0.25rem;">( ${d.witness2 ? `<span class="dotted-fill">${d.witness2}</span>` : '<span style="display:inline-block; width:140px; border-bottom:1px dotted #000;">&nbsp;</span>'} )</div>
            </div>
          </div>
        </div>

        <div class="contract-print-page back-page">
          <div style="text-align:center; font-weight:bold; font-size:1.25rem; margin-bottom:0.5rem;">
            กฎและมารยาทในการอยู่เช่าห้อง/บ้าน
          </div>

          <ol style="line-height:1.7; font-size:0.85rem; text-align:justify;">
            <li>ทำหนังสือสัญญาห้องเช่าก่อนเข้าอยู่อาศัย (เงินมัดจำจะคืนเมื่ออยู่เกิน 6 เดือน)</li>
            <li>จ่ายค่าเช่าทุกวันที่ 1 ของเดือน โดยมีค่าไฟฟ้ายูนิตละ 8 บาท / ค่าน้ำประปายูนิตละ 20 บาท</li>
            <li>หากจ่ายเกินวันที่ 5 เสียค่าปรับ 200 บาท เกินวันที่ 15 เสียค่าปรับ 300 บาท / หากไม่มีการแจ้งภายใน 5 วัน (ล็อคห้องทันทีโดยไม่ต้องแจ้งให้ทราบ)</li>
            <li>ห้ามตอกตะปู หรือใช้วัสดุใดที่ทำให้ผนังเป็นรูเด็ดขาด หากจำเป็นควรใช้ที่แขวนติดแทน ปรับจุดละ 200 บาท</li>
            <li>ห้ามเสพสิ่งเสพติดทุกชนิด/มั่วสุม ถ้าผู้ให้เช่าทราบจะดำเนินการทางกฎหมายและเชิญออกทันที</li>
            <li>ถ้ามีการดื่มสุรา/หรือจัดงานใด ๆ ไม่เกินเวลา 22.00 น.</li>
            <li>ห้ามเลี้ยงสัตว์เลี้ยงที่ก่อให้เกิดความเสียหายกับห้องและรบกวนห้องข้างทุกชนิด หากเกิดความเสียหายชดใช้ทั้งหมดทุกกรณี</li>
            <li>ถ้ามีเครื่องเสียงเวลาเปิดไม่ควรดังเกินจนเกิดความรำคาญแก่คนห้องอื่น (เตือน 3 ครั้ง เชิญออก)</li>
            <li>หากทำสิ่งของภายในห้องชำรุดหรือเสียหาย ต้องเสียค่าปรับเท่ากับราคาของนั้น</li>
            <li>หากหลอดไฟ ก๊อกน้ำเสื่อมสภาพ เครื่องปรับอากาศไม่เย็น กรุณาแจ้งผู้ให้เช่าทราบเพื่อแก้ไข</li>
            <li>ควรปิดไฟ ปิดน้ำ ปิดเตาแก๊ส หรือเครื่องใช้ไฟฟ้าก่อนออกจากห้องทุกครั้ง</li>
            <li>ควรปิดล็อคห้องด้วยลูกกุญแจอีกชั้น เพื่อความปลอดภัยต่อทรัพย์สิน (ผู้ให้เช่าไม่รับผิดชอบกรณีของสูญหายทุกกรณี)</li>
            <li>กรุณาช่วยกันดูแลรักษาความสะอาดให้เรียบร้อยและเป็นระเบียบ</li>
          </ol>

          <div style="margin-top:0.6rem; font-size:0.85rem; line-height:1.5;">
            <p>เบอร์เจ้าของห้อง ${d.ownerTel}</p>
            <p>เบอร์สถานีตำรวจไทรน้อย 02-9238778</p>
            <p>เบอร์สถานีอนามัยวัดราษฎร์นิยม 02-9855158</p>

            <div style="text-align:center; margin-top:1.2rem; font-weight:600;">
              <p>ขอบคุณทุกท่านที่ไว้ใจในบริการและให้ความร่วมมือในการใช้บริการจากเรา</p>
              <h3 style="margin-top:0.3rem; font-size:1.1rem; color:#000;">${settings.apartmentName || 'หอพักสมบัติ.คอม'}</h3>
            </div>
          </div>
        </div>
      `;

      document.body.classList.add('print-receipt-active');
      modal.classList.add('printing-hide');
      modal.style.display = 'none';
      window.print();
      setTimeout(() => {
        modal.style.display = '';
        document.body.classList.remove('print-receipt-active');
        modal.classList.remove('printing-hide');
      }, 600);
    });
  }
}

// Global Error Boundary & Exception Handler
window.addEventListener('error', (event) => {
  console.error('Global Error Boundary caught:', event.error || event.message);
  const loader = document.getElementById('app-startup-loader');
  if (loader) loader.remove();
  const workspace = document.getElementById('main-workspace') || document.getElementById('app-root');
  if (workspace && !workspace.querySelector('.error-boundary-box')) {
    workspace.innerHTML = `
      <div class="error-boundary-box glass-card text-center" style="padding:3rem 1.5rem; margin:2rem auto; max-width:500px; text-align:center;">
        <i class="fa-solid fa-triangle-exclamation text-danger" style="font-size:3rem; margin-bottom:1rem; color:#dc2626;"></i>
        <h3 style="font-weight:700; color:#0f172a; margin-bottom:0.5rem;">เกิดข้อผิดพลาดในการโหลดข้อมูล</h3>
        <p style="color:#64748b; font-size:0.9rem; margin-bottom:1.5rem;">${event.message || 'ระบบขัดข้องชั่วคราว กรุณากดลองใหม่อีกครั้ง'}</p>
        <button class="btn btn-primary" onclick="window.location.reload();" style="padding:0.75rem 1.5rem; border-radius:8px; font-weight:700;">
          <i class="fa-solid fa-rotate-right"></i> ลองใหม่
        </button>
      </div>
    `;
  }
});

// Global Launcher
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
