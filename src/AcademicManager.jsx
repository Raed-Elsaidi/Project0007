import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function AcademicManager({ currentUser = null, userRole = '' }) {
  const [branchesList, setBranchesList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [unitsList, setUnitsList] = useState([]);

  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchNumber, setNewBranchNumber] = useState('');
  
  const [subjectSelectedBranch, setSubjectSelectedBranch] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectMinimumMark, setNewSubjectMinimumMark] = useState('');
  const [newSubjectMaximumMark, setNewSubjectMaximumMark] = useState('');
  
  const [unitSelectedBranch, setUnitSelectedBranch] = useState('');
  const [unitSelectedSubject, setUnitSelectedSubject] = useState('');
  const [newUnitName, setNewUnitName] = useState('');

  const [message, setMessage] = useState({ text: '', color: '' });

  const isScopedAcademicUser = userRole === 'Teacher' || userRole === 'Supervisor';
  const scopedBranchId = currentUser?.branch_id ?? null;
  const scopedSubjectId = currentUser?.subject_id ?? null;

  // نافذة مخصصة وسط الشاشة للتعديل والحذف بدل window.prompt / confirm
  const [actionDialog, setActionDialog] = useState({
    open: false,
    mode: '',
    title: '',
    label: '',
    value: '',
    item: null
  });

  useEffect(() => {
    fetchAllData();
  }, [isScopedAcademicUser, scopedBranchId, scopedSubjectId]);

  const showTimedMessage = (text, color) => {
    setMessage({ text, color });
    setTimeout(() => {
      setMessage({ text: '', color: '' });
    }, 3000);
  };

  const fetchAllData = async () => {
    try {
      const { data: branches } = await supabase.from('branches').select('*');
      if (branches) setBranchesList(isScopedAcademicUser && scopedBranchId != null
        ? branches.filter(b => Number(b.id) === Number(scopedBranchId))
        : branches);

      const { data: subjects } = await supabase.from('subjects').select('*');
      if (subjects) setSubjectsList(isScopedAcademicUser
        ? subjects.filter(s => (scopedBranchId == null || Number(s.branch_id) === Number(scopedBranchId)) && (scopedSubjectId == null || Number(s.id) === Number(scopedSubjectId)))
        : subjects);

      const { data: units } = await supabase.from('units').select('*');
      if (units) setUnitsList(isScopedAcademicUser
        ? units.filter(u => (scopedSubjectId == null || Number(u.subject_id) === Number(scopedSubjectId)))
        : units);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  // --- إدارة الفروع ---
  const handleAddBranch = async (e) => {
    e.preventDefault();
    if (isScopedAcademicUser) return;
    const branchNumber = Number(newBranchNumber);

    if (!newBranchName.trim()) {
      showTimedMessage('أدخل اسم الفرع', '#dc2626');
      return;
    }

    if (!Number.isInteger(branchNumber) || branchNumber < 1 || branchNumber > 9) {
      showTimedMessage('رقم الفرع يجب أن يكون رقماً صحيحاً من 1 إلى 9', '#dc2626');
      return;
    }

    try {
      const { data: existingBranch } = await supabase
        .from('branches')
        .select('id')
        .eq('branch_number', branchNumber)
        .maybeSingle();

      if (existingBranch) {
        showTimedMessage('رقم الفرع مستخدم مسبقاً، اختر رقماً آخر', '#dc2626');
        return;
      }

      const { error } = await supabase.from('branches').insert([{
        branch_name: newBranchName.trim(),
        branch_number: branchNumber
      }]);

      if (error) throw error;

      setNewBranchName('');
      setNewBranchNumber('');
      showTimedMessage('تم إضافة الفرع بنجاح', '#059669');
      fetchAllData();
    } catch (err) {
      showTimedMessage('خطأ: ' + err.message, '#dc2626');
    }
  };

  const handleDeleteBranch = async (id) => {
    try {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) throw error;
      showTimedMessage('تم حذف الفرع بنجاح', '#059669');
      fetchAllData();
    } catch (err) {
      showTimedMessage('خطأ أثناء الحذف: ' + err.message, '#dc2626');
    }
  };

  const handleEditBranch = (branch) => {
    setActionDialog({
      open: true,
      mode: 'editBranch',
      title: 'تعديل اسم الفرع',
      label: 'اسم الفرع',
      value: branch.branch_name || branch.name || '',
      branchNumber: branch.branch_number ?? '',
      minimumMark: '',
      maximumMark: '',
      item: branch
    });
  };

  const saveEditBranch = async () => {
    const branch = actionDialog.item;
    const newName = actionDialog.value.trim();
    const branchNumber = Number(actionDialog.branchNumber);

    if (!newName) {
      showTimedMessage('اسم الفرع لا يمكن أن يكون فارغاً', '#dc2626');
      return;
    }

    if (!Number.isInteger(branchNumber) || branchNumber < 1 || branchNumber > 9) {
      showTimedMessage('رقم الفرع يجب أن يكون رقماً صحيحاً من 1 إلى 9', '#dc2626');
      return;
    }

    try {
      const { data: existingBranch } = await supabase
        .from('branches')
        .select('id')
        .eq('branch_number', branchNumber)
        .neq('id', branch.id)
        .maybeSingle();

      if (existingBranch) {
        showTimedMessage('رقم الفرع مستخدم مسبقاً، اختر رقماً آخر', '#dc2626');
        return;
      }

      const { error } = await supabase
        .from('branches')
        .update({
          branch_name: newName,
          branch_number: branchNumber
        })
        .eq('id', branch.id);

      if (error) throw error;

      closeActionDialog();
      showTimedMessage('تم تعديل بيانات الفرع بنجاح', '#059669');
      fetchAllData();
    } catch (err) {
      showTimedMessage('خطأ أثناء تعديل الفرع: ' + err.message, '#dc2626');
    }
  };

  // --- إدارة المباحث ---
  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (isScopedAcademicUser) return;
    if (!subjectSelectedBranch || !newSubjectName.trim()) return;

    const minimumMark = Number(newSubjectMinimumMark);
    const maximumMark = Number(newSubjectMaximumMark);

    if (!Number.isFinite(minimumMark) || minimumMark < 0) {
      showTimedMessage('أدخل علامة دنيا صحيحة (0 أو أكبر)', '#dc2626');
      return;
    }

    if (!Number.isFinite(maximumMark) || maximumMark <= 0) {
      showTimedMessage('أدخل علامة قصوى صحيحة أكبر من صفر', '#dc2626');
      return;
    }

    if (maximumMark < minimumMark) {
      showTimedMessage('العلامة القصوى يجب أن تكون أكبر من أو تساوي العلامة الدنيا', '#dc2626');
      return;
    }

    try {
      const { error } = await supabase.from('subjects').insert([
        {
          branch_id: Number(subjectSelectedBranch),
          subject_name: newSubjectName.trim(),
          minimum_mark: minimumMark,
          maximum_mark: maximumMark
        }
      ]);
      if (error) throw error;
      setNewSubjectName('');
      setNewSubjectMinimumMark('');
      setNewSubjectMaximumMark('');
      showTimedMessage('تم إضافة المبحث مع العلامة الدنيا والقصوى بنجاح', '#059669');
      fetchAllData();
    } catch (err) {
      showTimedMessage('خطأ: ' + err.message, '#dc2626');
    }
  };

  const handleDeleteSubject = async (id) => {
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw error;
      showTimedMessage('تم حذف المبحث بنجاح', '#059669');
      fetchAllData();
    } catch (err) {
      showTimedMessage('خطأ أثناء الحذف: ' + err.message, '#dc2626');
    }
  };

  const handleEditSubject = (subject) => {
    setActionDialog({
      open: true,
      mode: 'editSubject',
      title: 'تعديل بيانات المبحث',
      label: 'اسم المبحث',
      value: subject.subject_name || subject.name || '',
      minimumMark: subject.minimum_mark ?? subject.min_mark ?? '',
      maximumMark: subject.maximum_mark ?? subject.max_mark ?? '',
      item: subject
    });
  };

  const saveEditSubject = async () => {
    const subject = actionDialog.item;
    const newName = actionDialog.value.trim();
    const minimumMark = Number(actionDialog.minimumMark);
    const maximumMark = Number(actionDialog.maximumMark);

    if (!newName) {
      showTimedMessage('اسم المبحث لا يمكن أن يكون فارغاً', '#dc2626');
      return;
    }

    if (!Number.isFinite(minimumMark) || minimumMark < 0) {
      showTimedMessage('أدخل علامة دنيا صحيحة (0 أو أكبر)', '#dc2626');
      return;
    }

    if (!Number.isFinite(maximumMark) || maximumMark <= 0) {
      showTimedMessage('أدخل علامة قصوى صحيحة أكبر من صفر', '#dc2626');
      return;
    }

    if (maximumMark < minimumMark) {
      showTimedMessage('العلامة القصوى يجب أن تكون أكبر من أو تساوي العلامة الدنيا', '#dc2626');
      return;
    }

    try {
      const { error } = await supabase
        .from('subjects')
        .update({
          subject_name: newName,
          minimum_mark: minimumMark,
          maximum_mark: maximumMark
        })
        .eq('id', subject.id);
      if (error) throw error;
      closeActionDialog();
      showTimedMessage('تم تعديل المبحث وعلاماته بنجاح', '#059669');
      fetchAllData();
    } catch (err) {
      showTimedMessage('خطأ أثناء تعديل المبحث: ' + err.message, '#dc2626');
    }
  };

  // --- إدارة الوحدات ---
  const handleAddUnit = async (e) => {
    e.preventDefault();
    if (!unitSelectedSubject || !newUnitName.trim()) return;
    
    const existingUnitsForSubject = unitsList.filter(u => u.subject_id == unitSelectedSubject);
    const nextUnitNumber = existingUnitsForSubject.length + 1;

    try {
      const { error } = await supabase.from('units').insert([
        { 
          subject_id: parseInt(unitSelectedSubject), 
          unit_number: nextUnitNumber, 
          name: newUnitName 
        }
      ]);
      if (error) throw error;
      setNewUnitName('');
      showTimedMessage(`تم إضافة الوحدة ${nextUnitNumber} بنجاح`, '#059669');
      fetchAllData();
    } catch (err) {
      showTimedMessage('خطأ: ' + err.message, '#dc2626');
    }
  };

  const handleDeleteUnit = async (id) => {
    try {
      const { error } = await supabase.from('units').delete().eq('id', id);
      if (error) throw error;
      showTimedMessage('تم حذف الوحدة بنجاح', '#059669');
      fetchAllData();
    } catch (err) {
      showTimedMessage('خطأ أثناء الحذف: ' + err.message, '#dc2626');
    }
  };

  const handleEditUnit = (unit) => {
    setActionDialog({
      open: true,
      mode: 'editUnit',
      title: `تعديل اسم الوحدة ${unit.unit_number || ''}`,
      label: 'اسم الوحدة',
      value: unit.name || unit.unit_name || '',
      minimumMark: '',
      maximumMark: '',
      item: unit
    });
  };

  const saveEditUnit = async () => {
    const unit = actionDialog.item;
    const newName = actionDialog.value.trim();
    if (!newName) {
      showTimedMessage('اسم الوحدة لا يمكن أن يكون فارغاً', '#dc2626');
      return;
    }
    try {
      const { error } = await supabase
        .from('units')
        .update({ name: newName })
        .eq('id', unit.id);
      if (error) throw error;
      closeActionDialog();
      showTimedMessage('تم تعديل الوحدة بنجاح', '#059669');
      fetchAllData();
    } catch (err) {
      showTimedMessage('خطأ أثناء تعديل الوحدة: ' + err.message, '#dc2626');
    }
  };

  const closeActionDialog = () => {
    setActionDialog({ open: false, mode: '', title: '', label: '', value: '', branchNumber: '', minimumMark: '', maximumMark: '', item: null });
  };

  const openDeleteDialog = (type, item) => {
    const labels = { branch: 'الفرع', subject: 'المبحث', unit: 'الوحدة' };
    setActionDialog({
      open: true,
      mode: `delete${type.charAt(0).toUpperCase() + type.slice(1)}`,
      title: `حذف ${labels[type]}`,
      label: '',
      value: '',
      minimumMark: '',
      maximumMark: '',
      item
    });
  };

  const performDelete = async () => {
    const { mode, item } = actionDialog;
    const tableMap = {
      deleteBranch: 'branches',
      deleteSubject: 'subjects',
      deleteUnit: 'units'
    };
    const successMap = {
      deleteBranch: 'تم حذف الفرع بنجاح',
      deleteSubject: 'تم حذف المبحث بنجاح',
      deleteUnit: 'تم حذف الوحدة بنجاح'
    };
    const table = tableMap[mode];
    if (!table || !item?.id) return;

    try {
      const { error } = await supabase.from(table).delete().eq('id', item.id);
      if (error) throw error;
      closeActionDialog();
      showTimedMessage(successMap[mode], '#059669');
      fetchAllData();
    } catch (err) {
      closeActionDialog();
      showTimedMessage('خطأ أثناء الحذف: ' + err.message, '#dc2626');
    }
  };

  const filteredSubjectsForUnit = subjectsList.filter(s => s.branch_id == unitSelectedBranch);
  const currentSubjectUnits = unitsList.filter(u => u.subject_id == unitSelectedSubject);

  useEffect(() => {
    if (!isScopedAcademicUser) return;
    if (scopedBranchId != null) setUnitSelectedBranch(String(scopedBranchId));
    if (scopedSubjectId != null) setUnitSelectedSubject(String(scopedSubjectId));
  }, [isScopedAcademicUser, scopedBranchId, scopedSubjectId]);

  return (
    <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '30px', maxWidth: '1000px', margin: '0 auto', color: '#fff', direction: 'rtl' }}>
      
      <style>{`
        .edge-fix-select {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 2px solid #3b82f6 !important;
          padding: 14px 16px !important;
          border-radius: 6px !important;
          font-size: 19px !important;
          font-weight: bold !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .edge-fix-select option {
          background-color: #ffffff !important;
          color: #0f172a !important;
          font-weight: bold !important;
          font-size: 17px !important;
          padding: 10px !important;
        }
        /* نفس ستايل زر الحذف المستخدم في إدارة الموظفين */
        .academic-delete-btn {
          width: 62px !important;
          min-width: 62px !important;
          max-width: 62px !important;
          min-height: 30px !important;
          height: 30px !important;
          padding: 4px 2px !important;
          border: 1px solid rgba(255,255,255,.16) !important;
          border-radius: 999px !important;
          color: #fff !important;
          font-size: 8.5px !important;
          font-weight: 900 !important;
          line-height: 1 !important;
          white-space: nowrap !important;
          cursor: pointer !important;
          box-shadow: 0 3px 8px rgba(2,6,23,.18) !important;
          transition: transform .15s ease, filter .15s ease !important;
          background: linear-gradient(135deg, #dc2626, #be123c) !important;
        }
        .academic-delete-btn:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
        }
        /* نفس ستايل أزرار الإجراءات في إدارة الموظفين - زر التعديل */
        .academic-edit-btn {
          width: 62px !important;
          min-width: 62px !important;
          max-width: 62px !important;
          min-height: 30px !important;
          height: 30px !important;
          padding: 4px 2px !important;
          border: 1px solid rgba(255,255,255,.16) !important;
          border-radius: 999px !important;
          color: #fff !important;
          font-size: 8.5px !important;
          font-weight: 900 !important;
          line-height: 1 !important;
          white-space: nowrap !important;
          cursor: pointer !important;
          box-shadow: 0 3px 8px rgba(2,6,23,.18) !important;
          transition: transform .15s ease, filter .15s ease !important;
          background: linear-gradient(135deg, #d97706, #ea580c) !important;
        }
        .academic-edit-btn:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
        }


        .edge-input {
          background-color: #ffffff !important;
          color: #000000 !important;
          border: 2px solid #94a3b8 !important;
          padding: 14px 16px !important;
          border-radius: 6px !important;
          font-size: 19px !important;
          font-weight: 700 !important;
          outline: none !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .edge-input:focus {
          border-color: #3b82f6 !important;
        }
      `}</style>

      <h3 style={{ fontSize: '22px', marginBottom: '15px', color: '#60a5fa', borderBottom: '2px solid #2563eb', paddingBottom: '10px', textAlign: 'center' }}>
        {isScopedAcademicUser ? 'الوحدات الدراسية' : 'إدارة الهيكلية الأكاديمية (الفروع، المباحث، والوحدات)'}
      </h3>

      {message.text && (
        <div style={{ backgroundColor: message.color, color: '#ffffff', padding: '15px 20px', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold', textAlign: 'center', fontSize: '18px', border: '2px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
          {message.text}
        </div>
      )}

      {!isScopedAcademicUser && (
      <>
      {/* الأعمدة الرئيسية (العمود الأول: الفروع، العمود الثاني: المباحث) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        
        {/* 1. العمود الأول: الفروع الأكاديمية */}
        <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#60a5fa', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>1. الفروع الأكاديمية</h3>
          
          <form onSubmit={handleAddBranch} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '15px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="اسم الفرع الجديد (علمي، أدبي)..."
              value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              className="edge-input"
              required
            />
            <input
              type="number"
              min="1"
              max="9"
              step="1"
              inputMode="numeric"
              lang="en-US"
              placeholder="رقم الفرع (1-9)"
              value={newBranchNumber}
              onChange={e => setNewBranchNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 1))}
              className="edge-input"
              style={{ direction: 'ltr', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
              required
            />
            <button type="submit" style={{ gridColumn: '1 / -1', backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '18px' }}>إضافة الفرع</button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {branchesList.map(b => (
              <div key={b.id} style={{ backgroundColor: '#1e293b', padding: '12px 14px', borderRadius: '6px', border: '1px solid #334155', fontSize: '16px', color: '#fff', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span>{b.branch_name || b.name}</span>
                  <span style={{ direction: 'ltr', fontVariantNumeric: 'tabular-nums', backgroundColor: '#172554', color: '#93c5fd', padding: '5px 10px', borderRadius: '6px', fontSize: '14px' }}>
                    رقم الفرع: {b.branch_number ?? '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button onClick={() => handleEditBranch(b)} className="academic-edit-btn">تعديل</button>
                  <button className="academic-delete-btn" onClick={() => openDeleteDialog('branch', b)}>حذف</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. العمود الثاني: المباحث الدراسية */}
        <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#60a5fa', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>2. المباحث الدراسية</h3>
          
          <form onSubmit={handleAddSubject} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '15px' }}>
            <select 
              value={subjectSelectedBranch} 
              onChange={e => setSubjectSelectedBranch(e.target.value)} 
              className="edge-fix-select" 
              required
            >
              <option value="">-- اختر الفرع التابع له المبحث --</option>
              {branchesList.map(b => (
                <option key={b.id} value={b.id}>{b.branch_name || b.name}</option>
              ))}
            </select>

            <input 
              type="text" 
              placeholder="اسم المبحث الدراسي..." 
              value={newSubjectName} 
              onChange={e => setNewSubjectName(e.target.value)} 
              className="edge-input" 
              required 
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="العلامة الدنيا"
                value={newSubjectMinimumMark}
                onChange={e => setNewSubjectMinimumMark(e.target.value)}
                className="edge-input"
                required
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="العلامة القصوى"
                value={newSubjectMaximumMark}
                onChange={e => setNewSubjectMaximumMark(e.target.value)}
                className="edge-input"
                required
              />
            </div>

            <button type="submit" style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '18px' }}>إضافة المبحث</button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {!subjectSelectedBranch ? (
              <p style={{ fontSize: '15px', color: '#94a3b8', textAlign: 'center', padding: '10px' }}>اختر فرعاً لعرض مباحثه الخاصة.</p>
            ) : (
              subjectsList
                .filter(s => s.branch_id == subjectSelectedBranch)
                .map(s => (
                  <div key={s.id} style={{ backgroundColor: '#1e293b', padding: '12px 14px', borderRadius: '6px', border: '1px solid #334155', fontSize: '16px', color: '#fff', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span>{s.subject_name || s.name}</span>
                      <span style={{ fontSize: '13px', color: '#bfdbfe' }}>
                        الدنيا: {s.minimum_mark ?? s.min_mark ?? 0} — القصوى: {s.maximum_mark ?? s.max_mark ?? 0}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button onClick={() => handleEditSubject(s)} className="academic-edit-btn">تعديل</button>
                      <button className="academic-delete-btn" onClick={() => openDeleteDialog('subject', s)}>حذف</button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

      </div>
      </>
      )}

      {/* 3. قسم الوحدات الدراسية */}
      <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#60a5fa', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>3. الوحدات الدراسية (ترقيم تلقائي)</h3>
        
        <form onSubmit={handleAddUnit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: '15px', marginBottom: '15px', alignItems: 'center' }}>
          <select 
            value={unitSelectedBranch} 
            onChange={e => {
              setUnitSelectedBranch(e.target.value);
              setUnitSelectedSubject('');
            }} 
            className="edge-fix-select" 
            required
            disabled={isScopedAcademicUser}
          >
            <option value="">-- اختر الفرع أولاً --</option>
            {branchesList.map(b => (
              <option key={b.id} value={b.id}>{b.branch_name || b.name}</option>
            ))}
          </select>

          <select 
            value={unitSelectedSubject} 
            onChange={e => setUnitSelectedSubject(e.target.value)} 
            className="edge-fix-select" 
            required
            disabled={isScopedAcademicUser}
          >
            <option value="">-- اختر المبحث الدراسي --</option>
            {filteredSubjectsForUnit.map(s => (
              <option key={s.id} value={s.id}>{s.subject_name || s.name}</option>
            ))}
          </select>

          <input 
            type="text" 
            placeholder="عنوان الوحدة الدراسية (رقم الوحدة يضاف تلقائياً)..." 
            value={newUnitName} 
            onChange={e => setNewUnitName(e.target.value)} 
            className="edge-input" 
            required 
          />

          <button type="submit" style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '14px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '18px', whiteSpace: 'nowrap', height: '100%' }}>إضافة الوحدة</button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
          {currentSubjectUnits.length === 0 ? (
            <p style={{ fontSize: '15px', color: '#94a3b8', textAlign: 'center', padding: '10px' }}>اختر فرعاً ومبحثاً لعرض الوحدات الخاصة بهما.</p>
          ) : (
            currentSubjectUnits.map(u => (
              <div key={u.id} style={{ backgroundColor: '#1e293b', padding: '12px 14px', borderRadius: '6px', border: '1px solid #334155', fontSize: '16px', color: '#fff', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>الوحدة {u.unit_number}: {u.name || u.unit_name}</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button onClick={() => handleEditUnit(u)} className="academic-edit-btn">تعديل</button>
                  <button className="academic-delete-btn" onClick={() => openDeleteDialog('unit', u)}>حذف</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {actionDialog.open && (
        <div
          onClick={closeActionDialog}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            direction: 'rtl',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(440px, 94vw)',
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: '24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              textAlign: 'right'
            }}
          >
            <h3 style={{ margin: '0 0 18px', textAlign: 'center', color: '#172554' }}>
              {actionDialog.title}
            </h3>

            {actionDialog.mode.startsWith('edit') ? (
              <>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155' }}>
                  {actionDialog.label}
                </label>
                <input
                  autoFocus
                  value={actionDialog.value}
                  onChange={(e) => setActionDialog(prev => ({ ...prev, value: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (actionDialog.mode === 'editBranch') saveEditBranch();
                      else if (actionDialog.mode === 'editSubject') saveEditSubject();
                      else if (actionDialog.mode === 'editUnit') saveEditUnit();
                    }
                  }}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px',
                    border: '1px solid #94a3b8',
                    borderRadius: '8px',
                    fontSize: '16px',
                    marginBottom: actionDialog.mode === 'editSubject' ? '12px' : '18px'
                  }}
                />

                {actionDialog.mode === 'editBranch' && (
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155' }}>
                      رقم الفرع (1-9)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="9"
                      step="1"
                      inputMode="numeric"
                      lang="en-US"
                      value={actionDialog.branchNumber}
                      onChange={(e) =>
                        setActionDialog(prev => ({
                          ...prev,
                          branchNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 1)
                        }))
                      }
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '12px',
                        border: '1px solid #94a3b8',
                        borderRadius: '8px',
                        fontSize: '16px',
                        direction: 'ltr',
                        textAlign: 'center',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    />
                  </div>
                )}

                {actionDialog.mode === 'editSubject' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#334155', fontSize: '14px' }}>
                        العلامة الدنيا
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={actionDialog.minimumMark}
                        onChange={(e) => setActionDialog(prev => ({ ...prev, minimumMark: e.target.value }))}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '12px',
                          border: '1px solid #94a3b8',
                          borderRadius: '8px',
                          fontSize: '16px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#334155', fontSize: '14px' }}>
                        العلامة القصوى
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={actionDialog.maximumMark}
                        onChange={(e) => setActionDialog(prev => ({ ...prev, maximumMark: e.target.value }))}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '12px',
                          border: '1px solid #94a3b8',
                          borderRadius: '8px',
                          fontSize: '16px'
                        }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                  <button
                    onClick={() => {
                      if (actionDialog.mode === 'editBranch') saveEditBranch();
                      else if (actionDialog.mode === 'editSubject') saveEditSubject();
                      else if (actionDialog.mode === 'editUnit') saveEditUnit();
                    }}
                    style={{
                      backgroundColor: '#059669',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 28px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    موافق
                  </button>
                  <button
                    onClick={closeActionDialog}
                    style={{
                      backgroundColor: '#64748b',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 28px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ textAlign: 'center', color: '#334155', fontSize: '16px', margin: '8px 0 22px' }}>
                  هل أنت متأكد من حذف هذا العنصر؟
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                  <button
                    onClick={performDelete}
                    style={{
                      backgroundColor: '#dc2626',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 28px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    حذف
                  </button>
                  <button
                    onClick={closeActionDialog}
                    style={{
                      backgroundColor: '#64748b',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 28px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}