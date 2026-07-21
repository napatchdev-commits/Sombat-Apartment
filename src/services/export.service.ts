// ==========================================================================
// EXPORT SERVICE (PDF & EXCEL UTILITY ENGINE)
// ==========================================================================

export class ExportService {
  /**
   * Exports an array of objects to a CSV / Excel compatible file.
   */
  public static exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Thai support
    csvContent += headers.join(',') + '\n';
    
    rows.forEach(row => {
      const escapedRow = row.map(val => {
        const str = String(val ?? '').replace(/"/g, '""');
        return `"${str}"`;
      });
      csvContent += escapedRow.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Triggers printable browser dialog formatted as PDF view for specific element container ID.
   */
  public static printElement(elementId: string): void {
    const element = document.getElementById(elementId);
    if (!element) return;
    window.print();
  }
}
