const USER_PERMISSIONS = {
  super_admin: {
    canManageAdmins: true, canManageRooms: true, canManageTenants: true,
    canDeleteRecords: true, canManageBilling: true, canManageRates: true,
    canViewReports: true, canBackupRestore: true,
  },
  admin: {
    canManageAdmins: false, canManageRooms: true, canManageTenants: true,
    canDeleteRecords: false, canManageBilling: true, canManageRates: true,
    canViewReports: true, canBackupRestore: false,
  },
  staff: {
    canManageAdmins: false, canManageRooms: false, canManageTenants: false,
    canDeleteRecords: false, canManageBilling: false, canManageRates: false,
    canViewReports: false, canBackupRestore: false,
  }
};

export class AuthService {
  static STORAGE_KEY = 'SOMBAT_APARTMENT_CURRENT_USER';

  static getCurrentUser() {
    let raw = sessionStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(this.STORAGE_KEY);
    }
    if (raw) {
      try { return JSON.parse(raw); } catch {}
    }
    // Fallback default admin user on first visit to prevent unauthenticated blank screen
    const defaultUser = { id: 'usr_admin', username: 'admin', displayName: 'เจ้าของหอพัก / แอดมิน', role: 'admin' };
    this.setCurrentUser(defaultUser);
    return defaultUser;
  }

  static setCurrentUser(user) {
    if (user) {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user)); } catch(e) {}
    } else {
      sessionStorage.removeItem(this.STORAGE_KEY);
      try { localStorage.removeItem(this.STORAGE_KEY); } catch(e) {}
    }
  }

  static getPermissions(role) {
    return USER_PERMISSIONS[role] || USER_PERMISSIONS.staff;
  }
}
