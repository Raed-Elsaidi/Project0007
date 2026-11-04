-- Manual registrar review for failed pre-exam face verification.
-- Run this migration in Supabase SQL Editor before deploying either portal.

-- Live image is stored as a compressed data URL in this protected review table.
-- No public Storage bucket or public image URL is created.

CREATE TABLE IF NOT EXISTS public.exam_biometric_manual_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id integer NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  exam_id bigint,
  session_id text NOT NULL UNIQUE,
  live_image_data_url text NOT NULL,
  distance numeric,
  threshold numeric,
  match_score numeric,
  failure_reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_employee_id bigint REFERENCES public.employees(id),
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exam_bio_manual_status_created
  ON public.exam_biometric_manual_reviews(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_bio_manual_student
  ON public.exam_biometric_manual_reviews(student_id, created_at DESC);
ALTER TABLE public.exam_biometric_manual_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exam_biometric_manual_reviews FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exam_biometric_manual_reviews TO service_role;

CREATE OR REPLACE FUNCTION public.submit_exam_biometric_manual_review(
  p_student_id integer, p_exam_id bigint, p_session_id text,
  p_live_image_data_url text, p_distance numeric, p_threshold numeric,
  p_match_score numeric, p_failure_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF p_student_id IS NULL OR nullif(trim(p_session_id),'') IS NULL
     OR nullif(trim(p_live_image_data_url),'') IS NULL THEN
    RAISE EXCEPTION 'بيانات طلب مراجعة الوجه غير مكتملة';
  END IF;
  IF p_live_image_data_url NOT LIKE 'data:image/jpeg;base64,%' OR length(p_live_image_data_url) > 1200000 THEN
    RAISE EXCEPTION 'صيغة صورة المحاولة غير صحيحة أو حجمها كبير';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id=p_student_id) THEN
    RAISE EXCEPTION 'الطالب غير موجود';
  END IF;
  INSERT INTO public.exam_biometric_manual_reviews(
    student_id,exam_id,session_id,live_image_data_url,distance,threshold,match_score,failure_reason
  ) VALUES (
    p_student_id,p_exam_id,trim(p_session_id),p_live_image_data_url,p_distance,p_threshold,p_match_score,p_failure_reason
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_exam_biometric_manual_review(integer,bigint,text,text,numeric,numeric,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_exam_biometric_manual_review(integer,bigint,text,text,numeric,numeric,numeric,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_exam_biometric_manual_reviews(p_employee_id bigint)
RETURNS TABLE(
 id uuid,student_id integer,national_id text,student_name text,exam_id bigint,exam_title text,
 live_image_data_url text,personal_image_url text,distance numeric,threshold numeric,match_score numeric,
 failure_reason text,status text,reviewer_note text,created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.employees e
   WHERE e.id=p_employee_id AND e.is_active IS DISTINCT FROM false
     AND (e.job_id=9 OR lower(coalesce(e.role,'')) IN ('admin','administrator','manager'))
 ) THEN RAISE EXCEPTION 'ليس لديك صلاحية مراجعة محاولات التحقق البيومتري'; END IF;
 RETURN QUERY
 SELECT r.id,r.student_id,s.national_id::text,
        coalesce(s.full_name_ar,s.full_name_en,'')::text,
        r.exam_id,coalesce(to_jsonb(ex)->>'title',to_jsonb(ex)->>'exam_name','')::text,
        r.live_image_data_url,s.personal_image_url,r.distance,r.threshold,r.match_score,
        r.failure_reason,r.status,r.reviewer_note,r.created_at
 FROM public.exam_biometric_manual_reviews r
 JOIN public.students s ON s.id=r.student_id
 LEFT JOIN public.exams ex ON ex.id=r.exam_id
 ORDER BY CASE WHEN r.status='pending' THEN 0 ELSE 1 END,r.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.list_exam_biometric_manual_reviews(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_exam_biometric_manual_reviews(bigint) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.review_exam_biometric_manual_review(
 p_request_id uuid,p_employee_id bigint,p_decision text,p_note text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
 IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'قرار غير صالح'; END IF;
 IF p_decision='rejected' AND nullif(trim(p_note),'') IS NULL THEN RAISE EXCEPTION 'سبب الرفض مطلوب'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.employees e
   WHERE e.id=p_employee_id AND e.is_active IS DISTINCT FROM false
     AND (e.job_id=9 OR lower(coalesce(e.role,'')) IN ('admin','administrator','manager'))
 ) THEN RAISE EXCEPTION 'ليس لديك صلاحية مراجعة محاولات التحقق البيومتري'; END IF;
 UPDATE public.exam_biometric_manual_reviews
 SET status=p_decision,reviewer_employee_id=p_employee_id,reviewer_note=nullif(trim(p_note),''),reviewed_at=now()
 WHERE id=p_request_id AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود أو تمت مراجعته مسبقًا'; END IF;
 -- Reflect the registrar's decision in the original attempt audit row.
 UPDATE public.exam_biometric_verifications v
 SET verified=(p_decision='approved'),
     failure_reason=CASE WHEN p_decision='approved' THEN 'تم اعتماد التحقق يدويًا من المسجّل' ELSE coalesce(nullif(trim(p_note),''),'رفض المسجّل التحقق اليدوي') END
 WHERE v.session_id=(SELECT r.session_id FROM public.exam_biometric_manual_reviews r WHERE r.id=p_request_id);
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.review_exam_biometric_manual_review(uuid,bigint,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_exam_biometric_manual_review(uuid,bigint,text,text) TO authenticated, anon;


-- Student may poll using the unpredictable session UUID generated for this attempt.
CREATE OR REPLACE FUNCTION public.get_exam_biometric_manual_review_status(p_session_id text)
RETURNS TABLE(status text, reviewer_note text)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
 SELECT r.status,r.reviewer_note
 FROM public.exam_biometric_manual_reviews r
 WHERE r.session_id=trim(p_session_id)
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_exam_biometric_manual_review_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_exam_biometric_manual_review_status(text) TO anon, authenticated;
