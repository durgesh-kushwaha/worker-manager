require("dotenv").config();

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { DEFAULT_REPORT_DATE, SEEDED_WORKERS } = require("./seed-data/default-workers");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-before-production";
const MONGODB_URI = String(process.env.MONGODB_URI || "").trim();
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const ADMIN_NAME = String(process.env.ADMIN_NAME || "Durgesh Admin").trim() || "Durgesh Admin";

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: false, limit: "12mb" }));

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    logoDataUrl: { type: String, default: "" }
  },
  { timestamps: true }
);

const workerSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workerId: { type: String, required: true, trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    position: { type: String, trim: true, maxlength: 160, default: "" },
    hours: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

workerSchema.index({ owner: 1, workerId: 1 }, { unique: true });

const reportSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reportDate: { type: String, required: true, trim: true },
    workerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Worker" }]
  },
  { timestamps: true }
);

reportSchema.index({ owner: 1, reportDate: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);
const Worker = mongoose.model("Worker", workerSchema);
const Report = mongoose.model("Report", reportSchema);

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    logoDataUrl: user.logoDataUrl || "",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function normalizeHours(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
}

function normalizeWorkerPayload(payload = {}) {
  return {
    workerId: String(payload.workerId || "").trim(),
    name: String(payload.name || "").trim(),
    position: String(payload.position || "").trim(),
    hours: normalizeHours(payload.hours)
  };
}

function createToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.sub);
    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid session." });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  return next();
}

function validateRequiredConfiguration() {
  if (!MONGODB_URI || MONGODB_URI.includes("<db_username>") || MONGODB_URI.includes("<db_password>")) {
    throw new Error("Set MONGODB_URI in .env with your real MongoDB Atlas username and password.");
  }
  if (!ADMIN_EMAIL || !isValidEmail(ADMIN_EMAIL)) {
    throw new Error("Set ADMIN_EMAIL in .env to the private admin login email.");
  }
  if (ADMIN_PASSWORD.length < 6) {
    throw new Error("Set ADMIN_PASSWORD in .env to a private password with at least 6 characters.");
  }
}

async function ensureDefaultAdmin() {
  const existing = await User.findOne({ email: ADMIN_EMAIL });

  if (!existing) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    return User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin"
    });
  }

  let dirty = false;
  if (existing.role !== "admin") {
    existing.role = "admin";
    dirty = true;
  }
  if (existing.name !== ADMIN_NAME) {
    existing.name = ADMIN_NAME;
    dirty = true;
  }
  if (dirty) {
    await existing.save();
  }
  return existing;
}

async function seedAdminWorkers(adminUser) {
  const existingCount = await Worker.countDocuments({ owner: adminUser._id });
  if (existingCount > 0) {
    return;
  }

  await Worker.insertMany(
    SEEDED_WORKERS.map((worker) => ({
      owner: adminUser._id,
      workerId: worker.workerId,
      name: worker.name,
      position: worker.position,
      hours: worker.hours
    }))
  );

  const seededWorkers = await Worker.find({ owner: adminUser._id, workerId: { $in: SEEDED_WORKERS.map((worker) => worker.workerId) } })
    .select("_id workerId")
    .lean();

  const workerIdsByPid = new Map(seededWorkers.map((worker) => [worker.workerId, worker._id]));
  const orderedWorkerIds = SEEDED_WORKERS.map((worker) => workerIdsByPid.get(worker.workerId)).filter(Boolean);

  const existingReport = await Report.findOne({ owner: adminUser._id, reportDate: DEFAULT_REPORT_DATE }).lean();
  if (!existingReport) {
    await Report.create({
      owner: adminUser._id,
      reportDate: DEFAULT_REPORT_DATE,
      workerIds: orderedWorkerIds
    });
  }
}

async function loadReportSelection(ownerId, reportDate) {
  const report = await Report.findOne({ owner: ownerId, reportDate }).lean();
  return Array.isArray(report?.workerIds) ? report.workerIds.map(String) : [];
}

app.post("/api/auth/signup", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !isValidEmail(email) || password.length < 6) {
      return res.status(400).json({ message: "Name, valid email, and a 6+ character password are required." });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "An account already exists for this email." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, role: "user" });
    const token = createToken(user);

    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = createToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  return res.json({ user: sanitizeUser(req.user) });
});

app.post("/api/auth/change-password", authMiddleware, async (req, res, next) => {
  try {
    const oldPassword = String(req.body.oldPassword || "");
    const newPassword = String(req.body.newPassword || "");

    if (!oldPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Old password and a new password of at least 6 characters are required." });
    }

    const matches = await bcrypt.compare(oldPassword, req.user.passwordHash);
    if (!matches) {
      return res.status(401).json({ message: "Old password is incorrect." });
    }

    const sameAsOld = await bcrypt.compare(newPassword, req.user.passwordHash);
    if (sameAsOld) {
      return res.status(400).json({ message: "New password must be different from the old password." });
    }

    req.user.passwordHash = await bcrypt.hash(newPassword, 12);
    await req.user.save();
    return res.json({ message: "Password changed successfully." });
  } catch (error) {
    return next(error);
  }
});

app.put("/api/profile/logo", authMiddleware, async (req, res, next) => {
  try {
    const logoDataUrl = String(req.body.logoDataUrl || "");
    req.user.logoDataUrl = logoDataUrl;
    await req.user.save();
    return res.json({ user: sanitizeUser(req.user) });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/profile/logo", authMiddleware, async (req, res, next) => {
  try {
    req.user.logoDataUrl = "";
    await req.user.save();
    return res.json({ user: sanitizeUser(req.user) });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/workers", authMiddleware, async (req, res, next) => {
  try {
    const workers = await Worker.find({ owner: req.user._id }).sort({ workerId: 1, name: 1 }).lean();
    return res.json({ workers });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/workers", authMiddleware, async (req, res, next) => {
  try {
    const payload = normalizeWorkerPayload(req.body);
    if (!payload.workerId || !payload.name) {
      return res.status(400).json({ message: "Worker ID and name are required." });
    }

    const worker = await Worker.create({ owner: req.user._id, ...payload });
    return res.status(201).json({ worker });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Worker ID already exists." });
    }
    return next(error);
  }
});

app.put("/api/workers/:id", authMiddleware, async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid worker reference." });
    }

    const payload = normalizeWorkerPayload(req.body);
    if (!payload.workerId || !payload.name) {
      return res.status(400).json({ message: "Worker ID and name are required." });
    }

    const worker = await Worker.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      payload,
      { new: true, runValidators: true }
    );

    if (!worker) {
      return res.status(404).json({ message: "Worker not found." });
    }

    return res.json({ worker });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Worker ID already exists." });
    }
    return next(error);
  }
});

app.delete("/api/workers/:id", authMiddleware, async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid worker reference." });
    }

    const worker = await Worker.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!worker) {
      return res.status(404).json({ message: "Worker not found." });
    }

    await Report.updateMany({ owner: req.user._id }, { $pull: { workerIds: worker._id } });
    return res.json({ message: "Worker deleted." });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/workers/import", authMiddleware, async (req, res, next) => {
  try {
    const incoming = Array.isArray(req.body.workers) ? req.body.workers : [];
    const summary = { added: 0, updated: 0, skipped: 0 };

    for (const row of incoming) {
      const payload = normalizeWorkerPayload(row);
      if (!payload.workerId || !payload.name) {
        summary.skipped += 1;
        continue;
      }

      const existing = await Worker.findOne({ owner: req.user._id, workerId: payload.workerId });
      if (existing) {
        existing.name = payload.name;
        existing.position = payload.position;
        existing.hours = payload.hours;
        await existing.save();
        summary.updated += 1;
      } else {
        await Worker.create({ owner: req.user._id, ...payload });
        summary.added += 1;
      }
    }

    return res.json({ summary });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/workers/bulk-hours", authMiddleware, async (req, res, next) => {
  try {
    const mode = String(req.body.mode || "");
    const value = normalizeHours(req.body.value);
    const filterIds = Array.isArray(req.body.workerIds) ? req.body.workerIds.filter(isObjectId) : [];
    const query = { owner: req.user._id };

    if (filterIds.length) {
      query._id = { $in: filterIds };
    }

    const workers = await Worker.find(query);
    if (!workers.length) {
      return res.status(400).json({ message: "No matching workers found." });
    }

    const operations = workers.map((worker) => {
      const nextHours = mode === "increment" ? Number(worker.hours || 0) + 1 : value;
      return {
        updateOne: {
          filter: { _id: worker._id },
          update: { $set: { hours: nextHours } }
        }
      };
    });

    await Worker.bulkWrite(operations);
    return res.json({ message: "Hours updated." });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/reports/:date", authMiddleware, async (req, res, next) => {
  try {
    const reportDate = String(req.params.date || "");
    if (!isIsoDate(reportDate)) {
      return res.status(400).json({ message: "Invalid report date." });
    }

    const workerIds = await loadReportSelection(req.user._id, reportDate);
    return res.json({ reportDate, workerIds });
  } catch (error) {
    return next(error);
  }
});

app.put("/api/reports/:date", authMiddleware, async (req, res, next) => {
  try {
    const reportDate = String(req.params.date || "");
    if (!isIsoDate(reportDate)) {
      return res.status(400).json({ message: "Invalid report date." });
    }

    const requestedIds = Array.isArray(req.body.workerIds) ? req.body.workerIds.filter(isObjectId) : [];
    const ownedWorkers = await Worker.find({ owner: req.user._id, _id: { $in: requestedIds } }).select("_id").lean();
    const workerIds = ownedWorkers.map((worker) => worker._id);

    const report = await Report.findOneAndUpdate(
      { owner: req.user._id, reportDate },
      { owner: req.user._id, reportDate, workerIds },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({ reportDate: report.reportDate, workerIds: report.workerIds.map(String) });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/account/data", authMiddleware, async (req, res, next) => {
  try {
    await Worker.deleteMany({ owner: req.user._id });
    await Report.deleteMany({ owner: req.user._id });
    req.user.logoDataUrl = "";
    await req.user.save();
    return res.json({ message: "All account data cleared." });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/admin/users", authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    return res.json({ users: users.map(sanitizeUser) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/admin/users", authMiddleware, adminOnly, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !isValidEmail(email) || password.length < 6) {
      return res.status(400).json({ message: "Name, valid email, and a 6+ character password are required." });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "A user with that email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const role = email === ADMIN_EMAIL ? "admin" : "user";
    const user = await User.create({ name, email, passwordHash, role });

    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/admin/users/:id/reset-password", authMiddleware, adminOnly, async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid user reference." });
    }

    const password = String(req.body.password || "");
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    await user.save();

    return res.json({ message: `Password reset for ${user.email}.` });
  } catch (error) {
    return next(error);
  }
});

app.use(express.static(__dirname));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) {
    return next(error);
  }
  return res.status(500).json({ message: error?.message || "Server error." });
});

async function start() {
  validateRequiredConfiguration();
  await mongoose.connect(MONGODB_URI);
  const adminUser = await ensureDefaultAdmin();
  await seedAdminWorkers(adminUser);
  app.listen(PORT, () => {
    console.log(`Worker Manager running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start Worker Manager:", error.message);
  process.exit(1);
});
