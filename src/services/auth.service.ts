// ==========================================================================
// AUTHENTICATION & RBAC PERMISSION SERVICE
// ==========================================================================

import { UserAccount, UserRole, UserPermission } from '../types/user.types';

export class AuthService {
  private static STORAGE_KEY = 'SOMBAT_APARTMENT_CURRENT_USER';

  public static getRolePermissions(role: UserRole): UserPermission {
    switch (role) {
      case 'super_admin':
        return {
          canManageAdmins: true,
          canManageRooms: true,
          canManageTenants: true,
          canDeleteRecords: true,
          canManageBilling: true,
          canManageRates: true,
          canViewReports: true,
          canBackupRestore: true,
        };
      case 'admin':
        return {
          canManageAdmins: false,
          canManageRooms: true,
          canManageTenants: true,
          canDeleteRecords: true,
          canManageBilling: true,
          canManageRates: true,
          canViewReports: true,
          canBackupRestore: false,
        };
      case 'staff':
      default:
        return {
          canManageAdmins: false,
          canManageRooms: false, // Read only room status
          canManageTenants: false,
          canDeleteRecords: false,
          canManageBilling: true, // Can record payments & issue bills
          canManageRates: false,
          canViewReports: false,
          canBackupRestore: false,
        };
    }
  }

  public static getCurrentUser(): UserAccount | null {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public static setCurrentUser(user: UserAccount | null): void {
    if (user) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  public static isAuthorized(roleRequired: UserRole[]): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    return roleRequired.includes(user.role);
  }
}
