import { Formatters } from '../utils/formatters.js';
export class ContractsComponent {
  static render(state) {
    const tenants = state.tenants;
    const rooms = state.rooms;

    const contracts = tenants.map(t => {
      const room = rooms.find(r => r.id === t.assignedRoomId);
      const today = new Date();
      const end = t.endDate ? new Date(t.endDate) : new Date();
      const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 3600 * 24));
      
      let status = 'active'; let statusText = '🟢 มีผลบังคับใช้'; let statusBadge = 'badge-success';

      if (diffDays < 0) { status = 'expired'; statusText = '🔴 หมดอายุสัญญา'; statusBadge = 'badge-danger'; }
      else if (diffDays <= 30) { status = 'expiring'; statusText = '🟡 ใกล้หมดสัญญา'; statusBadge = 'badge-warning'; }

      return {
        id: 'ctr_' + t.id,
        contractNumber: `CTR-2026-${t.id.substring(0, 4).toUpperCase()}`,
        tenantId: t.id,
        tenantName: t.name,
        idCard: t.idCard,
        tel: t.tel,
        roomId: t.assignedRoomId,
        roomName: room ? room.name : 'ยังไม่จัดห้อง',
        startDate: t.startDate,
        endDate: t.endDate,
        monthlyRent: room ? room.baseRent : 3500,
        depositAmount: t.deposit ? t.deposit.initialBail : 7000,
        status, statusText, statusBadge, diffDays
      };
    });

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-file-contract text-primary"></i> จัดการสัญญาเช่า (Rental Contracts Management)</h2>
            <p>ออกหนังสือสัญญาเช่า พิมพ์เอกสาร PDF บันทึกย้ายเข้า-ย้ายออก และติดตามวันหมดอายุสัญญา</p>
          </div>
          <div class="header-actions">
            <button id="btn-export-contracts-excel" class="btn btn-secondary"><i class="fa-solid fa-file-excel text-success"></i> Export Excel</button>
            <button id="btn-create-contract" class="btn btn-primary"><i class="fa-solid fa-file-circle-plus"></i> ออกสัญญาเช่าใหม่</button>
          </div>
        </div>

        <div class="room-status-filter-bar">
          <button class="contract-filter-btn active" data-filter="all">สัญญาทั้งหมด (${contracts.length})</button>
          <button class="contract-filter-btn" data-filter="active">🟢 มีผลบังคับใช้ (${contracts.filter(c => c.status === 'active').length})</button>
          <button class="contract-filter-btn" data-filter="expiring">🟡 ใกล้หมดอายุ 30 วัน (${contracts.filter(c => c.status === 'expiring').length})</button>
          <button class="contract-filter-btn" data-filter="expired">🔴 หมดอายุสัญญา (${contracts.filter(c => c.status === 'expired').length})</button>
        </div>

        <div class="glass-card style-table-card">
          <div class="table-responsive">
            <table class="custom-table" id="contracts-table">
              <thead>
                <tr>
                  <th>เลขที่สัญญา</th>
                  <th>ห้องพัก</th>
                  <th>ผู้เช่าหลัก</th>
                  <th>เลขบัตรประชาชน</th>
                  <th>วันเริ่มสัญญา - วันหมดอายุ</th>
                  <th>ค่าเช่า / เงินมัดจำ</th>
                  <th>สถานะสัญญา</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${contracts.map(c => `
                  <tr class="contract-row" data-status="${c.status}">
                    <td><strong>${c.contractNumber}</strong></td>
                    <td><span class="badge-pill badge-primary">ห้อง ${c.roomName}</span></td>
                    <td><strong>${c.tenantName}</strong><div class="text-muted text-sm">${c.tel}</div></td>
                    <td><code>${Formatters.formatIdCard(c.idCard)}</code></td>
                    <td>
                      <div>${Formatters.thaiDate(c.startDate)} ➔</div>
                      <div class="${c.status === 'expiring' ? 'text-warning' : c.status === 'expired' ? 'text-danger' : 'text-main'}">
                        <strong>${Formatters.thaiDate(c.endDate)}</strong>
                      </div>
                    </td>
                    <td>
                      <div>ค่าเช่า: <strong>${Formatters.currency(c.monthlyRent)}</strong></div>
                      <div class="text-success text-sm">มัดจำ: ${Formatters.currency(c.depositAmount)}</div>
                    </td>
                    <td><span class="badge-pill ${c.statusBadge}">${c.statusText}</span></td>
                    <td>
                      <div class="action-buttons">
                        <button class="btn btn-secondary btn-xs btn-print-contract-pdf" data-tenant-id="${c.tenantId}" title="พิมพ์สัญญา PDF">
                          <i class="fa-solid fa-print text-warning"></i> พิมพ์สัญญา (หน้า-หลัง)
                        </button>
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

class TenantsComponent {
