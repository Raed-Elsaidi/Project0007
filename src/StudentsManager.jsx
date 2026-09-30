import React, { useEffect, useMemo, useState } from 'react';


// ======================================================
// Results announcement gate
// النتائج لا تظهر إلا إذا كان إعلان النتائج مفعّلاً
// ووصل تاريخ ووقت الإعلان من public.result_announcements.
// ======================================================
const checkResultsAnnouncement = async (supabase) => {
  if (!supabase?.from) return { allowed: false, found: false, announcementAt: null };
  try {
    const { data, error } = await supabase.from('result_announcements')
      .select('id, title, description, academic_year, exam_id, result_date, result_time, status, is_active, published_at')
      .eq('is_active', true).neq('status', 'cancelled');
    if (error) { console.error('Error checking result announcement:', error); return { allowed: false, found: false, announcementAt: null, error }; }
    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) return { allowed: false, found: false, announcementAt: null };
    const now = Date.now();
    const parsed = rows.map((row) => {
      const dateText = String(row?.result_date || '').slice(0, 10);
      let timeText = String(row?.result_time || '00:00:00').trim();
      if (/^\d{2}:\d{2}$/.test(timeText)) timeText += ':00';
      return { row, at: new Date(`${dateText}T${timeText}`).getTime() };
    }).filter((x) => Number.isFinite(x.at)).sort((a, b) => a.at - b.at);
    const reached = parsed.find((x) => now >= x.at);
    const upcoming = parsed.find((x) => now < x.at);
    const selected = reached || upcoming || null;
    return { allowed: Boolean(reached), found: true, row: selected?.row || null, announcementAt: selected?.at || null };
  } catch (error) {
    console.error('Unexpected error checking result announcement:', error);
    return { allowed: false, found: false, announcementAt: null, error };
  }
};
const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalize = (value) => String(value ?? '').trim();

const getSeat = (student) => firstValue(
  student?.seating_number,
  student?.seat_number,
  student?.exam_seating_number,
  student?.رقم_الجلوس,
  ''
);

const getBranchId = (row) => firstValue(row?.branch_id, row?.branchId);

const getBranchName = (row) => firstValue(
  row?.branch_name,
  row?.name,
  row?.title,
  row?.branch,
  row?.branchName,
  getBranchId(row) != null ? `فرع ${getBranchId(row)}` : 'غير محدد'
);

const getSubjectId = (row) => firstValue(
  row?.subject_id,
  row?.subjectId,
  row?.id
);

const getSubjectName = (row) => firstValue(
  row?.subject_name,
  row?.name,
  row?.title,
  row?.subjectName,
  row?.اسم_المبحث,
  `مادة ${getSubjectId(row) ?? ''}`
);

const getExamSubjectId = (exam) => firstValue(exam?.subject_id, exam?.subjectId);

const getExamMax = (exam) => toNumber(firstValue(
  exam?.total_marks,
  exam?.total_mark,
  exam?.max_marks,
  exam?.maximum_mark,
  exam?.exam_total,
  0
));

const getSubmissionScore = (submission) => {
  const finalScore = toNumber(submission?.final_score, 0);
  const totalScore = toNumber(submission?.total_score, 0);
  const obtainedMarks = toNumber(submission?.obtained_marks, 0);
  const baseScore = toNumber(submission?.base_score, 0);
  const score = toNumber(submission?.score, 0);
  const mark = toNumber(submission?.mark, 0);

  // final_score هو المعتمد عادةً. إذا كان صف التسليم يحتوي على 0 فيه
  // بينما توجد علامة محسوبة في أحد الحقول الأخرى، لا نظهر 0 للطالب.
  if (finalScore !== 0) return finalScore;

  return Math.max(totalScore, obtainedMarks, baseScore, score, mark, 0);
};

const getSubmissionSeat = (submission) => firstValue(
  submission?.seating_number,
  submission?.seat_number,
  submission?.exam_seating_number,
  submission?.رقم_الجلوس,
  ''
);

const getSubmissionDate = (submission) => {
  const value = firstValue(
    submission?.submitted_at,
    submission?.created_at,
    submission?.updated_at,
    ''
  );
  return value ? new Date(value).getTime() || 0 : 0;
};

const subjectNameText = (subject) => normalize(firstValue(subject?.subject_name, subject?.name, subject?.title, subject?.subjectName, ''));
const isScientificBranch = (name) => normalize(name).includes('علمي') || normalize(name).toLowerCase().includes('scientific');
const isOneOf = (name, words) => {
  const value = subjectNameText(name).toLowerCase();
  return words.some(word => value.includes(word));
};

const normalizeSubjectName = (value) =>
  normalize(value)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');

const subjectMatches = (subject, names) => {
  const value = normalizeSubjectName(subjectNameText(subject));
  return names.some((name) => value.includes(normalizeSubjectName(name)));
};

const pickHighestFromGroup = (cells, names, alreadyCountedKeys = new Set()) => {
  const available = cells.filter(
    (cell) => subjectMatches(cell.subject, names) && !alreadyCountedKeys.has(cell.key)
  );
  if (!available.length) return [];
  const winner = [...available].sort(
    (a, b) => Number(b.mark || 0) - Number(a.mark || 0) || Number(b.max || 0) - Number(a.max || 0)
  )[0];
  return [winner];
};

/*
 * قواعد احتساب المجموع حسب الفرع.
 * كل فرع يجب أن ينتهي إلى 7 مواد محتسبة.
 */
const BRANCH_RULES = [
  {
    test: (name) => normalizeSubjectName(name).includes('علمي') || normalizeSubjectName(name).includes('scientific'),
    groups: [
      ['التربية الاسلامية', 'التكنولوجيا'],
      ['الكيمياء', 'الاحياء']
    ]
  },
  {
    test: (name) => normalizeSubjectName(name).includes('ادبي') || normalizeSubjectName(name).includes('literary'),
    groups: [
      ['التربية الاسلامية', 'الجغرافيا'],
      ['الثقافة العلمية', 'التكنولوجيا']
    ]
  },
  {
    test: (name) => normalizeSubjectName(name).includes('زراعي') || normalizeSubjectName(name).includes('agricultural'),
    groups: [
      ['الاحياء', 'الرياضيات'],
      ['الكيمياء', 'التربية الاسلامية', 'الاحياء']
    ]
  },
  {
    test: (name) => normalizeSubjectName(name).includes('صناعي') || normalizeSubjectName(name).includes('industrial'),
    groups: [
      ['الرسم الصناعي', 'الفيزياء'],
      ['التربية الاسلامية', 'التكنولوجيا', 'الرسم الصناعي', 'الفيزياء']
    ]
  },
  {
    test: (name) => normalizeSubjectName(name).includes('اقتصاد منزلي') || normalizeSubjectName(name).includes('اقتصاد') || normalizeSubjectName(name).includes('home economics'),
    groups: [
      ['التكنولوجيا', 'الرياضيات', 'التربية الاسلامية', 'الكيمياء'],
      ['التكنولوجيا', 'الرياضيات', 'التربية الاسلامية', 'الكيمياء']
    ]
  },
  {
    test: (name) => normalizeSubjectName(name).includes('فندقي') || normalizeSubjectName(name).includes('hotel'),
    groups: [
      ['التكنولوجيا', 'الرياضيات', 'التربية الاسلامية', 'السياحة'],
      ['التكنولوجيا', 'الرياضيات', 'التربية الاسلامية', 'السياحة']
    ]
  },
  {
    test: (name) => normalizeSubjectName(name).includes('ريادة') || normalizeSubjectName(name).includes('اعمال') || normalizeSubjectName(name).includes('entrepreneur'),
    groups: [
      ['المحاسبة', 'المشاريع الصغيرة'],
      ['التربية الاسلامية', 'التكنولوجيا', 'المحاسبة', 'المشاريع الصغيرة']
    ]
  },
  {
    test: (name) => normalizeSubjectName(name).includes('تكنولوجي') || normalizeSubjectName(name).includes('technology'),
    groups: [
      ['الاتصالات والالكترونيات', 'الريادة والاعمال'],
      ['التربية الاسلامية', 'الثقافة العلمية', 'الاتصالات والالكترونيات', 'الريادة والاعمال']
    ]
  },
  {
    test: (name) => normalizeSubjectName(name).includes('شرعي') || normalizeSubjectName(name).includes('sharia') || normalizeSubjectName(name).includes('religious'),
    groups: [
      ['الفقه الاسلامي', 'التاريخ'],
      ['الجغرافيا', 'التكنولوجيا', 'الفقه الاسلامي', 'التاريخ']
    ]
  }
];

const getBranchRule = (branchName) => BRANCH_RULES.find((rule) => rule.test(branchName)) || null;

const calculateCountedCells = (branchName, subjectCells) => {
  const rule = getBranchRule(branchName);
  if (!rule) return subjectCells.slice();

  const counted = [];
  const countedKeys = new Set();

  // المجموعة الأولى: نختار الأعلى.
  const first = pickHighestFromGroup(subjectCells, rule.groups[0], countedKeys);
  first.forEach((cell) => {
    counted.push(cell);
    countedKeys.add(cell.key);
  });

  // المجموعة الثانية: إذا كانت تحتوي مادة فائزة من المجموعة الأولى،
  // لا نحتسبها مرتين؛ نختار الأعلى من المواد المتبقية.
  const second = pickHighestFromGroup(subjectCells, rule.groups[1], countedKeys);
  second.forEach((cell) => {
    counted.push(cell);
    countedKeys.add(cell.key);
  });

  // كل المواد الأخرى محتسبة، مع استثناء المواد التي تنتمي للمجموعتين
  // ولم يتم اختيارها كبديل.
  subjectCells.forEach((cell) => {
    if (countedKeys.has(cell.key)) return;
    const inFirst = subjectMatches(cell.subject, rule.groups[0]);
    const inSecond = subjectMatches(cell.subject, rule.groups[1]);
    if (inFirst || inSecond) return;
    counted.push(cell);
    countedKeys.add(cell.key);
  });

  // ضمان احتساب 7 مواد بالضبط عند وجود أكثر/أقل بسبب اختلاف أسماء المواد.
  // إذا كانت القاعدة أنتجت أقل من 7، نكمل بأعلى العلامات من غير المحتسبة.
  if (counted.length < 7) {
    subjectCells
      .filter((cell) => !countedKeys.has(cell.key))
      .sort((a, b) => Number(b.mark || 0) - Number(a.mark || 0))
      .slice(0, 7 - counted.length)
      .forEach((cell) => {
        counted.push(cell);
        countedKeys.add(cell.key);
      });
  }

  // إذا كان عدد المواد أكثر من 7، نحتفظ بالمواد ذات العلامة الأعلى من غير القواعد.
  if (counted.length > 7) {
    return counted
      .sort((a, b) => Number(b.mark || 0) - Number(a.mark || 0))
      .slice(0, 7);
  }

  return counted;
};

const getAcademicResult = (subjectCells, countedCells, total = null, maximum = null) => {
  const pending = subjectCells.some((cell) => cell.pendingCheating);
  if (pending) return 'قيد مراجعة الغش';

  const counted = countedCells?.length ? countedCells : subjectCells;
  const calculatedTotal = total == null
    ? counted.reduce((sum, cell) => sum + toNumber(cell.mark), 0)
    : toNumber(total);
  const calculatedMaximum = maximum == null
    ? counted.reduce((sum, cell) => sum + toNumber(cell.max), 0)
    : toNumber(maximum);
  const average = calculatedMaximum > 0
    ? (calculatedTotal / calculatedMaximum) * 100
    : 0;

  const failedSubjects = counted.filter(
    (cell) => toNumber(cell.mark) < toNumber(cell.subject.min)
  ).length;

  // النتيجة تعتمد أولاً على المجموع والمعدل:
  // أقل من 50% = راسب، و50% فأعلى مع عدم وجود مواد راسبة = ناجح.
  // إذا كان المعدل 50% فأعلى مع وجود 1-4 مواد دون الحد الأدنى = مكمل.
  // أكثر من 4 مواد دون الحد الأدنى = راسب.
  if (average < 50) return 'راسب';
  if (failedSubjects === 0) return 'ناجح';
  if (failedSubjects >= 1 && failedSubjects <= 4) return 'مكمل';
  return 'راسب';
};


const formatNumber = (value) => {
  const n = toNumber(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

// دالة لتنسيق المعدل بصيغة 00.0 دائماً
const formatPercentage = (value) => {
  const n = toNumber(value);
  return n.toFixed(1);
};


const formatAnnouncementCountdown = (totalSeconds) => {
  const total = Math.max(0, Number(totalSeconds) || 0);
  return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
};
const pad2 = (value) => String(value).padStart(2, '0');

export default function StudentResultsManager({ supabase, branchId = null, onBack = () => {} }) {
  const [resultsAnnouncementAllowed, setResultsAnnouncementAllowed] = useState(false);
  const [resultsAnnouncementChecked, setResultsAnnouncementChecked] = useState(false);
  const [resultsAnnouncementAt, setResultsAnnouncementAt] = useState(null);
  const [announcementCountdown, setAnnouncementCountdown] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const result = await checkResultsAnnouncement(supabase);
      if (!cancelled) {
        setResultsAnnouncementAllowed(Boolean(result.allowed));
        setResultsAnnouncementAt(result.announcementAt || null);
        setResultsAnnouncementChecked(true);
      }
    };

    check();
    const interval = setInterval(check, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [supabase]);


  useEffect(() => {
    if (!resultsAnnouncementAt || resultsAnnouncementAllowed) { setAnnouncementCountdown(0); return; }
    const countdownTick = () => {
      const seconds = Math.max(0, Math.ceil((resultsAnnouncementAt - Date.now()) / 1000));
      setAnnouncementCountdown(seconds);
      if (seconds <= 0) setResultsAnnouncementAllowed(true);
    };
    countdownTick();
    const countdownInterval = setInterval(countdownTick, 1000);
    return () => clearInterval(countdownInterval);
  }, [resultsAnnouncementAt, resultsAnnouncementAllowed]);

  const [students, setStudents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [cheatingCases, setCheatingCases] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(branchId != null ? String(branchId) : 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (branchId != null && branchId !== '') setSelectedBranch(String(branchId));
  }, [branchId]);

  const loadResults = async () => {
    if (!supabase?.from) {
      setError('لم يتم تمرير اتصال Supabase إلى شاشة إدارة النتائج.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [studentsRes, branchesRes, subjectsRes, examsRes, submissionsRes, cheatingRes] = await Promise.all([
        supabase.from('students').select('*'),
        supabase.from('branches').select('*'),
        supabase.from('subjects').select('*'),
        supabase.from('exams').select('*'),
        supabase.from('submissions').select('*'),
        supabase.from('cheating_cases').select('id, student_id, exam_id, case_status, action_taken, deduction_marks, processed_at')
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (branchesRes.error) throw branchesRes.error;
      if (subjectsRes.error) throw subjectsRes.error;
      if (examsRes.error) throw examsRes.error;
      if (submissionsRes.error) throw submissionsRes.error;
      if (cheatingRes.error) console.warn('تعذر تحميل حالات الغش:', cheatingRes.error);

      setStudents(studentsRes.data || []);
      const loadedBranches = (branchesRes.data || []).map((b) => ({ ...b, display_name: getBranchName(b) }));
      setBranches(loadedBranches);

      if (branchId == null || branchId === '') {
        const scientificBranch = loadedBranches.find((b) => {
          const name = normalize(b.display_name || b.name || b.branch_name);
          return name === 'علمي' || name === 'العلمي' || name.includes('علمي');
        });
        if (scientificBranch?.id != null) {
          setSelectedBranch(String(scientificBranch.id));
        }
      }

      setSubjects(subjectsRes.data || []);
      setExams(examsRes.data || []);
      setSubmissions(submissionsRes.data || []);
      setCheatingCases(cheatingRes.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('StudentResultsManager load error:', err);
      setError(err?.message || 'تعذر تحميل نتائج الطلاب.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const pendingCheatingKeys = useMemo(() => {
    const keys = new Set();
    (cheatingCases || []).forEach((item) => {
      if (String(item?.case_status || '').toLowerCase() !== 'pending') return;
      if (item?.student_id == null || item?.exam_id == null) return;
      keys.add(`${String(item.student_id)}:${String(item.exam_id)}`);
    });
    return keys;
  }, [cheatingCases]);

  // فهرسة التسليمات بطريقتين: رقم الجلوس + رقم الطالب.
  // هذا يمنع ظهور 0 عندما يكون السجل في submissions موجوداً لكن رقم الجلوس
  // غير محفوظ/مختلف في السجل، بينما student_id مطابق للطالب.
  const submissionMap = useMemo(() => {
    const bySeat = new Map();
    const byStudent = new Map();

    [...submissions]
      .sort((a, b) => getSubmissionDate(a) - getSubmissionDate(b))
      .forEach((submission) => {
        const examId = firstValue(submission?.exam_id, submission?.examId);
        if (examId == null) return;

        const examKey = String(examId);
        const seat = getSubmissionSeat(submission);
        const studentId = firstValue(submission?.student_id, submission?.studentId);

        if (seat) {
          bySeat.set(`${normalize(seat)}:${examKey}`, submission);
        }

        if (studentId != null && String(studentId).trim() !== '') {
          byStudent.set(`${String(studentId)}:${examKey}`, submission);
        }
      });

    return { bySeat, byStudent };
  }, [submissions]);

  const getBranchDataset = (targetBranchId) => {
    const q = normalize(searchQuery).toLowerCase();

    const branchStudents = students
      .filter((student) => {
        if (targetBranchId === 'all') return true;
        return String(getBranchId(student) ?? '') === String(targetBranchId);
      })
      .filter((student) => !q || normalize(getSeat(student)).toLowerCase().includes(q))
      .sort((a, b) => normalize(getSeat(a)).localeCompare(normalize(getSeat(b)), 'ar', { numeric: true }));

    const map = new Map();
    subjects.forEach((subject) => {
      const sid = getSubjectId(subject);
      if (sid == null) return;

      const subjectBranchId = getBranchId(subject);
      if (targetBranchId !== 'all' && String(subjectBranchId ?? '') !== String(targetBranchId)) return;

      const key = String(sid);
      if (!map.has(key)) {
        map.set(key, {
          key,
          id: sid,
          name: getSubjectName(subject),
          min: toNumber(firstValue(
            subject?.minimum_mark,
            subject?.min_mark,
            subject?.min_marks,
            subject?.minimum_marks,
            0
          )),
          max: toNumber(firstValue(
            subject?.maximum_mark,
            subject?.max_mark,
            subject?.max_marks,
            subject?.maximum_marks,
            subject?.total_marks,
            subject?.total_mark,
            0
          )),
          examIds: []
        });
      }
    });

    exams.forEach((exam) => {
      const examBranch = getBranchId(exam);
      if (targetBranchId !== 'all' && examBranch != null && String(examBranch) !== String(targetBranchId)) return;

      const directSid = getExamSubjectId(exam);
      if (directSid != null && map.has(String(directSid))) {
        map.get(String(directSid)).examIds.push(String(exam.id));
      }
    });

    const branchSubjects = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    const examsBySubject = new Map();
    const subjectNameToIds = new Map();

    branchSubjects.forEach((subject) => {
      const key = String(subject.id);
      examsBySubject.set(key, []);
      const nameKey = normalize(subject.name).toLowerCase();
      if (nameKey) {
        if (!subjectNameToIds.has(nameKey)) subjectNameToIds.set(nameKey, []);
        subjectNameToIds.get(nameKey).push(key);
      }
    });

    exams.forEach((exam) => {
      const examBranch = getBranchId(exam);
      if (targetBranchId !== 'all' && examBranch != null && String(examBranch) !== String(targetBranchId)) return;

      const directSid = getExamSubjectId(exam);
      if (directSid != null && examsBySubject.has(String(directSid))) {
        examsBySubject.get(String(directSid)).push(exam);
        return;
      }

      const examSubjectName = normalize(firstValue(
        exam?.subject_name,
        exam?.subjectName,
        exam?.subject,
        exam?.name,
        exam?.title,
        ''
      )).toLowerCase();
      const matchedIds = subjectNameToIds.get(examSubjectName) || [];
      matchedIds.forEach((id) => examsBySubject.get(id).push(exam));
    });

    examsBySubject.forEach((list) => {
      list.sort((a, b) => {
        const da = getSubmissionDate(a);
        const db = getSubmissionDate(b);
        return da - db || Number(a.id || 0) - Number(b.id || 0);
      });
    });

    const currentBranchObj = branches.find(b => String(b.id) === String(targetBranchId));
    const currentBranchName = currentBranchObj?.display_name || currentBranchObj?.branch_name || currentBranchObj?.name || '';

    const rows = branchStudents.map((student) => {
      const seat = getSeat(student);
      const subjectCells = [];

      branchSubjects.forEach((subject) => {
        const subjectExams = examsBySubject.get(String(subject.id)) || [];
        let submission = null;
        let submissionTime = -1;

        subjectExams.forEach((exam) => {
          // الأولوية لرقم الجلوس، ثم fallback على student_id.
          let candidate = submissionMap.bySeat.get(
            `${normalize(seat)}:${String(exam.id)}`
          );

          if (!candidate && student?.id != null) {
            candidate = submissionMap.byStudent.get(
              `${String(student.id)}:${String(exam.id)}`
            );
          }

          if (!candidate) return;
          const time = getSubmissionDate(candidate);
          if (!submission || time > submissionTime || (time === submissionTime && Number(exam.id || 0) > Number(submission?.exam_id || 0))) {
            submission = candidate;
            submissionTime = time;
          }
        });

        const max = toNumber(subject.max);
        const pendingCheating = Boolean(
          submission && pendingCheatingKeys.has(`${String(submission?.student_id ?? student?.id)}:${String(submission?.exam_id)}`)
        );
        const released = Boolean(submission) && !pendingCheating;
        const mark = released ? getSubmissionScore(submission) : 0;
        subjectCells.push({
          key: subject.key,
          subject,
          mark,
          max,
          submitted: Boolean(submission),
          released,
          pendingCheating
        });
      });

      const selectedCells = calculateCountedCells(currentBranchName, subjectCells);

      const total = selectedCells.reduce((sum, cell) => sum + toNumber(cell.mark), 0);
      // المجموع العظمى والصغرى للفرع تُحسب من المواد المعتمدة فعليًا.
      const maximumTotal = selectedCells.reduce((sum, cell) => sum + toNumber(cell.max), 0);
      const minimumTotal = selectedCells.reduce((sum, cell) => sum + toNumber(cell.subject.min), 0);
      const average = maximumTotal > 0 ? total / maximumTotal : 0;
      const percentage = average * 100;
      const academicResult = getAcademicResult(subjectCells, selectedCells, total, maximumTotal);
      const failedSubjects = subjectCells.filter(cell => toNumber(cell.mark) < toNumber(cell.subject.min)).length;

      const marks = {};
      branchSubjects.forEach(subject => {
        const selected = selectedCells.find(cell => cell.key === subject.key);
        const original = subjectCells.find(cell => cell.key === subject.key);
        marks[subject.key] = selected ? { ...selected, counted: true } : { ...(original || { mark: 0, max: toNumber(subject.max), submitted: false, released: false, pendingCheating: false }), counted: false };
      });

      return {
        student,
        seat,
        marks,
        total,
        maximumTotal,
        percentage,
        average,
        passed: academicResult === 'ناجح',
        academicResult,
        failedSubjects,
        countedSubjectCount: selectedCells.length,
        minimumTotal
      };
    });

    const baseTotals = branchSubjects.map(subject => ({ subject, mark: 0, max: toNumber(subject.max) }));
    const countedTotals = calculateCountedCells(currentBranchName, baseTotals);
    const totals = {
      minimum: countedTotals.reduce((sum, cell) => sum + toNumber(cell.subject.min), 0),
      maximum: countedTotals.reduce((sum, cell) => sum + toNumber(cell.max), 0),
      countedSubjects: countedTotals.length
    };

    return {
      branchId: targetBranchId,
      branchName: currentBranchObj?.display_name || `فرع ${targetBranchId}`,
      branchSubjects,
      rows,
      totals
    };
  };

  const activeDatasets = useMemo(() => {
    if (selectedBranch === 'all') {
      return branches.map((b) => getBranchDataset(String(b.id))).filter(ds => ds.branchSubjects.length > 0 && ds.rows.length > 0);
    } else {
      const ds = getBranchDataset(selectedBranch);
      return [ds];
    }
  }, [selectedBranch, branches, students, subjects, exams, submissionMap, pendingCheatingKeys, searchQuery]);

  const selectedBranchName = useMemo(() => {
    if (selectedBranch === 'all') return 'جميع الفروع';
    const branch = branches.find((b) => String(b.id) === String(selectedBranch));
    return branch?.display_name || `فرع ${selectedBranch}`;
  }, [branches, selectedBranch]);

  const totalStudentsCount = useMemo(() => {
    return activeDatasets.reduce((acc, ds) => acc + ds.rows.length, 0);
  }, [activeDatasets]);


  if (!resultsAnnouncementChecked) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700 }}>جاري التحقق من موعد إعلان النتائج...</div>
      </div>
    );
  }

  if (!resultsAnnouncementAllowed) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>لم يتم إعلان النتائج بعد</div>
          {resultsAnnouncementAt ? (() => {
            const countdown = formatAnnouncementCountdown(announcementCountdown);
            return (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 16, fontWeight: 700, opacity: 0.85 }}>الوقت المتبقي حتى إعلان النتائج</div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 10, direction: 'ltr', flexWrap: 'wrap' }}>
                  {[[countdown.days, 'يوم'], [countdown.hours, 'ساعة'], [countdown.minutes, 'دقيقة'], [countdown.seconds, 'ثانية']].map(([value, label]) => (
                    <div key={label} style={{ minWidth: 72, padding: '12px 10px', borderRadius: 14, border: '1px solid rgba(56,189,248,.55)', background: 'rgba(15,23,42,.82)', boxShadow: '0 8px 25px rgba(0,0,0,.18)' }}>
                      <div style={{ fontSize: 25, fontWeight: 900, lineHeight: 1 }}>{label === 'يوم' ? value : pad2(value)}</div>
                      <div style={{ marginTop: 7, fontSize: 12, fontWeight: 700 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })() : <div style={{ marginTop: 14, fontSize: 15, opacity: 0.8 }}>لم يتم تحديد موعد إعلان النتائج حالياً.</div>}
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📊 إدارة نتائج الطلاب</h1>
          <div style={styles.subtitle}>كشف علامات {selectedBranchName} — العلامة الدنيا والقصوى حسب المادة</div>
        </div>
        <button onClick={loadResults} disabled={loading} style={styles.refreshButton}>
          {loading ? 'جاري التحديث...' : '↻ تحديث النتائج'}
        </button>
      </div>

      <div style={styles.controls}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث برقم الجلوس..."
          style={styles.searchInput}
        />

        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          style={styles.branchSelect}
          disabled={branchId !== null && branchId !== undefined}
        >
          <option value="all">جميع الفروع</option>
          {branches.map((branch) => (
            <option key={branch.id} value={String(branch.id)}>{branch.display_name}</option>
          ))}
        </select>

        <div style={styles.counter}>إجمالي الطلاب: <strong>{totalStudentsCount}</strong></div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <div style={styles.state}>جاري تحميل النتائج…</div>
      ) : activeDatasets.length === 0 ? (
        <div style={styles.state}>لا توجد نتائج أو مباحث مطابقة للبحث أو الفرع المحدد.</div>
      ) : (
        activeDatasets.map((dataset) => (
          <div key={dataset.branchId} style={styles.branchSection}>
            {selectedBranch === 'all' && (
              <h2 style={styles.branchSectionTitle}>📁 {dataset.branchName}</h2>
            )}

            <div style={styles.tableOuter}>
              <table style={styles.table}>
                <colgroup>
                  <col style={{ width: '45px' }} />
                  <col style={{ width: '115px' }} />
                  {dataset.branchSubjects.map((subject) => <col key={subject.key} />)}
                  <col style={{ width: '105px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '90px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, ...styles.seatHeader }}>#</th>
                    <th style={{ ...styles.th, ...styles.seatHeader }}>رقم الجلوس</th>
                    {dataset.branchSubjects.map((subject) => (
                      <th key={subject.key} style={styles.th}>
                        <div style={styles.subjectName}>{subject.name}</div>
                        <div style={styles.subjectLimits}>
                          <span>صغرى: {formatNumber(subject.min)}</span>
                          <span>عظمى : {formatNumber(subject.max)}</span>
                        </div>
                      </th>
                    ))}
                    <th style={styles.th}>
                      <div style={styles.subjectName}>المجموع</div>
                      <div style={styles.subjectLimits}>
                        <span>صغرى: {formatNumber(dataset.totals.minimum)}</span>
                        <span>عظمى : {formatNumber(dataset.totals.maximum)}</span>
                      </div>
                    </th>
                    <th style={{ ...styles.th, ...styles.subjectName }}>
                      <div style={styles.subjectName}>المعدل %</div>
                      <div style={styles.formula}>المجموع ÷ 700 × 100</div>
                    </th>
                    <th style={styles.th}>النتيجة</th>
                  </tr>
                </thead>

                <tbody>
                  {dataset.rows.length === 0 ? (
                    <tr><td colSpan={dataset.branchSubjects.length + 5} style={styles.emptyCell}>لا يوجد طلاب لهذا الفرع.</td></tr>
                  ) : dataset.rows.map((row, index) => (
                    <tr key={`${row.seat}-${index}`}>
                      <td style={{ ...styles.td, ...styles.seatCell, ...styles.serialCell }}>
                        <div style={styles.serialNumber}>{index + 1}</div>
                      </td>
                      <td style={{ ...styles.td, ...styles.seatCell }}>
                        <div style={styles.seatNumber}>{row.seat || '-'}</div>
                      </td>
                      {dataset.branchSubjects.map((subject) => {
                        const cell = row.marks[subject.key];
                        return (
                          <td key={subject.key} style={styles.td}>
                            {cell?.pendingCheating ? (
                              <span style={styles.pendingCheating}>قيد مراجعة الغش</span>
                            ) : (
                              <span style={cell?.released ? styles.mark : styles.zero}>
                                {cell?.submitted ? formatNumber(cell.mark) : '0'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ ...styles.td, ...styles.totalCell }}>{formatNumber(row.total)}</td>
                      <td style={{ ...styles.td, ...styles.percentCell }}>{formatPercentage(row.percentage)}%</td>
                      <td style={{ ...styles.td, color: row.academicResult === 'ناجح' ? '#34d399' : row.academicResult === 'مكمل' ? '#fbbf24' : row.academicResult === 'قيد مراجعة الغش' ? '#38bdf8' : '#fb7185', fontWeight: 900 }}>
                        {row.academicResult}
                        <div style={{ fontSize: '10px', marginTop: '3px', opacity: 0.85 }}>أقل من الصغرى: {row.failedSubjects}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      <div style={styles.note}>
        🔵 العلامة المعتمدة تظهر باللون الأزرق. <strong style={styles.zero}>0</strong> تعني عدم تقديم المادة. 🟡 الطالب الذي عليه حالة غش معلّقة يظهر <strong style={styles.pendingCheating}>قيد مراجعة الغش</strong> ولا تدخل علامته في المجموع أو المعدل حتى يعتمد المراقب القرار. العلامة الدنيا والقصوى مأخوذتان مباشرة حسب المادة. 🟡 المكمل: من 1 إلى 4 مواد أقل من العلامة الصغرى ويحق له التقدم للدور الثانية أو الثالثة. 🔴 الراسب: أكثر من 5 مواد أقل من العلامة الصغرى ولا يحق له التقدم للدورة الثانية أو الثالثة. 🟢 الناجح: جميع مواد الفرع عند العلامة الصغرى أو أعلى. المجموع من 7 مواد = 700، والمعدل = المجموع ÷ 700 × 100.
        {lastUpdated && <span style={styles.updated}>آخر تحديث: {lastUpdated.toLocaleTimeString('ar-PS')}</span>}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#e2e8f0',
    padding: '18px',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '14px' },
  title: { margin: 0, color: '#f8fafc', fontSize: '25px', fontWeight: 800, fontFamily: 'Noto Kufi Arabic, sans-serif' },
  subtitle: { marginTop: '5px', color: '#94a3b8', fontSize: '14px' },
  refreshButton: { border: '1px solid rgba(96,165,250,.35)', background: '#1d4ed8', color: '#fff', padding: '10px 15px', borderRadius: '9px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  controls: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', background: 'rgba(30,41,59,.75)', border: '1px solid rgba(148,163,184,.16)', padding: '11px', borderRadius: '12px', marginBottom: '12px' },
  searchInput: { flex: '1 1 240px', minWidth: '200px', height: '40px', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid rgba(148,163,184,.25)', background: '#0b1220', color: '#fff', padding: '0 12px', outline: 'none', fontSize: '14px' },
  branchSelect: { height: '40px', minWidth: '170px', borderRadius: '8px', border: '1px solid rgba(148,163,184,.25)', background: '#0b1220', color: '#fff', padding: '0 10px', fontSize: '14px' },
  counter: { color: '#cbd5e1', fontSize: '13px', padding: '0 4px' },
  branchSection: { marginBottom: '25px' },
  branchSectionTitle: { color: '#38bdf8', fontSize: '18px', fontWeight: 800, marginBottom: '10px', paddingRight: '4px', fontFamily: 'Noto Kufi Arabic, sans-serif' },
  tableOuter: { width: '100%', overflowX: 'auto', background: 'rgba(15,23,42,.9)', border: '1px solid rgba(148,163,184,.18)', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,.22)' },
  table: { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'center', direction: 'rtl' },
  th: { background: '#172554', color: '#e0f2fe', border: '1px solid rgba(148,163,184,.2)', padding: '7px 4px', verticalAlign: 'middle', textAlign: 'center', overflow: 'hidden' },
  seatHeader: { background: '#1e3a5f', fontSize: '14px', textAlign: 'center' },
  subjectName: { fontSize: 'clamp(9px, 1vw, 12px)', fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere', textAlign: 'center' },
  subjectLimits: { display: 'flex', flexDirection: 'column', gap: '2px', color: '#bfdbfe', fontSize: 'clamp(8px, .85vw, 11px)', fontWeight: 600, marginTop: '4px', alignItems: 'center' },
  formula: { color: '#bfdbfe', fontSize: 'clamp(7px, .75vw, 10px)', lineHeight: 1.2, textAlign: 'center' },
  td: { padding: '7px 3px', border: '1px solid rgba(148,163,184,.12)', color: '#e2e8f0', fontSize: 'clamp(10px, 1vw, 14px)', fontWeight: 700, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' },
  serialCell: { background: 'rgba(30,58,95,.55)', width: '45px', padding: '7px 2px', textAlign: 'center' },
  seatCell: { background: 'rgba(30,58,95,.55)', color: '#f8fafc', fontSize: 'clamp(11px, 1vw, 14px)', fontWeight: 800, textAlign: 'center' },
  serialNumber: { color: '#facc15', fontSize: 'clamp(11px, .95vw, 13px)', fontWeight: 900, lineHeight: 1.15, textAlign: 'center' },
  seatNumber: { marginTop: '3px', color: '#f8fafc', fontSize: 'clamp(11px, 1vw, 14px)', fontWeight: 900, direction: 'ltr', textAlign: 'center' },
  mark: { color: '#60a5fa', fontWeight: 900 },
  zero: { color: '#94a3b8', fontWeight: 800 },
  pendingCheating: { color: '#fbbf24', fontWeight: 900, fontSize: 'clamp(8px, .8vw, 11px)' },
  totalCell: { background: 'rgba(37,99,235,.18)', color: '#fff', fontWeight: 900, textAlign: 'center' },
  percentCell: { background: 'rgba(34,197,94,.12)', color: '#86efac', fontWeight: 900, textAlign: 'center' },
  emptyCell: { padding: '28px', color: '#94a3b8', textAlign: 'center' },
  state: { padding: '45px 20px', textAlign: 'center', color: '#94a3b8', background: 'rgba(30,41,59,.6)', borderRadius: '12px' },
  error: { background: 'rgba(127,29,29,.35)', color: '#fecaca', border: '1px solid rgba(248,113,113,.35)', padding: '11px 14px', borderRadius: '9px', marginBottom: '12px' },
  note: { marginTop: '10px', color: '#94a3b8', fontSize: '12px' },
  updated: { marginRight: '15px', color: '#64748b' }
};