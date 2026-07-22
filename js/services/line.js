/**
 * LineService Class
 * Formats rent notification messages and manages LINE Messaging API / LINE Share integrations
 */
export class LineService {
  static createBillingMessage(invoice, propertyName, tenantUrl, lineBotUrl, isBroadcast = false) {
    const apartmentName = propertyName || 'หอพักสมบัติ นนทบุรี';
    const portalUrl = tenantUrl || (localStorage.getItem('SOMBAT_TENANT_PORTAL_URL') || `${window.location.origin}/tenant.html`);
    const botUrl = lineBotUrl !== undefined ? lineBotUrl : (localStorage.getItem('SOMBAT_LINE_BOT_URL') || '');

    const greeting = (isBroadcast || !invoice || !invoice.tenantName)
      ? 'เรียนผู้เช่าทุกท่าน'
      : `เรียน คุณ${invoice.tenantName}`;

    let msg = `🏠 ${apartmentName}\n\n📢 แจ้งเตือนค่าเช่าประจำเดือน\n\n${greeting}\n\nระบบได้ออกบิลประจำเดือนเรียบร้อยแล้ว\n\nกรุณาเข้าสู่ระบบผู้เช่า\nเพื่อตรวจสอบรายละเอียดบิล\nและอัปโหลดหลักฐานการชำระเงิน\n\nกดที่นี่\n\n${portalUrl}`;

    if (botUrl && botUrl.trim()) {
      msg += `\n\nติดต่อสอบถาม / LINE Bot:\n${botUrl.trim()}`;
    }

    msg += `\n\nขอบคุณครับ`;
    return msg;
  }
}
