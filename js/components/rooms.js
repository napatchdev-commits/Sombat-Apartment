import { Formatters } from '../utils/formatters.js';
import { UIHelpers } from '../utils/helpers.js';

/**
 * RoomsComponent & RoomTypesComponent Class
 * Handles room grid visualization, status updates, and room type configurations
 */
export class RoomsComponent {
  static renderHeader() {
    return `
      <div class="view-header">
        <div>
          <h2><i class="fa-solid fa-door-open text-primary"></i> ผังห้องพักและจัดการสถานะ (Room Management)</h2>
          <p>ตรวจสอบสถานะห้องพัก รายชื่อผู้เช่าปัจจุบัน ปรับเปลี่ยนสถานะ และจัดการห้องเช่า</p>
        </div>
        <div class="header-actions">
          <button id="btn-add-room" class="btn btn-primary"><i class="fa-solid fa-plus"></i> เพิ่มห้องพักใหม่</button>
        </div>
      </div>
    `;
  }

  static renderRoomGrid(rooms = []) {
    if (rooms.length === 0) return UIHelpers.emptyState('ไม่พบข้อมูลห้องพักในระบบ');

    const cardsHtml = rooms.map(room => {
      const isVacant = room.status === 'vacant';
      const isOccupied = room.status === 'occupied';
      const statusBadge = isVacant 
        ? UIHelpers.badge('ว่างพร้อมเช่า', 'vacant') 
        : isOccupied 
          ? UIHelpers.badge('มีผู้เช่าแล้ว', 'occupied') 
          : UIHelpers.badge('ปรับปรุง/ซ่อมแซม', 'maintenance');

      return `
        <div class="room-card glass-card ${room.status}">
          <div class="room-card-header">
            <h3 class="room-title">ห้อง ${room.name}</h3>
            ${statusBadge}
          </div>
          <div class="room-card-body">
            <p class="room-rent"><i class="fa-solid fa-tag"></i> ${Formatters.currency(room.baseRent)} / เดือน</p>
            <p class="room-tenant"><i class="fa-solid fa-user"></i> ${room.currentTenantName || 'ไม่มีผู้เช่า'}</p>
            <div class="room-meters">
              <span>⚡ ไฟ: ${room.lastElecMeter || 0}</span>
              <span>💧 น้ำ: ${room.lastWaterMeter || 0}</span>
            </div>
          </div>
          <div class="room-card-footer">
            <button class="btn btn-xs btn-outline-primary btn-edit-room" data-id="${room.id}"><i class="fa-solid fa-pen"></i> แก้ไข</button>
            <button class="btn btn-xs btn-outline-info btn-create-room-bill" data-id="${room.id}"><i class="fa-solid fa-file-invoice"></i> ออกบิล</button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="rooms-grid">
        ${cardsHtml}
      </div>
    `;
  }

  static render(state = {}) {
    const rooms = state.rooms || [];
    return `
      <div class="rooms-view">
        ${this.renderHeader()}
        ${this.renderRoomGrid(rooms)}
      </div>
    `;
  }
}

export class RoomTypesComponent {
  static render(state = {}) {
    const roomTypes = state.roomTypes || [];
    const rowsHtml = roomTypes.map(rt => `
      <tr>
        <td><strong>${rt.name}</strong></td>
        <td>${rt.rentalType === 'daily' ? 'สัญญารายวัน' : 'สัญญารายเดือน'}</td>
        <td><strong>${Formatters.currency(rt.defaultRent)}</strong></td>
        <td>${rt.description || '-'}</td>
        <td>
          <button class="btn btn-xs btn-secondary btn-edit-roomtype" data-id="${rt.id}"><i class="fa-solid fa-pen"></i> แก้ไข</button>
        </td>
      </tr>
    `).join('');

    return `
      <div class="roomtypes-view">
        <div class="view-header">
          <h2><i class="fa-solid fa-layer-group text-primary"></i> ตั้งค่าประเภทห้องพัก (Room Types)</h2>
        </div>
        <div class="glass-card">
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>ชื่อประเภทห้อง</th>
                  <th>รูปแบบสัญญา</th>
                  <th>อัตราค่าเช่าเริ่มต้น</th>
                  <th>รายละเอียด</th>
                  <th>จัดการ</th>
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
