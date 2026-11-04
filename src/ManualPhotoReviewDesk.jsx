import React, { useCallback, useEffect, useState } from 'react';

const ui = {
  panel: { direction: 'rtl', color: '#eaf2ff', background: '#0b1730', border: '1px solid #29466d', borderRadius: 16, padding: 16, width: '100%', boxSizing: 'border-box' },
  button: { border: 0, borderRadius: 8, padding: '9px 13px', color: '#fff', fontWeight: 700, cursor: 'pointer', font: 'inherit' },
  input: { width: '100%', boxSizing: 'border-box', borderRadius: 8, padding: 10, font: 'inherit', margin: '8px 0' }
};

export default function ManualPhotoReviewDesk({ supabase, currentUser, onBack }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState({});
  const [filter, setFilter] = useState('pending');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: rpcError } = await supabase.rpc('list_student_registration_manual_reviews', {
      p_employee_id: Number(currentUser?.id)
    });
    if (rpcError) setError(`تعذر تحميل طلبات الصور: ${rpcError.message}`);
    else setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [supabase, currentUser?.id]);

  useEffect(() => { load(); }, [load]);

  const decide = async (row, decision) => {
    const note = String(notes[row.id] || '').trim();
    if (decision === 'rejected' && !note) { setError('اكتب سبب الرفض حتى يظهر للطالب.'); return; }
    setBusy(row.id); setError('');
    const { error: rpcError } = await supabase.rpc('review_student_registration_manual_review', {
      p_request_id: row.id,
      p_employee_id: Number(currentUser?.id),
      p_decision: decision,
      p_note: note || null
    });
    if (rpcError) setError(`تعذر حفظ القرار: ${rpcError.message}`);
    else { setNotes(v => ({ ...v, [row.id]: '' })); await load(); }
    setBusy('');
  };

  const visible = rows.filter(r => filter === 'all' || r.status === filter);
  return <section style={ui.panel}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div><h2 style={{ margin: '0 0 6px', color: '#60b9ff' }}>مراجعة صور تسجيل الطلاب</h2><p style={{ margin: 0, color: '#a9bdd8' }}>تظهر هنا الحالات التي تعذّر فيها التعرف الآلي أو مقارنة الوجهين فقط.</p></div>
      <div style={{ display: 'flex', gap: 8 }}><button style={{ ...ui.button, background: '#1e4f91' }} onClick={load}>↻ تحديث</button>{onBack && <button style={{ ...ui.button, background: '#334155' }} onClick={onBack}>رجوع</button>}</div>
    </header>
    <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>{[['pending','قيد المراجعة'],['approved','موافق عليها'],['rejected','مرفوضة'],['all','الكل']].map(([v,l]) => <button key={v} onClick={() => setFilter(v)} style={{ ...ui.button, background: filter === v ? '#1d64d8' : '#172b49' }}>{l}</button>)}</nav>
    {error && <p role="alert" style={{ color: '#fecaca', background: '#451d2a', padding: 10, borderRadius: 8 }}>{error}</p>}
    {loading ? <p>جاري تحميل الطلبات...</p> : visible.length === 0 ? <p style={{ color: '#a9bdd8' }}>لا توجد طلبات في هذه القائمة.</p> : visible.map(row => <article key={row.id} style={{ background: '#101f39', border: '1px solid #334d70', borderRadius: 12, padding: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><strong>رقم الهوية: {row.national_id}</strong><span>{row.status === 'pending' ? 'قيد المراجعة' : row.status === 'approved' ? 'تمت الموافقة' : 'مرفوض'}</span></div>
      <p><b>نوع الوثيقة:</b> {row.document_type === 'passport' ? 'جواز سفر' : 'هوية'}</p>
      <p style={{ color: '#fbbf24' }}><b>سبب الإحالة:</b> {row.student_snapshot?.auto_check_note || 'تعذر إكمال الفحص الآلي'}</p>
      {row.student_snapshot?.face_match && <p><b>نتيجة الفحص الآلي:</b> {row.student_snapshot.face_match.score == null ? 'غير متاحة — يلزم الفحص اليدوي' : `${row.student_snapshot.face_match.score}% (الحد التشغيلي 85%)`}</p>}
      <p><b>السنة / الدورة:</b> {row.academic_year} / {row.registration_cycle}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <figure style={{ margin: 0 }}><figcaption>صورة الوثيقة</figcaption><a href={row.identity_image_url} target="_blank" rel="noreferrer"><img src={row.identity_image_url} alt="صورة وثيقة الطالب" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#fff', borderRadius: 8 }} /></a></figure>
        <figure style={{ margin: 0 }}><figcaption>الصورة الشخصية</figcaption><a href={row.personal_image_url} target="_blank" rel="noreferrer"><img src={row.personal_image_url} alt="الصورة الشخصية للطالب" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#fff', borderRadius: 8 }} /></a></figure>
      </div>
      {row.status === 'pending' && <><textarea rows={3} value={notes[row.id] || ''} onChange={e => setNotes(v => ({ ...v, [row.id]: e.target.value }))} placeholder="ملاحظة للطالب (مطلوبة عند الرفض)" style={ui.input} /><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button disabled={busy === row.id} onClick={() => decide(row, 'approved')} style={{ ...ui.button, background: '#15803d' }}>موافقة على الصور</button><button disabled={busy === row.id} onClick={() => decide(row, 'rejected')} style={{ ...ui.button, background: '#b91c1c' }}>رفض وطلب صور أوضح</button></div></>}
      {row.reviewer_note && <p><b>ملاحظة المسجل:</b> {row.reviewer_note}</p>}
      <small style={{ color: '#9fb2cc' }}>تاريخ الطلب: {row.created_at ? new Date(row.created_at).toLocaleString('ar') : '—'}</small>
    </article>)}
  </section>;
}
