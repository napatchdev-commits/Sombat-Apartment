-- Migration: Add LINE notification tracking columns to public.payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS line_notification_status text DEFAULT 'pending';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS line_notification_sent_at timestamptz;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS line_notification_error text;
