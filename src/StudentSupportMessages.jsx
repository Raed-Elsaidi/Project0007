import React, { useEffect, useMemo, useRef, useState } from 'react';
import { playStudentIncomingMessageSound, playMessageSentSound } from './soundUtils';

const BUCKET = 'student-support-messages';
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const EMOJIS = ['😀','😊','😂','😍','🥰','👍','👏','🙏','❤️','💙','💚','✨','🎉','✅','❓','⚠️','📚','📝','💡','📎'];

const clean = (v) => String(v ?? '').trim();
const studentName = (s) => s?.full_name_ar || s?.full_name || s?.student_name || s?.arabic_name || s?.name || 'طالب غير معروف';
const seatNumber = (s) => s?.seating_number || s?.seat_number || s?.seat || s?.seat_no || '—';
const nationalId = (s) => clean(s?.national_id || s?.identity_number || s?.id_number) || '—';
const studentPhone = (s) => clean(s?.phone_number || s?.phone || s?.mobile || s?.whatsapp_number) || '—';
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

export default function StudentSupportMessages({ supabase, styles = {}, showAlertMessage, onUnreadCountChange }) {
  const currentEmployeeId = Number(localStorage.getItem('currentUserId') || 0);
  const [employee, setEmployee] = useState(null);
  const [students, setStudents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [directorateRows, setDirectorateRows] = useState([]);
  const [schoolRows, setSchoolRows] = useState([]);
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
  const staffToken = () => localStorage.getItem('studentSupportStaffToken') || '';
  const supportApi = async (payload) => {
    const token = staffToken();
    if (!token) throw new Error('جلسة صندوق دعم الطلاب غير جاهزة. سجّل الخروج ثم الدخول مجددًا، وتأكد من نشر دالة staff-support-api.');
    const { data, error } = await supabase.functions.invoke('staff-support-api', {
      body: payload,
      headers: { Authorization: `Bearer ${token}` }
    });
    if (error) throw new Error(error.message || 'تعذر الاتصال بخدمة مراسلات الدعم.');
    if (!data?.ok) throw new Error(data?.error || 'تعذر تنفيذ العملية.');
    return data;
  };

  const loadData = async (showLoader = false) => {
    if (!currentEmployeeId) return;
    if (showLoader) setLoading(true);
    try {
      const [empRes, recipientsResult, supportResult] = await Promise.all([
        supabase.from('employees').select('id, full_name, username, job_id, is_active').eq('id', currentEmployeeId).maybeSingle(),
        supportApi({ action: 'recipients' }),
        supportApi({ action: 'list' })
      ]);
      if (empRes.error) throw empRes.error;
      setEmployee(empRes.data || null);
      setStudents(recipientsResult.students || []);
      setBranches(recipientsResult.branches || []);
      setDirectorateRows(recipientsResult.directorates || []);
      setSchoolRows(recipientsResult.schools || []);
      const rows = supportResult.messages || [];
      rows.forEach(r => r?.id != null && knownIds.current.add(r.id));
      setMessages(rows);

      // staff-support-api يعيد student_data لكل رسالة، بما فيها الطالب غير المسجل
      // بعد البحث عنه في allow_student بصلاحيات الخادم، لتجنب مشاكل RLS في المتصفح.
    } catch (e) {
      console.error(e);
      showAlertMessage?.(e.message || 'تعذر تحميل مراسلات الطلاب.', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    loadData(true);
    const timer = setInterval(() => loadData(false), 15000);
    // التحديث الدوري يستخدم واجهة الخادم الآمنة؛ لا نعتمد على RLS أو Realtime للموظف.
    return () => clearInterval(timer);
  }, [currentEmployeeId, supabase]);

  const directorates = useMemo(() => directorateRows
    .filter(x => x.is_active !== false)
    .sort((a,b) => String(a.directorate_name || '').localeCompare(String(b.directorate_name || ''), 'ar')),
    [directorateRows]);
  const schools = useMemo(() => schoolRows
    .filter(x => x.is_active !== false && (!selectedDirectorate || String(x.directorate_id) === String(selectedDirectorate)))
    .sort((a,b) => String(a.school_name || '').localeCompare(String(b.school_name || ''), 'ar')),
    [schoolRows, selectedDirectorate]);


  const studentOptions = useMemo(() => {
    const q = clean(studentSearch).toLowerCase();
    if (!q) return students.slice(0, 100);
    return students.filter(s => [studentName(s), seatNumber(s), s?.national_id, s?.id].join(' ').toLowerCase().includes(q)).slice(0, 100);
  }, [students, studentSearch]);

  const targetStudents = useMemo(() => {
    if (recipientType === 'student') return students.filter(s => String(s.id) === String(selectedStudent));
    if (recipientType === 'branch') return students.filter(s => String(s.branch_id ?? s.branch) === String(selectedBranch));
    if (recipientType === 'directorate') return students.filter(s => String(s.directorate_id ?? '') === String(selectedDirectorate));
    if (recipientType === 'school') return students.filter(s => String(s.school_id ?? '') === String(selectedSchool));
    return students;
  }, [recipientType, selectedStudent, selectedBranch, selectedDirectorate, selectedSchool, students]);

  const filteredMessages = useMemo(() => {
    let list = messages;
    if (box === 'inbox') list = messages.filter(m => m.sender_type !== 'support' && !m.recipient_deleted_at);
    if (box === 'read') list = messages.filter(m => m.sender_type !== 'support' && m.is_read && !m.recipient_deleted_at);
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

  const unreadCount = messages.filter(m => m.sender_type !== 'support' && !m.is_read && !m.recipient_deleted_at).length;

  // اجعل عداد القائمة الجانبية مطابقًا تمامًا لعداد صندوق الوارد
  // المحسوب من نفس الرسائل المحمّلة ونفس شروط الاستبعاد.
  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  const chooseMessage = async (message) => {
    setSelectedMessage(message);
    if (message.sender_type !== 'support' && !message.is_read) {
      try {
        await supportApi({ action: 'mark-read', message_id: message.id });
        const now = new Date().toISOString();
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, is_read: true, read_at: now } : m));
      } catch (error) { showAlertMessage?.(error.message, 'error'); }
    }
  };

  const sendMessage = async () => {
    if (!subject.trim()) return alert('اكتب عنوان الرسالة.');
    if (!messageText.trim() && !attachment) return alert('اكتب الرسالة أو أرفق ملفاً.');
    if (!replyingTo?._supportReplyToId && !targetStudents.length) return alert('لا يوجد طلاب مطابقون للخيار المحدد.');
    if (attachment && attachment.size > MAX_FILE_SIZE) return alert('حجم المرفق يجب ألا يتجاوز 25MB.');
    setSending(true);
    try {
      let attachmentPayload = null;
      if (attachment) {
        const bytes = new Uint8Array(await attachment.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        attachmentPayload = { name: attachment.name, mime: attachment.type || 'application/octet-stream', base64: btoa(binary) };
      }
      const result = await supportApi({
        action: 'send',
        subject: subject.trim(),
        message: messageText.trim(),
        student_ids: replyingTo?._supportReplyToId ? undefined : targetStudents.map(s => s.id),
        reply_to_id: replyingTo?._supportReplyToId || undefined,
        attachment: attachmentPayload
      });
      const data = result.messages || [];
      setMessages(prev => [...data, ...prev]);
      setSubject(''); setMessageText(''); setAttachment(null); setReplyingTo(null);
      const input = document.getElementById('student-support-attachment'); if (input) input.value = '';
      playMessageSentSound();
      setSuccess(replyingTo?._supportReplyToId ? 'تم إرسال الرد إلى الطالب صاحب الرسالة ✓' : `تم إرسال الرسالة إلى ${targetStudents.length === students.length ? 'جميع الطلاب' : `${targetStudents.length} طالب`} ✓`);
      setTimeout(() => setSuccess(''), 2500);
    } catch (e) { console.error(e); alert(e.message || 'تعذر إرسال الرسالة.'); }
    finally { setSending(false); }
  };

  const replyToStudent = (message) => {
    // اربط الرد بالرسالة الأصلية نفسها؛ هذا يدعم المسجل وغير المسجل.
    const s = getMessageStudent(message);
    const replyStudent = {
      ...(s || {}),
      id: message.student_id ?? s?.id ?? null,
      national_id: message.national_id || s?.national_id || null,
      _supportReplyToId: message.id
    };
    setReplyingTo(replyStudent);
    setRecipientType('student');
    setSelectedStudent(message.student_id != null ? String(message.student_id) : '');
    setStudentSearch(seatNumber(replyStudent) === '—' ? studentName(replyStudent) : String(seatNumber(replyStudent)));
    setSubject(message.subject ? `رد: ${message.subject}` : 'رد على استفسارك');
    setMessageText('');
    setSelectedMessage(null);
    setBox('inbox');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteMessage = async (message) => {
    const field = message.sender_type === 'support' && Number(message.sender_employee_id) === currentEmployeeId ? 'sender_deleted_at' : 'recipient_deleted_at';
    const now = new Date().toISOString();
    try {
      const result = await supportApi({ action: 'delete', message_id: message.id });
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, [field]: result[field] || now } : m));
      setSelectedMessage(null);
    } catch (error) { alert(error.message); }
  };

  const openAttachment = async (message) => {
    if (!message.attachment_path) return;
    try {
      const result = await supportApi({ action: 'attachment-url', message_id: message.id });
      window.open(result.signed_url, '_blank', 'noopener,noreferrer');
    } catch (error) { alert(error.message || 'تعذر فتح المرفق.'); }
  };

  const appendEmoji = (emoji) => { setMessageText(v => `${v}${emoji}`); setShowEmojiPicker(false); };
  const getStudent = id => students.find(s => Number(s.id) === Number(id));
  const getMessageStudent = message => {
    // بيانات الطالب المرفقة من الدالة الآمنة تشمل students أو allow_student.
    if (message?.student_data && typeof message.student_data === 'object') return message.student_data;
    return getStudent(message?.student_id) || null;
  };

  return (
    <div dir="rtl" style={{ ...styles.page, minHeight: '100%', padding: 18, background: '#07152f', color: '#e5f3ff' }}>
      <div style={ui.header}>
        <div><div style={ui.eyebrow}>وظيفة دعم فني</div><h2 style={ui.title}>🎧 مراسلات الطلاب</h2><p style={ui.sub}>استقبال استفسارات الطلاب والرد عليها ومتابعة التسليم والقراءة.</p></div>
        <button onClick={() => loadData(true)} style={ui.refresh}>🔄 تحديث</button>
      </div>

      {(box === 'sent' || replyingTo) && <div style={ui.compose}>
        <div style={ui.sender}><b>مرسلة من</b><span>🎧 دعم فني</span></div>
        {replyingTo && <div style={ui.replyStudentCard}>
          <div style={{fontWeight:900,color:'#7dd3fc',marginBottom:9}}>↩️ الرد على صاحب الرسالة الواردة</div>
          <div style={ui.replyStudentGrid}>
            <div><b>اسم الطالب:</b> {studentName(replyingTo)}</div>
            <div><b>رقم الهوية:</b> {nationalId(replyingTo)}</div>
            <div><b>رقم الجلوس:</b> {seatNumber(replyingTo)}</div>
            <div><b>رقم الهاتف:</b> {studentPhone(replyingTo)}</div>
            <div><b>الفرع:</b> {branchName(replyingTo, branches)}</div>
            <div><b>المديرية:</b> {directorateName(replyingTo)}</div>
            <div><b>المدرسة:</b> {schoolName(replyingTo)}</div>
          </div>
          <div style={{fontSize:12,color:'#bae6fd',marginTop:8}}>سيتم إرسال الرد إلى نفس الطالب.</div>
        </div>}
        {!replyingTo && <div style={ui.grid4}>
          <label>إلى
            <select value={recipientType} onChange={e => { setRecipientType(e.target.value); setSelectedStudent(''); setSelectedBranch(''); setSelectedDirectorate(''); setSelectedSchool(''); }} style={ui.input}>
              <option value="all">جميع الطلاب</option><option value="branch">الفرع</option><option value="directorate">المديرية</option><option value="school">المدرسة</option><option value="student">طالب</option>
            </select>
          </label>
          {recipientType === 'branch' && <label>الفرع<select value={selectedBranch} onChange={e=>setSelectedBranch(e.target.value)} style={ui.input}><option value="">اختر الفرع</option>{branches.map(b=><option key={b.id} value={b.id}>{b.branch_name||b.name||b.title}</option>)}</select></label>}
          {recipientType === 'directorate' && <label>المديرية<select value={selectedDirectorate} onChange={e=>{setSelectedDirectorate(e.target.value);setSelectedSchool('')}} style={ui.input}><option value="">اختر المديرية</option>{directorates.map(x=><option key={x.id} value={x.id}>{x.directorate_name}</option>)}</select></label>}
          {recipientType === 'school' && <>
            <label>المديرية<select value={selectedDirectorate} onChange={e=>{setSelectedDirectorate(e.target.value);setSelectedSchool('')}} style={ui.input}><option value="">كل المديريات</option>{directorates.map(x=><option key={x.id} value={x.id}>{x.directorate_name}</option>)}</select></label>
            <label>المدرسة<select value={selectedSchool} onChange={e=>setSelectedSchool(e.target.value)} style={ui.input}><option value="">اختر المدرسة</option>{schools.map(x=><option key={x.id} value={x.id}>{x.school_name}</option>)}</select></label>
          </>}
          {recipientType === 'student' && <label>الطالب<div style={{display:'grid',gap:6,marginTop:5}}><input value={studentSearch} onChange={e=>{setStudentSearch(e.target.value);setSelectedStudent('')}} placeholder="🔎 ابحث برقم الجلوس أو اسم الطالب..." style={ui.input}/><select value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)} style={ui.input}><option value="">اختر الطالب</option>{studentOptions.map(s=><option key={s.id} value={s.id}>{studentName(s)} — رقم الجلوس: {seatNumber(s)}</option>)}</select></div></label>}
        </div>}
        <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="عنوان الرسالة" style={ui.input}/>
        <textarea value={messageText} onChange={e=>setMessageText(e.target.value)} placeholder="اكتب الرسالة هنا..." style={ui.textarea}/>
        <div style={ui.tools}>
          <button type="button" onClick={()=>setShowEmojiPicker(v=>!v)} style={ui.tool}>😊 الإيموجي</button>
          <label style={ui.tool}>📎 المرفقات<input id="student-support-attachment" type="file" hidden onChange={e=>setAttachment(e.target.files?.[0] || null)}/></label>
          {attachment && <span style={ui.file}>{attachment.name}</span>}
          <button type="button" onClick={sendMessage} disabled={sending} style={ui.send}>{sending ? '⏳ جارٍ الإرسال...' : '📨 إرسال'}</button>
        </div>
        {showEmojiPicker && <div style={ui.emoji}>{EMOJIS.map(e=><button key={e} type="button" onClick={()=>appendEmoji(e)}>{e}</button>)}</div>}
      </div>}

      <div style={ui.tabs}>
        {[["inbox","📥 صندوق الوارد"],["sent","📤 صندوق الصادر"],["trash","🗑️ سلة المحذوفات"],["read","📖 الرسائل المقروءة"]].map(([key,label])=><button key={key} onClick={()=>{setBox(key);setSelectedMessage(null);setReplyingTo(null)}} style={{...ui.tab,...(box===key?ui.tabActive:{})}}>{label}{key==='inbox'&&unreadCount>0?<b style={ui.badge}>{unreadCount}</b>:null}</button>)}
      </div>

      {success && <div style={ui.success}>{success}</div>}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔎 بحث باسم الطالب أو رقم الجلوس أو عنوان الرسالة..." style={ui.search}/>

      <div style={ui.card}>
        {loading ? <div style={ui.empty}>⏳ جاري تحميل الرسائل...</div> : filteredMessages.length === 0 ? <div style={ui.empty}>لا توجد رسائل في هذا الصندوق.</div> : (
          <div style={{ overflowX: 'auto' }}><table style={ui.table}><thead><tr>
            <th>مسلسل</th><th>اسم الطالب</th><th>رقم الجلوس</th><th>الفرع</th><th>المديرية</th><th>المدرسة</th><th>عنوان المسج</th><th>المسج</th><th>الإرسال</th><th>التسليم</th><th>القراءة</th><th>الهاتف</th><th>المرفقات</th>{box==='inbox'&&<th>الرد</th>}
          </tr></thead><tbody>{filteredMessages.map((m,i)=>{const s=getMessageStudent(m); return <tr key={m.id} onClick={()=>chooseMessage(m)} style={{cursor:'pointer', background:m.is_read?'transparent':'rgba(56,189,248,.12)', fontWeight: box === 'inbox' && !m.is_read ? 900 : 400, color: box === 'inbox' && !m.is_read ? '#ffffff' : 'inherit'}}>
            <td>{i+1}</td><td>{studentName(s)}</td><td>{seatNumber(s)}</td><td>{branchName(s,branches)}</td><td>{directorateName(s)}</td><td>{schoolName(s)}</td><td>{m.subject||'—'}</td><td style={{maxWidth:260,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.message||'—'}</td><td>{formatDateTime(m.created_at)}</td><td>{m.delivered_at?'✓':'—'}</td><td>{m.is_read?'✓':'—'}</td><td>{studentPhone(s)}</td><td>{m.attachment_path?<button type="button" onClick={e=>{e.stopPropagation();openAttachment(m)}} style={ui.link}>📎</button>:'—'}</td>{box==='inbox'&&<td><button type="button" onClick={e=>{e.stopPropagation();replyToStudent(m)}} style={ui.reply}>↩️ رد</button></td>}
          </tr>})}</tbody></table></div>
        )}
      </div>

      {selectedMessage && (()=>{const s=getMessageStudent(selectedMessage); return <div style={ui.modalOverlay} onClick={()=>setSelectedMessage(null)}><div style={ui.modal} onClick={e=>e.stopPropagation()}>
        <div style={ui.modalHead}><h3>📨 تفاصيل الرسالة</h3><button onClick={()=>setSelectedMessage(null)} style={ui.close}>✕</button></div>
        <p><b>المرسل:</b> {selectedMessage.sender_type==='support'?'دعم فني':'الطالب'}</p>
        <p><b>الطالب:</b> {studentName(s)} — <b>رقم الهوية:</b> {selectedMessage.national_id || s?.national_id || '—'} — <b>رقم الجلوس:</b> {seatNumber(s)}</p>
        <p><b>الهاتف:</b> {studentPhone(s) !== '—' ? studentPhone(s) : (selectedMessage.phone_number || '—')}</p>
        <p><b>عنوان المشكلة:</b> {selectedMessage.subject || '—'}</p>
        <p style={{ marginBottom: 6 }}><b>تفاصيل المشكلة:</b></p>
        <div style={ui.messageBody}>{selectedMessage.message || 'لا توجد تفاصيل مرفقة.'}</div>
        <div style={ui.modalActions}>{selectedMessage.sender_type==='student'&&<button onClick={()=>replyToStudent(selectedMessage)} style={ui.reply}>↩️ الرد على الطالب</button>}{selectedMessage.attachment_path&&<button onClick={()=>openAttachment(selectedMessage)} style={ui.tool}>📎 فتح المرفق</button>}<button onClick={()=>deleteMessage(selectedMessage)} style={ui.delete}>🗑️ حذف</button></div>
      </div></div>})()}
    </div>
  );
}

const ui = {
  header:{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',padding:20,borderRadius:16,background:'linear-gradient(135deg,#0b2450,#155e75)',border:'1px solid rgba(56,189,248,.3)',marginBottom:16},
  eyebrow:{color:'#67e8f9',fontWeight:800,fontSize:12}, title:{margin:'4px 0',fontSize:25}, sub:{margin:0,color:'#bae6fd'},refresh:{border:0,borderRadius:10,padding:'10px 15px',background:'#0284c7',color:'#fff',fontWeight:800,cursor:'pointer'},
  compose:{background:'#0a1d3a',border:'1px solid rgba(56,189,248,.2)',borderRadius:16,padding:18,marginBottom:14}, replyStudentCard:{background:'rgba(14,116,144,.18)',border:'1px solid rgba(56,189,248,.35)',padding:13,borderRadius:12,marginBottom:12,lineHeight:1.9}, replyStudentGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:'4px 14px'}, sender:{display:'flex',gap:15,alignItems:'center',marginBottom:10}, senderValue:{}, replyNote:{background:'rgba(14,116,144,.18)',padding:10,borderRadius:10,marginBottom:10,color:'#bae6fd'}, grid4:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10}, input:{width:'100%',boxSizing:'border-box',marginTop:5,padding:11,borderRadius:9,border:'1px solid #31557b',background:'#06142c',color:'#fff',outline:'none'}, textarea:{width:'100%',boxSizing:'border-box',marginTop:10,minHeight:120,padding:12,borderRadius:10,border:'1px solid #31557b',background:'#06142c',color:'#fff',resize:'vertical'}, tools:{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:10},tool:{border:'1px solid #31557b',borderRadius:9,padding:'9px 12px',background:'#12345f',color:'#fff',cursor:'pointer',fontWeight:700},file:{color:'#7dd3fc',fontSize:12},send:{marginRight:'auto',border:0,borderRadius:10,padding:'10px 18px',background:'#0891b2',color:'#fff',fontWeight:900,cursor:'pointer'},emoji:{display:'flex',flexWrap:'wrap',gap:4,padding:10,background:'#06142c',borderRadius:10,marginTop:8},emojiButton:{},tabs:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12},tab:{border:'1px solid #31557b',background:'#0a1d3a',color:'#cfeeff',borderRadius:10,padding:'10px 14px',cursor:'pointer',fontWeight:800},tabActive:{background:'#075985',borderColor:'#38bdf8'},badge:{marginRight:6,background:'#ef4444',color:'#fff',borderRadius:999,padding:'2px 8px',fontSize:12,fontWeight:900},success:{padding:12,background:'#065f46',color:'#d1fae5',borderRadius:10,marginBottom:10,fontWeight:800},search:{width:'100%',boxSizing:'border-box',padding:12,borderRadius:10,border:'1px solid #31557b',background:'#06142c',color:'#fff',marginBottom:10},card:{background:'#0a1d3a',border:'1px solid rgba(56,189,248,.2)',borderRadius:16,padding:12},empty:{padding:35,textAlign:'center',color:'#94a3b8'},table:{width:'100%',borderCollapse:'collapse',fontSize:12},link:{border:0,background:'transparent',color:'#7dd3fc',cursor:'pointer',fontSize:18},reply:{border:0,borderRadius:7,padding:'6px 9px',background:'#0e7490',color:'#fff',cursor:'pointer',fontWeight:800},delete:{border:0,borderRadius:7,padding:'6px 9px',background:'#991b1b',color:'#fff',cursor:'pointer'},modalOverlay:{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:5000,padding:20},modal:{width:'min(720px,95vw)',maxHeight:'85vh',overflowY:'auto',background:'#0a1d3a',border:'1px solid #38bdf8',borderRadius:16,padding:20,color:'#e5f3ff'},modalHead:{display:'flex',justifyContent:'space-between',alignItems:'center'},close:{border:0,background:'#334155',color:'#fff',borderRadius:8,padding:7,cursor:'pointer'},messageBody:{whiteSpace:'pre-wrap',background:'#06142c',padding:15,borderRadius:10,lineHeight:1.8},modalActions:{display:'flex',gap:8,justifyContent:'flex-start',marginTop:15}
};
