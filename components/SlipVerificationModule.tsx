'use client';

import React, { useState, useMemo } from 'react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================
export interface PaymentSlip {
  id: string;
  invoiceId: string;
  tenantId?: string;
  roomId?: string;
  roomName: string;
  tenantName: string;
  monthKey: string;
  storagePath?: string;
  publicUrl: string;
  amount: number;
  requiredAmount: number;
  fineAmount?: number;
  referenceNo?: string;
  qrTransactionId?: string;
  senderBank?: string;
  receiverBank?: string;
  transactionDate?: string;
  transactionTime?: string;
  verificationStatus: 'pending' | 'approved' | 'rejected' | 'amount_mismatch' | 'duplicate';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectReason?: string;
  createdAt: string;
}

export interface SlipVerificationModuleProps {
  slips: PaymentSlip[];
  currentUserDisplayName?: string;
  onApproveSlip: (slipId: string, adminName: string) => Promise<void>;
  onRejectSlip: (slipId: string, adminName: string, reason: string) => Promise<void>;
  onRefreshData?: () => Promise<void>;
}

// Predefined Reject Reasons
const REJECT_REASONS = [
  'ยอดเงินไม่ตรงกับยอดบิลสุทธิ',
  'สลิปไม่ชัดเจน / ตัวหนังสือเบลอ อ่านไม่ได้',
  'พบการใช้งานสลิปซ้ำในระบบ',
  'ไม่ใช่บัญชีปลายทางของหอพัก',
  'สลิปถูกยกเลิกทำรายการจากต้นทาง',
  'วันที่/เวลาในสลิปไม่ตรงกับรอบบิล'
];

export default function SlipVerificationModule({
  slips = [],
  currentUserDisplayName = 'แอดมิน',
  onApproveSlip,
  onRejectSlip,
  onRefreshData
}: SlipVerificationModuleProps) {
  // ── States ─────────────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSlip, setSelectedSlip] = useState<PaymentSlip | null>(null);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(1);
  
  // Reject Modal
  const [rejectingSlip, setRejectingSlip] = useState<PaymentSlip | null>(null);
  const [customRejectReason, setCustomRejectReason] = useState<string>('');
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>(REJECT_REASONS[0]);
  
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // ── Filtered Slips ────────────────────────────────────────────────────────
  const filteredSlips = useMemo(() => {
    return slips.filter(slip => {
      // Status filter
      if (filterStatus !== 'all' && slip.verificationStatus !== filterStatus) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchRoom = slip.roomName.toLowerCase().includes(q);
        const matchTenant = slip.tenantName.toLowerCase().includes(q);
        const matchRef = (slip.referenceNo || '').toLowerCase().includes(q);
        const matchMonth = slip.monthKey.toLowerCase().includes(q);
        return matchRoom || matchTenant || matchRef || matchMonth;
      }
      return true;
    });
  }, [slips, filterStatus, searchQuery]);

  // Status Counts
  const counts = useMemo(() => {
    return {
      all: slips.length,
      pending: slips.filter(s => s.verificationStatus === 'pending').length,
      amount_mismatch: slips.filter(s => s.verificationStatus === 'amount_mismatch').length,
      duplicate: slips.filter(s => s.verificationStatus === 'duplicate').length,
      approved: slips.filter(s => s.verificationStatus === 'approved').length,
      rejected: slips.filter(s => s.verificationStatus === 'rejected').length
    };
  }, [slips]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleApprove = async (slip: PaymentSlip) => {
    setActionError(null);
    setActionSuccess(null);
    setLoadingActionId(slip.id);
    try {
      await onApproveSlip(slip.id, currentUserDisplayName);
      setActionSuccess(`อนุมัติสลิปของห้อง ${slip.roomName} สำเร็จ`);
      if (selectedSlip?.id === slip.id) setSelectedSlip(null);
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      setActionError(err.message || 'อนุมัติสลิปไม่สำเร็จ');
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleOpenRejectModal = (slip: PaymentSlip) => {
    setRejectingSlip(slip);
    setSelectedPresetReason(REJECT_REASONS[0]);
    setCustomRejectReason('');
    setActionError(null);
  };

  const handleConfirmReject = async () => {
    if (!rejectingSlip) return;
    const finalReason = customRejectReason.trim() || selectedPresetReason;
    if (!finalReason) {
      setActionError('กรุณาระบุหรือเลือกเหตุผลในการปฏิเสธ');
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    setLoadingActionId(rejectingSlip.id);
    try {
      await onRejectSlip(rejectingSlip.id, currentUserDisplayName, finalReason);
      setActionSuccess(`ปฏิเสธสลิปของห้อง ${rejectingSlip.roomName} เรียบร้อยแล้ว`);
      setRejectingSlip(null);
      if (selectedSlip?.id === rejectingSlip.id) setSelectedSlip(null);
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      setActionError(err.message || 'ปฏิเสธสลิปไม่สำเร็จ');
    } finally {
      setLoadingActionId(null);
    }
  };

  // Status Badge Rendering
  const renderStatusBadge = (status: PaymentSlip['verificationStatus']) => {
    switch (status) {
      case 'pending':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">⏳ รอตรวจสอบ</span>;
      case 'approved':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">✅ อนุมัติแล้ว</span>;
      case 'amount_mismatch':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">⚠️ ยอดเงินไม่ตรง</span>;
      case 'duplicate':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">🚫 สลิปซ้ำ</span>;
      case 'rejected':
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">❌ ปฏิเสธ</span>;
    }
  };

  return (
    <div className="w-full space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-5 rounded-2xl shadow-lg border border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="text-blue-400">📄</span> ระบบตรวจสอบสลิปการชำระเงิน (Slip Verification)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ตรวจสอบสลิปที่ผู้เช่าอัปโหลด เปรียบเทียบยอดเงิน ตรวจสอบสลิปซ้ำ และอนุมัติออกใบเสร็จรับเงิน
          </p>
        </div>
        {onRefreshData && (
          <button
            onClick={() => onRefreshData()}
            className="px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-xl transition flex items-center gap-1.5 self-start sm:self-auto border border-slate-700"
          >
            🔄 โหลดข้อมูลใหม่
          </button>
        )}
      </div>

      {/* Notifications */}
      {actionError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between shadow-sm animate-fade-in">
          <span>⚠️ {actionError}</span>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700 text-xs">ปิด</button>
        </div>
      )}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between shadow-sm animate-fade-in">
          <span>🎉 {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-700 text-xs">ปิด</button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({counts.all})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filterStatus === 'pending'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            ⏳ รอตรวจสอบ ({counts.pending})
          </button>
          <button
            onClick={() => setFilterStatus('amount_mismatch')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filterStatus === 'amount_mismatch'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
            }`}
          >
            ⚠️ ยอดไม่ตรง ({counts.amount_mismatch})
          </button>
          <button
            onClick={() => setFilterStatus('duplicate')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filterStatus === 'duplicate'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            🚫 สลิปซ้ำ ({counts.duplicate})
          </button>
          <button
            onClick={() => setFilterStatus('approved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filterStatus === 'approved'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            ✅ อนุมัติแล้ว ({counts.approved})
          </button>
          <button
            onClick={() => setFilterStatus('rejected')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filterStatus === 'rejected'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            ❌ ปฏิเสธ ({counts.rejected})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="ค้นหาห้อง, ผู้เช่า, เลขอ้างอิง..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
          />
          <span className="absolute left-3 top-2 text-slate-400 text-xs">🔍</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Content Grid & Table */}
      {filteredSlips.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm">
          <span className="text-4xl block mb-2">📭</span>
          <p className="font-semibold text-slate-600">ไม่พบรายการสลิปชำระเงิน</p>
          <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนการกรองสถานะหรือค้นหาด้วยคำอื่น</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                  <th className="py-3 px-4">สลิป</th>
                  <th className="py-3 px-4">ห้องพัก / ผู้เช่า</th>
                  <th className="py-3 px-4">รอบบิล</th>
                  <th className="py-3 px-4 text-right">ยอดที่ต้องชำระ</th>
                  <th className="py-3 px-4 text-right">ยอดในสลิป</th>
                  <th className="py-3 px-4 text-right">ส่วนต่าง</th>
                  <th className="py-3 px-4">วันที่อัปโหลด</th>
                  <th className="py-3 px-4">สถานะ</th>
                  <th className="py-3 px-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredSlips.map((slip) => {
                  const diff = slip.amount - slip.requiredAmount;
                  const isDiffMismatch = Math.abs(diff) > 0.01;
                  const isActionLoading = loadingActionId === slip.id;

                  return (
                    <tr key={slip.id} className="hover:bg-slate-50/80 transition">
                      {/* Image Thumbnail */}
                      <td className="py-3 px-4">
                        <div
                          onClick={() => {
                            setSelectedSlip(slip);
                            setIsZoomModalOpen(true);
                            setZoomScale(1);
                          }}
                          className="w-12 h-16 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 cursor-pointer hover:opacity-80 transition relative group"
                        >
                          <img
                            src={slip.publicUrl}
                            alt={`Slip ${slip.roomName}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs">
                            🔍
                          </div>
                        </div>
                      </td>

                      {/* Room & Tenant */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">ห้อง {slip.roomName}</div>
                        <div className="text-slate-500">{slip.tenantName}</div>
                        {slip.referenceNo && (
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Ref: {slip.referenceNo}</div>
                        )}
                      </td>

                      {/* Month Key */}
                      <td className="py-3 px-4 font-semibold text-slate-600">
                        {slip.monthKey}
                      </td>

                      {/* Required Amount */}
                      <td className="py-3 px-4 text-right font-semibold text-slate-700">
                        ฿{slip.requiredAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        {slip.fineAmount ? (
                          <div className="text-[10px] text-rose-500 font-normal">
                            +(ค่าปรับ ฿{slip.fineAmount.toLocaleString()})
                          </div>
                        ) : null}
                      </td>

                      {/* Slip Amount */}
                      <td className="py-3 px-4 text-right font-bold text-blue-600">
                        ฿{slip.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Difference */}
                      <td className="py-3 px-4 text-right">
                        {isDiffMismatch ? (
                          <span className={`font-bold ${diff < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {diff > 0 ? '+' : ''}฿{diff.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-400">฿0.00</span>
                        )}
                      </td>

                      {/* Upload Date */}
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(slip.createdAt).toLocaleDateString('th-TH', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      {/* Verification Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderStatusBadge(slip.verificationStatus)}
                        {slip.rejectReason && (
                          <div className="text-[10px] text-rose-500 mt-1 max-w-[150px] truncate" title={slip.rejectReason}>
                            ⚠️ {slip.rejectReason}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedSlip(slip);
                              setIsZoomModalOpen(true);
                              setZoomScale(1);
                            }}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition"
                            title="ดูสลิป"
                          >
                            👁️
                          </button>

                          {slip.verificationStatus !== 'approved' && (
                            <button
                              disabled={isActionLoading}
                              onClick={() => handleApprove(slip)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
                              title="อนุมัติการชำระเงิน"
                            >
                              {isActionLoading ? '...' : '✓ อนุมัติ'}
                            </button>
                          )}

                          {slip.verificationStatus !== 'rejected' && (
                            <button
                              disabled={isActionLoading}
                              onClick={() => handleOpenRejectModal(slip)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
                              title="ปฏิเสธสลิป"
                            >
                              ✕ ปฏิเสธ
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slip Image Zoom & Detail Modal */}
      {isZoomModalOpen && selectedSlip && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 text-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl border border-slate-800">
            {/* Left Image Viewport */}
            <div className="flex-1 bg-black relative flex items-center justify-center p-4 min-h-[350px] overflow-hidden">
              <img
                src={selectedSlip.publicUrl}
                alt="Slip Full"
                style={{ transform: `scale(${zoomScale})` }}
                className="max-h-[70vh] object-contain transition-transform duration-200"
              />

              {/* Zoom Controls */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
                <button
                  onClick={() => setZoomScale(prev => Math.max(0.5, prev - 0.25))}
                  className="hover:text-blue-400 font-bold px-1.5"
                >
                  ➖
                </button>
                <span>{Math.round(zoomScale * 100)}%</span>
                <button
                  onClick={() => setZoomScale(prev => Math.min(3, prev + 0.25))}
                  className="hover:text-blue-400 font-bold px-1.5"
                >
                  ➕
                </button>
                <button
                  onClick={() => setZoomScale(1)}
                  className="text-slate-400 hover:text-white ml-2 text-[10px]"
                >
                  รีเซ็ต
                </button>
              </div>

              {/* Close Button Mobile */}
              <button
                onClick={() => setIsZoomModalOpen(false)}
                className="absolute top-4 right-4 md:hidden w-8 h-8 rounded-full bg-slate-800/80 text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Right Details Panel */}
            <div className="w-full md:w-80 p-5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-800 bg-slate-900 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">รายละเอียดสลิป</h3>
                  <button
                    onClick={() => setIsZoomModalOpen(false)}
                    className="hidden md:flex text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">ห้องพัก:</span>
                    <span className="font-bold text-white">ห้อง {selectedSlip.roomName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ผู้เช่า:</span>
                    <span className="font-medium text-slate-200">{selectedSlip.tenantName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">รอบบิล:</span>
                    <span className="font-medium text-slate-200">{selectedSlip.monthKey}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">สถานะ:</span>
                    {renderStatusBadge(selectedSlip.verificationStatus)}
                  </div>
                </div>

                {/* Amounts Comparison Card */}
                <div className="bg-blue-950/40 border border-blue-900/50 p-3.5 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>ยอดที่ต้องชำระ:</span>
                    <span className="font-bold">฿{selectedSlip.requiredAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-blue-400 font-bold">
                    <span>ยอดเงินในสลิป:</span>
                    <span className="text-sm">฿{selectedSlip.amount.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-blue-900/60 pt-1.5 flex justify-between font-bold">
                    <span className="text-slate-400">ส่วนต่าง:</span>
                    <span className={selectedSlip.amount - selectedSlip.requiredAmount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      ฿{(selectedSlip.amount - selectedSlip.requiredAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Transaction Metadata */}
                <div className="space-y-2 text-xs text-slate-300">
                  {selectedSlip.referenceNo && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">เลขที่อ้างอิง (Ref No.):</span>
                      <span className="font-mono bg-slate-800 px-2 py-1 rounded text-white block truncate">
                        {selectedSlip.referenceNo}
                      </span>
                    </div>
                  )}
                  {selectedSlip.verifiedBy && (
                    <div className="bg-slate-800/40 p-2 rounded text-[11px] text-slate-400">
                      ตรวจสอบโดย <span className="text-white font-medium">{selectedSlip.verifiedBy}</span> เมื่อ{' '}
                      {selectedSlip.verifiedAt && new Date(selectedSlip.verifiedAt).toLocaleString('th-TH')}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex gap-2">
                {selectedSlip.verificationStatus !== 'approved' && (
                  <button
                    onClick={() => handleApprove(selectedSlip)}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-xs text-white shadow-md active:scale-95 transition"
                  >
                    ✓ อนุมัติ
                  </button>
                )}
                {selectedSlip.verificationStatus !== 'rejected' && (
                  <button
                    onClick={() => handleOpenRejectModal(selectedSlip)}
                    className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold text-xs text-white shadow-md active:scale-95 transition"
                  >
                    ✕ ปฏิเสธ
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal with Reason Selection */}
      {rejectingSlip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <span className="text-rose-500">❌</span> ปฏิเสธสลิปชำระเงิน
              </h3>
              <button onClick={() => setRejectingSlip(null)} className="text-slate-400 hover:text-slate-600 text-xs">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              ระบุเหตุผลในการปฏิเสธสลิปของ <strong className="text-slate-900">ห้อง {rejectingSlip.roomName}</strong> ({rejectingSlip.tenantName}):
            </p>

            {/* Reason Presets */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 block">เลือกเหตุผลสำเร็จรูป:</label>
              {REJECT_REASONS.map((reason, idx) => (
                <label
                  key={idx}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition ${
                    selectedPresetReason === reason && !customRejectReason
                      ? 'border-rose-500 bg-rose-50/50 text-rose-900 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="reject_reason"
                    checked={selectedPresetReason === reason && !customRejectReason}
                    onChange={() => {
                      setSelectedPresetReason(reason);
                      setCustomRejectReason('');
                    }}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {/* Custom Reason */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">หรือกรอกเหตุผลเพิ่มเติม:</label>
              <textarea
                rows={2}
                placeholder="ระบุรายละเอียดเพิ่มเติม..."
                value={customRejectReason}
                onChange={(e) => setCustomRejectReason(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setRejectingSlip(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-xs text-slate-700 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmReject}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold text-xs text-white shadow-md transition"
              >
                ยืนยันการปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
