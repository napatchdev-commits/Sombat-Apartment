// ==========================================================================
// TENANT, CONTRACT & DEPOSIT TYPE DEFINITIONS
// ==========================================================================

export interface TenantDocument {
  id: string;
  name: string;
  type: 'id_card' | 'house_reg' | 'contract' | 'other';
  fileType: 'pdf' | 'jpg' | 'png' | 'docx' | 'zip';
  url: string; // Base64 or ObjectURL string
  uploadDate: string;
  sizeBytes: number;
}

export interface SecurityDeposit {
  initialBail: number;
  deductions: {
    id: string;
    description: string;
    amount: number;
    date: string;
  }[];
  refundedAmount?: number;
  refundDate?: string;
  status: 'active' | 'partially_refunded' | 'fully_refunded';
}

export interface RentalContract {
  id: string;
  contractNumber: string;
  roomId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  terms: string;
  pdfGenerated: boolean;
  status: 'active' | 'expired' | 'terminated';
}

export interface Tenant {
  id: string;
  name: string;
  idCard: string;
  tel: string;
  lineId?: string;
  email?: string;
  address?: string;
  startDate: string;
  endDate: string;
  remarks?: string;
  assignedRoomId?: string;
  deposit: SecurityDeposit;
  documents: TenantDocument[];
  contract?: RentalContract;
}
