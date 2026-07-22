import { Formatters } from '../utils/formatters.js';
export class TenantsComponent {
  static render(state) {
    if (!state.tenants) state.tenants = [];
    
    // Auto-populate tenant records from occupied rooms if tenants array is empty or incomplete
    if (state.rooms && Array.isArray(state.rooms)) {
      state.rooms.forEach(r => {
        if (r.currentTenantName && r.currentTenantName !== 'ไม่มีผู้เข้าเช่า') {
          const exists = state.tenants.some(t => t.name === r.currentTenantName || t.assignedRoomId === r.id);
          if (!exists) {
            state.tenants.push({
              id: 't_auto_' + r.id,
              name: r.currentTenantName,
              idCard: r.idCard || '3451200115491',
              tel: '081-2345678',
              assignedRoomId: r.id,
              startDate: '2025-05-01',
              endDate: '2027-05-01',
              deposit: { initialBail: r.bailAmount || 7000, deductions: [], status: 'active' },
              documents: []
            });
          }
        }
      });
    }

    const tenants = state.tenants;

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-users text-primary"></i> จัดการข้อมูลผู้เช่าและเอกสารสัญญา</h2>
            <p>บันทึกทะเบียนผู้เช่า เพิ่มผู้เช่าใหม่ แนบไฟล์บัตรประชาชน/ทะเบียนบ้าน แก้ไข และลบรายการ</p>
          </div>
          <div class="header-actions">
            <button id="btn-export-tenants-excel" class="btn btn-secondary"><i class="fa-solid fa-file-excel text-success"></i> Export Excel</button>
            <button id="btn-add-tenant" class="btn btn-primary"><i class="fa-solid fa-user-plus"></i> เพิ่มผู้เช่าใหม่</button>
          </div>
        </div>

        <div class="glass-card style-table-card">
          <div class="table-responsive">
            <table class="custom-table" id="tenants-table">
              <thead>
                <tr>
                  <th>ชื่อ - นามสกุล</th>
                  <th>ห้องพัก</th>
                  <th>เลขบัตรประชาชน</th>
                  <th>เบอร์โทร / Line</th>
                  <th>เอกสารแนบ</th>
                  <th>วันเริ่ม - สิ้นสุดสัญญา</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${tenants.length === 0 ? `
                  <tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">ยังไม่มีข้อมูลผู้เช่าในระบบ กดปุ่ม "เพิ่มผู้เช่าใหม่" ด้านบนเพื่อเพิ่มข้อมูล</td></tr>
                ` : tenants.map(t => {
                  const room = state.rooms.find(r => r.id === t.assignedRoomId);
                  const roomBadge = room ? `<span class="badge-pill badge-primary">ห้อง ${room.name}</span>` : `<span class="badge-pill badge-gray">ยังไม่ระบุ</span>`;
                  const docCount = t.documents ? t.documents.length : 0;
                  return `
                    <tr>
                      <td><strong>${t.name}</strong></td>
                      <td>${roomBadge}</td>
                      <td><code>${Formatters.formatIdCard(t.idCard)}</code></td>
                      <td>${t.tel} ${t.lineId ? `(${t.lineId})` : ''}</td>
                      <td>
                        <button class="btn btn-secondary btn-xs btn-view-docs" data-id="${t.id}">
                          <i class="fa-solid fa-folder-open text-primary"></i> เอกสาร (${docCount})
                        </button>
                      </td>
                      <td>${Formatters.thaiDate(t.startDate)} ➔ <strong class="text-warning">${Formatters.thaiDate(t.endDate)}</strong></td>
                      <td>
                        <div class="action-buttons">
                          <button class="btn btn-secondary btn-xs btn-gen-contract" data-id="${t.id}"><i class="fa-solid fa-file-contract text-warning"></i> สัญญา</button>
                          <button class="btn btn-secondary btn-xs btn-edit-tenant" data-id="${t.id}"><i class="fa-solid fa-pen text-info"></i> แก้ไข</button>
                          <button class="btn btn-danger btn-xs btn-delete-tenant" data-id="${t.id}" data-name="${t.name}"><i class="fa-solid fa-trash"></i> ลบ</button>
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

class RoomsComponent {
