/**
 * PromptPayService Class
 * Calculates and formats Dynamic PromptPay QR Code payloads (EMVCo standard)
 */
export class PromptPayService {
  static sanitizeTarget(target) {
    const clean = String(target || '').replace(/\D/g, '');
    if (clean.length === 10) return `0066${clean.slice(1)}`; // Mobile number
    if (clean.length === 13) return clean; // National ID
    return clean;
  }

  static formatField(id, value) {
    const length = String(value.length).padStart(2, '0');
    return `${id}${length}${value}`;
  }

  static crc16(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      let x = ((crc >> 8) ^ data.charCodeAt(i)) & 0xFF;
      x ^= x >> 4;
      crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  static generatePayload(promptPayId, amount) {
    const cleanTarget = this.sanitizeTarget(promptPayId || '0805991691');
    const targetType = cleanTarget.length === 13 ? '02' : '01';

    const merchantInfo = this.formatField('00', 'A000000677010111') +
                         this.formatField(targetType, cleanTarget);

    let payload = this.formatField('00', '01') + // Payload Format Indicator
                  this.formatField('01', amount ? '12' : '11') + // Point of Initiation Method
                  this.formatField('29', merchantInfo) + // Merchant Account Info
                  this.formatField('53', '764') + // Transaction Currency (THB)
                  this.formatField('58', 'TH'); // Country Code

    if (amount && Number(amount) > 0) {
      const amtStr = Number(amount).toFixed(2);
      payload += this.formatField('54', amtStr);
    }

    payload += '6304';
    const checksum = this.crc16(payload);
    return `${payload}${checksum}`;
  }
}
