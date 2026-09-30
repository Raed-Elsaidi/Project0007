// قارئ XLSX صغير بدون مكتبات خارجية: يدعم أوراق العمل الأولى، sharedStrings و inline strings.
// يعتمد على DecompressionStream المتوفر في المتصفحات الحديثة.

const decoder = new TextDecoder('utf-8');

function u16(view, o) { return view.getUint16(o, true); }
function u32(view, o) { return view.getUint32(o, true); }

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('المتصفح لا يدعم قراءة ملفات Excel المضغوطة. استخدم Chrome أو Edge حديثًا.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntries(buffer) {
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = view.byteLength - 22; i >= Math.max(0, view.byteLength - 65557); i--) {
    if (u32(view, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ملف Excel غير صالح أو غير مدعوم.');
  const cdSize = u32(view, eocd + 12);
  const cdOffset = u32(view, eocd + 16);
  const entries = new Map();
  let p = cdOffset;
  const end = cdOffset + cdSize;
  while (p < end) {
    if (u32(view, p) !== 0x02014b50) break;
    const method = u16(view, p + 10);
    const compressedSize = u32(view, p + 20);
    const uncompressedSize = u32(view, p + 24);
    const nameLen = u16(view, p + 28);
    const extraLen = u16(view, p + 30);
    const commentLen = u16(view, p + 32);
    const localOffset = u32(view, p + 42);
    const name = decoder.decode(new Uint8Array(buffer, p + 46, nameLen));
    const localNameLen = u16(view, localOffset + 26);
    const localExtraLen = u16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = new Uint8Array(buffer, dataStart, compressedSize);
    let data;
    if (method === 0) data = compressed;
    else if (method === 8) data = await inflateRaw(compressed);
    else throw new Error(`ضغط ZIP غير مدعوم للملف الداخلي ${name}.`);
    if (uncompressedSize && data.byteLength !== uncompressedSize) {
      // لا نفشل هنا لأن بعض ملفات XLSX تستخدم حقولًا غير دقيقة في حالات نادرة.
    }
    entries.set(name, data);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function xmlText(bytes) {
  return decoder.decode(bytes);
}

function colIndex(ref) {
  const letters = String(ref).match(/^[A-Z]+/i)?.[0] || 'A';
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

function cellValue(cell, sharedStrings) {
  const type = cell.getAttribute('t');
  const valueNode = cell.querySelector(':scope > v');
  const inlineNode = cell.querySelector(':scope > is t');
  if (type === 'inlineStr') return inlineNode?.textContent || '';
  const raw = valueNode?.textContent ?? '';
  if (type === 's') return sharedStrings[Number(raw)] ?? '';
  if (type === 'b') return raw === '1' ? true : false;
  return raw;
}

export async function readXlsxFile(file) {
  const buffer = await file.arrayBuffer();
  const entries = await readZipEntries(buffer);
  const workbookBytes = entries.get('xl/workbook.xml');
  const relsBytes = entries.get('xl/_rels/workbook.xml.rels');
  if (!workbookBytes || !relsBytes) throw new Error('تعذر قراءة بنية ملف Excel.');

  const parser = new DOMParser();
  const workbook = parser.parseFromString(xmlText(workbookBytes), 'application/xml');
  const rels = parser.parseFromString(xmlText(relsBytes), 'application/xml');
  const relMap = new Map();
  rels.querySelectorAll('Relationship').forEach((r) => relMap.set(r.getAttribute('Id'), r.getAttribute('Target')));

  const firstSheet = workbook.querySelector('sheet');
  if (!firstSheet) throw new Error('لم يتم العثور على ورقة داخل ملف Excel.');
  const target = relMap.get(firstSheet.getAttribute('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')) || relMap.get(firstSheet.getAttribute('r:id'));
  const sheetPath = target ? (target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.?\//, '')}`) : 'xl/worksheets/sheet1.xml';
  const sheetBytes = entries.get(sheetPath) || entries.get('xl/worksheets/sheet1.xml');
  if (!sheetBytes) throw new Error('تعذر قراءة ورقة Excel الأولى.');

  const sharedStrings = [];
  const sharedBytes = entries.get('xl/sharedStrings.xml');
  if (sharedBytes) {
    const sharedDoc = parser.parseFromString(xmlText(sharedBytes), 'application/xml');
    sharedDoc.querySelectorAll('si').forEach((si) => {
      sharedStrings.push(Array.from(si.querySelectorAll('t')).map(t => t.textContent).join(''));
    });
  }

  const sheetDoc = parser.parseFromString(xmlText(sheetBytes), 'application/xml');
  const rows = [];
  sheetDoc.querySelectorAll('sheetData > row').forEach((row) => {
    const values = [];
    row.querySelectorAll(':scope > c').forEach((cell) => {
      const ref = cell.getAttribute('r') || '';
      values[colIndex(ref)] = cellValue(cell, sharedStrings);
    });
    rows.push(values);
  });
  if (!rows.length) return [];
  const headers = rows[0].map((v, i) => String(v ?? '').trim() || `column_${i + 1}`);
  return rows.slice(1).filter(row => row.some(v => String(v ?? '').trim() !== '')).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
    return obj;
  });
}


export async function readTabularFile(file) {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.csv')) {
    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim() !== '');
    if (!lines.length) return [];
    const parseLine = (line) => {
      const out = [];
      let cell = '', quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (quoted && line[i + 1] === '"') { cell += '"'; i++; }
          else quoted = !quoted;
        } else if ((ch === ',' || ch === ';' || ch === '\t') && !quoted) {
          out.push(cell); cell = '';
        } else cell += ch;
      }
      out.push(cell);
      return out;
    };
    const headers = parseLine(lines[0]).map((v, i) => v.trim() || `column_${i + 1}`);
    return lines.slice(1).map(line => {
      const vals = parseLine(line); const row = {};
      headers.forEach((h, i) => row[h] = vals[i] ?? '');
      return row;
    });
  }
  if (name.endsWith('.xlsx')) return readXlsxFile(file);
  throw new Error('صيغة الملف المدعومة هي XLSX أو CSV. ملفات XLS القديمة غير مدعومة مباشرة؛ احفظها بصيغة XLSX أولًا.');
}
