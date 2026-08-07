-- ============================================================================
-- 20) ระบบชำระไม่เต็มจำนวน / แบ่งชำระหลายครั้ง (Partial Payment System)
--     ตาราง payments, เพิ่ม payment_id ใน payment_slips, RLS & RPC Functions
-- ============================================================================

-- 1. สร้างตาราง payments สำหรับเก็บประวัติการชำระเงินแต่ละงวด
create table if not exists public.payments (
  id              text primary key,
  invoice_id      text references public.invoices(id) on delete cascade,
  tenant_id       text references public.tenants(id) on delete set null,
  room_id         text references public.rooms(id) on delete set null,
  amount          numeric not null check (amount > 0),
  payment_date    date default current_date,
  payment_method  text default 'transfer', -- 'transfer' | 'cash'
  slip_id         text,
  status          text default 'pending', -- 'pending' | 'approved' | 'rejected'
  note            text,
  verified_by     text,
  verified_at     timestamptz,
  created_at      timestamptz default now()
);

-- Index สำหรับค้นหาประวัติการชำระเงิน
create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_payments_room on public.payments(room_id);

-- 2. เพิ่มคอลัมน์ payment_id ในตาราง payment_slips
alter table public.payment_slips add column if not exists payment_id text;

-- 3. RLS สำหรับตาราง payments
alter table public.payments enable row level security;

drop policy if exists "Enable all access for payments" on public.payments;
create policy "Enable all access for payments"
  on public.payments for all
  using (true)
  with check (true);

-- 4. ฟังก์ชันส่งการชำระเงิน (Partial Payment Submission with Validation & Locking)
create or replace function public.submit_partial_payment(
  p_id_card text,
  p_room_id text,
  p_invoice_id text,
  p_amount numeric,
  p_payment_method text default 'transfer',
  p_slip_url text default null,
  p_image_hash text default null,
  p_note text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_tenant_ok boolean;
  v_tenant record;
  v_invoice record;
  v_approved_paid numeric;
  v_remaining numeric;
  v_payment_id text;
  v_slip_id text;
begin
  -- 1) ยืนยันตัวตนผู้เช่า
  select * into v_tenant from public.tenants
  where assigned_room_id = p_room_id
    and regexp_replace(id_card, '\D', '', 'g') = regexp_replace(p_id_card, '\D', '', 'g')
  limit 1;

  if not found then
    return json_build_object('status', 'error', 'message', 'ยืนยันตัวตนผู้เช่าไม่สำเร็จ');
  end if;

  -- 2) ล็อกบิลเพื่ออัปเดตแบบ atomic
  select * into v_invoice from public.invoices
  where id = p_invoice_id or (invoice_number = p_invoice_id and room_id = p_room_id)
  for update;

  if not found then
    return json_build_object('status', 'error', 'message', 'ไม่พบใบแจ้งหนี้นี้');
  end if;

  if v_invoice.status = 'paid' then
    return json_build_object('status', 'error', 'message', 'ใบแจ้งหนี้นี้ชำระครบแล้ว');
  end if;

  -- 3) คำนวณยอดชำระที่อนุมัติแล้ว และยอดคงเหลือ
  select coalesce(sum(amount), 0) into v_approved_paid
  from public.payments
  where invoice_id = v_invoice.id and status = 'approved';

  v_remaining := (v_invoice.rent_amount + v_invoice.water_amount + v_invoice.elec_amount + 
                  coalesce(v_invoice.trash_fee, 0) + coalesce(v_invoice.internet_fee, 0) + 
                  coalesce(v_invoice.common_fee, 0) + coalesce(v_invoice.fine_amount, 0) + 
                  coalesce(v_invoice.penalty_amount, 0)) - v_approved_paid;

  if v_remaining <= 0 then
    return json_build_object('status', 'error', 'message', 'ใบแจ้งหนี้นี้ชำระครบแล้ว');
  end if;

  -- 4) ตรวจสอบว่าจำนวนเงินเกินยอดคงเหลือหรือไม่
  if p_amount > v_remaining then
    return json_build_object('status', 'error', 'message', 'จำนวนเงินเกินยอดคงเหลือ');
  end if;

  -- 5) สร้าง Payment Record ใหม่
  v_payment_id := 'pay_' + p_room_id + '_' + extract(epoch from now())::text;
  v_slip_id := 'slip_' + p_room_id + '_' + extract(epoch from now())::text;

  insert into public.payments (
    id, invoice_id, tenant_id, room_id, amount, payment_date, payment_method, slip_id, status, note
  ) values (
    v_payment_id, v_invoice.id, v_tenant.id, v_invoice.room_id, p_amount, current_date, p_payment_method, 
    case when p_slip_url is not null then v_slip_id else null end,
    case when p_payment_method = 'cash' then 'approved' else 'pending' end,
    p_note
  );

  -- 6) บันทึกลง payment_slips หากเป็นการโอนเงิน
  if p_payment_method = 'transfer' and p_slip_url is not null then
    insert into public.payment_slips (
      id, invoice_id, tenant_id, room_id, room_name, tenant_name, month_key,
      public_url, amount, required_amount, fine_amount, image_hash,
      verification_status, payment_id
    ) values (
      v_slip_id, v_invoice.id, v_tenant.id, v_invoice.room_id, v_invoice.room_name, v_invoice.tenant_name,
      v_invoice.month_key, p_slip_url, p_amount, v_remaining, coalesce(v_invoice.penalty_amount, 0),
      p_image_hash, 'pending', v_payment_id
    );
  end if;

  -- 7) คำนวณยอดชำระสะสมใหม่และอัปเดตบิล
  select coalesce(sum(amount), 0) into v_approved_paid
  from public.payments
  where invoice_id = v_invoice.id and status = 'approved';

  v_remaining := (v_invoice.rent_amount + v_invoice.water_amount + v_invoice.elec_amount + 
                  coalesce(v_invoice.trash_fee, 0) + coalesce(v_invoice.internet_fee, 0) + 
                  coalesce(v_invoice.common_fee, 0) + coalesce(v_invoice.fine_amount, 0) + 
                  coalesce(v_invoice.penalty_amount, 0)) - v_approved_paid;

  update public.invoices
  set paid_amount = v_approved_paid,
      outstanding_amount = v_remaining,
      status = case 
        when v_remaining <= 0 then 'paid'
        when v_approved_paid > 0 then 'partial'
        else 'unpaid'
      end,
      updated_at = now()
  where id = v_invoice.id;

  return json_build_object('status', 'success', 'message', 'บันทึกการชำระเงินเรียบร้อยแล้ว', 'payment_id', v_payment_id);
end;
$$;

grant execute on function public.submit_partial_payment(text, text, text, numeric, text, text, text, text) to anon, authenticated;

-- 5. ฟังก์ชันสำหรับแอดมินบันทึกการชำระเงินตรง (Admin Add Payment)
create or replace function public.add_admin_payment(
  p_invoice_id text,
  p_amount numeric,
  p_payment_date date default current_date,
  p_payment_method text default 'cash',
  p_note text default null,
  p_admin_name text default 'แอดมิน',
  p_slip_url text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_invoice record;
  v_approved_paid numeric;
  v_remaining numeric;
  v_payment_id text;
  v_total_bill numeric;
begin
  -- 1) ล็อกบิล
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    return json_build_object('status', 'error', 'message', 'ไม่พบใบแจ้งหนี้นี้');
  end if;

  v_total_bill := v_invoice.rent_amount + v_invoice.water_amount + v_invoice.elec_amount + 
                  coalesce(v_invoice.trash_fee, 0) + coalesce(v_invoice.internet_fee, 0) + 
                  coalesce(v_invoice.common_fee, 0) + coalesce(v_invoice.fine_amount, 0) + 
                  coalesce(v_invoice.penalty_amount, 0);

  select coalesce(sum(amount), 0) into v_approved_paid
  from public.payments
  where invoice_id = v_invoice.id and status = 'approved';

  v_remaining := v_total_bill - v_approved_paid;

  if v_remaining <= 0 then
    return json_build_object('status', 'error', 'message', 'ใบแจ้งหนี้นี้ชำระครบแล้ว');
  end if;

  if p_amount > v_remaining then
    return json_build_object('status', 'error', 'message', 'จำนวนเงินเกินยอดคงเหลือ');
  end if;

  -- 2) สร้าง Payment Record สถานะ 'approved'
  v_payment_id := 'pay_adm_' + extract(epoch from now())::text;

  insert into public.payments (
    id, invoice_id, tenant_id, room_id, amount, payment_date, payment_method, 
    slip_id, status, note, verified_by, verified_at
  ) values (
    v_payment_id, v_invoice.id, v_invoice.tenant_id, v_invoice.room_id, p_amount, p_payment_date, p_payment_method,
    p_slip_url, 'approved', p_note, p_admin_name, now()
  );

  -- 3) อัปเดตยอดสะสมและสถานะบิล
  v_approved_paid := v_approved_paid + p_amount;
  v_remaining := v_total_bill - v_approved_paid;

  update public.invoices
  set paid_amount = v_approved_paid,
      outstanding_amount = v_remaining,
      status = case 
        when v_remaining <= 0 then 'paid'
        when v_approved_paid > 0 then 'partial'
        else 'unpaid'
      end,
      updated_at = now()
  where id = v_invoice.id;

  return json_build_object('status', 'success', 'message', 'บันทึกการชำระเงินเรียบร้อยแล้ว');
end;
$$;

grant execute on function public.add_admin_payment(text, numeric, date, text, text, text, text) to anon, authenticated;

-- 6. ฟังก์ชันแอดมินอนุมัติสลิป/งวดชำระ (Approve Partial Payment)
create or replace function public.approve_partial_payment(
  p_payment_id text,
  p_admin_name text
)
returns json
language plpgsql
security definer
as $$
declare
  v_payment record;
  v_invoice record;
  v_approved_paid numeric;
  v_remaining numeric;
  v_total_bill numeric;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    return json_build_object('status', 'error', 'message', 'ไม่พบรายการชำระเงินนี้');
  end if;

  select * into v_invoice from public.invoices where id = v_payment.invoice_id for update;

  -- อัปเดต Payment status
  update public.payments
  set status = 'approved',
      verified_by = p_admin_name,
      verified_at = now()
  where id = p_payment_id;

  -- อัปเดต payment_slips ถ้ามี
  update public.payment_slips
  set verification_status = 'approved',
      verified_by = p_admin_name,
      verified_at = now()
  where payment_id = p_payment_id or (invoice_id = v_payment.invoice_id and amount = v_payment.amount and verification_status = 'pending');

  -- คำนวณยอดชำระสะสมใหม่
  v_total_bill := v_invoice.rent_amount + v_invoice.water_amount + v_invoice.elec_amount + 
                  coalesce(v_invoice.trash_fee, 0) + coalesce(v_invoice.internet_fee, 0) + 
                  coalesce(v_invoice.common_fee, 0) + coalesce(v_invoice.fine_amount, 0) + 
                  coalesce(v_invoice.penalty_amount, 0);

  select coalesce(sum(amount), 0) into v_approved_paid
  from public.payments
  where invoice_id = v_invoice.id and status = 'approved';

  v_remaining := v_total_bill - v_approved_paid;

  update public.invoices
  set paid_amount = v_approved_paid,
      outstanding_amount = case when v_remaining < 0 then 0 else v_remaining end,
      status = case 
        when v_remaining <= 0 then 'paid'
        when v_approved_paid > 0 then 'partial'
        else 'unpaid'
      end,
      updated_at = now()
  where id = v_invoice.id;

  return json_build_object('status', 'success', 'message', 'อนุมัติการชำระเงินงวดนี้เรียบร้อยแล้ว');
end;
$$;

grant execute on function public.approve_partial_payment(text, text) to anon, authenticated;

-- 7. ฟังก์ชันแอดมินปฏิเสธสลิป/งวดชำระ (Reject Partial Payment)
create or replace function public.reject_partial_payment(
  p_payment_id text,
  p_admin_name text,
  p_reason text
)
returns json
language plpgsql
security definer
as $$
declare
  v_payment record;
  v_invoice record;
  v_approved_paid numeric;
  v_remaining numeric;
  v_total_bill numeric;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    return json_build_object('status', 'error', 'message', 'ไม่พบรายการชำระเงินนี้');
  end if;

  select * into v_invoice from public.invoices where id = v_payment.invoice_id for update;

  -- อัปเดต Payment status
  update public.payments
  set status = 'rejected',
      note = coalesce(p_reason, note),
      verified_by = p_admin_name,
      verified_at = now()
  where id = p_payment_id;

  -- อัปเดต payment_slips ถ้ามี
  update public.payment_slips
  set verification_status = 'rejected',
      verified_by = p_admin_name,
      verified_at = now(),
      reject_reason = p_reason
  where payment_id = p_payment_id or (invoice_id = v_payment.invoice_id and amount = v_payment.amount and verification_status = 'pending');

  -- คำนวณยอดชำระสะสมใหม่
  v_total_bill := v_invoice.rent_amount + v_invoice.water_amount + v_invoice.elec_amount + 
                  coalesce(v_invoice.trash_fee, 0) + coalesce(v_invoice.internet_fee, 0) + 
                  coalesce(v_invoice.common_fee, 0) + coalesce(v_invoice.fine_amount, 0) + 
                  coalesce(v_invoice.penalty_amount, 0);

  select coalesce(sum(amount), 0) into v_approved_paid
  from public.payments
  where invoice_id = v_invoice.id and status = 'approved';

  v_remaining := v_total_bill - v_approved_paid;

  update public.invoices
  set paid_amount = v_approved_paid,
      outstanding_amount = case when v_remaining < 0 then 0 else v_remaining end,
      status = case 
        when v_remaining <= 0 then 'paid'
        when v_approved_paid > 0 then 'partial'
        else 'unpaid'
      end,
      updated_at = now()
  where id = v_invoice.id;

  return json_build_object('status', 'success', 'message', 'ปฏิเสธการชำระเงินงวดนี้เรียบร้อยแล้ว');
end;
$$;

grant execute on function public.reject_partial_payment(text, text, text) to anon, authenticated;
