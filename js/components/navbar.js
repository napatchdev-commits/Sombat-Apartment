import { AuthService } from '../services/auth.js';
export class NavbarComponent {
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
          <a href="tenant.html" target="_blank" class="btn btn-secondary btn-sm" style="margin-right:0.5rem; text-decoration:none;" title="เปิดระบบแจ้งบิลผู้เช่า MyBills (สำหรับผู้เช่าล็อกอินสแกนสลิปผ่านเลขบัตรประชาชน)">
            <i class="fa-solid fa-mobile-screen-button text-success"></i> <span class="desktop-only">เปิดระบบบิลผู้เช่า MyBills</span>
          </a>

          <button id="btn-manual-sync-sheets" class="btn btn-secondary btn-sm" style="margin-right:0.5rem;" title="ดึงข้อมูลล่าสุดที่แก้ไขใน Google Sheets มาแสดงผลทันที">
            <i class="fa-solid fa-rotate text-primary"></i> <span class="desktop-only">ดึงข้อมูลจากชีตล่าสุด</span>
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
