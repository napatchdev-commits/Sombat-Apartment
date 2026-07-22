export class LoginComponent {
  static render(state) {
    const users = state.users || [
      { username: 'superadmin', displayName: 'สมบัติ น้ำวน', role: 'super_admin' },
      { username: 'admin', displayName: 'เจ้าของหอพัก / แอดมิน', role: 'admin' },
      { username: 'staff', displayName: 'พนักงานต้อนรับ (Staff)', role: 'staff' }
    ];

    return `
      <div class="login-page-container" style="position:fixed; top:0; left:0; width:100vw; height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); padding:1.5rem; z-index:99999; overflow-y:auto;">
        <div class="glass-card animate-fade-in" style="width:100%; max-width:440px; border-radius:16px; padding:2.5rem; background:rgba(255,255,255,0.96); box-shadow:0 20px 40px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2); margin:auto;">
          
          <div style="text-align:center; margin-bottom:2rem;">
            <div style="width:64px; height:64px; background:linear-gradient(135deg, #2563eb, #1d4ed8); color:#fff; border-radius:16px; display:inline-flex; align-items:center; justify-content:center; font-size:1.8rem; margin-bottom:1rem; box-shadow:0 8px 16px rgba(37,99,235,0.3);">
              <i class="fa-solid fa-house-lock"></i>
            </div>
            <h2 style="font-size:1.5rem; font-weight:700; color:#0f172a; margin-bottom:0.35rem;">${(state.settings && state.settings.apartmentName) || 'หอพักสมบัติ นนทบุรี'}</h2>
            <p style="color:#64748b; font-size:0.9rem;">ระบบบริหารจัดการหอพัก Enterprise</p>
          </div>

          <form id="login-form">
            <div class="form-group" style="margin-bottom:1.25rem;">
              <label style="font-weight:600; color:#334155;">Username (ชื่อผู้ใช้งาน)</label>
              <input type="text" id="login-username" class="form-control" value="superadmin" placeholder="ใส่ชื่อผู้ใช้..." required style="padding:0.75rem 1rem; border-radius:8px;">
            </div>

            <div class="form-group" style="margin-bottom:1.25rem;">
              <label style="font-weight:600; color:#334155;">Password (รหัสผ่าน)</label>
              <div style="position:relative;">
                <input type="password" id="login-password" class="form-control" value="admin" placeholder="ใส่รหัสผ่าน..." required style="padding:0.75rem 1rem; border-radius:8px; padding-right:2.5rem;">
                <button type="button" id="btn-toggle-password" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:#64748b; cursor:pointer;" title="แสดง/ซ่อนรหัสผ่าน">
                  <i class="fa-solid fa-eye"></i>
                </button>
              </div>
              <small class="text-muted" style="font-size:0.8rem; margin-top:0.35rem; display:block;">💡 รหัสผ่านเริ่มต้นคือ: <code>admin</code></small>
            </div>

            <div class="form-group" style="margin-bottom:1.5rem;">
              <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-size:0.9rem; color:#475569; user-select:none;">
                <input type="checkbox" id="login-remember-me" checked style="width:16px; height:16px; accent-color:#2563eb;">
                <span>จดจำการเข้าสู่ระบบ (Remember Me)</span>
              </label>
            </div>

            <button type="submit" class="btn btn-primary btn-full" style="padding:0.85rem; font-size:1rem; font-weight:600; border-radius:8px; box-shadow:0 4px 12px rgba(37,99,235,0.25);">
              <i class="fa-solid fa-right-to-bracket"></i> เข้าสู่ระบบ (Log In)
            </button>
          </form>

          <div style="margin-top:2rem; border-top:1px solid #e2e8f0; padding-top:1.5rem;">
            <p style="font-size:0.85rem; font-weight:600; color:#475569; margin-bottom:0.75rem; text-align:center;">⚡ เข้าสู่ระบบแบบ 1-Click (สำหรับผู้ใช้งาน):</p>
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
              ${users.map(u => `
                <button type="button" class="btn btn-secondary btn-sm btn-quick-login" data-username="${u.username}" data-password="${u.passwordHash || 'admin'}" style="justify-content:flex-start; text-align:left; padding:0.65rem 0.85rem; border-radius:8px;">
                  <i class="fa-solid ${u.role === 'super_admin' ? 'fa-crown text-warning' : (u.role === 'admin' ? 'fa-user-shield text-primary' : 'fa-user text-info')}"></i>
                  <span><strong>${u.displayName}</strong> (${u.role === 'super_admin' ? 'Super Admin' : (u.role === 'admin' ? 'Admin' : 'Staff')})</span>
                </button>
              `).join('')}
            </div>
          </div>

        </div>
      </div>
    `;
  }
}

