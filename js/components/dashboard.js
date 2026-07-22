import { Formatters } from '../utils/formatters.js';
import { UIHelpers } from '../utils/helpers.js';

/**
 * DashboardComponent Class
 * Displays executive summary cards, occupancy statistics, and quick action panels
 */
export class DashboardComponent {
  static renderHeader(apartmentName) {
    return `
      <div class="workspace-header">
        <div>
          <h2><i class="fa-solid fa-chart-pie text-primary"></i> ภาพรวมระบบการบริหารหอพัก</h2>
          <p>สรุปสถิติสถานะห้องพัก ยอดรวมรายรับ บิลค้างชำระ และรายการซ่อมแซมล่าสุด</p>
        </div>
        <div class="header-actions">
          <button id="btn-quick-create-bill" class="btn btn-primary"><i class="fa-solid fa-calculator"></i> ออกบิลประจำเดือน</button>
        </div>
      </div>
    `;
  }

  static renderCards(roomSummary, financialSummary) {
    return `
      <div class="metrics-grid">
        <div class="metric-card glass-card">
          <div class="metric-icon icon-blue"><i class="fa-solid fa-building-user"></i></div>
          <div class="metric-details">
            <span class="metric-label">อัตราการเช่าพัก</span>
            <h3 class="metric-value">${roomSummary.occupancyRate}%</h3>
            <span class="metric-subtext">มีผู้เช่า ${roomSummary.occupied} / ${roomSummary.total} ห้อง</span>
          </div>
        </div>

        <div class="metric-card glass-card">
          <div class="metric-icon icon-green"><i class="fa-solid fa-hand-holding-dollar"></i></div>
          <div class="metric-details">
            <span class="metric-label">รายรับรวมที่ได้รับ</span>
            <h3 class="metric-value text-success">${Formatters.currency(financialSummary.totalIncome)}</h3>
            <span class="metric-subtext">ชำระแล้ว ${financialSummary.paidCount} รายการ</span>
          </div>
        </div>

        <div class="metric-card glass-card">
          <div class="metric-icon icon-red"><i class="fa-solid fa-clock-rotate-left"></i></div>
          <div class="metric-details">
            <span class="metric-label">ยอดค้างชำระคงเหลือ</span>
            <h3 class="metric-value text-danger">${Formatters.currency(financialSummary.totalOutstanding)}</h3>
            <span class="metric-subtext">รอชำระ ${financialSummary.unpaidCount} รายการ</span>
          </div>
        </div>

        <div class="metric-card glass-card">
          <div class="metric-icon icon-orange"><i class="fa-solid fa-door-open"></i></div>
          <div class="metric-details">
            <span class="metric-label">ห้องว่างพร้อมเช่า</span>
            <h3 class="metric-value text-warning">${roomSummary.vacant} ห้อง</h3>
            <span class="metric-subtext">เตรียมพร้อมต้อนรับผู้เช่าใหม่</span>
          </div>
        </div>
      </div>
    `;
  }

  static renderTables(state) {
    const invoices = (state.invoices || []).slice(0, 5);
    const repairs = (state.repairs || []).filter(r => r.status === 'pending').slice(0, 5);

    const invoicesRows = invoices.length > 0 ? invoices.map(inv => {
      const isPaid = inv.status === 'paid';
      const statusBadge = UIHelpers.badge(isPaid ? 'ชำระแล้ว' : 'ค้างชำระ', isPaid ? 'paid' : 'unpaid');
      return `
        <tr>
          <td><strong>ห้อง ${inv.roomName}</strong></td>
          <td>${inv.tenantName || 'ผู้เช่า'}</td>
          <td>${inv.monthKey}</td>
          <td><strong>${Formatters.currency(inv.totalAmount)}</strong></td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="5" class="text-center text-muted">ยังไม่มีรายการบิล</td></tr>`;

    const repairsRows = repairs.length > 0 ? repairs.map(rep => `
      <tr>
        <td><strong>ห้อง ${rep.roomName}</strong></td>
        <td>${rep.title}</td>
        <td>${rep.requestDate}</td>
        <td>${UIHelpers.badge('รอดำเนินการ', 'warning')}</td>
      </tr>
    `).join('') : `<tr><td colspan="4" class="text-center text-muted">ไม่มีรายการแจ้งซ่อมค้าง</td></tr>`;

    return `
      <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:1.5rem; margin-top:1.5rem;">
        <div class="glass-card style-table-card">
          <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="font-size:1.1rem; margin:0;"><i class="fa-solid fa-file-invoice text-primary"></i> รายการบิลล่าสุด</h3>
            <button class="btn btn-xs btn-outline-primary btn-switch-tab" data-tab="billing">ดูทั้งหมด</button>
          </div>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>ห้องพัก</th>
                  <th>ผู้เช่า</th>
                  <th>ประจำเดือน</th>
                  <th>ยอดรวม</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                ${invoicesRows}
              </tbody>
            </table>
          </div>
        </div>

        <div class="glass-card style-table-card">
          <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="font-size:1.1rem; margin:0;"><i class="fa-solid fa-wrench text-warning"></i> แจ้งซ่อมรอดำเนินการ</h3>
            <button class="btn btn-xs btn-outline-warning btn-switch-tab" data-tab="repairs">ดูทั้งหมด</button>
          </div>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>ห้องพัก</th>
                  <th>หัวข้อ</th>
                  <th>วันที่แจ้ง</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                ${repairsRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  static render(state = {}) {
    const settings = state.settings || {};
    const apartmentName = settings.apartmentName || 'หอพักสมบัติ นนทบุรี';

    const roomSummary = UIHelpers.calculateRoomSummary(state.rooms || []);
    const financialSummary = UIHelpers.calculateFinancialSummary(state.invoices || []);

    return `
      <div class="dashboard-view">
        ${this.renderHeader(apartmentName)}
        ${this.renderCards(roomSummary, financialSummary)}
        ${this.renderTables(state)}
      </div>
    `;
  }
}
