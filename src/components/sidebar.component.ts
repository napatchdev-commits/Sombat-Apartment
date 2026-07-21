// ==========================================================================
// SIDEBAR COMPONENT (NAVIGATION WITH CONTRACTS & SHEETS SYNC)
// ==========================================================================

import { UserRole } from '../types/user.types';
import { AuthService } from '../services/auth.service';

export interface SidebarMenuItem {
  id: string;
  label: string;
  icon: string;
  roles: UserRole[];
  badgeCount?: number;
}

export class SidebarComponent {
  public static getMenuItems(): SidebarMenuItem[] {
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

  public static render(activeTabId: string, apartmentName: string): string {
    const user = AuthService.getCurrentUser();
    const role = user ? user.role : 'staff';
    const items = this.getMenuItems().filter(item => item.roles.includes(role));

    return `
      <aside class="app-sidebar" id="app-sidebar">
        <!-- Logo Branding Top -->
        <div class="sidebar-brand">
          <div class="brand-logo-icon">
            <i class="fa-solid fa-house-lock"></i>
          </div>
          <div class="brand-title">
            <h2>${apartmentName}</h2>
            <span>ระบบจัดการห้องเช่า Enterprise</span>
          </div>
        </div>

        <!-- Navigation Links -->
        <nav class="sidebar-nav">
          <ul>
            ${items.map(item => `
              <li class="${activeTabId === item.id ? 'active' : ''}">
                <a href="#${item.id}" data-tab="${item.id}">
                  <i class="fa-solid ${item.icon} nav-icon"></i>
                  <span>${item.label}</span>
                </a>
              </li>
            `).join('')}
          </ul>
        </nav>

        <!-- Sidebar Footer -->
        <div class="sidebar-footer">
          <p><i class="fa-solid fa-cloud"></i> บันทึกซิงค์ Google Sheets</p>
          <span class="version">v3.5 Enterprise Edition</span>
        </div>
      </aside>
    `;
  }
}
