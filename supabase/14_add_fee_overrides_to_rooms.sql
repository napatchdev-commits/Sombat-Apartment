-- ============================================================================
-- SQL Migration: Add Fee Overrides to Rooms Table and Update Invoice RPC
--
-- Run this in your Supabase SQL Editor to support room-specific fee overrides
-- (e.g. turning off trash fees or adding custom common/internet fees per room).
-- ============================================================================

-- 1) Add custom fee override columns and temporary draft meter columns to rooms table
alter table public.rooms add column if not exists trash_fee numeric;
alter table public.rooms add column if not exists internet_fee numeric;
alter table public.rooms add column if not exists common_fee  numeric;
alter table public.rooms add column if not exists temp_elec_meter numeric;
alter table public.rooms add column if not exists temp_water_meter numeric;
alter table public.rooms add column if not exists temp_fine_amount numeric;

-- 2) Update generate_room_invoice RPC function to support room-specific overrides
create or replace function public.generate_room_invoice(
  p_room_id text,
  p_month_key text,
  p_elec_curr numeric,
  p_water_curr numeric,
  p_issue_date date,
  p_due_date date,
  p_fine_amount numeric default 0,
  p_force boolean default false,
  p_internet_fee numeric default 0,
  p_common_fee numeric default 0
)
returns json
language plpgsql
security definer
as $$
declare
  v_room record;
  v_rates record;
  v_elec_prev numeric;
  v_water_prev numeric;
  v_elec_units numeric;
  v_water_units numeric;
  v_elec_amount numeric;
  v_water_amount numeric;
  v_rent_amount numeric;
  v_trash_fee numeric;
  v_internet_fee numeric;
  v_common_fee numeric;
  v_total numeric;
  v_invoice_id text;
  v_invoice_number text;
  v_row record;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    return json_build_object('status', 'error', 'message', 'ไม่พบห้องพักนี้ในระบบ');
  end if;

  if v_room.status not in ('occupied', 'overdue') then
    return json_build_object('status', 'error', 'message',
      format('ห้อง %s ไม่มีสถานะ "มีผู้เช่า/ค้างชำระ" (สถานะปัจจุบัน: %s) จึงออกบิลไม่ได้', v_room.name, v_room.status));
  end if;

  select * into v_rates from public.rates where id = 1;

  v_elec_prev := coalesce(v_room.last_elec_meter, 0);
  v_water_prev := coalesce(v_room.last_water_meter, 0);

  if (p_elec_curr < v_elec_prev or p_water_curr < v_water_prev) and not p_force then
    return json_build_object('status', 'error', 'message',
      format('ห้อง %s: ตัวเลขมิเตอร์ใหม่น้อยกว่ามิเตอร์เดิม (ไฟ: %s < %s, น้ำ: %s < %s)',
             v_room.name, p_elec_curr, v_elec_prev, p_water_curr, v_water_prev));
  end if;

  v_elec_units := p_elec_curr - v_elec_prev;
  v_water_units := p_water_curr - v_water_prev;
  v_elec_amount := v_elec_units * coalesce(v_rates.electricity_rate, 8);
  v_water_amount := v_water_units * coalesce(v_rates.water_rate, 20);
  
  -- Use custom overrides if set, otherwise fallback to system defaults
  v_rent_amount  := coalesce(v_room.base_rent, 0);
  v_trash_fee    := coalesce(v_room.trash_fee, v_rates.trash_fee, 20);
  v_internet_fee := coalesce(v_room.internet_fee, p_internet_fee, 0);
  v_common_fee   := coalesce(v_room.common_fee, p_common_fee, 0);

  v_total := v_rent_amount + v_elec_amount + v_water_amount + v_trash_fee
             + coalesce(p_fine_amount, 0) + v_internet_fee + v_common_fee;

  v_invoice_number := 'INV' || replace(p_month_key, '-', '') || '-' || v_room.name;
  v_invoice_id := 'inv_' || floor(extract(epoch from clock_timestamp()) * 1000)::text
                  || '_' || substr(md5(random()::text), 1, 9);

  update public.rooms
  set last_elec_meter = p_elec_curr,
      last_water_meter = p_water_curr,
      temp_elec_meter = null,
      temp_water_meter = null,
      temp_fine_amount = null,
      updated_at = now()
  where id = p_room_id;

  insert into public.invoices (
    id, invoice_number, month_key, room_id, room_name, tenant_id, tenant_name,
    issue_date, due_date, water_prev, water_curr, water_amount,
    elec_prev, elec_curr, elec_amount, rent_amount, trash_fee, fine_amount,
    internet_fee, common_fee,
    total_amount, paid_amount, outstanding_amount, status, slip_url, updated_at
  ) values (
    v_invoice_id, v_invoice_number, p_month_key, p_room_id, v_room.name,
    v_room.current_tenant_id, coalesce(v_room.current_tenant_name, 'ผู้เช่า'),
    p_issue_date, p_due_date, v_water_prev, p_water_curr, v_water_amount,
    v_elec_prev, p_elec_curr, v_elec_amount, v_rent_amount, v_trash_fee, coalesce(p_fine_amount, 0),
    v_internet_fee, v_common_fee,
    v_total, 0, v_total, 'unpaid', null, now()
  )
  on conflict (room_id, month_key) do update
  set invoice_number      = excluded.invoice_number,
      tenant_id           = excluded.tenant_id,
      tenant_name         = excluded.tenant_name,
      issue_date          = excluded.issue_date,
      due_date            = excluded.due_date,
      water_prev          = excluded.water_prev,
      water_curr          = excluded.water_curr,
      water_amount        = excluded.water_amount,
      elec_prev           = excluded.elec_prev,
      elec_curr           = excluded.elec_curr,
      elec_amount         = excluded.elec_amount,
      rent_amount         = excluded.rent_amount,
      trash_fee           = excluded.trash_fee,
      fine_amount         = excluded.fine_amount,
      internet_fee        = excluded.internet_fee,
      common_fee          = excluded.common_fee,
      total_amount        = excluded.total_amount,
      outstanding_amount  = excluded.total_amount - invoices.paid_amount,
      status              = case when invoices.status = 'paid' then 'paid' else excluded.status end,
      updated_at          = now()
  returning * into v_row;

  return json_build_object(
    'status', 'success',
    'invoice', json_build_object(
      'id', v_row.id,
      'invoiceNumber', v_row.invoice_number,
      'monthKey', v_row.month_key,
      'roomId', v_row.room_id,
      'roomName', v_row.room_name,
      'tenantName', v_row.tenant_name,
      'rentAmount', v_row.rent_amount,
      'trashFee', v_row.trash_fee,
      'fineAmount', v_row.fine_amount,
      'waterPrev', v_row.water_prev,
      'waterCurr', v_row.water_curr,
      'waterAmount', v_row.water_amount,
      'elecPrev', v_row.elec_prev,
      'elecCurr', v_row.elec_curr,
      'elecAmount', v_row.elec_amount,
      'internetFee', v_row.internet_fee,
      'commonFee', v_row.common_fee,
      'totalAmount', v_row.total_amount,
      'status', v_row.status
    )
  );
end;
$$;
