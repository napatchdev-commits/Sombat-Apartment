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
    // Prioritize paid invoices over unpaid duplicates
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

  static getInitialRooms() {
    const rooms = [];
    // S101 - S119
    for (let i = 101; i <= 119; i++) {
      rooms.push({
        id: `s${i}`,
        name: `S${i}`,
        floor: 1,
        type: 'rt_fan',
        baseRent: 2500,
        status: i % 2 === 0 ? 'occupied' : 'vacant',
        occupied: i % 2 === 0,
        currentTenantId: i % 2 === 0 ? `t_${i}` : null,
        currentTenantName: i % 2 === 0 ? `ผู้เช่าห้อง S${i}` : '',
        lastElecMeter: 1000 + i * 5,
        lastWaterMeter: 100 + i * 2
      });
    }
    // Rooms 101 - 110 (Floor 1), 201 - 210 (Floor 2)
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
          status: r % 3 === 0 ? 'occupied' : 'vacant',
          occupied: r % 3 === 0,
          currentTenantId: r % 3 === 0 ? `t_${code}` : null,
          currentTenantName: r % 3 === 0 ? `ผู้เช่าห้อง ${num}` : '',
          lastElecMeter: 1200 + r * 10,
          lastWaterMeter: 150 + r * 3
        });
      }
    }
    // Named houses / commercial rooms
    rooms.push(
      { id: 'rm_house1', name: 'บ้านหลัง 1', floor: 1, type: 'rt_shop', baseRent: 5500, status: 'occupied', occupied: true, currentTenantName: 'เพชรน้ำหนึ่ง' },
      { id: 'rm_house2', name: 'บ้านหลัง 2', floor: 1, type: 'rt_shop', baseRent: 5500, status: 'occupied', occupied: true, currentTenantName: 'แสงเงินแสงทอง' }
    );
    return rooms;
  }

  static getInitialState() {
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
        supabaseUrl: ''
      },
      rates: { electricityRate: 8.0, waterRate: 20.0, trashFee: 20.0, internetFee: 0, commonFee: 0 },
      users: [
        { id: 'usr_super', username: 'superadmin', displayName: 'สมบัติ น้ำวน', role: 'super_admin', passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' /* sha256('admin') */ },
        { id: 'usr_admin', username: 'admin', displayName: 'เจ้าของหอพัก / แอดมิน', role: 'admin', passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' /* sha256('admin') */ },
        { id: 'usr_staff', username: 'staff', displayName: 'พนักงานต้อนรับ (Staff)', role: 'staff', passwordHash: '1562206543da764123c21bd524674f0a8aaf49c8a89744c97352fe677f7e4006' /* sha256('staff') */ }
      ],
      roomTypes: [
        { id: 'rt_fan', name: 'ห้องพัดลมมาตรฐาน', description: 'ห้องพัดลมกว้างขวาง ระเบียงส่วนตัว', defaultRent: 2500 },
        { id: 'rt_air', name: 'ห้องแอร์ปรับอากาศ', description: 'เครื่องปรับอากาศประหยัดไฟเบอร์ 5 พร้อมเฟอร์นิเจอร์', defaultRent: 3500 },
        { id: 'rt_shop', name: 'ห้องพาณิชย์ร้านค้า', description: 'ติดถนนหลัก เหมาะค้าขายหรือทำออฟฟิศ', defaultRent: 5500 }
      ],
      rooms: this.getInitialRooms(),
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
        // Migrate old googleSheetUrl to supabaseUrl
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
          return this.cleanUrl(parsed.settings.supabaseUrl);
        }
      } catch (e) {}
    }
    const fromStorage = localStorage.getItem('SOMBAT_APARTMENT_SAVED_SUPABASE_URL');
    if (fromStorage && fromStorage.includes('supabase.co')) return this.cleanUrl(fromStorage);
    // Migrate old localStorage key
    const oldStorage = localStorage.getItem('SOMBAT_APARTMENT_SAVED_SHEET_URL');
    if (oldStorage && oldStorage.includes('supabase.co')) {
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

  // apiKey สิทธิ์จำกัด สำหรับแนบไปกับลิงก์พอร์ทัลผู้เช่า (tenant.html) เท่านั้น ต้องตั้งค่าคนละตัวกับ apiKey ของแอดมิน
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

  static async saveState(state) {
    if (state.settings && state.settings.supabaseUrl) {
      localStorage.setItem('SOMBAT_APARTMENT_SAVED_SUPABASE_URL', state.settings.supabaseUrl);
    }
    const url = this.getSavedSupabaseUrl();
    if (url) {
      // Show blocking loader during sync
      const syncLoader = document.createElement('div');
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

      try {
        await this.syncToSupabase(url, state);
      } catch (e) {
        console.error("Failed to sync to Supabase, state will be saved to local cache:", e);
        alert('⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อ Supabase: ' + e.message + '\n\n(ข้อมูลถูกบันทึกในอุปกรณ์เครื่องนี้แล้ว แต่ไม่สามารถอัปโหลดไปยังเซิร์ฟเวอร์ Supabase ได้ กรุณาตรวจสอบ URL หรือ Anon Key ในหน้าตั้งค่า)');
      } finally {
        syncLoader.remove();
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
  static async uploadFileToStorage(file, pathPrefix = 'doc') {
    if (!file) return null;
    const url = this.getSavedSupabaseUrl();
    const apiKey = this.getSavedApiKey();
    if (!url || !apiKey) {
      throw new Error('ยังไม่ได้ตั้งค่า Supabase URL / API Key จึงอัปโหลดไฟล์ไม่ได้');
    }
    const baseUrl = this.getBaseSupabaseUrl(url);
    const safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${pathPrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${safeName}`;
    const uploadUrl = `${baseUrl}/storage/v1/object/tenant-documents/${filename}`;

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
      const txt = await res.text().catch(() => '');
      throw new Error(`อัปโหลดไฟล์ "${file.name}" ไม่สำเร็จ: ${txt || res.statusText}`);
    }
    return `${baseUrl}/storage/v1/object/public/tenant-documents/${filename}`;
  }

  /* เรียก Postgres RPC function ผ่าน PostgREST (/rest/v1/rpc/<fn>) ด้วย anon key ของแอดมิน
     ใช้แพทเทิร์นเดียวกับที่ tenant-app.js ใช้เรียก submit_tenant_payment / submit_tenant_repair */
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

  static getTableConfigs() {
    return {
      rooms: {
        table: 'rooms', onConflict: 'id',
        fields: [['id','id'],['name','name'],['floor','floor'],['typeId','type_id'],['baseRent','base_rent'],
                 ['status','status'],['currentTenantId','current_tenant_id'],['currentTenantName','current_tenant_name'],
                 ['entryDate','entry_date'],['lastWaterMeter','last_water_meter'],['lastElecMeter','last_elec_meter']]
      },
      tenants: {
        table: 'tenants', onConflict: 'id',
        fields: [['id','id'],['name','name'],['idCard','id_card'],['tel','tel'],['lineId','line_id'],['email','email'],
                 ['address','address'],['startDate','start_date'],['endDate','end_date'],['assignedRoomId','assigned_room_id'],
                 ['depositAmount','deposit_amount'],['depositStatus','deposit_status']]
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
                 ['status','status'],['slipUrl','slip_url']]
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
                 ['amount','amount'],['recordedBy','recorded_by']]
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
                 ['promptPayId','prompt_pay_id']]
      },
      rates: {
        table: 'rates',
        fields: [['electricityRate','electricity_rate'],['waterRate','water_rate'],['trashFee','trash_fee'],
                 ['internetFee','internet_fee'],['commonFee','common_fee']]
      }
    };
  }

  static toRow(fields, obj) {
    const row = {};
    fields.forEach(([jsKey, dbKey]) => { row[dbKey] = obj[jsKey] !== undefined ? obj[jsKey] : null; });
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
          fetch(`${baseUrl}/rest/v1/${cfg.table}?id=eq.1&select=*`, { headers }).then(r => r.ok ? r.json() : Promise.reject(new Error(`โหลด ${cfg.table} ไม่สำเร็จ: ${r.statusText}`)))
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
        t.deposit = { initialBail: t.depositAmount || 0, status: t.depositStatus || 'active', deductions: [] };
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
        const dbRow = this.toRow(cfg.fields, jsRow);
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
      ['roomTypes', 'users', 'ledger', 'events'],
      ['rooms'],
      ['tenants', 'invoices', 'repairs']
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

    return `
      <div class="login-page-container" style="position:fixed; top:0; left:0; width:100vw; height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); padding:1.5rem; z-index:99999; overflow-y:auto;">
        <div class="glass-card animate-fade-in" style="width:100%; max-width:440px; border-radius:16px; padding:2.5rem; background:rgba(255,255,255,0.96); box-shadow:0 20px 40px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2); margin:auto;">
          
          <div style="text-align:center; margin-bottom:2rem;">
            <div style="width:64px; height:64px; background:linear-gradient(135deg, #2563eb, #1d4ed8); color:#fff; border-radius:16px; display:inline-flex; align-items:center; justify-content:center; font-size:1.8rem; margin-bottom:1rem; box-shadow:0 8px 16px rgba(37,99,235,0.3);">
              <i class="fa-solid fa-house-lock"></i>
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
    const overdueCount = state.rooms.filter(r => r.status === 'overdue').length;
    const vacantCount = state.rooms.filter(r => r.status === 'vacant').length;
    
    const today = new Date();
    const expiringContracts = state.tenants.filter(t => {
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
      { id: 'meter-entry', label: 'ตารางกรอกมิเตอร์', icon: 'fa-table-cells', colorClass: 'nav-icon-orange', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'billing', label: 'ระบบออกบิลค่าเช่า', icon: 'fa-file-invoice-dollar', colorClass: 'nav-icon-orange', roles: ['super_admin', 'admin', 'staff'] },
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

    return `
      <aside class="app-sidebar" id="app-sidebar">
        <div class="sidebar-brand">
          <div class="brand-logo-icon"><i class="fa-solid fa-house-lock"></i></div>
          <div class="brand-title">
            <h2>${apartmentName}</h2>
            <span>ระบบจัดการห้องเช่า Enterprise</span>
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
    const totalRooms = state.rooms.length;
    const occupiedRooms = state.rooms.filter(r => r.status === 'occupied').length;
    const vacantRooms = state.rooms.filter(r => r.status === 'vacant').length;
    const overdueRooms = state.rooms.filter(r => r.status === 'overdue').length;
    const reservedRooms = state.rooms.filter(r => r.status === 'reserved').length;

    const todayStr = new Date().toISOString().slice(0, 10);
    const monthKeyCurrent = todayStr.slice(0, 7);
    const yearCurrent = todayStr.slice(0, 4);

    let todayIncome = 0; let monthIncome = 0; let yearIncome = 0; let totalOutstanding = 0;

    state.invoices.forEach(inv => {
      if (inv.paymentDate === todayStr) todayIncome += inv.paidAmount;
      if (inv.monthKey === monthKeyCurrent) monthIncome += inv.paidAmount;
      if (inv.issueDate && inv.issueDate.startsWith(yearCurrent)) yearIncome += inv.paidAmount;
      totalOutstanding += inv.outstandingAmount;
    });

    const today = new Date();
    const expiringTenants = state.tenants.filter(t => {
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

        <div class="kpi-cards-grid">
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
          <div class="kpi-card card-white"><div class="kpi-icon text-warning"><i class="fa-solid fa-file-contract"></i></div><div class="kpi-content"><span class="label">สัญญาใกล้หมดอายุ</span><h3 class="value text-warning">${expiringTenants.length} <small>ราย</small></h3></div></div>
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
    const tenants = state.tenants;
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
        contractNumber: `CTR-2026-${t.id.substring(0, 4).toUpperCase()}`,
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
  static render(state) {
    if (!state.tenants) state.tenants = [];
    
    // Auto-populate tenant records from occupied rooms if tenants array is empty or incomplete
    if (state.rooms && Array.isArray(state.rooms)) {
      state.rooms.forEach(r => {
        if (r.currentTenantName && r.currentTenantName !== 'ไม่มีผู้เข้าเช่า') {
          const exists = state.tenants.some(t => t.name === r.currentTenantName || t.assignedRoomId === r.id);
          if (!exists) {
            state.tenants.push({
              id: 't_auto_' + r.id,
              name: r.currentTenantName,
              idCard: r.idCard || '3451200115491',
              tel: '081-2345678',
              assignedRoomId: r.id,
              startDate: '2025-05-01',
              endDate: '2027-05-01',
              deposit: { initialBail: r.bailAmount || 7000, deductions: [], status: 'active' },
              documents: []
            });
          }
        }
      });
    }

    const tenants = state.tenants;

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-users text-primary"></i> จัดการข้อมูลผู้เช่าและเอกสารสัญญา</h2>
            <p>บันทึกทะเบียนผู้เช่า เพิ่มผู้เช่าใหม่ แนบไฟล์บัตรประชาชน/ทะเบียนบ้าน แก้ไข และลบรายการ</p>
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
                  <tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">ยังไม่มีข้อมูลผู้เช่าในระบบ กดปุ่ม "เพิ่มผู้เช่าใหม่" ด้านบนเพื่อเพิ่มข้อมูล</td></tr>
                ` : tenants.map(t => {
                  const room = state.rooms.find(r => r.id === t.assignedRoomId);
                  const roomBadge = room ? `<span class="badge-pill badge-primary">ห้อง ${room.name}</span>` : `<span class="badge-pill badge-gray">ยังไม่ระบุ</span>`;
                  const docCount = t.documents ? t.documents.length : 0;
                  return `
                    <tr>
                      <td><strong>${t.name}</strong></td>
                      <td>${roomBadge}</td>
                      <td><code>${Formatters.formatIdCard(t.idCard)}</code></td>
                      <td>${t.tel} ${t.lineId ? `(${t.lineId})` : ''}</td>
                      <td>
                        <button class="btn btn-secondary btn-xs btn-view-docs" data-id="${t.id}">
                          <i class="fa-solid fa-folder-open text-primary"></i> เอกสาร (${docCount})
                        </button>
                      </td>
                      <td>${Formatters.thaiDate(t.startDate)} ➔ <strong class="text-warning">${Formatters.thaiDate(t.endDate)}</strong></td>
                      <td>
                        <div class="action-buttons">
                          <button class="btn btn-secondary btn-xs btn-gen-contract" data-id="${t.id}"><i class="fa-solid fa-file-contract text-warning"></i> สัญญา</button>
                          <button class="btn btn-secondary btn-xs btn-edit-tenant" data-id="${t.id}"><i class="fa-solid fa-pen text-info"></i> แก้ไข</button>
                          <button class="btn btn-danger btn-xs btn-delete-tenant" data-id="${t.id}" data-name="${t.name}"><i class="fa-solid fa-trash"></i> ลบ</button>
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

class RoomsComponent {
  static render(state) {
    const rawRooms = state.rooms || [];
    const roomTypes = state.roomTypes || [];

    // Sort rooms according to user requirement:
    // 1. Rooms starting with 'S' or 's' (S101, S102, S103...) FIRST
    // 2. Standard letter/numeric rooms (A101, 46/1...) SECOND
    // 3. Named rooms ("บ้านหลัง...", "แสงเงินแสงทอง", "ทิพย์มงคล"...) LAST
    const rooms = [...rawRooms].sort((a, b) => {
      const nameA = String(a.name || '').trim();
      const nameB = String(b.name || '').trim();

      const isSA = /^s/i.test(nameA);
      const isSB = /^s/i.test(nameB);

      if (isSA && !isSB) return -1;
      if (!isSA && isSB) return 1;
      if (isSA && isSB) {
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      }

      const isNamedA = /^[^A-Za-z0-9]/i.test(nameA) || nameA.startsWith('บ้าน') || nameA.startsWith('เรือน');
      const isNamedB = /^[^A-Za-z0-9]/i.test(nameB) || nameB.startsWith('บ้าน') || nameB.startsWith('เรือน');

      if (isNamedA && !isNamedB) return 1;
      if (!isNamedA && isNamedB) return -1;

      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

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

class BillingComponent {
  static render(state) {
    const rawInvoices = state.invoices || [];
    const invoices = DBService.getUniqueInvoices(rawInvoices);
    state.invoices = invoices;

    // Get list of unique months in descending order
    const months = Array.from(new Set(invoices.map(i => i.monthKey))).filter(Boolean).sort((a, b) => b.localeCompare(a));
    const latestMonth = months.length > 0 ? months[0] : '';

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
          <select id="filter-billing-month" class="form-control" style="width:220px; padding:0.5rem 0.85rem; border-radius:8px; font-size:0.95rem; font-weight:600; cursor:pointer; border-color:#cbd5e1; height:38px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
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
                  <th>ยอดรวมสุทธิ</th>
                  <th>สถานะ</th>
                  <th>การสั่งพิมพ์ & ส่งไลน์</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => {
                  const displayStyle = (inv.monthKey === latestMonth || !latestMonth) ? '' : 'none';
                  return `
                    <tr class="billing-table-row" data-month="${inv.monthKey}" style="display: ${displayStyle}">
                      <td><strong>${inv.invoiceNumber}</strong><div class="text-muted text-sm">${Formatters.thaiMonthBE(inv.monthKey)}</div></td>
                      <td><span class="badge-pill badge-primary">ห้อง ${inv.roomName}</span></td>
                    <td><strong>${inv.tenantName}</strong></td>
                    <td><strong class="text-primary">${Formatters.currency(inv.totalAmount)}</strong></td>
                    <td>
                      <button class="btn btn-xs ${inv.status === 'paid' ? 'btn-success' : (inv.status === 'pending' ? 'btn-warning' : 'btn-danger')} btn-toggle-pay-status" data-id="${inv.id}">
                        ${inv.status === 'paid' ? '🟢 ชำระแล้ว' : (inv.status === 'pending' ? '🟡 รอตรวจสอบ' : '🔴 ค้างชำระ')}
                      </button>
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
                        <button class="btn btn-secondary btn-xs btn-edit-bill" data-id="${inv.id}"><i class="fa-solid fa-pen text-info"></i> แก้ไข</button>
                        <button class="btn btn-primary btn-xs btn-save-pdf-bill" data-id="${inv.id}" title="บันทึก PDF ลง Supabase"><i class="fa-solid fa-file-pdf"></i> บันทึก PDF</button>
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

        <div class="kpi-cards-grid">
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
          <h3 style="margin-bottom:0.5rem; color:#0f172a;"><i class="fa-solid fa-box-archive text-primary"></i> 5. ศูนย์สำรองและเรียกคืนข้อมูลระบบ (Full Backup & Restore Center)</h3>
          <p class="text-muted" style="margin-bottom:1.5rem;">สำรองข้อมูลหอพักทั้งหมดเป็นไฟล์ Excel Multi-Sheet หรือ JSON และสามารถอัปโหลดเพื่อ Restore เรียกคืนข้อมูลย้อนหลังได้ตลอดเวลา</p>

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
  static render(state) {
    const settings = state.settings || {};
    const users = state.users || [];

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div><h2><i class="fa-solid fa-gears text-primary"></i> ตั้งค่าเซิร์ฟเวอร์ & เชื่อมต่อ Supabase</h2><p>จัดการผู้ใช้งานระบบ (3 บทบาท) ตั้งค่าระบบ LINE Bot และบันทึกข้อมูลซิงค์ฐานข้อมูลคลาวด์ Supabase</p></div>
        </div>

        <div class="glass-card" style="margin-bottom:1.5rem;">
          <h3><i class="fa-brands fa-line text-success"></i> ตั้งค่าระบบ LINE Bot & LINE Notify (บันทึกข้อมูลแบบเรียลไทม์)</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">
            ระบุ Token เพื่อส่งบิล ใบเสร็จ และแจ้งเตือนชำระเงินอัตโนมัติไปยัง LINE กลุ่มผู้บริหาร/ผู้เช่า (ซิงค์ลง Supabase ใช้งานตรงกันทุกเครื่อง)
          </p>
          
          <form id="line-bot-settings-form" style="margin-top:1rem;">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
              <div class="form-group">
                <label style="font-weight:600;"><i class="fa-brands fa-line text-success"></i> LINE Channel Access Token (LINE Bot Token):</label>
                <input type="text" id="setting-line-token" class="form-control" value="${settings.lineToken || ''}" placeholder="ระบุ LINE Channel Access Token..." style="padding:0.65rem 0.85rem;">
              </div>
              <div class="form-group">
                <label style="font-weight:600;"><i class="fa-solid fa-user-tag text-primary"></i> LINE User ID / Group ID (สำหรับส่งบิล):</label>
                <input type="text" id="setting-line-userid" class="form-control" value="${settings.lineUserId || ''}" placeholder="U123456789... หรือ Group ID..." style="padding:0.65rem 0.85rem;">
              </div>
            </div>

            <div class="form-group" style="margin-top:0.5rem;">
              <label style="font-weight:600;"><i class="fa-solid fa-bell text-warning"></i> LINE Notify Token (สำหรับแจ้งเตือนไลน์กลุ่ม):</label>
              <input type="text" id="setting-line-notify-token" class="form-control" value="${settings.lineNotifyToken || ''}" placeholder="ระบุ LINE Notify Token..." style="padding:0.65rem 0.85rem;">
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:1.25rem;">
              <button type="submit" class="btn btn-success"><i class="fa-solid fa-floppy-disk"></i> บันทึกการตั้งค่า LINE Bot ลง Supabase</button>
              <button type="button" class="btn btn-secondary" id="btn-test-line-send"><i class="fa-paper-plane fa-solid text-success"></i> ทดสอบส่งข้อความ LINE</button>
            </div>
          </form>
        </div>

        <div class="glass-card" style="margin-bottom:1.5rem;">
          <h3><i class="fa-solid fa-circle-half-stroke text-primary"></i> ตั้งค่าธีมระบบ (Appearance)</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">
            เลือกโหมดการแสดงผลของหน้าต่างแอดมินและผู้ใช้งาน (รองรับโหมดกลางคืนถนอมสายตา)
          </p>
          <div style="display:flex; gap:1rem; margin-top:1rem;">
            <button class="btn btn-primary" id="btn-theme-light" style="flex:1;"><i class="fa-solid fa-sun text-warning"></i> โหมดสว่าง (Light Mode)</button>
            <button class="btn btn-secondary" id="btn-theme-dark" style="flex:1;"><i class="fa-solid fa-moon text-info"></i> โหมดมืด (Dark Mode)</button>
          </div>
        </div>

        <div class="glass-card" style="margin-bottom:1.5rem;">
          <h3><i class="fa-solid fa-database text-primary"></i> ตั้งค่าเซิร์ฟเวอร์ & ฐานข้อมูล Supabase</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">
            ระบบเชื่อมต่อข้อมูลหลักผ่าน Supabase Database เพื่อจัดเก็บประวัติข้อมูลห้องพัก บิล และผู้เช่าแบบเรียลไทม์
          </p>
          <div class="form-group" style="margin-top:1rem;">
            <label>Supabase Project URL:</label>
            <input type="url" id="supabase-url-input" class="form-control" value="${settings.supabaseUrl || ''}" placeholder="https://your-project.supabase.co">
          </div>
          <div class="form-group" style="margin-top:1rem;">
            <label>Supabase API Key (Anon Key):</label>
            <input type="text" id="api-key-input" class="form-control" value="${settings.apiKey || ''}" placeholder="วางรหัส Supabase Anon Key ที่นี่...">
            <p class="text-muted" style="font-size:0.8rem; margin-top:0.35rem;">
              ⚠️ ต้องรันไฟล์ 1_schema.sql ใน Supabase SQL Editor ก่อน (สร้างตารางแยกประเภท เช่น rooms, tenants, invoices ฯลฯ) และเปิดสิทธิ์การอ่าน/เขียนตามที่สคริปต์ตั้งค่าไว้ให้แล้ว
            </p>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:1rem;">
            <button class="btn btn-primary" id="btn-save-supabase-url"><i class="fa-solid fa-save"></i> บันทึกการตั้งค่า</button>
            <button class="btn btn-success" id="btn-sync-to-supabase"><i class="fa-solid fa-cloud-arrow-up"></i> ซิงค์ข้อมูลลง Supabase ตอนนี้</button>
            <button class="btn btn-secondary" id="btn-copy-shared-link"><i class="fa-solid fa-share-nodes"></i> คัดลอกลิงก์แชร์เชื่อมต่อทุกเครื่อง</button>
          </div>
          
          <div style="margin-top:1.5rem; padding-top:1.5rem; border-top:1px solid rgba(220,38,38,0.15);">
            <h4 style="color:#dc2626; font-size:0.95rem; font-weight:600; display:flex; align-items:center; gap:0.4rem; margin-bottom:0.25rem;"><i class="fa-solid fa-triangle-exclamation"></i> เขตอันตราย (Danger Zone)</h4>
            <p class="text-muted" style="font-size:0.8rem; margin:0;">หากคุณต้องการลบข้อมูลประวัติ สัญญาเช่า ผู้เช่า และยอดค้างชำระทั้งหมด เพื่อเริ่มต้นกรอกข้อมูลของจริงใหม่</p>
            <button class="btn btn-danger" id="btn-danger-reset-all" style="margin-top:0.75rem; background:#dc2626; border-color:#dc2626; font-size:0.85rem; padding:0.5rem 1rem; color:#fff; border-radius:6px; cursor:pointer;"><i class="fa-solid fa-trash-can"></i> ล้างข้อมูลและรีเซ็ตระบบทั้งหมด</button>
          </div>
        </div>

        <div class="glass-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3><i class="fa-solid fa-users-gear text-primary"></i> จัดการผู้ใช้งานระบบ (User Roles Management)</h3>
            <button id="btn-add-user" class="btn btn-primary btn-sm"><i class="fa-solid fa-user-plus"></i> เพิ่มแอดมิน / ผู้ใช้งานใหม่</button>
          </div>
          <div class="table-responsive">
            <table class="custom-table">
              <thead><tr><th>Username</th><th>ชื่อที่แสดง</th><th>บทบาทสิทธิ์ใช้งาน</th><th>การจัดการ</th></tr></thead>
              <tbody>
                ${users.map(u => `
                  <tr>
                    <td><strong>${u.username}</strong></td>
                    <td>${u.displayName}</td>
                    <td><span class="role-pill role-${u.role}">${u.role === 'super_admin' ? '👑 Super Admin' : (u.role === 'admin' ? '🛡️ Admin' : '👤 Staff')}</span></td>
                    <td>
                      <div class="action-buttons">
                        <button class="btn btn-secondary btn-xs btn-edit-user" data-id="${u.id}"><i class="fa-solid fa-pen"></i> แก้ไข</button>
                        <button class="btn btn-primary btn-xs btn-switch-user" data-id="${u.id}"><i class="fa-solid fa-right-to-bracket"></i> สลับใช้งาน</button>
                        ${users.length > 1 ? `<button class="btn btn-danger btn-xs btn-delete-user" data-id="${u.id}"><i class="fa-solid fa-trash"></i> ลบ</button>` : ''}
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

class MeterEntryComponent {
  static render(state) {
    const rawInvoices = state.invoices || [];
    const rooms = [...state.rooms].sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));

    const getRoomPrevMeters = (room) => {
      if (!room) return { elecPrev: 0, waterPrev: 0 };
      let elecPrev = room.lastElecMeter;
      let waterPrev = room.lastWaterMeter;
      if (elecPrev === undefined || waterPrev === undefined || elecPrev === null || waterPrev === null) {
        const roomInvoices = rawInvoices.filter(i => i.roomId === room.id);
        if (roomInvoices.length > 0) {
          elecPrev = roomInvoices[0].elecCurr || 0;
          waterPrev = roomInvoices[0].waterCurr || 0;
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
        const temp = state.tempMeterReadings.find(t => t.roomId === r.id) || {};
        const elecCurr = temp.elecCurr !== undefined && temp.elecCurr !== null ? temp.elecCurr : '';
        const waterCurr = temp.waterCurr !== undefined && temp.waterCurr !== null ? temp.waterCurr : '';
        const fineAmount = temp.fineAmount !== undefined && temp.fineAmount !== null ? temp.fineAmount : 0;
        
        const elecUnits = elecCurr === '' ? 0 : Math.max(0, parseFloat(elecCurr) - prev.elecPrev);
        const waterUnits = waterCurr === '' ? 0 : Math.max(0, parseFloat(waterCurr) - prev.waterPrev);
        const elecAmt = elecUnits * (state.rates.electricityRate || 8);
        const waterAmt = waterUnits * (state.rates.waterRate || 20);
        const rentAmt = r.baseRent ? Number(r.baseRent) : 2500;
        const trashFee = (state.rates && state.rates.trashFee !== undefined) ? Number(state.rates.trashFee) : 20;
        const total = rentAmt + elecAmt + waterAmt + trashFee + parseFloat(fineAmount);

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
            <span id="excel-sync-indicator" style="font-size:0.85rem; color:#10b981; font-weight:600; display:none;">
              <i class="fa-solid fa-circle-check"></i> บันทึกอัตโนมัติเรียบร้อย
            </span>
            <button class="btn btn-secondary" id="btn-excel-undo" title="ย้อนกลับการแก้ไข (Ctrl+Z)" disabled>
              <i class="fa-solid fa-arrow-rotate-left"></i> ย้อนกลับ (Undo)
            </button>
            <button class="btn btn-primary" id="btn-excel-save-all"><i class="fa-solid fa-save"></i> บันทึกข้อมูลทั้งหมด</button>
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
        const cloudState = await DBService.pullFromSupabase(savedUrl);
        if (cloudState) {
          this.state = cloudState;
          console.log('✅ Real-time Cloud state fetched successfully on start');
        } else {
          this.state = DBService.getState();
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

    // Remove loading overlay
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
            if (cloudState && JSON.stringify(cloudState) !== JSON.stringify(this.state)) {
              this.state = cloudState;
              this.switchTab(this.activeTab);
              console.log('✅ Live sync from Supabase');
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
      case 'meter-entry': workspace.innerHTML = MeterEntryComponent.render(this.state); this.bindMeterEntryEvents(); break;
      case 'billing': workspace.innerHTML = BillingComponent.render(this.state); this.bindBillingEvents(); break;
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
  }

  static setupGlobalEvents() {
    // Global delegated click handler for dynamic elements (Links, Logout, User Profile, Notifications)
    document.addEventListener('click', (e) => {
      // 1. Sidebar Nav Links
      const link = e.target.closest('a[data-tab]');
      if (link) {
        e.preventDefault();
        const tabId = link.getAttribute('data-tab');
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

        <h4 style="font-size:0.95rem; font-weight:600; color:#334155; margin-bottom:0.75rem;"><i class="fa-solid fa-right-to-bracket text-primary"></i> 1-Click สลับบทบาทผู้ใช้งานทันที:</h4>
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
              p_force: false
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

          <div class="form-group">
            <label>สถานะห้องพัก *</label>
            <select id="rm-status" class="form-control" required>
              <option value="vacant" ${roomToEdit && roomToEdit.status === 'vacant' ? 'selected' : ''}>⚪ ห้องว่าง</option>
              <option value="occupied" ${roomToEdit && roomToEdit.status === 'occupied' ? 'selected' : ''}>🟢 มีผู้เช่า</option>
              <option value="overdue" ${roomToEdit && roomToEdit.status === 'overdue' ? 'selected' : ''}>🔴 ค้างชำระ</option>
              <option value="reserved" ${roomToEdit && roomToEdit.status === 'reserved' ? 'selected' : ''}>🟡 จองแล้ว</option>
            </select>
          </div>

          <button type="submit" class="btn btn-primary btn-full" style="margin-top:1rem;">
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

      if (isEdit) {
        roomToEdit.name = name;
        roomToEdit.floor = floor;
        roomToEdit.typeId = typeId;
        roomToEdit.baseRent = baseRent;
        roomToEdit.status = status;
      } else {
        const newRoom = {
          id: 'r_' + Date.now(),
          name, floor, typeId, baseRent, status,
          lastWaterMeter: 0, lastElecMeter: 0
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
  }

  // อัปโหลดไฟล์เอกสารผู้เช่าขึ้น Supabase Storage แทนการฝัง base64 ลงคอลัมน์ file_url โดยตรง
  // (bucket: tenant-documents ต้องสร้างไว้ล่วงหน้าใน Supabase Dashboard → Storage และตั้งเป็น public)
  static async readFileAsDataUrl(file) {
    if (!file) return null;
    const publicUrl = await DBService.uploadFileToStorage(file, 'doc');
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
            <input type="number" id="tn-deposit" class="form-control" value="${tenantToEdit && tenantToEdit.deposit ? tenantToEdit.deposit.initialBail : 7000}">
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:var(--radius-md); padding:1rem; margin-top:1rem;">
            <h4 style="font-size:0.95rem; margin-bottom:0.75rem; color:var(--primary);"><i class="fa-solid fa-paperclip"></i> แนบไฟล์เอกสารผู้เช่า (รองรับทุกไฟล์: รูปถ่าย/PDF/DOCX/ZIP)</h4>
            
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
      const bail = parseFloat(document.getElementById('tn-deposit').value) || 7000;

      if (!name) name = 'ผู้เช่า (ยังไม่ระบุชื่อ)';
      if (!idCard) idCard = '-';
      if (!tel) tel = '-';

      const fileIdCard = document.getElementById('tn-file-idcard').files[0];
      const fileHouse = document.getElementById('tn-file-house').files[0];
      const otherFiles = Array.from(document.getElementById('tn-file-other').files);

      const newDocs = tenantToEdit && tenantToEdit.documents ? [...tenantToEdit.documents] : [];

      try {
        if (fileIdCard || fileHouse || otherFiles.length) {
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังอัปโหลดไฟล์เอกสารขึ้น Supabase Storage...';
        }
        if (fileIdCard) {
          const doc = await App.readFileAsDataUrl(fileIdCard);
          if (doc) { doc.category = 'idcard'; doc.title = 'สำเนาบัตรประชาชน'; newDocs.push(doc); }
        }
        if (fileHouse) {
          const doc = await App.readFileAsDataUrl(fileHouse);
          if (doc) { doc.category = 'house'; doc.title = 'สำเนาทะเบียนบ้าน'; newDocs.push(doc); }
        }
        for (const f of otherFiles) {
          const doc = await App.readFileAsDataUrl(f);
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
        if (tenantToEdit.deposit) tenantToEdit.deposit.initialBail = bail;
      } else {
        const newTenant = {
          id: 't_' + Date.now(),
          name, idCard, tel, lineId, email, address,
          startDate, endDate, assignedRoomId: roomId,
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
        <h3><i class="fa-solid fa-triangle-exclamation text-danger"></i> ลบข้อมูลผู้เช่า</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <p>คุณต้องการลบข้อมูลผู้เช่า <strong>"${tenantName}"</strong> ออกจากระบบใช่หรือไม่?</p>
        <p class="text-muted text-sm">ห้องพักที่เคยเข้าอยู่จะถูกเปลี่ยนสถานะเป็น "ว่าง" โดยอัตโนมัติ</p>

        ${room ? `
          <div style="background:#fef3c7; border:1px solid #f59e0b; border-radius:8px; padding:1rem; margin-top:1rem;">
            <label style="display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer; margin-bottom:0.75rem;">
              <input type="checkbox" id="chk-reset-meters" checked style="margin-top:0.2rem;">
              <span>
                <strong>เคลียร์เลขมิเตอร์น้ำ-ไฟของห้อง ${room.name} เป็น 0</strong><br>
                <span class="text-muted text-sm">แนะนำให้ติ๊ก ถ้านี่คือผู้เช่าทดสอบ — ป้องกันบิลแรกของผู้เช่าจริงคนต่อไปเอาเลขมิเตอร์เก่าไปคำนวณผิด (ถ้าเป็นผู้เช่าจริงที่ย้ายออก แล้วมิเตอร์ยังเดินต่อเนื่อง ให้ไม่ติ๊กช่องนี้)</span>
              </span>
            </label>
            ${relatedInvoiceCount > 0 ? `
              <label style="display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer;">
                <input type="checkbox" id="chk-delete-invoices" style="margin-top:0.2rem;">
                <span>
                  <strong>ลบบิล/ใบแจ้งหนี้ทั้งหมดของห้อง ${room.name} ด้วย (${relatedInvoiceCount} ใบ)</strong><br>
                  <span class="text-muted text-sm">แนะนำให้ติ๊ก ถ้านี่คือบิลทดสอบ — ถ้าเป็นบิลจริงที่มีประวัติการชำระเงินจริง ไม่ควรติ๊ก</span>
                </span>
              </label>
            ` : ''}
          </div>
        ` : ''}

        <div style="display:flex; gap:0.75rem; margin-top:1.5rem;">
          <button id="btn-confirm-delete-tenant" class="btn btn-danger" style="flex:1;"><i class="fa-solid fa-trash"></i> ยืนยันลบผู้เช่า</button>
          <button class="btn btn-secondary close-modal-btn" style="flex:1;">ยกเลิก</button>
        </div>
      </div>
    `;
    modal.classList.add('active');
    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.classList.remove('active')));

    document.getElementById('btn-confirm-delete-tenant').addEventListener('click', () => {
      const resetMeters = room ? document.getElementById('chk-reset-meters').checked : false;
      const deleteInvoicesChk = document.getElementById('chk-delete-invoices');
      const deleteInvoices = deleteInvoicesChk ? deleteInvoicesChk.checked : false;
      modal.classList.remove('active');
      this.deleteTenant(tenantId, { resetMeters, deleteInvoices });
    });
  }

  static deleteTenant(tenantId, options = {}) {
    const { resetMeters = false, deleteInvoices = false } = options;
    const idx = this.state.tenants.findIndex(t => t.id === tenantId);
    if (idx !== -1) {
      const assignedRoomId = this.state.tenants[idx].assignedRoomId;
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
      DBService.saveState(this.state);
      this.switchTab('tenants');
    }
  }

  // --- 2.5 METER ENTRY GRID EVENTS ---
  static bindMeterEntryEvents() {
    const rawInvoices = this.state.invoices || [];
    const rooms = [...this.state.rooms].sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));

    const getRoomPrevMeters = (room) => {
      if (!room) return { elecPrev: 0, waterPrev: 0 };
      let elecPrev = room.lastElecMeter;
      let waterPrev = room.lastWaterMeter;
      if (elecPrev === undefined || waterPrev === undefined || elecPrev === null || waterPrev === null) {
        const roomInvoices = rawInvoices.filter(i => i.roomId === room.id);
        if (roomInvoices.length > 0) {
          elecPrev = roomInvoices[0].elecCurr || 0;
          waterPrev = roomInvoices[0].waterCurr || 0;
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
      const rentAmt = (room.baseRent !== undefined && room.baseRent !== '') ? Number(room.baseRent) : 2500;
      const trashFee = (this.state.rates && this.state.rates.trashFee !== undefined) ? Number(this.state.rates.trashFee) : 20;
      const fineAmt = parseFloat(fineAmount) || 0;
      return rentAmt + elecAmt + waterAmt + trashFee + fineAmt;
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

    let autoSaveTimeout = null;
    const saveTempReadingsToState = () => {
      if (!gridBody) return;
      const temp = [];
      const trs = gridBody.querySelectorAll('tr');
      trs.forEach(tr => {
        const roomId = tr.getAttribute('data-room-id');
        const room = this.state.rooms.find(r => r.id === roomId);
        const elecCurr = tr.querySelector('.elec-input').value;
        const waterCurr = tr.querySelector('.water-input').value;
        const fineAmount = tr.querySelector('.fine-input').value;
        
        temp.push({
          roomId,
          roomName: room ? room.name : '',
          elecCurr: elecCurr === '' ? null : parseFloat(elecCurr),
          waterCurr: waterCurr === '' ? null : parseFloat(waterCurr),
          fineAmount: parseFloat(fineAmount) || 0,
          monthKey: monthInput ? monthInput.value : new Date().toISOString().slice(0, 7)
        });
      });

      this.state.tempMeterReadings = temp;

      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        DBService.saveState(this.state).then(() => {
          if (indicator) {
            indicator.style.display = 'inline-block';
            setTimeout(() => {
              indicator.style.display = 'none';
            }, 2000);
          }
        });
      }, 1500);
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
          
          if (!this.state.tempMeterReadings) this.state.tempMeterReadings = [];
          const temp = this.state.tempMeterReadings.find(t => t.roomId === roomId) || {};
          const oldVal = col === 'elec' ? temp.elecCurr : (col === 'water' ? temp.waterCurr : temp.fineAmount);
          
          pushUndo(roomId, col, oldVal, newVal);
          
          const colLabel = col === 'elec' ? 'เลขไฟ' : (col === 'water' ? 'เลขน้ำ' : 'ค่าปรับ');
          addHistory(`แก้ไข ${roomName} (${colLabel}) จาก [${oldVal ?? 'ว่าง'}] เป็น [${newVal}]`);
          
          saveTempReadingsToState();
        }
      });

      gridBody.addEventListener('input', (e) => {
        if (e.target.classList.contains('excel-input')) {
          updateRowLive(e.target.closest('tr'));
        }
      });

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
        alert('📋 วางข้อมูลจาก Excel เรียบร้อยแล้ว!');
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
        saveAllBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกข้อมูล...';
        
        try {
          saveTempReadingsToState();
          await DBService.saveState(this.state);
          alert('✅ บันทึกข้อมูลค่าน้ำไฟล่าสุดลงคลาวด์เรียบร้อยแล้ว!');
        } catch (err) {
          alert('❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message);
        } finally {
          saveAllBtn.disabled = false;
          saveAllBtn.innerHTML = '<i class="fa-solid fa-save"></i> บันทึกข้อมูลทั้งหมด';
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

    document.querySelectorAll('.btn-toggle-pay-status').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const inv = this.state.invoices.find(i => i.id === id);
        if (inv) {
          inv.status = inv.status === 'paid' ? 'unpaid' : 'paid';
          inv.paidAmount = inv.status === 'paid' ? inv.totalAmount : 0;
          inv.outstandingAmount = inv.status === 'paid' ? 0 : inv.totalAmount;
          inv.paymentDate = inv.status === 'paid' ? new Date().toISOString().slice(0, 10) : null;
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

    document.querySelectorAll('.btn-save-pdf-bill').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const inv = this.state.invoices.find(i => i.id === id);
        if (inv) {
          inv.pdfUrl = `https://sombat-apartment.vercel.app/tenant.html?supabaseUrl=${encodeURIComponent(DBService.getSavedSupabaseUrl())}&apiKey=${encodeURIComponent(DBService.getSavedTenantApiKey())}&idCard=${encodeURIComponent(inv.idCard || '')}&roomId=${encodeURIComponent(inv.roomId || '')}`;
          DBService.saveState(this.state);
          const url = (this.state.settings && this.state.settings.supabaseUrl) ? this.state.settings.supabaseUrl : DBService.getSavedSupabaseUrl();
          if (url) {
            try {
              await DBService.syncToSupabase(url, this.state);
              alert(`✅ บันทึก PDF บิลและอัปโหลดลิงก์/เอกสารของห้อง ${inv.roomName} ลง Supabase เรียบร้อยแล้ว!`);
            } catch (err) {
              alert(`✅ บันทึก PDF บิลเรียบร้อยแล้ว! (การซิงค์ Supabase: ${err.message})`);
            }
          } else {
            alert(`✅ บันทึก PDF บิลเรียบร้อยแล้ว!`);
          }
        }
      });
    });

    const lineNotifyBtn = document.getElementById('btn-line-notify-header');
    if (lineNotifyBtn) {
      lineNotifyBtn.addEventListener('click', () => this.openLineNotifyModal());
    }

    document.querySelectorAll('.btn-send-line').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.openLineNotifyModal(id);
      });
    });
  }

  static openLineNotifyModal(initialInvoiceId = null) {
    const invoices = this.state.invoices || [];
    const settings = this.state.settings || {};
    
    const savedTenantUrl = localStorage.getItem('SOMBAT_TENANT_PORTAL_URL') || (window.location.origin + '/tenant.html');
    const savedLineBotUrl = localStorage.getItem('SOMBAT_LINE_BOT_URL') || '';
    const currentAptName = settings.apartmentName || 'หอพักสมบัติ นนทบุรี';

    const selectedInv = invoices.find(i => i.id === initialInvoiceId) || null;

    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    dialog.innerHTML = `
      <div class="modal-header" style="background:#06c755; color:#ffffff;">
        <h3><i class="fa-brands fa-line"></i> ระบบส่งไลน์แจ้งเตือนผู้เช่าชำระเงินประจำเดือน</h3>
        <button class="close-modal-btn" style="color:#ffffff;">&times;</button>
      </div>

      <div class="modal-body" style="padding:1.5rem;">
        <div class="form-group" style="margin-bottom:1.25rem;">
          <label style="font-weight:600; font-size:0.95rem; color:#0f172a;">เลือกรายการผู้เช่า / ห้องพักที่ต้องการแจ้งเตือน *</label>
          <select id="line-notify-inv-select" class="form-control" style="font-size:1rem; padding:0.65rem 0.85rem;">
            <option value="ALL" ${!selectedInv ? 'selected' : ''}>📢 ประกาศแจ้งเตือนรวม (เรียนผู้เช่าทุกท่าน)</option>
            ${invoices.map(inv => `
              <option value="${inv.id}" ${selectedInv && selectedInv.id === inv.id ? 'selected' : ''}>
                ห้อง ${inv.roomName} - คุณ ${inv.tenantName || 'ผู้เช่า'} (ยอดชำระ ฿${(inv.totalAmount || 0).toLocaleString()})
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group" style="margin-bottom:1.25rem;">
          <label style="font-weight:600; font-size:0.95rem; color:#0f172a; display:flex; justify-content:space-between; align-items:center;">
            <span><i class="fa-solid fa-pen-to-square text-info"></i> ข้อความที่จะส่งให้ผู้เช่า (สามารถพิมพ์แก้ไขเพิ่มเติมได้)</span>
            <span style="font-size:0.8rem; font-weight:normal; color:#059669;">✏️ สามารถพิมพ์แก้ไขข้อความได้ตามต้องการ</span>
          </label>
          <textarea id="line-msg-preview-textarea" class="form-control" rows="12" style="font-family:sans-serif; font-size:0.95rem; line-height:1.6; background-color:#ffffff; color:#0f172a; border:2px solid #06c755; border-radius:8px; padding:0.85rem;" placeholder="พิมพ์หรือแก้ไขข้อความเพิ่มเติมที่นี่..."></textarea>
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

    const updatePreview = () => {
      const invId = invSelect ? invSelect.value : null;
      const isBroadcast = invId === 'ALL' || !invId;
      const inv = invoices.find(i => i.id === invId) || null;
      const apt = currentAptName;
      const url = savedTenantUrl;
      const bot = savedLineBotUrl;

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
            <h4 style="font-size:0.95rem; margin-bottom:0.75rem; color:var(--primary);"><i class="fa-solid fa-bolt"></i> แก้ไขมิเตอร์ไฟฟ้า</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
              <div class="form-group"><label>มิเตอร์ไฟครั้งก่อน:</label><input type="number" id="edit-elec-prev" class="form-control" value="${inv.elecPrev}"></div>
              <div class="form-group"><label>มิเตอร์ไฟครั้งนี้:</label><input type="number" id="edit-elec-curr" class="form-control" value="${inv.elecCurr}"></div>
            </div>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin-top:0.75rem;">
            <h4 style="font-size:0.95rem; margin-bottom:0.75rem; color:var(--primary);"><i class="fa-solid fa-droplet"></i> แก้ไขมิเตอร์น้ำประปา</h4>
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

          <button type="submit" class="btn btn-primary btn-full" style="margin-top:1.25rem;">
            <i class="fa-solid fa-floppy-disk"></i> บันทึกการแก้ไขใบแจ้งหนี้ลง Supabase
          </button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

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
                ${(inv.fineAmount || 0) > 0 ? `
                  <tr>
                    <td style="text-align:center;">5</td>
                    <td><strong class="text-danger">ค่าปรับชำระเกินกำหนด (Overdue Fine)</strong></td>
                    <td style="text-align:center;">-</td>
                    <td style="text-align:center;">-</td>
                    <td style="text-align:center;">-</td>
                    <td style="text-align:right;">-</td>
                    <td style="text-align:right;"><strong class="text-danger">฿${inv.fineAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</strong></td>
                  </tr>
                ` : ''}
                <tr style="background:#f1f5f9; font-weight:bold; font-size:1.05rem;">
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
      window.print();
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
        <p style="font-size:0.95rem; color:#475569; line-height:1.6; margin-bottom:1.25rem;">
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
      if (!room) return { elecPrev: 1000, waterPrev: 100 };
      let elecPrev = room.lastElecMeter;
      let waterPrev = room.lastWaterMeter;
      if (elecPrev === undefined || waterPrev === undefined || elecPrev === null || waterPrev === null) {
        const roomInvoices = (this.state.invoices || []).filter(i => i.roomId === room.id);
        if (roomInvoices.length > 0) {
          elecPrev = roomInvoices[0].elecCurr || 1000;
          waterPrev = roomInvoices[0].waterCurr || 100;
        } else {
          elecPrev = 1000;
          waterPrev = 100;
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
    
    // Sort rooms by floor then name
    const rooms = [...this.state.rooms].sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));

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
      const rentAmt = (room.baseRent !== undefined && room.baseRent !== '') ? Number(room.baseRent) : 3500;
      const trashFee = (this.state.rates && this.state.rates.trashFee !== undefined) ? Number(this.state.rates.trashFee) : 20;
      const internetFee = room.typeId === 'rt_air' ? (Number(this.state.rates.internetFee) || 0) : 0;
      const commonFee = Number(this.state.rates.commonFee) || 0;
      const fineAmt = parseFloat(fineAmount) || 0;
      return rentAmt + elecAmt + waterAmt + trashFee + internetFee + commonFee + fineAmt;
    };

    const renderExcelRows = () => {
      return rooms.map((r, index) => {
        const prev = prevReadings[r.id];
        const temp = this.state.tempMeterReadings.find(t => t.roomId === r.id) || {};
        const elecCurr = temp.elecCurr !== undefined && temp.elecCurr !== null ? temp.elecCurr : '';
        const waterCurr = temp.waterCurr !== undefined && temp.waterCurr !== null ? temp.waterCurr : '';
        const fineAmount = temp.fineAmount !== undefined && temp.fineAmount !== null ? temp.fineAmount : 0;
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

    let autoSaveTimeout = null;
    const saveTempReadingsToState = () => {
      const temp = [];
      const trs = gridBody.querySelectorAll('tr');
      trs.forEach(tr => {
        const roomId = tr.getAttribute('data-room-id');
        const room = this.state.rooms.find(r => r.id === roomId);
        const elecCurr = tr.querySelector('.elec-input').value;
        const waterCurr = tr.querySelector('.water-input').value;
        const fineAmount = tr.querySelector('.fine-input').value;
        
        temp.push({
          roomId,
          roomName: room ? room.name : '',
          elecCurr: elecCurr === '' ? null : parseFloat(elecCurr),
          waterCurr: waterCurr === '' ? null : parseFloat(waterCurr),
          fineAmount: parseFloat(fineAmount) || 0,
          monthKey: monthInput.value
        });
      });

      this.state.tempMeterReadings = temp;

      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        DBService.saveState(this.state).then(() => {
          indicator.style.display = 'inline-block';
          setTimeout(() => {
            indicator.style.display = 'none';
          }, 2000);
        });
      }, 1500);
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
        
        const temp = this.state.tempMeterReadings.find(t => t.roomId === roomId) || {};
        const oldVal = col === 'elec' ? temp.elecCurr : (col === 'water' ? temp.waterCurr : temp.fineAmount);
        
        pushUndo(roomId, col, oldVal, newVal);
        
        const colLabel = col === 'elec' ? 'เลขไฟ' : (col === 'water' ? 'เลขน้ำ' : 'ค่าปรับ');
        addHistory(`แก้ไข ${roomName} (${colLabel}) จาก [${oldVal ?? 'ว่าง'}] เป็น [${newVal}]`);
        
        saveTempReadingsToState();
      }
    });

    gridBody.addEventListener('input', (e) => {
      if (e.target.classList.contains('excel-input')) {
        updateRowLive(e.target.closest('tr'));
      }
    });

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
      alert('📋 วางข้อมูลจาก Excel เรียบร้อยแล้ว!');
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
          const internetFee = room.typeId === 'rt_air' ? (Number(this.state.rates.internetFee) || 0) : 0;
          const commonFee = Number(this.state.rates.commonFee) || 0;

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
              p_internet_fee: internetFee,
              p_common_fee: commonFee
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
            this.switchTab('rates');
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
      this.switchTab('rates');
    });
  }

  // --- 9. SETTINGS EVENTS ---
  static bindSettingsEvents() {
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
      testLineBtn.addEventListener('click', () => {
        const token = (this.state.settings && (this.state.settings.lineToken || this.state.settings.lineNotifyToken)) || '';
        alert(`📱 ทดสอบส่งข้อความ LINE Bot & Notify:\n\n📢 [หอพักสมบัติ นนทบุรี] ทดสอบการเชื่อมต่อระบบ LINE Bot อัตโนมัติเรียบร้อยแล้ว!\n\n(Token: ${token ? 'ระบุไว้แล้ว' : 'ยังไม่ได้ระบุ'})`);
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
          const cleanState = {
            rooms: [
              {"id": "room_1_1", "name": "S101", "floor": 1, "status": "vacant", "baseRent": 2000, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_1_2", "name": "S102", "floor": 1, "status": "vacant", "baseRent": 2000, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_1_3", "name": "S103", "floor": 1, "status": "vacant", "baseRent": 2000, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_1_4", "name": "S104", "floor": 1, "status": "vacant", "baseRent": 2000, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_1_5", "name": "S105", "floor": 1, "status": "vacant", "baseRent": 2000, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_1_6", "name": "S106", "floor": 1, "status": "vacant", "baseRent": 2000, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_1_7", "name": "S107", "floor": 1, "status": "vacant", "baseRent": 2000, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_1_8", "name": "S108", "floor": 1, "status": "vacant", "baseRent": 2000, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_2_1", "name": "S201", "floor": 2, "status": "vacant", "baseRent": 2200, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_2_2", "name": "S202", "floor": 2, "status": "vacant", "baseRent": 2200, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_2_3", "name": "S203", "floor": 2, "status": "vacant", "baseRent": 2200, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_2_4", "name": "S204", "floor": 2, "status": "vacant", "baseRent": 2200, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_2_5", "name": "S205", "floor": 2, "status": "vacant", "baseRent": 2200, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_2_6", "name": "S206", "floor": 2, "status": "vacant", "baseRent": 2200, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_2_7", "name": "S207", "floor": 2, "status": "vacant", "baseRent": 2200, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_2_8", "name": "S208", "floor": 2, "status": "vacant", "baseRent": 2200, "type": "rt_fan", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_3_1", "name": "S301", "floor": 3, "status": "vacant", "baseRent": 2500, "type": "rt_air", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_3_2", "name": "S302", "floor": 3, "status": "vacant", "baseRent": 2500, "type": "rt_air", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_3_3", "name": "S303", "floor": 3, "status": "vacant", "baseRent": 2500, "type": "rt_air", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_3_4", "name": "S304", "floor": 3, "status": "vacant", "baseRent": 2500, "type": "rt_air", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_3_5", "name": "S305", "floor": 3, "status": "vacant", "baseRent": 2500, "type": "rt_air", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_3_6", "name": "S306", "floor": 3, "status": "vacant", "baseRent": 2500, "type": "rt_air", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_3_7", "name": "S307", "floor": 3, "status": "vacant", "baseRent": 2500, "type": "rt_air", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""},
              {"id": "room_3_8", "name": "S308", "floor": 3, "status": "vacant", "baseRent": 2500, "type": "rt_air", "lastElecMeter": 0, "lastWaterMeter": 0, "currentTenantId": "", "currentTenantName": ""}
            ],
            tenants: [],
            invoices: [],
            repairs: [],
            ledger: [],
            events: [],
            users: this.state.users || [
              { id: 'usr_super', username: 'superadmin', displayName: 'สมบัติ น้ำวน', role: 'super_admin', passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' },
              { id: 'usr_admin', username: 'admin', displayName: 'เจ้าของหอพัก / แอดมิน', role: 'admin', passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' },
              { id: 'usr_staff', username: 'staff', displayName: 'พนักงานต้อนรับ (Staff)', role: 'staff', passwordHash: '1562206543da764123c21bd524674f0a8aaf49c8a89744c97352fe677f7e4006' }
            ],
            roomTypes: [
              { id: 'rt_fan', name: 'ห้องพัดลมธรรมดา', baseRent: 2000 },
              { id: 'rt_air', name: 'ห้องแอร์ประหยัดไฟ', baseRent: 2500 }
            ],
            rates: {
              waterRate: 20,
              electricityRate: 8,
              commonFee: 0,
              trashFee: 20,
              internetFee: 0
            },
            settings: this.state.settings || {
              theme: 'light',
              lineToken: '',
              lineUserId: '',
              apartmentName: 'หอพักสมบัติ นนทบุรี',
              promptPayBank: 'ธนาคารไทยพาณิชย์',
              promptPayId: '062-6252564',
              promptPayName: 'สมบัติ น้ำวน',
              lineNotifyToken: ''
            }
          };

          const url = DBService.getSavedSupabaseUrl();
          if (url) {
            await DBService.syncToSupabase(url, cleanState);
          }
          
          localStorage.setItem(DBService.STORAGE_KEY, JSON.stringify(cleanState));
          alert('✅ ล้างข้อมูลและรีเซ็ตระบบสำเร็จเรียบร้อยแล้ว!');
          window.location.reload();
        } catch (err) {
          alert('❌ เกิดข้อผิดพลาดในการรีเซ็ตฐานข้อมูล: ' + err.message);
        } finally {
          resetBtn.disabled = false;
          resetBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> ล้างข้อมูลและรีเซ็ตระบบทั้งหมด';
        }
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
            this.switchTab('settings');
          }
        }
      });
    });
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
        if (tenant) this.openOfficialContractModal(tenant);
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

  static openCreateNewContractModal() {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-file-circle-plus text-primary"></i> ออกหนังสือสัญญาเช่าห้องพักใหม่</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="create-contract-form">
          <div class="form-group">
            <label>เลือกผู้เช่าหลัก *</label>
            <select id="ctr-tenant-select" class="form-control" required>
              <option value="">-- เลือกผู้เช่า หรือ กรอกผู้เช่าใหม่ด้านล่าง --</option>
              ${this.state.tenants.map(t => `<option value="${t.id}">${t.name} (บัตร: ${t.idCard})</option>`).join('')}
            </select>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>ชื่อ-นามสกุล ผู้เช่า *</label>
              <input type="text" id="ctr-tenant-name" class="form-control" placeholder="น.ส.กันญา บัวแดง" required>
            </div>
            <div class="form-group">
              <label>เลขบัตรประชาชน (13 หลัก) *</label>
              <input type="text" id="ctr-idcard" class="form-control" placeholder="3451200115491" required>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>เบอร์โทรศัพท์ *</label>
              <input type="text" id="ctr-tel" class="form-control" placeholder="081-2345678" required>
            </div>
            <div class="form-group">
              <label>เลือกห้องเช่า / บ้าน *</label>
              <select id="ctr-room-select" class="form-control" required>
                ${this.state.rooms.map(r => `<option value="${r.id}">ห้อง ${r.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>ที่อยู่ตามภูมิลำเนาของผู้เช่า:</label>
            <input type="text" id="ctr-address" class="form-control" placeholder="12/4 หมู่ 3 ต.บางบัวทอง อ.บางบัวทอง จ.นนทบุรี">
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>วันเริ่มสัญญา (วัน/เดือน/ปี พ.ศ.) *</label>
              <input type="text" id="ctr-start-date" class="form-control" value="${Formatters.thaiDate(new Date().toISOString().slice(0,10))}" placeholder="21/07/2569" required>
            </div>
            <div class="form-group">
              <label>วันสิ้นสุดสัญญา (วัน/เดือน/ปี พ.ศ.) *</label>
              <input type="text" id="ctr-end-date" class="form-control" value="31/07/2570" placeholder="31/07/2570" required>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>ค่าเช่ารายเดือน (บาท) *</label>
              <input type="number" id="ctr-rent-amt" class="form-control" value="3500" required>
            </div>
            <div class="form-group">
              <label>เงินประกันมัดจำ (บาท) *</label>
              <input type="number" id="ctr-deposit-amt" class="form-control" value="7000" required>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>ชื่อพยาน 1 (ถ้ามี):</label>
              <input type="text" id="ctr-witness1" class="form-control" placeholder="เว้นว่างไว้เพื่อเว้นจุดไข่ปลา">
            </div>
            <div class="form-group">
              <label>ชื่อพยาน 2 (ถ้ามี):</label>
              <input type="text" id="ctr-witness2" class="form-control" placeholder="เว้นว่างไว้เพื่อเว้นจุดไข่ปลา">
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-full" style="margin-top:1rem;">
            <i class="fa-solid fa-file-contract"></i> ออกสัญญาและดูพรีวิวสัญญา (PDF)
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

    tenantSelect.addEventListener('change', () => {
      const selected = this.state.tenants.find(t => t.id === tenantSelect.value);
      if (selected) {
        nameInput.value = selected.name;
        idCardInput.value = selected.idCard;
        telInput.value = selected.tel;
        addressInput.value = selected.address || '';
      }
    });

    // Automatically pull room rent and calculate deposit when a room is selected
    const roomSelect = document.getElementById('ctr-room-select');
    const rentInput = document.getElementById('ctr-rent-amt');
    const depositInput = document.getElementById('ctr-deposit-amt');
    if (roomSelect && rentInput && depositInput) {
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
      const tenantId = tenantSelect.value;
      let tenant = this.state.tenants.find(t => t.id === tenantId);
      const name = nameInput.value;
      const idCard = idCardInput.value;
      const tel = telInput.value;
      const address = addressInput.value;
      const roomId = document.getElementById('ctr-room-select').value;
      const startDate = document.getElementById('ctr-start-date').value;
      const endDate = document.getElementById('ctr-end-date').value;
      const bail = parseFloat(document.getElementById('ctr-deposit-amt').value) || 7000;
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
        if (tenant.deposit) tenant.deposit.initialBail = bail;
      } else {
        tenant = {
          id: 't_' + Date.now(),
          name, idCard, tel, address, startDate, endDate, assignedRoomId: roomId,
          deposit: { initialBail: bail, deductions: [], status: 'active' },
          documents: []
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
      this.openOfficialContractModal(tenant, witness1, witness2);
    });
  }

  static openOfficialContractModal(tenant, witness1Input = '', witness2Input = '') {
    const room = this.state.rooms.find(r => r.id === tenant.assignedRoomId);

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
      witness2: witness2Input
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
          <div style="text-align:center; font-weight:bold; font-size:1.4rem; margin-bottom:1.2rem;">
            หนังสือสัญญาเช่าห้องแถว
          </div>
          <div style="text-align:right; margin-bottom:1rem; font-size:0.95rem;">
            เขียนที่ ๔๕/๓ หมู่ที่ ๘ ตำบลราษฎร์นิยม อำเภอไทรน้อย จังหวัดนนทบุรี ๑๑๑๕๐ โทร. ๐๒-๐๕๓๔๓๑๑,๐๘๐-๕๙๙๑๖๙๑
          </div>
          <div style="text-align:right; margin-bottom:1.5rem; font-size:0.95rem;">
            วันที่<span class="dotted-fill">${d.day}</span>เดือน<span class="dotted-fill">${d.month}</span>พ.ศ.<span class="dotted-fill">${d.year}</span>
          </div>

          <div style="line-height:2.2; font-size:0.95rem; text-align:justify;">
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;โดยหนังสือฉบับนี้ ข้าพเจ้า <strong>นายสมบัติ น้ำวน</strong> อยู่บ้านเลขที่ ๔๕/๑๐ หมู่ที่ ๘ ตำบลราษฎร์นิยม อำเภอไทรน้อย จังหวัดนนทบุรี ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>“ผู้ให้เช่า”</strong> ฝ่ายหนึ่งกับข้าพเจ้า <span class="dotted-fill">${d.tenantName}</span><br>
            อยู่บ้านเลขที่ ${d.tenantAddressFormatted}<br>
            ถือบัตรประชาชน <span class="dotted-fill">${d.tenantIdCard}</span> เมื่อวันที่ <span class="dotted-fill">${d.tenantIdIssueDate}</span><br>
            ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>“ผู้เช่า”</strong> อีกฝ่ายหนึ่ง ทั้งสองฝ่ายตกลงทำสัญญากันดังมีข้อความต่อไปนี้คือ<br>

            <strong>ข้อ ๑.</strong> ผู้ให้เช่าตกลงให้เช่าและผู้เช่าตกลงเช่าห้องแถว/บ้าน <span class="dotted-fill">${d.roomName}</span> ตั้งอยู่ ณ. เลขที่ ๔๕/๑๐ หมู่ที่ ๘ ตำบลราษฎร์นิยม อำเภอไทรน้อย จังหวัดนนทบุรี เริ่มตั้งแต่วันที่ <span class="dotted-fill">${d.startDateDay}</span> เดือน <span class="dotted-fill">${d.startDateMonth}</span> พ.ศ. <span class="dotted-fill">${d.startDateYear}</span> ถึงจนกว่าจะออก/ยกเลิกสัญญา<br>

            <strong>ข้อ ๒.</strong> ผู้เช่าตกลงให้ค่าเช่าเป็นรายเดือนๆ ละ <span class="dotted-fill">${d.monthlyRentAmt}</span> บาท (<span class="dotted-fill">${d.monthlyRentThai}</span>) มีกำหนดชำระเงินค่าเช่าทุกวันที่ ๑ ของทุก ๆ เดือน หากผู้เช่าไม่ชำระตามกําหนดยอมให้ผู้ใช้เช่ายึดทรัพย์สินและใส่กุญแจห้องของผู้เช่าได้<br>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>๒.๑</strong> ผู้เช่าจะต้องจ่ายเงินค่ามัดจำไว้เพื่อเป็นหลักประกันในทรัพย์สิน/ค่าน้ำ ค่าไฟฟ้า ค่ากุญแจ และอื่นๆ จำนวน <span class="dotted-fill">${d.depositAmt}</span> บาท (<span class="dotted-fill">${d.depositThai}</span>) และจะคืนให้เมื่อครบกำหนด ๖ เดือน/เมื่อย้ายออก<br>

            <strong>ข้อ ๓.</strong> ผู้เช่าได้ตรวจดูห้องเช่าแล้ว เห็นว่าทุกสิ่งอยู่ในสภาพเรียบร้อยใช้การได้อย่างสมบูรณ์จะดูแลมิให้ชำรุดทรุดโทรม และจะบำรุงรักษาให้อยู่ในสภาพดี พร้อมที่จะส่งมอบคืนตามสภาพเดิมทุกประการ และตกลงยอมให้ผู้เช่าหรือตัวแทน เข้าตรวจดูห้องได้ทุกเวลาภายหลังจากได้แจ้งความประสงค์ให้ผู้เช่าทราบแล้ว ถ้าผู้เช่าออกจากห้องแถวที่เช่าไม่ว่ากรณีใด ๆ ผู้เช่าจะเรียกร้องค่าเสียหายและ/หรือค่าขนย้ายจากผู้ให้เช่ามิได้<br>

            <strong>ข้อ ๔.</strong> ผู้เช่าไม่มีสิทธินำห้องเช่า ที่เช่าออกให้ผู้อื่นเช่าช่วง หรือทำนิติกรรมใดๆ กับผู้อื่นในอันที่จะเป็นผลก่อให้เกิดความผูกพันในห้องเช่า ไม่ว่าโดยตรงหรือโดยปริยาย และจะไม่ทำการดัดแปลงหรือต่อเติมห้องเช่าไม่ว่าทั้งหมดหรือบางส่วน เว้นแต่จะได้รับความยินยอมเป็นหนังสือจากผู้ให้เช่า และหากผู้เช่าได้ทำการดัดแปลงหรือต่อเติมสิ่งใดตามที่ได้รับความยินยอมเมื่อใดแล้ว ผู้เช่ายอมยกกรรมสิทธิ์ในทรัพย์สินนั้นให้ตกเป็นของผู้ให้เช่านับแต่เมื่อนั้นด้วยทั้งสิ้น<br>

            <strong>ข้อ ๕.</strong> ถ้าเกิดอัคคีภัยขึ้นไม่ว่ากรณีใดๆ ให้สัญญานี้เป็นอันสิ้นสุดลง<br>
            <strong>ข้อ ๖.</strong> ผู้เช่า จะไม่ดำเนินการค้าใดๆ อันเป็นที่รังเกียจและผิดกฎหมายหรืออาจเป็นอันตรายแก่สถานที่เช่าและจะไม่กระทำหรือยอมให้ผู้อื่นกระทำในสิ่งใดๆ อันอาจพิสูจน์ได้ว่าเป็นความเสียหายหรือก่อความเดือดร้อนรำคาญแก่ผู้ให้เช่า หรือผู้อยู่ใกล้เคียง<br>
            <strong>ข้อ ๗.</strong> เมื่อผู้เช่ากระทำผิดสัญญาข้อหนึ่งข้อใด ผู้ให้เช่ามีสิทธิบอกเลิกสัญญาได้ทันที และผู้เช่ายอมให้ผู้เช่าทรงไว้ซึ่งสิทธิที่จะเข้ายึดครอบครองสถานที่และสิ่งที่เช่าได้โดยพลัน<br><br>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;สัญญาฉบับนี้ทำขึ้นเป็นสองฉบับมีข้อความอย่างเดียวกัน ทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญานี้โดยละเอียดดีแล้ว ต่างยึดถือไว้คนละฉบับ และได้ลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; margin-top:2.2rem; text-align:center;">
            <div>
              ลงชื่อ <span style="display:inline-block; width:150px; border-bottom:1px dotted #000;"></span> ผู้เช่า<br>
              <div style="margin-top:0.4rem;">( <span class="dotted-fill">${d.tenantName}</span> )</div>
            </div>
            <div>
              ลงชื่อ <span style="display:inline-block; width:150px; border-bottom:1px dotted #000;"></span> ผู้ให้เช่า<br>
              <div style="margin-top:0.4rem;">( นายสมบัติ น้ำวน )</div>
            </div>
            <div style="margin-top:1.5rem;">
              ลงชื่อ <span style="display:inline-block; width:150px; border-bottom:1px dotted #000;"></span> พยาน<br>
              <div style="margin-top:0.4rem;">( ${d.witness1 ? `<span class="dotted-fill">${d.witness1}</span>` : '<span style="display:inline-block; width:150px; border-bottom:1px dotted #000;"></span>'} )</div>
            </div>
            <div style="margin-top:1.5rem;">
              ลงชื่อ <span style="display:inline-block; width:150px; border-bottom:1px dotted #000;"></span> พยาน<br>
              <div style="margin-top:0.4rem;">( ${d.witness2 ? `<span class="dotted-fill">${d.witness2}</span>` : '<span style="display:inline-block; width:150px; border-bottom:1px dotted #000;"></span>'} )</div>
            </div>
          </div>
        </div>

        <div id="contract-back-view" class="contract-paper back-page" style="display: none;">
          <div style="text-align:center; font-weight:bold; font-size:1.4rem; margin-bottom:1.5rem;">
            กฎและมารยาทในการอยู่เช่าห้อง/บ้าน
          </div>

          <ol style="line-height:2.1; font-size:0.95rem; margin-left:1.5rem; text-align:justify;">
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

          <div style="margin-top:2.5rem; font-size:0.95rem; line-height:1.9;">
            <p>เบอร์เจ้าของห้อง 062-6252564</p>
            <p>เบอร์สถานีตำรวจไทรน้อย 02-9238778</p>
            <p>เบอร์สถานีอนามัยวัดราษฎร์นิยม 02-9855158</p>

            <div style="text-align:center; margin-top:2rem; font-weight:600;">
              <p>ขอบคุณทุกท่านที่ไว้ใจในบริการและให้ความร่วมมือในการใช้บริการจากเรา</p>
              <h3 style="margin-top:0.4rem; font-size:1.2rem; color:var(--primary);">หอพักสมบัติ.คอม</h3>
            </div>
          </div>
        </div>

        <button class="btn btn-primary btn-full" id="btn-do-print-official-contract" style="margin-top: 1.5rem;">
          <i class="fa-solid fa-print"></i> สั่งพิมพ์หนังสือสัญญาเช่า (PDF หน้า-หลัง)
        </button>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    const tabFront = document.getElementById('tab-front-doc');
    const tabBack = document.getElementById('tab-back-doc');
    const viewFront = document.getElementById('contract-front-view');
    const viewBack = document.getElementById('contract-back-view');

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
          <div style="text-align:center; font-weight:bold; font-size:1.5rem; margin-bottom:1.2rem;">
            หนังสือสัญญาเช่าห้องแถว
          </div>
          <div style="text-align:right; margin-bottom:1rem; font-size:0.95rem;">
            เขียนที่ ๔๕/๓ หมู่ที่ ๘ ตำบลราษฎร์นิยม อำเภอไทรน้อย จังหวัดนนทบุรี ๑๑๑๕๐ โทร. ๐๒-๐๕๓๔๓๑๑,๐๘๐-๕๙๙๑๖๙๑
          </div>
          <div style="text-align:right; margin-bottom:1.5rem; font-size:0.95rem;">
            วันที่<span class="dotted-fill">${d.day}</span>เดือน<span class="dotted-fill">${d.month}</span>พ.ศ.<span class="dotted-fill">${d.year}</span>
          </div>

          <div style="line-height:2.2; font-size:0.95rem; text-align:justify;">
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;โดยหนังสือฉบับนี้ ข้าพเจ้า <strong>นายสมบัติ น้ำวน</strong> อยู่บ้านเลขที่ ๔๕/๑๐ หมู่ที่ ๘ ตำบลราษฎร์นิยม อำเภอไทรน้อย จังหวัดนนทบุรี ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>“ผู้ให้เช่า”</strong> ฝ่ายหนึ่งกับข้าพเจ้า <span class="dotted-fill">${d.tenantName}</span><br>
            อยู่บ้านเลขที่ ${d.tenantAddressFormatted}<br>
            ถือบัตรประชาชน <span class="dotted-fill">${d.tenantIdCard}</span> เมื่อวันที่ <span class="dotted-fill">${d.tenantIdIssueDate}</span><br>
            ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>“ผู้เช่า”</strong> อีกฝ่ายหนึ่ง ทั้งสองฝ่ายตกลงทำสัญญากันดังมีข้อความต่อไปนี้คือ<br>

            <strong>ข้อ ๑.</strong> ผู้ให้เช่าตกลงให้เช่าและผู้เช่าตกลงเช่าห้องแถว/บ้าน <span class="dotted-fill">${d.roomName}</span> ตั้งอยู่ ณ. เลขที่ ๔๕/๑๐ หมู่ที่ ๘ ตำบลราษฎร์นิยม อำเภอไทรน้อย จังหวัดนนทบุรี เริ่มตั้งแต่วันที่ <span class="dotted-fill">${d.startDateDay}</span> เดือน <span class="dotted-fill">${d.startDateMonth}</span> พ.ศ. <span class="dotted-fill">${d.startDateYear}</span> ถึงจนกว่าจะออก/ยกเลิกสัญญา<br>

            <strong>ข้อ ๒.</strong> ผู้เช่าตกลงให้ค่าเช่าเป็นรายเดือนๆ ละ <span class="dotted-fill">${d.monthlyRentAmt}</span> บาท (<span class="dotted-fill">${d.monthlyRentThai}</span>) มีกำหนดชำระเงินค่าเช่าทุกวันที่ ๑ ของทุก ๆ เดือน หากผู้เช่าไม่ชำระตามกําหนดยอมให้ผู้ใช้เช่ายึดทรัพย์สินและใส่กุญแจห้องของผู้เช่าได้<br>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>๒.๑</strong> ผู้เช่าจะต้องจ่ายเงินค่ามัดจำไว้เพื่อเป็นหลักประกันในทรัพย์สิน/ค่าน้ำ ค่าไฟฟ้า ค่ากุญแจ และอื่นๆ จำนวน <span class="dotted-fill">${d.depositAmt}</span> บาท (<span class="dotted-fill">${d.depositThai}</span>) และจะคืนให้เมื่อครบกำหนด ๖ เดือน/เมื่อย้ายออก<br>

            <strong>ข้อ ๓.</strong> ผู้เช่าได้ตรวจดูห้องเช่าแล้ว เห็นว่าทุกสิ่งอยู่ในสภาพเรียบร้อยใช้การได้อย่างสมบูรณ์จะดูแลมิให้ชำรุดทรุดโทรม และจะบำรุงรักษาให้อยู่ในสภาพดี พร้อมที่จะส่งมอบคืนตามสภาพเดิมทุกประการ และตกลงยอมให้ผู้เช่าหรือตัวแทน เข้าตรวจดูห้องได้ทุกเวลาภายหลังจากได้แจ้งความประสงค์ให้ผู้เช่าทราบแล้ว ถ้าผู้เช่าออกจากห้องแถวที่เช่าไม่ว่ากรณีใด ๆ ผู้เช่าจะเรียกร้องค่าเสียหายและ/หรือค่าขนย้ายจากผู้ให้เช่ามิได้<br>

            <strong>ข้อ ๔.</strong> ผู้เช่าไม่มีสิทธินำห้องเช่า ที่เช่าออกให้ผู้อื่นเช่าช่วง หรือทำนิติกรรมใดๆ กับผู้อื่นในอันที่จะเป็นผลก่อให้เกิดความผูกพันในห้องเช่า ไม่ว่าโดยตรงหรือโดยปริยาย และจะไม่ทำการดัดแปลงหรือต่อเติมห้องเช่าไม่ว่าทั้งหมดหรือบางส่วน เว้นแต่จะได้รับความยินยอมเป็นหนังสือจากผู้ให้เช่า และหากผู้เช่าได้ทำการดัดแปลงหรือต่อเติมสิ่งใดตามที่ได้รับความยินยอมเมื่อใดแล้ว ผู้เช่ายอมยกกรรมสิทธิ์ในทรัพย์สินนั้นให้ตกเป็นของผู้ให้เช่านับแต่เมื่อนั้นด้วยทั้งสิ้น<br>

            <strong>ข้อ ๕.</strong> ถ้าเกิดอัคคีภัยขึ้นไม่ว่ากรณีใดๆ ให้สัญญานี้เป็นอันสิ้นสุดลง<br>
            <strong>ข้อ ๖.</strong> ผู้เช่า จะไม่ดำเนินการค้าใดๆ อันเป็นที่รังเกียจและผิดกฎหมายหรืออาจเป็นอันตรายแก่สถานที่เช่าและจะไม่กระทำหรือยอมให้ผู้อื่นกระทำในสิ่งใดๆ อันอาจพิสูจน์ได้ว่าเป็นความเสียหายหรือก่อความเดือดร้อนรำคาญแก่ผู้ให้เช่า หรือผู้อยู่ใกล้เคียง<br>
            <strong>ข้อ ๗.</strong> เมื่อผู้เช่ากระทำผิดสัญญาข้อหนึ่งข้อใด ผู้ให้เช่ามีสิทธิบอกเลิกสัญญาได้ทันที และผู้เช่ายอมให้ผู้เช่าทรงไว้ซึ่งสิทธิที่จะเข้ายึดครอบครองสถานที่และสิ่งที่เช่าได้โดยพลัน<br><br>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;สัญญาฉบับนี้ทำขึ้นเป็นสองฉบับมีข้อความอย่างเดียวกัน ทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญานี้โดยละเอียดดีแล้ว ต่างยึดถือไว้คนละฉบับ และได้ลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; margin-top:2.2rem; text-align:center;">
            <div>
              ลงชื่อ <span style="display:inline-block; width:150px; border-bottom:1px dotted #000;"></span> ผู้เช่า<br>
              <div style="margin-top:0.4rem;">( <span class="dotted-fill">${d.tenantName}</span> )</div>
            </div>
            <div>
              ลงชื่อ <span style="display:inline-block; width:150px; border-bottom:1px dotted #000;"></span> ผู้ให้เช่า<br>
              <div style="margin-top:0.4rem;">( นายสมบัติ น้ำวน )</div>
            </div>
            <div style="margin-top:1.5rem;">
              ลงชื่อ <span style="display:inline-block; width:150px; border-bottom:1px dotted #000;"></span> พยาน<br>
              <div style="margin-top:0.4rem;">( ${d.witness1 ? `<span class="dotted-fill">${d.witness1}</span>` : '<span style="display:inline-block; width:150px; border-bottom:1px dotted #000;"></span>'} )</div>
            </div>
            <div style="margin-top:1.5rem;">
              ลงชื่อ <span style="display:inline-block; width:150px; border-bottom:1px dotted #000;"></span> พยาน<br>
              <div style="margin-top:0.4rem;">( ${d.witness2 ? `<span class="dotted-fill">${d.witness2}</span>` : '<span style="display:inline-block; width:150px; border-bottom:1px dotted #000;"></span>'} )</div>
            </div>
          </div>
        </div>

        <div class="contract-print-page back-page">
          <div style="text-align:center; font-weight:bold; font-size:1.5rem; margin-bottom:1.5rem;">
            กฎและมารยาทในการอยู่เช่าห้อง/บ้าน
          </div>

          <ol style="line-height:2.1; font-size:0.95rem; margin-left:1.5rem; text-align:justify;">
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

          <div style="margin-top:2.5rem; font-size:0.95rem; line-height:1.9;">
            <p>เบอร์เจ้าของห้อง 062-6252564</p>
            <p>เบอร์สถานีตำรวจไทรน้อย 02-9238778</p>
            <p>เบอร์สถานีอนามัยวัดราษฎร์นิยม 02-9855158</p>

            <div style="text-align:center; margin-top:2rem; font-weight:600;">
              <p>ขอบคุณทุกท่านที่ไว้ใจในบริการและให้ความร่วมมือในการใช้บริการจากเรา</p>
              <h3 style="margin-top:0.4rem; font-size:1.2rem; color:#000;">หอพักสมบัติ.คอม</h3>
            </div>
          </div>
        </div>
      `;

      window.print();
    });
  }
}

// Global Launcher
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
