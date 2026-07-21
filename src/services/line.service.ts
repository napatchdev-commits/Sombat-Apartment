// ==========================================================================
// LINE NOTIFICATION SIMULATION SERVICE
// ==========================================================================

import { Invoice } from '../types/billing.types';
import { Tenant } from '../types/tenant.types';

export class LineService {
  /**
   * Generates formatted LINE notification text message for billing/reminders.
   */
  public static createBillingMessage(invoice: Invoice, propertyName: string): string {
    return `📢 [${propertyName}] ใบแจ้งหนี้ประจำเดือน ${invoice.monthKey}
----------------------------------------
🏠 ห้อง: ${invoice.roomName}
👤 ผู้เช่า: ${invoice.tenantName}
💵 ยอดบิลรวมสุทธิ: ฿${invoice.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
📅 กำหนดชำระภายใน: ${invoice.dueDate}

รายละเอียดเพิ่มเติม:
- ค่าเช่าห้อง: ฿${invoice.rentAmount.toLocaleString()}
- ค่าน้ำประปา (${invoice.waterPrev} -> ${invoice.waterCurr}): ฿${invoice.waterAmount.toLocaleString()}
- ค่าไฟฟ้า (${invoice.elecPrev} -> ${invoice.elecCurr}): ฿${invoice.elecAmount.toLocaleString()}
- ค่าขยะ/อื่นๆ: ฿${(invoice.trashFee + invoice.internetFee + invoice.commonFee + invoice.otherFee).toLocaleString()}

กรุณาโอนชำระเงินตามยอดดังกล่าว แล้วส่งสลิปยืนยันทาง LINE นี้ ขอบคุณครับ/ค่ะ 🙏`;
  }

  public static createOverdueMessage(invoice: Invoice, propertyName: string): string {
    return `⚠️ [แจ้งเตือนค้างชำระ - ${propertyName}]
----------------------------------------
🏠 ห้อง: ${invoice.roomName} (คุณ${invoice.tenantName})
❌ ยอดค้างชำระ: ฿${invoice.outstandingAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
📅 เกินกำหนดชำระตั้งแต่วันที่: ${invoice.dueDate}

กรุณาดำเนินการชำระเงินและแจ้งสลิปทันทีเพื่อป้องกันค่าปรับจ่ายล่าช้า ขอบคุณครับ/ค่ะ`;
  }

  public static createContractExpiryMessage(tenant: Tenant, roomName: string, propertyName: string): string {
    return `🔔 [แจ้งเตือนสัญญาเช่าใกล้หมดอายุ - ${propertyName}]
----------------------------------------
🏠 ห้อง: ${roomName} (คุณ${tenant.name})
📅 วันสิ้นสุดสัญญา: ${tenant.endDate}

กรุณาติดต่อเจ้าหน้าที่หอพักล่วงหน้าหากต้องการต่อสัญญาเช่าหรือแจ้งกำหนดวันย้ายออก ขอบคุณครับ/ค่ะ`;
  }
}
