// ==========================================================================
// CALENDAR COMPONENT (EVENT CALENDAR FOR PAYMENTS, CONTRACTS & REPAIRS)
// ==========================================================================

import { DatabaseState } from '../services/db.service';
import { Formatters } from '../utils/formatters';

export class CalendarComponent {
  public static render(state: DatabaseState): string {
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7);

    // Aggregate events
    const events: { date: string; type: 'due' | 'contract' | 'repair'; title: string; desc: string; badge: string }[] = [];

    // Billing Due Dates
    state.invoices.forEach(inv => {
      if (inv.status !== 'paid') {
        events.push({
          date: inv.dueDate,
          type: 'due',
          title: `💰 ครบกำหนดชำระบิล: ห้อง ${inv.roomName}`,
          desc: `ผู้เช่า: ${inv.tenantName} | ยอดค้าง: ${Formatters.currency(inv.outstandingAmount)}`,
          badge: 'badge-danger'
        });
      }
    });

    // Contract Expirations
    state.tenants.forEach(t => {
      if (t.endDate) {
        const room = state.rooms.find(r => r.id === t.assignedRoomId);
        events.push({
          date: t.endDate,
          type: 'contract',
          title: `📜 หมดอายุสัญญาเช่า: คุณ${t.name}`,
          desc: `ห้อง: ${room ? room.name : '-'} | เบอร์โทร: ${t.tel}`,
          badge: 'badge-warning'
        });
      }
    });

    // Maintenance Appointments
    state.repairs.forEach(rep => {
      if (rep.status !== 'completed') {
        events.push({
          date: rep.requestDate,
          type: 'repair',
          title: `🛠️ นัดหมายซ่อมบำรุง: ห้อง ${rep.roomName}`,
          desc: `หัวข้อ: ${rep.title} (${rep.assignedTechnician || 'ช่างหอพัก'})`,
          badge: 'badge-primary'
        });
      }
    });

    // Sort by date ascending
    events.sort((a, b) => a.date.localeCompare(b.date));

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-calendar-days text-primary"></i> ปฏิทินงานและวันนัดหมาย (Event Calendar)</h2>
            <p>รวมกำหนดการวันชำระค่าเช่า วันหมดอายุสัญญาเช่า และวันนัดซ่อมบำรุงในระบบ</p>
          </div>
          <div class="header-actions">
            <span class="badge-pill badge-primary"><i class="fa-solid fa-calendar"></i> เดือนปัจจุบัน: ${Formatters.thaiMonthBE(currentMonthStr)}</span>
          </div>
        </div>

        <div class="calendar-layout-grid">
          <!-- Left: Timeline Events List -->
          <div class="glass-card">
            <div class="card-header">
              <h3><i class="fa-solid fa-list-check text-primary"></i> กำหนดการและแจ้งเตือนเร็วๆ นี้</h3>
            </div>
            <div class="timeline-events-list">
              ${events.length === 0 ? `
                <p class="text-muted text-center" style="padding: 2rem;">ไม่มีกำหนดการนัดหมายหรือแจ้งเตือนในขณะนี้</p>
              ` : events.map(ev => `
                <div class="timeline-item">
                  <div class="timeline-date">
                    <span class="day">${ev.date.split('-')[2]}</span>
                    <span class="month">${Formatters.thaiMonthBE(ev.date.slice(0, 7)).split(' ')[0]}</span>
                  </div>
                  <div class="timeline-content">
                    <div class="title-row">
                      <strong>${ev.title}</strong>
                      <span class="badge-pill ${ev.badge}">${ev.type === 'due' ? 'บิลค่าเช่า' : ev.type === 'contract' ? 'สัญญาเช่า' : 'ซ่อมบำรุง'}</span>
                    </div>
                    <p class="text-muted text-sm">${ev.desc}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Right: Interactive Month Calendar Shell -->
          <div class="glass-card">
            <div class="card-header">
              <h3><i class="fa-solid fa-calendar-day text-success"></i> ปฏิทินแสดงภาพรวมประจำเดือน</h3>
            </div>
            <div class="calendar-grid-wrapper">
              <div class="calendar-days-header">
                <div>อา.</div><div>จ.</div><div>อ.</div><div>พ.</div><div>พฤ.</div><div>ศ.</div><div>ส.</div>
              </div>
              <div class="calendar-days-grid">
                ${this.generateDaysGrid(today, events)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private static generateDaysGrid(today: Date, events: any[]): string {
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    let html = '';
    // Empty slots before 1st of month
    for (let i = 0; i < firstDayIndex; i++) {
      html += `<div class="day-cell cell-empty"></div>`;
    }

    // Days of current month
    for (let day = 1; day <= totalDays; day++) {
      const dayStr = day < 10 ? '0' + day : '' + day;
      const monthStr = (month + 1) < 10 ? '0' + (month + 1) : '' + (month + 1);
      const fullDate = `${year}-${monthStr}-${dayStr}`;

      const dayEvents = events.filter(e => e.date === fullDate);
      const isToday = day === today.getDate();

      html += `
        <div class="day-cell ${isToday ? 'cell-today' : ''}">
          <span class="day-number">${day}</span>
          ${dayEvents.map(e => `<span class="event-dot dot-${e.type}" title="${e.title}"></span>`).join('')}
        </div>
      `;
    }
    return html;
  }
}
