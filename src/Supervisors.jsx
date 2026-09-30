import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { validatePasswordPolicy, PASSWORD_POLICY_MESSAGE } from './passwordPolicy';

const ONLINE_TIMEOUT_SECONDS = 70;
const HEARTBEAT_MS = 25000;
const REFRESH_MS = 15000;

const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase();

  if (value.includes('admin') || value.includes('مدير')) return 'Admin';
  if (value.includes('supervisor') || value.includes('مشرف')) return 'Supervisor';

  return 'Teacher';
};

// دالة لتنسيق الاسم: (الاسم الاول الحرف الاول من اسم الاب الحرف الاول من اسم الجد الاسم العائلة)
const formatEmployeeName = (fullName) => {
  if (!fullName) return 'بدون اسم';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} ${parts[1]}`;
  if (parts.length === 3) return `${parts[0]} ${parts[1][0]}. ${parts[2]}`;
  
  // إذا كان الاسم يتكون من 4 أجزاء أو أكثر (الاسم الأول، الأب، الجد، العائلة...)
  const firstName = parts[0];
  const fatherInitial = parts[1] ? `${parts[1][0]}.` : '';
  const grandfatherInitial = parts[2] ? `${parts[2][0]}.` : '';
  const lastName = parts[parts.length - 1];

  return [firstName, fatherInitial, grandfatherInitial, lastName].filter(Boolean).join(' ');
};

const formatDateTime = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  const formattedDate = date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const formattedTime = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return (
    <>
      <div>{formattedDate}</div>
      <div>{formattedTime}</div>
    </>
  );
};

const isActuallyOnline = (employee) => {
  if (!employee?.is_online || !employee?.last_seen) {
    return false;
  }

  const lastSeen = new Date(employee.last_seen).getTime();

  if (Number.isNaN(lastSeen)) {
    return false;
  }

  return Date.now() - lastSeen <= ONLINE_TIMEOUT_SECONDS * 1000;
};

export default function Supervisors({
  onBack,
  currentUserId,
  currentUsername,
  currentUserRole
}) {
  const activeUsername =
    currentUsername ||
    localStorage.getItem('currentUsername') ||
    localStorage.getItem('username') ||
    localStorage.getItem('user') ||
    localStorage.getItem('manualActiveUsername') ||
    '';

  const activeUserId =
    currentUserId ||
    localStorage.getItem('currentUserId') ||
    '';

  const activeRole = normalizeRole(
    currentUserRole ||
      localStorage.getItem('currentUserRole') ||
      localStorage.getItem('userRole') ||
      localStorage.getItem('role') ||
      ''
  );

  const isAdmin = activeRole === 'Admin';

  return (
    <div style={styles.container} dir="rtl">
      {isAdmin ? (
        <AdminDashboard
          onBack={onBack}
          currentUserId={activeUserId}
          currentUsername={activeUsername}
        />
      ) : (
        <EmployeeProfile
          onBack={onBack}
          activeUsername={activeUsername}
          activeUserId={activeUserId}
        />
      )}
    </div>
  );
}

/* =========================================================
   ADMIN DASHBOARD
========================================================= */

function AdminDashboard({
  onBack,
  currentUserId,
  currentUsername
}) {
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState(null);

  const [message, setMessage] = useState({
    type: '',
    text: ''
  });

  const emptyEmployee = {
    full_name: '',
    national_id: '',
    employee_number: '',
    gender: '',
    phone: '',
    address: '',
    workplace: '',
    email: '',
    username: '',
    password: '',
    role: 'Teacher',
    branch_id: '',
    specialization: '',
    subject_id: ''
  };

  const [newEmployee, setNewEmployee] = useState(emptyEmployee);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [passwordModal, setPasswordModal] = useState(null);
  const [selectedEmployeeModal, setSelectedEmployeeModal] = useState(null);
  const [editEmployeeForm, setEditEmployeeForm] = useState({});
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const showMessage = useCallback((type, text) => {
    setMessage({
      type,
      text
    });

    window.setTimeout(() => {
      setMessage({
        type: '',
        text: ''
      });
    }, 3000);
  }, []);

  const fetchMetaData = useCallback(async () => {
    const [branchesRes, subjectsRes] = await Promise.all([
      supabase.from('branches').select('*').order('branch_name', { ascending: true }),
      supabase.from('subjects').select('*').order('subject_name', { ascending: true })
    ]);

    if (branchesRes.error) console.error('Error fetching branches:', branchesRes.error);
    else setBranches(branchesRes.data || []);

    if (subjectsRes.error) console.error('Error fetching subjects:', subjectsRes.error);
    else setSubjects(subjectsRes.data || []);
  }, []);

  const fetchEmployees = useCallback(async () => {
    const { data, error } = await supabase
      .from('supervisors')
      .select('*, branches(branch_name), subjects(subject_name)')
      .order('created_at', {
        ascending: false
      });

    if (error) {
      console.error(error);
      showMessage('error', 'تعذر جلب بيانات الموظفين');
      setLoading(false);
      return;
    }

    setEmployees(data || []);
    setLoading(false);
  }, [showMessage]);

  useEffect(() => {
    const updateAdminHeartbeat = async () => {
      if (!currentUserId) return;
      await supabase
        .from('supervisors')
        .update({
          is_online: true,
          last_seen: new Date().toISOString()
        })
        .eq('id', currentUserId);
    };

    updateAdminHeartbeat();
    const hbTimer = setInterval(updateAdminHeartbeat, HEARTBEAT_MS);
    return () => clearInterval(hbTimer);
  }, [currentUserId]);

  useEffect(() => {
    fetchMetaData();
    fetchEmployees();

    const timer = window.setInterval(
      fetchEmployees,
      REFRESH_MS
    );

    const channel = supabase
      .channel('supervisors-management')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'supervisors'
        },
        () => {
          fetchEmployees();
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [fetchEmployees, fetchMetaData]);

  const handleAddEmployee = async (e) => {
    e.preventDefault();

    const full_name = newEmployee.full_name.trim();
    const username = newEmployee.username.trim();
    const password = newEmployee.password.trim();
    const role = normalizeRole(newEmployee.role);

    if (!full_name || !username || !password) {
      showMessage('error', 'يرجى تعبئة الحقول الأساسية (الاسم، اسم المستخدم، كلمة المرور)');
      return;
    }

    const policy = validatePasswordPolicy(password);
    if (!policy.valid) {
      showMessage('error', PASSWORD_POLICY_MESSAGE);
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('supervisors')
      .insert({
        full_name,
        username,
        password,
        role,
        national_id: newEmployee.national_id.trim() || null,
        employee_number: newEmployee.employee_number.trim() || null,
        gender: newEmployee.gender || null,
        address: newEmployee.address.trim() || null,
        phone: newEmployee.phone.trim() || null,
        email: newEmployee.email.trim() || null,
        workplace: newEmployee.workplace.trim() || null,
        branch_id: newEmployee.branch_id ? parseInt(newEmployee.branch_id, 10) : null,
        specialization: newEmployee.specialization.trim() || null,
        subject_id: newEmployee.subject_id ? parseInt(newEmployee.subject_id, 10) : null,
        is_active: true,
        is_online: false,
        last_seen: null
      });

    setSaving(false);

    if (error) {
      console.error(error);
      if (error.code === '23505') {
        showMessage('error', 'اسم المستخدم موجود مسبقًا');
      } else {
        showMessage('error', error.message || 'تعذر إضافة الموظف');
      }
      return;
    }

    setNewEmployee(emptyEmployee);

    showMessage('success', 'تمت إضافة الموظف بنجاح');
    fetchEmployees();
  };

  const handleUpdateEmployeeDetails = async (e) => {
    e.preventDefault();
    if (!selectedEmployeeModal) return;

    setSaving(true);
    const { error } = await supabase
      .from('supervisors')
      .update({
        full_name: editEmployeeForm.full_name?.trim() || null,
        national_id: editEmployeeForm.national_id?.trim() || null,
        employee_number: editEmployeeForm.employee_number?.trim() || null,
        gender: editEmployeeForm.gender || null,
        phone: editEmployeeForm.phone?.trim() || null,
        address: editEmployeeForm.address?.trim() || null,
        workplace: editEmployeeForm.workplace?.trim() || null,
        email: editEmployeeForm.email?.trim() || null,
        role: normalizeRole(editEmployeeForm.role),
        branch_id: editEmployeeForm.branch_id ? parseInt(editEmployeeForm.branch_id, 10) : null,
        specialization: editEmployeeForm.specialization?.trim() || null,
        subject_id: editEmployeeForm.subject_id ? parseInt(editEmployeeForm.subject_id, 10) : null
      })
      .eq('id', selectedEmployeeModal.id);

    setSaving(false);

    if (error) {
      console.error(error);
      showMessage('error', 'تعذر تحديث بيانات الموظف');
      return;
    }

    showMessage('success', 'تم تحديث بيانات الموظف بنجاح');
    setSelectedEmployeeModal(null);
    fetchEmployees();
  };

  const sendPasswordEmail = async (employee) => {
    if (!employee.email) {
      showMessage('error', 'هذا الموظف لا يملك بريداً إلكترونياً مسجلاً');
      return;
    }

    setSendingEmailId(employee.id);

    const emailSubject = 'معلومات الدخول للنظام';
    const emailBody = `عزيزي الموظف : ${employee.full_name || employee.username} تحية وبعد \nمرسل لكم اسم المستخدم وكلمة المرور احتفظ بهما للدخول للنظام \nUser name : ${employee.username} \nPassword: يتم حفظ كلمة المرور بشكل مشفّر، ولأسباب أمنية لا يتم إرسالها من قاعدة البيانات. \nوشكرا`;

    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: employee.email,
          subject: emailSubject,
          message: emailBody
        }
      });

      if (error) {
        console.warn('Edge function error, falling back to mailto:', error);
        fallbackToMailto(employee.email, emailSubject, emailBody);
      } else {
        showMessage('success', 'تم إرسال رسالة بيانات الدخول إلى البريد بنجاح');
      }
    } catch (err) {
      console.warn('Edge function exception, falling back to mailto:', err);
      fallbackToMailto(employee.email, emailSubject, emailBody);
    } finally {
      setSendingEmailId(null);
    }
  };

  const fallbackToMailto = (email, subject, body) => {
    const mailtoLink = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
    showMessage('success', 'تم فتح برنامج البريد الإلكتروني الخاص بك لإرسال البيانات جاهزة');
  };

  const toggleAccount = async (employee) => {
    if (String(employee.id) === String(currentUserId)) {
      showMessage('error', 'لا يمكنك تعطيل حسابك الحالي من هنا');
      return;
    }

    const nextActive = employee.is_active === false;

    const { error } = await supabase
      .from('supervisors')
      .update({
        is_active: nextActive,
        ...(nextActive ? {} : { is_online: false, last_seen: new Date().toISOString() })
      })
      .eq('id', employee.id);

    if (error) {
      console.error(error);
      showMessage('error', 'تعذر تغيير حالة الحساب');
      return;
    }

    showMessage('success', nextActive ? 'تم تفعيل الحساب بنجاح' : 'تم تعطيل الحساب بنجاح');
    fetchEmployees();
  };

  const deleteEmployee = async (employee) => {
    if (String(employee.id) === String(currentUserId)) {
      showMessage('error', 'لا يمكنك حذف حسابك الحالي');
      return;
    }

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف الموظف "${employee.full_name || employee.username}"؟`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from('supervisors')
      .delete()
      .eq('id', employee.id);

    if (error) {
      console.error(error);
      showMessage('error', 'تعذر حذف الموظف');
      return;
    }

    showMessage('success', 'تم حذف الموظف بنجاح');
    setSelectedEmployeeModal(null);
    fetchEmployees();
  };

  const openPasswordModal = (employee) => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowOldPass(false);
    setShowNewPass(false);
    setShowConfirmPass(false);
    setPasswordModal(employee);
  };

  const savePassword = async () => {
    if (!passwordModal) return;

    const currentAdminUser = employees.find(emp => String(emp.id) === String(currentUserId));
    
    if (!oldPassword.trim()) {
      showMessage('error', 'يرجى إدخال كلمة المرور القديمة');
      return;
    }
    const { data: oldPasswordValid, error: oldPasswordError } = await supabase.rpc('verify_supervisor_password', {
      p_username: currentAdminUser?.username || '',
      p_password: oldPassword.trim()
    });
    if (oldPasswordError || oldPasswordValid !== true) {
      showMessage('error', 'كلمة المرور القديمة غير صحيحة');
      return;
    }

    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    const newPolicy = validatePasswordPolicy(trimmedNew);
    if (!newPolicy.valid) {
      showMessage('error', PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (trimmedNew !== trimmedConfirm) {
      showMessage('error', 'كلمة المرور الجديدة وتأكيدها غير متطابقتين');
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('supervisors')
      .update({ password: trimmedNew })
      .eq('id', passwordModal.id);

    setSaving(false);

    if (error) {
      console.error(error);
      showMessage('error', 'تعذر تغيير كلمة المرور');
      return;
    }

    setPasswordModal(null);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');

    showMessage('success', 'تم تعديل كلمة المرور بنجاح');
  };

  const onlineCount = useMemo(
    () => employees.filter(isActuallyOnline).length,
    [employees]
  );

  const currentName =
    localStorage.getItem('currentName') ||
    currentUsername ||
    'المستخدم';

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <div style={styles.welcome}>أهلاً، {currentName}</div>
          <div style={styles.pageSubtitle}>إدارة الموظفين والحسابات</div>
        </div>

        <button 
          onClick={() => {
            if (typeof onBack === 'function') {
              onBack();
            } else {
              window.location.reload();
            }
          }} 
          style={styles.backButton}
        >
          ⬅️ الرئيسية
        </button>
      </div>

      {message.text && (
        <div
          style={{
            ...styles.message,
            ...(message.type === 'error' ? styles.errorMessage : styles.successMessage)
          }}
        >
          {message.text}
        </div>
      )}

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{employees.length}</div>
          <div style={styles.statLabel}>إجمالي الموظفين</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statNumber}>{onlineCount}</div>
          <div style={styles.statLabel}>متواجد الآن</div>
        </div>
      </div>

      <section style={styles.card}>
        <div style={styles.cardTitleRow}>
          <div>
            <h2 style={styles.cardTitle}>إضافة موظف جديد</h2>
            <p style={styles.cardSubtitle}>إنشاء حساب للمعلم أو المشرف أو المدير مع كافة البيانات الشخصية والوظيفية والفرع والمادة</p>
          </div>
        </div>

        <form onSubmit={handleAddEmployee} style={styles.addForm}>
          <div style={styles.field}>
            <label style={styles.label}>اسم الموظف *</label>
            <input
              value={newEmployee.full_name}
              onChange={(e) =>
                setNewEmployee((v) => ({ ...v, full_name: e.target.value }))
              }
              placeholder="الاسم الكامل"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>رقم الهوية الوطنية</label>
            <input
              value={newEmployee.national_id}
              onChange={(e) =>
                setNewEmployee((v) => ({ ...v, national_id: e.target.value }))
              }
              placeholder="رقم الهوية"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>الرقم الوظيفي</label>
            <input
              value={newEmployee.employee_number}
              onChange={(e) =>
                setNewEmployee((v) => ({ ...v, employee_number: e.target.value }))
              }
              placeholder="الرقم الوظيفي"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>الجنس</label>
            <select
              value={newEmployee.gender}
              onChange={(e) =>
                setNewEmployee((v) => ({ ...v, gender: e.target.value }))
              }
              style={styles.input}
            >
              <option value="">اختر الجنس</option>
              <option value="ذكر">ذكر</option>
              <option value="أنثى">أنثى</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>رقم الهاتف</label>
            <input
              value={newEmployee.phone}
              onChange={(e) =>
                setNewEmployee((v) => ({ ...v, phone: e.target.value }))
              }
              placeholder="رقم الهاتف"
              style={styles.input}
              dir="ltr"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>العنوان</label>
            <input
              value={newEmployee.address}
              onChange={(e) =>
                setNewEmployee((v) => ({ ...v, address: e.target.value }))
              }
              placeholder="العنوان السكني"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>مكان العمل</label>
            <input
              value={newEmployee.workplace}
              onChange={(e) =>
                setNewEmployee((v) => ({ ...v, workplace: e.target.value }))
              }
              placeholder="مكان العمل / المدرسة"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>البريد الإلكتروني</label>
            <input
              type="email"
              value={newEmployee.email}
              onChange={(e) =>
                setNewEmployee((v) => ({ ...v, email: e.target.value }))
              }
              placeholder="البريد الإلكتروني"
              style={styles.input}
              dir="ltr"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>الفرع</label>
            <select
              value={newEmployee.branch_id}
              onChange={(e) =>
                setNewEmployee((v) => ({ ...v, branch_id: e.target.value, subject_id: '' }))
              }
              style={styles.input}
            >
              <option value="">اختر الفرع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branch_name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>التخصص</label>
            <input
              value={newEmployee.specialization}
              onChange={(e) =>
                setNewEmployee((v) => ({ ...v, specialization: e.target.value }))
              }
              placeholder="التخصص"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>المادة الدراسية</label>
            <select
              value={newEmployee.subject_id}
              onChange={(e) =>
                setNewEmployee((v) => ({ ...v, subject_id: e.target.value }))
              }
              style={styles.input}
            >
              <option value="">اختر المادة</option>
              {subjects
                .filter((sub) => !newEmployee.branch_id || String(sub.branch_id) === String(newEmployee.branch_id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.subject_name}
                  </option>
                ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>الوظيفة (الصلاحية)</label>
            <select
              value={newEmployee.role}
              onChange={(e) =>
                setNewEmployee((v) => ({ ...v, role: e.target.value }))
              }
              style={styles.input}
            >
              <option value="Teacher">Teacher</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <div style={{ ...styles.field, gridColumn: 'span 4', borderTop: '1px solid #334155', paddingTop: '12px', marginTop: '6px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
            <div>
              <label style={styles.label}>اسم المستخدم *</label>
              <input
                value={newEmployee.username}
                onChange={(e) =>
                  setNewEmployee((v) => ({ ...v, username: e.target.value }))
                }
                placeholder="اسم المستخدم"
                style={styles.input}
                dir="ltr"
                autoComplete="off"
              />
            </div>

            <div>
              <label style={styles.label}>كلمة المرور *</label>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', lineHeight: 1.7 }}>{PASSWORD_POLICY_MESSAGE}</div>
              <div style={styles.passwordWrapper}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newEmployee.password}
                  onChange={(e) =>
                    setNewEmployee((v) => ({ ...v, password: e.target.value }))
                  }
                  placeholder="كلمة المرور"
                  style={{ ...styles.input, paddingLeft: '38px' }}
                  dir="ltr"
                  autoComplete="new-password"
                />
                <span
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={styles.eyeIcon}
                  title={showNewPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showNewPassword ? '👁️‍🗨️' : '👁️'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ gridColumn: 'span 4', display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button disabled={saving} type="submit" style={styles.addButton}>
              {saving ? '⏳ جاري الحفظ...' : '➕ إضافة الموظف'}
            </button>
          </div>
        </form>
      </section>

      <section style={styles.card}>
        <div style={styles.cardTitleRow}>
          <div>
            <h2 style={styles.cardTitle}>الموظفون</h2>
            <p style={styles.cardSubtitle}>اضغط على اسم الموظف لعرض وتعديل كافة بياناته الشخصية والوظيفية</p>
          </div>
        </div>

        {loading ? (
          <div style={styles.loading}>جاري تحميل الموظفين...</div>
        ) : employees.length === 0 ? (
          <div style={styles.empty}>لا يوجد موظفون مسجلون</div>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: '4%' }}>#</th>
                  <th style={{ ...styles.th, width: '15%' }}>اسم الموظف</th>
                  <th style={{ ...styles.th, width: '12%' }}>الوظيفة</th>
                  <th style={{ ...styles.th, width: '10%' }}>الفرع والمادة</th>
                  <th style={{ ...styles.th, width: '9%' }}>الهاتف</th>
                  <th style={{ ...styles.th, width: '11%' }}>تاريخ الدخول</th>
                  <th style={{ ...styles.th, width: '10%' }}>الحالة</th>
                  <th style={{ ...styles.th, width: '6%' }}>الحساب</th>
                  <th style={{ ...styles.th, width: '23%' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee, index) => {
                  const online = isActuallyOnline(employee);
                  const accountActive = employee.is_active !== false;
                  const isCurrent = String(employee.id) === String(currentUserId);
                  const isSendingEmail = sendingEmailId === employee.id;

                  const branchName = employee.branches?.branch_name || '—';
                  const subjectName = employee.subjects?.subject_name || '—';

                  const displayName = formatEmployeeName(employee.full_name);

                  return (
                    <tr key={employee.id}>
                      <td style={styles.td}>{index + 1}</td>
                      <td style={{ ...styles.td, fontWeight: 800 }}>
                        <div 
                          onClick={() => {
                            setSelectedEmployeeModal(employee);
                            setEditEmployeeForm({
                              full_name: employee.full_name || '',
                              national_id: employee.national_id || '',
                              employee_number: employee.employee_number || '',
                              gender: employee.gender || '',
                              phone: employee.phone || '',
                              address: employee.address || '',
                              workplace: employee.workplace || '',
                              email: employee.email || '',
                              role: normalizeRole(employee.role),
                              branch_id: employee.branch_id || '',
                              specialization: employee.specialization || '',
                              subject_id: employee.subject_id || ''
                            });
                          }}
                          style={{ ...styles.cellText, color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px', fontWeight: '900' }}
                          title={`الاسم الكامل: ${employee.full_name || 'بدون اسم'} - اضغط لعرض وتعديل بيانات الموظف`}
                        >
                          ✏️ {displayName}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.roleBadge}>
                          {normalizeRole(employee.role)}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontSize: '11px', color: '#38bdf8' }}>الفرع: {branchName}</div>
                        <div style={{ fontSize: '11px', color: '#cbd5e1' }}>المادة: {subjectName}</div>
                      </td>
                      <td style={{ ...styles.td, direction: 'ltr' }}>
                        <div style={styles.cellText}>{employee.phone || '—'}</div>
                      </td>
                      <td style={{ ...styles.td, direction: 'ltr' }}>
                        <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{formatDateTime(employee.last_login)}</div>
                      </td>
                      <td style={styles.td}>
                        {online ? (
                          <span style={styles.onlineBadge}>
                            <span className="online-dot" />
                            متواجد
                          </span>
                        ) : (
                          <span style={styles.offlineBadge}>
                            <span className="offline-dot" />
                            غير متواجد
                          </span>
                        )}
                      </td>
                      <td style={styles.td}>
                        {accountActive ? (
                          <span style={styles.activeBadge}>مفعل</span>
                        ) : (
                          <span style={styles.disabledBadge}>معطل</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionsContainer}>
                          <div style={styles.actionsRow}>
                            <button
                              onClick={() => sendPasswordEmail(employee)}
                              disabled={isSendingEmail}
                              style={{ ...styles.actionBtn, background: '#7c3aed' }}
                              title="إرسال كلمة المرور عبر الإيميل"
                            >
                              {isSendingEmail ? '...' : '✉️ إرسال'}
                            </button>
                            <button
                              onClick={() => openPasswordModal(employee)}
                              style={{ ...styles.actionBtn, background: '#1d4ed8' }}
                              title="تغيير كلمة المرور"
                            >
                              🔑 مرور
                            </button>
                          </div>
                          <div style={styles.actionsRow}>
                            <button
                              onClick={() => toggleAccount(employee)}
                              disabled={isCurrent}
                              style={{ 
                                ...styles.actionBtn, 
                                background: accountActive ? '#c2410c' : '#15803d',
                                opacity: isCurrent ? 0.5 : 1 
                              }}
                              title={accountActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                            >
                              {accountActive ? '🔒 تعطيل' : '🔓 تفعيل'}
                            </button>
                            <button
                              onClick={() => deleteEmployee(employee)}
                              disabled={isCurrent}
                              style={{ 
                                ...styles.actionBtn, 
                                background: '#b91c1c',
                                opacity: isCurrent ? 0.5 : 1 
                              }}
                              title="حذف الموظف"
                            >
                              🗑️ حذف
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* موديل تعديل بيانات الموظف من قبل الأدمن */}
      {selectedEmployeeModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={styles.modalTitle}>✏️ تعديل بيانات الموظف</h3>
            <p style={styles.modalText}>اسم المستخدم: <strong>{selectedEmployeeModal.username}</strong> (لا يمكن تعديل اسم المستخدم من هنا)</p>

            <form onSubmit={handleUpdateEmployeeDetails}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={styles.label}>الاسم الكامل</label>
                  <input
                    type="text"
                    value={editEmployeeForm.full_name}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, full_name: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={styles.label}>الوظيفة (الصلاحية)</label>
                  <select
                    value={editEmployeeForm.role}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, role: e.target.value })}
                    style={styles.input}
                  >
                    <option value="Teacher">Teacher</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={styles.label}>الفرع</label>
                  <select
                    value={editEmployeeForm.branch_id}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, branch_id: e.target.value, subject_id: '' })}
                    style={styles.input}
                  >
                    <option value="">اختر الفرع</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.branch_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={styles.label}>المادة الدراسية</label>
                  <select
                    value={editEmployeeForm.subject_id}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, subject_id: e.target.value })}
                    style={styles.input}
                  >
                    <option value="">اختر المادة</option>
                    {subjects
                      .filter((sub) => !editEmployeeForm.branch_id || String(sub.branch_id) === String(editEmployeeForm.branch_id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.subject_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={styles.label}>التخصص</label>
                  <input
                    type="text"
                    value={editEmployeeForm.specialization}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, specialization: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={styles.label}>رقم الهوية الوطنية</label>
                  <input
                    type="text"
                    value={editEmployeeForm.national_id}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, national_id: e.target.value })}
                    style={styles.input}
                    dir="ltr"
                  />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={styles.label}>الرقم الوظيفي</label>
                  <input
                    type="text"
                    value={editEmployeeForm.employee_number}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, employee_number: e.target.value })}
                    style={styles.input}
                    dir="ltr"
                  />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={styles.label}>الجنس</label>
                  <select
                    value={editEmployeeForm.gender}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, gender: e.target.value })}
                    style={styles.input}
                  >
                    <option value="">اختر الجنس</option>
                    <option value="ذكر">ذكر</option>
                    <option value="أنثى">أنثى</option>
                  </select>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={styles.label}>رقم الهاتف</label>
                  <input
                    type="text"
                    value={editEmployeeForm.phone}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, phone: e.target.value })}
                    style={styles.input}
                    dir="ltr"
                  />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={styles.label}>العنوان السكني</label>
                  <input
                    type="text"
                    value={editEmployeeForm.address}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, address: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={styles.label}>مكان العمل</label>
                  <input
                    type="text"
                    value={editEmployeeForm.workplace}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, workplace: e.target.value })}
                    style={styles.input}
                  />
                </div>

                <div style={{ marginBottom: '10px', gridColumn: 'span 2' }}>
                  <label style={styles.label}>البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={editEmployeeForm.email}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, email: e.target.value })}
                    style={styles.input}
                    dir="ltr"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button type="submit" disabled={saving} style={styles.addButton}>
                  {saving ? '⏳ جاري الحفظ...' : '💾 حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedEmployeeModal(null)}
                  style={styles.cancelButton}
                >
                  ❌ إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>🔑 تغيير كلمة المرور</h3>
            <p style={styles.modalText}>
              الموظف: <strong>{passwordModal.full_name || passwordModal.username}</strong>
            </p>

            <div style={{ marginBottom: '10px' }}>
              <label style={styles.label}>كلمة المرور القديمة (كلمة مرور الأدمن)</label>
              <div style={styles.passwordWrapper}>
                <input
                  type={showOldPass ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور القديمة"
                  style={{ ...styles.input, paddingLeft: '38px' }}
                  dir="ltr"
                  autoComplete="current-password"
                />
                <span
                  onClick={() => setShowOldPass(!showOldPass)}
                  style={styles.eyeIcon}
                >
                  {showOldPass ? '👁️‍🗨️' : '👁️'}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={styles.label}>كلمة المرور الجديدة (قوية)</label>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', lineHeight: 1.7 }}>{PASSWORD_POLICY_MESSAGE}</div>
              <div style={styles.passwordWrapper}>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="كلمة المرور الجديدة"
                  style={{ ...styles.input, paddingLeft: '38px' }}
                  dir="ltr"
                  autoComplete="new-password"
                />
                <span
                  onClick={() => setShowNewPass(!showNewPass)}
                  style={styles.eyeIcon}
                >
                  {showNewPass ? '👁️‍🗨️' : '👁️'}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={styles.label}>تأكيد كلمة المرور الجديدة</label>
              <div style={styles.passwordWrapper}>
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور الجديدة"
                  style={{ ...styles.input, paddingLeft: '38px' }}
                  dir="ltr"
                  autoComplete="new-password"
                />
                <span
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  style={styles.eyeIcon}
                >
                  {showConfirmPass ? '👁️‍🗨️' : '👁️'}
                </span>
              </div>
            </div>

            <div style={styles.modalActions}>
              <button onClick={savePassword} disabled={saving} style={styles.addButton}>
                {saving ? '⏳ جاري الحفظ...' : '💾 حفظ'}
              </button>
              <button
                onClick={() => {
                  setPasswordModal(null);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                style={styles.cancelButton}
              >
                ❌ إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes onlinePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .35; transform: scale(.78); }
        }
        .online-dot {
          width: 7px; height: 7px; background: #22c55e; border-radius: 50%;
          display: inline-block; animation: onlinePulse 1.2s infinite; flex-shrink: 0;
        }
        .offline-dot {
          width: 7px; height: 7px; background: #94a3b8; border-radius: 50%;
          display: inline-block; flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}

/* =========================================================
   EMPLOYEE PROFILE
========================================================= */

function EmployeeProfile({ onBack, activeUsername, activeUserId }) {
  const [employee, setEmployee] = useState(null);
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: '',
    email: '',
    address: '',
    workplace: '',
    branch_id: '',
    specialization: '',
    subject_id: ''
  });

  const [passwordModal, setPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [saving, setSaving] = useState(false);

  const showMessage = useCallback((type, text) => {
    setMessage({ type, text });
    window.setTimeout(() => {
      setMessage({ type: '', text: '' });
    }, 2000);
  }, []);

  const fetchMetaData = useCallback(async () => {
    const [branchesRes, subjectsRes] = await Promise.all([
      supabase.from('branches').select('*').order('branch_name', { ascending: true }),
      supabase.from('subjects').select('*').order('subject_name', { ascending: true })
    ]);

    if (!branchesRes.error) setBranches(branchesRes.data || []);
    if (!subjectsRes.error) setSubjects(subjectsRes.data || []);
  }, []);

  const fetchEmployee = useCallback(async () => {
    let query = supabase.from('supervisors').select('*, branches(branch_name), subjects(subject_name)');
    if (activeUserId) {
      query = query.eq('id', activeUserId);
    } else {
      query = query.eq('username', activeUsername);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error(error);
      showMessage('error', 'تعذر جلب بيانات الحساب');
      setLoading(false);
      return;
    }

    setEmployee(data || null);
    setLoading(false);
  }, [activeUserId, activeUsername, showMessage]);

  useEffect(() => {
    fetchMetaData();
    fetchEmployee();
    const timer = window.setInterval(fetchEmployee, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [fetchEmployee, fetchMetaData]);

  useEffect(() => {
    if (!employee?.id) return undefined;

    const updateHeartbeat = async () => {
      await supabase
        .from('supervisors')
        .update({
          is_online: true,
          last_seen: new Date().toISOString()
        })
        .eq('id', employee.id)
        .eq('is_active', true);
    };

    updateHeartbeat();
    const timer = window.setInterval(updateHeartbeat, HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [employee?.id]);

  const handleLogoutPresence = async () => {
    if (!employee?.id) return;
    await supabase
      .from('supervisors')
      .update({
        is_online: false,
        last_seen: new Date().toISOString()
      })
      .eq('id', employee.id);
  };

  const handleOpenEditModal = () => {
    if (!employee) return;
    setEditForm({
      phone: employee.phone || '',
      email: employee.email || '',
      address: employee.address || '',
      workplace: employee.workplace || '',
      branch_id: employee.branch_id || '',
      specialization: employee.specialization || '',
      subject_id: employee.subject_id || ''
    });
    setEditProfileModal(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!employee?.id) return;

    setSaving(true);
    const { error } = await supabase
      .from('supervisors')
      .update({
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || null,
        address: editForm.address.trim() || null,
        workplace: editForm.workplace.trim() || null,
        branch_id: editForm.branch_id ? parseInt(editForm.branch_id, 10) : null,
        specialization: editForm.specialization.trim() || null,
        subject_id: editForm.subject_id ? parseInt(editForm.subject_id, 10) : null
      })
      .eq('id', employee.id);

    setSaving(false);

    if (error) {
      console.error(error);
      showMessage('error', 'تعذر تحديث بيانات الحساب');
      return;
    }

    setEditProfileModal(false);
    showMessage('success', 'تم تحديث بياناتك بنجاح');
    fetchEmployee();
  };

  const savePassword = async () => {
    if (!employee?.id) return;

    if (!oldPassword.trim()) {
      showMessage('error', 'يرجى إدخال كلمة المرور القديمة');
      return;
    }

    const { data: oldPasswordValid, error: oldPasswordError } = await supabase.rpc('verify_supervisor_password', {
      p_username: employee.username || '',
      p_password: oldPassword.trim()
    });
    if (oldPasswordError || oldPasswordValid !== true) {
      showMessage('error', 'كلمة المرور القديمة غير صحيحة');
      return;
    }

    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    const newPolicy = validatePasswordPolicy(trimmedNew);
    if (!newPolicy.valid) {
      showMessage('error', PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (trimmedNew !== trimmedConfirm) {
      showMessage('error', 'كلمة المرور الجديدة وتأكيدها غير متطابقتين');
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('supervisors')
      .update({ password: trimmedNew })
      .eq('id', employee.id);

    setSaving(false);

    if (error) {
      console.error(error);
      showMessage('error', 'تعذر تغيير كلمة المرور');
      return;
    }

    setPasswordModal(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showMessage('success', 'تم تغيير كلمة المرور بنجاح');
  };

  const handleBack = async () => {
    await handleLogoutPresence();
    if (typeof onBack === 'function') {
      onBack();
    } else {
      window.location.reload();
    }
  };

  if (loading) {
    return <div style={styles.loadingPage}>جاري تحميل بيانات الحساب...</div>;
  }

  if (!employee) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>لم يتم العثور على الحساب</h2>
          <button onClick={handleBack} style={styles.backButton}>
            ⬅️ رجوع
          </button>
        </div>
      </div>
    );
  }

  const online = isActuallyOnline(employee);
  const branchName = employee.branches?.branch_name || '—';
  const subjectName = employee.subjects?.subject_name || '—';

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <div style={styles.welcome}>أهلاً، {employee.full_name || employee.username}</div>
          <div style={styles.pageSubtitle}>بيانات حسابك الشخصي والوظيفي</div>
        </div>

        <button onClick={handleBack} style={styles.backButton}>
          ⬅️ الرئيسية
        </button>
      </div>

      {message.text && (
        <div
          style={{
            ...styles.message,
            ...(message.type === 'error' ? styles.errorMessage : styles.successMessage)
          }}
        >
          {message.text}
        </div>
      )}

      <section style={styles.profileCard}>
        <div style={styles.profileIcon}>👤</div>
        <h2 style={styles.profileName}>{employee.full_name || employee.username}</h2>
        <div style={styles.profileRole}>{normalizeRole(employee.role)}</div>

        <div style={online ? styles.onlineBadgeLarge : styles.offlineBadgeLarge}>
          <span className={online ? 'online-dot' : 'offline-dot'} />
          {online ? 'متواجد' : 'غير متواجد'}
        </div>

        <div style={styles.profileGrid}>
          <InfoItem label="الاسم الكامل" value={employee.full_name || '—'} />
          <InfoItem label="اسم المستخدم" value={employee.username || '—'} ltr />
          <InfoItem label="الوظيفة" value={normalizeRole(employee.role)} />
          <InfoItem label="الفرع" value={branchName} />
          <InfoItem label="المادة الدراسية" value={subjectName} />
          <InfoItem label="التخصص" value={employee.specialization || '—'} />
          <InfoItem label="رقم الهوية الوطنية" value={employee.national_id || '—'} ltr />
          <InfoItem label="الرقم الوظيفي" value={employee.employee_number || '—'} ltr />
          <InfoItem label="الجنس" value={employee.gender || '—'} />
          <InfoItem label="العنوان" value={employee.address || '—'} />
          <InfoItem label="رقم الهاتف" value={employee.phone || '—'} ltr />
          <InfoItem label="البريد الإلكتروني" value={employee.email || '—'} ltr />
          <InfoItem label="مكان العمل" value={employee.workplace || '—'} />
          <InfoItem label="تاريخ إنشاء الحساب" value={formatDateTime(employee.created_at)} ltr />
          <InfoItem label="آخر تسجيل دخول" value={formatDateTime(employee.last_login)} ltr />
          <InfoItem label="آخر ظهور" value={formatDateTime(employee.last_seen)} ltr />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '22px' }}>
          <button
            onClick={handleOpenEditModal}
            style={styles.editProfileButton}
          >
            ✏️ تعديل بياناتي الشخصية والوظيفية
          </button>
          
          <button
            onClick={() => {
              setOldPassword('');
              setNewPassword('');
              setConfirmPassword('');
              setShowOldPass(false);
              setShowNewPass(false);
              setShowConfirmPass(false);
              setPasswordModal(true);
            }}
            style={styles.changePasswordButton}
          >
            🔑 تغيير كلمة المرور
          </button>
        </div>
      </section>

      {editProfileModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={styles.modalTitle}>✏️ تعديل بياناتي</h3>
            <p style={styles.modalText}>يمكنك تحديث الفرع، المادة، التخصص وباقي بيانات الاتصال والعمل.</p>

            <form onSubmit={handleSaveProfile}>
              <div style={{ marginBottom: '12px' }}>
                <label style={styles.label}>الفرع</label>
                <select
                  value={editForm.branch_id}
                  onChange={(e) => setEditForm({ ...editForm, branch_id: e.target.value, subject_id: '' })}
                  style={styles.input}
                >
                  <option value="">اختر الفرع</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branch_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={styles.label}>المادة الدراسية</label>
                <select
                  value={editForm.subject_id}
                  onChange={(e) => setEditForm({ ...editForm, subject_id: e.target.value })}
                  style={styles.input}
                >
                  <option value="">اختر المادة</option>
                  {subjects
                    .filter((sub) => !editForm.branch_id || String(sub.branch_id) === String(editForm.branch_id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subject_name}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={styles.label}>التخصص</label>
                <input
                  type="text"
                  value={editForm.specialization}
                  onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
                  placeholder="التخصص"
                  style={styles.input}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={styles.label}>رقم الهاتف</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="رقم الهاتف"
                  style={styles.input}
                  dir="ltr"
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={styles.label}>البريد الإلكتروني</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="البريد الإلكتروني"
                  style={styles.input}
                  dir="ltr"
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={styles.label}>العنوان السكني</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="العنوان السكني"
                  style={styles.input}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={styles.label}>مكان العمل</label>
                <input
                  type="text"
                  value={editForm.workplace}
                  onChange={(e) => setEditForm({ ...editForm, workplace: e.target.value })}
                  placeholder="مكان العمل / المدرسة / القسم"
                  style={styles.input}
                />
              </div>

              <div style={styles.modalActions}>
                <button type="submit" disabled={saving} style={styles.addButton}>
                  {saving ? '⏳ جاري الحفظ...' : '💾 حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditProfileModal(false)}
                  style={styles.cancelButton}
                >
                  ❌ إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>🔑 تغيير كلمة المرور</h3>

            <div style={{ marginBottom: '10px' }}>
              <label style={styles.label}>كلمة المرور القديمة</label>
              <div style={styles.passwordWrapper}>
                <input
                  type={showOldPass ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور القديمة"
                  style={{ ...styles.input, paddingLeft: '38px' }}
                  dir="ltr"
                  autoComplete="current-password"
                />
                <span
                  onClick={() => setShowOldPass(!showOldPass)}
                  style={styles.eyeIcon}
                >
                  {showOldPass ? '👁️‍🗨️' : '👁️'}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={styles.label}>كلمة المرور الجديدة (قوية)</label>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', lineHeight: 1.7 }}>{PASSWORD_POLICY_MESSAGE}</div>
              <div style={styles.passwordWrapper}>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="كلمة المرور الجديدة"
                  style={{ ...styles.input, paddingLeft: '38px' }}
                  dir="ltr"
                  autoComplete="new-password"
                />
                <span
                  onClick={() => setShowNewPass(!showNewPass)}
                  style={styles.eyeIcon}
                >
                  {showNewPass ? '👁️‍🗨️' : '👁️'}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={styles.label}>تأكيد كلمة المرور الجديدة</label>
              <div style={styles.passwordWrapper}>
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور الجديدة"
                  style={{ ...styles.input, paddingLeft: '38px' }}
                  dir="ltr"
                  autoComplete="new-password"
                />
                <span
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  style={styles.eyeIcon}
                >
                  {showConfirmPass ? '👁️‍🗨️' : '👁️'}
                </span>
              </div>
            </div>

            <div style={styles.modalActions}>
              <button onClick={savePassword} disabled={saving} style={styles.addButton}>
                {saving ? '⏳ جاري الحفظ...' : '💾 حفظ كلمة المرور'}
              </button>
              <button
                onClick={() => {
                  setPasswordModal(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                style={styles.cancelButton}
              >
                ❌ إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes onlinePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .35; transform: scale(.78); }
        }
        .online-dot { width: 9px; height: 9px; background: #22c55e; border-radius: 50%; display: inline-block; animation: onlinePulse 1.2s infinite; }
        .offline-dot { width: 9px; height: 9px; background: #94a3b8; border-radius: 50%; display: inline-block; }
      `}</style>
    </div>
  );
}

function InfoItem({ label, value, ltr = false }) {
  return (
    <div style={styles.infoItem}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={{ ...styles.infoValue, ...(ltr ? { direction: 'ltr' } : {}) }}>
        {value}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#e2e8f0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    width: '100%',
    maxWidth: '100vw'
  },
  page: {
    minHeight: '100vh',
    width: '100%',
    maxWidth: '1320px',
    margin: '0 auto',
    background: '#0f172a',
    padding: '16px',
    boxSizing: 'border-box',
    overflowX: 'hidden'
  },
  topBar: {
    width: '100%',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '14px',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    boxSizing: 'border-box'
  },
  welcome: { color: '#f8fafc', fontSize: '20px', fontWeight: 900 },
  pageSubtitle: { color: '#94a3b8', fontSize: '13px', marginTop: '3px' },
  backButton: {
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '14px',
    whiteSpace: 'nowrap'
  },
  message: {
    width: '100%',
    margin: '12px auto',
    padding: '12px 16px',
    borderRadius: '9px',
    textAlign: 'center',
    fontWeight: 700,
    boxSizing: 'border-box',
    fontSize: '14px'
  },
  successMessage: { background: '#064e3b', color: '#a7f3d0', border: '1px solid #10b981' },
  errorMessage: { background: '#7f1d1d', color: '#fecaca', border: '1px solid #ef4444' },
  statsRow: {
    width: '100%',
    margin: '12px 0',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px'
  },
  statCard: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '14px',
    textAlign: 'center',
    minWidth: 0
  },
  statNumber: { fontSize: '24px', fontWeight: 900, color: '#60a5fa' },
  statLabel: { color: '#94a3b8', fontSize: '13px', marginTop: '3px' },
  card: {
    width: '100%',
    margin: '0 0 14px',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '14px',
    padding: '16px',
    boxSizing: 'border-box',
    overflow: 'hidden'
  },
  cardTitleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' },
  cardTitle: { margin: 0, color: '#f8fafc', fontSize: '18px', fontWeight: 900 },
  cardSubtitle: { margin: '4px 0 0', color: '#94a3b8', fontSize: '12px' },
  addForm: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '10px',
    alignItems: 'end'
  },
  field: { minWidth: 0 },
  label: { display: 'block', marginBottom: '5px', color: '#cbd5e1', fontSize: '13px', fontWeight: 800 },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: '7px',
    border: '1px solid #475569',
    background: '#0f172a',
    color: '#f8fafc',
    outline: 'none',
    fontSize: '14px',
    minWidth: 0
  },
  passwordWrapper: {
    position: 'relative',
    width: '100%',
    display: 'flex',
    alignItems: 'center'
  },
  eyeIcon: {
    position: 'absolute',
    left: '10px',
    cursor: 'pointer',
    fontSize: '16px',
    userSelect: 'none',
    zIndex: 2
  },
    addButton: {
    border: 'none',
    background: '#16a34a',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: '7px',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '14px',
    whiteSpace: 'nowrap',
    width: '100%'
  },
  loading: { textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '14px' },
  empty: { textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '14px' },
  tableContainer: { width: '100%', overflowX: 'auto', boxSizing: 'border-box' },
  table: { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', boxSizing: 'border-box', minWidth: '950px' },
  th: {
    background: '#0f172a',
    color: '#cbd5e1',
    padding: '10px 6px',
    fontSize: '12px',
    fontWeight: 900,
    borderBottom: '1px solid #334155',
    textAlign: 'center'
  },
  td: {
    padding: '10px 6px',
    borderBottom: '1px solid #334155',
    color: '#e2e8f0',
    fontSize: '12px',
    textAlign: 'center',
    verticalAlign: 'middle',
    wordBreak: 'break-word',
    overflow: 'hidden'
  },
  cellText: { maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  roleBadge: {
    display: 'inline-block',
    background: '#312e81',
    color: '#c7d2fe',
    borderRadius: '999px',
    padding: '5px 9px',
    fontSize: '11px',
    fontWeight: 800
  },
  onlineBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    background: '#064e3b',
    color: '#86efac',
    border: '1px solid #15803d',
    borderRadius: '999px',
    padding: '5px 9px',
    fontSize: '11px',
    fontWeight: 800
  },
  offlineBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    background: '#334155',
    color: '#cbd5e1',
    border: '1px solid #475569',
    borderRadius: '999px',
    padding: '5px 9px',
    fontSize: '11px',
    fontWeight: 800
  },
  activeBadge: {
    display: 'inline-block',
    background: '#064e3b',
    color: '#86efac',
    borderRadius: '999px',
    padding: '5px 9px',
    fontSize: '11px',
    fontWeight: 800
  },
  disabledBadge: {
    display: 'inline-block',
    background: '#450a0a',
    color: '#fca5a5',
    borderRadius: '999px',
    padding: '5px 9px',
    fontSize: '11px',
    fontWeight: 800
  },
  actionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '100%',
    alignItems: 'stretch'
  },
  actionsRow: {
    display: 'flex',
    gap: '4px',
    justifyContent: 'center',
    width: '100%'
  },
  actionBtn: {
    border: 'none',
    color: '#fff',
    padding: '6px 4px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 800,
    flex: 1,
    textAlign: 'center',
    whiteSpace: 'nowrap'
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000, boxSizing: 'border-box'
  },
  modal: {
    width: '100%', maxWidth: '425px', background: '#1e293b', border: '1px solid #475569',
    borderRadius: '15px', padding: '20px', boxSizing: 'border-box', boxShadow: '0 20px 50px rgba(0,0,0,.45)'
  },
  modalTitle: { margin: '0 0 6px', color: '#f8fafc', fontSize: '18px' },
  modalText: { color: '#cbd5e1', fontSize: '13px', marginBottom: '12px' },
  modalActions: { display: 'flex', gap: '8px', marginTop: '14px' },
  cancelButton: {
    border: 'none', background: '#475569', color: '#fff',
    padding: '10px 16px', borderRadius: '7px', cursor: 'pointer', fontWeight: 800, fontSize: '14px', width: '100%'
  },
  loadingPage: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0f172a', color: '#94a3b8', padding: '20px', boxSizing: 'border-box', fontSize: '14px'
  },
  profileCard: {
    width: '100%', maxWidth: '900px', margin: '20px auto', background: '#1e293b',
    border: '1px solid #334155', borderRadius: '18px', padding: '24px', textAlign: 'center', boxSizing: 'border-box'
  },
  profileIcon: {
    width: '64px', height: '64px', margin: '0 auto 10px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#312e81', fontSize: '26px'
  },
  profileName: { margin: 0, color: '#f8fafc', fontSize: '22px', fontWeight: 900 },
  profileRole: { color: '#a5b4fc', fontWeight: 800, marginTop: '4px', fontSize: '14px' },
  onlineBadgeLarge: {
    display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px',
    background: '#064e3b', color: '#86efac', border: '1px solid #15803d', borderRadius: '999px', padding: '7px 14px', fontWeight: 800, fontSize: '13px'
  },
  offlineBadgeLarge: {
    display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px',
    background: '#334155', color: '#cbd5e1', border: '1px solid #475569', borderRadius: '999px', padding: '7px 14px', fontWeight: 800, fontSize: '13px'
  },
  profileGrid: {
    marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '10px', textAlign: 'right'
  },
  infoItem: { background: '#0f172a', border: '1px solid #334155', borderRadius: '9px', padding: '10px 12px', minWidth: 0 },
  infoLabel: { color: '#94a3b8', fontSize: '11px', marginBottom: '4px', fontWeight: 700 },
  infoValue: { color: '#f8fafc', fontSize: '13px', fontWeight: 800, wordBreak: 'break-word' },
  editProfileButton: {
    marginTop: '18px', border: 'none', background: '#16a34a', color: '#fff',
    padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 900, fontSize: '14px'
  },
  changePasswordButton: {
    marginTop: '18px', border: 'none', background: '#2563eb', color: '#fff',
    padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 900, fontSize: '14px'
  }
};