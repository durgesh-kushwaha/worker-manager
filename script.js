const WORKERS_KEY = "workers";
const SELECTED_KEY = "selectedWorkers";
const LOGO_KEY = "companyLogo";
localforage.config({ name: "modern-worker-manager" });

function setStatus(msg = "", isError = false) {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? "crimson" : "";
}

function safeText(s) {
  return s === undefined || s === null ? "" : String(s);
}

function ddmmyyyyFromISO(iso) {
  if (!iso) {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (!isNaN(d)) return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  return iso;
}

async function loadWorkers() {
  const v = await localforage.getItem(WORKERS_KEY);
  return Array.isArray(v) ? v : [];
}
async function saveWorkers(list) {
  await localforage.setItem(WORKERS_KEY, Array.isArray(list) ? list : []);
  await populateDropdown();
}
async function loadSelected() {
  const v = await localforage.getItem(SELECTED_KEY);
  return Array.isArray(v) ? v : [];
}
async function saveSelected(list) {
  await localforage.setItem(SELECTED_KEY, Array.isArray(list) ? list : []);
  await renderSelectedTable();
}
async function loadLogo() {
  return await localforage.getItem(LOGO_KEY);
}
async function saveLogoDataUrl(dataUrl) {
  if (!dataUrl) await localforage.removeItem(LOGO_KEY);
  else await localforage.setItem(LOGO_KEY, dataUrl);
}

async function populateDropdown() {
  const dd = document.getElementById("workers-dropdown");
  if (!dd) return;
  const workers = await loadWorkers();
  dd.innerHTML = `<option value="">-- Select a worker to add to list --</option>`;
  workers.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = `${w.name} (${w.id})`;
    dd.appendChild(opt);
  });
}

function clearForm() {
  ["worker-id", "worker-name", "worker-position", "worker-hours"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

async function addOrUpdateWorker() {
  const id = (document.getElementById("worker-id").value || "").trim();
  const name = (document.getElementById("worker-name").value || "").trim();
  const position = (document.getElementById("worker-position").value || "").trim();
  const hours = (document.getElementById("worker-hours").value || "").trim();
  if (!id || !name) {
    setStatus("ID & Name required", true);
    return;
  }
  const workers = await loadWorkers();
  const idx = workers.findIndex(w => w.id === id);
  const rec = { id, name, position, hours };
  if (idx >= 0) workers[idx] = rec;
  else workers.push(rec);
  await saveWorkers(workers);
  setStatus(idx >= 0 ? "Worker updated" : "Worker added");
  clearForm();
}

async function deleteWorker() {
  const id = (document.getElementById("worker-id").value || "").trim();
  if (!id) {
    setStatus("Enter ID to delete", true);
    return;
  }
  let workers = await loadWorkers();
  const before = workers.length;
  workers = workers.filter(w => w.id !== id);
  if (workers.length === before) {
    setStatus("Worker not found", true);
    return;
  }
  await saveWorkers(workers);
  setStatus("Worker deleted");
  clearForm();
}

async function addToSelected() {
  const selId = (document.getElementById("workers-dropdown").value || "").trim();
  if (!selId) {
    setStatus("Select a worker to add", true);
    return;
  }
  const workers = await loadWorkers();
  const w = workers.find(x => x.id === selId);
  if (!w) {
    setStatus("Worker not found", true);
    return;
  }
  const list = await loadSelected();
  if (list.find(x => x.id === w.id)) {
    setStatus("Already in list");
    return;
  }
  list.push(w);
  await saveSelected(list);
  setStatus("Added to list");
}

async function clearSelected() {
  await saveSelected([]);
  setStatus("Selected list cleared");
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
    setStatus(`Added ${added} worker${added > 1 ? "s" : ""} to the list`);
  } else {
    setStatus("All workers already in the list");
  }
}

async function applyBulkHours() {
  const raw = document.getElementById("bulk-hours-input").value;
  const onlySelected = document.getElementById("bulk-only-selected").checked;
  const value = Number(raw);
  if (isNaN(value)) {
    setStatus("Enter valid hours", true);
    return;
  }
  if (onlySelected) {
    const sel = await loadSelected();
    if (!sel.length) {
      setStatus("Selected list empty", true);
      return;
    }
    for (const s of sel) s.hours = String(value);
    await saveSelected(sel);
    let workers = await loadWorkers();
    workers = workers.map(w => {
      const m = sel.find(x => x.id === w.id);
      return m ? { ...w, hours: m.hours } : w;
    });
    await saveWorkers(workers);
    setStatus("Applied hours to selected list (overwritten)");
    return;
  } else {
    const workers = await loadWorkers();
    for (const w of workers) w.hours = String(value);
    await saveWorkers(workers);
    const sel = await loadSelected();
    const updatedSel = sel.map(s => {
      const m = workers.find(w => w.id === s.id);
      return m ? { ...s, hours: m.hours } : s;
    });
    await saveSelected(updatedSel);
    setStatus("Applied hours to all workers (overwritten)");
    return;
  }
}

async function incrementBulkHours() {
  const onlySelected = document.getElementById("bulk-only-selected").checked;
  if (onlySelected) {
    const sel = await loadSelected();
    if (!sel.length) {
      setStatus("Selected list empty", true);
      return;
    }
    for (const s of sel) s.hours = String(Math.max(0, Number(s.hours || 0) + 1));
    await saveSelected(sel);
    let workers = await loadWorkers();
    workers = workers.map(w => {
      const m = sel.find(x => x.id === w.id);
      return m ? { ...w, hours: m.hours } : w;
    });
    await saveWorkers(workers);
    setStatus("Added +1 hour to selected list");
    return;
  } else {
    const workers = await loadWorkers();
    for (const w of workers) w.hours = String(Math.max(0, Number(w.hours || 0) + 1));
    await saveWorkers(workers);
    const sel = await loadSelected();
    const updatedSel = sel.map(s => {
      const m = workers.find(w => w.id === s.id);
      return m ? { ...s, hours: m.hours } : s;
    });
    await saveSelected(updatedSel);
    setStatus("Added +1 hour to all workers");
    return;
  }
}

async function removeSelectedById(id) {
  let list = await loadSelected();
  list = list.filter(x => x.id !== id);
  await saveSelected(list);
  setStatus("Removed from list");
}

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
  document.getElementById("selected-search").addEventListener("input", e => {
    currentFilter = e.target.value.trim().toLowerCase();
    renderSelectedTable();
  });
  document.getElementById("selected-refresh").addEventListener("click", () => {
    renderSelectedTable();
    setStatus("Refreshed");
  });
}

function applyResponsiveActionStyle() {
  const isSmall = window.matchMedia("(max-width:640px)").matches;
  document.querySelectorAll("#selected-table .action-group").forEach(div => {
    if (isSmall) {
      div.classList.add("flex", "flex-col", "gap-2");
      div.querySelectorAll("button").forEach(b => {
        b.classList.add("w-full");
      });
    } else {
      div.classList.remove("flex", "flex-col", "gap-2");
      div.querySelectorAll("button").forEach(b => {
        b.classList.remove("w-full");
      });
    }
  });
}

async function renderSelectedTable() {
  ensureSearchBar();
  const tbody = document.querySelector("#selected-table tbody");
  if (!tbody) return;
  const list = await loadSelected();
  let rows = list.filter(r => {
    if (!currentFilter) return true;
    return (r.id || "").toLowerCase().includes(currentFilter) || (r.name || "").toLowerCase().includes(currentFilter) || (r.position || "").toLowerCase().includes(currentFilter);
  });
  if (currentSort.col) {
    rows.sort((a, b) => {
      const A = safeText(a[currentSort.col]).toLowerCase();
      const B = safeText(b[currentSort.col]).toLowerCase();
      if (A < B) return -1 * currentSort.dir;
      if (A > B) return 1 * currentSort.dir;
      return 0;
    });
  }
  tbody.innerHTML = "";
  rows.forEach(w => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="p-3 border">${w.id}</td>
      <td class="p-3 border">${w.name}</td>
      <td class="p-3 border">${w.hours || ""}</td>
      <td class="p-3 border">${w.position || ""}</td>
      <td class="p-3 border">
        <div class="action-group">
          <button class="edit-btn bg-blue-500 text-white px-3 py-1 rounded text-sm" data-id="${w.id}">Edit</button>
          <button class="remove-btn bg-red-500 text-white px-3 py-1 rounded text-sm ml-2" data-id="${w.id}">Remove</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll(".remove-btn").forEach(btn => btn.addEventListener("click", async e => {
    const id = e.currentTarget.getAttribute("data-id");
    await removeSelectedById(id);
  }));
  tbody.querySelectorAll(".edit-btn").forEach(btn => btn.addEventListener("click", async e => {
    const id = e.currentTarget.getAttribute("data-id");
    const workers = await loadWorkers();
    const w = workers.find(x => x.id === id);
    if (!w) {
      setStatus("Worker record not found", true);
      return;
    }
    document.getElementById("worker-id").value = w.id;
    document.getElementById("worker-name").value = w.name;
    document.getElementById("worker-position").value = w.position || "";
    document.getElementById("worker-hours").value = w.hours || "";
    setStatus("Editing worker — update fields and click Save");
  }));
  const headers = document.querySelectorAll("#selected-table thead th");
  headers.forEach((th, idx) => {
    const keyMap = ["id", "name", "hours", "position"];
    const colKey = keyMap[idx];
    if (!colKey) return;
    th.style.cursor = "pointer";
    th.onmouseenter = () => th.style.background = "#f3f4f6";
    th.onmouseleave = () => th.style.background = "";
    th.onclick = () => {
      if (currentSort.col === colKey) currentSort.dir = -currentSort.dir;
      else {
        currentSort.col = colKey;
        currentSort.dir = 1;
      }
      renderSelectedTable();
    };
  });
  applyResponsiveActionStyle();
}

async function exportCSV() {
  const workers = await loadWorkers();
  if (!workers.length) {
    setStatus("No workers to export", true);
    return;
  }
  const header = ["id", "name", "position", "hours"].join(",");
  const rows = workers.map(w => [w.id, w.name, w.position, w.hours].map(x => `"${(x || "").toString().replace(/"/g, '""')}"`).join(","));
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "workers.csv";
  a.click();
  setStatus("CSV exported");
}

async function importCSV(e) {
  const file = e?.target?.files?.[0];
  if (!file) {
    setStatus("No file selected", true);
    return;
  }
  try {
    setStatus("Reading file...");
    const text = await file.text();
    const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = cleaned.split("\n").filter(l => l.trim());
    if (!lines.length) {
      setStatus("CSV empty", true);
      e.target.value = null;
      return;
    }
    function detectDelimiter(sampleLines) {
      const candidates = [",", ";", "\t"];
      const scores = { ",": 0, ";": 0, "\t": 0 };
      const sampleCount = Math.min(sampleLines.length, 5);
      for (let i = 0; i < sampleCount; i++) {
        const ln = sampleLines[i];
        let inQ = false;
        for (let j = 0; j < ln.length; j++) {
          const ch = ln[j];
          if (ch === '"') {
            inQ = !inQ;
            continue;
          }
          if (!inQ && scores.hasOwnProperty(ch)) scores[ch]++;
        }
      }
      let best = candidates[0];
      for (const c of candidates) if (scores[c] > scores[best]) best = c;
      return best;
    }
    const delim = detectDelimiter(lines.slice(0, Math.min(lines.length, 10)));
    function parseCsvLine(line, d) {
      const fields = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
            continue;
          }
          inQuotes = !inQuotes;
          continue;
        }
        if (!inQuotes && ch === d) {
          fields.push(cur);
          cur = "";
          continue;
        }
        cur += ch;
      }
      fields.push(cur);
      return fields.map(f => f.replace(/^"|"$/g, "").trim());
    }
    const header = lines.shift();
    const headers = parseCsvLine(header, delim).map(h => h.toLowerCase().trim());
    const idx = {
      id: headers.indexOf("id") !== -1 ? headers.indexOf("id") : 0,
      name: headers.indexOf("name") !== -1 ? headers.indexOf("name") : 1,
      position: headers.indexOf("position") !== -1 ? headers.indexOf("position") : 2,
      hours: headers.indexOf("hours") !== -1 ? headers.indexOf("hours") : 3
    };
    const workers = await loadWorkers();
    let added = 0, updated = 0, skipped = 0;
    for (const l of lines) {
      if (!l.trim()) continue;
      const cols = parseCsvLine(l, delim);
      const rec = {
        id: safeText(cols[idx.id]),
        name: safeText(cols[idx.name]),
        position: safeText(cols[idx.position]),
        hours: safeText(cols[idx.hours])
      };
      if (!rec.id || !rec.name) {
        skipped++;
        continue;
      }
      const ex = workers.findIndex(w => w.id === rec.id);
      if (ex >= 0) {
        workers[ex] = rec;
        updated++;
      } else {
        workers.push(rec);
        added++;
      }
    }
    await saveWorkers(workers);
    setStatus(`CSV imported — added:${added} updated:${updated} skipped:${skipped}`);
    e.target.value = null;
  } catch (err) {
    console.error("CSV import error", err);
    setStatus("CSV import failed: " + (err && err.message ? err.message : err), true);
    if (e?.target) e.target.value = null;
  }
}

async function downloadJSON() {
  const workers = await loadWorkers();
  const blob = new Blob([JSON.stringify(workers, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "workers.json";
  a.click();
  setStatus("JSON backup downloaded");
}

async function handleLogoUpload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    await saveLogoDataUrl(reader.result);
    await renderLogo();
    setStatus("Logo uploaded");
  };
  reader.readAsDataURL(file);
}

async function renderLogo() {
  const area = document.getElementById("logo-area");
  if (!area) return;
  area.innerHTML = "";
  const data = await loadLogo();
  if (!data) return;
  const img = document.createElement("img");
  img.src = data;
  img.style.maxHeight = "60px";
  img.style.objectFit = "contain";
  area.appendChild(img);
}

async function exportPDF() {
  const selected = await loadSelected();
  if (!selected || !selected.length) {
    setStatus("No selected rows to export", true);
    return;
  }
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
      await new Promise(res => {
        img.onload = res;
        img.onerror = res;
      });
      const maxW = 300;
      const maxH = 80;
      let w = img.width, h = img.height;
      const ratio = Math.min(maxW / w, maxH / h, 1);
      w = w * ratio;
      h = h * ratio;
      const x = (pageWidth - w) / 2;
      doc.addImage(logoData, "PNG", x, cursorY, w, h);
      cursorY += h + 40;
    } catch (e) { }
  }
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(document.getElementById("export-title").textContent || "Today's Workers Overtime Sheet", margin, cursorY + 8);
  const rawDate = document.getElementById("export-date-input").value;
  const ddmm = ddmmyyyyFromISO(rawDate);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${ddmm}`, pageWidth - margin - doc.getTextWidth(`Date: ${ddmm}`), cursorY + 8);
  cursorY += 30;
  const body = selected.map(r => [r.id, r.name, r.hours || "", r.position || ""]);
  doc.autoTable({
    startY: cursorY,
    head: [["PID", "Name", "Hours", "Position"]],
    body,
    theme: "plain",
    styles: { fontSize: 11, cellPadding: 8, textColor: 20, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [14, 165, 164], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 250, 250] },
    columnStyles: { 1: { fontStyle: "bold" } },
    tableLineColor: [220, 220, 225],
    tableLineWidth: 0.4,
    margin: { left: margin + 10, right: margin + 10 },
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
  if (!selected || !selected.length) { setStatus("No selected rows to export (image)", true); return; }

  const baseCanvasWidth = 794;
  const margin = 40;
  const rowHeight = 44;
  const headerGap = 40;
  const scale = 2;

  const col1 = 120;
  const col2 = 320;
  const col3 = 90;
  const col4 = 160;

  let tableWidth = col1 + col2 + col3 + col4;
  let canvasWidth = Math.max(baseCanvasWidth, tableWidth + margin * 2);
  const contentWidth = canvasWidth - margin * 2;

  const neededHeight = margin * 2 + 180 + selected.length * rowHeight + 100;
  const canvasHeight = Math.max(1400, neededHeight);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(canvasWidth * scale);
  canvas.height = Math.round(canvasHeight * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  let y = margin;

  const logoData = await loadLogo();
  if (logoData) {
    await new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const maxW = Math.min(420, contentWidth);
        const ratio = Math.min(maxW / img.width, 120 / img.height, 1);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (canvasWidth - w) / 2;
        ctx.drawImage(img, x, y, w, h);
        y += h + 36;
        res();
      };
      img.onerror = () => { y += 36; res(); };
      img.src = logoData;
    });
  } else {
    y += 30;
  }

  const headerFontSize = canvasWidth > 1000 ? 32 : 28;
  const rowFontSize = canvasWidth > 1000 ? 18 : 16;

  ctx.fillStyle = "#111827";
  ctx.font = `bold ${headerFontSize}px Inter, Arial`;
  const title = document.getElementById("export-title")?.textContent || "Worker Report";
  const titleW = ctx.measureText(title).width;
  ctx.fillText(title, (canvasWidth - titleW) / 2, y + headerFontSize - 6);

  y += headerGap;

  const rawDate = document.getElementById("export-date-input")?.value || new Date().toISOString().split("T")[0];
  const dateText = ddmmyyyyFromISO(rawDate);

  ctx.font = `${rowFontSize}px Inter, Arial`;
  const dateW = ctx.measureText(`Date: ${dateText}`).width;
  ctx.fillText(`Date: ${dateText}`, canvasWidth - margin - dateW, y - headerGap + 18);

  const tableX = margin;
  const tableY = y;

  ctx.fillStyle = "rgb(14,165,164)";
  ctx.fillRect(tableX, tableY, tableWidth, rowHeight);

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${rowFontSize + 2}px Inter, Arial`;

  let cx = tableX;
  ctx.fillText("PID", cx + 12, tableY + rowHeight - 12); cx += col1;
  ctx.fillText("Name", cx + 12, tableY + rowHeight - 12); cx += col2;
  ctx.fillText("Hours", cx + 12, tableY + rowHeight - 12); cx += col3;
  ctx.fillText("Position", cx + 12, tableY + rowHeight - 12);

  y = tableY + rowHeight;
  ctx.font = `${rowFontSize}px Inter, Arial`;

  for (let i = 0; i < selected.length; i++) {
    const r = selected[i];

    if (i % 2 === 1) {
      ctx.fillStyle = "rgba(245,250,250,1)";
      ctx.fillRect(tableX, y, tableWidth, rowHeight);
    }

    ctx.fillStyle = "#111827";

    let colX = tableX;
    ctx.fillText(String(r.id || ""), colX + 12, y + rowHeight - 12); colX += col1;

    drawTextWithin(ctx, String(r.name || ""), colX + 12, y + 8, col2 - 24, rowHeight, rowFontSize);
    colX += col2;

    ctx.fillText(String(r.hours || ""), colX + 12, y + rowHeight - 12); colX += col3;

    drawTextWithin(ctx, String(r.position || ""), colX + 12, y + 8, col4 - 24, rowHeight, rowFontSize);

    y += rowHeight;
  }

  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 1;
  ctx.strokeRect(tableX, tableY, tableWidth, (selected.length + 1) * rowHeight);

  const footerY = Math.max(y + 24, canvasHeight / scale - margin);
  ctx.fillStyle = "#6b7280";
  ctx.font = `${rowFontSize - 1}px Inter, Arial`;
  ctx.fillText(`Generated on ${dateText}`, margin, footerY);

  canvas.toBlob(blob => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `workers-${dateText}.png`;
    a.click();
    setStatus("Image exported");
  }, "image/png", 1.0);

  function drawTextWithin(ctx, text, x, y, maxWidth, lineHeight, fontSize) {
    ctx.font = `${fontSize}px Inter, Arial`;
    const words = (text || "").split(/\s+/);
    let line = "";
    let curY = y + fontSize;

    for (let n = 0; n < words.length; n++) {
      const test = line + words[n] + " ";
      if (ctx.measureText(test).width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, curY);
        line = words[n] + " ";
        curY += lineHeight;
      } else {
        line = test;
      }
    }

    if (line) ctx.fillText(line.trim(), x, curY);
  }
}

async function clearAll() {
  if (!confirm("Clear all data?")) return;
  await localforage.clear();
  await populateDropdown();
  await saveSelected([]);
  await renderLogo();
  setStatus("Cleared all data");
}

async function init() {
  try {
    await populateDropdown();
    await renderSelectedTable();
    await renderLogo();
    const dateInput = document.getElementById("export-date-input");
    const now = new Date();
    dateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const display = document.getElementById("export-date-display");
    if (display) display.textContent = ddmmyyyyFromISO(dateInput.value);
    dateInput.addEventListener("input", () => {
      if (display) display.textContent = ddmmyyyyFromISO(dateInput.value);
    });
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
    document.getElementById("apply-bulk-hours").onclick = applyBulkHours;
    document.getElementById("increment-bulk-hours").onclick = incrementBulkHours;
    document.getElementById("logo-input").onchange = e => {
      if (e.target.files && e.target.files[0]) handleLogoUpload(e.target.files[0]);
    };
    document.getElementById("clear-logo").onclick = async () => {
      await saveLogoDataUrl(null);
      await renderLogo();
      setStatus("Logo cleared");
    };
    window.addEventListener("resize", () => {
      applyResponsiveActionStyle();
    });
    applyResponsiveActionStyle();
    setStatus("Ready");
  } catch (err) {
    console.error("init error", err);
    setStatus("Initialization failed: " + (err && err.message), true);
  }
}

init();
