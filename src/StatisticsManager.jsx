import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function StatisticsManager({ supabase, styles }) {
  
const getExamDateTime = (exam, endOfDay = false) => {
  const date = exam?.exam_date || exam?.date;
  const time = exam?.exam_time || exam?.start_time || '00:00';
  if (!date) return null;
  const d = new Date(`${date}T${time}:00`);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) {
    const duration = Number(exam?.duration_minutes ?? exam?.duration ?? 0);
    return new Date(d.getTime() + duration * 60000);
  }
  return d;
};

const getExamTimeStatus = (exam, now = new Date()) => {
  const start = getExamDateTime(exam, false);
  const end = getExamDateTime(exam, true);
  if (!start || !end) return 'unknown';
  if (now < start) return 'upcoming';
  if (now <= end) return 'running';
  return 'finished';
};

const [stats, setStats] = useState({
    studentsCount: 0,
    eligibleRegistrationStudentsCount: 0,
    runningExamsCount: 0,
    upcomingExamsCount: 0,
    finishedExamsCount: 0,
    maleCount: 0,
    femaleCount: 0,
    branchesCount: 0,
    studentsByBranch: {},
    studentsByDirectorate: {},
    submittedExamsCount: 0,
    notSubmittedExamsCount: 0,
    questionsCount: 0,
    examsCount: 0,
    passedStudentsCount: 0,
    activeSystemsCount: 0,
    supervisorsCount: 0,
    activeSupervisorsCount: 0,
    todayExamsCount: 0,
    tomorrowExamsCount: 0,
    todayExamsList: [],
    tomorrowExamsList: [],
    activeNowStudentsCount: 0,
    currentlyTestingCount: 0,
    submittedTodayCount: 0,
    cheatingCasesCount: 0,
    cheatingCasesByBranch: {},
    cheatingCasesByCycle: { 'الدورة الأولى': 0, 'الدورة الثانية': 0, 'الدورة الثالثة': 0 },
    studentSupportByCycle: { 'الدورة الأولى': { received: 0, handled: 0 }, 'الدورة الثانية': { received: 0, handled: 0 }, 'الدورة الثالثة': { received: 0, handled: 0 } }
  });

  const [loadingState, setLoadingState] = useState(true);
  const [dataAccessWarning, setDataAccessWarning] = useState('');
  const firstLoadRef = useRef(true);
  const fetchingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      if (cancelled || fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        await fetchStatistics(!firstLoadRef.current);
      } finally {
        fetchingRef.current = false;
        firstLoadRef.current = false;
      }
    };

    refresh();

    // تحديث هادئ في الخلفية بدون إخفاء الصفحة أو إظهار شاشة تحميل كل مرة.
    const timer = setInterval(refresh, 10000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [supabase]);

  const fetchStatistics = async (silent = false) => {
    if (!silent) {
      setLoadingState(true);
    }
    try {
      setDataAccessWarning('');

      // 1. جلب بيانات الطلاب من جدول students الفعلي
      const { data: studentsData, count: totalStudents, error: studentsError } = await supabase
        .from('students')
        .select('*', { count: 'exact' });

      if (studentsError) throw studentsError;
      const students = studentsData || [];

      // عدد الطلاب المسموح لهم بالتسجيل في النظام من جدول allow_student.
      // لا نستخدم بيانات students لهذا الرقم؛ المطلوب هو عدد السجلات
      // الموجودة فعليًا في جدول السماح بالتسجيل.
      let eligibleRegistrationStudentsCount = 0;
      let allowStudentError = null;

      // الجدول المستخدم في المشروع هو allow_student.
      // إذا كان الاسم في قاعدة البيانات allowstudent، نجربه كخطة بديلة.
      {
        const primary = await supabase
          .from('allow_student')
          .select('id', { count: 'exact', head: true });

        if (!primary.error) {
          eligibleRegistrationStudentsCount = primary.count || 0;
        } else {
          const fallback = await supabase
            .from('allowstudent')
            .select('id', { count: 'exact', head: true });

          if (!fallback.error) {
            eligibleRegistrationStudentsCount = fallback.count || 0;
          } else {
            allowStudentError = primary.error;
            console.warn('Allow-student count lookup failed:', primary.error.message);
          }
        }
      }

      let males = 0;
      let females = 0;
      const byBranch = {};
      const byDirectorate = {};
      let submitted = 0;
      let notSubmitted = 0;
      let passed = 0;
      let activeNow = 0;
      let currentlyTesting = 0;

      // خريطة لتخزين عدد الطلاب لكل فرع لتسهيل مطابقتها مع الامتحانات
      const branchStudentCounts = {};

      // التواريخ الحالية لمقارنة مواعيد الامتحانات
      // نستخدم التاريخ المحلي للمتصفح وليس UTC حتى لا ينتقل امتحان 00:30
      // إلى يوم الغد بسبب فرق التوقيت.
      const now = new Date();
      const formatLocalDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      const todayStr = formatLocalDate(now);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatLocalDate(tomorrow);

      // جلب أسماء الفروع والمديريات وربطها مع IDs الموجودة في سجلات الطلاب
      const { data: branchesData, count: branchesCount, error: branchesError } = await supabase
        .from('branches')
        .select('*', { count: 'exact' });

      if (branchesError) console.error('Error fetching branches:', branchesError);

      let directoratesData = [];
      const { data: dirsData, error: dirsError } = await supabase
        .from('directorates')
        .select('*');

      if (!dirsError) {
        directoratesData = dirsData || [];
      } else {
        console.warn('Directorates lookup failed:', dirsError.message);
      }

      const branchMap = {};
      (branchesData || []).forEach(b => {
        const name = b.branch_name || b.name || b.title || b.branch;
        if (b.id != null && name) branchMap[String(b.id)] = String(name).trim();
      });

      const directorateMap = {};
      directoratesData.forEach(d => {
        const name = d.directorate_name || d.name || d.title || d.directorate;
        if (d.id != null && name) directorateMap[String(d.id)] = String(name).trim();
      });

      const getStudentBranchName = (s) => {
        if (s.branch && typeof s.branch === 'object') {
          return s.branch.branch_name || s.branch.name || s.branch.title || 'غير محدد';
        }

        const direct = s.branch_name || s.branch || s.branchName;
        if (direct && String(direct).trim()) return String(direct).trim();

        const id = s.branch_id ?? s.branchId;
        if (id != null && branchMap[String(id)]) return branchMap[String(id)];

        return 'غير محدد';
      };

      const getStudentDirectorateName = (s) => {
        if (s.directorate && typeof s.directorate === 'object') {
          return s.directorate.directorate_name || s.directorate.name || s.directorate.title || 'غير مشخصة';
        }

        const direct =
          s.directorate_name ||
          s.directorateName ||
          s.management_name ||
          s.education_directorate;

        if (direct && typeof direct === 'string' && direct.trim()) return direct.trim();

        const id = s.directorate_id ?? s.directorateId ?? s.management_id;
        if (id != null && directorateMap[String(id)]) return directorateMap[String(id)];

        return 'غير مشخصة';
      };

      students.forEach(s => {
        // --- فحص الجنس من حقل gender المباشر ---
        const genderVal = String(s.gender || '').trim().toLowerCase();
        if (['ذكر', 'male', 'm', '1', 'رجل'].includes(genderVal) || genderVal.includes('ذك')) {
          males++;
        } else if (['أنثى', 'female', 'f', '2', 'بنت', 'انثى'].includes(genderVal) || genderVal.includes('أنث') || genderVal.includes('انث')) {
          females++;
        }

        // --- الفرع: اسم مباشر أو branch_id مربوط بجدول branches ---
        const branchName = getStudentBranchName(s);
        byBranch[branchName] = (byBranch[branchName] || 0) + 1;
        branchStudentCounts[branchName] = (branchStudentCounts[branchName] || 0) + 1;

        // --- المديرية: اسم مباشر أو directorate_id مربوط بجدول directorates ---
        const dirName = getStudentDirectorateName(s);
        byDirectorate[dirName] = (byDirectorate[dirName] || 0) + 1;

        // لا نعتمد على جدول students لمعرفة التسليم أو حالة الامتحان؛
        // التسليم الفعلي محفوظ في جدول submissions.
        if (s.result === 'ناجح' || s.is_passed || s.status === 'passed' || (s.grade && s.grade >= 50)) {
          passed++;
        }

        // هذه الحقول تستخدم فقط إذا كانت موجودة فعليًا في جدول الطلاب.
        if (
          s.is_active === true ||
          s.status === 'active' ||
          s.online === true
        ) {
          activeNow++;
        }
        if (
          s.status === 'testing' ||
          s.is_testing === true ||
          s.exam_in_progress === true
        ) {
          currentlyTesting++;
        }
      });

      const { count: questions } = await supabase.from('questions').select('*', { count: 'exact', head: true });
      const { data: examsData, count: examsCount, error: examsError } = await supabase.from('exams').select('*', { count: 'exact' });

      if (examsError) {
        console.error('Error fetching exams:', examsError);
      }

      const allExams = examsData || [];

      // مهم جدًا: تعريف حالات الامتحانات قبل setStats.
      // عدم تعريف هذه المتغيرات كان يسبب ReferenceError عند setStats،
      // وبالتالي تبقى كل الإحصائيات على قيمتها الابتدائية = 0.
      let runningExamsCount = 0;
      let upcomingExamsCount = 0;
      let finishedExamsCount = 0;
      allExams.forEach((exam) => {
        const status = getExamTimeStatus(exam, now);
        if (status === 'running') runningExamsCount += 1;
        else if (status === 'upcoming') upcomingExamsCount += 1;
        else if (status === 'finished') finishedExamsCount += 1;
      });

      const todayExamIds = new Set(
        allExams
          .filter(exam => {
            const raw = exam.exam_date || exam.date;
            return raw && String(raw).split('T')[0] === todayStr;
          })
          .map(exam => String(exam.id))
      );

      // التسليمات الحقيقية: كل سجل في submissions يمثل تسليمًا فعليًا للامتحان.
      // نستخدم distinct (seating_number + exam_id) حتى لا يتضاعف الطالب بسبب تكرار السجل.
      let submissionsRows = [];
      let submissionsError = null;
      {
        while (true) {
          const { data: page, error } = await supabase
            .from('submissions')
            .select('id, seating_number, exam_id, submitted_at');

          if (error) {
            submissionsError = error;
            break;
          }

          submissionsRows = page || [];
          break;
        }
      }

      if (submissionsError) {
        console.warn('Submissions lookup failed:', submissionsError.message);
      }

      // إحصائية التسليم تخص امتحانات اليوم فقط، وبعدد طلاب فريدين.
      const todaySubmissionRows = submissionsRows.filter(r =>
        r?.seating_number != null &&
        r?.exam_id != null &&
        r?.submitted_at &&
        todayExamIds.has(String(r.exam_id))
      );

      const submittedStudentNumbers = new Set(
        todaySubmissionRows
          .map(r => String(r.seating_number).trim())
          .filter(Boolean)
      );

      const submittedTodayKeys = new Set(
        todaySubmissionRows.map(r => `${String(r.seating_number).trim()}::${String(r.exam_id)}`)
      );

      submitted = submittedStudentNumbers.size;
      notSubmitted = todayExamIds.size > 0
        ? Math.max(0, students.length - submittedStudentNumbers.size)
        : 0;

      const todayExamsList = [];
      const tomorrowExamsList = [];

      allExams.forEach(exam => {
        const examDateRaw = exam.exam_date || exam.date || exam.created_at;
        if (examDateRaw) {
          const examDateOnly = String(examDateRaw).split('T')[0];
          const subName = exam.subject_name || exam.subjectName || exam.title || 'مبحث غير محدد';
          const examTime = exam.exam_time || exam.time || 'غير محدد';
          const duration = exam.duration_minutes || exam.duration || '60';
          const branchVal = exam.branch || exam.branch_name || exam.target_branch || 'عام / كافة الفروع';

          // حساب عدد الطلاب المسجلين بناءً على الفرع المرتبط بالامتحان، أو إجمالي الطلاب إذا كان عاماً
          let registeredCount = 0;
          if (branchVal !== 'عام / كافة الفروع' && branchStudentCounts[branchVal]) {
            registeredCount = branchStudentCounts[branchVal];
          } else {
            registeredCount = students.length;
          }

          const examObj = {
            subjectName: subName,
            branch: branchVal,
            time: examTime,
            duration: duration,
            registeredStudents: registeredCount
          };

          if (examDateOnly === todayStr) {
            todayExamsList.push(examObj);
          } else if (examDateOnly === tomorrowStr) {
            tomorrowExamsList.push(examObj);
          }
        }
      });

      // 2. جلب إحصائيات الموظفين والمشرفين من جدول supervisors
      const { data: supervisorsData, count: totalSupervisors, error: supervisorsError } = await supabase
        .from('supervisors')
        .select('*', { count: 'exact' });

      if (supervisorsError) {
        console.error('Error fetching supervisors:', supervisorsError);
      }

      const supervisors = supervisorsData || [];
      const activeSupervisors = supervisors.filter(emp => emp.is_active !== false).length;

      // 3. حالات الغش: عدّ تراكمي لجميع الامتحانات، مع توزيع العدد على الفروع.
      // لا يتم تصفير العداد عند الانتقال بين الامتحانات؛ كل سجل في cheating_cases
      // يمثل حالة غش واحدة ويستمر احتسابه حتى انتهاء دورة الامتحان وإعلان النتائج.
      let cheatingCases = [];
      let cheatingCasesError = null;
      const pageSize = 1000;
      let from = 0;

      while (true) {
        const { data: page, error: pageError } = await supabase
          .from('cheating_cases')
          .select('id, student_id, exam_id, occurred_at, case_status')
          .range(from, from + pageSize - 1);

        if (pageError) {
          cheatingCasesError = pageError;
          break;
        }

        const rows = page || [];
        cheatingCases.push(...rows);

        if (rows.length < pageSize) break;
        from += pageSize;
      }

      if (cheatingCasesError) {
        console.warn('Cheating cases lookup failed:', cheatingCasesError.message);
      }

      const cheatingExamIds = [...new Set(
        cheatingCases.map(c => c.exam_id).filter(id => id != null)
      )];
      const cheatingStudentIds = [...new Set(
        cheatingCases.map(c => c.student_id).filter(id => id != null)
      )];

      const cheatingExamMap = {};
      if (cheatingExamIds.length > 0) {
        const { data: cheatingExams, error: cheatingExamsError } = await supabase
          .from('exams')
          .select('id, branch_id')
          .in('id', cheatingExamIds);

        if (cheatingExamsError) {
          console.warn('Cheating exam branch lookup failed:', cheatingExamsError.message);
        } else {
          (cheatingExams || []).forEach(exam => {
            cheatingExamMap[String(exam.id)] = exam.branch_id;
          });
        }
      }

      const cheatingStudentMap = {};
      if (cheatingStudentIds.length > 0) {
        const { data: cheatingStudents, error: cheatingStudentsError } = await supabase
          .from('students')
          .select('id, branch_id')
          .in('id', cheatingStudentIds);

        if (cheatingStudentsError) {
          console.warn('Cheating student branch lookup failed:', cheatingStudentsError.message);
        } else {
          (cheatingStudents || []).forEach(student => {
            cheatingStudentMap[String(student.id)] = student.branch_id;
          });
        }
      }

      const cheatingByBranch = {};
      cheatingCases.forEach(caseRow => {
        // نعتمد فرع الامتحان أولاً، وإن لم يكن موجوداً نستخدم فرع الطالب.
        const branchId =
          cheatingExamMap[String(caseRow.exam_id)] ??
          cheatingStudentMap[String(caseRow.student_id)];

        const branchName =
          branchId != null && branchMap[String(branchId)]
            ? branchMap[String(branchId)]
            : 'غير محدد';

        cheatingByBranch[branchName] = (cheatingByBranch[branchName] || 0) + 1;
      });

      // حالات الغش للدورة كاملة: لا تعتمد على اليوم فقط.
      // نقرأ الدورة من سجل الطالب/الحالة/الامتحان، وإن لم توجد نستخرجها من
      // رقم الجلوس ذي 10 أرقام (الخانة الثالثة = رقم الدورة 1/2/3).
      const firstNonEmpty = (...values) => {
        for (const value of values) {
          if (value !== undefined && value !== null && String(value).trim() !== '') return value;
        }
        return null;
      };

      const examFullMap = {};
      allExams.forEach(exam => { examFullMap[String(exam.id)] = exam; });

      const studentFullMap = {};
      students.forEach(student => { studentFullMap[String(student.id)] = student; });

      const getCycleNumber = (caseRow, studentRow, examRow) => {
        const direct = firstNonEmpty(
          caseRow?.registration_cycle, caseRow?.cycle_number, caseRow?.cycle, caseRow?.exam_cycle,
          studentRow?.registration_cycle, studentRow?.cycle_number, studentRow?.cycle, studentRow?.exam_cycle,
          examRow?.registration_cycle, examRow?.cycle_number, examRow?.cycle, examRow?.exam_cycle
        );
        const n = Number(direct);
        if ([1, 2, 3].includes(n)) return n;

        const seat = firstNonEmpty(
          caseRow?.seating_number, caseRow?.seat_number, caseRow?.exam_seating_number,
          studentRow?.seating_number, studentRow?.seat_number, studentRow?.exam_seating_number,
          studentRow?.رقم_الجلوس
        );
        const seatText = String(seat || '').trim();
        if (/^\d{10}$/.test(seatText)) {
          const cycle = Number(seatText.charAt(2));
          if ([1, 2, 3].includes(cycle)) return cycle;
        }
        return 0;
      };

      const cheatingCasesByCycle = {
        'الدورة الأولى': 0,
        'الدورة الثانية': 0,
        'الدورة الثالثة': 0
      };

      cheatingCases.forEach(caseRow => {
        const studentRow = studentFullMap[String(caseRow.student_id)] || null;
        const examRow = examFullMap[String(caseRow.exam_id)] || null;
        const cycle = getCycleNumber(caseRow, studentRow, examRow);
        if ([1, 2, 3].includes(cycle)) {
          cheatingCasesByCycle[`الدورة ${['الأولى', 'الثانية', 'الثالثة'][cycle - 1]}`] += 1;
        }
      });

      // إحصائيات استفسارات الدعم الفني حسب الدورة:
      // الواصلة = كل رسائل الطلاب، والمتعامل معها = الرسائل التي فُتحت وأصبحت مقروءة.
      const studentSupportByCycle = {
        'الدورة الأولى': { received: 0, handled: 0 },
        'الدورة الثانية': { received: 0, handled: 0 },
        'الدورة الثالثة': { received: 0, handled: 0 }
      };
      const { data: supportRows, error: supportError } = await supabase
        .from('student_support_messages')
        .select('student_id, sender_type, is_read');
      if (supportError) {
        console.warn('Student support statistics lookup failed:', supportError.message);
      } else {
        const supportStudentIds = [...new Set((supportRows || []).map(r => r.student_id).filter(id => id != null))];
        let supportStudentMap = {};
        if (supportStudentIds.length) {
          const { data: supportStudents, error: supportStudentsError } = await supabase
            .from('students').select('id, registration_cycle, seating_number').in('id', supportStudentIds);
          if (!supportStudentsError) (supportStudents || []).forEach(st => { supportStudentMap[String(st.id)] = st; });
        }
        (supportRows || []).forEach(row => {
          if (row.sender_type !== 'student') return;
          const st = supportStudentMap[String(row.student_id)] || {};
          const cycle = Number(st.registration_cycle);
          const label = [1,2,3].includes(cycle) ? `الدورة ${['الأولى','الثانية','الثالثة'][cycle-1]}` : null;
          if (!label) return;
          studentSupportByCycle[label].received += 1;
          if (row.is_read) studentSupportByCycle[label].handled += 1;
        });
      }

      // عدّ حالات الغش المعروضة في البطاقة الرئيسية لامتحانات اليوم فقط.
      const currentCheatingCases = cheatingCases.filter(caseRow =>
        todayExamIds.has(String(caseRow.exam_id))
      );

      // إعادة بناء توزيع الفروع لليوم فقط.
      Object.keys(cheatingByBranch).forEach(key => delete cheatingByBranch[key]);
      currentCheatingCases.forEach(caseRow => {
        const branchId =
          cheatingExamMap[String(caseRow.exam_id)] ??
          cheatingStudentMap[String(caseRow.student_id)];
        const branchName =
          branchId != null && branchMap[String(branchId)]
            ? branchMap[String(branchId)]
            : 'غير محدد';
        cheatingByBranch[branchName] = (cheatingByBranch[branchName] || 0) + 1;
      });

      setStats({
        studentsCount: totalStudents || students.length,
        eligibleRegistrationStudentsCount: eligibleRegistrationStudentsCount || 0,
        runningExamsCount,
        upcomingExamsCount,
        finishedExamsCount,
        maleCount: males,
        femaleCount: females,
        branchesCount: branchesCount || 0,
        studentsByBranch: byBranch,
        studentsByDirectorate: byDirectorate,
        submittedExamsCount: submitted,
        notSubmittedExamsCount: notSubmitted || students.length - submitted,
        questionsCount: questions || 0,
        examsCount: examsCount || allExams.length,
        passedStudentsCount: passed,
        activeSystemsCount: students.length,
        supervisorsCount: totalSupervisors || supervisors.length,
        activeSupervisorsCount: activeSupervisors,
        todayExamsCount: todayExamsList.length,
        tomorrowExamsCount: tomorrowExamsList.length,
        todayExamsList: todayExamsList,
        tomorrowExamsList: tomorrowExamsList,
        activeNowStudentsCount: activeNow,
        currentlyTestingCount: currentlyTesting,
        submittedTodayCount: submittedStudentNumbers.size,
        cheatingCasesCount: currentCheatingCases.length,
        cheatingCasesByBranch: cheatingByBranch,
        cheatingCasesByCycle: cheatingCasesByCycle,
        studentSupportByCycle
      });

    } catch (err) {
      console.error('Error:', err);
      setDataAccessWarning(
        `تعذر تحميل بعض بيانات الإحصائيات: ${err?.message || 'خطأ غير معروف'}`
      );
    } finally {
      setLoadingState(false);
    }
  };

  const supportTh = { padding: '12px', textAlign: 'right', color: '#67e8f9', borderBottom: '1px solid #334155' };
const supportTd = { padding: '12px', textAlign: 'right', color: '#e2e8f0', borderBottom: '1px solid #0f172a' };

const baseCardStyle = {
    backgroundColor: '#1e293b',
    padding: '20px',
    borderRadius: '12px',
    textAlign: 'center',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    color: '#fff'
  };

  if (loadingState) {
    return <div style={{ textAlign: 'center', padding: '20px', color: '#93c5fd' }}>جاري تحميل الإحصائيات...</div>;
  }

  const totalDirectoratesCount = Object.values(stats.studentsByDirectorate).reduce((a, b) => a + b, 0);

  return (
    <div style={{ direction: 'rtl', color: '#fff' }}>
      {dataAccessWarning && (
        <div style={{ marginBottom: '15px', padding: '12px 16px', borderRadius: '10px', background: '#4c1d1d', color: '#fecaca', border: '1px solid #ef4444' }}>
          ⚠️ {dataAccessWarning}
        </div>
      )}

      <h3 style={styles?.sectionTitle || { fontSize: '20px', marginBottom: '20px', color: '#60a5fa', borderBottom: '2px solid #2563eb', paddingBottom: '8px' }}>
        📊 الإحصائيات الشاملة للنظام وغرفة الامتحانات
      </h3>

      {/* ================= قطاع بيانات الامتحان ================= */}
      <h4 style={{ color: '#a78bfa', fontSize: '16px', margin: '20px 0 10px 0', borderRight: '4px solid #a78bfa', paddingRight: '8px' }}>
        📝 بيانات الامتحانات
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        
        <div style={{ ...baseCardStyle, border: '1px solid #3b82f6' }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#60a5fa', fontSize: '14px' }}>امتحانات اليوم</h5>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#60a5fa' }}>{stats.todayExamsCount}</span>
        </div>

        <div style={{ ...baseCardStyle, border: '1px solid #a78bfa' }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#a78bfa', fontSize: '14px' }}>امتحانات الغد</h5>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#a78bfa' }}>{stats.tomorrowExamsCount}</span>
        </div>

        <div style={{ ...baseCardStyle, border: '1px solid #a78bfa' }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#a78bfa', fontSize: '14px' }}>إجمالي الامتحانات</h5>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#a78bfa' }}>{stats.examsCount}</span>
        </div>

        <div style={{ ...baseCardStyle, border: '1px solid #fbbf24' }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#fbbf24', fontSize: '14px' }}>أسئلة بنك الأسئلة</h5>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#fbbf24' }}>{stats.questionsCount}</span>
        </div>

      </div>

      {/* قسم تفاصيل الامتحانات (اليوم والغد) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '25px' }}>
        
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #3b82f6' }}>
          <h4 style={{ color: '#60a5fa', marginBottom: '15px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
            📅 تفاصيل امتحانات اليوم (العدد: {stats.todayExamsCount})
          </h4>
          {stats.todayExamsList.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>لا توجد امتحانات مجدولة لهذا اليوم</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {stats.todayExamsList.map((ex, idx) => (
                <li key={idx} style={{ padding: '12px 0', borderBottom: '1px solid #0f172a', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '15px' }}>📚 {ex.subjectName}</span>
                    <span style={{ backgroundColor: '#1d4ed8', color: '#93c5fd', padding: '2px 8px', borderRadius: '6px', fontSize: '12px' }}>الفرع: {ex.branch}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <span>⏰ التوقيت: {ex.time}</span>
                    <span>⏳ المدة: {ex.duration} دقيقة</span>
                    <span style={{ color: '#34d399', fontWeight: 'bold' }}>👥 المسجلون: {ex.registeredStudents} طالب</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #a78bfa' }}>
          <h4 style={{ color: '#a78bfa', marginBottom: '15px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
            📆 تفاصيل امتحانات الغد (العدد: {stats.tomorrowExamsCount})
          </h4>
          {stats.tomorrowExamsList.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>لا توجد امتحانات مجدولة ليوم غد</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {stats.tomorrowExamsList.map((ex, idx) => (
                <li key={idx} style={{ padding: '12px 0', borderBottom: '1px solid #0f172a', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '15px' }}>📚 {ex.subjectName}</span>
                    <span style={{ backgroundColor: '#6d28d9', color: '#ddd6fe', padding: '2px 8px', borderRadius: '6px', fontSize: '12px' }}>الفرع: {ex.branch}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <span>⏰ التوقيت: {ex.time}</span>
                    <span>⏳ المدة: {ex.duration} دقيقة</span>
                    <span style={{ color: '#34d399', fontWeight: 'bold' }}>👥 المسجلون: {ex.registeredStudents} طالب</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>


      {/* ================= قطاع بيانات الطلاب ================= */}
      <h4 style={{ color: '#60a5fa', fontSize: '16px', margin: '30px 0 10px 0', borderRight: '4px solid #60a5fa', paddingRight: '8px' }}>
        👨‍🎓 بيانات الطلاب
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        
        <div style={{ ...baseCardStyle, border: '1px solid #22c55e' }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#22c55e', fontSize: '14px' }}>الطلاب الذين يحق لهم التسجيل بالنظام</h5>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#22c55e' }}>
            {stats.eligibleRegistrationStudentsCount}
          </span>
        </div>

        <div style={{ ...baseCardStyle, border: '1px solid #60a5fa' }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#60a5fa', fontSize: '14px' }}>إجمالي الطلبة المسجلين</h5>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#60a5fa' }}>{stats.studentsCount}</span>
        </div>

        <div style={{ ...baseCardStyle, border: '1px solid #38bdf8' }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '14px' }}>الطلبة الذكور / الإناث</h5>
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#38bdf8' }}>
            {stats.maleCount} ذكر / {stats.femaleCount} أنثى
          </span>
        </div>

        <div style={{ ...baseCardStyle, border: '1px solid #f472b6' }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#f472b6', fontSize: '14px' }}>الطلاب النشطون حالياً</h5>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#f472b6' }}>{stats.activeNowStudentsCount}</span>
        </div>

        <div style={{ ...baseCardStyle, border: '1px solid #facc15' }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#facc15', fontSize: '14px' }}>يمتحنون الآن</h5>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#facc15' }}>{stats.currentlyTestingCount}</span>
        </div>

        <div style={{ ...baseCardStyle, border: '1px solid #34d399' }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#34d399', fontSize: '14px' }}>سلّموا الامتحانات</h5>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#34d399' }}>{stats.submittedExamsCount}</span>
        </div>

        <div style={{ ...baseCardStyle, border: '1px solid #4ade80' }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#4ade80', fontSize: '14px' }}>الطلبة الناجحون</h5>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#4ade80' }}>{stats.passedStudentsCount}</span>
        </div>

        <div style={{ ...baseCardStyle, border: '1px solid #fb7185' }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#fb7185', fontSize: '14px' }}>عدد حالات الغش المسجلة فعليًا</h5>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#fb7185' }}>{stats.cheatingCasesCount}</span>
        </div>

        <div style={{ ...baseCardStyle, border: '1px solid #2dd4bf' }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#2dd4bf', fontSize: '14px' }}>إجمالي الفروع</h5>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#2dd4bf' }}>{stats.branchesCount}</span>
        </div>

      </div>

      {/* تفاصيل الفروع والمديريات للطلاب */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '25px' }}>
        
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #2dd4bf' }}>
          <h4 style={{ color: '#2dd4bf', marginBottom: '15px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
            🏫 عدد الطلبة المسجلين بكل فرع (الإجمالي: {stats.studentsCount})
          </h4>
          {Object.keys(stats.studentsByBranch).length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>لا توجد بيانات متاحة</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {Object.entries(stats.studentsByBranch).map(([branch, count], idx) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #0f172a' }}>
                  <span>{branch}</span>
                  <span style={{ backgroundColor: '#0d9488', color: '#fff', padding: '2px 10px', borderRadius: '4px', fontWeight: 'bold' }}>{count} طالب</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #34d399' }}>
          <h4 style={{ color: '#34d399', marginBottom: '15px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
            🏢 عدد الطلبة بكل مديرية (الإجمالي: {totalDirectoratesCount})
          </h4>
          {Object.keys(stats.studentsByDirectorate).length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>لا توجد بيانات متاحة</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {Object.entries(stats.studentsByDirectorate).map(([dir, count], idx) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #0f172a' }}>
                  <span>{dir}</span>
                  <span style={{ backgroundColor: '#059669', color: '#fff', padding: '2px 10px', borderRadius: '4px', fontWeight: 'bold' }}>{count} طالب</span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>

      {/* استفسارات الدعم الفني حسب الدورة */}
      <h4 style={{ color: '#22d3ee', fontSize: '16px', margin: '30px 0 10px 0', borderRight: '4px solid #22d3ee', paddingRight: '8px' }}>
        🎧 استفسارات الدعم الفني حسب الدورة
      </h4>
      <div style={{ overflowX: 'auto', background: '#1e293b', borderRadius: 12, border: '1px solid #164e63', marginBottom: 25 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
          <thead><tr><th style={supportTh}>الدورة</th><th style={supportTh}>الاستفسارات الواصلة</th><th style={supportTh}>الاستفسارات التي تم التعامل معها</th></tr></thead>
          <tbody>{['الدورة الأولى','الدورة الثانية','الدورة الثالثة'].map(cycle => (
            <tr key={cycle}>
              <td style={supportTd}>{cycle}</td>
              <td style={supportTd}>{stats.studentSupportByCycle?.[cycle]?.received || 0}</td>
              <td style={supportTd}>{stats.studentSupportByCycle?.[cycle]?.handled || 0}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {/* إجمالي حالات الغش حسب الدورة */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        {['الدورة الأولى', 'الدورة الثانية', 'الدورة الثالثة'].map((cycle, idx) => (
          <div key={cycle} style={{ ...baseCardStyle, border: '1px solid #fb7185' }}>
            <h5 style={{ margin: '0 0 10px 0', color: '#fb7185', fontSize: '14px' }}>🚨 إجمالي الغش - {cycle}</h5>
            <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#fb7185' }}>
              {stats.cheatingCasesByCycle?.[cycle] || 0}
            </span>
          </div>
        ))}
      </div>

      {/* حالات الغش التراكمية حسب الفروع */}
      <div style={{
        backgroundColor: '#1e293b',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #fb7185',
        marginBottom: '25px'
      }}>
        <h4 style={{
          color: '#fb7185',
          marginBottom: '8px',
          paddingBottom: '8px',
          borderBottom: '1px solid #334155'
        }}>
          🚨 حالات الغش في امتحانات اليوم فقط
        </h4>
        <p style={{ color: '#cbd5e1', fontSize: '13px', marginTop: 0, marginBottom: '15px' }}>
          يعرض هذا العداد حالات الغش المسجلة في امتحانات اليوم فقط. أما إجمالي كل دورة فيظهر في البطاقات أدناه.
        </p>

        {Object.keys(stats.cheatingCasesByBranch).length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>لا توجد حالات غش مسجلة حتى الآن</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {Object.entries(stats.cheatingCasesByBranch)
              .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'ar'))
              .map(([branch, count], idx) => (
                <li key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0'
                }}>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{branch}</span>
                  <span style={{
                    backgroundColor: '#9f1239',
                    color: '#ffe4e6',
                    padding: '4px 12px',
                    borderRadius: '999px',
                    fontWeight: 'bold'
                  }}>
                    {count} حالة
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>


      {/* ================= قطاع بيانات الموظفين ================= */}
      <h4 style={{ color: '#c084fc', fontSize: '16px', margin: '30px 0 10px 0', borderRight: '4px solid #c084fc', paddingRight: '8px' }}>
        👨‍💼 بيانات الموظفين (المشرفين)
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
        
        <div style={{ ...baseCardStyle, border: '1px solid #c084fc' }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#c084fc', fontSize: '14px' }}>إجمالي الموظفين</h5>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#c084fc' }}>{stats.supervisorsCount}</span>
        </div>

        <div style={{ ...baseCardStyle, border: '1px solid #4ade80' }}>
          <h5 style={{ margin: '0 0 10px 0', color: '#4ade80', fontSize: '14px' }}>الموظفون النشطون (المفعلون)</h5>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#4ade80' }}>{stats.activeSupervisorsCount}</span>
        </div>

      </div>

    </div>
  );
}