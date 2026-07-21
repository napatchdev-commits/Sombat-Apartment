// ==========================================================================
// USER, ROLES, PERMISSIONS & AUDIT LOG TYPES
// ==========================================================================

export type UserRole = 'super_admin' | 'admin' | 'staff';

export interface UserPermission {
  canManageAdmins: boolean;
  canManageRooms: boolean;
  canManageTenants: boolean;
  canDeleteRecords: boolean;
  canManageBilling: boolean;
  canManageRates: boolean;
  canViewReports: boolean;
  canBackupRestore: boolean;
}

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  passwordHash: string; // Plain/hashed simulation
  lastLogin?: string;
  active: boolean;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  username: string;
  userRole: UserRole;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'BACKUP' | 'RESTORE';
  module: 'TENANTS' | 'ROOMS' | 'BILLING' | 'RATES' | 'REPAIRS' | 'ACCOUNTING' | 'SYSTEM' | 'AUTH';
  details: string;
}

export interface PropertySettings {
  apartmentName: string;
  logoUrl?: string;
  address: string;
  tel: string;
  lineId?: string;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  promptPayId: string; // Phone or Citizen ID
  googleSheetUrl?: string;
  firebaseConfig?: string;
}
