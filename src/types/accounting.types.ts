// ==========================================================================
// ACCOUNTING INCOME & EXPENSE TYPES
// ==========================================================================

export type LedgerType = 'income' | 'expense';

export interface LedgerEntry {
  id: string;
  date: string;
  type: LedgerType;
  category: 'rent_collected' | 'water_bill' | 'elec_bill' | 'maintenance' | 'housekeeping' | 'utility_master' | 'other';
  description: string;
  amount: number;
  recordedBy: string;
  referenceId?: string; // e.g. invoiceId or repairId
}

export interface FinancialSummary {
  todayIncome: number;
  monthIncome: number;
  monthExpense: number;
  netProfit: number;
  yearIncome: number;
  totalOutstanding: number;
}
