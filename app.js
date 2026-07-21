// ==========================================================================
// SOMBAT APARTMENT (ENTERPRISE EDITION) - FULLY INTERACTIVE APP CONTROLLER
// 100% Compatible with Vercel, GitHub Pages, Local file:// & Google Sheets Sync
// Includes Official Front & Back Page Rental Contracts with Dotted Fill Engine
// ==========================================================================

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
    return '฿' + (amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  static thaiDate(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const yearBE = parseInt(parts[0], 10) + 543;
    return `${parts[2]}/${parts[1]}/${yearBE}`;
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
   3. SERVICES (AUTH, LOGGER, PROMPTPAY, LINE, EXPORT, DB)
   ========================================================================== */

class AuthService {
  static STORAGE_KEY = 'SOMBAT_APARTMENT_CURRENT_USER';

  static getCurrentUser() {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  static setCurrentUser(user) {
    if (user) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.STORAGE_KEY);
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
  static createBillingMessage(invoice, propertyName) {
    return `📢 [${propertyName}] ใบแจ้งหนี้ประจำเดือน ${invoice.monthKey}\n----------------------------------------\n🏠 ห้อง: ${invoice.roomName}\n👤 ผู้เช่า: ${invoice.tenantName}\n💵 ยอดบิลรวมสุทธิ: ฿${invoice.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}\n📅 กำหนดชำระภายใน: ${invoice.dueDate}\n\nกรุณาโอนชำระเงินตามยอดดังกล่าว แล้วส่งสลิปยืนยันทาง LINE นี้ ขอบคุณครับ/ค่ะ 🙏`;
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
}

class DBService {
  static STORAGE_KEY = 'SOMBAT_APARTMENT_DB_STATE_V2';

  static getInitialState() {
    return {
      settings: {
        apartmentName: 'หอพักสมบัติ นนทบุรี',
        address: '45/10 หมู่ที่ 8 ต.ราษฎร์นิยม อ.ไทรน้อย จ.นนทบุรี 11150',
        tel: '080-5991691',
        lineId: '@sombat_rent',
        bankName: 'ธนาคารกสิกรไทย (K-Bank)',
        bankAccountNo: '080-2-59916-1',
        bankAccountName: 'นายสมบัติ น้ำวน',
        promptPayId: '0805991691',
        googleSheetUrl: ''
      },
      rates: { electricityRate: 8.0, waterRate: 20.0, trashFee: 20.0, internetFee: 200.0, commonFee: 100.0 },
      rateHistory: [
        { id: 'rh_1', timestamp: '2026-01-01T00:00:00.000Z', changedBy: 'superadmin', newRates: { electricityRate: 8, waterRate: 20 } }
      ],
      users: [
        { id: 'usr_super', username: 'superadmin', displayName: 'ผู้ดูแลระบบสูงสุด (Super Admin)', role: 'super_admin', passwordHash: 'admin123' },
        { id: 'usr_admin', username: 'admin', displayName: 'เจ้าของหอพัก / แอดมิน', role: 'admin', passwordHash: 'admin' },
        { id: 'usr_staff', username: 'staff', displayName: 'พนักงานต้อนรับ (Staff)', role: 'staff', passwordHash: 'staff' }
      ],
      roomTypes: [
        { id: 'rt_fan', name: 'ห้องพัดลมมาตรฐาน', description: 'ห้องพัดลมกว้างขวาง ระเบียงส่วนตัว', defaultRent: 2500 },
        { id: 'rt_air', name: 'ห้องแอร์ปรับอากาศ', description: 'เครื่องปรับอากาศประหยัดไฟเบอร์ 5 พร้อมเฟอร์นิเจอร์', defaultRent: 3500 },
        { id: 'rt_shop', name: 'ห้องพาณิชย์ร้านค้า', description: 'ติดถนนหลัก เหมาะค้าขายหรือทำออฟฟิศ', defaultRent: 5500 }
      ],
      rooms: [
        { id: 'r101', name: 'A101', floor: 1, typeId: 'rt_air', baseRent: 3500, status: 'occupied', currentTenantId: 't1', currentTenantName: 'น.ส.กันญา บัวแดง', entryDate: '2025-05-01', lastWaterMeter: 140, lastElecMeter: 1250 },
        { id: 'r102', name: 'A102', floor: 1, typeId: 'rt_air', baseRent: 3500, status: 'overdue', currentTenantId: 't2', currentTenantName: 'นายสมชาย ดีมาก', entryDate: '2025-06-15', lastWaterMeter: 98, lastElecMeter: 840 },
        { id: 'r103', name: 'A103', floor: 1, typeId: 'rt_fan', baseRent: 2500, status: 'vacant', lastWaterMeter: 50, lastElecMeter: 400 },
        { id: 'r104', name: 'A104', floor: 1, typeId: 'rt_fan', baseRent: 2500, status: 'reserved', currentTenantName: 'นายวิชัย จงเจริญ (จองแล้ว)', entryDate: '2026-08-01', lastWaterMeter: 30, lastElecMeter: 210 },
        { id: 'r201', name: 'A201', floor: 2, typeId: 'rt_air', baseRent: 3500, status: 'occupied', currentTenantId: 't3', currentTenantName: 'นางวิไล พรหมดี', entryDate: '2024-03-10', lastWaterMeter: 210, lastElecMeter: 1980 },
        { id: 'r202', name: 'A202', floor: 2, typeId: 'rt_air', baseRent: 3500, status: 'vacant', lastWaterMeter: 85, lastElecMeter: 750 },
        { id: 'r203', name: 'A203', floor: 2, typeId: 'rt_fan', baseRent: 2500, status: 'occupied', currentTenantId: 't4', currentTenantName: 'นายณัฐพงษ์ ศรีสุข', entryDate: '2026-01-10', lastWaterMeter: 115, lastElecMeter: 920 },
        { id: 'r301', name: 'A301', floor: 3, typeId: 'rt_shop', baseRent: 5500, status: 'occupied', currentTenantId: 't5', currentTenantName: 'ร้านสมบัติมินิมาร์ท (คุณมณี)', entryDate: '2023-01-01', lastWaterMeter: 450, lastElecMeter: 4100 }
      ],
      tenants: [
        {
          id: 't1', name: 'น.ส.กันญา บัวแดง', idCard: '3451200115491', tel: '081-2345678', lineId: 'kanya_b', email: 'kanya@gmail.com', address: '12/4 หมู่ 3 ต.บางบัวทอง อ.บางบัวทอง จ.นนทบุรี',
          startDate: '2025-05-01', endDate: '2026-08-31', assignedRoomId: 'r101',
          deposit: { initialBail: 7000, deductions: [], status: 'active' },
          documents: [ { id: 'doc1', name: 'สำเนาบัตรประชาชน.pdf', fileType: 'pdf' } ]
        },
        {
          id: 't2', name: 'นายสมชาย ดีมาก', idCard: '1100200345678', tel: '089-8765432', lineId: 'somchai_d', address: '88/1 ถ.แจ้งวัฒนะ อ.ปากเกร็ด จ.นนทบุรี',
          startDate: '2025-06-15', endDate: '2026-06-14', assignedRoomId: 'r102',
          deposit: { initialBail: 7000, deductions: [], status: 'active' }, documents: []
        },
        {
          id: 't3', name: 'นางวิไล พรหมดี', idCard: '3100500890123', tel: '086-1122334', address: '45/10 ต.ราษฎร์นิยม อ.ไทรน้อย จ.นนทบุรี',
          startDate: '2024-03-10', endDate: '2026-07-31', assignedRoomId: 'r201',
          deposit: { initialBail: 7000, deductions: [], status: 'active' }, documents: []
        }
      ],
      invoices: [
        {
          id: 'inv_2026_07_r101', invoiceNumber: 'INV202607-101', monthKey: '2026-07', roomId: 'r101', roomName: 'A101',
          tenantId: 't1', tenantName: 'น.ส.กันญา บัวแดง', issueDate: '2026-07-01', dueDate: '2026-07-05',
          waterPrev: 130, waterCurr: 140, elecPrev: 1180, elecCurr: 1250, rentAmount: 3500, waterAmount: 200, elecAmount: 560,
          trashFee: 20, internetFee: 0, commonFee: 0, otherFee: 0, fineAmount: 0, totalAmount: 4280, paidAmount: 4280, outstandingAmount: 0, status: 'paid', paymentDate: '2026-07-03'
        },
        {
          id: 'inv_2026_07_r102', invoiceNumber: 'INV202607-102', monthKey: '2026-07', roomId: 'r102', roomName: 'A102',
          tenantId: 't2', tenantName: 'นายสมชาย ดีมาก', issueDate: '2026-07-01', dueDate: '2026-07-05',
          waterPrev: 85, waterCurr: 98, elecPrev: 750, elecCurr: 840, rentAmount: 3500, waterAmount: 260, elecAmount: 720,
          trashFee: 20, internetFee: 0, commonFee: 0, otherFee: 0, fineAmount: 100, totalAmount: 4600, paidAmount: 0, outstandingAmount: 4600, status: 'unpaid'
        }
      ],
      repairs: [
        { id: 'rep_1', ticketNumber: 'REP-2026-001', roomId: 'r101', roomName: 'A101', tenantName: 'น.ส.กันญา บัวแดง', title: 'เครื่องปรับอากาศน้ำหยด', description: 'แอร์มีน้ำหยดลงเตียงนอน', category: 'aircon', requestDate: '2026-07-10', status: 'completed', expenseAmount: 500, assignedTechnician: 'ช่างสมศักดิ์ แอร์เซอร์วิส' }
      ],
      ledger: [
        { id: 'led_1', date: '2026-07-03', type: 'income', category: 'rent_collected', description: 'รับชำระค่าเช่าห้อง A101', amount: 4280, recordedBy: 'admin' },
        { id: 'led_2', date: '2026-07-12', type: 'expense', category: 'maintenance', description: 'ค่าล้างแอร์ห้อง A101', amount: 500, recordedBy: 'admin' }
      ]
    };
  }

  static getState() {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      const initial = this.getInitialState();
      this.saveState(initial);
      return initial;
    }
    try { return JSON.parse(raw); } catch {
      const initial = this.getInitialState();
      this.saveState(initial);
      return initial;
    }
  }

  static saveState(state) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  }

  static async syncToGoogleSheets(url, state) {
    if (!url) throw new Error('กรุณาระบุ Google Sheets Web App URL ก่อน');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'sync', data: state })
    });
    return response.json();
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

  static importJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (data && data.settings && data.rooms && data.tenants) {
        this.saveState(data);
        return true;
      }
      return false;
    } catch { return false; }
  }
}

/* ==========================================================================
   4. UI COMPONENTS (NAVBAR, SIDEBAR, DASHBOARD, CONTRACTS, TENANTS, ETC.)
   ========================================================================== */

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
          <div class="notification-dropdown-wrapper">
            <button id="notification-bell-btn" class="icon-btn">
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
                  <div class="notification-item item-danger">
                    <i class="fa-solid fa-circle-exclamation icon"></i>
                    <div><strong>ผู้เช่าค้างชำระ: ${overdueCount} ห้อง</strong><p>มีห้องพักเกินกำหนดชำระเงิน กรุณาตรวจสอบในระบบออกบิล</p></div>
                  </div>
                ` : ''}
                ${expiringContracts > 0 ? `
                  <div class="notification-item item-warning">
                    <i class="fa-solid fa-file-contract icon"></i>
                    <div><strong>สัญญาใกล้หมดอายุ: ${expiringContracts} ราย</strong><p>มีผู้เช่าที่มีสัญญาเช่าหมดอายุภายใน 30 วันนี้</p></div>
                  </div>
                ` : ''}
                <div class="notification-item item-info">
                  <i class="fa-solid fa-door-open icon"></i>
                  <div><strong>ห้องว่างพร้อมเข้าอยู่: ${vacantCount} ห้อง</strong><p>สามารถลงทะเบียนผู้เช่าใหม่เข้าพักได้ทันที</p></div>
                </div>
              </div>
            </div>
          </div>

          <div class="user-profile-badge">
            <div class="avatar"><i class="fa-solid fa-user-shield"></i></div>
            <div class="user-info">
              <span class="name">${user.displayName}</span>
              <span class="role-pill role-${user.role}">
                ${user.role === 'super_admin' ? '👑 Super Admin' : user.role === 'admin' ? '🛡️ Admin' : '👤 Staff'}
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
      { id: 'dashboard', label: 'หน้าหลัก (Dashboard)', icon: 'fa-chart-pie', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'contracts', label: 'จัดการสัญญาเช่า', icon: 'fa-file-contract', roles: ['super_admin', 'admin'] },
      { id: 'tenants', label: 'ข้อมูลผู้เช่า', icon: 'fa-users', roles: ['super_admin', 'admin'] },
      { id: 'rooms', label: 'ข้อมูลห้องเช่า', icon: 'fa-building-user', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'billing', label: 'ระบบออกบิลค่าเช่า', icon: 'fa-file-invoice-dollar', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'repairs', label: 'ระบบแจ้งซ่อม', icon: 'fa-screwdriver-wrench', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'accounting', label: 'รายรับ - รายจ่าย', icon: 'fa-scale-balanced', roles: ['super_admin', 'admin'] },
      { id: 'calendar', label: 'ปฏิทินงาน', icon: 'fa-calendar-days', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'reports', label: 'ระบบรายงาน', icon: 'fa-chart-line', roles: ['super_admin', 'admin'] },
      { id: 'settings', label: 'ตั้งค่าเซิร์ฟเวอร์ & Google Sheets', icon: 'fa-gears', roles: ['super_admin', 'admin'] },
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
                  <i class="fa-solid ${item.icon} nav-icon"></i> <span>${item.label}</span>
                </a>
              </li>
            `).join('')}
          </ul>
        </nav>

        <div class="sidebar-footer">
          <p><i class="fa-solid fa-cloud"></i> บันทึกซิงค์ Google Sheets</p>
          <span class="version">v3.5 Enterprise Edition</span>
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
            <div class="kpi-content"><span class="label">ห้องที่มีผู้เช่า</span><h3 class="value">${occupiedRooms} <small>ห้อง</small></h3><span class="subtext">คิดเป็น ${((occupiedRooms/totalRooms)*100).toFixed(0)}% ของหอพัก</span></div>
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

        <div class="charts-grid-container" style="margin-top: 2rem;">
          <div class="glass-card chart-card">
            <div class="card-header"><h3><i class="fa-solid fa-chart-area text-primary"></i> แนวโน้มรายได้รายเดือน (Monthly Revenue)</h3></div>
            <div class="chart-wrapper">${this.renderLineChart(state)}</div>
          </div>
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
    const tenants = state.tenants;

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-users text-primary"></i> จัดการข้อมูลผู้เช่าและเอกสารสัญญา</h2>
            <p>บันทึกทะเบียนผู้เช่า อัปโหลดเอกสารแนบ (PDF/JPG/PNG/DOCX/ZIP) และพิมพ์สัญญาเช่าอัตโนมัติ</p>
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
                  <th>วันเริ่ม - สิ้นสุดสัญญา</th>
                  <th>เงินประกัน</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${tenants.map(t => {
                  const room = state.rooms.find(r => r.id === t.assignedRoomId);
                  const roomBadge = room ? `<span class="badge-pill badge-primary">ห้อง ${room.name}</span>` : `<span class="badge-pill badge-gray">ยังไม่ระบุ</span>`;
                  return `
                    <tr>
                      <td><strong>${t.name}</strong></td>
                      <td>${roomBadge}</td>
                      <td><code>${Formatters.formatIdCard(t.idCard)}</code></td>
                      <td>${t.tel} ${t.lineId ? `(${t.lineId})` : ''}</td>
                      <td>${Formatters.thaiDate(t.startDate)} ➔ <strong class="text-warning">${Formatters.thaiDate(t.endDate)}</strong></td>
                      <td><strong class="text-success">${Formatters.currency(t.deposit ? t.deposit.initialBail : 0)}</strong></td>
                      <td>
                        <div class="action-buttons">
                          <button class="btn btn-secondary btn-xs btn-gen-contract" data-id="${t.id}"><i class="fa-solid fa-file-contract text-warning"></i> สัญญา</button>
                          <button class="btn btn-secondary btn-xs btn-edit-tenant" data-id="${t.id}"><i class="fa-solid fa-pen text-info"></i></button>
                          <button class="btn btn-danger btn-xs btn-delete-tenant" data-id="${t.id}"><i class="fa-solid fa-trash"></i></button>
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
    const rooms = state.rooms;
    const roomTypes = state.roomTypes;

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-building-user text-primary"></i> ข้อมูลห้องพัก (Room Card Layout)</h2>
            <p>จัดการห้องพัก ปรับสถานะ 4 สี ย้ายผู้เช่า และกำหนดราคาเช่าแยกรายห้อง</p>
          </div>
          <div class="header-actions">
            <button id="btn-add-room" class="btn btn-primary"><i class="fa-solid fa-plus"></i> เพิ่มห้องพักใหม่</button>
          </div>
        </div>

        <div class="rooms-cards-grid" id="rooms-grid">
          ${rooms.map(room => {
            const type = roomTypes.find(t => t.id === room.typeId);
            const typeName = type ? type.name : 'มาตรฐาน';

            let statusClass = 'status-vacant'; let statusText = '⚪ ว่าง'; let statusBadgeClass = 'badge-gray';
            if (room.status === 'occupied') { statusClass = 'status-occupied'; statusText = '🟢 มีผู้เช่า'; statusBadgeClass = 'badge-success'; }
            else if (room.status === 'overdue') { statusClass = 'status-overdue'; statusText = '🔴 ค้างชำระ'; statusBadgeClass = 'badge-danger'; }
            else if (room.status === 'reserved') { statusClass = 'status-reserved'; statusText = '🟡 จองแล้ว'; statusBadgeClass = 'badge-warning'; }

            return `
              <div class="room-card ${statusClass}">
                <div class="room-card-header">
                  <div class="room-number">ห้อง ${room.name}</div>
                  <span class="badge-pill ${statusBadgeClass}">${statusText}</span>
                </div>
                <div class="room-card-body">
                  <div class="info-row"><span>ชั้น / ประเภท:</span><strong>ชั้น ${room.floor} (${typeName})</strong></div>
                  <div class="info-row"><span>ค่าเช่า:</span><strong class="text-primary">${Formatters.currency(room.baseRent)}</strong></div>
                  <div class="info-row"><span>ผู้เช่าปัจจุบัน:</span><strong>${room.currentTenantName || 'ไม่มีผู้เข้าเช่า'}</strong></div>
                </div>
                <div class="room-card-footer">
                  <button class="btn btn-secondary btn-xs btn-edit-room" data-id="${room.id}">แก้ไข</button>
                  <button class="btn btn-primary btn-xs btn-action-bill" data-id="${room.id}">ออกบิล</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
}

class BillingComponent {
  static render(state) {
    const invoices = state.invoices;

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-file-invoice-dollar text-primary"></i> ระบบออกบิลและบันทึกชำระเงินค่าเช่า</h2>
            <p>จดมิเตอร์น้ำไฟ คำนวณยอดอัตโนมัติ เจน PromptPay QR Code และสั่งพิมพ์ใบแจ้งหนี้/สลิปใบเสร็จ</p>
          </div>
          <div class="header-actions">
            <button id="btn-create-bill" class="btn btn-primary"><i class="fa-solid fa-calculator"></i> คำนวณออกบิลใหม่</button>
          </div>
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
                ${invoices.map(inv => `
                  <tr>
                    <td><strong>${inv.invoiceNumber}</strong><div class="text-muted text-sm">${Formatters.thaiMonthBE(inv.monthKey)}</div></td>
                    <td><span class="badge-pill badge-primary">ห้อง ${inv.roomName}</span></td>
                    <td><strong>${inv.tenantName}</strong></td>
                    <td><strong class="text-primary">${Formatters.currency(inv.totalAmount)}</strong></td>
                    <td><span class="badge-pill ${inv.status === 'paid' ? 'badge-success' : 'badge-danger'}">${inv.status === 'paid' ? 'ชำระแล้ว' : 'ค้างชำระ'}</span></td>
                    <td>
                      <div class="action-buttons">
                        <button class="btn btn-secondary btn-xs btn-qr-promptpay" data-id="${inv.id}">QR PromptPay</button>
                        <button class="btn btn-secondary btn-xs btn-print-bill" data-id="${inv.id}">พิมพ์</button>
                        <button class="btn btn-secondary btn-xs btn-send-line" data-id="${inv.id}"><i class="fa-brands fa-line text-success"></i> LINE</button>
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

class RepairsComponent {
  static render(state) {
    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div><h2><i class="fa-solid fa-screwdriver-wrench text-primary"></i> ระบบแจ้งซ่อมและซ่อมบำรุงห้องพัก</h2><p>ติดตามคำขอแจ้งซ่อมจากผู้เช่า แนบรูปถ่าย และบันทึกค่าใช้จ่ายงานซ่อมบำรุง</p></div>
        </div>
        <div class="glass-card style-table-card">
          <div class="table-responsive">
            <table class="custom-table">
              <thead><tr><th>เลขที่ใบซ่อม</th><th>ห้องพัก</th><th>หัวข้อแจ้งซ่อม</th><th>ค่าซ่อม</th><th>สถานะ</th></tr></thead>
              <tbody>
                ${state.repairs.map(rep => `
                  <tr>
                    <td><strong>${rep.ticketNumber}</strong></td>
                    <td>ห้อง ${rep.roomName}</td>
                    <td>${rep.title}</td>
                    <td>${Formatters.currency(rep.expenseAmount)}</td>
                    <td><span class="badge-pill badge-success">${rep.status}</span></td>
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
    let totalIncome = 0; let totalExpense = 0;
    state.ledger.forEach(entry => {
      if (entry.type === 'income') totalIncome += entry.amount;
      else totalExpense += entry.amount;
    });

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div><h2><i class="fa-solid fa-scale-balanced text-primary"></i> ระบบบัญชี รายรับ - รายจ่าย (Accounting Ledger)</h2><p>บันทึกรายรับค่าน้ำไฟค่าเช่า และรายจ่ายแม่บ้าน ค่าซ่อมบำรุง ค่าน้ำไฟหลวง</p></div>
        </div>
        <div class="kpi-cards-grid">
          <div class="kpi-card card-green"><div class="kpi-content"><span class="label">รายรับรวม</span><h3 class="value text-success">${Formatters.currency(totalIncome)}</h3></div></div>
          <div class="kpi-card card-red"><div class="kpi-content"><span class="label">รายจ่ายรวม</span><h3 class="value text-danger">${Formatters.currency(totalExpense)}</h3></div></div>
          <div class="kpi-card card-blue"><div class="kpi-content"><span class="label">กำไรสุทธิ</span><h3 class="value text-primary">${Formatters.currency(totalIncome - totalExpense)}</h3></div></div>
        </div>
      </div>
    `;
  }
}

class CalendarComponent {
  static render(state) {
    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div><h2><i class="fa-solid fa-calendar-days text-primary"></i> ปฏิทินงานและวันนัดหมาย (Event Calendar)</h2><p>รวมกำหนดการวันชำระค่าเช่า วันหมดอายุสัญญาเช่า และวันนัดซ่อมบำรุง</p></div>
        </div>
        <div class="glass-card"><p class="text-center text-muted" style="padding:2rem;">ปฏิทินงานกำหนดการนัดหมายพร้อมใช้งาน</p></div>
      </div>
    `;
  }
}

class ReportsComponent {
  static render(state) {
    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div><h2><i class="fa-solid fa-chart-line text-primary"></i> ระบบสรุปรายงานและการส่งออกข้อมูล</h2><p>สรุปผลการดำเนินงาน รายรับ ยอดค้างชำระ และส่งออกไฟล์ PDF / Excel 1-Click</p></div>
        </div>
        <div class="reports-grid-container">
          <div class="glass-card report-card">
            <h3>1. รายงานรายรับประจำเดือน</h3>
            <button class="btn btn-secondary btn-sm btn-export-csv"><i class="fa-solid fa-file-excel text-success"></i> Export CSV/Excel</button>
          </div>
        </div>
      </div>
    `;
  }
}

class SettingsComponent {
  static render(state) {
    const settings = state.settings;

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div><h2><i class="fa-solid fa-gears text-primary"></i> ตั้งค่าเซิร์ฟเวอร์ & เชื่อมต่อ Google Sheets</h2><p>จัดการผู้ใช้งานระบบ (3 บทบาท), บันทึกข้อมูลซิงค์คลาวด์ Google Sheets และ Activity Logs</p></div>
        </div>
        <div class="glass-card" style="margin-bottom:1.5rem;">
          <h3><i class="fa-solid fa-cloud text-primary"></i> ซิงค์ข้อมูลลง Google Sheets</h3>
          <div class="form-group" style="margin-top:1rem;">
            <label>Google Apps Script Web App URL:</label>
            <input type="url" id="sheets-url-input" class="form-control" value="${settings.googleSheetUrl || ''}" placeholder="https://script.google.com/macros/s/.../exec">
          </div>
          <div style="display:flex; gap:0.5rem; margin-top:1rem;">
            <button class="btn btn-primary" id="btn-save-sheets-url"><i class="fa-solid fa-save"></i> บันทึก URL</button>
            <button class="btn btn-success" id="btn-sync-to-sheets"><i class="fa-solid fa-cloud-arrow-up"></i> บันทึกข้อมูลลง Google Sheets ตอนนี้</button>
          </div>
        </div>
        <div class="glass-card">
          <h3><i class="fa-solid fa-download text-success"></i> สำรอง & กู้คืนข้อมูล (Backup JSON)</h3>
          <button id="btn-backup-export" class="btn btn-success" style="margin-top:1rem;"><i class="fa-solid fa-file-export"></i> ดาวน์โหลดไฟล์สำรองข้อมูล JSON</button>
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

  static init() {
    let currentUser = AuthService.getCurrentUser();
    if (!currentUser) {
      const initialState = DBService.getState();
      currentUser = initialState.users[0];
      AuthService.setCurrentUser(currentUser);
      LoggerService.log(currentUser.username, currentUser.role, 'LOGIN', 'AUTH', 'เข้าสู่ระบบสำเร็จ');
    }

    this.state = DBService.getState();
    this.renderShell();
    this.setupGlobalEvents();
    this.switchTab(this.activeTab);
  }

  static renderShell() {
    const user = AuthService.getCurrentUser();
    const sidebarContainer = document.getElementById('sidebar-container');
    const navbarContainer = document.getElementById('navbar-container');

    if (sidebarContainer) {
      sidebarContainer.innerHTML = SidebarComponent.render(this.activeTab, this.state.settings.apartmentName);
    }
    if (navbarContainer && user) {
      navbarContainer.innerHTML = NavbarComponent.render(user, this.state);
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
      case 'rooms': workspace.innerHTML = RoomsComponent.render(this.state); break;
      case 'billing': workspace.innerHTML = BillingComponent.render(this.state); this.bindBillingEvents(); break;
      case 'repairs': workspace.innerHTML = RepairsComponent.render(this.state); break;
      case 'accounting': workspace.innerHTML = AccountingComponent.render(this.state); break;
      case 'calendar': workspace.innerHTML = CalendarComponent.render(this.state); break;
      case 'reports': workspace.innerHTML = ReportsComponent.render(this.state); this.bindReportsEvents(); break;
      case 'settings': workspace.innerHTML = SettingsComponent.render(this.state); this.bindSettingsEvents(); break;
      default: workspace.innerHTML = DashboardComponent.render(this.state);
    }
  }

  static setupGlobalEvents() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-tab]');
      if (link) {
        e.preventDefault();
        const tabId = link.getAttribute('data-tab');
        if (tabId) this.switchTab(tabId);
      }
    });

    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        const rows = document.querySelectorAll('.custom-table tbody tr, .room-card');
        rows.forEach((row) => {
          row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
        });
      });
    }

    const bellBtn = document.getElementById('notification-bell-btn');
    if (bellBtn) {
      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('notification-menu');
        if (menu) menu.classList.toggle('active');
      });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        AuthService.setCurrentUser(null);
        location.reload();
      });
    }
  }

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

    // Interactive Contract Viewer with Dotted Line Autofill (Front & Back Pages)
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

  static openOfficialContractModal(tenant) {
    const room = this.state.rooms.find(r => r.id === tenant.assignedRoomId);

    // Initial values
    const today = new Date();
    const d = {
      day: today.getDate().toString(),
      month: Formatters.thaiMonthBE(today.toISOString().slice(0, 7)).split(' ')[0],
      year: (today.getFullYear() + 543).toString(),
      landlordAge: '๕๕',
      tenantName: tenant.name,
      tenantAddress: tenant.address || '12/4 หมู่ 3 ต.บางบัวทอง อ.บางบัวทอง จ.นนทบุรี',
      tenantIdCard: Formatters.formatIdCard(tenant.idCard),
      tenantIdIssueDate: Formatters.thaiDate(tenant.startDate),
      roomName: room ? room.name : 'A101',
      startDateDay: tenant.startDate ? tenant.startDate.split('-')[2] : '1',
      startDateMonth: tenant.startDate ? Formatters.thaiMonthBE(tenant.startDate.slice(0, 7)).split(' ')[0] : 'พฤษภาคม',
      startDateYear: tenant.startDate ? (parseInt(tenant.startDate.split('-')[0], 10) + 543).toString() : '2568',
      monthlyRentAmt: room ? room.baseRent.toLocaleString() : '3,500',
      monthlyRentThai: Formatters.thaiBahtText(room ? room.baseRent : 3500),
      depositAmt: tenant.deposit ? tenant.deposit.initialBail.toLocaleString() : '7,000',
      depositThai: Formatters.thaiBahtText(tenant.deposit ? tenant.deposit.initialBail : 7000),
      witness1: 'นางสมศรี ใจดี',
      witness2: 'นายวิเชียร สมบัติ'
    };

    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-file-contract text-warning"></i> สัญญาเช่าห้องพักทางการ (หอพักสมบัติ.คอม)</h3>
        <button class="close-modal-btn">&times;</button>
      </div>

      <!-- Tab Switcher for Front & Back Document Pages -->
      <div class="contract-tab-switcher" style="padding-top: 1rem;">
        <button class="contract-tab-btn active" id="tab-front-doc"><i class="fa-solid fa-file-lines"></i> ด้านหน้า (หนังสือสัญญา)</button>
        <button class="contract-tab-btn" id="tab-back-doc"><i class="fa-solid fa-list-ol"></i> ด้านหลัง (กฎและมารยาท 13 ข้อ)</button>
      </div>

      <div class="modal-body" style="padding-top: 0.5rem;">
        <!-- Front Page Document Shell -->
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
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;โดยหนังสือฉบับนี้ ข้าพเจ้า <strong>นายสมบัติ น้ำวน</strong> อายุ <span class="dotted-fill">${d.landlordAge}</span> ปี อยู่บ้านเลขที่ ๔๕/๑๐ หมู่ที่ ๘ ตำบลราษฎร์นิยม อำเภอไทรน้อย จังหวัดนนทบุรี ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>“ผู้ให้เช่า”</strong> ฝ่ายหนึ่งกับข้าพเจ้า <span class="dotted-fill">${d.tenantName}</span><br>
            อยู่บ้านเลขที่ <span class="dotted-fill">${d.tenantAddress}</span><br>
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

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem; margin-top:2.5rem; text-align:center;">
            <div>ลงชื่อ....................................................ผู้เช่า<br>(<span class="dotted-fill">${d.tenantName}</span>)</div>
            <div>ลงชื่อ....................................................ผู้ให้เช่า<br>( นายสมบัติ น้ำวน )</div>
            <div style="margin-top:1.5rem;">ลงชื่อ....................................................พยาน<br>(<span class="dotted-fill">${d.witness1}</span>)</div>
            <div style="margin-top:1.5rem;">ลงชื่อ....................................................พยาน<br>(<span class="dotted-fill">${d.witness2}</span>)</div>
          </div>
        </div>

        <!-- Back Page Rules Shell (Hidden by default) -->
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
      viewBack.style.display = 'block'; viewFront.style.display = 'none';
    });

    document.getElementById('btn-do-print-official-contract').addEventListener('click', () => {
      // Print both front and back views
      viewFront.style.display = 'block';
      viewBack.style.display = 'block';
      window.print();
    });
  }

  static bindTenantsEvents() {
    const exportExcel = document.getElementById('btn-export-tenants-excel');
    if (exportExcel) {
      exportExcel.addEventListener('click', () => {
        const headers = ['ชื่อ-นามสกุล', 'เลขบัตรประชาชน', 'เบอร์โทร', 'วันเริ่มสัญญา', 'วันหมดสัญญา'];
        const rows = this.state.tenants.map(t => [t.name, t.idCard, t.tel, t.startDate, t.endDate]);
        ExportService.exportToCSV('ทะเบียนผู้เช่า_Sombat.csv', headers, rows);
      });
    }

    document.querySelectorAll('.btn-gen-contract').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const tenant = this.state.tenants.find(t => t.id === id);
        if (tenant) this.openOfficialContractModal(tenant);
      });
    });
  }

  static bindBillingEvents() {
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
      btn.addEventListener('click', () => window.print());
    });

    document.querySelectorAll('.btn-send-line').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const inv = this.state.invoices.find(i => i.id === id);
        if (inv) {
          alert(`📲 จำลองการส่งข้อความ LINE:\n\n${LineService.createBillingMessage(inv, this.state.settings.apartmentName)}`);
        }
      });
    });
  }

  static bindReportsEvents() {
    document.querySelectorAll('.btn-export-csv').forEach(btn => {
      btn.addEventListener('click', () => {
        const headers = ['เลขที่บิล', 'ห้อง', 'ผู้เช่า', 'ยอดรวม'];
        const rows = this.state.invoices.map(i => [i.invoiceNumber, i.roomName, i.tenantName, i.totalAmount]);
        ExportService.exportToCSV('รายงานรายรับ_Sombat.csv', headers, rows);
      });
    });
  }

  static bindSettingsEvents() {
    const backupBtn = document.getElementById('btn-backup-export');
    if (backupBtn) {
      backupBtn.addEventListener('click', () => DBService.exportJSON());
    }

    const saveUrlBtn = document.getElementById('btn-save-sheets-url');
    if (saveUrlBtn) {
      saveUrlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const urlInput = document.getElementById('sheets-url-input');
        if (urlInput) {
          this.state.settings.googleSheetUrl = urlInput.value;
          DBService.saveState(this.state);
          alert('บันทึก Google Sheets Web App URL เรียบร้อยแล้ว!');
        }
      });
    }

    const syncSheetsBtn = document.getElementById('btn-sync-to-sheets');
    if (syncSheetsBtn) {
      syncSheetsBtn.addEventListener('click', async () => {
        const url = this.state.settings.googleSheetUrl;
        if (!url) {
          alert('กรุณาใส่ Google Sheets Web App URL ในช่องก่อนกดบันทึกซิงค์ข้อมูล');
          return;
        }
        syncSheetsBtn.disabled = true;
        syncSheetsBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่งข้อมูลลง Google Sheets...';
        try {
          await DBService.syncToGoogleSheets(url, this.state);
          alert('✅ บันทึกข้อมูลลง Google Sheets สำเร็จเรียบร้อยแล้ว!');
        } catch (err) {
          alert('⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheets: ' + err.message);
        } finally {
          syncSheetsBtn.disabled = false;
          syncSheetsBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> บันทึกข้อมูลลง Google Sheets ตอนนี้';
        }
      });
    }
  }
}

// Global Launcher
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
