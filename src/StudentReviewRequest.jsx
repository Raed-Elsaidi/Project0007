import React, { useEffect, useMemo, useState } from 'react';

const first = (...v) => v.find(x => x !== undefined && x !== null && String(x).trim() !== '');
const seat = s => first(s?.seating_number, s?.seat_number, s?.seat, s?.exam_seating_number) || '—';
const subjectName = (s,e) => first(s?.subject_name, s?.name, s?.title, e?.subject_name) || `مادة ${e?.subject_id ?? ''}`;

// شاشة جاهزة للإضافة إلى بوابة الطالب.
// الطالب يختار مادة واحدة فقط في كل طلب، والـ RPC في exam_review_requests.sql
// يمنع تكرار الطلب لنفس المادة والدورة من قاعدة البيانات.
export default function StudentReviewRequest({ supabase, studentId }) {
  const sid = Number(studentId || localStorage.getItem('currentStudentId') || localStorage.getItem('studentId') || 0);
  const [student,setStudent]=useState(null),[exams,setExams]=useState([]),[subjects,setSubjects]=useState([]),[requests,setRequests]=useState([]),[selected,setSelected]=useState(''),[loading,setLoading]=useState(true),[sending,setSending]=useState(false),[message,setMessage]=useState('');
  const load = async()=>{
    setLoading(true);
    try{
      const [s,e,sub,r]=await Promise.all([
        supabase.from('students').select('*').eq('id',sid).maybeSingle(),
        supabase.from('exams').select('*'),
        supabase.from('subjects').select('*'),
        supabase.rpc('get_student_review_requests',{p_student_id:sid})
      ]);
      if(s.error) throw s.error; if(e.error) throw e.error; if(sub.error) throw sub.error; if(r.error) throw r.error;
      setStudent(s.data||null); setSubjects(sub.data||[]); setRequests(r.data||[]);
      const cycle=s.data?.registration_cycle;
      const {data:subs,error:subErr}=await supabase.from('submissions').select('exam_id,student_id').eq('student_id',sid);
      if(subErr) throw subErr;
      const ids=new Set((subs||[]).map(x=>String(x.exam_id)));
      setExams((e.data||[]).filter(x=>ids.has(String(x.id)) && (x.cycle_id == null || Number(x.cycle_id)===Number(cycle))));
    }catch(err){setMessage(err.message||'تعذر تحميل مواد طلب المراجعة.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{if(sid)load();},[sid]);
  const available=useMemo(()=>exams.filter(e=>!requests.some(r=>String(r.exam_id)===String(e.id))),[exams,requests]);
  const submit=async()=>{
    if(!selected)return setMessage('اختر المادة أولاً.');
    setSending(true);setMessage('');
    try{const {error}=await supabase.rpc('create_exam_review_request',{p_student_id:sid,p_exam_id:Number(selected)});if(error)throw error;setMessage('تم إرسال طلب مراجعة المادة بنجاح ✅');setSelected('');await load();}
    catch(err){setMessage(err.message||'تعذر إرسال طلب المراجعة.');}
    finally{setSending(false);}
  };
  if(!sid)return <div dir="rtl">تعذر تحديد حساب الطالب.</div>;
  return <div dir="rtl" style={{maxWidth:900,margin:'0 auto',padding:20}}>
    <h2>📝 إنشاء طلب مراجعة</h2><p>اختر المادة التي قدّمت امتحانها وسلّمته في دورة الامتحان الحالية.</p>
    {message&&<div style={{padding:12,background:'#eff6ff',borderRadius:8,marginBottom:12}}>{message}</div>}
    {loading?<p>جاري التحميل...</p>:<>
      <div style={{background:'#f8fafc',padding:14,borderRadius:10,marginBottom:15}}><b>الطالب:</b> {first(student?.full_name_ar,student?.full_name,student?.name)||'—'} &nbsp; | &nbsp; <b>رقم الجلوس:</b> {seat(student)} &nbsp; | &nbsp; <b>الدورة:</b> {student?.registration_cycle?`الدورة ${student.registration_cycle}`:'—'}</div>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>اختيار</th><th>المادة</th><th>الامتحان</th><th>العلامة</th><th>الحالة</th></tr></thead><tbody>
      {available.map(e=>{const s=subjects.find(x=>String(x.id)===String(e.subject_id));const req=requests.find(r=>String(r.exam_id)===String(e.id));return <tr key={e.id}><td><input type="radio" name="review_exam" checked={selected===String(e.id)} onChange={()=>setSelected(String(e.id))}/></td><td>{subjectName(s,e)}</td><td>{first(e.title,e.exam_name)||`امتحان ${e.id}`}</td><td>{first(e.total_marks,e.total_mark,e.max_marks,'—')}</td><td>{req?'تم تقديم الطلب':'متاح'}</td></tr>})}</tbody></table></div>
      {!available.length&&<div style={{padding:20,textAlign:'center'}}>لا توجد مواد متاحة لطلب مراجعة في الدورة الحالية.</div>}
      <button onClick={submit} disabled={sending||!selected} style={{marginTop:18,padding:'11px 18px',border:0,borderRadius:8,background:'#2563eb',color:'#fff',cursor:'pointer'}}>{sending?'جاري الإرسال...':'إرسال طلب المراجعة'}</button>
    </>}
  </div>;
}
