// ==========================================================================
// MAINTENANCE / REPAIR REQUEST TYPES
// ==========================================================================

export type RepairStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface RepairRequest {
  id: string;
  ticketNumber: string;
  roomId: string;
  roomName: string;
  tenantName: string;
  title: string;
  description: string;
  category: 'plumbing' | 'electrical' | 'aircon' | 'structure' | 'other';
  photoUrls: string[];
  requestDate: string;
  completedDate?: string;
  status: RepairStatus;
  expenseAmount: number;
  assignedTechnician?: string;
  remarks?: string;
}
