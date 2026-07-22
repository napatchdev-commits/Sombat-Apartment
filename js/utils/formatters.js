export class Formatters {
  static currency(amount) { return '฿' + (parseFloat(amount) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  static thaiDate(dateStr) { if (!dateStr) return '-'; try { const d = new Date(dateStr); if (isNaN(d.getTime())) return dateStr; const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']; return ${d.getDate()}  ; } catch { return dateStr; } }
  static thaiMonthBE(monthKey) { if (!monthKey) return '-'; try { const [y, m] = monthKey.split('-'); const fullMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']; return ${fullMonths[parseInt(m)-1]} ; } catch { return monthKey; } }
  static formatIdCard(id) { if (!id) return '-'; const c = String(id).replace(/\D/g, ''); return c.length === 13 ? ${c.slice(0,1)}---- : id; }
  static formatTel(tel) { if (!tel) return '-'; const c = String(tel).replace(/\D/g, ''); return c.length === 10 ? ${c.slice(0,3)}-- : tel; }
}
