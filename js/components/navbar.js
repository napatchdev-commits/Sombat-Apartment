import { AuthService } from '../services/auth.js';

/**
 * NavbarComponent Class
 * Renders top navigation bar, quick search, user profile, and notifications
 */
export class NavbarComponent {
  static render(user, state = {}) {
    const roleBadge = user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'เจ้าของหอพัก' : 'พนักงาน';
    const repairs = state.repairs || [];
    const pendingRepairs = repairs.filter(r => r.status === 'pending');

    return `
      <header class="app-navbar">
        <div class="navbar-left">
          <button id="sidebar-toggle-btn" class="icon-btn" title="ซ่อน/แสดง เมนู">
            <i class="fa-solid fa-bars"></i>
          </button>
          <div class="search-box">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="global-search-input" placeholder="ค้นหาห้องพัก, ชื่อผู้เช่า, เลขบิล...">
          </div>
        </div>

        <div class="navbar-right">
          <!-- Notification Bell -->
          <div class="notification-wrapper">
            <button id="notification-bell-btn" class="icon-btn" title="การแจ้งเตือน">
              <i class="fa-solid fa-bell"></i>
              ${pendingRepairs.length > 0 ? `<span class="badge-count">${pendingRepairs.length}</span>` : ''}
            </button>
            <div id="notification-menu" class="notification-dropdown">
              <div class="dropdown-header">
                <h4><i class="fa-solid fa-bell text-warning"></i> การแจ้งเตือนซ่อมแซม</h4>
              </div>
              <div class="dropdown-body">
                ${pendingRepairs.length > 0 ? pendingRepairs.map(r => `
                  <div class="notify-item" data-id="${r.id}">
                    <i class="fa-solid fa-wrench text-warning"></i>
                    <div>
                      <strong>ห้อง ${r.roomName}: ${r.title}</strong>
                      <small>${r.requestDate}</small>
                    </div>
                  </div>
                `).join('') : '<p class="text-muted p-2 text-center">ไม่มีการแจ้งซ่อมใหม่</p>'}
              </div>
            </div>
          </div>

          <!-- User Profile Badge -->
          <div class="user-profile-badge" id="navbar-user-profile" title="ดูโปรไฟล์ / เปลี่ยนรหัสผ่าน">
            <div class="avatar">${user.displayName.charAt(0)}</div>
            <div class="user-info">
              <span class="user-name">${user.displayName}</span>
              <span class="user-role">${roleBadge}</span>
            </div>
          </div>

          <!-- Logout Button -->
          <button id="navbar-logout-btn" class="icon-btn btn-logout-nav" title="ออกจากระบบ">
            <i class="fa-solid fa-right-from-bracket text-danger"></i>
          </button>
        </div>
      </header>
    `;
  }
}
