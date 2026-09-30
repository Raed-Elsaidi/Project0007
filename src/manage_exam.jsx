import React, { useState, useEffect } from 'react';

export default function ManageExam({ supabase, showAlertMessage, supervisor }) {
  const [exams, setExams] = useState([]);
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  const [filterBranchId, setFilterBranchId] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');

  const [examTitle, setExamTitle] = useState('');
  const [examDate, setExamDate] = useState('');
  const [examTime, setExamTime] = useState('');
  const [examDuration, setExamDuration] = useState(30);
  const [totalMarks, setTotalMarks] = useState(100);

  const [centerMessage, setCenterMessage] = useState(null);
  const [resolvedSupervisor, setResolvedSupervisor] = useState(supervisor || null);

  const isEnglishExam = () => {
    const textToCheck = (examTitle || selectedExam?.title || '').toLowerCase();
    return /[a-z]/.test(textToCheck) && !/[أ-ي]/.test(textToCheck);
  };

  const getAvailableSections = () => {
    const isEng = isEnglishExam();
    return [
      { name: isEng ? 'Primary Section' : 'القسم الأساسي', defaultScore: 50 },
      { name: isEng ? 'Optional Section' : 'القسم الاختياري', defaultScore: 30 },
      { name: isEng ? 'Additional Section' : 'القسم الإضافي', defaultScore: 20 }
    ];
  };

  const [examStructure, setExamStructure] = useState([
    { 
      name: 'القسم الأساسي', 
      sectionScore: 50, 
      types: [
        { typeKey: 'true_false', questions: [] }
      ] 
    }
  ]);

  const [allQuestionsBank, setAllQuestionsBank] = useState([]);
  const [isQuestionBankOpen, setIsQuestionBankOpen] = useState(false);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('');

  const [targetSectionName, setTargetSectionName] = useState('');
  const [targetQuestionIndex, setTargetQuestionIndex] = useState(null);
  const [targetTypeKey, setTargetTypeKey] = useState('');

  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [selectedSectionTemplate, setSelectedSectionTemplate] = useState('');

  const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
  const [activeSectionForType, setActiveSectionForType] = useState('');
  const [activeQuestionIndexForType, setActiveQuestionIndexForType] = useState(null);

  const QUESTION_TYPE_PRIORITY = {
    'true_false': 1,
    'multiple_choice': 2,
    'mcq': 2,
    'completion': 3,
    'essay': 4
  };

  const sortTypesByPriority = (typesArray) => {
    return [...typesArray].sort((a, b) => {
      const pA = QUESTION_TYPE_PRIORITY[a.typeKey] || 99;
      const pB = QUESTION_TYPE_PRIORITY[b.typeKey] || 99;
      return pA - pB;
    });
  };

  useEffect(() => {
    let cancelled = false;

    const resolveEmployee = async () => {
      let current = supervisor || null;
      let found = null;

      const currentUserId = window.localStorage.getItem('currentUserId');
      const currentUsername = window.localStorage.getItem('currentUsername');

      if (currentUserId) {
        const { data } = await supabase
          .from('employees')
          .select('*')
          .eq('id', currentUserId)
          .maybeSingle();
        if (data) found = data;
      }

      if (!found && currentUsername) {
        const { data } = await supabase
          .from('employees')
          .select('*')
          .eq('username', currentUsername)
          .maybeSingle();
        if (data) found = data;
      }

      if (!found && current?.id != null && current.id !== '') {
        const { data } = await supabase
          .from('employees')
          .select('*')
          .eq('id', current.id)
          .maybeSingle();
        if (data) found = data;
      }

      if (!found && current?.username) {
        const { data } = await supabase
          .from('employees')
          .select('*')
          .eq('username', current.username)
          .maybeSingle();
        if (data) found = data;
      }

      if (!found && current?.email) {
        const { data } = await supabase
          .from('employees')
          .select('*')
          .eq('email', current.email)
          .maybeSingle();
        if (data) found = data;
      }

      if (!found && current?.id != null && current.id !== '') {
        const { data } = await supabase.from('supervisors').select('*').eq('id', current.id).maybeSingle();
        if (data) found = data;
      }

      if (!found && current?.username) {
        const { data } = await supabase.from('supervisors').select('*').eq('username', current.username).maybeSingle();
        if (data) found = data;
      }

      if (found) current = { ...(current || {}), ...found };
      if (cancelled) return;

      setResolvedSupervisor(current);

      const branchId = current?.branch_id != null && current.branch_id !== ''
        ? String(current.branch_id)
        : '';

      let subjectId = current?.subject_id != null && current.subject_id !== ''
        ? String(current.subject_id)
        : '';

      if (!subjectId && branchId) {
        const specialization = String(
          current?.specialization ?? current?.subject_name ?? current?.subject ?? ''
        ).trim();

        if (specialization) {
          const { data } = await supabase
            .from('subjects')
            .select('id')
            .eq('branch_id', branchId)
            .ilike('subject_name', specialization)
            .maybeSingle();
          if (data?.id != null) subjectId = String(data.id);
        }
      }

      setFilterBranchId(branchId);
      setFilterSubjectId(subjectId);

      if (branchId && subjectId) {
        const employeeForFetch = {
          ...(current || {}),
          branch_id: branchId,
          subject_id: subjectId
        };
        fetchAllData(employeeForFetch);
      } else {
        setExams([]);
        setLoading(false);
      }
    };

    resolveEmployee();

    return () => { cancelled = true; };
  }, [supervisor, supabase]);

  const parseExamStart = (exam) => {
    if (!exam?.exam_date || !exam?.exam_time) return null;

    const datePart = String(exam.exam_date).split('T')[0].trim();
    let timePart = String(exam.exam_time).trim();

    const hasPM = /(?:^|\s)(?:م|مساء|PM|pm)(?:\s|$)/.test(timePart);
    const hasAM = /(?:^|\s)(?:ص|صباح|AM|am)(?:\s|$)/.test(timePart);

    timePart = timePart
      .replace(/\s*(?:ص|صباح|م|مساء|AM|PM|am|pm)\s*$/i, '')
      .trim();

    const parts = timePart.split(':').map(Number);
    if (parts.length < 2 || parts.some((v, i) => i < 2 && !Number.isFinite(v))) {
      return null;
    }

    let hour = parts[0];
    const minute = parts[1];
    const second = Number.isFinite(parts[2]) ? parts[2] : 0;

    if (hasAM || hasPM) {
      if (hour < 1 || hour > 12) return null;
      if (hour === 12) hour = hasPM ? 12 : 0;
      else if (hasPM) hour += 12;
    } else if (hour < 0 || hour > 23) {
      return null;
    }

    const d = new Date(
      `${datePart}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
    );

    return Number.isNaN(d.getTime()) ? null : d;
  };

  const getExamEnd = (exam) => {
    const start = parseExamStart(exam);
    if (!start) return null;
    const duration = Number(exam.duration_minutes ?? exam.duration ?? 30);
    return new Date(start.getTime() + Math.max(0, duration) * 60000);
  };

  const getExamTimeStatus = (exam, now = new Date()) => {
    const start = parseExamStart(exam);
    const end = getExamEnd(exam);

    if (!start || !end) return 'unknown';
    if (now < start) return 'upcoming';
    if (now < end) return 'active';
    return 'finished';
  };

  const formatExamTime = (exam) => {
    const start = parseExamStart(exam);
    if (!start) return '';
    return start.toLocaleTimeString('ar', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // =========================================================
  // مزامنة is_active حسب وقت الامتحان
  // - قبل البداية بـ5 دقائق وحتى النهاية: true
  // - بعد النهاية: false
  // - الامتحانات الأبعد من 5 دقائق تبقى كما هي
  // - لا نغيّر access_enabled هنا لأنه تحكم إداري
  // =========================================================
  const syncExamActiveStatus = async (examList) => {
    const now = new Date();
    const updated = [];

    for (const exam of examList || []) {
      const start = parseExamStart(exam);
      const end = getExamEnd(exam);

      if (!start || !end) {
        updated.push(exam);
        continue;
      }

      const verificationStart = new Date(start.getTime() - 5 * 60 * 1000);
      const shouldBeActive = now >= verificationStart && now < end;
      const shouldBeInactive = now >= end;

      let nextExam = exam;

      if (
        (shouldBeActive && exam.is_active !== true) ||
        (shouldBeInactive && exam.is_active !== false)
      ) {
        const nextIsActive = shouldBeActive;

        const { error } = await supabase
          .from('exams')
          .update({ is_active: nextIsActive })
          .eq('id', exam.id);

        if (error) {
          console.error('Could not synchronize exam is_active:', error);
        } else {
          nextExam = { ...exam, is_active: nextIsActive };
        }
      }

      updated.push(nextExam);
    }

    return updated;
  };

  const fetchAllData = async (supervisorOverride = null) => {
    setLoading(true);
    try {
      const activeSupervisor = supervisorOverride || resolvedSupervisor;

      const supervisorBranchId =
        activeSupervisor?.branch_id != null && activeSupervisor.branch_id !== ''
          ? String(activeSupervisor.branch_id) : '';

      const supervisorSubjectId =
        activeSupervisor?.subject_id != null && activeSupervisor.subject_id !== ''
          ? String(activeSupervisor.subject_id) : '';

      if (!supervisorBranchId || !supervisorSubjectId) {
        setExams([]);
        setLoading(false);
        return;
      }

      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('*')
        .eq('branch_id', supervisorBranchId)
        .eq('subject_id', supervisorSubjectId);

      if (examsError) throw examsError;

      let branchesData = [];
      const resBranches = await supabase.from('branches').select('*');
      if (!resBranches.error && resBranches.data) {
        branchesData = resBranches.data;
      } else {
        const resAltBranches = await supabase.from('branch').select('*');
        if (!resAltBranches.error && resAltBranches.data) {
          branchesData = resAltBranches.data;
        }
      }

      let subjectsData = [];
      const resSubjects = await supabase.from('subjects').select('*');
      if (!resSubjects.error && resSubjects.data) {
        subjectsData = resSubjects.data;
      } else {
        const resAltSubjects = await supabase.from('subject').select('*');
        if (!resAltSubjects.error && resAltSubjects.data) {
          subjectsData = resAltSubjects.data;
        }
      }

      setBranches(branchesData || []);
      setSubjects(subjectsData || []);

      setFilterBranchId(supervisorBranchId);
      setFilterSubjectId(supervisorSubjectId);

      const branchesMap = {};
      if (branchesData) {
        branchesData.forEach(b => { 
          branchesMap[b.id] = b.name || b.branch_name || b.title; 
        });
      }

      const subjectsMap = {};
      if (subjectsData) {
        subjectsData.forEach(s => { 
          subjectsMap[s.id] = s.subject_name || s.name || s.title; 
        });
      }

      const enrichedExams = (examsData || []).map(ex => ({
        ...ex,
        branchName: branchesMap[ex.branch_id] || ex.branch || '-',
        subjectName: subjectsMap[ex.subject_id] || subjectsMap[ex.subject_name_id] || subjectsMap[ex.subject] || '-'
      }));

      const synchronizedExams = await syncExamActiveStatus(enrichedExams);
      setExams(synchronizedExams);

      const { data: questionsData } = await supabase.from('questions').select('*');
      setAllQuestionsBank(questionsData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccess = async (examId, currentAccessStatus, examTitle) => {
    const newStatus = !currentAccessStatus;
    const isEng = isEnglishExam();
    
    try {
      const { error } = await supabase
        .from('exams')
        .update({ access_enabled: newStatus })
        .eq('id', examId);

      if (error) throw error;

      setExams(prev => prev.map(ex => 
        ex.id === examId ? { ...ex, access_enabled: newStatus } : ex
      ));

      setCenterMessage({ 
        text: isEng 
          ? `Exam "${examTitle}" has been ${newStatus ? 'activated' : 'disabled'} successfully ✔️` 
          : `تم ${newStatus ? 'تفعيل' : 'تعطيل'} الامتحان "${examTitle}" بنجاح ✔️`, 
        type: 'success' 
      });
      setTimeout(() => setCenterMessage(null), 2000);
    } catch (err) {
      console.error('Error toggling exam access:', err);
      setCenterMessage({ 
        text: (isEng ? 'Failed to update status: ' : 'فشل تحديث حالة الامتحان: ') + err.message, 
        type: 'error' 
      });
      setTimeout(() => setCenterMessage(null), 2500);
    }
  };

  const filteredSubjects = subjects.filter(sub => {
    if (!filterBranchId) return true;
    const subBranchId = sub.branch_id || sub.branchId || sub.branch;
    return !subBranchId || String(subBranchId) === String(filterBranchId);
  });

  const handleOpenPreview = async (exam) => {
    setSelectedExam(exam);
    const titleVal = exam.title || exam.exam_title || exam.name || '';
    setExamTitle(titleVal);
    setIsPreviewOpen(true);
    
    const rawDate = exam.exam_date || '';
    if (rawDate) {
      setExamDate(String(rawDate).split('T')[0]);
    } else {
      setExamDate('');
    }

    const rawTime = exam.exam_time || '';
    if (rawTime) {
      setExamTime(String(rawTime).slice(0, 5));
    } else {
      setExamTime('');
    }

    setExamDuration(exam.duration_minutes || exam.duration || 30);
    setTotalMarks(exam.total_mark || exam.total_marks || exam.total_score || 100);
    setSelectedBranchFilter(String(exam.branch_id || ''));

    try {
      const { data: examQuestions, error } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', exam.id);

      // بعض الامتحانات تحفظ معرفات الأسئلة داخل selected_questions /
      // exam_structure فقط، لذلك نجلبها من بنك الأسئلة أيضاً حتى لا تضيع الصورة.
      let resolvedExamQuestions = examQuestions || [];

      let selectedQuestionIds = exam.selected_questions;
      if (typeof selectedQuestionIds === 'string') {
        try { selectedQuestionIds = JSON.parse(selectedQuestionIds); } catch { selectedQuestionIds = []; }
      }
      if (!Array.isArray(selectedQuestionIds)) selectedQuestionIds = [];

      const ids = selectedQuestionIds
        .map(id => Number(id))
        .filter(id => Number.isFinite(id) && id > 0);

      if (ids.length > 0) {
        const { data: bankQuestionsForExam } = await supabase
          .from('questions')
          .select('*')
          .in('id', ids);

        if (bankQuestionsForExam?.length) {
          const byId = new Map(bankQuestionsForExam.map(q => [Number(q.id), q]));
          resolvedExamQuestions = resolvedExamQuestions.map(q => ({
            ...q,
            ...byId.get(Number(q.id)),
            custom_mark: q.custom_mark ?? byId.get(Number(q.id))?.custom_mark
          }));

          const existingIds = new Set(resolvedExamQuestions.map(q => Number(q.id)));
          bankQuestionsForExam.forEach(q => {
            if (!existingIds.has(Number(q.id))) resolvedExamQuestions.push(q);
          });
        }
      }

      if (!error && resolvedExamQuestions.length > 0) {
        const typesMap = {};
        resolvedExamQuestions.forEach(q => {
          const tKey = q.question_type || q.type || 'true_false';
          if (!typesMap[tKey]) {
            typesMap[tKey] = [];
          }
          typesMap[tKey].push(q);
        });

        const formattedTypes = Object.keys(typesMap).map(tKey => ({
          typeKey: tKey,
          questions: typesMap[tKey]
        }));

        const isEng = /[a-z]/.test(titleVal.toLowerCase()) && !/[أ-ي]/.test(titleVal);
        setExamStructure([
          {
            name: isEng ? 'Primary Section' : 'القسم الأساسي',
            types: sortTypesByPriority(formattedTypes)
          }
        ]);
        return;
      }
    } catch (err) {
      console.error('Error fetching exam questions:', err);
    }

    if (exam.exam_structure) {
      let struct = exam.exam_structure;
      if (typeof struct === 'string') {
        try { struct = JSON.parse(struct); } catch { struct = null; }
      }
      if (Array.isArray(struct) && struct.length > 0) {
        // استكمال بيانات الصور من بنك الأسئلة إذا كان الامتحان القديم
        // يحتوي على الأسئلة بدون image_url داخل exam_structure.
        let bankById = new Map();
        const structIds = [];

        const collectStructQuestions = (sections) => {
          (sections || []).forEach(sec => {
            (sec?.types || []).forEach(typeGroup => {
              (typeGroup?.questions || []).forEach(q => structIds.push(Number(q.id)));
            });
            (sec?.subQuestions || []).forEach(sub => {
              (sub?.types || []).forEach(typeGroup => {
                (typeGroup?.questions || []).forEach(q => structIds.push(Number(q.id)));
              });
            });
          });
        };

        collectStructQuestions(struct);
        const validStructIds = [...new Set(structIds.filter(id => Number.isFinite(id) && id > 0))];

        if (validStructIds.length > 0) {
          const { data: bankQuestionsForStructure } = await supabase
            .from('questions')
            .select('*')
            .in('id', validStructIds);

          bankById = new Map((bankQuestionsForStructure || []).map(q => [Number(q.id), q]));
        }

        const mergeQuestion = (q) => {
          const bankQ = bankById.get(Number(q?.id));
          if (!bankQ) return q;
          return {
            ...bankQ,
            ...q,
            image_url:
              q?.image_url ||
              q?.imageUrl ||
              q?.question_image_url ||
              q?.questionImageUrl ||
              bankQ?.image_url ||
              bankQ?.imageUrl ||
              bankQ?.question_image_url ||
              bankQ?.questionImageUrl ||
              null
          };
        };

        const sortedStruct = struct.map(sec => ({
          ...sec,
          types: sec.types ? sortTypesByPriority(sec.types.map(t => ({
            ...t,
            questions: (t.questions || []).map(mergeQuestion)
          }))) : sec.types,
          subQuestions: sec.subQuestions ? sec.subQuestions.map(sub => ({
            ...sub,
            types: sub.types ? sortTypesByPriority(sub.types.map(t => ({
              ...t,
              questions: (t.questions || []).map(mergeQuestion)
            }))) : sub.types
          })) : sec.subQuestions
        }));
        setExamStructure(sortedStruct);
        return;
      }
    }

    const isEng = /[a-z]/.test(titleVal.toLowerCase()) && !/[أ-ي]/.test(titleVal);
    setExamStructure([
      { 
        name: isEng ? 'Primary Section' : 'القسم الأساسي', 
        types: [
          { typeKey: 'true_false', questions: [] }
        ] 
      }
    ]);
  };

  const handleDeleteExam = async (examId, examTitle) => {
    const isEng = isEnglishExam();
    setCenterMessage({
      text: isEng ? `Are you sure you want to delete the exam "${examTitle || 'Untitled'}" permanently?` : `هل أنت متأكد من حذف الامتحان "${examTitle || 'بدون عنوان'}" نهائياً؟`,
      type: 'confirm',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('exams').delete().eq('id', examId);
          if (error) throw error;
          
          setExams(prev => prev.filter(ex => ex.id !== examId));
          setCenterMessage({ text: isEng ? 'Exam deleted successfully ✔️' : 'تم حذف الامتحان بنجاح ✔️', type: 'success' });
          setTimeout(() => setCenterMessage(null), 2000);
        } catch (err) {
          console.error('Error deleting exam:', err);
          setCenterMessage({ text: (isEng ? 'Failed to delete exam: ' : 'فشل حذف الامتحان: ') + err.message, type: 'error' });
          setTimeout(() => setCenterMessage(null), 2500);
        }
      }
    });
  };

  const calculateTotalExamScore = () => {
    let rawSum = 0;

    (examStructure || []).forEach(sec => {
      const isOptional = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');
      if (isOptional && sec.subQuestions) {
        const subScores = sec.subQuestions.map(subQ => {
          return subQ.types ? subQ.types.reduce((tSum, t) => {
            return tSum + t.questions.reduce((qSum, q) => qSum + Number(q.custom_mark !== undefined ? q.custom_mark : 1), 0);
          }, 0) : 0;
        });
        if (subScores.length > 0) {
          rawSum += Math.max(...subScores);
        }
      } else {
        const secSum = sec.types ? sec.types.reduce((tSum, t) => {
          return tSum + t.questions.reduce((qSum, q) => qSum + Number(q.custom_mark !== undefined ? q.custom_mark : 1), 0);
        }, 0) : 0;
        rawSum += secSum;
      }
    });

    return rawSum;
  };

  const handleSaveExamSettings = async () => {
    if (!selectedExam?.id) {
      const isEng = isEnglishExam();
      setCenterMessage({ text: isEng ? 'No exam selected to save.' : 'لم يتم تحديد امتحان للحفظ.', type: 'error' });
      setTimeout(() => setCenterMessage(null), 2500);
      return;
    }

    try {
      let allQuestionIds = [];

      (examStructure || []).forEach(sec => {
        (sec?.types || []).forEach(typeGroup => {
          (typeGroup?.questions || []).forEach(q => {
            if (q?.id !== undefined && q?.id !== null) allQuestionIds.push(q.id);
          });
        });

        (sec?.subQuestions || []).forEach(subQ => {
          (subQ?.types || []).forEach(typeGroup => {
            (typeGroup?.questions || []).forEach(q => {
              if (q?.id !== undefined && q?.id !== null) allQuestionIds.push(q.id);
            });
          });
        });
      });

      allQuestionIds = [...new Set(allQuestionIds)];

      const finalCalculatedScore = calculateTotalExamScore();
      const isEng = isEnglishExam();

      const protectedBranchId = selectedExam.branch_id ?? resolvedSupervisor?.branch_id ?? null;
      const protectedSubjectId = selectedExam.subject_id ?? resolvedSupervisor?.subject_id ?? null;

      const normalizedExamTime = examTime
        ? (examTime.length === 5 ? `${examTime}:00` : examTime)
        : null;

      if (examDate && normalizedExamTime && protectedBranchId != null) {
        const { data: duplicateExams, error: duplicateError } = await supabase
          .from('exams')
          .select('id, title')
          .eq('branch_id', protectedBranchId)
          .eq('exam_date', examDate)
          .eq('exam_time', normalizedExamTime)
          .neq('id', selectedExam.id)
          .limit(1);

        if (duplicateError) {
          console.error('Error checking duplicate exam while editing:', duplicateError);
          setCenterMessage({
            text: isEng
              ? 'Could not verify whether another exam uses this date and time.'
              : 'تعذر التحقق من وجود امتحان آخر في نفس التاريخ والتوقيت. حاول مرة أخرى.',
            type: 'error'
          });
          return;
        }

        if (duplicateExams && duplicateExams.length > 0) {
          const existingTitle = duplicateExams[0]?.title || (isEng ? 'Another exam' : 'امتحان آخر');
          setCenterMessage({
            text: isEng
              ? `This branch already has an exam at the same date and start time: "${existingTitle}".`
              : `ممنوع وجود أكثر من امتحان للفرع في نفس التاريخ ونفس التوقيت. يوجد بالفعل: "${existingTitle}"`,
            type: 'error'
          });
          return;
        }
      }

      const updatePayload = {
        title: examTitle || (isEng ? 'Untitled Exam' : 'امتحان بدون عنوان'),
        exam_date: examDate || null,
        exam_time: normalizedExamTime,
        duration_minutes: Number(examDuration) || 30,
        total_mark: finalCalculatedScore,
        total_marks: finalCalculatedScore,
        selected_questions: allQuestionIds,
        exam_structure: examStructure || [],
        is_active: selectedExam?.is_active ?? true,
        access_enabled: selectedExam?.access_enabled ?? false
      };

      let { error } = await supabase
        .from('exams')
        .update(updatePayload)
        .eq('id', selectedExam.id);

      if (error) {
        const message = String(error?.message || '').toLowerCase();

        if (message.includes('total_marks') && message.includes('column')) {
          const fallbackPayload = { ...updatePayload };
          delete fallbackPayload.total_marks;
          const retry = await supabase
            .from('exams')
            .update(fallbackPayload)
            .eq('id', selectedExam.id);
          error = retry.error;
        } else if (message.includes('total_mark') && message.includes('column')) {
          const fallbackPayload = { ...updatePayload };
          delete fallbackPayload.total_mark;
          const retry = await supabase
            .from('exams')
            .update(fallbackPayload)
            .eq('id', selectedExam.id);
          error = retry.error;
        }
      }

      if (error) throw error;

      setSelectedExam(prev => ({
        ...prev,
        ...updatePayload,
        ...(protectedBranchId != null ? { branch_id: protectedBranchId } : {}),
        ...(protectedSubjectId != null ? { subject_id: protectedSubjectId } : {})
      }));

      setExams(prev => prev.map(exam =>
        exam.id === selectedExam.id
          ? {
              ...exam,
              ...updatePayload,
              ...(protectedBranchId != null ? { branch_id: protectedBranchId } : {}),
              ...(protectedSubjectId != null ? { subject_id: protectedSubjectId } : {})
            }
          : exam
      ));

      setCenterMessage({
        text: isEng ? 'Exam details saved successfully ✔️' : 'تم حفظ تفاصيل الامتحان بنجاح ✔️',
        type: 'success'
      });
      setTimeout(() => setCenterMessage(null), 2500);
    } catch (err) {
      console.error('Failed to save exam:', err);

      const isEng = isEnglishExam();
      const errorMessage =
        err?.message ||
        err?.details ||
        err?.hint ||
        (typeof err === 'string' ? err : '');

      setCenterMessage({
        text: (isEng ? 'Save failed: ' : 'فشل الحفظ: ') +
          (errorMessage || 'تعذر الاتصال بقاعدة البيانات.'),
        type: 'error'
      });
      setTimeout(() => setCenterMessage(null), 5000);
    }
  };

  const getQuestionTypeHeaderTitle = (typeVal) => {
    const isEng = isEnglishExam();
    if (typeVal === 'true_false') {
      return isEng ? 'Put a check mark or a cross mark in front of each of the following statements :-' : 'ضع إشارة صح أو إشارة خطأ امام كل عبارة من العبارات التالية :-';
    }
    if (typeVal === 'multiple_choice' || typeVal === 'mcq') {
      return isEng ? 'Choose the correct answer in each of the following statements :-' : 'اختر الاجابة الصحيحة في كل عبارة من العبارات التالية :-';
    }
    if (typeVal === 'completion' || typeVal === 'complete' || typeVal === 'fill_in_blank') {
      return isEng ? 'Fill in the blanks for each of the following statements :-' : 'أكمل الفراغ في كل عبارة من العبارات التالية :-';
    }
    if (typeVal === 'essay') {
      return isEng ? 'Answer the following essay questions :-' : 'أجب عن الأسئلة المقالية التالية :-';
    }
    return isEng ? 'Answer the following statements :-' : 'أجب عن العبارات التالية :-';
  };

  const getArabicNumberWord = (num) => {
    const isEng = isEnglishExam();
    if (isEng) {
      const engWords = { 1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth', 5: 'Fifth', 6: 'Sixth', 7: 'Seventh', 8: 'Eighth', 9: 'Ninth', 10: 'Tenth' };
      return engWords[num] || num;
    }
    const words = { 1: 'الأول', 2: 'الثاني', 3: 'الثالث', 4: 'الرابع', 5: 'الخامس', 6: 'السادس', 7: 'السابع', 8: 'الثامن', 9: 'التاسع', 10: 'العاشر' };
    return words[num] || num;
  };

  const getSectionNumberedName = (index) => {
    const isEng = isEnglishExam();
    if (isEng) {
      const sectionNumbers = { 0: 'First Section', 1: 'Second Section', 2: 'Third Section' };
      return sectionNumbers[index] || `Section ${index + 1}`;
    }
    const sectionNumbers = { 0: 'القسم الأول', 1: 'القسم الثاني', 2: 'القسم الثالث' };
    return sectionNumbers[index] || `القسم ${index + 1}`;
  };

  const format12HourTime = (timeStr) => {
    if (!timeStr) return '-';
    try {
      const parts = timeStr.split(':');
      if (parts.length < 2) return timeStr;
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1].slice(0, 2);
      const isEng = isEnglishExam();
      const ampm = hours >= 12 ? (isEng ? 'PM' : 'م') : (isEng ? 'AM' : 'ص');
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  const calculateSectionTotalScore = (sec) => {
    const isOptional = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');
    if (isOptional && sec.subQuestions) {
      const subScores = sec.subQuestions.map(subQ => {
        return subQ.types ? subQ.types.reduce((tSum, t) => {
          return tSum + t.questions.reduce((qSum, q) => qSum + Number(q.custom_mark !== undefined ? q.custom_mark : 1), 0);
        }, 0) : 0;
      });
      if (subScores.length > 0) {
        return Math.max(...subScores);
      }
      return 0;
    } else if (sec.types) {
      return sec.types.reduce((tSum, t) => {
        return tSum + t.questions.reduce((qSum, q) => qSum + Number(q.custom_mark !== undefined ? q.custom_mark : 1), 0);
      }, 0);
    }
    return 0;
  };

  const handleUpdateQuestionMark = (sectionName, typeKey, questionId, newMark, subQIndex = null) => {
    let val = parseFloat(newMark);
    if (isNaN(val) || val < 0.5) val = 0.5;

    setExamStructure(prev => prev.map(sec => {
      if (sec.name === sectionName) {
        const isOptional = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');
        if (isOptional && subQIndex !== null) {
          return {
            ...sec,
            subQuestions: sec.subQuestions.map((subQ, sIdx) => {
              if (sIdx === subQIndex) {
                return {
                  ...subQ,
                  types: subQ.types.map(t => {
                    if (t.typeKey === typeKey) {
                      return {
                        ...t,
                        questions: t.questions.map(q => {
                          if (Number(q.id) === Number(questionId)) {
                            return { ...q, custom_mark: val };
                          }
                          return q;
                        })
                      };
                    }
                    return t;
                  })
                };
              }
              return subQ;
            })
          };
        } else {
          return {
            ...sec,
            types: sec.types.map(t => {
              if (t.typeKey === typeKey) {
                return {
                  ...t,
                  questions: t.questions.map(q => {
                    if (Number(q.id) === Number(questionId)) {
                      return { ...q, custom_mark: val };
                    }
                    return q;
                  })
                };
              }
              return t;
            })
          };
        }
      }
      return sec;
    }));
  };

  const confirmDeleteSection = (sectionName) => {
    const isEng = isEnglishExam();
    setCenterMessage({
      text: isEng ? `Are you sure you want to delete ${sectionName} completely?` : `هل أنت متأكد من حذف ${sectionName} بالكامل؟`,
      type: 'confirm',
      onConfirm: () => {
        setExamStructure(prev => prev.filter(sec => sec.name !== sectionName));
        setCenterMessage(null);
      }
    });
  };

  const confirmDeleteQuestionType = (sectionName, typeKey, subQIndex = null) => {
    const isEng = isEnglishExam();
    setCenterMessage({
      text: isEng ? 'Are you sure you want to delete this question type with all its branches?' : 'هل أنت متأكد من حذف هذا النوع بكافة فروعه؟',
      type: 'confirm',
      onConfirm: () => {
        setExamStructure(prev => prev.map(sec => {
          if (sec.name === sectionName) {
            const isOptional = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');
            if (isOptional && subQIndex !== null) {
              return {
                ...sec,
                subQuestions: sec.subQuestions.map((subQ, sIdx) => {
                  if (sIdx === subQIndex) {
                    return { ...subQ, types: subQ.types.filter(t => t.typeKey !== typeKey) };
                  }
                  return subQ;
                })
              };
            } else {
              return { ...sec, types: sec.types.filter(t => t.typeKey !== typeKey) };
            }
          }
          return sec;
        }));
        setCenterMessage(null);
      }
    });
  };

  const handleAddNewSection = () => {
    if (!selectedSectionTemplate) {
      alert(isEnglishExam() ? 'Please select a section to add' : 'يرجى اختيار القسم المراد إضافته');
      return;
    }

    const template = getAvailableSections().find(s => s.name === selectedSectionTemplate);
    if (!template) return;

    const sectionExists = examStructure.some(sec => sec.name === template.name);
    if (sectionExists) {
      alert(isEnglishExam() ? 'This section already exists in the exam' : 'هذا القسم موجود مسبقاً في الامتحان');
      return;
    }

    const isEng = isEnglishExam();
    let newSection = {
      name: template.name
    };

    const isOptionalTpl = template.name.includes('اختياري') || template.name.toLowerCase().includes('optional');
    if (isOptionalTpl) {
      newSection.subQuestions = [
        { title: isEng ? 'First Question' : 'السؤال الأول', types: [] },
        { title: isEng ? 'Second Question' : 'السؤال الثاني', types: [] }
      ];
    } else {
      newSection.types = [{ typeKey: 'true_false', questions: [] }];
    }

    setExamStructure(prev => {
      const updated = [...prev, newSection];
      return updated;
    });

    setSelectedSectionTemplate('');
    setIsAddSectionModalOpen(false);
  };

  const handleAddTypeToTarget = (typeKey) => {
    setExamStructure(prev => prev.map(sec => {
      if (sec.name === activeSectionForType) {
        const isOptional = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');
        if (isOptional) {
          const updatedSub = sec.subQuestions.map((subQ, idx) => {
            if (idx === activeQuestionIndexForType) {
              const typeExists = subQ.types.some(t => t.typeKey === typeKey);
              if (!typeExists) {
                const newTypes = sortTypesByPriority([...subQ.types, { typeKey, questions: [] }]);
                return { ...subQ, types: newTypes };
              }
            }
            return subQ;
          });
          return { ...sec, subQuestions: updatedSub };
        } else {
          const typeExists = sec.types.some(t => t.typeKey === typeKey);
          if (!typeExists) {
            const newTypes = sortTypesByPriority([...sec.types, { typeKey, questions: [] }]);
            return { ...sec, types: newTypes };
          }
        }
      }
      return sec;
    }));
    setIsAddTypeModalOpen(false);
  };

  const handleSelectQuestionFromBank = (bankQuestion) => {
    setExamStructure(prev => prev.map(sec => {
      if (sec.name === targetSectionName) {
        const isOptional = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');
        if (isOptional) {
          return {
            ...sec,
            subQuestions: sec.subQuestions.map((subQ, sIdx) => {
              if (sIdx === targetQuestionIndex) {
                return {
                  ...subQ,
                  types: subQ.types.map(t => {
                    if (t.typeKey === targetTypeKey) {
                      let updatedQuestions = [...t.questions];
                      const exists = updatedQuestions.some(q => Number(q.id) === Number(bankQuestion.id));
                      if (!exists) updatedQuestions.push({ ...bankQuestion, custom_mark: 1 });
                      return { ...t, questions: updatedQuestions };
                    }
                    return t;
                  })
                };
              }
              return subQ;
            })
          };
        } else {
          return {
            ...sec,
            types: sec.types.map(t => {
              if (t.typeKey === targetTypeKey) {
                let updatedQuestions = [...t.questions];
                const exists = updatedQuestions.some(q => Number(q.id) === Number(bankQuestion.id));
                if (!exists) updatedQuestions.push({ ...bankQuestion, custom_mark: 1 });
                return { ...t, questions: updatedQuestions };
              }
              return t;
            })
          };
        }
      }
      return sec;
    }));

    setIsQuestionBankOpen(false);
  };

  const handleDeleteQuestion = (sectionName, typeKey, questionId, subQIndex = null) => {
    setExamStructure(prev => prev.map(sec => {
      if (sec.name === sectionName) {
        const isOptional = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');
        if (isOptional && subQIndex !== null) {
          return {
            ...sec,
            subQuestions: sec.subQuestions.map((subQ, sIdx) => {
              if (sIdx === subQIndex) {
                return {
                  ...subQ,
                  types: subQ.types.map(t => {
                    if (t.typeKey === typeKey) {
                      return { ...t, questions: t.questions.filter(q => Number(q.id) !== Number(questionId)) };
                    }
                    return t;
                  })
                };
              }
              return subQ;
            })
          };
        } else {
          return {
            ...sec,
            types: sec.types.map(t => {
              if (t.typeKey === typeKey) {
                return { ...t, questions: t.questions.filter(q => Number(q.id) !== Number(questionId)) };
              }
              return t;
            })
          };
        }
      }
      return sec;
    }));
  };

  const COMPLETION_BLANK_WIDTH = '180px';

  const renderCompletionQuestionText = (text) => {
    const value = String(text ?? '');
    const blankPattern = /(?:[.\-_–—…ـ](?:\s*[.\-_–—…ـ]){1,})/g;
    const parts = value.split(blankPattern);

    const rendered = [];
    parts.forEach((part, index) => {
      if (part) {
        rendered.push(
          <React.Fragment key={`completion-text-${index}`}>{part}</React.Fragment>
        );
      }

      if (index < parts.length - 1) {
        rendered.push(
          <span
            key={`completion-blank-${index}`}
            aria-label="فراغ للإجابة"
            style={{
              display: 'inline-block',
              width: COMPLETION_BLANK_WIDTH,
              borderBottom: '2px solid #e2e8f0',
              height: '1.05em',
              verticalAlign: 'baseline',
              margin: '0 5px'
            }}
          />
        );
      }
    });

    return rendered;
  };

  const renderQuestionItem = (q, idx, sectionType) => {
    const optionLetters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
    const isEng = isEnglishExam();
    const optionLettersEng = ['A', 'B', 'C', 'D', 'E', 'F'];
    const activeLetters = isEng ? optionLettersEng : optionLetters;
    
    const hasOptions = (q.options && Array.isArray(q.options) && q.options.length > 0) || 
                       (q.choices && Array.isArray(q.choices) && q.choices.length > 0) ||
                       q.question_type === 'multiple_choice' || 
                       q.type === 'multiple_choice' ||
                       q.type === 'mcq';

    const optionsList = q.options && Array.isArray(q.options) && q.options.length > 0 
      ? q.options 
      : (q.choices && Array.isArray(q.choices) && q.choices.length > 0 ? q.choices : (hasOptions ? ['الخيار الأول', 'الخيار الثاني', 'الخيار الثالث', 'الخيار الرابع'] : null));

    const isTrueFalse = sectionType === 'true_false' || q.question_type === 'true_false' || q.type === 'true_false';
    const isFillBlank = sectionType === 'fill_in_blank' || q.question_type === 'fill_in_blank' || q.type === 'fill_in_blank' || q.question_type === 'complete' || q.question_type === 'completion';
    const isEssay = sectionType === 'essay' || q.question_type === 'essay' || q.type === 'essay';

    const correctAnswerText = q.answer || q.correct_answer || q.model_answer || '';
    const rawText = q.question_text || q.text || q.body || '';
    const questionImageUrl =
      q?.image_url ||
      q?.imageUrl ||
      q?.question_image_url ||
      q?.questionImageUrl ||
      '';

    return (
      <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '4px', fontSize: '14px', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid #334155', marginBottom: '8px', direction: isEng ? 'ltr' : 'rtl', textAlign: isEng ? 'left' : 'right' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ [isEng ? 'marginRight' : 'marginLeft']: '6px', fontWeight: 'bold', color: '#60a5fa' }}>{idx + 1}.</span>
            
            {isFillBlank ? (
              <span>
                {renderCompletionQuestionText(rawText)}
              </span>
            ) : (
              <span>
                {rawText}
              </span>
            )}
          </div>
          
          {isTrueFalse && (
            <div style={{ display: 'flex', gap: '12px', flexShrink: 0, marginTop: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#1e293b', border: '1px solid #334155', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: '#34d399', fontWeight: 'bold' }}>
                <div style={{ width: '14px', height: '14px', border: '2px solid #34d399', borderRadius: '3px' }}></div>
                <span>{isEng ? 'True' : 'صح'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#1e293b', border: '1px solid #334155', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: '#f87171', fontWeight: 'bold' }}>
                <div style={{ width: '14px', height: '14px', border: '2px solid #f87171', borderRadius: '3px' }}></div>
                <span>{isEng ? 'False' : 'خطأ'}</span>
              </div>
            </div>
          )}
        </div>

        {questionImageUrl && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            margin: '2px 0 8px'
          }}>
            <img
              src={questionImageUrl}
              alt={isEng ? 'Question image' : 'صورة السؤال'}
              style={{
                display: 'block',
                maxWidth: '100%',
                width: 'auto',
                maxHeight: '360px',
                objectFit: 'contain',
                borderRadius: '8px',
                border: '1px solid #475569',
                backgroundColor: '#fff'
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

        {isEssay && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', [isEng ? 'paddingLeft' : 'paddingRight']: '20px', marginTop: '2px' }}>
            <div style={{ borderBottom: '2px dashed #64748b', width: '100%', height: '10px' }}></div>
            <div style={{ borderBottom: '2px dashed #64748b', width: '100%', height: '10px' }}></div>
            
            {correctAnswerText && (
              <div style={{ marginTop: '4px', fontSize: '13px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 'bold' }}>{isEng ? 'Model Answer:' : 'الإجابة النموذجية:'}</span>
                <span>{correctAnswerText}</span>
              </div>
            )}
          </div>
        )}
        
        {optionsList && !isTrueFalse && !isFillBlank && !isEssay && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', [isEng ? 'paddingLeft' : 'paddingRight']: '15px', marginTop: '4px' }}>
            {optionsList.map((opt, optIdx) => (
              <div key={optIdx} style={{ color: '#93c5fd', fontSize: '13px' }}>
                <span style={{ fontWeight: 'bold', color: '#38bdf8', [isEng ? 'marginRight' : 'marginLeft']: '6px' }}>({activeLetters[optIdx] || optIdx + 1})</span>
                {typeof opt === 'string' ? opt : opt.text || opt.option_text}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: '4px', padding: '8px 10px', borderRadius: '6px', backgroundColor: '#111827', border: '1px solid #334155', display: 'flex', flexWrap: 'wrap', gap: '8px 18px', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>الإجابة: <strong style={{ color: '#34d399' }}>{correctAnswerText || 'غير محددة'}</strong></span>
          <span style={{ color: '#94a3b8' }}>المستوى: <strong style={{ color: '#fbbf24' }}>{q.difficulty_level || q.difficulty || q.level || q.question_level || 'غير محدد'}</strong></span>
          <span style={{ color: '#94a3b8' }}>الوحدة: <strong style={{ color: '#a78bfa' }}>{q.unit_name || q.unit || q.unit_title || (q.unit_number !== undefined && q.unit_number !== null ? `الوحدة ${q.unit_number}` : 'غير محددة')}</strong></span>
        </div>
      </div>
    );
  };

  const currentExamQuestionIds = new Set();
  examStructure.forEach(sec => {
    if (sec.types) {
      sec.types.forEach(t => t.questions.forEach(q => currentExamQuestionIds.add(Number(q.id))));
    }
    if (sec.subQuestions) {
      sec.subQuestions.forEach(subQ => {
        if (subQ.types) {
          subQ.types.forEach(t => t.questions.forEach(q => currentExamQuestionIds.add(Number(q.id))));
        }
      });
    }
  });

  const filteredBankQuestions = allQuestionsBank.filter(q => {
    if (currentExamQuestionIds.has(Number(q.id))) return false;
    const qType = q.question_type || q.type || '';
    const qBranch = String(q.branch_id || q.branch || '');
    const matchesBranch = selectedBranchFilter ? qBranch === String(selectedBranchFilter) : true;
    const matchesType = selectedTypeFilter ? (selectedTypeFilter === 'multiple_choice' ? (qType === 'multiple_choice' || qType === 'mcq') : qType === selectedTypeFilter) : true;
    return matchesBranch && matchesType;
  });

  const remainingSectionsToAdd = getAvailableSections().filter(
    avail => !examStructure.some(sec => sec.name === avail.name)
  );

  const formatDateTimeDisplay = (examObj) => {
    const dateVal = examObj.exam_date;
    const timeVal = examObj.exam_time;
    let dateStr = dateVal ? String(dateVal).split('T')[0] : (isEnglishExam() ? 'Not specified' : 'غير محدد');
    let timeStr = timeVal ? format12HourTime(String(timeVal).slice(0, 5)) : '';
    return { dateStr, timeStr };
  };

  const isExamActiveNow = (exam) => {
    if (!exam.exam_date || !exam.exam_time) return false;
    try {
      const now = new Date();
      const examDateStr = String(exam.exam_date).split('T')[0];
      const examTimeStr = String(exam.exam_time);
      const startDateTime = new Date(`${examDateStr}T${examTimeStr}`);
      const durationMinutes = Number(exam.duration_minutes || exam.duration || 30);
      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

      return now >= startDateTime && now <= endDateTime;
    } catch {
      return false;
    }
  };

  const filteredExams = exams.filter(exam => {
    const matchesBranch = filterBranchId ? String(exam.branch_id) === String(filterBranchId) : false;
    const matchesSubject = filterSubjectId
      ? String(exam.subject_id || exam.subject_name_id) === String(filterSubjectId)
      : false;

    const matchesSupervisor =
      resolvedSupervisor?.branch_id != null &&
      resolvedSupervisor?.subject_id != null
        ? String(exam.branch_id) === String(resolvedSupervisor.branch_id) &&
          String(exam.subject_id) === String(resolvedSupervisor.subject_id)
        : false;

    return matchesBranch && matchesSubject && matchesSupervisor;
  });

  const now = new Date();

  const activeExams = filteredExams
    .filter(exam => getExamTimeStatus(exam, now) === 'active')
    .sort((a, b) => parseExamStart(b)?.getTime() - parseExamStart(a)?.getTime());

  const upcomingExams = filteredExams
    .filter(exam => getExamTimeStatus(exam, now) === 'upcoming')
    .sort((a, b) => parseExamStart(a)?.getTime() - parseExamStart(b)?.getTime());

  const finishedExams = filteredExams
    .filter(exam => getExamTimeStatus(exam, now) === 'finished')
    .sort((a, b) => parseExamStart(b)?.getTime() - parseExamStart(a)?.getTime());

  const renderExamsTable = (examsList) => {
    const isEng = isEnglishExam();
    if (examsList.length === 0) {
      return <p style={{ textAlign: 'center', color: '#94a3b8', padding: '15px', fontSize: '13px' }}>{isEng ? 'No exams in this list.' : 'لا توجد امتحانات في هذه القائمة.'}</p>;
    }

    return (
      <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#0f172a', borderRadius: '8px', overflow: 'hidden', minWidth: '850px', border: '1px solid #334155', direction: isEng ? 'ltr' : 'rtl', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#60a5fa', borderBottom: '2px solid #334155' }}>
              <th className="px-2 py-2" style={{ padding: '8px 6px', width: '45px', textAlign: isEng ? 'left' : 'right' }}>{isEng ? 'No.' : 'الرقم'}</th>
              <th className="px-2 py-2" style={{ padding: '8px 6px', textAlign: isEng ? 'left' : 'right' }}>{isEng ? 'Exam Title' : 'اسم الامتحان'}</th>
              <th className="px-2 py-2" style={{ padding: '8px 6px', textAlign: isEng ? 'left' : 'right' }}>{isEng ? 'Branch' : 'الفرع'}</th>
              <th className="px-2 py-2" style={{ padding: '8px 6px', textAlign: isEng ? 'left' : 'right' }}>{isEng ? 'Subject' : 'المادة'}</th>
              <th className="px-2 py-2" style={{ padding: '8px 6px', textAlign: 'center' }}>{isEng ? 'Exam Date' : 'تاريخ الامتحان'}</th>
              <th className="px-2 py-2" style={{ padding: '8px 6px', textAlign: 'center' }}>{isEng ? 'Start Time' : 'وقت البدء'}</th>
              <th className="px-2 py-2" style={{ padding: '8px 6px', textAlign: 'center' }}>{isEng ? 'End Time' : 'وقت الانتهاء'}</th>
              <th className="px-2 py-2" style={{ padding: '8px 6px', textAlign: 'center' }}>{isEng ? 'Duration' : 'المدة'}</th>
              <th className="px-2 py-2" style={{ padding: '8px 6px', textAlign: 'center' }}>{isEng ? 'Total Mark' : 'العلامة'}</th>
              <th style={{ padding: '8px 6px', textAlign: 'center' }}>{isEng ? 'Actions' : 'الإجراءات'}</th>
            </tr>
          </thead>
          <tbody>
            {examsList.map((exam, index) => {
              const { dateStr, timeStr } = formatDateTimeDisplay(exam);
              const startForEndTime = parseExamStart(exam);
              const durationForEndTime = Number(exam.duration_minutes ?? exam.duration ?? 30);
              const endTime = startForEndTime && Number.isFinite(durationForEndTime)
                ? new Date(startForEndTime.getTime() + Math.max(0, durationForEndTime) * 60000)
                : null;
              const endTimeStr = endTime
                ? endTime.toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit', hour12: true })
                : '-';
              const examTitle = exam.title || exam.exam_title || exam.name || (isEng ? 'Untitled Exam' : 'امتحان بدون عنوان');
              const examBranch = exam.branchName;
              const examSubject = exam.subjectName;
              const examDurationVal = exam.duration_minutes || exam.duration || 30;
              const examMarks = exam.total_mark || exam.total_marks || exam.total_score || 100;
              const isActive = isExamActiveNow(exam);
              const isAccessEnabled = exam.access_enabled ?? true;

              return (
                <tr key={exam.id || index} style={{ borderBottom: '1px solid #334155', transition: 'background 0.2s', backgroundColor: isActive ? 'rgba(16, 185, 129, 0.08)' : 'transparent' }}>
                  <td className="px-2 py-2" style={{ padding: '8px 6px', color: '#93c5fd', fontWeight: 'bold', textAlign: isEng ? 'left' : 'right' }}>{index + 1}</td>
                  <td className="px-2 py-2" style={{ padding: '8px 6px', textAlign: isEng ? 'left' : 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span 
                        onClick={() => handleOpenPreview(exam)}
                        style={{ color: '#38bdf8', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                        title={isEng ? 'Click to edit and preview' : 'انقر للتعديل والمعاينة'}
                      >
                        {examTitle}
                      </span>
                      {isActive && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.2)', padding: '2px 6px', borderRadius: '10px', border: '1px solid #10b981' }}>
                          <span className="pulsing-light-bulb" title={isEng ? 'Exam is currently active!' : 'الامتحان فعال الآن!'}></span>
                          <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 'bold' }}>{isEng ? 'Live' : 'جاري'}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2" style={{ padding: '8px 6px', color: '#cbd5e1', textAlign: isEng ? 'left' : 'right' }}>{examBranch}</td>
                  <td className="px-2 py-2" style={{ padding: '8px 6px', color: '#cbd5e1', textAlign: isEng ? 'left' : 'right' }}>{examSubject}</td>
                  <td className="px-2 py-2" style={{ padding: '8px 6px', color: '#cbd5e1', textAlign: 'center', direction: 'ltr', unicodeBidi: 'embed' }}>{dateStr}</td>
                  <td className="px-2 py-2" style={{ padding: '8px 6px', color: '#cbd5e1', textAlign: 'center', direction: 'ltr', unicodeBidi: 'embed' }}>{timeStr || '-'}</td>
                  <td className="px-2 py-2" style={{ padding: '8px 6px', color: '#a7f3d0', fontWeight: 'bold', textAlign: 'center', direction: 'ltr', unicodeBidi: 'embed' }}>{endTimeStr}</td>
                  <td className="px-2 py-2" style={{ padding: '8px 6px', color: '#cbd5e1', textAlign: 'center', direction: 'ltr', unicodeBidi: 'embed' }}>{examDurationVal}m</td>
                  <td className="px-2 py-2" style={{ padding: '8px 6px', color: '#fbbf24', fontWeight: 'bold', textAlign: 'center', direction: 'ltr', unicodeBidi: 'embed' }}>{examMarks}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', alignItems: 'center' }}>
                      <button 
                        onClick={() => handleToggleAccess(exam.id, isAccessEnabled, examTitle)} 
                        style={{ 
                          background: isAccessEnabled ? '#10b981' : '#64748b', 
                          color: '#fff', 
                          border: 'none', 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          cursor: 'pointer', 
                          fontWeight: 'bold', 
                          fontSize: '11px',
                          minWidth: '75px'
                        }}
                        title={isEng ? 'Toggle student access' : 'تفعيل أو تعطيل دخول الطلاب'}
                      >
                        {isAccessEnabled ? (isEng ? 'Enabled ✓' : 'مفعل ✓') : (isAccessEnabled === false ? (isEng ? 'Disabled ✕' : 'معطل ✕') : (isEng ? 'Enabled ✓' : 'مفعل ✓'))}
                      </button>

                      <button 
                        onClick={() => handleDeleteExam(exam.id, examTitle)} 
                        style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}
                        title={isEng ? 'Delete' : 'حذف'}
                      >
                        {isEng ? 'Delete 🗑️' : 'حذف 🗑️'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const isEngUI = isEnglishExam();

  return (
    <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '25px', color: '#fff', direction: isEngUI ? 'ltr' : 'rtl', position: 'relative' }}>
      
      <style>{`
        .edge-fix-select-manage, .edge-fix-input-manage {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 2px solid #3b82f6 !important;
          padding: 8px 12px !important;
          border-radius: 6px !important;
          font-size: 14px !important;
          font-weight: bold !important;
          width: 100% !important;
          box-sizing: border-box !important;
          outline: none !important;
        }
        .edge-fix-select-manage option {
          background-color: #ffffff !important;
          color: #0f172a !important;
          font-weight: bold !important;
        }
        .ltr-input-fix-m {
          direction: ltr !important;
          text-align: left !important;
        }
        @keyframes pulseGlow {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }
        .pulsing-light-bulb {
          display: inline-block;
          width: 8px;
          height: 8px;
          background-color: #34d399;
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(52, 211, 153, 1);
          animation: pulseGlow 1.5s infinite;
        }
      `}</style>

      {centerMessage && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(15, 23, 42, 0.8)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          zIndex: 9999, 
          padding: '20px' 
        }}>
          <div style={{ 
            backgroundColor: centerMessage.type === 'error' ? '#991b1b' : (centerMessage.type === 'confirm' ? '#1e293b' : '#065f46'), 
            color: '#d1fae5', 
            padding: '20px', 
            borderRadius: '12px', 
            textAlign: 'center', 
            fontWeight: 'bold', 
            border: '2px solid #10b981', 
            fontSize: '15px',
            maxWidth: '450px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ marginBottom: '15px', color: '#fff' }}>{centerMessage.text}</div>
            {centerMessage.type === 'confirm' && (
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button onClick={centerMessage.onConfirm} style={{ backgroundColor: '#10b981', color: '#fff', padding: '8px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>{isEngUI ? 'Yes, Confirm' : 'نعم، متأكد'}</button>
                <button onClick={() => setCenterMessage(null)} style={{ backgroundColor: '#64748b', color: '#fff', padding: '8px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>{isEngUI ? 'Cancel' : 'إلغاء'}</button>
              </div>
            )}
          </div>
        </div>
      )}

      <h3 style={{ fontSize: '20px', marginBottom: '18px', color: '#60a5fa', borderBottom: '2px solid #2563eb', paddingBottom: '8px', textAlign: 'center' }}>
         {isEngUI ? 'Manage Exams, Sections & Auto-Calculate Total Score 📝' : 'إدارة الامتحانات والأقسام وتحديث العلامة الكلية تلقائياً 📝'}
      </h3>

      <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', border: '1px solid #334155' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
           <label style={{ display: 'block', fontSize: '13px', color: '#93c5fd', marginBottom: '6px', fontWeight: 'bold', textAlign: isEngUI ? 'left' : 'right' }}>{isEngUI ? 'Branch:' : 'الفرع:'}</label>
           <input
              type="text"
              readOnly
              value={
                branches.find(b => String(b.id) === String(filterBranchId))?.branch_name ||
                branches.find(b => String(b.id) === String(filterBranchId))?.name ||
                branches.find(b => String(b.id) === String(filterBranchId))?.title ||
                ''
              }
              placeholder={isEngUI ? 'Branch not found' : 'الفرع غير محدد'}
              className="edge-fix-select-manage"
              style={{ direction: isEngUI ? 'ltr' : 'rtl', textAlign: isEngUI ? 'left' : 'right', width: '100%', boxSizing: 'border-box' }}
            />
         </div>

         <div style={{ flex: 1, minWidth: '200px' }}>
           <label style={{ display: 'block', fontSize: '13px', color: '#93c5fd', marginBottom: '6px', fontWeight: 'bold', textAlign: isEngUI ? 'left' : 'right' }}>{isEngUI ? 'Subject:' : 'المادة:'}</label>
           <input
              type="text"
              readOnly
              value={
                subjects.find(s => String(s.id) === String(filterSubjectId))?.subject_name ||
                subjects.find(s => String(s.id) === String(filterSubjectId))?.name ||
                subjects.find(s => String(s.id) === String(filterSubjectId))?.title ||
                ''
              }
              placeholder={isEngUI ? 'Subject not found' : 'المادة غير محددة'}
              className="edge-fix-select-manage"
              style={{ direction: isEngUI ? 'ltr' : 'rtl', textAlign: isEngUI ? 'left' : 'right', width: '100%', boxSizing: 'border-box' }}
            />
         </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', paddingTop: '22px' }}>
          <button
            onClick={() => { fetchAllData(); }}
            style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
          >
            {isEngUI ? 'Show Exams 🔍' : 'عرض الامتحانات 🔍'}
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>{isEngUI ? 'Loading...' : 'جاري التحميل...'}</p>
      ) : (
        <>
          <div style={{ marginBottom: '25px' }}>
            <h4 style={{ color: '#34d399', borderBottom: '1px solid #334155', paddingBottom: '6px', marginBottom: '12px', fontSize: '16px', textAlign: isEngUI ? 'left' : 'right', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulsing-light-bulb"></span>
              {isEngUI ? `Current / Live Exams (${activeExams.length})` : `الامتحانات الحالية (${activeExams.length})`}
            </h4>
            {renderExamsTable(activeExams)}
          </div>

          <div style={{ marginBottom: '25px' }}>
            <h4 style={{ color: '#60a5fa', borderBottom: '1px solid #334155', paddingBottom: '6px', marginBottom: '12px', fontSize: '16px', textAlign: isEngUI ? 'left' : 'right' }}>
              📅 {isEngUI ? `Upcoming Exams (${upcomingExams.length})` : `قائمة الامتحانات المقبلة (${upcomingExams.length})`}
            </h4>
            {renderExamsTable(upcomingExams)}
          </div>

          <div style={{ marginBottom: '25px' }}>
            <h4 style={{ color: '#fbbf24', borderBottom: '1px solid #334155', paddingBottom: '6px', marginBottom: '12px', fontSize: '16px', textAlign: isEngUI ? 'left' : 'right' }}>
              ⏳ {isEngUI ? `Finished Exams (${finishedExams.length})` : `قائمة الامتحانات المنتهية (${finishedExams.length})`}
            </h4>
            {renderExamsTable(finishedExams)}
          </div>
        </>
      )}

      {isPreviewOpen && selectedExam && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', direction: isEngUI ? 'ltr' : 'rtl' }}>
          <div style={{ backgroundColor: '#1e293b', width: '100%', maxWidth: '1100px', maxHeight: '92vh', overflowY: 'auto', padding: '25px', borderRadius: '10px', border: '1px solid #334155', position: 'relative' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #2563eb', paddingBottom: '10px', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, color: '#60a5fa', fontSize: '18px' }}>{isEngUI ? `Edit & Preview Exam: ${examTitle}` : `تعديل ومعاينة امتحان: ${examTitle}`}</h3>
              <button onClick={() => setIsPreviewOpen(false)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>✕ {isEngUI ? 'Close' : 'إغلاق'}</button>
            </div>

            <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '10px', alignItems: 'center', border: '1px solid #334155' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#93c5fd', marginBottom: '4px', fontWeight: 'bold', textAlign: isEngUI ? 'left' : 'right' }}>📝 {isEngUI ? 'Exam Title:' : 'اسم الامتحان:'}</label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder={isEngUI ? 'Exam Title' : 'اسم الامتحان'}
                  className="edge-fix-input-manage"
                  style={{ direction: isEngUI ? 'ltr' : 'rtl', textAlign: isEngUI ? 'left' : 'right' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#93c5fd', marginBottom: '4px', fontWeight: 'bold', textAlign: isEngUI ? 'left' : 'right' }}>📅 {isEngUI ? 'Exam Date:' : 'تاريخ الامتحان:'}</label>
                <input 
                  type="date" 
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="edge-fix-input-manage ltr-input-fix-m"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#93c5fd', marginBottom: '4px', fontWeight: 'bold', textAlign: isEngUI ? 'left' : 'right' }}>⏰ {isEngUI ? 'Exam Time:' : 'وقت الامتحان:'}</label>
                <input 
                  type="time" 
                  value={examTime}
                  onChange={(e) => setExamTime(e.target.value)}
                  className="edge-fix-input-manage ltr-input-fix-m"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#93c5fd', marginBottom: '4px', fontWeight: 'bold', textAlign: 'center' }}>⏱️ {isEngUI ? 'Duration (mins):' : 'المدة (دقائق):'}</label>
                <input 
                  type="number" 
                  value={examDuration}
                  onChange={(e) => setExamDuration(e.target.value)}
                  className="edge-fix-input-manage ltr-input-fix-m"
                  style={{ fontSize: '16px', textAlign: 'center', fontWeight: 'bold' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#93c5fd', marginBottom: '4px', fontWeight: 'bold', textAlign: 'center' }}>🏆 {isEngUI ? 'Total Mark:' : 'العلامة الكلية:'}</label>
                <input 
                  type="number" 
                  value={calculateTotalExamScore()}
                  readOnly
                  className="edge-fix-input-manage ltr-input-fix-m"
                  style={{ backgroundColor: '#1e293b !important', color: '#fbbf24 !important', cursor: 'not-allowed', fontSize: '16px', textAlign: 'center', fontWeight: 'bold' }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '8px' }}>
                <button
                  onClick={handleSaveExamSettings}
                  style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                >
                  💾 {isEngUI ? 'Save Changes' : 'حفظ التعديلات'}
                </button>
              </div>
            </div>

            {remainingSectionsToAdd.length > 0 && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <button 
                  onClick={() => setIsAddSectionModalOpen(true)}
                  style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                >
                  ➕ {isEngUI ? 'Add New Section' : 'إضافة قسم جديد'}
                </button>
              </div>
            )}

            {examStructure.map((sec, sIdx) => {
              const currentSectionScore = calculateSectionTotalScore(sec);
              const isOptionalSec = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');

              return (
                <div key={sIdx} style={{ marginBottom: '18px', backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h4 style={{ color: '#60a5fa', margin: 0, fontSize: '15px', fontWeight: 'bold' }}>{getSectionNumberedName(sIdx)}: {sec.name}</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: '#1e293b', padding: '4px 10px', borderRadius: '6px', border: '1px solid #334155' }}>
                        <span style={{ fontSize: '12px', color: '#93c5fd' }}>{isEngUI ? 'Section Mark:' : 'علامة القسم:'}</span>
                        <span style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '13px', direction: 'ltr' }}>{currentSectionScore}</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {!isOptionalSec && (
                        <button
                          onClick={() => {
                            setActiveSectionForType(sec.name);
                            setActiveQuestionIndexForType(null);
                            setIsAddTypeModalOpen(true);
                          }}
                          style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                        >
                          ➕ {isEngUI ? 'Add Question Type' : 'إضافة نوع سؤال'}
                        </button>
                      )}
                      <button
                        onClick={() => confirmDeleteSection(sec.name)}
                        style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                      >
                        {isEngUI ? 'Delete Section 🗑️' : 'حذف القسم 🗑️'}
                      </button>
                    </div>
                  </div>

                  {isOptionalSec && sec.subQuestions ? (
                    sec.subQuestions.map((subQ, subIdx) => {
                      const subQuestionTotalMark = subQ.types ? subQ.types.reduce((tSum, t) => {
                        return tSum + t.questions.reduce((qSum, q) => qSum + Number(q.custom_mark !== undefined ? q.custom_mark : 1), 0);
                      }, 0) : 0;

                      return (
                        <div key={subIdx} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', marginBottom: '12px', padding: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '6px', marginBottom: '8px' }}>
                            <h5 style={{ color: '#fff', margin: 0, fontSize: '13px' }}>
                              {isEngUI ? `${getArabicNumberWord(subIdx + 1)} Question (Alternative) - Score: ` : `السؤال ${getArabicNumberWord(subIdx + 1)} (بديل) - علامة السؤال: `}
                              <span style={{ direction: 'ltr', unicodeBidi: 'embed', color: '#fbbf24' }}>{subQuestionTotalMark}</span>
                            </h5>
                            <button
                              onClick={() => {
                                setActiveSectionForType(sec.name);
                                setActiveQuestionIndexForType(subIdx);
                                setIsAddTypeModalOpen(true);
                              }}
                              style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                            >
                              ➕ {isEngUI ? 'Add Question Types' : 'إضافة نوع أسئلة'}
                            </button>
                          </div>

                          {subQ.types.length === 0 ? (
                            <p style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', margin: '8px 0' }}>{isEngUI ? 'No question types added to this question.' : 'لا توجد أنواع أسئلة مضافة لهذا السؤال.'}</p>
                          ) : (
                            subQ.types.map((typeGroup, tIdx) => (
                              <div key={tIdx} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', marginBottom: '8px', padding: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '6px', marginBottom: '8px' }}>
                                  <span style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '12px', textAlign: isEngUI ? 'left' : 'right' }}>
                                    {isEngUI ? `${getArabicNumberWord(subIdx + 1)} Question : ${getQuestionTypeHeaderTitle(typeGroup.typeKey)} (` : `السؤال ${getArabicNumberWord(subIdx + 1)} : ${getQuestionTypeHeaderTitle(typeGroup.typeKey)} (`}
                                    <span style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{typeGroup.questions.length}</span> {isEngUI ? 'branches)' : 'فروع)'}
                                  </span>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      onClick={() => {
                                        setTargetSectionName(sec.name);
                                        setTargetQuestionIndex(subIdx);
                                        setTargetTypeKey(typeGroup.typeKey);
                                        setSelectedTypeFilter(typeGroup.typeKey);
                                        setIsQuestionBankOpen(true);
                                      }}
                                      style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                                    >
                                      ➕ {isEngUI ? 'Add Branch' : 'إضافة فرع'}
                                    </button>
                                    <button
                                      onClick={() => confirmDeleteQuestionType(sec.name, typeGroup.typeKey, subIdx)}
                                      style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                                    >
                                      {isEngUI ? 'Delete Type 🗑️' : 'حذف النوع 🗑️'}
                                    </button>
                                  </div>
                                </div>

                                {typeGroup.questions.map((q, qIdx) => (
                                  <div key={q.id || qIdx}>
                                    <div style={{ display: 'flex', justifyContent: isEngUI ? 'flex-start' : 'flex-end', alignItems: 'center', marginBottom: '5px', gap: '6px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#1e293b', padding: '3px 6px', borderRadius: '4px', border: '1px solid #334155' }}>
                                        <span style={{ color: '#93c5fd', fontSize: '11px' }}>{isEngUI ? 'Branch Mark:' : 'علامة الفرع:'}</span>
                                        <input
                                          type="number"
                                          min="0.5"
                                          step="0.5"
                                          value={q.custom_mark !== undefined ? q.custom_mark : 1}
                                          onChange={(e) => handleUpdateQuestionMark(sec.name, typeGroup.typeKey, q.id, e.target.value, subIdx)}
                                          style={{ width: '50px', backgroundColor: '#0f172a', color: '#fbbf24', border: '1px solid #334155', borderRadius: '4px', textAlign: 'center', padding: '3px', fontWeight: 'bold', fontSize: '12px', direction: 'ltr' }}
                                        />
                                      </div>
                                      <button
                                        onClick={() => handleDeleteQuestion(sec.name, typeGroup.typeKey, q.id, subIdx)}
                                        style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
                                      >
                                        {isEngUI ? 'Delete Branch ✕' : 'حذف الفرع ✕'}
                                      </button>
                                    </div>
                                    {renderQuestionItem(q, qIdx, typeGroup.typeKey)}
                                  </div>
                                ))}
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })
                  ) : (
                    sec.types.map((typeGroup, tIdx) => (
                      <div key={tIdx} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', marginBottom: '12px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '10px' }}>
                          <span style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '13px', textAlign: isEngUI ? 'left' : 'right' }}>
                            {isEngUI ? `${getArabicNumberWord(tIdx + 1)} Question : ${getQuestionTypeHeaderTitle(typeGroup.typeKey)} (` : `السؤال ${getArabicNumberWord(tIdx + 1)} : ${getQuestionTypeHeaderTitle(typeGroup.typeKey)} (`}
                            <span style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{typeGroup.questions.length}</span> {isEngUI ? 'questions)' : 'أسئلة)'}
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => {
                                setTargetSectionName(sec.name);
                                setTargetQuestionIndex(null);
                                setTargetTypeKey(typeGroup.typeKey);
                                setSelectedTypeFilter(typeGroup.typeKey);
                                setIsQuestionBankOpen(true);
                              }}
                              style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                            >
                              ➕ {isEngUI ? 'Add Question' : 'إضافة سؤال'}
                            </button>
                            <button
                              onClick={() => confirmDeleteQuestionType(sec.name, typeGroup.typeKey)}
                              style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                            >
                              {isEngUI ? 'Delete Type 🗑️' : 'حذف النوع 🗑️'}
                            </button>
                          </div>
                        </div>

                        {typeGroup.questions.length === 0 ? (
                          <p style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', margin: '8px 0' }}>{isEngUI ? 'No questions added for this type.' : 'لا توجد أسئلة مضافة لهذا النوع.'}</p>
                        ) : (
                          typeGroup.questions.map((q, qIdx) => (
                            <div key={q.id || qIdx}>
                              <div style={{ display: 'flex', justifyContent: isEngUI ? 'flex-start' : 'flex-end', alignItems: 'center', marginBottom: '5px', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0f172a', padding: '3px 6px', borderRadius: '4px', border: '1px solid #334155' }}>
                                  <span style={{ color: '#93c5fd', fontSize: '11px' }}>{isEngUI ? 'Branch Mark:' : 'علامة الفرع:'}</span>
                                  <input
                                    type="number"
                                    min="0.5"
                                    step="0.5"
                                    value={q.custom_mark !== undefined ? q.custom_mark : 1}
                                    onChange={(e) => handleUpdateQuestionMark(sec.name, typeGroup.typeKey, q.id, e.target.value)}
                                    style={{ width: '50px', backgroundColor: '#1e293b', color: '#fbbf24', border: '1px solid #334155', borderRadius: '4px', textAlign: 'center', padding: '3px', fontWeight: 'bold', fontSize: '12px', direction: 'ltr' }}
                                  />
                                </div>
                                <button
                                  onClick={() => handleDeleteQuestion(sec.name, typeGroup.typeKey, q.id)}
                                  style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
                                >
                                  {isEngUI ? 'Delete Question ✕' : 'حذف السؤال ✕'}
                                </button>
                              </div>
                              {renderQuestionItem(q, qIdx, typeGroup.typeKey)}
                            </div>
                          ))
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}

          </div>
        </div>
      )}

      {isQuestionBankOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px', direction: isEngUI ? 'ltr' : 'rtl' }}>
          <div style={{ backgroundColor: '#1e293b', width: '100%', maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto', padding: '22px', borderRadius: '10px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #2563eb', paddingBottom: '8px', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, color: '#60a5fa', fontSize: '16px' }}>📚 {isEngUI ? 'Select Questions from Bank' : 'اختر أسئلة من البنك'}</h4>
              <button onClick={() => setIsQuestionBankOpen(false)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>✕ {isEngUI ? 'Close' : 'إغلاق'}</button>
            </div>

            {filteredBankQuestions.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '15px', fontSize: '13px' }}>{isEngUI ? 'No matching questions available in the bank.' : 'لا توجد أسئلة متاحة مطابقة في البنك.'}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredBankQuestions.map((bq, bIdx) => (
                  <div key={bq.id || bIdx} style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', direction: isEngUI ? 'ltr' : 'rtl' }}>
                    <div style={{ flex: 1, color: '#fff', fontSize: '13px', textAlign: isEngUI ? 'left' : 'right' }}>
                      <span style={{ color: '#60a5fa', fontWeight: 'bold', [isEngUI ? 'marginRight' : 'marginLeft']: '6px' }}>{bIdx + 1}.</span>
                      {bq.question_text || bq.text || bq.body}
                    </div>
                    <button
                      onClick={() => handleSelectQuestionFromBank(bq)}
                      style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap' }}
                    >
                      {isEngUI ? 'Select ➕' : 'اختيار ➕'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isAddSectionModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px', direction: isEngUI ? 'ltr' : 'rtl' }}>
          <div style={{ backgroundColor: '#1e293b', width: '100%', maxWidth: '380px', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#60a5fa', fontSize: '16px', textAlign: isEngUI ? 'left' : 'right' }}>➕ {isEngUI ? 'Add New Section' : 'إضافة قسم جديد'}</h4>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#93c5fd', fontSize: '13px', fontWeight: 'bold', textAlign: isEngUI ? 'left' : 'right' }}>{isEngUI ? 'Select Section:' : 'اختر القسم:'}</label>
              <select
                value={selectedSectionTemplate}
                onChange={(e) => setSelectedSectionTemplate(e.target.value)}
                className="edge-fix-select-manage"
                style={{ direction: isEngUI ? 'ltr' : 'rtl', textAlign: isEngUI ? 'left' : 'right' }}
              >
                <option value="">{isEngUI ? '-- Select Section --' : '-- اختر القسم --'}</option>
                {remainingSectionsToAdd.map((sec, idx) => (
                  <option key={idx} value={sec.name}>{sec.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setIsAddSectionModalOpen(false)} style={{ backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>{isEngUI ? 'Cancel' : 'إلغاء'}</button>
              <button onClick={handleAddNewSection} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>{isEngUI ? 'Add' : 'إضافة'}</button>
            </div>
          </div>
        </div>
      )}

      {isAddTypeModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px', direction: isEngUI ? 'ltr' : 'rtl' }}>
          <div style={{ backgroundColor: '#1e293b', width: '100%', maxWidth: '380px', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#60a5fa', fontSize: '16px', textAlign: isEngUI ? 'left' : 'right' }}>➕ {isEngUI ? 'Add New Question Type' : 'إضافة نوع سؤال جديد'}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
              <button onClick={() => handleAddTypeToTarget('true_false')} style={{ backgroundColor: '#0f172a', color: '#34d399', border: '1px solid #334155', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', textAlign: isEngUI ? 'left' : 'right' }}>{isEngUI ? 'True / False' : 'صح وخطأ'}</button>
              <button onClick={() => handleAddTypeToTarget('multiple_choice')} style={{ backgroundColor: '#0f172a', color: '#38bdf8', border: '1px solid #334155', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', textAlign: isEngUI ? 'left' : 'right' }}>{isEngUI ? 'Multiple Choice' : 'اختيار من متعدد'}</button>
              <button onClick={() => handleAddTypeToTarget('completion')} style={{ backgroundColor: '#0f172a', color: '#fbbf24', border: '1px solid #334155', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', textAlign: isEngUI ? 'left' : 'right' }}>{isEngUI ? 'Fill in the Blanks' : 'أكمل الفراغ'}</button>
              <button onClick={() => handleAddTypeToTarget('essay')} style={{ backgroundColor: '#0f172a', color: '#f472b6', border: '1px solid #334155', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', textAlign: isEngUI ? 'left' : 'right' }}>{isEngUI ? 'Essay Question' : 'سؤال مقالي'}</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsAddTypeModalOpen(false)} style={{ backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>{isEngUI ? 'Cancel' : 'إلغاء'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}