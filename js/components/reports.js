import { Formatters } from '../utils/formatters.js';
import { ExportService } from '../services/export.js';
export class AccountingComponent {
  static render(state) {
    const ledger = state.ledger || [];
    let totalIncome = 0; let totalExpense = 0;
    ledger.forEach(entry => {
      if (entry.type === 'income') totalIncome += entry.amount;
      else totalExpense += entry.amount;
    });

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div><h2><i class="fa-solid fa-scale-balanced text-primary"></i> ระบบบัญชี รายรับ - รายจ่าย (Accounting Ledger)</h2><p>บันทึกรายรับค่าน้ำไฟค่าเช่า และรายจ่ายแม่บ้าน ค่าซ่อมบำรุง ค่าน้ำไฟหลวง</p></div>
          <div class="header-actions">
            <button id="btn-add-ledger" class="btn btn-primary"><i class="fa-solid fa-plus"></i> บันทึกรายรับ-รายจ่ายใหม่</button>
          </div>
        </div>

        <div class="kpi-cards-grid">
          <div class="kpi-card card-green"><div class="kpi-content"><span class="label">รายรับรวม</span><h3 class="value text-success">${Formatters.currency(totalIncome)}</h3></div></div>
          <div class="kpi-card card-red"><div class="kpi-content"><span class="label">รายจ่ายรวม</span><h3 class="value text-danger">${Formatters.currency(totalExpense)}</h3></div></div>
          <div class="kpi-card card-blue"><div class="kpi-content"><span class="label">กำไรสุทธิ</span><h3 class="value text-primary">${Formatters.currency(totalIncome - totalExpense)}</h3></div></div>
        </div>

        <div class="glass-card style-table-card" style="margin-top:1.5rem;">
          <div class="table-responsive">
            <table class="custom-table">
              <thead><tr><th>วันที่</th><th>ประเภท</th><th>หมวดหมู่</th><th>รายการรายละเอียด</th><th>จำนวนเงิน</th><th>บันทึกโดย</th><th>การจัดการ</th></tr></thead>
              <tbody>
                ${ledger.map(l => `
                  <tr>
                    <td>${Formatters.thaiDate(l.date)}</td>
                    <td><span class="badge-pill ${l.type === 'income' ? 'badge-success' : 'badge-danger'}">${l.type === 'income' ? '📈 รายรับ' : '📉 รายจ่าย'}</span></td>
                    <td>${l.category}</td>
                    <td><strong>${l.description}</strong></td>
                    <td><strong class="${l.type === 'income' ? 'text-success' : 'text-danger'}">${Formatters.currency(l.amount)}</strong></td>
                    <td>${l.recordedBy || 'admin'}</td>
                    <td><button class="btn btn-danger btn-xs btn-delete-ledger" data-id="${l.id}"><i class="fa-solid fa-trash"></i> ลบ</button></td>
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

class CalendarComponent {

export class CalendarComponent {
  static render(state) {
    const events = state.events || [];

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div><h2><i class="fa-solid fa-calendar-days text-primary"></i> ปฏิทินงานและวันนัดหมาย (Event Calendar)</h2><p>รวมกำหนดการวันชำระค่าเช่า วันหมดอายุสัญญาเช่า และวันนัดซ่อมบำรุง</p></div>
          <div class="header-actions">
            <button id="btn-add-event" class="btn btn-primary"><i class="fa-solid fa-plus"></i> เพิ่มวันนัดหมายใหม่</button>
          </div>
        </div>

        <div class="glass-card">
          <h3 style="margin-bottom:1rem;"><i class="fa-solid fa-list-check text-primary"></i> รายการนัดหมายและกิจกรรมประจำเดือน</h3>
          <div class="table-responsive">
            <table class="custom-table">
              <thead><tr><th>วันที่นัดหมาย</th><th>หัวข้อนัดหมาย / กิจกรรม</th><th>หมวดหมู่</th><th>ห้องที่เกี่ยวข้อง</th><th>การจัดการ</th></tr></thead>
              <tbody>
                ${events.length === 0 ? `
                  <tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">ยังไม่มีวันนัดหมายในปฏิทิน</td></tr>
                ` : events.map(evt => `
                  <tr>
                    <td><strong>${Formatters.thaiDate(evt.date)}</strong></td>
                    <td><strong>${evt.title}</strong></td>
                    <td><span class="badge-pill badge-primary">${evt.category}</span></td>
                    <td>${evt.roomName || '-'}</td>
                    <td><button class="btn btn-danger btn-xs btn-delete-event" data-id="${evt.id}"><i class="fa-solid fa-trash"></i> ลบ</button></td>
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

class ReportsComponent {

export class ReportsComponent {
  static render(state) {
    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div><h2><i class="fa-solid fa-chart-line text-primary"></i> ระบบสรุปรายงานและการส่งออกข้อมูล</h2><p>สรุปผลการดำเนินงาน รายรับ ยอดค้างชำระ และส่งออกไฟล์ PDF / Excel 1-Click</p></div>
        </div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
          <div class="glass-card report-card">
            <h3><i class="fa-solid fa-file-invoice-dollar text-success"></i> 1. รายงานสรุปรายรับประจำเดือน</h3>
            <p class="text-muted">ส่งออกข้อมูลรายรับค่าเช่า ค่าน้ำ ค่าไฟ ของทุกห้องพัก</p>
            <button class="btn btn-success btn-sm btn-export-income-report" style="margin-top:1rem;"><i class="fa-solid fa-file-excel"></i> Export Excel (รายรับ)</button>
          </div>

          <div class="glass-card report-card">
            <h3><i class="fa-solid fa-user-clock text-danger"></i> 2. รายงานผู้เช่าค้างชำระเงิน</h3>
            <p class="text-muted">สรุปรายชื่อผู้เช่าที่ยังไม่ได้ชำระค่าเช่าตามกำหนด</p>
            <button class="btn btn-danger btn-sm btn-export-overdue-report" style="margin-top:1rem;"><i class="fa-solid fa-file-excel"></i> Export Excel (ค้างชำระ)</button>
          </div>

          <div class="glass-card report-card">
            <h3><i class="fa-solid fa-bolt text-warning"></i> 3. รายงานมิเตอร์น้ำ-ไฟประจำเดือน</h3>
            <p class="text-muted">สรุปหน่วยมิเตอร์น้ำประปาและไฟฟ้าทุกห้อง</p>
            <button class="btn btn-warning btn-sm btn-export-meter-report" style="margin-top:1rem;"><i class="fa-solid fa-file-excel"></i> Export Excel (มิเตอร์น้ำไฟ)</button>
          </div>

          <div class="glass-card report-card">
            <h3><i class="fa-solid fa-file-contract text-primary"></i> 4. รายงานประวัติสัญญาเช่าทั้งหมด</h3>
            <p class="text-muted">สรุปทะเบียนสัญญาเช่า วันเริ่มสัญญา และวันหมดอายุ</p>
            <button class="btn btn-primary btn-sm btn-export-contracts-report" style="margin-top:1rem;"><i class="fa-solid fa-file-excel"></i> Export Excel (สัญญาเช่า)</button>
          </div>
        </div>
      </div>
    `;
  }
}

class RatesComponent {
