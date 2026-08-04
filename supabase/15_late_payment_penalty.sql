-- ============================================================================
-- 15) ระบบค่าปรับชำระล่าช้าอัตโนมัติ (Late Payment Penalty Module)
--     เพิ่มฟิลด์ใน invoices, สร้างตาราง late_fee_settings, และอัปเดต RPCs
-- ============================================================================

-- 1. เพิ่มคอลัมน์ในตาราง invoices (ใช้ if not exists ป้องกัน error)
do $$
begin
  if not exists (select 1 from pg_attribute where attrelid = 'public.invoices'::regclass and attname = 'penalty_amount') then
    alter table public.invoices add column penalty_amount numeric default 0;
  end if;
  if not exists (select 1 from pg_attribute where attrelid = 'public.invoices'::regclass and attname = 'penalty_rule') then
    alter table public.invoices add column penalty_rule text;
  end if;
  if not exists (select 1 from pg_attribute where attrelid = 'public.invoices'::regclass and attname = 'penalty_calculated_at') then
    alter table public.invoices add column penalty_calculated_at timestamptz;
  end if;
end $$;

-- 2. สร้างตาราง late_fee_settings เก็บค่าตั้งค่าค่าปรับชำระล่าช้า (มีแถวเดียว id = 1)
create table if not exists public.late_fee_settings (
  id                      int primary key default 1,
  due_day                 int default 5,
  penalty_phase1_start    int default 6,
  penalty_phase1_end      int default 15,
  penalty_phase1_amount   numeric default 200,
  penalty_phase2_start    int default 16,
  penalty_phase2_end      int default 31,
  penalty_phase2_amount   numeric default 300,
  updated_at              timestamptz default now(),
  constraint late_fee_settings_single_row check (id = 1)
);

-- ใส่ค่าเริ่มต้นสำหรับ late_fee_settings
insert into public.late_fee_settings (id, due_day, penalty_phase1_start, penalty_phase1_end, penalty_phase1_amount, penalty_phase2_start, penalty_phase2_end, penalty_phase2_amount)
values (1, 5, 6, 15, 200, 16, 31, 300)
on conflict (id) do nothing;

-- 3. เปิดใช้ RLS (Row Level Security) สำหรับตาราง late_fee_settings
alter table public.late_fee_settings enable row level security;
drop policy if exists "allow all" on public.late_fee_settings;
create policy "allow all" on public.late_fee_settings for all using (true) with check (true);

-- 4. อัปเดตฟังก์ชัน get_tenant_bill() เพื่อคำนวณและบันทึกค่าปรับอัตโนมัติก่อนส่งข้อมูลออก
create or replace function public.get_tenant_bill(p_id_card text, p_room_id text)
returns json
language plpgsql
security definer
as $$
declare
  v_tenant record;
  v_due_day int;
  v_p1_start int;
  v_p1_end int;
  v_p1_amt numeric;
  v_p2_start int;
  v_p2_end int;
  v_p2_amt numeric;
  v_inv record;
  v_today date;
  v_today_str text;
  v_t_day int;
  v_t_month int;
  v_t_year int;
  v_d_day int;
  v_d_month int;
  v_d_year int;
  v_penalty numeric;
  v_rule text;
begin
  -- 1) ตรวจสอบสิทธิ์ผู้เช่า
  select * into v_tenant
  from public.tenants
  where assigned_room_id = p_room_id
    and regexp_replace(id_card, '\D', '', 'g') = regexp_replace(p_id_card, '\D', '', 'g')
  limit 1;

  if not found then
    return json_build_object('status', 'error', 'message', 'ไม่พบข้อมูลผู้เช่า หรือเลขบัตรไม่ตรงกับห้องนี้');
  end if;

  -- 2) ดึงตั้งค่าค่าปรับชำระล่าช้า
  select due_day, penalty_phase1_start, penalty_phase1_end, penalty_phase1_amount, penalty_phase2_start, penalty_phase2_end, penalty_phase2_amount
  into v_due_day, v_p1_start, v_p1_end, v_p1_amt, v_p2_start, v_p2_end, v_p2_amt
  from public.late_fee_settings
  where id = 1;

  if not found then
    v_due_day := 5;
    v_p1_start := 6;
    v_p1_end := 15;
    v_p1_amt := 200;
    v_p2_start := 16;
    v_p2_end := 31;
    v_p2_amt := 300;
  end if;

  v_today := current_date;
  v_today_str := to_char(v_today, 'YYYY-MM-DD');

  -- 3) วนลูปตรวจสอบคำนวณและอัปเดตบิลที่ยังไม่ชำระ (unpaid เท่านั้น) ของห้องพักนี้
  for v_inv in 
    select * from public.invoices 
    where room_id = p_room_id and status = 'unpaid'
  loop
    v_penalty := 0;
    v_rule := '';

    if v_inv.due_date is not null and v_today_str > to_char(v_inv.due_date, 'YYYY-MM-DD') then
      v_t_day := extract(day from v_today);
      v_t_month := extract(month from v_today);
      v_t_year := extract(year from v_today);

      v_d_day := extract(day from v_inv.due_date);
      v_d_month := extract(month from v_inv.due_date);
      v_d_year := extract(year from v_inv.due_date);

      if (v_t_year > v_d_year) or (v_t_year = v_d_year and v_t_month > v_d_month) then
        v_penalty := v_p2_amt;
        v_rule := 'ค้างชำระข้ามเดือน (ค่าปรับ ' || v_p2_amt || ' บาท)';
      elsif v_t_day >= v_p1_start and v_t_day <= v_p1_end then
        v_penalty := v_p1_amt;
        v_rule := 'ชำระล่าช้าช่วงที่ 1 (วันที่ ' || v_p1_start || '-' || v_p1_end || ': ค่าปรับ ' || v_p1_amt || ' บาท)';
      elsif v_t_day >= v_p2_start then
        v_penalty := v_p2_amt;
        v_rule := 'ชำระล่าช้าช่วงที่ 2 (วันที่ ' || v_p2_start || ' เป็นต้นไป: ค่าปรับ ' || v_p2_amt || ' บาท)';
      else
        v_penalty := v_p2_amt;
        v_rule := 'ชำระล่าช้าเกินกำหนด (ค่าปรับ ' || v_p2_amt || ' บาท)';
      end if;
    end if;

    -- ถ้าค่าปรับเปลี่ยน ให้อัปเดตตาราง invoices ทันที
    if coalesce(v_inv.penalty_amount, 0) != v_penalty or coalesce(v_inv.penalty_rule, '') != v_rule then
      update public.invoices
      set penalty_amount = v_penalty,
          penalty_rule = v_rule,
          penalty_calculated_at = now(),
          total_amount = rent_amount + water_amount + elec_amount + trash_fee + internet_fee + common_fee + fine_amount + v_penalty,
          outstanding_amount = (rent_amount + water_amount + elec_amount + trash_fee + internet_fee + common_fee + fine_amount + v_penalty) - paid_amount,
          updated_at = now()
      where id = v_inv.id;
    end if;
  end loop;

  -- 4) คืนค่าผลลัพธ์ข้อมูลหอพัก ห้อง บิลทั้งหมด (รวมคอลัมน์ใหม่)
  return json_build_object(
    'status', 'success',
    'settings', (select json_build_object(
                  'apartmentName', apartment_name,
                  'address', address,
                  'tel', tel,
                  'bankName', bank_name,
                  'bankAccountNo', bank_account_no,
                  'bankAccountName', bank_account_name,
                  'promptPayId', prompt_pay_id
                 ) from public.settings where id = 1),
    'lateFeeSettings', (select json_build_object(
                          'dueDay', due_day,
                          'penaltyPhase1Start', penalty_phase1_start,
                          'penaltyPhase1End', penalty_phase1_end,
                          'penaltyPhase1Amount', penalty_phase1_amount,
                          'penaltyPhase2Start', penalty_phase2_start,
                          'penaltyPhase2End', penalty_phase2_end,
                          'penaltyPhase2Amount', penalty_phase2_amount
                        ) from public.late_fee_settings where id = 1),
    'room', (select json_build_object(
               'id', id, 'name', name, 'floor', floor, 'baseRent', base_rent,
               'status', status, 'lastElecMeter', last_elec_meter, 'lastWaterMeter', last_water_meter
             ) from public.rooms where id = p_room_id),
    'tenant', json_build_object(
               'id', v_tenant.id, 'name', v_tenant.name, 'idCard', v_tenant.id_card,
               'tel', v_tenant.tel, 'email', v_tenant.email, 'assignedRoomId', v_tenant.assigned_room_id
             ),
    'invoices', coalesce((
               select json_agg(json_build_object(
                 'id', id, 'invoiceNumber', invoice_number, 'monthKey', month_key,
                 'roomId', room_id, 'roomName', room_name, 'issueDate', issue_date, 'dueDate', due_date,
                 'waterPrev', water_prev, 'waterCurr', water_curr, 'waterAmount', water_amount,
                 'elecPrev', elec_prev, 'elecCurr', elec_curr, 'elecAmount', elec_amount,
                 'rentAmount', rent_amount, 'trashFee', trash_fee, 'fineAmount', fine_amount,
                 'internetFee', internet_fee, 'commonFee', common_fee,
                 'penaltyAmount', penalty_amount, 'penaltyRule', penalty_rule, 'penaltyCalculatedAt', penalty_calculated_at,
                 'totalAmount', total_amount, 'paidAmount', paid_amount, 'outstandingAmount', outstanding_amount,
                 'status', status, 'slipUrl', slip_url
               ) order by month_key desc)
               from public.invoices where room_id = p_room_id
             ), '[]'::json),
    'repairs', coalesce((
               select json_agg(json_build_object(
                 'id', id, 'ticketNumber', ticket_number, 'title', title, 'description', description,
                 'status', status, 'requestDate', request_date
               ) order by request_date desc)
               from public.repairs where room_id = p_room_id
             ), '[]'::json),
    'events', '[]'::json
  );
end;
$$;

-- 5. อัปเดตฟังก์ชัน submit_tenant_payment() เพื่อคำนวณและล็อกค่าปรับช่วงเวลาส่งสลิป
create or replace function public.submit_tenant_payment(
  p_id_card text, p_room_id text, p_invoice_number text,
  p_payment_method text, p_slip_url text
)
returns json
language plpgsql
security definer
as $$
declare
  v_tenant_ok boolean;
  v_invoice record;
  v_due_day int;
  v_p1_start int;
  v_p1_end int;
  v_p1_amt numeric;
  v_p2_start int;
  v_p2_end int;
  v_p2_amt numeric;
  v_today date;
  v_today_str text;
  v_t_day int;
  v_t_month int;
  v_t_year int;
  v_d_day int;
  v_d_month int;
  v_d_year int;
  v_penalty numeric;
  v_rule text;
begin
  -- 1) ยืนยันตัวตนผู้เช่า
  select exists(
    select 1 from public.tenants
    where assigned_room_id = p_room_id
      and regexp_replace(id_card, '\D', '', 'g') = regexp_replace(p_id_card, '\D', '', 'g')
  ) into v_tenant_ok;

  if not v_tenant_ok then
    return json_build_object('status', 'error', 'message', 'ยืนยันตัวตนผู้เช่าไม่สำเร็จ');
  end if;

  -- 2) ล็อกบิลเพื่ออัปเดตแบบ atomic
  select * into v_invoice from public.invoices
  where invoice_number = p_invoice_number and room_id = p_room_id
  for update;

  if not found then
    return json_build_object('status', 'error', 'message', 'ไม่พบใบแจ้งหนี้นี้');
  end if;

  if v_invoice.status = 'paid' then
    return json_build_object('status', 'error', 'message', 'ใบแจ้งหนี้นี้ชำระแล้ว');
  end if;

  -- 3) คำนวณและล็อกค่าปรับ ณ วันที่จ่ายเงิน (ก่อนชำระเงิน)
  select due_day, penalty_phase1_start, penalty_phase1_end, penalty_phase1_amount, penalty_phase2_start, penalty_phase2_end, penalty_phase2_amount
  into v_due_day, v_p1_start, v_p1_end, v_p1_amt, v_p2_start, v_p2_end, v_p2_amt
  from public.late_fee_settings
  where id = 1;

  if not found then
    v_due_day := 5;
    v_p1_start := 6;
    v_p1_end := 15;
    v_p1_amt := 200;
    v_p2_start := 16;
    v_p2_end := 31;
    v_p2_amt := 300;
  end if;

  v_today := current_date;
  v_today_str := to_char(v_today, 'YYYY-MM-DD');
  v_penalty := 0;
  v_rule := '';

  if v_invoice.due_date is not null and v_today_str > to_char(v_invoice.due_date, 'YYYY-MM-DD') then
    v_t_day := extract(day from v_today);
    v_t_month := extract(month from v_today);
    v_t_year := extract(year from v_today);

    v_d_day := extract(day from v_invoice.due_date);
    v_d_month := extract(month from v_invoice.due_date);
    v_d_year := extract(year from v_invoice.due_date);

    if (v_t_year > v_d_year) or (v_t_year = v_d_year and v_t_month > v_d_month) then
      v_penalty := v_p2_amt;
      v_rule := 'ค้างชำระข้ามเดือน (ค่าปรับ ' || v_p2_amt || ' บาท)';
    elsif v_t_day >= v_p1_start and v_t_day <= v_p1_end then
      v_penalty := v_p1_amt;
      v_rule := 'ชำระล่าช้าช่วงที่ 1 (วันที่ ' || v_p1_start || '-' || v_p1_end || ': ค่าปรับ ' || v_p1_amt || ' บาท)';
    elsif v_t_day >= v_p2_start then
      v_penalty := v_p2_amt;
      v_rule := 'ชำระล่าช้าช่วงที่ 2 (วันที่ ' || v_p2_start || ' เป็นต้นไป: ค่าปรับ ' || v_p2_amt || ' บาท)';
    else
      v_penalty := v_p2_amt;
      v_rule := 'ชำระล่าช้าเกินกำหนด (ค่าปรับ ' || v_p2_amt || ' บาท)';
    end if;
  end if;

  -- 4) อัปเดตบิล ล็อกค่าปรับ และเปลี่ยนสถานะชำระเงิน
  update public.invoices
  set status = case when p_payment_method = 'transfer' then 'pending_verification' else 'paid' end,
      slip_url = coalesce(p_slip_url, slip_url),
      penalty_amount = v_penalty,
      penalty_rule = v_rule,
      penalty_calculated_at = now(),
      total_amount = rent_amount + water_amount + elec_amount + trash_fee + internet_fee + common_fee + fine_amount + v_penalty,
      outstanding_amount = case when p_payment_method = 'transfer' then (rent_amount + water_amount + elec_amount + trash_fee + internet_fee + common_fee + fine_amount + v_penalty) else 0.0 end,
      paid_amount = case when p_payment_method = 'transfer' then paid_amount else (rent_amount + water_amount + elec_amount + trash_fee + internet_fee + common_fee + fine_amount + v_penalty) end,
      updated_at = now()
  where id = v_invoice.id;

  return json_build_object('status', 'success', 'message', 'ส่งแจ้งชำระเงินเรียบร้อย รอตรวจสอบจากแอดมิน');
end;
$$;
