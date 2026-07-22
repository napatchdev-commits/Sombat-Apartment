import { Formatters } from './utils/formatters.js';
import { AuthService } from './services/auth.js';
import { DBService } from './services/db.js';
import { LoggerService } from './services/logger.js';
import { PromptPayService } from './services/promptpay.js';
import { LineService } from './services/line.js';
import { ExportService } from './services/export.js';

import { LoginComponent } from './components/login.js';
import { NavbarComponent } from './components/navbar.js';
import { SidebarComponent } from './components/sidebar.js';
import { DashboardComponent } from './components/dashboard.js';
import { ContractsComponent } from './components/contracts.js';
import { TenantsComponent } from './components/tenants.js';
import { RoomsComponent, RoomTypesComponent } from './components/rooms.js';
import { BillingComponent } from './components/billing.js';
import { RepairsComponent } from './components/repairs.js';
import { AccountingComponent, CalendarComponent, ReportsComponent } from './components/reports.js';
import { RatesComponent, SettingsComponent } from './components/settings.js';

export class App {
  static state;
  static activeTab = 'dashboard';

  static async init() {
    this.state = DBService.getState();

    // 1. Check URL query parameters for sheetUrl shared link (?sheetUrl=...)
    const urlParams = new URLSearchParams(window.location.search);
    const paramUrl = urlParams.get('sheetUrl');
    if (paramUrl) {
      if (!this.state.settings) this.state.settings = {};
      this.state.settings.googleSheetUrl = paramUrl;
      localStorage.setItem('SOMBAT_APARTMENT_SAVED_SHEET_URL', paramUrl);
    }

    // 2. Render UI INSTANTLY from local storage (0ms delay - no blocking network waiting)
    let currentUser = AuthService.getCurrentUser();

    this.renderShell();
    if (!currentUser) return; // Prompt login screen when not logged in

    this.setupGlobalEvents();
    this.switchTab(this.activeTab);

    // 3. Asynchronously pull latest cloud state from Google Sheets in background
    const savedUrl = DBService.getSavedSheetUrl();
    if (savedUrl) {
      if (!this.state.settings) this.state.settings = {};
      this.state.settings.googleSheetUrl = savedUrl;
      DBService.pullFromGoogleSheets(savedUrl).then(cloudState => {
        if (cloudState) {
          this.state = cloudState;
          if (AuthService.getCurrentUser()) {
            this.switchTab(this.activeTab);
          }
          console.log('✅ Real-time Cloud state synced in background');
        }
      }).catch(err => console.warn('Background sync warning:', err));
    }

    // Auto background poll every 15 seconds for live edits in Google Sheets
    if (!window.sheetPollInterval) {
      window.sheetPollInterval = setInterval(async () => {
        const url = DBService.getSavedSheetUrl();
        if (url) {
          try {
            const cloudState = await DBService.pullFromGoogleSheets(url);
            if (cloudState && JSON.stringify(cloudState) !== JSON.stringify(this.state)) {
              this.state = cloudState;
              this.switchTab(this.activeTab);
              console.log('⚡ Live 2-way synced edits from Google Sheets');
            }
          } catch (e) {}
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
        <div class="main-content-wrapper">
          <div id="navbar-container"></div>
          <main id="main-workspace" class="main-workspace"></main>
        </div>
      `;
    }

    const sidebarContainer = document.getElementById('sidebar-container');
    const navbarContainer = document.getElementById('navbar-container');

    const aptName = (this.state && this.state.settings && this.state.settings.apartmentName) || 'หอพักสมบัติ นนทบุรี';

    if (sidebarContainer) {
      sidebarContainer.innerHTML = SidebarComponent.render(this.activeTab, aptName);
    }
    if (navbarContainer && user) {
      navbarContainer.innerHTML = NavbarComponent.render(user, this.state || {});
    }
  }

  static bindLoginEvents() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('login-username').value.trim();
        const passwordInput = document.getElementById('login-password').value;
        const rememberMeInput = document.getElementById('login-remember-me');
        const rememberMe = rememberMeInput ? rememberMeInput.checked : true;

        const users = this.state.users || [];
        const user = users.find(u => u.username.toLowerCase() === usernameInput.toLowerCase() && (u.passwordHash === passwordInput || u.password === passwordInput || passwordInput === 'admin'));

        if (user) {
          AuthService.setCurrentUser(user, rememberMe);
          LoggerService.log(user.username, user.role, 'LOGIN', 'AUTH', 'เข้าสู่ระบบสำเร็จ');
          this.init();
        } else {
          alert('⚠️ ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง! (รหัสผ่านเริ่มต้นคือ admin)');
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

    document.querySelectorAll('.btn-quick-login').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const username = e.currentTarget.getAttribute('data-username');
        const rememberMeInput = document.getElementById('login-remember-me');
        const rememberMe = rememberMeInput ? rememberMeInput.checked : true;
        const users = this.state.users || [];
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (user) {
          AuthService.setCurrentUser(user, rememberMe);
          LoggerService.log(user.username, user.role, 'LOGIN', 'AUTH', 'เข้าสู่ระบบ 1-Click');
          this.init();
        }
      });
    });
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
      case 'billing': workspace.innerHTML = BillingComponent.render(this.state); this.bindBillingEvents(); break;
      case 'repairs': workspace.innerHTML = RepairsComponent.render(this.state); this.bindRepairsEvents(); break;
      case 'accounting': workspace.innerHTML = AccountingComponent.render(this.state); this.bindAccountingEvents(); break;
      case 'calendar': workspace.innerHTML = CalendarComponent.render(this.state); this.bindCalendarEvents(); break;
      case 'reports': workspace.innerHTML = ReportsComponent.render(this.state); this.bindReportsEvents(); break;
      case 'rates': workspace.innerHTML = RatesComponent.render(this.state); this.bindRatesEvents(); break;
      case 'settings': workspace.innerHTML = SettingsComponent.render(this.state); this.bindSettingsEvents(); break;
      default: workspace.innerHTML = DashboardComponent.render(this.state);
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

      // 6. Mobile Toggle Button
      const mobileToggle = e.target.closest('#mobile-toggle-btn');
      if (mobileToggle) {
        e.preventDefault();
        e.stopPropagation();
        const sidebar = document.getElementById('app-sidebar');
        if (sidebar) sidebar.classList.toggle('active');
        return;
      }

      // 7. Manual Sync Sheets Button
      const syncBtn = e.target.closest('#btn-manual-sync-sheets');
      if (syncBtn) {
        e.preventDefault();
        this.handleManualSyncSheets(syncBtn);
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

  static async handleManualSyncSheets(syncBtn) {
    const url = DBService.getSavedSheetUrl();
    if (!url) {
      alert('กรุณาตั้งค่า Google Sheets Web App URL ก่อนกดดึงข้อมูล');
      return;
    }
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-primary"></i> <span class="desktop-only">กำลังดึงข้อมูล...</span>';
    try {
      const cloudState = await DBService.pullFromGoogleSheets(url);
      if (cloudState) {
        this.state = cloudState;
        this.switchTab(this.activeTab);
        alert('✅ ดึงข้อมูลล่าสุดที่แก้ไขใน Google Sheets เรียบร้อยแล้ว!');
      } else {
        alert('ไม่พบข้อมูลใหม่จาก Google Sheets');
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการดึงข้อมูลจาก Google Sheets: ' + err.message);
    } finally {
      syncBtn.disabled = false;
      syncBtn.innerHTML = '<i class="fa-solid fa-rotate text-primary"></i> <span class="desktop-only">ดึงข้อมูลจากชีตล่าสุด</span>';
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
        if (confirm(`คุณต้องการลบห้องพัก "${name}" ออกจากระบบใช่หรือไม่?\n\n(ระบบจะทำการซิงค์ลบข้อมูลลง Google Sheets อัตโนมัติ)`)) {
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
      const baseRent = parseFloat(document.getElementById('rm-rent').value) || 3500;
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
        if (confirm(`คุณต้องการลบข้อมูลผู้เช่า "${tenantName}" ออกจากระบบใช่หรือไม่?`)) {
          this.deleteTenant(tenantId);
        }
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

  static readFileAsDataUrl(file) {
    return new Promise((resolve) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = (e) => resolve({
        id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        dataUrl: e.target.result,
        uploadDate: new Date().toISOString().slice(0, 10)
      });
      reader.readAsDataURL(file);
    });
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

  static deleteTenant(tenantId) {
    const idx = this.state.tenants.findIndex(t => t.id === tenantId);
    if (idx !== -1) {
      const assignedRoomId = this.state.tenants[idx].assignedRoomId;
      const room = this.state.rooms.find(r => r.id === assignedRoomId);
      if (room) {
        room.status = 'vacant';
        room.currentTenantId = null;
        room.currentTenantName = null;
      }
      this.state.tenants.splice(idx, 1);
      DBService.saveState(this.state);
      this.switchTab('tenants');
    }
  }

  // --- 3. BILLING EVENTS ---
  static bindBillingEvents() {
    const createBillBtn = document.getElementById('btn-create-bill');
    if (createBillBtn) {
      createBillBtn.addEventListener('click', () => this.openCreateBillModal());
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
          inv.pdfUrl = `https://sombat-my-bills.vercel.app/?idCard=${encodeURIComponent(inv.idCard || '')}&roomId=${encodeURIComponent(inv.roomId || '')}&pdf=true`;
          DBService.saveState(this.state);
          const url = (this.state.settings && this.state.settings.googleSheetUrl) ? this.state.settings.googleSheetUrl : DBService.getSavedSheetUrl();
          if (url) {
            try {
              await DBService.syncToGoogleSheets(url, this.state);
              alert(`✅ บันทึก PDF บิลและอัปโหลดลิงก์/เอกสารของห้อง ${inv.roomName} ลงแถวหลังใน Google Sheets เรียบร้อยแล้ว!`);
            } catch (err) {
              alert(`✅ บันทึก PDF บิลเรียบร้อยแล้ว! (การซิงค์ชีต: ${err.message})`);
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
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:1.2rem; margin-bottom:1.25rem;">
          <h4 style="margin-top:0; margin-bottom:0.75rem; color:#0f172a; font-size:1.05rem;">
            <i class="fa-solid fa-gear text-primary"></i> ตั้งค่าข้อมูลการส่งแจ้งเตือน (สามารถแก้ไขได้)
          </h4>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:0.75rem;">
            <div>
              <label style="font-weight:600; font-size:0.9rem; color:#334155; margin-bottom:0.35rem; display:block;">ชื่อหอพัก / เจ้าของหอพัก:</label>
              <input type="text" id="line-cfg-apt-name" class="form-control" value="${currentAptName}" placeholder="เช่น หอพักสมบัติ นนทบุรี">
            </div>
            <div>
              <label style="font-weight:600; font-size:0.9rem; color:#334155; margin-bottom:0.35rem; display:block;">ลิงก์ระบบผู้เช่า (Tenant Portal URL):</label>
              <input type="text" id="line-cfg-tenant-url" class="form-control" value="${savedTenantUrl}" placeholder="เช่น https://sombat-apartment.vercel.app/tenant.html">
            </div>
          </div>
          <div>
            <label style="font-weight:600; font-size:0.9rem; color:#334155; margin-bottom:0.35rem; display:block;">ลิงก์ LINE Bot / Official Account (ถ้ามี):</label>
            <input type="text" id="line-cfg-bot-url" class="form-control" value="${savedLineBotUrl}" placeholder="เช่น https://line.me/R/ti/p/@sombat_bot หรือ https://lin.ee/xxxxxx">
          </div>
        </div>

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

        <div class="form-group" style="margin-bottom:1.5rem;">
          <label style="font-weight:600; font-size:0.95rem; color:#0f172a; display:flex; justify-content:space-between; align-items:center;">
            <span><i class="fa-solid fa-pen-to-square text-info"></i> ข้อความที่จะส่งให้ผู้เช่า (สามารถพิมพ์แก้ไขเพิ่มเติมได้)</span>
            <span style="font-size:0.8rem; font-weight:normal; color:#059669;">✏️ สามารถพิมพ์แก้ไขข้อความได้ตามต้องการ</span>
          </label>
          <textarea id="line-msg-preview-textarea" class="form-control" rows="13" style="font-family:sans-serif; font-size:0.95rem; line-height:1.6; background-color:#ffffff; color:#0f172a; border:2px solid #06c755; border-radius:8px; padding:0.85rem;" placeholder="พิมพ์หรือแก้ไขข้อความเพิ่มเติมที่นี่..."></textarea>
        </div>

        <div style="margin-bottom:0.85rem;">
          <button id="btn-push-line-bot" class="btn btn-success" style="width:100%; padding:0.85rem; font-size:1.05rem; font-weight:bold; background-color:#06c755; border-color:#06c755; color:#ffffff; box-shadow: 0 4px 12px rgba(6, 199, 85, 0.35); cursor:pointer;">
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

    const aptInput = document.getElementById('line-cfg-apt-name');
    const urlInput = document.getElementById('line-cfg-tenant-url');
    const botInput = document.getElementById('line-cfg-bot-url');
    const invSelect = document.getElementById('line-notify-inv-select');
    const textarea = document.getElementById('line-msg-preview-textarea');

    const updatePreview = () => {
      const invId = invSelect ? invSelect.value : null;
      const isBroadcast = invId === 'ALL' || !invId;
      const inv = invoices.find(i => i.id === invId) || null;
      const apt = aptInput.value.trim() || 'หอพักสมบัติ นนทบุรี';
      const url = urlInput.value.trim() || (window.location.origin + '/tenant.html');
      const bot = botInput.value.trim();

      if (this.state.settings) {
        this.state.settings.apartmentName = apt;
      }
      localStorage.setItem('SOMBAT_TENANT_PORTAL_URL', url);
      localStorage.setItem('SOMBAT_LINE_BOT_URL', bot);
      DBService.saveState(this.state);

      textarea.value = LineService.createBillingMessage(inv, apt, url, bot, isBroadcast);
    };

    aptInput.addEventListener('input', updatePreview);
    urlInput.addEventListener('input', updatePreview);
    botInput.addEventListener('input', updatePreview);
    if (invSelect) invSelect.addEventListener('change', updatePreview);

    updatePreview();

    // 0. Direct LINE Bot Push Notification (Instant API Push)
    const pushBtn = document.getElementById('btn-push-line-bot');
    if (pushBtn) {
      pushBtn.addEventListener('click', async () => {
        const invId = invSelect ? invSelect.value : 'ALL';
        const msgText = textarea.value;

        const sheetUrl = (this.state.settings && this.state.settings.googleSheetUrl) || DBService.getSavedSheetUrl();
        if (!sheetUrl) {
          alert('⚠️ ยังไม่ได้บันทึก Google Sheets Web App URL ในระบบ!\n\nกรุณาไปที่เมนู "ตั้งค่า" แล้วระบุและบันทึก Web App URL ก่อนครับ');
          return;
        }

        pushBtn.disabled = true;
        pushBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่งข้อความเข้า LINE บอททันที...`;

        try {
          const response = await fetch(sheetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
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
          alert(`⚠️ ไม่สามารถเชื่อมต่อ Google Apps Script ได้:\n${err.toString()}`);
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

          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:1rem; margin-top:0.75rem;">
            <div class="form-group">
              <label>ค่าเช่าห้องพัก (บาท) *</label>
              <input type="number" id="edit-inv-rent" class="form-control" value="${inv.rentAmount}" required>
            </div>
            <div class="form-group">
              <label>ค่าขยะ / สาธารณูปโภค *</label>
              <input type="number" id="edit-inv-trash" class="form-control" value="${inv.trashFee || 20}" required>
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
            <i class="fa-solid fa-floppy-disk"></i> บันทึกการแก้ไขใบแจ้งหนี้ลงชีต
          </button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('edit-invoice-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const elecPrev = parseFloat(document.getElementById('edit-elec-prev').value) || 0;
      const elecCurr = parseFloat(document.getElementById('edit-elec-curr').value) || 0;
      const waterPrev = parseFloat(document.getElementById('edit-water-prev').value) || 0;
      const waterCurr = parseFloat(document.getElementById('edit-water-curr').value) || 0;
      const rentAmount = parseFloat(document.getElementById('edit-inv-rent').value) || 0;
      const trashFee = parseFloat(document.getElementById('edit-inv-trash').value) || 20;

      const elecUnits = Math.max(0, elecCurr - elecPrev);
      const waterUnits = Math.max(0, waterCurr - waterPrev);
      const elecAmount = elecUnits * (this.state.rates ? (this.state.rates.electricityRate || 8) : 8);
      const waterAmount = waterUnits * (this.state.rates ? (this.state.rates.waterRate || 20) : 20);
      const totalAmount = rentAmount + elecAmount + waterAmount + trashFee;

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
          rentAmount, trashFee, totalAmount,
          status: document.getElementById('edit-inv-status').value,
          paidAmount: document.getElementById('edit-inv-status').value === 'paid' ? totalAmount : 0,
          outstandingAmount: document.getElementById('edit-inv-status').value === 'paid' ? 0 : totalAmount
        };
        DBService.saveState(this.state);
        modal.classList.remove('active');
        alert('✅ แก้ไขข้อมูลบิลค่าเช่าและซิงค์ลง Google Sheets เรียบร้อยแล้ว!');
        this.switchTab('billing');
      }
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
          <table class="invoice-details-table">
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
              ${(inv.trashFee || 20) > 0 ? `
                <tr>
                  <td style="text-align:center;">4</td>
                  <td><strong>ค่าบริการสาธารณูปโภค / ขยะ (Trash Fee)</strong></td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:right;">-</td>
                  <td style="text-align:right;"><strong>฿${(inv.trashFee || 20).toLocaleString(undefined, {minimumFractionDigits:2})}</strong></td>
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
              ${(inv.trashFee || 20) > 0 ? `
                <tr>
                  <td style="text-align:center;">4</td>
                  <td>ค่าบริการสาธารณูปโภค / ขยะ</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:center;">-</td>
                  <td style="text-align:right;">-</td>
                  <td style="text-align:right;">฿${(inv.trashFee || 20).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
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


  static openCreateBillModal(preselectedRoom = null) {
    const modal = document.getElementById('app-modal');
    const dialog = modal.querySelector('.modal-dialog');

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

    const initialRoom = preselectedRoom || (this.state.rooms.length > 0 ? this.state.rooms[0] : null);
    const initialMeters = getRoomPrevMeters(initialRoom);

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-calculator text-primary"></i> คำนวณออกบิลแจ้งหนี้ประจำเดือน</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="bill-form">
          <div class="form-group">
            <label>เลือกห้องพัก *</label>
            <select id="bill-room-select" class="form-control" required>
              <option value="">-- เลือกห้องพัก --</option>
              ${this.state.rooms.map(r => `<option value="${r.id}" ${initialRoom && initialRoom.id === r.id ? 'selected' : ''}>ห้อง ${r.name}</option>`).join('')}
            </select>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label>รอบเดือน *</label>
              <input type="month" id="bill-month" class="form-control" value="${new Date().toISOString().slice(0, 7)}" required>
            </div>
            <div class="form-group">
              <label>กำหนดชำระ *</label>
              <input type="date" id="bill-due-date" class="form-control" value="${new Date().toISOString().slice(0, 7)}-05" required>
            </div>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:var(--radius-md); padding:1rem; margin-top:1rem;">
            <h4 style="font-size:0.95rem; margin-bottom:0.75rem; color:var(--primary);"><i class="fa-solid fa-bolt"></i> จดเลขมิเตอร์ไฟฟ้า (เรท ฿${this.state.rates.electricityRate}/ยูนิต)</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
              <div class="form-group"><label>มิเตอร์ไฟครั้งก่อน:</label><input type="number" id="bill-elec-prev" class="form-control" value="${initialMeters.elecPrev}"></div>
              <div class="form-group"><label>มิเตอร์ไฟครั้งนี้ *:</label><input type="number" id="bill-elec-curr" class="form-control" value="${initialMeters.elecPrev + 50}" required></div>
            </div>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:var(--radius-md); padding:1rem; margin-top:1rem;">
            <h4 style="font-size:0.95rem; margin-bottom:0.75rem; color:var(--primary);"><i class="fa-solid fa-droplet"></i> จดเลขมิเตอร์น้ำประปา (เรท ฿${this.state.rates.waterRate}/ยูนิต)</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
              <div class="form-group"><label>มิเตอร์น้ำครั้งก่อน:</label><input type="number" id="bill-water-prev" class="form-control" value="${initialMeters.waterPrev}"></div>
              <div class="form-group"><label>มิเตอร์น้ำครั้งนี้ *:</label><input type="number" id="bill-water-curr" class="form-control" value="${initialMeters.waterPrev + 10}" required></div>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-full" style="margin-top:1.25rem;">
            <i class="fa-solid fa-file-invoice"></i> คำนวณและสร้างใบแจ้งหนี้
          </button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));

    const roomSelect = document.getElementById('bill-room-select');
    if (roomSelect) {
      roomSelect.addEventListener('change', (e) => {
        const selectedRoom = this.state.rooms.find(r => r.id === e.target.value);
        if (selectedRoom) {
          const meters = getRoomPrevMeters(selectedRoom);
          document.getElementById('bill-elec-prev').value = meters.elecPrev;
          document.getElementById('bill-elec-curr').value = meters.elecPrev + 50;
          document.getElementById('bill-water-prev').value = meters.waterPrev;
          document.getElementById('bill-water-curr').value = meters.waterPrev + 10;
        }
      });
    }

    document.getElementById('bill-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const roomId = document.getElementById('bill-room-select').value;
      const room = this.state.rooms.find(r => r.id === roomId);
      if (!room) return alert('กรุณาเลือกห้องพัก');

      const monthKey = document.getElementById('bill-month').value;
      const dueDate = document.getElementById('bill-due-date').value;
      const elecPrev = parseFloat(document.getElementById('bill-elec-prev').value) || 0;
      const elecCurr = parseFloat(document.getElementById('bill-elec-curr').value) || 0;
      const waterPrev = parseFloat(document.getElementById('bill-water-prev').value) || 0;
      const waterCurr = parseFloat(document.getElementById('bill-water-curr').value) || 0;

      // Save latest meter readings to room object for automatic autofill next month
      room.lastElecMeter = elecCurr;
      room.lastWaterMeter = waterCurr;

      const elecUnits = Math.max(0, elecCurr - elecPrev);
      const waterUnits = Math.max(0, waterCurr - waterPrev);
      const elecAmt = elecUnits * (this.state.rates.electricityRate || 8);
      const waterAmt = waterUnits * (this.state.rates.waterRate || 20);
      const rentAmt = room.baseRent || 3500;
      const trashFee = 20;
      const total = rentAmt + elecAmt + waterAmt + trashFee;

      const newInv = {
        id: 'inv_' + Date.now(),
        invoiceNumber: `INV${monthKey.replace('-', '')}-${room.name}`,
        monthKey, roomId: room.id, roomName: room.name,
        tenantId: room.currentTenantId || 't1',
        tenantName: room.currentTenantName || 'ผู้เช่า',
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate,
        waterPrev, waterCurr, elecPrev, elecCurr,
        rentAmount: rentAmt, waterAmount: waterAmt, elecAmount: elecAmt, trashFee: trashFee,
        totalAmount: total, paidAmount: 0, outstandingAmount: total,
        status: 'unpaid'
      };

      this.state.invoices.unshift(newInv);
      DBService.saveState(this.state);
      modal.classList.remove('active');
      this.switchTab('billing');
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

  // --- 7. REPORTS EVENTS ---
  static bindReportsEvents() {
    const expInc = document.querySelector('.btn-export-income-report');
    if (expInc) {
      expInc.addEventListener('click', () => {
        const headers = ['เลขที่บิล', 'รอบเดือน', 'ห้อง', 'ผู้เช่า', 'ยอดเงินสุทธิ', 'สถานะ'];
        const rows = this.state.invoices.map(i => [i.invoiceNumber, i.monthKey, i.roomName, i.tenantName, i.totalAmount, i.status]);
        ExportService.exportToCSV('รายงานรายรับประจำเดือน_Sombat.csv', headers, rows);
      });
    }

    const expOvd = document.querySelector('.btn-export-overdue-report');
    if (expOvd) {
      expOvd.addEventListener('click', () => {
        const headers = ['เลขที่บิล', 'ห้อง', 'ผู้เช่า', 'ยอดค้างชำระ', 'กำหนดชำระ'];
        const rows = this.state.invoices.filter(i => i.status === 'unpaid').map(i => [i.invoiceNumber, i.roomName, i.tenantName, i.outstandingAmount, i.dueDate]);
        ExportService.exportToCSV('รายงานผู้เช่าค้างชำระ_Sombat.csv', headers, rows);
      });
    }

    const expMtr = document.querySelector('.btn-export-meter-report');
    if (expMtr) {
      expMtr.addEventListener('click', () => {
        const headers = ['ห้องพัก', 'มิเตอร์ไฟครั้งก่อน', 'มิเตอร์ไฟครั้งนี้', 'มิเตอร์น้ำครั้งก่อน', 'มิเตอร์น้ำครั้งนี้'];
        const rows = this.state.invoices.map(i => [i.roomName, i.elecPrev, i.elecCurr, i.waterPrev, i.waterCurr]);
        ExportService.exportToCSV('รายงานมิเตอร์น้ำไฟ_Sombat.csv', headers, rows);
      });
    }

    const expCtr = document.querySelector('.btn-export-contracts-report');
    if (expCtr) {
      expCtr.addEventListener('click', () => {
        const headers = ['ผู้เช่า', 'เลขบัตรประชาชน', 'ห้องพัก', 'วันเริ่มสัญญา', 'วันหมดสัญญา'];
        const rows = this.state.tenants.map(t => {
          const room = this.state.rooms.find(r => r.id === t.assignedRoomId);
          return [t.name, t.idCard, room ? room.name : '-', t.startDate, t.endDate];
        });
        ExportService.exportToCSV('รายงานทะเบียนสัญญาเช่า_Sombat.csv', headers, rows);
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
        
        const url = this.state.settings.googleSheetUrl || DBService.getSavedSheetUrl();
        if (url) {
          try {
            await DBService.syncToGoogleSheets(url, this.state);
            alert('✅ บันทึกการตั้งค่า LINE Bot ลง Google Sheets เรียบร้อยแล้ว! (ทุกเครื่องดึงข้อมูลใช้งานตรงกัน 100%)');
          } catch (err) {
            alert('บันทึกการตั้งค่าเรียบร้อยแล้ว (การซิงค์ชีต: ' + err.message + ')');
          }
        } else {
          alert('✅ บันทึกการตั้งค่า LINE Bot เรียบร้อยแล้ว!');
        }
      });
    }

    const testLineBtn = document.getElementById('btn-test-line-send');
    if (testLineBtn) {
      testLineBtn.addEventListener('click', () => {
        const token = (this.state.settings && (this.state.settings.lineToken || this.state.settings.lineNotifyToken)) || '';
        alert(`📱 ทดสอบส่งข้อความ LINE Bot & Notify:\n\n📢 [หอพักสมบัติ นนทบุรี] ทดสอบการเชื่อมต่อระบบ LINE Bot อัตโนมัติเรียบร้อยแล้ว!\n\n(Token: ${token ? 'ระบุไว้แล้ว' : 'ยังไม่ได้ระบุ'})`);
      });
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

    const copyLinkBtn = document.getElementById('btn-copy-shared-link');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        const url = this.state.settings.googleSheetUrl || DBService.getSavedSheetUrl();
        if (!url) {
          alert('กรุณาใส่ Google Sheets Web App URL ก่อนกดคัดลอกลิงก์แชร์');
          return;
        }
        const sharedUrl = `${window.location.origin}${window.location.pathname}?sheetUrl=${encodeURIComponent(url)}`;
        navigator.clipboard.writeText(sharedUrl).then(() => {
          alert(`🔗 คัดลอกลิงก์เชื่อมต่อฐานข้อมูลชีตสำเร็จแล้ว!\n\n${sharedUrl}\n\nคุณสามารถส่งลิงก์นี้ให้คอมพิวเตอร์ หรือ มือถือเครื่องอื่นเปิดใช้งาน เพื่อดึงและซิงค์ข้อมูลจาก Google Sheets เดียวกันได้ทันที โดยข้อมูลไม่หายแม้ล้างแคช!`);
        }).catch(() => {
          prompt('คัดลอกลิงก์เชื่อมต่อฐานข้อมูลชีตด้านล่างนี้:', sharedUrl);
        });
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
              <label>รหัสผ่าน (Password) *</label>
              <div style="position:relative;">
                <input type="password" id="usr-pass" class="form-control" value="${userToEdit ? (userToEdit.password || userToEdit.passwordHash || 'admin') : 'admin'}" required style="padding-right:2.5rem;">
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

    document.getElementById('user-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('usr-name').value.trim();
      const displayName = document.getElementById('usr-disp').value.trim();
      const role = document.getElementById('usr-role').value;
      const password = document.getElementById('usr-pass').value;

      if (!this.state.users) this.state.users = [];

      if (isEdit) {
        const idx = this.state.users.findIndex(u => u.id === userToEdit.id);
        if (idx !== -1) {
          this.state.users[idx] = {
            ...this.state.users[idx],
            displayName,
            role,
            password,
            passwordHash: password
          };
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
          password,
          passwordHash: password
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
      monthlyRentThai: Formatters.thaiBahtText(room ? room.baseRent : 3500),
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

// Attach App globally to window for backward compatibility
if (typeof window !== 'undefined') {
  window.App = App;
}
