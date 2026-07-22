/**
 * LoginComponent Class
 * Renders modern, responsive login interface
 */
export class LoginComponent {
  static render(state = {}) {
    const settings = state.settings || {};
    const apartmentName = settings.apartmentName || 'หอพักสมบัติ นนทบุรี';

    return `
      <div class="login-view-wrapper">
        <div class="login-card glass-card">
          <div class="login-header">
            <div class="login-logo-circle">
              <i class="fa-solid fa-house-lock"></i>
            </div>
            <h2>${apartmentName}</h2>
            <p>ระบบจัดการห้องเช่าและออกบิลอัตโนมัติ Enterprise</p>
          </div>

          <form id="login-form" class="login-form">
            <div class="form-group">
              <label for="login-username"><i class="fa-solid fa-user"></i> ชื่อผู้ใช้งาน (Username)</label>
              <input type="text" id="login-username" class="form-control" placeholder="ป้อน Username..." required autofocus>
            </div>

            <div class="form-group">
              <label for="login-password"><i class="fa-solid fa-key"></i> รหัสผ่าน (Password)</label>
              <div class="input-password-wrapper" style="position:relative;">
                <input type="password" id="login-password" class="form-control" placeholder="ป้อนรหัสผ่าน..." required style="padding-right:2.5rem;">
                <button type="button" id="btn-toggle-password" class="icon-btn" style="position:absolute; right:0.5rem; top:50%; transform:translateY(-50%); border:none; background:none; color:#64748b;">
                  <i class="fa-solid fa-eye"></i>
                </button>
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top:1.5rem; width:100%; font-size:1.05rem;">
              <i class="fa-solid fa-right-to-bracket"></i> เข้าสู่ระบบ
            </button>
          </form>

          <div class="login-quick-accounts" style="margin-top:1.5rem; padding-top:1.25rem; border-top:1px solid #e2e8f0; text-align:center;">
            <p style="font-size:0.85rem; color:#64748b; margin-bottom:0.75rem;">คลิกเพื่อทดสอบเข้าใช้งานรวดเร็ว (1-Click Login):</p>
            <div style="display:flex; justify-content:center; gap:0.5rem; flex-wrap:wrap;">
              <button class="btn btn-xs btn-outline-primary btn-quick-login" data-username="admin">เจ้าของหอพัก (admin)</button>
              <button class="btn btn-xs btn-outline-secondary btn-quick-login" data-username="staff">พนักงาน (staff)</button>
              <button class="btn btn-xs btn-outline-info btn-quick-login" data-username="superadmin">Super Admin</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
