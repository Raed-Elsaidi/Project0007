import React, { useState, useEffect } from 'react';

export default function AddExam({ supabase, showAlertMessage, supervisor }) {
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [units, setUnits] = useState([]);
  const [bankQuestions, setBankQuestions] = useState([]);

  // حقول البيانات الأساسية للامتحان مع حقول نصية لاسم الفرع واسم المادة
  const [title, setTitle] = useState('');
  const [branchName, setBranchName] = useState('');
  const [subjectName, setSubjectName] = useState('');

  // لغة واجهة القسم والأسئلة تعتمد على مادة الامتحان.
  // يدعم: لغة انجليزية / اللغة الإنجليزية / English / English Language
  const isEnglishExam = (() => {
    const value = String(subjectName || '').trim().toLowerCase();
    return value.includes('english') ||
      value.includes('إنجليزي') ||
      value.includes('انجليزي') ||
      value.includes('اللغة الإنجليزية') ||
      value.includes('لغة انجليزية');
  })();

  const getSectionDisplayName = (name) => {
    if (!isEnglishExam) return name;
    const map = {
      'القسم الأساسي': 'Basic Section',
      'القسم الاختياري': 'Optional Section',
      'القسم الإضافي': 'Additional Section'
    };
    return map[name] || name;
  };

  const getBranchDisplayName = (name, index = null) => {
    if (!isEnglishExam) return name;
    const map = {
      'الفرع الأول': 'First Branch',
      'الفرع الثاني': 'Second Branch'
    };
    if (map[name]) return map[name];
    if (index === 0) return 'First Branch';
    if (index === 1) return 'Second Branch';
    return name;
  };

  const getQuestionTypeDisplayLabel = (typeKey, fallback = '') => {
    if (!isEnglishExam) return fallback;
    const map = {
      true_false: 'True / False',
      multiple_choice: 'Multiple Choice',
      mcq: 'Multiple Choice',
      completion: 'Fill in the Blank',
      complete: 'Fill in the Blank',
      fill_in_blank: 'Fill in the Blank',
      essay: 'Essay'
    };
    return map[typeKey] || fallback;
  };

  const getQuestionTextDisplay = (q, fallbackText = '') => {
    if (!isEnglishExam) return fallbackText;

    // إذا كانت قاعدة البيانات تحتوي على ترجمة إنجليزية جاهزة نستخدمها.
    const englishText =
      q?.question_text_en ||
      q?.text_en ||
      q?.body_en ||
      q?.english_question_text ||
      q?.question_translation_en;

    if (englishText) return englishText;

    // ترجمات جاهزة لعبارات صيغة السؤال الشائعة.
    // نص السؤال نفسه يُفضّل أن يكون مخزناً بالإنجليزية في بنك الأسئلة.
    const commonPhrases = [
      [/ضع إشارة صح أو إشارة خطأ أمام كل عبارة من العبارات التالية\s*--?/gi, 'Put a True or False mark next to each of the following statements --'],
      [/ضع إشارة صح أو إشارة خطأ امام كل عبارة من العبارات التالية\s*--?/gi, 'Put a True or False mark next to each of the following statements --'],
      [/اختر الإجابة الصحيحة في كل عبارة من العبارات التالية\s*--?/gi, 'Choose the correct answer for each of the following statements --'],
      [/اختر الاجابة الصحيحة في كل عبارة من العبارات التالية\s*--?/gi, 'Choose the correct answer for each of the following statements --'],
      [/أكمل الفراغ في كل عبارة من العبارات التالية\s*\(-----\)/gi, 'Fill in the blank in each of the following statements (-----)'],
      [/أجب عن الأسئلة المقالية التالية\s*--?/gi, 'Answer the following essay questions --'],
      [/أجب عن العبارات التالية\s*--?/gi, 'Answer the following statements --']
    ];

    return commonPhrases.reduce((result, [pattern, replacement]) => (
      result.replace(pattern, replacement)
    ), String(fallbackText || ''));
  };

  const getQuestionTypeHeaderDisplay = (typeVal) => {
    const arabicHeader = getQuestionTypeHeaderTitle(typeVal);
    if (!isEnglishExam) return arabicHeader;

    const map = {
      true_false: 'Put a True or False mark next to each of the following statements --',
      multiple_choice: 'Choose the correct answer for each of the following statements --',
      mcq: 'Choose the correct answer for each of the following statements --',
      completion: 'Fill in the blank in each of the following statements (-----)',
      complete: 'Fill in the blank in each of the following statements (-----)',
      fill_in_blank: 'Fill in the blank in each of the following statements (-----)',
      essay: 'Answer the following essay questions --'
    };
    return map[typeVal] || 'Answer the following statements --';
  };

  const getSectionNumberedDisplayName = (index) => {
    if (!isEnglishExam) return getSectionNumberedName(index);
    const numbers = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
    return `${numbers[index] || index + 1} Section`;
  };

  const getNumberWordDisplay = (num) => {
    if (!isEnglishExam) return getArabicNumberWord(num);
    const words = { 1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth', 5: 'Fifth' };
    return words[num] || num;
  };

  const [selectedBranch, setSelectedBranch] = useState(
    supervisor?.branch_id ? String(supervisor.branch_id) : ''
  );
  const [selectedSubject, setSelectedSubject] = useState(
    supervisor?.subject_id ? String(supervisor.subject_id) : ''
  );
  
  // نطاق الامتحان (كل المادة أو وحدات محددة)
  const [scopeMode, setScopeMode] = useState('all');
  const [selectedUnits, setSelectedUnits] = useState([]);

  // طريقة وضع الأسئلة (auto / manual)
  const [questionMode, setQuestionMode] = useState('manual');

  // خيارات التوليد التلقائي المعدلة لتحديد عدد الأسئلة لكل نوع بشكل مستقل (شاملة الإكمال والمقالي)
  const [autoConfig, setAutoConfig] = useState({
    sectionsCount: 3,
    questionTypes: ['true_false', 'multiple_choice', 'completion', 'essay'],
    branchesPerType: {
      true_false: 5,
      multiple_choice: 5,
      completion: 3,
      essay: 2
    },
    defaultMark: 2
  });

  // إعدادات التوليد التلقائي: كل قسم مستقل، مع تفعيل/تعطيل
  // أنواع الأسئلة وعدد فروع كل نوع وعلامة الفرع.
  const QUESTION_TYPES = [
    { key: 'true_false', label: 'صح وخطأ' },
    { key: 'multiple_choice', label: 'اختيار من متعدد' },
    { key: 'completion', label: 'أكمل الفراغ' },
    { key: 'essay', label: 'مقالي' }
  ];

  const makeAutoTypes = () => ({
    true_false: { enabled: true, branches: 5, mark: 2 },
    multiple_choice: { enabled: true, branches: 5, mark: 2 },
    completion: { enabled: true, branches: 3, mark: 2 },
    essay: { enabled: true, branches: 2, mark: 2 }
  });

  const [autoSections, setAutoSections] = useState([
    {
      enabled: true,
      name: 'القسم الأساسي',
      kind: 'basic',
      types: makeAutoTypes(),
      optionalBranches: [
        { name: 'الفرع الأول', types: makeAutoTypes() },
        { name: 'الفرع الثاني', types: makeAutoTypes() }
      ]
    },
    {
      enabled: true,
      name: 'القسم الاختياري',
      kind: 'optional',
      types: makeAutoTypes(),
      optionalBranches: [
        { name: 'الفرع الأول', types: makeAutoTypes() },
        { name: 'الفرع الثاني', types: makeAutoTypes() }
      ]
    },
    {
      enabled: true,
      name: 'القسم الإضافي',
      kind: 'additional',
      types: makeAutoTypes(),
      optionalBranches: [
        { name: 'الفرع الأول', types: makeAutoTypes() },
        { name: 'الفرع الثاني', types: makeAutoTypes() }
      ]
    }
  ]);
  
  const [examDate, setExamDate] = useState('');
  const [examTime, setExamTime] = useState('');
  const [duration, setDuration] = useState('30');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // هيكل الامتحان والأقسام (القسم الأساسي، الاختياري، الإضافي)
  const getAvailableSections = () => [
    { name: 'القسم الأساسي', defaultScore: 50 },
    { name: 'القسم الاختياري', defaultScore: 30 },
    { name: 'القسم الإضافي', defaultScore: 20 }
  ];

  const [examStructure, setExamStructure] = useState([
    { 
      name: 'القسم الأساسي', 
      sectionScore: 50, 
      types: [
        { typeKey: 'true_false', questions: [] }
      ] 
    }
  ]);

  // حالات بنك الأسئلة المخصصة لوضع الأسئلة يدوياً
  const [isQuestionBankOpen, setIsQuestionBankOpen] = useState(false);
  const [targetSectionName, setTargetSectionName] = useState('');
  const [targetQuestionIndex, setTargetQuestionIndex] = useState(null);
  const [targetTypeKey, setTargetTypeKey] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('');

  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
  const [activeSectionForType, setActiveSectionForType] = useState('');
  const [activeQuestionIndexForType, setActiveQuestionIndexForType] = useState(null);

  const QUESTION_TYPE_PRIORITY = {
    'true_false': 1,
    'multiple_choice': 2,
    'mcq': 2,
    'completion': 3,
    'complete': 3,
    'fill_in_blank': 3,
    'essay': 4
  };

  const sortTypesByPriority = (typesArray) => {
    return [...typesArray].sort((a, b) => {
      const pA = QUESTION_TYPE_PRIORITY[a.typeKey] || 99;
      const pB = QUESTION_TYPE_PRIORITY[b.typeKey] || 99;
      return pA - pB;
    });
  };

  const showMsg = (msg, type) => {
    if (typeof showAlertMessage === 'function') {
      showAlertMessage(msg, type);
    } else {
      console.log(`[${type}] ${msg}`);
    }
  };

  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // ==========================================
  // ربط الامتحان بفرع ومادة المشرف من employees
  // ==========================================
  const [resolvedSupervisor, setResolvedSupervisor] = useState(supervisor || null);

  useEffect(() => {
    let cancelled = false;

    const resolveEmployee = async () => {
      if (!supabase) return;

      let current = supervisor || null;
      let found = null;

      // نستخدم بيانات الصفحة إن كانت تحتوي على الفرع والمادة.
      const hasContext =
        current?.branch_id != null && current?.branch_id !== '' &&
        current?.subject_id != null && current?.subject_id !== '';

      if (!hasContext) {
        const storedId = window.localStorage.getItem('currentUserId');
        const storedUsername = window.localStorage.getItem('currentUsername');

        if (storedId) {
          const result = await supabase
            .from('employees')
            .select('*, jobs:job_id(id, job_name)')
            .eq('id', Number(storedId))
            .maybeSingle();
          if (!result.error && result.data) found = result.data;
        }

        if (!found && (current?.id || storedUsername || current?.username)) {
          const username = current?.username || storedUsername;
          if (username) {
            const result = await supabase
              .from('employees')
              .select('*, jobs:job_id(id, job_name)')
              .eq('username', username)
              .maybeSingle();
            if (!result.error && result.data) found = result.data;
          }
        }
      }

      const merged = found ? { ...(current || {}), ...found } : current;

      if (!cancelled) {
        setResolvedSupervisor(merged || null);
      }
    };

    resolveEmployee();

    return () => {
      cancelled = true;
    };
  }, [supabase, supervisor]);

  const supervisorBranchId = resolvedSupervisor?.branch_id != null && resolvedSupervisor.branch_id !== ''
    ? Number(resolvedSupervisor.branch_id)
    : null;

  const supervisorSubjectId = resolvedSupervisor?.subject_id != null && resolvedSupervisor.subject_id !== ''
    ? Number(resolvedSupervisor.subject_id)
    : null;

  // ربط الامتحان بالمؤسسة الحالية. نقرأها أولاً من الموظف، ثم من جلسة النظام،
  // ثم نستخدم المؤسسة الافتراضية الحالية (01) إذا لم تكن الجلسة تحمل معرف المؤسسة.
  const currentInstitutionId =
    resolvedSupervisor?.institution_id != null && resolvedSupervisor.institution_id !== ''
      ? Number(resolvedSupervisor.institution_id)
      : (
          Number(window.localStorage.getItem('currentInstitutionId')) ||
          1
        );

  // مزامنة القيم من بيانات الموظف الحالي.
  useEffect(() => {
    setSelectedBranch(supervisorBranchId ? String(supervisorBranchId) : '');
    setSelectedSubject(supervisorSubjectId ? String(supervisorSubjectId) : '');
  }, [supervisorBranchId, supervisorSubjectId]);

  // جلب الفرع مع دعم أسماء الأعمدة الموجودة في المشروع.
  useEffect(() => {
    const fetchSupervisorBranch = async () => {
      if (!supervisorBranchId) {
        setBranches([]);
        setBranchName('');
        return;
      }

      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('id', supervisorBranchId)
        .maybeSingle();

      if (error || !data) {
        console.error('خطأ في جلب فرع الموظف:', error);
        setBranches([]);
        setBranchName('');
        return;
      }

      const normalizedBranch = {
        ...data,
        branch_name: data.branch_name || data.name || data.title || `فرع #${data.id}`
      };

      setBranches([normalizedBranch]);
      setBranchName(normalizedBranch.branch_name);
    };

    fetchSupervisorBranch();
  }, [supabase, supervisorBranchId]);

  // جلب المادة الخاصة بالموظف والتأكد أنها تابعة لفرعه.
  useEffect(() => {
    const fetchSupervisorSubject = async () => {
      if (!supervisorSubjectId || !supervisorBranchId) {
        setSubjects([]);
        setSubjectName('');
        return;
      }

      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('id', supervisorSubjectId)
        .eq('branch_id', supervisorBranchId)
        .maybeSingle();

      if (error || !data) {
        console.error('خطأ في جلب مادة الموظف:', error);
        setSubjects([]);
        setSubjectName('');
        return;
      }

      const normalizedSubject = {
        ...data,
        subject_name: data.subject_name || data.name || data.title || `مادة #${data.id}`
      };

      setSubjects([normalizedSubject]);
      setSubjectName(normalizedSubject.subject_name);
    };

    fetchSupervisorSubject();
  }, [supabase, supervisorSubjectId, supervisorBranchId]);

  useEffect(() => {
    const fetchUnits = async () => {
      if (!selectedSubject) {
        setUnits([]);
        setSelectedUnits([]);
        return;
      }
      let query = supabase.from('units').select('*').eq('subject_id', isNaN(selectedSubject) ? selectedSubject : Number(selectedSubject));
      const { data, error } = await query;
      if (!error && data) setUnits(data);
      else setUnits([]);
    };
    fetchUnits();
  }, [selectedSubject, supabase]);

  useEffect(() => {
    const fetchBankQuestions = async () => {
      if (!selectedSubject) {
        setBankQuestions([]);
        return;
      }

      let query = supabase.from('questions').select('*').eq('subject_id', Number(selectedSubject));

      if (scopeMode === 'units') {
        if (selectedUnits.length > 0) {
          query = query.in('unit_number', selectedUnits);
        } else {
          setBankQuestions([]);
          return;
        }
      }

      const { data, error } = await query;
      if (!error && data) setBankQuestions(data);
      else setBankQuestions([]);
    };

    fetchBankQuestions();
  }, [selectedSubject, scopeMode, selectedUnits, supabase]);

  const handleUnitCheckboxChange = (unitNum) => {
    if (selectedUnits.includes(unitNum)) {
      setSelectedUnits(selectedUnits.filter(u => u !== unitNum));
    } else {
      setSelectedUnits([...selectedUnits, unitNum]);
    }
  };

  const calculateTotalExamScore = () => {
    let rawSum = 0;
    (examStructure || []).forEach(sec => {
      const isOptional = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');
      if (isOptional && sec.subQuestions) {
        const subScores = sec.subQuestions.map(subQ => {
          return subQ.types ? subQ.types.reduce((tSum, t) => {
            return tSum + t.questions.reduce((qSum, q) => qSum + Number(q.custom_mark !== undefined ? q.custom_mark : 1), 0);
          }, 0) : 0;
        });
        if (subScores.length > 0) rawSum += Math.max(...subScores);
      } else {
        const secSum = sec.types ? sec.types.reduce((tSum, t) => {
          return tSum + t.questions.reduce((qSum, q) => qSum + Number(q.custom_mark !== undefined ? q.custom_mark : 1), 0);
        }, 0) : 0;
        rawSum += secSum;
      }
    });
    return rawSum;
  };

  const calculateSectionTotalScore = (sec) => {
    const isOptional = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');
    if (isOptional && sec.subQuestions) {
      const subScores = sec.subQuestions.map(subQ => {
        return subQ.types ? subQ.types.reduce((tSum, t) => {
          return tSum + t.questions.reduce((qSum, q) => qSum + Number(q.custom_mark !== undefined ? q.custom_mark : 1), 0);
        }, 0) : 0;
      });
      if (subScores.length > 0) return Math.max(...subScores);
      return 0;
    } else if (sec.types) {
      return sec.types.reduce((tSum, t) => {
        return tSum + t.questions.reduce((qSum, q) => qSum + Number(q.custom_mark !== undefined ? q.custom_mark : 1), 0);
      }, 0);
    }
    return 0;
  };

  const handleUpdateQuestionMark = (sectionName, typeKey, questionId, newMark, subQIndex = null) => {
    let val = parseFloat(newMark);
    if (isNaN(val) || val < 0.5) val = 0.5;

    setExamStructure(prev => prev.map(sec => {
      if (sec.name === sectionName) {
        const isOptional = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');
        if (isOptional && subQIndex !== null) {
          return {
            ...sec,
            subQuestions: sec.subQuestions.map((subQ, sIdx) => {
              if (sIdx === subQIndex) {
                return {
                  ...subQ,
                  types: subQ.types.map(t => {
                    if (t.typeKey === typeKey) {
                      return {
                        ...t,
                        questions: t.questions.map(q => Number(q.id) === Number(questionId) ? { ...q, custom_mark: val } : q)
                      };
                    }
                    return t;
                  })
                };
              }
              return subQ;
            })
          };
        } else {
          return {
            ...sec,
            types: sec.types.map(t => {
              if (t.typeKey === typeKey) {
                return {
                  ...t,
                  questions: t.questions.map(q => Number(q.id) === Number(questionId) ? { ...q, custom_mark: val } : q)
                };
              }
              return t;
            })
          };
        }
      }
      return sec;
    }));
  };

  const handleUpdateAllMarksForType = (sectionName, typeKey, newMark, subQIndex = null) => {
    let val = parseFloat(newMark);
    if (isNaN(val) || val < 0.5) val = 0.5;

    setExamStructure(prev => prev.map(sec => {
      if (sec.name === sectionName) {
        const isOptional = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');
        if (isOptional && subQIndex !== null) {
          return {
            ...sec,
            subQuestions: sec.subQuestions.map((subQ, sIdx) => {
              if (sIdx === subQIndex) {
                return {
                  ...subQ,
                  types: subQ.types.map(t => {
                    if (t.typeKey === typeKey) {
                      return {
                        ...t,
                        questions: t.questions.map(q => ({ ...q, custom_mark: val }))
                      };
                    }
                    return t;
                  })
                };
              }
              return subQ;
            })
          };
        } else {
          return {
            ...sec,
            types: sec.types.map(t => {
              if (t.typeKey === typeKey) {
                return {
                  ...t,
                  questions: t.questions.map(q => ({ ...q, custom_mark: val }))
                };
              }
              return t;
            })
          };
        }
      }
      return sec;
    }));
  };

  const confirmDeleteSection = (sectionName) => {
    setExamStructure(prev => prev.filter(sec => sec.name !== sectionName));
  };

  const confirmDeleteQuestionType = (sectionName, typeKey, subQIndex = null) => {
    setExamStructure(prev => prev.map(sec => {
      if (sec.name === sectionName) {
        const isOptional = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');
        if (isOptional && subQIndex !== null) {
          return {
            ...sec,
            subQuestions: sec.subQuestions.map((subQ, sIdx) => sIdx === subQIndex ? { ...subQ, types: subQ.types.filter(t => t.typeKey !== typeKey) } : subQ)
          };
        } else {
          return { ...sec, types: sec.types.filter(t => t.typeKey !== typeKey) };
        }
      }
      return sec;
    }));
  };

  const handleAddNewSection = (templateName) => {
    const template = getAvailableSections().find(s => s.name === templateName);
    if (!template) return;

    if (examStructure.some(sec => sec.name === template.name)) {
      showMsg('هذا القسم موجود مسبقاً في الامتحان', 'error');
      return;
    }

    let newSection = { name: template.name };
    const isOptionalTpl = template.name.includes('اختياري') || template.name.toLowerCase().includes('optional');
    if (isOptionalTpl) {
      newSection.subQuestions = [
        { title: 'السؤال الأول', types: [] },
        { title: 'السؤال الثاني', types: [] }
      ];
    } else {
      newSection.types = [{ typeKey: 'true_false', questions: [] }];
    }

    setExamStructure(prev => [...prev, newSection]);
    setIsAddSectionModalOpen(false);
  };

  const handleAddTypeToTarget = (typeKey) => {
    setExamStructure(prev => prev.map(sec => {
      if (sec.name === activeSectionForType) {
        const isOptional = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');
        if (isOptional) {
          const updatedSub = sec.subQuestions.map((subQ, idx) => {
            if (idx === activeQuestionIndexForType) {
              const typeExists = subQ.types.some(t => t.typeKey === typeKey);
              if (!typeExists) {
                return { ...subQ, types: sortTypesByPriority([...subQ.types, { typeKey, questions: [] }]) };
              }
            }
            return subQ;
          });
          return { ...sec, subQuestions: updatedSub };
        } else {
          const typeExists = sec.types.some(t => t.typeKey === typeKey);
          if (!typeExists) {
            return { ...sec, types: sortTypesByPriority([...sec.types, { typeKey, questions: [] }]) };
          }
        }
      }
      return sec;
    }));
    setIsAddTypeModalOpen(false);
  };

  const handleSelectQuestionFromBank = (bankQuestion) => {
    setExamStructure(prev => prev.map(sec => {
      if (sec.name === targetSectionName) {
        const isOptional = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');
        if (isOptional) {
          return {
            ...sec,
            subQuestions: sec.subQuestions.map((subQ, sIdx) => {
              if (sIdx === targetQuestionIndex) {
                return {
                  ...subQ,
                  types: subQ.types.map(t => {
                    if (t.typeKey === targetTypeKey) {
                      let updatedQuestions = [...t.questions];
                      if (!updatedQuestions.some(q => Number(q.id) === Number(bankQuestion.id))) {
                        updatedQuestions.push({ ...bankQuestion, custom_mark: 1 });
                      }
                      return { ...t, questions: updatedQuestions };
                    }
                    return t;
                  })
                };
              }
              return subQ;
            })
          };
        } else {
          return {
            ...sec,
            types: sec.types.map(t => {
              if (t.typeKey === targetTypeKey) {
                let updatedQuestions = [...t.questions];
                if (!updatedQuestions.some(q => Number(q.id) === Number(bankQuestion.id))) {
                  updatedQuestions.push({ ...bankQuestion, custom_mark: 1 });
                }
                return { ...t, questions: updatedQuestions };
              }
              return t;
            })
          };
        }
      }
      return sec;
    }));
    setIsQuestionBankOpen(false);
  };

  const handleDeleteQuestion = (sectionName, typeKey, questionId, subQIndex = null) => {
    setExamStructure(prev => prev.map(sec => {
      if (sec.name === sectionName) {
        const isOptional = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');
        if (isOptional && subQIndex !== null) {
          return {
            ...sec,
            subQuestions: sec.subQuestions.map((subQ, sIdx) => sIdx === subQIndex ? {
              ...subQ,
              types: subQ.types.map(t => t.typeKey === typeKey ? { ...t, questions: t.questions.filter(q => Number(q.id) !== Number(questionId)) } : t)
            } : subQ)
          };
        } else {
          return {
            ...sec,
            types: sec.types.map(t => t.typeKey === typeKey ? { ...t, questions: t.questions.filter(q => Number(q.id) !== Number(questionId)) } : t)
          };
        }
      }
      return sec;
    }));
  };

  // توحيد فراغات أسئلة أكمل الفراغ: 15 شرطة ثابتة.
  const COMPLETION_DASHES = '---------------';
  const normalizeCompletionText = (text) =>
    String(text ?? '').replace(/(?:[.\-_–—…ـ](?:\s*[.\-_–—…ـ]){1,})/g, COMPLETION_DASHES);

  // عدد الأسئلة المنطقي: كل نوع سؤال (صح/خطأ، اختياري، إكمال، مقالي) = سؤال واحد،
  // مهما كان عدد الفروع/العبارات داخله. في القسم الاختياري نعتمد فرعًا واحدًا فقط.
  const calculateLogicalQuestionCount = (structure = []) => {
    const countTypes = (types = []) => types.length;
    return structure.reduce((total, sec) => {
      const name = String(sec?.name || '');
      const isOptional = name.includes('الاختياري') || name.toLowerCase().includes('optional');
      if (isOptional && Array.isArray(sec?.subQuestions)) {
        const branchCounts = sec.subQuestions.map(sub => countTypes(sub?.types || []));
        return total + Math.max(0, ...branchCounts);
      }
      return total + countTypes(sec?.types || []);
    }, 0);
  };

  const getQuestionTypeHeaderTitle = (typeVal) => {
    if (typeVal === 'true_false') return 'ضع إشارة صح أو إشارة خطأ امام كل عبارة من العبارات التالية --';
    if (typeVal === 'multiple_choice' || typeVal === 'mcq') return 'اختر الاجابة الصحيحة في كل عبارة من العبارات التالية --';
    if (typeVal === 'completion' || typeVal === 'complete' || typeVal === 'fill_in_blank') return 'أكمل الفراغ في كل عبارة من العبارات التالية (-----)';
    if (typeVal === 'essay') return 'أجب عن الأسئلة المقالية التالية --';
    return 'أجب عن العبارات التالية --';
  };

  const getArabicNumberWord = (num) => {
    const words = { 1: 'الأول', 2: 'الثاني', 3: 'الثالث', 4: 'الرابع', 5: 'الخامس' };
    return words[num] || num;
  };

  const getSectionNumberedName = (index) => {
    const sectionNumbers = { 0: 'القسم الأول', 1: 'القسم الثاني', 2: 'القسم الثالث' };
    return sectionNumbers[index] || `القسم ${index + 1}`;
  };

  // الرقم الظاهر للقسم يعتمد على الأقسام المفعلة فقط.
  // مثال: إذا أُلغي القسم الاختياري، يصبح الإضافي "القسم الثاني".
  const getEnabledSectionNumber = (sectionIndex) => {
    const enabledIndexes = autoSections
      .map((section, index) => section?.enabled ? index : null)
      .filter(index => index !== null);

    const position = enabledIndexes.indexOf(sectionIndex);
    return position >= 0 ? position + 1 : null;
  };

  const renderQuestionItem = (q, idx, sectionType) => {
    const optionLetters = isEnglishExam ? ['a', 'b', 'c', 'd', 'e', 'f'] : ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
    const hasOptions = (q.options && Array.isArray(q.options) && q.options.length > 0) || 
                       (q.choices && Array.isArray(q.choices) && q.choices.length > 0) ||
                       q.question_type === 'multiple_choice' || q.type === 'multiple_choice' || q.type === 'mcq';

    const optionsList = q.options && Array.isArray(q.options) && q.options.length > 0 
      ? q.options 
      : (q.choices && Array.isArray(q.choices) && q.choices.length > 0 ? q.choices : (hasOptions ? ['الخيار الأول', 'الخيار الثاني', 'الخيار الثالث', 'الخيار الرابع'] : null));

    const isTrueFalse = sectionType === 'true_false' || q.question_type === 'true_false' || q.type === 'true_false';
    const isFillBlank = sectionType === 'fill_in_blank' || sectionType === 'completion' || q.question_type === 'fill_in_blank' || q.type === 'fill_in_blank' || q.question_type === 'complete' || q.question_type === 'completion';
    const isEssay = sectionType === 'essay' || q.question_type === 'essay' || q.type === 'essay';

    const correctAnswerText = q.answer || q.correct_answer || q.model_answer || '';
    const sourceText = q.question_text || q.text || q.body || '';
    const displaySourceText = getQuestionTextDisplay(q, sourceText);
    const rawText = isFillBlank ? normalizeCompletionText(displaySourceText) : displaySourceText;
    const questionImageUrl =
      q?.image_url ||
      q?.imageUrl ||
      q?.question_image_url ||
      q?.questionImageUrl ||
      '';

    return (
      <div style={{
        backgroundColor: '#0f172a',
        padding: '12px',
        borderRadius: '4px',
        fontSize: '14px',
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        border: '1px solid #334155',
        marginBottom: '8px',
        direction: isEnglishExam ? 'ltr' : 'rtl',
        textAlign: isEnglishExam ? 'left' : 'right'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ marginLeft: '6px', fontWeight: 'bold', color: '#60a5fa' }}>{idx + 1}-</span>
            <span>{rawText}</span>
          </div>
          
          {isTrueFalse && (
            <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#1e293b', border: '1px solid #334155', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: '#34d399', fontWeight: 'bold' }}>
                <div style={{ width: '14px', height: '14px', border: '2px solid #34d399', borderRadius: '3px' }}></div>
                <span>{isEnglishExam ? 'True' : 'صح'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#1e293b', border: '1px solid #334155', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: '#f87171', fontWeight: 'bold' }}>
                <div style={{ width: '14px', height: '14px', border: '2px solid #f87171', borderRadius: '3px' }}></div>
                <span>{isEnglishExam ? 'False' : 'خطأ'}</span>
              </div>
            </div>
          )}
        </div>

        {questionImageUrl && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            margin: '2px 0 8px'
          }}>
            <img
              src={questionImageUrl}
              alt="صورة السؤال"
              style={{
                display: 'block',
                maxWidth: '100%',
                width: 'auto',
                maxHeight: '360px',
                objectFit: 'contain',
                borderRadius: '8px',
                border: '1px solid #475569',
                background: '#fff'
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

        {isFillBlank && (
          <div style={{ [isEnglishExam ? 'paddingLeft' : 'paddingRight']: '20px', marginTop: '5px' }}>
            <div style={{ borderBottom: '2px dashed #f8fafc', width: '200px', height: '15px' }}></div>
          </div>
        )}

        {isEssay && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', [isEnglishExam ? 'paddingLeft' : 'paddingRight']: '20px' }}>
            <div style={{ borderBottom: '2px dashed #f8fafc', width: '100%', height: '10px' }}></div>
            <div style={{ borderBottom: '2px dashed #f8fafc', width: '100%', height: '10px' }}></div>
            {correctAnswerText && (
              <div style={{ marginTop: '4px', fontSize: '13px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{correctAnswerText}</span>
              </div>
            )}
          </div>
        )}
        
        {optionsList && !isTrueFalse && !isFillBlank && !isEssay && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', [isEnglishExam ? 'paddingLeft' : 'paddingRight']: '15px' }}>
            {optionsList.map((opt, optIdx) => (
              <div key={optIdx} style={{ color: '#93c5fd', fontSize: '13px' }}>
                <span style={{ fontWeight: 'bold', color: '#38bdf8', marginLeft: '6px' }}>({optionLetters[optIdx] || optIdx + 1})</span>
                {typeof opt === 'string' ? opt.replace(/[.\-_]+/g, '-----') : (opt.text || opt.option_text || '').replace(/[.\-_]+/g, '-----')}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '4px', padding: '8px 10px', borderRadius: '6px', backgroundColor: '#111827', border: '1px solid #334155', display: 'flex', flexWrap: 'wrap', gap: '8px 18px', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>الإجابة: <strong style={{ color: '#34d399' }}>{correctAnswerText || 'غير محددة'}</strong></span>
          <span style={{ color: '#94a3b8' }}>المستوى: <strong style={{ color: '#fbbf24' }}>{q.difficulty_level || q.difficulty || q.level || q.question_level || 'غير محدد'}</strong></span>
          <span style={{ color: '#94a3b8' }}>الوحدة: <strong style={{ color: '#a78bfa' }}>{q.unit_name || q.unit || q.unit_title || (q.unit_number !== undefined && q.unit_number !== null ? `الوحدة ${q.unit_number}` : 'غير محددة')}</strong></span>
        </div>
      </div>
    );
  };

  const updateAutoSection = (sectionIndex, patch) => {
    setAutoSections(prev =>
      prev.map((section, index) =>
        index === sectionIndex ? { ...section, ...patch } : section
      )
    );
  };

  const updateAutoType = (sectionIndex, typeKey, patch, branchIndex = null) => {
    setAutoSections(prev =>
      prev.map((section, index) => {
        if (index !== sectionIndex) return section;

        if (branchIndex !== null && section.kind === 'optional') {
          return {
            ...section,
            optionalBranches: (section.optionalBranches || []).map((branch, bIndex) =>
              bIndex === branchIndex
                ? {
                    ...branch,
                    types: {
                      ...branch.types,
                      [typeKey]: {
                        ...(branch.types?.[typeKey] || {}),
                        ...patch
                      }
                    }
                  }
                : branch
            )
          };
        }

        return {
          ...section,
          types: {
            ...section.types,
            [typeKey]: {
              ...(section.types?.[typeKey] || {}),
              ...patch
            }
          }
        };
      })
    );
  };

  const getTypeConfig = (section, typeKey, branchIndex = null) => {
    if (branchIndex !== null && section.kind === 'optional') {
      return section.optionalBranches?.[branchIndex]?.types?.[typeKey] || {
        enabled: false, branches: 0, mark: 1
      };
    }
    return section.types?.[typeKey] || {
      enabled: false, branches: 0, mark: 1
    };
  };

  const handleAutoGenerateExam = () => {
    if (!bankQuestions || bankQuestions.length === 0) {
      showMsg('لا توجد أسئلة في البنك لهذه المادة/النطاق لتوليد الامتحان تلقائياً.', 'error');
      return;
    }

    const enabledSections = autoSections.filter(s => s.enabled && String(s.name || '').trim());

    if (enabledSections.length === 0) {
      showMsg('يجب اختيار قسم واحد على الأقل للتوليد التلقائي.', 'error');
      return;
    }

    const usedQuestionIds = new Set();
    const shuffledBank = shuffleArray(bankQuestions);

    const matchesType = (q, key) => {
      const qType = q.question_type || q.type || '';
      if (key === 'multiple_choice') return qType === 'multiple_choice' || qType === 'mcq';
      if (key === 'completion') return ['completion', 'complete', 'fill_in_blank'].includes(qType);
      return qType === key;
    };

    const buildTypes = (typeConfig = {}) => {
      const result = [];

      QUESTION_TYPES.forEach(({ key }) => {
        const cfg = typeConfig[key];
        if (!cfg?.enabled) return;

        const count = Math.max(0, Number(cfg.branches || 0));
        if (!count) return;

        const selected = shuffledBank
          .filter(q => !usedQuestionIds.has(Number(q.id)) && matchesType(q, key))
          .slice(0, count)
          .map(q => {
            usedQuestionIds.add(Number(q.id));
            return { ...q, custom_mark: Number(cfg.mark || 1) };
          });

        if (selected.length) {
          result.push({ typeKey: key, questions: selected });
        }
      });

      return sortTypesByPriority(result);
    };

    const newStructure = [];

    enabledSections.forEach(section => {
      if (section.kind === 'optional') {
        const subQuestions = [];

        (section.optionalBranches || []).forEach((branch, branchIndex) => {
          const types = buildTypes(branch.types || {});
          if (types.length) {
            subQuestions.push({
              title: branch.name || `الفرع ${getArabicNumberWord(branchIndex + 1)}`,
              types
            });
          }
        });

        if (subQuestions.length) {
          newStructure.push({
            name: section.name.trim(),
            subQuestions
          });
        }
      } else {
        const types = buildTypes(section.types || {});
        if (types.length) {
          newStructure.push({
            name: section.name.trim(),
            types
          });
        }
      }
    });

    if (!newStructure.length) {
      showMsg('لم يتم العثور على أسئلة كافية حسب الإعدادات المحددة.', 'error');
      return;
    }

    setExamStructure(newStructure);
    showMsg('تم إنشاء الامتحان تلقائياً بدون تكرار أي سؤال. ✨', 'success');
  };


  // يمنع وجود امتحانين لنفس الفرع بفاصل أقل من ساعتين،
  // مع احتساب مدة الامتحانين والتاريخ والوقت الفعليين.
  const buildExamDateTime = (dateValue, timeValue) => {
    if (!dateValue || !timeValue) return null;
    const datePart = String(dateValue).split('T')[0];
    const timePart = String(timeValue).slice(0, 8);
    const dt = new Date(`${datePart}T${timePart}`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };

  const hasExamScheduleConflict = (candidateDate, candidateTime, candidateDuration, existingExams = [], excludedId = null) => {
    const candidateStart = buildExamDateTime(candidateDate, candidateTime);
    if (!candidateStart) return false;

    const candidateEnd = new Date(
      candidateStart.getTime() + (Number(candidateDuration) || 30) * 60 * 1000
    );
    const safetyGap = 2 * 60 * 60 * 1000;

    return existingExams.some(existing => {
      if (excludedId != null && String(existing.id) === String(excludedId)) return false;

      const existingStart = buildExamDateTime(existing.exam_date, existing.exam_time);
      if (!existingStart) return false;

      const existingEnd = new Date(
        existingStart.getTime() + (Number(existing.duration_minutes ?? existing.duration ?? 30) || 30) * 60 * 1000
      );

      // يجب أن يكون هناك ساعتان كاملتان على الأقل بين نهاية أحد الامتحانين
      // وبداية الآخر، ولا يجوز تداخل الامتحانين.
      return (
        candidateStart.getTime() < existingEnd.getTime() + safetyGap &&
        existingStart.getTime() < candidateEnd.getTime() + safetyGap
      );
    });
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showMsg('الرجاء إدخال عنوان الامتحان', 'error');
      return;
    }

    if (!supervisorBranchId || !supervisorSubjectId) {
      showMsg('لا يمكن إنشاء الامتحان: بيانات الفرع أو المادة غير مكتملة.', 'error');
      return;
    }

    if (!branchName.trim() || !subjectName.trim()) {
      showMsg('تعذر تحميل الفرع أو المادة. يرجى التأكد من بيانات الموظف.', 'error');
      return;
    }

    if (!Number.isFinite(currentInstitutionId) || currentInstitutionId <= 0) {
      showMsg('تعذر تحديد المؤسسة الحالية للامتحان.', 'error');
      return;
    }

    const finalBranchId = supervisorBranchId;
    const finalSubjectId = supervisorSubjectId;

    // Normalize the HTML time input (HH:MM) to the DB-compatible HH:MM:SS.
    const normalizedExamTime = examTime
      ? (String(examTime).length === 5 ? `${examTime}:00` : String(examTime).slice(0, 8))
      : '';

    if (!examDate || !normalizedExamTime) {
      showMsg('الرجاء تحديد تاريخ ووقت الامتحان.', 'error');
      return;
    }

    const durationNumber = Number(duration);
    if (!Number.isFinite(durationNumber) || durationNumber <= 0) {
      showMsg('الرجاء إدخال مدة امتحان صحيحة أكبر من صفر.', 'error');
      return;
    }

    setLoading(true);
    setShowSuccess(false);

    try {
      // منع أي امتحان آخر لنفس الفرع إذا كان بين الامتحانين أقل من ساعتين،
      // مع احتساب مدة الامتحان والتاريخ والوقت، وليس فقط تطابق وقت البداية.
      const { data: branchExamsForSchedule, error: scheduleError } = await supabase
        .from('exams')
        .select('id, title, exam_date, exam_time, duration_minutes')
        .eq('branch_id', finalBranchId);

      if (scheduleError) {
        console.error('Error checking exam schedule conflict:', scheduleError);
        showMsg('تعذر التحقق من مواعيد امتحانات الفرع. حاول مرة أخرى.', 'error');
        return;
      }

      if (hasExamScheduleConflict(examDate, normalizedExamTime, duration, branchExamsForSchedule || [])) {
        showMsg(
          'ممنوع إنشاء الامتحان: يجب أن يكون هناك ساعتان على الأقل بين نهاية أي امتحان آخر للفرع وبداية هذا الامتحان، مع احتساب مدة الامتحانين.',
          'error'
        );
        return;
      }

      let allQuestionIds = [];
      (examStructure || []).forEach(sec => {
        (sec?.types || []).forEach(typeGroup => {
          (typeGroup?.questions || []).forEach(q => {
            if (q?.id !== undefined && q?.id !== null) allQuestionIds.push(Number(q.id));
          });
        });
        (sec?.subQuestions || []).forEach(subQ => {
          (subQ?.types || []).forEach(typeGroup => {
            (typeGroup?.questions || []).forEach(q => {
              if (q?.id !== undefined && q?.id !== null) allQuestionIds.push(Number(q.id));
            });
          });
        });
      });
      allQuestionIds = [...new Set(allQuestionIds)];

      const finalCalculatedScore = calculateTotalExamScore();

      const normalizedExamStructure = (examStructure || []).map(sec => ({
        ...sec,
        types: (sec?.types || []).map(t => ({
          ...t,
          questions: (t?.questions || []).map(q =>
            (t.typeKey === 'completion' || t.typeKey === 'complete' || t.typeKey === 'fill_in_blank' ||
             q.question_type === 'completion' || q.question_type === 'complete' || q.question_type === 'fill_in_blank')
              ? {
                  ...q,
                  image_url: q?.image_url || q?.imageUrl || q?.question_image_url || q?.questionImageUrl || null,
                  question_text: normalizeCompletionText(q.question_text || q.text || q.body || '')
                }
              : {
                  ...q,
                  image_url: q?.image_url || q?.imageUrl || q?.question_image_url || q?.questionImageUrl || null
                }
          )
        })),
        subQuestions: (sec?.subQuestions || []).map(subQ => ({
          ...subQ,
          types: (subQ?.types || []).map(t => ({
            ...t,
            questions: (t?.questions || []).map(q =>
              (t.typeKey === 'completion' || t.typeKey === 'complete' || t.typeKey === 'fill_in_blank' ||
               q.question_type === 'completion' || q.question_type === 'complete' || q.question_type === 'fill_in_blank')
                ? { ...q, question_text: normalizeCompletionText(q.question_text || q.text || q.body || '') }
                : q
            )
          }))
        }))
      }));

      const insertPayload = {
        title: title.trim(),
        branch: branchName.trim(),
        duration_minutes: durationNumber,
        total_marks: Number(finalCalculatedScore) || 100,
        total_mark: Number(finalCalculatedScore) || 100,
        exam_date: examDate || null,
        exam_time: normalizedExamTime,
        question_mode: questionMode,
        scope_mode: scopeMode,
        selected_units: scopeMode === 'units' ? JSON.stringify(selectedUnits) : null,
        selected_questions: allQuestionIds,
        exam_structure: JSON.stringify(normalizedExamStructure),
        branch_id: finalBranchId,
        subject_id: finalSubjectId,
        institution_id: currentInstitutionId,
        question_count: calculateLogicalQuestionCount(normalizedExamStructure),
        // حالة الامتحان تُحسب تلقائياً من التاريخ + الوقت + المدة،
        // ولا نعتمد على is_active كشرط لظهور الامتحان في الإدارة.
        is_active: true,
        access_enabled: false,
      };

      const { error } = await supabase.from('exams').insert([insertPayload]);

      if (error) {
        console.error('Supabase exams insert error:', error, insertPayload);
        const detail = error.details ? ` — ${error.details}` : '';
        const hint = error.hint ? ` — ${error.hint}` : '';
        showMsg('فشل حفظ الامتحان: ' + error.message + detail + hint, 'error');
        return;
      }

      showMsg('تم إضافة الامتحان بنجاح وحفظه في النظام! ✨', 'success');
      setShowSuccess(true);

      setTimeout(() => {
        setTitle('');
        setExamDate('');
        setExamTime('');
        setSelectedUnits([]);
        setShowSuccess(false);
      }, 2000);

    } catch (err) {
      showMsg('حدث خطأ غير متوقع: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const remainingSectionsToAdd = getAvailableSections().filter(
    avail => !examStructure.some(sec => sec.name === avail.name)
  );

  const currentExamQuestionIds = new Set();
  examStructure.forEach(sec => {
    if (sec.types) sec.types.forEach(t => t.questions.forEach(q => currentExamQuestionIds.add(Number(q.id))));
    if (sec.subQuestions) {
      sec.subQuestions.forEach(subQ => {
        if (subQ.types) subQ.types.forEach(t => t.questions.forEach(q => currentExamQuestionIds.add(Number(q.id))));
      });
    }
  });

  const filteredBankQuestions = (bankQuestions || []).filter(q => {
    if (currentExamQuestionIds.has(Number(q.id))) return false;
    const qType = q.question_type || q.type || '';
    if (!selectedTypeFilter) return true;
    if (selectedTypeFilter === 'multiple_choice' || selectedTypeFilter === 'mcq') {
      return qType === 'multiple_choice' || qType === 'mcq';
    }
    if (selectedTypeFilter === 'completion' || selectedTypeFilter === 'complete' || selectedTypeFilter === 'fill_in_blank') {
      return qType === 'completion' || qType === 'complete' || qType === 'fill_in_blank';
    }
    return qType === selectedTypeFilter;
  });

  return (
    <div
      className={isEnglishExam ? 'english-exam-direction' : 'arabic-exam-direction'}
      style={{
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '10px',
        padding: '30px',
        color: '#fff',
        direction: isEnglishExam ? 'ltr' : 'rtl'
      }}
    >
      
      <style>{`
        .edge-fix-select-add, .edge-fix-input-add {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 2px solid #3b82f6 !important;
          padding: 12px 16px !important;
          border-radius: 6px !important;
          font-size: 16px !important;
          font-weight: bold !important;
          width: 100% !important;
          box-sizing: border-box !important;
          outline: none !important;
          direction: rtl !important;
          text-align: right !important;
        }
        .edge-fix-select-add option {
          background-color: #ffffff !important;
          color: #0f172a !important;
          font-weight: bold !important;
        }
        .ltr-input-fix-a {
          direction: ltr !important;
          text-align: left !important;
        }

        /* English exam: all writing/content flows from left to right */
        .english-exam-direction {
          direction: ltr !important;
          text-align: left;
        }
        .english-exam-direction .edge-fix-select-add,
        .english-exam-direction .edge-fix-input-add {
          direction: ltr !important;
          text-align: left !important;
        }
        .english-exam-direction .ltr-input-fix-a {
          direction: ltr !important;
          text-align: left !important;
        }
        hr {
          border: none;
          border-top: 2px dashed #f8fafc;
          width: 100%;
          margin: 10px 0;
        }
      `}</style>

      <h3 style={{ fontSize: '22px', marginBottom: '20px', color: '#60a5fa', borderBottom: '2px solid #2563eb', paddingBottom: '10px', textAlign: 'center' }}>
        ➕ إضافة امتحان جديد وتوزيع الأقسام والدرجات
      </h3>

      {showSuccess && (
        <div style={{ backgroundColor: '#065f46', color: '#d1fae5', padding: '16px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold', border: '2px solid #10b981', fontSize: '18px' }}>
          ✨ تمت إضافة الامتحان بنجاح وحفظه في النظام!
        </div>
      )}

      <form onSubmit={handleCreateExam} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', backgroundColor: '#0f172a', padding: '18px', borderRadius: '8px', border: '1px solid #334155' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#93c5fd', fontWeight: 'bold' }}>عنوان الامتحان:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: امتحان مبادئ التكنولوجيا الفصلي"
              className="edge-fix-input-add"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#93c5fd', fontWeight: 'bold' }}>الفرع:</label>
            <input
              type="text"
              value={branchName}
              readOnly
              placeholder="جاري تحميل الفرع..."
              className="edge-fix-input-add"
              style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
            />
            <small style={{ display: 'block', marginTop: '6px', color: '#94a3b8', fontSize: '12px' }}>
              🔒 يتم تحديد الفرع تلقائياً من بيانات الموظف.
            </small>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#93c5fd', fontWeight: 'bold' }}>المادة:</label>
            <input
              type="text"
              value={subjectName}
              readOnly
              placeholder="جاري تحميل المادة..."
              className="edge-fix-input-add"
              style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
            />
            <small style={{ display: 'block', marginTop: '6px', color: '#94a3b8', fontSize: '12px' }}>
              🔒 يتم تحديد المادة تلقائياً من بيانات الموظف.
            </small>
          </div>


          <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#93c5fd', fontWeight: 'bold', fontSize: '13px' }}>التاريخ:</label>
              <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="edge-fix-input-add ltr-input-fix-a" style={{ padding: '10px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#93c5fd', fontWeight: 'bold', fontSize: '13px' }}>الوقت:</label>
              <input type="time" value={examTime} onChange={(e) => setExamTime(e.target.value)} className="edge-fix-input-add ltr-input-fix-a" style={{ padding: '10px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#93c5fd', fontWeight: 'bold', fontSize: '13px' }}>المدة (د):</label>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="edge-fix-input-add ltr-input-fix-a" style={{ padding: '10px', textAlign: 'center' }} />
            </div>
          </div>
        </div>

        {/* نطاق الامتحان */}
        <div style={{ backgroundColor: '#0f172a', padding: '18px', borderRadius: '8px', border: '1px solid #334155' }}>
          <label style={{ display: 'block', marginBottom: '12px', fontSize: '15px', fontWeight: 'bold', color: '#60a5fa' }}>نطاق الامتحان:</label>
          <div style={{ display: 'flex', gap: '30px', marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              <input type="radio" name="scopeMode" value="all" checked={scopeMode === 'all'} onChange={() => { setScopeMode('all'); setSelectedUnits([]); }} />
              📚 كل المادة
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              <input type="radio" name="scopeMode" value="units" checked={scopeMode === 'units'} onChange={() => setScopeMode('units')} />
              📑 وحدات محددة
            </label>
          </div>

          {scopeMode === 'units' && (
            <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '6px', border: '1px solid #334155' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: '#93c5fd', fontWeight: 'bold' }}>اختر الوحدات المطلوبة:</label>
              {units.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>لا توجد وحدات مرتبطة بالمادة المحددة.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                  {units.map(u => {
                    const uNum = u.unit_number !== undefined ? u.unit_number : u.id;
                    const isChecked = selectedUnits.includes(uNum);
                    return (
                      <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: '4px', border: isChecked ? '1px solid #3b82f6' : '1px solid transparent' }}>
                        <input type="checkbox" checked={isChecked} onChange={() => handleUnitCheckboxChange(uNum)} style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }} />
                        <span style={{ fontSize: '14px', color: '#fff' }}>{u.unit_name || u.name || `الوحدة ${uNum}`}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* طريقة وضع الأسئلة */}
        <div style={{ backgroundColor: '#0f172a', padding: '18px', borderRadius: '8px', border: '1px solid #334155' }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '15px', fontWeight: 'bold', color: '#60a5fa', marginBottom: '8px' }}>طريقة وضع الأسئلة:</label>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                <input type="radio" name="questionMode" value="auto" checked={questionMode === 'auto'} onChange={() => setQuestionMode('auto')} />
                ⚡ توليد تلقائي
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                <input type="radio" name="questionMode" value="manual" checked={questionMode === 'manual'} onChange={() => setQuestionMode('manual')} />
                ✍️ وضع يدوي وتخصيص كامل للأقسام
              </label>
            </div>

            {questionMode === 'auto' && (
              <div style={{
                backgroundColor: '#0b1220',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid #3b82f6',
                marginBottom: '15px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <h5 style={{ margin: 0, color: '#60a5fa', fontSize: '15px' }}>
                    ⚙️ إعدادات التوليد التلقائي
                  </h5>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                    السؤال لا يتكرر داخل الامتحان
                  </span>
                </div>

                {/* الصف الأول */}
                <div style={{
                  backgroundColor: '#111c32',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '12px'
                }}>
                  <div style={{ color: '#93c5fd', fontWeight: 'bold', fontSize: '13px', marginBottom: '10px' }}>
                    عدد الأقسام وتحديد أسماء الأقسام
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '10px'
                  }}>
                    {autoSections.map((section, index) => (
                      <div key={index} style={{
                        backgroundColor: section.enabled ? '#172554' : '#0f172a',
                        border: section.enabled ? '1px solid #3b82f6' : '1px solid #334155',
                        borderRadius: '7px',
                        padding: '10px'
                      }}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '7px',
                          cursor: 'pointer',
                          color: '#fff',
                          fontWeight: 'bold',
                          fontSize: '12px',
                          marginBottom: '8px'
                        }}>
                          <input
                            type="checkbox"
                            checked={section.enabled}
                            onChange={e => updateAutoSection(index, { enabled: e.target.checked })}
                            style={{ width: '17px', height: '17px', accentColor: '#3b82f6' }}
                          />
                          {getSectionNumberedDisplayName(getEnabledSectionNumber(index) - 1)}
                        </label>

                        <input
                          type="text"
                          value={section.name}
                          disabled={!section.enabled}
                          onChange={e => updateAutoSection(index, { name: e.target.value })}
                          placeholder="اكتب اسم القسم"
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            backgroundColor: '#0f172a',
                            color: '#fff',
                            padding: '8px',
                            borderRadius: '5px',
                            border: '1px solid #334155',
                            textAlign: isEnglishExam ? 'left' : 'right',
                             direction: isEnglishExam ? 'ltr' : 'rtl',
                            opacity: section.enabled ? 1 : 0.5
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* الصف الثاني */}
                <div style={{ color: '#93c5fd', fontWeight: 'bold', fontSize: '13px' }}>
                  ترتيب الأقسام
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {autoSections.map((section, sectionIndex) => {
                    if (!section.enabled) return null;

                    const renderTypes = (owner, branchIndex = null) => (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                        gap: '8px'
                      }}>
                        {QUESTION_TYPES.map(({ key, label }) => {
                          const cfg = getTypeConfig(owner, key, branchIndex);

                          return (
                            <div key={key} style={{
                              backgroundColor: cfg.enabled ? '#172554' : '#0f172a',
                              border: cfg.enabled ? '1px solid #2563eb' : '1px solid #334155',
                              borderRadius: '7px',
                              padding: '9px'
                            }}>
                              {/* الصف الثالث */}
                              <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                color: '#fff',
                                fontWeight: 'bold',
                                fontSize: '12px'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={!!cfg.enabled}
                                  onChange={e => updateAutoType(sectionIndex, key, { enabled: e.target.checked }, branchIndex)}
                                  style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
                                />
                                {getQuestionTypeDisplayLabel(key, label)}
                              </label>

                              {/* بيانات النوع تظهر فقط عند تفعيل checkbox */}
                              {cfg.enabled && (
                                <div style={{
                                  marginTop: '9px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '7px'
                                }}>
                                  {/* الصف الرابع */}
                                  <div>
                                    <label style={{ display: 'block', color: '#93c5fd', fontSize: '11px', marginBottom: '4px' }}>
                                      عدد الفروع للسؤال
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      max="50"
                                      value={cfg.branches}
                                      onChange={e => updateAutoType(sectionIndex, key, {
                                        branches: Math.max(1, Number(e.target.value) || 1)
                                      }, branchIndex)}
                                      style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        backgroundColor: '#0f172a',
                                        color: '#fff',
                                        padding: '7px',
                                        borderRadius: '5px',
                                        border: '1px solid #334155',
                                        textAlign: 'center'
                                      }}
                                    />
                                  </div>

                                  {/* الصف الخامس */}
                                  <div>
                                    <label style={{ display: 'block', color: '#93c5fd', fontSize: '11px', marginBottom: '4px' }}>
                                      علامة الفرع
                                    </label>
                                    <input
                                      type="number"
                                      min="0.5"
                                      step="0.5"
                                      value={cfg.mark}
                                      onChange={e => updateAutoType(sectionIndex, key, {
                                        mark: Math.max(0.5, Number(e.target.value) || 0.5)
                                      }, branchIndex)}
                                      style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        backgroundColor: '#0f172a',
                                        color: '#fbbf24',
                                        padding: '7px',
                                        borderRadius: '5px',
                                        border: '1px solid #334155',
                                        textAlign: 'center',
                                        fontWeight: 'bold'
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );

                    return (
                      <div key={sectionIndex} style={{
                        backgroundColor: '#111827',
                        border: '2px solid #334155',
                        borderRadius: '10px',
                        padding: '14px'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '12px',
                          paddingBottom: '10px',
                          borderBottom: '1px solid #334155'
                        }}>
                          <div style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '15px' }}>
                            {getSectionNumberedDisplayName(getEnabledSectionNumber(sectionIndex) - 1)}: {getSectionDisplayName(section.name)}
                          </div>
                          <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                            {section.kind === 'optional'
                              ? isEnglishExam ? 'Optional Section — Two Alternative Branches' : 'قسم اختياري — فرعان بديلان'
                              : section.kind === 'additional'
                                ? isEnglishExam ? 'Additional Section' : 'قسم إضافي'
                                : isEnglishExam ? 'Basic Section' : 'قسم أساسي'}
                          </span>
                        </div>

                        {section.kind === 'optional' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {section.optionalBranches.map((branch, branchIndex) => (
                              <div key={branchIndex} style={{
                                backgroundColor: '#0f172a',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                padding: '11px'
                              }}>
                                <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '12px', marginBottom: '9px' }}>
                                  {getBranchDisplayName(branch.name, branchIndex)}
                                </div>
                                {renderTypes(branch, branchIndex)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          renderTypes(section)
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleAutoGenerateExam}
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '13px'
                  }}
                >
                  ⚡ إنشاء الامتحان
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div style={{ backgroundColor: '#1e293b', padding: '8px 16px', borderRadius: '6px', border: '1px solid #334155', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#93c5fd' }}>العلامة الكلية المحسوبة:</span>
              <span style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '18px' }}>{calculateTotalExamScore()}</span>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: 0, color: '#60a5fa', fontSize: '16px' }}>📋 هيكل الأقسام والأسئلة (الأساسي، الاختياري، الإضافي):</h4>
              {remainingSectionsToAdd.length > 0 && (
                <button type="button" onClick={() => setIsAddSectionModalOpen(true)} style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                  ➕ إضافة قسم جديد
                </button>
              )}
            </div>

            {(examStructure || []).map((sec, sIdx) => {
              const currentSectionScore = calculateSectionTotalScore(sec);
              const isOptionalSec = sec.name.includes('اختياري') || sec.name.toLowerCase().includes('optional');

              return (
                <div key={sIdx} style={{ marginBottom: '20px', backgroundColor: '#1e293b', padding: '18px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '12px', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <h5 style={{ color: '#60a5fa', margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{getSectionNumberedDisplayName(sIdx)}: {getSectionDisplayName(sec.name)}</h5>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0f172a', padding: '4px 10px', borderRadius: '6px', border: '1px solid #334155' }}>
                        <span style={{ fontSize: '12px', color: '#93c5fd' }}>علامة القسم:</span>
                        <span style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '14px' }}>{currentSectionScore}</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {!isOptionalSec && (
                        <button type="button" onClick={() => { setActiveSectionForType(sec.name); setActiveQuestionIndexForType(null); setIsAddTypeModalOpen(true); }} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                          ➕ إضافة نوع سؤال
                        </button>
                      )}
                      <button type="button" onClick={() => confirmDeleteSection(sec.name)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        حذف القسم 🗑️
                      </button>
                    </div>
                  </div>

                  {isOptionalSec && sec.subQuestions ? (
                    sec.subQuestions.map((subQ, subIdx) => {
                      const subQuestionTotalMark = subQ.types ? subQ.types.reduce((tSum, t) => {
                        return tSum + t.questions.reduce((qSum, q) => qSum + Number(q.custom_mark !== undefined ? q.custom_mark : 1), 0);
                      }, 0) : 0;

                      return (
                        <div key={subIdx} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', marginBottom: '15px', padding: '15px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '10px' }}>
                            <h6 style={{ color: '#fff', margin: 0, fontSize: '14px' }}>
                              السؤال {getArabicNumberWord(subIdx + 1)} (بديل) - علامة السؤال: <span style={{ color: '#fbbf24' }}>{subQuestionTotalMark}</span>
                            </h6>
                            <button type="button" onClick={() => { setActiveSectionForType(sec.name); setActiveQuestionIndexForType(subIdx); setIsAddTypeModalOpen(true); }} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                              ➕ إضافة نوع أسئلة
                            </button>
                          </div>

                          {subQ.types.length === 0 ? (
                            <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', margin: '10px 0' }}>لا توجد أنواع أسئلة مضافة لهذا السؤال.</p>
                          ) : (
                            subQ.types.map((typeGroup, tIdx) => (
                              <div key={tIdx} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', marginBottom: '10px', padding: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '10px' }}>
                                  <span style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '13px' }}>
                                    {isEnglishExam ? `Question ${getNumberWordDisplay(subIdx + 1)}` : `السؤال ${getNumberWordDisplay(subIdx + 1)}`} : {getQuestionTypeHeaderDisplay(typeGroup.typeKey)}
                                  </span>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button type="button" onClick={() => { setTargetSectionName(sec.name); setTargetQuestionIndex(subIdx); setTargetTypeKey(typeGroup.typeKey); setSelectedTypeFilter(typeGroup.typeKey); setIsQuestionBankOpen(true); }} style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                      ➕ إضافة فرع من البنك
                                    </button>
                                    <button type="button" onClick={() => confirmDeleteQuestionType(sec.name, typeGroup.typeKey, subIdx)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                      حذف النوع 🗑️
                                    </button>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', marginBottom: '12px', flexWrap: 'wrap' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '12px', color: '#93c5fd' }}>عدد الفروع:</span>
                                    <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '13px' }}>{typeGroup.questions.length}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '12px', color: '#93c5fd' }}>علامة الفرع (موحدة):</span>
                                    <input
                                      type="number"
                                      min="0.5"
                                      step="0.5"
                                      value={
                                        typeGroup.questions.length > 0 
                                          ? (typeGroup.questions.every(q => Number(q.custom_mark !== undefined ? q.custom_mark : 1) === Number(typeGroup.questions[0].custom_mark !== undefined ? typeGroup.questions[0].custom_mark : 1))
                                              ? Number(typeGroup.questions[0].custom_mark !== undefined ? typeGroup.questions[0].custom_mark : 1)
                                              : '') 
                                          : 1
                                      }
                                      placeholder="متعدد"
                                      onChange={(e) => handleUpdateAllMarksForType(sec.name, typeGroup.typeKey, e.target.value, subIdx)}
                                      style={{ width: '70px', backgroundColor: '#1e293b', color: '#fbbf24', border: '1px solid #334155', borderRadius: '4px', textAlign: 'center', padding: '4px', fontWeight: 'bold', fontSize: '13px' }}
                                    />
                                  </div>
                                </div>

                                {typeGroup.questions.map((q, qIdx) => (
                                  <div key={q.id || qIdx}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#0f172a', padding: '4px 8px', borderRadius: '4px', border: '1px solid #334155' }}>
                                        <span style={{ color: '#93c5fd', fontSize: '12px' }}>علامة الفرع:</span>
                                        <input
                                          type="number"
                                          min="0.5"
                                          step="0.5"
                                          value={q.custom_mark !== undefined ? q.custom_mark : 1}
                                          onChange={(e) => handleUpdateQuestionMark(sec.name, typeGroup.typeKey, q.id, e.target.value, subIdx)}
                                          style={{ width: '60px', backgroundColor: '#1e293b', color: '#fbbf24', border: '1px solid #334155', borderRadius: '4px', textAlign: 'center', padding: '4px', fontWeight: 'bold', fontSize: '13px' }}
                                        />
                                      </div>
                                      <button type="button" onClick={() => handleDeleteQuestion(sec.name, typeGroup.typeKey, q.id, subIdx)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                        حذف الفرع ✕
                                      </button>
                                    </div>
                                    {renderQuestionItem(q, qIdx, typeGroup.typeKey)}
                                  </div>
                                ))}
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })
                  ) : (
                    sec.types.map((typeGroup, tIdx) => (
                      <div key={tIdx} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', marginBottom: '15px', padding: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '12px' }}>
                          <span style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '14px' }}>
                            {isEnglishExam ? `Question ${getNumberWordDisplay(tIdx + 1)}` : `السؤال ${getNumberWordDisplay(tIdx + 1)}`} : {getQuestionTypeHeaderDisplay(typeGroup.typeKey)}
                          </span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="button" onClick={() => { setTargetSectionName(sec.name); setTargetQuestionIndex(null); setTargetTypeKey(typeGroup.typeKey); setSelectedTypeFilter(typeGroup.typeKey); setIsQuestionBankOpen(true); }} style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                              ➕ اختيار سؤال من البنك
                            </button>
                            <button type="button" onClick={() => confirmDeleteQuestionType(sec.name, typeGroup.typeKey)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                              حذف النوع 🗑️
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', backgroundColor: '#1e293b', padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155', marginBottom: '12px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', color: '#93c5fd' }}>عدد الفروع:</span>
                            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '13px' }}>{typeGroup.questions.length}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', color: '#93c5fd' }}>علامة الفرع (موحدة):</span>
                            <input
                              type="number"
                              min="0.5"
                              step="0.5"
                              value={
                                typeGroup.questions.length > 0 
                                  ? (typeGroup.questions.every(q => Number(q.custom_mark !== undefined ? q.custom_mark : 1) === Number(typeGroup.questions[0].custom_mark !== undefined ? typeGroup.questions[0].custom_mark : 1))
                                      ? Number(typeGroup.questions[0].custom_mark !== undefined ? typeGroup.questions[0].custom_mark : 1)
                                      : '') 
                                  : 1
                              }
                              placeholder="متعدد"
                              onChange={(e) => handleUpdateAllMarksForType(sec.name, typeGroup.typeKey, e.target.value)}
                              style={{ width: '70px', backgroundColor: '#0f172a', color: '#fbbf24', border: '1px solid #334155', borderRadius: '4px', textAlign: 'center', padding: '4px', fontWeight: 'bold', fontSize: '13px' }}
                            />
                          </div>
                        </div>

                        {typeGroup.questions.length === 0 ? (
                          <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', margin: '10px 0' }}>لا توجد أسئلة مضافة لهذا النوع.</p>
                        ) : (
                          typeGroup.questions.map((q, qIdx) => (
                            <div key={q.id || qIdx}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#1e293b', padding: '4px 8px', borderRadius: '4px', border: '1px solid #334155' }}>
                                  <span style={{ color: '#93c5fd', fontSize: '12px' }}>علامة الفرع:</span>
                                  <input
                                    type="number"
                                    min="0.5"
                                    step="0.5"
                                    value={q.custom_mark !== undefined ? q.custom_mark : 1}
                                    onChange={(e) => handleUpdateQuestionMark(sec.name, typeGroup.typeKey, q.id, e.target.value)}
                                    style={{ width: '60px', backgroundColor: '#0f172a', color: '#fbbf24', border: '1px solid #334155', borderRadius: '4px', textAlign: 'center', padding: '4px', fontWeight: 'bold', fontSize: '13px' }}
                                  />
                                </div>
                                <button type="button" onClick={() => handleDeleteQuestion(sec.name, typeGroup.typeKey, q.id)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                  حذف السؤال ✕
                                </button>
                              </div>
                              {renderQuestionItem(q, qIdx, typeGroup.typeKey)}
                            </div>
                          ))
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', width: '100%', marginTop: '10px' }}
        >
          {loading ? 'جاري الحفظ...' : '💾 حفظ وإنشاء الامتحان في النظام'}
        </button>
      </form>

      {/* نافذة اختيار الأسئلة من البنك */}
      {isQuestionBankOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', width: '100%', maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto', padding: '25px', borderRadius: '10px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #2563eb', paddingBottom: '10px', marginBottom: '15px' }}>
              <h4 style={{ margin: 0, color: '#60a5fa', fontSize: '18px' }}>📚 اختر أسئلة من البنك (مطابقة للنوع المحدد)</h4>
              <button type="button" onClick={() => setIsQuestionBankOpen(false)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>✕ إغلاق</button>
            </div>

            {filteredBankQuestions.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>لا توجد أسئلة متاحة مطابقة في البنك لهذا النوع.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredBankQuestions.map((bq, bIdx) => (
                  <div key={bq.id || bIdx} style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
                    <div style={{ flex: 1, color: '#fff', fontSize: '14px' }}>
                      <span style={{ color: '#60a5fa', fontWeight: 'bold', marginLeft: '6px' }}>{bIdx + 1}-</span>
                      {(bq.question_text || bq.text || bq.body || '').replace(/[.\-_]+/g, '-----')}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectQuestionFromBank(bq)}
                      style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap' }}
                    >
                      اختيار ➕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* نافذة إضافة قسم جديد */}
      {isAddSectionModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', width: '100%', maxWidth: '400px', padding: '25px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#60a5fa', fontSize: '18px' }}>➕ إضافة قسم جديد</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {remainingSectionsToAdd.map((sec, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddNewSection(sec.name)}
                  style={{ backgroundColor: '#0f172a', color: '#38bdf8', border: '1px solid #334155', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
                >
                  {sec.name}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setIsAddSectionModalOpen(false)} style={{ backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة نوع سؤال */}
      {isAddTypeModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', width: '100%', maxWidth: '400px', padding: '25px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#60a5fa', fontSize: '18px' }}>➕ إضافة نوع سؤال جديد</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <button type="button" onClick={() => handleAddTypeToTarget('true_false')} style={{ backgroundColor: '#0f172a', color: '#34d399', border: '1px solid #334155', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{getQuestionTypeDisplayLabel('true_false', 'صح وخطأ')}</button>
              <button type="button" onClick={() => handleAddTypeToTarget('multiple_choice')} style={{ backgroundColor: '#0f172a', color: '#38bdf8', border: '1px solid #334155', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{getQuestionTypeDisplayLabel('multiple_choice', 'اختيار من متعدد')}</button>
              <button type="button" onClick={() => handleAddTypeToTarget('completion')} style={{ backgroundColor: '#0f172a', color: '#fbbf24', border: '1px solid #334155', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{getQuestionTypeDisplayLabel('completion', 'أكمل الفراغ')}</button>
              <button type="button" onClick={() => handleAddTypeToTarget('essay')} style={{ backgroundColor: '#0f172a', color: '#f472b6', border: '1px solid #334155', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{getQuestionTypeDisplayLabel('essay', 'سؤال مقالي')}</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setIsAddTypeModalOpen(false)} style={{ backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}