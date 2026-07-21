// ==========================================================================
// SETTINGS COMPONENT (ADMIN ROLES, ACTIVITY LOGS, RATES & BACKUP)
// ==========================================================================

import { DatabaseState } from '../services/db.service';
import { LoggerService } from '../services/logger.service';
import { Formatters } from '../utils/formatters';

export class SettingsComponent {
  public static render(state: DatabaseState): string {
    const settings = state.settings;
    const rates = state.rates;
    const users = state.users;
    const logs = LoggerService.getLogs();

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-gears text-primary"></i> ตั้งค่าระบบและจัดการแอดมิน (Settings & Admin)</h2>
            <p>จัดการผู้ใช้งานระบบ (3 บทบาท), ดู Activity Logs, ตั้งค่าเรทค่าน้ำไฟ, PromptPay QR และสำรองข้อมูล</p>
          </div>
        </div>

        <!-- Sub-Tabs Navigation for Settings -->
        <div class="settings-subtabs-bar">
          <button class="subtab-btn active" data-subtab="users"><i class="fa-solid fa-users-gear"></i> ผู้ใช้งาน & สิทธิ์ (RBAC)</button>
          <button class="subtab-btn" data-subtab="logs"><i class="fa-solid fa-clock-rotate-left"></i> Activity Audit Logs</button>
          <button class="subtab-btn" data-subtab="rates"><i class="fa-solid fa-bolt"></i> อัตราเรทค่าน้ำ/ไฟ & ประวัติ</button>
          <button class="subtab-btn" data-subtab="property"><i class="fa-solid fa-building"></i> ข้อมูลหอพัก & PromptPay</button>
          <button class="subtab-btn" data-subtab="backup"><i class="fa-solid fa-database"></i> สำรอง & กู้คืนข้อมูล (Backup/Restore)</button>
        </div>

        <!-- Subtab 1: Admin Users & Roles -->
        <div class="subtab-content active" id="subtab-users">
          <div class="glass-card style-table-card">
            <div class="card-header flex-between">
              <h3><i class="fa-solid fa-user-shield text-primary"></i> บัญชีผู้ใช้งานระบบและกำหนดสิทธิ์ (3 Roles)</h3>
              <button id="btn-add-user" class="btn btn-primary btn-sm"><i class="fa-solid fa-user-plus"></i> เพิ่มผู้ใช้งานใหม่</button>
            </div>
            <div class="table-responsive">
              <table class="custom-table">
                <thead>
                  <tr>
                    <th>ชื่อผู้ใช้งาน (Username)</th>
                    <th>ชื่อที่แสดง (Display Name)</th>
                    <th>บทบาทสิทธิ์ (Role)</th>
                    <th>สถานะ</th>
                    <th>การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  ${users.map(u => `
                    <tr>
                      <td><code>${u.username}</code></td>
                      <td><strong>${u.displayName}</strong></td>
                      <td>
                        <span class="role-pill role-${u.role}">
                          ${u.role === 'super_admin' ? '👑 Super Admin' : u.role === 'admin' ? '🛡️ Admin' : '👤 Staff'}
                        </span>
                      </td>
                      <td><span class="badge-pill badge-success">เปิดใช้งาน</span></td>
                      <td>
                        <button class="btn btn-secondary btn-xs btn-change-pwd" data-id="${u.id}"><i class="fa-solid fa-key text-warning"></i> เปลี่ยนรหัสผ่าน</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Subtab 2: Activity Audit Logs -->
        <div class="subtab-content" id="subtab-logs">
          <div class="glass-card style-table-card">
            <div class="card-header">
              <h3><i class="fa-solid fa-list-check text-primary"></i> ประวัติบันทึกการใช้งานระบบ (Activity Audit Logs)</h3>
            </div>
            <div class="table-responsive" style="max-height: 400px;">
              <table class="custom-table">
                <thead>
                  <tr>
                    <th>วัน-เวลา</th>
                    <th>ผู้ใช้งาน</th>
                    <th>บทบาท</th>
                    <th>การกระทำ (Action)</th>
                    <th>โมดูล</th>
                    <th>รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  ${logs.length === 0 ? `
                    <tr><td colspan="6" class="text-center text-muted">ยังไม่มีประวัติการบันทึกกิจกรรมในระบบ</td></tr>
                  ` : logs.map(l => `
                    <tr>
                      <td><small>${new Date(l.timestamp).toLocaleString('th-TH')}</small></td>
                      <td><strong>${l.username}</strong></td>
                      <td><span class="role-pill role-${l.userRole}">${l.userRole}</span></td>
                      <td>
                        <span class="badge-pill ${l.action === 'CREATE' ? 'badge-success' : l.action === 'DELETE' ? 'badge-danger' : 'badge-primary'}">
                          ${l.action}
                        </span>
                      </td>
                      <td><code>${l.module}</code></td>
                      <td>${l.details}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Subtab 3: Utility Rates & History -->
        <div class="subtab-content" id="subtab-rates">
          <div class="grid-2-col">
            <div class="glass-card">
              <div class="card-header">
                <h3><i class="fa-solid fa-sliders text-primary"></i> กำหนดอัตราค่าบริการส่วนกลาง</h3>
              </div>
              <form id="rates-settings-form">
                <div class="form-group">
                  <label>ค่าไฟฟ้า (บาท / หน่วย):</label>
                  <input type="number" step="0.5" id="rate-elec" class="form-control" value="${rates.electricityRate}" required>
                </div>
                <div class="form-group">
                  <label>ค่าน้ำประปา (บาท / หน่วย):</label>
                  <input type="number" step="0.5" id="rate-water" class="form-control" value="${rates.waterRate}" required>
                </div>
                <div class="form-group">
                  <label>ค่าเก็บขยะรายเดือน (บาท / เดือน):</label>
                  <input type="number" id="rate-trash" class="form-control" value="${rates.trashFee}" required>
                </div>
                <div class="form-group">
                  <label>ค่าอินเทอร์เน็ต WiFi (บาท / เดือน):</label>
                  <input type="number" id="rate-internet" class="form-control" value="${rates.internetFee}" required>
                </div>
                <button type="submit" class="btn btn-primary btn-full" style="margin-top: 1rem;"><i class="fa-solid fa-save"></i> บันทึกการเปลี่ยนแปลงอัตราเรท</button>
              </form>
            </div>

            <div class="glass-card">
              <div class="card-header">
                <h3><i class="fa-solid fa-clock-rotate-left text-warning"></i> ประวัติบันทึกการปรับเปลี่ยนราคา</h3>
              </div>
              <div class="table-responsive">
                <table class="custom-table">
                  <thead>
                    <tr>
                      <th>วัน-เวลา</th>
                      <th>ผู้ปรับแก้</th>
                      <th>รายละเอียดอัตราเรทใหม่</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${state.rateHistory.map(h => `
                      <tr>
                        <td><small>${new Date(h.timestamp).toLocaleDateString('th-TH')}</small></td>
                        <td>${h.changedBy}</td>
                        <td><small>ไฟ ฿${h.newRates.electricityRate}/u | น้ำ ฿${h.newRates.waterRate}/u</small></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Subtab 4: Property & PromptPay Settings -->
        <div class="subtab-content" id="subtab-property">
          <div class="glass-card" style="max-width: 650px;">
            <div class="card-header">
              <h3><i class="fa-solid fa-building-circle-check text-primary"></i> ตั้งค่าข้อมูลหอพัก & QR PromptPay</h3>
            </div>
            <form id="property-settings-form">
              <div class="form-group">
                <label>ชื่อหอพัก / อพาร์ทเม้นท์:</label>
                <input type="text" id="prop-name" class="form-control" value="${settings.apartmentName}" required>
              </div>
              <div class="form-group">
                <label>ที่อยู่สำหรับออกเอกสาร:</label>
                <input type="text" id="prop-address" class="form-control" value="${settings.address}" required>
              </div>
              <div class="form-group">
                <label>เบอร์โทรศัพท์ติดต่อ:</label>
                <input type="text" id="prop-tel" class="form-control" value="${settings.tel}" required>
              </div>
              <div class="form-group">
                <label>ชื่อธนาคาร & เลขบัญชีโอนเงิน:</label>
                <input type="text" id="prop-bank" class="form-control" value="${settings.bankName} (${settings.bankAccountNo} - ${settings.bankAccountName})" required>
              </div>
              <div class="form-group">
                <label>หมายเลข PromptPay (เบอร์โทร 10 หลัก หรือ เลขบัตร ปชช. 13 หลัก):</label>
                <input type="text" id="prop-promptpay" class="form-control" value="${settings.promptPayId}" required placeholder="เช่น 0805991691">
              </div>
              <button type="submit" class="btn btn-primary btn-full" style="margin-top: 1rem;"><i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูลหอพัก</button>
            </form>
          </div>
        </div>

        <!-- Subtab 5: Backup & Restore -->
        <div class="subtab-content" id="subtab-backup">
          <div class="grid-2-col">
            <div class="glass-card">
              <div class="card-header">
                <h3><i class="fa-solid fa-download text-success"></i> สำรองข้อมูล (Backup Database)</h3>
              </div>
              <p class="text-muted">ดาวน์โหลดไฟล์สำรองข้อมูล JSON เก็บไว้ในเครื่องคอมพิวเตอร์ของคุณแบบ 100% ปลอดภัย</p>
              <button id="btn-backup-export" class="btn btn-success btn-full" style="margin-top: 1.5rem;">
                <i class="fa-solid fa-file-export"></i> ดาวน์โหลดไฟล์สำรองข้อมูล (.json)
              </button>
            </div>

            <div class="glass-card">
              <div class="card-header">
                <h3><i class="fa-solid fa-upload text-warning"></i> กู้คืนข้อมูล (Restore Database)</h3>
              </div>
              <p class="text-muted">เลือกไฟล์สำรองข้อมูล JSON จากเครื่องเพื่อนำกลับมาใช้งานในระบบ 1-Click Restore</p>
              <button id="btn-restore-trigger" class="btn btn-secondary btn-full" style="margin-top: 1.5rem;">
                <i class="fa-solid fa-file-import"></i> เลือกไฟล์ JSON เพื่อกู้คืน
              </button>
              <input type="file" id="restore-file-input" style="display: none;" accept=".json">
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
