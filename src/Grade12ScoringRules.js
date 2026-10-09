// قواعد احتساب نتائج الصف 12 - مصدر موحد لبوابة الموظفين وبوابة الطالب.
// "العلامة الأعلى" تعني العلامة الفعلية التي حصل عليها الطالب، وليس النسبة.

const normalizeArabic = (value) =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ـ]/g, '')
    .replace(/\s+/g, ' ');

const subjectName = (subject) =>
  normalizeArabic(
    subject?.subject_name ??
    subject?.name ??
    subject?.title ??
    subject?.subjectName ??
    subject
  );

const branchName = (name) => normalizeArabic(name);

const hasAny = (name, patterns) =>
  patterns.some((pattern) => name.includes(normalizeArabic(pattern)));

const branchRule = (name) => {
  const b = branchName(name);

  if (b.includes('علمي') || b.includes('scientific')) {
    return {
      mandatory: ['اللغه العربيه', 'العربيه', 'اللغة العربية', 'العربية', 'english', 'الانجليزي', 'اللغة الانجليزية', 'الرياضيات', 'الفيزياء'],
      optionalGroups: [
        { names: ['الكيمياء', 'الاحياء'], count: 1 },
        { names: ['التربية الاسلامية', 'اسلامية', 'التكنولوجيا', 'تكنولوجيا'], count: 1 }
      ]
    };
  }

  if (b.includes('ادبي') || b.includes('literary')) {
    return {
      mandatory: ['العربيه', 'اللغة العربية', 'العربية', 'english', 'الانجليزي', 'الرياضيات', 'التاريخ'],
      optionalGroups: [
        { names: ['الجغرافيا', 'الثقافة العلمية'], count: 1 },
        { names: ['التربية الاسلامية', 'اسلامية', 'التكنولوجيا', 'تكنولوجيا'], count: 1 }
      ]
    };
  }

  if (b.includes('ريادة') || b.includes('اعمال') || b.includes('entrepreneur') || b.includes('business')) {
    return {
      mandatory: ['العربيه', 'اللغة العربية', 'العربية', 'english', 'الانجليزي', 'الرياضيات', 'المحاسبة'],
      optionalGroups: [
        { names: ['الادارة والاقتصاد', 'ادارة واقتصاد', 'المشاريع الصغيرة', 'مشاريع صغيرة'], count: 1 },
        { names: ['التربية الاسلامية', 'اسلامية', 'التكنولوجيا', 'تكنولوجيا'], count: 1 }
      ]
    };
  }

  if (b.includes('شرعي') || b.includes('sharia') || b.includes('religious')) {
    return {
      mandatory: ['العربيه', 'اللغة العربية', 'العربية', 'english', 'الانجليزي', 'الرياضيات', 'علوم القران والحديث', 'القران والحديث', 'قران وحديث'],
      optionalGroups: [
        { names: ['الفقه واصوله', 'فقه واصول', 'العقيدة', 'العقيده'], count: 1 },
        { names: ['التكنولوجيا', 'تكنولوجيا', 'التربية الاسلامية', 'اسلامية'], count: 1 }
      ]
    };
  }

  if (b.includes('صناعي') || b.includes('industrial')) {
    return {
      mandatory: ['العربيه', 'اللغة العربية', 'العربية', 'english', 'الانجليزي', 'الرياضيات الصناعية', 'تدريب عملي', 'التدريب العملي', 'العلوم المهنية'],
      optionalGroups: [
        { names: ['الفيزياء', 'الرسم الصناعي', 'التربية الاسلامية', 'اسلامية', 'التكنولوجيا', 'تكنولوجيا'], count: 2 }
      ]
    };
  }

  if (b.includes('زراعي') || b.includes('agricultural')) {
    return {
      mandatory: ['العربيه', 'اللغة العربية', 'العربية', 'english', 'الانجليزي', 'تدريب عملي', 'التدريب العملي', 'العلوم الزراعية'],
      optionalGroups: [
        { names: ['الكيمياء', 'الاحياء', 'الرياضيات', 'التربية الاسلامية', 'اسلامية', 'التكنولوجيا', 'تكنولوجيا'], count: 2 }
      ]
    };
  }

  if (b.includes('فندقي') || b.includes('hotel')) {
    return {
      mandatory: ['العربيه', 'اللغة العربية', 'العربية', 'english', 'الانجليزي', 'تدريب عملي', 'التدريب العملي', 'العلوم الفندقية'],
      optionalGroups: [
        { names: ['ادارة السياحة', 'الادارة السياحية', 'السياحة', 'الرياضيات', 'التربية الاسلامية', 'اسلامية', 'التكنولوجيا', 'تكنولوجيا'], count: 2 }
      ]
    };
  }

  if (b.includes('اقتصاد منزلي') || b.includes('home economics')) {
    return {
      mandatory: ['العربيه', 'اللغة العربية', 'العربية', 'english', 'الانجليزي', 'تدريب عملي', 'التدريب العملي', 'العلوم المهنية'],
      optionalGroups: [
        { names: ['الكيمياء', 'الاحياء', 'الادارة', 'ادارة', 'التربية الاسلامية', 'اسلامية', 'التكنولوجيا', 'تكنولوجيا'], count: 2 }
      ]
    };
  }

  return null;
};

const toMark = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * subjectCells: [{ key, subject, mark, min, max }]
 *
 * القاعدة المهمة:
 * - اختيار المواد الأعلى يتم على mark نفسها.
 * - الحد الأدنى يُفحص لكل مواد الفرع، وليس فقط المواد المحتسبة في مجموع الـ700.
 */
export const calculateGrade12Result = (branch, subjectCells = []) => {
  const cells = Array.isArray(subjectCells) ? subjectCells : [];
  const rule = branchRule(branch);

  if (!rule) {
    const total = cells.reduce((sum, c) => sum + toMark(c.mark), 0);
    const failedSubjects = cells.filter((c) => toMark(c.mark) < toMark(c.min)).length;
    const percentage = (total / 700) * 100;
    const status = failedSubjects > 4 ? 'راسب' : (total < 350 || failedSubjects >= 1) ? 'مكمل' : 'ناجح';
    return {
      selectedCells: cells.slice(),
      total,
      maximumTotal: 700,
      percentage: Number.isFinite(percentage) ? percentage : 0,
      failedSubjects,
      status,
      passed: status === 'ناجح'
    };
  }

  const mandatory = [];
  const used = new Set();

  cells.forEach((cell) => {
    const name = subjectName(cell.subject);
    if (hasAny(name, rule.mandatory)) {
      mandatory.push(cell);
      used.add(String(cell.key));
    }
  });

  const selected = [...mandatory];

  // نختار أعلى علامة فعلية للطالب في كل مجموعة اختيارية.
  for (const group of rule.optionalGroups) {
    const candidates = cells
      .filter((cell) => !used.has(String(cell.key)) && hasAny(subjectName(cell.subject), group.names))
      .sort((a, b) => toMark(b.mark) - toMark(a.mark));

    candidates.slice(0, group.count).forEach((cell) => {
      selected.push(cell);
      used.add(String(cell.key));
    });
  }

  const total = selected.reduce((sum, c) => sum + toMark(c.mark), 0);

  // فحص الحد الأدنى يتم على جميع مواد الفرع الموجودة في جدول subjects.
  const failedSubjects = cells.filter(
    (cell) => toMark(cell.mark) < toMark(cell.min)
  ).length;

  const percentage = (total / 700) * 100;

  let status;
  if (failedSubjects > 4) {
    status = 'راسب';
  } else if (total < 350 || failedSubjects >= 1) {
    status = 'مكمل';
  } else {
    status = 'ناجح';
  }

  return {
    selectedCells: selected,
    total,
    maximumTotal: 700,
    percentage: Number.isFinite(percentage) ? percentage : 0,
    failedSubjects,
    status,
    passed: status === 'ناجح'
  };
};

export const getSubjectMaximum = (subject) =>
  toMark(
    subject?.maximum_mark ??
    subject?.max_mark ??
    subject?.max_marks ??
    subject?.maximum_marks ??
    subject?.total_marks ??
    subject?.total_mark ??
    0
  );

export const getSubjectMinimum = (subject) =>
  toMark(
    subject?.minimum_mark ??
    subject?.min_mark ??
    subject?.min_marks ??
    subject?.minimum_marks ??
    0
  );

export const normalizeGrade12SubjectName = subjectName;
