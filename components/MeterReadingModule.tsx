'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================
export interface Room {
  id: string;
  name: string;
  floor: number;
  typeId?: string;
  baseRent: number;
  status: 'vacant' | 'occupied' | 'overdue';
  currentTenantId?: string;
  currentTenantName?: string;
  lastWaterMeter: number;
  lastElecMeter: number;
}

export interface Invoice {
  id: string;
  monthKey: string;
  roomId: string;
  roomName: string;
  tenantName: string;
  rentAmount: number;
  waterPrev: number;
  waterCurr: number;
  waterAmount: number;
  elecPrev: number;
  elecCurr: number;
  elecAmount: number;
  trashFee: number;
  fineAmount: number;
  internetFee: number;
  commonFee: number;
  totalAmount: number;
  status: 'unpaid' | 'paid' | 'overdue';
}

export interface MeterAuditLog {
  id: string;
  roomId: string;
  roomName: string;
  monthKey: string;
  recordedBy: string;
  actionType: 'RECORD' | 'EDIT';
  oldWaterCurr: number;
  newWaterCurr: number;
  oldElecCurr: number;
  newElecCurr: number;
  waterUnits: number;
  elecUnits: number;
  waterAmount: number;
  elecAmount: number;
  notes?: string;
  createdAt: string;
}

export interface MeterReadingModuleProps {
  rooms: Room[];
  invoices: Invoice[];
  waterRate?: number;
  electricityRate?: number;
  currentUser?: { username: string; displayName: string; role: string };
  onSaveReading: (payload: {
    invoiceId: string;
    roomId: string;
    monthKey: string;
    waterPrev: number;
    waterCurr: number;
    waterUnits: number;
    waterAmount: number;
    elecPrev: number;
    elecCurr: number;
    elecUnits: number;
    elecAmount: number;
    totalAmount: number;
    notes?: string;
    isEdit: boolean;
  }) => Promise<void>;
}

// ============================================================================
// Next.js / React / TypeScript / Tailwind Component: MeterReadingModule
// ============================================================================
export const MeterReadingModule: React.FC<MeterReadingModuleProps> = ({
  rooms = [],
  invoices = [],
  waterRate = 20.0,
  electricityRate = 8.0,
  currentUser = { username: 'admin', displayName: 'แอดมิน', role: 'admin' },
  onSaveReading
}) => {
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'room' | 'floor' | 'unread'>('room');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [waterCurrInput, setWaterCurrInput] = useState<string>('');
  const [elecCurrInput, setElecCurrInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Draft state to store typed meter readings per room (loaded from localStorage for unmount persistence)
  const [draftMeters, setDraftMeters] = useState<Record<string, { water: string; elec: string; notes: string }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('draft_meter_readings');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        console.error('Failed to parse draft meters:', e);
      }
    }
    return {};
  });

  // Sync drafts to localStorage on change
  useEffect(() => {
    localStorage.setItem('draft_meter_readings', JSON.stringify(draftMeters));
  }, [draftMeters]);

  // Prevent wheel events from changing number input values (using capture phase)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (
        e.target instanceof HTMLInputElement &&
        e.target.type === 'number'
      ) {
        e.preventDefault();
      }
    };
    document.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      document.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, []);

  const handleWaterChange = (val: string) => {
    setWaterCurrInput(val);
    if (selectedRoom) {
      setDraftMeters(prev => ({
        ...prev,
        [selectedRoom.id]: {
          water: val,
          elec: elecCurrInput,
          notes: notesInput
        }
      }));
    }
  };

  const handleElecChange = (val: string) => {
    setElecCurrInput(val);
    if (selectedRoom) {
      setDraftMeters(prev => ({
        ...prev,
        [selectedRoom.id]: {
          water: waterCurrInput,
          elec: val,
          notes: notesInput
        }
      }));
    }
  };

  const handleNotesChange = (val: string) => {
    setNotesInput(val);
    if (selectedRoom) {
      setDraftMeters(prev => ({
        ...prev,
        [selectedRoom.id]: {
          water: waterCurrInput,
          elec: elecCurrInput,
          notes: val
        }
      }));
    }
  };
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<MeterAuditLog[]>([]);

  // Find invoice for selected room in current month
  const currentInvoice = useMemo(() => {
    if (!selectedRoom) return null;
    return invoices.find(
      inv => inv.roomId === selectedRoom.id && inv.monthKey === currentMonthStr
    );
  }, [selectedRoom, invoices, currentMonthStr]);

  // Determine if a room is recorded for current month
  const checkRoomRecorded = useCallback((roomId: string) => {
    const inv = invoices.find(i => i.roomId === roomId && i.monthKey === currentMonthStr);
    return Boolean(inv && inv.waterCurr > 0 && inv.elecCurr > 0);
  }, [invoices, currentMonthStr]);

  // Filtered & Sorted Rooms
  const processedRooms = useMemo(() => {
    let result = [...rooms];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        r => r.name.toLowerCase().includes(q) || (r.currentTenantName && r.currentTenantName.toLowerCase().includes(q))
      );
    }

    const cleanRoomName = (roomName: string) => {
      let name = String(roomName || '').trim();
      name = name.replace(/^(?:ห้องพัก|ห้อง)\s*/, '');
      return name.trim();
    };

    const getRoomSortWeight = (roomName: string) => {
      const name = cleanRoomName(roomName);
      if (!name) return 2;
      if (/^s/i.test(name)) return 1;
      const isNamed = /^[^A-Za-z0-9]/i.test(name) || name.startsWith('บ้าน') || name.startsWith('เรือน');
      if (isNamed) return 3;
      return 2;
    };

    const compareRooms = (a: any, b: any) => {
      const nameA = cleanRoomName(a.name);
      const nameB = cleanRoomName(b.name);
      const wA = getRoomSortWeight(nameA);
      const wB = getRoomSortWeight(nameB);
      if (wA !== wB) return wA - wB;
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    };

    result.sort((a, b) => {
      if (sortBy === 'floor') {
        if (a.floor !== b.floor) return a.floor - b.floor;
        return compareRooms(a, b);
      }
      if (sortBy === 'unread') {
        const aRecorded = checkRoomRecorded(a.id) ? 1 : 0;
        const bRecorded = checkRoomRecorded(b.id) ? 1 : 0;
        if (aRecorded !== bRecorded) return aRecorded - bRecorded;
        return compareRooms(a, b);
      }
      return compareRooms(a, b);
    });

    return result;
  }, [rooms, searchQuery, sortBy, checkRoomRecorded]);

  // Open Room Detail Modal
  const handleSelectRoom = (room: Room) => {
    setSelectedRoom(room);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    const draft = draftMeters[room.id];
    const inv = invoices.find(i => i.roomId === room.id && i.monthKey === currentMonthStr);
    
    if (draft) {
      setWaterCurrInput(draft.water);
      setElecCurrInput(draft.elec);
      setNotesInput(draft.notes);
      setIsEditing(true);
    } else if (inv && inv.waterCurr > 0 && inv.elecCurr > 0) {
      setWaterCurrInput(String(inv.waterCurr));
      setElecCurrInput(String(inv.elecCurr));
      setNotesInput(inv.notes || '');
      setIsEditing(false); // Locked until user clicks "แก้ไขมิเตอร์"
    } else {
      setWaterCurrInput('');
      setElecCurrInput('');
      setNotesInput('');
      setIsEditing(true);
    }
  };

  // Submit Handler with Validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedRoom) return;

    if (!currentInvoice) {
      setErrorMessage('⚠️ ยังไม่ได้สร้างบิลของเดือนนี้');
      return;
    }

    const waterPrev = currentInvoice.waterPrev || selectedRoom.lastWaterMeter || 0;
    const elecPrev = currentInvoice.elecPrev || selectedRoom.lastElecMeter || 0;

    const waterCurr = parseFloat(waterCurrInput);
    const elecCurr = parseFloat(elecCurrInput);

    if (isNaN(waterCurr) || isNaN(elecCurr)) {
      setErrorMessage('กรุณากรอกเลขมิเตอร์น้ำและไฟให้ครบถ้วน');
      return;
    }

    // Validation: New meter reading MUST NOT be less than previous meter reading
    if (waterCurr < waterPrev || elecCurr < elecPrev) {
      setErrorMessage('❌ เลขมิเตอร์ต้องไม่น้อยกว่าค่าครั้งก่อน');
      return;
    }

    const waterUnits = Math.max(0, waterCurr - waterPrev);
    const elecUnits = Math.max(0, elecCurr - elecPrev);
    const waterAmount = waterUnits * waterRate;
    const elecAmount = elecUnits * electricityRate;

    const newTotal = (currentInvoice.rentAmount || 0) + 
                     waterAmount + 
                     elecAmount + 
                     (currentInvoice.trashFee || 0) + 
                     (currentInvoice.fineAmount || 0) + 
                     (currentInvoice.internetFee || 0) + 
                     (currentInvoice.commonFee || 0);

    setLoading(true);
    try {
      await onSaveReading({
        invoiceId: currentInvoice.id,
        roomId: selectedRoom.id,
        monthKey: currentMonthStr,
        waterPrev,
        waterCurr,
        waterUnits,
        waterAmount,
        elecPrev,
        elecCurr,
        elecUnits,
        elecAmount,
        totalAmount: newTotal,
        notes: notesInput.trim(),
        isEdit: Boolean(currentInvoice.waterCurr > 0 && currentInvoice.elecCurr > 0)
      });

      // Clear draft for this room upon successful save
      setDraftMeters(prev => {
        const next = { ...prev };
        delete next[selectedRoom.id];
        return next;
      });

      setSuccessMessage('✅ บันทึกเลขมิเตอร์น้ำ-ไฟเรียบร้อยแล้ว!');
      setIsEditing(false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">⚡</span> จดมิเตอร์น้ำ-ไฟ (Meter Reading)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            บันทึกเลขจดมิเตอร์น้ำประปาและไฟฟ้าประจำเดือน คำนวณยอดเงินและอัปเดตบิลอัตโนมัติ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg">
            รอบบิล: {currentMonthStr}
          </span>
          <span className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg">
            {currentUser.displayName} ({currentUser.role})
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            placeholder="ค้นหาเลขห้อง หรือชื่อผู้เช่า..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <span className="absolute left-3.5 top-3.5 text-slate-400">🔍</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">เรียงตาม:</label>
          <select
            className="py-3 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
          >
            <option value="room">เลขห้องพัก</option>
            <option value="floor">ชั้นห้องพัก</option>
            <option value="unread">ยังไม่จดมิเตอร์</option>
          </select>
        </div>
      </div>

      {/* Room Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {processedRooms.map(room => {
          const isRecorded = checkRoomRecorded(room.id);
          const isVacant = room.status === 'vacant';

          return (
            <div
              key={room.id}
              onClick={() => handleSelectRoom(room)}
              className={`cursor-pointer rounded-2xl p-5 transition-all duration-200 border bg-white shadow-sm hover:shadow-md flex flex-col justify-between ${
                isRecorded ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-slate-900">ห้อง {room.name}</h3>
                  <span
                    className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                      isRecorded
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isRecorded ? '✓ จดแล้ว' : '○ ยังไม่จด'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <p>ผู้เช่า: <strong className="text-slate-700">{room.currentTenantName || 'ไม่มีผู้เช่า'}</strong></p>
                  <p>ชั้น: {room.floor} | สถานะ: {isVacant ? 'ว่าง' : 'มีผู้เช่า'}</p>
                  <p>มิเตอร์ล่าสุด: น้ำ {room.lastWaterMeter} | ไฟ {room.lastElecMeter}</p>
                </div>
              </div>
              <button
                className={`mt-4 w-full py-2.5 rounded-xl font-semibold text-xs transition-all ${
                  isRecorded
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                }`}
              >
                {isRecorded ? 'ดูรายละเอียด / แก้ไข' : '⚡ จดมิเตอร์ห้องนี้'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Selected Room Modal Popup */}
      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">บันทึกมิเตอร์ ห้อง {selectedRoom.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">ผู้เช่า: {selectedRoom.currentTenantName || 'ไม่มีผู้เช่า'}</p>
              </div>
              <button
                onClick={() => setSelectedRoom(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            {/* Error / Success Notifications */}
            {errorMessage && (
              <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold">
                {successMessage}
              </div>
            )}

            {!currentInvoice ? (
              <div className="p-6 text-center bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm font-semibold">
                ⚠️ ยังไม่ได้สร้างบิลของเดือนนี้ ({currentMonthStr})<br />
                <span className="text-xs font-normal text-amber-600 mt-1 block">
                  กรุณาสร้างบิลประจำเดือนในหน้าระบบออกบิลก่อนทำการจดมิเตอร์
                </span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Previous Readings Summary */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block">มิเตอร์น้ำครั้งก่อน</span>
                    <strong className="text-blue-700 text-sm">{currentInvoice.waterPrev || selectedRoom.lastWaterMeter || 0}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">มิเตอร์ไฟครั้งก่อน</span>
                    <strong className="text-amber-700 text-sm">{currentInvoice.elecPrev || selectedRoom.lastElecMeter || 0}</strong>
                  </div>
                </div>

                {/* Meter Input Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      เลขมิเตอร์น้ำล่าสุด *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      disabled={!isEditing}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                      placeholder="กรอกเลขมิเตอร์น้ำ..."
                      value={waterCurrInput}
                      onChange={e => handleWaterChange(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      เลขมิเตอร์ไฟล่าสุด *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      disabled={!isEditing}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                      placeholder="กรอกเลขมิเตอร์ไฟ..."
                      value={elecCurrInput}
                      onChange={e => handleElecChange(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      หมายเหตุ (ไม่บังคับ)
                    </label>
                    <input
                      type="text"
                      disabled={!isEditing}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                      placeholder="เช่น แจ้งเปลี่ยนมิเตอร์ใหม่..."
                      value={notesInput}
                      onChange={e => handleNotesChange(e.target.value)}
                    />
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="pt-2 flex items-center gap-3">
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl shadow-md transition-all"
                    >
                      ✏️ แก้ไขมิเตอร์
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-all disabled:opacity-50"
                    >
                      {loading ? 'กำลังบันทึก...' : '💾 บันทึกข้อมูลมิเตอร์'}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MeterReadingModule;
