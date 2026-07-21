// ==========================================================================
// REPORTS COMPONENT (ANALYTICS REPORTS & PDF/EXCEL EXPORT)
// ==========================================================================

import { DatabaseState } from '../services/db.service';
import { Formatters } from '../utils/formatters';

export class ReportsComponent {
  public static render(state: DatabaseState): string {
    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-chart-line text-primary"></i> ระบบสรุปรายงานและการส่งออกข้อมูล (Reports & Analytics)</h2>
            <p>สรุปผลการดำเนินงาน รายรับ ยอดค้างชำระ รายงานห้องว่าง และส่งออกไฟล์ PDF / Excel ใน 1 คลิก</p>
          </div>
        </div>

        <!-- Reports Quick Cards Grid -->
        <div class="reports-grid-container">
          <!-- Report 1: Revenue Report -->
          <div class="glass-card report-card">
            <div class="report-icon text-success"><i class="fa-solid fa-money-bill-wave"></i></div>
            <h3>1. รายงานรายรับประจำเดือน</h3>
            <p class="text-muted">สรุปยอดเงินสดรับจากค่าเช่า ค่าน้ำ ค่าไฟ และค่าบริการทั้งหมดประจำรอบเดือน</p>
            <div class="report-actions">
              <button class="btn btn-secondary btn-sm btn-report-excel" data-type="revenue"><i class="fa-solid fa-file-excel text-success"></i> Export Excel</button>
              <button class="btn btn-primary btn-sm btn-report-pdf" data-type="revenue"><i class="fa-solid fa-file-pdf text-danger"></i> Export PDF</button>
            </div>
          </div>

          <!-- Report 2: Overdue Report -->
          <div class="glass-card report-card">
            <div class="report-icon text-danger"><i class="fa-solid fa-file-circle-exclamation"></i></div>
            <h3>2. รายงานผู้เช่าค้างชำระ</h3>
            <p class="text-muted">รายชื่อห้องพักและผู้เช่าที่เกินกำหนดชำระ พร้อมรายละเอียดเบอร์โทรและยอดหนี้คงค้าง</p>
            <div class="report-actions">
              <button class="btn btn-secondary btn-sm btn-report-excel" data-type="overdue"><i class="fa-solid fa-file-excel text-success"></i> Export Excel</button>
              <button class="btn btn-primary btn-sm btn-report-pdf" data-type="overdue"><i class="fa-solid fa-file-pdf text-danger"></i> Export PDF</button>
            </div>
          </div>

          <!-- Report 3: Vacancy Report -->
          <div class="glass-card report-card">
            <div class="report-icon text-info"><i class="fa-solid fa-door-open"></i></div>
            <h3>3. รายงานห้องว่างและจองแล้ว</h3>
            <p class="text-muted">รายการห้องพักว่าง อัตราค่าเช่า และสถานะห้องพักสำหรับเสนอขายผู้เช่ารายใหม่</p>
            <div class="report-actions">
              <button class="btn btn-secondary btn-sm btn-report-excel" data-type="vacancy"><i class="fa-solid fa-file-excel text-success"></i> Export Excel</button>
              <button class="btn btn-primary btn-sm btn-report-pdf" data-type="vacancy"><i class="fa-solid fa-file-pdf text-danger"></i> Export PDF</button>
            </div>
          </div>

          <!-- Report 4: Tenant List & Contract Expiry -->
          <div class="glass-card report-card">
            <div class="report-icon text-warning"><i class="fa-solid fa-id-card"></i></div>
            <h3>4. รายงานทะเบียนผู้เช่าและสัญญา</h3>
            <p class="text-muted">ทะเบียนผู้เช่าถาวร เลขบัตรประชาชน วันเริ่ม-สิ้นสุดสัญญาเช่า และเงินประกันมัดจำ</p>
            <div class="report-actions">
              <button class="btn btn-secondary btn-sm btn-report-excel" data-type="tenants"><i class="fa-solid fa-file-excel text-success"></i> Export Excel</button>
              <button class="btn btn-primary btn-sm btn-report-pdf" data-type="tenants"><i class="fa-solid fa-file-pdf text-danger"></i> Export PDF</button>
            </div>
          </div>
        </div>

        <!-- Preview Report Data Container -->
        <div class="glass-card style-table-card" style="margin-top: 2rem;">
          <div class="card-header">
            <h3><i class="fa-solid fa-table-list text-primary"></i> ตัวอย่างตารางข้อมูลสรุปรายงาน (Report Data Preview)</h3>
          </div>
          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>ห้องพัก</th>
                  <th>ผู้เช่า</th>
                  <th>สถานะบิล</th>
                  <th>ค่าเช่า</th>
                  <th>ค่าน้ำไฟ</th>
                  <th>ยอดรวมบิล</th>
                  <th>ยอดค้างชำระ</th>
                </tr>
              </thead>
              <tbody>
                ${state.invoices.map(inv => `
                  <tr>
                    <td><strong>ห้อง ${inv.roomName}</strong></td>
                    <td>${inv.tenantName}</td>
                    <td><span class="badge-pill ${inv.status === 'paid' ? 'badge-success' : 'badge-danger'}">${inv.status === 'paid' ? 'ชำระแล้ว' : 'ค้างชำระ'}</span></td>
                    <td>${Formatters.currency(inv.rentAmount)}</td>
                    <td>${Formatters.currency(inv.waterAmount + inv.elecAmount)}</td>
                    <td><strong>${Formatters.currency(inv.totalAmount)}</strong></td>
                    <td class="${inv.outstandingAmount > 0 ? 'text-danger' : 'text-success'}"><strong>${Formatters.currency(inv.outstandingAmount)}</strong></td>
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
