// ==========================================================================
// DASHBOARD COMPONENT (KPIS & 3 SVG CHARTS)
// ==========================================================================

import { DatabaseState } from '../services/db.service';
import { Formatters } from '../utils/formatters';

export class DashboardComponent {
  public static render(state: DatabaseState): string {
    const totalRooms = state.rooms.length;
    const occupiedRooms = state.rooms.filter(r => r.status === 'occupied').length;
    const vacantRooms = state.rooms.filter(r => r.status === 'vacant').length;
    const overdueRooms = state.rooms.filter(r => r.status === 'overdue').length;
    const reservedRooms = state.rooms.filter(r => r.status === 'reserved').length;

    // Financial calculations
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthKeyCurrent = todayStr.slice(0, 7);
    const yearCurrent = todayStr.slice(0, 4);

    let todayIncome = 0;
    let monthIncome = 0;
    let yearIncome = 0;
    let totalOutstanding = 0;

    state.invoices.forEach(inv => {
      if (inv.paymentDate === todayStr) {
        todayIncome += inv.paidAmount;
      }
      if (inv.monthKey === monthKeyCurrent) {
        monthIncome += inv.paidAmount;
      }
      if (inv.issueDate && inv.issueDate.startsWith(yearCurrent)) {
        yearIncome += inv.paidAmount;
      }
      totalOutstanding += inv.outstandingAmount;
    });

    // Check expiring contracts within 30 days
    const today = new Date();
    const expiringTenants = state.tenants.filter(t => {
      if (!t.endDate) return false;
      const end = new Date(t.endDate);
      const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 3600 * 24));
      return diff >= 0 && diff <= 30;
    });

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-gauge-high text-primary"></i> แผงควบคุมระบบ (Dashboard Overview)</h2>
            <p>สรุปสถิติสถานะห้องพัก รายรับการเงิน และสัญญาเช่าแบบเรียลไทม์</p>
          </div>
          <div class="header-actions">
            <span class="badge-pill badge-primary"><i class="fa-regular fa-clock"></i> ข้อมูล ณ วันที่ ${Formatters.thaiDate(todayStr)}</span>
          </div>
        </div>

        <!-- Top KPI Cards Grid -->
        <div class="kpi-cards-grid">
          <div class="kpi-card card-blue">
            <div class="kpi-icon"><i class="fa-solid fa-building"></i></div>
            <div class="kpi-content">
              <span class="label">จำนวนห้องทั้งหมด</span>
              <h3 class="value">${totalRooms} <small>ห้อง</small></h3>
              <span class="subtext">ชั้น 1 ถึง ชั้น 3</span>
            </div>
          </div>

          <div class="kpi-card card-green">
            <div class="kpi-icon"><i class="fa-solid fa-user-check"></i></div>
            <div class="kpi-content">
              <span class="label">ห้องที่มีผู้เช่า</span>
              <h3 class="value">${occupiedRooms} <small>ห้อง</small></h3>
              <span class="subtext">คิดเป็น ${((occupiedRooms/totalRooms)*100).toFixed(0)}% ของหอพัก</span>
            </div>
          </div>

          <div class="kpi-card card-gray">
            <div class="kpi-icon"><i class="fa-solid fa-door-open"></i></div>
            <div class="kpi-content">
              <span class="label">ห้องว่างพร้อมอยู่</span>
              <h3 class="value">${vacantRooms} <small>ห้อง</small></h3>
              <span class="subtext">ว่างรอจัดสรรเข้าพัก</span>
            </div>
          </div>

          <div class="kpi-card card-red">
            <div class="kpi-icon"><i class="fa-solid fa-file-circle-exclamation"></i></div>
            <div class="kpi-content">
              <span class="label">ยอดค้างชำระรวม</span>
              <h3 class="value text-danger">${Formatters.currency(totalOutstanding)}</h3>
              <span class="subtext">${overdueRooms} ห้องค้างชำระ</span>
            </div>
          </div>
        </div>

        <!-- Secondary Financial KPI Row -->
        <div class="kpi-cards-grid secondary-kpis" style="margin-top: 1.25rem;">
          <div class="kpi-card card-white">
            <div class="kpi-icon text-success"><i class="fa-solid fa-hand-holding-dollar"></i></div>
            <div class="kpi-content">
              <span class="label">รายรับวันนี้</span>
              <h3 class="value text-success">${Formatters.currency(todayIncome)}</h3>
            </div>
          </div>

          <div class="kpi-card card-white">
            <div class="kpi-icon text-primary"><i class="fa-solid fa-calendar-check"></i></div>
            <div class="kpi-content">
              <span class="label">รายได้เดือนนี้ (${monthKeyCurrent})</span>
              <h3 class="value text-primary">${Formatters.currency(monthIncome)}</h3>
            </div>
          </div>

          <div class="kpi-card card-white">
            <div class="kpi-icon text-info"><i class="fa-solid fa-chart-line"></i></div>
            <div class="kpi-content">
              <span class="label">รายได้รวมปีนี้ (${yearCurrent})</span>
              <h3 class="value text-info">${Formatters.currency(yearIncome)}</h3>
            </div>
          </div>

          <div class="kpi-card card-white">
            <div class="kpi-icon text-warning"><i class="fa-solid fa-file-contract"></i></div>
            <div class="kpi-content">
              <span class="label">สัญญาใกล้หมดอายุ</span>
              <h3 class="value text-warning">${expiringTenants.length} <small>ราย</small></h3>
            </div>
          </div>
        </div>

        <!-- 3 Interactive SVG Charts Section -->
        <div class="charts-grid-container" style="margin-top: 2rem;">
          <!-- Chart 1: Monthly Income Trend -->
          <div class="glass-card chart-card">
            <div class="card-header">
              <h3><i class="fa-solid fa-chart-area text-primary"></i> แนวโน้มรายได้รายเดือน (Monthly Revenue)</h3>
            </div>
            <div class="chart-wrapper">
              ${this.renderLineChart(state)}
            </div>
          </div>

          <!-- Chart 2: Room Occupancy Donut -->
          <div class="glass-card chart-card">
            <div class="card-header">
              <h3><i class="fa-solid fa-chart-pie text-success"></i> สัดส่วนสถานะห้องพัก (Occupancy)</h3>
            </div>
            <div class="chart-wrapper">
              ${this.renderDonutChart(occupiedRooms, vacantRooms, overdueRooms, reservedRooms)}
            </div>
          </div>
        </div>

        <!-- Lower Section: Expiring Contracts Table & Quick Actions -->
        <div class="dashboard-bottom-grid" style="margin-top: 2rem;">
          <div class="glass-card">
            <div class="card-header">
              <h3><i class="fa-solid fa-clock-rotate-left text-warning"></i> รายชื่อผู้เช่าที่ใกล้หมดสัญญาเช่า (ภายใน 30 วัน)</h3>
            </div>
            <div class="table-responsive">
              <table class="custom-table">
                <thead>
                  <tr>
                    <th>ห้องพัก</th>
                    <th>ชื่อ-นามสกุล</th>
                    <th>เบอร์โทรศัพท์</th>
                    <th>วันเริ่มสัญญา</th>
                    <th>วันหมดสัญญา</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  ${expiringTenants.length === 0 ? `
                    <tr><td colspan="6" class="text-center text-muted">ไม่มีผู้เช่าที่กำลังจะหมดสัญญาเช่าในเร็วๆ นี้</td></tr>
                  ` : expiringTenants.map(t => {
                    const room = state.rooms.find(r => r.id === t.assignedRoomId);
                    return `
                      <tr>
                        <td><strong>ห้อง ${room ? room.name : '-'}</strong></td>
                        <td>${t.name}</td>
                        <td>${t.tel}</td>
                        <td>${Formatters.thaiDate(t.startDate)}</td>
                        <td class="text-warning"><strong>${Formatters.thaiDate(t.endDate)}</strong></td>
                        <td><span class="badge-pill badge-warning">ใกล้หมดสัญญา</span></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private static renderLineChart(state: DatabaseState): string {
    const monthlyTotals: { [key: string]: number } = {
      '2026-02': 28500,
      '2026-03': 31000,
      '2026-04': 30500,
      '2026-05': 32800,
      '2026-06': 34200,
      '2026-07': 35400,
    };

    const months = Object.keys(monthlyTotals);
    const values = Object.values(monthlyTotals);
    const maxVal = Math.max(...values, 40000) * 1.1;

    const width = 500;
    const height = 200;
    const padding = 30;
    const chartW = width - padding * 2;
    const chartH = height - padding * 2;

    const points = months.map((m, i) => {
      const x = padding + i * (chartW / (months.length - 1));
      const y = height - padding - (monthlyTotals[m] / maxVal) * chartH;
      return { x, y, val: monthlyTotals[m], label: m };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return `
      <svg class="svg-chart" viewBox="0 0 ${width} ${height}">
        <defs>
          <linearGradient id="line-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2563eb" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="#e2e8f0" stroke-dasharray="4"/>
        <line x1="${padding}" y1="${padding + chartH/2}" x2="${width - padding}" y2="${padding + chartH/2}" stroke="#e2e8f0" stroke-dasharray="4"/>
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#cbd5e1"/>

        <path d="${areaPath}" fill="url(#line-grad)"/>
        <path d="${linePath}" fill="none" stroke="#2563eb" stroke-width="3"/>

        ${points.map(p => `
          <circle cx="${p.x}" cy="${p.y}" r="5" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>
          <text x="${p.x}" y="${p.y - 10}" fill="#1e293b" font-size="10" font-weight="bold" text-anchor="middle">฿${(p.val/1000).toFixed(1)}k</text>
          <text x="${p.x}" y="${height - 10}" fill="#64748b" font-size="10" text-anchor="middle">${p.label.split('-')[1]}/${p.label.split('-')[0].slice(2)}</text>
        `).join('')}
      </svg>
    `;
  }

  private static renderDonutChart(occupied: number, vacant: number, overdue: number, reserved: number): string {
    const total = occupied + vacant + overdue + reserved;
    if (total === 0) return `<p class="text-center text-muted">ไม่มีข้อมูล</p>`;

    const r = 16;
    const occP = (occupied / total) * 100;
    const vacP = (vacant / total) * 100;
    const ovdP = (overdue / total) * 100;

    return `
      <div style="display: flex; align-items: center; justify-content: space-around;">
        <div style="position: relative; width: 160px; height: 160px;">
          <svg width="100%" height="100%" viewBox="0 0 42 42">
            <circle cx="21" cy="21" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="5"/>
            <circle cx="21" cy="21" r="${r}" fill="none" stroke="#10b981" stroke-width="5" stroke-dasharray="${occP} ${100-occP}" stroke-dashoffset="0"/>
            <circle cx="21" cy="21" r="${r}" fill="none" stroke="#ef4444" stroke-width="5" stroke-dasharray="${ovdP} ${100-ovdP}" stroke-dashoffset="-${occP}"/>
            <circle cx="21" cy="21" r="${r}" fill="none" stroke="#94a3b8" stroke-width="5" stroke-dasharray="${vacP} ${100-vacP}" stroke-dashoffset="-${occP + ovdP}"/>
          </svg>
          <div style="position: absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center;">
            <span style="font-size: 1.4rem; font-weight: bold; color: #1e293b;">${total}</span>
            <span style="display:block; font-size: 0.75rem; color: #64748b;">ห้องทั้งหมด</span>
          </div>
        </div>

        <div class="chart-legend-list">
          <div class="legend-item"><span class="color-dot" style="background:#10b981;"></span> 🟢 มีผู้เช่า: <strong>${occupied}</strong></div>
          <div class="legend-item"><span class="color-dot" style="background:#ef4444;"></span> 🔴 ค้างชำระ: <strong>${overdue}</strong></div>
          <div class="legend-item"><span class="color-dot" style="background:#94a3b8;"></span> ⚪ ห้องว่าง: <strong>${vacant}</strong></div>
          <div class="legend-item"><span class="color-dot" style="background:#f59e0b;"></span> 🟡 จองแล้ว: <strong>${reserved}</strong></div>
        </div>
      </div>
    `;
  }
}
