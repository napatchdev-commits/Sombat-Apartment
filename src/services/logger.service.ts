// ==========================================================================
// ACTIVITY AUDIT LOG SERVICE
// ==========================================================================

import { ActivityLog, UserRole } from '../types/user.types';

export class LoggerService {
  private static STORAGE_KEY = 'SOMBAT_APARTMENT_LOGS';

  public static getLogs(): ActivityLog[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static log(
    username: string,
    userRole: UserRole,
    action: ActivityLog['action'],
    module: ActivityLog['module'],
    details: string
  ): void {
    const logs = this.getLogs();
    const newLog: ActivityLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      username,
      userRole,
      action,
      module,
      details,
    };
    logs.unshift(newLog); // Newest first
    // Keep max 500 logs
    if (logs.length > 500) logs.pop();
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
  }
}
