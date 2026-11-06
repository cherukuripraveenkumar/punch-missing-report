'use strict';

/* =====================================================================
   PUNCH MISSING REPORT
   Everything is saved in the phone's browser (localStorage).
   You can change the default project, guards and places below.
   ===================================================================== */

const DEFAULT_PROJECT = '3185-Veligonda Tunnel-2';

const DEFAULT_GUARDS = [
  { ebill: '17406', name: 'V Chinnaiah',     shift: 'Night', location: 'Gate 2' },
  { ebill: '35031', name: 'G Nagarjuna',     shift: 'Day',   location: 'Rounding' },
  { ebill: '46197', name: 'K Mahesh Naik',   shift: 'Day',   location: 'S Plant' },
  { ebill: '35032', name: 'M.Narasimhulu',   shift: 'Night', location: 'B Plant' },
  { ebill: '9649',  name: 'T.Ananthaiah',    shift: 'Day',   location: 'Tunnel Gate' },
  { ebill: '13436', name: 'K Pradeep Kumar', shift: 'Day',   location: 'ESCamp' },
];

const DEFAULT_LOCATIONS = ['Gate 2', 'Rounding', 'S Plant', 'B Plant', 'Tunnel Gate', 'ESCamp'];

const STORAGE_KEY = 'punchReport.v1';

const REMARK = {
  out: 'Out Punch Approved',
  in: 'In Punch Approved',
  delay: 'Delay Punch Approved',
};

// Report columns: heading, width (% of page), alignment
const COLS = [
  { h: 'S.\nNo.', w: 4.6, a: 'c' },
  { h: 'Date', w: 7.6, a: 'c' },
  { h: 'Project code &\nproject name', w: 17.4, a: 'c' },
  { h: 'E-bill no.', w: 7.8, a: 'c' },
  { h: 'Name of security\nGuarding staff', w: 15, a: 'l' },
  { h: 'Shift', w: 5.4, a: 'c' },
  { h: 'Deployed\nlocation', w: 10.6, a: 'c' },
  { h: 'In time', w: 8.2, a: 'c' },
  { h: 'Out time', w: 8.2, a: 'c' },
  { h: 'Remarks', w: 15.2, a: 'c' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/* ---------------- small helpers ---------------- */
const $ = (sel) => document.querySelector(sel);
const pad2 = (n) => String(n).padStart(2, '0');
const clean = (s) => String(s || '').trim().replace(/\s+/g, ' ');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function xmlEsc(s) {
  return String(s ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
// "2026-10-21" -> "21.10.26"
function showDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}
// "19:20" -> "07:20 PM", "" -> "Missing"
function showTime(t) {
  if (!t) return 'Missing';
  const [h, m] = t.split(':').map(Number);
  return `${pad2(h % 12 || 12)}:${pad2(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}
function monthName(ym) {
  const [y, m] = ym.split('-');
  return `${MONTHS[+m - 1]} ${y}`;
}

let toastTimer;
function message(text, bad) {
  const el = $('#toast');
  el.textContent = text;
  el.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = bad ? 'bad' : ''; }, 3000);
}

/* ---------------- saved data ---------------- */
function freshData() {
  return {
    project: DEFAULT_PROJECT,
    guards: DEFAULT_GUARDS.map((g) => ({ ...g })),
    locations: [...DEFAULT_LOCATIONS],
    entries: [],
  };
}
function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (d && Array.isArray(d.entries) && Array.isArray(d.guards)) return d;
  } catch (e) { /* ignore and start fresh */ }
  return freshData();
}
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    message('Could not save on this phone. Storage may be full.', true);
    return false;
  }
}
let data = loadData();

/* ---------------- tabs ---------------- */
function openTab(name) {
  document.querySelectorAll('.tabs button').forEach((b) =>
    b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('on', t.id === 'tab-' + name));
  if (name === 'report') showReport();
  if (name === 'settings') showSettings();
  window.scrollTo(0, 0);
}

/* ---------------- add / edit form ---------------- */
let missType = 'out';
let shift = 'Day';
let editingId = null;
let remarkChanged = false;

function pick(groupId, value) {
  document.querySelectorAll(`#${groupId} button`).forEach((b) =>
    b.classList.toggle('on', b.dataset.v === value));
}
function setShift(v) { shift = v; pick('c-shift', v); }
function setType(v) {
  missType = v;
  pick('c-type', v);
  $('#w-in').classList.toggle('is-missing', v === 'in');
  $('#w-out').classList.toggle('is-missing', v === 'out');
  if (!remarkChanged) $('#f-remark').value = REMARK[v];
}

function findGuard(field, value) {
  const v = clean(value).toLowerCase();
  if (!v) return null;
  return data.guards.find((g) => String(g[field]).toLowerCase() === v) || null;
}
function fillGuard(g, typedIn) {
  if (!g) return;
  if (typedIn !== 'ebill') $('#f-ebill').value = g.ebill;
  if (typedIn !== 'name') $('#f-name').value = g.name;
  if (g.shift) setShift(g.shift);
  if (g.location) $('#f-loc').value = g.location;
}

function clearForm(keepDate) {
  const date = keepDate ? $('#f-date').value : '';
  editingId = null;
  remarkChanged = false;
  ['#f-ebill', '#f-name', '#f-loc', '#f-in', '#f-out'].forEach((s) => { $(s).value = ''; });
  $('#f-date').value = date || today();
  setShift('Day');
  setType('out');
  $('#f-err').textContent = '';
  $('#formTitle').textContent = 'Add a missed punch';
  $('#btn-save').textContent = '✓ Save Entry';
  $('#btn-cancel').hidden = true;
}

function editEntry(id) {
  const e = data.entries.find((x) => x.id === id);
  if (!e) return;
  openTab('add');
  editingId = id;
  remarkChanged = true;
  $('#f-date').value = e.date;
  $('#f-ebill').value = e.ebill;
  $('#f-name').value = e.name;
  $('#f-loc').value = e.location;
  $('#f-in').value = e.in || '';
  $('#f-out').value = e.out || '';
  $('#f-remark').value = e.remark;
  setShift(e.shift);
  setType(e.type);
  $('#formTitle').textContent = 'Change this entry';
  $('#btn-save').textContent = '✓ Save Changes';
  $('#btn-cancel').hidden = false;
}

function saveEntry() {
  const f = {
    date: $('#f-date').value,
    ebill: clean($('#f-ebill').value),
    name: clean($('#f-name').value),
    location: clean($('#f-loc').value),
    in: missType === 'in' ? '' : $('#f-in').value,
    out: missType === 'out' ? '' : $('#f-out').value,
    remark: clean($('#f-remark').value) || REMARK[missType],
  };

  let problem = '';
  if (!f.date) problem = 'Please choose the date.';
  else if (!f.ebill) problem = "Please type the guard's E-bill No.";
  else if (!f.name) problem = "Please type the guard's name.";
  else if (!f.location) problem = 'Please type the deployed location.';
  else if (missType !== 'in' && !f.in) problem = 'Please enter the In time.';
  else if (missType !== 'out' && !f.out) problem = 'Please enter the Out time.';
  $('#f-err').textContent = problem;
  if (problem) { $('#f-err').scrollIntoView({ block: 'center' }); return; }

  const entry = { ...f, shift, type: missType };

  if (editingId) {
    const i = data.entries.findIndex((x) => x.id === editingId);
    const old = data.entries[i];
    data.entries[i] = { ...entry, id: old.id, at: old.at, project: old.project };
  } else {
    data.entries.push({
      ...entry,
      id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      at: Date.now(),
      project: data.project,
    });
  }

  // Remember this guard and place for next time
  const g = findGuard('ebill', entry.ebill);
  if (g) Object.assign(g, { name: entry.name, shift: entry.shift, location: entry.location });
  else data.guards.push({ ebill: entry.ebill, name: entry.name, shift: entry.shift, location: entry.location });
  if (!data.locations.some((l) => l.toLowerCase() === entry.location.toLowerCase())) {
    data.locations.push(entry.location);
  }

  const wasEditing = !!editingId;
  if (!saveData()) return;
  reportMonth = entry.date.slice(0, 7);
  fillLists();
  clearForm(true);
  if (wasEditing) {
    message('✓ Changes saved');
    openTab('report');
  } else {
    message(`✓ Saved: ${entry.name}, ${showDate(entry.date)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function deleteEntry(id) {
  const e = data.entries.find((x) => x.id === id);
  if (!e) return;
  if (!confirm(`Delete the entry for ${e.name} on ${showDate(e.date)}?`)) return;
  data.entries = data.entries.filter((x) => x.id !== id);
  saveData();
  showReport();
  message('Entry deleted');
}

function fillLists() {
  const guards = [...data.guards].sort((a, b) => a.name.localeCompare(b.name));
  $('#dl-ebill').innerHTML = guards.map((g) => `<option value="${esc(g.ebill)}">${esc(g.name)}</option>`).join('');
  $('#dl-name').innerHTML = guards.map((g) => `<option value="${esc(g.name)}">${esc(g.ebill)}</option>`).join('');
  $('#dl-loc').innerHTML = data.locations.map((l) => `<option value="${esc(l)}"></option>`).join('');
  $('#projectLine').textContent = data.project;
}

/* ---------------- report tab ---------------- */
let reportMonth = null;

function monthList() {
  const counts = { [today().slice(0, 7)]: 0 };
  data.entries.forEach((e) => {
    const m = e.date.slice(0, 7);
    counts[m] = (counts[m] || 0) + 1;
  });
  return Object.keys(counts).sort().reverse().map((m) => ({ m, n: counts[m] }));
}

function monthRows() {
  return data.entries
    .filter((e) => e.date.slice(0, 7) === reportMonth)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.at || 0) - (b.at || 0));
}

function showReport() {
  const months = monthList();
  if (!reportMonth || !months.some((x) => x.m === reportMonth)) reportMonth = months[0].m;
  $('#r-month').innerHTML = months
    .map((x) => `<option value="${x.m}">${monthName(x.m)} (${x.n} ${x.n === 1 ? 'entry' : 'entries'})</option>`)
    .join('');
  $('#r-month').value = reportMonth;

  const rows = monthRows();
  document.querySelectorAll('[data-dl], #btn-share').forEach((b) => { b.disabled = !rows.length; });
  $('#r-count').textContent = rows.length ? `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} in ${monthName(reportMonth)}` : '';
  $('#r-list').innerHTML = rows.length
    ? rows.map((e, i) => `
      <div class="entry">
        <div class="top"><span>${i + 1}. ${esc(e.name)} (${esc(e.ebill)})</span><span class="date">${showDate(e.date)}</span></div>
        <div class="info">${esc(e.shift)} shift · ${esc(e.location)}</div>
        <div class="info">In: <span class="${e.in ? '' : 'miss'}">${showTime(e.in)}</span> &nbsp;·&nbsp; Out: <span class="${e.out ? '' : 'miss'}">${showTime(e.out)}</span></div>
        <div class="info">${esc(e.remark)}</div>
        <div class="acts">
          <button type="button" data-edit="${e.id}">✏️ Change</button>
          <button type="button" class="del" data-del="${e.id}">🗑️ Delete</button>
        </div>
      </div>`).join('')
    : `<p class="empty">No missed punches in ${monthName(reportMonth)} yet.<br>Use the ➕ Add tab to add one.</p>`;
}

function reportTableRows() {
  return monthRows().map((e, i) => [
    String(i + 1), showDate(e.date), e.project || data.project, e.ebill, e.name,
    e.shift, e.location, showTime(e.in), showTime(e.out), e.remark,
  ]);
}

function fileName(ext) {
  const [y, m] = reportMonth.split('-');
  return `Security_Punch_Missing_${MONTHS[+m - 1].slice(0, 3)}-${y}.${ext}`;
}

/* ---------------- make the PDF ---------------- */
async function makePdf(rows) {
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const doc = await PDFDocument.create();
  doc.setTitle('Security Punch Missing Report');
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);

  const PW = 841.89, PH = 595.28;            // A4 landscape
  const M = 34, TW = PW - 2 * M;              // margin, table width
  const size = 10.5, lh = 12.6, pad = 5;
  const black = rgb(0, 0, 0), grey = rgb(0.953, 0.953, 0.953);
  const widths = COLS.map((c) => (c.w / 100) * TW);
  let page, y;

  const safe = (s) => String(s ?? '').replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '?');

  function wrap(text, f, max) {
    const out = [];
    safe(text).split('\n').forEach((para) => {
      let line = '';
      para.split(/\s+/).filter(Boolean).forEach((word) => {
        let w = word;
        while (f.widthOfTextAtSize(w, size) > max && w.length > 1) {
          let i = w.length;
          while (i > 1 && f.widthOfTextAtSize(w.slice(0, i), size) > max) i--;
          if (line) { out.push(line); line = ''; }
          out.push(w.slice(0, i));
          w = w.slice(i);
        }
        const t = line ? line + ' ' + w : w;
        if (f.widthOfTextAtSize(t, size) <= max) line = t;
        else { out.push(line); line = w; }
      });
      out.push(line);
    });
    return out;
  }
  function measure(cells, f) {
    const lines = cells.map((t, i) => wrap(t, f, widths[i] - 2 * pad));
    const n = Math.max(...lines.map((l) => l.length));
    return { lines, h: n * lh + 2 * pad + 2, f };
  }
  function drawRow(row, fill) {
    let x = M;
    row.lines.forEach((lines, i) => {
      const w = widths[i];
      const box = { x, y: y - row.h, width: w, height: row.h, borderColor: black, borderWidth: 0.8 };
      if (fill) box.color = fill;
      page.drawRectangle(box);
      const top = y - (row.h - lines.length * lh) / 2;
      lines.forEach((t, k) => {
        const tw = row.f.widthOfTextAtSize(t, size);
        const tx = COLS[i].a === 'l' ? x + pad : x + (w - tw) / 2;
        page.drawText(t, { x: tx, y: top - k * lh - lh / 2 - size * 0.32, size, font: row.f, color: black });
      });
      x += w;
    });
    y -= row.h;
  }

  const header = measure(COLS.map((c) => c.h), bold);
  page = doc.addPage([PW, PH]);
  y = PH - M;

  // Title
  const title = 'SECURITY PUNCH MISSING REPORT';
  const ts = 15, tw = bold.widthOfTextAtSize(title, ts), tx = (PW - tw) / 2, ty = y - ts;
  page.drawText(title, { x: tx, y: ty, size: ts, font: bold, color: black });
  page.drawLine({ start: { x: tx, y: ty - 2.5 }, end: { x: tx + tw, y: ty - 2.5 }, thickness: 1.1, color: black });
  y = ty - 16;

  drawRow(header, grey);
  rows.forEach((r, i) => {
    const row = measure(r, font);
    const isLast = i === rows.length - 1;
    // Start a new page if the row doesn't fit
    // (the last row also needs room for the signatures, so they are never alone on a page)
    if (y - row.h < M || (isLast && rows.length > 1 && y - row.h - 80 < M)) {
      page = doc.addPage([PW, PH]);
      y = PH - M;
      drawRow(header, grey);
    }
    drawRow(row);
  });

  // Signatures
  if (y - 80 < M) { page = doc.addPage([PW, PH]); y = PH - M; }
  y -= 70;
  page.drawText('AGENCY SIGNATURE', { x: M + 46, y, size: 11.5, font: bold, color: black });
  page.drawText('SIGNATURE OF HR/ADMIN', { x: M + TW * 0.58, y, size: 11.5, font: bold, color: black });

  const bytes = await doc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

/* ---------------- make the Word file ---------------- */
async function makeWord(rows) {
  const total = 16838 - 2 * 720;
  const widths = COLS.map((c) => Math.round((c.w / 100) * total));
  const runs = (t, isBold, sz) => t.split('\n').map((s, i) =>
    (i ? '<w:r><w:br/></w:r>' : '') +
    `<w:r><w:rPr><w:rFonts w:ascii="Bookman Old Style" w:hAnsi="Bookman Old Style" w:cs="Times New Roman"/>${isBold ? '<w:b/>' : ''}<w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${xmlEsc(s)}</w:t></w:r>`
  ).join('');
  const cell = (t, i, head) =>
    `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : ''}<w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p><w:pPr><w:spacing w:before="50" w:after="50" w:line="240" w:lineRule="auto"/><w:jc w:val="${COLS[i].a === 'l' && !head ? 'left' : 'center'}"/></w:pPr>${runs(t, head, 20)}</w:p></w:tc>`;
  const borders = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((s) => `<w:${s} w:val="single" w:sz="6" w:space="0" w:color="000000"/>`).join('') + '</w:tblBorders>';

  const table =
    `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:jc w:val="center"/>${borders}<w:tblLayout w:type="fixed"/>` +
    '<w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
    `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
    `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>${COLS.map((c, i) => cell(c.h, i, true)).join('')}</w:tr>` +
    rows.map((r) => `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="560"/></w:trPr>${r.map((t, i) => cell(t, i, false)).join('')}</w:tr>`).join('') +
    '</w:tbl>';

  const body =
    '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Bookman Old Style" w:hAnsi="Bookman Old Style"/><w:b/><w:u w:val="single"/><w:sz w:val="28"/></w:rPr><w:t>SECURITY PUNCH MISSING REPORT</w:t></w:r></w:p>' +
    table +
    `<w:p><w:pPr><w:keepNext/><w:spacing w:before="1300"/><w:tabs><w:tab w:val="left" w:pos="9300"/></w:tabs><w:ind w:left="700"/></w:pPr>${runs('AGENCY SIGNATURE', true, 22)}<w:r><w:tab/></w:r>${runs('SIGNATURE OF HR/ADMIN', true, 22)}</w:p>` +
    '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr>';

  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/* ---------------- make the Excel file ---------------- */
async function makeExcel(rows) {
  const col = (i) => String.fromCharCode(65 + i);
  const c = (ref, v, style, isNum) => isNum
    ? `<c r="${ref}" s="${style}"><v>${v}</v></c>`
    : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  const widths = [6, 10, 24, 10, 22, 8, 15, 11, 11, 22];

  let sheetRows =
    `<row r="1" ht="24" customHeight="1">${c('A1', 'SECURITY PUNCH MISSING REPORT', 3)}</row>` +
    `<row r="3" ht="32" customHeight="1">${COLS.map((h, i) => c(col(i) + '3', h.h.replace('\n', ' '), 2)).join('')}</row>` +
    rows.map((r, k) => {
      const n = k + 4;
      return `<row r="${n}">${r.map((t, i) => c(col(i) + n, i === 0 ? +t : t, 1, i === 0)).join('')}</row>`;
    }).join('');
  const sig = rows.length + 6;
  sheetRows += `<row r="${sig}">${c('B' + sig, 'AGENCY SIGNATURE', 4)}${c('H' + sig, 'SIGNATURE OF HR/ADMIN', 4)}</row>`;

  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${NS}><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows}</sheetData><mergeCells count="1"><mergeCell ref="A1:J1"/></mergeCells><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToHeight="0"/></worksheet>`;
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><u/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${NS}><sheets><sheet name="Punch Missing" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.file('xl/worksheets/sheet1.xml', sheet);
  zip.file('xl/styles.xml', styles);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/* ---------------- download & share ---------------- */
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function makeFile(kind) {
  const rows = reportTableRows();
  if (kind === 'pdf') return makePdf(rows);
  if (kind === 'docx') return makeWord(rows);
  return makeExcel(rows);
}

async function onDownload(kind, btn) {
  if (!monthRows().length) return message('No entries in this month.', true);
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Please wait…';
  try {
    const name = fileName(kind);
    downloadBlob(await makeFile(kind), name);
    message('✓ Downloaded ' + name);
  } catch (e) {
    message('Could not make the file. Please try again.', true);
    console.error(e);
  }
  btn.disabled = false;
  btn.textContent = label;
}

async function onShare(btn) {
  if (!monthRows().length) return message('No entries in this month.', true);
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Please wait…';
  try {
    const file = new File([await makeFile('pdf')], fileName('pdf'), { type: 'application/pdf' });
    await navigator.share({ files: [file], title: 'Security Punch Missing Report – ' + monthName(reportMonth) });
  } catch (e) {
    if (e && e.name !== 'AbortError') message('Could not share. Use Download PDF instead.', true);
  }
  btn.disabled = false;
  btn.textContent = label;
}

function canShareFiles() {
  try {
    return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] }));
  } catch (e) { return false; }
}

/* ---------------- settings tab ---------------- */
function showSettings() {
  $('#s-project').value = data.project;
  const guards = [...data.guards].sort((a, b) => a.name.localeCompare(b.name));
  $('#s-guards').innerHTML = guards.length
    ? guards.map((g) => `
      <div class="guard">
        <div><strong>${esc(g.name)}</strong><small>E-bill ${esc(g.ebill)} · ${esc(g.shift || '')} · ${esc(g.location || '')}</small></div>
        <button type="button" data-gdel="${esc(g.ebill)}">Remove</button>
      </div>`).join('')
    : '<p class="help">No guards yet.</p>';
}

function backup() {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  downloadBlob(blob, `punch-report-backup-${today()}.json`);
  message('✓ Backup file saved');
}

function restore(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!d || !Array.isArray(d.entries) || !Array.isArray(d.guards)) throw new Error('bad file');
      if (!confirm(`Replace everything on this phone with the backup (${d.entries.length} entries)?`)) return;
      data = d;
      saveData();
      fillLists();
      showSettings();
      message('✓ Backup restored');
    } catch (e) {
      message('This is not a correct backup file.', true);
    }
  };
  reader.readAsText(file);
}

/* ---------------- connect buttons ---------------- */
function start() {
  document.querySelectorAll('.tabs button').forEach((b) =>
    b.addEventListener('click', () => openTab(b.dataset.tab)));

  $('#c-shift').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setShift(b.dataset.v); });
  $('#c-type').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setType(b.dataset.v); });
  $('#f-ebill').addEventListener('input', (e) => fillGuard(findGuard('ebill', e.target.value), 'ebill'));
  $('#f-name').addEventListener('input', (e) => fillGuard(findGuard('name', e.target.value), 'name'));
  $('#f-remark').addEventListener('input', (e) => { remarkChanged = !!e.target.value; });
  $('#btn-save').addEventListener('click', saveEntry);
  $('#btn-cancel').addEventListener('click', () => { clearForm(false); openTab('report'); });

  $('#r-month').addEventListener('change', (e) => { reportMonth = e.target.value; showReport(); });
  document.querySelectorAll('[data-dl]').forEach((b) =>
    b.addEventListener('click', () => onDownload(b.dataset.dl, b)));
  if (canShareFiles()) {
    $('#btn-share').hidden = false;
    $('#btn-share').addEventListener('click', (e) => onShare(e.currentTarget));
  }
  $('#r-list').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.edit) editEntry(b.dataset.edit);
    if (b.dataset.del) deleteEntry(b.dataset.del);
  });

  $('#btn-project').addEventListener('click', () => {
    const v = clean($('#s-project').value);
    if (!v) return message('Please type the project name.', true);
    data.project = v;
    saveData();
    fillLists();
    message('✓ Project name saved');
  });
  $('#s-guards').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-gdel]');
    if (!b) return;
    const g = data.guards.find((x) => x.ebill === b.dataset.gdel);
    if (!g || !confirm(`Remove ${g.name} from the guard list?`)) return;
    data.guards = data.guards.filter((x) => x !== g);
    saveData();
    fillLists();
    showSettings();
  });
  $('#btn-backup').addEventListener('click', backup);
  $('#f-restore').addEventListener('change', (e) => {
    if (e.target.files[0]) restore(e.target.files[0]);
    e.target.value = '';
  });

  fillLists();
  clearForm(false);
}

start();
