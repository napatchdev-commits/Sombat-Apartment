/**
 * UIHelpers Utility Class
 * Provides reusable UI generators, calculations, and deduplicated data helpers
 */
export class UIHelpers {
  /**
   * Deduplicated summary calculations for Room States
   */
  static calculateRoomSummary(rooms = []) {
    let vacant = 0;
    let occupied = 0;
    let maintenance = 0;

    for (let i = 0; i < rooms.length; i++) {
      const status = rooms[i].status;
      if (status === 'vacant') vacant++;
      else if (status === 'occupied') occupied++;
      else if (status === 'maintenance') maintenance++;
    }

    return {
      total: rooms.length,
      vacant,
      occupied,
      maintenance,
      occupancyRate: rooms.length > 0 ? ((occupied / rooms.length) * 100).toFixed(1) : 0
    };
  }

  /**
   * Deduplicated summary calculations for Financial Invoices
   */
  static calculateFinancialSummary(invoices = []) {
    let totalIncome = 0;
    let totalOutstanding = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      if (invoice.status === 'paid') {
        totalIncome += Number(invoice.paidAmount || invoice.totalAmount || 0);
        paidCount++;
      } else {
        totalOutstanding += Number(invoice.outstandingAmount || invoice.totalAmount || 0);
        unpaidCount++;
      }
    }

    return {
      totalIncome,
      totalOutstanding,
      paidCount,
      unpaidCount,
      totalInvoices: invoices.length
    };
  }

  /**
   * Reusable Badge Builder
   */
  static badge(text, type = 'info') {
    const typeMap = {
      vacant: 'status-badge vacant',
      occupied: 'status-badge occupied',
      maintenance: 'status-badge maintenance',
      paid: 'badge badge-success',
      unpaid: 'badge badge-danger',
      pending: 'badge badge-warning',
      success: 'badge badge-success',
      info: 'badge badge-info',
      danger: 'badge badge-danger',
      warning: 'badge badge-warning'
    };
    const badgeClass = typeMap[type] || 'badge badge-info';
    return `<span class="${badgeClass}">${text}</span>`;
  }

  /**
   * Reusable Button Builder
   */
  static button({ id = '', className = 'btn btn-primary', icon = '', label = '', title = '', attributes = '' }) {
    const iconHtml = icon ? `<i class="${icon}"></i> ` : '';
    const idHtml = id ? `id="${id}"` : '';
    const titleHtml = title ? `title="${title}"` : '';
    return `<button ${idHtml} class="${className}" ${titleHtml} ${attributes}>${iconHtml}${label}</button>`;
  }

  /**
   * Empty State View Builder
   */
  static emptyState(message = 'ไม่พบข้อมูลในระบบ', icon = 'fa-folder-open') {
    return `
      <div style="text-align:center; padding:3rem 1rem; color:#64748b;">
        <i class="fa-solid ${icon}" style="font-size:3rem; margin-bottom:1rem; opacity:0.5;"></i>
        <p style="font-size:1.1rem; font-weight:500; margin:0;">${message}</p>
      </div>
    `;
  }
}
