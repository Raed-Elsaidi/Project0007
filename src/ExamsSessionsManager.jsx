import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function ExamsSessionManager() {
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [units, setUnits] = useState([]);

  const [examTitle, setExamTitle] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [examDate, setExamDate] = useState('');
  const [examTime, setExamTime] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  
  const [questionTypeMode, setQuestionTypeMode] = useState('mandatory');
  const [customQuestionLabel, setCustomQuestionLabel] = useState('');

  const [allUnits, setAllUnits] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState([]);

  // حالات جديدة لإدارة وتجربة حفظ درجات الطلاب بناءً على القواعد الجديدة
  const [studentSeatingNumber, setStudentSeatingNumber] = useState('');
  const [baseScoreInput, setBaseScoreInput] = useState('');
  const [electiveQ1Input, setElectiveQ1Input] = useState('');
  const [electiveQ2Input, setElectiveQ2Input] = useState('');
  const [bonusScoreInput, setBonusScoreInput] = useState('');
  const [totalExamMarks, setTotalExamMarks] = useState(100);

  const [message, setMessage] = useState({ text: '', type: '' });

  const showTemporaryMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage({ text: '', type: '' });
    }, 3000);
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchSubjects(selectedBranch);
    } else {
      setSubjects([]);
      setSelectedSubject('');
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (selectedSubject) {
      fetchUnits(selectedSubject);
    } else {
      setUnits([]);
      setSelectedUnits([]);
    }
  }, [selectedSubject]);

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase.from('branches').select('*');
      if (error) throw error;
      if (data) setBranches(data);
    } catch (err) {
      console.error('Error fetching branches:', err);
    }
  };

  const fetchSubjects = async (branchId) => {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('branch_id', branchId);
      if (error) throw error;
      if (data) setSubjects(data);
    } catch (err) {
      console.error('Error fetching subjects:', err);
    }
  };

  const fetchUnits = async (subjectId) => {
    if (!subjectId) return; 
    
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('subject_id', subjectId);
      
      if (error) throw error;
      if (data) setUnits(data);
    } catch (err) {
      console.error('Error fetching units:', err);
    }
  };

  const handleUnitToggle = (unitNumber) => {
    if (selectedUnits.includes(unitNumber)) {
      setSelectedUnits(selectedUnits.filter(u => u !== unitNumber));
    } else {
      setSelectedUnits([...selectedUnits, unitNumber]);
    }
  };

  const handleSaveExam = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (!examTitle.trim() || !selectedBranch || !selectedSubject || !examDate || !examTime) {
      showTemporaryMessage('الرجاء تعبئة الحقول الأساسية وتاريخ ووقت الامتحان', 'error');
      return;
    }

    try {
      const { error } = await supabase.from('exams').insert([{
        title: examTitle.trim(),
        branch_id: selectedBranch,
        subject_id: selectedSubject,
        duration_minutes: parseInt(durationMinutes),
        question_count: parseInt(questionCount),
        exam_date: examDate,
        exam_time: examTime
      }]);

      if (error) throw error;

      showTemporaryMessage('تم إنشاء وإضافة الامتحان بنجاح!', 'success');
      setExamTitle('');
      setExamDate('');
      setExamTime('');
      setQuestionCount(10);
      setSelectedUnits([]);
    } catch (err) {
      console.error('Supabase Error:', err);
      showTemporaryMessage(`حدث خطأ: ${err.message || 'مشكلة في حفظ الامتحان'}`, 'error');
    }
  };

  // دالة احتساب وحفظ درجات الطالب في جدول submissions وفقاً للقواعد المعتمدة
  const handleSaveStudentSubmission = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (!studentSeatingNumber.trim()) {
      showTemporaryMessage('الرجاء إدخال رقم جلوس الطالب', 'error');
      return;
    }

    const base = parseFloat(baseScoreInput) || 0;
    const q1 = parseFloat(electiveQ1Input) || 0;
    const q2 = parseFloat(electiveQ2Input) || 0;
    const bonus = parseFloat(bonusScoreInput) || 0;
    const maxMarks = parseFloat(totalExamMarks) || 100;

    // 1. القسم الاختياري: اختيار العلامة الأعلى بين السؤالين (Math.max)
    const electiveSectionScore = Math.max(q1, q2);

    // 2. المجموع الأولي مع القسم الأساسي والاختياري والإضافي
    const rawTotal = base + electiveSectionScore + bonus;

    // 3. السقف النهائي: التأكد من عدم تجاوز العلامة الكلية (Math.min)
    const finalScore = Math.min(rawTotal, maxMarks);

    try {
      const { error } = await supabase.from('submissions').insert([{
        seating_number: studentSeatingNumber.trim(),
        exam_id: 1, // أو استبداله بمعرف الامتحان الفعلي الحالي إذا توفر
        base_score: base,
        elective_q1: q1,
        elective_q2: q2,
        bonus_score: bonus,
        final_score: finalScore,
        submitted_at: new Date().toISOString()
      }]);

      if (error) throw error;

      showTemporaryMessage(`تم حفظ النتيجة بنجاح! المجموع النهائي: ${finalScore} / ${maxMarks}`, 'success');
      setStudentSeatingNumber('');
      setBaseScoreInput('');
      setElectiveQ1Input('');
      setElectiveQ2Input('');
      setBonusScoreInput('');
    } catch (err) {
      console.error('Submission Error:', err);
      showTemporaryMessage(`حدث خطأ أثناء حفظ النتيجة: ${err.message}`, 'error');
    }
  };

  return (
    <div style={styles.container}>
      {message.text && (
        <div style={message.type === 'error' ? styles.errorAlert : styles.successAlert}>
          {message.text}
        </div>
      )}

      <h2 style={styles.mainTitle}>إنشاء وإدارة الامتحانات وجلساتها</h2>
      
      <form onSubmit={handleSaveExam} style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>عنوان الامتحان:</label>
          <input
            type="text"
            placeholder="مثال: امتحان الشهر الأول - التكنولوجيا"
            value={examTitle}
            onChange={(e) => setExamTitle(e.target.value)}
            style={styles.input}
            required
          />
        </div>

        <div style={styles.row}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>الفرع الأكاديمي:</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={styles.select}
              required
            >
              <option value="">اختر الفرع...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.branch_name}</option>
              ))}
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>المادة الدراسية:</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              style={styles.select}
              required
              disabled={!selectedBranch}
            >
              <option value="">اختر المبحث...</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.subject_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>تاريخ ويوم الامتحان:</label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>وقت بدء الامتحان:</label>
            <input
              type="time"
              value={examTime}
              onChange={(e) => setExamTime(e.target.value)}
              style={styles.input}
              required
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>مدة الامتحان (بالدقائق):</label>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              style={styles.input}
              min={5}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>عدد الأسئلة في الامتحان:</label>
            <input
              type="number"
              value={questionCount}
              onChange={(e) => setQuestionCount(e.target.value)}
              style={styles.input}
              min={1}
              required
            />
          </div>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>طبيعة الأسئلة في الامتحان:</label>
          <select
            value={questionTypeMode}
            onChange={(e) => setQuestionTypeMode(e.target.value)}
            style={styles.select}
          >
            <option value="mandatory">أسئلة إجبارية بالكامل</option>
            <option value="optional">يوجد أسئلة اختيارية (تضم عبارة أمام السؤال)</option>
            <option value="extra">يوجد أسئلة إضافية (تضم عبارة أمام السؤال)</option>
          </select>
        </div>

        {questionTypeMode !== 'mandatory' && (
          <div style={styles.inputGroup}>
            <label style={styles.label}>العبارة التي ستظهر أمام السؤال (مثل: [اختياري] أو [سؤال إضافي]):</label>
            <input
              type="text"
              placeholder="اكتب العبارة هنا..."
              value={customQuestionLabel}
              onChange={(e) => setCustomQuestionLabel(e.target.value)}
              style={styles.input}
            />
          </div>
        )}

        <div style={styles.unitsContainer}>
          <div style={styles.checkboxRow}>
            <input
              type="checkbox"
              id="allUnits"
              checked={allUnits}
              onChange={(e) => setAllUnits(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            <label htmlFor="allUnits" style={{ ...styles.label, cursor: 'pointer' }}>
              كل المادة (جلب أسئلة عشوائية من كافة الوحدات)
            </label>
          </div>

          {!allUnits && (
            <div style={styles.unitsList}>
              <label style={styles.label}>حدد الوحدات الداخلة في الامتحان:</label>
              {units.map((unit) => (
                <div key={unit.id} style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    id={`unit-${unit.id}`}
                    checked={selectedUnits.includes(unit.unit_number)}
                    onChange={() => handleUnitToggle(unit.unit_number)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <label htmlFor={`unit-${unit.id}`} style={{ cursor: 'pointer', fontSize: '15px' }}>
                    الوحدة {unit.unit_number}: {unit.name}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" style={styles.submitBtn}>حفظ وإنشاء الامتحان</button>
      </form>

      <hr style={{ margin: '30px 0', borderColor: '#cbd5e1' }} />

      {/* قسم تجريبي أو فعلي لتسجيل وتصحيح درجات الطالب وفق القواعد المعتمدة */}
      <h3 style={{ fontSize: '20px', color: '#1e3a8a', marginBottom: '15px' }}>تسجيل وتصحيح درجات طالب (مع تطبيق قواعد Math.max و Math.min)</h3>
      <form onSubmit={handleSaveStudentSubmission} style={styles.form}>
        <div style={styles.row}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>رقم جلوس الطالب:</label>
            <input
              type="text"
              placeholder="أدخل رقم الجلوس..."
              value={studentSeatingNumber}
              onChange={(e) => setStudentSeatingNumber(e.target.value)}
              style={styles.input}
              required
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>العلامة الكلية للامتحان:</label>
            <input
              type="number"
              value={totalExamMarks}
              onChange={(e) => setTotalExamMarks(e.target.value)}
              style={styles.input}
              required
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>علامة القسم الأساسي (حد أدنى 0.5 وبخطوات 0.5):</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={baseScoreInput}
              onChange={(e) => setBaseScoreInput(e.target.value)}
              style={styles.input}
              placeholder="0.0"
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>علامة القسم التعويضي / الإضافي:</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={bonusScoreInput}
              onChange={(e) => setBonusScoreInput(e.target.value)}
              style={styles.input}
              placeholder="0.0"
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>القسم الاختياري (السؤال الأول):</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={electiveQ1Input}
              onChange={(e) => setElectiveQ1Input(e.target.value)}
              style={styles.input}
              placeholder="0.0"
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>القسم الاختياري (السؤال الثاني - سيأخذ الأعلى):</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={electiveQ2Input}
              onChange={(e) => setElectiveQ2Input(e.target.value)}
              style={styles.input}
              placeholder="0.0"
            />
          </div>
        </div>

        <button type="submit" style={{ ...styles.submitBtn, backgroundColor: '#2563eb' }}>
          حساب وتخزين النتيجة النهائية (Submissions)
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '850px',
    margin: '30px auto',
    backgroundColor: '#ffffff',
    padding: '25px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
    direction: 'rtl',
    fontFamily: 'system-ui, sans-serif'
  },
  mainTitle: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#ffffff',
    backgroundColor: '#1e3a8a',
    padding: '14px 18px',
    borderRadius: '8px',
    marginBottom: '20px',
    textAlign: 'center'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '15px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#0f172a'
  },
  input: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1.5px solid #94a3b8',
    fontSize: '16px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
  },
  select: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1.5px solid #94a3b8',
    fontSize: '16px',
    backgroundColor: '#fff',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
  },
  unitsContainer: {
    backgroundColor: '#f8fafc',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  unitsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '8px',
    paddingRight: '10px'
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  submitBtn: {
    backgroundColor: '#16a34a',
    color: '#fff',
    border: 'none',
    padding: '14px',
    borderRadius: '8px',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '10px',
    boxShadow: '0 4px 6px rgba(22, 163, 74, 0.2)'
  },
  successAlert: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '14px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '15px',
    border: '1px solid #bbf7d0',
    textAlign: 'center'
  },
  errorAlert: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '14px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '15px',
    border: '1px solid #f87171',
    textAlign: 'center'
  }
};