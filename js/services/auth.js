/**
 * AuthService Class
 * Handles Session-only authentication and role-based permissions
 */
export class AuthService {
  static STORAGE_KEY = 'SOMBAT_APARTMENT_CURRENT_USER';

  /**
   * Retrieves current logged in user from Session Storage.
   * Clears legacy localStorage session to enforce strict session-only authentication.
   */
  static getCurrentUser() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {}

    const rawSession = sessionStorage.getItem(this.STORAGE_KEY);
    if (rawSession) {
      try {
        return JSON.parse(rawSession);
      } catch {}
    }
    return null;
  }

  /**
   * Sets current logged in user in Session Storage.
   */
  static setCurrentUser(user) {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {}

    if (user) {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(this.STORAGE_KEY);
    }
  }

  /**
   * Returns permission flags based on user role
   */
  static getPermissions(role) {
    const isSuper = role === 'super_admin';
    const isAdmin = role === 'admin' || isSuper;
    return {
      canEditRooms: isAdmin,
      canDeleteRooms: isSuper,
      canManageTenants: isAdmin,
      canCreateBills: isAdmin,
      canDeleteBills: isSuper,
      canManageRepairs: true,
      canViewFinancialReports: isAdmin,
      canManageSettings: isAdmin,
      canManageUsers: isSuper
    };
  }
}
