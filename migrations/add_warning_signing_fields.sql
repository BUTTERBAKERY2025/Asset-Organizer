-- ===========================================================================
-- Migration: Enhanced Warnings & Disciplinary Workflow
-- Date: 2026-05-24
-- Purpose: Add fields to support templates, reason categories, attachments,
--          public WhatsApp signing link, and digital signature image.
--
-- Run this in Supabase SQL Editor BEFORE deploying the application code.
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ===========================================================================

ALTER TABLE employee_warnings
  ADD COLUMN IF NOT EXISTS template_id              text,
  ADD COLUMN IF NOT EXISTS reason_category          text,
  ADD COLUMN IF NOT EXISTS attachments              jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS public_token             text,
  ADD COLUMN IF NOT EXISTS signed_at                timestamp,
  ADD COLUMN IF NOT EXISTS signature_data           text,
  ADD COLUMN IF NOT EXISTS signed_ip                text,
  ADD COLUMN IF NOT EXISTS signed_user_agent        text,
  ADD COLUMN IF NOT EXISTS company_name_snapshot    text;

-- Unique index on public_token (used to look up warnings via WhatsApp link).
-- Allows NULLs so older rows without a token remain valid.
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_warnings_public_token
  ON employee_warnings(public_token)
  WHERE public_token IS NOT NULL;

-- Helper index for per-employee disciplinary account statement queries.
CREATE INDEX IF NOT EXISTS idx_employee_warnings_employee_date
  ON employee_warnings(branch_employee_id, issued_date DESC);
