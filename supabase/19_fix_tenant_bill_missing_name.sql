-- ============================================================================
-- 19) แก้ปัญหา "บิลลูกค้ายังไม่มีชื่อผู้เช่า" (ฝั่งที่ผู้เช่าเห็นเอง ขึ้นคำว่า "undefined")
--
--     สาเหตุ: ฟังก์ชัน get_tenant_bill() (เวอร์ชันล่าสุดอยู่ในไฟล์ 15_) ที่หน้า
--     ผู้เช่าเรียกใช้เพื่อดึงรายการบิลของตัวเอง ไม่เคยใส่ฟิลด์ tenant_name ไว้ใน
--     JSON ที่ส่งกลับมาเลยตั้งแต่แรก (ต่างจากตาราง invoices จริงที่มีคอลัมน์นี้อยู่)
--     ฝั่งหน้าเว็บเลยได้ inv.tenantName เป็น undefined ทุกใบ ไม่ใช่แค่บางใบ
--     พอเอาไปแสดงในหน้า HTML เลยขึ้นเป็นข้อความ "undefined" ตามที่เห็น
--
--     รันไฟล์นี้ใน Supabase SQL Editor ครั้งเดียว (แทนที่ฟังก์ชันเดิมทั้งหมด
--     ด้วยเวอร์ชันเดียวกับไฟล์ 15_ ทุกอย่าง แค่เพิ่ม 'tenantName', tenant_name)
-- ============================================================================

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

  -- 4) คืนค่าผลลัพธ์ข้อมูลหอพัก ห้อง บิลทั้งหมด (เพิ่ม tenantName ที่ขาดหายไปเดิม)
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
                 'roomId', room_id, 'roomName', room_name,
                 'tenantName', tenant_name,
                 'issueDate', issue_date, 'dueDate', due_date,
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

grant execute on function public.get_tenant_bill(text, text) to anon, authenticated;
