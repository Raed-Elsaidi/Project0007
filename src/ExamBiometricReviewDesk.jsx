import React, { useCallback, useEffect, useState } from 'react';

const styles = {
  panel:{direction:'rtl',color:'#eaf2ff',background:'#0b1730',border:'1px solid #29466d',borderRadius:16,padding:16,width:'100%',boxSizing:'border-box'},
  button:{border:0,borderRadius:8,padding:'9px 13px',color:'#fff',fontWeight:700,cursor:'pointer',font:'inherit'},
  input:{width:'100%',boxSizing:'border-box',borderRadius:8,padding:10,font:'inherit',margin:'8px 0'}
};
export default function ExamBiometricReviewDesk({supabase,currentUser,onBack,onPendingCountChange}) {
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(''),[notes,setNotes]=useState({}),[filter,setFilter]=useState('pending'),[images,setImages]=useState({});
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  const {data,error:rpcError}=await supabase.rpc('list_exam_biometric_manual_reviews',{p_employee_id:Number(currentUser?.id)});
  if(rpcError){setError(`تعذر تحميل طلبات مراجعة الوجه: ${rpcError.message}`);setRows([]);onPendingCountChange?.(0);setLoading(false);return;}
  const list=Array.isArray(data)?data:[];setRows(list);onPendingCountChange?.(list.filter(row=>row?.status==='pending').length);
  const liveImages={};
  for(const row of list){ if(row.live_image_data_url) liveImages[row.id]=row.live_image_data_url; }
  setImages(liveImages);setLoading(false);
 },[supabase,currentUser?.id]);
 useEffect(()=>{load();},[load]);
 const decide=async(row,decision)=>{
  const note=String(notes[row.id]||'').trim();
  if(decision==='rejected'&&!note){setError('اكتب سبب الرفض حتى يعرف الطالب الإجراء المطلوب.');return;}
  setBusy(row.id);setError('');
  const {error:rpcError}=await supabase.rpc('review_exam_biometric_manual_review',{p_request_id:row.id,p_employee_id:Number(currentUser?.id),p_decision:decision,p_note:note||null});
  if(rpcError)setError(`تعذر حفظ القرار: ${rpcError.message}`);
  else {setNotes(v=>({...v,[row.id]:''}));await load();}
  setBusy('');
 };
 const visible=rows.filter(r=>filter==='all'||r.status===filter);
 return <section style={styles.panel}>
  <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
   <div><h2 style={{margin:'0 0 6px',color:'#60b9ff'}}>مراجعة التحقق من وجه الطالب قبل الامتحان</h2><p style={{margin:0,color:'#a9bdd8'}}>راجع الصورة الحية مقابل الصورة المسجلة، ثم اتخذ القرار. الصورة الحية محفوظة داخل سجل المراجعة ولا تظهر إلا في شاشة المراجعة.</p></div>
   <div style={{display:'flex',gap:8}}><button style={{...styles.button,background:'#1e4f91'}} onClick={load}>↻ تحديث</button>{onBack&&<button style={{...styles.button,background:'#334155'}} onClick={onBack}>رجوع</button>}</div>
  </header>
  <nav style={{display:'flex',gap:8,flexWrap:'wrap',margin:'16px 0'}}>{[['pending','قيد المراجعة'],['approved','موافق عليها'],['rejected','مرفوضة'],['all','الكل']].map(([v,l])=><button key={v} onClick={()=>setFilter(v)} style={{...styles.button,background:filter===v?'#1d64d8':'#172b49'}}>{l}</button>)}</nav>
  {error&&<p role="alert" style={{color:'#fecaca',background:'#451d2a',padding:10,borderRadius:8}}>{error}</p>}
  {loading?<p>جاري تحميل الطلبات...</p>:visible.length===0?<p style={{color:'#a9bdd8'}}>لا توجد طلبات في هذه القائمة.</p>:visible.map(row=><article key={row.id} style={{background:'#101f39',border:'1px solid #334d70',borderRadius:12,padding:12,marginTop:12}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><strong>الطالب: {row.student_name||`رقم الطالب ${row.student_id}`} — رقم الهوية: {row.national_id||'—'}</strong><span>{row.status==='pending'?'قيد المراجعة':row.status==='approved'?'تمت الموافقة':'مرفوض'}</span></div>
   <p><b>الامتحان:</b> {row.exam_title||row.exam_id||'—'}　<b>الدرجة:</b> {row.match_score??'—'}%　<b>المسافة:</b> {row.distance??'—'}　<b>الحد:</b> {row.threshold??'—'}</p>
   <p style={{color:'#fbbf24'}}><b>سبب الإحالة:</b> {row.failure_reason||'لم تحقق المطابقة الحد المطلوب'}</p>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
    <figure style={{margin:0}}><figcaption>الصورة الحية أثناء محاولة الامتحان</figcaption>{images[row.id]?<a href={images[row.id]} target="_blank" rel="noreferrer"><img src={images[row.id]} alt="الصورة الحية" style={{width:'100%',maxHeight:340,objectFit:'contain',background:'#fff',borderRadius:8}}/></a>:<p>تعذر تحميل الصورة المؤقتة.</p>}</figure>
    <figure style={{margin:0}}><figcaption>الصورة الشخصية المسجلة</figcaption>{row.personal_image_url?<a href={row.personal_image_url} target="_blank" rel="noreferrer"><img src={row.personal_image_url} alt="الصورة المسجلة" style={{width:'100%',maxHeight:340,objectFit:'contain',background:'#fff',borderRadius:8}}/></a>:<p>لا يوجد رابط للصورة الشخصية.</p>}</figure>
   </div>
   {row.status==='pending'&&<><textarea rows={3} value={notes[row.id]||''} onChange={e=>setNotes(v=>({...v,[row.id]:e.target.value}))} placeholder="ملاحظة أو سبب الرفض (مطلوب عند الرفض)" style={styles.input}/><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={busy===row.id} onClick={()=>decide(row,'approved')} style={{...styles.button,background:'#15803d'}}>اعتماد التحقق والسماح بالمتابعة</button><button disabled={busy===row.id} onClick={()=>decide(row,'rejected')} style={{...styles.button,background:'#b91c1c'}}>رفض التحقق</button></div></>}
   {row.reviewer_note&&<p><b>ملاحظة المسجّل:</b> {row.reviewer_note}</p>}
   <small style={{color:'#9fb2cc'}}>تاريخ المحاولة: {row.created_at?new Date(row.created_at).toLocaleString('ar'):'—'}</small>
  </article>)}
 </section>;
}
