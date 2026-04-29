-- ====================================================================
-- ZAI FLOW 2.0 - USERS TABLE UPDATE FOR BUSINESS ISOLATION
-- Adds business_id to users table to enforce tenant isolation
-- ====================================================================

/* =====================================================
   ALTER USERS TABLE - Add business_id column
===================================================== */

-- Add business_id column if it doesn't exist
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES public.business_entities(id) ON DELETE CASCADE;

-- Create index for business_id lookups
CREATE INDEX IF NOT EXISTS idx_users_business_id ON public.users(business_id);

-- Create index for email + business_id (for business-scoped logins)
CREATE INDEX IF NOT EXISTS idx_users_email_business ON public.users(email, business_id);

-- Add created_at if missing
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

/* =====================================================
   SEED USERS WITH BUSINESS ASSIGNMENT
   Assign existing users to DEFAULT_BUSINESS
===================================================== */

-- Update existing users to belong to DEFAULT_BUSINESS (id = 1)
UPDATE public.users
SET business_id = 1
WHERE business_id IS NULL;

/* =====================================================
   COMPLETION MESSAGE
===================================================== */
DO $$
BEGIN
  RAISE NOTICE '✅ Users table updated with business_id';
  RAISE NOTICE '✅ All existing users assigned to DEFAULT_BUSINESS';
  RAISE NOTICE '✅ Users are now BUSINESS-SCOPED';
  RAISE NOTICE '✅ Each user belongs to exactly ONE business';
END $$;
