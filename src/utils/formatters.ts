// ==========================================================================
// FORMATTER UTILITIES
// ==========================================================================

export class Formatters {
  public static currency(amount: number): string {
    return '฿' + (amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  public static thaiDate(dateStr?: string): string {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const yearBE = parseInt(parts[0], 10) + 543;
    const month = parts[1];
    const day = parts[2];
    return `${day}/${month}/${yearBE}`;
  }

  public static thaiMonthBE(monthKey: string): string {
    if (!monthKey) return '-';
    const parts = monthKey.split('-');
    if (parts.length !== 2) return monthKey;
    const yearBE = parseInt(parts[0], 10) + 543;
    const monthNum = parseInt(parts[1], 10);
    const months = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    return `${months[monthNum - 1]} ${yearBE}`;
  }

  public static formatIdCard(idCard: string): string {
    const clean = idCard.replace(/\D/g, '');
    if (clean.length !== 13) return idCard;
    return `${clean.substring(0, 1)}-${clean.substring(1, 5)}-${clean.substring(5, 10)}-${clean.substring(10, 12)}-${clean.substring(12)}`;
  }
}
