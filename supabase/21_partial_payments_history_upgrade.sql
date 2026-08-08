-- ============================================================================
-- 21) ระบบแบ่งชำระเงิน & ประวัติการชำระเงินของผู้เช่า (Partial Payments Upgrade)
-- ============================================================================

-- 1. เพิ่มคอลัมน์ที่จำเป็นสำหรับตาราง public.payments (ถ้ายังไม่มี)
alter table public.payments add column if not exists rejection_reason text;
alter table public.payments add column if not exists slip_url text;

-- 2. ฟังก์ชันส่งการชำระเงินจากผู้เช่า (Partial Payment Submission from Tenant)
--    สถานะเริ่มต้นต้องเป็น 'pending' (รอตรวจสอบ) เสมอ ทั้งโอนเงินและเงินสด
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
  v_tenant record;
  v_invoice record;
  v_approved_paid numeric;
  v_pending_paid numeric;
  v_remaining_total numeric;
  v_max_allowable numeric;
  v_total_bill numeric;
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

  v_total_bill := v_invoice.rent_amount + v_invoice.water_amount + v_invoice.elec_amount + 
                  coalesce(v_invoice.trash_fee, 0) + coalesce(v_invoice.internet_fee, 0) + 
                  coalesce(v_invoice.common_fee, 0) + coalesce(v_invoice.fine_amount, 0) + 
                  coalesce(v_invoice.penalty_amount, 0);

  -- 3) คำนวณยอดชำระที่อนุมัติแล้ว และยอดที่รอตรวจสอบ
  select coalesce(sum(amount), 0) into v_approved_paid
  from public.payments
  where invoice_id = v_invoice.id and status = 'approved';

  select coalesce(sum(amount), 0) into v_pending_paid
  from public.payments
  where invoice_id = v_invoice.id and status = 'pending';

  v_max_allowable := v_total_bill - v_approved_paid - v_pending_paid;

  if v_max_allowable <= 0 then
    return json_build_object('status', 'error', 'message', 'ใบแจ้งหนี้นี้มีรายการส่งชำระเต็มยอดแล้ว อยู่ระหว่างรอแอดมินตรวจสอบ');
  end if;

  -- 4) ตรวจสอบว่าจำนวนเงินเกินยอดคงเหลือที่ส่งชำระได้หรือไม่
  if p_amount > v_max_allowable then
    return json_build_object('status', 'error', 'message', 'จำนวนเงินเกินยอดคงเหลือที่สามารถชำระได้');
  end if;

  -- 5) สร้าง Payment Record ใหม่ สถานะ 'pending' เสมอ
  v_payment_id := 'pay_' || p_room_id || '_' || extract(epoch from now())::text;
  v_slip_id := 'slip_' || p_room_id || '_' || extract(epoch from now())::text;

  insert into public.payments (
    id, invoice_id, tenant_id, room_id, amount, payment_date, payment_method, 
    slip_id, slip_url, status, note, created_at
  ) values (
    v_payment_id, v_invoice.id, v_tenant.id, v_invoice.room_id, p_amount, current_date, p_payment_method, 
    case when p_slip_url is not null then v_slip_id else null end, p_slip_url,
    'pending', p_note, now()
  );

  -- 6) บันทึกลง payment_slips หากเป็นการโอนเงิน
  if p_payment_method = 'transfer' and p_slip_url is not null then
    insert into public.payment_slips (
      id, invoice_id, tenant_id, room_id, room_name, tenant_name, month_key,
      public_url, amount, required_amount, fine_amount, image_hash,
      verification_status, payment_id
    ) values (
      v_slip_id, v_invoice.id, v_tenant.id, v_invoice.room_id, v_invoice.room_name, v_invoice.tenant_name,
      v_invoice.month_key, p_slip_url, p_amount, (v_total_bill - v_approved_paid), coalesce(v_invoice.penalty_amount, 0),
      p_image_hash, 'pending', v_payment_id
    );
  end if;

  return json_build_object(
    'status', 'success', 
    'message', 'ขอบคุณที่ชำระบริการ กรุณารอแอดมินตรวจสอบสลิปอีกครั้ง แล้วกลับเข้ามาดูสถานะใหม่อีกครั้ง หากมีข้อสงสัยกรุณาติดต่อแอดมิน', 
    'payment_id', v_payment_id
  );
end;
$$;

grant execute on function public.submit_partial_payment(text, text, text, numeric, text, text, text, text) to anon, authenticated;

-- 3. อัปเดตฟังก์ชัน get_tenant_bill ให้แนบ payments array ทุกงวดส่งกลับไปด้วย
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

  -- 3) วนลูปคำนวณและอัปเดตบิลค้างชำระ
  for v_inv in
    select * from public.invoices
    where room_id = p_room_id and status in ('unpaid', 'partial')
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

  -- 4) คืนค่าผลลัพธ์ข้อมูลทั้งหมดรวมทั้ง payments
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
                 'id', i.id, 'invoiceNumber', i.invoice_number, 'monthKey', i.month_key,
                 'roomId', i.room_id, 'roomName', i.room_name,
                 'tenantName', i.tenant_name,
                 'issueDate', i.issue_date, 'dueDate', i.due_date,
                 'waterPrev', i.water_prev, 'waterCurr', i.water_curr, 'waterAmount', i.water_amount,
                 'elecPrev', i.elec_prev, 'elecCurr', i.elec_curr, 'elecAmount', i.elec_amount,
                 'rentAmount', i.rent_amount, 'trashFee', i.trash_fee, 'fineAmount', i.fine_amount,
                 'internetFee', i.internet_fee, 'commonFee', i.common_fee,
                 'penaltyAmount', i.penalty_amount, 'penaltyRule', i.penalty_rule, 'penaltyCalculatedAt', i.penalty_calculated_at,
                 'totalAmount', i.total_amount, 'paidAmount', i.paid_amount, 'outstandingAmount', i.outstanding_amount,
                 'status', i.status, 'slipUrl', i.slip_url,
                 'payments', coalesce((
                   select json_agg(json_build_object(
                     'id', p.id,
                     'invoiceId', p.invoice_id,
                     'amount', p.amount,
                     'paymentDate', p.payment_date,
                     'paymentMethod', p.payment_method,
                     'slipUrl', coalesce(p.slip_url, (select public_url from public.payment_slips where id = p.slip_id limit 1)),
                     'status', p.status,
                     'note', p.note,
                     'rejectionReason', coalesce(p.rejection_reason, (select reject_reason from public.payment_slips where payment_id = p.id limit 1)),
                     'verifiedBy', p.verified_by,
                     'verifiedAt', p.verified_at,
                     'createdAt', p.created_at
                   ) order by p.created_at asc)
                   from public.payments p
                   where p.invoice_id = i.id
                 ), '[]'::json)
               ) order by i.month_key desc)
               from public.invoices i where i.room_id = p_room_id
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

grant execute on function public.get_tenant_bill(text, text) to anon, authenticated;
