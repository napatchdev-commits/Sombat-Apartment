// ==========================================================================
// TENANTS COMPONENT (TENANTS TABLE, ATTACHMENTS & AUTO CONTRACT GENERATOR)
// ==========================================================================

import { DatabaseState } from '../services/db.service';
import { Formatters } from '../utils/formatters';

export class TenantsComponent {
  public static render(state: DatabaseState): string {
    const tenants = state.tenants;

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-users text-primary"></i> จัดการข้อมูลผู้เช่าและเอกสารสัญญา</h2>
            <p>บันทึกทะเบียนผู้เช่า อัปโหลดเอกสารแนบ (PDF/JPG/PNG/DOCX/ZIP) และพิมพ์สัญญาเช่าอัตโนมัติ</p>
          </div>
          <div class="header-actions">
            <button id="btn-export-tenants-excel" class="btn btn-secondary"><i class="fa-solid fa-file-excel text-success"></i> Export Excel</button>
            <button id="btn-export-tenants-pdf" class="btn btn-secondary"><i class="fa-solid fa-file-pdf text-danger"></i> Export PDF</button>
            <button id="btn-add-tenant" class="btn btn-primary"><i class="fa-solid fa-user-plus"></i> เพิ่มผู้เช่าใหม่</button>
          </div>
        </div>

        <!-- Filter & Search Bar -->
        <div class="glass-card table-filter-card">
          <div class="search-input-wrapper">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="tenant-search-input" class="form-control" placeholder="ค้นหาชื่อผู้เช่า, เลขบัตรประชาชน, เบอร์โทร..." autocomplete="off">
          </div>
        </div>

        <!-- Tenants Data Table -->
        <div class="glass-card style-table-card">
          <div class="table-responsive">
            <table class="custom-table" id="tenants-table">
              <thead>
                <tr>
                  <th>ชื่อ - นามสกุล</th>
                  <th>ห้องพัก</th>
                  <th>เลขบัตรประชาชน</th>
                  <th>เบอร์โทร / Line</th>
                  <th>วันเริ่ม - สิ้นสุดสัญญา</th>
                  <th>เงินประกัน</th>
                  <th>เอกสารแนบ</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody id="tenants-tbody">
                ${tenants.map(t => {
                  const room = state.rooms.find(r => r.id === t.assignedRoomId);
                  const roomBadge = room ? `<span class="badge-pill badge-primary">ห้อง ${room.name}</span>` : `<span class="badge-pill badge-gray">ยังไม่ระบุ</span>`;
                  const docCount = t.documents ? t.documents.length : 0;

                  return `
                    <tr>
                      <td>
                        <strong>${t.name}</strong>
                        ${t.email ? `<div class="text-muted text-sm">${t.email}</div>` : ''}
                      </td>
                      <td>${roomBadge}</td>
                      <td><code>${Formatters.formatIdCard(t.idCard)}</code></td>
                      <td>
                        <div><i class="fa-solid fa-phone text-muted"></i> ${t.tel}</div>
                        ${t.lineId ? `<div class="text-muted text-sm"><i class="fa-brands fa-line text-success"></i> ${t.lineId}</div>` : ''}
                      </td>
                      <td>
                        <div>${Formatters.thaiDate(t.startDate)} ➔</div>
                        <div class="text-warning"><strong>${Formatters.thaiDate(t.endDate)}</strong></div>
                      </td>
                      <td>
                        <strong class="text-success">${Formatters.currency(t.deposit ? t.deposit.initialBail : 0)}</strong>
                      </td>
                      <td>
                        <button class="btn btn-secondary btn-xs btn-doc-manage" data-id="${t.id}">
                          <i class="fa-solid fa-folder-open text-primary"></i> ${docCount} ไฟล์
                        </button>
                      </td>
                      <td>
                        <div class="action-buttons">
                          <button class="btn btn-secondary btn-xs btn-gen-contract" data-id="${t.id}" title="สร้างสัญญาเช่าอัตโนมัติ">
                            <i class="fa-solid fa-file-contract text-warning"></i> สัญญา
                          </button>
                          <button class="btn btn-secondary btn-xs btn-edit-tenant" data-id="${t.id}" title="แก้ไขข้อมูล">
                            <i class="fa-solid fa-pen-to-square text-info"></i>
                          </button>
                          <button class="btn btn-danger btn-xs btn-delete-tenant" data-id="${t.id}" title="ลบข้อมูล">
                            <i class="fa-solid fa-trash"></i>
                          </button>
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
