// ==========================================================================
// BILLING, METERS, UTILITIES & PROMPTPAY TYPES
// ==========================================================================

export interface UtilityRates {
  electricityRate: number; // e.g., 8 baht/unit
  waterRate: number;       // e.g., 20 baht/unit
  trashFee: number;        // e.g., 20 baht/month
  internetFee: number;     // e.g., 200 baht/month
  commonFee: number;       // e.g., 100 baht/month
}

export interface RateChangeHistory {
  id: string;
  timestamp: string;
  changedBy: string;
  oldRates: UtilityRates;
  newRates: UtilityRates;
}

export interface InvoiceItem {
  description: string;
  amount: number;
  units?: number;
  rate?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  monthKey: string; // e.g. "2026-07"
  roomId: string;
  roomName: string;
  tenantId: string;
  tenantName: string;
  issueDate: string;
  dueDate: string;
  
  // Meters
  waterPrev: number;
  waterCurr: number;
  elecPrev: number;
  elecCurr: number;

  // Breakdown
  rentAmount: number;
  waterAmount: number;
  elecAmount: number;
  trashFee: number;
  internetFee: number;
  commonFee: number;
  otherFee: number;
  fineAmount: number;
  
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  
  status: 'paid' | 'unpaid' | 'partial';
  paymentDate?: string;
  paymentMethod?: 'promptpay' | 'transfer' | 'cash';
  receiverName?: string;
  promptpayPayload?: string;
  remarks?: string;
}
