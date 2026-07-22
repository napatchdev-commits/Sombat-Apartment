import { Formatters } from '../utils/formatters.js';
export class RoomsComponent {
  static render(state) {
    const rawRooms = state.rooms || [];
    const roomTypes = state.roomTypes || [];

    // Sort rooms according to user requirement:
    // 1. Rooms starting with 'S' or 's' (S101, S102, S103...) FIRST
    // 2. Standard letter/numeric rooms (A101, 46/1...) SECOND
    // 3. Named rooms ("บ้านหลัง...", "แสงเงินแสงทอง", "ทิพย์มงคล"...) LAST
    const rooms = [...rawRooms].sort((a, b) => {
      const nameA = String(a.name || '').trim();
      const nameB = String(b.name || '').trim();

      const isSA = /^s/i.test(nameA);
      const isSB = /^s/i.test(nameB);

      if (isSA && !isSB) return -1;
      if (!isSA && isSB) return 1;
      if (isSA && isSB) {
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      }

      const isNamedA = /^[^A-Za-z0-9]/i.test(nameA) || nameA.startsWith('บ้าน') || nameA.startsWith('เรือน');
      const isNamedB = /^[^A-Za-z0-9]/i.test(nameB) || nameB.startsWith('บ้าน') || nameB.startsWith('เรือน');

      if (isNamedA && !isNamedB) return 1;
      if (!isNamedA && isNamedB) return -1;

      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

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

        <div class="rooms-cards-grid" id="rooms-grid">
          ${rooms.length === 0 ? `
            <div class="glass-card text-center" style="grid-column: 1 / -1; padding:4rem 2rem; border-radius:16px;">
              <div style="font-size:3.5rem; color:#cbd5e1; margin-bottom:1rem;"><i class="fa-solid fa-door-closed"></i></div>
              <h3 style="color:#334155; font-size:1.25rem; font-weight:700;">ยังไม่มีข้อมูลห้องพักในระบบ</h3>
              <p class="text-muted" style="margin-top:0.35rem; margin-bottom:1.5rem;">คุณสามารถกดปุ่ม "เพิ่มห้องพักใหม่" ด้านบนเพื่อเริ่มสร้างห้องเช่าประจำหอพักได้ทันที</p>
              <button class="btn btn-primary" id="btn-add-room-empty"><i class="fa-solid fa-plus"></i> เพิ่มห้องพักแรกในระบบ</button>
            </div>
          ` : rooms.map(room => {
            const type = roomTypes.find(t => t.id === room.typeId);
            const typeName = type ? type.name : 'มาตรฐาน';

            const isVacant = room.status === 'vacant' && (!room.currentTenantName || room.currentTenantName === 'ไม่มีผู้เข้าเช่า' || room.currentTenantName === '-');
            const statusClass = isVacant ? 'status-vacant' : 'status-not-vacant';
            const statusText = isVacant ? '⚪ ว่าง' : '🟢 มีผู้เช่า';
            const statusBadgeClass = isVacant ? 'badge-gray' : 'badge-success';

            return `
              <div class="room-card ${statusClass}">
                <div class="room-card-header">
                  <div class="room-number">ห้อง ${room.name}</div>
                  <span class="badge-pill ${statusBadgeClass}">${statusText}</span>
                </div>
                <div class="room-card-body">
                  <div class="info-row"><span>ชั้น / ประเภท:</span><strong>ชั้น ${room.floor} (${typeName})</strong></div>
                  <div class="info-row"><span>ค่าเช่า:</span><strong class="text-primary">${Formatters.currency(room.baseRent)} ${type && type.rentalType === 'daily' ? '/ วัน' : '/ เดือน'}</strong></div>
                  <div class="info-row"><span>ผู้เช่าปัจจุบัน:</span><strong>${room.currentTenantName || 'ไม่มีผู้เข้าเช่า'}</strong></div>
                </div>
                <div class="room-card-footer">
                  <button class="btn btn-secondary btn-xs btn-edit-room" data-id="${room.id}" title="แก้ไขห้อง"><i class="fa-solid fa-pen"></i> แก้ไข</button>
                  <button class="btn btn-primary btn-xs btn-action-bill" data-id="${room.id}" title="ออกบิล"><i class="fa-solid fa-calculator"></i> บิล</button>
                  <button class="btn btn-danger btn-xs btn-delete-room" data-id="${room.id}" data-name="${room.name}" title="ลบห้อง"><i class="fa-solid fa-trash"></i> ลบ</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
}

class RoomTypesComponent {

export class RoomTypesComponent {
  static render(state) {
    const roomTypes = state.roomTypes || [];

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-layer-group text-primary"></i> จัดการประเภทห้องเช่า (รายวัน & รายเดือน)</h2>
            <p>กำหนดประเภทห้องเช่า เช่น ห้องพัดลม, ห้องแอร์, ห้องรายวัน (Daily), ห้องพาณิชย์ และเรทราคาค่าเช่า</p>
          </div>
          <div class="header-actions">
            <button id="btn-add-roomtype" class="btn btn-primary"><i class="fa-solid fa-plus"></i> เพิ่มประเภทห้องเช่าใหม่</button>
          </div>
        </div>

        <div class="glass-card">
          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>ชื่อประเภทห้องเช่า</th>
                  <th>รูปแบบสัญญาเช่า</th>
                  <th>อัตราค่าเช่า (บาท)</th>
                  <th>รายละเอียดห้อง</th>
                  <th>จำนวนห้องในระบบ</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${roomTypes.length === 0 ? `
                  <tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">ยังไม่มีประเภทห้องเช่า กดปุ่ม "เพิ่มประเภทห้องเช่าใหม่" ด้านบนเพื่อเริ่มสร้าง</td></tr>
                ` : roomTypes.map(rt => {
                  const isDaily = rt.rentalType === 'daily';
                  const roomCount = (state.rooms || []).filter(r => r.typeId === rt.id).length;
                  return `
                    <tr>
                      <td><strong>${rt.name}</strong></td>
                      <td>
                        <span class="badge-pill ${isDaily ? 'badge-warning' : 'badge-info'}">
                          ${isDaily ? '🌞 สัญญารายวัน (Daily)' : '📅 สัญญารายเดือน (Monthly)'}
                        </span>
                      </td>
                      <td><strong class="text-primary">${Formatters.currency(rt.defaultRent)} ${isDaily ? '/ วัน' : '/ เดือน'}</strong></td>
                      <td><span class="text-muted text-sm">${rt.description || '-'}</span></td>
                      <td><span class="badge-pill badge-gray">${roomCount} ห้อง</span></td>
                      <td>
                        <div class="action-buttons">
                          <button class="btn btn-secondary btn-xs btn-edit-roomtype" data-id="${rt.id}"><i class="fa-solid fa-pen text-info"></i> แก้ไข</button>
                          <button class="btn btn-danger btn-xs btn-delete-roomtype" data-id="${rt.id}" data-name="${rt.name}"><i class="fa-solid fa-trash"></i> ลบ</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

class BillingComponent {
