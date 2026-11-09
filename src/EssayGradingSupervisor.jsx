import React, { useCallback, useEffect, useMemo, useState } from 'react';

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,.04)' };
const field = { width: '100%', boxSizing: 'border-box', padding: 11, border: '1px solid #cbd5e1', borderRadius: 9, background: '#fff' };

export default function EssayGradingSupervisor({ supabase, currentUser, onBack }) {
  const [exams, setExams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [examId, setExamId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [graderIds, setGraderIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const supervisorBranchId = currentUser?.branch_id ?? null;
  const supervisorSubjectId = currentUser?.subject_id ?? null;

  // إظهار امتحانات فرع ومبحث المشرف فقط، وإخفاء الامتحان بعد اكتمال كل أوراقه.
  const visibleExams = useMemo(() => {
    if (supervisorBranchId == null || supervisorSubjectId == null) return [];
    const groupsByExam = new Map();
    (dashboard?.groups || []).forEach(group => {
      const key = String(group.exam_id);
      const current = groupsByExam.get(key) || { total: 0, completed: 0 };
      current.total += Number(group.total_sheets || 0);
      current.completed += Number(group.completed_sheets || 0);
      groupsByExam.set(key, current);
    });
    return exams.filter(exam => {
      const matchesScope = Number(exam.branch_id) === Number(supervisorBranchId) && Number(exam.subject_id) === Number(supervisorSubjectId);
      if (!matchesScope) return false;
      const stats = groupsByExam.get(String(exam.id));
      return !(stats && stats.total > 0 && stats.completed >= stats.total);
    });
  }, [exams, dashboard, supervisorBranchId, supervisorSubjectId]);

  const visibleGroups = useMemo(() => {
    const totals = new Map();
    (dashboard?.groups || []).forEach(group => {
      const key = String(group.exam_id);
      const value = totals.get(key) || { total: 0, completed: 0 };
      value.total += Number(group.total_sheets || 0);
      value.completed += Number(group.completed_sheets || 0);
      totals.set(key, value);
    });
    return (dashboard?.groups || []).filter(group => {
      const exam = exams.find(item => String(item.id) === String(group.exam_id));
      if (!exam || Number(exam.branch_id) !== Number(supervisorBranchId) || Number(exam.subject_id) !== Number(supervisorSubjectId)) return false;
      const stats = totals.get(String(group.exam_id));
      return !(stats && stats.total > 0 && stats.completed >= stats.total);
    });
  }, [dashboard, exams, supervisorBranchId, supervisorSubjectId]);

  const selectedExam = useMemo(() => visibleExams.find(x => String(x.id) === String(examId)), [visibleExams, examId]);
  const eligibleGraders = useMemo(() => selectedExam ? employees.filter(e =>
    Number(e.job_id) === 7 &&
    e.is_active === true &&
    Number(e.branch_id) === Number(supervisorBranchId) &&
    Number(e.subject_id) === Number(supervisorSubjectId) &&
    Number(e.branch_id) === Number(selectedExam.branch_id) &&
    Number(e.subject_id) === Number(selectedExam.subject_id)
  ) : [], [employees, selectedExam, supervisorBranchId, supervisorSubjectId]);

  const loadAll = useCallback(async () => {
    setLoading(true); setMessage(''); setError(false);
    const [examRes, employeeRes, dashboardRes] = await Promise.all([
      supabase.from('exams').select('id,title,branch_id,subject_id').order('id', { ascending: false }),
      supabase.from('employees').select('id,full_name,username,job_id,is_active,branch_id,subject_id')
        .eq('job_id', 7).eq('is_active', true)
        .eq('branch_id', Number(supervisorBranchId)).eq('subject_id', Number(supervisorSubjectId)),
      supabase.rpc('get_essay_grading_supervisor_dashboard', { p_employee_id: Number(currentUser?.id) })
    ]);
    const firstError = examRes.error || employeeRes.error || dashboardRes.error;
    if (firstError) { console.error(firstError); setMessage(`تعذر تحميل بيانات إدارة التصحيح: ${firstError.message}`); setError(true); }
    setExams(examRes.data || []); setEmployees(employeeRes.data || []); setDashboard(dashboardRes.data || null);
    setLoading(false);
  }, [supabase, currentUser?.id, supervisorBranchId, supervisorSubjectId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleGrader = id => setGraderIds(old => old.includes(id) ? old.filter(x => x !== id) : old.length < 3 ? [...old, id] : old);

  const createGroup = async e => {
    e.preventDefault(); setMessage(''); setError(false);
    if (!selectedExam) { setMessage('اختر الامتحان أولاً.'); setError(true); return; }
    if (graderIds.length !== 3) { setMessage('يجب اختيار ثلاثة مصححين بالضبط.'); setError(true); return; }
    setSaving(true);
    const { data, error: rpcError } = await supabase.rpc('create_essay_grading_group', {
      p_exam_id: Number(examId), p_group_name: groupName.trim() || 'مجموعة التصحيح',
      p_grader_ids: graderIds.map(Number), p_created_by: currentUser?.id ? Number(currentUser.id) : null
    });
    if (rpcError) { console.error(rpcError); setMessage(rpcError.message || 'تعذر إنشاء مجموعة التصحيح.'); setError(true); }
    else { setMessage(`تم إنشاء مجموعة التصحيح بنجاح. رقم المجموعة: ${data}`); setGroupName(''); setGraderIds([]); await loadAll(); }
    setSaving(false);
  };

  return <main dir="rtl" style={{ maxWidth: 1200, margin: '0 auto', padding: 20, color: '#172033' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
      <div><h2 style={{ margin: 0 }}>📝 إدارة التصحيح وتوزيع أوراق الإجابات</h2><p style={{ margin: '7px 0 0', color: '#64748b' }}>إنشاء مجموعات من ثلاثة مصححين وإسناد أوراق الإجابات تلقائياً حسب الامتحان والفرع والمبحث.</p></div>
      <div style={{ display: 'flex', gap: 8 }}><button onClick={loadAll} style={{ padding: '10px 14px', borderRadius: 9, border: '1px solid #cbd5e1', background: '#fff' }}>↻ تحديث</button>{onBack && <button onClick={onBack} style={{ padding: '10px 14px', borderRadius: 9, border: 0, background: '#1e293b', color: '#fff' }}>الرئيسية</button>}</div>
    </header>
    {message && <div role="alert" style={{ padding: 12, marginBottom: 14, borderRadius: 9, background: error ? '#fef2f2' : '#ecfdf5', color: error ? '#991b1b' : '#065f46' }}>{message}</div>}
    {loading ? <p>جاري تحميل بيانات الامتحانات والمصححين...</p> : <>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 18 }}>
        <div style={card}><small style={{ color: '#64748b' }}>إجمالي الأوراق المسندة</small><h2 style={{ margin: '8px 0 0' }}>{dashboard?.total_sheets ?? 0}</h2></div>
        <div style={card}><small style={{ color: '#64748b' }}>الأوراق المكتملة</small><h2 style={{ margin: '8px 0 0', color: '#059669' }}>{dashboard?.completed_sheets ?? 0}</h2></div>
        <div style={card}><small style={{ color: '#64748b' }}>الأوراق المتبقية</small><h2 style={{ margin: '8px 0 0', color: '#d97706' }}>{dashboard?.remaining_sheets ?? 0}</h2></div>
      </section>
      { (supervisorBranchId == null || supervisorSubjectId == null) && <div role="alert" style={{ ...card, marginBottom: 14, color: '#991b1b' }}>تعذر تحديد فرع أو مبحث حساب المشرف من جدول employees. تأكد من وجود branch_id و subject_id في سجل الموظف.</div> }
      <section style={{ ...card, marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>إنشاء مجموعة وتوزيع أوراق الإجابات</h3>
        <form onSubmit={createGroup} style={{ display: 'grid', gap: 13 }}>
          <label>الامتحان<select required value={examId} onChange={e => { setExamId(e.target.value); setGraderIds([]); }} style={{ ...field, marginTop: 6 }}><option value="">اختر الامتحان</option>{visibleExams.map(ex => <option key={ex.id} value={ex.id}>{ex.title || `امتحان #${ex.id}`} — #{ex.id}</option>)}</select></label>
          <label>اسم المجموعة<input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="مثال: مجموعة تصحيح اللغة العربية" style={{ ...field, marginTop: 6 }} /></label>
          {selectedExam && <div style={{ padding: 10, background: '#f8fafc', borderRadius: 9, color: '#475569' }}>يعرض هذا الحساب امتحانات فرعه ومبحثه فقط. المصححون المتاحون يجب أن يطابق فرعهم ومبحثهم فرع ومبحث المشرف والامتحان، وأن تكون حساباتهم نشطة.</div>}
          {!visibleExams.length && supervisorBranchId != null && supervisorSubjectId != null && <p style={{ color: '#64748b' }}>لا توجد امتحانات متاحة لفرعك ومبحثك، أو أن جميع امتحاناتك اكتمل تصحيحها.</p>}
          <div><b>اختيار المصححين ({graderIds.length}/3)</b>{!selectedExam ? <p style={{ color: '#64748b' }}>اختر امتحاناً لعرض المصححين المطابقين.</p> : eligibleGraders.length === 0 ? <p style={{ color: '#b45309' }}>لا يوجد مصححون نشطون مطابقون لفرع ومبحث هذا الامتحان.</p> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 8, marginTop: 9 }}>{eligibleGraders.map(emp => <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e2e8f0', borderRadius: 9, padding: 10, background: graderIds.includes(Number(emp.id)) ? '#eff6ff' : '#fff' }}><input type="checkbox" checked={graderIds.includes(Number(emp.id))} disabled={!graderIds.includes(Number(emp.id)) && graderIds.length >= 3} onChange={() => toggleGrader(Number(emp.id))} /><span>{emp.full_name || emp.username || `موظف #${emp.id}`}</span></label>)}</div>}</div>
          <button type="submit" disabled={saving || graderIds.length !== 3 || !selectedExam} style={{ padding: 13, border: 0, borderRadius: 10, color: '#fff', background: saving || graderIds.length !== 3 ? '#94a3b8' : '#14532d', fontWeight: 700 }}>{saving ? 'جاري إنشاء المجموعة وإسناد الأوراق...' : 'إنشاء المجموعة وتوزيع الأوراق'}</button>
        </form>
      </section>
      <section style={card}><h3 style={{ marginTop: 0 }}>مجموعات التصحيح وحالة التوزيع</h3>{!visibleGroups.length ? <p style={{ color: '#64748b' }}>لا توجد مجموعات تصحيح ضمن فرعك ومبحثك حتى الآن.</p> : <div style={{ display: 'grid', gap: 12 }}>{visibleGroups.map(group => <article key={group.id} style={{ border: '1px solid #e2e8f0', borderRadius: 11, padding: 13 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><b>{group.group_name}</b><span style={{ color: '#64748b' }}>مجموعة #{group.id} · {group.exam_title || `امتحان #${group.exam_id}`}</span></div><div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '10px 0', fontSize: 14 }}><span>إجمالي الأوراق: <b>{group.total_sheets}</b></span><span>مكتملة: <b style={{ color: '#059669' }}>{group.completed_sheets}</b></span><span>متبقية: <b style={{ color: '#d97706' }}>{group.remaining_sheets}</b></span></div><div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{(group.members || []).map(member => <span key={member.id} style={{ background: '#f1f5f9', padding: '5px 9px', borderRadius: 20, fontSize: 13 }}>{member.name}</span>)}</div></article>)}</div>}</section>
    </>}
  </main>;
}
