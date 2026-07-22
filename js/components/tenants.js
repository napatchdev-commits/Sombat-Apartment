import { Formatters } from '../utils/formatters.js';
import { UIHelpers } from '../utils/helpers.js';

/**
 * TenantsComponent Class
 * Handles tenant registry, document attachments, and room assignments matching style.css
 */
export class TenantsComponent {
  static renderHeader() {
    return `
      <div class="view-header">
        <div>
          <h2><i class="fa-solid fa-users text-primary"></i> ทะเบียนผู้เช่า (Tenant Directory)</h2>
          <p>จัดการข้อมูลผู้เช่า เลขบัตรประชาชน เบอร์โทรศัพท์ และเอกสารประจำตัว</p>
        </div>
        <div class="header-actions">
          <button id="btn-add-tenant" class="btn btn-primary"><i class="fa-solid fa-user-plus"></i> ลงทะเบียนผู้เช่าใหม่</button>
        </div>
      </div>
    `;
  }

  static renderTable(tenants = [], rooms = []) {
    if (tenants.length === 0) return UIHelpers.emptyState('ยังไม่มีข้อมูลผู้เช่าในระบบ');

    const rowsHtml = tenants.map(tenant => {
      const room = rooms.find(r => r.id === tenant.assignedRoomId);
      const roomName = room ? room.name : '-';
      const formattedId = Formatters.formatIdCard(tenant.idCard);
      const formattedTel = Formatters.formatTel(tenant.tel);

      return `
        <tr>
          <td><strong>คุณ${tenant.name}</strong></td>
          <td><code>${formattedId}</code></td>
          <td>${formattedTel}</td>
          <td><span class="badge badge-info">ห้อง ${roomName}</span></td>
          <td>${Formatters.thaiDate(tenant.startDate)}</td>
          <td>
            <div class="btn-group">
              <button class="btn btn-xs btn-secondary btn-edit-tenant" data-id="${tenant.id}"><i class="fa-solid fa-pen"></i> แก้ไข</button>
              <button class="btn btn-xs btn-info btn-view-tenant-contract" data-id="${tenant.id}"><i class="fa-solid fa-file-contract"></i> ดูสัญญา</button>
              <button class="btn btn-xs btn-danger btn-delete-tenant" data-id="${tenant.id}"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="glass-card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>ชื่อ-นามสกุล</th>
                <th>เลขบัตรประชาชน</th>
                <th>เบอร์โทรศัพท์</th>
                <th>ห้องพัก</th>
                <th>วันเริ่มสัญญา</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  static render(state = {}) {
    const tenants = state.tenants || [];
    const rooms = state.rooms || [];
    return `
      <div class="tenants-view">
        ${this.renderHeader()}
        ${this.renderTable(tenants, rooms)}
      </div>
    `;
  }
}
