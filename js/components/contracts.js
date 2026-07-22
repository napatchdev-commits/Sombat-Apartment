import { Formatters } from '../utils/formatters.js';
import { UIHelpers } from '../utils/helpers.js';

/**
 * ContractsComponent Class
 * Handles rental contracts, contract printing, and official lease agreements
 */
export class ContractsComponent {
  static renderHeader() {
    return `
      <div class="view-header">
        <div>
          <h2><i class="fa-solid fa-file-contract text-primary"></i> หนังสือสัญญาเช่า (Lease Contracts)</h2>
          <p>สร้างและพิมพ์หนังสือสัญญาเช่าห้องพักฉบับมาตรฐาน บันทึกเงินประกัน และเงื่อนไขการเช่า</p>
        </div>
        <div class="header-actions">
          <button id="btn-create-contract" class="btn btn-primary"><i class="fa-solid fa-file-signature"></i> ทำสัญญาเช่าใหม่</button>
        </div>
      </div>
    `;
  }

  static renderTable(tenants = [], rooms = []) {
    if (tenants.length === 0) return UIHelpers.emptyState('ยังไม่มีข้อมูลสัญญาเช่าในระบบ');

    const rowsHtml = tenants.map(tenant => {
      const room = rooms.find(r => r.id === tenant.assignedRoomId);
      const roomName = room ? room.name : '-';
      const deposit = tenant.deposit ? tenant.deposit.initialBail : 0;

      return `
        <tr>
          <td><strong>CTR_${tenant.id}</strong></td>
          <td>คุณ${tenant.name}</td>
          <td><span class="badge badge-info">ห้อง ${roomName}</span></td>
          <td>${Formatters.thaiDate(tenant.startDate)}</td>
          <td>${Formatters.currency(deposit)}</td>
          <td>${UIHelpers.badge('ปกติ', 'success')}</td>
          <td>
            <button class="btn btn-xs btn-primary btn-print-contract-modal" data-id="${tenant.id}"><i class="fa-solid fa-print"></i> สัญญา</button>
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
                <th>เลขที่สัญญา</th>
                <th>ผู้เช่า</th>
                <th>ห้องพัก</th>
                <th>วันที่ทำสัญญา</th>
                <th>เงินประกัน</th>
                <th>สถานะ</th>
                <th>พิมพ์</th>
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
    const tenants = state.tenants || [];
    const rooms = state.rooms || [];
    return `
      <div class="contracts-view">
        ${this.renderHeader()}
        ${this.renderTable(tenants, rooms)}
      </div>
    `;
  }
}
