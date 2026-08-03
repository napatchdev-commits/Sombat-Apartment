-- ============================================================================
--  Sombat Apartment — ย้ายจาก apartment_state (JSON ก้อนเดียว) เป็นตารางแยกประเภท
--  รันไฟล์นี้ใน Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) ตาราง "settings" และ "rates"  (ตั้งค่าทั่วไป — มีแถวเดียว id = 1)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id                  int primary key default 1,
  apartment_name      text,
  address             text,
  tel                 text,
  line_id             text,
  bank_name           text,
  bank_account_no     text,
  bank_account_name   text,
  prompt_pay_id       text,
  is_demo_mode        boolean default true,
  updated_at          timestamptz default now(),
  constraint settings_single_row check (id = 1)
);

create table if not exists public.rates (
  id                  int primary key default 1,
  electricity_rate    numeric default 8,
  water_rate          numeric default 20,
  trash_fee           numeric default 20,
  internet_fee        numeric default 200,
  common_fee          numeric default 100,
  updated_at          timestamptz default now(),
  constraint rates_single_row check (id = 1)
);

-- ---------------------------------------------------------------------------
-- 2) ผู้ใช้งานระบบ (แอดมิน/สตาฟ)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id             text primary key,
  username       text unique not null,
  display_name   text,
  role           text not null default 'staff',
  password_hash  text not null,
  updated_at     timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 3) ประเภทห้อง
-- ---------------------------------------------------------------------------
create table if not exists public.room_types (
  id            text primary key,
  name          text not null,
  rental_type   text,
  default_rent  numeric default 0,
  description   text,
  updated_at    timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 4) ห้องเช่า
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id                    text primary key,
  name                  text not null,
  floor                 int default 1,
  type_id               text references public.room_types(id) on delete set null,
  base_rent             numeric default 0,
  status                text default 'vacant',           -- vacant | occupied
  current_tenant_id     text,
  current_tenant_name   text,
  entry_date            date,
  last_water_meter      numeric default 0,
  last_elec_meter       numeric default 0,
  updated_at            timestamptz default now()
);
create index if not exists idx_rooms_status on public.rooms(status);

-- ---------------------------------------------------------------------------
-- 5) ผู้เช่า
-- ---------------------------------------------------------------------------
create table if not exists public.tenants (
  id                text primary key,
  name              text not null,
  id_card           text,
  tel               text,
  line_id           text,
  email             text,
  address           text,
  start_date        date,          -- วันเริ่มสัญญาเช่า
  end_date          date,          -- วันสิ้นสุดสัญญาเช่า
  assigned_room_id  text references public.rooms(id) on delete set null,
  deposit_amount    numeric default 0,      -- เงินมัดจำ (แยกคอลัมน์ชัดเจน)
  deposit_status    text default 'active',  -- active | refunded | forfeited
  updated_at        timestamptz default now()
);
create index if not exists idx_tenants_room on public.tenants(assigned_room_id);
create index if not exists idx_tenants_idcard on public.tenants(id_card);

-- 5.1) เอกสารผู้เช่า (สลิป/บัตรประชาชน/ทะเบียนบ้าน/อื่นๆ) — แยกออกจาก tenants เป็นตารางคอลัมน์ของตัวเอง
create table if not exists public.tenant_documents (
  id            text primary key,
  tenant_id     text not null references public.tenants(id) on delete cascade,
  category      text not null,     -- idcard | house | other
  title         text,
  file_name     text,
  file_type     text,
  file_size     bigint,
  file_url      text,              -- URL จาก Supabase Storage (แนะนำ) หรือ data URL ชั่วคราว
  upload_date   date,
  updated_at    timestamptz default now()
);
create index if not exists idx_tenant_documents_tenant on public.tenant_documents(tenant_id);
create index if not exists idx_tenant_documents_category on public.tenant_documents(category);

-- 5.2) รายการหักเงินมัดจำ (ถ้ามี) — แยกเป็นตารางของตัวเอง แทนอาร์เรย์ซ้อนใน JSON
create table if not exists public.tenant_deposit_deductions (
  id            text primary key,
  tenant_id     text not null references public.tenants(id) on delete cascade,
  description   text,
  amount        numeric default 0,
  date          date,
  updated_at    timestamptz default now()
);
create index if not exists idx_deposit_deductions_tenant on public.tenant_deposit_deductions(tenant_id);

-- ---------------------------------------------------------------------------
-- 6) ใบแจ้งหนี้ / บิล
--    หัวใจของการ "ดึงข้อมูลไปทำบิลไม่ชนกัน": UNIQUE(room_id, month_key)
--    ห้องเดียว เดือนเดียว ออกบิลซ้ำไม่ได้ในระดับฐานข้อมูล (กันชนจริง ไม่ใช่แค่กรองซ้ำฝั่ง JS)
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id                  text primary key,
  invoice_number      text not null,
  month_key           text not null,                    -- 'YYYY-MM'
  room_id             text references public.rooms(id) on delete set null,
  room_name           text,
  tenant_id           text,
  tenant_name         text,
  issue_date          date,
  due_date            date,
  water_prev          numeric default 0,
  water_curr          numeric default 0,
  water_amount        numeric default 0,
  elec_prev           numeric default 0,
  elec_curr           numeric default 0,
  elec_amount         numeric default 0,
  rent_amount         numeric default 0,
  trash_fee           numeric default 0,
  fine_amount         numeric default 0,
  total_amount        numeric default 0,
  paid_amount         numeric default 0,
  outstanding_amount  numeric default 0,
  status              text default 'unpaid',             -- unpaid | pending_verification | paid
  slip_url            text,
  updated_at          timestamptz default now(),
  unique (room_id, month_key),
  unique (invoice_number)
);
create index if not exists idx_invoices_month on public.invoices(month_key);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_room on public.invoices(room_id);

-- ---------------------------------------------------------------------------
-- 7) แจ้งซ่อม
-- ---------------------------------------------------------------------------
create table if not exists public.repairs (
  id                    text primary key,
  ticket_number         text,
  room_id               text references public.rooms(id) on delete set null,
  room_name             text,
  tenant_name           text,
  title                 text,
  description           text,
  category              text default 'general',
  request_date          date,
  status                text default 'pending',
  expense_amount        numeric default 0,
  assigned_technician   text,
  image_url             text,
  updated_at            timestamptz default now()
);
create index if not exists idx_repairs_room on public.repairs(room_id);
create index if not exists idx_repairs_status on public.repairs(status);

-- ---------------------------------------------------------------------------
-- 8) บัญชีรายรับ-รายจ่าย
-- ---------------------------------------------------------------------------
create table if not exists public.ledger (
  id            text primary key,
  date          date,
  type          text,          -- income | expense
  category      text,
  description   text,
  amount        numeric default 0,
  recorded_by   text,
  updated_at    timestamptz default now()
);
create index if not exists idx_ledger_date on public.ledger(date);

-- ---------------------------------------------------------------------------
-- 9) ปฏิทิน/นัดหมาย
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id            text primary key,
  title         text,
  date          date,
  category      text,
  room_name     text,
  updated_at    timestamptz default now()
);

-- ============================================================================
-- Row Level Security — เปิดให้ตรงกับพฤติกรรมเดิมของ apartment_state
-- (anon key เดิมใช้เต็มสิทธิ์อยู่แล้ว จึงเปิด policy แบบเดียวกันเพื่อไม่ให้แอปพัง
--  หากต้องการความปลอดภัยเพิ่ม ค่อยจำกัดสิทธิ์เฉพาะ role ทีหลังได้)
-- ============================================================================
do $$
declare t text;
begin
  for t in select unnest(array['settings','rates','users','room_types','rooms','tenants','tenant_documents','tenant_deposit_deductions','invoices','repairs','ledger','events'])
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "allow all" on public.%I;', t);
    execute format('create policy "allow all" on public.%I for all using (true) with check (true);', t);
  end loop;
end $$;

-- ============================================================================
-- RPC สำหรับพอร์ทัลผู้เช่า (tenant.html / tenant-app.js) — ชื่อฟังก์ชันตรงกับ
-- ที่ tenant-app.js เรียกอยู่แล้ว จึงไม่ต้องแก้โค้ดฝั่งพอร์ทัลผู้เช่าเลย
-- ============================================================================

-- 1) รายชื่อห้อง + ชื่อหอพัก (สำหรับหน้าเลือกห้อง)
create or replace function public.get_room_list()
returns json
language sql
security definer
as $$
  select json_build_object(
    'apartmentName', (select apartment_name from public.settings where id = 1),
    'rooms', coalesce((
      select json_agg(json_build_object(
        'id', r.id, 'name', r.name, 'floor', r.floor,
        'typeId', r.type_id, 'baseRent', r.base_rent, 'status', r.status,
        'currentTenantId', r.current_tenant_id, 'currentTenantName', r.current_tenant_name,
        'lastElecMeter', r.last_elec_meter, 'lastWaterMeter', r.last_water_meter
      ) order by r.name)
      from public.rooms r
    ), '[]'::json)
  );
$$;

-- 2) ดึงบิล/ข้อมูลของผู้เช่ารายคน ตรวจด้วยเลขบัตร + ห้อง (ป้องกันเห็นบิลคนอื่น)
create or replace function public.get_tenant_bill(p_id_card text, p_room_id text)
returns json
language plpgsql
security definer
as $$
declare
  v_tenant record;
begin
  select * into v_tenant
  from public.tenants
  where assigned_room_id = p_room_id
    and regexp_replace(id_card, '\D', '', 'g') = regexp_replace(p_id_card, '\D', '', 'g')
  limit 1;

  if not found then
    return json_build_object('status', 'error', 'message', 'ไม่พบข้อมูลผู้เช่า หรือเลขบัตรไม่ตรงกับห้องนี้');
  end if;

  return json_build_object(
    'status', 'success',
    'settings', (select json_build_object('apartmentName', apartment_name) from public.settings where id = 1),
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

-- 3) ผู้เช่าแจ้งชำระเงิน — อัปเดตบิลใบเดียวแบบ atomic กันชนกับแอดมินที่อาจกำลังแก้บิลใบเดียวกัน
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
begin
  select exists(
    select 1 from public.tenants
    where assigned_room_id = p_room_id
      and regexp_replace(id_card, '\D', '', 'g') = regexp_replace(p_id_card, '\D', '', 'g')
  ) into v_tenant_ok;

  if not v_tenant_ok then
    return json_build_object('status', 'error', 'message', 'ยืนยันตัวตนผู้เช่าไม่สำเร็จ');
  end if;

  select * into v_invoice from public.invoices
  where invoice_number = p_invoice_number and room_id = p_room_id
  for update;                          -- ล็อกแถวนี้แถวเดียว กันแอดมิน/ผู้เช่าเขียนชนกัน

  if not found then
    return json_build_object('status', 'error', 'message', 'ไม่พบใบแจ้งหนี้นี้');
  end if;

  if v_invoice.status = 'paid' then
    return json_build_object('status', 'error', 'message', 'ใบแจ้งหนี้นี้ชำระแล้ว');
  end if;

  update public.invoices
  set status = case when p_payment_method = 'transfer' then 'pending_verification' else 'paid' end,
      slip_url = coalesce(p_slip_url, slip_url),
      updated_at = now()
  where id = v_invoice.id;

  return json_build_object('status', 'success', 'message', 'ส่งแจ้งชำระเงินเรียบร้อย รอตรวจสอบจากแอดมิน');
end;
$$;

-- 4) ผู้เช่าแจ้งซ่อม
create or replace function public.submit_tenant_repair(
  p_id_card text, p_room_id text, p_title text, p_description text, p_image_url text
)
returns json
language plpgsql
security definer
as $$
declare
  v_tenant record;
  v_room record;
  v_new_id text;
begin
  select * into v_tenant from public.tenants
  where assigned_room_id = p_room_id
    and regexp_replace(id_card, '\D', '', 'g') = regexp_replace(p_id_card, '\D', '', 'g')
  limit 1;

  if not found then
    return json_build_object('status', 'error', 'message', 'ยืนยันตัวตนผู้เช่าไม่สำเร็จ');
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  v_new_id := 'rep_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 6);

  insert into public.repairs (id, ticket_number, room_id, room_name, tenant_name, title, description, category, request_date, status, image_url)
  values (v_new_id, 'REP-' || to_char(now(), 'YYYY') || '-' || floor(random()*900+100)::int,
          p_room_id, v_room.name, v_tenant.name, p_title, p_description, 'general', current_date, 'pending', p_image_url);

  return json_build_object('status', 'success', 'message', 'แจ้งซ่อมเรียบร้อย');
end;
$$;

grant execute on function public.get_room_list() to anon, authenticated;
grant execute on function public.get_tenant_bill(text, text) to anon, authenticated;
grant execute on function public.submit_tenant_payment(text, text, text, text, text) to anon, authenticated;
grant execute on function public.submit_tenant_repair(text, text, text, text, text) to anon, authenticated;
