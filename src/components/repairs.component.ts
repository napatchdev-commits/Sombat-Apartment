// ==========================================================================
// REPAIRS COMPONENT (MAINTENANCE TICKETS & REPAIR EXPENSE TRACKER)
// ==========================================================================

import { DatabaseState } from '../services/db.service';
import { Formatters } from '../utils/formatters';

export class RepairsComponent {
  public static render(state: DatabaseState): string {
    const repairs = state.repairs;

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-screwdriver-wrench text-primary"></i> ระบบแจ้งซ่อมและซ่อมบำรุงห้องพัก</h2>
            <p>ติดตามคำขอแจ้งซ่อมจากผู้เช่า แนบรูปถ่าย และบันทึกค่าใช้จ่ายงานซ่อมบำรุง</p>
          </div>
          <div class="header-actions">
            <button id="btn-add-repair" class="btn btn-primary"><i class="fa-solid fa-circle-plus"></i> บันทึกรายการแจ้งซ่อมใหม่</button>
          </div>
        </div>

        <!-- Repairs List Cards/Table -->
        <div class="glass-card style-table-card">
          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>เลขที่ใบซ่อม / วันที่</th>
                  <th>ห้องพัก</th>
                  <th>ผู้แจ้ง</th>
                  <th>หัวข้อแจ้งซ่อม / รายละเอียด</th>
                  <th>หมวดหมู่</th>
                  <th>ช่างผู้รับผิดชอบ</th>
                  <th>ค่าซ่อมบำรุง</th>
                  <th>สถานะงาน</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${repairs.map(rep => {
                  let statusBadge = '<span class="badge-pill badge-warning">🟡 รอรับเรื่อง</span>';
                  if (rep.status === 'in_progress') {
                    statusBadge = '<span class="badge-pill badge-primary">🔵 กำลังดำเนินการ</span>';
                  } else if (rep.status === 'completed') {
                    statusBadge = '<span class="badge-pill badge-success">🟢 ซ่อมเสร็จสิ้น</span>';
                  }

                  return `
                    <tr>
                      <td>
                        <strong>${rep.ticketNumber}</strong>
                        <div class="text-muted text-sm">${Formatters.thaiDate(rep.requestDate)}</div>
                      </td>
                      <td><span class="badge-pill badge-primary">ห้อง ${rep.roomName}</span></td>
                      <td>${rep.tenantName}</td>
                      <td>
                        <strong>${rep.title}</strong>
                        <div class="text-muted text-sm">${rep.description}</div>
                      </td>
                      <td><span class="badge-pill badge-gray">${rep.category}</span></td>
                      <td>${rep.assignedTechnician || 'ยังไม่ระบุ'}</td>
                      <td><strong class="text-danger">${Formatters.currency(rep.expenseAmount)}</strong></td>
                      <td>${statusBadge}</td>
                      <td>
                        <button class="btn btn-secondary btn-xs btn-update-repair" data-id="${rep.id}">
                          <i class="fa-solid fa-pen"></i> อัปเดตสถานะ
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}
