/* ==========================================================================
   MYBILLS TENANT PORTAL - SOMBAT APARTMENT ENTERPRISE
   Tenant Authentication, Bill Retrieval, PromptPay QR, Slip Upload & Receipt
   ========================================================================== */

class Formatters {
  static currency(num) {
    return '฿' + (parseFloat(num) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  static thaiDate(dateStr) {
    if (!dateStr) return '-';
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

  static getNextMonth05(monthStr) {
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

class TenantDBService {
  static getInitialRooms() {
    const rooms = [];
    // S101 - S119
    for (let i = 101; i <= 119; i++) {
      rooms.push({ id: `s${i}`, name: `S${i}`, floor: 1, baseRent: 2500, currentTenantName: i % 2 === 0 ? `ผู้เช่าห้อง S${i}` : 'มีผู้เช่า' });
    }
    // Rooms 101 - 110 (Floor 1), 201 - 210 (Floor 2)
    for (let f = 1; f <= 2; f++) {
      for (let r = 1; r <= 10; r++) {
        const num = `${f}0${r}`.slice(-3);
        rooms.push({ id: `rm_${f}${r}`, name: `${num}`, floor: f, baseRent: f === 1 ? 2500 : 3500, currentTenantName: `ผู้เช่าห้อง ${num}` });
      }
    }
    // Named houses
    rooms.push(
      { id: 'rm_house1', name: 'บ้านหลัง 1', floor: 1, baseRent: 5500, currentTenantName: 'เพชรน้ำหนึ่ง' },
      { id: 'rm_house2', name: 'บ้านหลัง 2', floor: 1, baseRent: 5500, currentTenantName: 'แสงเงินแสงทอง' }
    );
    return rooms;
  }

  // [หมายเหตุ] เดิมมีฟังก์ชัน getState() ที่ cache ฐานข้อมูลทั้งก้อนไว้ใน localStorage ของเบราว์เซอร์ผู้เช่า
  // ถูกลบออกแล้ว เพราะขัดกับการแก้ปัญหาข้อมูลผู้เช่าคนอื่นรั่วไหล (ดูฟังก์ชัน getPublicState/fetchTenantBill แทน)

  static cleanUrl(url) {
    if (!url) return '';
    return url.split('?')[0].trim();
  }

  // [ความปลอดภัย] ไม่มี URL สำรอง (fallback) แบบ hardcode อีกต่อไป เพราะถ้าแอดมินลืมตั้งค่า
  // ระบบเดิมจะแอบส่งข้อมูลผู้เช่า/สลิปโอนเงินไปที่ Web App ของคนอื่นโดยไม่รู้ตัว
  // ถ้าไม่พบ URL ที่ตั้งค่าไว้ จะคืนค่าว่างและหน้าเว็บจะแสดงโหมด Demo แทน
  static getSavedSheetUrl() {
    let fromStorage = localStorage.getItem('SOMBAT_APARTMENT_SAVED_SHEET_URL');
    if (fromStorage) return this.cleanUrl(fromStorage);
    const urlParams = new URLSearchParams(window.location.search);
    const fromParam = urlParams.get('sheetUrl');
    if (fromParam) {
      const cleaned = this.cleanUrl(fromParam);
      localStorage.setItem('SOMBAT_APARTMENT_SAVED_SHEET_URL', cleaned);
      return cleaned;
    }
    return '';
  }

  // [ความปลอดภัย] apiKey สำหรับพอร์ทัลผู้เช่านี้ต้องเป็นคนละตัวกับ apiKey ของแอดมินเสมอ
  // (สิทธิ์จำกัดกว่ามาก: อ่านได้แค่รายชื่อห้อง/บิลของตัวเอง และบันทึกได้แค่การชำระเงินของตัวเอง)
  static getSavedTenantApiKey() {
    const fromStorage = localStorage.getItem('SOMBAT_APARTMENT_SAVED_TENANT_API_KEY');
    if (fromStorage) return fromStorage;
    const urlParams = new URLSearchParams(window.location.search);
    const fromParam = urlParams.get('apiKey');
    if (fromParam) {
      localStorage.setItem('SOMBAT_APARTMENT_SAVED_TENANT_API_KEY', fromParam);
      return fromParam;
    }
    return '';
  }

  static getEmptyState() {
    return {
      settings: { apartmentName: 'หอพักสมบัติ นนทบุรี', promptPayId: '0805991691' },
      rooms: this.getInitialRooms(), tenants: [], invoices: [], roomTypes: []
    };
  }

  // [พอร์ทัลผู้เช่า] ก่อนล็อกอิน ดึงมาแค่ "รายชื่อห้อง" สำหรับ dropdown เท่านั้น
  // ไม่ดึงฐานข้อมูลทั้งก้อนมาไว้ที่เบราว์เซอร์เหมือนโค้ดเดิม (ซึ่งจะมีเลขบัตร ปชช. ของผู้เช่าทุกคนติดมาด้วย)
  static async getPublicState() {
    const url = this.getSavedSheetUrl();
    if (!url) return this.getEmptyState();
    const apiKey = this.getSavedTenantApiKey();
    try {
      let fetchUrl = `${url}?action=getRoomList`;
      if (apiKey) fetchUrl += `&apiKey=${encodeURIComponent(apiKey)}`;
      const res = await fetch(fetchUrl);
      const data = await res.json();
      if (data && data.status === 'success') {
        return {
          settings: { apartmentName: data.apartmentName || 'หอพักสมบัติ นนทบุรี' },
          rooms: data.rooms || [], tenants: [], invoices: []
        };
      }
      console.warn('getRoomList error:', data && data.message);
    } catch (e) {
      console.warn('getPublicState failed:', e);
    }
    return this.getEmptyState();
  }

  // [พอร์ทัลผู้เช่า] ล็อกอินจริง: ให้ Server ยืนยันเลขบัตร ปชช. + ห้องพัก แล้วส่งกลับเฉพาะบิลของผู้เช่าคนนั้น
  static async fetchTenantBill(idCard, roomId) {
    const url = this.getSavedSheetUrl();
    if (!url) throw new Error('ยังไม่ได้เชื่อมต่อระบบกับ Google Sheets กรุณาเข้าใช้งานผ่านลิงก์ที่แอดมินส่งให้');
    const apiKey = this.getSavedTenantApiKey();
    let fetchUrl = `${url}?action=getTenantBill&idCard=${encodeURIComponent(idCard)}&roomId=${encodeURIComponent(roomId)}`;
    if (apiKey) fetchUrl += `&apiKey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(fetchUrl);
    const data = await res.json();
    if (data && data.status === 'success') return data;
    throw new Error((data && data.message) || 'ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบข้อมูลอีกครั้ง');
  }

  // [พอร์ทัลผู้เช่า] บันทึกการชำระเงิน (โอน/เงินสด) เฉพาะบิลของผู้เช่าคนนี้เท่านั้น
  // Server จะยืนยันตัวตนซ้ำอีกครั้งและไม่ยอมให้แก้ไขบิลของห้องอื่น
  static async submitPayment({ idCard, roomId, invoiceNumber, paymentMethod, slipDataUrl, slipHash, qrPayload }) {
    const url = this.getSavedSheetUrl();
    if (!url) throw new Error('ยังไม่ได้เชื่อมต่อระบบกับ Google Sheets กรุณาเข้าใช้งานผ่านลิงก์ที่แอดมินส่งให้');
    const apiKey = this.getSavedTenantApiKey();

    const syncLoader = document.createElement('div');
    syncLoader.id = 'app-sync-loader';
    syncLoader.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15, 23, 42, 0.75); color:#f8fafc; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:99999; font-family:sans-serif; backdrop-filter:blur(4px);';
    syncLoader.innerHTML = `
      <div style="width:45px; height:45px; border:4px solid #334155; border-top-color:#10b981; border-radius:50%; animation: spin 1s linear infinite; margin-bottom:1rem;"></div>
      <div style="font-weight:700; font-size:1.15rem; margin-bottom:0.25rem;">กำลังส่งข้อมูลการชำระเงินไปยัง Google Sheets...</div>
      <div style="font-size:0.88rem; color:#cbd5e1;">กรุณารอสักครู่ ระบบกำลังยืนยันยอดบิล</div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;
    document.body.appendChild(syncLoader);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'submitTenantPayment', apiKey, idCard, roomId, invoiceNumber,
          paymentMethod, slipDataUrl, slipHash, qrPayload
        }),
        redirect: 'follow'
      });
      if (!response.ok) throw new Error(`Server status ${response.status}`);
      const resJson = await response.json();
      if (resJson && resJson.status === 'error') {
        throw new Error(resJson.message || 'Unknown server error');
      }
      return resJson;
    } finally {
      syncLoader.remove();
    }
  }

  static getLoggedInTenant() {
    localStorage.removeItem(this.TENANT_SESSION_KEY);
    const raw = sessionStorage.getItem(this.TENANT_SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  static setLoggedInTenant(tenant) {
    localStorage.removeItem(this.TENANT_SESSION_KEY);
    if (tenant) {
      sessionStorage.setItem(this.TENANT_SESSION_KEY, JSON.stringify(tenant));
    } else {
      sessionStorage.removeItem(this.TENANT_SESSION_KEY);
    }
  }
}

class MyBillsApp {
  static state;
  static currentTenant = null;
  static currentSlipDataUrl = '';
  static currentPayMethod = 'transfer';

  static async computeSha256(base64Str) {
    // [ความปลอดภัย] เดิมถ้าคำนวณแฮชไม่สำเร็จ (เช่น crypto.subtle ใช้ไม่ได้เพราะไม่ได้เปิดผ่าน HTTPS)
    // จะ fallback เป็นค่าแฮชปลอมจาก timestamp/random ซึ่งทำให้ระบบตรวจจับสลิปซ้ำที่ฝั่ง Apps Script
    // เจอค่าที่ไม่สัมพันธ์กับรูปจริงเลย (ใช้สลิปเดิมซ้ำได้เพราะแฮชสุ่มใหม่ทุกครั้ง) ตอนนี้จึงโยน error
    // ออกไปแทน เพื่อให้ผู้เรียกใช้บล็อกการอัปโหลดและแจ้งผู้เช่าให้ลองใหม่แทนที่จะปล่อยผ่านอย่างเงียบๆ
    const encoder = new TextEncoder();
    const data = encoder.encode(base64Str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static async scanQrCodeFromDataUrl(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          if (window.jsQR) {
            const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });
            if (code) {
              resolve(code.data);
              return;
            }
          }
        } catch (e) {
          console.error("Error reading image data for QR:", e);
        }
        resolve(null);
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  static async init() {
    // 1. Resolve sheet url + apiKey from query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const paramUrl = urlParams.get('sheetUrl');
    if (paramUrl) {
      localStorage.setItem('SOMBAT_APARTMENT_SAVED_SHEET_URL', paramUrl);
    }
    const paramKey = urlParams.get('apiKey');
    if (paramKey) {
      localStorage.setItem('SOMBAT_APARTMENT_SAVED_TENANT_API_KEY', paramKey);
    }

    // Show a modern startup loading screen
    const loader = document.createElement('div');
    loader.id = 'app-startup-loader';
    loader.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#0f172a; color:#f8fafc; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:99999; font-family:sans-serif; transition: opacity 0.3s;';
    loader.innerHTML = `
      <div style="width:50px; height:50px; border:4px solid #334155; border-top-color:#10b981; border-radius:50%; animation: spin 1s linear infinite; margin-bottom:1rem;"></div>
      <div style="font-weight:700; font-size:1.1rem; margin-bottom:0.5rem;">กำลังโหลดข้อมูลล่าสุด...</div>
      <div style="font-size:0.9rem; color:#94a3b8;">ระบบผู้เช่า หอพักสมบัติ นนทบุรี</div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;
    document.body.appendChild(loader);

    // [ความปลอดภัย] ไม่ดึงฐานข้อมูลทั้งก้อนมาไว้ที่เบราว์เซอร์อีกต่อไป
    // - ถ้ายังไม่ได้ล็อกอิน: ดึงแค่รายชื่อห้อง (ไม่มีข้อมูลผู้เช่าคนอื่นติดมา) สำหรับ dropdown เท่านั้น
    // - ถ้ามีเซสชันล็อกอินค้างอยู่: ให้ Server ยืนยันตัวตนอีกครั้งแล้วส่งกลับเฉพาะบิลของผู้เช่าคนนั้น
    this.currentTenant = TenantDBService.getLoggedInTenant();

    try {
      if (this.currentTenant && this.currentTenant.idCard && this.currentTenant.assignedRoomId) {
        const cleanIdCard = String(this.currentTenant.idCard).replace(/\D/g, '');
        this.state = await TenantDBService.getPublicState(); // โหลดรายชื่อห้องไว้ก่อนเผื่อใช้แสดงผล
        const billData = await TenantDBService.fetchTenantBill(cleanIdCard, this.currentTenant.assignedRoomId);
        this.applyTenantBillData(billData);
        TenantDBService.setLoggedInTenant(this.currentTenant);
      } else {
        this.state = await TenantDBService.getPublicState();
      }
    } catch (err) {
      console.warn('Startup fetch warning, session may have expired:', err);
      this.currentTenant = null;
      TenantDBService.setLoggedInTenant(null);
      this.state = await TenantDBService.getPublicState().catch(() => TenantDBService.getEmptyState());
    }

    // Remove loading overlay
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 300);

    // Render screen
    this.render();
  }

  // รวมข้อมูลบิลที่ยืนยันโดย Server แล้ว (จาก getTenantBill / submitTenantPayment) เข้ากับ state ปัจจุบัน
  static applyTenantBillData(billData) {
    const existingRooms = (this.state && this.state.rooms) || [];
    this.state = {
      settings: billData.settings || (this.state && this.state.settings) || {},
      rooms: existingRooms.length > 0 ? existingRooms : (billData.room ? [billData.room] : []),
      invoices: billData.invoices || [],
      tenants: [billData.tenant].filter(Boolean)
    };
    this.currentTenant = {
      id: billData.tenant.id,
      name: billData.tenant.name,
      idCard: Formatters.formatIdCard(String(billData.tenant.idCard || '').replace(/\D/g, '')),
      tel: billData.tenant.tel || '080-5991691',
      assignedRoomId: billData.tenant.assignedRoomId
    };
  }

  static render() {
    const root = document.getElementById('tenant-app-root');
    if (!root) return;

    if (!this.currentTenant) {
      root.innerHTML = this.renderLoginScreen();
      this.bindLoginEvents();
    } else {
      root.innerHTML = this.renderBillDashboard();
      this.bindDashboardEvents();
    }
  }

  // --- 1. LOGIN SCREEN ---
  static renderLoginScreen() {
    const apartmentName = (this.state.settings && this.state.settings.apartmentName) || 'หอพักสมบัติ นนทบุรี';
    const rooms = this.state.rooms || [];

    const hasSheetUrl = !!localStorage.getItem('SOMBAT_APARTMENT_SAVED_SHEET_URL') || !!(new URLSearchParams(window.location.search).get('sheetUrl'));
    const warningBanner = hasSheetUrl ? '' : `
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:0.85rem; font-size:0.82rem; color:#b45309; text-align:center; margin-bottom:1.25rem; line-height:1.5;">
        ⚠️ <strong>ระบบยังไม่ได้เชื่อมต่อกับ Google Sheets</strong><br>
        คุณกำลังดู <u>ข้อมูลตัวอย่าง (Demo/Mock)</u> เนื่องจากเปิดใช้งานหน้าเว็บโดยตรงโดยไม่ได้ผ่านลิงก์ของหอพัก กรุณาเข้าใช้งานผ่านลิงก์ที่แอดมินส่งให้ทาง LINE เพื่อดูบิลจริงครับ
      </div>
    `;

    return `
      <div class="tenant-card animate-fade-in">
        <div class="brand-header">
          <div class="brand-logo"><i class="fa-solid fa-file-invoice-dollar"></i></div>
          <h1>MyBills - ระบบแจ้งบิลห้องเช่า</h1>
          <p>${apartmentName}</p>
        </div>

        ${warningBanner}

        <form id="tenant-login-form">
          <div class="form-group" style="margin-bottom:1rem;">
            <label style="font-weight:700; color:#334155; display:block; margin-bottom:0.5rem;">
              <i class="fa-solid fa-door-closed text-primary"></i> เลือกห้องพักของคุณ *
            </label>
            <select id="select-tenant-room" class="form-control" style="padding:0.85rem 1rem; border-radius:10px; font-size:1.05rem;" required>
              <option value="">-- เลือกห้องพักของคุณ --</option>
              ${rooms.map(r => `
                <option value="${r.id}">
                  ห้อง ${r.name}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group" style="margin-bottom:1.5rem;">
            <label style="font-weight:700; color:#334155; display:block; margin-bottom:0.5rem;">
              <i class="fa-solid fa-id-card text-primary"></i> เลขบัตรประชาชน (13 หลัก) *
            </label>
            <input type="text" id="input-idcard" class="form-control" placeholder="ระบุเลขบัตรประชาชน 13 หลัก..." maxlength="17" required style="padding:0.85rem 1rem; border-radius:10px; font-size:1.05rem; letter-spacing:1px;" autocomplete="off">
            <small class="text-muted" style="font-size:0.8rem; margin-top:0.35rem; display:block;">💡 กรอกเลขบัตรประชาชนและเลือกห้องพักเพื่อดูใบแจ้งหนี้/PDF</small>
          </div>

          <button type="submit" class="btn btn-primary btn-full" style="padding:0.85rem; font-size:1.05rem; font-weight:700; border-radius:10px; box-shadow:0 8px 20px rgba(37,99,235,0.3);">
            <i class="fa-solid fa-file-pdf"></i> เข้าสู่ระบบเปิดดูบิล PDF ห้องพัก
          </button>
        </form>

        <div style="margin-top:2rem; padding-top:1.25rem; border-top:1px solid #e2e8f0; text-align:center;">
          <p class="text-muted" style="font-size:0.82rem;">สอบถามข้อมูลเพิ่มเติม ติดต่อสำนักงานหอพัก โทร. 080-5991691</p>
        </div>
      </div>
    `;
  }

  static bindLoginEvents() {
    const form = document.getElementById('tenant-login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selectedRoomId = document.getElementById('select-tenant-room').value;
      const rawInput = document.getElementById('input-idcard').value.trim();
      const cleanInput = rawInput.replace(/\D/g, '');

      if (!selectedRoomId) {
        alert('กรุณาเลือกห้องพักของคุณ');
        return;
      }

      if (cleanInput.length !== 13) {
        alert('กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบ...'; }

      try {
        // [ความปลอดภัย] ให้ Server เป็นผู้ยืนยันเลขบัตร ปชช. + ห้องพักเองทั้งหมด แล้วส่งกลับเฉพาะบิลของผู้เช่าคนนี้
        // (ไม่ดึงฐานข้อมูลทั้งก้อนมากรองเองที่ฝั่ง client เหมือนเดิมอีกต่อไป)
        const billData = await TenantDBService.fetchTenantBill(cleanInput, selectedRoomId);
        this.applyTenantBillData(billData);
        TenantDBService.setLoggedInTenant(this.currentTenant);
        this.render();
      } catch (err) {
        alert('❌ ' + (err.message || 'ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบข้อมูลอีกครั้ง'));
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> เข้าสู่ระบบเปิดดูบิล PDF ห้องพัก'; }
      }
    });
  }

  // --- 2. TENANT BILL DASHBOARD ---
  static renderBillDashboard() {
    const tenant = this.currentTenant;
    const rooms = this.state.rooms || [];
    const invoices = this.state.invoices || [];
    const tenants = this.state.tenants || [];

    const room = rooms.find(r => r.id === tenant.assignedRoomId || (r.name && tenant.assignedRoomId && r.name.toLowerCase() === tenant.assignedRoomId.toLowerCase())) || { id: tenant.assignedRoomId || 's101', name: 'S101', floor: 1, baseRent: 2500 };
    
    // 1. Filter invoices matching this tenant's 13-digit National ID (clean format)
    const cleanTenantIdCard = String(tenant.idCard || '').replace(/\D/g, '');
    let matchedInvoices = [];
    
    if (cleanTenantIdCard && cleanTenantIdCard.length === 13) {
      matchedInvoices = invoices.filter(i => {
        const cleanInvIdCard = String(i.idCard || '').replace(/\D/g, '');
        return cleanInvIdCard === cleanTenantIdCard;
      });
    }

    // 2. If no invoice matches by National ID, fallback to room ID / room Name
    if (matchedInvoices.length === 0) {
      matchedInvoices = invoices.filter(i => 
        (i.roomId && (i.roomId === room.id || i.roomId.toLowerCase() === room.id.toLowerCase())) ||
        (i.roomName && room.name && i.roomName.trim().toLowerCase() === room.name.trim().toLowerCase())
      );
    }

    // 3. Deduplicate invoices by monthKey, prioritizing paid status
    const deduplicatedMap = new Map();
    const sortedForDeduplication = [...matchedInvoices].sort((a, b) => {
      if (a.status === 'paid' && b.status !== 'paid') return -1;
      if (a.status !== 'paid' && b.status === 'paid') return 1;
      return 0;
    });

    for (const inv of sortedForDeduplication) {
      if (!deduplicatedMap.has(inv.monthKey)) {
        deduplicatedMap.set(inv.monthKey, inv);
      }
    }

    // 4. Sort by monthKey descending (latest month first)
    const sortedInvoices = Array.from(deduplicatedMap.values()).sort((a, b) => {
      return (b.monthKey || '').localeCompare(a.monthKey || '');
    });
    
    const monthKey = new Date().toISOString().slice(0, 7);
    let latestInvoice = sortedInvoices.length > 0 ? sortedInvoices[0] : null;

    // Resolve tenant real name
    let realTenantName = '';
    if (latestInvoice && latestInvoice.tenantName && !latestInvoice.tenantName.includes('มีผู้เช่า')) {
      realTenantName = latestInvoice.tenantName;
    } else if (room.currentTenantName && room.currentTenantName !== 'ไม่มีผู้เข้าเช่า' && !room.currentTenantName.includes('มีผู้เช่า')) {
      realTenantName = room.currentTenantName;
    } else {
      const tenantMatch = tenants.find(t => t.assignedRoomId === room.id && t.name && !t.name.includes('มีผู้เช่า'));
      if (tenantMatch) realTenantName = tenantMatch.name;
    }
    if (!realTenantName) {
      realTenantName = 'ผู้เช่าห้อง ' + (room.name || 'S101');
    }

    if (!latestInvoice) {
      const rentAmt = room.baseRent || 2500;
      const elecAmt = 520;
      const waterAmt = 200;
      const trashAmt = 20;
      const totalAmt = rentAmt + elecAmt + waterAmt + trashAmt;
      
      latestInvoice = {
        id: 'inv_auto_' + tenant.id,
        invoiceNumber: `INV${monthKey.replace('-', '')}-${room.name || 'S101'}`,
        monthKey: monthKey,
        roomId: room.id || 's101',
        roomName: room.name || 'S101',
        tenantName: realTenantName,
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: Formatters.getNextMonth05(monthKey),
        elecPrev: room.lastElecMeter || 1000, elecCurr: (room.lastElecMeter || 1000) + 65, elecAmount: elecAmt,
        waterPrev: room.lastWaterMeter || 100, waterCurr: (room.lastWaterMeter || 100) + 10, waterAmount: waterAmt,
        rentAmount: rentAmt,
        trashFee: trashAmt,
        totalAmount: totalAmt,
        paidAmount: 0,
        outstandingAmount: totalAmt,
        status: 'unpaid'
      };
    } else {
      latestInvoice.tenantName = realTenantName;
    }

    // Keep track of the active invoice number
    MyBillsApp.activeInvoiceNumber = latestInvoice.invoiceNumber;

    tenant.name = realTenantName;
    const isPaid = latestInvoice.status === 'paid';
    const amountToPay = latestInvoice.outstandingAmount || latestInvoice.totalAmount;

    const hasSheetUrl = !!localStorage.getItem('SOMBAT_APARTMENT_SAVED_SHEET_URL') || !!(new URLSearchParams(window.location.search).get('sheetUrl'));
    const warningBanner = hasSheetUrl ? '' : `
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:0.85rem; font-size:0.82rem; color:#b45309; text-align:center; margin-bottom:1.25rem; line-height:1.5;">
        ⚠️ <strong>คำเตือน: กำลังแสดงข้อมูลตัวอย่าง (Demo/Mock)</strong><br>
        บิลนี้ไม่ใช่บิลจริง เนื่องจากหน้านี้ไม่ได้เชื่อมต่อกับ Google Sheets กรุณาเข้าใช้งานผ่านลิงก์เต็มรูปแบบที่คุณได้รับจากแอดมิน เพื่อเปิดบิลจริงของคุณครับ
      </div>
    `;

    return `
      <div class="tenant-card animate-fade-in">
        ${warningBanner}
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; padding-bottom:1rem; margin-bottom:1.25rem;">
          <div>
            <span class="badge-pill badge-primary" style="font-size:0.8rem;"><i class="fa-solid fa-house-user"></i> ห้อง ${room.name || 'S101'} (ชั้น ${room.floor || 1})</span>
            <h2 style="font-size:1.25rem; font-weight:800; color:#0f172a; margin-top:0.35rem;">${realTenantName}</h2>
          </div>
          <button id="btn-tenant-logout" class="btn btn-secondary btn-sm" style="border-radius:8px;" title="ออกจากระบบ">
            <i class="fa-solid fa-right-from-bracket text-danger"></i> ออกจากระบบ
          </button>
        </div>

        ${isPaid ? `
          <div style="background:#ffffff; border:2px solid #10b981; border-radius:16px; padding:1.5rem; margin-bottom:1.25rem; box-shadow:0 10px 30px rgba(16,185,129,0.15);">
            <div style="text-align:center; border-bottom:2px dashed #cbd5e1; padding-bottom:1rem; margin-bottom:1rem;">
              <div style="font-size:3rem; color:#10b981; margin-bottom:0.35rem;"><i class="fa-solid fa-circle-check"></i></div>
              <h2 style="color:#065f46; font-size:1.3rem; font-weight:800;">ใบเสร็จรับเงิน (Official Receipt)</h2>
              <span class="badge-pill badge-success" style="font-size:0.85rem; margin-top:0.35rem;">🟢 ชำระเงินเรียบร้อยแล้ว</span>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; background:#f8fafc; padding:0.85rem; border-radius:10px; font-size:0.88rem; margin-bottom:1rem;">
              <div><strong>เลขที่ใบเสร็จ:</strong> ${latestInvoice.invoiceNumber}</div>
              <div><strong>ห้องพัก:</strong> ห้อง ${latestInvoice.roomName}</div>
              <div><strong>ผู้ชำระเงิน:</strong> ${latestInvoice.tenantName}</div>
              <div><strong>วันที่ชำระ:</strong> ${Formatters.thaiDate(latestInvoice.paymentDate || new Date().toISOString())}</div>
            </div>

            <table style="width:100%; border-collapse:collapse; font-size:0.88rem; margin-bottom:1rem;" border="1" cellpadding="6">
              <thead>
                <tr style="background:#f1f5f9; color:#1e293b;">
                  <th style="text-align:center;">ลำดับ</th>
                  <th>รายการชำระเงิน</th>
                  <th style="text-align:right;">จำนวนเงิน (บาท)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style="text-align:center;">1</td><td>ค่าเช่าห้องพักประจำเดือน (${Formatters.thaiMonthBE(latestInvoice.monthKey)})</td><td style="text-align:right;">${Formatters.currency(latestInvoice.rentAmount || 2500)}</td></tr>
                <tr><td style="text-align:center;">2</td><td>ค่าไฟฟ้า (${latestInvoice.elecPrev} ➔ ${latestInvoice.elecCurr})</td><td style="text-align:right;">${Formatters.currency(latestInvoice.elecAmount || 0)}</td></tr>
                <tr><td style="text-align:center;">3</td><td>ค่าน้ำประปา (${latestInvoice.waterPrev} ➔ ${latestInvoice.waterCurr})</td><td style="text-align:right;">${Formatters.currency(latestInvoice.waterAmount || 0)}</td></tr>
                <tr><td style="text-align:center;">4</td><td>ค่าขยะ / สาธารณูปโภค</td><td style="text-align:right;">${Formatters.currency(latestInvoice.trashFee !== undefined ? latestInvoice.trashFee : 20)}</td></tr>
                <tr style="background:#f8fafc; font-weight:bold;"><td colspan="2" style="text-align:right;">ยอดรวมชำระทั้งสิ้น:</td><td style="text-align:right; color:#10b981; font-size:1.1rem;">${Formatters.currency(latestInvoice.paidAmount || latestInvoice.totalAmount)}</td></tr>
              </tbody>
            </table>

            <button id="btn-view-receipt" class="btn btn-success btn-full" style="padding:0.75rem; font-weight:700; border-radius:10px;">
              <i class="fa-solid fa-print"></i> พิมพ์ / ดาวน์โหลดใบเสร็จ (PDF)
            </button>
          </div>
        ` : `
          <div class="bill-card-detail">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem;">
              <h3 style="font-size:1.05rem; font-weight:700; color:#0f172a;">
                <i class="fa-solid fa-file-invoice-dollar text-primary"></i> ใบแจ้งหนี้ประจำเดือน ${Formatters.thaiMonthBE(latestInvoice.monthKey)}
              </h3>
              <span class="badge-pill badge-danger" style="font-size:0.85rem; padding:0.35rem 0.75rem;">
                🔴 ค้างชำระ
              </span>
            </div>

            <div class="bill-row"><span>เลขที่บิล:</span><strong>${latestInvoice.invoiceNumber}</strong></div>
            <div class="bill-row"><span>วันที่ออกบิล:</span><span>${Formatters.thaiDate(latestInvoice.issueDate)}</span></div>
            <div class="bill-row"><span>กำหนดชำระภายใน:</span><strong class="text-danger">${Formatters.thaiDate(latestInvoice.dueDate)}</strong></div>
            
            <div class="bill-row">
              <span>ค่าไฟฟ้า (${latestInvoice.elecPrev} ➔ ${latestInvoice.elecCurr} = ${Math.max(0, latestInvoice.elecCurr - latestInvoice.elecPrev)} ยูนิต):</span>
              <strong>${Formatters.currency(latestInvoice.elecAmount)}</strong>
            </div>

            <div class="bill-row">
              <span>ค่าน้ำประปา (${latestInvoice.waterPrev} ➔ ${latestInvoice.waterCurr} = ${Math.max(0, latestInvoice.waterCurr - latestInvoice.waterPrev)} ยูนิต):</span>
              <strong>${Formatters.currency(latestInvoice.waterAmount)}</strong>
            </div>

            <div class="bill-row"><span>ค่าเช่าห้องพัก:</span><strong>${Formatters.currency(latestInvoice.rentAmount)}</strong></div>
            <div class="bill-row"><span>ค่าขยะ / สาธารณูปโภค:</span><strong>${Formatters.currency(latestInvoice.trashFee !== undefined ? latestInvoice.trashFee : 20)}</strong></div>

            <div class="total-row">
              <span style="font-weight:700; color:#1e40af; font-size:1.05rem;">ยอดบิลรวมสุทธิ:</span>
              <strong style="font-size:1.35rem; color:#1d4ed8; font-weight:800;">${Formatters.currency(latestInvoice.totalAmount)}</strong>
            </div>
          </div>

          <button id="btn-view-official-bill" class="btn btn-secondary btn-full" style="margin-bottom:1.25rem; padding:0.75rem; border-radius:10px; font-weight:700; background:#f1f5f9; border:1px solid #cbd5e1; color:#0f172a;">
            <i class="fa-solid fa-file-pdf text-danger" style="font-size:1.2rem;"></i> เปิดดูฟอร์มใบแจ้งหนี้ฉบับเต็ม (PDF Printable Bill)
          </button>

          <!-- ตัวเลือกช่องทางการชำระเงิน -->
          <div style="display:flex; border:1px solid #cbd5e1; border-radius:10px; overflow:hidden; margin-bottom:1.25rem; font-family:inherit; box-shadow:var(--shadow-sm);">
            <button type="button" id="pay-method-transfer" style="flex:1; border:none; padding:0.75rem; font-weight:700; cursor:pointer; font-size:0.92rem; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:0.4rem; ${MyBillsApp.currentPayMethod === 'transfer' ? 'background:#2563eb; color:#ffffff;' : 'background:#f8fafc; color:#475569;'}">
              <i class="fa-solid fa-credit-card"></i> โอนเงิน (PromptPay)
            </button>
            <button type="button" id="pay-method-cash" style="flex:1; border:none; padding:0.75rem; font-weight:700; cursor:pointer; font-size:0.92rem; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:0.4rem; ${MyBillsApp.currentPayMethod === 'cash' ? 'background:#059669; color:#ffffff;' : 'background:#f8fafc; color:#475569;'}">
              <i class="fa-solid fa-money-bill-wave"></i> ชำระเงินสด
            </button>
          </div>

          ${MyBillsApp.currentPayMethod === 'transfer' ? `
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; padding:1rem; text-align:center; margin-bottom:1.25rem;">
              <div style="font-size:0.92rem; color:#334155; line-height:1.6;">
                <i class="fa-solid fa-building-columns text-primary"></i> <strong>โอนชำระเงินผ่านบัญชีธนาคาร:</strong><br>
                ธนาคารกรุงศรีอยุธยา (BAY) เลขที่บัญชี: <strong style="font-size:1.15rem; color:#2563eb;">240-1-34666-3</strong><br>
                ชื่อบัญชี: <strong>นางสมผิว น้ำวน</strong> | ยอดโอนสุทธิ: <strong style="font-size:1.15rem; color:#dc2626;">${Formatters.currency(amountToPay)}</strong>
              </div>
            </div>

            <form id="slip-upload-form">
              <div class="form-group">
                <label style="font-weight:700; color:#334155; display:block; margin-bottom:0.5rem;">
                  <i class="fa-solid fa-file-arrow-up text-primary"></i> อัปโหลดสลิปหลักฐานการโอนเงิน *
                </label>
                
                <div class="slip-upload-area" id="slip-drop-area">
                  <i class="fa-solid fa-cloud-arrow-up" style="font-size:2.2rem; color:#2563eb; margin-bottom:0.5rem;"></i>
                  <div style="font-weight:600; color:#334155;">กดที่นี่เพื่อเลือกไฟล์รูปสลิปเงินโอน</div>
                  <small class="text-muted">รองรับไฟล์ภาพ JPG, PNG (ไม่เกิน 10MB)</small>
                  <input type="file" id="input-slip-file" accept="image/*" style="display:none;" required>
                  <div id="slip-preview-container" style="display:none; margin-top:0.75rem;">
                    <img id="slip-preview-img" class="slip-preview-img" src="" alt="Preview Slip">
                  </div>
                </div>
              </div>

              <button type="submit" id="btn-submit-pay" class="btn btn-primary btn-full" style="padding:0.85rem; font-size:1.1rem; font-weight:800; border-radius:12px; box-shadow:0 8px 20px rgba(37,99,235,0.35);">
                <i class="fa-solid fa-paper-plane"></i> ชำระบริการและแนบสลิป
              </button>
            </form>
          ` : `
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:1.25rem; margin-bottom:1.5rem; text-align:center;">
              <i class="fa-solid fa-money-bill-wave" style="font-size:2.5rem; color:#16a34a; margin-bottom:0.5rem;"></i>
              <h4 style="color:#14532d; font-size:1rem; font-weight:700; margin-bottom:0.5rem;">ชำระเงินด้วยเงินสด</h4>
              <p style="font-size:0.88rem; color:#166534; line-height:1.6; margin:0 0 1.25rem 0;">
                คุณต้องการแจ้งชำระเงินด้วยเงินสดใช่หรือไม่?<br>เมื่อกดปุ่มยืนยัน ระบบจะตั้งสถานะบิลของห้องคุณเป็น <strong>"ชำระแล้ว"</strong> และส่งข้อความแจ้งเตือนเจ้าหน้าที่โดยอัตโนมัติ
              </p>
              <button type="button" id="btn-submit-cash-pay" class="btn btn-success btn-full" style="padding:0.85rem; font-size:1.1rem; font-weight:800; border-radius:12px; background:#059669; border-color:#059669; box-shadow:0 8px 20px rgba(5,150,105,0.35); cursor:pointer;">
                <i class="fa-solid fa-circle-check"></i> ยืนยันการชำระด้วยเงินสด
              </button>
            </div>
          `}
        `}
      </div>
    `;
  }

  static bindDashboardEvents() {
    const logoutBtn = document.getElementById('btn-tenant-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        TenantDBService.setLoggedInTenant(null);
        this.currentTenant = null;
        this.render();
      });
    }

    const viewReceiptBtn = document.getElementById('btn-view-receipt');
    if (viewReceiptBtn) {
      viewReceiptBtn.addEventListener('click', () => {
        this.openReceiptModal();
      });
    }

    const viewOfficialBillBtn = document.getElementById('btn-view-official-bill');
    if (viewOfficialBillBtn) {
      viewOfficialBillBtn.addEventListener('click', () => {
        this.openOfficialBillModal();
      });
    }

    const dropArea = document.getElementById('slip-drop-area');
    const fileInput = document.getElementById('input-slip-file');
    const previewContainer = document.getElementById('slip-preview-container');
    const previewImg = document.getElementById('slip-preview-img');

    if (dropArea && fileInput) {
      dropArea.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            this.currentSlipDataUrl = evt.target.result;
            previewImg.src = evt.target.result;
            previewContainer.style.display = 'block';
          };
          reader.readAsDataURL(file);
        }
      });
    }

    const slipForm = document.getElementById('slip-upload-form');
    if (slipForm) {
      slipForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!this.currentSlipDataUrl) {
          alert('กรุณาอัปโหลดรูปภาพสลิปหลักฐานการโอนเงินก่อนกดชำระบริการ');
          return;
        }

        // Show a loading screen during client-side slip analysis
        const analysisLoader = document.createElement('div');
        analysisLoader.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15, 23, 42, 0.85); color:#f8fafc; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:999999; font-family:sans-serif; backdrop-filter:blur(4px);';
        analysisLoader.innerHTML = `
          <div style="width:45px; height:45px; border:4px solid #334155; border-top-color:#10b981; border-radius:50%; animation: spin 1s linear infinite; margin-bottom:1rem;"></div>
          <div style="font-weight:700; font-size:1.15rem; margin-bottom:0.25rem;">กำลังวิเคราะห์ความปลอดภัยสลิปชำระเงิน...</div>
          <div style="font-size:0.88rem; color:#cbd5e1;">ระบบกำลังถอดรหัส QR Code และคำนวณลายนิ้วมือสลิป</div>
          <style>
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        `;
        document.body.appendChild(analysisLoader);

        const tenant = this.currentTenant;
        const rooms = this.state.rooms || [];
        const room = rooms.find(r => r.id === tenant.assignedRoomId) || { name: 'ยังไม่ระบุ' };

        const invoices = this.state.invoices || [];
        const invIdx = invoices.findIndex(i => i.invoiceNumber === MyBillsApp.activeInvoiceNumber);

        let hashHex = '';
        let qrCodeData = null;

        try {
          // Preprocess slip: hash image & scan QR code
          hashHex = await MyBillsApp.computeSha256(this.currentSlipDataUrl);
          qrCodeData = await MyBillsApp.scanQrCodeFromDataUrl(this.currentSlipDataUrl);
        } catch (err) {
          console.error("Client slip preprocessing failed:", err);
          analysisLoader.remove();
          alert('❌ ไม่สามารถประมวลผลรูปสลิปได้ในเบราว์เซอร์นี้ กรุณาลองใหม่อีกครั้ง หรือเปิดผ่านลิงก์ HTTPS ของหอพัก');
          return;
        } finally {
          analysisLoader.remove();
        }

        const cleanIdCard = String(tenant.idCard || '').replace(/\D/g, '');

        try {
          // [ความปลอดภัย] ส่งไปให้ Server ยืนยันตัวตน + ตรวจสอบสลิป + แก้ไขเฉพาะบิลของผู้เช่าคนนี้เท่านั้น
          // (ไม่ส่ง state ทั้งก้อนไปเขียนทับฐานข้อมูลเหมือนเดิมอีกต่อไป)
          const result = await TenantDBService.submitPayment({
            idCard: cleanIdCard,
            roomId: tenant.assignedRoomId,
            invoiceNumber: MyBillsApp.activeInvoiceNumber,
            paymentMethod: 'transfer',
            slipDataUrl: this.currentSlipDataUrl,
            slipHash: hashHex,
            qrPayload: qrCodeData
          });

          if (invIdx !== -1 && result && result.invoice) {
            invoices[invIdx] = Object.assign({}, invoices[invIdx], result.invoice);
          }

          // Show Success Alert Popup & Open Receipt Modal
          alert('🟢 ยืนยันสลิปชำระเงินสำเร็จ!\n\nระบบทำความสะอาดและตรวจสอบความถูกต้องสลิปเรียบร้อยแล้ว');

          this.render();
          this.openReceiptModal(invoices[invIdx]);
        } catch (err) {
          alert('❌ ปฏิเสธการชำระเงิน: ' + err.message);
        }
      });
    }

    // Toggle Payment Method
    const btnMethodTransfer = document.getElementById('pay-method-transfer');
    const btnMethodCash = document.getElementById('pay-method-cash');
    if (btnMethodTransfer && btnMethodCash) {
      btnMethodTransfer.addEventListener('click', () => {
        if (MyBillsApp.currentPayMethod !== 'transfer') {
          MyBillsApp.currentPayMethod = 'transfer';
          MyBillsApp.render();
        }
      });
      btnMethodCash.addEventListener('click', () => {
        if (MyBillsApp.currentPayMethod !== 'cash') {
          MyBillsApp.currentPayMethod = 'cash';
          MyBillsApp.render();
        }
      });
    }

    // Cash Payment Submission
    const btnSubmitCashPay = document.getElementById('btn-submit-cash-pay');
    if (btnSubmitCashPay) {
      btnSubmitCashPay.addEventListener('click', async () => {
        const tenant = this.currentTenant;
        const invoices = this.state.invoices || [];
        const invIdx = invoices.findIndex(i => i.invoiceNumber === MyBillsApp.activeInvoiceNumber);
        const cleanIdCard = String(tenant.idCard || '').replace(/\D/g, '');

        try {
          // [ความปลอดภัย] Server จะยืนยันตัวตนอีกครั้งและแก้ไขเฉพาะบิลของผู้เช่าคนนี้ พร้อมแจ้งเตือน LINE เอง
          const result = await TenantDBService.submitPayment({
            idCard: cleanIdCard,
            roomId: tenant.assignedRoomId,
            invoiceNumber: MyBillsApp.activeInvoiceNumber,
            paymentMethod: 'cash'
          });

          if (invIdx !== -1 && result && result.invoice) {
            invoices[invIdx] = Object.assign({}, invoices[invIdx], result.invoice);
          }

          alert('🟢 บันทึกข้อมูลชำระเงินสดเรียบร้อยแล้ว!\n\nระบบได้รับการชำระเงินและแจ้งไปยังเจ้าหน้าที่เรียบร้อยแล้วครับ');
          this.render();
          if (invoices[invIdx]) this.openReceiptModal(invoices[invIdx]);
        } catch (err) {
          alert('❌ เกิดข้อผิดพลาดในการส่งข้อมูลไปยัง Google Sheets: ' + err.message + '\n\nกรุณาตรวจการตั้งค่าสิทธิ์ หรืออัปเดตสคริปต์ Code.gs ตามขั้นตอน');
        }
      });
    }
  }

  // --- 3. OFFICIAL BILL POPUP MODAL ---
  static openOfficialBillModal(invParam = null) {
    const tenant = this.currentTenant;
    const rooms = this.state.rooms || [];
    const invoices = this.state.invoices || [];
    const room = rooms.find(r => r.id === tenant.assignedRoomId || r.currentTenantName === tenant.name) || { name: tenant.assignedRoomId || 'S101' };
    
    const inv = invParam || invoices.find(i => i.invoiceNumber === MyBillsApp.activeInvoiceNumber) || invoices.find(i => i.roomId === room.id || i.roomName === room.name || i.tenantName === tenant.name) || {
      invoiceNumber: 'INV' + new Date().toISOString().slice(0, 7).replace('-', '') + '-' + (room.name || 'S101'),
      monthKey: new Date().toISOString().slice(0, 7), roomName: room.name || 'S101', tenantName: tenant ? tenant.name : 'ผู้เช่า',
      issueDate: new Date().toISOString().slice(0, 10), dueDate: Formatters.getNextMonth05(new Date().toISOString().slice(0, 7)),
      rentAmount: room.baseRent || 2500, elecPrev: room.lastElecMeter || 1000, elecCurr: (room.lastElecMeter || 1000) + 65, elecAmount: 520,
      waterPrev: room.lastWaterMeter || 100, waterCurr: (room.lastWaterMeter || 100) + 10, waterAmount: 200, trashFee: 20, totalAmount: 3240
    };

    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    const elecUnits = Math.max(0, (inv.elecCurr || 0) - (inv.elecPrev || 0));
    const waterUnits = Math.max(0, (inv.waterCurr || 0) - (inv.waterPrev || 0));

    dialog.innerHTML = `
      <div class="modal-header" style="background:#2563eb; color:#ffffff;">
        <h3><i class="fa-solid fa-file-pdf"></i> ใบแจ้งหนี้ / ใบเสร็จรับเงิน (Official Bill)</h3>
        <button class="close-modal-btn" style="color:#ffffff;">&times;</button>
      </div>
      <div class="modal-body" style="padding:1.5rem;">
        <div id="modal-printable-bill-area" style="background:#ffffff; border:1px solid #cbd5e1; border-radius:12px; padding:1.75rem; font-family:sans-serif; color:#0f172a;">
          
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #2563eb; padding-bottom:1rem; margin-bottom:1.25rem;">
            <div>
              <h2 style="color:#1e40af; font-size:1.4rem; font-weight:800; margin-bottom:0.25rem;">หอพักสมบัติ นนทบุรี</h2>
              <p style="font-size:0.82rem; color:#475569; margin:0;">45/10 หมู่ที่ 8 ต.ราษฎร์นิยม อ.ไทรน้อย จ.นนทบุรี 11150</p>
              <p style="font-size:0.82rem; color:#475569; margin:0;">โทร. 080-5991691, 062-6252564</p>
            </div>
            <div style="text-align:right;">
              <span class="badge-pill ${inv.status === 'paid' ? 'badge-success' : 'badge-danger'}" style="font-size:0.85rem;">
                ${inv.status === 'paid' ? '🟢 ชำระแล้ว' : '🔴 ค้างชำระ'}
              </span>
              <h3 style="font-size:1.1rem; font-weight:800; color:#0f172a; margin-top:0.35rem;">${inv.invoiceNumber}</h3>
              <p style="font-size:0.82rem; color:#64748b;">ประจำเดือน: ${Formatters.thaiMonthBE(inv.monthKey)}</p>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; background:#f8fafc; padding:1rem; border-radius:10px; margin-bottom:1.25rem; font-size:0.9rem;">
            <div>
              <div>ห้องพัก (Room): <strong style="color:#2563eb;">ห้อง ${inv.roomName}</strong></div>
              <div>วันที่ออกบิล (Issue Date): <strong>${Formatters.thaiDate(inv.issueDate)}</strong></div>
            </div>
            <div>
              <div>ชื่อผู้เช่า (Tenant): <strong>${inv.tenantName}</strong></div>
              <div>กำหนดชำระเงิน (Due Date): <strong style="color:#dc2626;">${Formatters.thaiDate(inv.dueDate)}</strong></div>
            </div>
          </div>

          <div class="invoice-details-table-wrapper" style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; margin-bottom:1.25rem;">
            <table style="width:100%; min-width:560px; border-collapse:collapse; font-size:0.85rem;" border="1" cellpadding="8" cellspacing="0">
              <thead>
                <tr style="background:#f1f5f9; color:#0f172a; text-align:center;">
                  <th style="width:8%;">ลำดับ</th>
                  <th>รายการชำระ (Description)</th>
                  <th style="width:12%;">เลขครั้งก่อน</th>
                  <th style="width:12%;">เลขครั้งนี้</th>
                  <th style="width:14%;">หน่วยที่ใช้</th>
                  <th style="width:14%;">ราคา/หน่วย</th>
                  <th style="width:18%;">จำนวนเงิน (บาท)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="text-align:center;">1</td>
                  <td>ค่าเช่าห้องพักประจำเดือน (${Formatters.thaiMonthBE(inv.monthKey)})</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:right;"><strong>${Formatters.currency(inv.rentAmount)}</strong></td>
                </tr>
                <tr>
                  <td style="text-align:center;">2</td>
                  <td>ค่าไฟฟ้า (Electricity)</td>
                  <td style="text-align:center;">${inv.elecPrev}</td>
                  <td style="text-align:center;">${inv.elecCurr}</td>
                  <td style="text-align:center;">${elecUnits} ยูนิต</td>
                  <td style="text-align:center;">฿8.00</td>
                  <td style="text-align:right;"><strong>${Formatters.currency(inv.elecAmount)}</strong></td>
                </tr>
                <tr>
                  <td style="text-align:center;">3</td>
                  <td>ค่าน้ำประปา (Water)</td>
                  <td style="text-align:center;">${inv.waterPrev}</td>
                  <td style="text-align:center;">${inv.waterCurr}</td>
                  <td style="text-align:center;">${waterUnits} ยูนิต</td>
                  <td style="text-align:center;">฿20.00</td>
                  <td style="text-align:right;"><strong>${Formatters.currency(inv.waterAmount)}</strong></td>
                </tr>
                <tr>
                  <td style="text-align:center;">4</td>
                  <td>ค่าบริการสาธารณูปโภค / ขยะ (Trash Fee)</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:right;"><strong>${Formatters.currency(inv.trashFee !== undefined ? inv.trashFee : 20)}</strong></td>
                </tr>
              </tbody>
              <tfoot>
                <tr style="background:#eff6ff; font-weight:800; color:#1e40af;">
                  <td colspan="6" style="text-align:right; font-size:1.05rem;">ยอดเงินรวมสุทธิที่ต้องชำระ (Total Net Amount):</td>
                  <td style="text-align:right; font-size:1.25rem; color:#1d4ed8;">${Formatters.currency(inv.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style="background:#fffbebf8; border:1px solid #fde68a; border-radius:8px; padding:0.85rem; font-size:0.85rem; color:#92400e; text-align:center; margin-bottom:1rem;">
            📌 <strong>ช่องทางชำระเงิน:</strong> โอนชำระเงิน ธ.กรุงศรีอยุธยา (BAY) เลขที่ <strong>240-1-34666-3</strong> ชื่อบัญชี: <strong>นางสมผิว น้ำวน</strong>
          </div>
        </div>

        <div style="display:flex; gap:0.75rem; margin-top:1.25rem;">
          <button id="btn-print-official-bill" class="btn btn-primary btn-full" style="padding:0.85rem; font-weight:700; border-radius:10px;">
            <i class="fa-solid fa-print"></i> พิมพ์เอกสาร / สั่งพิมพ์ PDF
          </button>
        </div>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    const printBtn = document.getElementById('btn-print-official-bill');
    if (printBtn) {
      printBtn.addEventListener('click', () => window.print());
    }
  }

  // --- 4. OFFICIAL RECEIPT POPUP MODAL ---
  static openReceiptModal(invParam = null) {
    const tenant = this.currentTenant;
    const rooms = this.state.rooms || [];
    const invoices = this.state.invoices || [];
    const room = rooms.find(r => r.id === tenant.assignedRoomId || r.currentTenantName === tenant.name) || { name: 'ยังไม่ระบุ' };
    
    const inv = invParam || invoices.find(i => i.invoiceNumber === MyBillsApp.activeInvoiceNumber) || invoices.find(i => i.roomId === room.id || i.tenantName === tenant.name) || {
      invoiceNumber: 'INV202607-101', monthKey: '2026-07', roomName: room.name, tenantName: tenant.name,
      issueDate: new Date().toISOString().slice(0, 10), dueDate: new Date().toISOString().slice(0, 10),
      rentAmount: 3500, elecAmount: 500, waterAmount: 200, trashFee: 20, totalAmount: 4220, paidAmount: 4220
    };

    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-receipt text-success"></i> ใบเสร็จรับเงิน (Official Payment Receipt)</h3>
        <button type="button" class="close-modal-btn" onclick="document.getElementById('app-modal').classList.remove('active')">&times;</button>
      </div>
      <div class="modal-body">
        <div style="background:#ffffff; border:2px solid #e2e8f0; border-radius:12px; padding:1.5rem;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #0f172a; padding-bottom:0.75rem; margin-bottom:1rem;">
            <div>
              <h2 style="font-size:1.35rem; font-weight:800; color:#0f172a;">หอพักสมบัติ นนทบุรี</h2>
              <p style="font-size:0.8rem; color:#64748b; margin-top:0.2rem;">45/10 หมู่ที่ 8 ต.ราษฎร์นิยม อ.ไทรน้อย จ.นนทบุรี 11150</p>
            </div>
            <div style="text-align:right;">
              <span class="badge-pill badge-success" style="font-size:0.8rem;">🟢 ชำระเงินแล้ว</span>
              <div style="font-size:0.88rem; font-weight:700; margin-top:0.35rem;">เลขที่: ${inv.invoiceNumber}</div>
              <div style="font-size:0.8rem; color:#64748b;">ประจำเดือน: ${Formatters.thaiMonthBE(inv.monthKey)}</div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; background:#f8fafc; padding:0.85rem; border-radius:8px; font-size:0.88rem; margin-bottom:1rem;">
            <div><strong>ห้องพัก:</strong> ห้อง ${inv.roomName}</div>
            <div><strong>ชื่อผู้เช่า:</strong> ${inv.tenantName}</div>
            <div><strong>วันที่ชำระเงิน:</strong> ${Formatters.thaiDate(inv.paymentDate || new Date().toISOString())}</div>
            <div><strong>วิธีชำระ:</strong> โอนผ่าน PromptPay</div>
          </div>

          <table style="width:100%; border-collapse:collapse; font-size:0.88rem; margin-bottom:1rem;" border="1" cellpadding="6">
            <thead>
              <tr style="background:#f1f5f9; color:#1e293b;">
                <th style="text-align:center;">ลำดับ</th>
                <th>รายการชำระเงิน</th>
                <th style="text-align:right;">จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="text-align:center;">1</td><td>ค่าเช่าห้องพักประจำเดือน (${Formatters.thaiMonthBE(inv.monthKey)})</td><td style="text-align:right;">${Formatters.currency(inv.rentAmount || 3500)}</td></tr>
              <tr><td style="text-align:center;">2</td><td>ค่าไฟฟ้า (Electricity)</td><td style="text-align:right;">${Formatters.currency(inv.elecAmount || 0)}</td></tr>
              <tr><td style="text-align:center;">3</td><td>ค่าน้ำประปา (Water)</td><td style="text-align:right;">${Formatters.currency(inv.waterAmount || 0)}</td></tr>
              <tr><td style="text-align:center;">4</td><td>ค่าขยะ / สาธารณูปโภค</td><td style="text-align:right;">${Formatters.currency(inv.trashFee !== undefined ? inv.trashFee : 20)}</td></tr>
              <tr style="background:#f8fafc; font-weight:bold;"><td colspan="2" style="text-align:right;">ยอดรวมชำระทั้งสิ้น:</td><td style="text-align:right; color:#10b981; font-size:1.05rem;">${Formatters.currency(inv.paidAmount || inv.totalAmount)}</td></tr>
            </tbody>
          </table>

          <div style="text-align:center; margin-top:1.5rem; padding-top:1rem; border-top:1px dashed #cbd5e1;">
            <p style="font-size:0.85rem; color:#059669; font-weight:700;">🙏 ขอบพระคุณที่ใช้บริการหอพักสมบัติ นนทบุรี</p>
          </div>
        </div>

        <button class="btn btn-primary btn-full" onclick="window.print()" style="margin-top:1rem; padding:0.75rem; font-weight:700;">
          <i class="fa-solid fa-print"></i> พิมพ์ / ดาวน์โหลดใบเสร็จ (PDF)
        </button>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.remove('active');
    });
  }
}

// Auto init on DOM load
document.addEventListener('DOMContentLoaded', () => {
  MyBillsApp.init();
});
