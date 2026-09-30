import React, { useEffect, useMemo, useState } from "react";

export default function DirectorateSchoolManager({ supabase, showAlertMessage }) {
  const [directorates, setDirectorates] = useState([]);
  const [schools, setSchools] = useState([]);
  const [branches, setBranches] = useState([]);

  const [selectedDirectorateId, setSelectedDirectorateId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [directorateForm, setDirectorateForm] = useState({
    id: null,
    directorate_name: "",
    directorate_code: "",
    is_active: true,
  });

  const [schoolForm, setSchoolForm] = useState({
    id: null,
    school_name: "",
    school_code: "",
    directorate_id: "",
    address: "",
    phone: "",
    is_active: true,
  });

  const [editingDirectorate, setEditingDirectorate] = useState(false);
  const [showDirectorateForm, setShowDirectorateForm] = useState(false);
  const [editingSchool, setEditingSchool] = useState(false);

  const flash = (text) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2000);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [d, s, b] = await Promise.all([
        supabase.from("directorates").select("*").order("directorate_name", { ascending: true }),
        supabase.from("schools").select("*").order("school_name", { ascending: true }),
        supabase.from("branches").select("*").order("id", { ascending: true }),
      ]);

      if (d.error) throw d.error;
      if (s.error) throw s.error;

      setDirectorates(d.data || []);
      setSchools(s.data || []);
      setBranches(b.error ? [] : (b.data || []));

      if (!selectedDirectorateId && d.data?.length) {
        setSelectedDirectorateId(String(d.data[0].id));
      }
    } catch (error) {
      console.error(error);
      flash("تعذر تحميل المديريات والمدارس");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (supabase) loadAll();
  }, [supabase]);

  const selectedDirectorate = useMemo(
    () => directorates.find((d) => String(d.id) === String(selectedDirectorateId)),
    [directorates, selectedDirectorateId]
  );

  const visibleSchools = useMemo(() => {
    if (!selectedDirectorateId) return schools;
    return schools.filter(
      (school) => String(school.directorate_id) === String(selectedDirectorateId)
    );
  }, [schools, selectedDirectorateId]);

  const sortArabic = (a, b, field) =>
    String(a?.[field] ?? "").localeCompare(String(b?.[field] ?? ""), "ar", {
      sensitivity: "base",
      numeric: true,
    });

  const sortedDirectorates = useMemo(
    () => [...directorates].sort((a, b) => sortArabic(a, b, "directorate_name")),
    [directorates]
  );

  const sortedSchools = useMemo(
    () => [...schools].sort((a, b) => sortArabic(a, b, "school_name")),
    [schools]
  );

  const lowerDirectorates = useMemo(() => {
    if (selectedDirectorateId) {
      const one = directorates.find(
        (d) => String(d.id) === String(selectedDirectorateId)
      );
      return one ? [one] : [];
    }
    return sortedDirectorates;
  }, [directorates, selectedDirectorateId, sortedDirectorates]);

  const lowerSchoolsByDirectorate = useMemo(() => {
    const map = {};
    lowerDirectorates.forEach((d) => {
      map[String(d.id)] = sortedSchools.filter(
        (s) => String(s.directorate_id) === String(d.id)
      );
    });
    return map;
  }, [lowerDirectorates, sortedSchools]);

  const branchesByDirectorate = useMemo(() => {
    const map = {};
    branches.forEach((branch) => {
      const id = String(branch.directorate_id ?? "");
      if (!id) return;
      if (!map[id]) map[id] = [];
      map[id].push(branch);
    });
    return map;
  }, [branches]);

  const directorateNumber = (id) =>
    directorates.findIndex((row) => String(row.id) === String(id)) + 1;

  const schoolNumber = (id) =>
    visibleSchools.findIndex((row) => String(row.id) === String(id)) + 1;

  const resetDirectorate = () => {
    setDirectorateForm({
      id: null,
      directorate_name: "",
      directorate_code: "",
      is_active: true,
    });
    setEditingDirectorate(false);
    setShowDirectorateForm(false);
  };

  const startAddDirectorate = () => {
    setDirectorateForm({
      id: null,
      directorate_name: "",
      directorate_code: "",
      is_active: true,
    });
    setEditingDirectorate(false);
    setShowDirectorateForm(true);
  };

  const resetSchool = () => {
    setSchoolForm({
      id: null,
      school_name: "",
      school_code: "",
      directorate_id: selectedDirectorateId || "",
      address: "",
      phone: "",
      is_active: true,
    });
    setEditingSchool(false);
  };

  const saveDirectorate = async () => {
    if (!directorateForm.directorate_name.trim()) {
      flash("اكتب اسم المديرية أولًا");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        directorate_name: directorateForm.directorate_name.trim(),
        directorate_code: directorateForm.directorate_code.trim() || null,
        is_active: directorateForm.is_active,
      };

      let result;
      if (directorateForm.id) {
        result = await supabase
          .from("directorates")
          .update(payload)
          .eq("id", directorateForm.id);
      } else {
        result = await supabase.from("directorates").insert(payload);
      }

      if (result.error) throw result.error;

      flash(directorateForm.id ? "تم تعديل المديرية بنجاح ✅" : "تمت إضافة المديرية بنجاح ✅");
      resetDirectorate();
      await loadAll();
    } catch (error) {
      console.error(error);
      flash("تعذر حفظ المديرية: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteDirectorate = async (id) => {
    if (!window.confirm("هل تريد حذف المديرية؟ إذا كانت مرتبطة بمدارس أو فروع سيمنع النظام الحذف.")) return;

    try {
      const result = await supabase.from("directorates").delete().eq("id", id);
      if (result.error) throw result.error;
      flash("تم حذف المديرية بنجاح");
      if (String(selectedDirectorateId) === String(id)) setSelectedDirectorateId("");
      await loadAll();
    } catch (error) {
      flash("تعذر حذف المديرية: " + error.message);
    }
  };

  const saveSchool = async () => {
    if (!schoolForm.school_name.trim()) {
      flash("اكتب اسم المدرسة أولًا");
      return;
    }
    if (!schoolForm.directorate_id) {
      flash("اختر المديرية أولًا");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        school_name: schoolForm.school_name.trim(),
        school_code: schoolForm.school_code.trim() || null,
        directorate_id: Number(schoolForm.directorate_id),
        address: schoolForm.address.trim() || null,
        phone: schoolForm.phone.trim() || null,
        is_active: schoolForm.is_active,
      };

      let result;
      if (schoolForm.id) {
        result = await supabase.from("schools").update(payload).eq("id", schoolForm.id);
      } else {
        result = await supabase.from("schools").insert(payload);
      }

      if (result.error) throw result.error;

      flash(schoolForm.id ? "تم تعديل المدرسة بنجاح ✅" : "تمت إضافة المدرسة بنجاح ✅");
      resetSchool();
      await loadAll();
    } catch (error) {
      console.error(error);
      flash("تعذر حفظ المدرسة: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSchool = async (id) => {
    if (!window.confirm("هل تريد حذف المدرسة؟ إذا كانت مرتبطة بطلاب سيمنع النظام الحذف.")) return;

    try {
      const result = await supabase.from("schools").delete().eq("id", id);
      if (result.error) throw result.error;
      flash("تم حذف المدرسة بنجاح");
      await loadAll();
    } catch (error) {
      flash("تعذر حذف المدرسة: " + error.message);
    }
  };

  const toggleDirectorate = async (row) => {
    const { error } = await supabase
      .from("directorates")
      .update({ is_active: row.is_active === false })
      .eq("id", row.id);
    if (error) return flash("تعذر تغيير حالة المديرية");
    await loadAll();
  };

  const toggleSchool = async (row) => {
    const { error } = await supabase
      .from("schools")
      .update({ is_active: row.is_active === false })
      .eq("id", row.id);
    if (error) return flash("تعذر تغيير حالة المدرسة");
    await loadAll();
  };

  const editDirectorate = (row) => {
    setDirectorateForm({
      id: row.id,
      directorate_name: row.directorate_name || "",
      directorate_code: row.directorate_code || "",
      is_active: row.is_active !== false,
    });
    setEditingDirectorate(true);
    setShowDirectorateForm(true);
  };

  const editSchool = (row) => {
    setSchoolForm({
      id: row.id,
      school_name: row.school_name || "",
      school_code: row.school_code || "",
      directorate_id: row.directorate_id ? String(row.directorate_id) : "",
      address: row.address || "",
      phone: row.phone || "",
      is_active: row.is_active !== false,
    });
    setEditingSchool(true);
  };

  const input = (value, onChange, placeholder) => (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={styles.input}
    />
  );

  if (loading) {
    return (
      <div dir="rtl" style={styles.page}>
        <div style={styles.loading}>جاري تحميل المديريات والمدارس...</div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>🏫 الهيكل الإداري والتعليمي</div>
            <h1 style={styles.title}>إدارة المديريات والمدارس</h1>
            <p style={styles.subtitle}>إضافة وتعديل وتعطيل المديريات والمدارس وتنظيم ارتباطها — مع ترقيم تسلسلي وشريط رأسي للتنظيم.</p>
          </div>
          <div style={styles.stats}>
            <span>المديريات: <b>{directorates.length}</b></span>
            <span>المدارس: <b>{schools.length}</b></span>
          </div>
        </div>

        {message && <div style={styles.message}>{message}</div>}

        <div style={styles.grid}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>🏢 المديريات</h2>
                <div style={styles.smallText}>إدارة مديريات التعليم</div>
              </div>
              {showDirectorateForm ? (
                <button type="button" onClick={resetDirectorate} style={styles.cancelButton}>إلغاء</button>
              ) : (
                <button type="button" onClick={startAddDirectorate} style={styles.addButton}>＋ إضافة مديرية</button>
              )}
            </div>

            {showDirectorateForm && (
              <div style={styles.formBox}>
                {input(directorateForm.directorate_name, (v) => setDirectorateForm({ ...directorateForm, directorate_name: v }), "اسم المديرية")}
                {input(directorateForm.directorate_code, (v) => setDirectorateForm({ ...directorateForm, directorate_code: v }), "رمز المديرية (اختياري)")}
                <button disabled={saving} onClick={saveDirectorate} style={styles.saveButton}>
                  {saving ? "جاري الحفظ..." : editingDirectorate ? "حفظ التعديل" : "حفظ المديرية"}
                </button>
              </div>
            )}

            <div style={styles.list}>
              <div style={styles.numberedList}>
                <div style={styles.verticalRail} aria-hidden="true" />
                {sortedDirectorates.map((row) => (
                  <div
                    key={row.id}
                    onClick={() => setSelectedDirectorateId(String(row.id))}
                    style={{
                      ...styles.row,
                      ...(String(selectedDirectorateId) === String(row.id) ? styles.selectedRow : {}),
                    }}
                  >
                    <div style={styles.numberBadge}>{directorateNumber(row.id)}</div>
                    <div style={styles.rowMain}>
                      <div style={styles.rowTitle}>{row.directorate_name}</div>
                      <div style={styles.rowMeta}>
                        {row.directorate_code || "بدون رمز"} •{" "}
                        {(schools.filter((s) => String(s.directorate_id) === String(row.id))).length} مدرسة
                      </div>
                    </div>
                    <div style={styles.rowActions} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => editDirectorate(row)} style={styles.editButton}>✏️</button>
                      <button onClick={() => toggleDirectorate(row)} style={styles.statusButton}>
                        {row.is_active === false ? "تفعيل" : "تعطيل"}
                      </button>
                      <button onClick={() => deleteDirectorate(row.id)} style={styles.deleteButton}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
              {!directorates.length && <div style={styles.empty}>لا توجد مديريات حتى الآن.</div>}
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>🏫 المدارس</h2>
                <div style={styles.smallText}>
                  {selectedDirectorate ? `مدارس: ${selectedDirectorate.directorate_name}` : "اختر مديرية لعرض مدارسها"}
                </div>
              </div>
              <button
                onClick={() => {
                  setSchoolForm({
                    ...schoolForm,
                    id: null,
                    directorate_id: selectedDirectorateId || "",
                    school_name: "",
                    school_code: "",
                    address: "",
                    phone: "",
                    is_active: true,
                  });
                  setEditingSchool(true);
                }}
                style={styles.addButton}
              >
                ＋ إضافة مدرسة
              </button>
            </div>

            {editingSchool && (
              <div style={styles.formBox}>
                {input(schoolForm.school_name, (v) => setSchoolForm({ ...schoolForm, school_name: v }), "اسم المدرسة")}
                {input(schoolForm.school_code, (v) => setSchoolForm({ ...schoolForm, school_code: v }), "رمز المدرسة (اختياري)")}
                <select
                  value={schoolForm.directorate_id}
                  onChange={(e) => setSchoolForm({ ...schoolForm, directorate_id: e.target.value })}
                  style={styles.select}
                >
                  <option value="">اختر المديرية</option>
                  {directorates.map((d) => (
                    <option key={d.id} value={d.id}>{d.directorate_name}</option>
                  ))}
                </select>
                {input(schoolForm.address, (v) => setSchoolForm({ ...schoolForm, address: v }), "العنوان (اختياري)")}
                {input(schoolForm.phone, (v) => setSchoolForm({ ...schoolForm, phone: v }), "الهاتف (اختياري)")}
                <div style={styles.formActions}>
                  <button disabled={saving} onClick={saveSchool} style={styles.saveButton}>
                    {saving ? "جاري الحفظ..." : "حفظ المدرسة"}
                  </button>
                  <button onClick={resetSchool} style={styles.cancelButton}>إلغاء</button>
                </div>
              </div>
            )}

            <div style={styles.list}>
              <div style={styles.numberedList}>
                <div style={styles.verticalRail} aria-hidden="true" />
                {[...visibleSchools].sort((a, b) => sortArabic(a, b, 'school_name')).map((row) => (
                  <div key={row.id} style={styles.row}>
                    <div style={styles.numberBadge}>{schoolNumber(row.id)}</div>
                    <div style={styles.rowMain}>
                      <div style={styles.rowTitle}>{row.school_name}</div>
                      <div style={styles.rowMeta}>
                        {row.school_code || "بدون رمز"}{row.address ? ` • ${row.address}` : ""}
                      </div>
                    </div>
                    <div style={styles.rowActions}>
                      <button onClick={() => editSchool(row)} style={styles.editButton}>✏️</button>
                      <button onClick={() => toggleSchool(row)} style={styles.statusButton}>
                        {row.is_active === false ? "تفعيل" : "تعطيل"}
                      </button>
                      <button onClick={() => deleteSchool(row.id)} style={styles.deleteButton}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
              {!visibleSchools.length && <div style={styles.empty}>لا توجد مدارس مرتبطة بهذه المديرية.</div>}
            </div>
          </section>
        </div>

        <section style={styles.bottomPanel}>
          <div style={styles.bottomHeader}>
            <div>
              <div style={styles.eyebrow}>📋 القائمة الشاملة</div>
              <h2 style={styles.bottomTitle}>جميع المديريات والمدارس</h2>
              <div style={styles.smallText}>
                الترتيب أبجدي، ويمكن عرض مديرية واحدة أو جميع المديريات مع مدارسها.
              </div>
            </div>
            <div style={styles.filterBox}>
              <label style={styles.filterLabel}>عرض حسب المديرية</label>
              <select
                value={selectedDirectorateId}
                onChange={(e) => setSelectedDirectorateId(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">جميع المديريات</option>
                {sortedDirectorates.map((d) => (
                  <option key={d.id} value={d.id}>{d.directorate_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.summaryBar}>
            <span>المديريات: <b>{lowerDirectorates.length}</b></span>
            <span>المدارس: <b>{lowerDirectorates.reduce((n,d) => n + (lowerSchoolsByDirectorate[String(d.id)] || []).length, 0)}</b></span>
            <button type="button" onClick={() => setSelectedDirectorateId("")} style={styles.showAllButton}>
              🔄 جميع المديريات
            </button>
          </div>

          <div style={styles.hierarchyList}>
            {lowerDirectorates.map((d, di) => {
              const ds = lowerSchoolsByDirectorate[String(d.id)] || [];
              return (
                <div key={d.id} style={styles.hierarchyCard}>
                  <div style={styles.hierarchyDirectorate}>
                    <div style={styles.hierarchyNumber}>{di + 1}</div>
                    <div style={styles.hierarchyTitleBox}>
                      <div style={styles.hierarchyTitle}>{d.directorate_name}</div>
                      <div style={styles.rowMeta}>{d.directorate_code || "بدون رمز"} • {ds.length} مدرسة</div>
                    </div>
                    <button type="button" onClick={() => setSelectedDirectorateId(String(d.id))} style={styles.viewButton}>
                      👁 عرض المديرية
                    </button>
                  </div>
                  <div style={styles.schoolHierarchy}>
                    {ds.length ? ds.map((s, si) => (
                      <div key={s.id} style={styles.schoolHierarchyRow}>
                        <div style={styles.schoolNumber}>{si + 1}</div>
                        <div style={styles.schoolHierarchyMain}>
                          <div style={styles.schoolHierarchyTitle}>{s.school_name}</div>
                          <div style={styles.rowMeta}>
                            {s.school_code || "بدون رمز"}{s.address ? ` • ${s.address}` : ""}
                          </div>
                        </div>
                        <div style={styles.schoolStatus}>{s.is_active === false ? "معطلة" : "فعالة"}</div>
                      </div>
                    )) : <div style={styles.emptySmall}>لا توجد مدارس مرتبطة بهذه المديرية.</div>}
                  </div>
                </div>
              );
            })}
            {!lowerDirectorates.length && <div style={styles.empty}>لا توجد مديريات حتى الآن.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100%",
    padding: "22px",
    boxSizing: "border-box",
    background: "linear-gradient(135deg,#07152f 0%,#0a1d43 48%,#102d63 100%)",
    fontFamily: 'Noto Kufi Arabic, sans-serif',
    color: "#eef9ff",
  },
  container: { maxWidth: 1250, margin: "0 auto" },
  loading: { padding: 60, textAlign: "center", color: "#67d5ff", fontSize: 20, fontWeight: 900 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap", marginBottom: 18 },
  eyebrow: { color: "#65d8ff", fontSize: 14, fontWeight: 900, marginBottom: 5 },
  title: { margin: 0, color: "#fff", fontSize: 29, fontWeight: 900 },
  subtitle: { margin: "7px 0 0", color: "#b9d8ef", fontSize: 14, fontWeight: 700 },
  stats: { display: "flex", gap: 10, flexWrap: "wrap" },
  statsSpan: {},
  stats: { display: "flex", gap: 10, flexWrap: "wrap", color: "#dff6ff", fontSize: 14, fontWeight: 800 },
  grid: { display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18 },
  panel: { background: "rgba(7,20,48,.82)", border: "1px solid rgba(82,185,255,.45)", borderRadius: 17, padding: 20, boxShadow: "0 15px 40px rgba(0,0,0,.28)" },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", paddingBottom: 14, borderBottom: "1px solid rgba(88,190,255,.25)" },
  panelTitle: { margin: 0, color: "#fff", fontSize: 21, fontWeight: 900 },
  smallText: { marginTop: 4, color: "#9fc7e3", fontSize: 12, fontWeight: 700 },
  addButton: { border: "1px solid #38bdf8", background: "linear-gradient(135deg,#1479e8,#0754c7)", color: "#fff", borderRadius: 10, padding: "10px 15px", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 900 },
  cancelButton: { border: "1px solid #64748b", background: "rgba(71,85,105,.35)", color: "#e2e8f0", borderRadius: 10, padding: "10px 15px", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 900 },
  formBox: { display: "grid", gap: 9, marginTop: 15, padding: 14, borderRadius: 12, background: "rgba(16,48,89,.75)", border: "1px solid rgba(91,175,228,.3)" },
  input: { width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 9, border: "1px solid #4dbfff", background: "#102d59", color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 800, outline: "none" },
  select: { width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 9, border: "1px solid #4dbfff", background: "#102d59", color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 800, outline: "none" },
  saveButton: { border: "1px solid #38bdf8", background: "#1479e8", color: "#fff", borderRadius: 9, padding: "11px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 900 },
  formActions: { display: "flex", gap: 8 },
  list: { display: "grid", gap: 9, marginTop: 15, maxHeight: 550, overflowY: "auto", paddingLeft: 2 },
  numberedList: { position: "relative", display: "grid", gap: 9, marginTop: 15, paddingRight: 8 },
  verticalRail: {
    position: "absolute",
    top: 13,
    bottom: 13,
    right: 18,
    width: 3,
    borderRadius: 999,
    background: "linear-gradient(180deg,#38bdf8,#1479e8,#38bdf8)",
    boxShadow: "0 0 10px rgba(56,189,248,.45)",
    opacity: 0.85,
    pointerEvents: "none",
  },
  numberBadge: {
    position: "relative",
    zIndex: 1,
    flex: "0 0 32px",
    width: 32,
    height: 32,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg,#0ea5e9,#1d4ed8)",
    border: "2px solid rgba(125,211,252,.9)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 900,
    boxShadow: "0 0 12px rgba(14,165,233,.35)",
  },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 13px", paddingRight: 48, borderRadius: 11, border: "1px solid rgba(91,175,228,.3)", background: "rgba(16,48,89,.72)", cursor: "pointer", position: "relative", minWidth: 0 },
  selectedRow: { borderColor: "#4dc5ff", background: "linear-gradient(135deg,rgba(18,104,192,.62),rgba(16,48,89,.88))", boxShadow: "inset 0 0 18px rgba(50,180,255,.08)" },
  rowMain: { minWidth: 0, flex: 1 },
  rowTitle: { color: "#fff", fontSize: 16, fontWeight: 900, lineHeight: 1.5 },
  rowMeta: { color: "#9fc7e3", fontSize: 12, fontWeight: 700, marginTop: 3 },
  rowActions: { display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" },
  editButton: { border: "1px solid #38bdf8", background: "rgba(14,116,144,.55)", color: "#fff", borderRadius: 8, padding: "7px 9px", cursor: "pointer" },
  statusButton: { border: "1px solid #fbbf24", background: "rgba(161,98,7,.45)", color: "#fff", borderRadius: 8, padding: "7px 9px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 900 },
  deleteButton: { border: "1px solid #fb7185", background: "rgba(159,18,53,.45)", color: "#fff", borderRadius: 8, padding: "7px 9px", cursor: "pointer" },
  empty: { padding: 35, textAlign: "center", color: "#9fc7e3", fontWeight: 800 },
  message: { marginBottom: 16, padding: "11px 15px", textAlign: "center", borderRadius: 10, background: "rgba(20,83,45,.78)", border: "1px solid #4ade80", color: "#dcfce7", fontSize: 14, fontWeight: 900 },

  bottomPanel: { marginTop: 20, background: "rgba(7,20,48,.84)", border: "1px solid rgba(82,185,255,.48)", borderRadius: 17, padding: 20, boxShadow: "0 15px 40px rgba(0,0,0,.28)" },
  bottomHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap", paddingBottom: 15, borderBottom: "1px solid rgba(88,190,255,.25)" },
  bottomTitle: { margin: "3px 0 0", color: "#fff", fontSize: 23, fontWeight: 900 },
  filterBox: { minWidth: 240, display: "grid", gap: 6 },
  filterLabel: { color: "#9fdcff", fontSize: 12, fontWeight: 900 },
  filterSelect: { minWidth: 240, padding: "11px 13px", borderRadius: 10, border: "1px solid #4dbfff", background: "#102d59", color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 900, outline: "none" },
  summaryBar: { display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginTop: 14, padding: "10px 13px", borderRadius: 10, background: "rgba(15,65,118,.48)", border: "1px solid rgba(91,175,228,.28)", color: "#dff6ff", fontSize: 13, fontWeight: 800 },
  showAllButton: { marginRight: "auto", border: "1px solid #38bdf8", background: "rgba(14,125,218,.5)", color: "#fff", borderRadius: 9, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 900 },
  hierarchyList: { display: "grid", gap: 12, marginTop: 15 },
  hierarchyCard: { border: "1px solid rgba(91,175,228,.34)", borderRadius: 13, background: "rgba(16,48,89,.62)", overflow: "hidden" },
  hierarchyDirectorate: { display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", background: "linear-gradient(90deg,rgba(19,99,183,.62),rgba(14,54,104,.68))", borderBottom: "1px solid rgba(91,175,228,.25)" },
  hierarchyNumber: { flex: "0 0 34px", width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0ea5e9,#1d4ed8)", border: "2px solid rgba(125,211,252,.9)", color: "#fff", fontSize: 15, fontWeight: 900 },
  hierarchyTitleBox: { minWidth: 0, flex: 1 },
  hierarchyTitle: { color: "#fff", fontSize: 18, fontWeight: 900 },
  viewButton: { border: "1px solid #4dbfff", background: "rgba(9,100,184,.55)", color: "#fff", borderRadius: 9, padding: "8px 11px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 900 },
  schoolHierarchy: { display: "grid", gap: 7, padding: "10px 14px 13px" },
  schoolHierarchyRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 9, background: "rgba(7,28,57,.58)", border: "1px solid rgba(91,175,228,.19)" },
  schoolNumber: { flex: "0 0 28px", width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(56,189,248,.14)", border: "1px solid rgba(56,189,248,.65)", color: "#8ee4ff", fontSize: 13, fontWeight: 900 },
  schoolHierarchyMain: { minWidth: 0, flex: 1 },
  schoolHierarchyTitle: { color: "#fff", fontSize: 15, fontWeight: 900 },
  schoolStatus: { flex: "0 0 auto", padding: "5px 9px", borderRadius: 999, background: "rgba(37,99,235,.25)", border: "1px solid rgba(96,165,250,.4)", color: "#bfeaff", fontSize: 11, fontWeight: 900 },
  emptySmall: { padding: "8px 4px", color: "#91b6cf", fontSize: 13, fontWeight: 800 },
};
