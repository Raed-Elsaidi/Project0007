import React, { useEffect, useMemo, useState } from 'react';

export default function CheatingMonitor({ supabase }) {
  const [cases, setCases] = useState([]);
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [branchFilter, setBranchFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [deductionModal, setDeductionModal] = useState(null);
  const [deductionMarks, setDeductionMarks] = useState('');
  const [centerMessage, setCenterMessage] = useState(null);

  const employeeId = localStorage.getItem('currentUserId');

  useEffect(() => {
    loadData();
  }, []);

  const showCenterMessage = (text, type = 'error', duration = 2500) => {
    setCenterMessage({ text, type });
    window.setTimeout(() => setCenterMessage(null), duration);
  };

  const loadData = async () => {
    setLoading(true);

    try {
      // نقرأ الجداول بشكل منفصل لتجنب مشاكل علاقات PostgREST المتداخلة.
      const { data: caseData, error: caseError } = await supabase
        .from('cheating_cases')
        .select('*')
        .order('occurred_at', { ascending: false });

      if (caseError) throw new Error(`cheating_cases: ${caseError.message}`);

      const studentIds = [...new Set((caseData || []).map((x) => x.student_id).filter(Boolean))];
      const examIds = [...new Set((caseData || []).map((x) => x.exam_id).filter(Boolean))];

      let studentData = [];
      let examData = [];

      if (studentIds.length) {
        const { data, error } = await supabase
          .from('students')
          .select('id, full_name_ar, national_id, seating_number, gender, branch_id, directorate_id, school_id')
          .in('id', studentIds);
        if (error) throw new Error(`students: ${error.message}`);
        studentData = data || [];
      }

      if (examIds.length) {
        const { data, error } = await supabase
          .from('exams')
          .select('id, title, branch_id, subject_id')
          .in('id', examIds);
        if (error) throw new Error(`exams: ${error.message}`);
        examData = data || [];
      }

      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('*');
      if (branchError) throw new Error(`branches: ${branchError.message}`);

      const { data: subjectData, error: subjectError } = await supabase
        .from('subjects')
        .select('*');
      if (subjectError) throw new Error(`subjects: ${subjectError.message}`);

      const studentsById = Object.fromEntries((studentData || []).map((x) => [x.id, x]));
      const examsById = Object.fromEntries((examData || []).map((x) => [x.id, x]));

      const mergedCases = (caseData || []).map((item) => ({
        ...item,
        student: studentsById[item.student_id] || null,
        exam: examsById[item.exam_id] || null,
      }));

      setCases(mergedCases);
      setBranches(branchData || []);
      setSubjects(subjectData || []);
    } catch (error) {
      console.error('خطأ في تحميل حالات الغش:', error);
      showCenterMessage(`تعذر تحميل حالات الغش.\n\nالتفاصيل: ${error?.message || error}`, 'error', 5000);
    } finally {
      setLoading(false);
    }
  };

  const branchName = (id) => {
    const item = branches.find((b) => String(b.id) === String(id));
    return item?.branch_name || item?.name || item?.branch || 'غير محدد';
  };

  const subjectName = (id) => {
    const item = subjects.find((s) => String(s.id) === String(id));
    return item?.subject_name || item?.name || item?.subject || 'غير محددة';
  };

  const studentName = (student) =>
    student?.full_name_ar || student?.full_name_en || 'غير محدد';

  const violationLabel = (type) => {
    const map = {
      camera: '📹 كشف الكاميرا',
      microphone: '🎙️ كشف المايك',
      exam_closed: '🚪 إغلاق شاشة الامتحان',
      camera_microphone: '📹🎙️ الكاميرا والمايك',
      other: '⚠️ مخالفة أخرى'
    };
    return map[type] || type || '⚠️ مخالفة';
  };

  const statusLabel = (status) => {
    const map = {
      pending: 'بانتظار الإجراء',
      excused: 'تم التجاوز',
      deducted: 'تم خصم علامات',
      failed: 'راسب في المادة'
    };
    return map[status] || status;
  };

  // تحويل أي أرقام عربية/فارسية إلى أرقام إنجليزية 0-9
  const englishDigits = (value) => {
    if (value === null || value === undefined) return '-';
    return String(value)
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return englishDigits(value);
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  };

  const formatTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  };

  // المواد المرتبطة بالفرع المختار فقط.
  // نعتمد أولاً على branch_id، مع دعم branch/branch_name إذا كانت بعض سجلات المواد تخزن اسم الفرع.
  const filteredSubjects = useMemo(() => {
    if (!branchFilter) return [...subjects];

    const selectedBranch = branches.find(
      (b) => String(b.id) === String(branchFilter)
    );
    const selectedBranchNames = new Set(
      [
        selectedBranch?.branch_name,
        selectedBranch?.name,
        selectedBranch?.branch,
      ]
        .filter(Boolean)
        .map((v) => String(v).trim().toLowerCase())
    );

    return subjects.filter((subject) => {
      if (subject?.branch_id != null && String(subject.branch_id) === String(branchFilter)) {
        return true;
      }

      const subjectBranch =
        subject?.branch_name ?? subject?.branch ?? subject?.branchName;

      return (
        subjectBranch != null &&
        selectedBranchNames.has(String(subjectBranch).trim().toLowerCase())
      );
    });
  }, [subjects, branches, branchFilter]);

  // إذا تغيّر الفرع وأصبحت المادة الحالية ليست من هذا الفرع، نلغي اختيارها.
  useEffect(() => {
    if (subjectFilter && !filteredSubjects.some((subject) => String(subject.id) === String(subjectFilter))) {
      setSubjectFilter('');
    }
  }, [branchFilter, filteredSubjects, subjectFilter]);

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();

    return [...cases]
      .filter((item) => {
        const exam = item.exam || {};
        const student = item.student || {};
        const branchId = student.branch_id ?? exam.branch_id;
        const subjectId = exam.subject_id;

        const matchesBranch =
          !branchFilter || String(branchId) === String(branchFilter);

        const matchesSubject =
          !subjectFilter || String(subjectId) === String(subjectFilter);

        const matchesStatus =
          !statusFilter || item.case_status === statusFilter;

        const haystack = [
          studentName(student),
          student.national_id,
          student.seating_number,
          exam.title,
          branchName(branchId),
          subjectName(subjectId),
          violationLabel(item.violation_type)
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return matchesBranch && matchesSubject && matchesStatus &&
          (!q || haystack.includes(q));
      })
      .sort((a, b) => {
        const branchA = branchName(a.student?.branch_id ?? a.exam?.branch_id);
        const branchB = branchName(b.student?.branch_id ?? b.exam?.branch_id);
        const branchCompare = branchA.localeCompare(branchB, 'ar');
        if (branchCompare !== 0) return branchCompare;

        const subjectA = subjectName(a.exam?.subject_id);
        const subjectB = subjectName(b.exam?.subject_id);
        const subjectCompare = subjectA.localeCompare(subjectB, 'ar');
        if (subjectCompare !== 0) return subjectCompare;

        return new Date(a.occurred_at || 0) - new Date(b.occurred_at || 0);
      });
  }, [cases, branchFilter, subjectFilter, statusFilter, search, branches, subjects, filteredSubjects]);

  const prepareOriginalScore = async (caseItem) => {
    const seatingNumber =
      caseItem?.student?.seating_number ??
      caseItem?.student?.seat_number ??
      caseItem?.student?.exam_seating_number;

    if (!seatingNumber) {
      throw new Error('لا يوجد رقم جلوس محفوظ للطالب، ولا يمكن ربط نتيجته بالامتحان.');
    }

    const { data: submission, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('seating_number', String(seatingNumber))
      .eq('exam_id', String(caseItem.exam_id))
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!submission) {
      throw new Error('لا توجد نتيجة محفوظة لهذا الطالب في هذا الامتحان.');
    }

    const original = {
      original_obtained_marks: Number(submission.final_score ?? submission.total_score ?? submission.obtained_marks ?? 0),
      original_total_marks: Number(submission.total_marks ?? 0),
      original_percentage: Number(submission.percentage ?? 0),
      original_base_score: Number(submission.base_score ?? 0),
      original_bonus_score: Number(submission.bonus_score ?? 0),
      original_final_score: Number(submission.final_score ?? submission.total_score ?? 0)
    };

    return { submission, original };
  };

  const releaseSubmissionIfNoPendingCases = async (studentId, examId, submissionId) => {
    const { data: pendingCases, error } = await supabase
      .from('cheating_cases')
      .select('id')
      .eq('student_id', studentId)
      .eq('exam_id', examId)
      .eq('case_status', 'pending');

    if (error) throw error;

    // إذا بقيت مخالفة أخرى قيد المراجعة، تبقى العلامة غير معتمدة.
    const shouldRelease = !(pendingCases || []).length;
    const { error: releaseError } = await supabase
      .from('submissions')
      .update({ is_score_released: shouldRelease })
      .eq('id', submissionId);

    if (releaseError) throw releaseError;
    return shouldRelease;
  };

  const applyCaseAction = async (caseItem, action, deduction = 0) => {
    setProcessingId(caseItem.id);

    try {
      if (caseItem.case_status !== 'pending') {
        throw new Error('تم اتخاذ إجراء على هذه الحالة مسبقاً.');
      }

      const { submission, original } = await prepareOriginalScore(caseItem);

      // حفظ العلامة الأصلية في ملف الحالة قبل تعديل النتيجة.
      await supabase
        .from('cheating_cases')
        .update({
          ...original,
          updated_at: new Date().toISOString()
        })
        .eq('id', caseItem.id);

      const now = new Date().toISOString();

      if (action === 'excuse') {
        // تجاوز الحالة: إعادة النتيجة الأصلية إن كانت الحالة قد عدلتها سابقاً.
        const updatePayload = {
          obtained_marks: original.original_obtained_marks,
          total_marks: original.original_total_marks,
          percentage: original.original_percentage,
          base_score: original.original_base_score,
          bonus_score: original.original_bonus_score,
          final_score: original.original_final_score,
          total_score: original.original_final_score,
          is_score_released: false
        };

        const { error } = await supabase
          .from('submissions')
          .update(updatePayload)
          .eq('id', submission.id);

        if (error) throw error;

        await supabase
          .from('cheating_cases')
          .update({
            case_status: 'excused',
            action_taken: 'excuse',
            deduction_marks: 0,
            processed_at: now,
            processed_by: employeeId ? Number(employeeId) : null,
            updated_at: now
          })
          .eq('id', caseItem.id);
      }

      if (action === 'deduct') {
        const amount = Number(deduction);

        if (!Number.isInteger(amount) || amount <= 0) {
          throw new Error('أدخل عدد علامات صحيحاً للخصم، بمقدار 1 علامة.');
        }

        const originalObtained = original.original_obtained_marks;
        const originalTotal = original.original_total_marks;
        const newObtained = Math.max(0, originalObtained - amount);
        const newPercentage =
          originalTotal > 0 ? (newObtained / originalTotal) * 100 : 0;

        const updatePayload = {
          obtained_marks: newObtained,
          percentage: Number(newPercentage.toFixed(2)),
          final_score: newObtained,
          total_score: newObtained,
          is_score_released: false
        };

        const { error } = await supabase
          .from('submissions')
          .update(updatePayload)
          .eq('id', submission.id);

        if (error) throw error;

        await supabase
          .from('cheating_cases')
          .update({
            case_status: 'deducted',
            action_taken: 'deduct',
            deduction_marks: amount,
            processed_at: now,
            processed_by: employeeId ? Number(employeeId) : null,
            updated_at: now
          })
          .eq('id', caseItem.id);
      }

      if (action === 'fail') {
        const updatePayload = {
          obtained_marks: 0,
          percentage: 0,
          final_score: 0,
          total_score: 0,
          is_score_released: false
        };

        const { error } = await supabase
          .from('submissions')
          .update(updatePayload)
          .eq('id', submission.id);

        if (error) throw error;

        await supabase
          .from('cheating_cases')
          .update({
            case_status: 'failed',
            action_taken: 'fail',
            deduction_marks: null,
            processed_at: now,
            processed_by: employeeId ? Number(employeeId) : null,
            updated_at: now
          })
          .eq('id', caseItem.id);
      }

      // بعد اتخاذ القرار، لا تُعتمد العلامة إلا إذا لم تعد هناك أي حالة غش معلّقة لنفس الطالب والامتحان.
      await releaseSubmissionIfNoPendingCases(caseItem.student_id, caseItem.exam_id, submission.id);

      setDeductionModal(null);
      setDeductionMarks('');
      await loadData();
      showCenterMessage('تم تنفيذ الإجراء وترحيل العلامة إلى نتيجة الطالب.', 'success', 2500);
    } catch (error) {
      console.error('خطأ في معالجة حالة الغش:', error);
      showCenterMessage(error.message || 'تعذر تنفيذ الإجراء.', 'error', 3500);
    } finally {
      setProcessingId(null);
    }
  };

  const askDeduction = (caseItem) => {
    setDeductionMarks('');
    setDeductionModal(caseItem);
  };

  return (
    <div style={styles.container}>
      <style>{`
        .cheating-monitor-table th,
        .cheating-monitor-table td {
          padding: 5px 3px;
          line-height: 1.35;
          vertical-align: middle;
          overflow-wrap: anywhere;
        }
        .cheating-monitor-table thead tr {
          background: linear-gradient(90deg, #172554, #1e3a8a, #0f766e);
        }
        .cheating-monitor-table thead th {
          color: #f8fafc;
          font-weight: 800;
          text-align: center;
          border-bottom: 1px solid rgba(103,232,249,.35);
        }
        .cheating-monitor-table tbody td {
          text-align: center;
          vertical-align: middle;
          font-size: 11px;
        }
        .cheating-monitor-table tbody tr:first-child {
          background: linear-gradient(90deg, rgba(30,64,175,.34), rgba(13,148,136,.24));
        }
        .cheating-monitor-table tbody tr:first-child td {
          border-top: 1px solid rgba(96,165,250,.35);
          border-bottom: 1px solid rgba(96,165,250,.22);
        }
        .cheating-monitor-table th:nth-child(1) { width: 5%; }
        .cheating-monitor-table th:nth-child(2) { width: 8%; }
        .cheating-monitor-table th:nth-child(3) { width: 9%; }
        .cheating-monitor-table th:nth-child(4) { width: 10%; }
        .cheating-monitor-table th:nth-child(5) { width: 16%; }
        .cheating-monitor-table th:nth-child(6) { width: 10%; }
        .cheating-monitor-table th:nth-child(7) { width: 8%; }
        .cheating-monitor-table th:nth-child(8) { width: 17%; }
        .cheating-monitor-table th:nth-child(9) { width: 17%; text-align: center; }
      `}</style>
      {centerMessage && (
        <div style={styles.centerMessageOverlay}>
          <div
            style={{
              ...styles.centerMessage,
              background: centerMessage.type === 'error' ? '#991b1b' : '#065f46',
            }}
          >
            <div style={styles.centerMessageIcon}>
              {centerMessage.type === 'error' ? '⚠️' : '✅'}
            </div>
            <div style={styles.centerMessageText}>{centerMessage.text}</div>
          </div>
        </div>
      )}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>🚨 شاشة مراقبة حالات الغش</h2>
          <p style={styles.subtitle}>
            الطلبة الذين تم رصد مخالفات لهم بالكاميرا أو المايك أو إغلاق شاشة الامتحان
          </p>
        </div>
        <button style={styles.refreshBtn} onClick={loadData}>
          🔄 تحديث
        </button>
      </div>

      <div style={styles.filters}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔎 بحث باسم الطالب أو رقم الهوية أو رقم الجلوس..."
          style={{ ...styles.search, color: '#67e8f9', borderColor: 'rgba(103,232,249,.55)', fontWeight: '700' }}
        />

        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          style={{ ...styles.select, color: '#fbbf24', borderColor: 'rgba(251,191,36,.55)', fontWeight: '700' }}
        >
          <option value="">كل الفروع</option>
          {branches
            .slice()
            .sort((a, b) =>
              (a.branch_name || a.name || '').localeCompare(
                b.branch_name || b.name || '',
                'ar'
              )
            )
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.branch_name || b.name || b.branch}
              </option>
            ))}
        </select>

        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          style={{ ...styles.select, color: '#5eead4', borderColor: 'rgba(94,234,212,.55)', fontWeight: '700' }}
        >
          <option value="">كل المواد</option>
          {filteredSubjects
            .slice()
            .sort((a, b) =>
              (a.subject_name || a.name || '').localeCompare(
                b.subject_name || b.name || '',
                'ar'
              )
            )
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.subject_name || s.name || s.subject}
              </option>
            ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ ...styles.select, color: '#fb7185', borderColor: 'rgba(251,113,133,.55)', fontWeight: '700' }}
        >
          <option value="pending">الحالات بانتظار الإجراء</option>
          <option value="">كل الحالات</option>
          <option value="excused">تم التجاوز</option>
          <option value="deducted">تم الخصم</option>
          <option value="failed">راسب</option>
        </select>
      </div>

      <div style={styles.stats}>
        <div style={styles.statCard}>
          <span>عدد الحالات المعروضة</span>
          <strong>{englishDigits(filteredCases.length)}</strong>
        </div>
        <div style={styles.statCard}>
          <span>بانتظار الإجراء</span>
          <strong>{englishDigits(cases.filter((x) => x.case_status === 'pending').length)}</strong>
        </div>
        <div style={styles.statCard}>
          <span>تمت معالجتها</span>
          <strong>{englishDigits(cases.filter((x) => x.case_status !== 'pending').length)}</strong>
        </div>
      </div>

      <div style={styles.tableWrap}>
        {loading ? (
          <div style={styles.empty}>⏳ جاري تحميل حالات الغش...</div>
        ) : filteredCases.length === 0 ? (
          <div style={styles.empty}>✅ لا توجد حالات مطابقة للبحث أو الفلاتر.</div>
        ) : (
          <table className="cheating-monitor-table" style={styles.table}>
            <thead>
              <tr>
                <th>رقم مسلسل</th>
                <th>رقم الجلوس</th>
                <th>الفرع</th>
                <th>المادة</th>
                <th>عنوان الامتحان</th>
                <th>التاريخ</th>
                <th>الوقت</th>
                <th>حالة الغش</th>
                <th>الإجراءات</th>
              </tr>
            </thead>

            <tbody>
              {filteredCases.map((item, index) => {
                const branchId = item.student?.branch_id ?? item.exam?.branch_id;
                const subjectId = item.exam?.subject_id;
                const isProcessing = processingId === item.id;
                const pending = item.case_status === 'pending';

                return (
                  <tr key={item.id}>
                    <td style={styles.serial}>{englishDigits(index + 1)}</td>

                    <td style={styles.bold}>
                      {item.student?.seating_number || '-'}
                    </td>

                    <td>{branchName(branchId)}</td>
                    <td>{subjectName(subjectId)}</td>
                    <td style={styles.examTitle}>{item.exam?.title || englishDigits(item.exam_id)}</td>

                    <td style={styles.date}>{formatDate(item.occurred_at)}</td>
                    <td style={styles.time}>{formatTime(item.occurred_at)}</td>

                    <td>
                      <div style={styles.violation}>
                        {violationLabel(item.violation_type)}
                      </div>
                      {item.violation_details && (
                        <div style={styles.details}>{item.violation_details}</div>
                      )}
                      {(item.camera_recording_url ||
                        item.microphone_recording_url ||
                        item.evidence_url) && (
                        <div style={styles.evidence}>
                          🎞️ يوجد توثيق
                        </div>
                      )}
                    </td>

                    <td>
                      {pending ? (
                        <div style={styles.actions}>
                          <button
                            disabled={isProcessing}
                            onClick={() => applyCaseAction(item, 'excuse')}
                            style={styles.excuseBtn}
                          >
                            {isProcessing ? '...' : 'تجاوز'}
                          </button>

                          <button
                            disabled={isProcessing}
                            onClick={() => askDeduction(item)}
                            style={styles.deductBtn}
                          >
                            خصم
                          </button>

                          <button
                            disabled={isProcessing}
                            onClick={() => {
                              if (
                                window.confirm(
                                  'هل أنت متأكد من ترسيب الطالب في هذه المادة وجعل علامته 0؟'
                                )
                              ) {
                                applyCaseAction(item, 'fail');
                              }
                            }}
                            style={styles.failBtn}
                          >
                            ترسيب
                          </button>
                        </div>
                      ) : (
                        <div style={styles.processed}>
                          {statusLabel(item.case_status)}
                          {item.action_taken === 'deduct' &&
                            ` (${englishDigits(item.deduction_marks)} علامة)`}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {deductionModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>خصم من الطالب</h3>
            <p style={styles.modalText}>
              الطالب: <strong>{studentName(deductionModal.student)}</strong>
            </p>
            <p style={styles.modalText}>
              المادة: <strong>{subjectName(deductionModal.exam?.subject_id)}</strong>
            </p>

            <label style={styles.label}>عدد العلامات المراد خصمها</label>
            <div style={styles.stepper}>
              <button
                type="button"
                onClick={() =>
                  setDeductionMarks((current) =>
                    String(Math.max(1, (parseInt(current, 10) || 1) - 1))
                  )
                }
                style={styles.stepperBtn}
                aria-label="إنقاص علامة واحدة"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                step="1"
                value={deductionMarks}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d+$/.test(value)) {
                    setDeductionMarks(value);
                  }
                }}
                style={styles.modalInput}
                autoFocus
              />
              <button
                type="button"
                onClick={() =>
                  setDeductionMarks((current) =>
                    String((parseInt(current, 10) || 0) + 1)
                  )
                }
                style={styles.stepperBtn}
                aria-label="زيادة علامة واحدة"
              >
                +
              </button>
            </div>
            <div style={styles.stepperHint}>الزيادة أو النقصان يكون بمقدار علامة واحدة فقط.</div>

            <div style={styles.modalActions}>
              <button
                onClick={() => setDeductionModal(null)}
                style={styles.cancelBtn}
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  if (!deductionMarks || Number(deductionMarks) <= 0) {
                    showCenterMessage('أدخل عدد العلامات المراد خصمها (1 لكل ضغطة).', 'error', 2500);
                    return;
                  }
                  applyCaseAction(deductionModal, 'deduct', deductionMarks);
                }}
                style={styles.deductBtn}
              >
                حفظ وترحيل العلامة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    padding: '22px',
    background: '#07152f',
    color: '#e2e8f0',
    direction: 'rtl',
    fontFamily: 'Noto Kufi Arabic, sans-serif',
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '15px',
    padding: '20px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #0b2450, #0e3b73)',
    border: '1px solid rgba(56,189,248,.25)',
    marginBottom: '18px'
  },
  title: { margin: 0, color: '#f8fafc', fontSize: '25px' },
  subtitle: { margin: '8px 0 0', color: '#93c5fd' },
  refreshBtn: {
    border: 0,
    borderRadius: '10px',
    padding: '11px 18px',
    background: '#0284c7',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'minmax(240px, 2fr) repeat(3, minmax(160px, 1fr))',
    gap: '10px',
    marginBottom: '16px'
  },
  search: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px',
    borderRadius: '10px',
    border: '1px solid #334155',
    background: '#0f2345',
    color: '#fff',
    outline: 'none'
  },
  select: {
    width: '100%',
    padding: '13px',
    borderRadius: '10px',
    border: '1px solid #334155',
    background: '#0f2345',
    color: '#fff',
    outline: 'none'
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '16px'
  },
  statCard: {
    padding: '15px',
    borderRadius: '12px',
    background: '#0b2042',
    border: '1px solid rgba(96,165,250,.18)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  tableWrap: {
    width: '100%',
    maxWidth: '100%',
    overflowX: 'hidden',
    overflowY: 'visible',
    borderRadius: '14px',
    border: '1px solid rgba(148,163,184,.16)',
    background: '#091b37',
    boxSizing: 'border-box'
  },
  table: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    textAlign: 'center',
    direction: 'rtl',
    fontSize: '11px',
    boxSizing: 'border-box'
  },
  empty: {
    padding: '60px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '18px'
  },
  serial: {
    fontWeight: 'bold',
    color: '#38bdf8',
    fontSize: '11px', whiteSpace: 'nowrap', padding: '4px 4px'
  },
  studentName: {
    color: '#67e8f9',
    fontWeight: 'bold',
    fontSize: '11px'
  },
  muted: { color: '#94a3b8', fontSize: '11px', marginTop: '4px' },
  bold: { fontWeight: 'bold', fontSize: '11px', overflowWrap: 'anywhere', direction: 'ltr' },
  violation: {
    display: 'inline-block',
    padding: '4px 6px',
    borderRadius: '8px',
    background: 'rgba(239,68,68,.12)',
    color: '#fca5a5',
    fontWeight: 'bold',
    fontSize: '11px'
  },
  details: { marginTop: '4px', color: '#cbd5e1', fontSize: '11px' },
  evidence: { marginTop: '4px', color: '#67e8f9', fontSize: '11px' },
  examTitle: { fontSize: '11px', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' },
  date: { whiteSpace: 'nowrap', color: '#cbd5e1', fontSize: '11px', direction: 'ltr' },
  time: { whiteSpace: 'nowrap', color: '#cbd5e1', fontSize: '11px', direction: 'ltr' },
  actions: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    minWidth: 0,
    width: '100%',
    whiteSpace: 'nowrap',
    flexWrap: 'nowrap'
  },
  excuseBtn: {
    border: 0, borderRadius: '6px', padding: '5px 7px',
    background: '#15803d', color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', whiteSpace: 'nowrap', padding: '4px 4px'
  },
  deductBtn: {
    border: 0, borderRadius: '6px', padding: '5px 7px',
    background: '#d97706', color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', whiteSpace: 'nowrap', padding: '4px 4px'
  },
  failBtn: {
    border: 0, borderRadius: '6px', padding: '5px 7px',
    background: '#b91c1c', color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px', whiteSpace: 'nowrap'
  },
  processed: {
    padding: '8px',
    borderRadius: '8px',
    background: 'rgba(148,163,184,.08)',
    color: '#cbd5e1',
    fontWeight: 'bold',
    fontSize: '11px'
  },
  centerMessageOverlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'rgba(2,6,23,.35)',
    zIndex: 20000,
    pointerEvents: 'none'
  },
  centerMessage: {
    width: 'min(560px, 92vw)',
    minHeight: '110px',
    boxSizing: 'border-box',
    padding: '24px 28px',
    borderRadius: '18px',
    border: '1px solid rgba(255,255,255,.25)',
    boxShadow: '0 25px 80px rgba(0,0,0,.55)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    textAlign: 'center',
    direction: 'rtl',
    whiteSpace: 'pre-line',
    fontSize: '17px',
    fontWeight: '800'
  },
  centerMessageIcon: {
    fontSize: '28px',
    flex: '0 0 auto'
  },
  centerMessageText: {
    lineHeight: 1.8
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2,6,23,.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px'
  },
  modal: {
    width: 'min(500px, 100%)',
    background: '#0b2042',
    border: '1px solid rgba(56,189,248,.3)',
    borderRadius: '16px',
    padding: '25px',
    boxShadow: '0 20px 60px rgba(0,0,0,.45)'
  },
  modalText: { color: '#cbd5e1' },
  label: { display: 'block', color: '#e2e8f0', margin: '16px 0 8px', fontWeight: 'bold' },
  stepper: {
    display: 'grid',
    gridTemplateColumns: '46px 1fr 46px',
    gap: '8px',
    alignItems: 'center'
  },
  stepperBtn: {
    height: '46px',
    border: 0,
    borderRadius: '9px',
    background: '#2563eb',
    color: '#fff',
    fontSize: '24px',
    fontWeight: '900',
    cursor: 'pointer'
  },
  stepperHint: {
    marginTop: '7px',
    color: '#94a3b8',
    fontSize: '11px',
    textAlign: 'center'
  },
  modalInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px',
    borderRadius: '9px',
    border: '1px solid #475569',
    background: '#07152f',
    color: '#fff',
    fontSize: '17px'
  },
  modalActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '18px'
  },
  cancelBtn: {
    flex: 1,
    border: 0,
    borderRadius: '9px',
    padding: '12px',
    background: '#475569',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold'
  }
};
