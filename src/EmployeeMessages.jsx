import React, { useEffect, useMemo, useState, useRef } from 'react';
import { playIncomingMessageSound, playMessageSentSound } from './soundUtils';

const BUCKET = 'employee-messages';
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export default function EmployeeMessages({ supabase }) {
  const currentEmployeeId = Number(localStorage.getItem('currentUserId') || 0);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [box, setBox] = useState('inbox');
  const [recipientType, setRecipientType] = useState('individual');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedJob, setSelectedJob] = useState('');
  const [subject, setSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('employeeMessagingTheme') || 'blue');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState('');

  // تتبع الرسائل التي عُرفت مسبقاً حتى لا يتكرر صوت الوصول أثناء التحديث الدوري.
  const prevUnreadCountRef = useRef(null);
  const knownMessageIdsRef = useRef(new Set());

  const loadData = async (showLoader = false) => {
    if (!currentEmployeeId) return;
    if (showLoader) setLoading(true);
    try {
      const [employeeRes, jobsRes, messageRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, full_name, username, job_id, is_active, is_online, last_seen')
          .eq('is_active', true)
          .order('full_name', { ascending: true }),
        supabase.from('jobs').select('id, job_name').order('id', { ascending: true }),
        supabase
          .from('employee_messages')
          .select('*')
          .or(`sender_id.eq.${currentEmployeeId},receiver_id.eq.${currentEmployeeId}`)
          .order('created_at', { ascending: false })
      ]);

      if (employeeRes.error) throw employeeRes.error;
      if (jobsRes.error) throw jobsRes.error;
      if (messageRes.error) throw messageRes.error;

      const allEmployees = employeeRes.data || [];
      const myEmployee = allEmployees.find(e => Number(e.id) === currentEmployeeId) || null;
      setCurrentEmployee(myEmployee);
      setEmployees(allEmployees.filter(e => Number(e.id) !== currentEmployeeId));
      setJobs(jobsRes.data || []);
      
      const newMessages = messageRes.data || [];
      newMessages.forEach(message => { if (message?.id != null) knownMessageIdsRef.current.add(message.id); });
      
      // حساب عدد الرسائل الواردة غير المقروءة حالياً
      const currentUnreadCount = newMessages.filter(m =>
        Number(m.receiver_id) === currentEmployeeId && !m.is_read && !m.receiver_deleted_at
      ).length;

      prevUnreadCountRef.current = currentUnreadCount;

      setMessages(newMessages);
    } catch (error) {
      console.error('خطأ في تحميل المراسلات:', error);
      alert(error.message || 'تعذر تحميل بيانات المراسلات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    const timer = setInterval(() => loadData(false), 15000);

    if (!supabase || !currentEmployeeId) {
      return () => clearInterval(timer);
    }

    // استقبال الرسالة فوراً عند INSERT عبر Supabase Realtime.
    const channel = supabase
      .channel(`employee-messages-realtime-${currentEmployeeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'employee_messages',
          filter: `receiver_id=eq.${currentEmployeeId}`,
        },
        (payload) => {
          const incoming = payload?.new;
          if (!incoming || Number(incoming.receiver_id) !== currentEmployeeId) return;

          const alreadyKnown =
            incoming.id != null && knownMessageIdsRef.current.has(incoming.id);

          if (incoming.id != null) {
            knownMessageIdsRef.current.add(incoming.id);
          }

          setMessages(prev => {
            if (prev.some(m => String(m.id) === String(incoming.id))) return prev;
            return [incoming, ...prev];
          });

          // تشغيل الصوت فور وصول الرسالة إذا كان الموظف المستقبل متواجداً.
          if (!alreadyKnown) {
            playIncomingMessageSound();
          }

          if (!incoming.is_read && !incoming.receiver_deleted_at) {
            prevUnreadCountRef.current =
              (prevUnreadCountRef.current == null ? 0 : prevUnreadCountRef.current) + 1;
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('تعذر تشغيل التحديث الفوري للمراسلات، وسيستمر التحديث الدوري.');
        }
      });

    return () => {
      clearInterval(timer);
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [currentEmployeeId, supabase]);

  const getJobName = (jobId) => {
    const job = jobs.find(j => Number(j.id) === Number(jobId));
    return job?.job_name || 'بدون وظيفة';
  };

  const getEmployee = (id) => {
    if (Number(id) === currentEmployeeId) return currentEmployee;
    return employees.find(e => Number(e.id) === Number(id)) || null;
  };

  const getEmployeeLabel = (id) => {
    const employee = getEmployee(id);
    if (!employee) return `موظف ${id}`;
    return `${employee.full_name || employee.username} — ${getJobName(employee.job_id)}`;
  };

  const isOnline = (employee) => {
    if (!employee?.last_seen) return false;
    const age = Date.now() - new Date(employee.last_seen).getTime();
    return age >= 0 && age <= 60 * 1000;
  };

  const boxMessages = useMemo(() => {
    let list = messages;
    if (box === 'inbox') {
      list = messages.filter(m => Number(m.receiver_id) === currentEmployeeId && !m.receiver_deleted_at);
    } else if (box === 'sent') {
      list = messages.filter(m => Number(m.sender_id) === currentEmployeeId && !m.sender_deleted_at);
    } else {
      list = messages.filter(m =>
        (Number(m.sender_id) === currentEmployeeId && m.sender_deleted_at) ||
        (Number(m.receiver_id) === currentEmployeeId && m.receiver_deleted_at)
      );
    }

    const enriched = list.map(m => {
      const group = list.filter(x =>
        Number(x.sender_id) === Number(m.sender_id) &&
        x.subject === m.subject &&
        x.message === m.message &&
        x.created_at === m.created_at
      );
      if (Number(m.sender_id) === currentEmployeeId && group.length > 1) {
        return {
          ...m,
          broadcast_group: true,
          recipientNames: group.map(x => getEmployee(x.receiver_id)?.full_name || getEmployee(x.receiver_id)?.username || `موظف ${x.receiver_id}`),
          readNames: group.filter(x => x.is_read).map(x => getEmployee(x.receiver_id)?.full_name || getEmployee(x.receiver_id)?.username || `موظف ${x.receiver_id}`),
          unreadNames: group.filter(x => !x.is_read).map(x => getEmployee(x.receiver_id)?.full_name || getEmployee(x.receiver_id)?.username || `موظف ${x.receiver_id}`)
        };
      }
      return m;
    });

    const q = search.trim().toLowerCase();
    if (!q) return enriched;

    return enriched.filter(m => {
      const other = Number(m.sender_id) === currentEmployeeId ? getEmployee(m.receiver_id) : getEmployee(m.sender_id);
      return [m.subject, m.message, other?.full_name, other?.username, ...(m.recipientNames || [])]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [messages, box, search, employees, currentEmployee]);

  const unreadCount = messages.filter(m =>
    Number(m.receiver_id) === currentEmployeeId && !m.is_read && !m.receiver_deleted_at
  ).length;

  const trashCount = messages.filter(m =>
    (Number(m.sender_id) === currentEmployeeId && m.sender_deleted_at) ||
    (Number(m.receiver_id) === currentEmployeeId && m.receiver_deleted_at)
  ).length;


  const themePalette = theme === 'pink'
    ? {
        page: '#3b0724',
        header: 'linear-gradient(135deg,#831843,#be185d)',
        card: '#4c0519',
        cardSoft: '#831843',
        input: '#2b0319',
        text: '#fdf2f8',
        muted: '#f472b6',
        accent: '#f43f5e',
        accentSoft: '#9f1239',
        border: '#fb7185',
        borderSoft: 'rgba(251,113,133,.4)',
        message: '#2b0319',
        messageText: '#ffffff',
        table: '#4c0519',
        attachmentText: '#f472b6',
        tableText: '#ffe4e6',
      }
    : theme === 'green'
      ? {
          page: '#022c22',
          header: 'linear-gradient(135deg,#065f46,#047857)',
          card: '#064e3b',
          cardSoft: '#065f46',
          input: '#011c16',
          text: '#ecfdf5',
          muted: '#34d399',
          accent: '#10b981',
          accentSoft: '#047857',
          border: '#34d399',
          borderSoft: 'rgba(52,211,153,.4)',
          message: '#011c16',
          messageText: '#ffffff',
          table: '#064e3b',
          attachmentText: '#34d399',
          tableText: '#d1fae5',
        }
      : {
          page: '#07152f',
          header: 'linear-gradient(135deg,#0b2450,#0e3b73)',
          card: '#0a1d3a',
          cardSoft: '#12345f',
          input: '#06142c',
          text: '#eef7ff',
          muted: '#9cc9ef',
          accent: '#38bdf8',
          accentSoft: '#0e7490',
          border: '#38bdf8',
          borderSoft: 'rgba(96,165,250,.35)',
          message: '#07152f',
          messageText: '#ffffff',
          table: '#0b2042',
          attachmentText: '#bae6fd',
          tableText: '#e0f2fe',
        };

  const applyTheme = (nextTheme) => {
    setTheme(nextTheme);
    localStorage.setItem('employeeMessagingTheme', nextTheme);
  };

  const emojiList = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰',
    '😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏',
    '😢','😭','😤','😡','🤬','😱','😴','🤗','🤔','🫡','🤭','🫢','🫣','🤫','🤐','🤝',
    '👍','👎','👏','🙌','🙏','💪','👌','✌️','🤞','🫶','❤️','🧡','💛','💚','💙','💜',
    '🩷','🩵','🤍','🖤','🤎','💔','✨','⭐','🌟','💫','🔥','🎉','🎊','🎁','🏆','💯',
    '✅','❌','⚠️','❗','❓','📌','📎','📚','📝','💡','📢','📣','💬','✉️','📩','📨',
    '☀️','🌙','🌸','🌹','🌷','🌺','🌻','🍀','🌿','☕','🍎','🎵','🎶','⚽','🏅'
  ];
  const appendEmoji = (emoji) => {
    setMessageText(prev => `${prev}${emoji}`);
    setShowEmojiPicker(false);
  };

  const chooseMessage = async (message) => {
    setSelectedMessage(message);
    if (Number(message.receiver_id) === currentEmployeeId && !message.is_read) {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('employee_messages')
        .update({ is_read: true, read_at: now })
        .eq('id', message.id)
        .eq('receiver_id', currentEmployeeId);
      if (!error) {
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, is_read: true, read_at: now } : m));
        setSelectedMessage(prev => prev ? { ...prev, is_read: true, read_at: now } : prev);
      }
    }
  };

  const sendMessage = async () => {
    if (recipientType === 'individual' && !selectedEmployee) return alert('اختر الموظف المستلم أولاً.');
    if (recipientType === 'job' && !selectedJob) return alert('اختر القسم/الوظيفة المستلمة أولاً.');
    if (!subject.trim()) return alert('اكتب عنوان الرسالة.');
    if (!messageText.trim() && !attachment) return alert('اكتب الرسالة أو أرفق ملفاً.');
    if (!currentEmployeeId) return alert('لم يتم التعرف على الموظف الحالي.');
    if (attachment && attachment.size > MAX_FILE_SIZE) return alert('حجم المرفق يجب ألا يتجاوز 25MB.');

    setSending(true);
    try {
      let recipientIds = [];

      if (recipientType === 'individual') {
        recipientIds = [Number(selectedEmployee)];
      } else if (recipientType === 'all') {
        recipientIds = employees.map(employee => Number(employee.id));
      } else if (recipientType === 'job') {
        recipientIds = employees
          .filter(employee => Number(employee.job_id) === Number(selectedJob))
          .map(employee => Number(employee.id));
      }

      recipientIds = [...new Set(recipientIds)].filter(id => id && id !== currentEmployeeId);

      if (!recipientIds.length) {
        return alert(recipientType === 'job' ? 'لا يوجد موظفون نشطون ضمن هذا القسم/الوظيفة.' : 'لا يوجد مستلمون متاحون.');
      }

      let attachmentPath = null;
      let attachmentName = null;
      let attachmentMime = null;
      let attachmentSize = null;

      if (attachment) {
        const safeName = attachment.name.replace(/[^a-zA-Z0-9._-\u0600-\u06FF]/g, '_');
        const path = `${currentEmployeeId}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, attachment, { upsert: false, contentType: attachment.type || undefined });
        if (uploadError) throw uploadError;
        attachmentPath = path;
        attachmentName = attachment.name;
        attachmentMime = attachment.type || 'application/octet-stream';
        attachmentSize = attachment.size;
      }

      const now = new Date().toISOString();
      const payloads = recipientIds.map(receiverId => ({
        sender_id: currentEmployeeId,
        receiver_id: receiverId,
        subject: subject.trim(),
        message: messageText.trim(),
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        attachment_mime: attachmentMime,
        attachment_size: attachmentSize,
        delivered_at: now,
        is_read: false,
        read_at: null,
        sender_deleted_at: null,
        receiver_deleted_at: null
      }));

      const { data, error } = await supabase
        .from('employee_messages')
        .insert(payloads)
        .select('*');
      if (error) throw error;

      setMessages(prev => [...(data || []), ...prev]);
      setSubject('');
      setMessageText('');
      setAttachment(null);
      setSelectedEmployee('');
      setSelectedJob('');
      const input = document.getElementById('employee-message-attachment');
      if (input) input.value = '';

      const targetLabel = recipientType === 'all'
        ? 'جميع الموظفين'
        : recipientType === 'job'
          ? `قسم: ${getJobName(selectedJob)}`
          : getEmployeeLabel(selectedEmployee);
      playMessageSentSound();
      setSendSuccessMessage(`تم إرسال الرسالة إلى ${targetLabel} بنجاح ✓`);
      window.setTimeout(() => setSendSuccessMessage(''), 2000);
    } catch (error) {
      console.error('خطأ في إرسال الرسالة:', error);
      alert(error.message || 'تعذر إرسال الرسالة.');
    } finally {
      setSending(false);
    }
  };

  const moveToTrash = async (message) => {
    const field = Number(message.sender_id) === currentEmployeeId ? 'sender_deleted_at' : 'receiver_deleted_at';
    const { error } = await supabase
      .from('employee_messages')
      .update({ [field]: new Date().toISOString() })
      .eq('id', message.id);
    if (error) return alert(error.message);
    setMessages(prev => prev.map(m => m.id === message.id ? { ...m, [field]: new Date().toISOString() } : m));
    setSelectedMessage(null);
  };

  const restoreFromTrash = async (message) => {
    const field = Number(message.sender_id) === currentEmployeeId ? 'sender_deleted_at' : 'receiver_deleted_at';
    const { error } = await supabase
      .from('employee_messages')
      .update({ [field]: null })
      .eq('id', message.id);
    if (error) return alert(error.message);
    setMessages(prev => prev.map(m => m.id === message.id ? { ...m, [field]: null } : m));
  };

  const permanentlyDelete = async (message) => {
    if (!window.confirm('هل تريد حذف الرسالة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;

    if (message.attachment_path) {
      const { count: attachmentRefs, error: refsError } = await supabase
        .from('employee_messages')
        .select('id', { count: 'exact', head: true })
        .eq('attachment_path', message.attachment_path)
        .neq('id', message.id);

      if (!refsError && Number(attachmentRefs || 0) === 0) {
        await supabase.storage.from(BUCKET).remove([message.attachment_path]);
      }
    }
    const { error } = await supabase.from('employee_messages').delete().eq('id', message.id);
    if (error) return alert(error.message);
    setMessages(prev => prev.filter(m => m.id !== message.id));
    setSelectedMessage(null);
  };

  const openAttachment = async (message) => {
    if (!message.attachment_path) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(message.attachment_path, 300);
    if (error) return alert(error.message || 'تعذر فتح المرفق.');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', numberingSystem: 'latn' }) : '—';
  const formatTime = (value) => value ? new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, numberingSystem: 'latn' }) : '—';
  const firstLastName = (fullName) => {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return parts[0] || '—';
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };
  const englishNumber = (value) => Number(value || 0).toLocaleString('en-US');

  if (!currentEmployeeId) {
    return <div style={styles.emptyPage}>⚠️ لم يتم العثور على الموظف الحالي.</div>;
  }

  return (
    <div
      dir="rtl"
      className={`employee-messaging-root theme-${theme}`}
      style={{
        ...styles.page,
        '--em-page': themePalette.page,
        '--em-header': themePalette.header,
        '--em-card': themePalette.card,
        '--em-card-soft': themePalette.cardSoft,
        '--em-input': themePalette.input,
        '--em-text': themePalette.text,
        '--em-muted': themePalette.muted,
        '--em-accent': themePalette.accent,
        '--em-accent-soft': themePalette.accentSoft,
        '--em-border': themePalette.border,
        '--em-border-soft': themePalette.borderSoft,
        '--em-message': themePalette.message,
        '--em-message-text': themePalette.messageText,
        '--em-table': themePalette.table,
        '--em-attachment-text': themePalette.attachmentText,
        '--em-table-text': themePalette.tableText,
      }}
    >
      {sendSuccessMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          <div style={{
            minWidth: 'min(430px, calc(100vw - 40px))',
            maxWidth: 'calc(100vw - 40px)',
            padding: '18px 28px',
            borderRadius: 18,
            background: 'rgba(15, 23, 42, 0.96)',
            color: '#fff',
            border: '2px solid #38bdf8',
            boxShadow: '0 18px 55px rgba(0,0,0,.35)',
            textAlign: 'center',
            fontSize: 20,
            fontWeight: 900,
            animation: 'emSendToastIn .18s ease-out'
          }}>
            ✉️ {sendSuccessMessage}
          </div>
        </div>
      )}
      <style>{`
        @keyframes emSendToastIn { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

        .employee-messaging-root {
          background: var(--em-page) !important;
          color: var(--em-text) !important;
          transition: background .2s ease, color .2s ease;
        }
        .employee-messaging-root .em-header {
          background: var(--em-header) !important;
          border-color: var(--em-border-soft) !important;
        }
        .employee-messaging-root .em-compose-card,
        .employee-messaging-root .em-table-card {
          background: var(--em-card) !important;
          border-color: var(--em-border-soft) !important;
        }
        .employee-messaging-root .em-sender-box {
          background: var(--em-card-soft) !important;
          border: 1px solid var(--em-border-soft);
        }
        .employee-messaging-root input,
        .employee-messaging-root select,
        .employee-messaging-root textarea {
          background: var(--em-input) !important;
          color: var(--em-text) !important;
          border-color: var(--em-border) !important;
        }
        .employee-messaging-root label,
        .employee-messaging-root .fieldLabel {
          color: var(--em-accent) !important;
        }
        .employee-messaging-root .themeButtons {
          border: 1px solid var(--em-border-soft);
        }
        .employee-messaging-root .attachmentLink {
          color: var(--em-attachment-text) !important;
        }
        .employee-messaging-root table td {
          color: var(--em-table-text) !important;
        }
        .employee-messaging-root table td .subjectButton,
        .employee-messaging-root table td .linkButton {
          color: var(--em-attachment-text) !important;
        }
        .employee-messaging-root .fileName {
          color: var(--em-attachment-text) !important;
          font-weight: 800;
        }
        .employee-messaging-root .themeButtonActive {
          background: var(--em-accent-soft) !important;
          box-shadow: 0 0 0 2px var(--em-border) inset, 0 4px 12px rgba(0,0,0,.18);
          border-radius: 8px;
        }
        .employee-messaging-root th { color: var(--em-accent) !important; }
        .employee-messaging-root .em-action-column { border-right: 2px solid var(--em-border) !important; }
        .employee-messaging-root td {
          color: var(--em-text);
          border-color: var(--em-border-soft) !important;
        }
        .employee-messaging-root .subjectButton {
          color: var(--em-accent) !important;
        }
        .employee-messaging-root .modal,
        .employee-messaging-root .messageDisplayBox .displayHeader {
          border-color: var(--em-border) !important;
        }
        .employee-messaging-root .modal::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .employee-messaging-root .modal {
          background: var(--em-card) !important;
          color: var(--em-text) !important;
        }
        .employee-messaging-root .messageBody {
          background: var(--em-message) !important;
          color: var(--em-message-text) !important;
          border: 1px solid var(--em-border-soft);
        }
        .employee-messaging-root .modalMessageTitle {
          background: var(--em-card-soft) !important;
          color: var(--em-accent) !important;
          border-color: var(--em-border) !important;
          font-size: 25px !important;
          font-weight: 900 !important;
          text-align: center !important;
          line-height: 1.6 !important;
          padding: 12px 16px !important;
        }
        .employee-messaging-root .messageBody {
          background: var(--em-message) !important;
          color: var(--em-message-text) !important;
          font-size: 22px !important;
          font-weight: 800 !important;
          line-height: 2 !important;
          text-align: right !important;
          padding: 20px !important;
          border: 1px solid var(--em-border) !important;
        }
        .employee-messaging-root .fieldLabel {
          color: var(--em-accent) !important;
          font-size: 20px !important;
          font-weight: 900 !important;
        }
        .employee-messaging-root .input {
          font-size: 18px !important;
          font-weight: 800 !important;
        }
        .employee-messaging-root textarea {
          font-size: 17px !important;
          font-weight: 800 !important;
          line-height: 2 !important;
        }
        .employee-messaging-root input::placeholder,
        .employee-messaging-root textarea::placeholder {
          color: var(--em-muted) !important;
          opacity: .85;
        }
        .employee-messaging-root .subjectButton {
          font-size: 14px !important;
          font-weight: 900 !important;
        }
        .employee-messaging-root .boxTabActive {
          background: var(--em-accent) !important;
          border-color: var(--em-border) !important;
        }
        .employee-messaging-root .sendButton,
        .employee-messaging-root .refresh {
          background: var(--em-accent) !important;
        }
        .employee-messaging-root .emojiButton,
        .employee-messaging-root .emojiPicker {
          border-color: var(--em-border) !important;
        }
        .employee-messaging-root .emojiPicker {
          background: var(--em-card) !important;
        }
        .employee-messaging-root .jobPill {
          border-color: var(--em-border) !important;
          background: var(--em-accent-soft) !important;
        }
        .employee-messaging-root.theme-pink .title,
        .employee-messaging-root.theme-green .title {
          color: #ffffff !important;
        }
        .employee-messaging-root.theme-pink .subtitle,
        .employee-messaging-root.theme-green .subtitle {
          color: var(--em-muted) !important;
        }
        .employee-messaging-root table tbody tr {
          background: var(--em-table) !important;
          transition: background .15s ease, transform .15s ease;
        }
        .employee-messaging-root table tbody tr:nth-child(even) {
          background: var(--em-card-soft) !important;
        }
        .employee-messaging-root table tbody tr:hover {
          background: var(--em-accent-soft) !important;
        }
        .employee-messaging-root table tbody tr.unreadRow {
          box-shadow: inset -3px 0 0 var(--em-accent);
          font-weight: 800;
        }
        .employee-messaging-root th,
        .employee-messaging-root td {
          border-bottom: 0 !important;
          border-top: 0 !important;
          border-left: 1px solid var(--em-border-soft) !important;
          color: var(--em-text) !important;
        }
        .employee-messaging-root th {
          background: var(--em-card-soft) !important;
          color: var(--em-accent) !important;
        }
        .employee-messaging-root .emojiPicker::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .employee-messaging-root .emojiPickerAnimated {
          transform-origin: left center;
          opacity: 0;
          transform: translateY(-50%) scale(.18);
          visibility: hidden;
          pointer-events: none;
          transition:
            opacity .16s ease,
            transform .28s cubic-bezier(.2,.85,.25,1.2),
            visibility 0s linear .28s;
        }
        .employee-messaging-root .emojiPickerAnimated.isOpen {
          opacity: 1;
          transform: translateY(-50%) scale(1);
          visibility: visible;
          pointer-events: auto;
          transition:
            opacity .16s ease,
            transform .32s cubic-bezier(.2,.85,.25,1.2),
            visibility 0s;
        }
        .employee-messaging-root .emojiPickerAnimated .emojiItem {
          opacity: 0;
          transform: scale(.15);
          transition:
            opacity .18s ease,
            transform .28s cubic-bezier(.2,.9,.25,1.25);
          transition-delay: calc(var(--emoji-index) * 18ms);
        }
        .employee-messaging-root .emojiPickerAnimated.isOpen .emojiItem {
          opacity: 1;
          transform: scale(1);
        }
        .employee-messaging-root .emojiPickerAnimated.isClosed .emojiItem {
          opacity: 0;
          transform: scale(.15);
          transition-delay: calc((23 - var(--emoji-index)) * 10ms);
        }
        .employee-messaging-root .emojiButton {
          transition: transform .2s ease, box-shadow .2s ease;
        }
        .employee-messaging-root .emojiButton:active {
          transform: scale(.94);
        }
        th, td { padding: 6px 4px; min-width: 0; word-break: break-word; border-bottom: 0; text-align: center; overflow: hidden; text-overflow: ellipsis; }
        th { font-size: 12px; color: var(--em-accent) !important; white-space: nowrap; font-weight: 900; }
        td small { font-size: 10px; }
        th, td { border-left: 1px solid var(--em-border-soft); }
        th:first-child, td:first-child { border-right: 0; }
        @media (max-width: 900px) {
          .employee-message-form-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 760px) {
          .employee-message-table { font-size: 10px !important; }
        }
      `}</style>
      <div className="em-header" style={styles.header}>
        <div>
          <h2 style={styles.title}>💬 مراسلة الموظفين</h2>
          <p style={styles.subtitle}>نظام مراسلات داخلية للموظفين</p>
        </div>
        <div style={styles.headerActions}>
          <div style={styles.themeChooser}>
            <div style={styles.themeButtons}>
              <button type="button" aria-label="الستايل الأزرق" onClick={() => applyTheme('blue')} style={{ ...styles.themeButton, ...(theme === 'blue' ? styles.themeButtonActive : {}) }}>
                <span>🔵</span><span style={styles.themeCheck}>{theme === 'blue' ? '✓' : ''}</span>
              </button>
              <button type="button" aria-label="الستايل الزهري" onClick={() => applyTheme('pink')} style={{ ...styles.themeButton, ...(theme === 'pink' ? styles.themeButtonActive : {}) }}>
                <span>🌸</span><span style={styles.themeCheck}>{theme === 'pink' ? '✓' : ''}</span>
              </button>
              <button type="button" aria-label="الستايل الأخضر" onClick={() => applyTheme('green')} style={{ ...styles.themeButton, ...(theme === 'green' ? styles.themeButtonActive : {}) }}>
                <span>🟢</span><span style={styles.themeCheck}>{theme === 'green' ? '✓' : ''}</span>
              </button>
            </div>
            <div style={styles.themeCaption}>اختر ستايلك</div>
          </div>
          <button onClick={() => loadData(true)} style={styles.refresh}>🔄 تحديث</button>
        </div>
      </div>

      <div className="em-compose-card" style={styles.composeCard}>
        <div className="em-sender-box" style={styles.senderBox}>
          <div style={styles.fieldLabel}>مرسلة من</div>
          <div style={styles.senderValue}>
            👤 <strong>{currentEmployee?.full_name || localStorage.getItem('currentName') || 'الموظف الحالي'}</strong>
            <span>({getJobName(currentEmployee?.job_id || localStorage.getItem('currentJobId'))})</span>
          </div>
        </div>

        <div className="employee-message-form-grid" style={styles.formGridCompact}>
          <div style={styles.field}>
            <label style={styles.fieldLabel}>مرسلة إلى</label>
            <select value={recipientType} onChange={e => { setRecipientType(e.target.value); setSelectedEmployee(''); setSelectedJob(''); }} style={styles.input}>
              <option value="individual">👤 موظف محدد</option>
              <option value="all">👥 الجميع</option>
              <option value="job">🏷️ قسم</option>
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.fieldLabel}>اسم الموظف / القسم</label>
            {recipientType === 'individual' ? (
              <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} style={styles.input}>
                <option value="">اختر الموظف المستلم</option>
                {employees.map(employee => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name || employee.username} — {getJobName(employee.job_id)}{isOnline(employee) ? ' • متواجد' : ''}
                  </option>
                ))}
              </select>
            ) : recipientType === 'job' ? (
              <select value={selectedJob} onChange={e => setSelectedJob(e.target.value)} style={styles.input}>
                <option value="">اختر القسم / الوظيفة</option>
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.job_name} — {employees.filter(employee => Number(employee.job_id) === Number(job.id)).length} موظف
                  </option>
                ))}
              </select>
            ) : (
              <div style={styles.input}>👥 جميع الموظفين النشطين</div>
            )}
          </div>
          <div style={styles.field}>
            <label style={styles.fieldLabel}>عنوان الرسالة</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="اكتب عنوان الرسالة" style={styles.input} />
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.fieldLabel}>الرسالة</label>
          <div style={styles.messageEditor}>
            <textarea value={messageText} onChange={e => setMessageText(e.target.value)} placeholder="اكتب الرسالة هنا..." style={styles.bigTextarea} />
          </div>
        </div>

        <div style={styles.emojiRow}>
          <button type="button" onClick={() => setShowEmojiPicker(v => !v)} style={styles.emojiButton}>😊</button>
          <span style={styles.emojiHint}>إضافة إيموجي</span>
          <div
            className={`emojiPickerAnimated ${showEmojiPicker ? 'isOpen' : 'isClosed'}`}
            aria-hidden={!showEmojiPicker}
            style={styles.emojiPicker}
          >
            {emojiList.map((emoji, index) => (
              <button
                key={emoji}
                type="button"
                onClick={() => appendEmoji(emoji)}
                tabIndex={showEmojiPicker ? 0 : -1}
                style={{ ...styles.emojiItem, '--emoji-index': index }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.attachmentRow}>
          <label style={styles.attachButton}>
            📎 المرفقات — صورة أو ملف
            <input
              id="employee-message-attachment"
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
              onChange={e => setAttachment(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
            />
          </label>
          {attachment && <span style={styles.fileName}>📄 {attachment.name} ({englishNumber(Math.ceil(attachment.size / 1024))} KB)</span>}
          <button onClick={sendMessage} disabled={sending} style={styles.sendButton}>{sending ? '⏳ جارٍ الإرسال...' : '📨 إرسال'}</button>
        </div>
      </div>

      <div style={styles.boxTabs}>
        <button onClick={() => { setBox('inbox'); setSelectedMessage(null); }} style={{ ...styles.boxTab, ...(box === 'inbox' ? styles.boxTabActive : {}) }}>📥 صندوق الوارد {unreadCount > 0 && <b style={styles.badge}>{englishNumber(unreadCount)}</b>}</button>
        <button onClick={() => { setBox('sent'); setSelectedMessage(null); }} style={{ ...styles.boxTab, ...(box === 'sent' ? styles.boxTabActive : {}) }}>📤 صندوق الصادر</button>
        <button onClick={() => { setBox('trash'); setSelectedMessage(null); }} style={{ ...styles.boxTab, ...(box === 'trash' ? styles.boxTabActive : {}) }}>🗑️ المحذوفات {trashCount > 0 && <b style={styles.badge}>{englishNumber(trashCount)}</b>}</button>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔎 بحث بالعنوان أو اسم الموظف..." style={styles.search} />
      </div>

      <div style={styles.messageDisplayBox}>
        <div style={styles.displayHeader}>
          <div>
            <div style={styles.tableTitle}>📨 صندوق عرض الرسائل</div>
            <div style={styles.displaySubTitle}>
              {box === 'inbox' ? 'الرسائل الواردة مرتبة من الأحدث إلى الأقدم' : box === 'sent' ? 'الرسائل المرسلة' : 'الرسائل المحذوفة'}
            </div>
          </div>
          <div style={styles.displayCount}>{englishNumber(boxMessages.length)} رسالة</div>
        </div>

        <div style={styles.summaryGrid}>
          <div style={styles.summaryCardNew}>
            <div style={styles.summaryTitle}>🆕 الرسائل الجديدة <b>{englishNumber(boxMessages.filter(m => !m.is_read).length)}</b></div>
            <div style={styles.summaryList}>
              {boxMessages.filter(m => !m.is_read).length === 0 ? <span style={styles.summaryEmpty}>لا توجد رسائل جديدة</span> :
                boxMessages.filter(m => !m.is_read).map((m, i) => (
                  <button key={`new-${m.id}`} type="button" onClick={() => chooseMessage(m)} style={styles.summaryItem}>
                    <span>{englishNumber(i + 1)}.</span> <span>{m.subject || 'بدون عنوان'}</span>
                  </button>
                ))}
            </div>
          </div>
          <div style={styles.summaryCardRead}>
            <div style={styles.summaryTitle}>📖 الرسائل المقروءة <b>{englishNumber(boxMessages.filter(m => m.is_read).length)}</b></div>
            <div style={styles.summaryList}>
              {boxMessages.filter(m => m.is_read).length === 0 ? <span style={styles.summaryEmpty}>لا توجد رسائل مقروءة</span> :
                boxMessages.filter(m => m.is_read).map((m, i) => (
                  <button key={`read-${m.id}`} type="button" onClick={() => chooseMessage(m)} style={styles.summaryItem}>
                    <span>{englishNumber(i + 1)}.</span> <span>{m.subject || 'بدون عنوان'}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div className="em-table-card" style={styles.tableCard}>
          {loading ? <div style={styles.empty}>⏳ جاري تحميل الرسائل...</div> : boxMessages.length === 0 ? <div style={styles.empty}>لا توجد رسائل في هذا الصندوق.</div> : (
            <table style={styles.table}>
              <colgroup>
                <col style={{ width: '5%' }} /><col style={{ width: '13%' }} /><col style={{ width: '13%' }} />
                <col style={{ width: '10%' }} /><col style={{ width: '9%' }} /><col style={{ width: '8%' }} />
                <col style={{ width: '7%' }} /><col style={{ width: '7%' }} /><col style={{ width: '8%' }} /><col style={{ width: '6%' }} /><col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>رقم</th><th>العنوان</th><th>الاسم</th><th>الوظيفة</th><th>التاريخ</th><th>الوقت</th><th>التسليم</th><th>القراءة</th><th>الحالة</th><th>مرفق</th><th className="em-action-column">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {boxMessages.map((message, index) => {
                  const mine = Number(message.sender_id) === currentEmployeeId;
                  const other = getEmployee(mine ? message.receiver_id : message.sender_id);
                  const otherOnline = isOnline(other);
                  return (
                    <tr key={message.id} className={!message.is_read && !mine ? 'unreadRow' : ''}>
                      <td>{englishNumber(index + 1)}</td>
                      <td><button onClick={() => chooseMessage(message)} style={styles.subjectButton}>{message.subject || 'بدون عنوان'}</button></td>
                      <td>{firstLastName(other?.full_name || other?.username || `موظف ${englishNumber(mine ? message.receiver_id : message.sender_id)}`)}</td>
                      <td><span style={styles.jobPill}>{getJobName(other?.job_id)}</span></td>
                      <td>{formatDate(message.created_at)}</td>
                      <td>{formatTime(message.created_at)}</td>
                      <td><span style={styles.delivered}>✓</span></td>
                      <td>
                        {message.is_read ? <span style={styles.read}>✓</span> : <span style={styles.unread}>—</span>}
                      </td>
                      <td><span style={{ ...styles.onlinePill, background: otherOnline ? '#14532d' : '#334155' }}>{otherOnline ? 'متواجد' : 'غير متواجد'}</span></td>
                      <td>{message.attachment_path ? <button onClick={() => openAttachment(message)} style={styles.linkButton} title="فتح المرفق">✓</button> : <span>—</span>}</td>
                      <td className="em-action-column">
                        <div style={styles.actions}>
                          {box === 'trash' ? <><button onClick={() => restoreFromTrash(message)} style={styles.restore}>استعادة</button><button onClick={() => permanentlyDelete(message)} style={styles.delete}>حذف نهائي</button></> : <button onClick={() => moveToTrash(message)} style={styles.delete}>حذف</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedMessage && (
        <div style={styles.modalBackdrop} onClick={() => { setSelectedMessage(null); }}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setSelectedMessage(null); }}
              style={styles.close}
              aria-label="إغلاق"
            >×</button>

            <div style={styles.modalTitle}>✉️ تفاصيل الرسالة</div>

            <div style={styles.modalMetaBlock}>
              <div style={styles.metaLine}>
                <b>مرسلة من:</b> {getEmployee(selectedMessage.sender_id)?.full_name || '—'}
                <span style={styles.jobPill}>{getJobName(getEmployee(selectedMessage.sender_id)?.job_id)}</span>
              </div>

              <div style={styles.metaLine}>
                <b>مرسلة إلى:</b> {getEmployee(selectedMessage.receiver_id)?.full_name || '—'}
                <span style={styles.jobPill}>{getJobName(getEmployee(selectedMessage.receiver_id)?.job_id)}</span>
              </div>

              <div style={styles.dateTimeLine}>
                <span><b>تاريخ الإرسال:</b> {formatDate(selectedMessage.created_at)}</span>
                <span><b>وقت الإرسال:</b> {formatTime(selectedMessage.created_at)}</span>
              </div>

              <div style={styles.dateTimeLine}>
                <span><b>التسليم:</b> ✓ تم التسليم</span>
                <span>
                  <b>القراءة:</b>{' '}
                  {selectedMessage.broadcast_group
                    ? (
                      <>
                        ✓ قرأ: {selectedMessage.readNames.join('، ') || 'لا أحد'}
                        {'  '}
                        — لم يقرأ: {selectedMessage.unreadNames.join('، ') || 'لا أحد'}
                      </>
                    )
                    : selectedMessage.is_read
                      ? <>✓ تمت القراءة — {formatDate(selectedMessage.read_at)} {formatTime(selectedMessage.read_at)}</>
                      : 'لم تتم القراءة بعد'}
                </span>
              </div>
            </div>

            <div style={styles.modalMessageTitle}>
              {selectedMessage.subject || 'بدون عنوان'}
            </div>

            <div style={styles.messageBody}>
              {selectedMessage.message || '—'}
            </div>

            {selectedMessage.attachment_path && (
              <div style={styles.previewSection}>
                <button
                  type="button"
                  onClick={() => openAttachment(selectedMessage)}
                  className="attachmentLink"
                  style={styles.attachmentLink}
                >
                  📎 {selectedMessage.attachment_name || 'فتح المرفق'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { minHeight: '100%', width: '100%', maxWidth: 1180, margin: '0 auto', padding: '18px 20px 32px', background: 'var(--em-input)', color: 'var(--em-text)', fontFamily: 'Noto Kufi Arabic, sans-serif', boxSizing: 'border-box', overflowX: 'hidden', overflowY: 'visible' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 15, padding: 20, borderRadius: 16, background: 'var(--em-header)', border: '1px solid rgba(56,189,248,.25)', marginBottom: 18 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  themeChooser: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
  themeButtons: { display: 'flex', gap: 6, padding: 5, borderRadius: 12, background: 'rgba(255,255,255,.10)', alignItems: 'center' },
  themeButton: { border: 0, background: 'transparent', cursor: 'pointer', fontSize: 18, padding: '5px 8px', transition: 'all .15s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 38 },
  themeCheck: { minHeight: 14, lineHeight: 1, fontSize: 13, color: '#fff', fontWeight: 900 },
  themeCaption: { color: '#e2e8f0', fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' },
  themeButtonActive: { transform: 'scale(1.08)' },
  messageEditor: { position: 'relative', width: '100%' },
  emojiRow: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
    marginTop: -5,
    marginBottom: 9,
    overflow: 'visible',
  },
  emojiButton: { border: '1px solid var(--em-border)', borderRadius: 8, background: 'var(--em-card-soft)', color: '#fff', cursor: 'pointer', fontSize: 20, padding: '4px 8px' },
  emojiHint: { color: 'var(--em-muted)', fontSize: 12, fontWeight: 'bold' },
  emojiPicker: {
    position: 'absolute',
    left: 48,
    top: '50%',
    zIndex: 100,
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: 5,
    padding: 10,
    minWidth: 270,
    maxHeight: 250,
    overflowY: 'auto',
    scrollbarWidth: 'none',
    borderRadius: 13,
    background: 'var(--em-card)',
    border: '1px solid var(--em-border)',
    boxShadow: '0 16px 38px rgba(0,0,0,.35)',
  },
  emojiItem: { border: 0, background: 'transparent', cursor: 'pointer', fontSize: 22, padding: 5, borderRadius: 8, transition: 'transform .15s ease, background .15s ease' },
  title: { margin: 0, color: '#f8fafc', fontSize: 25 },
  subtitle: { margin: '8px 0 0', color: 'var(--em-muted)' },
  refresh: { border: 0, borderRadius: 10, padding: '11px 18px', background: '#0284c7', color: '#fff', cursor: 'pointer', fontWeight: 'bold' },
  composeCard: { background: 'var(--em-card)', border: '1px solid rgba(96,165,250,.2)', borderRadius: 16, padding: 18, marginBottom: 18 },
  senderBox: { background: 'var(--em-card-soft)', borderRadius: 10, padding: 12, marginBottom: 14 },
  senderValue: { display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', color: '#e0f2fe' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  formGridCompact: { display: 'grid', gridTemplateColumns: '0.72fr 1fr 1.15fr', gap: 10, alignItems: 'end' },
  field: { marginBottom: 14 },
  fieldLabel: { display: 'block', marginBottom: 7, color: '#7dd3fc', fontWeight: 'bold', fontSize: 18 },
  recipientHint: { marginTop: 8, padding: '9px 11px', borderRadius: 8, background: 'rgba(14,165,233,.10)', border: '1px solid rgba(56,189,248,.20)', color: '#bae6fd', fontSize: 13, lineHeight: 1.6 },
  input: { width: '100%', boxSizing: 'border-box', padding: '10px 11px', minHeight: 42, borderRadius: 9, border: '2px solid #38bdf8', background: 'var(--em-input)', color: '#fff', outline: 'none', fontSize: 15 },
  bigTextarea: { width: '100%', minHeight: 135, resize: 'vertical', boxSizing: 'border-box', padding: 13, borderRadius: 10, border: '1px solid #334155', background: 'var(--em-input)', color: '#fff', outline: 'none', fontFamily: 'inherit', lineHeight: 1.8, fontSize: 17 },
  attachmentRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  attachButton: { display: 'inline-flex', alignItems: 'center', padding: '10px 14px', borderRadius: 9, background: '#164e63', color: '#cffafe', cursor: 'pointer', fontWeight: 'bold' },
  fileName: { color: 'var(--em-attachment-text)', fontSize: 14, fontWeight: 800, flex: 1 },
  sendButton: { border: 0, borderRadius: 10, padding: '12px 28px', background: '#0284c7', color: '#fff', fontWeight: 'bold', cursor: 'pointer', minWidth: 130 },
  boxTabs: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 },
  boxTab: { border: '1px solid #334155', borderRadius: 9, padding: '10px 15px', background: 'var(--em-card)', color: '#cbd5e1', cursor: 'pointer', fontWeight: 'bold' },
  boxTabActive: { background: '#1d4ed8', color: '#fff', borderColor: '#38bdf8' },
  badge: { marginRight: 5, padding: '2px 7px', borderRadius: 20, background: '#ef4444', color: '#fff' },
  search: { flex: 1, minWidth: 220, padding: 11, borderRadius: 9, border: '1px solid #334155', background: 'var(--em-input)', color: '#fff', outline: 'none' },
  messageDisplayBox: { width: '100%', maxWidth: 1140, margin: '20px auto 0', boxSizing: 'border-box' },
  displayHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid var(--em-border)', borderRadius: 12, background: 'rgba(11,32,66,.9)', marginBottom: 10 },
  displaySubTitle: { color: '#94a3b8', fontSize: 12, marginTop: 3 },
  displayCount: { color: '#67e8f9', fontWeight: 900, fontSize: 14, whiteSpace: 'nowrap' },
  summaryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
  summaryCardNew: { border: '1px solid #f59e0b', borderRadius: 11, padding: 9, background: 'rgba(120,53,15,.15)' },
  summaryCardRead: { border: '1px solid var(--em-border)', borderRadius: 11, padding: 9, background: 'rgba(14,116,144,.12)' },
  summaryTitle: { display: 'flex', justifyContent: 'space-between', color: '#f8fafc', fontWeight: 900, fontSize: 13, marginBottom: 6 },
  summaryList: { display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 110, overflowY: 'auto' },
  summaryItem: { border: 0, background: 'transparent', color: '#cbd5e1', cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit', fontSize: 12, padding: '3px 2px' },
  summaryEmpty: { color: '#64748b', fontSize: 12, padding: 4 },
  tableCard: { background: 'var(--em-card)', border: '1px solid rgba(56,189,248,.45)', borderRadius: 12, overflow: 'hidden', width: '100%' },
  tableTitle: { padding: 0, fontWeight: 900, fontSize: 16, color: '#67e8f9' },
  table: { width: '100%', maxWidth: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12, direction: 'rtl', background: 'var(--em-table)' },
  delivered: { color: '#4ade80', fontWeight: 900, whiteSpace: 'nowrap', fontSize: 16 },
  read: { color: '#38bdf8', fontWeight: 'bold', whiteSpace: 'nowrap' },
  unread: { color: '#fbbf24', fontWeight: 'bold', whiteSpace: 'nowrap' },
  jobPill: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '3px 9px', borderRadius: 999, border: '1px solid var(--em-border)', background: 'rgba(14,116,144,.28)', color: '#e0f2fe', fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap' },
  onlinePill: { display: 'inline-block', padding: '3px 6px', borderRadius: 20, color: '#fff', whiteSpace: 'nowrap', fontSize: 11 },
  statusList: { lineHeight: 1.45, maxWidth: 170, whiteSpace: 'normal' },
  subjectButton: { border: 0, background: 'transparent', color: '#7dd3fc', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' },
  linkButton: { border: 0, background: 'transparent', color: '#67e8f9', cursor: 'pointer', fontWeight: 'bold' },
  actions: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, flexWrap: 'wrap', width: '100%' },
  restore: { border: 0, borderRadius: 7, padding: '6px 8px', background: '#075985', color: '#fff', cursor: 'pointer' },
  delete: { border: 0, borderRadius: 7, padding: '6px 8px', background: '#7f1d1d', color: '#fff', cursor: 'pointer' },
  empty: { padding: 50, textAlign: 'center', color: '#94a3b8' },
  emptyPage: { padding: 40, color: 'var(--em-text)', background: 'var(--em-input)', minHeight: '100vh' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16, overflow: 'hidden', boxSizing: 'border-box' },
  modal: { position: 'relative', width: 'min(820px, 94vw)', maxHeight: 'calc(100vh - 28px)', overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', background: 'var(--em-card)', border: '1px solid #2563eb', borderRadius: 16, padding: 22, boxSizing: 'border-box', boxShadow: '0 25px 70px rgba(0,0,0,.5)' },
  close: { position: 'absolute', top: 10, left: 12, border: 0, background: 'transparent', color: '#fff', fontSize: 30, cursor: 'pointer' },
  modalTitle: { marginTop: 0, color: '#67e8f9', paddingLeft: 35, textAlign: 'center', fontSize: 22 },
  modalMessageTitle: { marginTop: 16, marginBottom: 0, padding: '12px 16px', border: '1px solid var(--em-border)', borderBottom: 0, borderRadius: '10px 10px 0 0', background: 'var(--em-card-soft)', color: 'var(--em-accent)', fontWeight: 900, fontSize: 25, textAlign: 'center', lineHeight: 1.6 },
  modalMetaBlock: {
    background: 'var(--em-card-soft)',
    border: '1px solid var(--em-border-soft)',
    borderRadius: 12,
    padding: '10px 14px',
    display: 'grid',
    gap: 8,
    marginBottom: 10,
  },
  metaLine: {
    color: 'var(--em-text)',
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.8,
  },
  dateTimeLine: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    color: 'var(--em-text)',
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.8,
  },
  previewSection: {
    marginTop: 12,
    borderTop: '0',
    paddingTop: 0,
  },
  previewLabel: {
    color: 'var(--em-accent)',
    fontSize: 16,
    fontWeight: 900,
    marginBottom: 8,
    textAlign: 'right',
  },
  previewBox: {
    width: '100%',
    height: 'min(27vh, 240px)',
    border: '1px solid var(--em-border)',
    borderRadius: 12,
    background: 'var(--em-input)',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  previewFrame: {
    width: '100%',
    height: '100%',
    border: 0,
  },
  previewMedia: {
    maxWidth: '100%',
    maxHeight: '100%',
  },
  previewAudio: {
    width: '90%',
  },
  filePreviewFallback: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color: 'var(--em-text)',
    fontSize: 15,
    fontWeight: 800,
    padding: 20,
    textAlign: 'center',
  },
  meta: { padding: '7px 0', borderBottom: '1px solid rgba(148,163,184,.1)', color: '#cbd5e1' },
  messageBody: { marginTop: 0, padding: 20, minHeight: 140, borderRadius: 10, background: 'var(--em-message)', color: 'var(--em-message-text)', border: '1px solid var(--em-border)', fontSize: 22, fontWeight: 800, lineHeight: 2, whiteSpace: 'pre-wrap', textAlign: 'right' },
  attachmentLink: { border: '1px solid var(--em-border)', borderRadius: 10, padding: '10px 16px', background: 'var(--em-card-soft)', color: 'var(--em-attachment-text)', cursor: 'pointer', fontWeight: 900, minHeight: 42, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', fontSize: 16 },
  attachOpen: { border: '1px solid var(--em-border)', borderRadius: 10, padding: '10px 16px', background: 'var(--em-card-soft)', color: 'var(--em-attachment-text)', cursor: 'pointer', fontWeight: '900', minHeight: 42, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
};