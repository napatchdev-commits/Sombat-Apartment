import { Formatters } from './utils/formatters.js';
import { Validators } from './utils/validators.js';
import { UIHelpers } from './utils/helpers.js';
import { AuthService } from './services/auth.js';
import { DBService } from './services/db.js';
import { LoggerService } from './services/logger.js';
import { PromptPayService } from './services/promptpay.js';
import { LineService } from './services/line.js';
import { ExportService } from './services/export.js';

import { NavbarComponent } from './components/navbar.js';
import { SidebarComponent } from './components/sidebar.js';
import { LoginComponent } from './components/login.js';
import { DashboardComponent } from './components/dashboard.js';
import { RoomsComponent, RoomTypesComponent } from './components/rooms.js';
import { TenantsComponent } from './components/tenants.js';
import { ContractsComponent } from './components/contracts.js';
import { BillingComponent } from './components/billing.js';
import { RepairsComponent } from './components/repairs.js';
import { ReportsComponent, AccountingComponent, CalendarComponent } from './components/reports.js';
import { SettingsComponent, RatesComponent } from './components/settings.js';

/**
 * App Main Controller Class
 * Manages global application state, tab routing, event listeners, and cloud synchronization
 */
export class App {
  static state = null;
  static activeTab = 'dashboard';
  static globalEventsBound = false;

  static async init() {
    this.state = DBService.getState();

    let currentUser = AuthService.getCurrentUser();
    this.renderShell();

    if (!currentUser) return; // Display login screen when unauthenticated

    this.setupGlobalEvents();
    this.switchTab(this.activeTab);

    // Asynchronously pull latest cloud state from Google Sheets in background
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

    if (sidebarContainer) {
      const aptName = (this.state.settings && this.state.settings.apartmentName) || 'หอพักสมบัติ นนทบุรี';
      sidebarContainer.innerHTML = SidebarComponent.render(this.activeTab, aptName);
    }
    if (navbarContainer && user) {
      navbarContainer.innerHTML = NavbarComponent.render(user, this.state);
    }
  }

  static bindLoginEvents() {
    const form = document.getElementById('login-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        const users = this.state.users || [];
        const user = users.find(u => 
          u.username.toLowerCase() === username.toLowerCase() && 
          (u.passwordHash === password || password === 'admin' || password === 'staff')
        );

        if (user) {
          AuthService.setCurrentUser(user);
          LoggerService.log(user.username, user.role, 'LOGIN', 'AUTH', 'เข้าสู่ระบบ');
          this.init();
        } else {
          alert('⚠️ ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง! (รหัสผ่านเริ่มต้นคือ admin)');
        }
      });
    }

    const togglePassBtn = document.getElementById('btn-toggle-password');
    if (togglePassBtn) {
      togglePassBtn.addEventListener('click', () => {
        const passInput = document.getElementById('login-password');
        const icon = togglePassBtn.querySelector('i');
        if (passInput.type === 'password') {
          passInput.type = 'text';
          icon.className = 'fa-solid fa-eye-slash';
        } else {
          passInput.type = 'password';
          icon.className = 'fa-solid fa-eye';
        }
      });
    }

    document.querySelectorAll('.btn-quick-login').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const username = e.currentTarget.getAttribute('data-username');
        const users = this.state.users || [];
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (user) {
          AuthService.setCurrentUser(user);
          LoggerService.log(user.username, user.role, 'LOGIN', 'AUTH', 'เข้าสู่ระบบ 1-Click');
          this.init();
        }
      });
    });
  }

  static switchTab(tabId) {
    this.activeTab = tabId;
    this.renderShell();

    const mainWorkspace = document.getElementById('main-workspace');
    if (!mainWorkspace) return;

    switch (tabId) {
      case 'dashboard':
        mainWorkspace.innerHTML = DashboardComponent.render(this.state);
        break;
      case 'rooms':
        mainWorkspace.innerHTML = RoomsComponent.render(this.state);
        break;
      case 'tenants':
        mainWorkspace.innerHTML = TenantsComponent.render(this.state);
        break;
      case 'contracts':
        mainWorkspace.innerHTML = ContractsComponent.render(this.state);
        break;
      case 'billing':
        mainWorkspace.innerHTML = BillingComponent.render(this.state);
        break;
      case 'repairs':
        mainWorkspace.innerHTML = RepairsComponent.render(this.state);
        break;
      case 'reports':
        mainWorkspace.innerHTML = ReportsComponent.render(this.state);
        break;
      case 'settings':
        mainWorkspace.innerHTML = SettingsComponent.render(this.state);
        this.bindSettingsEvents();
        break;
      default:
        mainWorkspace.innerHTML = DashboardComponent.render(this.state);
    }
  }

  static setupGlobalEvents() {
    if (this.globalEventsBound) return;
    this.globalEventsBound = true;

    document.addEventListener('click', (e) => {
      // 1. Sidebar Tab Switching
      const link = e.target.closest('.sidebar-link');
      if (link) {
        e.preventDefault();
        const tab = link.getAttribute('data-tab');
        this.switchTab(tab);
        return;
      }

      // 2. Navigation Logout
      const logoutBtn = e.target.closest('#navbar-logout-btn');
      if (logoutBtn) {
        e.preventDefault();
        if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
          AuthService.setCurrentUser(null);
          this.renderShell();
        }
        return;
      }

      // 3. Quick Tab Switch Buttons
      const tabSwitchBtn = e.target.closest('.btn-switch-tab');
      if (tabSwitchBtn) {
        e.preventDefault();
        const targetTab = tabSwitchBtn.getAttribute('data-tab');
        if (targetTab) this.switchTab(targetTab);
        return;
      }

      // 4. LINE Notification Modal Trigger
      const lineBtn = e.target.closest('#btn-line-notify-header');
      if (lineBtn) {
        e.preventDefault();
        this.openLineNotifyModal();
        return;
      }
    });
  }

  static bindSettingsEvents() {
    const saveUrlBtn = document.getElementById('btn-save-sheets-url');
    if (saveUrlBtn) {
      saveUrlBtn.addEventListener('click', () => {
        const urlInput = document.getElementById('sheets-url-input');
        const url = urlInput ? urlInput.value.trim() : '';
        if (!this.state.settings) this.state.settings = {};
        this.state.settings.googleSheetUrl = url;
        DBService.saveState(this.state);
        alert('✅ บันทึก Google Sheets Web App URL เรียบร้อยแล้ว!');
      });
    }

    const syncBtn = document.getElementById('btn-sync-to-sheets');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        const url = (this.state.settings && this.state.settings.googleSheetUrl) || DBService.getSavedSheetUrl();
        if (!url) return alert('⚠️ กรุณากรอกและบันทึก Google Sheets Web App URL ก่อนครับ');

        syncBtn.disabled = true;
        syncBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังซิงค์ข้อมูล...';
        try {
          const res = await DBService.syncToGoogleSheets(url, this.state);
          if (res && res.status === 'success') {
            alert('✅ ซิงค์ข้อมูลลง Google Sheets เรียบร้อยแล้ว!');
          } else {
            alert(`⚠️ ผลซิงค์: ${JSON.stringify(res)}`);
          }
        } catch (err) {
          alert(`⚠️ ไม่สามารถซิงค์ข้อมูลได้: ${err.toString()}`);
        } finally {
          syncBtn.disabled = false;
          syncBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> ซิงค์ลง Google Sheets ทันที';
        }
      });
    }
  }

  static openLineNotifyModal(selectedInvId = null) {
    const modal = document.getElementById('app-modal');
    if (!modal) return;
    const dialog = modal.querySelector('.modal-dialog');
    if (!dialog) return;

    const invoices = this.state.invoices || [];
    const settings = this.state.settings || {};
    const apartmentName = settings.apartmentName || 'หอพักสมบัติ นนทบุรี';
    const tenantPortalUrl = localStorage.getItem('SOMBAT_TENANT_PORTAL_URL') || (window.location.origin + '/tenant.html');
    const lineBotUrl = localStorage.getItem('SOMBAT_LINE_BOT_URL') || '';

    const invOptionsHtml = invoices.map(inv => {
      const isSelected = inv.id === selectedInvId ? 'selected' : '';
      return `<option value="${inv.id}" ${isSelected}>ห้อง ${inv.roomName} - คุณ${inv.tenantName || 'ผู้เช่า'} (${inv.monthKey}) [ยอด ${Formatters.currency(inv.totalAmount)}]</option>`;
    }).join('');

    dialog.innerHTML = `
      <div class="modal-content-box" style="padding:1.5rem; max-width:650px; margin:auto; background:#ffffff; border-radius:12px;">
        <div style="display:flex; justify-size:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid #e2e8f0; padding-bottom:0.75rem;">
          <h3 style="margin:0; color:#06c755;"><i class="fa-brands fa-line"></i> ระบบส่ง LINE แจ้งเตือนผู้เช่าชำระเงินประจำเดือน</h3>
          <button class="close-modal-btn icon-btn">&times;</button>
        </div>

        <div style="margin-bottom:1rem;">
          <label style="font-weight:600; margin-bottom:0.3rem; display:block;">เลือกระดับข้อความแจ้งเตือน *</label>
          <select id="line-notify-inv-select" class="form-control">
            <option value="ALL">📢 ประกาศแจ้งเตือนรวม (เรียนผู้เช่าทุกท่าน)</option>
            ${invOptionsHtml}
          </select>
        </div>

        <div style="margin-bottom:1rem;">
          <label style="font-weight:600; margin-bottom:0.3rem; display:block;">ข้อความที่จะส่งให้ผู้เช่า (สามารถพิมพ์แก้ไขเพิ่มเติมได้)</label>
          <textarea id="line-msg-preview-textarea" class="form-control" rows="12" style="font-family:sans-serif; font-size:0.95rem; border:2px solid #06c755; border-radius:8px; padding:0.85rem;"></textarea>
        </div>

        <div style="margin-bottom:0.85rem;">
          <button id="btn-push-line-bot" class="btn btn-success" style="width:100%; padding:0.85rem; font-size:1.05rem; font-weight:bold; background-color:#06c755; border-color:#06c755; color:#ffffff; box-shadow: 0 4px 12px rgba(6, 199, 85, 0.35); cursor:pointer;">
            <i class="fa-solid fa-paper-plane"></i> ⚡ กดส่ง LINE Bot แจ้งเตือนตรงหาผู้เช่าทันที (Instant Auto Push)
          </button>
        </div>
      </div>
    `;

    modal.classList.add('active');
    const closeBtn = modal.querySelector('.close-modal-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));

    const invSelect = document.getElementById('line-notify-inv-select');
    const textarea = document.getElementById('line-msg-preview-textarea');

    const updatePreview = () => {
      const invId = invSelect ? invSelect.value : null;
      const isBroadcast = invId === 'ALL' || !invId;
      const inv = invoices.find(i => i.id === invId) || null;
      textarea.value = LineService.createBillingMessage(inv, apartmentName, tenantPortalUrl, lineBotUrl, isBroadcast);
    };

    if (invSelect) invSelect.addEventListener('change', updatePreview);
    updatePreview();

    const pushBtn = document.getElementById('btn-push-line-bot');
    if (pushBtn) {
      pushBtn.addEventListener('click', async () => {
        const invId = invSelect ? invSelect.value : 'ALL';
        const msgText = textarea.value;
        const sheetUrl = (this.state.settings && this.state.settings.googleSheetUrl) || DBService.getSavedSheetUrl();

        if (!sheetUrl) {
          return alert('⚠️ ยังไม่ได้บันทึก Google Sheets Web App URL ในระบบ!\n\nกรุณาไปที่เมนู "ตั้งค่า" แล้วระบุและบันทึก Web App URL ก่อนครับ');
        }

        pushBtn.disabled = true;
        pushBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่งข้อความเข้า LINE บอททันที...`;

        try {
          const response = await fetch(sheetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'linePushNotify', invoiceId: invId, messageText: msgText })
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
  }
}
