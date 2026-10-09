import React, { useEffect, useState } from 'react';

export default function EssayGradingManager({ supabase, onBack }) {
  const graderId = Number(localStorage.getItem('currentUserId')) || null;
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!graderId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('get_essay_grading_queue', { p_grader_id: graderId });
    if (error) {
      console.error(error);
      setMessage('تعذر تحميل أسئلة التصحيح. تأكد من تشغيل SQL الخاص بالتصحيح المقالي.');
      setItems([]);
    } else {
      setItems(data || []);
      setMessage('');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!selected) return;
    const value = Number(score);
    const max = Number(selected.max_score) || 0;
    if (!Number.isFinite(value) || value < 0 || value > max) {
      setMessage(`العلامة يجب أن تكون بين 0 و ${max}.`);
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('submit_essay_grade', {
      p_student_id: Number(selected.student_id),
      p_exam_id: Number(selected.exam_id),
      p_question_id: Number(selected.question_id),
      p_grader_id: graderId,
      p_score: value,
    });
    if (error) {
      console.error(error);
      setMessage(error.message || 'تعذر حفظ التصحيح.');
    } else {
      setSelected(null);
      setScore('');
      setMessage('تم حفظ التصحيح وإخفاء هوية الطالب عن المصحح.');
      await load();
    }
    setSaving(false);
  };

  return <div dir="rtl" style={{padding:24, maxWidth:1100, margin:'0 auto'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:20}}>
      <div><h2 style={{margin:0}}>📝 تصحيح الأسئلة المقالية</h2><p style={{color:'#777'}}>التصحيح مستقل ومجهول الهوية. لا تظهر للمصحح أسماء الطلاب أو أرقام هوياتهم.</p></div>
      {onBack && <button onClick={onBack}>الرئيسية</button>}
    </div>
    {message && <div style={{padding:12,borderRadius:8,background:'#fff4df',marginBottom:14}}>{message}</div>}
    {loading ? <p>جاري التحميل...</p> : !items.length ? <p>لا توجد أسئلة بانتظار التصحيح المخصص لك.</p> :
      <div style={{display:'grid',gap:12}}>{items.map((item, i) =>
        <button key={`${item.exam_id}-${item.question_id}-${i}`} onClick={() => {setSelected(item);setScore('');}} style={{textAlign:'right',padding:16,border:'1px solid #ddd',borderRadius:12,background:'#fff',cursor:'pointer'}}>
          <b>السؤال #{item.question_id}</b> — العلامة القصوى: {item.max_score}<br/>
          <span>{item.question_text}</span><br/>
          <small>إجابة الطالب: {item.student_answer || '—'}</small>
        </button>)}
      </div>}

    {selected && <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:18,zIndex:9999}}>
      <form onSubmit={save} style={{background:'#fff',borderRadius:16,padding:22,width:'min(650px,100%)'}}>
        <h3>تصحيح السؤال #{selected.question_id}</h3>
        <p>{selected.question_text}</p>
        <div style={{background:'#f6f6f6',padding:14,borderRadius:10,marginBottom:15}}>إجابة الطالب: {selected.student_answer || '—'}</div>
        <label>العلامة من {selected.max_score}</label>
        <input autoFocus type="number" min="0" max={selected.max_score} step="0.01" value={score} onChange={e=>setScore(e.target.value)} style={{width:'100%',padding:12,boxSizing:'border-box',marginTop:7}} />
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:18}}><button type="button" onClick={()=>setSelected(null)}>إلغاء</button><button type="submit" disabled={saving}>{saving?'جاري الحفظ...':'حفظ التصحيح'}</button></div>
      </form>
    </div>}
  </div>;
}
