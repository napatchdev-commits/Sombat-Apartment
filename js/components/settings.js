import { Formatters } from '../utils/formatters.js';
export class RatesComponent {
  static render(state) {
    const rates = state.rates || { electricityRate: 8.0, waterRate: 20.0, trashFee: 20.0, customFees: [] };
    const customFees = rates.customFees || [];

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-sliders text-primary"></i> ตั้งค่าเรท & ค่าบริการสาธารณูปโภค (Rates & Service Fees)</h2>
            <p>กำหนดเรทค่าน้ำ ค่าไฟ ค่าขยะ และเพิ่ม/แก้ไข/ลบ รายการค่าบริการอื่นๆ เพื่อบันทึกลงชีตและออกบิลอัตโนมัติ</p>
          </div>
        </div>

        <!-- 1. Standard Rates Form -->
        <div class="glass-card" style="margin-bottom:1.5rem;">
          <h3><i class="fa-solid fa-bolt text-warning"></i> 1. อัตราเรทค่าน้ำ - ค่าไฟ และค่าขยะหลัก</h3>
          <form id="form-rates-main" style="margin-top:1rem;">
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:1rem;">
              <div class="form-group">
                <label>ค่าไฟฟ้า (บาท / ยูนิต) *</label>
                <input type="number" step="0.1" id="rate-elec" class="form-control" value="${rates.electricityRate || 8.0}" required>
              </div>
              <div class="form-group">
                <label>ค่าน้ำประปา (บาท / ยูนิต) *</label>
                <input type="number" step="0.1" id="rate-water" class="form-control" value="${rates.waterRate || 20.0}" required>
              </div>
              <div class="form-group">
                <label>ค่าบริการขยะ (บาท / เดือน) *</label>
                <input type="number" step="0.1" id="rate-trash" class="form-control" value="${rates.trashFee !== undefined ? rates.trashFee : 20.0}" required>
              </div>
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:1rem;"><i class="fa-solid fa-floppy-disk"></i> บันทึกปรับเรทหลัก</button>
          </form>
        </div>

        <!-- 2. Custom Extra Fees Management -->
        <div class="glass-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <div>
              <h3><i class="fa-solid fa-boxes-packing text-primary"></i> 2. รายการค่าใช้จ่ายและค่าบริการเสริมอื่นๆ (Custom Service Fees)</h3>
              <p class="text-muted text-sm">สามารถเพิ่ม แก้ไข ลบ รายการค่าบริการอื่นๆ เพื่อนำไปบันทึกลงชีตและคำนวณในบิลได้</p>
            </div>
            <button id="btn-add-custom-fee" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> เพิ่มรายการค่าใช้จ่ายใหม่</button>
          </div>

          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>ชื่อรายการค่าใช้จ่าย</th>
                  <th>รูปแบบคำนวณ</th>
                  <th>อัตราค่าบริการ (บาท)</th>
                  <th>หมายเหตุรายละเอียด</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${customFees.length === 0 ? `
                  <tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">ยังไม่มีรายการค่าใช้จ่ายเสริม สามารถกดเพิ่มใหม่ได้</td></tr>
                ` : customFees.map(fee => `
                  <tr>
                    <td><strong>${fee.name}</strong></td>
                    <td><span class="badge-pill badge-info">${fee.unitType === 'monthly' ? '📅 รายเดือน (บาท/เดือน)' : '⚡ ตามหน่วย (บาท/ยูนิต)'}</span></td>
                    <td><strong class="text-primary">${Formatters.currency(fee.amount)}</strong></td>
                    <td><span class="text-muted text-sm">${fee.note || '-'}</span></td>
                    <td>
                      <div class="action-buttons">
                        <button class="btn btn-secondary btn-xs btn-edit-custom-fee" data-id="${fee.id}"><i class="fa-solid fa-pen"></i> แก้ไข</button>
                        <button class="btn btn-danger btn-xs btn-delete-custom-fee" data-id="${fee.id}"><i class="fa-solid fa-trash"></i> ลบ</button>
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

class SettingsComponent {

export class SettingsComponent {
  static render(state) {
    const settings = state.settings || {};
    const users = state.users || [];

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div><h2><i class="fa-solid fa-gears text-primary"></i> ตั้งค่าเซิร์ฟเวอร์ & เชื่อมต่อ Google Sheets</h2><p>จัดการผู้ใช้งานระบบ (3 บทบาท) ตั้งค่าระบบ LINE Bot และบันทึกข้อมูลซิงค์คลาวด์ Google Sheets</p></div>
        </div>

        <div class="glass-card" style="margin-bottom:1.5rem;">
          <h3><i class="fa-brands fa-line text-success"></i> ตั้งค่าระบบ LINE Bot & LINE Notify (บันทึกลงชีต แก้ไขได้ทุกเครื่อง 100%)</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">
            ระบุ Token เพื่อส่งบิล ใบเสร็จ และแจ้งเตือนชำระเงินอัตโนมัติไปยัง LINE กลุ่มผู้บริหาร/ผู้เช่า (ซิงค์ลง Google Sheets ใช้งานตรงกันทุกเครื่อง)
          </p>
          
          <form id="line-bot-settings-form" style="margin-top:1rem;">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
              <div class="form-group">
                <label style="font-weight:600;"><i class="fa-brands fa-line text-success"></i> LINE Channel Access Token (LINE Bot Token):</label>
                <input type="text" id="setting-line-token" class="form-control" value="${settings.lineToken || ''}" placeholder="ระบุ LINE Channel Access Token..." style="padding:0.65rem 0.85rem;">
              </div>
              <div class="form-group">
                <label style="font-weight:600;"><i class="fa-solid fa-user-tag text-primary"></i> LINE User ID / Group ID (สำหรับส่งบิล):</label>
                <input type="text" id="setting-line-userid" class="form-control" value="${settings.lineUserId || ''}" placeholder="U123456789... หรือ Group ID..." style="padding:0.65rem 0.85rem;">
              </div>
            </div>

            <div class="form-group" style="margin-top:0.5rem;">
              <label style="font-weight:600;"><i class="fa-solid fa-bell text-warning"></i> LINE Notify Token (สำหรับแจ้งเตือนไลน์กลุ่ม):</label>
              <input type="text" id="setting-line-notify-token" class="form-control" value="${settings.lineNotifyToken || ''}" placeholder="ระบุ LINE Notify Token..." style="padding:0.65rem 0.85rem;">
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:1.25rem;">
              <button type="submit" class="btn btn-success"><i class="fa-solid fa-floppy-disk"></i> บันทึกการตั้งค่า LINE Bot ลงชีต</button>
              <button type="button" class="btn btn-secondary" id="btn-test-line-send"><i class="fa-paper-plane fa-solid text-success"></i> ทดสอบส่งข้อความ LINE</button>
            </div>
          </form>
        </div>

        <div class="glass-card" style="margin-bottom:1.5rem;">
          <h3><i class="fa-solid fa-cloud text-primary"></i> เชื่อมต่อซิงค์ข้อมูล Google Sheets แบบเรียลไทม์ (ทุกเครื่องตรงกัน 100%)</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:0.25rem;">
            ระบบจะดึงข้อมูลจาก Google Sheets เสมอแม้ล้างแคชหรือเปิดจากคอมพิวเตอร์เครื่องใหม่
          </p>
          <div class="form-group" style="margin-top:1rem;">
            <label>Google Apps Script Web App URL:</label>
            <input type="url" id="sheets-url-input" class="form-control" value="${settings.googleSheetUrl || ''}" placeholder="https://script.google.com/macros/s/.../exec">
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:1rem;">
            <button class="btn btn-primary" id="btn-save-sheets-url"><i class="fa-solid fa-save"></i> บันทึก URL</button>
            <button class="btn btn-success" id="btn-sync-to-sheets"><i class="fa-solid fa-cloud-arrow-up"></i> บันทึกข้อมูลลง Google Sheets ตอนนี้</button>
            <button class="btn btn-secondary" id="btn-copy-shared-link"><i class="fa-solid fa-share-nodes"></i> คัดลอกลิงก์แชร์เชื่อมต่อทุกเครื่อง</button>
          </div>
        </div>

        <div class="glass-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3><i class="fa-solid fa-users-gear text-primary"></i> จัดการผู้ใช้งานระบบ (User Roles Management)</h3>
            <button id="btn-add-user" class="btn btn-primary btn-sm"><i class="fa-solid fa-user-plus"></i> เพิ่มแอดมิน / ผู้ใช้งานใหม่</button>
          </div>
          <div class="table-responsive">
            <table class="custom-table">
              <thead><tr><th>Username</th><th>ชื่อที่แสดง</th><th>บทบาทสิทธิ์ใช้งาน</th><th>การจัดการ</th></tr></thead>
              <tbody>
                ${users.map(u => `
                  <tr>
                    <td><strong>${u.username}</strong></td>
                    <td>${u.displayName}</td>
                    <td><span class="role-pill role-${u.role}">${u.role === 'super_admin' ? '👑 Super Admin' : (u.role === 'admin' ? '🛡️ Admin' : '👤 Staff')}</span></td>
                    <td>
                      <div class="action-buttons">
                        <button class="btn btn-secondary btn-xs btn-edit-user" data-id="${u.id}"><i class="fa-solid fa-pen"></i> แก้ไข</button>
                        <button class="btn btn-primary btn-xs btn-switch-user" data-id="${u.id}"><i class="fa-solid fa-right-to-bracket"></i> สลับใช้งาน</button>
                        ${users.length > 1 ? `<button class="btn btn-danger btn-xs btn-delete-user" data-id="${u.id}"><i class="fa-solid fa-trash"></i> ลบ</button>` : ''}
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

/* ==========================================================================
   5. MAIN APPLICATION CONTROLLER
   ========================================================================== */

class App {
