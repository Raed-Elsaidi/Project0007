import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { validatePasswordPolicy, PASSWORD_POLICY_MESSAGE } from "./passwordPolicy";

const NAME_COLUMN = "name";

export default function InstitutionManagement() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    name: "",
    institution_code: "",
    manager_full_name: "",
    manager_national_id: "",
    manager_phone: "",
    manager_whatsapp_number: "",
    manager_email: "",
    manager_address: "",
    manager_gender: "",
    manager_nationality: "فلسطيني",
    manager_birth_date: "",
    manager_birth_place: "",
    manager_specialization: "",
    manager_username: "",
    manager_password: ""
  });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("institutions")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      setError(error.message);
      setItems([]);
    } else {
      setItems(data || []);
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function reset() {
    setEditingId(null);
    setForm({
      name: "", institution_code: "", manager_full_name: "", manager_national_id: "",
      manager_phone: "", manager_whatsapp_number: "", manager_email: "", manager_address: "",
      manager_gender: "", manager_nationality: "فلسطيني", manager_birth_date: "",
      manager_birth_place: "", manager_specialization: "", manager_username: "", manager_password: ""
    });
  }

  function edit(row) {
    setEditingId(row.id);
    setForm({
      name: row[NAME_COLUMN] ?? row.name_line_1 ?? row.institution_name ?? "",
      institution_code: row.institution_code ?? "",
      manager_full_name: "",
      manager_national_id: "",
      manager_phone: "",
      manager_whatsapp_number: "",
      manager_email: "",
      manager_address: "",
      manager_gender: "",
      manager_nationality: "فلسطيني",
      manager_birth_date: "",
      manager_birth_place: "",
      manager_specialization: "",
      manager_username: "",
      manager_password: ""
    });
    setError("");
    setMessage("");
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    const name = form.name.trim();
    const code = form.institution_code.trim();

    if (!name) return setError("يرجى إدخال اسم المؤسسة.");
    if (!/^\d{2}$/.test(code))
      return setError("كود المؤسسة يجب أن يتكون من رقمين، مثل 01.");

    setSaving(true);

    // التأكد من أن كود المؤسسة غير مستخدم من مؤسسة أخرى.
    let duplicateQuery = supabase
      .from("institutions")
      .select("id")
      .eq("institution_code", code);

    if (editingId) {
      duplicateQuery = duplicateQuery.neq("id", editingId);
    }

    const { data: duplicateRows, error: duplicateError } = await duplicateQuery.limit(1);

    if (duplicateError) {
      setError("تعذر التحقق من كود المؤسسة: " + duplicateError.message);
      setSaving(false);
      return;
    }

    if (duplicateRows && duplicateRows.length > 0) {
      setError(`كود المؤسسة ${code} مستخدم مسبقًا. اختر كودًا آخر.`);
      setSaving(false);
      return;
    }

    const values = {
      [NAME_COLUMN]: name,
      institution_code: code
    };

    // عند إضافة مؤسسة جديدة، ينشئ المبرمج معها حساب مدير المؤسسة.
    // كلمة المرور تُرسل إلى جدول employees، حيث يقوم Trigger bcrypt الموجود
    // في قاعدة البيانات بتخزينها بشكل آمن، ولا تُحفظ كنص صريح من الواجهة.
    if (!editingId) {
      const managerUsername = form.manager_username.trim();
      const managerPassword = form.manager_password.trim();
      const managerFullName = form.manager_full_name.trim();
      const managerNationalId = form.manager_national_id.trim();

      if (managerNationalId && !/^\d{9}$/.test(managerNationalId)) {
        setError("رقم هوية مدير المؤسسة يجب أن يتكون من 9 أرقام فقط.");
        setSaving(false);
        return;
      }

      if (!managerFullName || managerFullName === `مدير ${name}`) {
        setError("الاسم الرباعي لمدير المؤسسة مطلوب.");
        setSaving(false);
        return;
      }

      if (!managerNationalId) {
        setError("رقم هوية مدير المؤسسة مطلوب.");
        setSaving(false);
        return;
      }

      if (!managerUsername) {
        setError("اسم مستخدم مدير المؤسسة مطلوب عند إضافة مؤسسة جديدة.");
        setSaving(false);
        return;
      }

      if (!managerPassword) {
        setError("كلمة مرور مدير المؤسسة مطلوبة عند إضافة مؤسسة جديدة.");
        setSaving(false);
        return;
      }

      const policy = validatePasswordPolicy(managerPassword);
      if (!policy.valid) {
        setError(PASSWORD_POLICY_MESSAGE);
        setSaving(false);
        return;
      }

      const { data: duplicateUser, error: duplicateUserError } = await supabase
        .from("employees")
        .select("id")
        .eq("username", managerUsername)
        .maybeSingle();

      if (duplicateUserError) {
        setError("تعذر التحقق من اسم مستخدم مدير المؤسسة: " + duplicateUserError.message);
        setSaving(false);
        return;
      }

      if (duplicateUser) {
        setError("اسم المستخدم مستخدم مسبقًا. اختر اسم مستخدم آخر.");
        setSaving(false);
        return;
      }

      const { data: existingManagerJob, error: managerJobLookupError } = await supabase
        .from("jobs")
        .select("id, job_name, is_active")
        .eq("job_name", "مدير المؤسسة")
        .maybeSingle();

      if (managerJobLookupError) {
        setError("تعذر تحديد وظيفة مدير المؤسسة: " + managerJobLookupError.message);
        setSaving(false);
        return;
      }

      let managerJobId = existingManagerJob?.id || null;

      if (!managerJobId) {
        const { data: createdJob, error: createJobError } = await supabase
          .from("jobs")
          .insert({ job_name: "مدير المؤسسة", is_active: true })
          .select("id, job_name")
          .single();

        if (createJobError) {
          setError("تعذر إنشاء وظيفة مدير المؤسسة: " + createJobError.message);
          setSaving(false);
          return;
        }
        managerJobId = createdJob.id;
      }

      const { data: createdInstitution, error: institutionError } = await supabase
        .from("institutions")
        .insert({ ...values, name_line_1: name, director_name: managerFullName, is_active: true })
        .select()
        .single();

      if (institutionError) {
        setError(institutionError.message);
        setSaving(false);
        return;
      }

      const institutionId = createdInstitution.id;

      const { data: permissionRows, error: permissionsError } = await supabase
        .from("permissions")
        .select("id, permission_key")
        .in("permission_key", ["manage_employees", "view_employee_profile"]);

      if (permissionsError) {
        await supabase.from("institutions").delete().eq("id", institutionId);
        setError("تعذر تجهيز صلاحيات مدير المؤسسة: " + permissionsError.message);
        setSaving(false);
        return;
      }

      if (permissionRows?.length) {
        const { data: existingJobPermissions, error: existingJobPermissionsError } = await supabase
          .from("job_permissions")
          .select("permission_id")
          .eq("job_id", managerJobId);

        if (existingJobPermissionsError) {
          await supabase.from("institutions").delete().eq("id", institutionId);
          setError("تعذر قراءة صلاحيات مدير المؤسسة: " + existingJobPermissionsError.message);
          setSaving(false);
          return;
        }

        const existingPermissionIds = new Set(
          (existingJobPermissions || []).map((row) => Number(row.permission_id))
        );
        const missingJobPermissions = permissionRows
          .filter((permission) => !existingPermissionIds.has(Number(permission.id)))
          .map((permission) => ({
            job_id: managerJobId,
            permission_id: permission.id
          }));

        if (missingJobPermissions.length) {
          const { error: jobPermissionsError } = await supabase
            .from("job_permissions")
            .insert(missingJobPermissions);

          if (jobPermissionsError) {
            await supabase.from("institutions").delete().eq("id", institutionId);
            setError("تعذر تجهيز صلاحيات مدير المؤسسة: " + jobPermissionsError.message);
            setSaving(false);
            return;
          }
        }
      }

      const { error: managerError } = await supabase
        .from("employees")
        .insert({
          full_name: managerFullName,
          username: managerUsername,
          password: managerPassword,
          national_id: managerNationalId || null,
          phone: form.manager_phone.trim() || null,
          whatsapp_number: form.manager_whatsapp_number.trim() || null,
          email: form.manager_email.trim() || null,
          address: form.manager_address.trim() || null,
          gender: form.manager_gender || null,
          nationality: form.manager_nationality.trim() || "فلسطيني",
          birth_date: form.manager_birth_date || null,
          birth_place: form.manager_birth_place.trim() || null,
          specialization: form.manager_specialization.trim() || null,
          job_id: managerJobId,
          role: "InstitutionManager",
          institution_id: institutionId,
          workplace: name,
          is_active: true
        });

      if (managerError) {
        await supabase.from("institutions").delete().eq("id", institutionId);
        setError("تم إنشاء المؤسسة لكن تعذر إنشاء حساب مديرها: " + managerError.message);
        setSaving(false);
        return;
      }

      setMessage(`تمت إضافة المؤسسة وإنشاء حساب المدير ${managerUsername} بنجاح.`);
      reset();
      await load();
      setSaving(false);
      return;
    }

    const result = await supabase
      .from("institutions")
      .update(values)
      .eq("id", editingId)
      .select();

    if (result.error) {
      setError(result.error.message);
    } else {
      setMessage("تم تعديل المؤسسة بنجاح.");
      reset();
      await load();
    }
    setSaving(false);
  }

  async function toggle(row) {
    const active = row.is_active !== false;
    const ok = window.confirm(
      `هل تريد ${active ? "تجميد" : "تفعيل"} المؤسسة "${row[NAME_COLUMN] ?? row.name_line_1 ?? row.institution_name ?? ""}"؟`
    );
    if (!ok) return;

    const { error } = await supabase
      .from("institutions")
      .update({ is_active: !active })
      .eq("id", row.id);

    if (error) {
      setError("تعذر تغيير حالة المؤسسة: " + error.message);
    } else {
      setMessage(active ? "تم تجميد المؤسسة." : "تم تفعيل المؤسسة.");
      await load();
    }
  }

  async function remove(row) {
    const name = row[NAME_COLUMN] ?? row.name_line_1 ?? row.institution_name ?? "";
    if (!window.confirm(`هل أنت متأكد من حذف المؤسسة "${name}"؟`)) return;

    const { error } = await supabase
      .from("institutions")
      .delete()
      .eq("id", row.id);

    if (error) {
      setError(`تعذر حذف المؤسسة. قد تكون مرتبطة ببيانات أخرى.\\n${error.message}`);
    } else {
      setMessage("تم حذف المؤسسة.");
      if (editingId === row.id) reset();
      await load();
    }
  }

  return (
    <div dir="rtl" style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>إدارة المؤسسات التعليمية</h1>
            <p style={s.sub}>إضافة وتعديل وتجميد وتفعيل وحذف المؤسسات</p>
          </div>
          <button type="button" onClick={load} style={s.refresh}>↻ تحديث</button>
        </div>

        {(error || message) && (
          <div style={error ? s.error : s.success}>{error || message}</div>
        )}

        <section style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <div style={s.eyebrow}>إدارة المؤسسات التعليمية</div>
              <h2 style={s.h2}>{editingId ? "تعديل المؤسسة" : "إضافة مؤسسة جديدة"}</h2>
            </div>
            <div style={s.cardIcon}>🏫</div>
          </div>

          <form onSubmit={save} style={s.form}>
            <div style={s.topFields}>
              <label style={{ ...s.label, ...s.fieldCardBlue }}>
                <span style={s.labelRow}><span>اسم المؤسسة <b style={s.required}>*</b></span><span style={s.fieldIcon}>🏫</span></span>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="اكتب اسم المؤسسة"
                  style={s.input}
                />
              </label>

              <label style={{ ...s.label, ...s.fieldCardPurple }}>
                <span style={s.labelRow}><span>كود المؤسسة <b style={s.required}>*</b> <small style={s.codeHintInline}>(الكود مكون من رقمين)</small></span><span style={s.fieldIcon}>#</span></span>
                <input
                  value={form.institution_code}
                  onChange={e =>
                    setForm({
                      ...form,
                      institution_code: e.target.value.replace(/\D/g, "").slice(0, 2)
                    })
                  }
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="01"
                  style={s.input}
                />
              </label>
            </div>

            {!editingId && (
              <>
                <div style={s.managerBox}>
                  <div style={s.managerTitle}>بيانات مدير المؤسسة</div>
                  <div style={s.managerGrid}>
                    <label style={s.label}>
                      الاسم الرباعي *
                      <input value={form.manager_full_name} onChange={e => setForm({ ...form, manager_full_name: e.target.value })} placeholder="الاسم الرباعي" style={s.input} />
                    </label>
                    <label style={s.label}>
                      رقم الهوية *
                      <input value={form.manager_national_id} onChange={e => setForm({ ...form, manager_national_id: e.target.value.replace(/\D/g, '').slice(0, 9) })} inputMode="numeric" maxLength={9} placeholder="9 أرقام" style={s.input} />
                    </label>
                    <label style={s.label}>
                      رقم الهاتف
                      <input value={form.manager_phone} onChange={e => setForm({ ...form, manager_phone: e.target.value })} placeholder="05xxxxxxxx" style={s.input} />
                    </label>
                    <label style={s.label}>
                      رقم الواتس
                      <input value={form.manager_whatsapp_number} onChange={e => setForm({ ...form, manager_whatsapp_number: e.target.value })} placeholder="05xxxxxxxx" style={s.input} />
                    </label>

                    <label style={s.label}>
                      البريد الإلكتروني
                      <input type="email" value={form.manager_email} onChange={e => setForm({ ...form, manager_email: e.target.value })} placeholder="name@example.com" style={s.input} />
                    </label>
                    <label style={s.label}>
                      العنوان
                      <input value={form.manager_address} onChange={e => setForm({ ...form, manager_address: e.target.value })} placeholder="العنوان" style={s.input} />
                    </label>
                    <div style={s.emptyCell} />
                    <div style={s.emptyCell} />

                    <label style={s.label}>
                      الجنس
                      <select value={form.manager_gender} onChange={e => setForm({ ...form, manager_gender: e.target.value })} style={s.input}>
                        <option value="">اختر الجنس</option><option value="ذكر">ذكر</option><option value="أنثى">أنثى</option>
                      </select>
                    </label>
                    <label style={s.label}>
                      الجنسية
                      <input value={form.manager_nationality} onChange={e => setForm({ ...form, manager_nationality: e.target.value })} style={s.input} />
                    </label>
                    <label style={s.label}>
                      تاريخ الميلاد
                      <input type="date" value={form.manager_birth_date} onChange={e => setForm({ ...form, manager_birth_date: e.target.value })} style={s.input} />
                    </label>
                    <label style={s.label}>
                      مكان الميلاد
                      <input value={form.manager_birth_place} onChange={e => setForm({ ...form, manager_birth_place: e.target.value })} placeholder="مكان الميلاد" style={s.input} />
                    </label>

                    <label style={s.label}>
                      التخصص
                      <input value={form.manager_specialization} onChange={e => setForm({ ...form, manager_specialization: e.target.value })} placeholder="التخصص" style={s.input} />
                    </label>
                    <label style={s.label}>
                      اسم المستخدم *
                      <input value={form.manager_username} onChange={e => setForm({ ...form, manager_username: e.target.value.replace(/\s/g, '') })} placeholder="مثال: manager01" autoComplete="off" style={s.input} />
                    </label>
                    <label style={s.label}>
                      كلمة المرور *
                      <input type="password" value={form.manager_password} onChange={e => setForm({ ...form, manager_password: e.target.value })} placeholder="8–10 أحرف وفق سياسة النظام" autoComplete="new-password" style={s.input} />
                    </label>
                    <div style={s.emptyCell} />
                  </div>
                  <small style={s.hint}>الوظيفة تُنشأ تلقائيًا كـ «مدير المؤسسة»، والمؤسسة تُربط تلقائيًا بهذا الحساب.</small>
                </div>
              </>
            )}

            <div style={s.buttons}>
              <button disabled={saving} type="submit" style={s.primary}>
                {saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة المؤسسة"}
              </button>
              {editingId && (
                <button type="button" onClick={reset} style={s.secondary}>
                  إلغاء
                </button>
              )}
            </div>
          </form>
        </section>

        <section style={s.card}>
          <div style={s.listTitle}>
            <h2 style={s.h2}>المؤسسات</h2>
            <span style={s.badge}>{items.length} مؤسسة</span>
          </div>

          {loading ? (
            <div style={s.empty}>جارٍ تحميل المؤسسات...</div>
          ) : items.length === 0 ? (
            <div style={s.empty}>لا توجد مؤسسات مضافة حتى الآن.</div>
          ) : (
            <div>
              {items.map((row, i) => {
                const active = row.is_active !== false;
                const name = row[NAME_COLUMN] ?? row.institution_name ?? "بدون اسم";

                return (
                  <div key={row.id} style={s.row}>
                    <div style={s.number}>{i + 1}</div>

                    <div style={s.info}>
                      <div style={s.name}>{name}</div>
                      <div style={s.meta}>
                        <span>كود: {row.institution_code ?? "—"}</span>
                        <span style={active ? s.active : s.frozen}>
                          {active ? "نشطة" : "مجمّدة"}
                        </span>
                      </div>
                    </div>

                    <div style={s.actions}>
                      <button onClick={() => edit(row)} style={s.edit}>تعديل</button>
                      <button onClick={() => toggle(row)} style={active ? s.freeze : s.activate}>
                        {active ? "تجميد" : "تفعيل"}
                      </button>
                      <button onClick={() => remove(row)} style={s.delete}>حذف</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "linear-gradient(145deg, #020617 0%, #050b18 45%, #00040b 100%)", padding: "28px 22px 45px", fontFamily: "Tajawal, Cairo, Arial, sans-serif", color: "#e5eefc" },
  container: { maxWidth: 1180, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 15, marginBottom: 20, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 30, fontWeight: 900, color: "#f8fbff" },
  sub: { margin: "6px 0 0", color: "#8fa4c2" },
  refresh: { border: "1px solid #1769aa", background: "#07172b", color: "#bfe8ff", borderRadius: 10, padding: "10px 15px", cursor: "pointer", boxShadow: "0 0 18px rgba(14,165,233,.10)" },
  card: { background: "linear-gradient(145deg, rgba(5,18,35,.98), rgba(2,10,22,.98))", border: "1px solid #173451", borderRadius: 18, padding: 24, marginBottom: 20, boxShadow: "0 18px 55px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.025)" },
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 15, marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid #16314d" },
  cardIcon: { width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#052e52,#073b68)", border: "1px solid #00b7ff", color: "#00d9ff", fontSize: 25, boxShadow: "0 0 22px rgba(0,183,255,.16)" },
  eyebrow: { color: "#00bfff", fontSize: 13, fontWeight: 800, marginBottom: 3 },
  h2: { margin: 0, fontSize: 24, fontWeight: 900, color: "#f5f9ff" },
  form: { display: "flex", flexDirection: "column", gap: 18, marginTop: 4 },
  topFields: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 },
  managerBox: { border: "1px solid #008f96", borderRadius: 15, padding: 18, background: "linear-gradient(145deg, rgba(0,75,83,.22), rgba(2,15,27,.72))", boxShadow: "inset 0 0 28px rgba(0,211,214,.035)" },
  managerTitle: { fontSize: 20, fontWeight: 900, color: "#42e8e8", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 },
  managerGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 },
  emptyCell: { minHeight: 1 },
  fieldCardBlue: { border: "1px solid #0b8fce", borderRadius: 14, padding: 14, background: "linear-gradient(145deg, rgba(5,38,65,.58), rgba(2,13,26,.8))", boxShadow: "0 0 22px rgba(0,174,255,.055)" },
  fieldCardPurple: { border: "1px solid #7845c7", borderRadius: 14, padding: 14, background: "linear-gradient(145deg, rgba(44,20,75,.58), rgba(13,7,28,.8))", boxShadow: "0 0 22px rgba(141,75,255,.06)" },
  label: { display: "flex", flexDirection: "column", gap: 8, fontWeight: 800, fontSize: 14, color: "#dbeafe" },
  labelRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 24 },
  required: { color: "#ff2d2d", fontSize: 17 },
  fieldIcon: { width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,174,255,.12)", border: "1px solid #0d6d9e", color: "#31c8ff", fontWeight: 900, fontSize: 18 },
  codeHintInline: { color: "#d9ccff", fontWeight: 600, fontSize: 12 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #28425e", background: "#071322", color: "#f4f8ff", borderRadius: 10, padding: "12px 13px", fontSize: 15, outline: "none", direction: "rtl", boxShadow: "inset 0 1px 8px rgba(0,0,0,.22)" },
  hint: { color: "#8ea6c4", fontWeight: 400 },
  buttons: { display: "flex", gap: 10, justifyContent: "center", paddingTop: 12, borderTop: "1px solid #18334f" },
  primary: { border: "1px solid #1586ff", background: "linear-gradient(135deg,#0878f9,#0a55dc)", color: "#fff", borderRadius: 11, padding: "13px 28px", cursor: "pointer", fontWeight: 900, boxShadow: "0 7px 25px rgba(0,112,255,.22)" },
  secondary: { border: "1px solid #36506d", background: "#101e30", color: "#d5e4f6", borderRadius: 11, padding: "13px 28px", cursor: "pointer" },
  listTitle: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  badge: { background: "#0c1e35", color: "#65d6ff", border: "1px solid #1a5d85", borderRadius: 20, padding: "6px 10px", fontSize: 13 },
  row: { display: "flex", alignItems: "center", gap: 13, border: "1px solid #173451", borderRadius: 13, padding: 12, marginBottom: 9, background: "#061221" },
  number: { width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#07538b,#0b2d4c)", border: "1px solid #1685bd", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 17, fontWeight: 800, marginBottom: 6, color: "#f4f8ff" },
  meta: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", color: "#8fa4c2", fontSize: 13 },
  active: { background: "rgba(16,185,129,.13)", color: "#5eead4", border: "1px solid #147b70", borderRadius: 20, padding: "4px 9px" },
  frozen: { background: "rgba(245,158,11,.12)", color: "#fbbf24", border: "1px solid #7a5411", borderRadius: 20, padding: "4px 9px" },
  actions: { display: "flex", gap: 6, flexWrap: "wrap" },
  edit: { border: "1px solid #1769aa", background: "#071b31", color: "#56c8ff", borderRadius: 8, padding: "8px 11px", cursor: "pointer" },
  freeze: { border: "1px solid #7a5411", background: "#201807", color: "#fbbf24", borderRadius: 8, padding: "8px 11px", cursor: "pointer" },
  activate: { border: "1px solid #147b70", background: "#061d1c", color: "#5eead4", borderRadius: 8, padding: "8px 11px", cursor: "pointer" },
  delete: { border: "1px solid #7f2430", background: "#240b10", color: "#ff7a87", borderRadius: 8, padding: "8px 11px", cursor: "pointer" },
  empty: { textAlign: "center", padding: 35, color: "#8298b5" },
  error: { background: "#250b11", color: "#ff9aa5", border: "1px solid #7f2430", borderRadius: 10, padding: 12, marginBottom: 15, whiteSpace: "pre-line" },
  success: { background: "#06231e", color: "#72e6ca", border: "1px solid #147b70", borderRadius: 10, padding: 12, marginBottom: 15 },
  codeHint: { color: "#9eb4cf" }
};

