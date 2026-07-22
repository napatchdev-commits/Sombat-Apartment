import { Formatters } from '../utils/formatters.js';

/**
 * SettingsComponent & RatesComponent Class
 * Handles system settings, apartment profile, cloud sync URL, utility rates, and user accounts
 */
export class SettingsComponent {
  static render(state = {}) {
    const settings = state.settings || {};
    const rates = state.rates || { electricityRate: 8.0, waterRate: 20.0, trashFee: 20.0 };
    const users = state.users || [];

    const usersRows = users.map(u => `
      <tr>
        <td><strong>${u.username}</strong></td>
        <td>${u.displayName}</td>
        <td><span class="badge badge-info">${u.role}</span></td>
        <td>
          <button class="btn btn-xs btn-secondary btn-edit-user" data-id="${u.id}"><i class="fa-solid fa-pen"></i> แก้ไข</button>
        </td>
      </tr>
    `).join('');

    return `
      <div class="settings-view">
        <div class="workspace-header">
          <div>
            <h2><i class="fa-solid fa-sliders text-primary"></i> ตั้งค่าระบบหอพัก (System Settings)</h2>
            <p>กำหนดชื่อหอพัก อัตราค่าน้ำ ค่าไฟ บัญชี PromptPay และเชื่อมต่อ Google Sheets API</p>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
          <!-- Left Column: Apartment Profile & Cloud Sync -->
          <div>
            <div class="glass-card p-4" style="margin-bottom:1.5rem;">
              <h3 style="margin-top:0; font-size:1.1rem; margin-bottom:1rem;"><i class="fa-solid fa-cloud-arrow-up text-success"></i> เชื่อมต่อฐานข้อมูล Google Sheets Cloud</h3>
              <div class="form-group">
                <label style="font-weight:600;">Google Sheets Web App URL *</label>
                <input type="url" id="sheets-url-input" class="form-control" value="${settings.googleSheetUrl || ''}" placeholder="https://script.google.com/macros/s/.../exec">
              </div>
              <div style="display:flex; gap:0.5rem; margin-top:1rem; flex-wrap:wrap;">
                <button class="btn btn-primary" id="btn-save-sheets-url"><i class="fa-solid fa-save"></i> บันทึก URL</button>
                <button class="btn btn-success" id="btn-sync-to-sheets"><i class="fa-solid fa-cloud-arrow-up"></i> ซิงค์ลง Google Sheets ทันที</button>
              </div>
            </div>

            <div class="glass-card p-4">
              <h3 style="margin-top:0; font-size:1.1rem; margin-bottom:1rem;"><i class="fa-solid fa-house-user text-primary"></i> ข้อมูลหอพัก & PromptPay</h3>
              <form id="apartment-settings-form">
                <div class="form-group" style="margin-bottom:0.75rem;">
                  <label>ชื่อหอพัก / อพาร์ทเม้นท์</label>
                  <input type="text" id="setting-apt-name" class="form-control" value="${settings.apartmentName || ''}">
                </div>
                <div class="form-group" style="margin-bottom:0.75rem;">
                  <label>หมายเลข PromptPay</label>
                  <input type="text" id="setting-promptpay-id" class="form-control" value="${settings.promptPayId || ''}">
                </div>
                <button type="submit" class="btn btn-primary" style="margin-top:0.5rem;"><i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูลหอพัก</button>
              </form>
            </div>
          </div>

          <!-- Right Column: Rates & Users -->
          <div>
            <div class="glass-card p-4" style="margin-bottom:1.5rem;">
              <h3 style="margin-top:0; font-size:1.1rem; margin-bottom:1rem;"><i class="fa-solid fa-bolt text-warning"></i> อัตราค่าน้ำ ค่าไฟ ค่าบริการ</h3>
              <form id="rates-settings-form">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
                  <div class="form-group">
                    <label>ค่าไฟฟ้า (บาท / ยูนิต)</label>
                    <input type="number" step="0.1" id="setting-rate-elec" class="form-control" value="${rates.electricityRate || 8.0}">
                  </div>
                  <div class="form-group">
                    <label>ค่าน้ำประปา (บาท / ยูนิต)</label>
                    <input type="number" step="0.1" id="setting-rate-water" class="form-control" value="${rates.waterRate || 20.0}">
                  </div>
                </div>
                <div class="form-group" style="margin-top:0.75rem;">
                  <label>ค่าขยะ / สาธารณูปโภค (บาท / เดือน)</label>
                  <input type="number" id="setting-rate-trash" class="form-control" value="${rates.trashFee !== undefined ? rates.trashFee : 20.0}">
                </div>
                <button type="submit" class="btn btn-primary" style="margin-top:0.75rem;"><i class="fa-solid fa-floppy-disk"></i> บันทึกอัตราค่าบริการ</button>
              </form>
            </div>

            <div class="glass-card p-4">
              <h3 style="margin-top:0; font-size:1.1rem; margin-bottom:1rem;"><i class="fa-solid fa-users-gear text-info"></i> บัญชีผู้ใช้งานระบบ</h3>
              <div class="table-responsive">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>ชื่อที่แสดง</th>
                      <th>บทบาท</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${usersRows}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

export class RatesComponent {
  static render(state = {}) {
    return SettingsComponent.render(state);
  }
}
