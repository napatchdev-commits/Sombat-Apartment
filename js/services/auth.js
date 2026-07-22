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
    // Clear legacy localStorage login session to ensure fresh login on browser close
    try { localStorage.removeItem(this.STORAGE_KEY); } catch(e) {}
    
    const rawSession = sessionStorage.getItem(this.STORAGE_KEY);
    if (rawSession) {
      try { return JSON.parse(rawSession); } catch {}
    }
    return null;
  }

  static setCurrentUser(user) {
    try { localStorage.removeItem(this.STORAGE_KEY); } catch(e) {}
    if (user) {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(this.STORAGE_KEY);
    }
  }

  static getPermissions(role) {
    return USER_PERMISSIONS[role] || USER_PERMISSIONS.staff;
  }
}
