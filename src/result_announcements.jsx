import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const emptyForm = {
  title: "",
  description: "",
  academic_year: new Date().getFullYear(),
  exam_id: "",
  result_date: "",
  result_time: "",
  status: "scheduled",
  is_active: true,
};

export default function ResultAnnouncementManager() {
  const [announcements, setAnnouncements] = useState([]);
  const [exams, setExams] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const showMessage = (msg) => {
    setMessage(msg);
    window.setTimeout(() => setMessage(""), 2500);
  };

  const loadData = async () => {
    setLoading(true);

    const [{ data: announcementRows, error: announcementError }, { data: examRows, error: examError }] =
      await Promise.all([
        supabase
          .from("result_announcements")
          .select("*")
          .order("academic_year", { ascending: false })
          .order("result_date", { ascending: true })
          .order("result_time", { ascending: true }),

        supabase
          .from("exams")
          .select("*")
          .order("id", { ascending: false }),
      ]);

    if (announcementError) {
      showMessage(`خطأ: ${announcementError.message}`);
    } else {
      setAnnouncements(announcementRows || []);
    }

    if (!examError) {
      setExams(examRows || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const examName = (examId) => {
    if (!examId) return "إعلان عام";
    const exam = exams.find((e) => Number(e.id) === Number(examId));
    return exam?.exam_name || exam?.title || `امتحان رقم ${examId}`;
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      title: row.title || "",
      description: row.description || "",
      academic_year: row.academic_year || new Date().getFullYear(),
      exam_id: row.exam_id || "",
      result_date: row.result_date || "",
      result_time: row.result_time ? String(row.result_time).slice(0, 5) : "",
      status: row.status || "scheduled",
      is_active: row.is_active !== false,
    });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();

    if (!form.title.trim() || !form.result_date || !form.result_time) {
      showMessage("أكمل عنوان الإعلان والتاريخ والوقت.");
      return;
    }

    setSaving(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      academic_year: Number(form.academic_year),
      exam_id: form.exam_id ? Number(form.exam_id) : null,
      result_date: form.result_date,
      result_time: form.result_time,
      status: form.status,
      is_active: form.is_active,
      published_at: form.status === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const query = editingId
      ? supabase.from("result_announcements").update(payload).eq("id", editingId)
      : supabase.from("result_announcements").insert(payload);

    const { error } = await query;

    setSaving(false);

    if (error) {
      showMessage(`خطأ: ${error.message}`);
      return;
    }

    showMessage(editingId ? "تم تعديل موعد النتائج ✅" : "تم إنشاء إعلان النتائج ✅");
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    loadData();
  };

  const toggleActive = async (row) => {
    const { error } = await supabase
      .from("result_announcements")
      .update({
        is_active: !row.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) {
      showMessage(`خطأ: ${error.message}`);
      return;
    }

    showMessage(row.is_active ? "تم تعطيل الإعلان" : "تم تفعيل الإعلان");
    loadData();
  };

  const publishNow = async (row) => {
    const { error } = await supabase
      .from("result_announcements")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) {
      showMessage(`خطأ: ${error.message}`);
      return;
    }

    showMessage("تم إعلان النتائج الآن ✅");
    loadData();
  };

  const deleteRow = async (row) => {
    if (!window.confirm(`حذف إعلان "${row.title}"؟`)) return;

    const { error } = await supabase
      .from("result_announcements")
      .delete()
      .eq("id", row.id);

    if (error) {
      showMessage(`خطأ: ${error.message}`);
      return;
    }

    showMessage("تم حذف الإعلان");
    loadData();
  };

  const sorted = useMemo(
    () =>
      [...announcements].sort((a, b) => {
        const da = `${a.result_date || ""} ${a.result_time || ""}`;
        const db = `${b.result_date || ""} ${b.result_time || ""}`;
        return da.localeCompare(db);
      }),
    [announcements]
  );

  return (
    <div dir="rtl" style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>📅 إدارة النتائج</div>
          <h1 style={styles.title}>جدولة إعلان النتائج</h1>
          <p style={styles.subtitle}>
            تحديد موعد نشر نتائج الثانوية العامة أو أي نتائج أخرى.
          </p>
        </div>

        <button type="button" onClick={openAdd} style={styles.addButton}>
          ＋ إضافة موعد نتائج
        </button>
      </div>

      {message && <div style={styles.message}>{message}</div>}

      {showForm && (
        <form onSubmit={save} style={styles.form}>
          <h2 style={styles.formTitle}>
            {editingId ? "✏️ تعديل موعد النتائج" : "➕ إضافة موعد نتائج"}
          </h2>

          <div style={styles.grid}>
            <Field label="عنوان الإعلان">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="مثال: إعلان نتائج الثانوية العامة 2026"
                style={styles.input}
              />
            </Field>

            <Field label="السنة الدراسية">
              <input
                type="number"
                value={form.academic_year}
                onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                style={styles.input}
              />
            </Field>

            <Field label="الامتحان — اختياري">
              <select
                value={form.exam_id}
                onChange={(e) => setForm({ ...form, exam_id: e.target.value })}
                style={styles.input}
              >
                <option value="">إعلان عام — بدون امتحان محدد</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.exam_name || exam.title || `امتحان ${exam.id}`}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="تاريخ إعلان النتائج">
              <input
                type="date"
                value={form.result_date}
                onChange={(e) => setForm({ ...form, result_date: e.target.value })}
                style={styles.input}
              />
            </Field>

            <Field label="وقت إعلان النتائج">
              <input
                type="time"
                value={form.result_time}
                onChange={(e) => setForm({ ...form, result_time: e.target.value })}
                style={styles.input}
              />
            </Field>

            <Field label="حالة الإعلان">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                style={styles.input}
              >
                <option value="scheduled">مجدول</option>
                <option value="published">تم الإعلان</option>
                <option value="cancelled">ملغى</option>
              </select>
            </Field>
          </div>

          <Field label="وصف الإعلان">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="مثال: سيتم نشر النتائج الساعة 10:00 صباحًا."
              style={{ ...styles.input, minHeight: 80, resize: "vertical" }}
            />
          </Field>

          <div style={styles.actions}>
            <button type="submit" disabled={saving} style={styles.saveButton}>
              {saving ? "جاري الحفظ..." : "💾 حفظ"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={styles.cancelButton}
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>📋 مواعيد إعلان النتائج</h2>
          <span style={styles.count}>{announcements.length}</span>
        </div>

        {loading ? (
          <div style={styles.empty}>جاري التحميل...</div>
        ) : sorted.length === 0 ? (
          <div style={styles.empty}>لا توجد مواعيد نتائج حتى الآن.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>الإعلان</th>
                  <th style={styles.th}>السنة</th>
                  <th style={styles.th}>النطاق</th>
                  <th style={styles.th}>التاريخ</th>
                  <th style={styles.th}>الوقت</th>
                  <th style={styles.th}>الحالة</th>
                  <th style={styles.th}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, index) => (
                  <tr key={row.id}>
                    <td style={styles.td}>{index + 1}</td>
                    <td style={styles.td}>
                      <div style={styles.name}>{row.title}</div>
                      {row.description && <div style={styles.desc}>{row.description}</div>}
                    </td>
                    <td style={styles.td}>{row.academic_year}</td>
                    <td style={styles.td}>{examName(row.exam_id)}</td>
                    <td style={styles.td}>{row.result_date}</td>
                    <td style={styles.td}>{String(row.result_time || "").slice(0, 5)}</td>
                    <td style={styles.td}>
                      <span style={styles.status(row.status)}>
                        {row.status === "published"
                          ? "تم الإعلان"
                          : row.status === "cancelled"
                          ? "ملغى"
                          : "مجدول"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.rowActions}>
                        <button onClick={() => openEdit(row)} style={styles.editButton}>✏️</button>
                        {row.status !== "published" && (
                          <button onClick={() => publishNow(row)} style={styles.publishButton}>
                            📢 إعلان
                          </button>
                        )}
                        <button onClick={() => toggleActive(row)} style={styles.toggleButton}>
                          {row.is_active ? "تعطيل" : "تفعيل"}
                        </button>
                        <button onClick={() => deleteRow(row)} style={styles.deleteButton}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100%",
    padding: 24,
    color: "#eaf7ff",
    fontFamily: "Noto Kufi Arabic, sans-serif",
    background: "linear-gradient(135deg,#06152f,#0a2d61,#073a75)",
    borderRadius: 18,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
    borderBottom: "2px solid rgba(56,189,248,.55)",
    paddingBottom: 16,
  },
  kicker: { color: "#67e8f9", fontWeight: 900, fontSize: 14 },
  title: { margin: "5px 0", fontSize: 27, color: "#fff", fontWeight: 900 },
  subtitle: { margin: 0, color: "#a8d9f5", fontSize: 13, fontWeight: 700 },
  addButton: {
    border: "1px solid #67e8f9",
    borderRadius: 11,
    padding: "11px 16px",
    background: "linear-gradient(135deg,#0891b2,#2563eb)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  message: {
    marginTop: 12,
    padding: 11,
    borderRadius: 10,
    background: "rgba(14,165,233,.18)",
    border: "1px solid rgba(56,189,248,.45)",
    color: "#dff9ff",
    textAlign: "center",
    fontWeight: 900,
  },
  form: {
    marginTop: 16,
    padding: 18,
    borderRadius: 15,
    background: "rgba(4,20,49,.78)",
    border: "1px solid rgba(56,189,248,.42)",
  },
  formTitle: { margin: "0 0 15px", color: "#7dd3fc", fontSize: 19 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,minmax(0,1fr))",
    gap: 13,
  },
  field: { display: "grid", gap: 6, marginBottom: 13 },
  label: { color: "#bdeeff", fontSize: 12, fontWeight: 900 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 9,
    border: "1px solid rgba(96,165,250,.55)",
    background: "#102c57",
    color: "#fff",
    padding: "10px 11px",
    outline: "none",
    fontFamily: "inherit",
    fontWeight: 700,
  },
  actions: { display: "flex", gap: 9, marginTop: 5 },
  saveButton: {
    border: 0, borderRadius: 9, padding: "10px 17px",
    background: "#0891b2", color: "#fff", fontWeight: 900, cursor: "pointer",
  },
  cancelButton: {
    border: "1px solid #64748b", borderRadius: 9, padding: "10px 17px",
    background: "rgba(71,85,105,.35)", color: "#fff", fontWeight: 900, cursor: "pointer",
  },
  card: {
    marginTop: 18,
    padding: 16,
    borderRadius: 15,
    background: "rgba(4,20,49,.72)",
    border: "1px solid rgba(56,189,248,.35)",
  },
  cardHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 13 },
  cardTitle: { margin: 0, color: "#fff", fontSize: 18 },
  count: {
    minWidth: 27, height: 27, borderRadius: "50%", display: "flex",
    alignItems: "center", justifyContent: "center",
    background: "#1d4ed8", color: "#fff", fontWeight: 900,
  },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 900 },
  th: {
    padding: "11px 8px", background: "#123b78", color: "#aeeaff",
    fontWeight: 900, fontSize: 12, borderBottom: "1px solid #4dbfff",
  },
  td: {
    padding: "11px 8px", textAlign: "center",
    borderBottom: "1px solid rgba(96,165,250,.16)",
    color: "#eaf7ff", fontSize: 13, fontWeight: 700,
  },
  name: { color: "#7dd3fc", fontWeight: 900 },
  desc: { color: "#8fb9d2", fontSize: 11, marginTop: 3 },
  status: (status) => ({
    display: "inline-block",
    padding: "5px 9px",
    borderRadius: 999,
    background: status === "published" ? "rgba(16,185,129,.2)" : status === "cancelled" ? "rgba(239,68,68,.2)" : "rgba(59,130,246,.2)",
    border: `1px solid ${status === "published" ? "rgba(52,211,153,.55)" : status === "cancelled" ? "rgba(248,113,113,.55)" : "rgba(96,165,250,.55)"}`,
    color: "#fff",
    fontSize: 11,
    fontWeight: 900,
  }),
  rowActions: { display: "flex", justifyContent: "center", gap: 5, flexWrap: "wrap" },
  editButton: {
    border: "1px solid #38bdf8", background: "rgba(14,116,144,.3)",
    color: "#fff", borderRadius: 7, padding: "6px 8px", cursor: "pointer",
  },
  publishButton: {
    border: "1px solid #34d399", background: "rgba(16,185,129,.25)",
    color: "#fff", borderRadius: 7, padding: "6px 8px", cursor: "pointer", fontWeight: 900,
  },
  toggleButton: {
    border: "1px solid #60a5fa", background: "rgba(37,99,235,.25)",
    color: "#fff", borderRadius: 7, padding: "6px 8px", cursor: "pointer", fontWeight: 900,
  },
  deleteButton: {
    border: "1px solid #fb7185", background: "rgba(239,68,68,.22)",
    color: "#fff", borderRadius: 7, padding: "6px 8px", cursor: "pointer",
  },
  empty: { textAlign: "center", padding: 30, color: "#9cc6de", fontWeight: 800 },
};
