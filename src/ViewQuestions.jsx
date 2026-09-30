import React, { useState, useEffect } from 'react';

export default function ViewQuestions({ supabase, styles, showAlertMessage, teacher }) {
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [units, setUnits] = useState([]);

  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedUnitNumber, setSelectedUnitNumber] = useState('all');
  const [questionType, setQuestionType] = useState('');
  const [searchSearch, setSearchSearch] = useState('');

  const [questions, setQuestions] = useState([]);
  const [totalSubjectQuestionsCount, setTotalSubjectQuestionsCount] = useState(0); 
  const [loading, setLoading] = useState(false);

  const [resolvedTeacher, setResolvedTeacher] = useState(teacher || null);
  const [teacherReady, setTeacherReady] = useState(false);

  const showMsg = (msg, type) => {
    if (typeof showAlertMessage === 'function') {
      showAlertMessage(msg, type);
    } else {
      console.log(`[${type}] ${msg}`);
    }
  };

  // تحميل فرع ومادة الموظف الحاليين تلقائياً مع دعم الجدول الأساسي employees والجداول البديلة.
  useEffect(() => {
    let cancelled = false;

    const resolveTeacher = async () => {
      let current = teacher || {
        id: localStorage.getItem('currentUserId'),
        username: localStorage.getItem('currentUsername'),
        name: localStorage.getItem('currentName'),
        role: localStorage.getItem('currentUserRole'),
        branch_id: null,
        subject_id: null
      };

      let found = null;

      if (current?.id) {
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

      if (!found && current?.id) {
        const { data } = await supabase
          .from('supervisors')
          .select('*')
          .eq('id', current.id)
          .maybeSingle();
        if (data) found = data;
      }

      if (!found && current?.username) {
        const { data } = await supabase
          .from('supervisors')
          .select('*')
          .eq('username', current.username)
          .maybeSingle();
        if (data) found = data;
      }

      if (!found && current?.id) {
        const { data } = await supabase
          .from('teachers')
          .select('*')
          .eq('id', current.id)
          .maybeSingle();
        if (data) found = data;
      }

      if (found) current = { ...(current || {}), ...found };
      if (cancelled) return;

      const branchId =
        current?.branch_id != null && current.branch_id !== ''
          ? String(current.branch_id) : '';

      let subjectId =
        current?.subject_id != null && current.subject_id !== ''
          ? String(current.subject_id) : '';

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

      const normalizedTeacher = {
        ...(current || {}),
        branch_id: branchId || current?.branch_id || null,
        subject_id: subjectId || current?.subject_id || null
      };

      setResolvedTeacher(normalizedTeacher);
      setSelectedBranch(branchId);
      setSelectedSubject(subjectId);
      setTeacherReady(Boolean(branchId && subjectId));
    };

    const fetchBranches = async () => {
      const { data, error } = await supabase.from('branches').select('*');
      if (data && !cancelled) setBranches(data);
      if (error) console.error('Error fetching branches:', error);
    };

    resolveTeacher();
    fetchBranches();

    return () => { cancelled = true; };
  }, [teacher, supabase]);

  // جلب المواد (المباحث) عند اختيار الفرع
  useEffect(() => {
    if (!selectedBranch) { 
      setSubjects([]); 
      setUnits([]);
      return; 
    }
    const fetchSubjects = async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('branch_id', selectedBranch);
      if (data) setSubjects(data);
      if (error) console.error('Error fetching subjects:', error);
    };
    fetchSubjects();
  }, [selectedBranch, supabase]);

  // جلب الوحدات عند اختيار المبحث
  useEffect(() => {
    if (!selectedSubject) { 
      setUnits([]); 
      setSelectedUnitNumber('all'); 
      setTotalSubjectQuestionsCount(0);
      return; 
    }
    const fetchUnits = async () => {
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('*')
        .eq('subject_id', selectedSubject);
      if (unitsData) setUnits(unitsData);
      if (unitsError) console.error('Error fetching units:', unitsError);
    };
    fetchUnits();
  }, [selectedSubject, supabase]);

  // جلب الأسئلة وحساب العدد الإجمالي للمادة بدقة
  const fetchQuestions = async () => {
    if (!teacherReady || !selectedBranch || !selectedSubject || !selectedUnitNumber) {
      showMsg('يرجى اختيار الوحدة والتأكد من بيانات الفرع والمادة', 'error');
      return;
    }

    const teacherBranchId = resolvedTeacher?.branch_id != null ? String(resolvedTeacher.branch_id) : '';
    const teacherSubjectId = resolvedTeacher?.subject_id != null ? String(resolvedTeacher.subject_id) : '';

    if (
      !teacherBranchId || !teacherSubjectId ||
      String(selectedBranch) !== teacherBranchId ||
      String(selectedSubject) !== teacherSubjectId
    ) {
      showMsg('لا يمكنك عرض أسئلة خارج فرع ومادة المعلم', 'error');
      return;
    }

    setLoading(true);
    
    // 1. جلب إجمالي الأسئلة الخاصة بهذه المادة حصرياً
    const { count: subjectCount, error: countErr } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', teacherBranchId)
      .eq('subject_id', teacherSubjectId);

    if (!countErr && subjectCount !== null) {
      setTotalSubjectQuestionsCount(subjectCount);
    } else {
      setTotalSubjectQuestionsCount(0);
    }

    // 2. جلب الأسئلة المطابقة للوحدة والمادة والنوع
    let query = supabase
      .from('questions')
      .select('*')
      .eq('branch_id', teacherBranchId)
      .eq('subject_id', teacherSubjectId);

    if (selectedUnitNumber !== 'all') {
      query = query.eq('unit_number', selectedUnitNumber);
    }

    if (questionType) {
      query = query.eq('question_type', questionType);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase query error:', error);
      showMsg('خطأ في جلب الأسئلة: ' + error.message, 'error');
    } else {
      setQuestions(data || []);
      if (!data || data.length === 0) {
        showMsg('لا توجد أسئلة مسجلة لهذه الوحدة والمادة حتى الآن', 'error');
      }
    }
    setLoading(false);
  };

  const currentSubjectObj = subjects.find(s => String(s.id) === String(selectedSubject));
  const subjectName =
    currentSubjectObj?.subject_name ||
    currentSubjectObj?.name ||
    resolvedTeacher?.subject_name ||
    resolvedTeacher?.specialization ||
    resolvedTeacher?.subject ||
    'المادة المختارة';
  
  const currentUnitObj = units.find(u => String(u.unit_number) === String(selectedUnitNumber));
  const unitName = selectedUnitNumber === 'all'
    ? 'جميع الوحدات'
    : (currentUnitObj ? (currentUnitObj.name || currentUnitObj.unit_name || `الوحدة ${selectedUnitNumber}`) : `الوحدة ${selectedUnitNumber}`);

  // تصفية إضافية محلية لنص البحث
  const filteredQuestions = questions.filter(q => {
    const text = String(q.question_text || q.text || '').toLowerCase();
    return !searchSearch || text.includes(searchSearch.trim().toLowerCase());
  });

  return (
    <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '30px', color: '#fff', direction: 'rtl' }}>
      
      <style>{`
        .edge-fix-select-q {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 2px solid #3b82f6 !important;
          padding: 14px 16px !important;
          border-radius: 6px !important;
          font-size: 18px !important;
          font-weight: bold !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .edge-fix-select-q option {
          background-color: #ffffff !important;
          color: #0f172a !important;
          font-weight: bold !important;
          font-size: 16px !important;
          padding: 10px !important;
        }
      `}</style>

      <h3 style={{ fontSize: '22px', marginBottom: '20px', color: '#60a5fa', borderBottom: '2px solid #2563eb', paddingBottom: '10px', textAlign: 'center' }}>
        📚 استعراض وعرض الأسئلة
      </h3>

      {/* حقول التصفية */}
      <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
          
          <div>
             <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: 'bold', color: '#93c5fd' }}>فرع المعلم:</label>
             <input
               type="text"
               readOnly
               value={
                 branches.find(b => String(b.id) === String(selectedBranch))?.branch_name ||
                 branches.find(b => String(b.id) === String(selectedBranch))?.name ||
                 branches.find(b => String(b.id) === String(selectedBranch))?.title ||
                 ''
               }
               placeholder="فرع المعلم غير محدد"
               className="edge-fix-select-q"
               style={{ width: '100%', boxSizing: 'border-box' }}
             />
           </div>

           <div>
             <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: 'bold', color: '#93c5fd' }}>مادة المعلم:</label>
             <input
               type="text"
               readOnly
               value={
                 subjects.find(s => String(s.id) === String(selectedSubject))?.subject_name ||
                 subjects.find(s => String(s.id) === String(selectedSubject))?.name ||
                 subjects.find(s => String(s.id) === String(selectedSubject))?.title ||
                 ''
               }
               placeholder="مادة المعلم غير محددة"
               className="edge-fix-select-q"
               style={{ width: '100%', boxSizing: 'border-box' }}
             />
           </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: 'bold', color: '#93c5fd' }}>اختر الوحدة:</label>
            <select value={selectedUnitNumber} onChange={(e) => setSelectedUnitNumber(e.target.value)} className="edge-fix-select-q">
              <option value="all">جميع الوحدات</option>
              {units.map(u => <option key={u.id} value={u.unit_number}>الوحدة {u.unit_number}: {u.name || u.unit_name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: 'bold', color: '#93c5fd' }}>نوع السؤال (اختياري للتصفية):</label>
            <select value={questionType} onChange={(e) => setQuestionType(e.target.value)} className="edge-fix-select-q">
              <option value="">-- جميع الأنواع --</option>
              <option value="mcq">اختيار من متعدد</option>
              <option value="true_false">صح وخطأ</option>
              <option value="text">إجابة نصية</option>
            </select>
          </div>

        </div>

        <div style={{ marginBottom: '15px' }}>
          <input
            type="text"
            value={searchSearch}
            onChange={(e) => setSearchSearch(e.target.value)}
            placeholder="🔎 ابحث داخل نص الأسئلة المعروضة..."
            className="edge-fix-select-q"
            style={{ width: '100%', boxSizing: 'border-box', fontSize: '16px' }}
          />
        </div>

        <button onClick={fetchQuestions} style={{ width: '100%', padding: '14px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '18px' }}>
          عرض الأسئلة المطابقة
        </button>
      </div>

      {/* عرض تفاصيل أعداد الأسئلة */}
      {selectedSubject && selectedUnitNumber && !loading && (
        <div style={{ backgroundColor: '#0f172a', padding: '15px 20px', borderRadius: '8px', border: '1px solid #3b82f6', marginBottom: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '17px', fontWeight: 'bold', color: '#f3f4f6', margin: 0 }}>
            <span style={{ color: '#60a5fa' }}>عدد الأسئلة لمادة {subjectName} هو ({totalSubjectQuestionsCount} سؤال)</span>
            <span style={{ color: '#f59e0b', margin: '0 10px' }}>|</span>
            <span style={{ color: '#34d399' }}>عدد أسئلة {unitName} هو ({questions.length} سؤال)</span>
          </p>
          <div style={{ width: '100%', height: '2px', backgroundColor: '#3b82f6', marginTop: '12px', opacity: 0.6 }}></div>
        </div>
      )}

      {/* قائمة الأسئلة */}
      {loading ? (
        <p style={{ textAlign: 'center', fontSize: '16px', color: '#94a3b8', padding: '20px' }}>جاري التحميل...</p>
      ) : filteredQuestions.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '16px', padding: '20px' }}>لا توجد أسئلة مسجلة لهذه التصفية حتى الآن.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredQuestions.map((q, index) => {
            let opts = q.options || [];
            if (typeof opts === 'string') {
              try { opts = JSON.parse(opts); } catch (e) { opts = opts.split(',').map(item => item.trim()); }
            }

            const qTypeLabel = q.question_type === 'true_false' ? 'صح وخطأ' : q.question_type === 'text' ? 'إجابة نصية' : q.question_type === 'essay' ? 'مقالي' : 'اختيار من متعدد';
            const rawCorrect = String(q.correct_answer ?? '');
            const correctIndex = Number(rawCorrect);
            const correctOptionText = (Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex < opts.length) ? opts[correctIndex] : rawCorrect;

            return (
              <div key={q.id || index} style={{ backgroundColor: '#0f172a', padding: '18px 20px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, marginLeft: '20px' }}>
                  {/* صورة مصغرة للسؤال إذا كانت مرفقة */}
                  {(q.image_url || q.image) && (
                    <div style={{ marginBottom: '10px' }}>
                      <img src={q.image_url || q.image} alt="Question Visual" style={{ width: '90px', height: '65px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #475569' }} />
                    </div>
                  )}

                  <p style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '10px', color: '#fff' }}>
                    {index + 1}. {q.question_text || q.text}
                  </p>

                  {/* عرض الخيارات أو الإجابة حسب نوع السؤال */}
                  {q.question_type === 'mcq' && Array.isArray(opts) && opts.length > 0 && opts[0] !== '' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                      {opts.map((opt, i) => (
                        <span key={i} style={{ fontSize: '14px', color: (opt === q.correct_answer || opt === correctOptionText) ? '#4ade80' : '#94a3b8', fontWeight: (opt === q.correct_answer || opt === correctOptionText) ? 'bold' : 'normal' }}>
                          {i + 1}) {opt} {(opt === q.correct_answer || opt === correctOptionText) && '✓ (الإجابة الصحيحة)'}
                        </span>
                      ))}
                    </div>
                  )}

                  {q.question_type === 'true_false' && (
                    <div style={{ marginBottom: '10px', fontSize: '14px', color: '#4ade80', fontWeight: 'bold' }}>
                      الإجابة الصحيحة: {q.correct_answer === 'true' ? 'صح' : 'خطأ'}
                    </div>
                  )}

                  {q.question_type === 'text' && (
                    <div style={{ marginBottom: '10px', fontSize: '14px', color: '#4ade80', fontWeight: 'bold' }}>
                      الإجابة النموذجية: {q.correct_answer}
                    </div>
                  )}

                  {(q.question_type === 'essay' || q.question_type === 'completion') && (
                    <div style={{ marginBottom: '10px', fontSize: '14px', color: '#4ade80', fontWeight: 'bold' }}>
                      الإجابة الصحيحة: {(() => {
                        if (q.question_type === 'essay') {
                          try {
                            const parsed = JSON.parse(q.correct_answer || '[]');
                            return Array.isArray(parsed) ? parsed.filter(Boolean).join(' • ') : q.correct_answer;
                          } catch { return q.correct_answer || 'غير محددة'; }
                        }
                        return q.correct_answer || 'غير محددة';
                      })()}
                    </div>
                  )}

                  <div style={{ marginBottom: '10px', fontSize: '14px', color: '#fbbf24', fontWeight: 'bold' }}>
                    مستوى صعوبة السؤال: {q.difficulty_level || 'متوسط'}
                  </div>
                  <div style={{ marginBottom: '10px', fontSize: '14px', color: '#a78bfa', fontWeight: 'bold' }}>
                    الوحدة: {(() => { const u = units.find(x => String(x.unit_number) === String(q.unit_number)); return u ? (u.name || u.unit_name || `الوحدة ${q.unit_number}`) : (q.unit_name || (q.unit_number != null ? `الوحدة ${q.unit_number}` : 'غير محددة')); })()}
                  </div>
                  <div style={{ display: 'flex', gap: '15px', fontSize: '13px', color: '#60a5fa' }}>
                    <span>العلامة: {q.points !== undefined && q.points !== null ? q.points : q.mark}</span>
                    <span>|</span>
                    <span>نوع السؤال: {qTypeLabel}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}