// ==========================================================================
// MAIN APPLICATION CONTROLLER (SINGLE PAGE APP & CLEAN ARCHITECTURE MODULES)
// ==========================================================================

import { DBService, DatabaseState } from './src/services/db.service';
import { AuthService } from './src/services/auth.service';
import { LoggerService } from './src/services/logger.service';
import { PromptPayService } from './src/services/promptpay.service';
import { LineService } from './src/services/line.service';
import { ExportService } from './src/services/export.service';
import { Formatters } from './src/utils/formatters';
import { Validators } from './src/utils/validators';

import { NavbarComponent } from './src/components/navbar.component';
import { SidebarComponent } from './src/components/sidebar.component';
import { DashboardComponent } from './src/components/dashboard.component';
import { TenantsComponent } from './src/components/tenants.component';
import { RoomsComponent } from './src/components/rooms.component';
import { BillingComponent } from './src/components/billing.component';
import { RepairsComponent } from './src/components/repairs.component';
import { AccountingComponent } from './src/components/accounting.component';
import { CalendarComponent } from './src/components/calendar.component';
import { ReportsComponent } from './src/components/reports.component';
import { SettingsComponent } from './src/components/settings.component';

export class App {
  private static state: DatabaseState;
  private static activeTab: string = 'dashboard';

  public static init(): void {
    // Check authentication
    let currentUser = AuthService.getCurrentUser();
    if (!currentUser) {
      // Default auto-login as Super Admin for demonstration
      const initialState = DBService.getState();
      currentUser = initialState.users[0]; // superadmin
      AuthService.setCurrentUser(currentUser);
      LoggerService.log(currentUser.username, currentUser.role, 'LOGIN', 'AUTH', 'เข้าสู่ระบบสำเร็จ');
    }

    this.state = DBService.getState();
    this.renderShell();
    this.setupGlobalEvents();
    this.switchTab(this.activeTab);
  }

  private static renderShell(): void {
    const user = AuthService.getCurrentUser()!;
    const sidebarContainer = document.getElementById('sidebar-container');
    const navbarContainer = document.getElementById('navbar-container');

    if (sidebarContainer) {
      sidebarContainer.innerHTML = SidebarComponent.render(this.activeTab, this.state.settings.apartmentName);
    }
    if (navbarContainer) {
      navbarContainer.innerHTML = NavbarComponent.render(user, this.state);
    }
  }

  public static switchTab(tabId: string): void {
    this.activeTab = tabId;
    this.renderShell();

    const workspace = document.getElementById('main-workspace');
    if (!workspace) return;

    // Loading Skeleton Simulation
    workspace.innerHTML = `
      <div class="skeleton-loader-view">
        <div class="skeleton-header"></div>
        <div class="skeleton-cards-grid">
          <div class="skeleton-card"></div>
          <div class="skeleton-card"></div>
          <div class="skeleton-card"></div>
        </div>
      </div>
    `;

    setTimeout(() => {
      switch (tabId) {
        case 'dashboard':
          workspace.innerHTML = DashboardComponent.render(this.state);
          break;
        case 'tenants':
          workspace.innerHTML = TenantsComponent.render(this.state);
          this.bindTenantsEvents();
          break;
        case 'rooms':
          workspace.innerHTML = RoomsComponent.render(this.state);
          this.bindRoomsEvents();
          break;
        case 'billing':
          workspace.innerHTML = BillingComponent.render(this.state);
          this.bindBillingEvents();
          break;
        case 'repairs':
          workspace.innerHTML = RepairsComponent.render(this.state);
          this.bindRepairsEvents();
          break;
        case 'accounting':
          workspace.innerHTML = AccountingComponent.render(this.state);
          this.bindAccountingEvents();
          break;
        case 'calendar':
          workspace.innerHTML = CalendarComponent.render(this.state);
          break;
        case 'reports':
          workspace.innerHTML = ReportsComponent.render(this.state);
          this.bindReportsEvents();
          break;
        case 'settings':
          workspace.innerHTML = SettingsComponent.render(this.state);
          this.bindSettingsEvents();
          break;
        default:
          workspace.innerHTML = DashboardComponent.render(this.state);
      }
    }, 150);
  }

  private static setupGlobalEvents(): void {
    // Sidebar Tab Navigation
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[data-tab]') as HTMLAnchorElement;
      if (link) {
        e.preventDefault();
        const tabId = link.getAttribute('data-tab');
        if (tabId) this.switchTab(tabId);
      }
    });

    // Mobile Drawer Toggle
    const mobileBtn = document.getElementById('mobile-toggle-btn');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('app-sidebar');
        if (sidebar) sidebar.classList.toggle('active');
      });
    }

    // Global Search Filter
    const searchInput = document.getElementById('global-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        this.filterActiveView(query);
      });
    }

    // Notification Dropdown Toggle
    const bellBtn = document.getElementById('notification-bell-btn');
    if (bellBtn) {
      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('notification-menu');
        if (menu) menu.classList.toggle('active');
      });
    }

    document.addEventListener('click', () => {
      const menu = document.getElementById('notification-menu');
      if (menu) menu.classList.remove('active');
    });

    // Logout Event
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        const user = AuthService.getCurrentUser();
        if (user) {
          LoggerService.log(user.username, user.role, 'LOGOUT', 'AUTH', 'ออกจากระบบ');
        }
        AuthService.setCurrentUser(null);
        location.reload();
      });
    }
  }

  private static filterActiveView(query: string): void {
    if (!query) {
      this.switchTab(this.activeTab);
      return;
    }
    const rows = document.querySelectorAll('.custom-table tbody tr, .room-card');
    rows.forEach((row: any) => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(query) ? '' : 'none';
    });
  }

  // ==========================================================================
  // EVENT BINDINGS FOR COMPONENTS
  // ==========================================================================

  private static bindTenantsEvents(): void {
    const addBtn = document.getElementById('btn-add-tenant');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openTenantModal());
    }

    document.querySelectorAll('.btn-edit-tenant').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const tenant = this.state.tenants.find(t => t.id === id);
        if (tenant) this.openTenantModal(tenant);
      });
    });

    document.querySelectorAll('.btn-delete-tenant').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (confirm('ยืนยันลบผู้เช่าคนนี้ใช่หรือไม่?')) {
          const user = AuthService.getCurrentUser()!;
          this.state.tenants = this.state.tenants.filter(t => t.id !== id);
          DBService.saveState(this.state);
          LoggerService.log(user.username, user.role, 'DELETE', 'TENANTS', `ลบผู้เช่า ID ${id}`);
          this.showToast('ลบผู้เช่าเรียบร้อยแล้ว', 'success');
          this.switchTab('tenants');
        }
      });
    });

    // Auto Rental Contract Generator
    document.querySelectorAll('.btn-gen-contract').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const tenant = this.state.tenants.find(t => t.id === id);
        if (tenant) this.openContractModal(tenant);
      });
    });

    // Document Manager Modal
    document.querySelectorAll('.btn-doc-manage').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const tenant = this.state.tenants.find(t => t.id === id);
        if (tenant) this.openDocumentModal(tenant);
      });
    });

    // Exports
    const exportExcel = document.getElementById('btn-export-tenants-excel');
    if (exportExcel) {
      exportExcel.addEventListener('click', () => {
        const headers = ['ชื่อ-นามสกุล', 'เลขบัตรประชาชน', 'เบอร์โทร', 'วันเริ่มสัญญา', 'วันหมดสัญญา', 'เงินประกัน'];
        const rows = this.state.tenants.map(t => [t.name, t.idCard, t.tel, t.startDate, t.endDate, t.deposit ? t.deposit.initialBail : 0]);
        ExportService.exportToCSV('ทะเบียนผู้เช่า_Sombat_Apartment.csv', headers, rows);
      });
    }
  }

  private static bindRoomsEvents(): void {
    const addBtn = document.getElementById('btn-add-room');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openRoomModal());
    }

    // Status Filter Tabs
    document.querySelectorAll('.status-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('active'));
        const targetBtn = e.currentTarget as HTMLElement;
        targetBtn.classList.add('active');
        const status = targetBtn.getAttribute('data-status');

        document.querySelectorAll('.room-card').forEach((card: any) => {
          if (status === 'all' || card.getAttribute('data-status') === status) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });

    document.querySelectorAll('.btn-edit-room').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const room = this.state.rooms.find(r => r.id === id);
        if (room) this.openRoomModal(room);
      });
    });
  }

  private static bindBillingEvents(): void {
    const createBtn = document.getElementById('btn-create-bill');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.openCreateBillModal());
    }

    // Dynamic PromptPay QR Popup
    document.querySelectorAll('.btn-qr-promptpay').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const inv = this.state.invoices.find(i => i.id === id);
        if (inv) this.openPromptPayModal(inv);
      });
    });

    // Print Receipt / Bill
    document.querySelectorAll('.btn-print-bill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const inv = this.state.invoices.find(i => i.id === id);
        if (inv) this.printBillReceipt(inv);
      });
    });

    // LINE Notification Simulator
    document.querySelectorAll('.btn-send-line').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const inv = this.state.invoices.find(i => i.id === id);
        if (inv) {
          const msg = LineService.createBillingMessage(inv, this.state.settings.apartmentName);
          alert(`📲 จำลองการส่งข้อความ LINE แจ้งผู้เช่า:\n\n${msg}`);
          this.showToast('ส่งการแจ้งเตือน LINE เรียบร้อยแล้ว', 'success');
        }
      });
    });
  }

  private static bindRepairsEvents(): void {
    const addBtn = document.getElementById('btn-add-repair');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddRepairModal());
    }
  }

  private static bindAccountingEvents(): void {
    const addBtn = document.getElementById('btn-add-ledger-entry');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddLedgerModal());
    }
  }

  private static bindReportsEvents(): void {
    document.querySelectorAll('.btn-report-excel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = (e.currentTarget as HTMLElement).getAttribute('data-type');
        const headers = ['รายการ', 'ห้อง', 'ผู้เช่า', 'จำนวนเงิน'];
        const rows = this.state.invoices.map(i => [i.invoiceNumber, i.roomName, i.tenantName, i.totalAmount]);
        ExportService.exportToCSV(`รายงาน_${type}_Sombat.csv`, headers, rows);
      });
    });

    document.querySelectorAll('.btn-report-pdf').forEach(btn => {
      btn.addEventListener('click', () => {
        window.print();
      });
    });
  }

  private static bindSettingsEvents(): void {
    // Backup export
    const backupBtn = document.getElementById('btn-backup-export');
    if (backupBtn) {
      backupBtn.addEventListener('click', () => {
        DBService.exportJSON();
        this.showToast('ดาวน์โหลดไฟล์สำรองข้อมูล JSON เรียบร้อยแล้ว', 'success');
      });
    }

    // Restore trigger
    const restoreBtn = document.getElementById('btn-restore-trigger');
    const fileInput = document.getElementById('restore-file-input') as HTMLInputElement;
    if (restoreBtn && fileInput) {
      restoreBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const contents = ev.target?.result as string;
          const ok = DBService.importJSON(contents);
          if (ok) {
            this.showToast('กู้คืนข้อมูลสำเร็จ ระบบกำลังรีโหลด...', 'success');
            setTimeout(() => location.reload(), 1000);
          } else {
            this.showToast('ไฟล์สำรองข้อมูลไม่ถูกต้อง', 'danger');
          }
        };
        reader.readAsText(file);
      });
    }

    // Subtabs switcher
    document.querySelectorAll('.subtab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.subtab-content').forEach(c => c.classList.remove('active'));
        
        const targetBtn = e.currentTarget as HTMLElement;
        targetBtn.classList.add('active');
        const subtabId = targetBtn.getAttribute('data-subtab');
        const content = document.getElementById(`subtab-${subtabId}`);
        if (content) content.classList.add('active');
      });
    });
  }

  // ==========================================================================
  // MODAL DIALOG POPUPS
  // ==========================================================================

  private static openTenantModal(tenant?: any): void {
    const modal = document.getElementById('app-modal')!;
    const dialog = modal.querySelector('.modal-dialog')!;

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-user-pen text-primary"></i> ${tenant ? 'แก้ไขข้อมูลผู้เช่า' : 'เพิ่มทะเบียนผู้เช่าใหม่'}</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="tenant-form">
          <div class="form-group">
            <label>ชื่อ - นามสกุล *</label>
            <input type="text" id="t-name" class="form-control" value="${tenant ? tenant.name : ''}" required>
          </div>
          <div class="form-group">
            <label>เลขบัตรประชาชน (13 หลัก) *</label>
            <input type="text" id="t-idcard" class="form-control" value="${tenant ? tenant.idCard : ''}" required placeholder="3451200115491">
          </div>
          <div class="form-group">
            <label>เบอร์โทรศัพท์ *</label>
            <input type="text" id="t-tel" class="form-control" value="${tenant ? tenant.tel : ''}" required>
          </div>
          <div class="form-group">
            <label>วันเริ่มสัญญาเช่า *</label>
            <input type="date" id="t-start" class="form-control" value="${tenant ? tenant.startDate : new Date().toISOString().slice(0,10)}" required>
          </div>
          <div class="form-group">
            <label>วันสิ้นสุดสัญญาเช่า *</label>
            <input type="date" id="t-end" class="form-control" value="${tenant ? tenant.endDate : '2027-07-31'}" required>
          </div>
          <div class="form-group">
            <label>เงินประกันมัดจำ (บาท) *</label>
            <input type="number" id="t-bail" class="form-control" value="${tenant ? (tenant.deposit ? tenant.deposit.initialBail : 7000) : 7000}" required>
          </div>
          <button type="submit" class="btn btn-primary btn-full"><i class="fa-solid fa-save"></i> บันทึกข้อมูลผู้เช่า</button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn')!.addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('tenant-form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = AuthService.getCurrentUser()!;
      const name = (document.getElementById('t-name') as HTMLInputElement).value;
      const idCard = (document.getElementById('t-idcard') as HTMLInputElement).value;
      const tel = (document.getElementById('t-tel') as HTMLInputElement).value;
      const startDate = (document.getElementById('t-start') as HTMLInputElement).value;
      const endDate = (document.getElementById('t-end') as HTMLInputElement).value;
      const bail = parseFloat((document.getElementById('t-bail') as HTMLInputElement).value) || 0;

      if (tenant) {
        tenant.name = name;
        tenant.idCard = idCard;
        tenant.tel = tel;
        tenant.startDate = startDate;
        tenant.endDate = endDate;
        if (tenant.deposit) tenant.deposit.initialBail = bail;
        LoggerService.log(user.username, user.role, 'UPDATE', 'TENANTS', `แก้ไขผู้เช่า ${name}`);
      } else {
        const newTenant = {
          id: 't_' + Date.now(),
          name, idCard, tel, startDate, endDate,
          deposit: { initialBail: bail, deductions: [], status: 'active' },
          documents: []
        };
        this.state.tenants.push(newTenant as any);
        LoggerService.log(user.username, user.role, 'CREATE', 'TENANTS', `เพิ่มผู้เช่าใหม่ ${name}`);
      }

      DBService.saveState(this.state);
      modal.classList.remove('active');
      this.showToast('บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
      this.switchTab('tenants');
    });
  }

  private static openContractModal(tenant: any): void {
    const modal = document.getElementById('app-modal')!;
    const dialog = modal.querySelector('.modal-dialog')!;

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-file-contract text-warning"></i> สัญญาเช่าห้องพักอัตโนมัติ (Rental Agreement)</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body" id="contract-print-area">
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 1rem; margin-bottom: 1.5rem;">
          <h2>หนังสือสัญญาเช่าห้องพัก</h2>
          <h4>${this.state.settings.apartmentName}</h4>
          <p>${this.state.settings.address} โทร. ${this.state.settings.tel}</p>
        </div>

        <p style="text-indent: 2rem; margin-bottom: 0.75rem;">
          สัญญาฉบับนี้ทำขึ้นเมื่อวันที่ <strong>${Formatters.thaiDate(tenant.startDate)}</strong> ระหว่าง <strong>${this.state.settings.apartmentName}</strong> (ผู้ให้เช่า) 
          และ <strong>คุณ${tenant.name}</strong> ถือบัตรประชาชนเลขที่ <code>${Formatters.formatIdCard(tenant.idCard)}</code> (ผู้เช่า)
        </p>

        <p style="text-indent: 2rem; margin-bottom: 0.75rem;">
          ข้อ 1. ผู้ให้เช่าตกลงให้เช่า และผู้เช่าตกลงเช่าห้องพักในอัตราค่าเช่าเดือนละ <strong>${Formatters.currency(tenant.deposit ? tenant.deposit.initialBail / 2 : 3500)}</strong> 
          โดยมีระยะเวลาสัญญาเช่าตั้งแต่ <strong>${Formatters.thaiDate(tenant.startDate)}</strong> ถึง <strong>${Formatters.thaiDate(tenant.endDate)}</strong>
        </p>

        <p style="text-indent: 2rem; margin-bottom: 1.5rem;">
          ข้อ 2. ในวันทำสัญญานี้ ผู้เช่าได้วางเงินประกันมัดจำไว้เป็นจำนวนเงิน <strong>${Formatters.currency(tenant.deposit ? tenant.deposit.initialBail : 7000)}</strong> 
          แก่ผู้ให้เช่าไว้เป็นหลักฐานเรียบร้อยแล้ว
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; text-align: center; margin-top: 3rem;">
          <div><p>(ลงชื่อ).................................................ผู้เช่า</p><p>(${tenant.name})</p></div>
          <div><p>(ลงชื่อ).................................................ผู้ให้เช่า</p><p>(${this.state.settings.apartmentName})</p></div>
        </div>

        <button class="btn btn-primary btn-full" id="btn-do-print-contract" style="margin-top: 2rem;">
          <i class="fa-solid fa-print"></i> สั่งพิมพ์สัญญาเช่า (PDF)
        </button>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn')!.addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('btn-do-print-contract')!.addEventListener('click', () => {
      window.print();
    });
  }

  private static openDocumentModal(tenant: any): void {
    const modal = document.getElementById('app-modal')!;
    const dialog = modal.querySelector('.modal-dialog')!;

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-folder-open text-primary"></i> จัดการไฟล์เอกสารแนบ: ${tenant.name}</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <p class="text-muted" style="margin-bottom: 1rem;">รองรับไฟล์: PDF, JPG, PNG, DOCX, ZIP (จัดเก็บลงระบบคลาวด์/ฐานข้อมูล)</p>
        
        <div class="form-group">
          <label>อัปโหลดเอกสารใหม่:</label>
          <input type="file" id="doc-file-input" class="form-control" accept=".pdf,.jpg,.png,.docx,.zip">
        </div>

        <h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">รายชื่อไฟล์ที่แนบไว้ (${tenant.documents ? tenant.documents.length : 0}):</h4>
        <ul class="custom-file-list" style="list-style: none;">
          ${(!tenant.documents || tenant.documents.length === 0) ? '<li class="text-muted">ยังไม่มีเอกสารแนบ</li>' : tenant.documents.map((d: any) => `
            <li style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0;">
              <span><i class="fa-solid fa-file text-primary"></i> ${d.name}</span>
              <span class="badge-pill badge-gray">${d.fileType.toUpperCase()}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn')!.addEventListener('click', () => modal.classList.remove('active'));

    const fileInput = document.getElementById('doc-file-input') as HTMLInputElement;
    fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!tenant.documents) tenant.documents = [];

      tenant.documents.push({
        id: 'doc_' + Date.now(),
        name: file.name,
        type: 'other',
        fileType: file.name.split('.').pop() || 'pdf',
        url: '',
        uploadDate: new Date().toISOString().slice(0, 10),
        sizeBytes: file.size
      });

      DBService.saveState(this.state);
      this.showToast(`อัปโหลดไฟล์ ${file.name} สำเร็จ`, 'success');
      modal.classList.remove('active');
      this.switchTab('tenants');
    });
  }

  private static openPromptPayModal(inv: any): void {
    const modal = document.getElementById('app-modal')!;
    const dialog = modal.querySelector('.modal-dialog')!;

    const payload = PromptPayService.generatePayload(this.state.settings.promptPayId, inv.totalAmount);
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-qrcode text-primary"></i> Dynamic PromptPay QR Code</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body text-center" style="padding: 2rem;">
        <div style="background: #ffffff; padding: 1.5rem; border-radius: 16px; display: inline-block; box-shadow: var(--shadow-md);">
          <img src="${qrApiUrl}" alt="PromptPay QR" style="width: 220px; height: 220px; border-radius: 8px;">
        </div>

        <h3 style="margin-top: 1.25rem; font-size: 1.5rem; color: #1e293b;">${Formatters.currency(inv.totalAmount)}</h3>
        <p class="text-muted">ห้อง ${inv.roomName} (${inv.tenantName})</p>
        <p class="text-sm" style="margin-top: 0.5rem; color: #64748b;">สแกนผ่านแอปพลิเคชันทุกธนาคาร ยอดเงินตรงตามบิลอัตโนมัติ</p>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn')!.addEventListener('click', () => modal.classList.remove('active'));
  }

  private static printBillReceipt(inv: any): void {
    const printArea = document.getElementById('print-receipt-area')!;
    const settings = this.state.settings;

    const waterUsed = inv.waterCurr - inv.waterPrev;
    const elecUsed = inv.elecCurr - inv.elecPrev;

    printArea.innerHTML = `
      <div style="padding: 2rem; font-family: 'Sarabun', sans-serif; background: #fff; max-width: 650px; margin: 0 auto; border: 1px solid #ccc;">
        <div style="text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 1rem; margin-bottom: 1rem;">
          <h2 style="margin-bottom: 0.25rem;">${settings.apartmentName}</h2>
          <p style="font-size: 0.85rem;">${settings.address} โทร. ${settings.tel}</p>
          <h3 style="margin-top: 0.75rem;">${inv.status === 'paid' ? 'ใบเสร็จรับเงิน (Receipt)' : 'ใบแจ้งหนี้ค่าเช่าห้องพัก (Invoice)'}</h3>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.9rem; margin-bottom: 1.25rem;">
          <div>เลขที่บิล: <strong>${inv.invoiceNumber}</strong></div>
          <div>ประจำรอบเดือน: <strong>${Formatters.thaiMonthBE(inv.monthKey)}</strong></div>
          <div>ห้องพัก: <strong>${inv.roomName}</strong></div>
          <div>ชื่อผู้เช่า: <strong>${inv.tenantName}</strong></div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.25rem; font-size: 0.9rem;">
          <thead>
            <tr style="border-bottom: 1px solid #000; text-align: left;">
              <th>รายการ</th>
              <th style="text-align: right;">หน่วย</th>
              <th style="text-align: right;">จำนวนเงิน (บาท)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>ค่าเช่าห้องพัก</td><td style="text-align: right;">-</td><td style="text-align: right;">${Formatters.currency(inv.rentAmount)}</td></tr>
            <tr><td>ค่าน้ำประปา (${inv.waterPrev} ➔ ${inv.waterCurr})</td><td style="text-align: right;">${waterUsed} หน่วย</td><td style="text-align: right;">${Formatters.currency(inv.waterAmount)}</td></tr>
            <tr><td>ค่าไฟฟ้า (${inv.elecPrev} ➔ ${inv.elecCurr})</td><td style="text-align: right;">${elecUsed} หน่วย</td><td style="text-align: right;">${Formatters.currency(inv.elecAmount)}</td></tr>
            <tr><td>ค่าขยะรายเดือน</td><td style="text-align: right;">-</td><td style="text-align: right;">${Formatters.currency(inv.trashFee)}</td></tr>
            <tr style="border-top: 1px solid #000; font-weight: bold;">
              <td>ยอดรวมสุทธิทั้งสิ้น</td><td></td><td style="text-align: right;">${Formatters.currency(inv.totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; text-align: center; margin-top: 2.5rem; font-size: 0.85rem;">
          <div><p>ผู้จ่ายเงิน</p><br><p>(..............................................)</p></div>
          <div><p>ผู้รับเงิน</p><br><p>(..............................................)</p></div>
        </div>
      </div>
    `;

    window.print();
  }

  private static openRoomModal(room?: any): void {
    const modal = document.getElementById('app-modal')!;
    const dialog = modal.querySelector('.modal-dialog')!;

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-building text-primary"></i> ${room ? 'แก้ไขห้องพัก' : 'เพิ่มห้องพักใหม่'}</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="room-form">
          <div class="form-group">
            <label>หมายเลขห้อง *</label>
            <input type="text" id="rm-name" class="form-control" value="${room ? room.name : ''}" required placeholder="เช่น A105">
          </div>
          <div class="form-group">
            <label>ชั้น *</label>
            <input type="number" id="rm-floor" class="form-control" value="${room ? room.floor : 1}" required>
          </div>
          <div class="form-group">
            <label>ราคาค่าเช่าต่อเดือน (บาท) *</label>
            <input type="number" id="rm-rent" class="form-control" value="${room ? room.baseRent : 3500}" required>
          </div>
          <button type="submit" class="btn btn-primary btn-full"><i class="fa-solid fa-save"></i> บันทึกห้องพัก</button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn')!.addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('room-form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = AuthService.getCurrentUser()!;
      const name = (document.getElementById('rm-name') as HTMLInputElement).value;
      const floor = parseInt((document.getElementById('rm-floor') as HTMLInputElement).value, 10);
      const baseRent = parseFloat((document.getElementById('rm-rent') as HTMLInputElement).value);

      if (room) {
        room.name = name;
        room.floor = floor;
        room.baseRent = baseRent;
        LoggerService.log(user.username, user.role, 'UPDATE', 'ROOMS', `แก้ไขห้อง ${name}`);
      } else {
        const newRoom = {
          id: 'r_' + Date.now(),
          name, floor, baseRent,
          typeId: 'rt_air',
          status: 'vacant',
          lastWaterMeter: 0,
          lastElecMeter: 0
        };
        this.state.rooms.push(newRoom as any);
        LoggerService.log(user.username, user.role, 'CREATE', 'ROOMS', `เพิ่มห้องใหม่ ${name}`);
      }

      DBService.saveState(this.state);
      modal.classList.remove('active');
      this.showToast('บันทึกข้อมูลห้องเรียบร้อย', 'success');
      this.switchTab('rooms');
    });
  }

  private static openCreateBillModal(): void {
    const modal = document.getElementById('app-modal')!;
    const dialog = modal.querySelector('.modal-dialog')!;

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-calculator text-primary"></i> คำนวณและออกบิลประจำเดือนใหม่</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="create-bill-form">
          <div class="form-group">
            <label>เลือกห้องพัก:</label>
            <select id="bill-room-select" class="form-control" required>
              <option value="">-- เลือกห้องพัก --</option>
              ${this.state.rooms.map(r => `<option value="${r.id}">ห้อง ${r.name} (${r.currentTenantName || 'ไม่มีผู้เช่า'})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>มิเตอร์น้ำปัจจุบัน:</label>
            <input type="number" id="bill-water-curr" class="form-control" required placeholder="ป้อนตัวเลขมิเตอร์น้ำ">
          </div>
          <div class="form-group">
            <label>มิเตอร์ไฟปัจจุบัน:</label>
            <input type="number" id="bill-elec-curr" class="form-control" required placeholder="ป้อนตัวเลขมิเตอร์ไฟ">
          </div>
          <button type="submit" class="btn btn-primary btn-full"><i class="fa-solid fa-circle-check"></i> คำนวณบิลและออกเอกสาร</button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn')!.addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('create-bill-form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const roomId = (document.getElementById('bill-room-select') as HTMLSelectElement).value;
      const room = this.state.rooms.find(r => r.id === roomId);
      if (!room) return;

      const waterCurr = parseFloat((document.getElementById('bill-water-curr') as HTMLInputElement).value);
      const elecCurr = parseFloat((document.getElementById('bill-elec-curr') as HTMLInputElement).value);

      const waterUsed = Math.max(0, waterCurr - room.lastWaterMeter);
      const elecUsed = Math.max(0, elecCurr - room.lastElecMeter);

      const waterAmount = waterUsed * this.state.rates.waterRate;
      const elecAmount = elecUsed * this.state.rates.electricityRate;
      const totalAmount = room.baseRent + waterAmount + elecAmount + this.state.rates.trashFee;

      const monthKey = new Date().toISOString().slice(0, 7);
      const newInv = {
        id: 'inv_' + Date.now(),
        invoiceNumber: `INV${monthKey.replace('-','')}-${room.name}`,
        monthKey,
        roomId: room.id,
        roomName: room.name,
        tenantId: room.currentTenantId || 't1',
        tenantName: room.currentTenantName || 'ผู้เช่า',
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 5*24*3600*1000).toISOString().slice(0, 10),
        waterPrev: room.lastWaterMeter,
        waterCurr,
        elecPrev: room.lastElecMeter,
        elecCurr,
        rentAmount: room.baseRent,
        waterAmount,
        elecAmount,
        trashFee: this.state.rates.trashFee,
        internetFee: 0, commonFee: 0, otherFee: 0, fineAmount: 0,
        totalAmount,
        paidAmount: 0,
        outstandingAmount: totalAmount,
        status: 'unpaid'
      };

      room.lastWaterMeter = waterCurr;
      room.lastElecMeter = elecCurr;

      this.state.invoices.unshift(newInv as any);
      DBService.saveState(this.state);

      modal.classList.remove('active');
      this.showToast(`ออกบิลห้อง ${room.name} สำเร็จ ยอดรวม ฿${totalAmount.toLocaleString()}`, 'success');
      this.switchTab('billing');
    });
  }

  private static openAddRepairModal(): void {
    const modal = document.getElementById('app-modal')!;
    const dialog = modal.querySelector('.modal-dialog')!;

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-screwdriver-wrench text-primary"></i> บันทึกการแจ้งซ่อมใหม่</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="repair-form">
          <div class="form-group">
            <label>ห้องพัก:</label>
            <select id="rep-room" class="form-control" required>
              ${this.state.rooms.map(r => `<option value="${r.id}">ห้อง ${r.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>หัวข้อแจ้งซ่อม *</label>
            <input type="text" id="rep-title" class="form-control" required placeholder="เช่น ท่อน้ำอุดตัน, แอร์ไม่เย็น">
          </div>
          <div class="form-group">
            <label>รายละเอียดอาการ:</label>
            <textarea id="rep-desc" class="form-control" rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>ประมาณการค่าซ่อม (บาท):</label>
            <input type="number" id="rep-cost" class="form-control" value="0">
          </div>
          <button type="submit" class="btn btn-primary btn-full"><i class="fa-solid fa-save"></i> บันทึกใบแจ้งซ่อม</button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn')!.addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('repair-form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const roomId = (document.getElementById('rep-room') as HTMLSelectElement).value;
      const room = this.state.rooms.find(r => r.id === roomId);
      const title = (document.getElementById('rep-title') as HTMLInputElement).value;
      const desc = (document.getElementById('rep-desc') as HTMLTextAreaElement).value;
      const cost = parseFloat((document.getElementById('rep-cost') as HTMLInputElement).value) || 0;

      const newRep = {
        id: 'rep_' + Date.now(),
        ticketNumber: `REP-${Date.now().toString().slice(-4)}`,
        roomId,
        roomName: room ? room.name : '-',
        tenantName: room ? (room.currentTenantName || 'ผู้เช่า') : 'ผู้เช่า',
        title,
        description: desc,
        category: 'other',
        photoUrls: [],
        requestDate: new Date().toISOString().slice(0, 10),
        status: 'pending',
        expenseAmount: cost
      };

      this.state.repairs.unshift(newRep as any);
      DBService.saveState(this.state);
      modal.classList.remove('active');
      this.showToast('บันทึกแจ้งซ่อมเรียบร้อย', 'success');
      this.switchTab('repairs');
    });
  }

  private static openAddLedgerModal(): void {
    const modal = document.getElementById('app-modal')!;
    const dialog = modal.querySelector('.modal-dialog')!;

    dialog.innerHTML = `
      <div class="modal-header">
        <h3><i class="fa-solid fa-scale-balanced text-primary"></i> บันทึกรายการรายรับ-รายจ่าย</h3>
        <button class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <form id="ledger-form">
          <div class="form-group">
            <label>ประเภทรายการ *</label>
            <select id="led-type" class="form-control" required>
              <option value="income">🟢 รายรับ (+)</option>
              <option value="expense">🔴 รายจ่าย (-)</option>
            </select>
          </div>
          <div class="form-group">
            <label>รายละเอียดคำอธิบาย *</label>
            <input type="text" id="led-desc" class="form-control" required placeholder="เช่น ค่าแม่บ้านทำความสะอาดประจำเดือน">
          </div>
          <div class="form-group">
            <label>จำนวนเงิน (บาท) *</label>
            <input type="number" id="led-amount" class="form-control" required placeholder="0.00">
          </div>
          <button type="submit" class="btn btn-primary btn-full"><i class="fa-solid fa-save"></i> บันทึกบัญชี</button>
        </form>
      </div>
    `;

    modal.classList.add('active');
    modal.querySelector('.close-modal-btn')!.addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('ledger-form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = AuthService.getCurrentUser()!;
      const type = (document.getElementById('led-type') as HTMLSelectElement).value as any;
      const desc = (document.getElementById('led-desc') as HTMLInputElement).value;
      const amount = parseFloat((document.getElementById('led-amount') as HTMLInputElement).value) || 0;

      const newEntry = {
        id: 'led_' + Date.now(),
        date: new Date().toISOString().slice(0, 10),
        type,
        category: 'other',
        description: desc,
        amount,
        recordedBy: user.username
      };

      this.state.ledger.unshift(newEntry as any);
      DBService.saveState(this.state);
      modal.classList.remove('active');
      this.showToast('บันทึกบัญชีเรียบร้อย', 'success');
      this.switchTab('accounting');
    });
  }

  private static showToast(message: string, type: 'success' | 'danger' | 'warning' = 'success'): void {
    const container = document.getElementById('toast-container')!;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fa-solid fa-circle-check text-${type}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideInRight 0.3s reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Global Launcher on Window Load
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
