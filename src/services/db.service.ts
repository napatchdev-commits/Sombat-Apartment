// ==========================================================================
// DATABASE & STORAGE ENGINE (PERSISTENCE & CLOUD SYNC)
// ==========================================================================

import { Tenant } from '../types/tenant.types';
import { Room, RoomType } from '../types/room.types';
import { Invoice, UtilityRates, RateChangeHistory } from '../types/billing.types';
import { RepairRequest } from '../types/repair.types';
import { LedgerEntry } from '../types/accounting.types';
import { UserAccount, PropertySettings } from '../types/user.types';
import { LoggerService } from './logger.service';

export interface DatabaseState {
  settings: PropertySettings;
  rates: UtilityRates;
  rateHistory: RateChangeHistory[];
  users: UserAccount[];
  roomTypes: RoomType[];
  rooms: Room[];
  tenants: Tenant[];
  invoices: Invoice[];
  repairs: RepairRequest[];
  ledger: LedgerEntry[];
}

export class DBService {
  private static STORAGE_KEY = 'SOMBAT_APARTMENT_DB_STATE_V2';

  public static getInitialState(): DatabaseState {
    return {
      settings: {
        apartmentName: 'หอพักสมบัติ นนทบุรี',
        address: '45/10 หมู่ที่ 8 ต.ราษฎร์นิยม อ.ไทรน้อย จ.นนทบุรี 11150',
        tel: '080-5991691',
        lineId: '@sombat_rent',
        bankName: 'ธนาคารกสิกรไทย (K-Bank)',
        bankAccountNo: '080-2-59916-1',
        bankAccountName: 'นายสมบัติ น้ำวน',
        promptPayId: '0805991691',
        googleSheetUrl: '',
      },
      rates: {
        electricityRate: 8.0,
        waterRate: 20.0,
        trashFee: 20.0,
        internetFee: 200.0,
        commonFee: 100.0,
      },
      rateHistory: [
        {
          id: 'rh_1',
          timestamp: '2026-01-01T00:00:00.000Z',
          changedBy: 'superadmin',
          oldRates: { electricityRate: 7, waterRate: 18, trashFee: 20, internetFee: 200, commonFee: 100 },
          newRates: { electricityRate: 8, waterRate: 20, trashFee: 20, internetFee: 200, commonFee: 100 },
        }
      ],
      users: [
        {
          id: 'usr_super',
          username: 'superadmin',
          displayName: 'ผู้ดูแลระบบสูงสุด (Super Admin)',
          role: 'super_admin',
          passwordHash: 'admin123',
          active: true,
        },
        {
          id: 'usr_admin',
          username: 'admin',
          displayName: 'เจ้าของหอพัก / แอดมิน',
          role: 'admin',
          passwordHash: 'admin',
          active: true,
        },
        {
          id: 'usr_staff',
          username: 'staff',
          displayName: 'พนักงานต้อนรับ (Staff)',
          role: 'staff',
          passwordHash: 'staff',
          active: true,
        }
      ],
      roomTypes: [
        { id: 'rt_fan', name: 'ห้องพัดลมมาตรฐาน', description: 'ห้องพัดลมกว้างขวาง ระเบียงส่วนตัว', defaultRent: 2500 },
        { id: 'rt_air', name: 'ห้องแอร์ปรับอากาศ', description: 'เครื่องปรับอากาศประหยัดไฟเบอร์ 5 พร้อมเฟอร์นิเจอร์', defaultRent: 3500 },
        { id: 'rt_shop', name: 'ห้องพาณิชย์ร้านค้า', description: 'ติดถนนหลัก เหมาะค้าขายหรือทำออฟฟิศ', defaultRent: 5500 }
      ],
      rooms: [
        { id: 'r101', name: 'A101', floor: 1, typeId: 'rt_air', baseRent: 3500, status: 'occupied', currentTenantId: 't1', currentTenantName: 'น.ส.กันญา บัวแดง', entryDate: '2025-05-01', lastWaterMeter: 140, lastElecMeter: 1250 },
        { id: 'r102', name: 'A102', floor: 1, typeId: 'rt_air', baseRent: 3500, status: 'overdue', currentTenantId: 't2', currentTenantName: 'นายสมชาย ดีมาก', entryDate: '2025-06-15', lastWaterMeter: 98, lastElecMeter: 840 },
        { id: 'r103', name: 'A103', floor: 1, typeId: 'rt_fan', baseRent: 2500, status: 'vacant', lastWaterMeter: 50, lastElecMeter: 400 },
        { id: 'r104', name: 'A104', floor: 1, typeId: 'rt_fan', baseRent: 2500, status: 'reserved', currentTenantName: 'นายวิชัย จงเจริญ (จองแล้ว)', entryDate: '2026-08-01', lastWaterMeter: 30, lastElecMeter: 210 },
        { id: 'r201', name: 'A201', floor: 2, typeId: 'rt_air', baseRent: 3500, status: 'occupied', currentTenantId: 't3', currentTenantName: 'นางวิไล พรหมดี', entryDate: '2024-03-10', lastWaterMeter: 210, lastElecMeter: 1980 },
        { id: 'r202', name: 'A202', floor: 2, typeId: 'rt_air', baseRent: 3500, status: 'vacant', lastWaterMeter: 85, lastElecMeter: 750 },
        { id: 'r203', name: 'A203', floor: 2, typeId: 'rt_fan', baseRent: 2500, status: 'occupied', currentTenantId: 't4', currentTenantName: 'นายณัฐพงษ์ ศรีสุข', entryDate: '2026-01-10', lastWaterMeter: 115, lastElecMeter: 920 },
        { id: 'r301', name: 'A301', floor: 3, typeId: 'rt_shop', baseRent: 5500, status: 'occupied', currentTenantId: 't5', currentTenantName: 'ร้านสมบัติมินิมาร์ท (คุณมณี)', entryDate: '2023-01-01', lastWaterMeter: 450, lastElecMeter: 4100 }
      ],
      tenants: [
        {
          id: 't1',
          name: 'น.ส.กันญา บัวแดง',
          idCard: '3451200115491',
          tel: '081-2345678',
          lineId: 'kanya_b',
          email: 'kanya@gmail.com',
          address: '12/4 หมู่ 3 ต.บางบัวทอง อ.บางบัวทอง จ.นนทบุรี',
          startDate: '2025-05-01',
          endDate: '2026-08-31',
          remarks: 'ผู้เช่าตรงเวลา อุปกรณ์ครบ',
          assignedRoomId: 'r101',
          deposit: { initialBail: 7000, deductions: [], status: 'active' },
          documents: [
            { id: 'doc1', name: 'สำเนาบัตรประชาชน.pdf', type: 'id_card', fileType: 'pdf', url: '', uploadDate: '2025-05-01', sizeBytes: 245000 },
            { id: 'doc2', name: 'สัญญาเช่าห้อง_A101.pdf', type: 'contract', fileType: 'pdf', url: '', uploadDate: '2025-05-01', sizeBytes: 512000 }
          ]
        },
        {
          id: 't2',
          name: 'นายสมชาย ดีมาก',
          idCard: '1100200345678',
          tel: '089-8765432',
          lineId: 'somchai_d',
          address: '88/1 ถ.แจ้งวัฒนะ อ.ปากเกร็ด จ.นนทบุรี',
          startDate: '2025-06-15',
          endDate: '2026-06-14',
          remarks: 'ค้างชำระบิลเดือนล่าสุด',
          assignedRoomId: 'r102',
          deposit: { initialBail: 7000, deductions: [], status: 'active' },
          documents: []
        },
        {
          id: 't3',
          name: 'นางวิไล พรหมดี',
          idCard: '3100500890123',
          tel: '086-1122334',
          startDate: '2024-03-10',
          endDate: '2026-07-31', // Near expiry
          assignedRoomId: 'r201',
          deposit: { initialBail: 7000, deductions: [], status: 'active' },
          documents: []
        }
      ],
      invoices: [
        {
          id: 'inv_2026_07_r101',
          invoiceNumber: 'INV202607-101',
          monthKey: '2026-07',
          roomId: 'r101',
          roomName: 'A101',
          tenantId: 't1',
          tenantName: 'น.ส.กันญา บัวแดง',
          issueDate: '2026-07-01',
          dueDate: '2026-07-05',
          waterPrev: 130,
          waterCurr: 140,
          elecPrev: 1180,
          elecCurr: 1250,
          rentAmount: 3500,
          waterAmount: 200, // (140-130)*20
          elecAmount: 560,  // (1250-1180)*8
          trashFee: 20,
          internetFee: 0,
          commonFee: 0,
          otherFee: 0,
          fineAmount: 0,
          totalAmount: 4280,
          paidAmount: 4280,
          outstandingAmount: 0,
          status: 'paid',
          paymentDate: '2026-07-03',
          paymentMethod: 'promptpay',
          receiverName: 'แอดมิน (admin)',
          remarks: 'โอนชำระผ่าน PromptPay QR เรียบร้อย'
        },
        {
          id: 'inv_2026_07_r102',
          invoiceNumber: 'INV202607-102',
          monthKey: '2026-07',
          roomId: 'r102',
          roomName: 'A102',
          tenantId: 't2',
          tenantName: 'นายสมชาย ดีมาก',
          issueDate: '2026-07-01',
          dueDate: '2026-07-05',
          waterPrev: 85,
          waterCurr: 98,
          elecPrev: 750,
          elecCurr: 840,
          rentAmount: 3500,
          waterAmount: 260, // (98-85)*20
          elecAmount: 720,  // (840-750)*8
          trashFee: 20,
          internetFee: 0,
          commonFee: 0,
          otherFee: 0,
          fineAmount: 100, // Late fee
          totalAmount: 4600,
          paidAmount: 0,
          outstandingAmount: 4600,
          status: 'unpaid',
          remarks: 'เกินกำหนดชำระแล้ว'
        }
      ],
      repairs: [
        {
          id: 'rep_1',
          ticketNumber: 'REP-2026-001',
          roomId: 'r101',
          roomName: 'A101',
          tenantName: 'น.ส.กันญา บัวแดง',
          title: 'เครื่องปรับอากาศน้ำหยด',
          description: 'แอร์มีน้ำหยดลงเตียงนอน ต้องการช่างมาล้างล้างแอร์',
          category: 'aircon',
          photoUrls: [],
          requestDate: '2026-07-10',
          completedDate: '2026-07-12',
          status: 'completed',
          expenseAmount: 500,
          assignedTechnician: 'ช่างสมศักดิ์ แอร์เซอร์วิส',
          remarks: 'ล้างแอร์เรียบร้อยแล้ว'
        },
        {
          id: 'rep_2',
          ticketNumber: 'REP-2026-002',
          roomId: 'r201',
          roomName: 'A201',
          tenantName: 'นางวิไล พรหมดี',
          title: 'หลอดไฟห้องน้ำเสีย',
          description: 'หลอดไฟกระพริบไม่ติด',
          category: 'electrical',
          photoUrls: [],
          requestDate: '2026-07-18',
          status: 'in_progress',
          expenseAmount: 120,
          assignedTechnician: 'ช่างหอพัก',
        }
      ],
      ledger: [
        {
          id: 'led_1',
          date: '2026-07-03',
          type: 'income',
          category: 'rent_collected',
          description: 'รับชำระค่าเช่าห้อง A101 (รอบ 2026-07)',
          amount: 4280,
          recordedBy: 'admin',
          referenceId: 'inv_2026_07_r101'
        },
        {
          id: 'led_2',
          date: '2026-07-12',
          type: 'expense',
          category: 'maintenance',
          description: 'ค่าล้างแอร์ห้อง A101 (ช่างสมศักดิ์)',
          amount: 500,
          recordedBy: 'admin',
          referenceId: 'rep_1'
        }
      ]
    };
  }

  public static getState(): DatabaseState {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      const initial = this.getInitialState();
      this.saveState(initial);
      return initial;
    }
    try {
      return JSON.parse(raw);
    } catch {
      const initial = this.getInitialState();
      this.saveState(initial);
      return initial;
    }
  }

  public static saveState(state: DatabaseState): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  }

  public static exportJSON(): void {
    const state = this.getState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Sombat_Apartment_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  public static importJSON(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (data && data.settings && data.rooms && data.tenants) {
        this.saveState(data);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
