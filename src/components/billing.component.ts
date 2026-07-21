// ==========================================================================
// BILLING COMPONENT (AUTO CALCULATOR, PROMPTPAY QR & PRINT RECEIPT)
// ==========================================================================

import { DatabaseState } from '../services/db.service';
import { Formatters } from '../utils/formatters';

export class BillingComponent {
  public static render(state: DatabaseState): string {
    const invoices = state.invoices;

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-file-invoice-dollar text-primary"></i> ระบบออกบิลและบันทึกชำระเงินค่าเช่า</h2>
            <p>จดมิเตอร์น้ำไฟ คำนวณยอดอัตโนมัติ เจน PromptPay QR Code และสั่งพิมพ์ใบแจ้งหนี้/สลิปใบเสร็จ</p>
          </div>
          <div class="header-actions">
            <button id="btn-create-bill" class="btn btn-primary"><i class="fa-solid fa-calculator"></i> คำนวณออกบิลใหม่</button>
          </div>
        </div>

        <!-- Monthly Invoices Ledger Table -->
        <div class="glass-card style-table-card">
          <div class="table-responsive">
            <table class="custom-table" id="invoices-table">
              <thead>
                <tr>
                  <th>เลขที่บิล / รอบเดือน</th>
                  <th>ห้อง</th>
                  <th>ผู้เช่า</th>
                  <th>มิเตอร์น้ำ (ก่อน ➔ หลัง)</th>
                  <th>มิเตอร์ไฟ (ก่อน ➔ หลัง)</th>
                  <th>ยอดรวมสุทธิ</th>
                  <th>ยอดชำระแล้ว</th>
                  <th>สถานะ</th>
                  <th>การสั่งพิมพ์ & ส่งไลน์</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => {
                  let statusBadge = `<span class="badge-pill badge-danger">🔴 ค้างชำระ</span>`;
                  if (inv.status === 'paid') {
                    statusBadge = `<span class="badge-pill badge-success">🟢 ชำระแล้ว</span>`;
                  } else if (inv.status === 'partial') {
                    statusBadge = `<span class="badge-pill badge-warning">🟡 ชำระบางส่วน</span>`;
                  }

                  const waterUsed = inv.waterCurr - inv.waterPrev;
                  const elecUsed = inv.elecCurr - inv.elecPrev;

                  return `
                    <tr>
                      <td>
                        <strong>${inv.invoiceNumber}</strong>
                        <div class="text-muted text-sm">${Formatters.thaiMonthBE(inv.monthKey)}</div>
                      </td>
                      <td><span class="badge-pill badge-primary">ห้อง ${inv.roomName}</span></td>
                      <td><strong>${inv.tenantName}</strong></td>
                      <td><small>${inv.waterPrev} ➔ ${inv.waterCurr} (${waterUsed} หน่วย)</small></td>
                      <td><small>${inv.elecPrev} ➔ ${inv.elecCurr} (${elecUsed} หน่วย)</small></td>
                      <td><strong class="text-primary">${Formatters.currency(inv.totalAmount)}</strong></td>
                      <td><strong class="text-success">${Formatters.currency(inv.paidAmount)}</strong></td>
                      <td>${statusBadge}</td>
                      <td>
                        <div class="action-buttons">
                          <button class="btn btn-secondary btn-xs btn-qr-promptpay" data-id="${inv.id}" title="สแกน QR PromptPay">
                            <i class="fa-solid fa-qrcode text-primary"></i> QR
                          </button>
                          <button class="btn btn-secondary btn-xs btn-print-bill" data-id="${inv.id}" title="พิมพ์ใบแจ้งหนี้/ใบเสร็จ">
                            <i class="fa-solid fa-print"></i> พิมพ์
                          </button>
                          <button class="btn btn-secondary btn-xs btn-send-line" data-id="${inv.id}" title="ส่งแจ้งเตือน LINE">
                            <i class="fa-brands fa-line text-success"></i> LINE
                          </button>
                          ${inv.status !== 'paid' ? `
                            <button class="btn btn-success btn-xs btn-record-pay" data-id="${inv.id}">
                              <i class="fa-solid fa-check"></i> รับเงิน
                            </button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}
