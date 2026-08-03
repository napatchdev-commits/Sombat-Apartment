/* ==========================================================================
   MYBILLS TENANT PORTAL - SOMBAT APARTMENT ENTERPRISE (MOBILE-FIRST JS)
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
  static getInitialRooms() { return []; }

  static getSavedSupabaseUrl() {
    const fromParam = new URLSearchParams(window.location.search).get('supabaseUrl') || new URLSearchParams(window.location.search).get('sheetUrl');
    if (fromParam) {
      let cleaned = this.cleanUrl(fromParam);
      if (cleaned.includes('bdeowpdjgiambqatdilh')) {
        cleaned = cleaned.replace('bdeowpdjgiambqatdilh', 'bdeowpdjgiombqatdilh');
      }
      if (!cleaned.includes('script.google.com') && !cleaned.includes('macros') && !cleaned.includes('google.com')) {
        localStorage.setItem('SOMBAT_APARTMENT_SAVED_SUPABASE_URL', cleaned);
        return cleaned;
      }
    }
    let saved = localStorage.getItem('SOMBAT_APARTMENT_SAVED_SUPABASE_URL') || localStorage.getItem('SOMBAT_APARTMENT_SAVED_SHEET_URL');
    if (saved && (saved.includes('script.google.com') || saved.includes('macros') || saved.includes('google.com'))) {
      localStorage.removeItem('SOMBAT_APARTMENT_SAVED_SHEET_URL');
    } else if (saved) {
      if (saved.includes('bdeowpdjgiambqatdilh')) {
        saved = saved.replace('bdeowpdjgiambqatdilh', 'bdeowpdjgiombqatdilh');
        localStorage.setItem('SOMBAT_APARTMENT_SAVED_SUPABASE_URL', saved);
      }
      localStorage.setItem('SOMBAT_APARTMENT_SAVED_SUPABASE_URL', this.cleanUrl(saved));
      localStorage.removeItem('SOMBAT_APARTMENT_SAVED_SHEET_URL');
      return this.cleanUrl(saved);
    }
    return 'https://bdeowpdjgiombqatdilh.supabase.co';
  }

  static getSavedTenantApiKey() {
    const fromParam = new URLSearchParams(window.location.search).get('apiKey');
    if (fromParam && fromParam.startsWith('eyJ')) {
      localStorage.setItem('SOMBAT_APARTMENT_SAVED_TENANT_API_KEY', fromParam);
      return fromParam;
    }
    const saved = localStorage.getItem('SOMBAT_APARTMENT_SAVED_TENANT_API_KEY');
    if (saved && saved.startsWith('eyJ')) return saved;
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkZW93cGRqZ2lvbWJxYXRkaWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzA3MjAsImV4cCI6MjEwMTI0NjcyMH0.XBvQzG4aChKQT-kWpHrb2Y1xtCgOwB_M9Ej-NYelgPY';
  }

  static cleanUrl(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url.trim());
      parsed.searchParams.delete('merge');
      return parsed.toString();
    } catch (e) {
      let u = url.trim();
      u = u.replace(/[&?]merge=true/g, '');
      return u;
    }
  }

  static getLoggedInTenant() {
    const raw = localStorage.getItem('SOMBAT_APARTMENT_LOGGED_IN_TENANT');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  static setLoggedInTenant(tenant) {
    if (tenant) {
      localStorage.setItem('SOMBAT_APARTMENT_LOGGED_IN_TENANT', JSON.stringify(tenant));
    } else {
      localStorage.removeItem('SOMBAT_APARTMENT_LOGGED_IN_TENANT');
    }
  }

  static getEmptyState() {
    return {
      settings: { apartmentName: 'หอพักสมบัติ นนทบุรี' },
      rooms: [],
      invoices: [],
      tenants: [],
      repairs: [],
      events: []
    };
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

  static async uploadBase64ToStorage(url, apiKey, base64Data, roomId, ext = 'png') {
    if (!base64Data) return '';
    try {
      const baseUrl = this.getBaseSupabaseUrl(url);
      const parts = base64Data.split(';base64,');
      const mime = parts[0].split(':')[1] || 'image/png';
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);
      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }
      const blob = new Blob([uInt8Array], { type: mime });

      const filename = `slip_${roomId}_${Date.now()}.${ext}`;
      const uploadUrl = `${baseUrl}/storage/v1/object/slips/${filename}`;

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': mime
        },
        body: blob
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`อัปโหลดรูปภาพไม่สำเร็จ: ${txt || res.statusText}`);
      }
      return `${baseUrl}/storage/v1/object/public/slips/${filename}`;
    } catch (e) {
      console.error('Storage upload error:', e);
      throw new Error('ระบบอัปโหลดสลิป/รูปภาพขัดข้อง: ' + e.message);
    }
  }

  static async getPublicState() {
    const url = this.getSavedSupabaseUrl();
    const apiKey = this.getSavedTenantApiKey();
    const baseUrl = this.getBaseSupabaseUrl(url);
    
    const res = await fetch(`${baseUrl}/rest/v1/rpc/get_room_list`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json();
    if (data.status === 'error') {
      throw new Error(data.message || 'เกิดข้อผิดพลาดในการโหลดฐานข้อมูลห้อง');
    }
    return {
      settings: { apartmentName: data.apartmentName || 'หอพักสมบัติ นนทบุรี' },
      rooms: (data.rooms && Array.isArray(data.rooms)) ? data.rooms : [],
      invoices: [],
      tenants: [],
      repairs: [],
      events: []
    };
  }

  static async fetchTenantBill(idCard, roomId) {
    const url = this.getSavedSupabaseUrl();
    const apiKey = this.getSavedTenantApiKey();
    const baseUrl = this.getBaseSupabaseUrl(url);

    const res = await fetch(`${baseUrl}/rest/v1/rpc/get_tenant_bill`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_id_card: idCard, p_room_id: roomId })
    });
    const data = await res.json();
    if (data.status === 'error') {
      throw new Error(data.message || 'ไม่พบข้อมูลใบแจ้งหนี้หรือรหัสบัตรไม่ถูกต้อง');
    }
    return data;
  }

  static async submitPayment(paymentData) {
    const url = this.getSavedSupabaseUrl();
    const apiKey = this.getSavedTenantApiKey();
    const baseUrl = this.getBaseSupabaseUrl(url);

    if (paymentData.action === 'submitTenantPayment') {
      let slipUrl = '';
      if (paymentData.paymentMethod === 'transfer' && paymentData.slipDataUrl) {
        slipUrl = await this.uploadBase64ToStorage(url, apiKey, paymentData.slipDataUrl, paymentData.roomId);

        // บันทึกตาราง payment_slips เพื่อใช้ระบบตรวจสอบสลิป (Slip Verification Module)
        try {
          const slipRecord = {
            id: `slip_${paymentData.roomId}_${Date.now()}`,
            invoice_id: paymentData.invoiceId || paymentData.invoiceNumber,
            tenant_id: paymentData.tenantId || '',
            room_id: paymentData.roomId,
            room_name: paymentData.roomName || 'ห้องพัก',
            tenant_name: paymentData.tenantName || 'ผู้เช่า',
            month_key: paymentData.monthKey || new Date().toISOString().slice(0,7),
            public_url: slipUrl,
            amount: parseFloat(paymentData.amount) || parseFloat(paymentData.requiredAmount) || 0,
            required_amount: parseFloat(paymentData.requiredAmount) || 0,
            fine_amount: parseFloat(paymentData.fineAmount) || 0,
            reference_no: paymentData.referenceNo || null,
            verification_status: paymentData.isMismatch ? 'amount_mismatch' : 'pending',
            created_at: new Date().toISOString()
          };

          await fetch(`${baseUrl}/rest/v1/payment_slips`, {
            method: 'POST',
            headers: {
              'apikey': apiKey,
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(slipRecord)
          });
        } catch (slipErr) {
          console.warn('Post to payment_slips table warning:', slipErr);
        }
      }
      
      const res = await fetch(`${baseUrl}/rest/v1/rpc/submit_tenant_payment`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_id_card: paymentData.idCard,
          p_room_id: paymentData.roomId,
          p_invoice_number: paymentData.invoiceNumber,
          p_payment_method: paymentData.paymentMethod,
          p_slip_url: slipUrl
        })
      });
      const result = await res.json();
      if (result.status === 'error') {
        throw new Error(result.message || 'บันทึกการชำระเงินไม่สำเร็จ');
      }
      return result;
    } else if (paymentData.action === 'submitTenantRepair') {
      let imageUrl = '';
      if (paymentData.imageDataUrl) {
        imageUrl = await this.uploadBase64ToStorage(url, apiKey, paymentData.imageDataUrl, paymentData.roomId);
      }

      const res = await fetch(`${baseUrl}/rest/v1/rpc/submit_tenant_repair`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_id_card: paymentData.idCard,
          p_room_id: paymentData.roomId,
          p_title: paymentData.title,
          p_description: paymentData.description,
          p_image_url: imageUrl
        })
      });
      const result = await res.json();
      if (result.status === 'error') {
        throw new Error(result.message || 'ส่งแจ้งซ่อมไม่สำเร็จ');
      }
      return result;
    }
    throw new Error('ไม่รองรับประเภทการส่งข้อมูลนี้');
  }
}

class MyBillsApp {
  static state;
  static currentTenant = null;
  static activeTab = 'home';
  static activeRepairId = null;
  static currentSlipDataUrl = '';
  static currentSlipQrData = '';
  static currentPayMethod = 'transfer';
  static activeInvoiceNumber = '';

  static decodeQR(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, img.width, img.height);
          if (typeof jsQR !== 'undefined') {
            const code = jsQR(imgData.data, imgData.width, imgData.height);
            if (code) {
              resolve(code.data);
            } else {
              resolve(null);
            }
          } else {
            console.error('jsQR is not loaded');
            resolve(null);
          }
        } catch (e) {
          console.error('jsQR error:', e);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  static getRefNo(qrString) {
    if (!qrString) return null;
    if (qrString.startsWith('http')) {
      try {
        const url = new URL(qrString);
        return url.pathname.split('/').pop() || qrString;
      } catch (e) {
        return qrString.substring(qrString.length - 20);
      }
    }
    return qrString.length > 20 ? qrString.substring(qrString.length - 20) : qrString;
  }

  static lineAccount = null;

  static async fetchLineAccount() {
    if (!this.currentTenant) {
      this.lineAccount = null;
      return;
    }
    try {
      const url = TenantDBService.getSavedSupabaseUrl();
      const apiKey = TenantDBService.getSavedTenantApiKey();
      const baseUrl = TenantDBService.getBaseSupabaseUrl(url);

      const res = await fetch(`${baseUrl}/rest/v1/tenant_line_accounts?tenant_id=eq.${this.currentTenant.id}`, {
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`
        }
      });
      if (res.ok) {
        const rows = await res.json();
        this.lineAccount = (rows && rows.length > 0) ? rows[0] : null;
      } else {
        this.lineAccount = null;
      }
    } catch (e) {
      console.warn('Failed to fetch LINE account link status:', e);
      this.lineAccount = null;
    }
  }

  static async unlinkLineAccount() {
    if (!this.currentTenant) return;
    if (!confirm('คุณต้องการยกเลิกการเชื่อมโยงบัญชี LINE หรือไม่? (หากยกเลิก คุณจะไม่ได้รับการแจ้งเตือนบิลใหม่ผ่าน LINE บัญชีนี้อีกต่อไป)')) return;

    try {
      const url = TenantDBService.getSavedSupabaseUrl();
      const apiKey = TenantDBService.getSavedTenantApiKey();
      const baseUrl = TenantDBService.getBaseSupabaseUrl(url);

      const res = await fetch(`${baseUrl}/rest/v1/rpc/unlink_tenant_line_account`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_tenant_id: this.currentTenant.id })
      });

      if (res.ok) {
        const data = await res.json();
        alert('✅ ยกเลิกการเชื่อมโยงบัญชี LINE สำเร็จแล้ว!');
        await this.fetchLineAccount();
        this.render();
      } else {
        const errText = await res.text();
        throw new Error(errText);
      }
    } catch (e) {
      alert(`❌ ไม่สามารถยกเลิกการเชื่อมโยงได้: ${e.message}`);
    }
  }

  static async init() {
    // Check LINE Login callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const linkingStatus = urlParams.get('line_linking');
    if (linkingStatus === 'success') {
      alert('🎉 เชื่อมโยงบัญชี LINE สำเร็จเรียบร้อยแล้ว!');
      urlParams.delete('line_linking');
      urlParams.delete('error_msg');
      window.history.replaceState({}, document.title, window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : ''));
    } else if (linkingStatus === 'error') {
      const errMsg = urlParams.get('error_msg') || 'เกิดข้อผิดพลาดในการเชื่อมโยงบัญชี LINE';
      alert(`❌ การเชื่อมโยง LINE ล้มเหลว:\n\n${errMsg}`);
      urlParams.delete('line_linking');
      urlParams.delete('error_msg');
      window.history.replaceState({}, document.title, window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : ''));
    }

    TenantDBService.getSavedSupabaseUrl();
    TenantDBService.getSavedTenantApiKey();

    // Auto-detect and apply system dark mode
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark');
    }

    // Show loading overlay
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

    this.currentTenant = TenantDBService.getLoggedInTenant();

    try {
      if (this.currentTenant && this.currentTenant.idCard && this.currentTenant.assignedRoomId) {
        const cleanIdCard = String(this.currentTenant.idCard).replace(/\D/g, '');
        this.state = await TenantDBService.getPublicState();
        const billData = await TenantDBService.fetchTenantBill(cleanIdCard, this.currentTenant.assignedRoomId);
        this.applyTenantBillData(billData);
        await this.fetchLineAccount();
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

    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 300);

    this.render();
  }

  static applyTenantBillData(billData) {
    const existingRooms = (this.state && this.state.rooms) || [];
    this.state = {
      settings: billData.settings || (this.state && this.state.settings) || {},
      rooms: existingRooms.length > 0 ? existingRooms : (billData.room ? [billData.room] : []),
      invoices: billData.invoices || [],
      tenants: [billData.tenant].filter(Boolean),
      repairs: billData.repairs || [],
      events: billData.events || []
    };
    this.currentTenant = {
      id: billData.tenant.id,
      name: billData.tenant.name,
      idCard: Formatters.formatIdCard(String(billData.tenant.idCard || '').replace(/\D/g, '')),
      tel: billData.tenant.tel || '-',
      email: billData.tenant.email || 'ยังไม่ระบุอีเมล',
      assignedRoomId: billData.tenant.assignedRoomId
    };
  }

  static switchTab(tabName) {
    this.activeTab = tabName;
    this.activeRepairId = null; // Clear active repair view when switching tabs
    this.render();
  }

  static render() {
    const root = document.getElementById('tenant-app-root');
    if (!root) return;

    if (!this.currentTenant) {
      root.innerHTML = this.renderLoginScreen();
      this.bindLoginEvents();
    } else {
      root.innerHTML = this.renderMobileShell();
      this.bindShellEvents();
    }
  }

  // --- 1. LOGIN SCREEN ---
  static renderLoginScreen() {
    const apartmentName = (this.state.settings && this.state.settings.apartmentName) || 'หอพักสมบัติ นนทบุรี';
    const rooms = this.state.rooms || [];

    const hasSupabaseUrl = !!localStorage.getItem('SOMBAT_APARTMENT_SAVED_SUPABASE_URL') || !!localStorage.getItem('SOMBAT_APARTMENT_SAVED_SHEET_URL') || !!(new URLSearchParams(window.location.search).get('supabaseUrl')) || !!(new URLSearchParams(window.location.search).get('sheetUrl'));
    const warningBanner = hasSupabaseUrl ? '' : `
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:0.85rem; font-size:0.82rem; color:#b45309; text-align:center; margin-bottom:1.25rem; line-height:1.5;">
        ⚠️ <strong>ระบบยังไม่ได้เชื่อมต่อกับ Supabase</strong><br>
        คุณกำลังดู <u>ข้อมูลตัวอย่าง (Demo/Mock)</u> กรุณาเข้าใช้งานผ่านลิงก์เชื่อมต่อฐานข้อมูลคลาวด์ที่ส่งจากระบบแอดมิน
      </div>
    `;

    return `
      <div class="tenant-card animate-fade-in" style="margin: auto; width: 100%; padding: 2rem;">
        <div class="brand-header">
          <div class="brand-logo"><i class="fa-solid fa-file-invoice-dollar"></i></div>
          <h1>MyBills - พอร์ทัลผู้เช่า</h1>
          <p>${apartmentName}</p>
        </div>

        ${warningBanner}

        <form id="tenant-login-form">
          <div class="form-group" style="margin-bottom:1.25rem;">
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

          <div class="form-group" style="margin-bottom:1.75rem;">
            <label style="font-weight:700; color:#334155; display:block; margin-bottom:0.5rem;">
              <i class="fa-solid fa-id-card text-primary"></i> เลขบัตรประชาชน (13 หลัก) *
            </label>
            <input type="text" id="input-idcard" class="form-control" placeholder="ระบุเลขบัตรประชาชน 13 หลัก..." maxlength="17" required style="padding:0.85rem 1rem; border-radius:10px; font-size:1.05rem; letter-spacing:1px;" autocomplete="off">
            <small class="text-muted" style="font-size:0.8rem; margin-top:0.35rem; display:block;">💡 ข้อมูลความปลอดภัยจะเชื่อมโยงกับฐานข้อมูลสัญญาโดยตรง</small>
          </div>

          <button type="submit" class="btn btn-primary btn-full" style="padding:0.85rem; font-size:1.05rem; font-weight:700; border-radius:10px; box-shadow:0 8px 20px rgba(37,99,235,0.3);">
            <i class="fa-solid fa-right-to-bracket"></i> เข้าสู่ระบบผู้เช่า MyBills
          </button>
        </form>

        <div style="margin-top:2.5rem; padding-top:1.25rem; border-top:1px solid #e2e8f0; text-align:center;">
          <p class="text-muted" style="font-size:0.82rem;">ติดต่อสำนักงานหอพัก โทร. 080-5991691</p>
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
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบสิทธิ์...'; }

      try {
        const billData = await TenantDBService.fetchTenantBill(cleanInput, selectedRoomId);
        this.applyTenantBillData(billData);
        await this.fetchLineAccount();
        TenantDBService.setLoggedInTenant(this.currentTenant);
        this.activeTab = 'home';
        this.render();
      } catch (err) {
        alert('❌ เข้าสู่ระบบไม่สำเร็จ: ' + (err.message || 'กรุณาตรวจสอบเลขห้องและเลขบัตรประชาชนอีกครั้ง'));
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> เข้าสู่ระบบผู้เช่า MyBills'; }
      }
    });
  }

  // --- 2. MOBILE WEB SHELL LAYOUT ---
  static renderMobileShell() {
    return `
      <div class="app-container">
        <!-- Sticky Header (Premium Gradient) -->
        <div class="app-header">
          <div style="font-size: 0.75rem; opacity: 0.85; text-align: center; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 0.35rem;">
            ${this.getHeaderTitleText()}
          </div>
          ${this.renderHeaderBar()}
        </div>
        
        <!-- Scrollable Tab Content Workspace -->
        <div class="app-content" id="app-content-area">
          ${this.renderActiveTabContent()}
        </div>
        
        <!-- Bottom Tab Navigation Bar -->
        <div class="mobile-nav-bar">
          <button type="button" class="nav-item ${this.activeTab === 'home' ? 'active' : ''}" data-tab="home">
            <i class="fa-solid fa-house"></i>
            <span>หน้าหลัก</span>
          </button>
          <button type="button" class="nav-item ${this.activeTab === 'bills' ? 'active' : ''}" data-tab="bills">
            <i class="fa-solid fa-file-invoice-dollar"></i>
            <span>บิล</span>
          </button>
          <button type="button" class="nav-item ${this.activeTab === 'repairs' ? 'active' : ''}" data-tab="repairs">
            <i class="fa-solid fa-screwdriver-wrench"></i>
            <span>แจ้งซ่อม</span>
          </button>
          <button type="button" class="nav-item ${this.activeTab === 'notices' ? 'active' : ''}" data-tab="notices">
            <i class="fa-solid fa-bullhorn"></i>
            <span>ประกาศ</span>
          </button>
          <button type="button" class="nav-item ${this.activeTab === 'profile' ? 'active' : ''}" data-tab="profile">
            <i class="fa-solid fa-user"></i>
            <span>โปรไฟล์</span>
          </button>
        </div>
      </div>
    `;
  }

  static getHeaderTitleText() {
    const aptName = (this.state.settings && this.state.settings.apartmentName) || 'หอพักสมบัติ นนทบุรี';
    switch (this.activeTab) {
      case 'home': return `หน้าหลัก · ${aptName}`;
      case 'bills': return `รายการบิล · ${aptName}`;
      case 'repairs': return this.activeRepairId ? `${this.activeRepairId} · ${aptName}` : `แจ้งซ่อม · ${aptName}`;
      case 'notices': return `ประกาศหอพัก · ${aptName}`;
      case 'profile': return `โปรไฟล์ · ${aptName}`;
      default: return aptName;
    }
  }

  static renderHeaderBar() {
    if (this.activeTab === 'home') {
      const rooms = (this.state && this.state.rooms) || [];
      const room = rooms.find(r => r.id === (this.currentTenant && this.currentTenant.assignedRoomId)) || { name: 'S101' };
      const roomName = room.name || (this.currentTenant && this.currentTenant.assignedRoomId) || 'S101';
      const contractExpiry = (this.currentTenant && this.currentTenant.contractExpiry) || '31 พ.ค. 2570';

      return `
        <div class="header-tenant-card animate-fade-in">
          <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(this.currentTenant.name || 'tenant')}" class="header-avatar" alt="Tenant Profile" loading="lazy" />
          <div class="header-tenant-info">
            <div class="header-tenant-name">${this.currentTenant.name || 'ผู้เช่า'}</div>
            <div class="header-meta-row">
              <span class="header-room-badge"><i class="fa-solid fa-door-closed"></i> ห้อง ${roomName}</span>
              <span class="header-status-badge"><i class="fa-solid fa-circle-check"></i> ผู้เช่าปัจจุบัน</span>
            </div>
            ${contractExpiry ? `
              <div class="header-expiry-tag">
                <i class="fa-regular fa-calendar-check"></i> วันหมดสัญญา: ${Formatters.thaiDate(contractExpiry)}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'repairs' && this.activeRepairId) {
      return `
        <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.35rem; cursor:pointer;" id="btn-back-repairs-list-header">
          <i class="fa-solid fa-arrow-left" style="font-size: 1.1rem; margin-right: 0.25rem;"></i>
          <h2 style="font-size: 1.2rem; font-weight: 800; margin:0;">ย้อนกลับ</h2>
        </div>
      `;
    }

    let titleText = 'ระบบ';
    switch (this.activeTab) {
      case 'bills': titleText = 'รายการบิลของคุณ'; break;
      case 'repairs': titleText = 'รายการแจ้งซ่อมบำรุง'; break;
      case 'notices': titleText = 'ข่าวสารและประกาศ'; break;
      case 'profile': titleText = 'ข้อมูลของฉัน'; break;
    }

    return `
      <div style="margin-top: 0.35rem;">
        <h2 style="font-size: 1.2rem; font-weight: 800; margin:0; letter-spacing: 0.3px;">${titleText}</h2>
      </div>
    `;
  }

  static bindShellEvents() {
    // Bind Tab navigation click events
    const navButtons = document.querySelectorAll('.mobile-nav-bar .nav-item');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Bind back button in header (if in Repair Detail view)
    const headerBackBtn = document.getElementById('btn-back-repairs-list-header');
    if (headerBackBtn) {
      headerBackBtn.addEventListener('click', () => {
        this.activeRepairId = null;
        this.render();
      });
    }

    // Bind active tab-specific events
    switch (this.activeTab) {
      case 'home': this.bindHomeTabEvents(); break;
      case 'bills': this.bindBillsTabEvents(); break;
      case 'repairs': this.bindRepairsTabEvents(); break;
      case 'profile': this.bindProfileTabEvents(); break;
    }
  }

  static renderActiveTabContent() {
    switch (this.activeTab) {
      case 'home': return this.renderHomeTab();
      case 'bills': return this.renderBillsTab();
      case 'repairs': return this.renderRepairsTab();
      case 'notices': return this.renderNoticesTab();
      case 'profile': return this.renderProfileTab();
      default: return `<div>ไม่พบเนื้อหาที่ต้องการ</div>`;
    }
  }

  // --- 2.1 HOME TAB ---
  static getMatchedInvoices() {
    const tenant = this.currentTenant;
    const rooms = this.state.rooms || [];
    const invoices = this.state.invoices || [];
    const room = rooms.find(r => r.id === tenant.assignedRoomId) || { id: tenant.assignedRoomId || 's101', name: 'S101' };

    const cleanTenantIdCard = String(tenant.idCard || '').replace(/\D/g, '');
    let matchedInvoices = [];
    
    if (cleanTenantIdCard && cleanTenantIdCard.length === 13) {
      matchedInvoices = invoices.filter(i => {
        const cleanInvIdCard = String(i.idCard || '').replace(/\D/g, '');
        return cleanInvIdCard === cleanTenantIdCard;
      });
    }

    if (matchedInvoices.length === 0) {
      matchedInvoices = invoices.filter(i => 
        (i.roomId && i.roomId.toLowerCase() === room.id.toLowerCase()) ||
        (i.roomName && room.name && i.roomName.trim().toLowerCase() === room.name.trim().toLowerCase())
      );
    }

    // Deduplicate by monthKey
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

    return Array.from(deduplicatedMap.values()).sort((a, b) => (b.monthKey || '').localeCompare(a.monthKey || ''));
  }

  static renderHomeTab() {
    const sortedInvoices = this.getMatchedInvoices();
    let latestInvoice = sortedInvoices.length > 0 ? sortedInvoices[0] : null;
    const rooms = this.state.rooms || [];
    const room = rooms.find(r => r.id === this.currentTenant.assignedRoomId) || { name: 'S101', floor: 1, baseRent: 2500 };

    if (!latestInvoice) {
      const monthKey = new Date().toISOString().slice(0, 7);
      const rentAmt = room.baseRent || 2500;
      const elecAmt = 520;
      const waterAmt = 200;
      const trashAmt = 20;
      const totalAmt = rentAmt + elecAmt + waterAmt + trashAmt;
      
      latestInvoice = {
        id: 'inv_mock_latest',
        invoiceNumber: `INV${monthKey.replace('-', '')}-${room.name}`,
        monthKey: monthKey,
        roomId: room.id,
        roomName: room.name,
        tenantName: this.currentTenant.name,
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
    }

    MyBillsApp.activeInvoiceNumber = latestInvoice.invoiceNumber;
    const isPaid = latestInvoice.status === 'paid';
    const isPending = latestInvoice.status === 'pending';
    const amountToPay = latestInvoice.outstandingAmount || latestInvoice.totalAmount;

    // Badges calculation
    const unpaidCount = sortedInvoices.filter(i => i.status !== 'paid' && i.status !== 'pending').length;
    const activeRepairsCount = (this.state.repairs || []).filter(r => r.status !== 'completed' && r.status !== 'เสร็จสิ้น').length;

    let cardBgClass = '';
    let cardStyle = '';
    if (isPaid) {
      cardBgClass = 'paid';
    } else if (isPending) {
      cardBgClass = 'pending';
      cardStyle = 'border-color: rgba(245, 158, 11, 0.35); box-shadow: 0 10px 25px rgba(245, 158, 11, 0.08);';
    }

    let statusText = `ครบกำหนดวันที่ ${Formatters.thaiDate(latestInvoice.dueDate)}`;
    let statusColor = '#b45309';
    let amountColor = 'var(--danger)';
    let iconClass = 'fa-regular fa-file-lines text-danger';
    let iconBgColor = '#fee2e2';
    
    if (isPaid) {
      statusText = 'ชำระค่าห้องเรียบร้อยแล้ว ขอบคุณครับ!';
      statusColor = '#059669';
      amountColor = '#059669';
      iconClass = 'fa-solid fa-circle-check text-success';
      iconBgColor = '#d1fae5';
    } else if (isPending) {
      statusText = 'ส่งหลักฐานแล้ว รอแอดมินตรวจสอบ';
      statusColor = '#d97706';
      amountColor = '#d97706';
      iconClass = 'fa-regular fa-clock text-warning';
      iconBgColor = '#fef3c7';
    }

    // Top 3 recent invoices for payment history widget
    const recentInvoicesTop3 = sortedInvoices.slice(0, 3);
    
    // Top 3 recent announcements for notice widget
    const events = (this.state.events && this.state.events.length > 0) ? this.state.events : [
      { id: 'ev_1', title: 'แจ้งจดมิเตอร์ค่าน้ำ-ค่าไฟประจำเดือน', date: new Date().toISOString().slice(0, 10), category: 'บริการ' },
      { id: 'ev_2', title: 'การทำความสะอาดพื้นที่ส่วนกลางและลานจอดรถ', date: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10), category: 'ประกาศทั่วไป' },
      { id: 'ev_3', title: 'ช่องทางชำระค่าเช่าผ่าน QR PromptPay', date: new Date(Date.now() - 86400000 * 7).toISOString().slice(0, 10), category: 'การชำระเงิน' }
    ];
    const recentNoticesTop3 = events.slice(0, 3);

    return `
      <div class="animate-fade-in" style="display:flex; flex-direction:column; gap:1rem;">
        
        <!-- Outstanding Bill Card -->
        <div class="outstanding-card ${cardBgClass}" style="${cardStyle}">
          <div class="outstanding-header">
            <div>
              <div class="outstanding-title">
                <i class="fa-solid fa-file-invoice"></i> ยอดค้างชำระ · ${Formatters.thaiMonthBE(latestInvoice.monthKey)}
              </div>
              <div class="outstanding-amount-wrapper">
                <span class="outstanding-amount" style="color:${amountColor};">
                  ${isPaid ? '0.00' : amountToPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span style="font-size:0.9rem; font-weight:700; color:var(--text-sub);">บาท</span>
              </div>
              <div class="outstanding-status-text" style="color:${statusColor};">
                ${statusText}
              </div>
            </div>
            
            <div class="outstanding-icon-box" style="background:${iconBgColor};">
              <i class="${iconClass}"></i>
            </div>
          </div>

          <!-- Dual Action Buttons -->
          <div class="outstanding-actions">
            <button type="button" class="btn btn-outline-indigo" id="btn-home-view-bill">
              <i class="fa-regular fa-file-lines"></i> ดูบิล
            </button>
            <button type="button" class="btn ${isPaid ? 'btn-success' : (isPending ? 'btn-secondary' : 'btn-indigo')}" id="btn-home-pay-bill">
              <i class="${isPaid ? 'fa-solid fa-receipt' : (isPending ? 'fa-regular fa-clock' : 'fa-solid fa-qrcode')}"></i>
              <span>${isPaid ? 'ดูใบเสร็จ' : (isPending ? 'รอตรวจสอบ' : 'ชำระเงิน')}</span>
            </button>
          </div>
        </div>

        <!-- 2-Column Grid Menu (8 items) -->
        <div class="menu-grid-2col">
          <!-- 1. บิลทั้งหมด -->
          <div class="menu-card" data-action="go-bills">
            <div class="menu-card-icon-wrapper" style="background:#e0e7ff;">
              <i class="fa-solid fa-file-invoice-dollar" style="color:#4f46e5;"></i>
            </div>
            <div class="menu-card-label">บิลทั้งหมด</div>
            ${unpaidCount > 0 ? `<span class="badge-pill badge-danger menu-card-badge">${unpaidCount} ค้าง</span>` : ''}
          </div>

          <!-- 2. แจ้งซ่อม -->
          <div class="menu-card" data-action="new-repair">
            <div class="menu-card-icon-wrapper" style="background:#fef3c7;">
              <i class="fa-solid fa-wrench" style="color:#d97706;"></i>
            </div>
            <div class="menu-card-label">แจ้งซ่อม</div>
          </div>

          <!-- 3. งานซ่อมของฉัน -->
          <div class="menu-card" data-action="go-repairs">
            <div class="menu-card-icon-wrapper" style="background:#faf5ff;">
              <i class="fa-solid fa-list-check" style="color:#7c3aed;"></i>
            </div>
            <div class="menu-card-label">งานซ่อมของฉัน</div>
            ${activeRepairsCount > 0 ? `<span class="badge-pill badge-warning menu-card-badge">${activeRepairsCount}</span>` : ''}
          </div>

          <!-- 4. ประกาศ -->
          <div class="menu-card" data-action="go-notices">
            <div class="menu-card-icon-wrapper" style="background:#cffafe;">
              <i class="fa-solid fa-bullhorn" style="color:#0891b2;"></i>
            </div>
            <div class="menu-card-label">ประกาศ</div>
          </div>

          <!-- 5. สัญญาเช่า -->
          <div class="menu-card" data-action="go-contract">
            <div class="menu-card-icon-wrapper" style="background:#d1fae5;">
              <i class="fa-solid fa-file-contract" style="color:#16a34a;"></i>
            </div>
            <div class="menu-card-label">สัญญาเช่า</div>
          </div>

          <!-- 6. ประวัติการชำระ -->
          <div class="menu-card" data-action="go-history">
            <div class="menu-card-icon-wrapper" style="background:#fff7ed;">
              <i class="fa-solid fa-receipt" style="color:#ea580c;"></i>
            </div>
            <div class="menu-card-label">ประวัติการชำระ</div>
          </div>

          <!-- 7. ข้อมูลส่วนตัว -->
          <div class="menu-card" data-action="go-profile">
            <div class="menu-card-icon-wrapper" style="background:#fdf2f8;">
              <i class="fa-solid fa-user-gear" style="color:#db2777;"></i>
            </div>
            <div class="menu-card-label">ข้อมูลส่วนตัว</div>
          </div>

          <!-- 8. ติดต่อผู้ดูแล -->
          <div class="menu-card" data-action="contact-admin">
            <div class="menu-card-icon-wrapper" style="background:#f1f5f9;">
              <i class="fa-solid fa-headset" style="color:#2563eb;"></i>
            </div>
            <div class="menu-card-label">ติดต่อผู้ดูแล</div>
          </div>
        </div>

        <!-- Widget: ประวัติการชำระล่าสุด (3 รายการล่าสุด) -->
        <div class="widget-section">
          <div class="widget-header">
            <div class="widget-title">
              <i class="fa-solid fa-clock-rotate-left"></i>
              <span>ประวัติการชำระล่าสุด</span>
            </div>
            <span class="widget-action-link" id="link-view-all-history">ดูทั้งหมด <i class="fa-solid fa-chevron-right"></i></span>
          </div>

          <div class="widget-list">
            ${recentInvoicesTop3.length === 0 ? `
              <div style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:0.75rem;">ยังไม่มีประวัติการชำระเงิน</div>
            ` : recentInvoicesTop3.map(inv => `
              <div class="widget-item widget-history-item" data-inv-id="${inv.id}">
                <div class="widget-item-info">
                  <div class="widget-item-title">รอบบิล ${Formatters.thaiMonthBE(inv.monthKey)}</div>
                  <div class="widget-item-sub">
                    <i class="fa-regular fa-calendar"></i> ${Formatters.thaiDate(inv.paymentDate || inv.dueDate)}
                  </div>
                </div>
                <div class="widget-item-right">
                  <div class="widget-item-amount">${Formatters.currency(inv.paidAmount || inv.totalAmount)}</div>
                  <span class="badge-pill ${inv.status === 'paid' ? 'badge-success' : (inv.status === 'pending' ? 'badge-warning' : 'badge-danger')}">
                    ${inv.status === 'paid' ? 'ชำระแล้ว' : (inv.status === 'pending' ? 'รอตรวจสอบ' : 'ค้างชำระ')}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Widget: ประกาศล่าสุด (3 รายการล่าสุด) -->
        <div class="widget-section">
          <div class="widget-header">
            <div class="widget-title">
              <i class="fa-solid fa-bullhorn"></i>
              <span>ประกาศล่าสุด</span>
            </div>
            <span class="widget-action-link" id="link-view-all-notices">ดูทั้งหมด <i class="fa-solid fa-chevron-right"></i></span>
          </div>

          <div class="widget-list">
            ${recentNoticesTop3.map(evt => `
              <div class="widget-item widget-notice-item">
                <div class="widget-item-info">
                  <div class="widget-item-title">${evt.title}</div>
                  <div class="widget-item-sub">
                    <span class="badge-pill badge-indigo" style="font-size:0.65rem;">${evt.category || 'ทั่วไป'}</span>
                    <span><i class="fa-regular fa-clock"></i> ${Formatters.thaiDate(evt.date)}</span>
                  </div>
                </div>
                <div class="widget-item-right">
                  <i class="fa-solid fa-chevron-right" style="color:var(--text-muted); font-size:0.8rem;"></i>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;
  }

  static bindHomeTabEvents() {
    const sorted = this.getMatchedInvoices();
    const latest = sorted.length > 0 ? sorted[0] : null;

    // Dual action buttons in Outstanding Card
    const viewBillBtn = document.getElementById('btn-home-view-bill');
    if (viewBillBtn) {
      viewBillBtn.addEventListener('click', () => {
        if (latest) {
          this.openOfficialBillModal(latest);
        }
      });
    }

    const payBillBtn = document.getElementById('btn-home-pay-bill');
    if (payBillBtn) {
      payBillBtn.addEventListener('click', () => {
        if (latest) {
          if (latest.status === 'paid') {
            this.openReceiptModal(latest);
          } else if (latest.status === 'pending') {
            this.openOfficialBillModal(latest);
          } else {
            this.openPaymentModal(latest);
          }
        }
      });
    }

    // Grid cards navigation clicks
    const menuCards = document.querySelectorAll('.menu-card');
    menuCards.forEach(card => {
      card.addEventListener('click', () => {
        const action = card.getAttribute('data-action');
        if (action === 'go-bills' || action === 'go-history') {
          this.switchTab('bills');
        } else if (action === 'go-repairs') {
          this.switchTab('repairs');
        } else if (action === 'go-notices') {
          this.switchTab('notices');
        } else if (action === 'go-profile' || action === 'go-contract') {
          this.switchTab('profile');
        } else if (action === 'contact-admin') {
          this.openContactAdminModal();
        } else if (action === 'new-repair') {
          this.openNewRepairFormModal();
        }
      });
    });

    // Widget Action Links
    const viewAllHistoryLink = document.getElementById('link-view-all-history');
    if (viewAllHistoryLink) {
      viewAllHistoryLink.addEventListener('click', () => this.switchTab('bills'));
    }

    const viewAllNoticesLink = document.getElementById('link-view-all-notices');
    if (viewAllNoticesLink) {
      viewAllNoticesLink.addEventListener('click', () => this.switchTab('notices'));
    }

    // History Widget Item Click -> Open detail modal
    const historyItems = document.querySelectorAll('.widget-history-item');
    historyItems.forEach(item => {
      item.addEventListener('click', () => {
        const invId = item.getAttribute('data-inv-id');
        const inv = sorted.find(i => i.id === invId);
        if (inv) {
          if (inv.status === 'paid') {
            this.openReceiptModal(inv);
          } else {
            this.openPaymentModal(inv);
          }
        }
      });
    });

    // Notice Widget Item Click -> Switch to notices tab
    const noticeItems = document.querySelectorAll('.widget-notice-item');
    noticeItems.forEach(item => {
      item.addEventListener('click', () => this.switchTab('notices'));
    });
  }

  static openContactAdminModal() {
    const modal = document.getElementById('app-modal');
    if (!modal) return;
    const dialog = modal.querySelector('.modal-dialog');
    const settings = (this.state && this.state.settings) || {};
    const adminPhone = settings.contactPhone || '080-5991691';

    dialog.innerHTML = `
      <div class="modal-header" style="background:var(--primary); color:#ffffff;">
        <h3><i class="fa-solid fa-headset"></i> ติดต่อผู้ดูแลหอพัก</h3>
        <button type="button" class="close-modal-btn" style="color:#ffffff;">&times;</button>
      </div>
      <div class="modal-body" style="text-align:center;">
        <div style="width:64px; height:64px; background:var(--primary-light); border-radius:50%; display:inline-flex; align-items:center; justify-content:center; margin-bottom:1rem;">
          <i class="fa-solid fa-building-user" style="font-size:1.8rem; color:var(--primary);"></i>
        </div>
        <h4 style="font-size:1.1rem; font-weight:800; color:var(--text-main); margin-bottom:0.25rem;">
          ${settings.apartmentName || 'หอพักสมบัติ นนทบุรี'}
        </h4>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.25rem;">
          สำนักงานนิติบุคคลและฝ่ายบริการผู้เช่า
        </p>

        <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:1rem; margin-bottom:1.25rem; text-align:left; display:flex; flex-direction:column; gap:0.75rem;">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <i class="fa-solid fa-phone text-primary" style="font-size:1.2rem;"></i>
            <div>
              <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">เบอร์โทรศัพท์สำนักงาน</div>
              <a href="tel:${adminPhone}" style="font-weight:800; font-size:1rem; color:var(--primary); text-decoration:none;">${adminPhone}</a>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <i class="fa-solid fa-clock text-primary" style="font-size:1.2rem;"></i>
            <div>
              <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">เวลาทำการ</div>
              <div style="font-weight:700; font-size:0.88rem; color:var(--text-main);">08:30 - 19:00 น. (ทุกวัน)</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <i class="fa-solid fa-location-dot text-primary" style="font-size:1.2rem;"></i>
            <div>
              <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">ที่อยู่สำนักงาน</div>
              <div style="font-weight:600; font-size:0.82rem; color:var(--text-sub);">45/10 ม.8 ต.ราษฎร์นิยม อ.ไทรน้อย จ.นนทบุรี 11150</div>
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <a href="tel:${adminPhone}" class="btn btn-indigo btn-full" style="text-decoration:none;">
            <i class="fa-solid fa-phone"></i> โทรออก
          </a>
          <button type="button" class="btn btn-secondary close-modal-trigger">
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelectorAll('.close-modal-btn, .close-modal-trigger').forEach(btn => {
      btn.addEventListener('click', () => modal.classList.remove('active'));
    });
  }

  // --- 2.2 BILLS TAB ---
  static renderBillsTab() {
    const sortedInvoices = this.getMatchedInvoices();
    if (sortedInvoices.length === 0) {
      return `
        <div class="white-card text-center animate-fade-in" style="padding:3rem 1.5rem; text-align:center;">
          <i class="fa-solid fa-file-circle-xmark text-muted" style="font-size:2.5rem; margin-bottom:1rem;"></i>
          <p style="color:#64748b; font-weight:600;">ไม่พบรายการบิลใดๆ ในประวัติห้องเช่าของคุณ</p>
        </div>
      `;
    }

    return `
      <div class="animate-fade-in" style="display:flex; flex-direction:column; gap:0.85rem;">
        <p style="font-size:0.85rem; color:#64748b; font-weight:700; margin-bottom:0.15rem; padding-left:0.25rem;">
          ประวัติการออกบิลทั้งหมด (${sortedInvoices.length} บิลล่าสุด)
        </p>
        
        ${sortedInvoices.map(inv => `
          <div class="bill-card-item" data-id="${inv.id}" style="cursor:pointer; background:#ffffff; border-radius:16px; padding:1.25rem; border:1px solid #e2e8f0; box-shadow:var(--shadow-sm); display:flex; justify-content:space-between; align-items:center; transition:var(--transition);">
            <div>
              <div style="font-weight:800; font-size:0.95rem; color:#1f2937;">
                รอบบิล ${Formatters.thaiMonthBE(inv.monthKey)}
              </div>
              <div style="font-size:0.8rem; color:#6b7280; margin-top:0.2rem; font-family:monospace;">
                เลขที่: ${inv.invoiceNumber}
              </div>
              <div style="font-size:1.1rem; font-weight:800; color:#2563eb; margin-top:0.35rem;">
                ${Formatters.currency(inv.totalAmount)}
              </div>
            </div>
            
            <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
              <span class="badge-pill ${inv.status === 'paid' ? 'badge-success' : 'badge-danger'}" style="font-size:0.75rem; padding:0.35rem 0.6rem;">
                ${inv.status === 'paid' ? '🟢 ชำระแล้ว' : '🔴 ค้างชำระ'}
              </span>
              <span style="font-size:0.75rem; color:#9ca3af;">
                ครบกำหนด: ${Formatters.thaiDate(inv.dueDate).split('/')[0]}/${Formatters.thaiDate(inv.dueDate).split('/')[1]}
              </span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  static bindBillsTabEvents() {
    const cards = document.querySelectorAll('.bill-card-item');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const invoices = this.state.invoices || [];
        const inv = invoices.find(i => i.id === id);
        if (inv) {
          if (inv.status === 'paid') {
            this.openReceiptModal(inv);
          } else {
            this.openPaymentModal(inv);
          }
        }
      });
    });
  }

  // --- 2.3 REPAIRS TAB (List & Details Mockup UI) ---
  static renderRepairsTab() {
    if (this.activeRepairId) {
      return this.renderRepairDetailScreen();
    }

    const repairs = this.state.repairs || [];
    const activeList = repairs.filter(r => r.status !== 'completed' && r.status !== 'เสร็จสิ้น');
    const pastList = repairs.filter(r => r.status === 'completed' || r.status === 'เสร็จสิ้น');

    return `
      <div class="animate-fade-in">
        
        <button type="button" class="btn btn-primary btn-full" id="btn-add-repair-trigger" style="margin-bottom:1.25rem; font-weight:700; border-radius:12px; padding:0.85rem; box-shadow:0 6px 15px rgba(37,99,235,0.25);">
          <i class="fa-solid fa-circle-plus"></i>
          <span>แจ้งปัญหาสุขาภิบาล / ซ่อมบำรุงห้อง</span>
        </button>

        <!-- รายการซ่อมคงค้าง -->
        <p style="font-size:0.85rem; color:#64748b; font-weight:700; margin-bottom:0.5rem; padding-left:0.25rem;">
          งานซ่อมบำรุงที่อยู่ระหว่างดำเนินการ (${activeList.length})
        </p>

        <div style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:1.5rem;">
          ${activeList.length === 0 ? `
            <div class="white-card text-center" style="padding:1.5rem; text-align:center; color:#94a3b8; font-size:0.85rem;">
              ไม่มีรายการแจ้งซ่อมระหว่างดำเนินการ
            </div>
          ` : activeList.map(rep => this.renderRepairCardMarkup(rep)).join('')}
        </div>

        <!-- ประวัติการซ่อมบำรุงที่แล้วเสร็จ -->
        <p style="font-size:0.85rem; color:#64748b; font-weight:700; margin-bottom:0.5rem; padding-left:0.25rem;">
          ประวัติการซ่อมบำรุงที่เสร็จสิ้นแล้ว (${pastList.length})
        </p>

        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          ${pastList.length === 0 ? `
            <div class="white-card text-center" style="padding:1.5rem; text-align:center; color:#94a3b8; font-size:0.85rem;">
              ไม่มีประวัติการซ่อมบำรุงย้อนหลัง
            </div>
          ` : pastList.map(rep => this.renderRepairCardMarkup(rep)).join('')}
        </div>

      </div>
    `;
  }

  static renderRepairCardMarkup(rep) {
    let statusLabel = 'รับแจ้งใหม่';
    let statusClass = 'badge-primary';
    
    if (rep.status === 'assigned' || rep.status === 'มอบหมายช่าง') {
      statusLabel = 'มอบหมายช่าง';
      statusClass = 'badge-primary';
    } else if (rep.status === 'in_progress' || rep.status === 'กำลังซ่อม') {
      statusLabel = 'กำลังซ่อม';
      statusClass = 'badge-warning';
    } else if (rep.status === 'completed' || rep.status === 'เสร็จสิ้น') {
      statusLabel = 'เสร็จสิ้น';
      statusClass = 'badge-success';
    }

    return `
      <div class="repair-item-card" data-ticket="${rep.ticketNumber}" style="cursor:pointer; background:#ffffff; border-radius:16px; padding:1.25rem; border:1px solid #e2e8f0; box-shadow:var(--shadow-sm); display:flex; justify-content:space-between; align-items:center; transition:var(--transition);">
        <div style="flex:1; min-width:0; padding-right:1rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <strong style="font-size:0.95rem; color:#1e293b;">${rep.ticketNumber}</strong>
            <span class="badge-pill ${statusClass}" style="font-size:0.7rem; padding:0.15rem 0.45rem;">${statusLabel}</span>
          </div>
          <div style="font-weight:700; font-size:0.88rem; color:#0f172a; margin-top:0.35rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${rep.title}
          </div>
          <div style="font-size:0.8rem; color:#64748b; margin-top:0.15rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${rep.description || 'ไม่มีคำอธิบายเพิ่มเติม'}
          </div>
        </div>
        <div style="flex-shrink:0; text-align:right;">
          <i class="fa-solid fa-chevron-right" style="color:#cbd5e1; font-size:0.95rem;"></i>
        </div>
      </div>
    `;
  }

  static renderRepairDetailScreen() {
    const repairs = this.state.repairs || [];
    const rep = repairs.find(r => r.ticketNumber === this.activeRepairId);
    if (!rep) return `<div>ไม่พบข้อมูลใบแจ้งซ่อม</div>`;

    // Generate repair logs timeline dynamically
    const timelineItems = [
      {
        title: 'รับแจ้งใหม่',
        desc: `แจ้งซ่อมเข้าระบบผ่าน LINE: ${rep.title}`,
        time: `${Formatters.thaiDate(rep.requestDate)}`,
        color: 'grey'
      }
    ];

    if (rep.assignedTechnician && rep.assignedTechnician !== '-' && rep.assignedTechnician !== 'ยังไม่ระบุช่าง') {
      timelineItems.unshift({
        title: 'มอบหมายช่าง',
        desc: `มอบหมายงานให้ช่าง: ${rep.assignedTechnician}`,
        time: `${Formatters.thaiDate(rep.requestDate)}`,
        color: 'blue'
      });
    }

    if (rep.status === 'in_progress' || rep.status === 'กำลังซ่อม') {
      timelineItems.unshift({
        title: 'กำลังซ่อม',
        desc: 'ช่างกำลังดำเนินการเข้าแก้ไขหน้างานบำรุงรักษา',
        time: `${Formatters.thaiDate(rep.requestDate)}`,
        color: 'yellow'
      });
    }

    if (rep.status === 'completed' || rep.status === 'เสร็จสิ้น') {
      let expenseDesc = 'ช่างสรุปผลดำเนินการซ่อมบำรุงเรียบร้อยแล้ว';
      if (rep.expenseAmount && rep.expenseAmount > 0) {
        expenseDesc += ` (ค่าใช้จ่าย: ${Formatters.currency(rep.expenseAmount)})`;
      }
      timelineItems.unshift({
        title: 'ซ่อมบำรุงเสร็จสิ้น',
        desc: expenseDesc,
        time: `${Formatters.thaiDate(rep.requestDate)}`,
        color: 'green'
      });
    }

    return `
      <div class="animate-fade-in">
        
        <!-- Photo attachment Card (Matches screen mockup 3) -->
        ${rep.imageUrl ? `
          <div class="white-card">
            <h4 style="font-size:0.92rem; font-weight:700; color:#334155; margin-bottom:0.75rem;">
              <i class="fa-regular fa-image text-primary"></i> รูปภาพแนบมา
            </h4>
            <div style="font-size:0.82rem; color:#64748b; margin-bottom:0.5rem;">ก่อนซ่อม</div>
            <img src="${rep.imageUrl}" style="width:100%; border-radius:12px; max-height:220px; object-fit:cover; border:1px solid #cbd5e1; box-shadow:var(--shadow-sm);" />
          </div>
        ` : ''}

        <!-- Timeline tracking Card (Matches screen mockup 3) -->
        <div class="white-card">
          <h4 style="font-size:0.92rem; font-weight:700; color:#334155; margin-bottom:0.75rem;">
            <i class="fa-regular fa-clock text-primary"></i> ไทม์ไลน์การดำเนินงาน
          </h4>
          
          <div class="timeline-container">
            ${timelineItems.map(item => `
              <div class="timeline-item">
                <span class="timeline-dot ${item.color}"></span>
                <div class="timeline-title">${item.title}</div>
                <div class="timeline-desc">${item.desc}</div>
                <div class="timeline-time">${item.time}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <button type="button" class="btn btn-secondary btn-full" id="btn-back-repairs-list-body" style="border-radius:12px; padding:0.85rem; font-weight:700;">
          <i class="fa-solid fa-arrow-left"></i> ย้อนกลับไปรายการแจ้งซ่อม
        </button>

      </div>
    `;
  }

  static bindRepairsTabEvents() {
    // Click on repair request list card to open details
    const repairCards = document.querySelectorAll('.repair-item-card');
    repairCards.forEach(card => {
      card.addEventListener('click', () => {
        const ticket = card.getAttribute('data-ticket');
        this.activeRepairId = ticket;
        this.render();
      });
    });

    // Back to repairs list clicks
    const backBtn = document.getElementById('btn-back-repairs-list-body');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.activeRepairId = null;
        this.render();
      });
    }

    // Trigger New Repair Request Modal
    const addTrigger = document.getElementById('btn-add-repair-trigger');
    if (addTrigger) {
      addTrigger.addEventListener('click', () => {
        this.openNewRepairFormModal();
      });
    }
  }

  // --- 2.4 NOTICES TAB ---
  static renderNoticesTab() {
    const events = this.state.events || [];
    
    // Sort events by date descending
    const sortedEvents = events.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (sortedEvents.length === 0) {
      return `
        <div class="white-card text-center animate-fade-in" style="padding:3rem 1.5rem; text-align:center;">
          <i class="fa-solid fa-bullhorn text-muted" style="font-size:2.5rem; margin-bottom:1rem; opacity:0.5;"></i>
          <p style="color:#64748b; font-weight:600;">ช่วงนี้ไม่มีประกาศข่าวสารจากทางหอพัก</p>
        </div>
      `;
    }

    return `
      <div class="animate-fade-in" style="display:flex; flex-direction:column; gap:0.85rem;">
        <p style="font-size:0.85rem; color:#64748b; font-weight:700; margin-bottom:0.15rem; padding-left:0.25rem;">
          ข่าวประชาสัมพันธ์ / ประกาศจากสำนักงานนิติบุคคล
        </p>

        ${sortedEvents.map(evt => `
          <div class="white-card" style="margin-bottom:0; display:flex; flex-direction:column; gap:0.5rem; border-left:4px solid #2563eb;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <span class="badge-pill badge-primary" style="font-size:0.68rem; padding:0.15rem 0.45rem;">
                ${evt.category || 'ประกาศทั่วไป'}
              </span>
              <span style="font-size:0.75rem; color:#94a3b8; font-weight:600;">
                <i class="fa-regular fa-calendar"></i> ${Formatters.thaiDate(evt.date)}
              </span>
            </div>
            
            <h4 style="font-size:0.95rem; font-weight:800; color:#1e293b;">
              ${evt.title}
            </h4>
            
            <p style="font-size:0.85rem; color:#475569; line-height:1.5; white-space:pre-line;">
              ${evt.roomName || 'ประกาศถึงผู้เช่าทุกท่าน'}
            </p>
          </div>
        `).join('')}
      </div>
    `;
  }

  // --- 2.5 PROFILE TAB (Matches Screen mockup 2) ---
  static renderProfileTab() {
    const tenant = this.currentTenant;
    const rooms = this.state.rooms || [];
    const room = rooms.find(r => r.id === tenant.assignedRoomId) || { name: 'S101', floor: 1, baseRent: 2500 };

    return `
      <div class="animate-fade-in">
        
        <!-- User avatar identity card -->
        <div class="white-card text-center" style="padding:1.5rem 1rem; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=student" style="width:72px; height:72px; border-radius:50%; background:#eff6ff; border:2px solid #2563eb; margin-bottom:0.75rem; box-shadow:var(--shadow-sm);" />
          <h3 style="font-size:1.15rem; font-weight:800; color:#0f172a; margin:0;">
            ${tenant.name}
          </h3>
          <span style="font-size:0.8rem; font-weight:700; color:#64748b; font-family:monospace; margin-top:0.2rem; background:#f1f5f9; padding:0.15rem 0.5rem; border-radius:6px;">
            TENANT ID: ${tenant.id.replace('t_', '').toUpperCase()}
          </span>
        </div>

        <!-- Contact info widget -->
        <div class="white-card" style="padding:1.25rem 1.5rem;">
          <h4 style="font-size:0.92rem; font-weight:800; color:#1e293b; border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem; margin-bottom:0.85rem;">
            <i class="fa-solid fa-address-book text-primary" style="margin-right:0.35rem;"></i> ข้อมูลติดต่อ
          </h4>
          
          <div style="display:flex; justify-content:space-between; padding:0.45rem 0; font-size:0.88rem;">
            <span style="color:#64748b; font-weight:600;">เบอร์โทร</span>
            <span style="font-weight:700; color:#0f172a;">${tenant.tel}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:0.45rem 0; font-size:0.88rem;">
            <span style="color:#64748b; font-weight:600;">อีเมล</span>
            <span style="font-weight:700; color:#0f172a;">${tenant.email || 'ddd@gmail.com'}</span>
          </div>
        </div>

        <!-- Contract Details Card -->
        <div class="white-card" style="padding:1.25rem 1.5rem;">
          <h4 style="font-size:0.92rem; font-weight:800; color:#1e293b; border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem; margin-bottom:0.85rem;">
            <i class="fa-regular fa-file-lines text-primary" style="margin-right:0.35rem;"></i> สัญญาเช่าปัจจุบัน
          </h4>
          
          <div style="display:flex; justify-content:space-between; padding:0.45rem 0; font-size:0.88rem;">
            <span style="color:#64748b; font-weight:600;">เลขสัญญา</span>
            <span style="font-weight:700; color:#0f172a; font-family:monospace;">CT-69-${tenant.id.replace('t_', '').padStart(4, '0')}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:0.45rem 0; font-size:0.88rem;">
            <span style="color:#64748b; font-weight:600;">ห้อง</span>
            <span style="font-weight:700; color:#0f172a;">${room.name} · ชั้น ${room.floor}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:0.45rem 0; font-size:0.88rem;">
            <span style="color:#64748b; font-weight:600;">ค่าเช่า/เดือน</span>
            <span style="font-weight:700; color:#2563eb;">${Formatters.currency(room.baseRent)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:0.45rem 0; font-size:0.88rem;">
            <span style="color:#64748b; font-weight:600;">เริ่มสัญญา</span>
            <span style="font-weight:700; color:#0f172a;">1 มิ.ย. 69</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:0.45rem 0; font-size:0.88rem;">
            <span style="color:#64748b; font-weight:600;">ครบกำหนดชำระ</span>
            <span style="font-weight:700; color:#dc2626;">ทุกวันที่ 5</span>
          </div>
        </div>

        <!-- LINE Account Linking Card -->
        <div class="white-card" style="padding:1.25rem 1.5rem;">
          <h4 style="font-size:0.92rem; font-weight:800; color:#1e293b; border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem; margin-bottom:0.85rem;">
            <i class="fa-brands fa-line text-success" style="margin-right:0.35rem;"></i> เชื่อมต่อบัญชี LINE
          </h4>
          
          ${this.lineAccount ? `
            <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1rem; padding:0.5rem 0;">
              <img src="${this.lineAccount.picture_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=line'}" style="width:48px; height:48px; border-radius:50%; border:2px solid #06c755; background:#f0fdf4;" />
              <div style="flex:1;">
                <div style="font-weight:700; color:#0f172a; font-size:0.92rem;">${this.lineAccount.display_name || 'LINE User'}</div>
                <div style="font-size:0.78rem; color:#059669; font-weight:700;"><i class="fa-solid fa-circle-check"></i> เชื่อม LINE แล้ว</div>
              </div>
            </div>
            <button type="button" class="btn btn-secondary btn-full" id="btn-line-unlink" style="border-radius:10px; padding:0.6rem; color:#dc2626; border-color:#fca5a5; background:#fff5f5; font-size:0.85rem; font-weight:700; display:flex; justify-content:center; gap:0.35rem;">
              <i class="fa-solid fa-link-slash"></i> ยกเลิกการเชื่อมต่อ
            </button>
          ` : `
            <p style="font-size:0.82rem; color:#64748b; margin:0 0 1rem 0; line-height:1.5;">
              เชื่อมต่อบัญชี LINE ของคุณ เพื่อรับข้อความแจ้งเตือนเมื่อออกบิลใหม่ แจ้งเตือนชำระเงิน หรือส่งข้อความจากหอพักโดยตรง
            </p>
            <button type="button" class="btn btn-success btn-full" id="btn-line-link" style="border-radius:10px; padding:0.75rem; background:#06c755; border-color:#06c755; font-weight:700; font-size:0.9rem; display:flex; justify-content:center; gap:0.4rem;">
              <i class="fa-brands fa-line" style="font-size:1.1rem;"></i> เชื่อมต่อบัญชี LINE
            </button>
          `}
        </div>

        <!-- Logout Action Button -->
        <button type="button" class="btn btn-secondary btn-full" id="btn-profile-logout" style="border-radius:12px; padding:0.85rem; color:#dc2626; border-color:#fca5a5; background:#fff5f5; font-weight:700; margin-top:0.5rem; display:flex; justify-content:center; gap:0.5rem;">
          <i class="fa-solid fa-right-from-bracket"></i>
          <span>ออกจากระบบ</span>
        </button>

      </div>
    `;
  }

  static bindProfileTabEvents() {
    const linkBtn = document.getElementById('btn-line-link');
    if (linkBtn) {
      linkBtn.addEventListener('click', () => {
        const url = TenantDBService.getSavedSupabaseUrl();
        const baseUrl = TenantDBService.getBaseSupabaseUrl(url);
        const tenant = this.currentTenant;
        
        // Redirect to Edge Function OAuth Redirect endpoint
        const returnUrl = window.location.origin + window.location.pathname;
        const redirectUrl = `${baseUrl}/functions/v1/line-login-callback?action=loginRedirect&tenantId=${tenant.id}&roomId=${tenant.assignedRoomId}&returnUrl=${encodeURIComponent(returnUrl)}`;
        
        window.location.href = redirectUrl;
      });
    }

    const unlinkBtn = document.getElementById('btn-line-unlink');
    if (unlinkBtn) {
      unlinkBtn.addEventListener('click', () => {
        this.unlinkLineAccount();
      });
    }

    const logoutBtn = document.getElementById('btn-profile-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        TenantDBService.setLoggedInTenant(null);
        this.currentTenant = null;
        this.activeTab = 'home';
        this.render();
      });
    }
  }

  // --- 3. MODAL POPUP DIALOGS ---
  
  // 3.1 openPaymentModal (Scan QR Code & Upload Slip Card)
  static openPaymentModal(inv) {
    if (!inv) return;
    MyBillsApp.activeInvoiceNumber = inv.invoiceNumber;
    MyBillsApp.currentSlipDataUrl = '';
    MyBillsApp.currentPayMethod = 'transfer';

    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    const amountToPay = inv.outstandingAmount || inv.totalAmount;
    const settings = this.state.settings || {};
    // ห้ามใช้เลขพร้อมเพย์ตัวอย่าง/เดโมเป็น fallback เด็ดขาด — ถ้าแอดมินยังไม่ตั้งค่าจริง
    // ให้ถือว่าไม่มีเลขพร้อมเพย์ แล้วซ่อน QR พร้อมแจ้งให้ติดต่อแอดมินแทน
    const promptPayId = settings.promptPayId || '';
    const qrPayload = promptPayId ? PromptPayService.generatePayload(promptPayId, amountToPay) : '';
    
    // PromptPay QR image using public API (สร้างเฉพาะกรณีมีเลขพร้อมเพย์จริงจากการตั้งค่าเท่านั้น)
    const qrImgUrl = promptPayId ? `https://promptpay.io/${promptPayId}/${amountToPay}.png` : '';
    const hasBankInfo = !!(settings.bankName || settings.bankAccountNo);

    const renderPaymentContent = () => {
      dialog.innerHTML = `
        <div class="modal-header" style="background:#2563eb; color:#ffffff;">
          <h3><i class="fa-solid fa-qrcode"></i> ดูบิล & ชำระเงินบิล</h3>
          <button type="button" class="close-modal-btn" style="color:#ffffff;">&times;</button>
        </div>
        <div class="modal-body" style="padding:1.25rem;">
          
          <!-- Bill Summary Card -->
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; padding:1rem; margin-bottom:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem; font-size:0.9rem;">
              <span style="font-weight:700; color:#1e293b;">รอบบิล ${Formatters.thaiMonthBE(inv.monthKey)}</span>
              <span class="badge-pill badge-danger" style="font-size:0.75rem;">ค้างชำระ</span>
            </div>
            <div style="font-size:0.8rem; color:#64748b; font-family:monospace;">บิลเลขที่: ${inv.invoiceNumber}</div>
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:0.5rem; font-size:0.9rem;">
              <span style="font-weight:600; color:#475569;">ยอดเงินที่ต้องชำระ:</span>
              <strong style="font-size:1.3rem; color:#dc2626;">${Formatters.currency(amountToPay)}</strong>
            </div>
          </div>

          <!-- Payment Channel selection -->
          <div style="display:flex; border:1px solid #cbd5e1; border-radius:10px; overflow:hidden; margin-bottom:1rem; font-family:inherit; box-shadow:var(--shadow-sm);">
            <button type="button" id="pay-modal-transfer" style="flex:1; border:none; padding:0.65rem; font-weight:700; cursor:pointer; font-size:0.88rem; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:0.4rem; ${MyBillsApp.currentPayMethod === 'transfer' ? 'background:#2563eb; color:#ffffff;' : 'background:#f8fafc; color:#475569;'}">
              <i class="fa-solid fa-credit-card"></i> โอน (PromptPay)
            </button>
            <button type="button" id="pay-modal-cash" style="flex:1; border:none; padding:0.65rem; font-weight:700; cursor:pointer; font-size:0.88rem; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:0.4rem; ${MyBillsApp.currentPayMethod === 'cash' ? 'background:#059669; color:#ffffff;' : 'background:#f8fafc; color:#475569;'}">
              <i class="fa-solid fa-money-bill-wave"></i> ชำระเงินสด
            </button>
          </div>

          ${MyBillsApp.currentPayMethod === 'transfer' ? `
            <!-- Transfer View (Matches iOS Mockup) -->
            <!-- Bank Transfer Info (จากค่าตั้งค่าจริงของแอดมินเท่านั้น ไม่ใช่ข้อมูลตัวอย่าง) -->
            ${hasBankInfo ? `
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:0.75rem; text-align:center; font-size:0.8rem; color:#166534; margin-bottom:1rem; line-height:1.5;">
                🏦 <strong>บัญชีรับเงิน:</strong> ${settings.bankName || '-'}<br>
                เลขบัญชี: <strong style="font-size:0.95rem; color:#2563eb;">${settings.bankAccountNo || '-'}</strong>
                ${settings.bankAccountName ? ` | ชื่อบัญชี: <strong>${settings.bankAccountName}</strong>` : ''}
              </div>
            ` : ''}

            <!-- PromptPay QR Code container -->
            ${qrImgUrl ? `
              <div class="qr-box" style="margin:0 0 1rem 0; padding:0.85rem;">
                <div style="font-weight:800; font-size:0.88rem; color:#0f172a;">สแกนเพื่อโอนเงิน (Thai PromptPay QR)</div>
                <img src="${qrImgUrl}" alt="PromptPay QR Code" style="width:160px; height:160px;" />
                <div style="font-size:0.75rem; color:#64748b; margin-top:0.25rem;">บันทึกรูปคิวอาร์นี้เพื่อนำไปสแกนในแอปธนาคารของคุณ</div>
              </div>
            ` : `
              <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:1rem; text-align:center; margin-bottom:1rem;">
                <i class="fa-solid fa-triangle-exclamation" style="color:#dc2626; font-size:1.5rem; margin-bottom:0.35rem;"></i>
                <div style="font-weight:700; color:#991b1b; font-size:0.88rem;">ยังไม่ได้ตั้งค่าเลขพร้อมเพย์</div>
                <div style="font-size:0.8rem; color:#7f1d1d; margin-top:0.25rem;">กรุณาติดต่อผู้ดูแลหอพัก${hasBankInfo ? ' หรือโอนตามเลขบัญชีด้านบน' : ''} เพื่อสอบถามช่องทางชำระเงิน</div>
              </div>
            `}

            <!-- Slip upload form -->
            <form id="pay-modal-slip-form">
              <div class="form-group" style="margin-bottom:1rem;">
                <div class="slip-upload-area" id="pay-modal-drop-area" style="padding:1.25rem; margin-bottom:0.75rem;">
                  <i class="fa-solid fa-cloud-arrow-up" style="font-size:1.8rem; color:#2563eb; margin-bottom:0.4rem;"></i>
                  <div style="font-weight:700; color:#334155; font-size:0.85rem;">คลิกเพื่ออัปโหลดรูปภาพสลิปสแกนชำระเงิน</div>
                  <small class="text-muted" style="font-size:0.75rem;">รองรับสลิป JPG, PNG เท่านั้น</small>
                  <input type="file" id="pay-modal-file-input" accept="image/*" style="display:none;" required>
                  <div id="pay-modal-preview-container" style="${MyBillsApp.currentSlipDataUrl ? 'display:block;' : 'display:none;'} margin-top:0.5rem;">
                    <img id="pay-modal-preview-img" class="slip-preview-img" src="${MyBillsApp.currentSlipDataUrl}" style="max-height:160px;" alt="Slip Preview">
                  </div>
                </div>
              </div>

              <button type="submit" class="btn btn-primary btn-full" style="padding:0.85rem; border-radius:12px;">
                <i class="fa-solid fa-paper-plane"></i> ชำระบริการและแนบสลิป
              </button>
            </form>
          ` : `
            <!-- Cash View -->
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:1.5rem; text-align:center; margin:1rem 0;">
              <i class="fa-solid fa-money-bill-wave" style="font-size:2.5rem; color:#16a34a; margin-bottom:0.5rem;"></i>
              <h4 style="color:#14532d; font-weight:700; font-size:1rem; margin-bottom:0.5rem;">แจ้งชำระด้วยเงินสด</h4>
              <p style="font-size:0.82rem; color:#166534; line-height:1.6; margin-bottom:1.25rem;">
                กรุณาติดต่อเคาน์เตอร์สำนักงานหอพักเพื่อนำเงินสดไปชำระโดยตรง<br>เมื่อกดปุ่มด้านล่าง ระบบจะบันทึกและส่งข้อความแจ้งเจ้าหน้าที่ทันที
              </p>
              <button type="button" id="pay-modal-cash-submit" class="btn btn-success btn-full" style="background:#059669; border-color:#059669; padding:0.85rem; border-radius:12px;">
                <i class="fa-solid fa-circle-check"></i> ยืนยันการชำระด้วยเงินสด
              </button>
            </div>
          `}
        </div>
      `;

      // Bind events inside renderPaymentContent
      modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));
      
      const tabTransfer = document.getElementById('pay-modal-transfer');
      const tabCash = document.getElementById('pay-modal-cash');
      if (tabTransfer && tabCash) {
        tabTransfer.addEventListener('click', () => {
          if (MyBillsApp.currentPayMethod !== 'transfer') {
            MyBillsApp.currentPayMethod = 'transfer';
            renderPaymentContent();
          }
        });
        tabCash.addEventListener('click', () => {
          if (MyBillsApp.currentPayMethod !== 'cash') {
            MyBillsApp.currentPayMethod = 'cash';
            renderPaymentContent();
          }
        });
      }

      if (MyBillsApp.currentPayMethod === 'transfer') {
        const dropArea = document.getElementById('pay-modal-drop-area');
        const fileInput = document.getElementById('pay-modal-file-input');
        const previewContainer = document.getElementById('pay-modal-preview-container');
        const previewImg = document.getElementById('pay-modal-preview-img');

        if (dropArea && fileInput) {
          dropArea.addEventListener('click', () => fileInput.click());
          fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
              // 1. Security Check: File Type
              const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
              if (!allowedMimes.includes(file.type.toLowerCase())) {
                alert('⚠️ รองรับเฉพาะไฟล์รูปภาพสลิปประเภท JPG, PNG หรือ WEBP เท่านั้น');
                fileInput.value = '';
                return;
              }
              // 2. Security Check: File Size <= 10MB
              if (file.size > 10 * 1024 * 1024) {
                alert(`⚠️ ขนาดไฟล์สลิปเกินกำหนด (สูงสุด 10 MB) ไฟล์ของคุณขนาด ${(file.size / (1024 * 1024)).toFixed(1)} MB`);
                fileInput.value = '';
                return;
              }

              const reader = new FileReader();
              reader.onload = async (evt) => {
                const dataUrl = evt.target.result;
                
                // Show analyzing indicator in drop area
                const dropAreaText = dropArea.querySelector('p');
                const originalText = dropAreaText ? dropAreaText.innerHTML : '';
                if (dropAreaText) {
                  dropAreaText.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-success" style="font-size:1.5rem;"></i><br><strong style="color:var(--success);">กำลังตรวจสอบคิวอาร์โค้ดสลิป...</strong>';
                }

                const qrData = await MyBillsApp.decodeQR(dataUrl);
                if (dropAreaText) {
                  dropAreaText.innerHTML = originalText;
                }

                if (!qrData) {
                  alert('⚠️ ตรวจสอบไม่พบ "QR Code สลิปธนาคาร" บนรูปภาพนี้!\n\nกรุณาอัปโหลดรูปภาพสลิปโอนเงินของจริงจากแอปธนาคาร (ที่มี QR Code แสดงชัดเจน) เพื่อใช้สำหรับส่งหลักฐานชำระเงินตามระบบรักษาความปลอดภัยครับ');
                  MyBillsApp.currentSlipDataUrl = '';
                  MyBillsApp.currentSlipQrData = '';
                  previewImg.src = '';
                  previewContainer.style.display = 'none';
                  fileInput.value = '';
                  return;
                }

                MyBillsApp.currentSlipDataUrl = dataUrl;
                MyBillsApp.currentSlipQrData = qrData;
                previewImg.src = dataUrl;
                previewContainer.style.display = 'block';
              };
              reader.readAsDataURL(file);
            }
          });
        }

        const slipForm = document.getElementById('pay-modal-slip-form');
        if (slipForm) {
          slipForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!MyBillsApp.currentSlipDataUrl) {
              alert('กรุณาอัปโหลดรูปภาพสลิปหลักฐานการโอนเงินก่อนกดยืนยันชำระ');
              return;
            }

            const analysisLoader = document.createElement('div');
            analysisLoader.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15, 23, 42, 0.85); color:#f8fafc; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:999999; font-family:sans-serif; backdrop-filter:blur(4px);';
            analysisLoader.innerHTML = `
              <div style="width:45px; height:45px; border:4px solid #334155; border-top-color:#10b981; border-radius:50%; animation: spin 1s linear infinite; margin-bottom:1rem;"></div>
              <div style="font-weight:700; font-size:1.1rem; margin-bottom:0.25rem;">กำลังส่งหลักฐานสลิป...</div>
              <div style="font-size:0.85rem; color:#cbd5e1;">ระบบกำลังจัดเก็บภาพสลิปลง Supabase Storage</div>
              <style>
                @keyframes spin { to { transform: rotate(360deg); } }
              </style>
            `;
            document.body.appendChild(analysisLoader);

            const tenant = MyBillsApp.currentTenant;
            const invoicesList = MyBillsApp.state.invoices || [];
            const invIdx = invoicesList.findIndex(i => i.invoiceNumber === MyBillsApp.activeInvoiceNumber);

            try {
              const result = await TenantDBService.submitPayment({
                action: 'submitTenantPayment',
                idCard: String(tenant.idCard).replace(/\D/g, ''),
                roomId: tenant.assignedRoomId,
                roomName: inv ? (inv.roomName || tenant.assignedRoomId) : tenant.assignedRoomId,
                tenantName: tenant.name,
                invoiceId: inv ? inv.id : MyBillsApp.activeInvoiceNumber,
                invoiceNumber: MyBillsApp.activeInvoiceNumber,
                monthKey: inv ? inv.monthKey : new Date().toISOString().slice(0,7),
                paymentMethod: 'transfer',
                slipDataUrl: MyBillsApp.currentSlipDataUrl,
                requiredAmount: inv ? (inv.totalAmount || amountToPay) : amountToPay,
                amount: amountToPay,
                fineAmount: inv ? (inv.fineAmount || 0) : 0,
                referenceNo: MyBillsApp.currentSlipQrData ? MyBillsApp.getRefNo(MyBillsApp.currentSlipQrData) : null
              });

              analysisLoader.remove();
              modal.classList.remove('active');
              
              if (invIdx !== -1 && result && result.invoice) {
                invoicesList[invIdx] = Object.assign({}, invoicesList[invIdx], result.invoice);
              }

              // Fire-and-forget LINE notification to Admin
              try {
                const supabaseUrl = TenantDBService.getSavedSupabaseUrl();
                const apiKey = TenantDBService.getSavedTenantApiKey();
                if (supabaseUrl && apiKey) {
                  const baseUrl = TenantDBService.getBaseSupabaseUrl(supabaseUrl);
                  fetch(`${baseUrl}/functions/v1/line-notify`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'apikey': apiKey,
                      'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                      action: 'notifyAdminNewSlip',
                      roomName: room ? room.name : tenant.assignedRoomId,
                      tenantName: tenant.name,
                      amount: amountToPay
                    })
                  }).catch(e => console.warn('Failed to send LINE notification to admin:', e));
                }
              } catch (lineErr) {
                console.warn('LINE notification trigger error:', lineErr);
              }

              MyBillsApp.render();
              MyBillsApp.openOfficialBillModal(invoicesList[invIdx]);
            } catch (err) {
              analysisLoader.remove();
              alert('❌ ' + err.message);
            }
          });
        }
      } else {
        // Cash payment submission trigger
        const cashSubmitBtn = document.getElementById('pay-modal-cash-submit');
        if (cashSubmitBtn) {
          cashSubmitBtn.addEventListener('click', async () => {
            const tenant = MyBillsApp.currentTenant;
            const invoicesList = MyBillsApp.state.invoices || [];
            const invIdx = invoicesList.findIndex(i => i.invoiceNumber === MyBillsApp.activeInvoiceNumber);

            try {
              const result = await TenantDBService.submitPayment({
                action: 'submitTenantPayment',
                idCard: String(tenant.idCard).replace(/\D/g, ''),
                roomId: tenant.assignedRoomId,
                invoiceNumber: MyBillsApp.activeInvoiceNumber,
                paymentMethod: 'cash'
              });

              modal.classList.remove('active');

              if (invIdx !== -1 && result && result.invoice) {
                invoicesList[invIdx] = Object.assign({}, invoicesList[invIdx], result.invoice);
              }

              MyBillsApp.render();
              MyBillsApp.openReceiptModal(invoicesList[invIdx]);
            } catch (err) {
              alert('❌ แจ้งชำระล้มเหลว: ' + err.message);
            }
          });
        }
      }
    };

    renderPaymentContent();
    modal.classList.add('active');
  }

  // 3.2 openReceiptModal (Paid Receipt printable dialog)
  static openReceiptModal(inv) {
    if (!inv) return;
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    dialog.innerHTML = `
      <div class="modal-header" style="background:#10b981; color:#ffffff;">
        <h3><i class="fa-solid fa-receipt"></i> ใบเสร็จรับเงิน (Official Receipt)</h3>
        <button type="button" class="close-modal-btn" style="color:#ffffff;">&times;</button>
      </div>
      <div class="modal-body" style="padding:1rem;">
        
        <div id="modal-printable-bill-area" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem; font-family:sans-serif; color:#0f172a;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #0f172a; padding-bottom:0.75rem; margin-bottom:1rem;">
            <div>
              <h2 style="font-size:1.25rem; font-weight:800; color:#0f172a;">หอพักสมบัติ นนทบุรี</h2>
              <p style="font-size:0.78rem; color:#64748b; margin-top:0.2rem; line-height:1.3;">45/10 ม.8 ต.ราษฎร์นิยม อ.ไทรน้อย จ.นนทบุรี 11150</p>
            </div>
            <div style="text-align:right;">
              <span class="badge-pill badge-success" style="font-size:0.75rem;">🟢 ชำระเงินแล้ว</span>
              <div style="font-size:0.85rem; font-weight:800; margin-top:0.25rem;">เลขที่: ${inv.invoiceNumber}</div>
              <div style="font-size:0.75rem; color:#64748b;">รอบบิล: ${Formatters.thaiMonthBE(inv.monthKey)}</div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; background:#f8fafc; padding:0.75rem; border-radius:8px; font-size:0.82rem; margin-bottom:1rem; line-height:1.4;">
            <div><strong>ห้องพัก:</strong> ห้อง ${inv.roomName}</div>
            <div><strong>ชื่อผู้เช่า:</strong> ${inv.tenantName}</div>
            <div><strong>วันที่ชำระ:</strong> ${Formatters.thaiDate(inv.paymentDate || new Date().toISOString())}</div>
            <div><strong>วิธีชำระ:</strong> ${inv.slipUrl === 'cash' ? 'เงินสด (Cash)' : 'โอนเงิน (PromptPay)'}</div>
          </div>

          <table style="width:100%; border-collapse:collapse; font-size:0.8rem; margin-bottom:1rem;" border="1" cellpadding="6" cellspacing="0">
            <thead>
              <tr style="background:#f1f5f9; color:#1e293b;">
                <th style="text-align:center; width:8%;">ลำดับ</th>
                <th>รายการชำระเงิน</th>
                <th style="text-align:right; width:28%;">จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="text-align:center;">1</td><td>ค่าเช่าห้องพักประจำเดือน</td><td style="text-align:right;">${Formatters.currency(inv.rentAmount || 2500)}</td></tr>
              <tr><td style="text-align:center;">2</td><td>ค่าไฟฟ้า (Electricity)</td><td style="text-align:right;">${Formatters.currency(inv.elecAmount || 0)}</td></tr>
              <tr><td style="text-align:center;">3</td><td>ค่าน้ำประปา (Water)</td><td style="text-align:right;">${Formatters.currency(inv.waterAmount || 0)}</td></tr>
              <tr><td style="text-align:center;">4</td><td>ค่าขยะ / สาธารณูปโภค</td><td style="text-align:right;">${Formatters.currency(inv.trashFee !== undefined ? inv.trashFee : 20)}</td></tr>
              ${inv.fineAmount > 0 ? `<tr><td style="text-align:center;">5</td><td>ค่าปรับชำระล่าช้า</td><td style="text-align:right;">${Formatters.currency(inv.fineAmount)}</td></tr>` : ''}
              <tr style="background:#f0fdf4; font-weight:bold; color:#15803d;"><td colspan="2" style="text-align:right;">ยอดรวมชำระทั้งสิ้น:</td><td style="text-align:right; font-size:1.05rem;">${Formatters.currency(inv.paidAmount || inv.totalAmount)}</td></tr>
            </tbody>
          </table>

          <div style="text-align:center; margin-top:1rem; padding-top:0.75rem; border-top:1px dashed #cbd5e1;">
            <p style="font-size:0.8rem; color:#059669; font-weight:700;">🙏 ขอบพระคุณที่เลือกใช้บริการหอพักสมบัติ นนทบุรี</p>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:1rem;">
          <button type="button" class="btn btn-secondary" id="btn-modal-view-bill" style="border-radius:10px; padding:0.65rem;">
            <i class="fa-regular fa-file-pdf"></i> ดูใบแจ้งหนี้
          </button>
          <button type="button" class="btn btn-primary" onclick="window.print()" style="background:#10b981; border-color:#10b981; border-radius:10px; padding:0.65rem;">
            <i class="fa-solid fa-print"></i> สั่งพิมพ์ PDF
          </button>
        </div>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    const viewBillBtn = document.getElementById('btn-modal-view-bill');
    if (viewBillBtn) {
      viewBillBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        this.openOfficialBillModal(inv);
      });
    }
  }

  // 3.3 openOfficialBillModal (Invoice Details)
  static openOfficialBillModal(inv) {
    if (!inv) return;
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    const elecUnits = Math.max(0, (inv.elecCurr || 0) - (inv.elecPrev || 0));
    const waterUnits = Math.max(0, (inv.waterCurr || 0) - (inv.waterPrev || 0));

    dialog.innerHTML = `
      <div class="modal-header" style="background:#2563eb; color:#ffffff;">
        <h3><i class="fa-regular fa-file-lines"></i> รายละเอียดใบแจ้งบิลค่าเช่า</h3>
        <button type="button" class="close-modal-btn" style="color:#ffffff;">&times;</button>
      </div>
      <div class="modal-body" style="padding:1rem;">
        
        <div id="modal-printable-bill-area" style="background:#ffffff; border:1px solid #cbd5e1; border-radius:12px; padding:1.25rem; font-family:sans-serif; color:#0f172a;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #2563eb; padding-bottom:0.75rem; margin-bottom:1rem;">
            <div>
              <h2 style="color:#1e40af; font-size:1.25rem; font-weight:800; margin-bottom:0.2rem;">หอพักสมบัติ นนทบุรี</h2>
              <p style="font-size:0.78rem; color:#475569; margin:0; line-height:1.3;">45/10 ม.8 ต.ราษฎร์นิยม อ.ไทรน้อย จ.นนทบุรี 11150</p>
            </div>
            <div style="text-align:right;">
              <span class="badge-pill ${inv.status === 'paid' ? 'badge-success' : 'badge-danger'}" style="font-size:0.75rem;">
                ${inv.status === 'paid' ? '🟢 ชำระแล้ว' : '🔴 ค้างชำระ'}
              </span>
              <h3 style="font-size:1rem; font-weight:800; color:#0f172a; margin-top:0.25rem; font-family:monospace;">${inv.invoiceNumber}</h3>
              <p style="font-size:0.75rem; color:#64748b;">บิลเดือน: ${Formatters.thaiMonthBE(inv.monthKey)}</p>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; background:#f8fafc; padding:0.75rem; border-radius:8px; margin-bottom:1rem; font-size:0.82rem; line-height:1.4;">
            <div>ห้องพัก (Room): <strong style="color:#2563eb;">ห้อง ${inv.roomName}</strong></div>
            <div>ชื่อผู้เช่า (Tenant): <strong>${inv.tenantName}</strong></div>
            <div>ออกบิลเมื่อ (Issue): <strong>${Formatters.thaiDate(inv.issueDate)}</strong></div>
            <div>ครบกำหนด (Due): <strong style="color:#dc2626;">${Formatters.thaiDate(inv.dueDate)}</strong></div>
          </div>

          <div class="invoice-details-table-wrapper" style="width:100%; margin-bottom:1rem;">
            <table style="width:100%; table-layout:fixed; border-collapse:collapse; font-size:0.72rem;" border="1" cellpadding="4" cellspacing="0">
              <thead>
                <tr style="background:#f1f5f9; color:#0f172a; text-align:center;">
                  <th style="width:7%;">#</th>
                  <th>รายการ</th>
                  <th style="width:26%;">หน่วยมิเตอร์</th>
                  <th style="width:15%;">หน่วยที่ใช้</th>
                  <th style="width:26%;">จำนวนเงิน (บาท)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="text-align:center;">1</td>
                  <td style="word-break:break-word;">ค่าเช่าห้องพักประจำเดือน</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:right;"><strong>${Formatters.currency(inv.rentAmount)}</strong></td>
                </tr>
                <tr>
                  <td style="text-align:center;">2</td>
                  <td style="word-break:break-word;">ค่าไฟฟ้า</td>
                  <td style="text-align:center; white-space:nowrap;">${inv.elecPrev}→${inv.elecCurr}</td>
                  <td style="text-align:center;">${elecUnits}</td>
                  <td style="text-align:right;"><strong>${Formatters.currency(inv.elecAmount)}</strong></td>
                </tr>
                <tr>
                  <td style="text-align:center;">3</td>
                  <td style="word-break:break-word;">ค่าน้ำประปา</td>
                  <td style="text-align:center; white-space:nowrap;">${inv.waterPrev}→${inv.waterCurr}</td>
                  <td style="text-align:center;">${waterUnits}</td>
                  <td style="text-align:right;"><strong>${Formatters.currency(inv.waterAmount)}</strong></td>
                </tr>
                <tr>
                  <td style="text-align:center;">4</td>
                  <td style="word-break:break-word;">ค่าขยะ / สาธารณูปโภค</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:right;"><strong>${Formatters.currency(inv.trashFee !== undefined ? inv.trashFee : 20)}</strong></td>
                </tr>
                ${inv.fineAmount > 0 ? `
                  <tr>
                    <td style="text-align:center;">5</td>
                    <td style="word-break:break-word;">ค่าปรับชำระล่าช้า</td>
                    <td style="text-align:center;">-</td>
                    <td style="text-align:center;">-</td>
                    <td style="text-align:right; color:#dc2626;"><strong>${Formatters.currency(inv.fineAmount)}</strong></td>
                  </tr>
                ` : ''}
              </tbody>
              <tfoot>
                <tr style="background:#eff6ff; font-weight:800; color:#1e40af;">
                  <td colspan="4" style="text-align:right; font-size:0.8rem;">ยอดบิลสุทธิ:</td>
                  <td style="text-align:right; font-size:0.95rem; color:#1d4ed8;">${Formatters.currency(inv.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; margin-top:1rem;">
          <button type="button" class="btn btn-secondary" id="btn-modal-back-action" style="border-radius:10px; padding:0.65rem;">
            ${inv.status === 'paid' ? '<i class="fa-solid fa-receipt"></i> ดูใบเสร็จ' : '<i class="fa-solid fa-qrcode"></i> ชำระเงิน'}
          </button>
          <button type="button" class="btn btn-primary" onclick="window.print()" style="border-radius:10px; padding:0.65rem;">
            <i class="fa-solid fa-print"></i> พิมพ์เอกสาร
          </button>
        </div>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    const backBtn = document.getElementById('btn-modal-back-action');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        if (inv.status === 'paid') {
          this.openReceiptModal(inv);
        } else {
          this.openPaymentModal(inv);
        }
      });
    }
  }

  // 3.4 openNewRepairFormModal (Submit Repair request form)
  static openNewRepairFormModal() {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');
    
    MyBillsApp.currentSlipDataUrl = ''; // Clear image buffer for new repair request

    dialog.innerHTML = `
      <div class="modal-header" style="background:#2563eb; color:#ffffff;">
        <h3><i class="fa-solid fa-screwdriver-wrench"></i> กรอกคำขอแจ้งซ่อมห้องพัก</h3>
        <button type="button" class="close-modal-btn" style="color:#ffffff;">&times;</button>
      </div>
      <div class="modal-body">
        <form id="new-repair-form">
          <div class="form-group" style="margin-bottom:1rem;">
            <label style="font-weight:700; color:#334155; display:block; margin-bottom:0.4rem;">
              หัวข้อปัญหาที่ต้องการแจ้งซ่อม *
            </label>
            <input type="text" id="repair-title-input" class="form-control" placeholder="เช่น ท่อน้ำรั่วซึม, หลอดไฟห้องน้ำขาด..." required>
          </div>

          <div class="form-group" style="margin-bottom:1rem;">
            <label style="font-weight:700; color:#334155; display:block; margin-bottom:0.4rem;">
              รายละเอียดอาการ / เลขจุดที่มีปัญหา
            </label>
            <textarea id="repair-desc-input" class="form-control" rows="3" placeholder="ระบุรายละเอียดปัญหาสั้นๆ เพื่อให้ช่างซ่อมบำรุงเตรียมเครื่องมือได้ถูกต้อง..." style="resize:none;"></textarea>
          </div>

          <div class="form-group" style="margin-bottom:1.25rem;">
            <label style="font-weight:700; color:#334155; display:block; margin-bottom:0.4rem;">
              รูปถ่ายปัญหาก่อนซ่อม (ระบุปัญหาหน้างาน)
            </label>
            <div class="slip-upload-area" id="repair-img-drop-area" style="padding:1.25rem;">
              <i class="fa-solid fa-camera" style="font-size:1.8rem; color:#64748b; margin-bottom:0.4rem;"></i>
              <div style="font-weight:700; color:#334155; font-size:0.85rem;">กดเลือกเพื่อแนบภาพถ่ายหน้างาน</div>
              <small class="text-muted" style="font-size:0.75rem;">รองรับสลิป JPG, PNG (ไม่บังคับ)</small>
              <input type="file" id="repair-file-input" accept="image/*" style="display:none;">
              <div id="repair-img-preview-container" style="display:none; margin-top:0.5rem;">
                <img id="repair-img-preview-img" class="slip-preview-img" style="max-height:160px;" alt="Repair Attachment Preview">
              </div>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-full" style="padding:0.85rem; border-radius:12px; font-weight:800;">
            <i class="fa-solid fa-paper-plane"></i> ยืนยันและส่งคำขอแจ้งซ่อมบำรุง
          </button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    const dropArea = document.getElementById('repair-img-drop-area');
    const fileInput = document.getElementById('repair-file-input');
    const previewContainer = document.getElementById('repair-img-preview-container');
    const previewImg = document.getElementById('repair-img-preview-img');

    if (dropArea && fileInput) {
      dropArea.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            MyBillsApp.currentSlipDataUrl = evt.target.result;
            previewImg.src = evt.target.result;
            previewContainer.style.display = 'block';
          };
          reader.readAsDataURL(file);
        }
      });
    }

    const form = document.getElementById('new-repair-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('repair-title-input').value.trim();
        const desc = document.getElementById('repair-desc-input').value.trim();

        if (!title) {
          alert('กรุณากรอกหัวข้อแจ้งซ่อมด้วยครับ');
          return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่งคำขอเข้าระบบ...'; }

        try {
          const tenant = MyBillsApp.currentTenant;
          const result = await TenantDBService.submitPayment({
            action: 'submitTenantRepair',
            idCard: String(tenant.idCard).replace(/\D/g, ''),
            roomId: tenant.assignedRoomId,
            title: title,
            description: desc,
            imageUrl: MyBillsApp.currentSlipDataUrl
          });

          modal.classList.remove('active');
          alert('🟢 ส่งเรื่องแจ้งซ่อมเรียบร้อยแล้ว!\n\nระบบวิเคราะห์ปัญหาและแจ้งเตือนแอดมิน/ช่างนิติบุคคลเรียบร้อยแล้วครับ');
          
          if (result && result.repair) {
            if (!MyBillsApp.state.repairs) MyBillsApp.state.repairs = [];
            MyBillsApp.state.repairs.unshift(result.repair);
          }

          MyBillsApp.render();
        } catch (err) {
          alert('❌ การส่งใบแจ้งซ่อมมีข้อผิดพลาด: ' + err.message);
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> ยืนยันและส่งคำขอแจ้งซ่อมบำรุง'; }
        }
      });
    }
  }
}

// Auto bootstrap application shell
document.addEventListener('DOMContentLoaded', () => {
  MyBillsApp.init();
});
