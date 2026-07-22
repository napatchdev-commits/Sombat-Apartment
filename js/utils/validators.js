/**
 * Validators Utility Class
 * Provides input validation helpers for ID cards, phone numbers, and utility meters
 */
export class Validators {
  static validateIdCard(idStr) {
    if (!idStr) return false;
    const clean = String(idStr).replace(/\D/g, '');
    if (clean.length !== 13) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(clean.charAt(i), 10) * (13 - i);
    }
    const checkDigit = (11 - (sum % 11)) % 10;
    return checkDigit === parseInt(clean.charAt(12), 10);
  }

  static validateTel(telStr) {
    if (!telStr) return false;
    const clean = String(telStr).replace(/\D/g, '');
    return clean.length >= 9 && clean.length <= 10;
  }

  static validateMeter(prevMeter, currMeter) {
    const prev = Number(prevMeter);
    const curr = Number(currMeter);
    if (isNaN(prev) || isNaN(curr)) return { valid: false, error: 'ตัวเลขอ่านค่ามิเตอร์ไม่ถูกต้อง' };
    if (curr < prev) return { valid: false, error: 'เลขมิเตอร์ปัจจุบันต้องไม่น้อยกว่าครั้งก่อน' };
    return { valid: true, units: curr - prev };
  }
}
