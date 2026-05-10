-- ============================================================================
-- REINITIALIZE DEPARTMENTS FOR ALL BRANCHES
-- Run this if departments aren't showing in the HR dropdown
-- ============================================================================

-- Create departments for each branch
INSERT INTO public.departments (branch_id, business_id, name, description)
SELECT b.id, b.business_id, 'Management', 'Executive and management staff'
FROM public.branches b
WHERE NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.branch_id = b.id AND d.name = 'Management');

INSERT INTO public.departments (branch_id, business_id, name, description)
SELECT b.id, b.business_id, 'Finance', 'Accounting and financial management'
FROM public.branches b
WHERE NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.branch_id = b.id AND d.name = 'Finance');

INSERT INTO public.departments (branch_id, business_id, name, description)
SELECT b.id, b.business_id, 'Human Resources', 'HR and recruitment'
FROM public.branches b
WHERE NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.branch_id = b.id AND d.name = 'Human Resources');

INSERT INTO public.departments (branch_id, business_id, name, description)
SELECT b.id, b.business_id, 'Sales', 'Sales and business development'
FROM public.branches b
WHERE NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.branch_id = b.id AND d.name = 'Sales');

INSERT INTO public.departments (branch_id, business_id, name, description)
SELECT b.id, b.business_id, 'Operations', 'Operations and logistics'
FROM public.branches b
WHERE NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.branch_id = b.id AND d.name = 'Operations');

INSERT INTO public.departments (branch_id, business_id, name, description)
SELECT b.id, b.business_id, 'Customer Service', 'Customer support and relations'
FROM public.branches b
WHERE NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.branch_id = b.id AND d.name = 'Customer Service');

-- Verify departments were created
SELECT COUNT(*) as total_departments, business_id FROM public.departments GROUP BY business_id;
