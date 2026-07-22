import { Formatters } from '../utils/formatters.js';
import { UIHelpers } from '../utils/helpers.js';
import { ExportService } from '../services/export.js';

/**
 * ReportsComponent, AccountingComponent & CalendarComponent Class
 * Handles financial reports, accounting ledger, export to CSV, and appointment calendars matching style.css
 */
export class ReportsComponent {
  static renderHeader() {
    return `
      <div class="view-header">
        <div>
          <h2><i class="fa-solid fa-chart-line text-primary"></i> รายงานสรุปการเงินและสถิติหอพัก</h2>
          <p>สรุปรายรับ-รายจ่าย รายงานค่าน้ำค่าไฟ ประจำเดือน และส่งออกข้อมูลเป็น CSV</p>
        </div>
        <div class="header-actions">
          <button id="btn-export-financial-csv" class="btn btn-success"><i class="fa-solid fa-file-csv"></i> ส่งออกรายงาน CSV</button>
        </div>
      </div>
    `;
  }

  static renderSummary(financialSummary, rooms) {
    const roomSummary = UIHelpers.calculateRoomSummary(rooms);

    return `
      <div class="kpi-cards-grid">
        <div class="kpi-card card-green">
          <div class="kpi-icon"><i class="fa-solid fa-money-bill-wave"></i></div>
          <div class="kpi-content">
            <span class="label">รายรับรวมสุทธิ</span>
            <h3 class="value text-success">${Formatters.currency(financialSummary.totalIncome)}</h3>
          </div>
        </div>

        <div class="kpi-card card-red">
          <div class="kpi-icon"><i class="fa-solid fa-file-circle-exclamation"></i></div>
          <div class="kpi-content">
            <span class="label">ยอดค้างชำระรวม</span>
            <h3 class="value text-danger">${Formatters.currency(financialSummary.totalOutstanding)}</h3>
          </div>
        </div>

        <div class="kpi-card card-blue">
          <div class="kpi-icon"><i class="fa-solid fa-chart-pie"></i></div>
          <div class="kpi-content">
            <span class="label">อัตราครองห้อง</span>
            <h3 class="value text-primary">${roomSummary.occupancyRate}%</h3>
          </div>
        </div>
      </div>
    `;
  }

  static render(state = {}) {
    const invoices = state.invoices || [];
    const rooms = state.rooms || [];
    const financialSummary = UIHelpers.calculateFinancialSummary(invoices);

    return `
      <div class="reports-view">
        ${this.renderHeader()}
        ${this.renderSummary(financialSummary, rooms)}
      </div>
    `;
  }
}

export class AccountingComponent {
  static render(state = {}) {
    const ledger = state.ledger || [];
    const rowsHtml = ledger.length > 0 ? ledger.map(item => {
      const isIncome = item.type === 'income';
      return `
        <tr>
          <td>${item.date}</td>
          <td>${UIHelpers.badge(isIncome ? 'รายรับ' : 'รายจ่าย', isIncome ? 'success' : 'danger')}</td>
          <td>${item.category}</td>
          <td>${item.description}</td>
          <td><strong>${Formatters.currency(item.amount)}</strong></td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="5" class="text-center text-muted">ยังไม่มีรายการบัญชี</td></tr>`;

    return `
      <div class="accounting-view">
        <div class="view-header">
          <h2><i class="fa-solid fa-book text-primary"></i> บัญชีรายรับ - รายจ่าย (Accounting Ledger)</h2>
        </div>
        <div class="glass-card">
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ประเภท</th>
                  <th>หมวดหมู่</th>
                  <th>รายละเอียด</th>
                  <th>จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

export class CalendarComponent {
  static render(state = {}) {
    const events = state.events || [];
    return `
      <div class="calendar-view">
        <div class="view-header">
          <h2><i class="fa-solid fa-calendar-days text-primary"></i> ปฏิทินนัดหมายและกิจกรรม</h2>
        </div>
        <div class="glass-card p-4">
          <p class="text-muted">รายการนัดหมายเข้าพัก ชำระเงิน และตรวจเช็กมิเตอร์</p>
        </div>
      </div>
    `;
  }
}
