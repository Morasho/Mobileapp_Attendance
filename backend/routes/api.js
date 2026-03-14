const express  = require("express");
const router   = express.Router();

const { register, login }           = require("../controllers/authController");
const { listClasses, createClass }  = require("../controllers/classController");
const { signIn, myLogs, classReport } = require("../controllers/attendanceController");
const protect = require("../middleware/auth");

// ── Auth (public) ──────────────────────────────────────────
router.post("/auth/register", register);
router.post("/auth/login",    login);

// ── Classes ────────────────────────────────────────────────
router.get ("/classes",  protect, listClasses);
router.post("/classes",  protect, createClass);

// ── Attendance ─────────────────────────────────────────────
router.post("/attendance/sign-in",         protect, signIn);
router.get ("/attendance/my-logs",         protect, myLogs);
router.get ("/attendance/report/:classId", protect, classReport);

module.exports = router;