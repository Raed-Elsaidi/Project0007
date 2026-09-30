import { useEffect, useState } from 'react';

const CACHE_KEY = 'currentInstitutionData';

export async function fetchCurrentInstitution(supabase) {
  if (!supabase) return null;
  const storedId = Number(window.localStorage.getItem('currentInstitutionId'));
  // المصدر الموحد لبيانات الهوية المؤسسية هو سجل "إدارة المؤسسة" الحالي.
  // نستخدم currentInstitutionId الذي تحفظه شاشة إدارة المؤسسة، ثم كود المؤسسة 01 كاحتياط.
  let query = supabase.from('institutions').select('*');
  if (Number.isFinite(storedId) && storedId > 0) {
    query = query.eq('id', storedId);
  } else {
    query = query.eq('institution_code', '01');
  }
  let { data, error } = await query.limit(1).maybeSingle();

  // احتياط أخير فقط إذا لم يوجد السجل المحدد.
  if (!data && !error) {
    const fallback = await supabase
      .from('institutions')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) {
    console.warn('Institution loading warning:', error.message);
    return null;
  }
  if (data) {
    window.localStorage.setItem('currentInstitutionId', String(data.id));
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  }
  return data || null;
}

export function useInstitution(supabase) {
  const [institution, setInstitution] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let cancelled = false;
    fetchCurrentInstitution(supabase).then((data) => {
      if (!cancelled && data) setInstitution(data);
    });
    return () => { cancelled = true; };
  }, [supabase]);

  return institution;
}

export function institutionName(institution) {
  return institution?.name_line_1 || institution?.name || institution?.official_name || 'اسم المؤسسة';
}

export function institutionLogo(institution) {
  return institution?.logo_url || '';
}
