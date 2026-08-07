-- SQL Migration: Add status and last_assigned_room_name to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_assigned_room_name TEXT;
