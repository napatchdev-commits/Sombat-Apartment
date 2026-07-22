/**
 * ExportService Class
 * Handles CSV export and report data extraction
 */
export class ExportService {
  static exportToCSV(filename, headers, rows) {
    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += headers.join(',') + '\n';

    rows.forEach(row => {
      const escapedRow = row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`);
      csvContent += escapedRow.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
