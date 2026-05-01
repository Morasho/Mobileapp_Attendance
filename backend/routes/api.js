const express  = require("express");
const router   = express.Router();

const { register, login }                                         = require("../controllers/authController");
const { listClasses, createClass: adminCreateClass }              = require("../controllers/classController");
const { signIn, myLogs, classReport, classReportCSV }             = require("../controllers/attendanceController");
const { dashboard, myClasses, createClass, updateClass,
        deleteClass, classReport: lecturerReport }                = require("../controllers/lecturerController");
const { getProfile, updateProfile }                               = require("../controllers/profileController");
const { protect, lecturerOnly, studentOnly }                      = require("../middleware/auth");

// ── Auth (public) ──────────────────────────────────────────
router.post("/auth/register", register);
router.post("/auth/login",    login);

// ── Profile (both roles) ───────────────────────────────────
router.get ("/profile",  protect, getProfile);
router.put ("/profile",  protect, updateProfile);

// ── Classes (public list for students) ────────────────────
router.get ("/classes",  protect, listClasses);

// ── Lecturer routes ────────────────────────────────────────
router.get ("/lecturer/dashboard",           protect, lecturerOnly, dashboard);
router.get ("/lecturer/classes",             protect, lecturerOnly, myClasses);
router.post("/lecturer/classes",             protect, lecturerOnly, createClass);
router.put ("/lecturer/classes/:id",         protect, lecturerOnly, updateClass);
router.delete("/lecturer/classes/:id",       protect, lecturerOnly, deleteClass);
router.get ("/lecturer/report/:classId",     protect, lecturerOnly, lecturerReport);

// ── Student attendance routes ──────────────────────────────
router.post("/attendance/sign-in",              protect, studentOnly, signIn);
router.get ("/attendance/my-logs",              protect, studentOnly, myLogs);
router.get ("/attendance/report/:classId",      protect, classReport);
router.get ("/attendance/report/:classId/csv",  protect, classReportCSV);

module.exports = router;