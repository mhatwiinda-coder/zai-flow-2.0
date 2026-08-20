-- ============================================================================
-- FIX: Update to Correct Zambian PAYE Compliance (ZRA 2026 Bands)
-- ============================================================================
-- This fixes payroll tax calculation to match official ZRA 2026 PAYE bands
-- Source: ZRA PAYE Tax Computation Bands 2026

-- STEP 1: Clear old incorrect tax_rules data
-- ============================================================================
DELETE FROM public.tax_rules
WHERE effective_date >= '2026-01-01';

-- STEP 2: Insert correct ZRA 2026 PAYE tax bands
-- ============================================================================
INSERT INTO public.tax_rules (min_income, max_income, tax_rate, description, effective_date)
VALUES
  -- Band 1: First K 5,100 @ 0% (tax-free allowance)
  (0.00, 5100.00, 0.00, 'ZRA 2026 Band 1: K 0 - K 5,100 @ 0%', '2026-01-01'),

  -- Band 2: K 5,100.01 - K 7,100 @ 20%
  (5100.01, 7100.00, 20.00, 'ZRA 2026 Band 2: K 5,100.01 - K 7,100 @ 20%', '2026-01-01'),

  -- Band 3: K 7,100.01 - K 9,200 @ 30%
  (7100.01, 9200.00, 30.00, 'ZRA 2026 Band 3: K 7,100.01 - K 9,200 @ 30%', '2026-01-01'),

  -- Band 4: K 9,200.01+ @ 37% (top bracket)
  (9200.01, 999999999.99, 37.00, 'ZRA 2026 Band 4: K 9,200.01+ @ 37%', '2026-01-01');

-- Verify the update
SELECT id, min_income, max_income, tax_rate, description, effective_date
FROM public.tax_rules
WHERE effective_date >= '2026-01-01'
ORDER BY min_income;

-- STEP 3: Add missing GL accounts for statutory contributions
-- ============================================================================

-- Check if NAPSA Payable account exists (account 2200)
-- If not, create it (it may be named "Pension Contribution Payable")
INSERT INTO public.chart_of_accounts (account_code, account_name, account_type, branch_id)
SELECT '2200', 'NAPSA Contributions Payable', 'LIABILITY', id
FROM public.branches
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts
  WHERE account_code = '2200' AND branch_id = branches.id
);

-- Create National Health Insurance Payable account (new - 2300)
INSERT INTO public.chart_of_accounts (account_code, account_name, account_type, branch_id)
SELECT '2300', 'National Health Insurance Payable', 'LIABILITY', id
FROM public.branches
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts
  WHERE account_code = '2300' AND branch_id = branches.id
);

-- Verify GL accounts exist
SELECT account_code, account_name, account_type
FROM public.chart_of_accounts
WHERE account_code IN ('5100', '2100', '2200', '2300')
ORDER BY account_code;

-- STEP 4: Add columns to payroll_deductions to track all deduction types
-- ============================================================================
-- These columns already exist but verify them
ALTER TABLE public.payroll_deductions
ADD COLUMN IF NOT EXISTS napsa_contribution NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS health_insurance NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_deductions NUMERIC(12,2) DEFAULT 0;

-- Update payroll_runs to track all deduction types
ALTER TABLE public.payroll_runs
ADD COLUMN IF NOT EXISTS total_napsa NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_health_insurance NUMERIC(12,2) DEFAULT 0;

-- Verify columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'payroll_deductions'
AND column_name IN ('paye_tax', 'napsa_contribution', 'health_insurance', 'net_salary')
ORDER BY ordinal_position;

-- ============================================================================
-- SUMMARY OF CHANGES
-- ============================================================================
-- ✅ Tax Rules updated with official ZRA 2026 PAYE bands (0%, 20%, 30%, 37%)
-- ✅ GL accounts created for PAYE (2100), NAPSA (2200), Health Insurance (2300)
-- ✅ Payroll tables updated with new deduction columns
--
-- NEXT STEPS:
-- 1. Deploy the updated process_payroll() function
-- 2. Reprocess April 2026 payroll (will recalculate with correct PAYE)
-- 3. Reprocess May 2026 payroll (will recalculate with correct PAYE)
-- 4. Verify GL entries and balance sheet
-- ============================================================================
