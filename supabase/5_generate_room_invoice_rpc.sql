-- ============================================================================
-- ข้อ 4: ออกบิลแบบ atomic — ย้ายตรรกะ "รับมิเตอร์ → คำนวณ → อัปเดตห้อง + สร้างบิล"
-- จาก JS (ฝั่งแอดมิน, ปุ่ม "ออกบิลทุกห้อง (Bulk)") มาเป็น Postgres RPC เดียว
-- ที่ทำงานในทรานแซกชันเดียว + ล็อกแถวห้อง (for update) กันสองคนออกบิลห้อง+เดือน
-- เดียวกันพร้อมกันแล้วอ่านเลขมิเตอร์เดิมซ้ำ/เขียนทับกัน
--
-- รันไฟล์นี้ใน Supabase SQL Editor หลังจากรัน 1_schema.sql แล้ว
--
-- ขอบเขต: ครอบคลุมสูตรคำนวณของปุ่ม "ออกบิลทุกห้อง (Bulk)" เท่านั้น
-- (ค่าเช่า + ค่าไฟ + ค่าน้ำ + ค่าขยะ + ค่าปรับ) ซึ่งตรงกับคอลัมน์ที่มีอยู่จริงในตาราง invoices
-- ส่วนหน้า "คำนวณออกบิลใหม่ (Excel Grid)" มีค่าเน็ต/ค่าส่วนกลางเพิ่มที่ยังไม่มีคอลัมน์ในตาราง
-- invoices ตอนนี้ — ยังไม่ได้ย้ายส่วนนั้นมาที่ RPC นี้ เพื่อไม่ให้ยอดบิลคลาดเคลื่อนจากของเดิม
-- ============================================================================

create or replace function public.generate_room_invoice(
  p_room_id text,
  p_month_key text,
  p_elec_curr numeric,
  p_water_curr numeric,
  p_issue_date date,
  p_due_date date,
  p_fine_amount numeric default 0,
  p_force boolean default false      -- true = ยอมออกบิลแม้เลขมิเตอร์ใหม่น้อยกว่าเดิม (เช่น เปลี่ยนมิเตอร์ใหม่)
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
  v_total numeric;
  v_invoice_id text;
  v_invoice_number text;
  v_row record;
begin
  -- ล็อกแถวห้องนี้ไว้จนจบทรานแซกชัน กันอีกคนออกบิลห้องเดียวกันพร้อมกันแล้วอ่านมิเตอร์เดิมซ้ำ
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
  v_rent_amount := coalesce(v_room.base_rent, 0);
  v_trash_fee := coalesce(v_rates.trash_fee, 20);
  v_total := v_rent_amount + v_elec_amount + v_water_amount + v_trash_fee + coalesce(p_fine_amount, 0);

  v_invoice_number := 'INV' || replace(p_month_key, '-', '') || '-' || v_room.name;
  v_invoice_id := 'inv_' || floor(extract(epoch from clock_timestamp()) * 1000)::text
                  || '_' || substr(md5(random()::text), 1, 9);

  -- อัปเดตมิเตอร์ล่าสุดของห้อง กับสร้าง/อัปเดตบิล อยู่ในทรานแซกชันเดียวกัน (atomic)
  update public.rooms
  set last_elec_meter = p_elec_curr,
      last_water_meter = p_water_curr,
      updated_at = now()
  where id = p_room_id;

  insert into public.invoices (
    id, invoice_number, month_key, room_id, room_name, tenant_id, tenant_name,
    issue_date, due_date, water_prev, water_curr, water_amount,
    elec_prev, elec_curr, elec_amount, rent_amount, trash_fee, fine_amount,
    total_amount, paid_amount, outstanding_amount, status, slip_url, updated_at
  ) values (
    v_invoice_id, v_invoice_number, p_month_key, p_room_id, v_room.name,
    v_room.current_tenant_id, coalesce(v_room.current_tenant_name, 'ผู้เช่า'),
    p_issue_date, p_due_date, v_water_prev, p_water_curr, v_water_amount,
    v_elec_prev, p_elec_curr, v_elec_amount, v_rent_amount, v_trash_fee, coalesce(p_fine_amount, 0),
    v_total, 0, v_total, 'unpaid', '', now()
  )
  -- UNIQUE(room_id, month_key) กันบิลซ้ำจริงระดับ DB — ถ้ามีบิลห้องนี้เดือนนี้อยู่แล้วให้เขียนทับ
  -- (คงพฤติกรรมเดิม: การออกบิลซ้ำจะรีเซ็ตสถานะเป็น unpaid/ยอดชำระ 0 เหมือนโค้ด JS เดิม)
  on conflict (room_id, month_key) do update set
    invoice_number      = excluded.invoice_number,
    room_name            = excluded.room_name,
    tenant_id             = excluded.tenant_id,
    tenant_name           = excluded.tenant_name,
    issue_date            = excluded.issue_date,
    due_date              = excluded.due_date,
    water_prev            = excluded.water_prev,
    water_curr            = excluded.water_curr,
    water_amount          = excluded.water_amount,
    elec_prev             = excluded.elec_prev,
    elec_curr             = excluded.elec_curr,
    elec_amount           = excluded.elec_amount,
    rent_amount           = excluded.rent_amount,
    trash_fee             = excluded.trash_fee,
    fine_amount           = excluded.fine_amount,
    total_amount          = excluded.total_amount,
    paid_amount           = excluded.paid_amount,
    outstanding_amount    = excluded.outstanding_amount,
    status                = excluded.status,
    slip_url              = excluded.slip_url,
    updated_at            = now()
  returning * into v_row;

  return json_build_object(
    'status', 'success',
    'invoice', json_build_object(
      'id', v_row.id, 'invoiceNumber', v_row.invoice_number, 'monthKey', v_row.month_key,
      'roomId', v_row.room_id, 'roomName', v_row.room_name,
      'tenantId', v_row.tenant_id, 'tenantName', v_row.tenant_name,
      'issueDate', v_row.issue_date, 'dueDate', v_row.due_date,
      'waterPrev', v_row.water_prev, 'waterCurr', v_row.water_curr, 'waterAmount', v_row.water_amount,
      'elecPrev', v_row.elec_prev, 'elecCurr', v_row.elec_curr, 'elecAmount', v_row.elec_amount,
      'rentAmount', v_row.rent_amount, 'trashFee', v_row.trash_fee, 'fineAmount', v_row.fine_amount,
      'totalAmount', v_row.total_amount, 'paidAmount', v_row.paid_amount,
      'outstandingAmount', v_row.outstanding_amount, 'status', v_row.status, 'slipUrl', v_row.slip_url
    )
  );
exception when others then
  return json_build_object('status', 'error', 'message', sqlerrm);
end;
$$;

-- ให้ anon key (แอดมิน) เรียกฟังก์ชันนี้ได้ (ตรงกับโมเดล "allow all" เดิมของโปรเจกต์)
grant execute on function public.generate_room_invoice(
  text, text, numeric, numeric, date, date, numeric, boolean
) to anon, authenticated;
