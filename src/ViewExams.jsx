import React, { useState, useEffect } from 'react';

export default function ViewExams({ supabase, styles, showAlertMessage, supervisor }) {
  const [exams, setExams] = useState([]);
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const [filterBranchId, setFilterBranchId] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [resolvedSupervisor, setResolvedSupervisor] = useState(supervisor || null);
  const [examStructure, setExamStructure] = useState([]);

  const isEnglishExam = () => {
    const textToCheck = (examTitle || selectedExam?.title || selectedExam?.exam_name || '').toLowerCase();
    return /[a-z]/.test(textToCheck) && !/[أ-ي]/.test(textToCheck);
  };

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

      fetchAllData(current, branchId, subjectId);
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

  const updateExamsActiveStatus = async (examsList) => {
    const now = new Date();

    for (const exam of examsList) {
      const status = getExamTimeStatus(exam, now);
      if (status === 'unknown') continue;

      const shouldBeActive = status === 'active';

      if (Boolean(exam.is_active) !== shouldBeActive) {
        const { error } = await supabase
          .from('exams')
          .update({ is_active: shouldBeActive })
          .eq('id', exam.id);

        if (!error) exam.is_active = shouldBeActive;
        else console.error(`Error updating is_active for exam ID ${exam.id}:`, error);
      }
    }
  };

  const fetchAllData = async (activeSupervisor = resolvedSupervisor, bId = filterBranchId, sId = filterSubjectId) => {
    setLoading(true);
    try {
      let examsData = [];
      
      const isManagerRole = Number(activeSupervisor?.job_id) === 1 ||
        ['admin', 'مدير'].includes(String(activeSupervisor?.role || '').trim().toLowerCase()) ||
        String(activeSupervisor?.job?.job_name || '').trim() === 'مدير';

      if (isManagerRole) {
        const { data, error } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        examsData = data || [];
      } else {
        if (!bId || !sId) {
          setExams([]);
          setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from('exams')
          .select('*')
          .eq('branch_id', bId)
          .eq('subject_id', sId);
        if (error) throw error;
        examsData = data || [];
      }

      if (examsData.length > 0) {
        await updateExamsActiveStatus(examsData);
      }

      let branchesData = [];
      const resBranches = await supabase.from('branches').select('*');
      if (!resBranches.error && resBranches.data) branchesData = resBranches.data;

      let subjectsData = [];
      const resSubjects = await supabase.from('subjects').select('*');
      if (!resSubjects.error && resSubjects.data) subjectsData = resSubjects.data;

      setBranches(branchesData || []);
      setSubjects(subjectsData || []);

      const branchesMap = {};
      branchesData.forEach(b => { branchesMap[b.id] = b.name || b.branch_name || b.title; });

      const subjectsMap = {};
      subjectsData.forEach(s => { subjectsMap[s.id] = s.subject_name || s.name || s.title; });

      const enrichedExams = examsData.map(ex => ({
        ...ex,
        branchName: branchesMap[ex.branch_id] || ex.branch || '-',
        subjectName: subjectsMap[ex.subject_id] || subjectsMap[ex.subject_name_id] || subjectsMap[ex.subject] || '-'
      }));

      setExams(enrichedExams);
    } catch (err) {
      console.error('Error fetching exams:', err);
      if (showAlertMessage) showAlertMessage('تعذر تحميل الامتحانات: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPreview = async (exam) => {
    setSelectedExam(exam);
    const titleVal = exam.title || exam.exam_title || exam.name || '';
    setExamTitle(titleVal);
    setIsPreviewOpen(true);

    try {
      const { data: examQuestions, error } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', exam.id);

      if (!error && examQuestions && examQuestions.length > 0) {
        const typesMap = {};
        examQuestions.forEach(q => {
          const tKey = q.question_type || q.type || 'true_false';
          if (!typesMap[tKey]) typesMap[tKey] = [];
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
        const sortedStruct = struct.map(sec => ({
          ...sec,
          types: sec.types ? sortTypesByPriority(sec.types) : sec.types,
          subQuestions: sec.subQuestions ? sec.subQuestions.map(sub => ({
            ...sub,
            types: sub.types ? sortTypesByPriority(sub.types) : sub.types
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
        types: [{ typeKey: 'true_false', questions: [] }] 
      }
    ]);
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

  const formatDateTimeDisplay = (examObj) => {
    const dateVal = examObj.exam_date;
    const timeVal = examObj.exam_time;
    let dateStr = dateVal ? String(dateVal).split('T')[0] : (isEnglishExam() ? 'Not specified' : 'غير محدد');
    let timeStr = timeVal ? format12HourTime(String(timeVal).slice(0, 5)) : '';

    let endTimeStr = '';
    const start = typeof parseExamStart === 'function' ? parseExamStart(examObj) : null;
    const duration = Number(examObj.duration_minutes ?? examObj.duration ?? 30);
    if (start && Number.isFinite(duration)) {
      const end = new Date(start.getTime() + Math.max(0, duration) * 60000);
      endTimeStr = end.toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    return { dateStr, timeStr, endTimeStr };
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
      const engWords = { 1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth', 5: 'Fifth' };
      return engWords[num] || num;
    }
    const words = { 1: 'الأول', 2: 'الثاني', 3: 'الثالث', 4: 'الرابع', 5: 'الخامس' };
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
              <th style={{ padding: '8px 6px', width: '45px', textAlign: isEng ? 'left' : 'right' }}>{isEng ? 'No.' : 'الرقم'}</th>
              <th style={{ padding: '8px 6px', textAlign: isEng ? 'left' : 'right' }}>{isEng ? 'Exam Title' : 'اسم الامتحان'}</th>
              <th style={{ padding: '8px 6px', textAlign: isEng ? 'left' : 'right' }}>{isEng ? 'Branch' : 'الفرع'}</th>
              <th style={{ padding: '8px 6px', textAlign: isEng ? 'left' : 'right' }}>{isEng ? 'Subject' : 'المادة'}</th>
              <th style={{ padding: '8px 6px', textAlign: 'center' }}>{isEng ? 'Exam Date' : 'تاريخ الامتحان'}</th>
              <th style={{ padding: '8px 6px', textAlign: 'center' }}>{isEng ? 'Start Time' : 'وقت البدء'}</th>
              <th style={{ padding: '8px 6px', textAlign: 'center' }}>{isEng ? 'End Time' : 'وقت الانتهاء'}</th>
              <th style={{ padding: '8px 6px', textAlign: 'center' }}>{isEng ? 'Duration' : 'المدة'}</th>
              <th style={{ padding: '8px 6px', textAlign: 'center' }}>{isEng ? 'Total Mark' : 'العلامة'}</th>
              <th style={{ padding: '8px 6px', textAlign: 'center' }}>{isEng ? 'Actions' : 'الإجراءات'}</th>
            </tr>
          </thead>
          <tbody>
            {examsList.map((exam, index) => {
              const { dateStr, timeStr, endTimeStr } = formatDateTimeDisplay(exam);
              const examTitle = exam.title || exam.exam_title || exam.name || (isEng ? 'Untitled Exam' : 'امتحان بدون عنوان');
              const isActive = isExamActiveNow(exam);

              return (
                <tr key={exam.id || index} style={{ borderBottom: '1px solid #334155', backgroundColor: isActive ? 'rgba(16, 185, 129, 0.08)' : 'transparent' }}>
                  <td style={{ padding: '8px 6px', color: '#93c5fd', fontWeight: 'bold', textAlign: isEng ? 'left' : 'right' }}>{index + 1}</td>
                  <td style={{ padding: '8px 6px', textAlign: isEng ? 'left' : 'right' }}>
                    <span 
                      onClick={() => handleOpenPreview(exam)}
                      style={{ color: '#38bdf8', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {examTitle}
                    </span>
                  </td>
                  <td style={{ padding: '8px 6px', color: '#cbd5e1', textAlign: isEng ? 'left' : 'right' }}>{exam.branchName}</td>
                  <td style={{ padding: '8px 6px', color: '#cbd5e1', textAlign: isEng ? 'left' : 'right' }}>{exam.subjectName}</td>
                  <td style={{ padding: '8px 6px', color: '#cbd5e1', textAlign: 'center', direction: 'ltr' }}>{dateStr}</td>
                  <td style={{ padding: '8px 6px', color: '#cbd5e1', textAlign: 'center', direction: 'ltr' }}>{timeStr || '-'}</td>
                  <td style={{ padding: '8px 6px', color: '#a7f3d0', fontWeight: 'bold', textAlign: 'center', direction: 'ltr' }}>{endTimeStr || '-'}</td>
                  <td style={{ padding: '8px 6px', color: '#cbd5e1', textAlign: 'center', direction: 'ltr' }}>{exam.duration_minutes || exam.duration || 30}m</td>
                  <td style={{ padding: '8px 6px', color: '#fbbf24', fontWeight: 'bold', textAlign: 'center', direction: 'ltr' }}>{exam.total_mark || exam.total_marks || 100}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    <button 
                      onClick={() => handleOpenPreview(exam)} 
                      style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}
                    >
                      {isEng ? 'Preview 👁️' : 'معاينة 👁️'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const filteredExams = exams.filter(exam => {
    const title = (exam.title || exam.exam_title || '').toLowerCase();
    return title.includes(search.toLowerCase());
  });

  const now = new Date();
  const activeExams = filteredExams.filter(exam => getExamTimeStatus(exam, now) === 'active');
  const upcomingExams = filteredExams.filter(exam => getExamTimeStatus(exam, now) === 'upcoming');
  const finishedExams = filteredExams.filter(exam => getExamTimeStatus(exam, now) === 'finished');

  const isEngUI = isEnglishExam();

  return (
    <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '25px', color: '#fff', direction: isEngUI ? 'ltr' : 'rtl' }}>
      
      <h3 style={{ fontSize: '20px', marginBottom: '18px', color: '#60a5fa', borderBottom: '2px solid #2563eb', paddingBottom: '8px', textAlign: 'center' }}>
         {isEngUI ? 'View Exams & Question Bank Structure 👁️' : 'عرض الامتحانات وهيكلية الأسئلة والأقسام 👁️'}
      </h3>

      <div style={{ marginBottom: '20px' }}>
        <input 
          type="text"
          placeholder={isEngUI ? 'Search exam title...' : 'ابحث باسم الامتحان...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>{isEngUI ? 'Loading...' : 'جاري التحميل...'}</p>
      ) : (
        <>
          <div style={{ marginBottom: '25px' }}>
            <h4 style={{ color: '#34d399', borderBottom: '1px solid #334155', paddingBottom: '6px', marginBottom: '12px', fontSize: '16px' }}>
              {isEngUI ? `Current / Live Exams (${activeExams.length})` : `الامتحانات الحالية (${activeExams.length})`}
            </h4>
            {renderExamsTable(activeExams)}
          </div>

          <div style={{ marginBottom: '25px' }}>
            <h4 style={{ color: '#60a5fa', borderBottom: '1px solid #334155', paddingBottom: '6px', marginBottom: '12px', fontSize: '16px' }}>
              📅 {isEngUI ? `Upcoming Exams (${upcomingExams.length})` : `قائمة الامتحانات المقبلة (${upcomingExams.length})`}
            </h4>
            {renderExamsTable(upcomingExams)}
          </div>

          <div style={{ marginBottom: '25px' }}>
            <h4 style={{ color: '#fbbf24', borderBottom: '1px solid #334155', paddingBottom: '6px', marginBottom: '12px', fontSize: '16px' }}>
              ⏳ {isEngUI ? `Finished Exams (${finishedExams.length})` : `قائمة الامتحانات المنتهية (${finishedExams.length})`}
            </h4>
            {renderExamsTable(finishedExams)}
          </div>
        </>
      )}

      {isPreviewOpen && selectedExam && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', direction: isEngUI ? 'ltr' : 'rtl' }}>
          <div style={{ backgroundColor: '#1e293b', width: '100%', maxWidth: '1100px', maxHeight: '92vh', overflowY: 'auto', padding: '25px', borderRadius: '10px', border: '1px solid #334155' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #2563eb', paddingBottom: '10px', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, color: '#60a5fa', fontSize: '18px' }}>{isEngUI ? `Exam Preview: ${examTitle}` : `معاينة الامتحان: ${examTitle}`}</h3>
              <button onClick={() => setIsPreviewOpen(false)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>✕ {isEngUI ? 'Close' : 'إغلاق'}</button>
            </div>

            {examStructure.map((sec, sIdx) => (
              <div key={sIdx} style={{ marginBottom: '18px', backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155' }}>
                <h4 style={{ color: '#60a5fa', margin: '0 0 10px 0', fontSize: '15px', fontWeight: 'bold', borderBottom: '1px solid #334155', paddingBottom: '6px' }}>
                  {getSectionNumberedName(sIdx)}: {sec.name}
                </h4>

                {sec.types && sec.types.map((typeGroup, tIdx) => (
                  <div key={tIdx} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', marginBottom: '12px', padding: '12px' }}>
                    <p style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '13px', margin: '0 0 8px 0' }}>
                      {getQuestionTypeHeaderTitle(typeGroup.typeKey)}
                    </p>
                    
                    {typeGroup.questions.map((q, qIdx) => (
                      <div key={q.id || qIdx} style={{ fontSize: '14px', color: '#e2e8f0', marginBottom: '8px', padding: '8px', backgroundColor: '#0f172a', borderRadius: '4px', border: '1px solid #334155' }}>
                        <span style={{ color: '#60a5fa', fontWeight: 'bold', marginInlineEnd: '6px' }}>{qIdx + 1}.</span>
                        {q.question_text || q.text || q.body}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}

          </div>
        </div>
      )}

    </div>
  );
}