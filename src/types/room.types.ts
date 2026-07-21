// ==========================================================================
// ROOM, FLOOR & STATUS TYPE DEFINITIONS
// ==========================================================================

export type RoomStatus = 'occupied' | 'vacant' | 'overdue' | 'reserved';

export interface RoomType {
  id: string;
  name: string; // e.g. Standard Fan, Deluxe Air, Commercial
  description: string;
  defaultRent: number;
}

export interface Room {
  id: string;
  name: string; // e.g. A101, A102
  floor: number;
  typeId: string;
  baseRent: number;
  status: RoomStatus;
  currentTenantId?: string;
  currentTenantName?: string;
  entryDate?: string;
  lastWaterMeter: number;
  lastElecMeter: number;
}
