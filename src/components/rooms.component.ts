// ==========================================================================
// ROOMS COMPONENT (CARD LAYOUT GRID & STATUS MANAGERS)
// ==========================================================================

import { DatabaseState } from '../services/db.service';
import { Formatters } from '../utils/formatters';

export class RoomsComponent {
  public static render(state: DatabaseState): string {
    const rooms = state.rooms;
    const roomTypes = state.roomTypes;

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-building-user text-primary"></i> ข้อมูลห้องพัก (Room Card Layout)</h2>
            <p>จัดการห้องพัก ปรับสถานะ 4 สี ย้ายผู้เช่า และกำหนดราคาเช่าแยกรายห้อง</p>
          </div>
          <div class="header-actions">
            <button id="btn-add-room" class="btn btn-primary"><i class="fa-solid fa-plus"></i> เพิ่มห้องพักใหม่</button>
          </div>
        </div>

        <!-- Status Filter Tabs -->
        <div class="room-status-filter-bar">
          <button class="status-filter-btn active" data-status="all">ทั้งหมด (${rooms.length})</button>
          <button class="status-filter-btn" data-status="occupied">🟢 มีผู้เช่า (${rooms.filter(r=>r.status==='occupied').length})</button>
          <button class="status-filter-btn" data-status="vacant">⚪ ห้องว่าง (${rooms.filter(r=>r.status==='vacant').length})</button>
          <button class="status-filter-btn" data-status="overdue">🔴 ค้างชำระ (${rooms.filter(r=>r.status==='overdue').length})</button>
          <button class="status-filter-btn" data-status="reserved">🟡 จองแล้ว (${rooms.filter(r=>r.status==='reserved').length})</button>
        </div>

        <!-- Room Cards Grid -->
        <div class="rooms-cards-grid" id="rooms-grid">
          ${rooms.map(room => {
            const type = roomTypes.find(t => t.id === room.typeId);
            const typeName = type ? type.name : 'มาตรฐาน';

            let statusClass = 'status-vacant';
            let statusText = '⚪ ว่าง';
            let statusBadgeClass = 'badge-gray';

            if (room.status === 'occupied') {
              statusClass = 'status-occupied';
              statusText = '🟢 มีผู้เช่า';
              statusBadgeClass = 'badge-success';
            } else if (room.status === 'overdue') {
              statusClass = 'status-overdue';
              statusText = '🔴 ค้างชำระ';
              statusBadgeClass = 'badge-danger';
            } else if (room.status === 'reserved') {
              statusClass = 'status-reserved';
              statusText = '🟡 จองแล้ว';
              statusBadgeClass = 'badge-warning';
            }

            return `
              <div class="room-card ${statusClass}" data-room-id="${room.id}" data-status="${room.status}">
                <div class="room-card-header">
                  <div class="room-number">ห้อง ${room.name}</div>
                  <span class="badge-pill ${statusBadgeClass}">${statusText}</span>
                </div>

                <div class="room-card-body">
                  <div class="info-row">
                    <span class="text-muted"><i class="fa-solid fa-layer-group"></i> ชั้น / ประเภท:</span>
                    <strong>ชั้น ${room.floor} (${typeName})</strong>
                  </div>

                  <div class="info-row">
                    <span class="text-muted"><i class="fa-solid fa-tag"></i> ค่าเช่าประจำเดือน:</span>
                    <strong class="text-primary price-tag">${Formatters.currency(room.baseRent)}</strong>
                  </div>

                  <div class="info-row tenant-row">
                    <span class="text-muted"><i class="fa-solid fa-user"></i> ผู้เช่าปัจจุบัน:</span>
                    <strong class="${room.currentTenantName ? 'text-main' : 'text-muted'}">
                      ${room.currentTenantName || 'ไม่มีผู้เข้าเช่า'}
                    </strong>
                  </div>

                  ${room.entryDate ? `
                    <div class="info-row">
                      <span class="text-muted"><i class="fa-solid fa-calendar-day"></i> วันที่เข้าอยู่:</span>
                      <span>${Formatters.thaiDate(room.entryDate)}</span>
                    </div>
                  ` : ''}

                  <div class="info-row meters-row">
                    <span class="text-muted"><i class="fa-solid fa-gauge"></i> มิเตอร์ล่าสุด:</span>
                    <small>น้ำ ${room.lastWaterMeter} | ไฟ ${room.lastElecMeter}</small>
                  </div>
                </div>

                <div class="room-card-footer">
                  <button class="btn btn-secondary btn-xs btn-edit-room" data-id="${room.id}"><i class="fa-solid fa-pen"></i> แก้ไข</button>
                  <button class="btn btn-secondary btn-xs btn-transfer-room" data-id="${room.id}"><i class="fa-solid fa-arrow-right-arrow-left"></i> ย้ายผู้เช่า</button>
                  <button class="btn btn-primary btn-xs btn-action-bill" data-id="${room.id}"><i class="fa-solid fa-file-invoice"></i> ออกบิล</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
}
