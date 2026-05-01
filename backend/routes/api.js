const express  = require("express");
const router   = express.Router();

const { register, login }                                     = require("../controllers/authController");
const { listClasses }                                         = require("../controllers/classController");
const { signIn, myLogs, classReport, classReportCSV }         = require("../controllers/attendanceController");
const { dashboard, myClasses, createClass, updateClass,
        deleteClass, classReport: lecturerReport }            = require("../controllers/lecturerController");
const { getProfile, updateProfile }                           = require("../controllers/profileController");
const { protect, requireRole }                                = require("../middleware/auth"); // updated

// ── Auth (public) ──────────────────────────────────────────
router.post("/auth/register", register);
router.post("/auth/login",    login);

// ── Profile (both roles) ───────────────────────────────────
router.get("/profile",  protect, getProfile);
router.put("/profile",  protect, updateProfile);

// ── Classes (both roles can view) ─────────────────────────
router.get("/classes",  protect, listClasses);

// ── Lecturer routes ────────────────────────────────────────
router.get   ("/lecturer/dashboard",       protect, requireRole("lecturer"), dashboard);
router.get   ("/lecturer/classes",         protect, requireRole("lecturer"), myClasses);
router.post  ("/lecturer/classes",         protect, requireRole("lecturer"), createClass);
router.put   ("/lecturer/classes/:id",     protect, requireRole("lecturer"), updateClass);
router.delete("/lecturer/classes/:id",     protect, requireRole("lecturer"), deleteClass);
router.get   ("/lecturer/report/:classId", protect, requireRole("lecturer"), lecturerReport);

// ── Student attendance routes ──────────────────────────────
router.post("/attendance/sign-in",              protect, requireRole("student"),           signIn);
router.get ("/attendance/my-logs",              protect, requireRole("student"),           myLogs);
router.get ("/attendance/report/:classId",      protect, requireRole("student","lecturer"), classReport);
router.get ("/attendance/report/:classId/csv",  protect, requireRole("lecturer"),          classReportCSV);
router.get ("/attendance/report/:classId/csv",  protect, requireRole("lecturer"),          classReportCSV);

module.exports = router; 