import React, { useState, useEffect } from 'react';

export default function ManageStudent({ supabase, styles, showAlertMessage }) {
  const [students, setStudents] = useState([]);
  const [branchesList, setBranchesList] = useState([]);
  const [directoratesList, setDirectoratesList] = useState([]);
  const [schoolsList, setSchoolsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [successMsg, setSuccessMsg] = useState(false);
  
  // حالات خاصة بنوافذ تأكيد الحذف
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [transferFilter, setTransferFilter] = useState('all');
  const [transferring, setTransferring] = useState(false);
  const [accountScope, setAccountScope] = useState('all');
  const [accountScopeValue, setAccountScopeValue] = useState('');
  const [accountActionLoading, setAccountActionLoading] = useState(false);

  // دالة لجلب قائمة الطلاب من جدول students
  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      if (typeof showAlertMessage === 'function') {
        showAlertMessage('خطأ في جلب بيانات الطلاب: ' + error.message, 'error');
      }
    } else {
      setStudents(data || []);
    }
    setLoading(false);
  };

  // جلب الفروع والمديريات والمدارس. المدرسة مرتبطة بالمديرية.
  const fetchLists = async () => {
    const [branchesResult, directoratesResult, schoolsResult] = await Promise.all([
      supabase.from('branches').select('*'),
      supabase.from('directorates').select('*').eq('is_active', true).order('directorate_name', { ascending: true }),
      supabase.from('schools').select('*').eq('is_active', true).order('school_name', { ascending: true })
    ]);

    if (!branchesResult.error) setBranchesList(branchesResult.data || []);
    else console.error('خطأ في جلب الفروع:', branchesResult.error.message);

    if (!directoratesResult.error) setDirectoratesList([...(directoratesResult.data || [])].sort((a, b) => String(a.directorate_name || '').localeCompare(String(b.directorate_name || ''), 'ar', { sensitivity: 'base', numeric: true })));
    else console.error('خطأ في جلب المديريات:', directoratesResult.error.message);

    if (!schoolsResult.error) setSchoolsList(schoolsResult.data || []);
    else console.error('خطأ في جلب المدارس:', schoolsResult.error.message);
  };

  useEffect(() => {
    fetchStudents();
    fetchLists();
  }, []);

  const availableEditSchools = editingStudent
    ? schoolsList
        .filter(school => Number(school.directorate_id) === Number(editingStudent.directorate_id))
        .sort((a, b) => String(a.school_name || '').localeCompare(String(b.school_name || ''), 'ar', { sensitivity: 'base', numeric: true }))
    : [];

  const getBranchName = (student) => {
    if (!student) return '—';

    // الأولوية للربط الحقيقي branch_id مع جدول branches.
    const branchId = student.branch_id ?? student.branchId;
    if (branchId !== null && branchId !== undefined && branchId !== '') {
      const branch = branchesList.find((b) => Number(b.id) === Number(branchId));
      if (branch) {
        return branch.name || branch.branch_name || branch.title || `فرع ${branch.id}`;
      }
    }

    // دعم الحقول القديمة إن وجدت، لكن لا نعرضها إذا كانت مجرد رقم.
    const raw = student.branch;
    if (raw !== null && raw !== undefined && raw !== '') {
      const byId = branchesList.find((b) => Number(b.id) === Number(raw));
      if (byId) {
        return byId.name || byId.branch_name || byId.title || `فرع ${byId.id}`;
      }
      return String(raw);
    }

    return '—';
  };

  const updateStudentField = (field, value) => {
    setEditingStudent(prev => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };

      if (field === 'directorate_id') {
        const directorate = directoratesList.find(item => Number(item.id) === Number(value));
        next.directorate_name = directorate?.directorate_name || '';
        next.school_id = '';
        next.school_name = '';
      }

      if (field === 'school_id') {
        const school = schoolsList.find(item => Number(item.id) === Number(value));
        next.school_name = school?.school_name || '';
      }

      return next;
    });
  };

  // دالة لإظهار رسالة النجاح لمدة 3 ثوانٍ
  const triggerSuccessMsg = (msg) => {
    setSuccessMsg(msg);
    if (typeof showAlertMessage === 'function') {
      showAlertMessage(msg, 'success');
    }
    setTimeout(() => {
      setSuccessMsg(false);
    }, 3000);
  };

  // البحث باسم الطالب أو رقم الهوية
  const handleSearch = (e) => {
    e.preventDefault();
  };

  const filteredStudents = students.filter((student) => {
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) return true;

    const name = String(student.full_name_ar || student.full_name || '').toLowerCase();
    const nationalId = String(student.national_id || '').toLowerCase();
    const seating = String(student.seating_number || '').toLowerCase();

    return name.includes(q) || nationalId.includes(q) || seating.includes(q);
  });

  const getAccountScopeStudents = () => {
    if (accountScope === 'all') return students;
    if (accountScope === 'branch') return students.filter(s => String(s.branch_id ?? s.branch ?? '') === String(accountScopeValue));
    if (accountScope === 'directorate') return students.filter(s => String(s.directorate_id ?? '') === String(accountScopeValue));
    if (accountScope === 'school') return students.filter(s => String(s.school_id ?? '') === String(accountScopeValue));
    if (accountScope === 'student') return students.filter(s => String(s.seating_number ?? '').trim() === String(accountScopeValue).trim());
    return [];
  };

  const setStudentsAccountStatus = async (active) => {
    const targets = getAccountScopeStudents();
    if (!targets.length) {
      showAlertMessage?.('لا يوجد طلاب مطابقون للخيار المحدد.', 'error');
      return;
    }
    const action = active ? 'تفعيل' : 'تعطيل';
    if (!window.confirm(`هل تريد ${action} دخول ${targets.length} طالب؟`)) return;
    setAccountActionLoading(true);
    try {
      const ids = targets.map(s => s.id).filter(Boolean);
      const { error } = await supabase.from('students').update({ is_active: active }).in('id', ids);
      if (error) throw error;

      if (!active) {
        const notifications = targets.map(s => ({
          student_id: s.id,
          title: '🔔 لطفاً انتبه',
          message: `عزيز الطالب: ${s.full_name_ar || s.full_name || 'الطالب'}
لقد تم تعطيل دخولك للنظام يرجي التوجه لمديرية التعليم بمنطقتك وشكرا`,
          notification_type: 'account_disabled',
          is_read: false
        }));
        const { error: notificationError } = await supabase.from('student_notifications').insert(notifications);
        if (notificationError) console.warn('تعذر حفظ إشعارات تعطيل الطلاب:', notificationError.message);
      }

      setStudents(prev => prev.map(s => ids.includes(s.id) ? { ...s, is_active: active } : s));
      triggerSuccessMsg(`تم ${action} دخول ${targets.length} طالب بنجاح.`);
    } catch (error) {
      showAlertMessage?.(`تعذر ${action} حسابات الطلاب: ${error.message}`, 'error');
    } finally {
      setAccountActionLoading(false);
    }
  };

  // حفظ التعديلات على الطالب
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;

    setLoading(true);
    const { directorate_name, school_name, ...studentPayload } = editingStudent;
    const { error } = await supabase
      .from('students')
      .update(studentPayload)
      .eq('id', editingStudent.id);

    if (error) {
      if (typeof showAlertMessage === 'function') {
        showAlertMessage('خطأ في تحديث البيانات: ' + error.message, 'error');
      }
    } else {
      triggerSuccessMsg('تم تعديل وحفظ بيانات الطالب بنجاح!');
      setEditingStudent(null);
      fetchStudents();
    }
    setLoading(false);
  };

  // تنفذ عملية الحذف الفعلية بعد التأكيد
  const transferStudents = async () => {
    const labels = { all: 'جميع الطلاب', passed: 'الطلاب الناجحون', incomplete: 'الطلاب المكملون', failed: 'الطلاب الراسبون' };
    const status = transferFilter === 'passed' ? 'ناجح' : transferFilter === 'incomplete' ? 'مكمل' : transferFilter === 'failed' ? 'راسب' : null;
    if (!window.confirm(`سيتم نقل ${labels[transferFilter]} من جدول students إلى finish_student. هل أنت متأكد؟`)) return;
    setTransferring(true);
    try {
      let query = supabase.from('students').select('*');
      if (status) query = query.eq('final_result', status);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) { showAlertMessage?.(`لا يوجد ${labels[transferFilter]} مؤهل للنقل.`, 'info'); return; }
      const { error: insertError } = await supabase.from('finish_student').upsert(rows, { onConflict: 'id' });
      if (insertError) throw insertError;
      const ids = rows.map(r => r.id).filter(Boolean);
      if (ids.length) {
        const { error: deleteError } = await supabase.from('students').delete().in('id', ids);
        if (deleteError) throw deleteError;
      }
      triggerSuccessMsg(`تم نقل ${rows.length} طالب إلى finish_student بنجاح.`);
      await fetchStudents();
    } catch (error) {
      showAlertMessage?.('تعذر نقل الطلاب: ' + error.message, 'error');
    } finally {
      setTransferring(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', deleteConfirmId);

    if (error) {
      if (typeof showAlertMessage === 'function') {
        showAlertMessage('خطأ في عملية الحذف: ' + error.message, 'error');
      }
    } else {
      triggerSuccessMsg('تم حذف الطالب بنجاح');
      if (editingStudent && editingStudent.id === deleteConfirmId) {
        setEditingStudent(null);
      }
      setStudents(students.filter(student => student.id !== deleteConfirmId));
    }
    setDeleteConfirmId(null);
  };

  return (
    <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '25px', color: '#fff', direction: 'rtl', position: 'relative' }}>
      <h3 style={{ fontSize: '18px', marginBottom: '20px', color: '#60a5fa', borderBottom: '2px solid #2563eb', paddingBottom: '8px' }}>
        👥 إدارة بيانات الطلاب (Students)
      </h3>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '18px', padding: '12px', background: '#0f172a', borderRadius: '10px', border: '1px solid #334155' }}>
        <strong style={{ color: '#38bdf8' }}>📦 نقل الطلاب إلى الأرشيف</strong>
        <select value={transferFilter} onChange={e => setTransferFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: '150px' }}>
          <option value="all">جميع الطلاب</option>
          <option value="passed">الناجحون</option>
          <option value="incomplete">المكملون</option>
          <option value="failed">الراسبون</option>
        </select>
        <button type="button" onClick={transferStudents} disabled={transferring} style={{ padding: '10px 16px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
          {transferring ? 'جاري النقل...' : '📦 نقل الطلاب'}
        </button>
        <span style={{ color: '#94a3b8', fontSize: '12px' }}>يشترط أن تكون النتيجة محفوظة في students.</span>
      </div>

      {/* رسالة تأكيد الحذف المنبثقة (Modal) */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#0f172a', border: '2px solid #ef4444', padding: '25px', borderRadius: '10px', width: '350px', textAlign: 'center' }}>
            <h4 style={{ color: '#ef4444', marginBottom: '15px', fontSize: '18px' }}>⚠️ تأكيد الحذف</h4>
            <p style={{ color: '#cbd5e1', marginBottom: '20px', fontSize: '14px' }}>هل أنت متأكد من أنك تريد حذف بيانات هذا الطالب؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                onClick={confirmDelete}
                style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                نعم، احذف
              </button>
              <button 
                onClick={() => setDeleteConfirmId(null)}
                style={{ backgroundColor: '#475569', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* رسالة النجاح المنبثقة تختفي بعد 3 ثوانٍ */}
      {successMsg && (
        <div style={{ backgroundColor: '#065f46', color: '#d1fae5', padding: '14px', borderRadius: '6px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold', border: '2px solid #10b981', fontSize: '16px' }}>
          ✨ {successMsg}
        </div>
      )}

      {/* نموذج تعديل وحذف الطالب */}
      {editingStudent && (
        <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', border: '2px solid #3b82f6', marginBottom: '25px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ color: '#60a5fa', margin: 0, fontSize: '16px' }}>✏️ تعديل بيانات الطالب: {editingStudent.full_name_ar}</h4>
            <button 
              type="button"
              onClick={() => setEditingStudent(null)} 
              style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              إغلاق النموذج ✕
            </button>
          </div>

          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* الصف الأول (3 أعمدة) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
              <div>
                <label style={labelStyle}>رقم هوية الطالب:</label>
                <input
                  type="text"
                  value={editingStudent.national_id || ''}
                  onChange={(e) => setEditingStudent({...editingStudent, national_id: e.target.value})}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>الاسم الكامل (عربي):</label>
                <input
                  type="text"
                  value={editingStudent.full_name_ar || ''}
                  onChange={(e) => setEditingStudent({...editingStudent, full_name_ar: e.target.value})}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>الاسم الكامل (إنجليزي):</label>
                <input
                  type="text"
                  value={editingStudent.full_name_en || ''}
                  onChange={(e) => setEditingStudent({...editingStudent, full_name_en: e.target.value})}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* الصف الثاني: الجنس، الجنسية، تاريخ الميلاد، مكان الميلاد (4 أعمدة بنفس السطر) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
              <div>
                <label style={labelStyle}>الجنس:</label>
                <select
                  value={editingStudent.gender || 'ذكر'}
                  onChange={(e) => setEditingStudent({...editingStudent, gender: e.target.value})}
                  style={inputStyle}
                >
                  <option value="ذكر">ذكر</option>
                  <option value="أنثى">أنثى</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>الجنسية:</label>
                <input
                  type="text"
                  value={editingStudent.nationality || ''}
                  onChange={(e) => setEditingStudent({...editingStudent, nationality: e.target.value})}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>تاريخ الميلاد:</label>
                <input
                  type="date"
                  value={editingStudent.birth_date || ''}
                  onChange={(e) => setEditingStudent({...editingStudent, birth_date: e.target.value})}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>مكان الميلاد:</label>
                <input
                  type="text"
                  value={editingStudent.birth_place || ''}
                  onChange={(e) => setEditingStudent({...editingStudent, birth_place: e.target.value})}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* الصف الثالث (3 أعمدة) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
              <div>
                <label style={labelStyle}>رقم الهاتف:</label>
                <input
                  type="text"
                  value={editingStudent.phone_number || ''}
                  onChange={(e) => setEditingStudent({...editingStudent, phone_number: e.target.value})}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>رقم الواتساب:</label>
                <input
                  type="text"
                  value={editingStudent.whatsapp_number || ''}
                  onChange={(e) => setEditingStudent({...editingStudent, whatsapp_number: e.target.value})}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>العنوان:</label>
                <input
                  type="text"
                  value={editingStudent.address || ''}
                  onChange={(e) => setEditingStudent({...editingStudent, address: e.target.value})}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>المديرية:</label>
                <select
                  value={editingStudent.directorate_id || ''}
                  onChange={(e) => updateStudentField('directorate_id', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">اختر المديرية</option>
                  {directoratesList.map(directorate => (
                    <option key={directorate.id} value={directorate.id}>
                      {directorate.directorate_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>المدرسة:</label>
                <select
                  value={editingStudent.school_id || ''}
                  onChange={(e) => updateStudentField('school_id', e.target.value)}
                  disabled={!editingStudent.directorate_id}
                  style={{ ...inputStyle, opacity: editingStudent.directorate_id ? 1 : 0.6 }}
                >
                  <option value="">
                    {editingStudent.directorate_id ? 'اختر المدرسة التابعة للمديرية' : 'اختر المديرية أولاً'}
                  </option>
                  {availableEditSchools.map(school => (
                    <option key={school.id} value={school.id}>
                      {school.school_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>الفرع:</label>
                <select
                  value={editingStudent.branch_id ?? editingStudent.branch ?? ''}
                  onChange={(e) => setEditingStudent({...editingStudent, branch_id: e.target.value ? Number(e.target.value) : null})}
                  style={inputStyle}
                >
                  <option value="">اختر الفرع</option>
                  {[...branchesList]
                    .sort((a, b) =>
                      String(a.name || a.branch_name || a.title || '').localeCompare(
                        String(b.name || b.branch_name || b.title || ''),
                        'ar',
                        { sensitivity: 'base', numeric: true }
                      )
                    )
                    .map((b) => {
                      const branchName = b.name || b.branch_name || b.title || `فرع ${b.id}`;
                      return (
                        <option key={b.id} value={b.id}>
                          {branchName}
                        </option>
                      );
                    })}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                type="submit"
                style={{ flex: 1, padding: '12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                حفظ التعديلات
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(editingStudent.id)}
                style={{ padding: '12px 20px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                حذف الطالب
              </button>
            </div>
          </form>
        </div>
      )}

      {/* التحكم بحسابات دخول الطلاب */}
      <div style={{ marginBottom: '18px', padding: '14px', background: '#0f172a', borderRadius: '10px', border: '1px solid #334155' }}>
        <div style={{ color: '#38bdf8', fontWeight: 900, marginBottom: 10 }}>🔐 التحكم بحسابات دخول الطلاب</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) minmax(220px,1fr) auto auto', gap: 8, alignItems: 'end' }}>
          <label style={{ color:'#cbd5e1', fontSize:12 }}>النطاق
            <select value={accountScope} onChange={e=>{setAccountScope(e.target.value);setAccountScopeValue('')}} style={{...inputStyle, marginTop:4}}>
              <option value="all">جميع الطلاب</option><option value="branch">حسب الفرع</option><option value="directorate">حسب المديرية</option><option value="school">حسب المدرسة</option><option value="student">طالب برقم الجلوس</option>
            </select>
          </label>
          {accountScope === 'branch' && <label style={{color:'#cbd5e1',fontSize:12}}>الفرع<select value={accountScopeValue} onChange={e=>setAccountScopeValue(e.target.value)} style={{...inputStyle,marginTop:4}}><option value="">اختر الفرع</option>{branchesList.map(b=><option key={b.id} value={b.id}>{b.name||b.branch_name||b.title}</option>)}</select></label>}
          {accountScope === 'directorate' && <label style={{color:'#cbd5e1',fontSize:12}}>المديرية<select value={accountScopeValue} onChange={e=>setAccountScopeValue(e.target.value)} style={{...inputStyle,marginTop:4}}><option value="">اختر المديرية</option>{directoratesList.map(d=><option key={d.id} value={d.id}>{d.directorate_name}</option>)}</select></label>}
          {accountScope === 'school' && <label style={{color:'#cbd5e1',fontSize:12}}>المدرسة<select value={accountScopeValue} onChange={e=>setAccountScopeValue(e.target.value)} style={{...inputStyle,marginTop:4}}><option value="">اختر المدرسة</option>{schoolsList.map(x=><option key={x.id} value={x.id}>{x.school_name}</option>)}</select></label>}
          {accountScope === 'student' && <label style={{color:'#cbd5e1',fontSize:12}}>رقم الجلوس<input value={accountScopeValue} onChange={e=>setAccountScopeValue(e.target.value)} placeholder="أدخل رقم الجلوس" style={{...inputStyle,marginTop:4}}/></label>}
          {accountScope === 'all' && <div style={{color:'#94a3b8',fontSize:12,paddingBottom:10}}>سيتم تطبيق الإجراء على جميع الطلاب.</div>}
          <button type="button" disabled={accountActionLoading} onClick={()=>setStudentsAccountStatus(true)} style={{padding:'10px 14px',background:'#059669',color:'#fff',border:0,borderRadius:7,fontWeight:900,cursor:'pointer'}}>🟢 تفعيل الحساب</button>
          <button type="button" disabled={accountActionLoading} onClick={()=>setStudentsAccountStatus(false)} style={{padding:'10px 14px',background:'#dc2626',color:'#fff',border:0,borderRadius:7,fontWeight:900,cursor:'pointer'}}>🔴 تعطيل الحساب</button>
        </div>
      </div>

      {/* شريط البحث باسم الطالب أو رقم الهوية */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث باسم الطالب أو رقم الهوية أو رقم الجلوس..."
          aria-label="البحث باسم الطالب أو رقم الهوية"
          style={{ flex: 1, padding: '10px 14px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '14px' }}
        />
        <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          🔍 بحث
        </button>
      </form>

      {/* عدد الطلاب */}
      <div style={{ marginBottom: '15px', color: '#93c5fd', fontWeight: 'bold', fontSize: '15px' }}>
        عدد الطلاب ({filteredStudents.length})
      </div>
      
      {loading ? (
        <p style={{ color: '#94a3b8' }}>جاري تحميل البيانات...</p>
      ) : filteredStudents.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>لا يوجد طلاب مسجلين حالياً.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '9px' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#60a5fa', borderBottom: '2px solid #334155' }}>
                <th style={thStyle}>رقم مسلسل</th>
                <th style={thStyle}>اسم الطالب</th>
                <th style={thStyle}>رقم هوية الطالب</th>
                <th style={thStyle}>الجنس</th>
                <th style={thStyle}>الفرع</th>
                <th style={thStyle}>المديرية</th>
                <th style={thStyle}>المدرسة</th>
                <th style={thStyle}>السنة</th>
                <th style={thStyle}>حالة الدخول</th>
                <th style={thStyle}>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student, index) => (
                <tr key={student.id || index} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={tdStyle}>{index + 1}</td>
                  
                  {/* اسم الطالب: محاذاة لليمين تماماً وبخط أصغر وأنيق */}
                  <td
                    style={{ ...tdStyle, cursor: 'pointer', fontWeight: '700', textAlign: 'right', paddingRight: '0px', fontSize: '9px' }}
                    title="انقر لتعديل بيانات الطالب"
                    onClick={() => setEditingStudent(student)}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        flexDirection: 'row-reverse',
                        gap: '4px',
                        color: '#38bdf8',
                        fontWeight: '700',
                        fontSize: '9px',
                        textDecoration: 'none',
                        transition: 'color .18s ease',
                        width: 'fit-content',
                        marginRight: '0',
                        marginLeft: 'auto',
                        paddingRight: '0',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#7dd3fc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#38bdf8';
                      }}
                    >
                      <span
                        style={{
                          textDecoration: 'underline',
                          textUnderlineOffset: '3px',
                          textDecorationThickness: '1.5px',
                        }}
                      >
                        {student.full_name_ar || student.full_name || '—'}
                      </span>
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'inline-block',
                          fontSize: '8px',
                          textDecoration: 'none',
                          borderBottom: 'none',
                          lineHeight: 1,
                        }}
                      >
                        ✏️
                      </span>
                    </span>
                  </td>

                  {/* رقم الهوية */}
                  <td style={{ ...tdStyle, color: '#60a5fa', fontWeight: 'bold', textAlign: 'right', fontSize: '9px' }}>
                    {student.national_id || '—'}
                  </td>

                  <td style={{ ...tdStyle, textAlign: 'right', fontSize: '9px' }}>{student.gender}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontSize: '9px' }}>{getBranchName(student)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontSize: '9px' }}>{student.directorate_name || (directoratesList.find(d => Number(d.id) === Number(student.directorate_id))?.directorate_name || '—')}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontSize: '9px' }}>{student.school_name || (schoolsList.find(s => Number(s.id) === Number(student.school_id))?.school_name || '—')}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontSize: '9px' }}>{student.created_at ? new Date(student.created_at).getFullYear() : '-'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button type="button" onClick={async (e)=>{e.stopPropagation(); const next = student.is_active === false; setAccountActionLoading(true); try { const {error}=await supabase.from('students').update({is_active:next}).eq('id',student.id); if(error) throw error; if(!next){await supabase.from('student_notifications').insert({student_id:student.id,title:'🔔 لطفاً انتبه',message:`عزيز الطالب: ${student.full_name_ar || student.full_name || 'الطالب'}\nلقد تم تعطيل دخولك للنظام يرجي التوجه لمديرية التعليم بمنطقتك وشكرا`,notification_type:'account_disabled',is_read:false});} setStudents(prev=>prev.map(s=>s.id===student.id?{...s,is_active:next}:s)); triggerSuccessMsg(next?'تم تفعيل دخول الطالب.':'تم تعطيل دخول الطالب.'); } catch(err){showAlertMessage?.(err.message,'error')} finally{setAccountActionLoading(false)} }} style={{padding:'2px 7px',background:student.is_active===false?'#059669':'#dc2626',color:'#fff',border:0,borderRadius:4,cursor:'pointer',fontSize:8,fontWeight:900}}>{student.is_active===false?'تفعيل':'تعطيل'}</button>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(student.id);
                      }}
                      style={{ 
                        padding: '2px 5px', 
                        backgroundColor: '#dc2626', 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontSize: '8px',
                        fontWeight: 'bold'
                      }}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '5px 6px',
  borderBottom: '2px solid #334155',
  textAlign: 'right',
  fontSize: '9px'
};

const tdStyle = {
  padding: '5px 6px',
  textAlign: 'right',
  fontSize: '9px'
};

const labelStyle = {
  display: 'block',
  marginBottom: '5px',
  fontSize: '13px',
  color: '#93c5fd',
  textAlign: 'right'
};

const inputStyle = {
  width: '100%',
  padding: '10px',
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  color: '#fff',
  borderRadius: '6px',
  fontSize: '14px',
  boxSizing: 'border-box',
  textAlign: 'right'
};