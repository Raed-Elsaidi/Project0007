-- Manual registration-photo review workflow.
-- Run once in Supabase SQL Editor before deploying both portals.

CREATE TABLE IF NOT EXISTS public.student_registration_manual_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  national_id text NOT NULL,
  academic_year integer NOT NULL,
  registration_cycle integer NOT NULL,
  identity_image_url text NOT NULL,
  personal_image_url text NOT NULL,
  document_type text,
  student_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_employee_id bigint,
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_registration_manual_reviews_status_created
  ON public.student_registration_manual_reviews(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_registration_manual_reviews_student
  ON public.student_registration_manual_reviews(national_id, academic_year, registration_cycle);
ALTER TABLE public.student_registration_manual_reviews ENABLE ROW LEVEL SECURITY;

-- The browser must not insert/read/update this table directly. All operations go through
-- narrowly-scoped SECURITY DEFINER functions below.
REVOKE ALL ON public.student_registration_manual_reviews FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.student_registration_manual_reviews TO service_role;

CREATE OR REPLACE FUNCTION public.submit_student_registration_manual_review(
  p_national_id text,
  p_academic_year integer,
  p_registration_cycle integer,
  p_identity_image_url text,
  p_personal_image_url text,
  p_document_type text,
  p_student_snapshot jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF nullif(trim(p_national_id), '') IS NULL
     OR p_academic_year IS NULL OR p_registration_cycle IS NULL
     OR nullif(trim(p_identity_image_url), '') IS NULL
     OR nullif(trim(p_personal_image_url), '') IS NULL THEN
    RAISE EXCEPTION 'بيانات طلب المراجعة غير مكتملة';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.allow_student a WHERE trim(a.national_id::text) = trim(p_national_id)) THEN
    RAISE EXCEPTION 'الطالب غير موجود ضمن قائمة الطلاب المسموح لهم بالتسجيل';
  END IF;

  -- Prevent duplicate pending review requests for the same student and cycle.
  PERFORM pg_advisory_xact_lock(hashtext(trim(p_national_id)), p_registration_cycle);
  IF EXISTS (
    SELECT 1 FROM public.student_registration_manual_reviews r
    WHERE r.national_id = trim(p_national_id)
      AND r.academic_year = p_academic_year
      AND r.registration_cycle = p_registration_cycle
      AND r.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'يوجد طلب مراجعة صور قيد الانتظار لهذا الطالب';
  END IF;

  INSERT INTO public.student_registration_manual_reviews (
    national_id, academic_year, registration_cycle,
    identity_image_url, personal_image_url, document_type,
    student_snapshot, status
  ) VALUES (
    trim(p_national_id), p_academic_year, p_registration_cycle,
    p_identity_image_url, p_personal_image_url, p_document_type,
    coalesce(p_student_snapshot, '{}'::jsonb), 'pending'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_student_registration_manual_reviews(p_employee_id bigint)
RETURNS SETOF public.student_registration_manual_reviews
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    LEFT JOIN public.jobs j ON j.id = e.job_id
    WHERE e.id = p_employee_id AND coalesce(e.is_active, true) = true
      AND (trim(coalesce(j.job_name, e.role, '')) = 'مسجل' OR trim(coalesce(e.role, '')) = 'Admin')
  ) THEN
    RAISE EXCEPTION 'غير مصرح لك بمراجعة طلبات التسجيل';
  END IF;
  RETURN QUERY SELECT * FROM public.student_registration_manual_reviews ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_student_registration_manual_review(
  p_request_id uuid,
  p_employee_id bigint,
  p_decision text,
  p_note text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_request public.student_registration_manual_reviews%ROWTYPE;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'قرار المراجعة غير صالح'; END IF;
  IF p_decision = 'rejected' AND nullif(trim(p_note), '') IS NULL THEN RAISE EXCEPTION 'سبب الرفض مطلوب'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    LEFT JOIN public.jobs j ON j.id = e.job_id
    WHERE e.id = p_employee_id AND coalesce(e.is_active, true) = true
      AND (trim(coalesce(j.job_name, e.role, '')) = 'مسجل' OR trim(coalesce(e.role, '')) = 'Admin')
  ) THEN RAISE EXCEPTION 'غير مصرح لك بمراجعة طلبات التسجيل'; END IF;

  SELECT * INTO v_request FROM public.student_registration_manual_reviews
  WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'طلب المراجعة غير موجود'; END IF;
  IF v_request.status <> 'pending' THEN RAISE EXCEPTION 'تمت مراجعة هذا الطلب مسبقًا'; END IF;

  UPDATE public.student_registration_manual_reviews
  SET status = p_decision,
      reviewer_employee_id = p_employee_id,
      reviewer_note = nullif(trim(p_note), ''),
      reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  UPDATE public.students
  SET biometric_status = CASE WHEN p_decision = 'approved' THEN 'manual_review_approved' ELSE 'manual_review_rejected' END,
      is_active = (p_decision = 'approved')
  WHERE trim(national_id::text) = trim(v_request.national_id)
    AND academic_year = v_request.academic_year
    AND registration_cycle = v_request.registration_cycle;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_student_registration_manual_review(text, integer, integer, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_student_registration_manual_reviews(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_student_registration_manual_review(uuid, bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_student_registration_manual_review(text, integer, integer, text, text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_student_registration_manual_reviews(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_student_registration_manual_review(uuid, bigint, text, text) TO anon, authenticated;
