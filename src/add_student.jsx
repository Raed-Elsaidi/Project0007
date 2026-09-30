import React, { useState, useEffect, useMemo } from 'react';
import { readTabularFile } from './xlsxLite';

export default function AddStudent({ supabase, showAlertMessage }) {
  const [formData, setFormData] = useState({
    national_id: '',
    full_name_ar: '',
    full_name_en: '',
    gender: 'ذكر',
    nationality: 'فلسطيني',
    birth_date: '',
    birth_place: '',
    phone_number: '',
    whatsapp_number: '',
    address: '',
    directorate_id: '',
    school_id: '',
    directorate_name: '',
    school_name: '',
    branch: ''
  });

  const [branchesList, setBranchesList] = useState([]);
  const [directoratesList, setDirectoratesList] = useState([]);
  const [schoolsList, setSchoolsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMsgVisible, setSuccessMsgVisible] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importHeaders, setImportHeaders] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [importSource, setImportSource] = useState('excel');
  const [externalTableName, setExternalTableName] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [allowDeleteFilter, setAllowDeleteFilter] = useState('all');

  // جلب الفروع من جدول branches عند تحميل المكون
  useEffect(() => {
    const fetchLists = async () => {
      const [branchesResult, directoratesResult, schoolsResult] = await Promise.all([
        supabase.from('branches').select('*'),
        supabase.from('directorates').select('*').eq('is_active', true).order('directorate_name', { ascending: true }),
        supabase.from('schools').select('*').eq('is_active', true).order('school_name', { ascending: true })
      ]);

      if (branchesResult.error) console.error('خطأ في جلب الفروع:', branchesResult.error.message);
      else setBranchesList(branchesResult.data || []);

      if (directoratesResult.error) console.error('خطأ في جلب المديريات:', directoratesResult.error.message);
      else setDirectoratesList(directoratesResult.data || []);

      if (schoolsResult.error) console.error('خطأ في جلب المدارس:', schoolsResult.error.message);
      else setSchoolsList(schoolsResult.data || []);
    };

    fetchLists();
  }, [supabase]);

  const availableSchools = schoolsList
    .filter(school => Number(school.directorate_id) === Number(formData.directorate_id))
    .sort((a, b) => String(a.school_name || '').localeCompare(String(b.school_name || ''), 'ar', { sensitivity: 'base', numeric: true }));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };

      if (name === 'directorate_id') {
        next.school_id = '';
        next.school_name = '';
      }

      if (name === 'school_id') {
        const school = schoolsList.find(item => Number(item.id) === Number(value));
        next.school_name = school?.school_name || '';
      }

      if (name === 'directorate_id') {
        const directorate = directoratesList.find(item => Number(item.id) === Number(value));
        next.directorate_name = directorate?.directorate_name || '';
      }

      return next;
    });
  };


  const allowStudentFields = useMemo(() => Object.keys(formData), [formData]);

  const normalizeHeader = (value) => String(value ?? '')
    .trim().toLowerCase()
    .replace(/[\s_\-./]+/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه');

  const fieldAliases = {
    national_id: ['national_id','nationalid','id','identity','identitynumber','رقمالهوية','الهوية','رقمالهويه'],
    full_name_ar: ['full_name_ar','fullnamear','namear','studentname','fullname','الاسم','اسمالطالب','الاسمالكامل','الاسمالكاملبالعربي'],
    full_name_en: ['full_name_en','fullnameen','nameen','englishname','الاسمالانجليزي'],
    gender: ['gender','sex','الجنس'],
    nationality: ['nationality','الجنسية'],
    birth_date: ['birth_date','birthdate','dateofbirth','dob','تاريخالميلاد'],
    birth_place: ['birth_place','birthplace','مكانالميلاد'],
    phone_number: ['phone_number','phone','mobile','mobilephone','رقمالهاتف','الهاتف','الجوال'],
    whatsapp_number: ['whatsapp_number','whatsapp','whats','رقمالواتساب','الواتساب'],
    address: ['address','العنوان'],
    directorate_id: ['directorate_id','directorateid','رقمالمديرية','معرفالمديرية'],
    school_id: ['school_id','schoolid','رقمالمدرسة','معرفالمدرسة'],
    directorate_name: ['directorate_name','directoratename','المديرية','اسمالمديرية'],
    school_name: ['school_name','schoolname','المدرسة','اسمالمدرسة'],
    branch: ['branch','branchname','الفرع','اسمالفرع']
  };

  const suggestMapping = (headers) => {
    const next = {};
    headers.forEach((header) => {
      const normalized = normalizeHeader(header);
      const match = allowStudentFields.find((field) =>
        [field, ...(fieldAliases[field] || [])].some(alias => normalizeHeader(alias) === normalized)
      );
      if (match && !Object.values(next).includes(header)) next[match] = header;
    });
    setFieldMapping(next);
  };

  const loadImportData = async (rows) => {
    const headers = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
    setImportHeaders(headers);
    suggestMapping(headers);
    setImportRows(rows);
    setImportSummary({ total: rows.length, valid: rows.length, invalid: 0, duplicate: 0 });
  };

  const handleExcelImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const rows = await readTabularFile(file);
      await loadImportData(rows);
      showAlertMessage?.(`تمت قراءة ${rows.length} سجل من ملف Excel. راجع مطابقة الحقول ثم اضغط استيراد.`, 'success');
    } catch (error) {
      showAlertMessage?.('تعذر قراءة ملف Excel: ' + error.message, 'error');
    } finally {
      setImportLoading(false);
      event.target.value = '';
    }
  };

  const handleExternalTableLoad = async () => {
    const table = externalTableName.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
      showAlertMessage?.('اسم الجدول غير صالح.', 'error');
      return;
    }
    setImportLoading(true);
    try {
      const { data, error } = await supabase.from(table).select('*').limit(10000);
      if (error) throw error;
      await loadImportData(data || []);
      showAlertMessage?.(`تمت قراءة ${(data || []).length} سجل من جدول ${table}.`, 'success');
    } catch (error) {
      showAlertMessage?.('تعذر قراءة الجدول الخارجي: ' + error.message, 'error');
    } finally {
      setImportLoading(false);
    }
  };

  const excelSerialToDate = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return String(value ?? '').trim();
    const date = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return date.toISOString().slice(0, 10);
  };

  const buildMappedRows = () => importRows.map((row) => {
    const mapped = {};
    allowStudentFields.forEach((field) => {
      const source = fieldMapping[field];
      let value = source ? row[source] : '';
      if (field === 'birth_date' && value !== '') value = excelSerialToDate(value);
      mapped[field] = value === '' || value === undefined ? null : String(value).trim();
    });
    if (!mapped.gender) mapped.gender = 'ذكر';
    if (!mapped.nationality) mapped.nationality = 'فلسطيني';
    return mapped;
  });

  const validateImport = async (rows) => {
    const ids = rows.map(r => String(r.national_id || '').trim()).filter(Boolean);
    const existing = new Set();
    if (ids.length) {
      let existingResult = await supabase.from('allow_student').select('national_id').in('national_id', ids);
      if (existingResult.error && /relation|does not exist|schema cache/i.test(String(existingResult.error.message || ''))) {
        existingResult = await supabase.from('allowstudent').select('national_id').in('national_id', ids);
      }
      (existingResult.data || []).forEach(r => existing.add(String(r.national_id)));
    }
    let invalid = 0;
    let duplicate = 0;
    const validRows = [];
    for (const row of rows) {
      if (!row.national_id || !row.full_name_ar) { invalid++; continue; }
      if (existing.has(String(row.national_id))) { duplicate++; continue; }
      validRows.push(row);
      existing.add(String(row.national_id));
    }
    return { validRows, invalid, duplicate };
  };

  const importMappedStudents = async () => {
    if (!importRows.length) {
      showAlertMessage?.('اختر ملف Excel أو حمّل جدولًا خارجيًا أولًا.', 'error');
      return;
    }
    setImportLoading(true);
    try {
      const mappedRows = buildMappedRows();
      const { validRows, invalid, duplicate } = await validateImport(mappedRows);
      if (!validRows.length) {
        setImportSummary({ total: mappedRows.length, valid: 0, invalid, duplicate });
        showAlertMessage?.('لا توجد سجلات صالحة للاستيراد بعد التحقق.', 'error');
        return;
      }
      let insertResult = await supabase.from('allow_student').insert(validRows);
      if (insertResult.error && /relation|does not exist|schema cache/i.test(String(insertResult.error.message || ''))) {
        insertResult = await supabase.from('allowstudent').insert(validRows);
      }
      if (insertResult.error) throw insertResult.error;
      setImportSummary({ total: mappedRows.length, valid: validRows.length, invalid, duplicate });
      setImportRows([]);
      setImportHeaders([]);
      setFieldMapping({});
      showAlertMessage?.(`تم استيراد ${validRows.length} طالب بنجاح. تم تجاوز ${duplicate} مكرر و${invalid} سجل غير مكتمل.`, 'success');
    } catch (error) {
      showAlertMessage?.('فشل الاستيراد: ' + error.message, 'error');
    } finally {
      setImportLoading(false);
    }
  };

  const deleteAllowStudents = async () => {
    const labels = { all: 'جميع الطلاب', passed: 'الطلاب الناجحون', incomplete: 'الطلاب المكملون', failed: 'الطلاب الراسبون' };
    if (!window.confirm(`تحذير: سيتم حذف ${labels[allowDeleteFilter]} من جدول Allow Student. هل أنت متأكد؟`)) return;
    setDeletingAll(true);
    try {
      const tables = ['allow_student', 'allowstudent'];
      let lastError = null;
      for (const table of tables) {
        let query = supabase.from(table).delete();
        if (allowDeleteFilter === 'all') {
          query = query.not('id', 'is', null);
        } else {
          const { data: studentsByStatus, error: statusError } = await supabase
            .from('students').select('national_id').eq('final_result', allowDeleteFilter === 'passed' ? 'ناجح' : allowDeleteFilter === 'incomplete' ? 'مكمل' : 'راسب');
          if (statusError) throw statusError;
          const ids = (studentsByStatus || []).map(r => r.national_id).filter(Boolean);
          if (!ids.length) { showAlertMessage?.(`لا يوجد ${labels[allowDeleteFilter]} للحذف.`, 'info'); return; }
          query = query.in('national_id', ids);
        }
        const result = await query;
        if (!result.error) {
          showAlertMessage?.(`تم حذف ${labels[allowDeleteFilter]} من جدول Allow Student.`, 'success');
          return;
        }
        lastError = result.error;
        if (!/relation|does not exist|schema cache/i.test(String(result.error.message || ''))) break;
      }
      if (lastError) throw lastError;
    } catch (error) {
      showAlertMessage?.('تعذر حذف بيانات الطلاب: ' + error.message, 'error');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.national_id || !formData.full_name_ar) {
      if (typeof showAlertMessage === 'function') {
        showAlertMessage('يرجى ادخال رقم هوية الطالب والاسم الكامل بالعربي على الأقل', 'error');
      }
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('allow_student').insert([formData]);

      if (error) throw error;

      setSuccessMsgVisible(true);
      if (typeof showAlertMessage === 'function') {
        showAlertMessage('تم إضافة الطالب بنجاح!', 'success');
      }

      // إخفاء رسالة النجاح تلقائياً بعد 3 ثوانٍ
      setTimeout(() => {
        setSuccessMsgVisible(false);
      }, 3000);

      // إعادة تعيين النموذج بعد الحفظ الناجح
      setFormData({
        national_id: '',
        full_name_ar: '',
        full_name_en: '',
        gender: 'ذكر',
        nationality: 'فلسطيني',
        birth_date: '',
        birth_place: '',
        phone_number: '',
        whatsapp_number: '',
        address: '',
        directorate_id: '',
        school_id: '',
        directorate_name: '',
        school_name: '',
        branch: ''
      });
    } catch (error) {
      if (typeof showAlertMessage === 'function') {
        showAlertMessage('خطأ في إضافة الطالب: ' + error.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '25px', color: '#fff', direction: 'rtl', maxWidth: '900px', margin: '0 auto' }}>
      <h3 style={{ fontSize: '20px', marginBottom: '20px', color: '#60a5fa', borderBottom: '2px solid #2563eb', paddingBottom: '8px', textAlign: 'center' }}>
        🎓 إضافة طالب جديد (Allow Student)
      </h3>

      {/* رسالة النجاح التي تختفي بعد 3 ثوانٍ */}
      {successMsgVisible && (
        <div style={{ backgroundColor: '#065f46', color: '#d1fae5', padding: '15px', borderRadius: '6px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold', border: '2px solid #10b981', fontSize: '17px' }}>
          ✨ تم حفظ بيانات الطالب بنجاح!
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {/* الصف الأول (3 أعمدة) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
          <div>
            <label style={labelStyle}>رقم هوية الطالب:</label>
            <input
              type="text"
              name="national_id"
              value={formData.national_id}
              onChange={handleChange}
              placeholder="أدخل رقم هوية الطالب"
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={labelStyle}>الاسم الكامل (عربي):</label>
            <input
              type="text"
              name="full_name_ar"
              value={formData.full_name_ar}
              onChange={handleChange}
              placeholder="الاسم الكامل بالعربية"
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={labelStyle}>الاسم الكامل (إنجليزي):</label>
            <input
              type="text"
              name="full_name_en"
              value={formData.full_name_en}
              onChange={handleChange}
              placeholder="Full Name in English"
              style={inputStyle}
            />
          </div>
        </div>

        {/* الصف الثاني: الجنس، الجنسية، تاريخ الميلاد، مكان الميلاد (4 أعمدة بنفس السطر) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
          <div>
            <label style={labelStyle}>الجنس:</label>
            <select name="gender" value={formData.gender} onChange={handleChange} style={inputStyle}>
              <option value="ذكر">ذكر</option>
              <option value="أنثى">أنثى</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>الجنسية:</label>
            <input
              type="text"
              name="nationality"
              value={formData.nationality}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>تاريخ الميلاد:</label>
            <input
              type="date"
              name="birth_date"
              value={formData.birth_date}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>مكان الميلاد:</label>
            <input
              type="text"
              name="birth_place"
              value={formData.birth_place}
              onChange={handleChange}
              placeholder="مثال: غزة"
              style={inputStyle}
            />
          </div>
        </div>

        {/* الصف الثالث (أعمدة البيانات المتبقية والفرع) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
          <div>
            <label style={labelStyle}>رقم الهاتف:</label>
            <input
              type="text"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              placeholder="0500..."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>رقم الواتساب:</label>
            <input
              type="text"
              name="whatsapp_number"
              value={formData.whatsapp_number}
              onChange={handleChange}
              placeholder="00970..."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>العنوان:</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="مثال: النصيرات"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>المديرية:</label>
            <select
              name="directorate_id"
              value={formData.directorate_id}
              onChange={handleChange}
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
              name="school_id"
              value={formData.school_id}
              onChange={handleChange}
              disabled={!formData.directorate_id}
              style={{ ...inputStyle, opacity: formData.directorate_id ? 1 : 0.6 }}
            >
              <option value="">
                {formData.directorate_id ? 'اختر المدرسة التابعة للمديرية' : 'اختر المديرية أولاً'}
              </option>
              {availableSchools.map(school => (
                <option key={school.id} value={school.id}>
                  {school.school_name}
                </option>
              ))}
            </select>
          </div>

          {/* الفرع يجلب من جدول الفروع (branches) عبر قائمة منسدلة */}
          <div>
            <label style={labelStyle}>الفرع:</label>
            <select
              name="branch"
              value={formData.branch}
              onChange={handleChange}
              style={inputStyle}
            >
              <option value="">اختر الفرع</option>
              {branchesList.map((b, index) => {
                const branchValue = b.name || b.branch_name || b.id;
                return (
                  <option key={index} value={branchValue}>
                    {branchValue}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: '14px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginTop: '10px' }}
        >
          {loading ? 'جاري الإضافة...' : 'حفظ الطالب'}
        </button>
      </form>

      <section className="allow-student-import-card" style={{ marginTop: '30px', padding: '20px', border: '1px solid #475569', borderRadius: '12px', background: '#0f172a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h4 style={{ margin: 0, color: '#38bdf8', fontSize: '18px' }}>📥 استيراد طلاب إلى Allow Student</h4>
            <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '12px' }}>هذه العملية مستقلة عن إضافة الطالب اليدوية، وتدعم Excel أو جدولًا خارجيًا مع مطابقة الحقول.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={allowDeleteFilter} onChange={e => setAllowDeleteFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: '150px' }} aria-label="نوع الطلاب للحذف">
              <option value="all">جميع الطلاب</option>
              <option value="passed">الناجحون</option>
              <option value="incomplete">المكملون</option>
              <option value="failed">الراسبون</option>
            </select>
            <button type="button" onClick={deleteAllowStudents} disabled={deletingAll} style={{ padding: '10px 14px', background: '#991b1b', color: '#fff', border: '1px solid #ef4444', borderRadius: '8px', fontWeight: 'bold' }}>
              {deletingAll ? 'جاري الحذف...' : '🗑️ حذف الطلاب'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button type="button" onClick={() => setImportSource('excel')} style={{ ...sourceButtonStyle, background: importSource === 'excel' ? '#2563eb' : '#334155' }}>📊 من Excel</button>
          <button type="button" onClick={() => setImportSource('table')} style={{ ...sourceButtonStyle, background: importSource === 'table' ? '#2563eb' : '#334155' }}>🗄️ من جدول خارجي</button>
        </div>

        {importSource === 'excel' ? (
          <div style={{ marginTop: '14px' }}>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} disabled={importLoading} style={{ width: '100%', color: '#fff' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
            <input value={externalTableName} onChange={(e) => setExternalTableName(e.target.value)} placeholder="اسم الجدول الخارجي مثل external_students" style={{ ...inputStyle, flex: 1, minWidth: '220px' }} />
            <button type="button" onClick={handleExternalTableLoad} disabled={importLoading} style={{ padding: '10px 18px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>{importLoading ? 'جاري القراءة...' : 'تحميل البيانات'}</button>
          </div>
        )}

        {importHeaders.length > 0 && (
          <div style={{ marginTop: '18px' }}>
            <h5 style={{ margin: '0 0 10px', color: '#e2e8f0' }}>🔗 مطابقة الحقول</h5>
            <div className="allow-student-mapping-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              {allowStudentFields.map(field => (
                <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: '5px', color: '#cbd5e1', fontSize: '12px' }}>
                  {field}
                  <select value={fieldMapping[field] || ''} onChange={(e) => setFieldMapping(prev => ({ ...prev, [field]: e.target.value }))} style={inputStyle}>
                    <option value="">-- بدون مطابقة --</option>
                    {importHeaders.map(header => <option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>

            <div style={{ marginTop: '14px', padding: '12px', background: '#111827', borderRadius: '8px', color: '#cbd5e1', fontSize: '13px' }}>
              عدد السجلات المقروءة: <strong>{importRows.length}</strong>
              {importSummary && <> — صالح مبدئيًا: <strong>{importSummary.valid}</strong> — مكرر: <strong>{importSummary.duplicate}</strong> — ناقص: <strong>{importSummary.invalid}</strong></>}
            </div>
            <button type="button" onClick={importMappedStudents} disabled={importLoading} style={{ width: '100%', marginTop: '12px', padding: '13px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px' }}>
              {importLoading ? 'جاري الاستيراد...' : '✅ تأكيد استيراد الطلاب'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  marginBottom: '5px',
  fontSize: '13px',
  color: '#93c5fd'
};

const inputStyle = {
  width: '100%',
  padding: '10px',
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  color: '#fff',
  borderRadius: '6px',
  fontSize: '14px',
  boxSizing: 'border-box'
};
const sourceButtonStyle = { padding: '10px 16px', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
