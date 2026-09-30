import React, { useState, useEffect } from 'react';

export default function AddQuestions({ supabase, teacher }) {
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [units, setUnits] = useState([]);

  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedUnitNumber, setSelectedUnitNumber] = useState('');

  const [questionType, setQuestionType] = useState('mcq');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [mark, setMark] = useState('1.0');
  const [difficultyLevel, setDifficultyLevel] = useState('متوسط');
  
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('0');

  // للسؤال المقالي: يمكن إدخال حتى 4 إجابات صحيحة.
  // أي إجابة يتم إدخالها هنا تعتبر إجابة صحيحة، وليس مطلوباً تعبئة الأربع.
  const [essayCorrectAnswers, setEssayCorrectAnswers] = useState(['', '', '', '']);
  
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState({ text: '', type: '' });

  const [resolvedTeacher, setResolvedTeacher] = useState(teacher || null);
  const [teacherReady, setTeacherReady] = useState(false);

  const showInternalAlert = (text, type = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => {
      setFeedbackMessage({ text: '', type: '' });
    }, 4000);
  };

  useEffect(() => {
    let cancelled = false;

    const resolveEmployee = async () => {
      try {
        // الاعتماد على الموظف الحالي من employees، وليس جدول teachers.
        const storedId = window.localStorage.getItem('currentUserId');
        const storedUsername = window.localStorage.getItem('currentUsername');

        let query = supabase
          .from('employees')
          .select('id, username, full_name, health, job_id, branch_id, subject_id, role, is_active')
          .limit(1);

        let employee = null;

        if (storedId) {
          const { data, error } = await query.eq('id', Number(storedId)).maybeSingle();
          if (error) throw error;
          employee = data || null;
        }

        if (!employee && storedUsername) {
          const { data, error } = await supabase
            .from('employees')
            .select('id, username, full_name, health, job_id, branch_id, subject_id, role, is_active')
            .eq('username', storedUsername)
            .maybeSingle();
          if (error) throw error;
          employee = data || null;
        }

        // fallback لبيانات teacher الممررة من شاشة الدخول.
        if (!employee && teacher?.id != null) {
          const { data, error } = await supabase
            .from('employees')
            .select('id, username, full_name, health, job_id, branch_id, subject_id, role, is_active')
            .eq('id', Number(teacher.id))
            .maybeSingle();
          if (error) throw error;
          employee = data || null;
        }

        if (!employee && teacher?.username) {
          const { data, error } = await supabase
            .from('employees')
            .select('id, username, full_name, health, job_id, branch_id, subject_id, role, is_active')
            .eq('username', teacher.username)
            .maybeSingle();
          if (error) throw error;
          employee = data || null;
        }

        if (!employee) {
          throw new Error('لم يتم العثور على الموظف الحالي في جدول employees.');
        }

        const branchId = employee.branch_id != null ? String(employee.branch_id) : '';
        const subjectId = employee.subject_id != null ? String(employee.subject_id) : '';

        if (!branchId || !subjectId) {
          throw new Error('الموظف الحالي لا يحتوي على فرع ومادة محددين في جدول employees.');
        }

        if (cancelled) return;

        setResolvedTeacher(employee);
        if (branchId) setSelectedBranch(branchId);
        if (subjectId) setSelectedSubject(subjectId);
        setTeacherReady(true);
      } catch (error) {
        console.error('Resolve employee error:', error);
        if (!cancelled) {
          setTeacherReady(false);
          showInternalAlert(error?.message || 'تعذر تحميل بيانات الموظف الحالي.', 'error');
        }
      }
    };

    const fetchBranches = async () => {
      const { data, error } = await supabase.from('branches').select('*');
      if (error) showInternalAlert('خطأ في جلب الفروع: ' + error.message, 'error');
      else if (data && !cancelled) setBranches(data);
    };

    resolveEmployee();
    fetchBranches();

    return () => { cancelled = true; };
  }, [teacher, supabase]);

  useEffect(() => {
    setSubjects([]);
    setUnits([]);
    if (!selectedBranch) return;

    const fetchSubjects = async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('branch_id', selectedBranch);
      if (error) showInternalAlert('خطأ في جلب المواد: ' + error.message, 'error');
      else if (data) setSubjects(data);
    };
    fetchSubjects();
  }, [selectedBranch, supabase]);

  useEffect(() => {
    setSelectedUnitNumber('');
    setUnits([]);
    if (!selectedSubject) return;

    const fetchUnits = async () => {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('subject_id', selectedSubject);
      if (error) showInternalAlert('خطأ في جلب الوحدات: ' + error.message, 'error');
      else if (data) setUnits(data);
    };
    fetchUnits();
  }, [selectedSubject, supabase]);

  const handleTypeChange = (newType) => {
    setQuestionType(newType);
    if (newType === 'mcq') {
      setOptions(['', '', '', '']);
      setCorrectAnswer('0');
    } else if (newType === 'true_false') {
      setOptions(['صح', 'خطأ']);
      setCorrectAnswer('true');
    } else if (newType === 'completion') {
      setOptions([]);
      setCorrectAnswer('');
      setEssayCorrectAnswers(['', '', '', '']);
    } else if (newType === 'essay') {
      setOptions([]);
      setCorrectAnswer('');
      setEssayCorrectAnswers(['', '', '', '']);
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleEssayAnswerChange = (index, value) => {
    setEssayCorrectAnswers((previous) => {
      const updated = [...previous];
      updated[index] = value;
      return updated;
    });
  };

  const handleQuestionImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
      setImageUrl('');
    } else {
      setImagePreview('');
    }
  };

  const uploadQuestionImage = async (file) => {
    if (!file) return null;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP أو GIF.');
    }

    if (file.size > 8 * 1024 * 1024) {
      throw new Error('حجم الصورة كبير جدًا. الحد الأقصى 8MB.');
    }

    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const safeTeacherId = resolvedTeacher?.id || 'teacher';
    const uniquePart =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const filePath = `${safeTeacherId}/${Date.now()}-${uniquePart}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('question-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('question-images')
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      throw new Error('تم رفع الصورة لكن تعذر إنشاء رابط الصورة.');
    }

    return publicUrlData.publicUrl;
  };

  const handleMarkChange = (direction) => {
    let current = parseFloat(mark);
    if (isNaN(current)) current = 1.0;
    
    if (direction === 'up') {
      current += 0.1;
    } else if (direction === 'down') {
      current -= 0.1;
      if (current < 0) current = 0;
    }
    setMark(current.toFixed(1));
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!teacherReady || !selectedBranch || !selectedSubject || !selectedUnitNumber) {
      showInternalAlert('تعذر تحميل الفرع والمادة من بيانات الموظف الحالي في employees.', 'error');
      return;
    }

    if (!questionText.trim()) {
      showInternalAlert('يرجى كتابة نص السؤال', 'error');
      return;
    }

    if (questionType === 'mcq') {
      const cleanOptions = options.map((v) => String(v || '').trim());
      if (cleanOptions.some((v) => !v)) {
        showInternalAlert('يرجى تعبئة الخيارات الأربعة كلها.', 'error');
        return;
      }
      if (!['0', '1', '2', '3'].includes(String(correctAnswer))) {
        showInternalAlert('يرجى تحديد إجابة صحيحة واحدة فقط.', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      const teacherBranchId = resolvedTeacher?.branch_id != null ? String(resolvedTeacher.branch_id) : '';
      const teacherSubjectId = resolvedTeacher?.subject_id != null ? String(resolvedTeacher.subject_id) : '';

      if (teacherBranchId && String(selectedBranch) !== teacherBranchId) {
        throw new Error('لا يمكن إضافة سؤال خارج فرع الموظف المحدد.');
      }
      if (teacherSubjectId && String(selectedSubject) !== teacherSubjectId) {
        throw new Error('لا يمكن إضافة سؤال خارج مادة الموظف المحددة.');
      }

      if (questionType === 'completion' && !String(correctAnswer || '').trim()) {
        throw new Error('يرجى إدخال الإجابة الصحيحة لسؤال الإكمال.');
      }

      if (questionType === 'essay') {
        const acceptedEssayAnswers = essayCorrectAnswers
          .map((answer) => String(answer || '').trim())
          .filter(Boolean);

        if (acceptedEssayAnswers.length === 0) {
          throw new Error('يرجى إدخال إجابة صحيحة واحدة على الأقل للسؤال المقالي.');
        }
      }

      let finalImageUrl = imageUrl.trim() || null;
      if (imageFile) {
        finalImageUrl = await uploadQuestionImage(imageFile);
      }

      const questionData = {
        branch_id: parseInt(selectedBranch),
        subject_id: parseInt(selectedSubject),
        unit_number: parseInt(selectedUnitNumber),
        question_type: questionType,
        image_url: finalImageUrl,
        question_text: questionText,
        mark: parseFloat(mark) || 1.0,
        points: parseFloat(mark) || 1.0,
        difficulty_level: difficultyLevel,
        options:
          questionType === 'mcq'
            ? options
            : questionType === 'true_false'
            ? ['صح', 'خطأ']
            : null,

        // المقالي: نحفظ كل الإجابات المقبولة كـ JSON.
        correct_answer:
          questionType === 'essay'
            ? JSON.stringify(
                essayCorrectAnswers
                  .map((answer) => String(answer || '').trim())
                  .filter(Boolean)
              )
            : correctAnswer
      };

      const { error } = await supabase
        .from('questions')
        .insert([questionData]);

      if (error) throw error;

      showInternalAlert('تم حفظ السؤال في بنك الأسئلة بنجاح! 🎉', 'success');
      
      setQuestionText('');
      setImageUrl('');
      setImageFile(null);
      setImagePreview('');
      setOptions(['', '', '', '']);
      setCorrectAnswer('0');
      setEssayCorrectAnswers(['', '', '', '']);
      setMark('1.0');
      setDifficultyLevel('متوسط');

    } catch (error) {
      console.error("Supabase Insert Error:", error);
      showInternalAlert('خطأ أثناء حفظ السؤال: ' + (error.message || JSON.stringify(error)), 'error');
    } finally {
      setLoading(false);
    }
  };

  const generalInputStyle = {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'rgba(255,255,255,.97)',
    color: '#0b2450',
    border: '2px solid #4cc9ff',
    borderRadius: '12px',
    fontSize: '17px',
    fontWeight: '700',
    outline: 'none',
    boxSizing: 'border-box'
  };

  return (
    <div style={{ background: 'linear-gradient(145deg,#071b3a 0%,#0b2b63 52%,#06162f 100%)', border: '1px solid rgba(96,165,250,.45)', borderRadius: '24px', padding: '28px', maxWidth: '1100px', margin: '20px auto', color: '#f8fbff', direction: 'rtl', boxShadow: '0 20px 60px rgba(0,0,0,.35)', boxSizing: 'border-box' }}>
      
      <style>{`
        .edge-fix-select {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 2px solid #3b82f6 !important;
          padding: 14px 16px !important;
          border-radius: 6px !important;
          font-size: 19px !important;
          font-weight: bold !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .edge-fix-select option {
          background-color: #ffffff !important;
          color: #0f172a !important;
          font-weight: bold !important;
          font-size: 17px !important;
          padding: 10px !important;
        }
        .edge-type-select {
          background-color: #ffffff !important;
          color: #047857 !important;
          border: 2px solid #059669 !important;
          padding: 14px 16px !important;
          border-radius: 6px !important;
          font-size: 19px !important;
          font-weight: 800 !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .edge-type-select option {
          background-color: #ffffff !important;
          color: #047857 !important;
          font-weight: bold !important;
          font-size: 17px !important;
        }
        .edge-mark-wrapper {
          display: flex;
          align-items: center;
          background-color: #ffffff;
          border: 2px solid #3b82f6;
          border-radius: 6px;
          overflow: hidden;
          box-sizing: border-box;
          width: 100%;
        }
        .edge-mark-input {
          background-color: transparent !important;
          color: #0f172a !important;
          border: none !important;
          padding: 12px 14px !important;
          font-size: 20px !important;
          font-weight: 800 !important;
          width: 100% !important;
          outline: none !important;
          direction: ltr !important;
          text-align: center !important;
          font-family: Arial, Helvetica, sans-serif !important;
        }
        .edge-arrows-container {
          display: flex;
          flex-direction: column;
          border-left: 2px solid #cbd5e1;
          background-color: #f1f5f9;
        }
        .edge-arrow-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: bold;
          color: #334155;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .edge-arrow-btn:hover {
          background-color: #e2e8f0;
          color: #1d4ed8;
        }

        /* رسائل العمليات — نافذة مركزية بنفس ستايل إدارة الموظفين */
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
          margin: 0 !important;
          background: rgba(2, 6, 23, .74) !important;
          backdrop-filter: blur(5px);
          overflow: auto !important;
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
          padding: 24px !important;
        }

        .employee-message-modal {
          align-items: center !important;
          justify-content: center !important;
        }

        .employee-message-modal .employee-modal-box {
          flex: 0 1 auto !important;
          transform: translateY(0) !important;
        }
        .addq-card {
          background: linear-gradient(135deg, rgba(9,35,78,.96), rgba(10,53,112,.82)) !important;
          border: 1px solid rgba(56,189,248,.42) !important;
          border-radius: 18px !important;
          box-shadow: 0 10px 30px rgba(0,0,0,.16) !important;
        }
        .addq-label { color:#b9f3ff !important; font-weight:900 !important; font-size:16px !important; }
        .addq-section-title { color:#67e8f9 !important; font-weight:900 !important; }
        .addq-input, .addq-input:focus, .addq-select, .addq-select:focus {
          background:#f8fbff !important; color:#09244e !important; border:2px solid #43c6ff !important;
          border-radius:12px !important; box-shadow:0 0 0 3px rgba(56,189,248,.08) !important; outline:none !important;
        }
        .addq-input:focus, .addq-select:focus { border-color:#22d3ee !important; box-shadow:0 0 0 4px rgba(34,211,238,.16) !important; }
        .addq-primary { background:linear-gradient(135deg,#168cff,#22c7ff) !important; box-shadow:0 10px 25px rgba(14,165,233,.28) !important; }
        .addq-primary:hover { transform:translateY(-1px); filter:brightness(1.06); }
        @media (max-width: 760px) {
          .addq-grid-3, .addq-grid-2, .addq-options-grid { grid-template-columns:1fr !important; }
          .essay-answers-grid { grid-template-columns:1fr !important; }
        }

`}
</style>

      <h3 style={{ fontSize: '26px', marginBottom: '22px', color: '#67e8f9', borderBottom: '2px solid #38bdf8', paddingBottom: '14px', fontWeight: 900, textAlign: 'center', textShadow: '0 2px 12px rgba(34,211,238,.18)' }}>
        إضافة سؤال جديد إلى بنك الأسئلة
      </h3>

      {feedbackMessage.text && (
        <div
          className="employee-modal employee-message-modal"
          onClick={() => setFeedbackMessage({ text: '', type: '' })}
        >
          <div
            className="employee-modal-box"
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: 460,
              textAlign: 'center',
              borderColor:
                feedbackMessage.type === 'error'
                  ? 'rgba(239,68,68,.65)'
                  : feedbackMessage.type === 'warning'
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
              {feedbackMessage.type === 'error'
                ? '⚠️'
                : feedbackMessage.type === 'warning'
                ? '⛔'
                : '✅'}
            </div>

            <div
              style={{
                fontSize: 16,
                fontWeight: 900,
                lineHeight: 1.8,
                color: '#f8fafc'
              }}
            >
              {feedbackMessage.text}
            </div>

            <button
              type="button"
              onClick={() => setFeedbackMessage({ text: '', type: '' })}
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

      <form onSubmit={handleAddQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* الفلاتر */}
        <div className="addq-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div>
             <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '600', color: '#b9f3ff' }}>الفرع :</label>
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
               className="edge-fix-select addq-select"
               style={{ width: '100%', boxSizing: 'border-box' }}
             />
           </div>

           <div>
             <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '600', color: '#b9f3ff' }}>المادة :</label>
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
               className="edge-fix-select addq-select"
               style={{ width: '100%', boxSizing: 'border-box' }}
             />
           </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '600', color: '#b9f3ff' }}>اختر رقم الوحدة:</label>
            <select className="edge-fix-select addq-select" value={selectedUnitNumber} onChange={(e) => setSelectedUnitNumber(e.target.value)} disabled={!selectedSubject} style={{ opacity: selectedSubject ? 1 : 0.5 }}>
              <option value="">-- اختر الوحدة --</option>
              {units.map((u, index) => {
                const uNum = u.unit_number || u.order || (index + 1);
                return (
                  <option key={u.id || index} value={uNum}>
                    {`الوحدة ${uNum}: ${u.name || u.unit_name || ''}`}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* نوع السؤال والدرجة */}
        <div className="addq-card addq-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '20px', padding: '18px', borderRadius: '18px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '600' }}>نوع السؤال:</label>
            <select className="edge-type-select addq-select" value={questionType} onChange={(e) => handleTypeChange(e.target.value)}>
              <option value="mcq">اختيار من متعدد (MCQ)</option>
              <option value="true_false">صح وخطأ</option>
              <option value="completion">إكمال</option>
              <option value="essay">مقالي</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '600', color: '#b9f3ff' }}>مستوى السؤال:</label>
            <select
              className="edge-type-select addq-select"
              value={difficultyLevel}
              onChange={(e) => setDifficultyLevel(e.target.value)}
            >
              <option value="سهل">سهل</option>
              <option value="متوسط">متوسط</option>
              <option value="صعب">صعب</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '600', color: '#b9f3ff' }}>الدرجة / العلامة:</label>
            <div className="edge-mark-wrapper">
              <div className="edge-arrows-container">
                <button type="button" className="edge-arrow-btn" onClick={() => handleMarkChange('up')}>▲</button>
                <button type="button" className="edge-arrow-btn" onClick={() => handleMarkChange('down')} style={{ borderTop: '1px solid #cbd5e1' }}>▼</button>
              </div>
              <input 
                type="text" 
                inputMode="decimal"
                className="edge-mark-input"
                value={mark} 
                onChange={(e) => setMark(e.target.value.replace(/[^0-9.]/g, ''))} 
                onBlur={(e) => {
                  const val = parseFloat(e.target.value);
                  setMark(!isNaN(val) ? val.toFixed(1) : '1.0');
                }}
              />
            </div>
          </div>
        </div>

        {/* صورة السؤال: رفع من الجهاز */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '600' }}>
            صورة السؤال (اختياري):
          </label>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            flexWrap: 'wrap',
            padding: '16px',
            borderRadius: '16px',
            background: 'rgba(15,23,42,.45)',
            border: '1px solid rgba(148,163,184,.25)'
          }}>
            <label
              style={{
                width: '190px',
                height: '125px',
                borderRadius: '14px',
                border: '2px dashed #60a5fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                cursor: 'pointer',
                background: '#f8fafc',
                color: '#64748b',
                position: 'relative'
              }}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="معاينة صورة السؤال"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ fontWeight: 800 }}>صورة السؤال</span>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleQuestionImageChange}
                hidden
              />
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{
                display: 'inline-flex',
                width: 'fit-content',
                padding: '12px 20px',
                borderRadius: '10px',
                background: '#2563eb',
                color: '#fff',
                fontWeight: 800,
                cursor: 'pointer'
              }}>
                رفع صورة السؤال
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleQuestionImageChange}
                  hidden
                />
              </label>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                JPG أو PNG أو WEBP أو GIF — حتى 8MB
              </span>
              {imageFile && (
                <span style={{ color: '#cbd5e1', fontSize: '13px' }}>{imageFile.name}</span>
              )}
            </div>
          </div>
        </div>

        {/* نص السؤال */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '600' }}>نص السؤال:</label>
          <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows="4" placeholder="اكتب نص السؤال هنا..." className="addq-input" style={{ ...generalInputStyle, fontSize: '18px', lineHeight: '1.7', resize: 'vertical', minHeight: '130px' }} />
        </div>

        {/* خيارات MCQ */}
        {questionType === 'mcq' && (
          <div className="addq-card" style={{ padding: '18px', borderRadius: '18px' }}>
            <label style={{ display: 'block', marginBottom: '12px', fontSize: '16px', color: '#67e8f9', fontWeight: 'bold' }}>خيارات الإجابة:</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {options.map((opt, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="radio" name="correctOpt" style={{ transform: 'scale(1.3)' }} checked={correctAnswer === idx.toString()} onChange={() => setCorrectAnswer(idx.toString())} />
                  <span style={{ backgroundColor: '#334155', color: '#ffffff', padding: '12px 14px', borderRadius: '6px', fontSize: '15px', whiteSpace: 'nowrap', fontWeight: '700', border: '1px solid #475569' }}>
                    الخيار {idx + 1}
                  </span>
                  <input type="text" value={opt} onChange={(e) => handleOptionChange(idx, e.target.value)} placeholder={`أدخل نص الخيار ${idx + 1}`} className="addq-input" style={generalInputStyle} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* صح وخطأ */}
        {questionType === 'true_false' && (
          <div className="addq-card" style={{ padding: '18px', borderRadius: '18px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '16px', color: '#67e8f9', fontWeight: 'bold' }}>الإجابة الصحيحة:</label>
            <div style={{ display: 'flex', gap: '30px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '18px', fontWeight: '750' }}>
                <input type="radio" name="tfAnswer" style={{ transform: 'scale(1.3)' }} checked={correctAnswer === 'true'} onChange={() => setCorrectAnswer('true')} /> صح
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '18px', fontWeight: '750' }}>
                <input type="radio" name="tfAnswer" style={{ transform: 'scale(1.3)' }} checked={correctAnswer === 'false'} onChange={() => setCorrectAnswer('false')} /> خطأ
              </label>
            </div>
          </div>
        )}

        {/* إكمال */}
        {questionType === 'completion' && (
          <div className="addq-card" style={{ padding: '18px', borderRadius: '18px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '16px', color: '#67e8f9', fontWeight: 'bold' }}>الإجابة النموذجية للفراغ:</label>
            <input type="text" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} placeholder="اكتب الإجابة الصحيحة للفراغ..." className="addq-input" style={generalInputStyle} />
          </div>
        )}

        {/* مقالي */}
        {questionType === 'essay' && (
          <div className="addq-card" style={{ padding: '18px', borderRadius: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
              <label style={{ fontSize: '18px', color: '#67e8f9', fontWeight: 900 }}>
                الإجابات الصحيحة المقبولة للسؤال المقالي
              </label>
              <span style={{
                background: 'rgba(34,211,238,.12)',
                border: '1px solid rgba(103,232,249,.35)',
                color: '#cffafe',
                borderRadius: '999px',
                padding: '5px 10px',
                fontSize: '13px',
                fontWeight: 800
              }}>
                حتى 4 إجابات
              </span>
            </div>

            <p style={{ fontSize: '14px', color: '#cbd5e1', margin: '0 0 14px', lineHeight: 1.8 }}>
              أدخل الإجابة المقبولة في أي خانة. ليس مطلوباً تعبئة الخانات الأربع؛ كل إجابة تكتبها تعتبر صحيحة للطالب.
            </p>

            <div className="essay-answers-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {essayCorrectAnswers.map((answer, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    minWidth: '42px',
                    height: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg,#0ea5e9,#2563eb)',
                    color: '#fff',
                    fontWeight: 900
                  }}>
                    {index + 1}
                  </span>

                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => handleEssayAnswerChange(index, e.target.value)}
                    placeholder={`الإجابة الصحيحة ${index + 1} (اختياري)`}
                    className="addq-input"
                    style={generalInputStyle}
                  />
                </div>
              ))}
            </div>

            <div style={{
              marginTop: '14px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(15,23,42,.42)',
              border: '1px solid rgba(148,163,184,.22)',
              color: '#e2e8f0',
              fontSize: '13px',
              lineHeight: 1.8
            }}>
              💡 مثال: إذا كانت الإجابات المقبولة «القلب»، «عضلة القلب»، «Cardiac muscle»، فيكفي إدخال هذه الإجابات في 3 خانات فقط.
            </div>
          </div>
        )}

        <button type="submit" disabled={loading} className="addq-primary" style={{ padding: '16px', backgroundColor: loading ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '18px', marginTop: '10px', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'جاري الحفظ...' : 'حفظ السؤال في البنك'}
        </button>
      </form>
    </div>
  );
}