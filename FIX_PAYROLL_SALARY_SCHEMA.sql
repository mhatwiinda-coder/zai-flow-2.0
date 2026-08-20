-- FIX: Add basic_salary column to employees table
-- This fixes the discrepancy where process_payroll() was using hardcoded K 5,000

-- Step 1: Add basic_salary column if it doesn't exist
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(12,2);

-- Step 2: Add other salary/compensation columns for future use
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS allowances NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS housing_benefit NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS transport_allowance NUMERIC(12,2) DEFAULT 0;

-- Step 3: Verify structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'employees'
AND column_name IN ('basic_salary', 'allowances', 'housing_benefit', 'transport_allowance')
ORDER BY ordinal_position;

-- Step 4: Set correct salaries for existing employees
-- Mainza Hatwiinda: K 50,000
UPDATE public.employees
SET basic_salary = 50000
WHERE employee_code = 'MAINZA' OR first_name = 'MAINZA';

-- Lodia Chikambwe: K 40,000
UPDATE public.employees
SET basic_salary = 40000
WHERE employee_code = 'LODIA' OR first_name = 'LODIA';

-- Step 5: Verify the updates
SELECT
  id, employee_code, first_name, last_name,
  basic_salary, allowances, status
FROM public.employees
WHERE branch_id = 1
ORDER BY employee_code;

-- Step 6: Add comment explaining the fix
COMMENT ON COLUMN public.employees.basic_salary IS 'Monthly basic salary in ZMW. Used by process_payroll() to calculate deductions. Must be > 0 for employee to be included in payroll.';

-- Done! Now the payroll function will use actual employee salaries instead of hardcoded K 5,000
