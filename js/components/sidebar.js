import { AuthService } from '../services/auth.js';

/**
 * SidebarComponent Class
 * Renders sidebar navigation items according to user roles and permissions
 */
export class SidebarComponent {
  static getMenuItems() {
    return [
      { id: 'dashboard', label: 'ภาพรวมระบบ', icon: 'fa-solid fa-chart-pie', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'billing', label: 'ระบบออกบิล & ชำระเงิน', icon: 'fa-solid fa-file-invoice-dollar', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'rooms', label: 'ผังห้องพัก & สถานะ', icon: 'fa-solid fa-door-open', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'tenants', label: 'ทะเบียนผู้เช่า', icon: 'fa-solid fa-users', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'contracts', label: 'หนังสือสัญญาเช่า', icon: 'fa-solid fa-file-contract', roles: ['super_admin', 'admin'] },
      { id: 'repairs', label: 'แจ้งซ่อม & ดูแลหอ', icon: 'fa-solid fa-wrench', roles: ['super_admin', 'admin', 'staff'] },
      { id: 'reports', label: 'รายงานการเงิน & บัญชี', icon: 'fa-solid fa-chart-line', roles: ['super_admin', 'admin'] },
      { id: 'settings', label: 'ตั้งค่าระบบหอพัก', icon: 'fa-solid fa-sliders', roles: ['super_admin', 'admin'] }
    ];
  }

  static render(activeTabId, apartmentName = 'หอพักสมบัติ นนทบุรี') {
    const user = AuthService.getCurrentUser();
    const role = user ? user.role : 'staff';
    const menuItems = this.getMenuItems().filter(item => item.roles.includes(role));

    const menuHtml = menuItems.map(item => {
      const activeClass = item.id === activeTabId ? 'active' : '';
      return `
        <li class="sidebar-item ${activeClass}">
          <a href="#" class="sidebar-link" data-tab="${item.id}">
            <i class="${item.icon}"></i>
            <span>${item.label}</span>
          </a>
        </li>
      `;
    }).join('');

    return `
      <aside class="app-sidebar" id="app-sidebar">
        <div class="sidebar-brand">
          <div class="brand-logo-icon"><i class="fa-solid fa-house-lock"></i></div>
          <div class="brand-title">
            <h2>${apartmentName}</h2>
            <span>ระบบจัดการหอ Enterprise</span>
          </div>
        </div>

        <nav class="sidebar-menu">
          <ul>
            ${menuHtml}
          </ul>
        </nav>
      </aside>
    `;
  }
}
