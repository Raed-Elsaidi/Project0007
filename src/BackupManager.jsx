import React, { useMemo, useState } from 'react';

const HISTORY_KEY = 'project06_backup_history_v1';

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(items) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)));
  } catch {}
}

export default function BackupManager({ showAlertMessage }) {
  const [backupKey, setBackupKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [history, setHistory] = useState(readHistory);
  const [restoreFile, setRestoreFile] = useState(null);

  const apiBase = useMemo(() => {
    const configured = String(import.meta.env.VITE_BACKUP_API_URL || '').trim().replace(/\/$/, '');
    return configured || '';
  }, []);

  const setStatus = (type, text) => {
    setMessageType(type);
    setMessage(text);
    if (typeof showAlertMessage === 'function') showAlertMessage(text, type);
  };

  const addHistory = (entry) => {
    const next = [{ ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }, ...history].slice(0, 20);
    setHistory(next);
    saveHistory(next);
  };

  const getHeaders = () => ({ 'x-backup-key': backupKey.trim() });

  const createBackup = async () => {
    if (!backupKey.trim()) {
      setStatus('error', 'أدخل مفتاح النسخ الاحتياطي BACKUP_ADMIN_KEY أولاً.');
      return;
    }

    setBusy(true);
    setStatus('info', 'جاري إنشاء النسخة الاحتياطية الكاملة...');

    try {
      const response = await fetch(`${apiBase}/api/backup/export`, { headers: getHeaders() });
      if (!response.ok) {
        let detail = 'فشل إنشاء النسخة الاحتياطية.';
        try { detail = (await response.json()).message || detail; } catch {}
        throw new Error(detail);
      }

      const blob = await response.blob();
      const suggestedName = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/i)?.[1]
        || `Project06-Full-Backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz`;

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName,
            types: [{ description: 'Project06 Backup', accept: { 'application/gzip': ['.json.gz', '.gz'] } }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (pickerError) {
          if (pickerError?.name === 'AbortError') {
            setStatus('info', 'تم إلغاء اختيار مكان الحفظ.');
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = suggestedName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      addHistory({
        date: new Date().toISOString(),
        action: 'إنشاء نسخة احتياطية',
        result: 'نجحت العملية',
        fileName: suggestedName
      });
      setStatus('success', 'تم إنشاء النسخة الاحتياطية بنجاح وحفظها على جهازك.');
    } catch (error) {
      addHistory({ date: new Date().toISOString(), action: 'إنشاء نسخة احتياطية', result: `فشلت العملية: ${error.message}`, fileName: '' });
      setStatus('error', error.message || 'حدث خطأ أثناء إنشاء النسخة الاحتياطية.');
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async () => {
    if (!backupKey.trim()) {
      setStatus('error', 'أدخل مفتاح النسخ الاحتياطي BACKUP_ADMIN_KEY أولاً.');
      return;
    }
    if (!restoreFile) {
      setStatus('error', 'اختر ملف النسخة الاحتياطية أولاً.');
      return;
    }

    const confirmed = window.confirm(
      'تحذير: استعادة النسخة الاحتياطية ستستبدل بيانات الجداول المشتركة بالبيانات الموجودة داخل النسخة. هل تريد المتابعة؟'
    );
    if (!confirmed) return;

    setBusy(true);
    setStatus('info', 'جاري قراءة النسخة الاحتياطية واستعادتها...');

    try {
      const isGzip = restoreFile.name.toLowerCase().endsWith('.gz') || restoreFile.type === 'application/gzip';
      let response;
      if (isGzip) {
        response = await fetch(`${apiBase}/api/backup/restore-gzip`, {
          method: 'POST',
          headers: { ...getHeaders(), 'Content-Type': restoreFile.type || 'application/gzip' },
          body: await restoreFile.arrayBuffer()
        });
      } else {
        const text = await restoreFile.text();
        const backup = JSON.parse(text);
        response = await fetch(`${apiBase}/api/backup/restore`, {
          method: 'POST',
          headers: { ...getHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ backup })
        });
      }

      let payload = {};
      try { payload = await response.json(); } catch {}
      if (!response.ok) throw new Error(payload.message || payload.error || 'فشل استعادة النسخة الاحتياطية.');

      addHistory({
        date: new Date().toISOString(),
        action: 'استعادة نسخة احتياطية',
        result: 'نجحت العملية',
        fileName: restoreFile.name
      });
      setRestoreFile(null);
      const input = document.getElementById('backup-restore-file');
      if (input) input.value = '';
      setStatus('success', payload.message || 'تم استرجاع النسخة الاحتياطية بنجاح.');
    } catch (error) {
      addHistory({ date: new Date().toISOString(), action: 'استعادة نسخة احتياطية', result: `فشلت العملية: ${error.message}`, fileName: restoreFile.name });
      setStatus('error', error.message || 'حدث خطأ أثناء الاستعادة.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>حماية البيانات</div>
          <h2 style={styles.title}>حفظ البيانات وإنشاء نسخة احتياطية</h2>
          <p style={styles.subtitle}>إنشاء نسخة كاملة من بيانات PostgreSQL واستعادتها عند الحاجة.</p>
        </div>
        <div style={styles.shield}>🔐</div>
      </div>

      <div style={styles.notice}>
        <strong>تنبيه مهم:</strong> النسخة الاحتياطية يتم إنشاؤها على السيرفر ثم تُحفظ كملف على جهازك. لا تحفظ مفتاح BACKUP_ADMIN_KEY داخل المشروع أو GitHub.
      </div>

      <div style={styles.grid}>
        <section style={styles.card}>
          <div style={styles.cardIcon}>💾</div>
          <h3 style={styles.cardTitle}>إنشاء نسخة احتياطية</h3>
          <p style={styles.cardText}>تتضمن النسخة بيانات الجداول ومعلومات البنية والقيود والفهارس والدوال والسياسات والتسلسلات التي يستطيع خادم النسخ قراءتها.</p>
          <label style={styles.label}>مفتاح النسخ الاحتياطي</label>
          <input
            type="password"
            value={backupKey}
            onChange={(e) => setBackupKey(e.target.value)}
            placeholder="BACKUP_ADMIN_KEY"
            autoComplete="off"
            style={styles.input}
          />
          <button type="button" disabled={busy} onClick={createBackup} style={styles.primaryButton}>
            {busy ? '⏳ جاري التنفيذ...' : '💾 إنشاء وحفظ نسخة احتياطية'}
          </button>
        </section>

        <section style={styles.card}>
          <div style={styles.cardIcon}>♻️</div>
          <h3 style={styles.cardTitle}>استعادة نسخة احتياطية</h3>
          <p style={styles.cardText}>اختر ملف <code>.json.gz</code> أو <code>.json</code> سابقًا، ثم أكد العملية. الاستعادة تتم داخل معاملة قاعدة بيانات مع التراجع عند الفشل.</p>
          <label style={styles.label}>ملف النسخة الاحتياطية</label>
          <input
            id="backup-restore-file"
            type="file"
            accept=".gz,.json,.json.gz,application/gzip,application/json"
            onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
            style={styles.fileInput}
          />
          {restoreFile && <div style={styles.fileName}>📦 {restoreFile.name}</div>}
          <button type="button" disabled={busy || !restoreFile} onClick={restoreBackup} style={styles.restoreButton}>
            {busy ? '⏳ جاري الاستعادة...' : '♻️ استعادة النسخة المحددة'}
          </button>
        </section>
      </div>

      {message && <div style={{ ...styles.message, ...(messageType === 'error' ? styles.error : messageType === 'success' ? styles.success : styles.info) }}>{message}</div>}

      <section style={styles.historyCard}>
        <div style={styles.historyHeader}>
          <div>
            <h3 style={styles.cardTitle}>سجل عمليات النسخ الاحتياطي</h3>
            <p style={styles.subtitle}>السجل الظاهر هنا محفوظ في متصفح هذا الجهاز لأغراض المتابعة.</p>
          </div>
          <button type="button" onClick={() => { setHistory([]); saveHistory([]); }} style={styles.clearButton}>مسح السجل المحلي</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr><th>التاريخ والوقت</th><th>العملية</th><th>النتيجة</th><th>الملف</th></tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan="4" style={styles.empty}>لا توجد عمليات مسجلة بعد.</td></tr>
              ) : history.map(item => (
                <tr key={item.id}>
                  <td>{new Date(item.date).toLocaleString('ar-PS')}</td>
                  <td>{item.action}</td>
                  <td style={{ color: item.result.startsWith('نجحت') ? '#34d399' : '#f87171', fontWeight: 800 }}>{item.result}</td>
                  <td>{item.fileName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const styles = {
  page: { width: '100%', maxWidth: 1200, margin: '0 auto', color: '#e5e7eb' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, background: 'linear-gradient(135deg,#172033,#1e293b)', border: '1px solid #334155', borderRadius: 18, padding: '24px 28px', marginBottom: 18 },
  kicker: { color: '#fbbf24', fontSize: 12, fontWeight: 800, marginBottom: 6 },
  title: { margin: 0, color: '#f8fafc', fontSize: 24, fontWeight: 900 },
  subtitle: { margin: '7px 0 0', color: '#94a3b8', fontSize: 13 },
  shield: { width: 58, height: 58, borderRadius: 16, display: 'grid', placeItems: 'center', background: '#0f172a', border: '1px solid #475569', fontSize: 28 },
  notice: { background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.35)', color: '#fcd34d', borderRadius: 14, padding: '13px 16px', marginBottom: 18, lineHeight: 1.8, fontSize: 13 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 18 },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 18, padding: 22, boxShadow: '0 12px 30px rgba(0,0,0,.16)' },
  cardIcon: { fontSize: 30, marginBottom: 8 },
  cardTitle: { margin: 0, color: '#f8fafc', fontSize: 18, fontWeight: 900 },
  cardText: { color: '#94a3b8', fontSize: 13, lineHeight: 1.8, minHeight: 72 },
  label: { display: 'block', color: '#cbd5e1', fontSize: 13, fontWeight: 800, margin: '14px 0 7px' },
  input: { width: '100%', boxSizing: 'border-box', padding: '12px 13px', borderRadius: 10, border: '1px solid #475569', background: '#0f172a', color: '#fff', outline: 'none' },
  fileInput: { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px dashed #64748b', background: '#0f172a', color: '#cbd5e1' },
  fileName: { marginTop: 8, padding: 9, borderRadius: 9, background: '#0f172a', color: '#93c5fd', fontSize: 12, overflowWrap: 'anywhere' },
  primaryButton: { width: '100%', marginTop: 15, padding: '12px 15px', border: 0, borderRadius: 10, background: '#2563eb', color: '#fff', fontWeight: 900, cursor: 'pointer' },
  restoreButton: { width: '100%', marginTop: 15, padding: '12px 15px', border: '1px solid #92400e', borderRadius: 10, background: '#78350f', color: '#fff', fontWeight: 900, cursor: 'pointer' },
  message: { marginTop: 18, borderRadius: 12, padding: '13px 16px', fontWeight: 800, fontSize: 13 },
  error: { background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.35)', color: '#fca5a5' },
  success: { background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.35)', color: '#6ee7b7' },
  info: { background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.35)', color: '#93c5fd' },
  historyCard: { marginTop: 18, background: '#1e293b', border: '1px solid #334155', borderRadius: 18, padding: 22 },
  historyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  clearButton: { padding: '8px 12px', borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#cbd5e1', cursor: 'pointer', fontWeight: 700 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 680 },
  empty: { padding: 24, textAlign: 'center', color: '#64748b' }
};
