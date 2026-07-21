// ==========================================================================
// DYNAMIC PROMPTPAY QR PAYLOAD GENERATOR (EMVCo Standard)
// ==========================================================================

export class PromptPayService {
  /**
   * Generates a Thai EMVCo QR Code payload string for PromptPay.
   * Target can be a 10-digit mobile number (e.g. 0805991691) or 13-digit Citizen ID.
   */
  public static generatePayload(target: string, amount: number): string {
    const sanitizedTarget = target.replace(/[^0-9]/g, '');
    let formattedTarget = '';

    if (sanitizedTarget.length === 10) {
      // Mobile phone number: 0066 + 9 digits (drop leading 0)
      formattedTarget = '0066' + sanitizedTarget.substring(1);
    } else if (sanitizedTarget.length === 13) {
      // Citizen ID / Tax ID
      formattedTarget = sanitizedTarget;
    } else {
      formattedTarget = '0066805991691'; // Fallback
    }

    const targetType = sanitizedTarget.length === 10 ? '01' : '02';
    
    // Tag 29 - Merchant Account Information (PromptPay ID)
    const tag29_00 = '0016A000000677010111'; // AID for PromptPay
    const tag29_target = targetType + this.pad2(formattedTarget.length) + formattedTarget;
    const tag29_content = tag29_00 + tag29_target;
    const tag29 = '29' + this.pad2(tag29_content.length) + tag29_content;

    // Tag 53 - Transaction Currency (764 = THB)
    const tag53 = '5303764';

    // Tag 54 - Transaction Amount (optional if amount > 0)
    let tag54 = '';
    if (amount && amount > 0) {
      const amtStr = amount.toFixed(2);
      tag54 = '54' + this.pad2(amtStr.length) + amtStr;
    }

    // Tag 58 - Country Code (TH)
    const tag58 = '5802TH';

    // Tag 63 - CRC checksum header
    const rawPayload = '000201010212' + tag29 + tag53 + tag54 + tag58 + '6304';
    const crc = this.crc16(rawPayload);

    return rawPayload + crc;
  }

  private static pad2(num: number): string {
    return num < 10 ? '0' + num : '' + num;
  }

  private static crc16(data: string): string {
    let crc = 0xffff;
    for (let i = 0; i < data.length; i++) {
      let x = ((crc >> 8) ^ data.charCodeAt(i)) & 0xff;
      x ^= x >> 4;
      crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xffff;
    }
    const hex = (crc & 0xffff).toString(16).toUpperCase();
    return hex.padStart(4, '0');
  }
}
