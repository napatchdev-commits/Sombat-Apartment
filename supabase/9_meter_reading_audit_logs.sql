-- ============================================================================
-- 9) ตาราง "meter_audit_logs" และ "meter_readings_history"
--    สำหรับระบบจดมิเตอร์น้ำ-ไฟ (Meter Reading Module)
-- ============================================================================

create table if not exists public.meter_audit_logs (
  id             text primary key,
  room_id        text references public.rooms(id) on delete set null,
  room_name      text not null,
  month_key      text not null,
  recorded_by    text not null,
  action_type    text not null default 'RECORD', -- RECORD | EDIT
  old_water_curr numeric default 0,
  new_water_curr numeric default 0,
  old_elec_curr  numeric default 0,
  new_elec_curr  numeric default 0,
  water_units    numeric default 0,
  elec_units     numeric default 0,
  water_amount   numeric default 0,
  elec_amount    numeric default 0,
  notes          text,
  ip_address     text,
  user_agent     text,
  created_at     timestamptz default now()
);

-- Index สำหรับค้นหาประวัติมิเตอร์ตามห้องและรอบเดือนอย่างรวดเร็ว
create index if not exists idx_meter_audit_room_month on public.meter_audit_logs(room_id, month_key);
create index if not exists idx_meter_audit_created_at on public.meter_audit_logs(created_at desc);

-- RLS Policy
alter table public.meter_audit_logs enable row level security;

create policy "Enable all access for authenticated users on meter_audit_logs"
  on public.meter_audit_logs for all
  using (true)
  with check (true);
