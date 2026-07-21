// ==========================================================================
// VALIDATOR UTILITIES
// ==========================================================================

export class Validators {
  public static isValidThaiIdCard(idCard: string): boolean {
    const clean = idCard.replace(/\D/g, '');
    if (clean.length !== 13) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(clean.charAt(i), 10) * (13 - i);
    }
    const check = (11 - (sum % 11)) % 10;
    return check === parseInt(clean.charAt(12), 10);
  }

  public static isValidPhone(tel: string): boolean {
    const clean = tel.replace(/\D/g, '');
    return clean.length >= 9 && clean.length <= 10;
  }
}
