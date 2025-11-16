// script.js — updated: Remove button in each data row (last cell) with "Remove" text,
// exclude-from-export class so export won't include it

const WORKERS_KEY = 'workers';
const SELECTED_LIST_KEY = 'selectedList';
const LOGO_KEY = 'companyLogoDataUrl';

if (typeof localforage !== 'undefined') localforage.config({ name: 'workerManager' });

/* ------------------------- Helpers ------------------------- */
function setStatus(text = '', isError = false) {
  const s = document.getElementById('status');
  if (!s) return;
  s.textContent = text;
  s.style.color = isError ? '#b91c1c' : '';
}
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"'`=\/]/g, function (s) {
    return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#47;','`':'&#96;','=':'&#61;'})[s];
  });
}
function setExportButtonsDisabled(disabled = true) {
  const ids = ['export-image','export-pdf','export-csv','download-json'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.disabled = disabled; el.style.opacity = disabled ? '0.6' : ''; el.style.pointerEvents = disabled ? 'none' : ''; }
  });
}
function ensureLibs() {
  const missing = [];
  if (typeof localforage === 'undefined') missing.push('localforage');
  if (typeof html2canvas === 'undefined') missing.push('html2canvas');
  if (typeof window.html2pdf === 'undefined') missing.push('html2pdf');
  if (missing.length) {
    setStatus('Missing libraries: ' + missing.join(', ') + '. Check CDN in index.html.', true);
    console.warn('Missing libs:', missing);
    return false;
  }
  return true;
}
function waitForImages(root) {
  const imgs = Array.from((root || document).querySelectorAll('img'));
  if (!imgs.length) return Promise.resolve();
  return Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
    return new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 5000);
    });
  }));
}

/* ------------------------- Storage ------------------------- */
async function loadWorkers() {
  try {
    if (typeof localforage === 'undefined') return [];
    const v = await localforage.getItem(WORKERS_KEY);
    return Array.isArray(v) ? v : [];
  } catch (e) { console.error(e); setStatus('Storage read error', true); return []; }
}
async function saveWorkers(list) {
  try {
    if (typeof localforage === 'undefined') return;
    await localforage.setItem(WORKERS_KEY, list || []);
    await populateDropdown();
  } catch (e) { console.error(e); setStatus('Storage write error', true); }
}
async function loadSelectedList() {
  try {
    if (typeof localforage === 'undefined') return [];
    const v = await localforage.getItem(SELECTED_LIST_KEY);
    return Array.isArray(v) ? v : [];
  } catch (e) { console.error(e); setStatus('Storage read error', true); return []; }
}
async function saveSelectedList(list) {
  try {
    if (typeof localforage === 'undefined') return;
    await localforage.setItem(SELECTED_LIST_KEY, list || []);
    await renderSelectedTable();
  } catch (e) { console.error(e); setStatus('Storage write error', true); }
}
async function loadLogo() {
  try {
    if (typeof localforage === 'undefined') return;
    const dataUrl = await localforage.getItem(LOGO_KEY);
    const logoArea = document.getElementById('logo-area');
    if (!logoArea) return;
    logoArea.innerHTML = '';
    if (dataUrl) {
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = 'Company Logo';
      img.style.maxHeight = '80px';
      img.style.objectFit = 'contain';
      try { img.loading = 'eager'; } catch (e) {}
      logoArea.appendChild(img);
    }
  } catch (e) { console.error('loadLogo', e); }
}
async function saveLogo(dataUrl) {
  try {
    if (typeof localforage === 'undefined') return;
    if (!dataUrl) { await localforage.removeItem(LOGO_KEY); await loadLogo(); return; }
    await localforage.setItem(LOGO_KEY, dataUrl); await loadLogo();
  } catch (e) { console.error('saveLogo', e); setStatus('Logo save error', true); }
}

/* ------------------------- UI rendering ------------------------- */
async function populateDropdown() {
  const dropdown = document.getElementById('workers-dropdown');
  if (!dropdown) return;
  const workers = await loadWorkers();
  dropdown.innerHTML = '<option value="">-- Select a worker to add to list --</option>';
  for (const w of workers) {
    const opt = document.createElement('option'); opt.value = w.id; opt.textContent = `${w.name} (${w.id})`; dropdown.appendChild(opt);
  }
}

async function renderSelectedTable() {
  const tbody = document.querySelector('#selected-table tbody');
  if (!tbody) return;
  const selected = await loadSelectedList();
  tbody.innerHTML = '';

  for (const w of selected) {
    const tr = document.createElement('tr');

    // create cells for data
    const tdId = document.createElement('td');
    tdId.className = 'border p-2';
    tdId.textContent = w.id || '';
    tr.appendChild(tdId);

    const tdName = document.createElement('td');
    tdName.className = 'border p-2';
    tdName.textContent = w.name || '';
    tr.appendChild(tdName);

    const tdPos = document.createElement('td');
    tdPos.className = 'border p-2';
    tdPos.textContent = w.position || '';
    tr.appendChild(tdPos);

    const tdHours = document.createElement('td');
    tdHours.className = 'border p-2';
    tdHours.textContent = w.workHours || '';
    tr.appendChild(tdHours);

    // action cell with Remove button (text "Remove")
    const tdAction = document.createElement('td');
    tdAction.className = 'border p-2 text-center';
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.setAttribute('data-remove-id', w.id);
    // mark UI-only button to be excluded from export
    btn.className = 'exclude-from-export bg-red-500 text-white px-3 py-1 rounded text-sm remove-selected-btn';
    btn.title = 'Remove from selected list';
    tdAction.appendChild(btn);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  }

  // attach remove handlers
  tbody.querySelectorAll('.remove-selected-btn').forEach(btn => btn.addEventListener('click', async (e) => {
    const id = e.currentTarget.getAttribute('data-remove-id'); if (!id) return;
    let list = await loadSelectedList(); list = list.filter(x => x.id !== id); await saveSelectedList(list);
    setStatus('Removed from list');
  }));
}

/* ------------------------- Form handlers ------------------------- */
function clearForm() { ['worker-id','worker-name','worker-position','worker-hours'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); setStatus(''); }
async function onAddWorker() {
  const id = (document.getElementById('worker-id')?.value || '').trim();
  const name = (document.getElementById('worker-name')?.value || '').trim();
  const position = (document.getElementById('worker-position')?.value || '').trim();
  const workHours = (document.getElementById('worker-hours')?.value || '').trim();
  if (!id || !name) { setStatus('ID and Name required', true); return; }
  const workers = await loadWorkers();
  const idx = workers.findIndex(w => w.id === id);
  const rec = { id, name, position, workHours };
  if (idx >= 0) { workers[idx] = rec; setStatus('Worker updated'); } else { workers.push(rec); setStatus('Worker added'); }
  await saveWorkers(workers); clearForm();
}
async function onDeleteWorker() {
  const id = (document.getElementById('worker-id')?.value || '').trim();
  if (!id) { setStatus('Enter worker ID to delete', true); return; }
  const workers = await loadWorkers();
  const rem = workers.filter(w => w.id !== id);
  if (rem.length === workers.length) { setStatus('No worker with that ID', true); return; }
  await saveWorkers(rem); setStatus('Worker deleted'); clearForm();
}
async function onDropdownChange(e) {
  const id = e?.target?.value || ''; if (!id) return;
  const workers = await loadWorkers(); const w = workers.find(x => x.id === id); if (!w) return;
  document.getElementById('worker-id').value = w.id; document.getElementById('worker-name').value = w.name;
  document.getElementById('worker-position').value = w.position || ''; document.getElementById('worker-hours').value = w.workHours || '';
}
async function onAddSelected() {
  const sel = document.getElementById('workers-dropdown')?.value || '';
  if (!sel) { setStatus('Choose a worker to add', true); return; }
  const workers = await loadWorkers(); const w = workers.find(x => x.id === sel); if (!w) { setStatus('Worker not found', true); return; }
  const list = await loadSelectedList(); if (!list.find(x => x.id === w.id)) { list.push(w); await saveSelectedList(list); setStatus('Worker added to list'); } else setStatus('Worker already in list');
}
async function onClearList() { await saveSelectedList([]); setStatus('Selected list cleared'); }

/* ------------------------- CSV / JSON ------------------------- */
async function onExportCsv() {
  try { setExportButtonsDisabled(true); const workers = await loadWorkers(); if (!workers.length) { setStatus('No workers to export'); return; }
    const header = ['id','name','position','workHours']; const rows = workers.map(w => header.map(h => `"${(w[h]||'').toString().replace(/"/g,'""')}"`).join(',')); const csv = [header.join(',')].concat(rows).join('\n');
    const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'workers.csv'; a.click(); URL.revokeObjectURL(url); setStatus('CSV exported');
  } catch (e) { console.error(e); setStatus('CSV export failed', true); } finally { setExportButtonsDisabled(false); }
}
async function onImportCsv(e) {
  try {
    const file = e?.target?.files?.[0];
    if (!file) { setStatus('No file selected', true); return; }

    setExportButtonsDisabled(true);
    setStatus('Reading file...');

    // Read as text (UTF-8). If file uses other encoding, this may still work.
    const text = await file.text();

    if (!text || !text.trim()) { setStatus('CSV file is empty', true); if (e?.target) e.target.value = null; return; }

    // Remove UTF-8 BOM if present
    const BOM_REGEX = /^\uFEFF/;
    const cleaned = text.replace(BOM_REGEX, '');

    // Normalise newlines
    const normalized = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split into lines but keep quoted fields intact — we'll parse each line robustly.
    const lines = normalized.split('\n').filter(l => l.trim() !== '');

    if (!lines.length) { setStatus('CSV contains no data', true); if (e?.target) e.target.value = null; return; }

    // Detect delimiter by sampling first few lines: prefer comma, else semicolon, else tab
    function detectDelimiter(sampleLines, candidates = [',',';','\t']) {
      const scores = {};
      candidates.forEach(d => scores[d] = 0);
      const sampleCount = Math.min(sampleLines.length, 5);
      for (let i=0;i<sampleCount;i++){
        const ln = sampleLines[i];
        candidates.forEach(d => {
          // Rough heuristic: count occurrences outside quotes
          let count = 0, inQ=false;
          for (let chIndex=0; chIndex<ln.length; chIndex++){
            const ch = ln[chIndex];
            if (ch === '"') { inQ = !inQ; continue; }
            if (!inQ && ch === d) count++;
          }
          scores[d] += count;
        });
      }
      // choose delimiter with highest score (fallback to comma)
      let best = candidates[0];
      candidates.forEach(d => { if (scores[d] > scores[best]) best = d; });
      return best;
    }

    const delimiter = detectDelimiter(lines.slice(0, Math.min(lines.length, 10)));
    // CSV parser that handles quoted fields and escaped quotes ("")
    function parseCsvLine(line, delim) {
      const fields = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          // if next is also quote, it's an escaped quote
          if (inQuotes && line[i+1] === '"') {
            cur += '"';
            i++; // skip next
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }
        if (!inQuotes && ch === delim) {
          fields.push(cur);
          cur = '';
          continue;
        }
        cur += ch;
      }
      fields.push(cur);
      // Trim surrounding spaces
      return fields.map(f => f.trim());
    }

    // First line is header (attempt)
    const headerLine = lines.shift();
    const headerCandidates = parseCsvLine(headerLine, delimiter).map(h => h.replace(/^"|"$/g,'').trim().toLowerCase());

    // Map header names to indexes
    const indexMap = {
      id: headerCandidates.indexOf('id'),
      name: headerCandidates.indexOf('name'),
      position: headerCandidates.indexOf('position'),
      workHours: headerCandidates.indexOf('workhours') !== -1 ? headerCandidates.indexOf('workhours') : headerCandidates.indexOf('hours')
    };

    // If header doesn't include expected columns, try heuristic (first 4 columns)
    if (indexMap.id === -1 || indexMap.name === -1) {
      // fallback: assume first two columns are id + name
      indexMap.id = indexMap.id === -1 ? 0 : indexMap.id;
      indexMap.name = indexMap.name === -1 ? 1 : indexMap.name;
      if (indexMap.position === -1) indexMap.position = 2;
      if (indexMap.workHours === -1) indexMap.workHours = 3;
    }

    const workers = await loadWorkers();

    let added = 0, updated = 0, skipped = 0;
    for (const rawLine of lines) {
      if (!rawLine.trim()) continue;
      const cols = parseCsvLine(rawLine, delimiter).map(c => c.replace(/^"|"$/g,'').trim());
      const rec = {
        id: cols[indexMap.id] || '',
        name: cols[indexMap.name] || '',
        position: cols[indexMap.position] || '',
        workHours: cols[indexMap.workHours] || ''
      };
      if (!rec.id || !rec.name) { skipped++; continue; }
      const existingIndex = workers.findIndex(w => w.id === rec.id);
      if (existingIndex >= 0) { workers[existingIndex] = rec; updated++; } else { workers.push(rec); added++; }
    }

    await saveWorkers(workers);
    setStatus(`CSV imported — added: ${added}, updated: ${updated}, skipped: ${skipped}`);
    if (e?.target) e.target.value = null;
  } catch (err) {
    console.error('CSV import error', err);
    setStatus('CSV import failed: ' + (err && err.message ? err.message : err), true);
    if (e?.target) e.target.value = null;
  } finally {
    setExportButtonsDisabled(false);
  }
}

async function onDownloadJson() {
  try { setExportButtonsDisabled(true); const workers = await loadWorkers(); const blob = new Blob([JSON.stringify(workers,null,2)],{type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'workers.json'; a.click(); URL.revokeObjectURL(url); setStatus('JSON backup downloaded'); }
  catch (e) { console.error(e); setStatus('JSON download failed', true); } finally { setExportButtonsDisabled(false); }
}

/* ------------------------- Logo ------------------------- */
async function onLogoUpload(e) {
  const file = e?.target?.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => { try { await saveLogo(reader.result); setStatus('Logo saved'); } catch (e) { console.error(e); setStatus('Logo save failed', true); } };
  reader.readAsDataURL(file);
}

/* ------------------------- Image / PDF export (unchanged) ------------------------- */
async function onExportImage() {
  if (!ensureLibs()) return;
  const exportElement = document.getElementById('export-area');
  if (!exportElement) { setStatus('Export area not found', true); return; }
  
  try {
    setExportButtonsDisabled(true);
    setStatus('Preparing image (waiting for images)...');

    // Update date display from input before capture
    const dateVal = document.getElementById('export-date-input')?.value || '';
    const dateDisp = document.getElementById('export-date-display');
    if (dateDisp) dateDisp.textContent = `Date: ${dateVal}`;

    await waitForImages(exportElement);

    const rect = exportElement.getBoundingClientRect();
    const fullWidth = Math.max(exportElement.scrollWidth, Math.ceil(rect.width));
    const fullHeight = Math.max(exportElement.scrollHeight, Math.ceil(rect.height));

    setStatus('Rendering image...');
    const canvas = await html2canvas(exportElement, {
      useCORS: true,
      backgroundColor: '#ffffff',
      width: fullWidth,
      height: fullHeight,
      windowWidth: fullWidth,
      windowHeight: fullHeight,
      scrollX: 0,
      scrollY: 0,
      scale: 2,
      ignoreElements: (element) => element.classList && element.classList.contains('exclude-from-export')
    });

    const dataUrl = canvas.toDataURL('image/png', 1.0);
    const a = document.createElement('a');
    a.href = dataUrl; a.download = 'workers.png'; a.click();
    setStatus('Image downloaded');
  } catch (e) {
    console.error('onExportImage error', e);
    setStatus('Image export failed: ' + (e?.message || e), true);
  } finally {
    setExportButtonsDisabled(false);
  }
}

async function onExportPdf() {
  if (!ensureLibs()) return;
  const exportElement = document.getElementById('export-area');
  if (!exportElement) { setStatus('Export area not found', true); return; }

  try {
    setExportButtonsDisabled(true);
    setStatus('Preparing PDF (waiting for images)...');

    // Update date display from input before capture
    const dateVal = document.getElementById('export-date-input')?.value || '';
    const dateDisp = document.getElementById('export-date-display');
    if (dateDisp) dateDisp.textContent = `Date: ${dateVal}`;

    await waitForImages(exportElement);

    setStatus('Generating PDF...');
    const opt = {
      margin: 0.4,
      filename: 'workers.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      html2canvas: {
        scale: 2,
        useCORS: true,
        ignoreElements: (element) => element.classList && element.classList.contains('exclude-from-export')
      }
    };

    await window.html2pdf().set(opt).from(exportElement).save();
    setStatus('PDF download started');
  } catch (e) {
    console.error('onExportPdf error', e);
    setStatus('PDF export failed: ' + (e?.message || e), true);
  } finally {
    setExportButtonsDisabled(false);
  }
}

/* ------------------------- Clear storage ------------------------- */
async function onClearStorage() {
  if (!confirm('Clear all data from this app on this device? This cannot be undone.')) return;
  try {
    if (typeof localforage !== 'undefined') await localforage.clear();
    await populateDropdown(); await saveSelectedList([]); await loadLogo();
    initializeDate();
    setStatus('All data cleared');
  } catch (e) { console.error(e); setStatus('Failed to clear storage', true); }
}

/* ------------------------- Date helper ------------------------- */
function initializeDate() {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  const dateString = new Date().toLocaleDateString(undefined, options);
  const dateInput = document.getElementById('export-date-input');
  const dateDisplay = document.getElementById('export-date-display');
  if (dateInput) dateInput.value = dateString;
  if (dateDisplay) dateDisplay.textContent = `Date: ${dateString}`;
}

/* ------------------------- Wiring & init ------------------------- */
function attachEventListeners() {
  document.getElementById('add-worker')?.addEventListener('click', onAddWorker);
  document.getElementById('delete-worker')?.addEventListener('click', onDeleteWorker);
  document.getElementById('clear-form')?.addEventListener('click', clearForm);
  document.getElementById('workers-dropdown')?.addEventListener('change', onDropdownChange);
  document.getElementById('add-selected')?.addEventListener('click', onAddSelected);
  document.getElementById('clear-list')?.addEventListener('click', onClearList);
  document.getElementById('export-image')?.addEventListener('click', onExportImage);
  document.getElementById('export-pdf')?.addEventListener('click', onExportPdf);
  document.getElementById('export-csv')?.addEventListener('click', onExportCsv);
  document.getElementById('download-json')?.addEventListener('click', onDownloadJson);
  document.getElementById('clear-storage')?.addEventListener('click', onClearStorage);
  document.getElementById('import-csv')?.addEventListener('change', onImportCsv);
  document.getElementById('logo-input')?.addEventListener('change', onLogoUpload);
  document.getElementById('clear-logo')?.addEventListener('click', async () => { await saveLogo(null); setStatus('Logo cleared'); });

  document.getElementById('export-date-input')?.addEventListener('input', (e) => {
    const dateDisplay = document.getElementById('export-date-display');
    if (dateDisplay) dateDisplay.textContent = `Date: ${e.target.value}`;
  });
}

(async function init(){
  try {
    attachEventListeners();
    await populateDropdown();
    const sel = await loadSelectedList(); await saveSelectedList(sel);
    await loadLogo();
    initializeDate();
    setStatus('Ready');
  } catch (e) {
    console.error('init error', e);
    setStatus('Initialization failed', true);
  }
})();
