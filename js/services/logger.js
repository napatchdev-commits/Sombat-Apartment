/**
 * LoggerService Class
 * Manages system audit logs and action histories
 */
export class LoggerService {
  static STORAGE_KEY = 'SOMBAT_APARTMENT_LOGS';

  static getLogs() {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static log(username, role, action, category, details) {
    const logs = this.getLogs();
    const newLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      username: username || 'system',
      role: role || 'admin',
      action,
      category,
      details
    };
    logs.unshift(newLog);

    // Keep latest 200 logs
    if (logs.length > 200) logs.pop();
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    } catch {}
  }
}
