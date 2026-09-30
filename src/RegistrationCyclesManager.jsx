const toEnglishDigits = (value) => String(value ?? '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const englishDate = (value) => toEnglishDigits(value).slice(0, 10);

import React, { useEffect, useMemo, useState } from "react";

/*
  شاشة إدارة الدورات:
  - الدورة الأولى / الثانية / الثالثة
  - تاريخ بداية التسجيل ونهاية التسجيل لكل دورة
  - إحصائية الطلاب المسجلين لكل دورة
  - التجميع حسب الفرع ثم المديرية ثم الجنس
  - تعتمد على students.registration_cycle الموجودة في النظام
*/

const CYCLES = [
  { number: 1, label: "الدورة الأولى" },
  { number: 2, label: "الدورة الثانية" },
  { number: 3, label: "الدورة الثالثة" },
];

const BRANCH_ORDER = [
  "علمي",
  "أدبي",
  "زراعي",
  "صناعي",
  "ريادة وأعمال",
  "تكنولوجي",
  "شرعي",
  "اقتصاد منزلي",
  "فندقي",
];

const normalizeText = (value) => String(value ?? "").trim();

const branchLabel = (value) => {
  const v = normalizeText(value);
  if (!v) return "غير محدد";
  const map = {
    علمي: "علمي",
    العلمي: "علمي",
    أدبي: "أدبي",
    الادبي: "أدبي",
    أدبي: "أدبي",
    زراعي: "زراعي",
    زراعي: "زراعي",
    صناعي: "صناعي",
    "ريادة وأعمال": "ريادة وأعمال",
    "ريادة واعمال": "ريادة وأعمال",
    تجاري: "ريادة وأعمال",
    تكنولوجي: "تكنولوجي",
    تكنولوجي: "تكنولوجي",
    شرعي: "شرعي",
    "اقتصاد منزلي": "اقتصاد منزلي",
    فندقي: "فندقي",
  };
  return map[v] || v;
};

const genderLabel = (value) => {
  const v = normalizeText(value).toLowerCase();
  if (["ذكر", "male", "m"].includes(v)) return "ذكور";
  if (["أنثى", "انثى", "female", "f"].includes(v)) return "إناث";
  return "غير محدد";
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB");
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function RegistrationCyclesManager({ supabase }) {
  const [cycles, setCycles] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const selectedConfig = useMemo(
    () => cycles.find((c) => Number(c.cycle_number) === Number(selectedCycle)),
    [cycles, selectedCycle]
  );

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (selectedConfig) {
      setStartDate(selectedConfig.start_date || "");
      setEndDate(selectedConfig.end_date || "");
    } else {
      setStartDate("");
      setEndDate("");
    }
  }, [selectedConfig]);

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
    window.setTimeout(() => setMessage(""), 3000);
  };

  const loadData = async () => {
    if (!supabase) return;

    setLoading(true);
    try {
      const [{ data: cycleRows, error: cycleError }, { data: studentRows, error: studentError }] =
        await Promise.all([
          supabase
            .from("registration_cycles")
            .select("id, cycle_number, start_date, end_date, created_at, updated_at")
            .order("cycle_number", { ascending: true }),
          supabase
            .from("students")
            .select("id, registration_cycle, branch, directorate_name, gender"),
        ]);

      if (cycleError) throw cycleError;
      if (studentError) throw studentError;

      setCycles(cycleRows || []);
      setStudents(studentRows || []);
    } catch (error) {
      console.error(error);
      showMessage(error?.message || "تعذر تحميل بيانات الدورات.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveCycleDates = async () => {
    if (!supabase) return;

    if (!startDate || !endDate) {
      showMessage("يرجى تحديد تاريخ بداية التسجيل وتاريخ انتهاء التسجيل.", "error");
      return;
    }

    if (endDate < startDate) {
      showMessage("تاريخ انتهاء التسجيل يجب أن يكون بعد أو مساويًا لتاريخ البداية.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        cycle_number: Number(selectedCycle),
        start_date: startDate,
        end_date: endDate,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("registration_cycles")
        .upsert(payload, { onConflict: "cycle_number" })
        .select("id, cycle_number, start_date, end_date, created_at, updated_at")
        .single();

      if (error) throw error;

      setCycles((previous) => {
        const without = previous.filter(
          (row) => Number(row.cycle_number) !== Number(selectedCycle)
        );
        return [...without, data].sort(
          (a, b) => Number(a.cycle_number) - Number(b.cycle_number)
        );
      });

      showMessage(`تم حفظ مواعيد ${CYCLES.find((c) => c.number === Number(selectedCycle))?.label}.`);
    } catch (error) {
      console.error(error);
      showMessage(error?.message || "تعذر حفظ مواعيد الدورة.", "error");
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const rows = students.filter(
      (student) => Number(student.registration_cycle) === Number(selectedCycle)
    );

    const total = rows.length;

    const branchMap = new Map();

    rows.forEach((student) => {
      const branch = branchLabel(student.branch);
      const directorate = normalizeText(student.directorate_name) || "غير محددة";
      const gender = genderLabel(student.gender);

      if (!branchMap.has(branch)) {
        branchMap.set(branch, {
          branch,
          total: 0,
          directorates: new Map(),
        });
      }

      const branchEntry = branchMap.get(branch);
      branchEntry.total += 1;

      if (!branchEntry.directorates.has(directorate)) {
        branchEntry.directorates.set(directorate, {
          directorate,
          total: 0,
          males: 0,
          females: 0,
          unknown: 0,
        });
      }

      const d = branchEntry.directorates.get(directorate);
      d.total += 1;
      if (gender === "ذكور") d.males += 1;
      else if (gender === "إناث") d.females += 1;
      else d.unknown += 1;
    });

    const orderedBranches = [...branchMap.values()].sort((a, b) => {
      const ai = BRANCH_ORDER.indexOf(a.branch);
      const bi = BRANCH_ORDER.indexOf(b.branch);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.branch.localeCompare(b.branch, "ar");
    });

    orderedBranches.forEach((entry) => {
      entry.directorates = [...entry.directorates.values()].sort((a, b) =>
        a.directorate.localeCompare(b.directorate, "ar")
      );
    });

    return { total, branches: orderedBranches };
  }, [students, selectedCycle]);

  const currentCycle = CYCLES.find((c) => c.number === Number(selectedCycle));

  return (
    <div dir="rtl" style={styles.page}>
      {message && (
        <div
          style={{
            ...styles.message,
            ...(messageType === "error" ? styles.errorMessage : styles.successMessage),
          }}
        >
          {message}
        </div>
      )}

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>إدارة الدورات الدراسية</h1>
          <div style={styles.subtitle}>
            مواعيد التسجيل وإحصائيات الطلاب حسب الدورة والفرع والمديرية والجنس
          </div>
        </div>
        <button style={styles.refreshButton} onClick={loadData} disabled={loading}>
          ↻ تحديث البيانات
        </button>
      </div>

      <div style={styles.cycleTabs}>
        {CYCLES.map((cycle) => (
          <button
            key={cycle.number}
            onClick={() => setSelectedCycle(cycle.number)}
            style={{
              ...styles.cycleButton,
              ...(Number(selectedCycle) === cycle.number ? styles.cycleButtonActive : {}),
            }}
          >
            {cycle.label}
          </button>
        ))}
      </div>

      <section style={styles.card}>
        <div style={styles.cardTitle}>
          ⚙️ إعدادات {currentCycle?.label}
        </div>

        <div style={styles.formGrid}>
          <label style={styles.field}>
            <span>تاريخ بداية التسجيل</span>
            <input
              type="date" lang="en-US" inputMode="numeric"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            <span>تاريخ انتهاء التسجيل</span>
            <input
              type="date" lang="en-US" inputMode="numeric"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={styles.input}
            />
          </label>

          <div style={styles.saveWrap}>
            <button style={styles.saveButton} onClick={saveCycleDates} disabled={saving}>
              {saving ? "جاري الحفظ..." : "حفظ مواعيد الدورة"}
            </button>
          </div>
        </div>

        <div style={styles.hint}>
          💡 تعتمد إحصائية الدورة على الحقل <b>registration_cycle</b> الموجود في جدول الطلاب.
        </div>
      </section>

      <section style={styles.summaryCard}>
        <div>
          <div style={styles.summaryLabel}>إجمالي المسجلين في {currentCycle?.label}</div>
          <div style={styles.summaryNumber}>{toEnglishDigits(stats.total)}</div>
        </div>
        <div style={styles.dateSummary}>
          <div>
            <span>البداية</span>
            <b>{formatDate(startDate)}</b>
          </div>
          <div>
            <span>النهاية</span>
            <b>{formatDate(endDate)}</b>
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardTitle}>
          📊 أعداد الطلاب حسب الفرع والمديرية والجنس
        </div>

        {loading ? (
          <div style={styles.empty}>جاري تحميل البيانات...</div>
        ) : stats.branches.length === 0 ? (
          <div style={styles.empty}>لا يوجد طلاب مسجلون في هذه الدورة حتى الآن.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>الفرع</th>
                  <th style={styles.th}>المديرية</th>
                  <th style={styles.th}>ذكور</th>
                  <th style={styles.th}>إناث</th>
                  <th style={styles.th}>غير محدد</th>
                  <th style={styles.th}>المجموع</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let serial = 0;
                  return stats.branches.flatMap((branch) => {
                    const branchRows = branch.directorates.map((d, index) => {
                      serial += 1;
                      return (
                        <tr key={`${branch.branch}-${d.directorate}`}>
                          <td style={styles.td}>{serial}</td>
                          <td style={styles.td}>
                            {index === 0 ? (
                              <b>{branch.branch}</b>
                            ) : (
                              <span style={styles.mutedBranch}>↳ {branch.branch}</span>
                            )}
                          </td>
                          <td style={styles.td}>{d.directorate}</td>
                          <td style={styles.td}>{d.males}</td>
                          <td style={styles.td}>{d.females}</td>
                          <td style={styles.td}>{d.unknown}</td>
                          <td style={{ ...styles.td, fontWeight: 800 }}>{d.total}</td>
                        </tr>
                      );
                    });

                    branchRows.push(
                      <tr key={`${branch.branch}-total`} style={styles.branchTotalRow}>
                        <td style={styles.td}></td>
                        <td style={styles.td} colSpan={2}>
                          إجمالي {branch.branch}
                        </td>
                        <td style={styles.td}>
                          {branch.directorates.reduce((s, d) => s + d.males, 0)}
                        </td>
                        <td style={styles.td}>
                          {branch.directorates.reduce((s, d) => s + d.females, 0)}
                        </td>
                        <td style={styles.td}>
                          {branch.directorates.reduce((s, d) => s + d.unknown, 0)}
                        </td>
                        <td style={styles.td}>{branch.total}</td>
                      </tr>
                    );

                    return branchRows;
                  });
                })()}
              </tbody>
              <tfoot>
                <tr style={styles.grandTotalRow}>
                  <td style={styles.td} colSpan={3}>الإجمالي الكلي</td>
                  <td style={styles.td}>
                    {stats.branches.reduce(
                      (sum, b) =>
                        sum + b.directorates.reduce((s, d) => s + d.males, 0),
                      0
                    )}
                  </td>
                  <td style={styles.td}>
                    {stats.branches.reduce(
                      (sum, b) =>
                        sum + b.directorates.reduce((s, d) => s + d.females, 0),
                      0
                    )}
                  </td>
                  <td style={styles.td}>
                    {stats.branches.reduce(
                      (sum, b) =>
                        sum + b.directorates.reduce((s, d) => s + d.unknown, 0),
                      0
                    )}
                  </td>
                  <td style={styles.td}>{toEnglishDigits(stats.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    background: "linear-gradient(135deg,#061226 0%,#0a1730 55%,#07101f 100%)",
    color: "#eef6ff",
    fontFamily: "'Noto Kufi Arabic', Arial, sans-serif",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "20px",
  },
  title: {
    margin: 0,
    fontSize: "26px",
    fontWeight: 900,
  },
  subtitle: {
    marginTop: "7px",
    color: "#a9bdd6",
    fontSize: "13px",
  },
  refreshButton: {
    border: "1px solid rgba(80,180,255,.5)",
    background: "rgba(30,120,255,.2)",
    color: "#fff",
    borderRadius: "12px",
    padding: "11px 16px",
    cursor: "pointer",
    fontWeight: 800,
  },
  cycleTabs: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  cycleButton: {
    flex: "1 1 180px",
    border: "1px solid rgba(100,160,220,.28)",
    background: "rgba(20,40,75,.65)",
    color: "#cbd9e9",
    borderRadius: "12px",
    padding: "13px 16px",
    cursor: "pointer",
    fontWeight: 800,
  },
  cycleButtonActive: {
    background: "linear-gradient(135deg,#1689ff,#2455e6)",
    color: "#fff",
    borderColor: "#52b7ff",
  },
  card: {
    background: "rgba(13,28,55,.78)",
    border: "1px solid rgba(95,155,225,.22)",
    borderRadius: "18px",
    padding: "20px",
    marginBottom: "18px",
    boxShadow: "0 14px 40px rgba(0,0,0,.2)",
  },
  cardTitle: {
    fontSize: "17px",
    fontWeight: 900,
    marginBottom: "16px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
    alignItems: "end",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#b9cbe0",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "#08172e",
    border: "1px solid rgba(100,170,235,.35)",
    color: "#fff",
    borderRadius: "10px",
    padding: "12px",
    outline: "none",
    fontSize: "14px",
  },
  saveWrap: {
    display: "flex",
    alignItems: "end",
  },
  saveButton: {
    border: 0,
    background: "linear-gradient(135deg,#00a878,#087f68)",
    color: "#fff",
    borderRadius: "10px",
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  hint: {
    marginTop: "12px",
    color: "#90a8c2",
    fontSize: "11px",
  },
  summaryCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    padding: "20px",
    marginBottom: "18px",
    borderRadius: "18px",
    background: "linear-gradient(135deg,rgba(18,72,145,.78),rgba(14,37,79,.78))",
    border: "1px solid rgba(85,175,255,.35)",
  },
  summaryLabel: {
    color: "#b9d4ee",
    fontSize: "13px",
    fontWeight: 700,
  },
  summaryNumber: {
    fontSize: "38px",
    fontWeight: 950,
    marginTop: "4px",
  },
  dateSummary: {
    display: "flex",
    gap: "28px",
  },
  dateSummaryItem: {},
  dateSummary: {
    display: "flex",
    gap: "28px",
  },
  dateSummary: {
    display: "flex",
    gap: "28px",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
    borderRadius: "12px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "760px",
    fontSize: "12px",
  },
  th: {
    background: "linear-gradient(135deg,#174caa,#1f72d5)",
    color: "#fff",
    padding: "11px 8px",
    border: "1px solid rgba(255,255,255,.12)",
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "10px 8px",
    border: "1px solid rgba(120,165,210,.14)",
    textAlign: "center",
    color: "#eaf3ff",
  },
  branchTotalRow: {
    background: "rgba(30,105,185,.14)",
  },
  grandTotalRow: {
    background: "rgba(20,140,120,.2)",
    fontWeight: 950,
  },
  mutedBranch: {
    opacity: 0.45,
    fontSize: "10px",
  },
  empty: {
    textAlign: "center",
    padding: "35px",
    color: "#9eb3cb",
  },
  message: {
    position: "fixed",
    zIndex: 9999,
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    padding: "15px 24px",
    borderRadius: "12px",
    fontWeight: 900,
    boxShadow: "0 15px 50px rgba(0,0,0,.4)",
    textAlign: "center",
  },
  successMessage: {
    background: "#087f68",
    color: "#fff",
  },
  errorMessage: {
    background: "#a32635",
    color: "#fff",
  },
};
