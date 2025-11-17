

const WORKERS_KEY = "workers";
const SELECTED_KEY = "selectedWorkers";
const LOGO_KEY = "companyLogo";

localforage.config({ name: "modern-worker-manager" });

function safeText(s) { return s === undefined || s === null ? "" : String(s); }
function ddmmyyyyFromISO(iso) {
  if (!iso) return (() => {
    const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  })();
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(iso)) return iso;
  const d = new Date(iso); if (!isNaN(d)) return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  return iso;
}
function setStatus(msg = "", isError = false) {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? "crimson" : "";
}


async function loadWorkers() { const v = await localforage.getItem(WORKERS_KEY); return Array.isArray(v) ? v : []; }
async function saveWorkers(list) { await localforage.setItem(WORKERS_KEY, Array.isArray(list) ? list : []); await populateDropdown(); }
async function loadSelected() { const v = await localforage.getItem(SELECTED_KEY); return Array.isArray(v) ? v : []; }
async function saveSelected(list) { await localforage.setItem(SELECTED_KEY, Array.isArray(list) ? list : []); await renderSelectedTable(); }
async function loadLogo() { return await localforage.getItem(LOGO_KEY); }
async function saveLogoDataUrl(dataUrl) { if (!dataUrl) await localforage.removeItem(LOGO_KEY); else await localforage.setItem(LOGO_KEY, dataUrl); }


async function populateDropdown() {
  const dd = document.getElementById("workers-dropdown");
  if (!dd) return;
  const workers = await loadWorkers();
  dd.innerHTML = `<option value="">Choose worker...</option>`;
  workers.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w.id; opt.textContent = `${w.name} (${w.id})`;
    dd.appendChild(opt);
  });
}


function clearForm() {
  ['worker-id', 'worker-name', 'worker-position', 'worker-hours'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
}
async function addOrUpdateWorker() {
  const id = (document.getElementById("worker-id").value || "").trim();
  const name = (document.getElementById("worker-name").value || "").trim();
  const pos = (document.getElementById("worker-position").value || "").trim();
  const hrs = (document.getElementById("worker-hours").value || "").trim();
  if (!id || !name) { setStatus("ID and Name are required", true); return; }
  const workers = await loadWorkers();
  const idx = workers.findIndex(w => w.id === id);
  const rec = { id, name, position: pos, hours: hrs };
  if (idx >= 0) { workers[idx] = rec; setStatus("Worker updated"); } else { workers.push(rec); setStatus("Worker added"); }
  await saveWorkers(workers); clearForm();
}
async function deleteWorker() {
  const id = (document.getElementById("worker-id").value || "").trim();
  if (!id) { setStatus("Enter ID to delete", true); return; }
  let workers = await loadWorkers();
  const before = workers.length;
  workers = workers.filter(w => w.id !== id);
  if (workers.length === before) { setStatus("No worker found with that ID", true); return; }
  await saveWorkers(workers); setStatus("Worker deleted"); clearForm();
}


async function addToSelected() {
  const sel = (document.getElementById("workers-dropdown").value || "").trim();
  if (!sel) { setStatus("Select worker to add", true); return; }
  const workers = await loadWorkers();
  const w = workers.find(x => x.id === sel);
  if (!w) return setStatus("Worker not found", true);
  const list = await loadSelected();
  if (list.find(x => x.id === w.id)) { setStatus("Already in selected list"); return; }
  list.push(w); await saveSelected(list); setStatus("Added to selected list");
}


async function addAllWorkersToSelected() {
  const workers = await loadWorkers();
  if (!workers || workers.length === 0) {
    setStatus("No stored workers to add", true);
    return;
  }

  const selected = await loadSelected();
  let added = 0;
  for (const w of workers) {
    if (!selected.find(s => s.id === w.id)) {
      selected.push(w);
      added++;
    }
  }

  if (added > 0) {
    await saveSelected(selected);
    setStatus(`Added ${added} worker${added > 1 ? 's' : ''} to the list`);
  } else {
    setStatus("All workers already in the list");
  }
}


async function clearSelected() { await saveSelected([]); setStatus("Selected list cleared"); }
async function removeSelectedById(id) { let list = await loadSelected(); list = list.filter(x => x.id !== id); await saveSelected(list); setStatus("Removed"); }


let currentFilter = "";
let currentSort = { col: null, dir: 1 };

function ensureSearchBar() {
  const container = document.getElementById("selected-list-container");
  if (!container) return;
  if (document.getElementById("selected-search")) return;
  const wrapper = document.createElement("div");
  wrapper.className = "p-2 flex gap-2 items-center";
  wrapper.innerHTML = `<input id="selected-search" placeholder="Search ID or name..." class="p-2 border rounded flex-1" />
                       <button id="selected-refresh" class="bg-gray-200 px-3 py-1 rounded">Refresh</button>`;
  container.parentNode.insertBefore(wrapper, container);
  document.getElementById("selected-search").addEventListener("input", e => { currentFilter = e.target.value.toLowerCase().trim(); renderSelectedTable(); });
  document.getElementById("selected-refresh").addEventListener("click", () => { renderSelectedTable(); setStatus("Refreshed"); });
}

function applyResponsiveActionStyle() {

  const isSmall = window.matchMedia("(max-width:640px)").matches;
  document.querySelectorAll("#selected-table .action-group").forEach(div => {
    if (isSmall) {
      div.classList.add("flex", "flex-col", "gap-2");
      div.querySelectorAll("button").forEach(b => { b.classList.add("w-full"); });
    } else {
      div.classList.remove("flex", "flex-col", "gap-2");
      div.querySelectorAll("button").forEach(b => { b.classList.remove("w-full"); });
    }
  });
}

async function renderSelectedTable() {
  ensureSearchBar();
  const tbody = document.querySelector("#selected-table tbody");
  if (!tbody) return;
  let rows = await loadSelected();


  if (currentFilter) {
    rows = rows.filter(r => (r.id || "").toLowerCase().includes(currentFilter) || (r.name || "").toLowerCase().includes(currentFilter) || (r.position || "").toLowerCase().includes(currentFilter));
  }


  if (currentSort.col) {
    rows.sort((a, b) => {
      const A = safeText(a[currentSort.col]).toLowerCase();
      const B = safeText(b[currentSort.col]).toLowerCase();
      if (A < B) return -1 * currentSort.dir; if (A > B) return 1 * currentSort.dir; return 0;
    });
  }

  tbody.innerHTML = "";
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="p-3 border">${r.id}</td>
      <td class="p-3 border">${r.name}</td>
      <td class="p-3 border">${r.position || ""}</td>
      <td class="p-3 border">${r.hours || ""}</td>
      <td class="p-3 border">
        <div class="action-group">
          <button class="edit-btn bg-blue-500 text-white px-3 py-1 rounded text-sm" data-id="${r.id}">Edit</button>
          <button class="remove-btn bg-red-500 text-white px-3 py-1 rounded text-sm ml-2" data-id="${r.id}">Remove</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });


  tbody.querySelectorAll(".remove-btn").forEach(b => b.addEventListener("click", async (e) => { const id = e.currentTarget.dataset.id; await removeSelectedById(id); }));
  tbody.querySelectorAll(".edit-btn").forEach(b => b.addEventListener("click", async (e) => { const id = e.currentTarget.dataset.id; const workers = await loadWorkers(); const w = workers.find(x => x.id === id); if (!w) return setStatus("Worker not found", true); document.getElementById("worker-id").value = w.id; document.getElementById("worker-name").value = w.name; document.getElementById("worker-position").value = w.position || ""; document.getElementById("worker-hours").value = w.hours || ""; setStatus("Editing - update and Save"); }));


  const headers = document.querySelectorAll("#selected-table thead th");
  headers.forEach((th, idx) => {
    const map = ["id", "name", "position", "hours"];
    const key = map[idx];
    if (!key) return;
    th.style.cursor = "pointer";
    th.onclick = () => { if (currentSort.col === key) currentSort.dir = -currentSort.dir; else { currentSort.col = key; currentSort.dir = 1; } renderSelectedTable(); };
  });


  applyResponsiveActionStyle();
}


async function exportCSV() {
  const workers = await loadWorkers();
  if (!workers.length) { setStatus("No workers to export", true); return; }
  const header = ["id", "name", "position", "hours"].join(",");
  const rows = workers.map(w => [w.id, w.name, w.position, w.hours].map(x => `"${(x || "").toString().replace(/"/g, '""')}"`).join(","));
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "workers.csv"; a.click();
  setStatus("CSV exported");
}
async function importCSV(e) {
  const file = e?.target?.files?.[0]; if (!file) { setStatus("No file selected", true); return; }
  const text = await file.text(); const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = cleaned.split("\n").filter(l => l.trim()); if (!lines.length) { setStatus("CSV empty", true); e.target.value = null; return; }
  const header = lines.shift(); const delim = [",", ";", "\t"].reduce((best, d) => (header.split(d).length > header.split(best).length ? d : best), ",");
  function parseLine(line) {
    const out = []; let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; continue; }
      if (!inQ && ch === delim) { out.push(cur); cur = ""; continue; } cur += ch;
    } out.push(cur); return out.map(s => s.replace(/^"|"$/g, "").trim());
  }
  const headers = parseLine(header).map(h => h.toLowerCase().trim());
  const idx = { id: headers.indexOf("id") !== -1 ? headers.indexOf("id") : 0, name: headers.indexOf("name") !== -1 ? headers.indexOf("name") : 1, position: headers.indexOf("position") !== -1 ? headers.indexOf("position") : 2, hours: headers.indexOf("hours") !== -1 ? headers.indexOf("hours") : 3 };
  const workers = await loadWorkers(); let added = 0, updated = 0, skipped = 0;
  for (const l of lines) {
    if (!l.trim()) continue;
    const cols = parseLine(l);
    const rec = { id: safeText(cols[idx.id]), name: safeText(cols[idx.name]), position: safeText(cols[idx.position]), hours: safeText(cols[idx.hours]) };
    if (!rec.id || !rec.name) { skipped++; continue; }
    const ex = workers.findIndex(w => w.id === rec.id);
    if (ex >= 0) { workers[ex] = rec; updated++; } else { workers.push(rec); added++; }
  }
  await saveWorkers(workers); setStatus(`CSV imported — added:${added} updated:${updated} skipped:${skipped}`); e.target.value = null;
}


async function downloadJSON() { const workers = await loadWorkers(); const blob = new Blob([JSON.stringify(workers, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "workers.json"; a.click(); setStatus("JSON backup downloaded"); }


async function handleLogoUpload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => { await saveLogoDataUrl(reader.result); await renderLogo(); setStatus("Logo uploaded"); };
  reader.readAsDataURL(file);
}
async function renderLogo() {
  const area = document.getElementById("logo-area"); if (!area) return; area.innerHTML = "";
  const data = await loadLogo(); if (!data) return;
  const img = document.createElement("img"); img.src = data; img.style.maxHeight = "60px"; img.style.objectFit = "contain"; area.appendChild(img);
}


async function exportPDF() {
  const selected = await loadSelected();
  if (!selected.length) { setStatus("No rows to export", true); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });


  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let cursorY = 30;


  const logoData = await loadLogo();
  if (logoData) {
    try {

      const img = new Image();
      img.src = logoData;
      await new Promise((res) => { img.onload = res; img.onerror = res; });
      const maxW = 300; const maxH = 80;
      let w = img.width, h = img.height;
      const ratio = Math.min(maxW / w, maxH / h, 1);
      w = w * ratio; h = h * ratio;
      const x = (pageWidth - w) / 2;
      doc.addImage(logoData, "PNG", x, cursorY, w, h);
      cursorY += h + 12;
    } catch (e) { console.warn("logo add failed", e); }
  }


  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Workers Overtime Report", margin, cursorY + 8);


  const rawDate = document.getElementById("export-date-input").value;
  const ddmm = ddmmyyyyFromISO(rawDate);
  doc.setFontSize(11); doc.setFont("helvetica", "normal");
  doc.text(`Date: ${ddmm}`, pageWidth - margin - doc.getTextWidth(`Date: ${ddmm}`), cursorY + 8);

  cursorY += 30;


  const body = selected.map(r => [r.id, r.name, r.position || "", r.hours || ""]);


doc.autoTable({
  startY: cursorY,
  head: [["PID","Name","Position","Hours"]],
  body,
  theme: "plain", 
  styles: {
    fontSize: 11,
    cellPadding: 8,
    textColor: 20,
    overflow: 'linebreak',
    valign: 'middle'
  },
  headStyles: {
    fillColor: [14,165,164], 
    textColor: 255,
    fontStyle: 'bold'
  },
  alternateRowStyles: {
    fillColor: [245, 250, 250]
  },
  columnStyles: {
    1: { fontStyle: 'bold' } 
  },
  tableLineColor: [220,220,225],
  tableLineWidth: 0.4,
  margin: { left: margin, right: margin },

  didDrawPage: function (data) {
    const pageCount = doc.internal.getNumberOfPages();
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Generated on ${ddmm}`, margin, doc.internal.pageSize.getHeight() - 30);
    const pageStr = `Page ${doc.internal.getCurrentPageInfo().pageNumber} of ${pageCount}`;
    doc.text(pageStr, pageWidth - margin - doc.getTextWidth(pageStr), doc.internal.pageSize.getHeight() - 30);
  }
});



  const filename = `workers-${ddmm}.pdf`;
  doc.save(filename);
  setStatus(`PDF exported as ${filename}`);
}



async function exportImage() {
  const selected = await loadSelected();
  if (!selected.length) { setStatus("No selected rows to export (image)", true); return; }


  const padding = 40;
  const headerH = 110; 
  const rowH = 28;
  const colWidths = [90, 240, 150, 90];
  const contentW = colWidths.reduce((a,b)=>a+b,0);
  const canvasW = Math.min(1123, contentW + padding*2); 
  const canvasH = padding*2 + headerH + (selected.length * rowH) + 40;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");


  ctx.fillStyle = "#fff";
  ctx.fillRect(0,0,canvasW,canvasH);

  let y = padding;


  const logoData = await loadLogo();
  if(logoData){
    await new Promise(res=>{
      const img = new Image(); img.onload = ()=>{
        const maxW = 320, maxH = 80;
        let w=img.width, h=img.height; const ratio = Math.min(maxW/w, maxH/h, 1);
        w*=ratio; h*=ratio;
        const x = (canvasW - w)/2;
        ctx.drawImage(img, x, y, w, h);
        y += h + 10; res();
      };
      img.onerror = ()=>{ res(); };
      img.src = logoData;
    });
  } else {
    y += 10;
  }


  ctx.fillStyle = "#111827";
  ctx.font = "bold 18px Arial";
  ctx.fillText("Workers Overtime Report", padding, y + 6);

  const rawDate = document.getElementById("export-date-input").value;
  const ddmm = ddmmyyyyFromISO(rawDate);
  ctx.font = "12px Arial";
  ctx.fillText(`Date: ${ddmm}`, canvasW - padding - ctx.measureText(`Date: ${ddmm}`).width, y + 6);
  y += 30;


  const tableX = padding; 
  const tableW = canvasW - padding*2;
  ctx.fillStyle = "#e6f0fb";
  ctx.fillRect(tableX, y, tableW, rowH);


  ctx.fillStyle = "#0b63b8";
  ctx.font = "600 12px Arial";
  let x = tableX;
  const headers = ["PID","Name","Position","Hours"];
  for(let i=0;i<headers.length;i++){
    ctx.fillText(headers[i], x + 6, y + 18);
    x += colWidths[i];
  }
  y += rowH;


  ctx.font = "12px Arial";
  for(let i=0;i<selected.length;i++){
    const r = selected[i];
    if(i%2===0){ ctx.fillStyle = "#ffffff"; } 
    else { ctx.fillStyle = "#f8fafc"; ctx.fillRect(tableX, y, tableW, rowH); }

    ctx.fillStyle = "#111827";
    x = tableX;


    ctx.fillText(safeText(r.id), x + 6, y + 18); 
    x += colWidths[0];


    drawWrapText(ctx, safeText(r.name), x + 6, y + 6, colWidths[1] - 12, 14);
    x += colWidths[1];


    drawWrapText(ctx, safeText(r.position||""), x + 6, y + 6, colWidths[2] - 12, 14);
    x += colWidths[2];


    ctx.fillText(safeText(r.hours||""), x + 6, y + 18);

    y += rowH;
  }


  canvas.toBlob(blob=>{
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `workers-${ddmm}.png`;
    a.click();
    setStatus("Image exported");
  }, "image/png", 1.0);


  function drawWrapText(ctx, text, x, y, maxWidth, lineHeight){
    const words = text.split(/\s+/);
    let line=""; let curY = y + 12;
    for(let i=0;i<words.length;i++){
      const test = line + words[i] + " ";
      if(ctx.measureText(test).width > maxWidth && i>0){
        ctx.fillText(line.trim(), x, curY);
        line = words[i] + " ";
        curY += lineHeight;
      } else {
        line = test;
      }
    }
    if(line) ctx.fillText(line.trim(), x, curY);
  }
}



async function clearAll() { if (!confirm("Clear all data?")) return; await localforage.clear(); await populateDropdown(); await saveSelected([]); await renderLogo(); setStatus("Cleared all data"); }


async function init() {
  try {
    await populateDropdown();
    await renderSelectedTable();
    await renderLogo();

  const dateInput = document.getElementById("export-date-input");
    const now = new Date();
    dateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const display = document.getElementById("export-date-display");
    if (display) display.textContent = ddmmyyyyFromISO(dateInput.value);
    dateInput.addEventListener("input", () => { if (display) display.textContent = ddmmyyyyFromISO(dateInput.value); });

  document.getElementById("add-worker").onclick = addOrUpdateWorker;
    document.getElementById("delete-worker").onclick = deleteWorker;
    document.getElementById("clear-form").onclick = clearForm;

    document.getElementById("add-selected").onclick = addToSelected;
    document.getElementById("clear-list").onclick = clearSelected;

    const addAllBtn = document.getElementById("add-all-workers");
    if (addAllBtn) addAllBtn.onclick = addAllWorkersToSelected;


    document.getElementById("export-csv").onclick = exportCSV;
    document.getElementById("import-csv").onchange = importCSV;
    document.getElementById("download-json").onclick = downloadJSON;
    document.getElementById("clear-storage").onclick = clearAll;

    document.getElementById("export-pdf").onclick = exportPDF;
    document.getElementById("export-image").onclick = exportImage;

  document.getElementById("logo-input").onchange = (e) => { if (e.target.files && e.target.files[0]) handleLogoUpload(e.target.files[0]); };
    document.getElementById("clear-logo").onclick = async () => { await saveLogoDataUrl(null); await renderLogo(); setStatus("Logo cleared"); };

  window.addEventListener("resize", () => { applyResponsiveActionStyle(); });
    applyResponsiveActionStyle();
    setStatus("Ready");
  } catch (err) {
    console.error("init error", err);
    setStatus("Initialization failed: " + (err && err.message), true);
  }
}

init();
