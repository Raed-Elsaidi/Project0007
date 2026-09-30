import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/**
 * إدارة المؤسسة
 * تعمل مع جدول public.institutions الحالي:
 * id, institution_code, name_line_1, name_line_2, name_line_3,
 * logo_url, facebook_url, instagram_url, youtube_url,
 * whatsapp_url, tiktok_url, website_url, is_active, created_at
 *
 * ملاحظة:
 * أنشئ Storage bucket باسم institution-logos من لوحة Supabase
 * إذا لم يكن موجودًا. الكود لا يحاول إنشاء Bucket من الواجهة.
 */

const BUCKET = "institution-logos";

export default function InstitutionManagementProfile({
  institutionId: institutionIdProp,
  onSaved,
}) {
  const [institutionId, setInstitutionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    official_name: "",
    name_line_1: "",
    name_line_2: "",
    name_line_3: "",
    institution_code: "",
    phone: "",
    email: "",
    address: "",
    website: "",
    director_name: "",
    registration_number: "",
    description: "",
    logo_url: "",
    facebook_url: "",
    instagram_url: "",
    youtube_url: "",
    whatsapp_url: "",
    tiktok_url: "",
    website_url: "",
    is_active: true,
  });

  useEffect(() => {
    resolveInstitutionAndLoad();
  }, [institutionIdProp]);

  async function resolveInstitutionAndLoad() {
    setLoading(true);
    setError("");
    setMessage("");

    // نأخذ المؤسسة من الجدول نفسه. الأولوية للـ prop، ثم جلسة المستخدم،
    // ثم المؤسسة الافتراضية الحالية ذات الكود 01.
    let resolvedId = Number(institutionIdProp);

    if (!Number.isFinite(resolvedId) || resolvedId <= 0) {
      const storedId = Number(window.localStorage.getItem("currentInstitutionId"));
      if (Number.isFinite(storedId) && storedId > 0) {
        resolvedId = storedId;
      }
    }

    if (!Number.isFinite(resolvedId) || resolvedId <= 0) {
      const { data: currentInstitution, error: currentError } = await supabase
        .from("institutions")
        .select("id")
        .eq("institution_code", "01")
        .maybeSingle();

      if (currentError) {
        setError("تعذر تحديد المؤسسة الحالية: " + currentError.message);
        setLoading(false);
        return;
      }

      resolvedId = currentInstitution?.id;
    }

    if (!Number.isFinite(Number(resolvedId)) || Number(resolvedId) <= 0) {
      setError("لم يتم العثور على المؤسسة الحالية في جدول المؤسسات.");
      setLoading(false);
      return;
    }

    setInstitutionId(Number(resolvedId));

    const { data, error } = await supabase
      .from("institutions")
      .select(`
        id,
        institution_code,
        name,
        official_name,
        name_line_1,
        name_line_2,
        name_line_3,
        phone,
        email,
        address,
        website,
        director_name,
        registration_number,
        description,
        logo_url,
        facebook_url,
        instagram_url,
        youtube_url,
        whatsapp_url,
        tiktok_url,
        website_url,
        is_active
      `)
      .eq("id", Number(resolvedId))
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    window.localStorage.setItem("currentInstitutionId", String(resolvedId));
    window.localStorage.setItem("currentInstitutionData", JSON.stringify(data));

    setForm({
      name: data?.name ?? data?.name_line_1 ?? "",
      official_name: data?.official_name ?? "",
      name_line_1: data?.name_line_1 ?? "",
      name_line_2: data?.name_line_2 ?? "",
      name_line_3: data?.name_line_3 ?? "",
      institution_code: data?.institution_code ?? "",
      phone: data?.phone ?? "",
      email: data?.email ?? "",
      address: data?.address ?? "",
      website: data?.website ?? data?.website_url ?? "",
      director_name: data?.director_name ?? "",
      registration_number: data?.registration_number ?? "",
      description: data?.description ?? "",
      logo_url: data?.logo_url ?? "",
      facebook_url: data?.facebook_url ?? "",
      instagram_url: data?.instagram_url ?? "",
      youtube_url: data?.youtube_url ?? "",
      whatsapp_url: data?.whatsapp_url ?? "",
      tiktok_url: data?.tiktok_url ?? "",
      website_url: data?.website_url ?? "",
      is_active: data?.is_active ?? true,
    });

    setLoading(false);
  }

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function uploadLogo(file) {
    if (!file) return;
    if (!Number.isFinite(Number(institutionId)) || Number(institutionId) <= 0) {
      setError("لم يتم تحديد المؤسسة الحالية.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${institutionId}/logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      setError(
        uploadError.message.includes("Bucket not found")
          ? `لم يتم العثور على Bucket باسم ${BUCKET}. يجب إنشاء الـBucket في Supabase أولًا ثم إعادة رفع الشعار.`
          : uploadError.message
      );
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

    setField("logo_url", data.publicUrl);
    setMessage("تم رفع الشعار. اضغط «حفظ البيانات» لتثبيت الرابط في المؤسسة.");
    setUploading(false);
  }

  async function save() {
    if (!Number.isFinite(Number(institutionId)) || Number(institutionId) <= 0) {
      setError("لم يتم تحديد المؤسسة الحالية.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      name: form.name.trim() || form.name_line_1.trim(),
      official_name: form.official_name.trim() || null,
      name_line_1: form.name_line_1.trim() || form.name.trim(),
      name_line_2: form.name_line_2.trim() || null,
      name_line_3: form.name_line_3.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      website: form.website.trim() || null,
      director_name: form.director_name.trim() || null,
      registration_number: form.registration_number.trim() || null,
      description: form.description.trim() || null,
      logo_url: form.logo_url.trim() || null,
      facebook_url: form.facebook_url.trim() || null,
      instagram_url: form.instagram_url.trim() || null,
      youtube_url: form.youtube_url.trim() || null,
      whatsapp_url: form.whatsapp_url.trim() || null,
      tiktok_url: form.tiktok_url.trim() || null,
      is_active: !!form.is_active,
    };

    if (!payload.name_line_1) {
      setError("اسم المؤسسة في السطر الأول مطلوب.");
      setSaving(false);
      return;
    }

    const { data, error: updateError } = await supabase
      .from("institutions")
      .update(payload)
      .eq("id", institutionId)
      .select()
      .single();

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    window.localStorage.setItem("currentInstitutionId", String(data.id));
    window.localStorage.setItem("currentInstitutionData", JSON.stringify(data));

    setMessage("تم حفظ بيانات المؤسسة بنجاح.");
    setSaving(false);
    onSaved?.(data);
  }

  if (loading) {
    return (
      <div dir="rtl" style={styles.page}>
        <div style={styles.card}>جاري تحميل بيانات المؤسسة…</div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>إدارة المؤسسة</h1>
          <p style={styles.subtitle}>
            إدارة بيانات المؤسسة وشعارها وروابط التواصل.
          </p>
        </div>
        <div style={styles.identityBadge}>
          <div>
            المؤسسة: <strong>{form.name || form.name_line_1 || "—"}</strong>
          </div>
          <div>
            كود المؤسسة: <strong>{form.institution_code || "—"}</strong>
          </div>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>شعار المؤسسة</h2>
        <p style={styles.help}>
          ارفع شعار المؤسسة من جهازك، ثم اضغط حفظ البيانات.
        </p>

        <div style={styles.logoRow}>
          <div style={styles.logoBox}>
            {form.logo_url ? (
              <img
                src={form.logo_url}
                alt="شعار المؤسسة"
                style={styles.logo}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span style={styles.logoPlaceholder}>شعار المؤسسة</span>
            )}
          </div>

          <div>
            <label style={styles.uploadButton}>
              {uploading ? "جاري الرفع…" : "رفع الشعار"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                hidden
                disabled={uploading}
                onChange={(e) => uploadLogo(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>البيانات الأساسية</h2>

        <div style={styles.grid}>
          <Field
            label="اسم المؤسسة *"
            value={form.name}
            onChange={(v) => setField("name", v)}
          />
          <Field
            label="الاسم الرسمي"
            value={form.official_name}
            onChange={(v) => setField("official_name", v)}
          />
          <Field
            label="رقم التسجيل / الترخيص"
            value={form.registration_number}
            onChange={(v) => setField("registration_number", v)}
          />
          <Field
            label="اسم المدير / المسؤول"
            value={form.director_name}
            onChange={(v) => setField("director_name", v)}
          />
          <Field
            label="اسم المؤسسة - السطر الأول *"
            value={form.name_line_1}
            onChange={(v) => setField("name_line_1", v)}
          />
          <Field
            label="اسم المؤسسة - السطر الثاني"
            value={form.name_line_2}
            onChange={(v) => setField("name_line_2", v)}
          />
          <Field
            label="اسم المؤسسة - السطر الثالث"
            value={form.name_line_3}
            onChange={(v) => setField("name_line_3", v)}
          />
          <Field
            label="كود المؤسسة"
            value={form.institution_code}
            disabled
            onChange={() => {}}
          />
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>بيانات التواصل والمؤسسة</h2>
        <div style={styles.grid}>
          <Field
            label="رقم الهاتف"
            value={form.phone}
            onChange={(v) => setField("phone", v)}
            dir="ltr"
          />
          <Field
            label="البريد الإلكتروني"
            value={form.email}
            onChange={(v) => setField("email", v)}
            dir="ltr"
          />
          <Field
            label="العنوان"
            value={form.address}
            onChange={(v) => setField("address", v)}
          />
          <Field
            label="الموقع الإلكتروني"
            value={form.website}
            onChange={(v) => setField("website", v)}
            dir="ltr"
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={styles.field}>
            <span style={styles.label}>وصف المؤسسة</span>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={4}
              style={styles.textarea}
            />
          </label>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>روابط المؤسسة</h2>

        <div style={styles.grid}>
          <Field
            label="الموقع الإلكتروني"
            value={form.website_url}
            onChange={(v) => setField("website_url", v)}
            dir="ltr"
          />
          <Field
            label="Facebook"
            value={form.facebook_url}
            onChange={(v) => setField("facebook_url", v)}
            dir="ltr"
          />
          <Field
            label="Instagram"
            value={form.instagram_url}
            onChange={(v) => setField("instagram_url", v)}
            dir="ltr"
          />
          <Field
            label="YouTube"
            value={form.youtube_url}
            onChange={(v) => setField("youtube_url", v)}
            dir="ltr"
          />
          <Field
            label="WhatsApp"
            value={form.whatsapp_url}
            onChange={(v) => setField("whatsapp_url", v)}
            dir="ltr"
          />
          <Field
            label="TikTok"
            value={form.tiktok_url}
            onChange={(v) => setField("tiktok_url", v)}
            dir="ltr"
          />
        </div>
      </section>

      <section style={styles.card}>
        <label style={styles.statusRow}>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setField("is_active", e.target.checked)}
          />
          <span>المؤسسة مفعّلة</span>
        </label>
      </section>

      <div style={styles.actions}>
        <button
          type="button"
          onClick={save}
          disabled={saving || uploading}
          style={styles.saveButton}
        >
          {saving ? "جاري الحفظ…" : "حفظ بيانات المؤسسة"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, disabled = false, dir }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input
        value={value}
        disabled={disabled}
        dir={dir}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...styles.input,
          ...(disabled ? styles.disabledInput : {}),
        }}
      />
    </label>
  );
}

const styles = {
  page: {
    minHeight: "100%",
    padding: 24,
    background: "#f6f8fb",
    color: "#172033",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  title: { margin: 0, fontSize: 30 },
  subtitle: { margin: "8px 0 0", color: "#64748b" },
  identityBadge: {
    padding: "10px 16px",
    borderRadius: 12,
    background: "#eef2ff",
    color: "#3730a3",
    display: "flex",
    flexDirection: "column",
    gap: 5,
    minWidth: 210,
  },
  codeBadge: {
    padding: "10px 16px",
    borderRadius: 12,
    background: "#eef2ff",
    color: "#3730a3",
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    boxShadow: "0 3px 12px rgba(15,23,42,.05)",
  },
  sectionTitle: { margin: "0 0 8px", fontSize: 20 },
  help: { margin: "0 0 16px", color: "#64748b" },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
  },
  logoBox: {
    width: 130,
    height: 130,
    borderRadius: 14,
    border: "2px dashed #cbd5e1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    background: "#f8fafc",
  },
  logo: { width: "100%", height: "100%", objectFit: "contain" },
  logoPlaceholder: { color: "#94a3b8", fontSize: 14 },
  uploadButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "11px 18px",
    borderRadius: 10,
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
    gap: 16,
  },
  field: { display: "flex", flexDirection: "column", gap: 7 },
  label: { fontWeight: 700, fontSize: 14 },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    outline: "none",
    background: "#fff",
    fontFamily: "inherit",
    resize: "vertical",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    outline: "none",
    background: "#fff",
  },
  disabledInput: { background: "#f1f5f9", color: "#64748b" },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    fontWeight: 700,
  },
  actions: { display: "flex", justifyContent: "flex-start", marginTop: 8 },
  saveButton: {
    border: 0,
    borderRadius: 10,
    padding: "12px 24px",
    background: "#0f766e",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  error: {
    background: "#fff1f2",
    color: "#be123c",
    border: "1px solid #fecdd3",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  success: {
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #a7f3d0",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
};
