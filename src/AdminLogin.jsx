import React, { useState, useEffect } from 'react';
import ministryLogo from './logo.png';
import raedLogo from './raed-logo1.jpg';
import programLogo from './program_logo.png';
import { FaEnvelope, FaFacebookF, FaLinkedinIn, FaWhatsapp } from 'react-icons/fa';

import AcademicManager from './AcademicManager';
import AddQuestion from './add_question';
import ManageQuestion from './manage_question';
import AddExam from './add_exam';
import ManageExam from './manage_exam';
import AddStudent from './add_student';
import RegistrationCyclesManager from './RegistrationCyclesManager';
import ManageStudent from './manage_student';
import StatisticsManager from './StatisticsManager';
import EmployeesManager from './EmployeesManager';
import PermissionsManager from './PermissionsManager';
import DirectorateSchoolManager from './DirectorateSchoolManager';
import ViewQuestions from './ViewQuestions';
import ViewExams from './ViewExams';
import StudentResultsManager from './StudentResultsManager';
import StudentResultView from './StudentResultView';
import CheatingMonitor from './CheatingMonitor';
import ResultAnnouncementManager from './result_announcements';
import EmployeeMessages from './EmployeeMessages';
import StudentSupportMessages from './StudentSupportMessages';
import Notes from './Notes';
import InstitutionManagementProfile from './InstitutionManagementProfile';

function readInstitutionManagementProfile() {
  try {
    const raw = window.localStorage.getItem('currentInstitutionData');
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

function useInstitutionManagementProfile() {
  const [institution, setInstitution] = React.useState(() =>
    readInstitutionManagementProfile()
  );

  React.useEffect(() => {
    const refresh = () => setInstitution(readInstitutionManagementProfile());
    refresh();

    // InstitutionManagementProfile stores the latest saved profile in localStorage.
    const timer = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return institution;
}

import InstitutionManagement from './InstitutionManagement';
import BackupManager from './BackupManager';
import { playMenuHoverSound } from './soundUtils';
// توحيد دور الموظف القادم من employees/jobs إلى قيم واضحة تستخدمها لوحة التحكم.
function normalizeEmployeeRole(role, jobName = '', jobId = null, username = '') {
  const rawRole = String(role || '').trim().toLowerCase();
  const rawJob = String(jobName || '').trim();
  const rawUsername = String(username || '').trim().toLowerCase();

  // الحساب الإداري القديم "admin" يبقى مديرًا حتى لو كانت بيانات الوظيفة القديمة
  // تشير إلى وظيفة أخرى.
  if (rawUsername === 'admin') {
    return 'Admin';
  }

  // مدير المؤسسة المرتبط بوظيفة "مدير المؤسسة" ليس مدير النظام العام.
  if (
    rawRole === 'institutionmanager' ||
    rawRole === 'institution_manager' ||
    rawJob === 'مدير المؤسسة'
  ) {
    return 'InstitutionManager';
  }

  // المدير العام للنظام فقط يحصل على الدور Admin.
  if (
    rawRole === 'admin' ||
    rawRole === 'administrator' ||
    rawRole === 'manager' ||
    rawRole === 'مدير' ||
    rawJob === 'مدير'
  ) {
    return 'Admin';
  }

  if (
    rawRole === 'supervisor' ||
    rawRole === 'مشرف' ||
    rawJob === 'مشرف'
  ) {
    return 'Supervisor';
  }

  if (
    rawRole === 'teacher' ||
    rawRole === 'معلم' ||
    rawJob === 'معلم'
  ) {
    return 'Teacher';
  }

  if (
    rawRole === 'monitor' ||
    rawRole === 'proctor' ||
    rawRole === 'مراقب' ||
    rawJob === 'مراقب'
  ) {
    return 'Monitor';
  }

  // job_id يستخدم فقط عندما لا توجد قيمة صريحة مفهومة.
  if (Number(jobId) === 1) return 'Admin';
  if (Number(jobId) === 2) return 'Supervisor';
  if (Number(jobId) === 3) return 'Teacher';
  if (Number(jobId) === 4) return 'Monitor';

  if (['Admin', 'Supervisor', 'Teacher', 'Monitor', 'Programmer'].includes(role)) {
    return role;
  }

  return 'Teacher';
}

async function loadEmployeePermissions(supabase, jobId) {
  if (!supabase || jobId == null) return [];
  const { data, error } = await supabase
    .from('job_permissions')
    .select('permission_id, permissions(permission_key, permission_name)')
    .eq('job_id', jobId);
  if (error) {
    console.error('تعذر تحميل صلاحيات الموظف:', error);
    return [];
  }
  return (data || []).map(item => item?.permissions?.permission_key).filter(Boolean);
}

// مكون شاشة تسجيل الدخول للموظفين/المشرفين
function EmployeeLogin({ supabase, onLoginSuccess, onBack }) {
  const institution = useInstitutionManagementProfile();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // المبرمج يدخل من جدول supervisors، وعند نجاح الدخول يظهر له
      // بند "إدارة المؤسسة" فقط.
      const { data: supervisor, error: supervisorError } = await supabase
        .from('supervisors')
        .select('*')
        .eq('username', 'rprog')
        .maybeSingle();

      if (!supervisorError && supervisor && username.trim().toLowerCase() === 'rprog') {
        if (supervisor.is_active === false) {
          setErrorMessage('هذا الحساب غير نشط. يرجى مراجعة الإدارة.');
          setLoading(false);
          return;
        }

        const { data: supervisorPasswordValid, error: supervisorPasswordError } = await supabase.rpc('verify_supervisor_password', {
          p_username: username.trim(),
          p_password: password
        });
        if (supervisorPasswordError || supervisorPasswordValid !== true) {
          setErrorMessage('كلمة المرور غير صحيحة');
          setLoading(false);
          return;
        }

        // حساب المبرمج: وصول مخصص لإدارة المؤسسة فقط.
        const programmerUser = {
          ...supervisor,
          id: supervisor.id,
          username: supervisor.username,
          name: supervisor.full_name || supervisor.name || supervisor.username,
          role: 'Programmer',
          job_name: 'مبرمج',
          permissions: ['manage_institution'],
          auth_source: 'supervisors'
        };

        const nowIso = new Date().toISOString();

        // الأعمدة موجودة في جدول supervisors حسب بنية الجدول الحالية.
        const { error: activityError } = await supabase
          .from('supervisors')
          .update({ last_login: nowIso })
          .eq('id', supervisor.id);

        if (activityError) {
          console.warn('تعذر تحديث آخر تسجيل دخول للمبرمج:', activityError);
        }

        localStorage.setItem('currentUserId', String(supervisor.id));
        localStorage.setItem('currentUsername', supervisor.username || '');
        localStorage.setItem('currentUserRole', 'Programmer');
        localStorage.setItem('currentJobId', '');
        localStorage.setItem('currentJobName', 'مبرمج');
        localStorage.setItem('currentName', programmerUser.name);
        localStorage.setItem('employeePermissions', JSON.stringify(['manage_institution']));
        localStorage.setItem('authSource', 'supervisors');
        localStorage.setItem('loggedIn', 'true');

        setUsername('');
        setPassword('');
        setLoading(false);

        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess(programmerUser);
        }
        return;
      }

      // باقي المستخدمين يسجلون الدخول من جدول employees.
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('username', username.trim())
        .maybeSingle();

      if (error || !data) {
        console.error('Employee login error:', error);
        setErrorMessage('اسم الموظف غير موجود أو حدث خطأ في الاتصال');
        setLoading(false);
        return;
      }

      // الموظف المعطّل لا يستطيع الدخول.
      if (data.is_active === false) {
        setErrorMessage('هذا الحساب غير نشط. يرجى مراجعة الإدارة.');
        setLoading(false);
        return;
      }

      // التحقق من كلمة المرور باستخدام bcrypt داخل قاعدة البيانات.
      const { data: employeePasswordValid, error: employeePasswordError } = await supabase.rpc('verify_employee_password', {
        p_username: username.trim(),
        p_password: password
      });
      if (employeePasswordError || employeePasswordValid !== true) {
        setErrorMessage('كلمة المرور غير صحيحة');
        setLoading(false);
        return;
      }

      // جلب اسم الوظيفة من جدول jobs، مع وجود قيمة احتياطية من job_id.
      let jobName = data.job_name || '';
      if (!jobName && data.job_id != null) {
        const { data: jobData, error: jobError } = await supabase
          .from('jobs')
          .select('id, job_name')
          .eq('id', data.job_id)
          .maybeSingle();

        if (!jobError && jobData) {
          jobName = jobData.job_name || '';
        }
      }

      // تحويل الوظيفة/الدور إلى القيم التي يستخدمها نظام الواجهة.
      const normalizedRole = normalizeEmployeeRole(data.role, jobName, data.job_id, data.username);
      const realName = data.full_name || data.name || data.username;
      const permissions = await loadEmployeePermissions(supabase, data.job_id);

      // تحديث بيانات النشاط في جدول employees.
      const nowIso = new Date().toISOString();
      const { error: activityError } = await supabase
        .from('employees')
        .update({
          is_online: true,
          last_login: nowIso,
          last_seen: nowIso
        })
        .eq('id', data.id);

      if (activityError) {
        console.warn('تعذر تحديث وقت الدخول:', activityError);
      }

      const loggedEmployee = {
        ...data,
        name: realName,
        job_name: jobName,
        role: normalizedRole,
        permissions
      };

      // حفظ بيانات الجلسة في التخزين المحلي.
      localStorage.setItem('currentUserId', String(data.id));
      localStorage.setItem('currentUsername', data.username || '');
      localStorage.setItem('currentUserRole', normalizedRole);
      localStorage.setItem('currentJobId', data.job_id != null ? String(data.job_id) : '');
      localStorage.setItem('currentJobName', jobName || '');
      localStorage.setItem('currentName', realName);
      localStorage.setItem('employeePermissions', JSON.stringify(permissions));
      localStorage.setItem('authSource', 'employees');
      localStorage.setItem('loggedIn', 'true');

      // مسح حقول الإدخال عند النجاح.
      setUsername('');
      setPassword('');
      setLoading(false);

      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(loggedEmployee);
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('حدث خطأ أثناء تسجيل الدخول');
      setLoading(false);
    }
  };

  const focusLogin = () => {
    document.getElementById('staff-username-input')?.focus();
  };

  const currentYear = new Date().getFullYear();
  const currentInstitutionName = institution?.name_line_1 || institution?.name || institution?.official_name || '';
  const institutionLine2 = institution?.name_line_2 || '';
  const institutionLine3 = institution?.name_line_3 || '';
  const currentInstitutionLogo = institution?.logo_url || ministryLogo;

  return (
    <div className="staff-login-only-page" dir="rtl">
      <style>{`
        .staff-login-only-page {
          position: relative;
          width: 100%;
          height: 100vh;
          min-height: 620px;
          overflow: hidden;
        }
        

        .bismillah {
          position: absolute;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          color: #fff;
          font-family: "Amiri", "Traditional Arabic", serif;
          font-size: clamp(18px, 1.65vw, 28px);
          font-weight: 800;
          white-space: nowrap;
          text-shadow: 0 3px 14px rgba(0,0,0,.8);
        }
.staff-login-main {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 0;
          z-index: 2;
          padding-bottom: 58px;
        }
        .institution-brand {
          position: absolute;
          top: 24px;
          right: 22px;
          width: 210px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 3px;
        }
        .header-logo {
          width: 72px;
          height: 72px;
          object-fit: contain;
          border-radius: 50%;
          background: rgba(255,255,255,.92);
          padding: 2px;
          box-shadow: 0 5px 18px rgba(0,0,0,.35);
        }
        .institution-line {
          display: inline-block;
          color: #fff;
          background: rgba(2,16,34,.60);
          border: 1px solid rgba(255,255,255,.20);
          border-radius: 8px;
          padding: 2px 8px;
          font-size: 11px;
          line-height: 1.35;
        }
        .staff-footer {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 7px;
          width: 100%;
          z-index: 20;
          min-height: 58px;
          height: 58px;
          padding: 8px 20px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          border-top: 1px solid rgba(255,255,255,.20);
          background: rgba(1,17,35,.90);
          backdrop-filter: blur(7px);
          overflow: hidden;
        }
        .footer-brand {
          transform: translateY(-6px);
          grid-column: 1;
          justify-self: start;
          display: flex;
          align-items: center;
          gap: 9px;
          direction: ltr;
          text-align: left;
        }
        .footer-logo {
          width: 45px !important;
          height: 45px !important;
          object-fit: contain;
          border-radius: 4px;
          background: #fff;
          padding: 1px;
        }
        .brand-name {
          font-size: 12px;
          line-height: 1.25;
          font-weight: 800;
          white-space: nowrap;
        }
        .brand-role {
          margin-top: 2px;
          font-size: 9px;
          line-height: 1.2;
          opacity: .82;
          white-space: nowrap;
        }
        .social-links {
          transform: translateY(-6px);
          grid-column: 2;
          justify-self: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .social-link {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,.28);
          border-radius: 8px;
          background: rgba(255,255,255,.08);
          transition: transform .2s ease, background .2s ease;
        }
        .footer-copy {
          transform: translateY(-6px);
          grid-column: 3;
          justify-self: end;
          text-align: right;
          direction: rtl;
          white-space: nowrap;
        }
        .staff-footer .footer-brand,
        .staff-footer .social-links,
        .staff-footer .footer-copy {
          transform: none;
          align-self: center;
        }

        @media (max-width: 760px) {
          .staff-login-only-page {
            min-height: 100vh;
            height: 100vh;
            overflow: hidden;
          }
          .staff-login-main {
            height: auto;
            min-height: calc(100vh - 100px);
            padding-bottom: 0;
          }
          .staff-footer {
            position: relative;
            left: auto;
            right: auto;
            bottom: auto;
            z-index: 20;
            min-height: 100px;
            height: auto;
            padding: 9px 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            flex-wrap: wrap;
            overflow: visible;
          }
          .staff-footer .footer-brand,
          .staff-footer .social-links,
          .staff-footer .footer-copy {
            position: static;
            transform: none;
          }
          .staff-footer .footer-brand { order: 1; height: auto; }
          .staff-footer .social-links { order: 2; height: auto; }
          .staff-footer .footer-copy {
            order: 3;
            width: 100%;
            text-align: center;
            align-self: center;
          }
        }
      `}</style>
      <div className="staff-login-only-overlay" />
      <div className="staff-login-only-smoke" />

      <header className="staff-login-header">
        <div className="staff-login-bismillah">
          بسم الله الرحمن الرحيم
        </div>

        <div className="institution-brand" aria-label="بيانات المؤسسة">
          <img
            src={currentInstitutionLogo}
            alt={currentInstitutionName}
            className="header-logo"
            onError={(event) => {
              if (event.currentTarget.src !== ministryLogo) {
                event.currentTarget.src = ministryLogo;
              }
            }}
          />

          {currentInstitutionName ? (
            <div className="institution-line">
              {currentInstitutionName}
            </div>
          ) : null}

          {institutionLine2 ? (
            <div className="institution-line">{institutionLine2}</div>
          ) : null}

          {institutionLine3 ? (
            <div className="institution-line">{institutionLine3}</div>
          ) : null}
        </div>
      </header>

      <main className="staff-login-main">
        <section className="staff-login-only-card" aria-label="تسجيل دخول الموظفين">
          <button
            type="button"
            className="staff-login-only-home staff-login-only-home-top"
            onClick={() => {
              if (typeof onBack === 'function') {
                onBack();
              } else {
                window.location.reload();
              }
            }}
            aria-label="العودة إلى الصفحة الرئيسية"
            title="الصفحة الرئيسية"
          >
            🏠
          </button>

          <div className="staff-login-only-program-brand">
            <img src={programLogo} alt="برنامج الامتحانات الالكتروني" />
            <div className="staff-login-program-title">برنامج الامتحانات الالكتروني</div>
          </div>

          <div className="staff-login-only-divider" />
          <h1>تسجيل دخول الموظفين</h1>
          <p>الدخول إلى نظام إدارة الامتحانات الإلكترونية</p>

          {errorMessage && (
            <div className="staff-login-only-error">⚠️ {errorMessage}</div>
          )}

          <form onSubmit={handleLogin} className="staff-login-only-form">
            <label htmlFor="staff-username-input">اسم المستخدم</label>
            <input
              id="staff-username-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="أدخل اسم المستخدم"
              autoComplete="username"
              autoFocus
            />

            <label htmlFor="staff-password-input">كلمة المرور</label>
            <div className="staff-login-only-password">
              <input
                id="staff-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="staff-login-only-toggle"
                onClick={() => setShowPassword(prev => !prev)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            <button type="submit" disabled={loading} className="staff-login-only-submit">
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
              <span>↪</span>
            </button>
          </form>
        </section>
      </main>

      <footer className="staff-footer">
        <div className="footer-brand">
          <img src={raedLogo} alt="Raed Logo" className="footer-logo" />
          <div>
            <div className="brand-name">ENG. RAED ELSAIDI</div>
            <div className="brand-role">Full Stack Web Developer</div>
          </div>
        </div>

        <div className="social-links" aria-label="روابط التواصل">
          <a className="social-link" href="https://wa.me/970599242087" target="_blank" rel="noreferrer" aria-label="WhatsApp"><FaWhatsapp /></a>
          <a className="social-link" href="https://www.linkedin.com/in/raed-elsaidi-98b1033a6" target="_blank" rel="noreferrer" aria-label="LinkedIn"><FaLinkedinIn /></a>
          <a className="social-link" href="https://www.facebook.com/raed.elsaidi" target="_blank" rel="noreferrer" aria-label="Facebook"><FaFacebookF /></a>
          <a className="social-link" href="mailto:elsaidiraed@gmail.com" aria-label="Email"><FaEnvelope /></a>
        </div>

        <div className="footer-copy">
          © 2026 — كافة الحقوق محفوظة
        </div>
      </footer>
    </div>
  );
}

// 1. شاشة الترحيب (تعرض الاسم الحقيقي للموظف)
function WelcomeScreen({ employeeName, roleTitle, onContinue }) {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (typeof onContinue === 'function') {
            onContinue();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onContinue]);

  return (
    <div style={welcomeStyles.container} dir="rtl">
      <div style={welcomeStyles.card}>
        <div style={welcomeStyles.iconBg}>🎉</div>
        <h2 style={welcomeStyles.title}>مرحباً بك</h2>
        <p style={welcomeStyles.messageText}>
          أهلاً وسهلاً بك، <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{employeeName}</span><br />
          تم تسجيل الدخول بنجاح بصفتك (<span style={{ color: '#fbbf24' }}>{roleTitle}</span>)
        </p>
        <div style={welcomeStyles.timerBox}>
          ⏳ سيتم توجيهك إلى لوحة التحكم خلال <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '18px' }}>{countdown}</span> ثوانٍ...
        </div>
      </div>
    </div>
  );
}

const welcomeStyles = {
  container: {
    width: '100vw',
    height: '100vh',
    backgroundColor: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Noto Kufi Arabic, sans-serif',
    padding: '20px',
    boxSizing: 'border-box'
  },
  card: {
    backgroundColor: '#1e293b',
    width: '100%',
    maxWidth: '450px',
    padding: '40px 30px',
    borderRadius: '20px',
    boxShadow: '0 15px 35px rgba(0, 0, 0, 0.6)',
    border: '1px solid #334155',
    textAlign: 'center',
    boxSizing: 'border-box'
  },
  iconBg: {
    width: '70px',
    height: '70px',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    margin: '0 auto 20px',
    border: '1px solid rgba(56, 189, 248, 0.3)'
  },
  title: {
    margin: '0 0 10px 0',
    color: '#f8fafc',
    fontSize: '24px',
    fontWeight: 'bold'
  },
  messageText: {
    color: '#cbd5e1',
    fontSize: '16px',
    lineHeight: '1.6',
    margin: '0 auto 20px'
  },
  timerBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: '12px',
    borderRadius: '8px',
    color: '#94a3b8',
    fontSize: '14px',
    border: '1px solid #334155'
  }
};

const loginStyles = {
  container: {
    width: '100vw',
    height: '100vh',
    backgroundColor: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Noto Kufi Arabic, sans-serif',
    padding: '20px',
    boxSizing: 'border-box'
  },
  card: {
    backgroundColor: '#1e293b',
    width: '100%',
    maxWidth: '420px',
    padding: '30px',
    borderRadius: '16px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
    border: '1px solid #334155',
    boxSizing: 'border-box'
  },
  title: {
    margin: '0 0 5px 0',
    color: '#f8fafc',
    fontSize: '20px',
    fontWeight: 'bold'
  },
  subtitle: {
    margin: '0',
    color: '#94a3b8',
    fontSize: '13px'
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    color: '#cbd5e1',
    fontSize: '13px',
    fontWeight: '600'
  },
  input: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0f172a',
    border: '1px solid #475569',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none'
  },
  submitBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 'bold',
    marginTop: '10px',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
  },
  backBtn: {
    width: '100%',
    padding: '10px',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    border: '1px solid #475569',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    marginTop: '5px'
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    padding: '10px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '15px',
    textAlign: 'center',
    border: '1px solid rgba(239, 68, 68, 0.4)'
  }
};

// 2. رسالة تقييد الصلاحيات (تعرض الاسم الحقيقي للموظف)
function RestrictedView() {
  return null;
}

const restrictedStyles = {
  container: {
    width: '100%',
    height: '100%',
    minHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    boxSizing: 'border-box'
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    backdropFilter: 'blur(10px)',
    width: '100%',
    maxWidth: '500px',
    padding: '30px',
    borderRadius: '20px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.37)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    textAlign: 'center',
    boxSizing: 'border-box'
  },
  iconBg: {
    width: '56px',
    height: '56px',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    margin: '0 auto 15px',
    border: '1px solid rgba(239, 68, 68, 0.4)'
  },
  title: {
    margin: '0 0 10px',
    color: '#f8fafc',
    fontSize: '20px',
    fontWeight: '800'
  },
  messageText: {
    color: '#cbd5e1',
    fontSize: '15px',
    lineHeight: '1.6',
    margin: '0 auto 25px',
    fontWeight: '600'
  },
  backBtn: {
    padding: '12px 24px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
  }
};

export default function AdminPanel({ supabase, styles, showAlertMessage, onLogout, user, onGoHome }) {
  const institution = useInstitutionManagementProfile();
  // AdminLogin هي الشاشة الثانية، وتظهر بعد الضغط على دخول الموظفين من WelcomeScreen.
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const [currentUser, setCurrentUser] = useState(user || {
    id: localStorage.getItem('currentUserId'),
    username: localStorage.getItem('currentUsername'),
    name: localStorage.getItem('currentName'),
    role: localStorage.getItem('currentUserRole'),
    job_id: localStorage.getItem('currentJobId') ? Number(localStorage.getItem('currentJobId')) : null,
    permissions: JSON.parse(localStorage.getItem('employeePermissions') || '[]')
  });

  const [permissions, setPermissions] = useState(
    Array.isArray(user?.permissions) ? user.permissions : JSON.parse(localStorage.getItem('employeePermissions') || '[]')
  );

  // عند إعادة فتح لوحة التحكم، نعيد جلب بيانات الموظف من employees.
  // هذا مهم حتى تبقى branch_id و subject_id و job_id متوفرة للصفحات.
  useEffect(() => {
    let cancelled = false;

    const loadCurrentEmployee = async () => {
      if (!supabase || !isLoggedIn) return;

      // حساب المبرمج مصدره جدول supervisors وليس employees.
      if (
        currentUser?.auth_source === 'supervisors' ||
        localStorage.getItem('authSource') === 'supervisors' ||
        currentUser?.role === 'Programmer' ||
        localStorage.getItem('currentUserRole') === 'Programmer'
      ) {
        return;
      }

      const currentId = currentUser?.id || localStorage.getItem('currentUserId');
      const currentUsername = currentUser?.username || localStorage.getItem('currentUsername');

      let query = supabase.from('employees').select('*');

      if (currentId) {
        query = query.eq('id', currentId);
      } else if (currentUsername) {
        query = query.eq('username', currentUsername);
      } else {
        return;
      }

      const { data, error } = await query.maybeSingle();

      if (cancelled) return;

      if (!error && data) {
        let jobName = data.job_name || currentUser?.job_name || localStorage.getItem('currentJobName') || '';

        if (!jobName && data.job_id != null) {
          const { data: jobData } = await supabase
            .from('jobs')
            .select('id, job_name')
            .eq('id', data.job_id)
            .maybeSingle();

          if (jobData) jobName = jobData.job_name || '';
        }

        const realName = data.full_name || data.name || data.username || currentUser?.name;
        const normalizedRole = normalizeEmployeeRole(data.role, jobName, data.job_id, data.username);

        const employeePermissions = await loadEmployeePermissions(supabase, data.job_id);

        const mergedUser = {
          ...currentUser,
          ...data,
          name: realName,
          job_name: jobName,
          role: normalizedRole,
          permissions: employeePermissions
        };

        setCurrentUser(mergedUser);
        setPermissions(employeePermissions);

        localStorage.setItem('currentUserId', String(data.id));
        if (data.username) localStorage.setItem('currentUsername', data.username);
        localStorage.setItem('currentUserRole', normalizedRole);
        if (data.job_id != null) localStorage.setItem('currentJobId', String(data.job_id));
        if (jobName) localStorage.setItem('currentJobName', jobName);
        if (realName) localStorage.setItem('currentName', realName);
        localStorage.setItem('employeePermissions', JSON.stringify(employeePermissions));
      } else if (error) {
        console.error('تعذر تحميل بيانات الموظف الحالي:', error);
      }
    };

    loadCurrentEmployee();

    return () => {
      cancelled = true;
    };
  }, [supabase, isLoggedIn, currentUser?.id, currentUser?.username]);

  // تحديث last_seen بشكل دوري طالما الموظف داخل النظام.
  useEffect(() => {
    if (!supabase || !isLoggedIn || !currentUser?.id) return;

    if (
      currentUser?.auth_source === 'supervisors' ||
      localStorage.getItem('authSource') === 'supervisors' ||
      currentUser?.role === 'Programmer'
    ) {
      return;
    }

    const updateLastSeen = async () => {
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from('employees')
        .update({
          is_online: true,
          last_seen: nowIso
        })
        .eq('id', currentUser.id);

      if (error) {
        console.warn('تعذر تحديث last_seen:', error);
      }
    };

    updateLastSeen();
    const interval = setInterval(updateLastSeen, 60 * 1000);

    return () => clearInterval(interval);
  }, [supabase, isLoggedIn, currentUser?.id]);

  const userRole = currentUser?.role || localStorage.getItem('currentUserRole') || 'Teacher';
  const isProgrammer =
    userRole === 'Programmer' &&
    (
      currentUser?.auth_source === 'supervisors' ||
      localStorage.getItem('authSource') === 'supervisors'
    );
  const hasPermission = (permissionKey) => permissions.includes(permissionKey);
  // كل موظف، بما في ذلك مدير النظام، يرى فقط البنود الممنوحة له من شاشة الصلاحيات. المبرمج فقط يتجاوز هذه القيود.
  const canAccess = (permissionKey) => userRole === 'Programmer' || hasPermission(permissionKey);
  const canAny = (...keys) => keys.some((key) => canAccess(key));

  // المبرمج يبدأ مباشرة من شاشة إدارة المؤسسة.
  const [activeTab, setActiveTab] = useState(
    isProgrammer ? 'institution_management' : 'academic_structure'
  );
  const [employeeUnreadCount, setEmployeeUnreadCount] = useState(0);
  const [studentSupportUnreadCount, setStudentSupportUnreadCount] = useState(0);

  useEffect(() => {
    if (!supabase || !isLoggedIn || !currentUser?.id) return;
    const loadUnreadMessages = async () => {
      const { count, error } = await supabase
        .from('employee_messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', currentUser.id)
        .eq('is_read', false)
        .is('receiver_deleted_at', null);
      if (!error) setEmployeeUnreadCount(Number(count || 0));
    };
    loadUnreadMessages();
    const timer = setInterval(loadUnreadMessages, 15000);
    return () => clearInterval(timer);
  }, [supabase, isLoggedIn, currentUser?.id]);

  useEffect(() => {
    if (!supabase || !isLoggedIn || !currentUser?.id || !hasPermission('student_support_messaging')) return;
    const loadSupportUnread = async () => {
      const { count, error } = await supabase
        .from('student_support_messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_type', 'student')
        .eq('is_read', false)
        .is('recipient_deleted_at', null);
      if (!error) setStudentSupportUnreadCount(Number(count || 0));
    };
    loadSupportUnread();
    const timer = setInterval(loadSupportUnread, 15000);
    return () => clearInterval(timer);
  }, [supabase, isLoggedIn, currentUser?.id, permissions]);

  const [openMenus, setOpenMenus] = useState({ 
    questions: hasPermission('view_questions') || hasPermission('add_question'),
    exams: canAny('view_exams', 'add_exam', 'edit_exam', 'delete_exam'),
    academic_structure: canAny('manage_branches', 'manage_subjects', 'manage_units'),
    students: hasPermission('manage_students') || userRole === 'Admin',
    student_results: hasPermission('manage_student_results') || hasPermission('view_student_results')
  });

  const toggleMenu = (menu) => setOpenMenus(prev => ({ ...prev, [menu]: !prev[menu] }));

  const currentServerYear = new Date().getFullYear();

  const getRoleTitle = (role) => {
    if (role === 'Programmer') return 'المبرمج';
    if (role === 'Admin') return 'مدير النظام';
    if (role === 'InstitutionManager') return 'مدير المؤسسة';
    if (role === 'Supervisor') return 'المشرف';
    if (role === 'Monitor') return 'المراقب';
    if (role === 'Teacher') return 'المعلم';
    return 'الموظف';
  };

  const handleHomeClick = () => {
    // Home يرجع إلى WelcomeScreen
    if (typeof onGoHome === 'function') {
      onGoHome();
    }
  };

  const handleLogoutClick = async () => {
    // تسجيل خروج الموظف فعليًا في جدول employees.
    if (supabase && currentUser?.id) {
      const { error } = await supabase
        .from('employees')
        .update({
          is_online: false,
          last_seen: new Date().toISOString()
        })
        .eq('id', currentUser.id);

      if (error) {
        console.warn('تعذر تحديث حالة الموظف عند تسجيل الخروج:', error);
      }
    }

    localStorage.removeItem('currentUserId');
    localStorage.removeItem('currentUsername');
    localStorage.removeItem('currentUserRole');
    localStorage.removeItem('currentJobId');
    localStorage.removeItem('currentJobName');
    localStorage.removeItem('currentName');
    localStorage.removeItem('employeePermissions');
    localStorage.removeItem('manualActiveUsername');
    localStorage.removeItem('authSource');
    localStorage.removeItem('loggedIn');

    setIsLoggedIn(false);
    setShowWelcome(false);

    if (typeof onLogout === 'function') {
      onLogout();
    } else if (typeof onGoHome === 'function') {
      onGoHome();
    }
  };

  if (!isLoggedIn) {
    return (
      <EmployeeLogin 
        supabase={supabase} 
        onLoginSuccess={(userData) => {
          setCurrentUser(userData);
          setIsLoggedIn(true);
          setShowWelcome(false);
        }} 
        onBack={handleHomeClick} 
      />
    );
  }

  if (showWelcome) {
    const employeeFullName = currentUser?.name || localStorage.getItem('currentName') || 'الموظف';
    const employeeRoleTitle = getRoleTitle(userRole);
    return (
      <WelcomeScreen 
        employeeName={employeeFullName} 
        roleTitle={employeeRoleTitle} 
        onContinue={() => setShowWelcome(false)} 
      />
    );
  }

  // حساب المبرمج: شاشة واحدة فقط لإدارة المؤسسات.
  // لا تظهر له إدارة المؤسسة ولا أي شاشة أخرى.
  if (isProgrammer) {
    return (
      <div
        style={{
          color: '#fff',
          fontFamily: 'Noto Kufi Arabic, sans-serif',
          backgroundColor: '#0f172a',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        dir="rtl"
      >
        <header
          style={{
            backgroundColor: '#1e293b',
            borderBottom: '1px solid #334155',
            padding: '15px 30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '15px'
          }}
        >
          <div>
            <div style={{ fontSize: '21px', fontWeight: '800', color: '#fbbf24' }}>
              لوحة المبرمج
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '13px', marginTop: '4px' }}>
              إدارة المؤسسات
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogoutClick}
            style={{
              border: '1px solid #475569',
              background: '#0f172a',
              color: '#fff',
              borderRadius: '8px',
              padding: '9px 14px',
              cursor: 'pointer'
            }}
          >
            تسجيل الخروج
          </button>
        </header>

        <main
          style={{
            flex: 1,
            padding: '25px',
            overflowY: 'auto',
            boxSizing: 'border-box'
          }}
        >
          <InstitutionManagement />
        </main>
      </div>
    );
  }


  const subItemStyle = (isActive) => ({
    textAlign: 'right', padding: '10px 15px', borderRadius: '4px', border: 'none', cursor: 'pointer',
    backgroundColor: isActive ? '#2563eb' : '#334155', color: '#fff', fontSize: '13px', fontWeight: '500', marginRight: '10px',
    display: 'flex', alignItems: 'center', gap: '8px'
  });

  const mainItemStyle = (isActive) => ({
    width: '100%', textAlign: 'right', padding: '12px 15px', borderRadius: '6px', border: 'none', cursor: 'pointer',
    backgroundColor: isActive ? '#1e40af' : 'transparent', color: '#f8fafc', fontSize: '14px', fontWeight: '600',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  });

  const handleMenuPointerOver = (event) => {
    const item = event.target?.closest?.('button');
    if (!item) return;
    if (event.relatedTarget && item.contains(event.relatedTarget)) return;
    playMenuHoverSound();
  };

  return (
    <div style={{ color: '#fff', fontFamily: 'Noto Kufi Arabic, sans-serif', backgroundColor: '#0f172a', minHeight: '100vh', display: 'flex', flexDirection: 'column' }} dir="rtl">
      
      {/* الترويسة العلوية Header */}
      <header style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '15px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', minHeight: '120px' }}>
        
        <div style={{ fontSize: '22px', fontFamily: 'Amiri, Traditional Arabic, serif', fontWeight: 'bold', color: '#fbbf24', textAlign: 'center', width: '100%', letterSpacing: '1px' }}>
          بسم الله الرحمن الرحيم
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderTop: '1px solid #334155', paddingTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
               <img src={institution?.logo_url || ministryLogo} alt="Logo" style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '50%' }} />
               <div>
                 <h4 style={{ margin: '0', color: '#f8fafc', fontSize: '13px', fontWeight: 'bold' }}>{(institution?.name_line_1 || institution?.name || institution?.official_name || '')}</h4>
                 <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}>
                   قسم القياس والتقويم والامتحانات - امتحان إتمام شهادة الدراسة الثانوية العامة - {currentServerYear}
                 </p>
               </div>
          </div>

          <div style={{ fontSize: '19px', fontWeight: 'bold', color: '#38bdf8' }}>
            لوحة تحكم الموظفين
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#cbd5e1' }}>
              مرحباً، {currentUser?.name || localStorage.getItem('currentName') || 'الموظف'}
              {' - '}
              {getRoleTitle(userRole)}
            </span>
            <button type="button" onClick={handleHomeClick} style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
              🏠 الرئيسية
            </button>
            <button type="button" onClick={handleLogoutClick} style={{ padding: '6px 12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
              تسجيل الخروج
            </button>
          </div>
        </div>

      </header>

      {/* المحتوى والقائمة الجانبية */}
      <div style={{ display: 'flex', flex: 1, minHeight: 'calc(100vh - 120px)' }}>
        
        {/* القائمة الجانبية (يمين) */}
        <div style={{ width: '270px', backgroundColor: '#1e293b', borderLeft: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px', borderBottom: '1px solid #334155', fontWeight: 'bold', fontSize: '15px', color: '#cbd5e1', textAlign: 'center' }}>
            القائمة الرئيسية
          </div>
          
          <div onPointerOver={handleMenuPointerOver} style={{ display: 'flex', flexDirection: 'column', padding: '10px', gap: '8px' }}>
            {/* إدارة المؤسسة */}
            {canAccess('manage_institution') && (
              <button type="button" onClick={() => setActiveTab('institution_management')} style={mainItemStyle(activeTab === 'institution_management')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>🏫 إدارة المؤسسة</span>
              </button>
            )}

            {/* المديريات والمدارس */}
            {canAccess('manage_directorates_schools') && (
              <button type="button" onClick={() => setActiveTab('directorates_schools')} style={mainItemStyle(activeTab === 'directorates_schools')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>🏫 المديريات والمدارس</span>
              </button>
            )}

            {/* الهيكلية الدراسية */}
            {canAny('manage_branches', 'manage_subjects', 'manage_units') && (
              <div>
                <button type="button" onClick={() => toggleMenu('academic_structure')} style={mainItemStyle(activeTab === 'academic_structure')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>📚 الهيكلية الدراسية</span>
                  <span>{openMenus.academic_structure ? '▼' : '◀'}</span>
                </button>
                {openMenus.academic_structure && (
                  <div style={{ display: 'flex', flexDirection: 'column', paddingRight: '15px', gap: '5px', marginTop: '5px' }}>
                    {canAccess('manage_branches') && <button type="button" onClick={() => setActiveTab('academic_structure')} style={subItemStyle(activeTab === 'academic_structure')}>🏢 إدارة الفروع</button>}
                    {canAccess('manage_subjects') && <button type="button" onClick={() => setActiveTab('academic_structure')} style={subItemStyle(activeTab === 'academic_structure')}>📚 إدارة المواد</button>}
                    {canAccess('manage_units') && <button type="button" onClick={() => setActiveTab('academic_structure')} style={subItemStyle(activeTab === 'academic_structure')}>📦 إدارة الوحدات</button>}
                  </div>
                )}
              </div>
            )}

            {/* إدارة الأسئلة */}
            {canAny('add_question', 'view_questions', 'edit_question', 'delete_question') && (
              <div>
                <button type="button" onClick={() => toggleMenu('questions')} style={mainItemStyle(activeTab.includes('question'))}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>❓ إدارة الأسئلة</span>
                  <span>{openMenus.questions ? '▼' : '◀'}</span>
                </button>
                {openMenus.questions && (
                  <div style={{ display: 'flex', flexDirection: 'column', paddingRight: '15px', gap: '5px', marginTop: '5px' }}>
                    {canAccess('add_question') && <button type="button" onClick={() => setActiveTab('add_question')} style={subItemStyle(activeTab === 'add_question')}>➕ إضافة سؤال</button>}
                    {canAccess('view_questions') && <button type="button" onClick={() => setActiveTab('view_questions')} style={subItemStyle(activeTab === 'view_questions')}>📚 عرض الأسئلة</button>}
                    {canAny('edit_question', 'delete_question') && <button type="button" onClick={() => setActiveTab('manage_questions')} style={subItemStyle(activeTab === 'manage_questions')}>⚙️ إدارة وتعديل وحذف</button>}
                  </div>
                )}
              </div>
            )}

            {/* إدارة الامتحانات */}
            {canAny('add_exam', 'view_exams', 'edit_exam', 'delete_exam') && (
              <div>
                <button type="button" onClick={() => toggleMenu('exams')} style={mainItemStyle(activeTab.includes('exam'))}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>📝 إدارة الامتحانات</span>
                  <span>{openMenus.exams ? '▼' : '◀'}</span>
                </button>
                {openMenus.exams && (
                  <div style={{ display: 'flex', flexDirection: 'column', paddingRight: '15px', gap: '5px', marginTop: '5px' }}>
                    {canAccess('add_exam') && <button type="button" onClick={() => setActiveTab('add_exam')} style={subItemStyle(activeTab === 'add_exam')}>➕ إنشاء امتحان</button>}
                    {canAccess('view_exams') && <button type="button" onClick={() => setActiveTab('view_exams')} style={subItemStyle(activeTab === 'view_exams')}>📝 عرض الامتحان</button>}
                    {canAny('edit_exam', 'delete_exam') && <button type="button" onClick={() => setActiveTab('manage_exams')} style={subItemStyle(activeTab === 'manage_exams')}>⚙️ إدارة الامتحان</button>}
                  </div>
                )}
              </div>
            )}

            {/* الطلاب */}
            {canAny('manage_registration_cycles', 'add_student', 'manage_student', 'manage_students') && (
              <div>
                <button type="button" onClick={() => toggleMenu('students')} style={mainItemStyle(activeTab === 'registration_cycles' || activeTab === 'add_student' || activeTab === 'manage_student')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>🎓 إدارة ملف الطلاب</span>
                  <span>{openMenus.students ? '▼' : '◀'}</span>
                </button>
                {openMenus.students && (
                  <div style={{ display: 'flex', flexDirection: 'column', paddingRight: '15px', gap: '5px', marginTop: '5px' }}>
                    {canAny('manage_registration_cycles', 'manage_students') && <button type="button" onClick={() => setActiveTab('registration_cycles')} style={subItemStyle(activeTab === 'registration_cycles')}>📅 إدارة الدورات</button>}
                    {canAny('add_student', 'manage_students') && <button type="button" onClick={() => setActiveTab('add_student')} style={subItemStyle(activeTab === 'add_student')}>➕ إضافة طالب</button>}
                    {canAny('manage_student', 'manage_students') && <button type="button" onClick={() => setActiveTab('manage_student')} style={subItemStyle(activeTab === 'manage_student')}>⚙️ إدارة وحذف الطلاب</button>}
                  </div>
                )}
              </div>
            )}

            {/* نتائج الطلاب والمعدلات */}
            {canAny('manage_student_results', 'result_announcements', 'view_student_results') && (
              <div>
                <button type="button" onClick={() => toggleMenu('student_results')} style={mainItemStyle(activeTab === 'manage_student_results' || activeTab === 'result_announcements' || activeTab === 'view_student_results')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>📊 نتائج الطلاب والمعدلات</span>
                  <span>{openMenus.student_results ? '▼' : '◀'}</span>
                </button>
                {openMenus.student_results && (
                  <div style={{ display: 'flex', flexDirection: 'column', paddingRight: '15px', gap: '5px', marginTop: '5px' }}>
                    {canAccess('manage_student_results') && <button type="button" onClick={() => setActiveTab('manage_student_results')} style={subItemStyle(activeTab === 'manage_student_results')}>⚙️ إدارة النتائج</button>}
                    {canAccess('result_announcements') && <button type="button" onClick={() => setActiveTab('result_announcements')} style={subItemStyle(activeTab === 'result_announcements')}>📢 إعلان النتائج</button>}
                    {canAccess('view_student_results') && <button type="button" onClick={() => setActiveTab('view_student_results')} style={subItemStyle(activeTab === 'view_student_results')}>📊 عرض النتائج</button>}
                  </div>
                )}
              </div>
            )}

            {canAccess('monitor_students') && (
              <button type="button" onClick={() => setActiveTab('cheating_monitor')} style={mainItemStyle(activeTab === 'cheating_monitor')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>🚨 مراقبة محاولات الغش</span>
              </button>
            )}

            {canAccess('view_statistics') && (
              <button type="button" onClick={() => setActiveTab('statistics')} style={mainItemStyle(activeTab === 'statistics')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>📈 الإحصائيات العامة</span>
              </button>
            )}

            {canAccess('employee_messaging') && (
              <button type="button" onClick={() => { setActiveTab('employee_messages'); setEmployeeUnreadCount(0); }} style={mainItemStyle(activeTab === 'employee_messages')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  💬 مراسلة الموظفين
                  {employeeUnreadCount > 0 && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: '#ef4444', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>{employeeUnreadCount > 99 ? '99+' : employeeUnreadCount}</span>}
                </span>
              </button>
            )}

            {canAccess('student_support_messaging') && (
              <button type="button" onClick={() => { setActiveTab('student_support_messages'); setStudentSupportUnreadCount(0); }} style={mainItemStyle(activeTab === 'student_support_messages')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  🎧 مراسلات الطلاب (دعم فني)
                  {studentSupportUnreadCount > 0 && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: '#ef4444', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>{studentSupportUnreadCount > 99 ? '99+' : studentSupportUnreadCount}</span>}
                </span>
              </button>
            )}

            {canAccess('manage_permissions') && (
              <button type="button" onClick={() => setActiveTab('permissions')} style={mainItemStyle(activeTab === 'permissions')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>🛡️ إدارة الصلاحيات</span>
              </button>
            )}

            {canAny('manage_employees', 'view_employee_profile') && (
              <button type="button" onClick={() => setActiveTab('employees')} style={mainItemStyle(activeTab === 'employees')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>🧑‍🏫 إدارة الموظفين</span>
              </button>
            )}

            {canAccess('notes_book') && (
              <button type="button" onClick={() => setActiveTab('notes')} style={mainItemStyle(activeTab === 'notes')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>📝 الملاحظات</span>
              </button>
            )}

            {canAccess('backup_data') && (
              <button type="button" onClick={() => setActiveTab('backup')} style={mainItemStyle(activeTab === 'backup')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>💾 حفظ البيانات والنسخ الاحتياطي</span>
              </button>
            )}
          </div>
        </div>

        {/* محتوى الصفحات */}
        <div style={{ flex: 1, padding: '25px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          
          {activeTab === 'institution_management' && userRole === 'Admin' && (
            <InstitutionManagementProfile
              institutionId={currentUser?.institution_id || null}
            />
          )}

          {activeTab === 'notes' && canAccess('notes_book') && (
            <Notes currentEmployeeId={currentUser?.id || localStorage.getItem('currentUserId')} />
          )}

          {activeTab === 'backup' && canAccess('backup_data') && (
            <BackupManager showAlertMessage={showAlertMessage} />
          )}

          {activeTab === 'academic_structure' && (
            canAny('manage_branches', 'manage_subjects', 'manage_units')
              ? <AcademicManager supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} currentUser={currentUser} userRole={userRole} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'view_questions' && <ViewQuestions supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} />}

          {activeTab === 'add_question' && (
            hasPermission('add_question')
              ? <AddQuestion supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} teacher={currentUser} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'manage_questions' && (
            (hasPermission('view_questions') || hasPermission('edit_question') || hasPermission('delete_question'))
              ? <ManageQuestion supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} teacher={currentUser} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'view_exams' && canAccess('view_exams') && <ViewExams supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} />}

          {activeTab === 'add_exam' && (
            canAccess('add_exam')
              ? <AddExam supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} supervisor={currentUser} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'manage_exams' && (
            canAny('view_exams', 'edit_exam', 'delete_exam')
              ? <ManageExam supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} supervisor={currentUser} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'registration_cycles' && (
            canAny('manage_registration_cycles', 'manage_students')
              ? <RegistrationCyclesManager supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'add_student' && (
            canAny('add_student', 'manage_students')
              ? <AddStudent supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'manage_student' && (
            canAny('manage_student', 'manage_students')
              ? <ManageStudent supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'manage_student_results' && (
            canAccess('manage_student_results')
              ? <StudentResultsManager supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'view_student_results' && (
            canAccess('view_student_results')
              ? <StudentResultView supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'cheating_monitor' && (
            hasPermission('monitor_students')
              ? <CheatingMonitor supabase={supabase} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'result_announcements' && (
            canAccess('result_announcements')
              ? <ResultAnnouncementManager />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'employee_messages' && (
            canAccess('employee_messaging')
              ? <EmployeeMessages supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'student_support_messages' && (
            canAccess('student_support_messaging')
              ? <StudentSupportMessages supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'statistics' && (
            hasPermission('view_statistics')
              ? <StatisticsManager supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'monitor_home' && (
            hasPermission('monitor_students')
              ? <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'directorates_schools' && (
            hasPermission('manage_directorates_schools')
              ? <DirectorateSchoolManager supabase={supabase} styles={styles} showAlertMessage={showAlertMessage} />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'employees' && (
            canAny('manage_employees', 'view_employee_profile')
              ? <EmployeesManager
                supabase={supabase}
                styles={styles}
                showAlertMessage={showAlertMessage}
                institutionId={currentUser?.institution_id || null}
                isInstitutionManager={userRole === 'InstitutionManager'}
              />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}

          {activeTab === 'permissions' && (
            canAccess('manage_permissions')
              ? <PermissionsManager />
              : <RestrictedView onBack={handleHomeClick} currentName={currentUser?.name} roleTitle={getRoleTitle(userRole)} />
          )}
        </div>

      </div>
    </div>
  );
}