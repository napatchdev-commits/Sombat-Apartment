export class DBService {
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
        googleSheetUrl: ''
      },
      rates: { electricityRate: 8.0, waterRate: 20.0, trashFee: 20.0, internetFee: 200.0, commonFee: 100.0 },
      users: [
        { id: 'usr_super', username: 'superadmin', displayName: 'สมบัติ น้ำวน', role: 'super_admin', passwordHash: 'admin' },
        { id: 'usr_admin', username: 'admin', displayName: 'เจ้าของหอพัก / แอดมิน', role: 'admin', passwordHash: 'admin' },
        { id: 'usr_staff', username: 'staff', displayName: 'พนักงานต้อนรับ (Staff)', role: 'staff', passwordHash: 'staff' }
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

  static getSavedSheetUrl() {
    const rawState = localStorage.getItem(this.STORAGE_KEY);
    let fromState = '';
    if (rawState) {
      try {
        const parsed = JSON.parse(rawState);
        if (parsed.settings && parsed.settings.googleSheetUrl) {
          fromState = parsed.settings.googleSheetUrl;
        }
      } catch (e) {}
    }
    if (fromState) return fromState;
    const fromStorage = localStorage.getItem('SOMBAT_APARTMENT_SAVED_SHEET_URL');
    if (fromStorage) return fromStorage;
    const urlParams = new URLSearchParams(window.location.search);
    const fromParam = urlParams.get('sheetUrl');
    if (fromParam) {
      localStorage.setItem('SOMBAT_APARTMENT_SAVED_SHEET_URL', fromParam);
      return fromParam;
    }
    return '';
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
    if (!state.rooms || !Array.isArray(state.rooms) || state.rooms.length === 0) {
      state.rooms = this.getInitialRooms();
    }
    if (state.invoices && Array.isArray(state.invoices)) {
      state.invoices = this.getUniqueInvoices(state.invoices);
    }
    // Ensure googleSheetUrl is populated from persistent fallback
    const savedUrl = this.getSavedSheetUrl();
    if (savedUrl && (!state.settings || !state.settings.googleSheetUrl)) {
      if (!state.settings) state.settings = {};
      state.settings.googleSheetUrl = savedUrl;
    }
    return state;
  }

  static saveState(state) {
    if (state.settings && state.settings.googleSheetUrl) {
      localStorage.setItem('SOMBAT_APARTMENT_SAVED_SHEET_URL', state.settings.googleSheetUrl);
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    // Background Real-time Auto Sync to Google Sheets if URL is set
    const url = (state.settings && state.settings.googleSheetUrl) ? state.settings.googleSheetUrl : this.getSavedSheetUrl();
    if (url) {
      this.syncToGoogleSheets(url, state).catch(() => {});
    }
  }

  static async pullFromGoogleSheets(url) {
    if (!url) return null;
    const fetchUrl = url.includes('?') ? `${url}&action=get` : `${url}?action=get`;
    const res = await fetch(fetchUrl);
    const data = await res.json();
    if (data && typeof data === 'object' && (data.tenants || data.rooms)) {
      if (!data.settings) data.settings = {};
      data.settings.googleSheetUrl = url;
      localStorage.setItem('SOMBAT_APARTMENT_SAVED_SHEET_URL', url);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      return data;
    }
    return null;
  }

  static async syncToGoogleSheets(url, state) {
    if (!url) throw new Error('กรุณาระบุ Google Sheets Web App URL ก่อน');
    localStorage.setItem('SOMBAT_APARTMENT_SAVED_SHEET_URL', url);
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
}

/* ==========================================================================
   4. UI COMPONENTS (ALL 10 MODULES FULLY INTERACTIVE)
   ========================================================================== */

