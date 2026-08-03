-- ============================================================================
-- 10) ระบบตรวจสอบสลิปการชำระเงิน (Slip Verification Module)
--     ตาราง payment_slips, Storage Bucket 'slips', RLS Policies & RPC Functions
-- ============================================================================

-- 1. สร้างตาราง payment_slips เก็บประวัติการส่งและตรวจสลิป
create table if not exists public.payment_slips (
  id                  text primary key,
  invoice_id          text references public.invoices(id) on delete cascade,
  tenant_id           text references public.tenants(id) on delete set null,
  room_id             text references public.rooms(id) on delete set null,
  room_name           text not null,
  tenant_name         text not null,
  month_key           text not null,
  storage_path        text,
  public_url          text not null,
  amount              numeric default 0,
  required_amount     numeric default 0,
  fine_amount         numeric default 0,
  reference_no        text,
  qr_transaction_id   text,
  sender_bank         text,
  receiver_bank       text,
  transaction_date    date,
  transaction_time    text,
  verification_status text default 'pending', -- 'pending' | 'approved' | 'rejected' | 'amount_mismatch' | 'duplicate'
  verified_by         text,
  verified_at         timestamptz,
  reject_reason       text,
  created_at          timestamptz default now()
);

-- Index เพิ่มประสิทธิภาพการค้นหาและป้องกันสลิปซ้ำ
create index if not exists idx_payment_slips_ref on public.payment_slips(reference_no);
create index if not exists idx_payment_slips_qr on public.payment_slips(qr_transaction_id);
create index if not exists idx_payment_slips_invoice on public.payment_slips(invoice_id);
create index if not exists idx_payment_slips_status on public.payment_slips(verification_status);
create index if not exists idx_payment_slips_room_month on public.payment_slips(room_id, month_key);

-- 2. ตั้งค่า RLS (Row Level Security) สำหรับตาราง payment_slips
alter table public.payment_slips enable row level security;

drop policy if exists "Enable all access for payment_slips" on public.payment_slips;
create policy "Enable all access for payment_slips"
  on public.payment_slips for all
  using (true)
  with check (true);

-- 3. ฟังก์ชั่นตรวจสอบสลิปซ้ำ (Check Duplicate Slip)
create or replace function public.check_duplicate_slip(
  p_reference_no text,
  p_qr_transaction_id text,
  p_amount numeric,
  p_trans_date date,
  p_trans_time text
)
returns json
language plpgsql
security definer
as $$
declare
  v_dup record;
begin
  -- 1) เช็คจาก Reference Number
  if p_reference_no is not null and trim(p_reference_no) <> '' then
    select * into v_dup from public.payment_slips
    where reference_no = trim(p_reference_no)
      and verification_status in ('pending', 'approved', 'amount_mismatch')
    limit 1;

    if found then
      return json_build_object(
        'is_duplicate', true,
        'reason', 'พบเลขที่อ้างอิง (Reference No.) นี้ในระบบแล้ว',
        'duplicate_slip_id', v_dup.id,
        'room_name', v_dup.room_name
      );
    end if;
  end if;

  -- 2) เช็คจาก QR Transaction ID
  if p_qr_transaction_id is not null and trim(p_qr_transaction_id) <> '' then
    select * into v_dup from public.payment_slips
    where qr_transaction_id = trim(p_qr_transaction_id)
      and verification_status in ('pending', 'approved', 'amount_mismatch')
    limit 1;

    if found then
      return json_build_object(
        'is_duplicate', true,
        'reason', 'พบ QR Transaction ID นี้ในระบบแล้ว',
        'duplicate_slip_id', v_dup.id,
        'room_name', v_dup.room_name
      );
    end if;
  end if;

  -- 3) เช็คจาก วันที่ + เวลา + จำนวนเงิน
  if p_amount > 0 and p_trans_date is not null and p_trans_time is not null then
    select * into v_dup from public.payment_slips
    where amount = p_amount
      and transaction_date = p_trans_date
      and transaction_time = p_trans_time
      and verification_status in ('pending', 'approved', 'amount_mismatch')
    limit 1;

    if found then
      return json_build_object(
        'is_duplicate', true,
        'reason', 'พบสลิปยอดเงินและเวลาทำรายการตรงกันในระบบแล้ว',
        'duplicate_slip_id', v_dup.id,
        'room_name', v_dup.room_name
      );
    end if;
  end if;

  return json_build_object('is_duplicate', false);
end;
$$;

grant execute on function public.check_duplicate_slip(text, text, numeric, date, text) to anon, authenticated;

-- 4. ฟังก์ชั่นแอดมินอนุมัติสลิป (Approve Payment Slip)
create or replace function public.approve_payment_slip(
  p_slip_id text,
  p_admin_name text
)
returns json
language plpgsql
security definer
as $$
declare
  v_slip record;
begin
  select * into v_slip from public.payment_slips where id = p_slip_id for update;
  if not found then
    return json_build_object('status', 'error', 'message', 'ไม่พบรายการสลิปนี้');
  end if;

  -- อัปเดตตาราง payment_slips
  update public.payment_slips
  set verification_status = 'approved',
      verified_by = p_admin_name,
      verified_at = now(),
      reject_reason = null
  where id = p_slip_id;

  -- อัปเดตสถานะบิลในตาราง invoices เป็น 'paid'
  update public.invoices
  set status = 'paid',
      paid_amount = total_amount,
      outstanding_amount = 0,
      slip_url = v_slip.public_url,
      updated_at = now()
  where id = v_slip.invoice_id;

  return json_build_object('status', 'success', 'message', 'อนุมัติการชำระเงินและปรับสถานะบิลเป็นชำระแล้วเรียบร้อย');
end;
$$;

grant execute on function public.approve_payment_slip(text, text) to anon, authenticated;

-- 5. ฟังก์ชั่นแอดมินปฏิเสธสลิป (Reject Payment Slip)
create or replace function public.reject_payment_slip(
  p_slip_id text,
  p_admin_name text,
  p_reason text
)
returns json
language plpgsql
security definer
as $$
declare
  v_slip record;
begin
  select * into v_slip from public.payment_slips where id = p_slip_id for update;
  if not found then
    return json_build_object('status', 'error', 'message', 'ไม่พบรายการสลิปนี้');
  end if;

  -- อัปเดตตาราง payment_slips
  update public.payment_slips
  set verification_status = 'rejected',
      verified_by = p_admin_name,
      verified_at = now(),
      reject_reason = p_reason
  where id = p_slip_id;

  -- คืนสถานะบิลในตาราง invoices เป็น 'pending'
  update public.invoices
  set status = 'pending',
      updated_at = now()
  where id = v_slip.invoice_id and status <> 'paid';

  return json_build_object('status', 'success', 'message', 'ปฏิเสธสลิปเรียบร้อยแล้ว');
end;
$$;

grant execute on function public.reject_payment_slip(text, text, text) to anon, authenticated;
