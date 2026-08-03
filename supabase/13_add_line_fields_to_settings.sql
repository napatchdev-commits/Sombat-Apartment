-- Migration: Add LINE configuration fields to settings table
alter table public.settings 
  add column if not exists line_token text,
  add column if not exists line_user_id text,
  add column if not exists line_notify_token text;
