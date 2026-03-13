const TOKEN_KEY = "workerManagerAuthToken";
const DEFAULT_LOGO_URL = "/assets/mecc-logo.jpeg";

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  currentUser: null,
  workers: [],
  selectedWorkerIds: [],
  adminUsers: [],
  passwordDialog: { mode: "", userId: "", userName: "" },
  workerDialog: { mode: "add", workerId: "" },
  currentFilter: "",
  currentSort: { key: null, dir: 1 }
};

function el(id) {
  return document.getElementById(id);
}

function safeText(value) {
  return value === undefined || value === null ? "" : String(value);
}

function escapeHtml(value) {
  return safeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function ddmmyyyyFromISO(iso) {
  if (!iso) {
    return ddmmyyyyFromISO(todayIso());
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split("-");
    return `${day}-${month}-${year}`;
  }
  const date = new Date(iso);
  if (!Number.isNaN(date.getTime())) {
    return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
  }
  return safeText(iso);
}

function formatHours(value) {
  const hours = Number(value || 0);
  if (!Number.isFinite(hours)) return "0";
  return Number.isInteger(hours) ? String(hours) : String(hours.toFixed(2)).replace(/\.?0+$/, "");
}

function formatJoinedDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0) return 0;
  return hours;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setStatus(message = "", isError = false, targetId = "status") {
  const target = el(targetId);
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("is-error", Boolean(isError));
}

function isAdminUser() {
  return state.currentUser?.role === "admin";
}

function syncBodyModalState() {
  const anyOpen = ["password-modal", "worker-modal"].some((modalId) => {
    const modal = el(modalId);
    return modal && !modal.classList.contains("hidden");
  });
  document.body.classList.toggle("modal-open", anyOpen);
}

function getWorkerById(workerId) {
  return state.workers.find((worker) => worker._id === workerId) || null;
}

function pinPermanentWorkerFirst(workers = []) {
  const permanentWorker = workers.find((worker) => worker.isPermanent);
  if (!permanentWorker) {
    return workers;
  }
  return [permanentWorker, ...workers.filter((worker) => worker._id !== permanentWorker._id)];
}

function clearPasswordModalFields() {
  el("password-modal-form").reset();
}

function closePasswordModal() {
  state.passwordDialog = { mode: "", userId: "", userName: "" };
  clearPasswordModalFields();
  el("password-modal").classList.add("hidden");
  el("password-modal").setAttribute("aria-hidden", "true");
  syncBodyModalState();
}

function openPasswordModal({ mode, userId = "", userName = "" }) {
  state.passwordDialog = { mode, userId, userName };
  clearPasswordModalFields();

  const isSelf = mode === "self";
  el("password-modal-title").textContent = isSelf ? "Change Password" : "Reset Password";
  el("password-modal-copy").textContent = isSelf
    ? "Enter your current password and choose a new one."
    : `Set a new password for ${userName || "this user"}.`;
  el("current-password-group").classList.toggle("hidden", !isSelf);
  el("modal-old-password").required = isSelf;
  el("password-modal-submit").textContent = isSelf ? "Update Password" : "Reset Password";
  el("password-modal").classList.remove("hidden");
  el("password-modal").setAttribute("aria-hidden", "false");
  syncBodyModalState();

  if (isSelf) {
    el("modal-old-password").focus();
  } else {
    el("modal-new-password").focus();
  }
}

function clearWorkerForm() {
  el("worker-db-id").value = "";
  el("worker-id").value = "";
  el("worker-name").value = "";
  el("worker-position").value = "";
  el("worker-hours").value = "";
}

function updateWorkerFormInteractivity() {
  const selectedWorker = getWorkerById(safeText(el("worker-db-id").value).trim());
  const isLockedPermanent = Boolean(selectedWorker?.isPermanent && state.workerDialog.mode === "modify");

  el("worker-id").disabled = isLockedPermanent;
  el("worker-name").disabled = isLockedPermanent;
  el("worker-position").disabled = isLockedPermanent;
  el("delete-worker").classList.toggle("hidden", state.workerDialog.mode !== "modify" || isLockedPermanent || !selectedWorker);
  el("add-worker").textContent = state.workerDialog.mode === "modify" ? "Update Worker" : "Add Worker";
  el("worker-modal-help").textContent = isLockedPermanent
    ? "Kanhaiya is the permanent default worker. Only hours can be changed and he cannot be deleted."
    : state.workerDialog.mode === "modify"
      ? "Modify the selected worker record. Changes are saved everywhere for this user."
      : "Add a new worker record to the database.";
}

function fillWorkerForm(worker) {
  if (!worker) {
    clearWorkerForm();
    updateWorkerFormInteractivity();
    return;
  }

  state.workerDialog.workerId = safeText(worker._id);
  el("worker-db-id").value = safeText(worker._id);
  el("worker-id").value = safeText(worker.workerId);
  el("worker-name").value = safeText(worker.name);
  el("worker-position").value = safeText(worker.position);
  el("worker-hours").value = formatHours(worker.hours);
  el("worker-modal-select").value = safeText(worker._id);
  updateWorkerFormInteractivity();
}

function setWorkerDialogMode(mode, workerId = "") {
  state.workerDialog.mode = mode === "modify" ? "modify" : "add";
  el("worker-mode-add").classList.toggle("active", state.workerDialog.mode === "add");
  el("worker-mode-modify").classList.toggle("active", state.workerDialog.mode === "modify");
  el("worker-modify-picker").classList.toggle("hidden", state.workerDialog.mode !== "modify");
  el("worker-modal-title").textContent = state.workerDialog.mode === "modify" ? "Modify Worker" : "Add Worker";
  el("worker-modal-copy").textContent = state.workerDialog.mode === "modify"
    ? "Pick a worker, then update the record from this popup."
    : "Create a new worker without showing the full form on the page.";

  if (state.workerDialog.mode === "add") {
    state.workerDialog.workerId = "";
    el("worker-modal-select").value = "";
    clearWorkerForm();
    updateWorkerFormInteractivity();
    el("worker-id").focus();
    return;
  }

  const nextWorker = getWorkerById(workerId) || getWorkerById(state.workerDialog.workerId) || state.workers[0] || null;
  if (nextWorker) {
    fillWorkerForm(nextWorker);
    el("worker-modal-select").value = safeText(nextWorker._id);
    el("worker-hours").focus();
  } else {
    clearWorkerForm();
    el("worker-modal-select").value = "";
    updateWorkerFormInteractivity();
  }
}

function closeWorkerModal() {
  state.workerDialog = { mode: "add", workerId: "" };
  clearWorkerForm();
  el("worker-modal").classList.add("hidden");
  el("worker-modal").setAttribute("aria-hidden", "true");
  syncBodyModalState();
}

function openWorkerModal(options = {}) {
  if (!isAdminUser()) {
    setStatus("Only admins can change worker records.", true);
    return;
  }

  const { mode = "add", workerId = "" } = options;
  el("worker-modal").classList.remove("hidden");
  el("worker-modal").setAttribute("aria-hidden", "false");
  syncBodyModalState();
  setWorkerDialogMode(mode, workerId);
}

function persistToken(token) {
  state.token = token || "";
  if (state.token) {
    localStorage.setItem(TOKEN_KEY, state.token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function setCurrentUser(user) {
  state.currentUser = user || null;
  const appVisible = Boolean(state.currentUser);

  el("auth-view").classList.toggle("hidden", appVisible);
  el("app-view").classList.toggle("hidden", !appVisible);

  if (!state.currentUser) {
    closePasswordModal();
    closeWorkerModal();
    el("admin-panel").classList.add("hidden");
    return;
  }

  const isAdmin = isAdminUser();
  el("nav-user-name").textContent = state.currentUser.name;
  el("nav-user-email").textContent = state.currentUser.email;
  el("nav-user-role").textContent = state.currentUser.role;
  el("account-name").textContent = state.currentUser.name;
  el("account-email").textContent = state.currentUser.email;
  el("nav-user-role").classList.toggle("role-admin", isAdmin);
  el("admin-panel").classList.toggle("hidden", !isAdmin);
  el("worker-management-section").classList.toggle("hidden", !isAdmin);
  el("bulk-hours-section").classList.toggle("hidden", !isAdmin);
  el("csv-import-wrap").classList.toggle("hidden", !isAdmin);
  el("clear-storage").classList.toggle("hidden", !isAdmin);
  renderLogo();
}

function showAuthPanel(panel) {
  const isLogin = panel !== "signup";
  el("login-form").classList.toggle("hidden", !isLogin);
  el("signup-form").classList.toggle("hidden", isLogin);
  el("show-login").classList.toggle("active", isLogin);
  el("show-signup").classList.toggle("active", !isLogin);
}

function getReportDate() {
  return el("export-date-input").value || todayIso();
}

function updateDateDisplay() {
  el("export-date-display").textContent = `Report Date: ${ddmmyyyyFromISO(getReportDate())}`;
}

function currentLogoSource() {
  return safeText(state.currentUser?.logoDataUrl) || DEFAULT_LOGO_URL;
}

async function apiRequest(path, options = {}) {
  const { method = "GET", body, auth = true } = options;
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth && state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let payload = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && auth) {
      persistToken("");
      setCurrentUser(null);
      setStatus(payload.message || "Session expired. Please login again.", true, "auth-status");
      showAuthPanel("login");
    }
    throw new Error(payload.message || "Request failed.");
  }

  return payload;
}

function renderLogo() {
  const area = el("logo-area");
  if (!area) return;

  area.innerHTML = "";
  const image = document.createElement("img");
  image.src = currentLogoSource();
  image.alt = "Company logo";
  area.appendChild(image);
}

function renderWorkersDropdown() {
  const dropdown = el("workers-dropdown");
  dropdown.innerHTML = '<option value="">-- Select a worker to add to list --</option>';

  state.workers.forEach((worker) => {
    const option = document.createElement("option");
    option.value = worker._id;
    option.textContent = worker.isPermanent ? `${worker.name} (${worker.workerId}) - Default` : `${worker.name} (${worker.workerId})`;
    dropdown.appendChild(option);
  });

  renderWorkerModalPicker();
}

function renderWorkerModalPicker() {
  const picker = el("worker-modal-select");
  if (!picker) return;

  const currentValue = state.workerDialog.workerId;
  picker.innerHTML = '<option value="">-- Select a worker to modify --</option>';

  state.workers.forEach((worker) => {
    const option = document.createElement("option");
    option.value = worker._id;
    option.textContent = worker.isPermanent ? `${worker.name} (${worker.workerId}) - Permanent` : `${worker.name} (${worker.workerId})`;
    picker.appendChild(option);
  });

  if (currentValue && getWorkerById(currentValue)) {
    picker.value = currentValue;
    fillWorkerForm(getWorkerById(currentValue));
    return;
  }

  if (state.workerDialog.mode === "modify" && state.workers.length) {
    fillWorkerForm(state.workers[0]);
  }
}

function getSelectedWorkers() {
  return pinPermanentWorkerFirst(
    state.selectedWorkerIds
    .map((id) => state.workers.find((worker) => worker._id === id))
    .filter(Boolean)
  );
}

function renderSelectedTable() {
  const tbody = document.querySelector("#selected-table tbody");
  let rows = getSelectedWorkers();

  if (state.currentFilter) {
    const filter = state.currentFilter.toLowerCase();
    rows = rows.filter((row) => {
      return (
        safeText(row.workerId).toLowerCase().includes(filter) ||
        safeText(row.name).toLowerCase().includes(filter) ||
        safeText(row.position).toLowerCase().includes(filter)
      );
    });
  }

  if (state.currentSort.key) {
    rows.sort((left, right) => {
      const leftValue = state.currentSort.key === "hours" ? Number(left.hours || 0) : safeText(left[state.currentSort.key]).toLowerCase();
      const rightValue = state.currentSort.key === "hours" ? Number(right.hours || 0) : safeText(right[state.currentSort.key]).toLowerCase();
      if (leftValue < rightValue) return -1 * state.currentSort.dir;
      if (leftValue > rightValue) return 1 * state.currentSort.dir;
      return 0;
    });
  }

  rows = pinPermanentWorkerFirst(rows);

  if (!rows.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5" class="empty-state">No selected workers for this report date.</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((worker) => {
      const showManageButton = isAdminUser();
      const showRemoveButton = !worker.isPermanent;
      const actionContent = showManageButton || showRemoveButton
        ? `
            <div class="action-group">
              ${
                showManageButton
                  ? `<button class="edit-btn" type="button" data-worker-id="${worker._id}">${worker.isPermanent ? "Edit Hours" : "Modify"}</button>`
                  : ""
              }
              ${
                showRemoveButton
                  ? `<button class="remove-btn" type="button" data-remove-id="${worker._id}">Remove</button>`
                  : `<span class="inline-note permanent-note">Default worker is pinned</span>`
              }
            </div>
          `
        : '<span class="inline-note permanent-note">Default worker is pinned</span>';

      return `
        <tr class="${worker.isPermanent ? "permanent-row" : ""}">
          <td data-label="PID">${worker.isPermanent ? `<strong>${escapeHtml(worker.workerId)}</strong>` : escapeHtml(worker.workerId)}</td>
          <td data-label="Name">${worker.isPermanent ? `<strong>${escapeHtml(worker.name)}</strong>` : escapeHtml(worker.name)}</td>
          <td data-label="Hours">${formatHours(worker.hours)}</td>
          <td data-label="Position">${escapeHtml(worker.position)}</td>
          <td data-label="Action">
            ${actionContent}
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("[data-remove-id]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const workerId = event.currentTarget.getAttribute("data-remove-id");
      state.selectedWorkerIds = state.selectedWorkerIds.filter((id) => id !== workerId);
      await saveReportSelection(state.selectedWorkerIds, { silent: true });
      renderSelectedTable();
      setStatus("Removed worker from the report list.");
    });
  });

  tbody.querySelectorAll("[data-worker-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const workerId = event.currentTarget.getAttribute("data-worker-id");
      const worker = state.workers.find((item) => item._id === workerId);
      if (!worker) {
        setStatus("Worker record not found.", true);
        return;
      }
      openWorkerModal({ mode: "modify", workerId: worker._id });
      setStatus(worker.isPermanent ? "Permanent worker opened. Only hours can be changed." : "Worker opened for editing.");
    });
  });
}

function renderAdminUsers() {
  const tbody = document.querySelector("#users-table tbody");
  if (!tbody) return;

  if (!isAdminUser()) {
    tbody.innerHTML = "";
    renderAdminWorkerTargets();
    return;
  }

  tbody.innerHTML = state.adminUsers
    .map((user) => {
      const isCurrentUser = user.id === state.currentUser?.id;
      return `
        <tr>
          <td data-label="Name">${escapeHtml(user.name)}</td>
          <td data-label="Email">${escapeHtml(user.email)}</td>
          <td data-label="Role"><span class="role-chip ${user.role === "admin" ? "role-admin-chip" : ""}">${escapeHtml(user.role)}</span></td>
          <td data-label="Joined">${formatJoinedDate(user.createdAt)}</td>
          <td data-label="Password">
            <div class="password-reset-row">
              ${
                isCurrentUser
                  ? `<span class="inline-note">Use Account Settings to change your password.</span>`
                  : `<button class="btn btn-primary btn-small" type="button" data-reset-user="${user.id}" data-user-name="${escapeHtml(user.name)}">Reset Password</button>`
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("[data-reset-user]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const userId = event.currentTarget.getAttribute("data-reset-user");
      const userName = event.currentTarget.getAttribute("data-user-name") || "this user";
      openPasswordModal({ mode: "admin", userId, userName });
    });
  });

  renderAdminWorkerTargets();
}

function renderAdminWorkerTargets() {
  const container = el("admin-worker-user-list");
  if (!container) return;

  if (!isAdminUser()) {
    container.innerHTML = "";
    return;
  }

  if (!state.adminUsers.length) {
    container.innerHTML = '<p class="inline-note">No users available yet.</p>';
    return;
  }

  container.innerHTML = state.adminUsers
    .map((user) => {
      return `
        <label class="admin-user-option">
          <input type="checkbox" value="${user.id}" />
          <span>
            <strong>${escapeHtml(user.name)}</strong>
            <small>${escapeHtml(user.email)} · ${escapeHtml(user.role)}</small>
          </span>
        </label>
      `;
    })
    .join("");
}

async function loadWorkers() {
  const payload = await apiRequest("/api/workers");
  state.workers = Array.isArray(payload.workers) ? payload.workers : [];
  renderWorkersDropdown();
}

async function loadReportSelection() {
  const payload = await apiRequest(`/api/reports/${getReportDate()}`);
  state.selectedWorkerIds = Array.isArray(payload.workerIds) ? payload.workerIds : [];
}

async function saveReportSelection(workerIds, options = {}) {
  const payload = await apiRequest(`/api/reports/${getReportDate()}`, {
    method: "PUT",
    body: { workerIds }
  });
  state.selectedWorkerIds = Array.isArray(payload.workerIds) ? payload.workerIds : [];
  if (!options.silent) {
    setStatus("Report list updated.");
  }
}

async function loadAdminUsers() {
  if (state.currentUser?.role !== "admin") {
    state.adminUsers = [];
    renderAdminUsers();
    return;
  }
  const payload = await apiRequest("/api/admin/users");
  state.adminUsers = Array.isArray(payload.users) ? payload.users : [];
  renderAdminUsers();
}

async function refreshAppData(options = {}) {
  const { silent = false } = options;
  if (!silent) setStatus("Loading data...");
  await Promise.all([loadWorkers(), loadReportSelection(), loadAdminUsers()]);
  renderSelectedTable();
  renderLogo();
  if (!silent) setStatus("Ready");
}

async function hydrateSession() {
  if (!state.token) {
    setCurrentUser(null);
    return;
  }

  try {
    const payload = await apiRequest("/api/auth/me");
    setCurrentUser(payload.user);
    await refreshAppData({ silent: true });
    setStatus("Ready");
  } catch (error) {
    persistToken("");
    setCurrentUser(null);
    setStatus("Login required.", true, "auth-status");
  }
}

async function handleLogin(event) {
  event.preventDefault();
  setStatus("Checking credentials...", false, "auth-status");

  try {
    const payload = await apiRequest("/api/auth/login", {
      method: "POST",
      auth: false,
      body: {
        email: el("login-email").value.trim(),
        password: el("login-password").value
      }
    });

    persistToken(payload.token);
    setCurrentUser(payload.user);
    await refreshAppData({ silent: true });
    event.target.reset();
    setStatus("Logged in successfully.", false, "auth-status");
    setStatus("Ready");
  } catch (error) {
    setStatus(error.message, true, "auth-status");
  }
}

async function handleSignup(event) {
  event.preventDefault();
  setStatus("Creating account...", false, "auth-status");

  try {
    const payload = await apiRequest("/api/auth/signup", {
      method: "POST",
      auth: false,
      body: {
        name: el("signup-name").value.trim(),
        email: el("signup-email").value.trim(),
        password: el("signup-password").value
      }
    });

    persistToken(payload.token);
    setCurrentUser(payload.user);
    await refreshAppData({ silent: true });
    event.target.reset();
    setStatus("Account created and logged in.", false, "auth-status");
    setStatus("Ready");
  } catch (error) {
    setStatus(error.message, true, "auth-status");
  }
}

async function handleChangePassword(event) {
  event.preventDefault();

  const oldPassword = el("modal-old-password").value;
  const newPassword = el("modal-new-password").value;
  const confirmPassword = el("modal-confirm-password").value;
  const isSelf = state.passwordDialog.mode === "self";

  if (newPassword.length < 6) {
    setStatus("New password must be at least 6 characters long.", true);
    return;
  }

  if (newPassword !== confirmPassword) {
    setStatus("New password and confirm password do not match.", true);
    return;
  }

  try {
    if (isSelf) {
      if (!oldPassword) {
        setStatus("Enter your current password first.", true);
        return;
      }

      await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: { oldPassword, newPassword }
      });
      closePasswordModal();
      setStatus("Password changed successfully.");
      return;
    }

    await apiRequest(`/api/admin/users/${state.passwordDialog.userId}/reset-password`, {
      method: "POST",
      body: { password: newPassword }
    });
    closePasswordModal();
    setStatus("User password reset successfully.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function handleLogout() {
  closePasswordModal();
  closeWorkerModal();
  persistToken("");
  state.workers = [];
  state.selectedWorkerIds = [];
  state.adminUsers = [];
  setCurrentUser(null);
  renderSelectedTable();
  renderAdminUsers();
  showAuthPanel("login");
  setStatus("Logged out.", false, "auth-status");
}

async function addOrUpdateWorker() {
  if (!isAdminUser()) {
    setStatus("Only admins can change worker records.", true);
    return;
  }

  const workerDbId = safeText(el("worker-db-id").value).trim();
  const payload = {
    workerId: el("worker-id").value.trim(),
    name: el("worker-name").value.trim(),
    position: el("worker-position").value.trim(),
    hours: normalizeHours(el("worker-hours").value)
  };

  if (!payload.workerId || !payload.name) {
    setStatus("Worker ID and full name are required.", true);
    return;
  }

  try {
    if (workerDbId) {
      await apiRequest(`/api/workers/${workerDbId}`, {
        method: "PUT",
        body: payload
      });
      setStatus("Worker updated.");
    } else {
      await apiRequest("/api/workers", {
        method: "POST",
        body: payload
      });
      setStatus("Worker added.");
    }

    clearWorkerForm();
    await refreshAppData({ silent: true });
    closeWorkerModal();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function deleteWorker() {
  if (!isAdminUser()) {
    setStatus("Only admins can delete worker records.", true);
    return;
  }

  const workerDbId = safeText(el("worker-db-id").value).trim();
  const workerCode = el("worker-id").value.trim();
  const worker = workerDbId
    ? state.workers.find((item) => item._id === workerDbId)
    : state.workers.find((item) => item.workerId === workerCode);

  if (!worker) {
    setStatus("Enter or load a worker before deleting.", true);
    return;
  }

  try {
    await apiRequest(`/api/workers/${worker._id}`, { method: "DELETE" });
    clearWorkerForm();
    await refreshAppData({ silent: true });
    closeWorkerModal();
    setStatus("Worker deleted.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function addToSelected() {
  const workerId = el("workers-dropdown").value;
  if (!workerId) {
    setStatus("Select a worker to add.", true);
    return;
  }

  if (state.selectedWorkerIds.includes(workerId)) {
    setStatus("Worker is already in the report list.");
    return;
  }

  state.selectedWorkerIds.push(workerId);
  await saveReportSelection(state.selectedWorkerIds, { silent: true });
  renderSelectedTable();
  setStatus("Worker added to report list.");
}

async function clearSelected() {
  state.selectedWorkerIds = [];
  await saveReportSelection([], { silent: true });
  renderSelectedTable();
  setStatus("Report list cleared. The default worker stayed pinned.");
}

async function addAllWorkersToSelected() {
  if (!state.workers.length) {
    setStatus("No workers available to add.", true);
    return;
  }

  const merged = new Set(state.selectedWorkerIds);
  state.workers.forEach((worker) => merged.add(worker._id));
  state.selectedWorkerIds = Array.from(merged);
  await saveReportSelection(state.selectedWorkerIds, { silent: true });
  renderSelectedTable();
  setStatus("All workers added to the report list.");
}

async function updateBulkHours(mode) {
  if (!isAdminUser()) {
    setStatus("Only admins can change worker hours in bulk.", true);
    return;
  }

  const onlySelected = el("bulk-only-selected").checked;
  const selectedIds = onlySelected ? [...state.selectedWorkerIds] : [];

  if (onlySelected && !selectedIds.length) {
    setStatus("Select at least one worker for bulk edit.", true);
    return;
  }

  const rawValue = el("bulk-hours-input").value;
  if (mode === "set" && rawValue === "") {
    setStatus("Enter hours to apply.", true);
    return;
  }

  try {
    await apiRequest("/api/workers/bulk-hours", {
      method: "POST",
      body: {
        mode,
        value: Number(rawValue || 0),
        workerIds: selectedIds
      }
    });
    await refreshAppData({ silent: true });
    setStatus(mode === "increment" ? "Added +1 hour." : "Bulk hours applied.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function exportCSV() {
  if (!state.workers.length) {
    setStatus("No workers available for CSV export.", true);
    return;
  }

  const header = ["workerId", "name", "position", "hours"].join(",");
  const rows = state.workers.map((worker) => {
    return [worker.workerId, worker.name, worker.position, formatHours(worker.hours)]
      .map((value) => `"${safeText(value).replace(/"/g, '""')}"`)
      .join(",");
  });

  const csv = [header, ...rows].join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv" }), "workers.csv");
  setStatus("CSV exported.");
}

function detectDelimiter(lines) {
  const candidates = [",", ";", "\t"];
  const scores = { ",": 0, ";": 0, "\t": 0 };
  const sampleLines = lines.slice(0, Math.min(lines.length, 5));

  sampleLines.forEach((line) => {
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && Object.prototype.hasOwnProperty.call(scores, char)) {
        scores[char] += 1;
      }
    }
  });

  return candidates.sort((left, right) => scores[right] - scores[left])[0];
}

function parseCsvLine(line, delimiter) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && char === delimiter) {
      fields.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  fields.push(current);
  return fields.map((field) => field.trim());
}

async function importCSV(event) {
  if (!isAdminUser()) {
    event.target.value = "";
    setStatus("Only admins can import worker records.", true);
    return;
  }

  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    setStatus("Reading CSV...");
    const rawText = await file.text();
    const cleaned = rawText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = cleaned.split("\n").filter((line) => line.trim());

    if (!lines.length) {
      throw new Error("CSV file is empty.");
    }

    const delimiter = detectDelimiter(lines);
    const headerColumns = parseCsvLine(lines.shift(), delimiter).map((item) => item.toLowerCase());
    const indexes = {
      workerId: headerColumns.indexOf("workerid") >= 0 ? headerColumns.indexOf("workerid") : headerColumns.indexOf("id"),
      name: headerColumns.indexOf("name"),
      position: headerColumns.indexOf("position"),
      hours: headerColumns.indexOf("hours")
    };

    const workers = lines.map((line) => {
      const columns = parseCsvLine(line, delimiter);
      return {
        workerId: safeText(columns[indexes.workerId >= 0 ? indexes.workerId : 0]).trim(),
        name: safeText(columns[indexes.name >= 0 ? indexes.name : 1]).trim(),
        position: safeText(columns[indexes.position >= 0 ? indexes.position : 2]).trim(),
        hours: normalizeHours(safeText(columns[indexes.hours >= 0 ? indexes.hours : 3]).trim())
      };
    });

    const payload = await apiRequest("/api/workers/import", {
      method: "POST",
      body: { workers }
    });

    event.target.value = "";
    await refreshAppData({ silent: true });
    setStatus(
      `CSV imported. Added: ${payload.summary.added}, updated: ${payload.summary.updated}, skipped: ${payload.summary.skipped}.`
    );
  } catch (error) {
    event.target.value = "";
    setStatus(error.message, true);
  }
}

function downloadJSON() {
  const content = JSON.stringify(state.workers, null, 2);
  downloadBlob(new Blob([content], { type: "application/json" }), "workers.json");
  setStatus("JSON backup downloaded.");
}

async function handleLogoUpload(file) {
  if (!file) return;

  try {
    const reader = new FileReader();
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Logo upload failed."));
      reader.readAsDataURL(file);
    });

    const payload = await apiRequest("/api/profile/logo", {
      method: "PUT",
      body: { logoDataUrl: dataUrl }
    });

    setCurrentUser(payload.user);
    setStatus("Logo uploaded.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function clearLogo() {
  try {
    const payload = await apiRequest("/api/profile/logo", { method: "DELETE" });
    setCurrentUser(payload.user);
    setStatus("Default logo restored.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function getFittedImage(source, box) {
  if (!source) return null;

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;
      const ratio = Math.min(box.width / sourceWidth, box.height / sourceHeight, 1);
      const width = sourceWidth * ratio;
      const height = sourceHeight * ratio;

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth));
      canvas.height = Math.max(1, Math.round(sourceHeight));
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, sourceWidth, sourceHeight);

      resolve({
        dataUrl: canvas.toDataURL("image/png"),
        format: "PNG",
        x: box.x + (box.width - width) / 2,
        y: box.y + (box.height - height) / 2,
        width,
        height
      });
    };
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function fitCanvasText(ctx, text, maxWidth) {
  const value = safeText(text);
  if (ctx.measureText(value).width <= maxWidth) {
    return value;
  }

  let trimmed = value;
  while (trimmed.length > 0 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

function isPermanentExportCell(worker, columnIndex) {
  return Boolean(worker?.isPermanent && (columnIndex === 1 || columnIndex === 2));
}

function buildExportHeaderLayout(canvasWidth, margins, logoSpec) {
  const logoBottom = logoSpec ? logoSpec.y + logoSpec.height : margins.top;
  const titleY = logoBottom + 28;
  const dateY = titleY + 24;
  const lineY = dateY + 14;
  return {
    titleY,
    dateY,
    lineY,
    tableStartY: lineY + 14
  };
}

function drawPdfHeader(doc, options) {
  const { pageWidth, dateText, title, logoSpec, margins, layout } = options;

  if (logoSpec) {
    doc.addImage(logoSpec.dataUrl, logoSpec.format, logoSpec.x, logoSpec.y, logoSpec.width, logoSpec.height);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(0, 0, 0);
  doc.text(title, pageWidth / 2, layout.titleY, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Date: ${dateText}`, pageWidth - margins.right, layout.dateY, { align: "right" });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(margins.left, layout.lineY, pageWidth - margins.right, layout.lineY);
}

async function exportPDF() {
  const selected = getSelectedWorkers();
  if (!selected.length) {
    setStatus("No selected workers to export.", true);
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margins = { left: 32, right: 32, top: 0, bottom: 36 };
  const title = el("export-title").textContent || "Workers Overtime Sheet";
  const dateText = ddmmyyyyFromISO(getReportDate());
  const logoSpec = await getFittedImage(currentLogoSource(), { x: 48, y: 18, width: pageWidth - 96, height: 84 });
  const headerLayout = buildExportHeaderLayout(pageWidth, margins, logoSpec);
  margins.top = headerLayout.tableStartY;
  const body = selected.map((worker, index) => [
    String(index + 1),
    safeText(worker.workerId),
    safeText(worker.name),
    formatHours(worker.hours),
    safeText(worker.position)
  ]);

  doc.autoTable({
    startY: margins.top,
    margin: margins,
    head: [["#", "PID", "Name", "Hours", "Position"]],
    body,
    theme: "grid",
    styles: {
      fontSize: 10.5,
      overflow: "ellipsize",
      cellPadding: { top: 5, right: 5, bottom: 5, left: 5 },
      minCellHeight: 24,
      valign: "middle",
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      lineColor: [0, 0, 0],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 10.5
    },
    columnStyles: {
      0: { cellWidth: 30, halign: "center" },
      1: { cellWidth: 78 },
      2: { cellWidth: 176 },
      3: { cellWidth: 60, halign: "center" },
      4: { cellWidth: 187 }
    },
    didParseCell: (hook) => {
      if (hook.section !== "body") {
        return;
      }

      const worker = selected[hook.row.index];
      if (isPermanentExportCell(worker, hook.column.index)) {
        hook.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: () => {
      drawPdfHeader(doc, { pageWidth, dateText, title, logoSpec, margins, layout: headerLayout });
    }
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Generated on ${dateText}`, margins.left, pageHeight - 20);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margins.right, pageHeight - 20, { align: "right" });
  }

  const filename = `workers-${dateText}.pdf`;
  doc.save(filename);
  setStatus(`PDF exported as ${filename}.`);
}

async function exportImage() {
  const selected = getSelectedWorkers();
  if (!selected.length) {
    setStatus("No selected workers to export.", true);
    return;
  }

  const scale = 2;
  const margin = 32;
  const rowHeight = 36;
  const footerHeight = 42;
  const columns = [36, 100, 248, 80, 184];
  const tableWidth = columns.reduce((total, value) => total + value, 0);
  const canvasWidth = margin * 2 + tableWidth;
  const logoSpec = await getFittedImage(currentLogoSource(), { x: margin, y: 18, width: canvasWidth - margin * 2, height: 84 });
  const headerLayout = buildExportHeaderLayout(canvasWidth, { left: margin, right: margin, top: 18 }, logoSpec);
  const canvasHeight = headerLayout.tableStartY + footerHeight + rowHeight * (selected.length + 1) + 30;
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth * scale;
  canvas.height = canvasHeight * scale;

  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const dateText = ddmmyyyyFromISO(getReportDate());
  const title = el("export-title").textContent || "Workers Overtime Sheet";

  if (logoSpec) {
    const logoImage = await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = logoSpec.dataUrl;
    });
    if (logoImage) {
      ctx.drawImage(logoImage, logoSpec.x, logoSpec.y, logoSpec.width, logoSpec.height);
    }
  }

  ctx.fillStyle = "#000000";
  ctx.font = "700 18px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, canvasWidth / 2, headerLayout.titleY);

  ctx.fillStyle = "#000000";
  ctx.font = "500 11px Inter, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`Date: ${dateText}`, canvasWidth - margin, headerLayout.dateY);

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, headerLayout.lineY);
  ctx.lineTo(canvasWidth - margin, headerLayout.lineY);
  ctx.stroke();

  const startX = margin;
  let cursorY = headerLayout.tableStartY;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(startX, cursorY, tableWidth, rowHeight);
  ctx.fillStyle = "#000000";
  ctx.font = "700 13px Inter, sans-serif";
  ctx.textAlign = "left";

  const labels = ["#", "PID", "Name", "Hours", "Position"];
  let offsetX = startX;
  labels.forEach((label, index) => {
    ctx.fillText(label, offsetX + 10, cursorY + 22);
    offsetX += columns[index];
  });

  cursorY += rowHeight;

  selected.forEach((worker, index) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(startX, cursorY, tableWidth, rowHeight);
    ctx.fillStyle = "#000000";
    const values = [
      String(index + 1),
      safeText(worker.workerId),
      safeText(worker.name),
      formatHours(worker.hours),
      safeText(worker.position)
    ];

    let valueX = startX;
    values.forEach((value, columnIndex) => {
      ctx.font = isPermanentExportCell(worker, columnIndex) ? "700 12px Inter, sans-serif" : "500 12px Inter, sans-serif";
      const maxWidth = columns[columnIndex] - 18;
      const fitted = fitCanvasText(ctx, value, maxWidth);
      ctx.fillText(fitted, valueX + 10, cursorY + 22);
      valueX += columns[columnIndex];
    });

    cursorY += rowHeight;
  });

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(startX, headerLayout.tableStartY, tableWidth, rowHeight * (selected.length + 1));

  let gridX = startX;
  ctx.beginPath();
  columns.forEach((columnWidth) => {
    ctx.moveTo(gridX, headerLayout.tableStartY);
    ctx.lineTo(gridX, headerLayout.tableStartY + rowHeight * (selected.length + 1));
    gridX += columnWidth;
  });
  ctx.moveTo(gridX, headerLayout.tableStartY);
  ctx.lineTo(gridX, headerLayout.tableStartY + rowHeight * (selected.length + 1));

  for (let lineIndex = 1; lineIndex <= selected.length + 1; lineIndex += 1) {
    const y = headerLayout.tableStartY + rowHeight * lineIndex;
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + tableWidth, y);
  }
  ctx.stroke();

  ctx.fillStyle = "#000000";
  ctx.font = "500 11px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Generated on ${dateText}`, margin, canvasHeight - 18);

  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus("Image export failed.", true);
      return;
    }
    downloadBlob(blob, `workers-${dateText}.png`);
    setStatus("Image exported.");
  }, "image/png");
}

async function clearAllData() {
  if (!isAdminUser()) {
    setStatus("Only admins can clear worker database data.", true);
    return;
  }

  if (!window.confirm("Clear all workers, report selections, and your uploaded logo?")) {
    return;
  }

  try {
    await apiRequest("/api/account/data", { method: "DELETE" });
    if (state.currentUser) {
      state.currentUser.logoDataUrl = "";
      renderLogo();
    }
    await refreshAppData({ silent: true });
    closeWorkerModal();
    setStatus("Account data cleared. The permanent worker was kept.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function handleAdminCreateUser(event) {
  event.preventDefault();

  try {
    await apiRequest("/api/admin/users", {
      method: "POST",
      body: {
        name: el("admin-user-name").value.trim(),
        email: el("admin-user-email").value.trim(),
        password: el("admin-user-password").value
      }
    });
    event.target.reset();
    await refreshAppData({ silent: true });
    setStatus("User created.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function handleAdminAssignWorker(event) {
  event.preventDefault();

  if (!isAdminUser()) {
    setStatus("Only admins can assign workers to users.", true);
    return;
  }

  const ownerIds = Array.from(document.querySelectorAll("#admin-worker-user-list input[type='checkbox']:checked"))
    .map((input) => input.value)
    .filter(Boolean);

  try {
    await apiRequest("/api/admin/workers/assign", {
      method: "POST",
      body: {
        ownerIds,
        worker: {
          workerId: el("admin-assign-worker-id").value.trim(),
          name: el("admin-assign-worker-name").value.trim(),
          position: el("admin-assign-worker-position").value.trim(),
          hours: normalizeHours(el("admin-assign-worker-hours").value)
        }
      }
    });

    event.target.reset();
    document.querySelectorAll("#admin-worker-user-list input[type='checkbox']").forEach((input) => {
      input.checked = false;
    });
    await refreshAppData({ silent: true });
    setStatus("Worker assigned to selected users.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function bindStaticEvents() {
  el("show-login").addEventListener("click", () => showAuthPanel("login"));
  el("show-signup").addEventListener("click", () => showAuthPanel("signup"));
  el("login-form").addEventListener("submit", handleLogin);
  el("signup-form").addEventListener("submit", handleSignup);
  el("open-change-password").addEventListener("click", () => {
    openPasswordModal({
      mode: "self",
      userId: state.currentUser?.id || "",
      userName: state.currentUser?.name || ""
    });
  });
  el("password-modal-form").addEventListener("submit", handleChangePassword);
  el("close-password-modal").addEventListener("click", closePasswordModal);
  el("password-modal-cancel").addEventListener("click", closePasswordModal);
  el("password-modal").addEventListener("click", (event) => {
    if (event.target.hasAttribute("data-close-password-modal")) {
      closePasswordModal();
    }
  });
  el("logout-btn").addEventListener("click", handleLogout);

  el("open-worker-modal").addEventListener("click", () => openWorkerModal({ mode: "add" }));
  el("close-worker-modal").addEventListener("click", closeWorkerModal);
  el("worker-modal-cancel").addEventListener("click", closeWorkerModal);
  el("worker-modal").addEventListener("click", (event) => {
    if (event.target.hasAttribute("data-close-worker-modal")) {
      closeWorkerModal();
    }
  });
  el("worker-mode-add").addEventListener("click", () => setWorkerDialogMode("add"));
  el("worker-mode-modify").addEventListener("click", () => setWorkerDialogMode("modify"));
  el("worker-modal-select").addEventListener("change", (event) => {
    const worker = getWorkerById(event.target.value);
    if (!worker) {
      clearWorkerForm();
      updateWorkerFormInteractivity();
      return;
    }
    fillWorkerForm(worker);
  });
  el("add-worker").addEventListener("click", addOrUpdateWorker);
  el("delete-worker").addEventListener("click", deleteWorker);
  el("add-selected").addEventListener("click", addToSelected);
  el("clear-list").addEventListener("click", clearSelected);
  el("add-all-workers").addEventListener("click", addAllWorkersToSelected);
  el("apply-bulk-hours").addEventListener("click", () => updateBulkHours("set"));
  el("increment-bulk-hours").addEventListener("click", () => updateBulkHours("increment"));
  el("export-csv").addEventListener("click", exportCSV);
  el("import-csv").addEventListener("change", importCSV);
  el("download-json").addEventListener("click", downloadJSON);
  el("clear-storage").addEventListener("click", clearAllData);
  el("export-pdf").addEventListener("click", exportPDF);
  el("export-image").addEventListener("click", exportImage);
  el("clear-logo").addEventListener("click", clearLogo);
  el("logo-input").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleLogoUpload(file);
    }
    event.target.value = "";
  });
  el("selected-search").addEventListener("input", (event) => {
    state.currentFilter = event.target.value.trim();
    renderSelectedTable();
  });
  el("selected-refresh").addEventListener("click", async () => {
    await refreshAppData({ silent: true });
    setStatus("Data refreshed.");
  });
  el("export-date-input").addEventListener("change", async () => {
    updateDateDisplay();
    await loadReportSelection();
    renderSelectedTable();
    setStatus("Loaded selected workers for the chosen date.");
  });
  el("admin-create-user-form").addEventListener("submit", handleAdminCreateUser);
  el("admin-assign-worker-form").addEventListener("submit", handleAdminAssignWorker);

  document.querySelectorAll("#selected-table thead th[data-sort-key]").forEach((header) => {
    header.addEventListener("click", () => {
      const key = header.getAttribute("data-sort-key");
      if (state.currentSort.key === key) {
        state.currentSort.dir *= -1;
      } else {
        state.currentSort.key = key;
        state.currentSort.dir = 1;
      }
      renderSelectedTable();
    });
  });
}

async function init() {
  el("export-date-input").value = todayIso();
  updateDateDisplay();
  renderSelectedTable();
  bindStaticEvents();
  showAuthPanel("login");
  await hydrateSession();
}

init();
