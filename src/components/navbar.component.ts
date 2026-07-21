// ==========================================================================
// NAVBAR COMPONENT (HEADER, GLOBAL SEARCH & NOTIFICATION CENTER)
// ==========================================================================

import { UserAccount } from '../types/user.types';
import { DatabaseState } from '../services/db.service';

export class NavbarComponent {
  public static render(user: UserAccount, state: DatabaseState): string {
    // Calculate notifications
    const overdueCount = state.rooms.filter(r => r.status === 'overdue').length;
    const vacantCount = state.rooms.filter(r => r.status === 'vacant').length;
    
    // Check contracts expiring within 30 days
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
          <button id="mobile-toggle-btn" class="icon-btn mobile-only">
            <i class="fa-solid fa-bars"></i>
          </button>

          <!-- Global Real-time Search Box -->
          <div class="global-search-container">
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
            <input type="text" id="global-search-input" class="global-search-input" placeholder="ค้นหาห้องพัก, ผู้เช่า, เลขบัตร, บิล (Real-time)..." autocomplete="off">
          </div>
        </div>

        <div class="header-right">
          <!-- Notification Dropdown Bell -->
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
                    <div>
                      <strong>ผู้เช่าค้างชำระ: ${overdueCount} ห้อง</strong>
                      <p>มีห้องพักเกินกำหนดชำระเงิน กรุณาตรวจสอบในระบบออกบิล</p>
                    </div>
                  </div>
                ` : ''}

                ${expiringContracts > 0 ? `
                  <div class="notification-item item-warning">
                    <i class="fa-solid fa-file-contract icon"></i>
                    <div>
                      <strong>สัญญาใกล้หมดอายุ: ${expiringContracts} ราย</strong>
                      <p>มีผู้เช่าที่มีสัญญาเช่าหมดอายุภายใน 30 วันนี้</p>
                    </div>
                  </div>
                ` : ''}

                <div class="notification-item item-info">
                  <i class="fa-solid fa-door-open icon"></i>
                  <div>
                    <strong>ห้องว่างพร้อมเข้าอยู่: ${vacantCount} ห้อง</strong>
                    <p>สามารถลงทะเบียนผู้เช่าใหม่เข้าพักได้ทันที</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- User Profile & Role Pill -->
          <div class="user-profile-badge">
            <div class="avatar">
              <i class="fa-solid fa-user-shield"></i>
            </div>
            <div class="user-info">
              <span class="name">${user.displayName}</span>
              <span class="role-pill role-${user.role}">
                ${user.role === 'super_admin' ? '👑 Super Admin' : user.role === 'admin' ? '🛡️ Admin' : '👤 Staff'}
              </span>
            </div>
          </div>

          <!-- Logout Button -->
          <button id="logout-btn" class="btn btn-secondary btn-sm" title="ออกจากระบบ">
            <i class="fa-solid fa-right-from-bracket"></i>
            <span class="desktop-only">ออกจากระบบ</span>
          </button>
        </div>
      </header>
    `;
  }
}
