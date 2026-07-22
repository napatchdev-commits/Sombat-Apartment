import { Formatters } from '../utils/formatters.js';
import { UIHelpers } from '../utils/helpers.js';

/**
 * RepairsComponent Class
 * Handles maintenance tickets, repair requests, and technician assignments matching style.css
 */
export class RepairsComponent {
  static renderHeader() {
    return `
      <div class="view-header">
        <div>
          <h2><i class="fa-solid fa-wrench text-primary"></i> รายการแจ้งซ่อมแซมและดูแลหอพัก</h2>
          <p>บันทึกเรื่องแจ้งซ่อม อุปกรณ์ชำรุด ติดตามสถานะการซ่อม และบันทึกค่าใช้จ่าย</p>
        </div>
        <div class="header-actions">
          <button id="btn-add-repair" class="btn btn-primary"><i class="fa-solid fa-plus"></i> แจ้งซ่อมแซมใหม่</button>
        </div>
      </div>
    `;
  }

  static renderTable(repairs = []) {
    if (repairs.length === 0) return UIHelpers.emptyState('ยังไม่มีรายการแจ้งซ่อมในระบบ');

    const rowsHtml = repairs.map(repair => {
      const isDone = repair.status === 'completed';
      const statusBadge = isDone 
        ? UIHelpers.badge('เสร็จสิ้น', 'success') 
        : UIHelpers.badge('รอดำเนินการ', 'warning');

      return `
        <tr>
          <td><strong>${repair.ticketNumber}</strong></td>
          <td><span class="badge badge-info">ห้อง ${repair.roomName}</span></td>
          <td><strong>${repair.title}</strong></td>
          <td>${repair.description || '-'}</td>
          <td>${Formatters.currency(repair.expenseAmount || 0)}</td>
          <td>${repair.requestDate}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn btn-xs ${isDone ? 'btn-outline-secondary' : 'btn-success'} btn-toggle-repair-status" data-id="${repair.id}">
              ${isDone ? 'ย้อนสถานะ' : 'ทำเสร็จแล้ว'}
            </button>
            <button class="btn btn-xs btn-danger btn-delete-repair" data-id="${repair.id}"><i class="fa-solid fa-trash"></i></button>
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
                <th>เลขที่ตั๋ว</th>
                <th>ห้องพัก</th>
                <th>หัวข้อแจ้งซ่อม</th>
                <th>รายละเอียด</th>
                <th>ค่าใช้จ่าย</th>
                <th>วันที่แจ้ง</th>
                <th>สถานะ</th>
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
    const repairs = state.repairs || [];
    return `
      <div class="repairs-view">
        ${this.renderHeader()}
        ${this.renderTable(repairs)}
      </div>
    `;
  }
}
