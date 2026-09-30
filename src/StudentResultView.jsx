import React, { useState, useEffect } from 'react';

export default function StudentResultView({ supabase }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [studentResult, setStudentResult] = useState(null);
  const [topStudents, setTopStudents] = useState({});
  const [loadingTop, setLoadingTop] = useState(true);
  const [searching, setSearching] = useState(false);

  const currentYear = new Date().getFullYear();

  const getStudentName = (student) =>
    student?.full_name_ar || student?.full_name || student?.name || 'غير محدد';

  const formatPercentage = (value) => {
    const n = Number(value);
    return (Number.isFinite(n) ? n : 0).toFixed(1);
  };

  const englishDigits = (value) => String(value ?? '')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[^0-9]/g, '');

  const normalizeIdentifierQuery = (value) => {
    const raw = String(value ?? '');
    const latin = englishDigits(raw);
    return /^[0-9٠-٩]+$/.test(raw) ? latin.slice(0, 10) : raw.trim();
  };

  const getNationalId = (student) => englishDigits(student?.national_id ?? student?.identity_number ?? student?.id_number).slice(0, 9);
  const getSeatNumber = (student) => englishDigits(
    student?.seating_number ?? student?.seat_number ?? student?.exam_seating_number
  ).slice(0, 10);

  const submissionTime = (sub) => {
    const value = sub?.submitted_at ?? sub?.created_at ?? sub?.updated_at;
    const t = value ? new Date(value).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  };

  const submissionCycle = (sub) => {
    const direct = Number(sub?.registration_cycle ?? sub?.cycle_number ?? sub?.cycle ?? sub?.exam_cycle);
    if ([1, 2, 3].includes(direct)) return direct;
    const seat = englishDigits(sub?.seating_number ?? sub?.seat_number ?? sub?.exam_seating_number ?? '').slice(0, 10);
    if (seat.length === 10 && [1, 2, 3].includes(Number(seat[2]))) return Number(seat[2]);
    return 0;
  };

  const isLaterSubmission = (candidate, current) => {
    if (!current) return true;
    const cc = submissionCycle(candidate);
    const pc = submissionCycle(current);
    return cc !== pc ? cc > pc : submissionTime(candidate) > submissionTime(current);
  };

  const scoreOfSubmission = (sub) => {
    const values = [
      sub?.obtained_marks, sub?.total_score, sub?.final_score,
      sub?.base_score, sub?.score, sub?.mark
    ].map(Number).filter(Number.isFinite);
    return values.find(v => v !== 0) ?? values[0] ?? 0;
  };

  // دالة مساعدة لاختيار العنصر الأعلى في مجموعة مواد متشابهة
  const chooseHighestPairSubmissions = (subsMap, keywords, subjectsMap) => {
    const matchingEntries = Object.entries(subsMap).filter(([subId]) => {
      const subj = subjectsMap[subId];
      if (!subj) return false;
      const sName = (subj.subject_name || subj.name || '').toLowerCase();
      return keywords.some((k) => sName.includes(k.toLowerCase()));
    });

    if (matchingEntries.length <= 1) return;

    // ترتيب تنازلي حسب العلامة لاختيار الأعلى وإلغاء الباقي من الاحتساب
    matchingEntries.sort((a, b) => b[1].mark - a[1].mark);
    for (let i = 1; i < matchingEntries.length; i++) {
      const subIdToRemove = matchingEntries[i][0];
      delete subsMap[subIdToRemove];
    }
  };

  // دالة مطابقة قواعد احتساب المجموع والمعدل وحالة الطالب بناءً على الفرع وتوجيهاتك الـ 9
  const calculateAdvancedResult = (studentSubs, branchName, subjectsMap, examsMap) => {
    const subsMap = {};
    let failedCount = 0;
    let totalMarks = 0;

    Object.values(studentSubs || {}).forEach((sub) => {
      const exam = examsMap[String(sub.exam_id)] || {};
      const subjectId = exam.subject_id || sub.subject_id;
      const subject = subjectsMap[String(subjectId)] || {};
      
      const mark = scoreOfSubmission(sub);
      const minMark = Number(
        exam.min_marks ??
        exam.minimum_mark ??
        exam.passing_marks ??
        subject.minimum_mark ??
        subject.min_mark ??
        50
      );

      subsMap[String(subjectId)] = {
        mark,
        minMark,
        subjectId
      };
    });

    const bName = (branchName || '').toLowerCase();

    // تطبيق قواعد الاستثناء واختيار العلامة الأعلى لكل فرع
    if (bName.includes('علمي')) {
      chooseHighestPairSubmissions(subsMap, ['التربية الاسلامية', 'التربية الإسلامية', 'اسلامية', 'التكنولوجيا', 'تكنولوجيا'], subjectsMap);
      chooseHighestPairSubmissions(subsMap, ['الكيمياء', 'كيمياء', 'الاحياء', 'الأحياء', 'احياء'], subjectsMap);
    } else if (bName.includes('ادبي') || bName.includes('أدبي')) {
      chooseHighestPairSubmissions(subsMap, ['التربية الاسلامية', 'التربية الإسلامية', 'اسلامية', 'جغرافيا'], subjectsMap);
      chooseHighestPairSubmissions(subsMap, ['الثقافة العلمية', 'التكنولوجيا'], subjectsMap);
    } else if (bName.includes('زراعي')) {
      chooseHighestPairSubmissions(subsMap, ['الاحياء', 'الأحياء', 'احياء', 'رياضيات'], subjectsMap);
      chooseHighestPairSubmissions(subsMap, ['الكيمياء', 'التربية الإسلامية', 'التربية الاسلامية', 'الاحياء'], subjectsMap);
    } else if (bName.includes('صناعي')) {
      chooseHighestPairSubmissions(subsMap, ['الرسم الصناعي', 'الفيزياء'], subjectsMap);
      chooseHighestPairSubmissions(subsMap, ['التربية الاسلامية', 'التكنولوجيا'], subjectsMap);
    } else if (bName.includes('اقتصاد منزلي')) {
      chooseHighestPairSubmissions(subsMap, ['التكنولوجيا', 'رياضيات', 'التربية الاسلامية', 'التربية الإسلامية', 'الكيمياء'], subjectsMap);
    } else if (bName.includes('فندقي')) {
      chooseHighestPairSubmissions(subsMap, ['التكنولوجيا', 'رياضيات', 'التربية الاسلامية', 'التربية الإسلامية', 'السياحة'], subjectsMap);
    } else if (bName.includes('ريادة') || bName.includes('اعمال')) {
      chooseHighestPairSubmissions(subsMap, ['المحاسبة', 'المشاريع الصغيرة'], subjectsMap);
      chooseHighestPairSubmissions(subsMap, ['التربية الاسلامية', 'التكنولوجيا'], subjectsMap);
    } else if (bName.includes('تكنولوجي')) {
      chooseHighestPairSubmissions(subsMap, ['الاتصالات والالكترونيات', 'الريادة والاعمال'], subjectsMap);
      chooseHighestPairSubmissions(subsMap, ['التربية الاسلامية', 'الثقافة العلمية'], subjectsMap);
    } else if (bName.includes('شرعي')) {
      chooseHighestPairSubmissions(subsMap, ['الفقه الاسلامي', 'التاريخ'], subjectsMap);
      chooseHighestPairSubmissions(subsMap, ['الجغرافيا', 'التكنولوجيا'], subjectsMap);
    }

    const calculatedSelected = Object.values(subsMap);
    
    // المجموع يتم جمعه من 7 مواد فقط حسب الشروط وتتم القسمة على 700 للمعدل
    calculatedSelected.forEach((item) => {
      totalMarks += item.mark;
      if (item.mark < item.minMark) {
        failedCount++;
      }
    });

    const percentage = (totalMarks / 700) * 100;

    // تحديد النتيجة وحالة الطالب بدقة
    let status = 'ناجح';
    let isPassed = true;

    if (failedCount >= 1 && failedCount <= 4) {
      status = 'مكمل (إكمال)';
      isPassed = false;
    } else if (failedCount > 4 || percentage < 50) {
      status = 'راسب';
      isPassed = false;
    }

    return {
      totalMarks,
      maximumMarks: 700,
      percentage: Number.isFinite(percentage) ? percentage : 0,
      status,
      failedCount,
      isPassed
    };
  };

  useEffect(() => {
    fetchTopStudents();
  }, []);

  const fetchTopStudents = async () => {
    setLoadingTop(true);

    try {
      const [studentsRes, submissionsRes, branchesRes, directoratesRes, schoolsRes, examsRes, subjectsRes] = await Promise.all([
        supabase.from('students').select('*').catch(() => ({ data: [] })),
        supabase.from('submissions').select('*').order('submitted_at', { ascending: false }).catch(() => ({ data: [] })),
        supabase.from('branches').select('*').catch(() => ({ data: [] })),
        supabase.from('directorates').select('*').catch(() => ({ data: [] })),
        supabase.from('schools').select('*').catch(() => ({ data: [] })),
        supabase.from('exams').select('*').catch(() => ({ data: [] })),
        supabase.from('subjects').select('*').catch(() => ({ data: [] }))
      ]);

      const students = studentsRes.data || [];
      const submissions = submissionsRes.data || [];
      const branches = branchesRes.data || [];
      const directorates = directoratesRes.data || [];
      const schools = schoolsRes.data || [];
      const exams = examsRes.data || [];
      const subjects = subjectsRes.data || [];

      const examsMap = {};
      exams.forEach((e) => { examsMap[String(e.id)] = e; });

      const subjectsMap = {};
      subjects.forEach((s) => { subjectsMap[String(s.id)] = s; });

      const branchMap = {};
      branches.forEach((branch) => {
        branchMap[String(branch.id)] = branch.branch_name || branch.name || branch.branch || 'غير محدد';
      });

      const directorateMap = {};
      directorates.forEach((d) => { directorateMap[String(d.id)] = d.directorate_name || d.name || 'غير محددة'; });

      const schoolMap = {};
      schools.forEach((s) => { schoolMap[String(s.id)] = s.school_name || s.name || 'غير محددة'; });

      const studentsMap = {};
      students.forEach((student) => { studentsMap[String(student.id)] = student; });

      // تجميع تقديمات كل طالب لاحتساب النتيجة والمعدل الشامل المعتمد
      const studentSubsGroup = {};
      submissions.filter((sub) => submissionCycle(sub) === 1).forEach((sub) => {
        const studentId = sub.student_id;
        if (!studentId) return;
        if (!studentSubsGroup[studentId]) studentSubsGroup[studentId] = {};

        const exam = examsMap[String(sub.exam_id)] || {};
        const subjId = exam.subject_id ?? sub.subject_id;
        if (subjId == null) return;

        const key = String(subjId);
        const current = studentSubsGroup[studentId][key];
        if (!current || isLaterSubmission(sub, current)) {
          studentSubsGroup[studentId][key] = sub;
        }
      });

      const evaluatedStudentsByBranch = {};

      Object.entries(studentSubsGroup).forEach(([studentId, subsMap]) => {
        const student = studentsMap[studentId];
        if (!student) return;

        const branchId = student.branch_id ?? student.branch;
        const branchName = branchMap[String(branchId)] || student.branch_name || student.branch || 'غير محدد';

        const calc = calculateAdvancedResult(subsMap, branchName, subjectsMap, examsMap);

        // شرط التنافس على الأوائل: أن يكون الطالب ناجحاً في جميع المواد
        if (calc.status !== 'ناجح') return;

        const item = {
          ...student,
          calculatedResult: calc,
          displayPercentage: calc.percentage,
          displayBranch: branchName,
          displayDirectorate: directorateMap[String(student.directorate_id)] || student.directorate_name || 'غير محددة',
          displaySchool: schoolMap[String(student.school_id)] || student.school_name || 'غير محددة'
        };

        if (!evaluatedStudentsByBranch[branchName]) {
          evaluatedStudentsByBranch[branchName] = [];
        }
        evaluatedStudentsByBranch[branchName].push(item);
      });

      // ترتيب الأوائل وتحديد المراكز والترتيب المكرر بدقة
      Object.keys(evaluatedStudentsByBranch).forEach((branchName) => {
        const sorted = evaluatedStudentsByBranch[branchName].sort((a, b) => b.displayPercentage - a.displayPercentage);
        const processedList = [];
        let currentRank = 1;

        for (let i = 0; i < sorted.length && processedList.length < 10; i++) {
          const currentItem = sorted[i];
          if (i > 0) {
            const prevItem = sorted[i - 1];
            if (currentItem.displayPercentage < prevItem.displayPercentage) {
              currentRank = i + 1;
            }
          }

          const isDuplicate =
            (i > 0 && sorted[i - 1].displayPercentage === currentItem.displayPercentage) ||
            (i < sorted.length - 1 && sorted[i + 1].displayPercentage === currentItem.displayPercentage);

          let rankText = '';
          if (currentRank === 1) rankText = isDuplicate ? 'الأول مكرر' : 'الأول';
          else if (currentRank === 2) rankText = isDuplicate ? 'الثاني مكرر' : 'الثاني';
          else if (currentRank === 3) rankText = isDuplicate ? 'الثالث مكرر' : 'الثالث';
          else {
            const ordinals = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
            rankText = ordinals[currentRank] || `${currentRank}`;
            if (isDuplicate) rankText += ' مكرر';
          }

          processedList.push({ ...currentItem, calculatedRank: rankText });
        }

        evaluatedStudentsByBranch[branchName] = processedList;
      });

      setTopStudents(evaluatedStudentsByBranch);
    } catch (err) {
      console.error('خطأ في جلب أوائل الطلبة:', err);
      setTopStudents({});
    } finally {
      setLoadingTop(false);
    }
  };

  const findStudent = async (q) => {
    try {
      const searchValue = normalizeIdentifierQuery(q);

      if (/^\d{10}$/.test(searchValue)) {
        const { data: seatingData } = await supabase.from('students').select('*').eq('seating_number', searchValue).limit(1);
        if (seatingData?.length) return seatingData[0];
      }

      if (/^\d{9}$/.test(searchValue)) {
        const { data: nationalData } = await supabase.from('students').select('*').eq('national_id', searchValue).limit(1);
        if (nationalData?.length) return nationalData[0];
      }

      for (const column of ['full_name_ar', 'full_name', 'name']) {
        const { data: nameData } = await supabase.from('students').select('*').ilike(column, `%${q}%`).limit(1);
        if (nameData?.length) return nameData[0];
      }

      // إذا لم يوجد الطالب في students نبحث في finish_student.
      if (/^\d{10}$/.test(searchValue)) {
        const { data } = await supabase.from('finish_student').select('*').eq('seating_number', searchValue).limit(1);
        if (data?.length) return { ...data[0], __archived: true };
      }
      if (/^\d{9}$/.test(searchValue)) {
        const { data } = await supabase.from('finish_student').select('*').eq('national_id', searchValue).limit(1);
        if (data?.length) return { ...data[0], __archived: true };
      }
      for (const column of ['full_name_ar', 'full_name', 'name']) {
        const { data } = await supabase.from('finish_student').select('*').ilike(column, `%${q}%`).limit(1);
        if (data?.length) return { ...data[0], __archived: true };
      }
    } catch (e) {
      console.error('خطأ أثناء البحث عن الطالب:', e);
    }
    return null;
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = normalizeIdentifierQuery(searchQuery);
    if (!q) return;

    setSearching(true);
    setStudentResult(null);

    try {
      const student = await findStudent(q);
      if (!student) {
        setStudentResult({ notFound: true });
        setSearching(false);
        return;
      }

      const [submissionsRes, branchesRes, directoratesRes, schoolsRes, examsRes, subjectsRes] = await Promise.all([
        supabase.from('submissions').select('*').eq('student_id', student.id).catch(() => ({ data: [] })),
        supabase.from('branches').select('*').catch(() => ({ data: [] })),
        supabase.from('directorates').select('*').catch(() => ({ data: [] })),
        supabase.from('schools').select('*').catch(() => ({ data: [] })),
        supabase.from('exams').select('*').catch(() => ({ data: [] })),
        supabase.from('subjects').select('*').catch(() => ({ data: [] }))
      ]);

      const submissions = submissionsRes.data || [];
      const branch = (branchesRes.data || []).find((item) => String(item.id) === String(student.branch_id));
      const directorate = (directoratesRes.data || []).find((item) => String(item.id) === String(student.directorate_id));
      const school = (schoolsRes.data || []).find((item) => String(item.id) === String(student.school_id));
      
      const examsMap = {};
      (examsRes.data || []).forEach((e) => { examsMap[String(e.id)] = e; });
      const subjectsMap = {};
      (subjectsRes.data || []).forEach((s) => { subjectsMap[String(s.id)] = s; });

      const studentSubsMap = {};
      submissions.forEach((sub) => {
        const exam = examsMap[String(sub.exam_id)] || {};
        const subjId = exam.subject_id || sub.subject_id;
        if (subjId && !studentSubsMap[subjId]) {
          studentSubsMap[subjId] = sub;
        }
      });

      const branchName = branch?.branch_name || branch?.name || student.branch_name || student.branch || '';
      const calcResult = student.__archived
        ? {
            totalMarks: Number(student.final_total ?? student.total_score ?? student.final_score ?? 0) || 0,
            maximumMarks: 700,
            percentage: Number(student.final_average ?? student.percentage ?? 0) || 0,
            status: student.final_result || student.result || student.status || 'غير محدد',
            failedCount: 0,
            isPassed: String(student.final_result || student.result || '').startsWith('ناجح')
          }
        : calculateAdvancedResult(studentSubsMap, branchName, subjectsMap, examsMap);

      if (!student.__archived && student.id) {
        const payload = {
          final_total: Number(calcResult.totalMarks) || 0,
          final_average: Number(calcResult.percentage) || 0,
          final_result: String(calcResult.status || '').startsWith('مكمل') ? 'مكمل' : calcResult.status,
          result_updated_at: new Date().toISOString()
        };
        const { error: saveError } = await supabase.from('students').update(payload).eq('id', student.id);
        if (saveError) console.warn('تعذر حفظ المعدل والنتيجة في students:', saveError.message);
      }

      setStudentResult({
        student,
        submissions,
        calculatedResult: calcResult,
        displayBranch: branchName || 'غير محدد',
        displayDirectorate: directorate?.directorate_name || directorate?.name || 'غير مشخصة',
        displaySchool: school?.school_name || school?.name || 'غير مشخصة',
        notFound: false
      });
    } catch (err) {
      console.error('خطأ في جلب تفاصيل نتائج الطالب:', err);
      setStudentResult({ notFound: true });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>📊 عرض نتائج ومعدلات الطلبة والشهادات</h2>

        <form onSubmit={handleSearch} style={styles.searchForm}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              const value = e.target.value;
              const normalized = /^[0-9٠-٩]+$/.test(value)
                ? englishDigits(value).slice(0, 10)
                : value;
              setSearchQuery(normalized);
            }}
            inputMode="text"
            maxLength={100}
            placeholder="ابحث باسم الطالب أو رقم الهوية (9) أو رقم الجلوس (10)..."
            style={styles.input}
            required
          />
          <button type="submit" disabled={searching} style={{ ...styles.searchBtn, opacity: searching ? 0.7 : 1 }}>
            {searching ? 'جاري البحث...' : '🔍 بحث'}
          </button>
        </form>

        <p style={styles.searchHint}>يمكنك البحث باستخدام <b>الاسم</b> أو <b>رقم الهوية</b> أو <b>رقم الجلوس</b>.</p>

        {studentResult && (
          <div style={styles.resultBox}>
            <h3 style={styles.resultTitle}>📄 نتيجة الطالب النهائية</h3>

            {studentResult.notFound ? (
              <p style={styles.errorText}>⚠️ لم يتم العثور على طالب بالاسم أو رقم الهوية أو رقم الجلوس المدخل.</p>
            ) : (
              <>
                <div style={styles.studentInfoGrid}>
                  <p><b>اسم الطالب:</b> {getStudentName(studentResult.student)}</p>
                  <p><b>رقم الجلوس:</b> {getSeatNumber(studentResult.student) || 'غير محدد'}</p>
                  <p><b>رقم الهوية:</b> {getNationalId(studentResult.student) || 'غير محدد'}</p>
                  <p><b>الفرع:</b> {studentResult.displayBranch}</p>
                  <p><b>المديرية:</b> {studentResult.displayDirectorate}</p>
                  <p><b>المدرسة:</b> {studentResult.displaySchool}</p>
                </div>

                <div style={styles.resultGrid}>
                  <div style={styles.resultItem}>
                    <span>المجموع العام</span>
                    <strong>{studentResult.calculatedResult.totalMarks} / {studentResult.calculatedResult.maximumMarks}</strong>
                  </div>
                  <div style={styles.resultItem}>
                    <span>المعدل النسبي</span>
                    <strong style={styles.greenValue}>{formatPercentage(studentResult.calculatedResult.percentage)}%</strong>
                  </div>
                  <div style={styles.resultItem}>
                    <span>النتيجة النهائية</span>
                    <strong style={{
                      color: studentResult.calculatedResult.isPassed ? '#4ade80' : (studentResult.calculatedResult.status.includes('مكمل') ? '#facc15' : '#f87171')
                    }}>
                      {studentResult.calculatedResult.status}
                    </strong>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* قسم الأوائل بحسب القواعد المعتمدة */}
        <div style={{ marginTop: '40px', borderTop: '2px solid rgba(255,255,255,0.1)', paddingTop: '25px' }}>
          <h3 style={styles.mainTopHeader}>
            🏆 العشرة الأوائل على محافظات الوطن في كافة الفروع للعام: {currentYear}
          </h3>

          {loadingTop ? (
            <p style={styles.emptyText}>جاري تحميل قائمة الأوائل...</p>
          ) : Object.keys(topStudents).length === 0 ? (
            <p style={styles.emptyText}>لا توجد نتائج مطابقة لشروط النجاح التام في جميع المواد حالياً.</p>
          ) : (
            Object.entries(topStudents).map(([branchName, studentsList]) => (
              <div key={branchName} style={{ marginBottom: '35px' }}>
                <h4 style={styles.branchTitle}>الـ 10 أوائل في الفرع: {branchName}</h4>
                <hr style={styles.horizontalLine} />

                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>مسلسل</th>
                        <th style={styles.th}>اسم الطالب</th>
                        <th style={styles.th}>رقم الجلوس</th>
                        <th style={styles.th}>اسم المديرية</th>
                        <th style={styles.th}>اسم المدرسة</th>
                        <th style={styles.th}>المجموع</th>
                        <th style={styles.th}>المعدل %</th>
                        <th style={styles.th}>الترتيب</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentsList.map((item, index) => (
                        <tr key={item.id || index} style={{ backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)' }}>
                          <td style={styles.td}>{index + 1}</td>
                          <td style={{ ...styles.td, fontWeight: 'bold', color: '#38bdf8' }}>{getStudentName(item)}</td>
                          <td style={styles.td}>{getSeatNumber(item) || '-'}</td>
                          <td style={styles.td}>{item.displayDirectorate}</td>
                          <td style={styles.td}>{item.displaySchool}</td>
                          <td style={styles.td}>{item.calculatedResult.totalMarks} / 700</td>
                          <td style={{ ...styles.td, ...styles.greenValue, fontSize: '16px' }}>{formatPercentage(item.displayPercentage)}%</td>
                          <td style={{ ...styles.td, fontWeight: 'bold', color: '#facc15' }}>{item.calculatedRank}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0f172a', padding: '20px', direction: 'rtl', fontFamily: 'Noto Kufi Arabic, sans-serif' },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.75)', backdropFilter: 'blur(10px)', width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '35px', borderRadius: '20px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.37)', border: '1px solid rgba(255, 255, 255, 0.1)' },
  sectionTitle: { color: '#f8fafc', marginBottom: '25px', textAlign: 'center', borderBottom: '2px solid #2563eb', paddingBottom: '12px', fontSize: '26px', fontWeight: 'bold' },
  searchForm: { display: 'flex', gap: '12px', marginBottom: '8px' },
  input: { flex: '1', minWidth: 0, padding: '14px 18px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', fontSize: '16px', color: '#fff', outline: 'none', fontFamily: 'inherit' },
  searchBtn: { backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '0 28px', height: '52px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '17px', whiteSpace: 'nowrap' },
  searchHint: { color: '#94a3b8', fontSize: '14px', marginBottom: '25px' },
  resultBox: { backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(56, 189, 248, 0.4)', padding: '25px', borderRadius: '14px', marginBottom: '30px' },
  resultTitle: { color: '#38bdf8', marginBottom: '18px', fontSize: '20px' },
  errorText: { color: '#f87171', fontWeight: 'bold', fontSize: '18px' },
  studentInfoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px 20px', color: '#f1f5f9', fontSize: '16px' },
  resultGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginTop: '22px' },
  resultItem: { backgroundColor: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '12px', padding: '15px', textAlign: 'center', color: '#cbd5e1' },
  greenValue: { color: '#4ade80', fontWeight: 'bold' },
  mainTopHeader: { color: '#f8fafc', marginBottom: '20px', fontSize: '22px', fontWeight: 'bold', textAlign: 'center' },
  branchTitle: { color: '#60a5fa', margin: '15px 0 8px 0', fontSize: '18px', fontWeight: 'bold' },
  horizontalLine: { border: '0', height: '1px', backgroundColor: 'rgba(59, 130, 246, 0.3)', marginBottom: '15px' },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontSize: '16px' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '15px', minWidth: '900px' },
  th: { padding: '14px', borderBottom: '2px solid rgba(255, 255, 255, 0.15)', color: '#94a3b8', fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: 'right' },
  td: { padding: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: '#e2e8f0', textAlign: 'right' }
};