// ==========================================================================
// ACCOUNTING COMPONENT (INCOME & EXPENSE LEDGER & NET PROFIT)
// ==========================================================================

import { DatabaseState } from '../services/db.service';
import { Formatters } from '../utils/formatters';

export class AccountingComponent {
  public static render(state: DatabaseState): string {
    const ledger = state.ledger;

    let totalIncome = 0;
    let totalExpense = 0;

    ledger.forEach(entry => {
      if (entry.type === 'income') {
        totalIncome += entry.amount;
      } else {
        totalExpense += entry.amount;
      }
    });

    const netProfit = totalIncome - totalExpense;

    return `
      <div class="view-container animate-fade-in">
        <div class="view-header">
          <div>
            <h2><i class="fa-solid fa-scale-balanced text-primary"></i> ระบบบัญชี รายรับ - รายจ่าย (Accounting Ledger)</h2>
            <p>บันทึกรายรับค่าน้ำไฟค่าเช่า และรายจ่ายแม่บ้าน ค่าซ่อมบำรุง ค่าน้ำไฟหลวง พร้อมสรุปกำไรสุทธิ</p>
          </div>
          <div class="header-actions">
            <button id="btn-add-ledger-entry" class="btn btn-primary"><i class="fa-solid fa-plus-circle"></i> บันทึกรายการทางบัญชี</button>
          </div>
        </div>

        <!-- Summary Cards Row -->
        <div class="kpi-cards-grid" style="margin-bottom: 1.5rem;">
          <div class="kpi-card card-green">
            <div class="kpi-icon"><i class="fa-solid fa-arrow-down-left-and-arrow-up-right"></i></div>
            <div class="kpi-content">
              <span class="label">รายรับรวมทั้งหมด</span>
              <h3 class="value text-success">${Formatters.currency(totalIncome)}</h3>
            </div>
          </div>

          <div class="kpi-card card-red">
            <div class="kpi-icon"><i class="fa-solid fa-money-bill-transfer"></i></div>
            <div class="kpi-content">
              <span class="label">รายจ่ายรวมทั้งหมด</span>
              <h3 class="value text-danger">${Formatters.currency(totalExpense)}</h3>
            </div>
          </div>

          <div class="kpi-card ${netProfit >= 0 ? 'card-blue' : 'card-red'}">
            <div class="kpi-icon"><i class="fa-solid fa-sack-dollar"></i></div>
            <div class="kpi-content">
              <span class="label">กำไรสุทธิ (Net Profit)</span>
              <h3 class="value ${netProfit >= 0 ? 'text-primary' : 'text-danger'}">${Formatters.currency(netProfit)}</h3>
            </div>
          </div>
        </div>

        <!-- Ledger Table -->
        <div class="glass-card style-table-card">
          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>วันที่บันทึก</th>
                  <th>ประเภทรายการ</th>
                  <th>หมวดหมู่</th>
                  <th>รายการคำอธิบาย</th>
                  <th>จำนวนเงิน (บาท)</th>
                  <th>ผู้บันทึก</th>
                </tr>
              </thead>
              <tbody>
                ${ledger.map(item => `
                  <tr>
                    <td>${Formatters.thaiDate(item.date)}</td>
                    <td>
                      <span class="badge-pill ${item.type === 'income' ? 'badge-success' : 'badge-danger'}">
                        ${item.type === 'income' ? '🟢 รายรับ (+)' : '🔴 รายจ่าย (-)'}
                      </span>
                    </td>
                    <td><span class="badge-pill badge-gray">${item.category}</span></td>
                    <td><strong>${item.description}</strong></td>
                    <td>
                      <strong class="${item.type === 'income' ? 'text-success' : 'text-danger'}">
                        ${item.type === 'income' ? '+' : '-'}${Formatters.currency(item.amount)}
                      </strong>
                    </td>
                    <td>${item.recordedBy}</td>
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
