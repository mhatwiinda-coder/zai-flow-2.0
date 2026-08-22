-- ============================================================================
-- HR EMPLOYEE PROFILE - performance, disciplinary, training, documents
-- ============================================================================
-- Item 2: "employee profiles that can be accessed by HR when they click the
-- employee details... performance, disciplinary, and everything necessary."
--
-- Structure follows standard personnel-file practice:
--   - Employment history (promotions, transfers, salary changes)
--   - Performance reviews
--   - Disciplinary records
--   - Training & certifications (with expiry, so lapses are visible)
--   - Documents (contracts, ID, qualifications)
--   - Medical records - DELIBERATELY A SEPARATE TABLE
--   - Access audit log
--
-- The medical split is not a stylistic choice. The ADA requires medical
-- information to be "maintained on separate forms and in separate medical
-- files and treated as a confidential medical record", and FMLA requires the
-- same for certifications and medical histories. Mixing them into the general
-- personnel record is a compliance problem, so employee_medical_records is
-- its own table with its own access rules and is never returned by the
-- general profile RPC.
--
-- Personal details, emergency contact and avatar already live on `employees`
-- (see ADD_EMPLOYEE_PROFILE_FIELDS.sql) and are not duplicated here.
-- ============================================================================


-- ============================================================================
-- 1. EMPLOYMENT HISTORY - the job record over time
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employee_employment_history (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN
    ('HIRED','PROMOTION','TRANSFER','SALARY_CHANGE','ROLE_CHANGE','SUSPENSION','REINSTATEMENT','TERMINATION','RESIGNATION')),
  effective_date DATE NOT NULL,
  previous_position TEXT,
  new_position TEXT,
  previous_department_id INTEGER REFERENCES public.departments(id),
  new_department_id INTEGER REFERENCES public.departments(id),
  previous_salary NUMERIC(12,2),
  new_salary NUMERIC(12,2),
  reason TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emp_history_employee ON public.employee_employment_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_history_branch ON public.employee_employment_history(branch_id);


-- ============================================================================
-- 2. PERFORMANCE REVIEWS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employee_performance_reviews (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  review_period_start DATE NOT NULL,
  review_period_end DATE NOT NULL,
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reviewer_id UUID,
  reviewer_name TEXT,
  overall_rating NUMERIC(3,1) CHECK (overall_rating >= 1 AND overall_rating <= 5),
  strengths TEXT,
  areas_for_improvement TEXT,
  goals TEXT,
  employee_comments TEXT,
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','FINALISED','ACKNOWLEDGED')),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_review_period CHECK (review_period_end >= review_period_start)
);
CREATE INDEX IF NOT EXISTS idx_emp_reviews_employee ON public.employee_performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_reviews_branch ON public.employee_performance_reviews(branch_id);


-- ============================================================================
-- 3. DISCIPLINARY RECORDS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employee_disciplinary_records (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  incident_date DATE NOT NULL,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  severity TEXT NOT NULL CHECK (severity IN
    ('VERBAL_WARNING','WRITTEN_WARNING','FINAL_WARNING','SUSPENSION','DISMISSAL')),
  category TEXT,
  description TEXT NOT NULL,
  action_taken TEXT,
  issued_by UUID,
  issued_by_name TEXT,
  employee_response TEXT,
  acknowledged_at TIMESTAMPTZ,
  -- Warnings normally lapse after a set period; storing it makes "active"
  -- vs "spent" warnings answerable rather than a judgement call.
  expires_on DATE,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','RESCINDED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emp_disc_employee ON public.employee_disciplinary_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_disc_branch ON public.employee_disciplinary_records(branch_id);


-- ============================================================================
-- 4. TRAINING & CERTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employee_training_records (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  provider TEXT,
  training_type TEXT CHECK (training_type IN ('INDUCTION','COMPLIANCE','TECHNICAL','SAFETY','LEADERSHIP','OTHER')),
  start_date DATE,
  completion_date DATE,
  expiry_date DATE,
  result TEXT,
  certificate_url TEXT,
  cost NUMERIC(12,2),
  status TEXT DEFAULT 'COMPLETED' CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','FAILED','EXPIRED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emp_training_employee ON public.employee_training_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_training_expiry ON public.employee_training_records(expiry_date);


-- ============================================================================
-- 5. DOCUMENTS (non-medical)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN
    ('CONTRACT','OFFER_LETTER','ID_DOCUMENT','QUALIFICATION','NRC_COPY','TAX_FORM','POLICY_ACKNOWLEDGEMENT','RESIGNATION_LETTER','OTHER')),
  title TEXT NOT NULL,
  file_url TEXT,
  issued_date DATE,
  expiry_date DATE,
  notes TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emp_docs_employee ON public.employee_documents(employee_id);


-- ============================================================================
-- 6. MEDICAL RECORDS - SEPARATE AND RESTRICTED
-- ============================================================================
-- Kept apart from every other table above because the ADA requires medical
-- information to be held in separate confidential files, and FMLA says the
-- same for medical certifications. Never returned by get_employee_profile();
-- it has its own RPC so access can be restricted and logged independently.
CREATE TABLE IF NOT EXISTS public.employee_medical_records (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN
    ('SICK_NOTE','FITNESS_TO_WORK','ACCOMMODATION','INJURY_REPORT','VACCINATION','OTHER')),
  record_date DATE NOT NULL,
  summary TEXT,
  restrictions TEXT,
  valid_until DATE,
  file_url TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emp_medical_employee ON public.employee_medical_records(employee_id);


-- ============================================================================
-- 7. ACCESS AUDIT LOG
-- ============================================================================
-- Personnel files carry an expectation of a written access protocol and audit
-- trail. This records who opened whose file, and whether they viewed the
-- restricted medical section.
CREATE TABLE IF NOT EXISTS public.employee_profile_access_log (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  accessed_by UUID,
  section TEXT NOT NULL,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profile_access_employee ON public.employee_profile_access_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_profile_access_time ON public.employee_profile_access_log(accessed_at);


-- ============================================================================
-- 8. RPC: full profile (everything EXCEPT medical)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_employee_profile(INTEGER, INTEGER, UUID);
CREATE OR REPLACE FUNCTION public.get_employee_profile(
  p_employee_id INTEGER,
  p_branch_id INTEGER,
  p_viewer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Branch scoping: an employee from another branch is simply not visible.
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND branch_id = p_branch_id) THEN
    RETURN jsonb_build_object('error', 'Employee not found in this branch');
  END IF;

  INSERT INTO public.employee_profile_access_log (employee_id, accessed_by, section)
  VALUES (p_employee_id, p_viewer_id, 'PROFILE');

  SELECT jsonb_build_object(
    'employee', (
      SELECT to_jsonb(e) - 'notification_prefs'
      FROM (
        SELECT e.id, e.employee_code, e.first_name, e.last_name, e.preferred_name,
               e.email, e.personal_email, e.phone, e.position, e.status,
               e.hire_date, e.termination_date, e.date_of_birth, e.gender,
               e.marital_status, e.nationality, e.address, e.city,
               e.identity_number, e.tax_pin, e.avatar_url, e.basic_salary,
               e.branch_id, e.department_id,
               d.name AS department_name,
               e.emergency_contact_name, e.emergency_contact_phone,
               e.emergency_contact_relationship
        FROM public.employees e
        LEFT JOIN public.departments d ON d.id = e.department_id
        WHERE e.id = p_employee_id
      ) e
    ),
    'employment_history', COALESCE((
      SELECT jsonb_agg(to_jsonb(h) ORDER BY h.effective_date DESC)
      FROM public.employee_employment_history h WHERE h.employee_id = p_employee_id
    ), '[]'::jsonb),
    'performance_reviews', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.review_date DESC)
      FROM public.employee_performance_reviews r WHERE r.employee_id = p_employee_id
    ), '[]'::jsonb),
    'disciplinary_records', COALESCE((
      SELECT jsonb_agg(to_jsonb(dr) ORDER BY dr.incident_date DESC)
      FROM public.employee_disciplinary_records dr WHERE dr.employee_id = p_employee_id
    ), '[]'::jsonb),
    'training_records', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.completion_date DESC NULLS LAST)
      FROM public.employee_training_records t WHERE t.employee_id = p_employee_id
    ), '[]'::jsonb),
    'documents', COALESCE((
      SELECT jsonb_agg(to_jsonb(dc) ORDER BY dc.created_at DESC)
      FROM public.employee_documents dc WHERE dc.employee_id = p_employee_id
    ), '[]'::jsonb),
    'leave_summary', COALESCE((
      SELECT jsonb_build_object(
        'total_requests', COUNT(*),
        'approved_days', COALESCE(SUM(days_requested) FILTER (WHERE status='APPROVED'), 0),
        'pending', COUNT(*) FILTER (WHERE status='PENDING')
      )
      FROM public.leave_requests WHERE employee_id = p_employee_id
    ), '{}'::jsonb),
    'attendance_summary', COALESCE((
      SELECT jsonb_build_object(
        'days_present', COUNT(*) FILTER (WHERE status='PRESENT'),
        'days_absent',  COUNT(*) FILTER (WHERE status='ABSENT'),
        'days_leave',   COUNT(*) FILTER (WHERE status='LEAVE'),
        'days_sick',    COUNT(*) FILTER (WHERE status='SICK')
      )
      FROM public.attendance
      WHERE employee_id = p_employee_id AND attendance_date >= CURRENT_DATE - INTERVAL '90 days'
    ), '{}'::jsonb),
    -- Flag only; the records themselves require the separate RPC below.
    'has_medical_records', EXISTS (
      SELECT 1 FROM public.employee_medical_records WHERE employee_id = p_employee_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- ============================================================================
-- 9. RPC: medical records (separate call, separately logged)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_employee_medical_records(INTEGER, INTEGER, UUID);
CREATE OR REPLACE FUNCTION public.get_employee_medical_records(
  p_employee_id INTEGER,
  p_branch_id INTEGER,
  p_viewer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_is_allowed BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND branch_id = p_branch_id) THEN
    RETURN jsonb_build_object('error', 'Employee not found in this branch');
  END IF;

  -- Restricted to admins and the HR department manager, rather than anyone
  -- who can open a personnel file.
  SELECT public.zf_is_admin(p_viewer_id)
      OR EXISTS (
        SELECT 1 FROM public.departments d
        WHERE d.branch_id = p_branch_id AND d.name = 'Human Resources'
          AND d.manager_user_id = p_viewer_id
      )
  INTO v_is_allowed;

  IF NOT v_is_allowed THEN
    RETURN jsonb_build_object('error', 'Medical records are restricted to HR and administrators');
  END IF;

  INSERT INTO public.employee_profile_access_log (employee_id, accessed_by, section)
  VALUES (p_employee_id, p_viewer_id, 'MEDICAL');

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(m) ORDER BY m.record_date DESC)
    FROM public.employee_medical_records m WHERE m.employee_id = p_employee_id
  ), '[]'::jsonb);
END;
$$;


-- ============================================================================
-- 10. RPCs: add records
-- ============================================================================
DROP FUNCTION IF EXISTS public.add_disciplinary_record(INTEGER, INTEGER, DATE, TEXT, TEXT, TEXT, TEXT, DATE, UUID);
CREATE OR REPLACE FUNCTION public.add_disciplinary_record(
  p_employee_id INTEGER, p_branch_id INTEGER, p_incident_date DATE,
  p_severity TEXT, p_category TEXT, p_description TEXT, p_action_taken TEXT,
  p_expires_on DATE, p_issued_by UUID
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_name TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND branch_id = p_branch_id) THEN
    RETURN QUERY SELECT FALSE, 'Employee not found in this branch'::TEXT; RETURN;
  END IF;

  SELECT u.name INTO v_name FROM public.users u WHERE u.id = public.zf_uuid_to_user_id(p_issued_by);

  INSERT INTO public.employee_disciplinary_records
    (employee_id, branch_id, incident_date, severity, category, description, action_taken, expires_on, issued_by, issued_by_name)
  VALUES
    (p_employee_id, p_branch_id, p_incident_date, p_severity, p_category, p_description, p_action_taken, p_expires_on, p_issued_by, v_name);

  RETURN QUERY SELECT TRUE, ('Disciplinary record added (' || p_severity || ')')::TEXT;
END;
$$;

DROP FUNCTION IF EXISTS public.add_performance_review(INTEGER, INTEGER, DATE, DATE, NUMERIC, TEXT, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.add_performance_review(
  p_employee_id INTEGER, p_branch_id INTEGER, p_period_start DATE, p_period_end DATE,
  p_rating NUMERIC, p_strengths TEXT, p_improvements TEXT, p_goals TEXT, p_reviewer_id UUID
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_name TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND branch_id = p_branch_id) THEN
    RETURN QUERY SELECT FALSE, 'Employee not found in this branch'::TEXT; RETURN;
  END IF;

  SELECT u.name INTO v_name FROM public.users u WHERE u.id = public.zf_uuid_to_user_id(p_reviewer_id);

  INSERT INTO public.employee_performance_reviews
    (employee_id, branch_id, review_period_start, review_period_end, overall_rating,
     strengths, areas_for_improvement, goals, reviewer_id, reviewer_name, status)
  VALUES
    (p_employee_id, p_branch_id, p_period_start, p_period_end, p_rating,
     p_strengths, p_improvements, p_goals, p_reviewer_id, v_name, 'FINALISED');

  RETURN QUERY SELECT TRUE, 'Performance review saved'::TEXT;
END;
$$;

DROP FUNCTION IF EXISTS public.add_training_record(INTEGER, INTEGER, TEXT, TEXT, TEXT, DATE, DATE, TEXT);
CREATE OR REPLACE FUNCTION public.add_training_record(
  p_employee_id INTEGER, p_branch_id INTEGER, p_course_name TEXT, p_provider TEXT,
  p_training_type TEXT, p_completion_date DATE, p_expiry_date DATE, p_result TEXT
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND branch_id = p_branch_id) THEN
    RETURN QUERY SELECT FALSE, 'Employee not found in this branch'::TEXT; RETURN;
  END IF;

  INSERT INTO public.employee_training_records
    (employee_id, branch_id, course_name, provider, training_type, completion_date, expiry_date, result)
  VALUES
    (p_employee_id, p_branch_id, p_course_name, p_provider, p_training_type, p_completion_date, p_expiry_date, p_result);

  RETURN QUERY SELECT TRUE, 'Training record added'::TEXT;
END;
$$;


-- ============================================================================
-- 11. Seed employment history for existing staff
-- ============================================================================
-- Without this every existing employee's history starts blank; their hire is
-- the one event already known.
INSERT INTO public.employee_employment_history
  (employee_id, branch_id, change_type, effective_date, new_position, new_department_id, new_salary, reason)
SELECT e.id, e.branch_id, 'HIRED', e.hire_date, e.position, e.department_id, e.basic_salary, 'Initial appointment'
FROM public.employees e
WHERE e.branch_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.employee_employment_history h
    WHERE h.employee_id = e.id AND h.change_type = 'HIRED'
  );


-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'employee_%'
ORDER BY table_name;

SELECT routine_name FROM information_schema.routines
WHERE routine_schema='public' AND routine_name IN
 ('get_employee_profile','get_employee_medical_records','add_disciplinary_record',
  'add_performance_review','add_training_record')
ORDER BY routine_name;
-- Expect 5 functions.
