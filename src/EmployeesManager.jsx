import React, { useEffect, useMemo, useState } from 'react';
import { validatePasswordPolicy, PASSWORD_POLICY_MESSAGE } from './passwordPolicy';

const EMPTY_FORM = {
  full_name: '',
  username: '',
  password: '',
  national_id: '',
  gender: '',
  nationality: 'فلسطيني',
  birth_date: '',
  birth_place: '',
  workplace: '',
  specialization: '',
  health: 'جيدة جدا',
  address: '',
  phone: '',
  whatsapp_number: '',
  email: '',
  employee_number: '',
  directorate_id: '',
  school_id: '',
  branch_id: '',
  subject_id: '',
  job_id: '',
  is_active: true
};

const FORM_ROWS = [
  [
    ['full_name', 'الاسم بالعربية', true],
    ['national_id', 'رقم الهوية', false],
    ['employee_number', 'الرقم الوظيفي', false],
    ['gender', 'الجنس', false]
  ],
  [
    ['nationality', 'الجنسية', false],
    ['birth_place', 'مكان الميلاد', false],
    ['birth_date', 'تاريخ الميلاد', false],
    ['workplace', 'مكان العمل', false],
    ['specialization', 'التخصص', false],
    ['health', 'الحالة الصحية', false]
  ],
  [
    ['address', 'العنوان', false],
    ['phone', 'رقم الهاتف', false],
    ['whatsapp_number', 'رقم الواتس', false],
    ['email', 'الإيميل', false]
  ]
];

function normalizeDate(value) {
  return value ? String(value).slice(0, 10) : '';
}

function safeErrorMessage(error) {
  return error?.message || error?.details || 'حدث خطأ غير متوقع.';
}

function formatEmployeeName(fullName, isManager) {
  const trimmed = String(fullName || '').trim();
  if (!trimmed) return '—';
  if (!isManager) return trimmed;

  const parts = trimmed.split(/\s+/);
  if (parts.length <= 1) return trimmed;

  const firstName = parts[0];
  const secondInitial = parts[1] ? parts[1][0] : '';
  const thirdInitial = parts[2] ? parts[2][0] : '';
  const fourthName = parts.length >= 4 ? parts[3] : '';

  return [firstName, secondInitial, thirdInitial, fourthName].filter(Boolean).join(' ');
}

export default function EmployeesManager({
  supabase,
  styles = {},
  institutionId = null,
  isInstitutionManager = false,
}) {
  const [employees, setEmployees] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [directorates, setDirectorates] = useState([]);
  const [schools, setSchools] = useState([]);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [messageModal, setMessageModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isHeartbeatActive, setIsHeartbeatActive] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editUnlocked, setEditUnlocked] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState(null);
  const [profileMode, setProfileMode] = useState(false);

  // جميع رسائل العمليات تظهر داخل واجهة النظام في منتصف الشاشة،
  // جميع رسائل العمليات تظهر داخل نافذة النظام المركزية.
  const notify = (message, type = 'success') => {
    openMessage(message, type);
  };

  const loadData = async () => {
    if (!supabase) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const [employeesResult, jobsResult, branchesResult, subjectsResult, directoratesResult, schoolsResult] =
        await Promise.all([
          (() => {
            let query = supabase
              .from('employees')
              .select(`
                *,
                jobs:job_id (id, job_name)
              `)
              .order('id', { ascending: false });

            if (isInstitutionManager && Number(institutionId) > 0) {
              query = query.eq('institution_id', Number(institutionId));
            }

            return query;
          })(),

          supabase
            .from('jobs')
            .select('id, job_name, is_active')
            .order('id'),

          supabase
            .from('branches')
            .select('*')
            .order('id'),

          supabase
            .from('subjects')
            .select('*')
            .order('id'),

          supabase
            .from('directorates')
            .select('*')
            .eq('is_active', true)
            .order('directorate_name', { ascending: true }),

          supabase
            .from('schools')
            .select('*')
            .eq('is_active', true)
            .order('school_name', { ascending: true })
        ]);

      if (employeesResult.error) throw employeesResult.error;
      if (jobsResult.error) throw jobsResult.error;
      if (branchesResult.error) throw branchesResult.error;
      if (subjectsResult.error) throw subjectsResult.error;
      if (directoratesResult.error) throw directoratesResult.error;
      if (schoolsResult.error) throw schoolsResult.error;

      setEmployees(employeesResult.data || []);
      let loadedJobs = jobsResult.data || [];
      if (!loadedJobs.some((job) => String(job.job_name || '').trim() === 'دعم فني')) {
        const { data: supportJob, error: supportJobError } = await supabase
          .from('jobs')
          .insert({ job_name: 'دعم فني', is_active: true })
          .select('id, job_name, is_active')
          .maybeSingle();
        if (!supportJobError && supportJob) loadedJobs = [...loadedJobs, supportJob];
      }
      setJobs(loadedJobs);
      setBranches(branchesResult.data || []);
      setSubjects(subjectsResult.data || []);
      setDirectorates(directoratesResult.data || []);
      setSchools(schoolsResult.data || []);
    } catch (error) {
      console.error('EmployeesManager load error:', error);
      openMessage(safeErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supabase, institutionId, isInstitutionManager]);

  useEffect(() => {
    if (!supabase) return;

    const currentUserId = window.localStorage.getItem('currentUserId');
    const currentUsername = window.localStorage.getItem('currentUsername');

    if (!currentUserId && !currentUsername) return;

    let cancelled = false;

    const heartbeat = async () => {
      try {
        const now = new Date().toISOString();
        let targetId = currentUserId ? Number(currentUserId) : null;

        if (!targetId && currentUsername) {
          const { data, error } = await supabase
            .from('employees')
            .select('id')
            .eq('username', currentUsername)
            .maybeSingle();

          if (error) throw error;
          targetId = data?.id || null;
        }

        if (!targetId) {
          throw new Error('لم يتم العثور على الموظف الحالي في employees.');
        }

        const { error } = await supabase
          .from('employees')
          .update({ is_online: true, last_seen: now })
          .eq('id', targetId);

        if (error) throw error;

        if (!cancelled) {
          setIsHeartbeatActive(true);
          setEmployees((current) =>
            current.map((employee) =>
              Number(employee.id) === Number(targetId)
                ? { ...employee, is_online: true, last_seen: now }
                : employee
            )
          );
        }
      } catch (error) {
        console.error('EmployeesManager heartbeat error:', error);
        if (!cancelled) setIsHeartbeatActive(false);
      }
    };

    heartbeat();

    // نبض كل 20 ثانية حتى لا يفقد المستخدم حالة "متواجد"
    // بسبب تأخير مؤقت في المتصفح.
    const heartbeatTimer = window.setInterval(heartbeat, 20000);

    // إعادة التحديث عند الرجوع للنافذة.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        heartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [supabase]);

  const getJobName = (employee) =>
    employee?.jobs?.job_name ||
    jobs.find((job) => Number(job.id) === Number(employee?.job_id))?.job_name ||
    'غير محدد';

  const getCurrentSession = () => {
    const id = window.localStorage.getItem('currentUserId');
    const username = window.localStorage.getItem('currentUsername');
    const jobId = window.localStorage.getItem('currentJobId');
    const role = window.localStorage.getItem('currentUserRole');
    return {
      id: id ? Number(id) : null,
      username: username || '',
      jobId: jobId ? Number(jobId) : null,
      role: role || ''
    };
  };

  const session = getCurrentSession();
  const currentEmployee = useMemo(() => {
    if (session.id) {
      const byId = employees.find((employee) => Number(employee.id) === session.id);
      if (byId) return byId;
    }

    if (session.username) {
      return employees.find(
        (employee) => String(employee.username || '').toLowerCase() === session.username.toLowerCase()
      ) || null;
    }

    return null;
  }, [employees, session.id, session.username]);

  const isManager =
    Number(currentEmployee?.job_id || session.jobId) === 1 ||
    ['admin', 'مدير'].includes(String(currentEmployee?.role || session.role || '').trim().toLowerCase()) ||
    String(getJobName(currentEmployee) || '').trim() === 'مدير';

  const canManageInstitutionEmployees = isManager || isInstitutionManager;

  const getBranchName = (employee) => {
    const branch = branches.find(
      (item) => Number(item.id) === Number(employee?.branch_id)
    );
    return (
      branch?.name ||
      branch?.branch_name ||
      branch?.title ||
      `فرع #${employee?.branch_id || '-'}`
    );
  };

  const getSubjectName = (employee) => {
    const subject = subjects.find(
      (item) => Number(item.id) === Number(employee?.subject_id)
    );
    return (
      subject?.name ||
      subject?.subject_name ||
      subject?.title ||
      `مادة #${employee?.subject_id || '-'}`
    );
  };

  // المادة تتغير حسب الفرع المختار فقط.
  const availableSubjects = useMemo(() => {
    if (!form.branch_id) return [];

    const selectedBranchId = Number(form.branch_id);

    return subjects.filter((subject) => {
      const subjectBranchId =
        subject.branch_id ??
        subject.branchId ??
        subject.branch;

      // إذا كانت المادة مرتبطة بفرع، نعرض مواد الفرع فقط.
      // المواد القديمة غير المرتبطة بفرع لا تظهر عند اختيار فرع.
      return (
        subjectBranchId !== undefined &&
        subjectBranchId !== null &&
        subjectBranchId !== '' &&
        Number(subjectBranchId) === selectedBranchId
      );
    });
  }, [subjects, form.branch_id]);

  const availableSchools = useMemo(() => {
    if (!form.directorate_id) return [];
    return schools
      .filter((school) => Number(school.directorate_id) === Number(form.directorate_id))
      .sort((a, b) =>
        String(a.school_name || '').localeCompare(String(b.school_name || ''), 'ar', {
          sensitivity: 'base',
          numeric: true
        })
      );
  }, [schools, form.directorate_id]);

  const getDirectorateName = (employee) => {
    const row = directorates.find((item) => Number(item.id) === Number(employee?.directorate_id));
    return row?.directorate_name || employee?.directorate_name || '—';
  };

  const getSchoolName = (employee) => {
    const row = schools.find((item) => Number(item.id) === Number(employee?.school_id));
    return row?.school_name || employee?.school_name || '—';
  };

  // المتواجد حاليًا يعتمد فقط على تاريخ ووقت "آخر مشاهدة".
  // إذا كانت آخر مشاهدة خلال آخر دقيقة فهو "متواجد"،
  // وإذا تجاوزت دقيقة واحدة فهو "غير متواجد".
  const isCurrentlyOnline = (employee) => {
    if (!employee?.last_seen) return false;

    const lastSeen = new Date(employee.last_seen).getTime();
    if (Number.isNaN(lastSeen)) return false;

    const elapsed = Date.now() - lastSeen;

    // نتعامل مع وقت مستقبلي بسيط كمتواجد أيضًا، بسبب فرق الساعة
    // بين جهاز المستخدم وقاعدة البيانات.
    return elapsed <= 60 * 1000;
  };

  const openMessage = (message, type = 'success') => {
    setMessageModal({ message, type });
  };

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('employees-manager-live')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'employees'
        },
        (payload) => {
          setEmployees((current) =>
            current.map((employee) =>
              employee.id === payload.new.id
                ? { ...employee, ...payload.new }
                : employee
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees
      .filter((employee) => {
        // البحث حسب: اسم الموظف أو رقم الهوية أو الرقم الوظيفي فقط.
        const matchesSearch =
          !query ||
          [
            employee.full_name,
            employee.national_id,
            employee.employee_number
          ]
            .filter(Boolean)
            .some((value) =>
              String(value).toLowerCase().includes(query)
            );

        const matchesJob =
          !jobFilter || Number(employee.job_id) === Number(jobFilter);

        const matchesBranch =
          !branchFilter ||
          Number(employee.branch_id) === Number(branchFilter);

        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active' && employee.is_active !== false) ||
          (statusFilter === 'inactive' && employee.is_active === false) ||
          (statusFilter === 'online' && isCurrentlyOnline(employee));

        return (
          matchesSearch &&
          matchesJob &&
          matchesBranch &&
          matchesStatus
        );
      })
      .sort((a, b) => {
        // المدير يكون أولاً، ثم باقي الموظفين أبجديًا حسب اسم الموظف.
        const aIsManager =
          Number(a?.job_id) === 1 ||
          String(getJobName(a) || '').trim() === 'مدير';
        const bIsManager =
          Number(b?.job_id) === 1 ||
          String(getJobName(b) || '').trim() === 'مدير';

        if (aIsManager !== bIsManager) {
          return aIsManager ? -1 : 1;
        }

        return String(a.full_name || '').localeCompare(
          String(b.full_name || ''),
          'ar',
          { sensitivity: 'base', numeric: true }
        );
      });
  }, [
    employees,
    search,
    jobFilter,
    branchFilter,
    statusFilter
  ]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setErrorMessage('');
    setEditUnlocked(false);
    setEditSnapshot(null);
    setProfileMode(false);
  };

  const startAdd = () => {
    setShowPassword(false);
    setErrorMessage('');
    setSelectedEmployee(null);
    setProfileMode(false);
    setForm({
      ...EMPTY_FORM,
      nationality: 'فلسطيني',
    });
    setEditingId(null);
    setEditUnlocked(true);
    setEditSnapshot(null);
    setShowForm(true);
  };

  const startEdit = (employee) => {
    setProfileMode(false);
    setShowPassword(false);
    setErrorMessage('');
    setEditingId(employee.id);
    setEditUnlocked(false);

    const nextForm = {
      ...EMPTY_FORM,
      ...employee,
      password: '',
      birth_date: normalizeDate(employee.birth_date),
      directorate_id: employee.directorate_id ?? '',
      school_id: employee.school_id ?? '',
      branch_id: employee.branch_id ?? '',
      subject_id: employee.subject_id ?? '',
      job_id: employee.job_id ?? '',
      health: employee.health || 'جيدة جدا',
      is_active: employee.is_active !== false
    };

    setForm(nextForm);
    setEditSnapshot(nextForm);
    setShowForm(true);
    setSelectedEmployee(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startProfileEdit = () => {
    if (!currentEmployee) return;
    setProfileMode(true);
    setShowPassword(false);
    setErrorMessage('');
    setEditingId(currentEmployee.id);
    setEditUnlocked(false);

    const nextForm = {
      ...EMPTY_FORM,
      ...currentEmployee,
      password: '',
      birth_date: normalizeDate(currentEmployee.birth_date),
      directorate_id: currentEmployee.directorate_id ?? '',
      school_id: currentEmployee.school_id ?? '',
      branch_id: currentEmployee.branch_id ?? '',
      subject_id: currentEmployee.subject_id ?? '',
      job_id: currentEmployee.job_id ?? '',
      health: currentEmployee.health || 'جيدة جدا',
      is_active: currentEmployee.is_active !== false
    };

    setForm(nextForm);
    setEditSnapshot(nextForm);
    setShowForm(true);
  };

  const updateField = (field, value) => {
    if (editingId && !editUnlocked) return;

    // رقم الهوية: أرقام فقط وبحد أقصى 9 خانات.
    if (field === 'national_id') {
      value = String(value ?? '').replace(/\D/g, '').slice(0, 9);
    }

    setForm((current) => {
      const next = { ...current, [field]: value };

      // عند تغيير الفرع، نمسح المادة القديمة إذا لم تعد ضمن مواد الفرع.
      if (field === 'directorate_id') {
        next.school_id = '';
      }

      if (field === 'branch_id') {
        next.subject_id = '';
      }

      return next;
    });
  };

  const hasEditChanges = useMemo(() => {
    if (!editingId || !editSnapshot) return false;
    const fields = Object.keys(EMPTY_FORM);
    return fields.some((field) => String(form[field] ?? '') !== String(editSnapshot[field] ?? ''));
  }, [editingId, editSnapshot, form]);

  const unlockEdit = () => {
    setEditUnlocked(true);
    setErrorMessage('');
  };

  const cancelEditChanges = () => {
    resetForm();
  };

  const saveEmployee = async (event) => {
    event.preventDefault();
    if (!supabase) return;

    if (!form.full_name.trim()) {
      openMessage('الاسم الكامل مطلوب.', 'warning');
      return;
    }

    if (!form.username.trim()) {
      openMessage('اسم المستخدم مطلوب.', 'warning');
      return;
    }

    if (!form.job_id) {
      openMessage('يجب اختيار الوظيفة.', 'warning');
      return;
    }

    if (!form.branch_id && form.subject_id) {
      openMessage('اختر الفرع أولًا ثم اختر المادة.', 'warning');
      return;
    }

    if (form.subject_id && !availableSubjects.some(
      (subject) => Number(subject.id) === Number(form.subject_id)
    )) {
      openMessage('المادة المختارة لا تتبع الفرع المحدد.', 'warning');
      return;
    }

    if (profileMode) {
      const sessionId = getCurrentSession().id;
      if (!sessionId || Number(editingId) !== Number(sessionId)) {
        openMessage('لا يمكن تعديل إلا بيانات الموظف المسجل دخوله.', 'warning');
        return;
      }
    }

    if (isInstitutionManager) {
      const selectedJob = jobs.find((job) => Number(job.id) === Number(form.job_id));
      const selectedJobName = String(selectedJob?.job_name || '').trim();
      if (selectedJobName === 'مدير' || selectedJobName === 'مدير المؤسسة') {
        openMessage('لا يمكن لمدير المؤسسة إنشاء أو تعيين مدير مؤسسة آخر.', 'warning');
        return;
      }
    }

    if (form.national_id && !/^\d{9}$/.test(form.national_id.trim())) {
      openMessage('رقم الهوية يجب أن يتكون من 9 أرقام فقط.', 'warning');
      return;
    }

    if (form.password.trim()) {
      const policy = validatePasswordPolicy(form.password.trim());
      if (!policy.valid) {
        openMessage(PASSWORD_POLICY_MESSAGE, 'warning');
        return;
      }
    }

    setSaving(true);
    setErrorMessage('');

    try {
      const payload = {
        full_name: form.full_name.trim(),
        national_id: form.national_id?.trim() || null,
        gender: form.gender || null,
        nationality: form.nationality?.trim() || 'فلسطيني',
        birth_date: form.birth_date || null,
        birth_place: form.birth_place?.trim() || null,
        workplace: form.workplace?.trim() || null,
        specialization: form.specialization?.trim() || null,
        health: form.health || 'جيدة جدا',
        address: form.address?.trim() || null,
        phone: form.phone?.trim() || null,
        whatsapp_number: form.whatsapp_number?.trim() || null,
        email: form.email?.trim() || null,
        employee_number: form.employee_number?.trim() || null,
        directorate_id: form.directorate_id ? Number(form.directorate_id) : null,
        school_id: form.school_id ? Number(form.school_id) : null,
        branch_id: form.branch_id ? Number(form.branch_id) : null,
        subject_id: form.subject_id ? Number(form.subject_id) : null,
        job_id: Number(form.job_id),
        is_active: form.is_active !== false
      };

      if (isInstitutionManager && Number(institutionId) > 0) {
        payload.institution_id = Number(institutionId);
      }

      if (profileMode) {
        delete payload.job_id;
        delete payload.is_active;
      }

      if (editingId) {
        if (form.password.trim()) {
          payload.password = form.password;
        }

        const { error } = await supabase
          .from('employees')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        openMessage('تم تعديل بيانات الموظف بنجاح.', 'success');
      } else {
        if (!form.password.trim()) {
          openMessage('كلمة المرور مطلوبة عند إضافة موظف جديد.', 'warning');
          setSaving(false);
          return;
        }

        payload.username = form.username.trim();
        payload.password = form.password;

        const { error } = await supabase
          .from('employees')
          .insert(payload);

        if (error) throw error;
        notify('تمت إضافة الموظف بنجاح.');
      }

      resetForm();
      await loadData();
    } catch (error) {
      console.error('EmployeesManager save error:', error);
      openMessage(safeErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (employee) => {
    if (!supabase) return;

    const nextValue = employee.is_active === false;

    try {
      const { error } = await supabase
        .from('employees')
        .update({
          is_active: nextValue,
          ...(nextValue ? {} : { is_online: false })
        })
        .eq('id', employee.id);

      if (error) throw error;

      openMessage(
        nextValue ? 'تم تفعيل الموظف بنجاح.' : 'تم تعطيل الموظف بنجاح.',
        nextValue ? 'success' : 'warning'
      );
      await loadData();
    } catch (error) {
      console.error('EmployeesManager toggle error:', error);
      openMessage(safeErrorMessage(error), 'error');
    }
  };

  const deleteEmployee = async (employee) => {
    if (!supabase || !employee) return;

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employee.id);

      if (error) throw error;

      openMessage('تم حذف الموظف بنجاح.', 'success');

      if (selectedEmployee?.id === employee.id) {
        setSelectedEmployee(null);
      }

      await loadData();
    } catch (error) {
      console.error('EmployeesManager delete error:', error);
      openMessage(`تعذر حذف الموظف: ${safeErrorMessage(error)}`, 'error');
    } finally {
      setDeleteTarget(null);
    }
  };


  /**
   * إرسال بيانات الدخول.
   *
   * يحتاج المشروع إلى Supabase Edge Function باسم:
   * send-employee-credentials
   *
   * Body:
   * { employeeId }
   *
   * لا يتم إرسال كلمة المرور من المتصفح إلى خدمة بريد خارجية.
   * يفضل أن تنفذ الـ Edge Function عملية الإرسال من الخادم.
   */


  const formatDateTime = (value) => {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, lineHeight: 1.35, direction: 'ltr' }}>
        <span>{date.toLocaleDateString('en-CA')}</span>
        <span>{date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
      </span>
    );
  };

  const formatLoginDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-CA');
  };

  const formatLoginTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : date.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
  };

  const activeCount = employees.filter(
    (item) => item.is_active !== false
  ).length;

  const onlineCount = employees.filter(isCurrentlyOnline).length;

  const inactiveCount = employees.length - activeCount;

  const jobEmployeeCounts = useMemo(() => {
    const counts = new Map();
    employees.forEach((employee) => {
      const jobId = employee?.job_id == null ? '' : String(employee.job_id);
      counts.set(jobId, (counts.get(jobId) || 0) + 1);
    });

    return jobs
      .map((job) => ({
        ...job,
        employeeCount: counts.get(String(job.id)) || 0,
      }))
      .sort((a, b) =>
        String(a.job_name || '').localeCompare(
          String(b.job_name || ''),
          'ar',
          { sensitivity: 'base' }
        )
      );
  }, [employees, jobs]);

  return (
    <div style={{ ...styles, direction: 'rtl' }}>
      <style>{`
        .employees-page {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          overflow-x: hidden;
          padding: clamp(10px, 2vw, 24px);
          color: #e5e7eb;
        }

        .employees-card {
          width: 100%;
          box-sizing: border-box;
          background: rgba(15, 23, 42, .94);
          border: 1px solid rgba(96, 165, 250, .42);
          border-radius: 16px;
          padding: clamp(12px, 1.8vw, 20px);
          box-shadow: 0 10px 28px rgba(0,0,0,.16);
          overflow: hidden;
        }


        .employees-section-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 12px;
          padding: 8px 12px;
          border: 1px solid rgba(56,189,248,.48);
          border-radius: 11px;
          background: linear-gradient(135deg, rgba(30,64,175,.28), rgba(14,116,144,.22));
          color: #e0f2fe;
          font-size: 16px;
          font-weight: 950;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
        }

        .employees-section-label .section-label-icon {
          font-size: 17px;
        }

        .employees-stats-card {
          border-color: rgba(56,189,248,.62) !important;
          box-shadow: 0 10px 28px rgba(2,6,23,.22), inset 0 1px 0 rgba(255,255,255,.035);
        }

        .employee-data-card {
          border-color: rgba(99,102,241,.62) !important;
          box-shadow: 0 10px 28px rgba(2,6,23,.22), inset 0 1px 0 rgba(255,255,255,.035);
        }

        .employee-add-form-card {
          border-color: rgba(34,211,238,.72) !important;
          box-shadow: 0 18px 55px rgba(2,6,23,.34), inset 0 1px 0 rgba(255,255,255,.05);
        }

        .employees-title {
          margin: 0;
          font-size: clamp(20px, 2.2vw, 28px);
          font-weight: 900;
        }

        .employees-subtitle {
          margin: 6px 0 0;
          opacity: .70;
          font-size: 13px;
        }

        .employees-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 16px;
        }

        .employee-stat {
          min-width: 0;
          border-radius: 12px;
          padding: 12px;
          background: rgba(30, 41, 59, .65);
          border: 1px solid rgba(148,163,184,.12);
          text-align: center; /* توسيط النص والأرقام داخل المربع */
        }

        .employee-stat-value {
          display: block;
          margin-top: 3px;
          font-size: 22px;
          font-weight: 900;
          text-align: center; /* توسيط القيمة */
        }

        .employees-job-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 9px;
          margin-top: 10px;
        }

        .employee-job-stat {
          min-width: 0;
          border-radius: 12px;
          padding: 10px 12px;
          background: linear-gradient(135deg, rgba(30,64,175,.30), rgba(14,116,144,.20));
          border: 1px solid rgba(96,165,250,.28);
          text-align: center;
        }

        .employee-job-stat-name {
          display: block;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .employee-job-stat-count {
          display: block;
          margin-top: 3px;
          font-size: 20px;
          font-weight: 950;
          line-height: 1.1;
        }

        .employee-form-grid {
          display: grid;
          gap: 14px;
        }

        .employee-form-grid-ordered {
          width: 100%;
        }

        .employee-form-row-five,
        .employee-form-row-six {
          display: grid;
          width: 100%;
          align-items: end;
          gap: 12px;
        }

        .employee-form-row-1 {
          grid-template-columns: 1.45fr 1.15fr 1.05fr .82fr .95fr;
        }

        .employee-form-row-2 {
          grid-template-columns: .95fr 1.05fr 1fr 1fr 1.35fr 1.35fr;
        }

        .employee-form-row-3 {
          grid-template-columns: .95fr 1.45fr 1.15fr 1.55fr 1.25fr;
        }

        .employee-form-row-4 {
          grid-template-columns: 1.05fr 1.15fr 1.05fr 1.25fr 1.55fr;
        }

        /* إطار مستقل لكل صف بلون مختلف، مع الحفاظ على اختلاف عرض الخانات */
        .employee-form-row-1,
        .employee-form-row-2,
        .employee-form-row-3,
        .employee-form-row-4 {
          padding: 12px;
          border-radius: 16px;
          border: 1.5px solid;
          box-sizing: border-box;
        }

        .employee-form-row-1 {
          border-color: rgba(56,189,248,.72);
          background: rgba(14,116,144,.07);
        }
        .employee-form-row-2 {
          border-color: rgba(168,85,247,.72);
          background: rgba(126,34,206,.06);
        }
        .employee-form-row-3 {
          border-color: rgba(34,197,94,.72);
          background: rgba(21,128,61,.06);
        }
        .employee-form-row-4 {
          border-color: rgba(245,158,11,.78);
          background: rgba(180,83,9,.06);
        }

        .employee-form-row-1 .employee-input { border-color: rgba(56,189,248,.62) !important; }
        .employee-form-row-2 .employee-input { border-color: rgba(168,85,247,.62) !important; }
        .employee-form-row-3 .employee-input { border-color: rgba(34,197,94,.62) !important; }
        .employee-form-row-4 .employee-input { border-color: rgba(245,158,11,.65) !important; }

        .employee-form-row-1 .employee-label { color: #bae6fd; }
        .employee-form-row-2 .employee-label { color: #e9d5ff; }
        .employee-form-row-3 .employee-label { color: #bbf7d0; }
        .employee-form-row-4 .employee-label { color: #fde68a; }

        .employee-field {
          min-width: 0;
        }

        .employee-field.wide {
          grid-column: span 2;
        }

        .employee-label {
          display: block;
          margin-bottom: 6px;
          font-size: 13px;
          font-weight: 800;
        }

        .employee-form-grid .employee-input {
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }

        .employee-form-grid .employee-label {
          white-space: nowrap;
        }

                .employee-search-input {
          border-color: rgba(96,165,250,.62) !important;
          background: linear-gradient(180deg, rgba(15,23,42,.82), rgba(30,41,59,.66)) !important;
          font-size: 14px;
          font-weight: 900;
        }

        .employee-search-label {
          display: block;
          margin: 0 0 7px;
          color: #e0f2fe;
          font-size: 15px;
          font-weight: 950;
          text-align: right;
        }

        .employee-input {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          padding: 10px 11px;
          border-radius: 9px;
          border: 1px solid #334155;
          background: #0b1729;
          color: #f8fafc;
          outline: none;
        }

        .employee-input:disabled {
          opacity: .82;
          cursor: not-allowed;
          background: rgba(15,23,42,.62);
        }

        .employee-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,.12);
        }

        .employee-filters {
          display: grid;
          grid-template-columns: minmax(300px, 2.35fr) repeat(3, minmax(140px, 1fr));
          gap: 12px;
          align-items: end;
          direction: rtl;
          width: 100%;
          padding: 15px;
          box-sizing: border-box;
          border-radius: 16px;
          border: 1px solid rgba(56,189,248,.58);
          background: linear-gradient(135deg, rgba(8,20,45,.94), rgba(20,52,92,.82));
          outline: 1px solid rgba(59,130,246,.12);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 10px 24px rgba(2,6,23,.20);
        }

        .employee-filter-box {
          min-width: 0;
        }

        .employee-filter-label {
          display: block;
          margin: 0 0 7px;
          color: #e0f2fe;
          font-size: 15px;
          font-weight: 950;
          text-align: right;
        }

        .employee-filter-select {
          width: 100%;
          min-height: 44px;
          box-sizing: border-box;
          font-size: 15px !important;
          font-weight: 900 !important;
          color: #f8fafc !important;
          border: 1px solid rgba(96,165,250,.72) !important;
          background: linear-gradient(180deg, rgba(15,35,70,.96), rgba(24,58,100,.84)) !important;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.025), 0 5px 14px rgba(2,6,23,.14);
        }

        .employee-filter-search-box {
          min-width: 0;
        }

        .employee-search-box {
          position: relative;
          width: 100%;
        }

        .employee-search-icon {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 2;
          font-size: 16px;
          pointer-events: none;
        }

        .employee-search-input {
          width: 100% !important;
          min-height: 44px;
          box-sizing: border-box;
          padding-right: 39px !important;
          font-size: 16px !important;
          font-weight: 900 !important;
          color: #f8fafc !important;
          border: 1px solid rgba(34,211,238,.82) !important;
          border-radius: 11px;
          background: linear-gradient(180deg, rgba(15,23,42,.92), rgba(30,41,59,.78)) !important;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.025), 0 6px 18px rgba(2,6,23,.16);
        }

        .employee-search-input::placeholder {
          color: #cbd5e1;
          opacity: .95;
          font-weight: 800;
        }

        .employee-filter-status-box .employee-filter-select {
          min-width: 0;
          padding-left: 7px;
          padding-right: 7px;
        }


        /* توحيد لون خط جميع القوائم المنسدلة */
        select.employee-input,
        select.employee-filter-select,
        select {
          color: #e2e8f0 !important;
          background: linear-gradient(180deg, rgba(15,35,70,.96), rgba(24,58,100,.84)) !important;
          font-weight: 900 !important;
        }

        select.employee-input option,
        select.employee-filter-select option,
        select option {
          color: #e2e8f0 !important;
          background: #172554 !important;
          font-weight: 800 !important;
        }

        select.employee-input option:checked,
        select.employee-filter-select option:checked,
        select option:checked {
          color: #ffffff !important;
          background: #2563eb !important;
          font-weight: 950 !important;
        }

        /* لون نص سهم القائمة ومظهر القائمة */
        .employee-filter-select {
          color-scheme: dark;
          cursor: pointer;
        }

        .employee-filter-select:focus {
          color: #ffffff !important;
          border-color: #38bdf8 !important;
          outline: none;
          box-shadow: 0 0 0 3px rgba(56,189,248,.13) !important;
        }

        .employee-table-wrap {
          width: 100%;
          overflow: hidden;
        }

        /* تمرير رأسي داخل جدول الموظفين بعد ظهور 5 موظفين،
           مع تثبيت عنوان الأعمدة أثناء التمرير. */
        .employee-table-scroll {
          width: 100%;
          max-height: 294px;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: rgba(56,189,248,.72) rgba(15,23,42,.42);
          border-radius: 12px;
        }

        .employee-table-scroll::-webkit-scrollbar {
          width: 8px;
        }

        .employee-table-scroll::-webkit-scrollbar-track {
          background: rgba(15,23,42,.42);
          border-radius: 999px;
        }

        .employee-table-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(56,189,248,.88), rgba(37,99,235,.88));
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.12);
        }

        .employee-table-scroll .employee-table thead th {
          position: sticky;
          top: 0;
          z-index: 20;
          background: linear-gradient(180deg, #172554 0%, #0f1f3d 100%);
          box-shadow: 0 3px 10px rgba(2,6,23,.34);
        }

        .employee-table-scroll .employee-table tbody td {
          height: 50px;
        }

        .employee-table {
          width: calc(100% - 10px);
          margin-left: 10px;
          margin-right: 0;
          direction: rtl;
          table-layout: fixed;
          border-collapse: separate;
          border-spacing: 0;
          font-size: clamp(11px, .9vw, 13px);
        }

        .employee-table th,
        .employee-table td {
          padding: 9px 6px;
          border-bottom: 1px solid rgba(51,65,85,.58);
          text-align: center;
          vertical-align: middle;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* توزيع الأعمدة: مساحة كافية للحالة والاتصال والإجراءات بدون تداخل */
        .employee-table th,
        .employee-table td {
          box-sizing: border-box;
        }

        .employee-table th:nth-child(5),
        .employee-table td:nth-child(5) {
          padding-right: 12px;
          padding-left: 12px;
        }

        .employee-table th:nth-child(6),
        .employee-table td:nth-child(6) {
          padding-right: 10px;
          padding-left: 10px;
        }

        .employee-table th:nth-child(7),
        .employee-table td:nth-child(7) {
          padding-right: 10px;
          padding-left: 10px;
        }

        .employee-table .connection-column {
          white-space: nowrap;
          transform: translateX(5px);
        }

        .employee-table .status-column {
          width: 11%;
          min-width: 82px;
          white-space: nowrap;
          text-align: center;
          transform: translateX(8px);
          overflow: visible;
        }

        .employee-table th.status-column {
          padding-right: 8px;
          padding-left: 8px;
        }

        .employee-table td.status-column {
          padding-right: 8px;
          padding-left: 8px;
          overflow: visible;
        }

        .employee-status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 70px;
          max-width: 100%;
          min-height: 30px;
          padding: 4px 8px;
          box-sizing: border-box;
          border-radius: 999px;
          white-space: nowrap;
          overflow: visible;
        }

        /* تنسيق الاسم والوظيفة والاتصال والأزرار - تم تعديل محاذاة اسم الموظف لليمن */
        .employee-name-wrap {
          display: inline-flex;
          align-items: center;
          justify-content: flex-start; /* محاذاة لليمين */
          gap: 5px;
          max-width: 100%;
          width: 100%;
        }

        .employee-name {
          appearance: none;
          border: 0 !important;
          outline: none;
          background: transparent !important;
          box-shadow: none !important;
          color: #7dd3fc !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          text-decoration: underline;
          text-decoration-thickness: 1.5px;
          text-underline-offset: 4px;
          cursor: pointer;
          padding: 2px 0;
          line-height: 1.35;
          text-align: right !important; /* محاذاة النص لليمين */
          width: 100%;
          transition: transform .16s ease, color .16s ease;
        }

        .employee-name:hover {
          color: #bae6fd !important;
          transform: translateY(-3px);
        }

        .employee-name-edit-icon {
          color: #fbbf24;
          font-size: 14px;
          line-height: 1;
        }

        .job-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 66px;
          padding: 7px 13px;
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(124,58,237,.72), rgba(59,130,246,.72));
          border: 1px solid rgba(167,139,250,.72);
          color: #ffffff !important;
          font-size: 12px;
          font-weight: 900;
          line-height: 1;
          white-space: nowrap;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 4px 10px rgba(2,6,23,.16);
        }

        .presence {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 14px;
          font-weight: 950;
          white-space: nowrap;
        }

        .presence.online {
          color: #4ade80 !important;
          text-shadow: 0 0 8px rgba(74,222,128,.30);
          font-weight: 950;
        }

        .presence.offline {
          color: rgba(148,163,184,.48) !important;
        }

        .presence-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          flex: 0 0 10px;
          border-radius: 50%;
        }

        .presence-dot.online {
          background: #22c55e;
          box-shadow: 0 0 0 2px rgba(34,197,94,.16), 0 0 12px rgba(34,197,94,.85);
          animation: employee-presence-pulse 1.15s ease-in-out infinite;
        }

        .presence-dot.offline {
          background: rgba(100,116,139,.30);
          border: 1px solid rgba(100,116,139,.25);
          box-shadow: none;
        }

        @keyframes employee-presence-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .38; transform: scale(.78); }
        }

        .employee-table .employee-actions {
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding-inline: 3px;
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
        }

        .employee-table .employee-action {
          width: 62px;
          min-width: 62px;
          max-width: 62px;
          min-height: 30px;
          height: 30px;
          padding: 4px 2px;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 999px;
          color: #fff !important;
          /* تعديل حجم الخط خصيصاً لكلمات: ارسال، تعطيل، تفعيل، حذف */
          font-size: 8.5px !important;
          font-weight: 900;
          line-height: 1;
          white-space: nowrap;
          cursor: pointer;
          box-shadow: 0 3px 8px rgba(2,6,23,.18);
          transition: transform .15s ease, filter .15s ease;
        }

        .employee-table .employee-action:hover:not(:disabled) {
          transform: translateY(-2px);
          filter: brightness(1.08);
        }

        .employee-table .employee-action.disable {
          background: linear-gradient(135deg, #d97706, #ea580c) !important;
        }

        .employee-table .employee-action.enable {
          background: linear-gradient(135deg, #16a34a, #15803d) !important;
        }

        .employee-table .employee-action.delete {
          background: linear-gradient(135deg, #dc2626, #be123c) !important;
        }

        .employee-table .employee-action:disabled {
          opacity: .48;
          cursor: not-allowed;
          filter: grayscale(.25);
        }

        /* توحيد وتمركز جميع النوافذ والرسائل المركزية في منتصف الشاشة تماماً */
        .employee-modal {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 10000 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-sizing: border-box !important;
          padding: 20px !important;
          margin: auto !important;
          background: rgba(2, 6, 23, .74) !important;
          backdrop-filter: blur(5px);
          overflow: auto !important;
        }

        .employee-self-profile-card {
          width: 100%;
          box-sizing: border-box;
          margin-bottom: 14px;
          padding: clamp(18px, 2.2vw, 26px);
          border: 1px solid rgba(56,189,248,.62);
          border-radius: 20px;
          background: linear-gradient(145deg, rgba(15,23,42,.96), rgba(30,41,59,.92));
          box-shadow: 0 18px 45px rgba(2,6,23,.28), inset 0 1px 0 rgba(255,255,255,.05);
        }

        .employee-self-profile-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 0 20px;
          text-align: center;
        }

        .employee-self-icon {
          width: 68px;
          height: 68px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(37,99,235,.95), rgba(14,165,233,.9));
          border: 1px solid rgba(125,211,252,.7);
          font-size: 32px;
          box-shadow: 0 10px 25px rgba(14,165,233,.24);
        }

        .employee-self-name {
          margin-top: 4px;
          color: #f8fafc;
          font-size: clamp(21px, 2.2vw, 28px);
          font-weight: 950;
          text-decoration: underline;
          text-underline-offset: 5px;
        }

        .employee-self-job {
          color: #93c5fd;
          font-size: 16px;
          font-weight: 900;
        }

        .employee-self-presence {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 5px;
          font-size: 16px;
          font-weight: 950;
        }

        .employee-self-presence.online { color: #4ade80; }
        .employee-self-presence.offline { color: rgba(148,163,184,.58); }

        .employee-self-data-label {
          margin: 0 0 12px;
          padding: 9px 13px;
          border: 1px solid rgba(99,102,241,.58);
          border-radius: 12px;
          background: rgba(30,64,175,.18);
          color: #dbeafe;
          font-size: 17px;
          font-weight: 950;
        }

        .employee-self-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .employee-self-grid > div {
          min-width: 0;
          padding: 11px 12px;
          border: 1px solid rgba(96,165,250,.28);
          border-radius: 12px;
          background: rgba(15,23,42,.52);
        }

        .employee-self-grid span {
          display: block;
          margin-bottom: 5px;
          color: #93c5fd;
          font-size: 12px;
          font-weight: 800;
        }

        .employee-self-grid strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #f8fafc;
          font-size: 14px;
          font-weight: 900;
          white-space: nowrap;
        }

        .employee-self-profile-actions {
          display: flex;
          justify-content: center;
          margin-top: 16px;
        }

        .employee-self-edit-button {
          border: 0;
          border-radius: 999px;
          padding: 11px 22px;
          background: linear-gradient(135deg, #2563eb, #0ea5e9);
          color: #fff;
          font-size: 14px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(37,99,235,.24);
          transition: transform .15s ease, filter .15s ease;
        }

        .employee-self-edit-button:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
        }

        .employee-profile-edit-hint {
          margin-right: auto;
          margin-left: 10px;
          color: #93c5fd;
          font-size: 12px;
          font-weight: 800;
        }

        .employee-self-loading {
          text-align: center;
          padding: 35px;
          color: #cbd5e1;
          font-weight: 800;
        }

        .employee-modal-box {
          position: relative !important;
          width: min(520px, 92vw) !important;
          max-height: min(88vh, 760px) !important;
          overflow-y: auto !important;
          margin: auto !important;
          box-sizing: border-box !important;
          border: 1px solid rgba(56,189,248,.55) !important;
          border-radius: 20px !important;
          background: linear-gradient(145deg, rgba(15,23,42,.98), rgba(30,41,59,.98)) !important;
          box-shadow: 0 24px 80px rgba(0,0,0,.58), 0 0 0 1px rgba(59,130,246,.08) !important;
          color: #f8fafc !important;
        }

        .employee-message-modal {
          align-items: center !important;
          justify-content: center !important;
        }

        .employee-message-modal .employee-modal-box {
          flex: 0 1 auto !important;
          transform: translateY(0) !important;
        }

        .employee-edit-modal {
          position: fixed !important;
          inset: 0 !important;
          z-index: 9999 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 18px !important;
          background: rgba(2, 6, 23, .72) !important;
          backdrop-filter: blur(5px);
          overflow-y: auto;
        }

        .employee-edit-modal .employee-form-card {
          width: min(1120px, 96vw) !important;
          max-height: 90vh;
          overflow-y: auto;
          margin: auto !important;
          border: 1px solid rgba(56,189,248,.55) !important;
          border-radius: 20px !important;
          box-shadow: 0 24px 70px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.04);
        }

        .employee-form-host {
          display: block;
        }

        .employee-edit-modal .employee-form-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
        }

        .employee-edit-modal .employee-form-row-five,
        .employee-edit-modal .employee-form-row-six {
          display: grid;
          gap: 12px;
          width: 100%;
          align-items: end;
        }

        .employee-edit-modal .employee-form-row-1 { grid-template-columns: 1.45fr 1.15fr 1.05fr .82fr .95fr; }
        .employee-edit-modal .employee-form-row-2 { grid-template-columns: .95fr 1.05fr 1fr 1fr 1.35fr 1.35fr; }
        .employee-edit-modal .employee-form-row-3 { grid-template-columns: .95fr 1.45fr 1.15fr 1.55fr 1.25fr; }
        .employee-edit-modal .employee-form-row-4 { grid-template-columns: 1.05fr 1.15fr 1.05fr 1.25fr 1.55fr; }

        .employee-edit-modal .employee-form-row-five > .employee-field {
          min-width: 0;
        }

        .employee-edit-modal .employee-form-row-five > .employee-field,
        .employee-edit-modal .employee-form-row-six > .employee-field {
          min-width: 0;
        }

                .employee-edit-modal .employee-form-grid .employee-input {
          min-height: 40px;
          font-size: 14px;
          font-weight: 800;
        }

        .employee-edit-modal .employee-label {
          font-size: 13px;
          font-weight: 900;
        }

        .employee-edit-modal .employee-edit-title {
          font-size: 20px;
          font-weight: 950;
        }

        @media (max-width: 1100px) {
          .employee-self-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }


          .employee-edit-modal .employee-form-row-1,
          .employee-edit-modal .employee-form-row-3,
          .employee-edit-modal .employee-form-row-4 {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }

          .employee-edit-modal .employee-form-row-2 {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }

          .employee-form-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        

          .employee-filters {
            grid-template-columns: minmax(245px, 2.2fr) repeat(3, minmax(115px, 1fr));
            gap: 9px;
            padding: 12px;
          }

          .employee-filter-label {
            font-size: 14px;
          }

          .employee-filter-select,
          .employee-search-input {
            min-height: 42px;
            font-size: 14px !important;
          }

          .employee-table {
            font-size: 11px;
          }

          .employee-table th,
          .employee-table td {
            padding: 7px 4px;
          }

          .employee-table .employee-action {
            width: 58px;
            min-width: 58px;
            max-width: 58px;
            min-height: 30px;
            height: 30px;
            padding: 4px 2px;
            font-size: 8px !important;
          }
        }

        @media (max-width: 760px) {
          .employee-edit-modal .employee-form-row-five,
          .employee-edit-modal .employee-form-row-six {
            grid-template-columns: 1fr !important;
          }

          .employees-stats {
            grid-template-columns: 1fr;
          }

          .employee-form-grid,
          .employee-filters {
            grid-template-columns: 1fr;
          }

          .employee-field.wide {
            grid-column: span 1;
          }

          .employee-detail-grid {
            grid-template-columns: 1fr 1fr;
          }

          .employee-table {
            font-size: 10px;
          }

          .employee-table th,
          .employee-table td {
            padding: 6px 3px;
          }

          .employee-table .employee-action {
            width: 54px;
            min-width: 54px;
            max-width: 54px;
            min-height: 29px;
            height: 29px;
            padding: 4px 2px;
            font-size: 7.5px !important;
          }

          .job-pill {
            min-width: 58px;
            padding: 5px 8px;
            font-size: 12px;
          }

          .employee-name {
            font-size: 13px !important;
          }

          .presence {
            gap: 4px;
            font-size: 11px;
          }

          .presence-dot {
            width: 7px;
            height: 7px;
          }
        }

        @media (max-width: 520px) {
          .employee-detail-grid {
            grid-template-columns: 1fr;
          }

          .employee-table th:nth-child(3),
          .employee-table td:nth-child(3) {
            display: none;
          }

          .employee-table th,
          .employee-table td {
            padding: 5px 2px;
            font-size: 9px;
          }

          .employee-action {
            padding: 4px;
            font-size: 7px !important;
          }
        }
      `}</style>

      <div className="employees-page">

        <div
          className="employees-card employees-stats-card"
          style={{ marginBottom: 14 }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap'
            }}
          >
            <div>
              <h2 className="employees-title">
                👥 إدارة الموظفين والوظائف
              </h2>
              <p className="employees-subtitle">
                إدارة بيانات الموظفين وربط الوظيفة والفرع والمادة ومتابعة الاتصال.
                {isHeartbeatActive && (
                  <span style={{ marginRight: 8, color: '#4ade80', fontWeight: 800 }}>
                    • الاتصال المباشر فعال
                  </span>
                )}
              </p>
            </div>

            {isManager && !showForm && (
              <button
                type="button"
                onClick={startAdd}
                style={{
                  border: 0,
                  borderRadius: 10,
                  padding: '10px 17px',
                  background: 'linear-gradient(135deg,#2563eb,#0ea5e9)',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  boxShadow: '0 7px 18px rgba(37,99,235,.25)'
                }}
              >
                <span aria-hidden="true">➕</span>
                إضافة موظف
              </button>
            )}
          </div>

          {canManageInstitutionEmployees && (
            <>
          <div className="employees-section-label">
            <span className="section-label-icon" aria-hidden="true">📊</span>
            <span>إحصائية الموظفين:</span>
          </div>

          <div className="employees-stats">
            <div className="employee-stat">
              <span style={{ display: 'block', textAlign: 'center' }}>إجمالي الموظفين</span>
              <strong className="employee-stat-value">
                {employees.length}
              </strong>
            </div>

            <div className="employee-stat">
              <span style={{ display: 'block', textAlign: 'center' }}>متواجدون الآن</span>
              <strong
                className="employee-stat-value"
                style={{ color: '#4ade80' }}
              >
                {onlineCount}
              </strong>
            </div>

            <div className="employee-stat">
              <span style={{ display: 'block', textAlign: 'center' }}>حسابات معطلة</span>
              <strong
                className="employee-stat-value"
                style={{ color: '#f87171' }}
              >
                {inactiveCount}
              </strong>
            </div>
          </div>

          <div className="employees-job-stats" aria-label="عدد الموظفين حسب الوظيفة">
            {jobEmployeeCounts.map((job) => (
              <div className="employee-job-stat" key={job.id}>
                <span className="employee-job-stat-name" title={job.job_name || 'بدون اسم'}>
                  {job.job_name || 'بدون اسم'}
                </span>
                <strong className="employee-job-stat-count">
                  {job.employeeCount}
                </strong>
                <span style={{ fontSize: '10px', opacity: .65 }}>موظف</span>
              </div>
            ))}
          </div>
            </>
          )}
        </div>

        {(!isManager || isInstitutionManager) && (
          <section className="employee-self-profile-card">
            {currentEmployee ? (
              <>
                <div className="employee-self-profile-header">
                  <div className="employee-self-icon" aria-hidden="true">👤</div>
                  <div className="employee-self-name">{formatEmployeeName(currentEmployee.full_name, false)}</div>
                  <div className="employee-self-job">{getJobName(currentEmployee)}</div>
                  <div className={`employee-self-presence ${isCurrentlyOnline(currentEmployee) ? 'online' : 'offline'}`}>
                    <span className={`presence-dot ${isCurrentlyOnline(currentEmployee) ? 'online' : 'offline'}`} />
                    <span>{isCurrentlyOnline(currentEmployee) ? 'متواجد' : 'غير متواجد'}</span>
                  </div>
                </div>

                <div className="employee-self-data-label">📋 بياناتي</div>
                <div className="employee-self-grid">
                  <div><span>رقم الهوية</span><strong>{currentEmployee.national_id || '—'}</strong></div>
                  <div><span>الرقم الوظيفي</span><strong>{currentEmployee.employee_number || '—'}</strong></div>
                  <div><span>الجنس</span><strong>{currentEmployee.gender || '—'}</strong></div>
                  <div><span>الجنسية</span><strong>{currentEmployee.nationality || '—'}</strong></div>
                  <div><span>مكان الميلاد</span><strong>{currentEmployee.birth_place || '—'}</strong></div>
                  <div><span>تاريخ الميلاد</span><strong>{normalizeDate(currentEmployee.birth_date) || '—'}</strong></div>
                  <div><span>مكان العمل</span><strong>{currentEmployee.workplace || '—'}</strong></div>
                  <div><span>التخصص</span><strong>{currentEmployee.specialization || '—'}</strong></div>
                  <div><span>الحالة الصحية</span><strong>{currentEmployee.health || '—'}</strong></div>
                  <div><span>العنوان</span><strong>{currentEmployee.address || '—'}</strong></div>
                  <div><span>رقم الهاتف</span><strong>{currentEmployee.phone || '—'}</strong></div>
                  <div><span>رقم الواتس</span><strong>{currentEmployee.whatsapp_number || '—'}</strong></div>
                  <div><span>الإيميل</span><strong>{currentEmployee.email || '—'}</strong></div>
                  <div><span>اسم المستخدم</span><strong>{currentEmployee.username || '—'}</strong></div>
                  <div><span>الفرع</span><strong>{getBranchName(currentEmployee)}</strong></div>
                  <div><span>المادة</span><strong>{getSubjectName(currentEmployee)}</strong></div>
                </div>

                <div className="employee-self-profile-actions">
                  <button type="button" className="employee-self-edit-button" onClick={startProfileEdit}>
                    ✏️ تعديل بياناتي وكلمة المرور
                  </button>
                </div>
              </>
            ) : (
              <div className="employee-self-loading">جاري تحميل بيانات الموظف...</div>
            )}
          </section>
        )}

        {errorMessage && (
          <div
            className="employees-card"
            style={{
              marginBottom: 14,
              borderColor: '#ef4444',
              color: '#fecaca'
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {showForm && (
          <div
            className={editingId ? 'employee-modal employee-edit-modal' : 'employee-form-host'}
            onClick={editingId ? resetForm : undefined}
          >
          <form
            onSubmit={saveEmployee}
            className="employees-card employee-form-card employee-add-form-card"
            style={{ marginBottom: 14 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14
              }}
            >
              <h3 className="employee-edit-title" style={{ margin: 0 }}>
                {editingId
                  ? (profileMode ? (editUnlocked ? '✏️ تعديل بياناتي' : '👤 بياناتي') : (editUnlocked ? '✏️ تعديل بيانات الموظف' : '👤 بيانات الموظف'))
                  : '➕ إضافة موظف جديد'}
              </h3>

              {profileMode && (
                <span className="employee-profile-edit-hint">يمكنك تعديل بياناتك وتغيير كلمة المرور فقط</span>
              )}

              <button
                type="button"
                onClick={resetForm}
                style={{
                  border: 0,
                  borderRadius: 8,
                  padding: '8px 12px',
                  background: '#334155',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                إغلاق
              </button>
            </div>

            <div className="employee-form-grid employee-form-grid-ordered">

              {/* الصف الأول: الاسم بالعربية | رقم الهوية | الرقم الوظيفي | الجنس | الجنسية */}
              <div className="employee-form-row-five employee-form-row-1">
                {[
                  ['full_name', 'الاسم بالعربية', true],
                  ['national_id', 'رقم الهوية', false],
                  ['employee_number', 'الرقم الوظيفي', false],
                  ['gender', 'الجنس', false],
                  ['nationality', 'الجنسية', false]
                ].map(([field, label, required]) => (
                  <div key={field} className={`employee-field employee-field-${field}`}>
                    <label className="employee-label">
                      {label}{required && <span style={{ color: '#f87171' }}> *</span>}
                    </label>
                    {field === 'gender' ? (
                      <select
                        className="employee-input"
                        disabled={Boolean(editingId && !editUnlocked)}
                        value={form.gender || ''}
                        onChange={(event) => updateField(field, event.target.value)}
                      >
                        <option value="">اختر</option>
                        <option value="ذكر">ذكر</option>
                        <option value="أنثى">أنثى</option>
                      </select>
                    ) : (
                      <input
                        className="employee-input"
                        disabled={Boolean(editingId && (!editUnlocked || (profileMode && field === 'national_id')))}
                        type="text"
                        value={form[field] ?? ''}
                        onChange={(event) => updateField(field, event.target.value)}
                        inputMode={field === 'national_id' ? 'numeric' : undefined}
                        pattern={field === 'national_id' ? '[0-9]{9}' : undefined}
                        minLength={field === 'national_id' ? 9 : undefined}
                        maxLength={field === 'national_id' ? 9 : undefined}
                        title={field === 'national_id' ? 'رقم الهوية يجب أن يتكون من 9 أرقام فقط' : undefined}
                        required={required}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* الصف الثاني: تاريخ الميلاد | مكان الميلاد | الهاتف | الواتس | العنوان | الإيميل */}
              <div className="employee-form-row-six employee-form-row-2">
                {[
                  ['birth_date', 'تاريخ الميلاد'],
                  ['birth_place', 'مكان الميلاد'],
                  ['phone', 'رقم الهاتف'],
                  ['whatsapp_number', 'رقم الواتس'],
                  ['address', 'العنوان'],
                  ['email', 'الإيميل']
                ].map(([field, label]) => (
                  <div key={field} className={`employee-field employee-field-${field}`}>
                    <label className="employee-label">{label}</label>
                    <input
                      className="employee-input"
                      disabled={Boolean(editingId && !editUnlocked)}
                      type={field === 'birth_date' ? 'date' : field === 'email' ? 'email' : 'text'}
                      value={form[field] ?? ''}
                      onChange={(event) => updateField(field, event.target.value)}
                    />
                  </div>
                ))}
              </div>

              {/* الصف الثالث: الحالة الصحية | مكان العمل | المديرية | المدرسة | التخصص */}
              <div className="employee-form-row-five employee-form-row-3">
                <div className="employee-field employee-field-health">
                  <label className="employee-label">الحالة الصحية</label>
                  <select
                    className="employee-input"
                    disabled={Boolean(editingId && !editUnlocked)}
                    value={form.health || 'جيدة جدا'}
                    onChange={(event) => updateField('health', event.target.value)}
                  >
                    <option value="جيدة جدا">جيدة جدا</option>
                    <option value="مريض">مريض</option>
                  </select>
                </div>

                <div className="employee-field employee-field-workplace employee-field-wide-custom">
                  <label className="employee-label">مكان العمل</label>
                  <input
                    className="employee-input"
                    disabled={Boolean(editingId && !editUnlocked)}
                    type="text"
                    value={form.workplace ?? ''}
                    onChange={(event) => updateField('workplace', event.target.value)}
                  />
                </div>

                <div className="employee-field employee-field-directorate">
                  <label className="employee-label">المديرية</label>
                  <select
                    className="employee-input"
                    disabled={Boolean(editingId && (!editUnlocked || profileMode))}
                    value={form.directorate_id || ''}
                    onChange={(event) => updateField('directorate_id', event.target.value)}
                  >
                    <option value="">اختر المديرية</option>
                    {directorates.map((directorate) => (
                      <option key={directorate.id} value={directorate.id}>
                        {directorate.directorate_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="employee-field employee-field-school employee-field-wide-custom">
                  <label className="employee-label">المدرسة</label>
                  <select
                    className="employee-input"
                    disabled={Boolean(editingId && (!editUnlocked || profileMode)) || !form.directorate_id}
                    value={form.school_id || ''}
                    onChange={(event) => updateField('school_id', event.target.value)}
                  >
                    <option value="">
                      {form.directorate_id ? 'اختر المدرسة التابعة للمديرية' : 'اختر المديرية أولًا'}
                    </option>
                    {availableSchools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.school_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="employee-field employee-field-specialization">
                  <label className="employee-label">التخصص</label>
                  <input
                    className="employee-input"
                    disabled={Boolean(editingId && !editUnlocked)}
                    type="text"
                    value={form.specialization ?? ''}
                    onChange={(event) => updateField('specialization', event.target.value)}
                  />
                </div>
              </div>

              {/* الصف الرابع: الفرع | المادة | الوظيفة | اسم المستخدم | كلمة المرور */}
              <div className="employee-form-row-five employee-form-row-4">
                <div className="employee-field employee-field-branch">
                  <label className="employee-label">الفرع</label>
                  <select
                    className="employee-input"
                    disabled={Boolean(editingId && (!editUnlocked || profileMode))}
                    value={form.branch_id}
                    onChange={(event) => updateField('branch_id', event.target.value)}
                  >
                    <option value="">اختر الفرع</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name || branch.branch_name || branch.title || `فرع #${branch.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="employee-field employee-field-subject">
                  <label className="employee-label">المادة</label>
                  <select
                    className="employee-input"
                    disabled={Boolean(editingId && (!editUnlocked || profileMode)) || !form.branch_id}
                    value={form.subject_id}
                    onChange={(event) => updateField('subject_id', event.target.value)}
                  >
                    <option value="">
                      {form.branch_id ? 'اختر المادة التابعة للفرع' : 'اختر الفرع أولًا'}
                    </option>
                    {availableSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name || subject.subject_name || subject.title || `مادة #${subject.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="employee-field employee-field-job">
                  <label className="employee-label">الوظيفة *</label>
                  <select
                    className="employee-input"
                    disabled={Boolean(editingId && (!editUnlocked || profileMode))}
                    value={form.job_id}
                    onChange={(event) => updateField('job_id', event.target.value)}
                    required
                  >
                    <option value="">اختر الوظيفة</option>
                    {jobs
                      .filter((job) => {
                        if (!isInstitutionManager) return true;
                        const name = String(job.job_name || '').trim();
                        return name !== 'مدير' && name !== 'مدير المؤسسة';
                      })
                      .map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.job_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="employee-field employee-field-username employee-field-wide-custom">
                  <label className="employee-label">اسم المستخدم *</label>
                  <input
                    className="employee-input"
                    disabled={Boolean(editingId)}
                    type="text"
                    value={form.username}
                    onChange={(event) => updateField('username', event.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>

                <div className="employee-field employee-field-password employee-field-wide-custom">
                  <label className="employee-label">
                    {profileMode ? 'كلمة المرور الجديدة' : 'كلمة المرور'} {!editingId && <span style={{ color: '#f87171' }}>*</span>}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="employee-input"
                      disabled={Boolean(editingId && !editUnlocked)}
                      style={{ paddingLeft: 42 }}
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(event) => updateField('password', event.target.value)}
                      required={!editingId}
                      placeholder={editingId ? 'اتركها فارغة دون تغيير' : 'أدخل كلمة المرور'}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      style={{
                        position: 'absolute',
                        left: 7,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 30,
                        height: 30,
                        border: 0,
                        borderRadius: 7,
                        background: 'rgba(15,23,42,.55)',
                        color: '#cbd5e1',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: 6 }}>{PASSWORD_POLICY_MESSAGE}</div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 16
              }}
            >
              {editingId ? (
                editUnlocked && hasEditChanges ? (
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      border: 0,
                      borderRadius: 999,
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg,#16a34a,#22c55e)',
                      color: '#fff',
                      fontWeight: 900,
                      cursor: saving ? 'wait' : 'pointer',
                      boxShadow: '0 5px 14px rgba(34,197,94,.22)'
                    }}
                  >
                    {saving ? '⏳ جاري الحفظ...' : '💾 حفظ التعديلات'}
                  </button>
                ) : !editUnlocked ? (
                  <button
                    type="button"
                    onClick={unlockEdit}
                    style={{
                      border: 0,
                      borderRadius: 999,
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg,#2563eb,#0ea5e9)',
                      color: '#fff',
                      fontWeight: 900,
                      cursor: 'pointer',
                      boxShadow: '0 5px 14px rgba(37,99,235,.22)'
                    }}
                  >
                    ✏️ تعديل البيانات
                  </button>
                ) : null
              ) : (
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    border: 0,
                    borderRadius: 999,
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg,#16a34a,#22c55e)',
                    color: '#fff',
                    fontWeight: 900,
                    cursor: saving ? 'wait' : 'pointer'
                  }}
                >
                  {saving ? '⏳ جاري الحفظ...' : '💾 إضافة الموظف'}
                </button>
              )}

              <button
                type="button"
                onClick={editingId ? cancelEditChanges : resetForm}
                style={{
                  border: 0,
                  borderRadius: 999,
                  padding: '10px 20px',
                  background: '#475569',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                ↩ إلغاء
              </button>
            </div>
          </form>
          </div>
        )}

        {canManageInstitutionEmployees && (
        <div
          className="employees-card"
          style={{ marginBottom: 14 }}
        >
          <div className="employee-filters employee-filters-polished">
            <div className="employee-filter-box employee-filter-search-box">
              <label className="employee-filter-label">بحث عن موظف</label>
              <div className="employee-search-box">
                <span className="employee-search-icon" aria-hidden="true">🔎</span>
                <input
                  className="employee-input employee-search-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="بحث عن موظف"
                />
              </div>
            </div>

            <div className="employee-filter-box">
              <label className="employee-filter-label">الفروع</label>
              <select
                className="employee-input employee-filter-select"
                value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
            >
              <option value="">كل الفروع</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name ||
                    branch.branch_name ||
                    branch.title ||
                    `فرع #${branch.id}`}
                </option>
              ))}
              </select>
            </div>

            <div className="employee-filter-box">
              <label className="employee-filter-label">الوظائف</label>
              <select
                className="employee-input employee-filter-select"
                value={jobFilter}
              onChange={(event) => setJobFilter(event.target.value)}
            >
              <option value="">كل الوظائف</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.job_name}
                </option>
              ))}
              </select>
            </div>

            <div className="employee-filter-box employee-filter-status-box">
              <label className="employee-filter-label">الحالات</label>
              <select
                className="employee-input employee-filter-select"
                value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">كل الحالات</option>
              <option value="active">النشطون</option>
              <option value="inactive">حسابات معطلة</option>
              <option value="online">المتواجدون الآن</option>
              </select>
            </div>
          </div>
        </div>

        )}

        {canManageInstitutionEmployees && (
        <div className="employees-card employee-table-wrap employee-data-card">
          <div className="employees-section-label">
            <span className="section-label-icon" aria-hidden="true">👥</span>
            <span>بيانات الموظفين:</span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 35 }}>
              جاري تحميل الموظفين...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 35,
                opacity: .7
              }}
            >
              لا توجد بيانات مطابقة.
            </div>
          ) : (
            <div className="employee-table-scroll">
              <table className="employee-table">
                <colgroup>
                <col style={{ width: '4%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '24%' }} />
              </colgroup>

              <thead>
                <tr>
                  <th>#</th>
                  <th>اسم الموظف</th>
                  <th>الوظيفة</th>
                  <th>تسجيل الدخول</th>
                  <th className="connection-column">الاتصال</th>
                  <th className="status-column">الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>

              <tbody>
                {filteredEmployees.map((employee, index) => (
                  <tr key={employee.id}>

                    <td>
                      {index + 1}
                    </td>

                    <td>
                      <span className="employee-name-wrap">
                        <span
                          className="employee-name-edit-icon"
                          aria-hidden="true"
                          title="تعديل"
                        >
                          ✏️
                        </span>
                        <button
                          type="button"
                          className="employee-name"
                          onClick={() => startEdit(employee)}
                          title="عرض وتعديل بيانات الموظف"
                        >
                          {formatEmployeeName(employee.full_name, isManager)}
                        </button>
                      </span>
                    </td>

                    <td>
                      <span className="job-pill">
                        {getJobName(employee)}
                      </span>
                    </td>

                    <td className="login-cell">
                      {employee.last_login ? (
                        <span
                          className="login-date-time"
                          style={{
                            display: 'inline-flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '3px',
                            minWidth: '92px',
                            lineHeight: 1.2,
                            direction: 'ltr',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <span className="login-date">{formatLoginDate(employee.last_login)}</span>
                          <span className="login-time">{formatLoginTime(employee.last_login)}</span>
                        </span>
                      ) : (
                        <span className="login-empty">—</span>
                      )}
                    </td>

                    <td>
                      {isCurrentlyOnline(employee) ? (
                        <span className="presence online">
                          <span className="presence-dot online" />
                          متواجد
                        </span>
                      ) : (
                        <span className="presence offline">
                          <span className="presence-dot offline" />
                          غير متواجد
                        </span>
                      )}
                    </td>

                    <td className="status-column">
                      <span
                        className="employee-status-pill"
                        style={{
                          fontWeight: 950,
                          fontSize: 13,
                          background:
                            employee.is_active === false
                              ? 'rgba(127,29,29,.28)'
                              : 'rgba(21,128,61,.22)',
                          color:
                            employee.is_active === false
                              ? '#fca5a5'
                              : '#86efac',
                          border:
                            employee.is_active === false
                              ? '1px solid rgba(248,113,113,.28)'
                              : '1px solid rgba(74,222,128,.28)'
                        }}
                      >
                        {employee.is_active === false ? 'معطل' : 'فعال'}
                      </span>
                    </td>

                    <td>
                      <div className="employee-actions">
                        <button
                          type="button"
                          className={`employee-action ${
                            employee.is_active === false
                              ? 'enable'
                              : 'disable'
                          }`}
                          onClick={() => toggleActive(employee)}
                          title={
                            employee.is_active === false
                              ? 'تفعيل الموظف'
                              : 'تعطيل الموظف'
                          }
                        >
                          {employee.is_active === false
                            ? '▶️ تفعيل'
                            : '⏸️ تعطيل'}
                        </button>

                        <button
                          type="button"
                          className="employee-action delete"
                          onClick={() => setDeleteTarget(employee)}
                          title="حذف الموظف"
                        >
                          🗑️ حذف
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          )}
        </div>



        )}

        {deleteTarget && (
          <div
            className="employee-modal"
            onClick={() => setDeleteTarget(null)}
          >
            <div
              className="employee-modal-box"
              onClick={(event) => event.stopPropagation()}
              style={{ maxWidth: 430, textAlign: 'center' }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>🗑️</div>
              <h3 style={{ margin: '0 0 8px' }}>تأكيد حذف الموظف</h3>
              <p style={{ margin: '0 0 18px', opacity: .78 }}>
                هل أنت متأكد من حذف الموظف:
                <strong style={{ display: 'block', marginTop: 6 }}>
                  {deleteTarget.full_name || deleteTarget.username}
                </strong>
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => deleteEmployee(deleteTarget)}
                  style={{
                    border: 0,
                    borderRadius: 9,
                    padding: '10px 18px',
                    background: '#dc2626',
                    color: '#fff',
                    fontWeight: 900,
                    cursor: 'pointer'
                  }}
                >
                  🗑️ نعم، حذف
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  style={{
                    border: 0,
                    borderRadius: 9,
                    padding: '10px 18px',
                    background: '#475569',
                    color: '#fff',
                    fontWeight: 900,
                    cursor: 'pointer'
                  }}
                >
                  ↩ إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {messageModal && (
          <div
            className="employee-modal employee-message-modal"
            onClick={() => setMessageModal(null)}
          >
            <div
              className="employee-modal-box"
              onClick={(event) => event.stopPropagation()}
              style={{
                maxWidth: 460,
                textAlign: 'center',
                borderColor:
                  messageModal.type === 'error'
                    ? 'rgba(239,68,68,.65)'
                    : messageModal.type === 'warning'
                    ? 'rgba(245,158,11,.65)'
                    : 'rgba(34,197,94,.65)'
              }}
            >
              <div
                style={{
                  fontSize: 34,
                  marginBottom: 8
                }}
              >
                {messageModal.type === 'error'
                  ? '⚠️'
                  : messageModal.type === 'warning'
                  ? '⛔'
                  : '✅'}
              </div>

              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  lineHeight: 1.8
                }}
              >
                {messageModal.message}
              </div>

              <button
                type="button"
                onClick={() => setMessageModal(null)}
                style={{
                  marginTop: 16,
                  border: 0,
                  borderRadius: 9,
                  padding: '9px 22px',
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                حسنًا
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}