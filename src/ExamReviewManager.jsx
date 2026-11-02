import React, { useEffect, useMemo, useState } from 'react';

const clean = (v) => String(v ?? '').trim();
const first = (...v) => v.find(x => x !== undefined && x !== null && clean(x) !== '');
const num = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const fmt = (v) => Number.isFinite(Number(v)) ? Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—';
const dateTime = (v) => v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const seat = (s) => first(s?.seating_number, s?.seat_number, s?.seat, s?.exam_seating_number, s?.رقم_الجلوس) || '—';
const studentName = (s) => first(s?.full_name_ar, s?.full_name, s?.name, s?.student_name) || '—';
const branchName = (b, row) => first(b?.branch_name, b?.name, b?.title, row?.branch_name, row?.branch) || (row?.branch_id ? `فرع ${row.branch_id}` : '—');
const subjectName = (s, row) => first(s?.subject_name, s?.name, s?.title, row?.subject_name, row?.subject) || (row?.subject_id ? `مادة ${row.subject_id}` : '—');
const cycleName = (c, row) => c?.cycle_number ? `الدورة ${c.cycle_number}` : (row?.cycle_id ? `الدورة ${row.cycle_id}` : '—');

const normalizeAnswer = (v) => clean(v).toLowerCase().replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
const optionText = (o) => typeof o === 'object' ? first(o?.text, o?.option_text, o?.label, o?.value, o?.name) : o;
const options = (q) => Array.isArray(q?.options) ? q.options : (Array.isArray(q?.choices) ? q.choices : []);
const optionIndex = (v, opts) => {
  const x = normalizeAnswer(v);
  if (!x) return null;
  if (/^\d+$/.test(x)) {
    const n = Number(x);
    if (n >= 0 && n < opts.length) return n;
    if (n >= 1 && n <= opts.length) return n - 1;
  }
  const letters = { a:0,b:1,c:2,d:3,'ا':0,'ب':1,'ج':2,'د':3 };
  if (letters[x] != null && letters[x] < opts.length) return letters[x];
  const i = opts.findIndex(o => normalizeAnswer(optionText(o)) === x);
  return i >= 0 ? i : null;
};
const sameAnswer = (q, a, c) => {
  const aa = normalizeAnswer(a), cc = normalizeAnswer(c);
  if (!aa || !cc) return false;
  if (aa === cc) return true;
  const opts = options(q);
  if (!opts.length) return false;
  const ai = optionIndex(aa, opts), ci = optionIndex(cc, opts);
  return ai != null && ci != null && ai === ci;
};
const getAnswer = (a) => first(a?.selected_answer, a?.selected_option, a?.answer, a?.student_answer, a?.answer_text, a?.answer_value, a?.option, a?.choice, a?.value);
const getCorrect = (q, a) => first(a?.correct_answer, a?.correctAnswer, a?.expected_answer, q?.correct_answer, q?.correctAnswer, q?.right_answer, q?.correct_option, q?.correct_choice, q?.answer_key);
const getMax = (q, a) => num(first(a?.points, a?.mark, a?.marks, a?.score, q?.points, q?.mark, q?.marks, q?.score, q?.degree, q?.question_mark, 1), 1);
const getStoredScore = (a) => {
  const v = first(a?.mark, a?.marks, a?.score, a?.earned_marks, a?.earned_score);
  return v === undefined ? null : num(v, 0);
};

function getSelectedQuestionIds(exam) {
  let ids = exam?.selected_questions;
  if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { ids = []; } }
  return Array.isArray(ids) ? ids.map(x => Number.isFinite(Number(x)) ? Number(x) : x) : [];
}

export default function ExamReviewManager({ supabase, currentUser, userRole, canAccess, initialView = 'pending', styles = {}, showAlertMessage }) {
  const employeeId = Number(currentUser?.id || localStorage.getItem('currentUserId') || 0);
  const isAdmin = userRole === 'Admin';
  const canReview = isAdmin || canAccess?.('review_exam_requests');
  const canReviewed = isAdmin || canAccess?.('view_reviewed_exam_reviews');
  const canPending = isAdmin || canAccess?.('view_unreviewed_exam_reviews');
  const canAdjust = isAdmin || canAccess?.('adjust_exam_review_mark');
  const canManageReviewButton = isAdmin || canAccess?.('manage_review_request_button_visibility');

  const [requests, setRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [branches, setBranches] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeView, setActiveView] = useState(initialView === 'reviewed' && canReviewed ? 'reviewed' : (canPending ? 'pending' : 'reviewed'));
  useEffect(() => { setActiveView(initialView === 'reviewed' && canReviewed ? 'reviewed' : (canPending ? 'pending' : 'reviewed')); }, [initialView, canPending, canReviewed]);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editedScores, setEditedScores] = useState({});
  const [showCreateRequestButton, setShowCreateRequestButton] = useState(true);
  const [savingButtonVisibility, setSavingButtonVisibility] = useState(false);

  const show = (m) => { setMessage(m); window.setTimeout(() => setMessage(''), 2800); };

  const loadButtonVisibility = async () => {
    try {
      const { data, error } = await supabase.rpc('get_exam_review_request_button_visibility');
      if (error) throw error;
      setShowCreateRequestButton(data !== false);
    } catch (e) {
      console.warn('تعذر تحميل حالة زر إنشاء طلب المراجعة:', e);
    }
  };

  const toggleCreateRequestButton = async () => {
    if (!canManageReviewButton || savingButtonVisibility) return;
    const next = !showCreateRequestButton;
    setSavingButtonVisibility(true);
    try {
      const { data, error } = await supabase.rpc('set_exam_review_request_button_visibility', {
        p_employee_id: employeeId,
        p_visible: next
      });
      if (error) throw error;
      setShowCreateRequestButton(data?.visible !== false);
      show(next ? 'تم إظهار زر إنشاء طلب مراجعة للطلاب.' : 'تم إخفاء زر إنشاء طلب مراجعة للطلاب.');
    } catch (e) {
      console.error(e);
      show(e.message || 'تعذر تغيير حالة زر إنشاء طلب المراجعة.');
    } finally {
      setSavingButtonVisibility(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [reqRes, stRes, exRes, subRes, brRes, cyRes, empRes] = await Promise.all([
        supabase.from('exam_review_requests').select('*').order('cycle_id', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('students').select('*'),
        supabase.from('exams').select('*'),
        supabase.from('subjects').select('*'),
        supabase.from('branches').select('*'),
        supabase.from('registration_cycles').select('*').order('cycle_number'),
        supabase.from('employees').select('id, full_name, username, branch_id, subject_id, job_id')
      ]);
      if (reqRes.error) throw reqRes.error;
      setRequests(reqRes.data || []);
      setStudents(stRes.data || []);
      setExams(exRes.data || []);
      setSubjects(subRes.data || []);
      setBranches(brRes.data || []);
      setCycles(cyRes.data || []);
      setEmployees(empRes.data || []);
    } catch (e) {
      console.error(e);
      showAlertMessage?.(e.message || 'تعذر تحميل طلبات مراجعة الامتحانات.', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); loadButtonVisibility(); }, [supabase]);

  const maps = useMemo(() => ({
    students: new Map(students.map(x => [String(x.id), x])),
    exams: new Map(exams.map(x => [String(x.id), x])),
    subjects: new Map(subjects.map(x => [String(x.id), x])),
    branches: new Map(branches.map(x => [String(x.id), x])),
    cycles: new Map(cycles.map(x => [String(x.id), x])),
    employees: new Map(employees.map(x => [String(x.id), x])),
  }), [students, exams, subjects, branches, cycles, employees]);

  const scoped = useMemo(() => requests.filter(r => {
    if (isAdmin) return true;
    const b = currentUser?.branch_id;
    const s = currentUser?.subject_id;
    return b != null && s != null && String(r.branch_id) === String(b) && String(r.subject_id) === String(s);
  }), [requests, isAdmin, currentUser]);

  const pending = useMemo(() => scoped.filter(r => r.status === 'pending'), [scoped]);
  const reviewed = useMemo(() => scoped.filter(r => r.status !== 'pending'), [scoped]);
  const rows = activeView === 'pending' ? pending : reviewed;

  const enrich = (r) => ({
    ...r,
    student: maps.students.get(String(r.student_id)),
    exam: maps.exams.get(String(r.exam_id)),
    subject: maps.subjects.get(String(r.subject_id)),
    branch: maps.branches.get(String(r.branch_id)),
    cycle: maps.cycles.get(String(r.cycle_id)),
    reviewer: maps.employees.get(String(r.reviewer_id)),
  });

  const openDetail = async (row) => {
    setSelected(row);
    setDetail(null);
    setEditedScores({});
    setDetailLoading(true);
    try {
      const r = enrich(row);
      const exam = r.exam;
      const selectedIds = getSelectedQuestionIds(exam);
      const [qRes, aRes, subRes, ovRes] = await Promise.all([
        supabase.from('questions').select('*').in('id', selectedIds.length ? selectedIds : [-1]),
        supabase.from('student_answers').select('*').eq('student_id', row.student_id).eq('exam_id', row.exam_id),
        supabase.from('submissions').select('*').eq('student_id', row.student_id).eq('exam_id', row.exam_id).order('id', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('exam_review_question_scores').select('*').eq('request_id', row.id),
      ]);
      if (qRes.error) throw qRes.error;
      if (aRes.error) throw aRes.error;
      if (ovRes.error) throw ovRes.error;
      const answers = aRes.data || [];
      const answerMap = new Map(answers.map(a => [String(a.question_id), a]));
      const overrides = ovRes.data || [];
      const overrideMap = new Map(overrides.map(o => [String(o.question_id), o]));
      const questionRows = (qRes.data || []).map((q) => {
        const a = answerMap.get(String(q.id));
        const max = getMax(q, a);
        const given = getAnswer(a);
        const correct = getCorrect(q, a);
        const stored = getStoredScore(a);
        const original = stored != null ? stored : (given != null && correct != null && sameAnswer(q, given, correct) ? max : 0);
        const ov = overrideMap.get(String(q.id));
        return { q, a, max, given, correct, original: num(first(ov?.original_score, original)), current: num(first(ov?.reviewed_score, original)), override: ov || null };
      });
      setDetail({ ...r, questions: questionRows, submission: subRes.data || null });
    } catch (e) {
      console.error(e);
      show(e.message || 'تعذر فتح الامتحان للمراجعة.');
    } finally { setDetailLoading(false); }
  };

  const saveAdjusted = async () => {
    if (!detail || !canAdjust) return;
    const changes = detail.questions.filter(x => editedScores[String(x.q.id)] !== undefined);
    if (!changes.length) { show('لم يتم تعديل أي علامة.'); return; }
    setSaving(true);
    try {
      for (const item of changes) {
        const value = Number(editedScores[String(item.q.id)]);
        if (!Number.isFinite(value) || value < 0 || value > item.max) throw new Error(`علامة السؤال يجب أن تكون بين 0 و ${item.max}.`);
        const { error } = await supabase.rpc('apply_exam_review_adjustment', {
          p_request_id: Number(detail.id), p_question_id: Number(item.q.id), p_new_score: value, p_reviewer_id: employeeId
        });
        if (error) throw error;
      }
      const { error: finalizeError } = await supabase.rpc('finalize_exam_review_adjusted', { p_request_id: Number(detail.id), p_reviewer_id: employeeId });
      if (finalizeError) throw finalizeError;
      show('تم اعتماد العلامات الجديدة للأسئلة والامتحان بنجاح ✅');
      setSelected(null);
      setDetail(null);
      await load();
    } catch (e) {
      console.error(e);
      show(e.message || 'تعذر حفظ تعديل العلامة.');
    } finally { setSaving(false); }
  };

  const markCorrect = async (row) => {
    if (!canReview) return;
    if (!window.confirm('تأكيد أن علامة الامتحان صحيحة؟')) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('complete_exam_review_correct', { p_request_id: Number(row.id), p_reviewer_id: employeeId });
      if (error) throw error;
      show('تم اعتماد العلامة الحالية دون تعديل.');
      await load();
    } catch (e) { console.error(e); show(e.message || 'تعذر اعتماد المراجعة.'); }
    finally { setSaving(false); }
  };

  const table = (title, data, showActions) => (
    <section style={ui.section}>
      <div style={ui.sectionHeader}><div><h3 style={{margin:0}}>{title}</h3><div style={ui.count}>العدد: <b>{data.length}</b></div></div><button onClick={load} style={ui.refresh}>↻ تحديث</button></div>
      <div style={ui.tableWrap}>
        <table style={ui.table}>
          <thead><tr><th>مسلسل</th><th>رقم جلوس الطالب</th><th>المادة</th><th>العلامة قبل المراجعة</th><th>العلامة بعد المراجعة</th><th>اسم المراجع</th><th>تاريخ المراجعة</th><th>دورة الامتحان</th>{showActions && <th>الإجراء</th>}</tr></thead>
          <tbody>{data.map((row, i) => { const r = enrich(row); return <tr key={row.id}>
            <td>{i + 1}</td><td>{seat(r.student)}</td><td>{subjectName(r.subject, r)}</td><td>{fmt(row.original_score)}</td><td>{row.reviewed_score == null ? '—' : fmt(row.reviewed_score)}</td><td>{first(r.reviewer?.full_name, r.reviewer?.username) || '—'}</td><td>{row.reviewed_at ? dateTime(row.reviewed_at) : '—'}</td><td>{cycleName(r.cycle, row)}</td>{showActions && <td><div style={ui.actionRow}><button onClick={() => openDetail(row)} style={ui.editBtn}>تعديل</button><button onClick={() => markCorrect(row)} style={ui.okBtn} disabled={saving}>العلامة صحيحة</button></div></td>}
          </tr>})}</tbody>
        </table>
        {!data.length && <div style={ui.empty}>لا توجد امتحانات في هذه القائمة.</div>}
      </div>
    </section>
  );

  if (!canReview && !canReviewed && !canPending) return <div dir="rtl" style={ui.denied}>ليس لديك صلاحية الوصول إلى مراجعة الامتحانات.</div>;

  return <div dir="rtl" style={ui.page}>
    <div style={ui.header}><div><div style={ui.eyebrow}>مراجعة طلبات الطلاب</div><h2 style={ui.title}>🔎 مراجعة الامتحانات</h2><p style={ui.subtitle}>يظهر للمراجع فقط الامتحان الذي قدّم الطالب طلب مراجعته، مع الالتزام بفرع ومادة المراجع.</p></div><div style={ui.headerRight}><div style={ui.cards}><div><b>{pending.length}</b><span>لم تتم مراجعتها</span></div><div><b>{reviewed.length}</b><span>تمت مراجعتها</span></div></div>{canManageReviewButton && <button type="button" onClick={toggleCreateRequestButton} disabled={savingButtonVisibility} style={ui.visibilityBtn}>{savingButtonVisibility ? 'جاري الحفظ...' : (showCreateRequestButton ? '🙈 إخفاء زر إنشاء طلب مراجعة' : '👁️ إظهار زر إنشاء طلب مراجعة')}</button>}</div></div>
    {message && <div style={ui.message}>{message}</div>}
    <div style={ui.tabs}>{canPending && <button onClick={() => setActiveView('pending')} style={{...ui.tab, ...(activeView==='pending'?ui.activeTab:{})}}>🕐 لم تتم مراجعتها ({pending.length})</button>}{canReviewed && <button onClick={() => setActiveView('reviewed')} style={{...ui.tab, ...(activeView==='reviewed'?ui.activeTab:{})}}>✅ تمت مراجعتها ({reviewed.length})</button>}</div>
    {loading ? <div style={ui.empty}>جاري تحميل البيانات...</div> : table(activeView === 'pending' ? 'الامتحانات التي تحتاج مراجعة' : 'الامتحانات التي تمت مراجعتها', rows, activeView === 'pending' && canReview)}

    {selected && detail && <div style={ui.overlay}>
      <div style={ui.modal}>
        <div style={ui.modalHead}><div><h3 style={{margin:0}}>مراجعة امتحان الطالب</h3><p style={{margin:'5px 0 0',color:'#64748b'}}>رقم الجلوس: {seat(detail.student)} — {subjectName(detail.subject, detail)} — {cycleName(detail.cycle, detail)}</p></div><button onClick={() => setSelected(null)} style={ui.close}>✕</button></div>
        <div style={ui.studentInfo}><b>الطالب:</b> {studentName(detail.student)} &nbsp; | &nbsp; <b>العلامة الحالية:</b> {fmt(detail.original_score)} &nbsp; | &nbsp; <b>الامتحان:</b> {first(detail.exam?.title, detail.exam?.exam_name) || `امتحان ${detail.exam_id}`}</div>
        <div style={ui.questions}>
          {detail.questions.map((item, idx) => <div key={item.q.id} style={ui.question}>
            <div style={ui.qHead}><b>السؤال {idx + 1}</b><span>العلامة القصوى: {fmt(item.max)}</span></div>
            <div style={ui.qText}>{first(item.q.question_text, item.q.text, item.q.body, item.q.question) || '—'}</div>
            <div style={ui.answer}><b>إجابة الطالب:</b> {item.given ?? 'لم يجب'}</div>
            <div style={ui.markLine}><span>العلامة الحالية للسؤال: <b>{fmt(item.current)}</b> / {fmt(item.max)}</span>{canAdjust && detail.status === 'pending' && <input type="number" min="0" max={item.max} step="0.01" value={editedScores[String(item.q.id)] ?? item.current} onChange={e => setEditedScores(prev => ({...prev, [String(item.q.id)]: e.target.value}))} style={ui.markInput} />}</div>
          </div>)}
        </div>
        {canAdjust && detail.status === 'pending' && <div style={ui.modalActions}><button onClick={() => setSelected(null)} style={ui.cancel}>إلغاء</button><button onClick={saveAdjusted} disabled={saving} style={ui.save}>{saving ? 'جاري الحفظ...' : '💾 اعتماد التعديلات والعلامة الجديدة'}</button></div>}
      </div>
    </div>}
  </div>;
}

const ui = {
  page:{padding:24,maxWidth:1500,margin:'0 auto',color:'#e5e7eb'},header:{display:'flex',justifyContent:'space-between',gap:20,alignItems:'center',marginBottom:18,flexWrap:'wrap'},headerRight:{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',justifyContent:'flex-end'},eyebrow:{fontSize:12,color:'#93c5fd'},title:{margin:'4px 0',fontSize:24},subtitle:{margin:0,color:'#94a3b8'},cards:{display:'flex',gap:10},cardsDiv:{},section:{background:'#111827',border:'1px solid #334155',borderRadius:14,overflow:'hidden'},sectionHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:16},count:{color:'#94a3b8',marginTop:5},refresh:{background:'#334155',color:'#fff',border:0,borderRadius:8,padding:'8px 12px',cursor:'pointer'},visibilityBtn:{background:'#7c3aed',color:'#fff',border:0,borderRadius:9,padding:'10px 14px',cursor:'pointer',fontWeight:800},tableWrap:{overflowX:'auto'},table:{width:'100%',borderCollapse:'collapse',minWidth:950},message:{background:'#064e3b',padding:12,borderRadius:10,marginBottom:14},tabs:{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'},tab:{border:'1px solid #475569',background:'#1e293b',color:'#fff',padding:'10px 14px',borderRadius:9,cursor:'pointer'},activeTab:{background:'#2563eb',borderColor:'#2563eb'},empty:{padding:30,textAlign:'center',color:'#94a3b8',background:'#111827',borderRadius:12},denied:{padding:30,textAlign:'center',color:'#fca5a5'},actionRow:{display:'flex',gap:7,flexWrap:'wrap'},editBtn:{background:'#f59e0b',color:'#111827',border:0,borderRadius:7,padding:'7px 10px',cursor:'pointer',fontWeight:800},okBtn:{background:'#10b981',color:'#052e16',border:0,borderRadius:7,padding:'7px 10px',cursor:'pointer',fontWeight:800},overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16},modal:{background:'#f8fafc',color:'#0f172a',borderRadius:16,width:'min(1050px,100%)',maxHeight:'92vh',overflow:'auto',boxShadow:'0 20px 70px rgba(0,0,0,.4)'},modalHead:{display:'flex',justifyContent:'space-between',gap:15,padding:18,borderBottom:'1px solid #e2e8f0'},close:{border:0,background:'#fee2e2',color:'#991b1b',borderRadius:8,padding:'7px 10px',cursor:'pointer'},studentInfo:{margin:16,padding:12,background:'#e0f2fe',borderRadius:10},questions:{padding:'0 16px 16px',display:'grid',gap:12},question:{border:'1px solid #cbd5e1',borderRadius:12,padding:14,background:'#fff'},qHead:{display:'flex',justifyContent:'space-between',gap:10,color:'#334155'},qText:{marginTop:10,fontWeight:700,lineHeight:1.8},answer:{marginTop:10,padding:10,background:'#f1f5f9',borderRadius:8,whiteSpace:'pre-wrap'},markLine:{marginTop:10,display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'},markInput:{width:130,padding:8,border:'1px solid #94a3b8',borderRadius:7},modalActions:{position:'sticky',bottom:0,background:'#fff',padding:15,borderTop:'1px solid #cbd5e1',display:'flex',justifyContent:'flex-end',gap:8},cancel:{border:0,background:'#e2e8f0',padding:'10px 15px',borderRadius:8,cursor:'pointer'},save:{border:0,background:'#2563eb',color:'#fff',padding:'10px 15px',borderRadius:8,cursor:'pointer',fontWeight:800}
};
