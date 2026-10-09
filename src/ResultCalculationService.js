// خدمة موحدة لاحتساب وحفظ النتيجة النهائية للصف 12.
// الترتيب: تصحيح آلي -> تصحيح مقالي معتمد -> خصم الغش -> العلامة النهائية -> المعدل/النتيجة.

export const calculateFinalScore = ({ automaticScore = 0, manualScore = 0, cheatingDeduction = 0, maxScore = 100 }) => {
  const max = Math.max(0, Number(maxScore) || 0);
  const auto = Math.max(0, Number(automaticScore) || 0);
  const manual = Math.max(0, Number(manualScore) || 0);
  const deduction = Math.max(0, Number(cheatingDeduction) || 0);
  const finalScore = Math.min(max || Number.POSITIVE_INFINITY, Math.max(0, auto + manual - deduction));
  const average = max > 0 ? (finalScore / max) * 100 : 0;
  return { automaticScore: auto, manualScore: manual, cheatingDeduction: deduction, finalScore, average };
};

export const getResultStatus = ({ average = 0, failedSubjects = 0, totalScore = null }) => {
  const avg = Number(average) || 0;
  const failed = Number(failedSubjects) || 0;
  const total = totalScore == null ? null : Number(totalScore);

  // قواعد الصف 12: أكثر من 4 مواد دون الحد الأدنى = راسب.
  // من 1 إلى 4 مواد أو مجموع أقل من 350 = مكمل.
  // النجاح يتطلب عدم وجود مادة دون حدها الأدنى ومجموع 350 فأعلى.
  if (failed > 4) return 'راسب';
  if ((total != null && Number.isFinite(total) && total < 350) || failed >= 1) return 'مكمل';
  if (avg >= 50) return 'ناجح';
  return 'مكمل';
};

export async function finalizeExamResult(supabase, { studentId, examId, subjectId, cycleId = 1 }) {
  const { data, error } = await supabase.rpc('finalize_exam_result', {
    p_student_id: Number(studentId),
    p_exam_id: Number(examId),
    p_subject_id: subjectId == null ? null : Number(subjectId),
    p_cycle_id: Number(cycleId) || 1,
  });
  if (error) throw error;
  return data;
}

export async function recalculateStudentFinalResult(supabase, { studentId, cycleId = 1 }) {
  const { data, error } = await supabase.rpc('recalculate_student_final_result', {
    p_student_id: Number(studentId),
    p_cycle_id: Number(cycleId) || 1,
  });
  if (error) throw error;
  return data;
}
