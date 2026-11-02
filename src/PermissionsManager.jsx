import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

// كل بند هنا يقابل صلاحية فعلية في القائمة الرئيسية.
// عند تفعيل check للبند، يظهر البند للموظف صاحب الوظيفة المحددة.
const PERMISSION_GROUPS = [
  {
    title: "إدارة المؤسسة",
    items: [["manage_institution", "إدارة المؤسسة"]],
  },
  {
    title: "المديريات والمدارس",
    items: [["manage_directorates_schools", "إدارة المديريات والمدارس"]],
  },
  {
    title: "الهيكلية الدراسية",
    items: [
      ["manage_branches", "إدارة الفروع"],
      ["manage_subjects", "إدارة المواد"],
      ["manage_units", "إدارة الوحدات"],
    ],
  },
  {
    title: "الأسئلة",
    items: [
      ["add_question", "إضافة سؤال"],
      ["view_questions", "عرض الأسئلة"],
      ["edit_question", "تعديل سؤال"],
      ["delete_question", "حذف سؤال"],
    ],
  },
  {
    title: "الامتحانات",
    items: [
      ["add_exam", "إنشاء امتحان"],
      ["view_exams", "عرض الامتحان"],
      ["edit_exam", "تعديل الامتحان"],
      ["delete_exam", "حذف الامتحان"],
    ],
  },
  {
    title: "الطلاب",
    items: [
      ["manage_registration_cycles", "إدارة الدورات"],
      ["add_student", "إضافة طالب"],
      ["manage_student", "إدارة وحذف الطلاب"],
    ],
  },
  {
    title: "طلبات تعديل البيانات الشخصية",
    items: [
      ["view_registration_requests", "عرض طلبات تعديل بيانات الطلاب"],
      ["approve_registration_requests", "الموافقة على طلبات تعديل البيانات"],
      ["reject_registration_requests", "رفض طلبات تعديل البيانات"],
    ],
  },
  {
    title: "نتائج الطلاب والمعدلات",
    items: [
      ["manage_student_results", "إدارة النتائج"],
      ["result_announcements", "إعلان النتائج"],
      ["view_student_results", "عرض النتائج"],
    ],
  },
  {
    title: "مراقبة الطلاب",
    items: [["monitor_students", "مراقبة محاولات الغش"]],
  },
  {
    title: "الإحصائيات",
    items: [["view_statistics", "الإحصائيات العامة"]],
  },
  {
    title: "مراسلة الموظفين",
    items: [["employee_messaging", "مراسلة الموظفين"]],
  },
  {
    title: "إدارة الإرشادات",
    items: [
      ["manage_guides", "عرض وإدارة الإرشادات"],
    ],
  },
  {
    title: "الدعم الفني / مراسلات الطلاب",
    items: [["student_support_messaging", "مراسلات الطلاب / دعم فني"]],
  },
  {
    title: "مراجعة الامتحانات",
    items: [
      ["review_exam_requests", "مراجعة الامتحانات التي طلب الطالب مراجعتها"],
      ["view_reviewed_exam_reviews", "الامتحانات التي تمت مراجعتها"],
      ["view_unreviewed_exam_reviews", "الامتحانات التي لم تتم مراجعتها"],
      ["adjust_exam_review_mark", "تعديل علامة الامتحان أثناء المراجعة"],
      ["manage_review_request_button_visibility", "إظهار/إخفاء زر إنشاء طلب مراجعة للطلاب"],
    ],
  },
  {
    title: "إدارة الصلاحيات",
    items: [["manage_permissions", "إدارة الصلاحيات"]],
  },
  {
    title: "إدارة الموظفين",
    items: [
      ["manage_employees", "إدارة الموظفين"],
      ["manage_jobs", "إدارة الوظائف"],
      ["view_employee_profile", "عرض ملف الموظف"],
    ],
  },
  {
    title: "الإرشادات والتعليمات",
    items: [["manage_guides", "إدارة الإرشادات"]],
  },
  {
    title: "الإرشادات والتعليمات",
    items: [["manage_guides", "إدارة الإرشادات"]],
  },
  {
    title: "الملاحظات",
    items: [["notes_book", "الملاحظات"]],
  },
  {
    title: "النسخ الاحتياطي",
    items: [["backup_data", "حفظ البيانات والنسخ الاحتياطي"]],
  },
];

export default function PermissionsManager() {
  const [jobs, setJobs] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const messageTimerRef = useRef(null);

  const showMessage = (text) => {
    setMessage(text);
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    messageTimerRef.current = setTimeout(() => {
      setMessage("");
      messageTimerRef.current = null;
    }, 2500);
  };

  useEffect(() => () => {
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
  }, []);

  const permissionMap = useMemo(() => {
    const map = new Map();
    permissions.forEach((p) => {
      if (p.permission_key) map.set(p.permission_key, p);
    });
    return map;
  }, [permissions]);

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    const definedPermissions = PERMISSION_GROUPS.flatMap((group) =>
      group.items.map(([permission_key, permission_name]) => ({
        permission_key,
        permission_name,
        description: permission_name,
        is_active: true,
      }))
    );

    const { data: existingPermissions, error: existingPermissionsError } = await supabase
      .from("permissions")
      .select("permission_key");

    if (existingPermissionsError) {
      showMessage("تعذر التحقق من الصلاحيات: " + existingPermissionsError.message);
      setLoading(false);
      return;
    }

    const existingKeys = new Set(
      (existingPermissions || []).map((item) => item.permission_key).filter(Boolean)
    );
    const missingPermissions = definedPermissions.filter(
      (item) => !existingKeys.has(item.permission_key)
    );

    if (missingPermissions.length) {
      const { error } = await supabase.from("permissions").insert(missingPermissions);
      if (error) showMessage("تعذر إضافة بنود الصلاحيات الجديدة: " + error.message);
    }

    const [jobsResult, permissionsResult] = await Promise.all([
      supabase.from("jobs").select("id, job_name, is_active").eq("is_active", true).order("id"),
      supabase
        .from("permissions")
        .select("id, permission_name, permission_key, is_active")
        .eq("is_active", true)
        .order("id"),
    ]);

    if (jobsResult.error) {
      showMessage("تعذر تحميل الوظائف: " + jobsResult.error.message);
      setLoading(false);
      return;
    }
    if (permissionsResult.error) {
      showMessage("تعذر تحميل الصلاحيات: " + permissionsResult.error.message);
      setLoading(false);
      return;
    }

    const jobsData = jobsResult.data || [];
    setJobs(jobsData);
    setPermissions(permissionsResult.data || []);
    if (!selectedJobId && jobsData.length) setSelectedJobId(String(jobsData[0].id));
    setLoading(false);
  };

  const loadJobPermissions = async (jobId) => {
    if (!jobId) {
      setSelectedKeys(new Set());
      return;
    }
    const { data, error } = await supabase
      .from("job_permissions")
      .select("permission_id")
      .eq("job_id", Number(jobId));

    if (error) {
      showMessage("تعذر تحميل صلاحيات الوظيفة: " + error.message);
      setSelectedKeys(new Set());
      return;
    }

    const ids = new Set((data || []).map((row) => Number(row.permission_id)));
    setSelectedKeys(
      new Set(
        permissions
          .filter((permission) => ids.has(Number(permission.id)))
          .map((permission) => permission.permission_key)
          .filter(Boolean)
      )
    );
    setMessage("");
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (selectedJobId && permissions.length) loadJobPermissions(selectedJobId);
  }, [selectedJobId, permissions]);

  const togglePermission = (key) => {
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allKeys = useMemo(
    () => PERMISSION_GROUPS.flatMap((group) => group.items.map(([key]) => key)),
    []
  );

  const selectAll = () => setSelectedKeys(new Set(allKeys.filter((key) => permissionMap.has(key))));
  const clearAll = () => setSelectedKeys(new Set());

  const savePermissions = async () => {
    if (!selectedJobId) return;
    setSaving(true);
    setMessage("");

    const { error: deleteError } = await supabase
      .from("job_permissions")
      .delete()
      .eq("job_id", Number(selectedJobId));

    if (deleteError) {
      setSaving(false);
      showMessage("تعذر حذف الصلاحيات القديمة: " + deleteError.message);
      return;
    }

    const rows = [...selectedKeys]
      .map((key) => permissionMap.get(key))
      .filter(Boolean)
      .map((permission) => ({ job_id: Number(selectedJobId), permission_id: Number(permission.id) }));

    if (rows.length) {
      const { error: insertError } = await supabase.from("job_permissions").insert(rows);
      if (insertError) {
        setSaving(false);
        showMessage("تعذر حفظ الصلاحيات: " + insertError.message);
        return;
      }
    }

    setSaving(false);
    showMessage("تم حفظ صلاحيات الوظيفة بنجاح ✅");
  };

  if (loading) {
    return <div style={styles.page}><div style={styles.card}>جاري تحميل الصلاحيات...</div></div>;
  }

  return (
    <div dir="rtl" className="permissions-manager-page" style={styles.page}>
      <style>{`
        .permissions-manager-page, .permissions-manager-page * { box-sizing: border-box; }
        .permissions-manager-page { min-width: 0; overflow-x: clip; }
        .permissions-manager-page .pm-header { min-width: 0; }
        .permissions-manager-page .pm-groups { grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); }
        .permissions-manager-page fieldset.pm-group { min-inline-size: 0; }
        .permissions-manager-page fieldset.pm-group legend { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; max-width: 100%; }
        .permissions-manager-page .pm-permission-label { display:block; flex:1 1 auto; min-width:0; white-space:normal !important; writing-mode:horizontal-tb !important; text-orientation:mixed !important; overflow-wrap:anywhere; word-break:normal; }
        .permissions-manager-page .pm-permission { display:flex !important; flex-direction:row !important; align-items:center !important; justify-content:flex-start !important; width:100%; min-width:0; }
        .permissions-manager-page .pm-groups { display:grid !important; grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr)); align-items:start; }
        .permissions-manager-page fieldset.pm-group { width:100%; min-width:0; }
        .permissions-manager-page input[type="checkbox"] { width: 18px !important; height: 18px !important; min-width: 18px !important; min-height: 18px !important; max-width: 18px !important; max-height: 18px !important; flex: 0 0 18px !important; transform: none !important; }
        @media (max-width: 600px) {
          .permissions-manager-page { padding: 8px !important; font-size: 13px; }
          .permissions-manager-page .pm-card { padding: 12px !important; border-radius: 12px !important; }
          .permissions-manager-page .pm-header { flex-direction: column; align-items: stretch; gap: 10px; }
          .permissions-manager-page .pm-title { font-size: 19px !important; line-height: 1.35 !important; }
          .permissions-manager-page .pm-subtitle { font-size: 11px !important; line-height: 1.55 !important; }
          .permissions-manager-page .pm-actions { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; gap: 6px !important; }
          .permissions-manager-page .pm-actions button { min-width: 0; width: 100%; padding: 8px 6px !important; font-size: 12px !important; white-space: normal; }
          .permissions-manager-page .pm-actions button:last-child { grid-column: 1 / -1; }
          .permissions-manager-page .pm-job-panel { display: grid !important; grid-template-columns: 36px minmax(0, 1fr); gap: 8px !important; padding: 10px !important; }
          .permissions-manager-page .pm-job-panel .pm-select { grid-column: 1 / -1; font-size: 13px !important; padding: 9px !important; }
          .permissions-manager-page .pm-job-icon { width: 36px !important; height: 36px !important; }
          .permissions-manager-page .pm-job-label { font-size: 13px !important; }
          .permissions-manager-page .pm-job-hint { font-size: 10px !important; }
          .permissions-manager-page .pm-groups { grid-template-columns: minmax(0, 1fr) !important; gap: 9px !important; margin-top: 12px !important; }
          .permissions-manager-page fieldset.pm-group { padding: 7px 8px 9px !important; border-width: 1px !important; border-radius: 10px !important; }
          .permissions-manager-page .pm-group-legend { font-size: 12px !important; padding-inline: 4px !important; }
          .permissions-manager-page .pm-group-title { font-size: 12px !important; }
          .permissions-manager-page .pm-group-count { font-size: 10px !important; }
          .permissions-manager-page .pm-permission { min-height: 34px !important; gap: 7px !important; padding: 6px !important; }
          .permissions-manager-page .pm-permission-label { font-size: 11px !important; line-height: 1.5 !important; }
          .permissions-manager-page .pm-message { font-size: 12px !important; padding: 8px 10px !important; }
        }
      `}</style>
      <div className="pm-card" style={styles.card}>
        <div className="pm-header" style={styles.header}>
          <div>
            <div style={styles.eyebrow}>نظام الصلاحيات</div>
            <h2 className="pm-title" style={styles.title}>🛡️ إدارة صلاحيات الموظفين</h2>
            <p className="pm-subtitle" style={styles.subtitle}>اختر الوظيفة ثم ضع ✓ بجانب كل بند تريد إظهاره لموظفي هذه الوظيفة.</p>
          </div>
          <div className="pm-actions" style={styles.actions}>
            <button type="button" onClick={selectAll} style={styles.secondaryButton}>✓ تحديد الكل</button>
            <button type="button" onClick={clearAll} style={styles.secondaryButton}>إلغاء الكل</button>
            <button type="button" onClick={savePermissions} disabled={saving || !selectedJobId} style={{ ...styles.saveButton, opacity: saving || !selectedJobId ? 0.6 : 1 }}>
              {saving ? "جاري الحفظ..." : "💾 حفظ التغييرات"}
            </button>
          </div>
        </div>

        <div className="pm-job-panel" style={styles.jobPanel}>
          <div className="pm-job-icon" style={styles.jobIcon}>👔</div>
          <div style={styles.jobText}>
            <div className="pm-job-label" style={styles.label}>الوظيفة</div>
            <div className="pm-job-hint" style={styles.jobHint}>الصلاحيات التي ستطبق على جميع موظفي هذه الوظيفة</div>
          </div>
          <select className="pm-select" value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} style={styles.select} aria-label="اختيار الوظيفة">
            {jobs.map((job) => <option key={job.id} value={job.id}>{job.job_name}</option>)}
          </select>
        </div>

        {message && <div style={{ ...styles.message, color: message.includes("تعذر") ? "#991b1b" : "#166534", background: message.includes("تعذر") ? "#fee2e2" : "#dcfce7", borderColor: message.includes("تعذر") ? "#fecaca" : "#bbf7d0" }}>{message}</div>}

        <div className="pm-groups" style={styles.groups}>
          {PERMISSION_GROUPS.map((group, groupIndex) => (
            <fieldset className="pm-group" key={group.title} style={{ ...styles.group, ...(styles.groupVariants[groupIndex % styles.groupVariants.length] || {}) }}>
              <legend className="pm-group-legend" style={styles.groupLegend}>
                <span className="pm-group-title" style={styles.groupTitle}>{group.title}</span>
                <span className="pm-group-count" style={styles.groupCount}>{group.items.length} بنود</span>
              </legend>
              <div style={styles.permissionGrid}>
                {group.items.map(([key, label]) => {
                  const exists = permissionMap.has(key);
                  const checked = selectedKeys.has(key);
                  return (
                    <label className="pm-permission" key={key} style={{ ...styles.permission, ...(checked ? styles.permissionChecked : {}), opacity: exists ? 1 : 0.45 }}>
                      <input type="checkbox" checked={checked} disabled={!exists} onChange={() => togglePermission(key)} style={styles.checkbox} />
                      <span className="pm-permission-label" style={styles.permissionLabel}>{label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100%", width: "100%", padding: "18px", boxSizing: "border-box", background: "#020817", fontFamily: "Cairo, Arial, sans-serif", color: "#eaf4ff" },
  card: { maxWidth: "1380px", margin: "0 auto", padding: "20px", boxSizing: "border-box", background: "rgba(8,20,42,.92)", border: "1px solid rgba(14,165,233,.42)", borderRadius: "16px", boxShadow: "0 18px 50px rgba(0,0,0,.32)", backdropFilter: "blur(10px)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", paddingBottom: "16px", borderBottom: "1px solid rgba(14,165,233,.25)", minWidth: 0 },
  eyebrow: { color: "#38bdf8", fontSize: "13px", fontWeight: 800, marginBottom: "4px" },
  title: { margin: 0, color: "#f8fbff", fontSize: "25px", lineHeight: 1.35, fontWeight: 900 },
  subtitle: { margin: "5px 0 0", color: "#a9c4dc", fontSize: "13px", fontWeight: 700, lineHeight: 1.7 },
  actions: { display: "flex", alignItems: "stretch", gap: "8px", flexWrap: "wrap", maxWidth: "100%" },
  secondaryButton: { border: "1px solid #334155", background: "#0f1f36", color: "#eaf4ff", borderRadius: "9px", padding: "9px 13px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: 800 },
  saveButton: { border: "1px solid #0ea5e9", background: "linear-gradient(135deg,#0ea5e9,#2563eb)", color: "#fff", borderRadius: "9px", padding: "10px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: 900 },
  jobPanel: { marginTop: "16px", display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: "#0b1830", border: "1px solid #263b56", borderRadius: "12px", flexWrap: "wrap" },
  jobIcon: { width: "40px", height: "40px", display: "grid", placeItems: "center", background: "#10294b", border: "1px solid #28537b", borderRadius: "9px", fontSize: "20px" },
  jobText: { flex: "1 1 180px", minWidth: 0 },
  label: { color: "#f2f7fb", fontSize: "15px", fontWeight: 900 },
  jobHint: { marginTop: "2px", color: "#8ea9c1", fontSize: "11px", fontWeight: 700 },
  select: { minWidth: 0, width: "100%", maxWidth: "100%", flex: "1 1 100%", boxSizing: "border-box", border: "1px solid #3b82f6", borderRadius: "9px", padding: "10px 12px", background: "#0b1d38", color: "#fff", fontFamily: "inherit", fontSize: "14px", fontWeight: 800, outline: "none" },
  message: { marginTop: "14px", padding: "10px 14px", border: "1px solid", borderRadius: "9px", fontSize: "13px", fontWeight: 800, lineHeight: 1.6 },
  groups: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: "12px", marginTop: "16px", alignItems: "start", width: "100%", minWidth: 0, boxSizing: "border-box" },
  group: { minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box", margin: 0, padding: "8px 10px 11px", border: "2px solid #2563eb", borderRadius: "11px", background: "#0a1730", boxShadow: "0 8px 24px rgba(0,0,0,.18)", overflowWrap: "anywhere" },
  groupVariants: [
    { borderColor: "#3b82f6" },
    { borderColor: "#22c55e" },
    { borderColor: "#a855f7" },
    { borderColor: "#f97316" },
    { borderColor: "#ef4444" },
    { borderColor: "#06b6d4" },
    { borderColor: "#ec4899" },
    { borderColor: "#2563eb" },
    { borderColor: "#16a34a" },
    { borderColor: "#eab308" },
    { borderColor: "#c026d3" },
    { borderColor: "#64748b" },
    { borderColor: "#dc2626" },
    { borderColor: "#0891b2" },
  ],
  groupLegend: { padding: "0 6px", marginInlineStart: "4px", color: "#f8fbff", fontSize: "14px", fontWeight: 900, whiteSpace: "normal", maxWidth: "100%", overflowWrap: "anywhere" },
  groupTitle: { color: "#f8fbff", fontSize: "14px", fontWeight: 900, lineHeight: 1.4, whiteSpace: "normal", overflowWrap: "anywhere" },
  groupCount: { marginInlineStart: "8px", color: "#8fa9c0", fontSize: "10px", fontWeight: 700 },
  permissionGrid: { display: "grid", gridTemplateColumns: "1fr", gap: "5px", marginTop: "3px" },
  permission: { minHeight: "36px", display: "flex", alignItems: "center", gap: "8px", padding: "6px 7px", borderRadius: "7px", border: "1px solid #263b56", background: "#0e203b", cursor: "pointer", boxSizing: "border-box" },
  permissionChecked: { borderColor: "#2563eb", background: "#102e55" },
  checkbox: { width: "18px", height: "18px", accentColor: "#2563eb", cursor: "pointer", flexShrink: 0 },
  permissionLabel: { flex: 1, color: "#e7f0f8", fontSize: "12px", fontWeight: 700, lineHeight: 1.45 },
};

