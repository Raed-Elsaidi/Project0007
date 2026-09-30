import React, { useState, useEffect } from 'react';

export default function ManageQuestion({ supabase, styles, showAlertMessage, teacher }) {
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [units, setUnits] = useState([]);

  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedUnitNumber, setSelectedUnitNumber] = useState('all');
  const [questionType, setQuestionType] = useState('');

  const [questions, setQuestions] = useState([]);
  const [totalSubjectQuestionsCount, setTotalSubjectQuestionsCount] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [showModalSuccess, setShowModalSuccess] = useState(false);

  const [resolvedTeacher, setResolvedTeacher] = useState(teacher || null);
  const [teacherReady, setTeacherReady] = useState(false);

  // حالات نافذة التعديل المنبثقة (Modal)
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editText, setEditText] = useState('');
  const [editScore, setEditScore] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState('');
  const [editDifficultyLevel, setEditDifficultyLevel] = useState('متوسط');
  const [editQuestionType, setEditQuestionType] = useState('mcq');
  
  // الخيارات الـ 4 والإجابة الصحيحة عبر الـ Radio
  const [option1, setOption1] = useState('');
  const [option2, setOption2] = useState('');
  const [option3, setOption3] = useState('');
  const [option4, setOption4] = useState('');
  const [correctOptionIndex, setCorrectOptionIndex] = useState('');
  const [trueFalseAnswer, setTrueFalseAnswer] = useState('true');
  const [textAnswer, setTextAnswer] = useState('');
  const [essayCorrectAnswers, setEssayCorrectAnswers] = useState(['', '', '', '']);

  // حالات نافذة تأكيد الحذف المنبثقة (Delete Modal)
  const [questionToDelete, setQuestionToDelete] = useState(null);

  const showMsg = (msg, type) => {
    if (typeof showAlertMessage === 'function') {
      showAlertMessage(msg, type);
    } else {
      console.log(`[${type}] ${msg}`);
    }
  };

  // تحميل فرع ومادة الموظف الحاليين تلقائياً من employees.
  // يبقى هناك fallback للـ supervisors/teachers القديمة حتى لا تتعطل البيانات القديمة.
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

      // المصدر الأساسي الآن هو employees.
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

      // توافق مع السجلات القديمة فقط إذا لم نجد الموظف في employees.
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

      // إذا كانت المادة محفوظة بالاسم/التخصص فقط، استخرج ID المادة من نفس الفرع.
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

  // جلب الأسئلة وحساب العدد الإجمالي للمادة بدقة بناءً على المادة المختارة
  const fetchQuestions = async () => {
    if (!teacherReady || !selectedBranch || !selectedSubject || !selectedUnitNumber) {
      showMsg('لا توجد بيانات فرع ومادة للمعلم أو لم يتم تحميلها بعد', 'error');
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
    
    // 1. جلب إجمالي الأسئلة الخاصة بهذه المادة حصرياً للتأكد من دقة العداد للمادة الصحيحة
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

    // 2. جلب الأسئلة المطابقة للوحدة والمادة
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

  // فتح نافذة التعديل وتعبئة البيانات الحالية للسؤال
  const handleOpenEdit = (q) => {
    setShowModalSuccess(false);
    setEditingQuestion(q);
    setEditText(q.question_text || q.text || '');
    setEditScore(q.points !== undefined && q.points !== null ? q.points : (q.mark !== undefined && q.mark !== null ? q.mark : ''));
    setEditImage(q.image_url || q.image || '');
    setEditImageFile(null);
    setEditImagePreview(q.image_url || q.image || '');
    setEditDifficultyLevel(q.difficulty_level || 'متوسط');
    
    // توحيد الأنواع القديمة: text يُعرض الآن كـ "أكمل الفراغ".
    const rawQType = q.question_type || 'mcq';
    const qType = rawQType === 'text' || rawQType === 'complete' || rawQType === 'fill_in_blank'
      ? 'completion'
      : rawQType;
    setEditQuestionType(qType);
    setEssayCorrectAnswers(['', '', '', '']);
    
    let opts = q.options || [];
    if (typeof opts === 'string') {
      try {
        opts = JSON.parse(opts);
      } catch (e) {
        opts = opts.split(',').map(item => item.trim());
      }
    }
    
    if (qType === 'mcq') {
      setOption1(opts[0] || '');
      setOption2(opts[1] || '');
      setOption3(opts[2] || '');
      setOption4(opts[3] || '');

      const rawCorrect = String(q.correct_answer ?? '').trim();
      let normalizedIndex = '';

      // النسخة الجديدة تخزن رقم الفهرس 0..3 فقط.
      if (/^[0-3]$/.test(rawCorrect)) {
        normalizedIndex = rawCorrect;
      } else {
        // توافق مع البيانات القديمة التي كانت تخزن النص أو 1..4.
        const numeric = Number(rawCorrect);
        if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 4) {
          normalizedIndex = String(numeric - 1);
        } else {
          const byText = opts.findIndex((opt) => String(opt).trim() === rawCorrect);
          if (byText >= 0) normalizedIndex = String(byText);
        }
      }

      setCorrectOptionIndex(normalizedIndex);
    } else if (qType === 'true_false') {
      setTrueFalseAnswer(q.correct_answer || 'true');
    } else if (qType === 'completion') {
      setTextAnswer(q.correct_answer || '');
    } else if (qType === 'essay') {
      let accepted = [];
      try {
        const parsed = JSON.parse(q.correct_answer || '[]');
        accepted = Array.isArray(parsed) ? parsed : [String(q.correct_answer || '')];
      } catch {
        accepted = q.correct_answer ? [String(q.correct_answer)] : [];
      }
      setEssayCorrectAnswers([
        accepted[0] || '',
        accepted[1] || '',
        accepted[2] || '',
        accepted[3] || ''
      ]);
    }
  };

  const handleEditQuestionImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    setEditImageFile(file);
    if (file) {
      setEditImagePreview(URL.createObjectURL(file));
    } else {
      setEditImagePreview(editImage || '');
    }
  };

  const uploadEditedQuestionImage = async (file) => {
    if (!file) return editImage || null;

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

  // حفظ التعديلات وإغلاق الفورم بعد 3 ثوانٍ من ظهور رسالة النجاح
  const handleUpdateQuestion = async (e) => {
    e.preventDefault();
    if (!editingQuestion) return;

    const questionId = editingQuestion.id;
    const teacherBranchId = resolvedTeacher?.branch_id != null ? String(resolvedTeacher.branch_id) : '';
    const teacherSubjectId = resolvedTeacher?.subject_id != null ? String(resolvedTeacher.subject_id) : '';

    if (!teacherBranchId || !teacherSubjectId) {
      showMsg('بيانات فرع ومادة المعلم غير متوفرة', 'error');
      return;
    }

    if (!questionId) {
      showMsg('خطأ: معرف السؤال (ID) غير متاح للتحديث', 'error');
      return;
    }

    const parsedScore = parseFloat(editScore);
    let optionsArray = [];
    let finalCorrectAnswer = '';

    if (editQuestionType === 'mcq') {
      optionsArray = [option1, option2, option3, option4].map((v) => String(v || '').trim());
      if (optionsArray.some((v) => !v)) {
        showMsg('يرجى تعبئة الخيارات الأربعة كلها.', 'error');
        return;
      }
      if (!['0', '1', '2', '3'].includes(String(correctOptionIndex))) {
        showMsg('يرجى تحديد إجابة صحيحة واحدة فقط.', 'error');
        return;
      }
      finalCorrectAnswer = String(correctOptionIndex);
    } else if (editQuestionType === 'true_false') {
      optionsArray = ['صح', 'خطأ'];
      finalCorrectAnswer = trueFalseAnswer;
    } else if (editQuestionType === 'completion') {
      optionsArray = [];
      finalCorrectAnswer = textAnswer;
    } else if (editQuestionType === 'essay') {
      const acceptedEssayAnswers = essayCorrectAnswers
        .map((answer) => String(answer || '').trim())
        .filter(Boolean)
        .slice(0, 4);

      if (acceptedEssayAnswers.length === 0) {
        showMsg('يرجى إدخال إجابة صحيحة واحدة على الأقل للسؤال المقالي', 'error');
        return;
      }

      optionsArray = acceptedEssayAnswers;
      finalCorrectAnswer = JSON.stringify(acceptedEssayAnswers);
    }

    let finalEditImage = editImage || null;
    if (editImageFile) {
      finalEditImage = await uploadEditedQuestionImage(editImageFile);
    }

    const updatePayload = {
      question_text: editText,
      question_type: editQuestionType,
      correct_answer: finalCorrectAnswer,
      points: isNaN(parsedScore) ? 0 : parsedScore,
      options: optionsArray,
      image_url: finalEditImage,
      difficulty_level: editDifficultyLevel || 'متوسط'
    };

    const { data, error } = await supabase
      .from('questions')
      .update(updatePayload)
      .eq('id', questionId)
      .eq('branch_id', teacherBranchId)
      .eq('subject_id', teacherSubjectId)
      .select();

    if (error) {
      console.error('Supabase update error details:', error);
      showMsg('فشل الحفظ من قاعدة البيانات: ' + error.message, 'error');
    } else {
      setShowModalSuccess(true);
      showMsg('تم تعديل وحفظ السؤال بنجاح', 'success');
      
      setTimeout(() => {
        setShowModalSuccess(false);
        setEditingQuestion(null); 
        fetchQuestions(); 
      }, 3000);
    }
  };

  // تأكيد وحذف السؤال فعلياً من قاعدة البيانات
  const confirmDelete = async () => {
    if (!questionToDelete) return;

    const teacherBranchId = resolvedTeacher?.branch_id != null ? String(resolvedTeacher.branch_id) : '';
    const teacherSubjectId = resolvedTeacher?.subject_id != null ? String(resolvedTeacher.subject_id) : '';

    if (!teacherBranchId || !teacherSubjectId) {
      showMsg('بيانات فرع ومادة المعلم غير متوفرة', 'error');
      setQuestionToDelete(null);
      return;
    }

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionToDelete.id)
      .eq('branch_id', teacherBranchId)
      .eq('subject_id', teacherSubjectId);
    if (error) {
      showMsg('خطأ في الحذف: ' + error.message, 'error');
    } else {
      showMsg('تم حذف السؤال بنجاح', 'success');
      setQuestions(questions.filter(q => q.id !== questionToDelete.id));
    }
    setQuestionToDelete(null); 
  };

  // جلب اسم المادة والوحدة المختارة للعرض النصي التوضيحي
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
        ⚙️ إدارة، تعديل وحذف الأسئلة
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
              <option value="completion">أكمل الفراغ</option>
              <option value="essay">مقالي</option>
            </select>
          </div>

        </div>

        <button onClick={fetchQuestions} style={{ width: '100%', padding: '14px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '18px' }}>
          عرض الأسئلة المطابقة
        </button>
      </div>

      {/* نافذة التعديل المنبثقة (Modal) */}
      {editingQuestion && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '30px', borderRadius: '10px', width: '650px', border: '2px solid #3b82f6', color: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>
            <h4 style={{ color: '#60a5fa', marginBottom: '20px', fontSize: '20px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>✏️ تعديل السؤال</h4>
            
            {showModalSuccess && (
              <div style={{ backgroundColor: '#065f46', color: '#d1fae5', padding: '16px 20px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold', border: '2px solid #10b981', fontSize: '19px' }}>
                ✨ تم تعديل وحفظ السؤال بنجاح!
              </div>
            )}

            <form onSubmit={handleUpdateQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', color: '#93c5fd', fontWeight: 'bold' }}>نوع السؤال:</label>
                  <select 
                    value={editQuestionType} 
                    onChange={(e) => setEditQuestionType(e.target.value)} 
                    style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #64748b', backgroundColor: '#1e293b', color: '#fff', fontSize: '16px', boxSizing: 'border-box' }}
                  >
                    <option value="mcq">اختيار من متعدد</option>
                    <option value="true_false">صح وخطأ</option>
                    <option value="completion">أكمل الفراغ</option>
                    <option value="essay">مقالي</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', color: '#93c5fd', fontWeight: 'bold' }}>صورة السؤال (اختياري):</label>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    flexWrap: 'wrap',
                    padding: '10px',
                    borderRadius: '12px',
                    border: '1px solid #334155',
                    background: '#0f172a'
                  }}>
                    <label style={{
                      width: '120px',
                      height: '82px',
                      borderRadius: '10px',
                      border: '2px dashed #60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: '#f8fafc',
                      color: '#64748b'
                    }}>
                      {editImagePreview ? (
                        <img
                          src={editImagePreview}
                          alt="معاينة صورة السؤال"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <span style={{ fontWeight: 800, fontSize: '12px' }}>صورة السؤال</span>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleEditQuestionImageChange}
                        hidden
                      />
                    </label>
                    <label style={{
                      display: 'inline-flex',
                      padding: '9px 14px',
                      borderRadius: '9px',
                      background: '#2563eb',
                      color: '#fff',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}>
                      تغيير الصورة
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleEditQuestionImageChange}
                        hidden
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', color: '#93c5fd', fontWeight: 'bold' }}>العلامة:</label>
                  <input type="number" step="0.5" value={editScore} onChange={(e) => setEditScore(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #64748b', backgroundColor: '#1e293b', color: '#fff', fontSize: '16px', boxSizing: 'border-box' }} required />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#93c5fd', fontWeight: 'bold' }}>نص السؤال:</label>
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows="3" style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #64748b', backgroundColor: '#1e293b', color: '#fff', fontSize: '16px', boxSizing: 'border-box' }} required />
              </div>

              {/* تخصيص الخيارات بناءً على نوع السؤال */}
              {editQuestionType === 'mcq' && (
                <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <label style={{ display: 'block', marginBottom: '12px', color: '#60a5fa', fontWeight: 'bold', fontSize: '16px' }}>الخيارات (اختر زر الـ Radio لتحديد الإجابة الصحيحة):</label>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ fontSize: '14px', color: '#93c5fd', fontWeight: 'bold' }}>خيار 1:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="radio" name="correctAnswerRadio" checked={correctOptionIndex === '0'} onChange={() => setCorrectOptionIndex('0')} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                        <input type="text" value={option1} onChange={(e) => setOption1(e.target.value)} placeholder="نص الخيار الأول" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #64748b', backgroundColor: '#0f172a', color: '#fff', fontSize: '15px' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ fontSize: '14px', color: '#93c5fd', fontWeight: 'bold' }}>خيار 2:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="radio" name="correctAnswerRadio" checked={correctOptionIndex === '1'} onChange={() => setCorrectOptionIndex('1')} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                        <input type="text" value={option2} onChange={(e) => setOption2(e.target.value)} placeholder="نص الخيار الثاني" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #64748b', backgroundColor: '#0f172a', color: '#fff', fontSize: '15px' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ fontSize: '14px', color: '#93c5fd', fontWeight: 'bold' }}>خيار 3:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="radio" name="correctAnswerRadio" checked={correctOptionIndex === '2'} onChange={() => setCorrectOptionIndex('2')} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                        <input type="text" value={option3} onChange={(e) => setOption3(e.target.value)} placeholder="نص الخيار الثالث" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #64748b', backgroundColor: '#0f172a', color: '#fff', fontSize: '15px' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ fontSize: '14px', color: '#93c5fd', fontWeight: 'bold' }}>خيار 4:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="radio" name="correctAnswerRadio" checked={correctOptionIndex === '3'} onChange={() => setCorrectOptionIndex('3')} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                        <input type="text" value={option4} onChange={(e) => setOption4(e.target.value)} placeholder="نص الخيار الرابع" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #64748b', backgroundColor: '#0f172a', color: '#fff', fontSize: '15px' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {editQuestionType === 'true_false' && (
                <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <label style={{ display: 'block', marginBottom: '10px', color: '#60a5fa', fontWeight: 'bold', fontSize: '16px' }}>حدد الإجابة الصحيحة:</label>
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '16px' }}>
                      <input type="radio" name="tfAnswer" value="true" checked={trueFalseAnswer === 'true'} onChange={() => setTrueFalseAnswer('true')} style={{ width: '18px', height: '18px' }} />
                      صح
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '16px' }}>
                      <input type="radio" name="tfAnswer" value="false" checked={trueFalseAnswer === 'false'} onChange={() => setTrueFalseAnswer('false')} style={{ width: '18px', height: '18px' }} />
                      خطأ
                    </label>
                  </div>
                </div>
              )}

              {editQuestionType === 'completion' && (
                <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#60a5fa', fontWeight: 'bold', fontSize: '16px' }}>الإجابة الصحيحة:</label>
                  <input type="text" value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} placeholder="أدخل الإجابة الصحيحة..." style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #64748b', backgroundColor: '#0f172a', color: '#fff', fontSize: '15px', boxSizing: 'border-box' }} />
                </div>
              )}

              {editQuestionType === 'essay' && (
                <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <label style={{ display: 'block', marginBottom: '12px', color: '#f472b6', fontWeight: 'bold', fontSize: '16px' }}>
                    الإجابات الصحيحة المقبولة (حتى 4 إجابات):
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {essayCorrectAnswers.map((answer, index) => (
                      <div key={index}>
                        <label style={{ display: 'block', marginBottom: '5px', color: '#cbd5e1', fontSize: '13px', fontWeight: 'bold' }}>
                          إجابة صحيحة {index + 1} {index === 0 ? '(مطلوبة)' : '(اختيارية)'}
                        </label>
                        <input
                          type="text"
                          value={answer}
                          onChange={(e) => {
                            const next = [...essayCorrectAnswers];
                            next[index] = e.target.value;
                            setEssayCorrectAnswers(next);
                          }}
                          placeholder={`الإجابة الصحيحة ${index + 1}`}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #64748b', backgroundColor: '#0f172a', color: '#fff', fontSize: '15px', boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '10px', color: '#94a3b8', fontSize: '13px' }}>
                    يكفي إدخال إجابة صحيحة واحدة، وأي إجابة من الإجابات المدخلة تُعتبر صحيحة.
                  </div>
                </div>
              )}

              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: '#fbbf24', fontWeight: 'bold' }}>مستوى صعوبة السؤال:</label>
                <select value={editDifficultyLevel} onChange={(e) => setEditDifficultyLevel(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #64748b', backgroundColor: '#1e293b', color: '#fff', fontSize: '16px', boxSizing: 'border-box' }}>
                  <option value="سهل">سهل</option>
                  <option value="متوسط">متوسط</option>
                  <option value="صعب">صعب</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                <button type="submit" style={{ flex: 1, padding: '14px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '17px' }}>حفظ التعديلات</button>
                <button type="button" onClick={() => setEditingQuestion(null)} style={{ flex: 1, padding: '14px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '17px' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تأكيد الحذف المنبثقة */}
      {questionToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '30px', borderRadius: '10px', width: '400px', border: '2px solid #dc2626', color: '#fff', textAlign: 'center' }}>
            <h4 style={{ color: '#f87171', marginBottom: '15px', fontSize: '20px' }}>⚠️ تأكيد الحذف</h4>
            <p style={{ fontSize: '16px', color: '#cbd5e1', marginBottom: '25px' }}>هل أنت متأكد من رغبتك في حذف هذا السؤال؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={confirmDelete} style={{ flex: 1, padding: '12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
                نعم، احذف
              </button>
              <button onClick={() => setQuestionToDelete(null)} style={{ flex: 1, padding: '12px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* عرض تفاصيل أعداد الأسئلة قبل القائمة */}
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
      ) : questions.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '16px', padding: '20px' }}>لا توجد أسئلة مسجلة لهذه التصفية حتى الآن.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {questions.map((q, index) => {
            let opts = q.options || [];
            if (typeof opts === 'string') {
              try { opts = JSON.parse(opts); } catch (e) { opts = opts.split(',').map(item => item.trim()); }
            }

            const qTypeLabel =
              q.question_type === 'true_false'
                ? 'صح وخطأ'
                : q.question_type === 'completion'
                ? 'إكمال'
                : q.question_type === 'essay'
                ? 'مقالي'
                : (q.question_type === 'text' || q.question_type === 'complete' || q.question_type === 'fill_in_blank')
                ? 'أكمل الفراغ'
                : 'اختيار من متعدد';

            return (
              <div key={q.id} style={{ backgroundColor: '#0f172a', padding: '18px 20px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, marginLeft: '20px' }}>
                  <p style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '10px', color: '#fff' }}>
                    {index + 1}. {q.question_text || q.text}
                  </p>
                  
                  {/* عرض الصورة إذا وجدت */}
                  {(q.image_url || q.image) && (
                    <div style={{ marginBottom: '10px' }}>
                      <img src={q.image_url || q.image} alt="Question Visual" style={{ width: '90px', height: '65px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #475569' }} />
                    </div>
                  )}

                  {/* عرض الخيارات أو الإجابة حسب نوع السؤال */}
                  {q.question_type === 'mcq' && Array.isArray(opts) && opts.length > 0 && opts[0] !== '' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                      {opts.map((opt, i) => {
                        const correctValue = String(q.correct_answer ?? '').trim();
                        let storedCorrectIndex = '';

                        if (/^[0-3]$/.test(correctValue)) {
                          storedCorrectIndex = correctValue;
                        } else {
                          const numeric = Number(correctValue);
                          if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 4) {
                            storedCorrectIndex = String(numeric - 1);
                          } else if (String(opt).trim() === correctValue) {
                            storedCorrectIndex = String(i);
                          }
                        }

                        const isCorrect = storedCorrectIndex === String(i);

                        return (
                          <span
                            key={i}
                            style={{
                              fontSize: '14px',
                              color: isCorrect ? '#4ade80' : '#94a3b8',
                              fontWeight: isCorrect ? 'bold' : 'normal',
                              display: 'block'
                            }}
                          >
                            {i + 1}) {opt} {isCorrect && '✓ (الإجابة الصحيحة)'}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {q.question_type === 'true_false' && (
                    <div style={{ marginBottom: '10px', fontSize: '14px', color: '#4ade80', fontWeight: 'bold' }}>
                      الإجابة الصحيحة: {q.correct_answer === 'true' ? 'صح' : 'خطأ'}
                    </div>
                  )}

                  {(q.question_type === 'completion' || q.question_type === 'text' || q.question_type === 'complete' || q.question_type === 'fill_in_blank') && (
                    <div style={{ marginBottom: '10px', fontSize: '14px', color: '#4ade80', fontWeight: 'bold' }}>
                      الإجابة الصحيحة: {q.correct_answer}
                    </div>
                  )}

                  {q.question_type === 'essay' && (
                    <div style={{ marginBottom: '10px', fontSize: '14px', color: '#4ade80', fontWeight: 'bold' }}>
                      الإجابات الصحيحة المقبولة: {
                        (() => {
                          try {
                            const parsed = JSON.parse(q.correct_answer || '[]');
                            return Array.isArray(parsed) ? parsed.join(' • ') : q.correct_answer;
                          } catch {
                            return q.correct_answer || 'غير محددة';
                          }
                        })()
                      }
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '15px', fontSize: '13px', color: '#60a5fa' }}>
                    <span>العلامة: {q.points !== undefined && q.points !== null ? q.points : q.mark}</span>
                    <span>|</span>
                    <span>نوع السؤال: {qTypeLabel}</span><span>|</span><span>مستوى الصعوبة: {q.difficulty_level || 'متوسط'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', minWidth: '130px', justifyContent: 'flex-end' }}>
                  <button onClick={() => handleOpenEdit(q)} style={{ padding: '8px 16px', backgroundColor: '#ca8a04', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>تعديل</button>
                  <button onClick={() => setQuestionToDelete(q)} style={{ padding: '8px 16px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>حذف</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}