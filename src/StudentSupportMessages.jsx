import React, { useEffect, useMemo, useRef, useState } from 'react';
import { playStudentIncomingMessageSound, playMessageSentSound } from './soundUtils';

const BUCKET = 'student-support-messages';
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const EMOJIS = ['😀','😊','😂','😍','🥰','👍','👏','🙏','❤️','💙','💚','✨','🎉','✅','❓','⚠️','📚','📝','💡','📎'];

const clean = (v) => String(v ?? '').trim();
const studentName = (s) => s?.full_name_ar || s?.full_name || s?.name || 'طالب غير معروف';
const seatNumber = (s) => s?.seating_number || s?.seat_number || s?.seat || '—';
const branchName = (s, branches) => {
  const id = s?.branch_id;
  if (id != null) {
    const b = branches.find(x => Number(x.id) === Number(id));
    if (b) return b.branch_name || b.name || b.title || `فرع ${b.id}`;
  }
  return clean(s?.branch_name || s?.branch) || '—';
};
const directorateName = (s) => clean(s?.directorate_name || s?.directorate || s?.management_name) || '—';
const schoolName = (s) => clean(s?.school_name || s?.school) || '—';
const formatDateTime = (v) => v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short', numberingSystem: 'latn' }) : '—';

export default function StudentSupportMessages({ supabase, styles = {}, showAlertMessage }) {
  const currentEmployeeId = Number(localStorage.getItem('currentUserId') || 0);
  const [employee, setEmployee] = useState(null);
  const [students, setStudents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [messages, setMessages] = useState([]);
  const [box, setBox] = useState('inbox');
  const [recipientType, setRecipientType] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedDirectorate, setSelectedDirectorate] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [subject, setSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [success, setSuccess] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const knownIds = useRef(new Set());

  const loadData = async (showLoader = false) => {
    if (!currentEmployeeId) return;
    if (showLoader) setLoading(true);
    try {
      const [empRes, studentsRes, branchesRes, messagesRes] = await Promise.all([
        supabase.from('employees').select('id, full_name, username, job_id, is_active').eq('id', currentEmployeeId).maybeSingle(),
        supabase.from('students').select('*').order('id', { ascending: false }),
        supabase.from('branches').select('*').order('id'),
        supabase.from('student_support_messages').select('*').order('created_at', { ascending: false })
      ]);
      if (empRes.error) throw empRes.error;
      if (studentsRes.error) throw studentsRes.error;
      if (branchesRes.error) throw branchesRes.error;
      if (messagesRes.error) throw messagesRes.error;
      setEmployee(empRes.data || null);
      setStudents(studentsRes.data || []);
      setBranches(branchesRes.data || []);
      const rows = messagesRes.data || [];
      rows.forEach(r => r?.id != null && knownIds.current.add(r.id));
      setMessages(rows);
    } catch (e) {
      console.error(e);
      showAlertMessage?.(e.message || 'تعذر تحميل مراسلات الطلاب.', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    loadData(true);
    const timer = setInterval(() => loadData(false), 15000);
    const channel = supabase?.channel(`student-support-${currentEmployeeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'student_support_messages' }, payload => {
        const row = payload?.new;
        if (!row || Number(row.sender_employee_id) === currentEmployeeId) return;
        if (row.id != null && knownIds.current.has(row.id)) return;
        if (row.id != null) knownIds.current.add(row.id);
        setMessages(prev => prev.some(x => String(x.id) === String(row.id)) ? prev : [row, ...prev]);
        if (row.sender_type === 'student') playStudentIncomingMessageSound();
      })
      .subscribe();
    return () => { clearInterval(timer); if (channel) supabase.removeChannel(channel); };
  }, [currentEmployeeId, supabase]);

  const directorates = useMemo(() => [...new Set(students.map(s => directorateName(s)).filter(x => x !== '—'))].sort((a,b)=>a.localeCompare(b,'ar')), [students]);
  const schools = useMemo(() => [...new Set(students.map(s => schoolName(s)).filter(x => x !== '—'))].sort((a,b)=>a.localeCompare(b,'ar')), [students]);

  const studentOptions = useMemo(() => {
    const q = clean(studentSearch).toLowerCase();
    if (!q) return students.slice(0, 100);
    return students.filter(s => [studentName(s), seatNumber(s), s?.national_id, s?.id].join(' ').toLowerCase().includes(q)).slice(0, 100);
  }, [students, studentSearch]);

  const targetStudents = useMemo(() => {
    if (recipientType === 'student') return students.filter(s => String(s.id) === String(selectedStudent));
    if (recipientType === 'branch') return students.filter(s => String(s.branch_id ?? s.branch) === String(selectedBranch));
    if (recipientType === 'directorate') return students.filter(s => directorateName(s) === selectedDirectorate);
    if (recipientType === 'school') return students.filter(s => schoolName(s) === selectedSchool);
    return students;
  }, [recipientType, selectedStudent, selectedBranch, selectedDirectorate, selectedSchool, students]);

  const filteredMessages = useMemo(() => {
    let list = messages;
    if (box === 'inbox') list = messages.filter(m => m.sender_type === 'student' && !m.is_read && !m.recipient_deleted_at);
    if (box === 'read') list = messages.filter(m => m.sender_type === 'student' && m.is_read && !m.recipient_deleted_at);
    if (box === 'sent') list = messages.filter(m => m.sender_type === 'support' && Number(m.sender_employee_id) === currentEmployeeId && !m.sender_deleted_at);
    if (box === 'trash') list = messages.filter(m => m.recipient_deleted_at || m.sender_deleted_at);
    const q = clean(search).toLowerCase();
    if (!q) return list;
    return list.filter(m => {
      const s = students.find(x => Number(x.id) === Number(m.student_id));
      return [studentName(s), seatNumber(s), branchName(s, branches), directorateName(s), schoolName(s), m.subject, m.message]
        .join(' ').toLowerCase().includes(q);
    });
  }, [messages, box, search, students, branches, currentEmployeeId]);

  const unreadCount = messages.filter(m => m.sender_type === 'student' && !m.is_read && !m.recipient_deleted_at).length;

  const chooseMessage = async (message) => {
    setSelectedMessage(message);
    if (message.sender_type === 'student' && !message.is_read) {
      const now = new Date().toISOString();
      const { error } = await supabase.from('student_support_messages').update({ is_read: true, read_at: now }).eq('id', message.id).eq('sender_type', 'student');
      if (!error) setMessages(prev => prev.map(m => m.id === message.id ? { ...m, is_read: true, read_at: now } : m));
    }
  };

  const sendMessage = async () => {
    if (!subject.trim()) return alert('اكتب عنوان الرسالة.');
    if (!messageText.trim() && !attachment) return alert('اكتب الرسالة أو أرفق ملفاً.');
    if (!targetStudents.length) return alert('لا يوجد طلاب مطابقون للخيار المحدد.');
    if (attachment && attachment.size > MAX_FILE_SIZE) return alert('حجم المرفق يجب ألا يتجاوز 25MB.');
    setSending(true);
    try {
      let attachmentPath = null, attachmentName = null, attachmentMime = null, attachmentSize = null;
      if (attachment) {
        const safeName = attachment.name.replace(/[^a-zA-Z0-9._-\u0600-\u06FF]/g, '_');
        const path = `support/${currentEmployeeId}/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, attachment, { upsert: false, contentType: attachment.type || undefined });
        if (error) throw error;
        attachmentPath = path; attachmentName = attachment.name; attachmentMime = attachment.type || 'application/octet-stream'; attachmentSize = attachment.size;
      }
      const now = new Date().toISOString();
      const payloads = targetStudents.map(s => ({
        student_id: s.id, sender_type: 'support', sender_employee_id: currentEmployeeId,
        subject: subject.trim(), message: messageText.trim(), attachment_path: attachmentPath,
        attachment_name: attachmentName, attachment_mime: attachmentMime, attachment_size: attachmentSize,
        delivered_at: now, is_read: false, read_at: null, sender_deleted_at: null, recipient_deleted_at: null
      }));
      const { data, error } = await supabase.from('student_support_messages').insert(payloads).select('*');
      if (error) throw error;
      setMessages(prev => [...(data || []), ...prev]);
      setSubject(''); setMessageText(''); setAttachment(null); setReplyingTo(null);
      const input = document.getElementById('student-support-attachment'); if (input) input.value = '';
      playMessageSentSound();
      setSuccess(`تم إرسال الرسالة إلى ${targetStudents.length === students.length ? 'جميع الطلاب' : `${targetStudents.length} طالب`} ✓`);
      setTimeout(() => setSuccess(''), 2500);
    } catch (e) { console.error(e); alert(e.message || 'تعذر إرسال الرسالة.'); }
    finally { setSending(false); }
  };

  const replyToStudent = (message) => {
    const s = students.find(x => Number(x.id) === Number(message.student_id));
    setReplyingTo(s || null); setRecipientType('student'); setSelectedStudent(String(message.student_id)); setStudentSearch(seatNumber(s) === '—' ? studentName(s) : String(seatNumber(s))); 
    setSubject(message.subject ? `رد: ${message.subject}` : 'رد على استفسارك');
    setMessageText(''); setSelectedMessage(null); setBox('sent');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteMessage = async (message) => {
    const field = message.sender_type === 'support' && Number(message.sender_employee_id) === currentEmployeeId ? 'sender_deleted_at' : 'recipient_deleted_at';
    const now = new Date().toISOString();
    const { error } = await supabase.from('student_support_messages').update({ [field]: now }).eq('id', message.id);
    if (error) return alert(error.message);
    setMessages(prev => prev.map(m => m.id === message.id ? { ...m, [field]: now } : m));
    setSelectedMessage(null);
  };

  const openAttachment = async (message) => {
    if (!message.attachment_path) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(message.attachment_path, 300);
    if (error) return alert(error.message || 'تعذر فتح المرفق.');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const appendEmoji = (emoji) => { setMessageText(v => `${v}${emoji}`); setShowEmojiPicker(false); };
  const getStudent = id => students.find(s => Number(s.id) === Number(id));

  return (
    <div dir="rtl" style={{ ...styles.page, minHeight: '100%', padding: 18, background: '#07152f', color: '#e5f3ff' }}>
      <div style={ui.header}>
        <div><div style={ui.eyebrow}>وظيفة دعم فني</div><h2 style={ui.title}>🎧 مراسلات الطلاب</h2><p style={ui.sub}>استقبال استفسارات الطلاب والرد عليها ومتابعة التسليم والقراءة.</p></div>
        <button onClick={() => loadData(true)} style={ui.refresh}>🔄 تحديث</button>
      </div>

      <div style={ui.compose}>
        <div style={ui.sender}><b>مرسلة من</b><span>🎧 دعم فني</span></div>
        {replyingTo && <div style={ui.replyNote}>↩️ الرد على الطالب: <b>{studentName(replyingTo)}</b> — رقم الجلوس: {seatNumber(replyingTo)}</div>}
        <div style={ui.grid4}>
          <label>إلى
            <select value={recipientType} onChange={e => { setRecipientType(e.target.value); setSelectedStudent(''); }} style={ui.input}>
              <option value="all">جميع الطلاب</option><option value="branch">الفرع</option><option value="directorate">المديرية</option><option value="school">المدرسة</option><option value="student">طالب</option>
            </select>
          </label>
          {recipientType === 'branch' && <label>الفرع<select value={selectedBranch} onChange={e=>setSelectedBranch(e.target.value)} style={ui.input}><option value="">اختر الفرع</option>{branches.map(b=><option key={b.id} value={b.id}>{b.branch_name||b.name||b.title}</option>)}</select></label>}
          {recipientType === 'directorate' && <label>المديرية<select value={selectedDirectorate} onChange={e=>setSelectedDirectorate(e.target.value)} style={ui.input}><option value="">اختر المديرية</option>{directorates.map(x=><option key={x} value={x}>{x}</option>)}</select></label>}
          {recipientType === 'school' && <label>المدرسة<select value={selectedSchool} onChange={e=>setSelectedSchool(e.target.value)} style={ui.input}><option value="">اختر المدرسة</option>{schools.map(x=><option key={x} value={x}>{x}</option>)}</select></label>}
          {recipientType === 'student' && <label>الطالب<div style={{display:'grid',gap:6,marginTop:5}}><input value={studentSearch} onChange={e=>{setStudentSearch(e.target.value);setSelectedStudent('')}} placeholder="🔎 ابحث برقم الجلوس أو اسم الطالب..." style={ui.input}/><select value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)} style={ui.input}><option value="">اختر الطالب</option>{studentOptions.map(s=><option key={s.id} value={s.id}>{studentName(s)} — رقم الجلوس: {seatNumber(s)}</option>)}</select></div></label>}
        </div>
        <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="عنوان الرسالة" style={ui.input}/>
        <textarea value={messageText} onChange={e=>setMessageText(e.target.value)} placeholder="اكتب الرسالة هنا..." style={ui.textarea}/>
        <div style={ui.tools}>
          <button type="button" onClick={()=>setShowEmojiPicker(v=>!v)} style={ui.tool}>😊 الإيموجي</button>
          <label style={ui.tool}>📎 المرفقات<input id="student-support-attachment" type="file" hidden onChange={e=>setAttachment(e.target.files?.[0] || null)}/></label>
          {attachment && <span style={ui.file}>{attachment.name}</span>}
          <button type="button" onClick={sendMessage} disabled={sending} style={ui.send}>{sending ? '⏳ جارٍ الإرسال...' : '📨 إرسال'}</button>
        </div>
        {showEmojiPicker && <div style={ui.emoji}>{EMOJIS.map(e=><button key={e} type="button" onClick={()=>appendEmoji(e)}>{e}</button>)}</div>}
      </div>

      <div style={ui.tabs}>
        {[["inbox","📥 صندوق الوارد"],["sent","📤 صندوق الصادر"],["trash","🗑️ سلة المحذوفات"],["read","📖 الرسائل المقروءة"]].map(([key,label])=><button key={key} onClick={()=>{setBox(key);setSelectedMessage(null)}} style={{...ui.tab,...(box===key?ui.tabActive:{})}}>{label}{key==='inbox'&&unreadCount>0?<b style={ui.badge}>{unreadCount}</b>:null}</button>)}
      </div>

      {success && <div style={ui.success}>{success}</div>}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔎 بحث باسم الطالب أو رقم الجلوس أو عنوان الرسالة..." style={ui.search}/>

      <div style={ui.card}>
        {loading ? <div style={ui.empty}>⏳ جاري تحميل الرسائل...</div> : filteredMessages.length === 0 ? <div style={ui.empty}>لا توجد رسائل في هذا الصندوق.</div> : (
          <div style={{ overflowX: 'auto' }}><table style={ui.table}><thead><tr>
            <th>مسلسل</th><th>اسم المرسل</th><th>اسم الطالب</th><th>رقم الجلوس</th><th>الفرع</th><th>المديرية</th><th>المدرسة</th><th>عنوان المسج</th><th>المسج</th><th>الإرسال</th><th>التسليم</th><th>القراءة</th><th>الهاتف</th><th>المرفقات</th>{box==='inbox'&&<th>الرد</th>}
          </tr></thead><tbody>{filteredMessages.map((m,i)=>{const s=getStudent(m.student_id); return <tr key={m.id} onClick={()=>chooseMessage(m)} style={{cursor:'pointer', background:m.is_read?'transparent':'rgba(56,189,248,.08)'}}>
            <td>{i+1}</td><td>{m.sender_type==='support'?'دعم فني':'الطالب'}</td><td>{studentName(s)}</td><td>{seatNumber(s)}</td><td>{branchName(s,branches)}</td><td>{directorateName(s)}</td><td>{schoolName(s)}</td><td>{m.subject||'—'}</td><td style={{maxWidth:260,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.message||'—'}</td><td>{formatDateTime(m.created_at)}</td><td>{m.delivered_at?'✓':'—'}</td><td>{m.is_read?'✓':'—'}</td><td>{s?.phone || s?.mobile || s?.phone_number || '—'}</td><td>{m.attachment_path?<button type="button" onClick={e=>{e.stopPropagation();openAttachment(m)}} style={ui.link}>📎</button>:'—'}</td>{box==='inbox'&&<td><button type="button" onClick={e=>{e.stopPropagation();replyToStudent(m)}} style={ui.reply}>↩️ رد</button></td>}
          </tr>})}</tbody></table></div>
        )}
      </div>

      {selectedMessage && (()=>{const s=getStudent(selectedMessage.student_id); return <div style={ui.modalOverlay} onClick={()=>setSelectedMessage(null)}><div style={ui.modal} onClick={e=>e.stopPropagation()}>
        <div style={ui.modalHead}><h3>📨 تفاصيل الرسالة</h3><button onClick={()=>setSelectedMessage(null)} style={ui.close}>✕</button></div>
        <p><b>المرسل:</b> {selectedMessage.sender_type==='support'?'دعم فني':'الطالب'}</p><p><b>الطالب:</b> {studentName(s)} — <b>رقم الجلوس:</b> {seatNumber(s)}</p><p><b>الهاتف:</b> {s?.phone || s?.mobile || s?.phone_number || '—'}</p><p><b>العنوان:</b> {selectedMessage.subject}</p><div style={ui.messageBody}>{selectedMessage.message}</div>
        <div style={ui.modalActions}>{selectedMessage.sender_type==='student'&&<button onClick={()=>replyToStudent(selectedMessage)} style={ui.reply}>↩️ الرد على الطالب</button>}{selectedMessage.attachment_path&&<button onClick={()=>openAttachment(selectedMessage)} style={ui.tool}>📎 فتح المرفق</button>}<button onClick={()=>deleteMessage(selectedMessage)} style={ui.delete}>🗑️ حذف</button></div>
      </div></div>})()}
    </div>
  );
}

const ui = {
  header:{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',padding:20,borderRadius:16,background:'linear-gradient(135deg,#0b2450,#155e75)',border:'1px solid rgba(56,189,248,.3)',marginBottom:16},
  eyebrow:{color:'#67e8f9',fontWeight:800,fontSize:12}, title:{margin:'4px 0',fontSize:25}, sub:{margin:0,color:'#bae6fd'},refresh:{border:0,borderRadius:10,padding:'10px 15px',background:'#0284c7',color:'#fff',fontWeight:800,cursor:'pointer'},
  compose:{background:'#0a1d3a',border:'1px solid rgba(56,189,248,.2)',borderRadius:16,padding:18,marginBottom:14}, sender:{display:'flex',gap:15,alignItems:'center',marginBottom:10}, senderValue:{}, replyNote:{background:'rgba(14,116,144,.18)',padding:10,borderRadius:10,marginBottom:10,color:'#bae6fd'}, grid4:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10}, input:{width:'100%',boxSizing:'border-box',marginTop:5,padding:11,borderRadius:9,border:'1px solid #31557b',background:'#06142c',color:'#fff',outline:'none'}, textarea:{width:'100%',boxSizing:'border-box',marginTop:10,minHeight:120,padding:12,borderRadius:10,border:'1px solid #31557b',background:'#06142c',color:'#fff',resize:'vertical'}, tools:{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:10},tool:{border:'1px solid #31557b',borderRadius:9,padding:'9px 12px',background:'#12345f',color:'#fff',cursor:'pointer',fontWeight:700},file:{color:'#7dd3fc',fontSize:12},send:{marginRight:'auto',border:0,borderRadius:10,padding:'10px 18px',background:'#0891b2',color:'#fff',fontWeight:900,cursor:'pointer'},emoji:{display:'flex',flexWrap:'wrap',gap:4,padding:10,background:'#06142c',borderRadius:10,marginTop:8},emojiButton:{},tabs:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12},tab:{border:'1px solid #31557b',background:'#0a1d3a',color:'#cfeeff',borderRadius:10,padding:'10px 14px',cursor:'pointer',fontWeight:800},tabActive:{background:'#075985',borderColor:'#38bdf8'},badge:{marginRight:6,background:'#ef4444',borderRadius:999,padding:'2px 7px',fontSize:11},success:{padding:12,background:'#065f46',color:'#d1fae5',borderRadius:10,marginBottom:10,fontWeight:800},search:{width:'100%',boxSizing:'border-box',padding:12,borderRadius:10,border:'1px solid #31557b',background:'#06142c',color:'#fff',marginBottom:10},card:{background:'#0a1d3a',border:'1px solid rgba(56,189,248,.2)',borderRadius:16,padding:12},empty:{padding:35,textAlign:'center',color:'#94a3b8'},table:{width:'100%',borderCollapse:'collapse',fontSize:12},link:{border:0,background:'transparent',color:'#7dd3fc',cursor:'pointer',fontSize:18},reply:{border:0,borderRadius:7,padding:'6px 9px',background:'#0e7490',color:'#fff',cursor:'pointer',fontWeight:800},delete:{border:0,borderRadius:7,padding:'6px 9px',background:'#991b1b',color:'#fff',cursor:'pointer'},modalOverlay:{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:5000,padding:20},modal:{width:'min(720px,95vw)',maxHeight:'85vh',overflowY:'auto',background:'#0a1d3a',border:'1px solid #38bdf8',borderRadius:16,padding:20,color:'#e5f3ff'},modalHead:{display:'flex',justifyContent:'space-between',alignItems:'center'},close:{border:0,background:'#334155',color:'#fff',borderRadius:8,padding:7,cursor:'pointer'},messageBody:{whiteSpace:'pre-wrap',background:'#06142c',padding:15,borderRadius:10,lineHeight:1.8},modalActions:{display:'flex',gap:8,justifyContent:'flex-start',marginTop:15}
};
