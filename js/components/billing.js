import { Formatters } from '../utils/formatters.js';
export class BillingComponent {
  static render(state) {
    const rawInvoices = state.invoices || [];
    const invoices = DBService.getUniqueInvoices(rawInvoices);
    state.invoices = invoices;

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
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

        <div class="glass-card style-table-card">
          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>เลขที่บิล / รอบเดือน</th>
                  <th>ห้อง</th>
                  <th>ผู้เช่า</th>
                  <th>ยอดรวมสุทธิ</th>
                  <th>สถานะ</th>
                  <th>การสั่งพิมพ์ & ส่งไลน์</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => `
                  <tr>
                    <td><strong>${inv.invoiceNumber}</strong><div class="text-muted text-sm">${Formatters.thaiMonthBE(inv.monthKey)}</div></td>
                    <td><span class="badge-pill badge-primary">ห้อง ${inv.roomName}</span></td>
                    <td><strong>${inv.tenantName}</strong></td>
                    <td><strong class="text-primary">${Formatters.currency(inv.totalAmount)}</strong></td>
                    <td>
                      <button class="btn btn-xs ${inv.status === 'paid' ? 'btn-success' : 'btn-danger'} btn-toggle-pay-status" data-id="${inv.id}">
                        ${inv.status === 'paid' ? '🟢 ชำระแล้ว' : '🔴 ค้างชำระ'}
                      </button>
                    </td>
                    <td>
                      <div class="action-buttons">
                        <button class="btn btn-secondary btn-xs btn-edit-bill" data-id="${inv.id}"><i class="fa-solid fa-pen text-info"></i> แก้ไข</button>
                        <button class="btn btn-primary btn-xs btn-save-pdf-bill" data-id="${inv.id}" title="บันทึก PDF ลงชีต"><i class="fa-solid fa-file-pdf"></i> บันทึก PDF</button>
                        <button class="btn btn-secondary btn-xs btn-print-bill" data-id="${inv.id}"><i class="fa-solid fa-print text-warning"></i> พิมพ์บิล</button>
                        <button class="btn btn-secondary btn-xs btn-send-line" data-id="${inv.id}"><i class="fa-brands fa-line text-success"></i> LINE</button>
                        <button class="btn btn-danger btn-xs btn-delete-bill" data-id="${inv.id}"><i class="fa-solid fa-trash"></i> ลบ</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

class RepairsComponent {
