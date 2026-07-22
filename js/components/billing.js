import { Formatters } from '../utils/formatters.js';
import { UIHelpers } from '../utils/helpers.js';

/**
 * BillingComponent Class
 * Handles monthly invoice generation, meter calculations, payment status updates, and LINE notifications
 */
export class BillingComponent {
  static renderHeader() {
    return `
      <div class="workspace-header">
        <div>
          <h2><i class="fa-solid fa-file-invoice-dollar text-primary"></i> ระบบออกบิลและบันทึกชำระเงินค่าเช่า</h2>
          <p>จดมิเตอร์น้ำไฟ คำนวณยอดอัตโนมัติ เจน PromptPay QR Code และสั่งพิมพ์ใบแจ้งหนี้/สลิปใบเสร็จ</p>
        </div>
        <div class="header-actions">
          <button id="btn-create-bill" class="btn btn-primary"><i class="fa-solid fa-calculator"></i> คำนวณออกบิลใหม่</button>
          <button id="btn-line-notify-header" class="btn btn-success" style="margin-left:0.5rem; background-color:#06c755; border-color:#06c755; color:#ffffff;" title="ส่งข้อความแจ้งเตือนค่าเช่าเข้า LINE">
            <i class="fa-brands fa-line"></i> แจ้งเตือน LINE ชำระเงิน
          </button>
        </div>
      </div>
    `;
  }

  static renderTable(invoices = []) {
    if (invoices.length === 0) return UIHelpers.emptyState('ยังไม่มีรายการบิลค่าเช่าในระบบ');

    const rowsHtml = invoices.map(invoice => {
      const isPaid = invoice.status === 'paid';
      const statusBadge = UIHelpers.badge(isPaid ? 'ชำระแล้ว' : 'ค้างชำระ', isPaid ? 'paid' : 'unpaid');
      const elecUnits = (invoice.elecCurr || 0) - (invoice.elecPrev || 0);
      const waterUnits = (invoice.waterCurr || 0) - (invoice.waterPrev || 0);

      return `
        <tr>
          <td><strong>${invoice.invoiceNumber}</strong></td>
          <td>${invoice.monthKey}</td>
          <td><span class="badge badge-info">ห้อง ${invoice.roomName}</span></td>
          <td>คุณ${invoice.tenantName || 'ผู้เช่า'}</td>
          <td>
            <small>ไฟ: ${invoice.elecPrev} -> ${invoice.elecCurr} (${elecUnits} หน่วย)</small><br>
            <small>น้ำ: ${invoice.waterPrev} -> ${invoice.waterCurr} (${waterUnits} หน่วย)</small>
          </td>
          <td><strong>${Formatters.currency(invoice.totalAmount)}</strong></td>
          <td>${statusBadge}</td>
          <td>
            <div class="btn-group">
              <button class="btn btn-xs ${isPaid ? 'btn-outline-danger' : 'btn-success'} btn-toggle-pay-status" data-id="${invoice.id}">
                ${isPaid ? 'ยกเลิกจ่าย' : 'รับชำระเงิน'}
              </button>
              <button class="btn btn-secondary btn-xs btn-edit-bill" data-id="${invoice.id}"><i class="fa-solid fa-pen text-info"></i></button>
              <button class="btn btn-primary btn-xs btn-save-pdf-bill" data-id="${invoice.id}" title="บันทึก PDF ลงชีต"><i class="fa-solid fa-file-pdf"></i> บันทึก PDF</button>
              <button class="btn btn-secondary btn-xs btn-print-bill" data-id="${invoice.id}"><i class="fa-solid fa-print text-warning"></i></button>
              <button class="btn btn-secondary btn-xs btn-send-line" data-id="${invoice.id}"><i class="fa-brands fa-line text-success"></i> LINE</button>
              <button class="btn btn-danger btn-xs btn-delete-bill" data-id="${invoice.id}"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="glass-card style-table-card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>เลขที่บิล</th>
                <th>รอบเดือน</th>
                <th>ห้องพัก</th>
                <th>ผู้เช่า</th>
                <th>มิเตอร์ (น้ำ/ไฟ)</th>
                <th>ยอดบิลสุทธิ</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  static render(state = {}) {
    const invoices = state.invoices || [];
    return `
      <div class="billing-view">
        ${this.renderHeader()}
        ${this.renderTable(invoices)}
      </div>
    `;
  }
}
