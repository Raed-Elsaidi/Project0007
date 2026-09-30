import { useEffect, useState } from 'react';

const CACHE_KEY = 'currentInstitutionData';
const CURRENT_ID_KEY = 'currentInstitutionId';

export async function fetchCurrentInstitution(supabase) {
  if (!supabase) return null;

  const storedId = Number(
    window.localStorage.getItem(CURRENT_ID_KEY)
  );

  if (!Number.isFinite(storedId) || storedId <= 0) {
    console.warn('No current institution selected.');
    return null;
  }

  const { data, error } = await supabase
    .from('institutions')
    .select('*')
    .eq('id', storedId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(
      'Institution loading warning:',
      error.message
    );
    return null;
  }

  if (!data) {
    console.warn('Selected institution was not found.');
    return null;
  }

  window.localStorage.setItem(
    CURRENT_ID_KEY,
    String(data.id)
  );

  window.localStorage.setItem(
    CACHE_KEY,
    JSON.stringify(data)
  );

  return data;
}

export function useInstitution(supabase) {
  const [institution, setInstitution] = useState(() => {
    try {
      const cached =
        window.localStorage.getItem(CACHE_KEY);

      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let cancelled = false;

    fetchCurrentInstitution(supabase).then((data) => {
      if (!cancelled && data) {
        setInstitution(data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return institution;
}

export function institutionName(institution) {
  return (
    institution?.name_line_1 ||
    institution?.name ||
    institution?.official_name ||
    'اسم المؤسسة'
  );
}

export function institutionLogo(institution) {
  return institution?.logo_url || '';
}