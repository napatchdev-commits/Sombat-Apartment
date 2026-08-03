-- ============================================================================
--  ย้ายข้อมูลเดิมจากตาราง apartment_state (JSON ก้อนเดียว) เข้าตารางใหม่
--  รันไฟล์ 1_schema.sql ให้เสร็จก่อน แล้วค่อยรันไฟล์นี้ "ครั้งเดียว"
--  สคริปต์นี้เขียนแบบ idempotent (รันซ้ำได้ ไม่สร้างข้อมูลซ้ำ) เพราะใช้ on conflict
-- ============================================================================

do $$
declare
  v_state jsonb;
begin
  select state into v_state from public.apartment_state where id = 1;

  if v_state is null then
    raise notice 'ไม่พบข้อมูลเดิมใน apartment_state (id=1) — ข้ามการย้ายข้อมูล';
    return;
  end if;

  -- settings ------------------------------------------------------------
  insert into public.settings (id, apartment_name, address, tel, line_id, bank_name, bank_account_no, bank_account_name, prompt_pay_id)
  values (
    1,
    v_state->'settings'->>'apartmentName', v_state->'settings'->>'address', v_state->'settings'->>'tel',
    v_state->'settings'->>'lineId', v_state->'settings'->>'bankName', v_state->'settings'->>'bankAccountNo',
    v_state->'settings'->>'bankAccountName', v_state->'settings'->>'promptPayId'
  )
  on conflict (id) do update set
    apartment_name = excluded.apartment_name, address = excluded.address, tel = excluded.tel,
    line_id = excluded.line_id, bank_name = excluded.bank_name, bank_account_no = excluded.bank_account_no,
    bank_account_name = excluded.bank_account_name, prompt_pay_id = excluded.prompt_pay_id, updated_at = now();

  -- rates -----------------------------------------------------------------
  insert into public.rates (id, electricity_rate, water_rate, trash_fee, internet_fee, common_fee)
  values (
    1,
    coalesce((v_state->'rates'->>'electricityRate')::numeric, 8),
    coalesce((v_state->'rates'->>'waterRate')::numeric, 20),
    coalesce((v_state->'rates'->>'trashFee')::numeric, 20),
    coalesce((v_state->'rates'->>'internetFee')::numeric, 200),
    coalesce((v_state->'rates'->>'commonFee')::numeric, 100)
  )
  on conflict (id) do update set
    electricity_rate = excluded.electricity_rate, water_rate = excluded.water_rate, trash_fee = excluded.trash_fee,
    internet_fee = excluded.internet_fee, common_fee = excluded.common_fee, updated_at = now();

  -- users -------------------------------------------------------------
  insert into public.users (id, username, display_name, role, password_hash)
  select u->>'id', u->>'username', u->>'displayName', u->>'role', u->>'passwordHash'
  from jsonb_array_elements(coalesce(v_state->'users', '[]'::jsonb)) u
  on conflict (id) do update set
    username = excluded.username, display_name = excluded.display_name, role = excluded.role,
    password_hash = excluded.password_hash, updated_at = now();

  -- room_types --------------------------------------------------------
  insert into public.room_types (id, name, rental_type, default_rent, description)
  select rt->>'id', rt->>'name', rt->>'rentalType', coalesce((rt->>'defaultRent')::numeric, 0), rt->>'description'
  from jsonb_array_elements(coalesce(v_state->'roomTypes', '[]'::jsonb)) rt
  on conflict (id) do update set
    name = excluded.name, rental_type = excluded.rental_type, default_rent = excluded.default_rent,
    description = excluded.description, updated_at = now();

  -- rooms ---------------------------------------------------------------
  insert into public.rooms (id, name, floor, type_id, base_rent, status, current_tenant_id, current_tenant_name, entry_date, last_water_meter, last_elec_meter)
  select
    r->>'id', r->>'name', coalesce((r->>'floor')::int, 1),
    coalesce(r->>'typeId', r->>'type'),
    coalesce((r->>'baseRent')::numeric, 0), coalesce(r->>'status', 'vacant'),
    r->>'currentTenantId', r->>'currentTenantName',
    nullif(r->>'entryDate','')::date,
    coalesce((r->>'lastWaterMeter')::numeric, 0), coalesce((r->>'lastElecMeter')::numeric, 0)
  from jsonb_array_elements(coalesce(v_state->'rooms', '[]'::jsonb)) r
  on conflict (id) do update set
    name = excluded.name, floor = excluded.floor, type_id = excluded.type_id, base_rent = excluded.base_rent,
    status = excluded.status, current_tenant_id = excluded.current_tenant_id, current_tenant_name = excluded.current_tenant_name,
    entry_date = excluded.entry_date, last_water_meter = excluded.last_water_meter, last_elec_meter = excluded.last_elec_meter,
    updated_at = now();

  -- tenants ---------------------------------------------------------------
  insert into public.tenants (id, name, id_card, tel, line_id, email, address, start_date, end_date, assigned_room_id, deposit_amount, deposit_status)
  select
    t->>'id', t->>'name', t->>'idCard', t->>'tel', t->>'lineId', t->>'email', t->>'address',
    nullif(t->>'startDate','')::date, nullif(t->>'endDate','')::date, t->>'assignedRoomId',
    coalesce((t->'deposit'->>'initialBail')::numeric, 0),
    coalesce(t->'deposit'->>'status', 'active')
  from jsonb_array_elements(coalesce(v_state->'tenants', '[]'::jsonb)) t
  on conflict (id) do update set
    name = excluded.name, id_card = excluded.id_card, tel = excluded.tel, line_id = excluded.line_id,
    email = excluded.email, address = excluded.address, start_date = excluded.start_date, end_date = excluded.end_date,
    assigned_room_id = excluded.assigned_room_id, deposit_amount = excluded.deposit_amount,
    deposit_status = excluded.deposit_status, updated_at = now();

  -- tenant_documents (สลิป/บัตรประชาชน/ทะเบียนบ้าน/อื่นๆ ของผู้เช่าแต่ละคน) -----------
  insert into public.tenant_documents (id, tenant_id, category, title, file_name, file_type, file_size, file_url, upload_date)
  select
    coalesce(d->>'id', 'doc_' || md5(random()::text)),
    t->>'id', coalesce(d->>'category','other'), d->>'title', d->>'fileName', d->>'fileType',
    nullif(d->>'fileSize','')::bigint, d->>'dataUrl', nullif(d->>'uploadDate','')::date
  from jsonb_array_elements(coalesce(v_state->'tenants', '[]'::jsonb)) t,
       jsonb_array_elements(coalesce(t->'documents', '[]'::jsonb)) d
  on conflict (id) do update set
    category = excluded.category, title = excluded.title, file_name = excluded.file_name,
    file_type = excluded.file_type, file_size = excluded.file_size, file_url = excluded.file_url,
    upload_date = excluded.upload_date, updated_at = now();

  -- tenant_deposit_deductions -------------------------------------------
  insert into public.tenant_deposit_deductions (id, tenant_id, description, amount, date)
  select
    coalesce(dd->>'id', 'ded_' || md5(random()::text)),
    t->>'id', dd->>'description', coalesce((dd->>'amount')::numeric, 0), nullif(dd->>'date','')::date
  from jsonb_array_elements(coalesce(v_state->'tenants', '[]'::jsonb)) t,
       jsonb_array_elements(coalesce(t->'deposit'->'deductions', '[]'::jsonb)) dd
  on conflict (id) do update set
    description = excluded.description, amount = excluded.amount, date = excluded.date, updated_at = now();

  -- invoices ------------------------------------------------------------
  -- ตัดบิลซ้ำ (ห้องเดียวกัน เดือนเดียวกัน) เหลือใบที่จ่ายแล้วก่อน แล้วค่อยเลือกใบล่าสุด
  insert into public.invoices (id, invoice_number, month_key, room_id, room_name, tenant_id, tenant_name,
    issue_date, due_date, water_prev, water_curr, water_amount, elec_prev, elec_curr, elec_amount,
    rent_amount, trash_fee, fine_amount, total_amount, paid_amount, outstanding_amount, status, slip_url)
  select distinct on (i->>'roomId', i->>'monthKey')
    i->>'id', i->>'invoiceNumber', i->>'monthKey', i->>'roomId', i->>'roomName', i->>'tenantId', i->>'tenantName',
    nullif(i->>'issueDate','')::date, nullif(i->>'dueDate','')::date,
    coalesce((i->>'waterPrev')::numeric,0), coalesce((i->>'waterCurr')::numeric,0), coalesce((i->>'waterAmount')::numeric,0),
    coalesce((i->>'elecPrev')::numeric,0), coalesce((i->>'elecCurr')::numeric,0), coalesce((i->>'elecAmount')::numeric,0),
    coalesce((i->>'rentAmount')::numeric,0), coalesce((i->>'trashFee')::numeric,0), coalesce((i->>'fineAmount')::numeric,0),
    coalesce((i->>'totalAmount')::numeric,0), coalesce((i->>'paidAmount')::numeric,0), coalesce((i->>'outstandingAmount')::numeric,0),
    coalesce(i->>'status','unpaid'), i->>'slipUrl'
  from jsonb_array_elements(coalesce(v_state->'invoices', '[]'::jsonb)) i
  order by i->>'roomId', i->>'monthKey', (i->>'status' = 'paid') desc
  on conflict (room_id, month_key) do update set
    invoice_number = excluded.invoice_number, room_name = excluded.room_name, tenant_id = excluded.tenant_id,
    tenant_name = excluded.tenant_name, issue_date = excluded.issue_date, due_date = excluded.due_date,
    water_prev = excluded.water_prev, water_curr = excluded.water_curr, water_amount = excluded.water_amount,
    elec_prev = excluded.elec_prev, elec_curr = excluded.elec_curr, elec_amount = excluded.elec_amount,
    rent_amount = excluded.rent_amount, trash_fee = excluded.trash_fee, fine_amount = excluded.fine_amount,
    total_amount = excluded.total_amount, paid_amount = excluded.paid_amount, outstanding_amount = excluded.outstanding_amount,
    status = excluded.status, slip_url = excluded.slip_url, updated_at = now();

  -- repairs ---------------------------------------------------------------
  insert into public.repairs (id, ticket_number, room_id, room_name, tenant_name, title, description, category, request_date, status, expense_amount, assigned_technician, image_url)
  select
    rp->>'id', rp->>'ticketNumber', rp->>'roomId', rp->>'roomName', rp->>'tenantName', rp->>'title', rp->>'description',
    coalesce(rp->>'category','general'), nullif(rp->>'requestDate','')::date, coalesce(rp->>'status','pending'),
    coalesce((rp->>'expenseAmount')::numeric,0), rp->>'assignedTechnician', rp->>'imageUrl'
  from jsonb_array_elements(coalesce(v_state->'repairs', '[]'::jsonb)) rp
  on conflict (id) do update set
    ticket_number = excluded.ticket_number, room_id = excluded.room_id, room_name = excluded.room_name,
    tenant_name = excluded.tenant_name, title = excluded.title, description = excluded.description,
    category = excluded.category, request_date = excluded.request_date, status = excluded.status,
    expense_amount = excluded.expense_amount, assigned_technician = excluded.assigned_technician,
    image_url = excluded.image_url, updated_at = now();

  -- ledger ------------------------------------------------------------------
  insert into public.ledger (id, date, type, category, description, amount, recorded_by)
  select l->>'id', nullif(l->>'date','')::date, l->>'type', l->>'category', l->>'description',
         coalesce((l->>'amount')::numeric,0), l->>'recordedBy'
  from jsonb_array_elements(coalesce(v_state->'ledger', '[]'::jsonb)) l
  on conflict (id) do update set
    date = excluded.date, type = excluded.type, category = excluded.category, description = excluded.description,
    amount = excluded.amount, recorded_by = excluded.recorded_by, updated_at = now();

  -- events --------------------------------------------------------------
  insert into public.events (id, title, date, category, room_name)
  select e->>'id', e->>'title', nullif(e->>'date','')::date, e->>'category', e->>'roomName'
  from jsonb_array_elements(coalesce(v_state->'events', '[]'::jsonb)) e
  on conflict (id) do update set
    title = excluded.title, date = excluded.date, category = excluded.category, room_name = excluded.room_name, updated_at = now();

  raise notice 'ย้ายข้อมูลจาก apartment_state เข้าตารางใหม่เรียบร้อย';
end $$;

-- ตรวจสอบผลลัพธ์
select 'rooms' t, count(*) from public.rooms
union all select 'tenants', count(*) from public.tenants
union all select 'invoices', count(*) from public.invoices
union all select 'repairs', count(*) from public.repairs
union all select 'ledger', count(*) from public.ledger
union all select 'events', count(*) from public.events
union all select 'users', count(*) from public.users
union all select 'room_types', count(*) from public.room_types
union all select 'tenant_documents', count(*) from public.tenant_documents
union all select 'tenant_deposit_deductions', count(*) from public.tenant_deposit_deductions;

-- ⚠️ อย่าเพิ่งลบ apartment_state ทันที — ให้เปิดแอปที่อัปเดตแล้วทดสอบก่อนสัก 2-3 วัน
-- เมื่อมั่นใจว่าทุกอย่างทำงานถูกต้องแล้วค่อยรัน (เก็บสำรองไว้ก่อนก็ได้):
-- drop table public.apartment_state;
