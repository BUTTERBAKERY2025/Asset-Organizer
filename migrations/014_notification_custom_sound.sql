-- ============================================
-- Phase 5.1: Custom sound URL for notifications
-- Run this MANUALLY in Supabase SQL Editor BEFORE deploying new code.
-- Safe & idempotent.
-- ============================================

ALTER TABLE system_notifications
  ADD COLUMN IF NOT EXISTS custom_sound_url TEXT;
