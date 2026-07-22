import { AuthService } from '../services/auth.js';

/**
 * NavbarComponent Class
 * Renders top header navigation bar matching style.css rules exactly
 */
export class NavbarComponent {
  static render(user, state = {}) {
    const roleBadge = user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'เจ้าของหอพัก' : 'พนักงาน';
    const repairs = state.repairs || [];
    const pendingRepairs = repairs.filter(r => r.status === 'pending');

    return `
      <header class="app-header">
        <div class="header-left">
          <button id="sidebar-toggle-btn" class="icon-btn" title="ซ่อน/แสดง เมนู">
            <i class="fa-solid fa-bars"></i>
          </button>
          <div class="global-search-container">
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
            <input type="text" id="global-search-input" class="global-search-input" placeholder="ค้นหาห้องพัก, ชื่อผู้เช่า, เลขบิล...">
          </div>
        </div>

        <div class="header-right">
          <!-- Notification Bell Dropdown -->
          <div class="notification-dropdown-wrapper">
            <button id="notification-bell-btn" class="icon-btn" title="การแจ้งเตือน">
              <i class="fa-solid fa-bell"></i>
              ${pendingRepairs.length > 0 ? `<span class="notification-badge">${pendingRepairs.length}</span>` : ''}
            </button>
            <div id="notification-menu" class="notification-menu-panel">
              <div class="notification-header">
                <h4><i class="fa-solid fa-bell text-warning"></i> การแจ้งเตือนซ่อมแซม</h4>
              </div>
              <div class="notification-body">
                ${pendingRepairs.length > 0 ? pendingRepairs.map(r => `
                  <div class="notification-item item-warning" data-id="${r.id}">
                    <i class="fa-solid fa-wrench"></i>
                    <div>
                      <strong>ห้อง ${r.roomName}: ${r.title}</strong>
                      <small style="display:block;">${r.requestDate}</small>
                    </div>
                  </div>
                `).join('') : '<p class="text-muted p-2 text-center" style="margin:0;">ไม่มีการแจ้งซ่อมใหม่</p>'}
              </div>
            </div>
          </div>

          <!-- User Profile Badge -->
          <div class="user-profile-badge" id="navbar-user-profile" title="ดูโปรไฟล์ / เปลี่ยนรหัสผ่าน" style="cursor:pointer;">
            <div class="avatar"><i class="fa-solid fa-user-gear"></i></div>
            <span class="name">${user.displayName}</span>
            <span class="role-pill role-${user.role}">${roleBadge}</span>
          </div>

          <!-- Logout Button -->
          <button id="navbar-logout-btn" class="icon-btn" title="ออกจากระบบ" style="color:var(--danger); border-color:#fee2e2; background:#fef2f2;">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      </header>
    `;
  }
}
