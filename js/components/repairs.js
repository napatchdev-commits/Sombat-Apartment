import { Formatters } from '../utils/formatters.js';
export class RepairsComponent {
  static render(state) {
    const repairs = state.repairs || [];

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div><h2><i class="fa-solid fa-screwdriver-wrench text-primary"></i> ระบบแจ้งซ่อมและซ่อมบำรุงห้องพัก</h2><p>ติดตามคำขอแจ้งซ่อมจากผู้เช่า แนบรูปถ่าย และบันทึกค่าใช้จ่ายงานซ่อมบำรุง</p></div>
          <div class="header-actions">
            <button id="btn-add-repair" class="btn btn-primary"><i class="fa-solid fa-plus"></i> เพิ่มรายการแจ้งซ่อมใหม่</button>
          </div>
        </div>

        <div class="glass-card style-table-card">
          <div class="table-responsive">
            <table class="custom-table">
              <thead><tr><th>เลขที่ใบซ่อม</th><th>ห้องพัก</th><th>ผู้แจ้งซ่อม</th><th>หัวข้อแจ้งซ่อม / รายละเอียด</th><th>ช่างรับงาน</th><th>ค่าซ่อม</th><th>สถานะ</th><th>การจัดการ</th></tr></thead>
              <tbody>
                ${repairs.length === 0 ? `
                  <tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">ยังไม่มีรายการแจ้งซ่อม</td></tr>
                ` : repairs.map(rep => `
                  <tr>
                    <td><strong>${rep.ticketNumber}</strong></td>
                    <td><span class="badge-pill badge-primary">ห้อง ${rep.roomName}</span></td>
                    <td>${rep.tenantName || '-'}</td>
                    <td><strong>${rep.title}</strong><div class="text-muted text-sm">${rep.description || ''}</div></td>
                    <td>${rep.assignedTechnician || 'ยังไม่ระบุช่าง'}</td>
                    <td><strong class="text-danger">${Formatters.currency(rep.expenseAmount)}</strong></td>
                    <td>
                      <span class="badge-pill ${rep.status === 'completed' ? 'badge-success' : 'badge-warning'}">
                        ${rep.status === 'completed' ? '🟢 เสร็จสิ้น' : '🟡 กำลังซ่อม'}
                      </span>
                    </td>
                    <td>
                      <div class="action-buttons">
                        <button class="btn btn-secondary btn-xs btn-toggle-repair" data-id="${rep.id}">${rep.status === 'completed' ? 'ปรับเป็นกำลังซ่อม' : 'ปรับเป็นเสร็จสิ้น'}</button>
                        <button class="btn btn-danger btn-xs btn-delete-repair" data-id="${rep.id}"><i class="fa-solid fa-trash"></i> ลบ</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

class AccountingComponent {
