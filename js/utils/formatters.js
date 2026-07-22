/**
 * Formatters Utility Class
 * Provides formatting methods for Currency, Thai Dates, ID Cards, and Telephone Numbers
 */
export class Formatters {
  static currency(num) {
    if (num === null || num === undefined || isNaN(num)) return '฿0.00';
    return `฿${Number(num).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  static thaiDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const thMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
      ];
      const day = d.getDate();
      const month = thMonths[d.getMonth()];
      const year = d.getFullYear() + 543;
      return `${day} ${month} ${year}`;
    } catch {
      return dateStr;
    }
  }

  static thaiMonthBE(monthKey) {
    if (!monthKey) return '-';
    try {
      const parts = monthKey.split('-');
      if (parts.length !== 2) return monthKey;
      const year = parseInt(parts[0], 10) + 543;
      const monthIdx = parseInt(parts[1], 10) - 1;
      const fullMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      return `${fullMonths[monthIdx]} ${year}`;
    } catch {
      return monthKey;
    }
  }

  static formatIdCard(idStr) {
    if (!idStr) return '-';
    const clean = String(idStr).replace(/\D/g, '');
    if (clean.length !== 13) return idStr;
    return `${clean.slice(0, 1)}-${clean.slice(1, 5)}-${clean.slice(5, 10)}-${clean.slice(10, 12)}-${clean.slice(12)}`;
  }

  static formatTel(telStr) {
    if (!telStr) return '-';
    const clean = String(telStr).replace(/\D/g, '');
    if (clean.length === 10) {
      return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    return telStr;
  }
}
