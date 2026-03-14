require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const createTables = require("./db/schema");
const apiRoutes    = require("./routes/api");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health check ───────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "✅ GPS Attendance API is running", port: PORT });
});

// ── API routes ─────────────────────────────────────────────
app.use("/api", apiRoutes);

// ── 404 ────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ── Boot ───────────────────────────────────────────────────
const start = async () => {
  await createTables();   // creates all tables if they don't exist
  app.listen(PORT, () => {
    console.log(`🚀 Server running → http://localhost:${PORT}`);
    console.log(`📋 Endpoints:`);
    console.log(`   POST /api/auth/register`);
    console.log(`   POST /api/auth/login`);
    console.log(`   GET  /api/classes`);
    console.log(`   POST /api/classes`);
    console.log(`   POST /api/attendance/sign-in`);
    console.log(`   GET  /api/attendance/my-logs`);
    console.log(`   GET  /api/attendance/report/:classId`);
  });
};

start();