const express  = require("express");
const router   = express.Router();
const pool     = require("../config/db");

const { register, login }                                     = require("../controllers/authController");
const { listClasses }                                         = require("../controllers/classController");
const { signIn, myLogs, mySummary, classReport, classReportCSV }         = require("../controllers/attendanceController");
const { dashboard, myUnits, myClasses, createClass, updateClass,
        deleteClass, classReport: lecturerReport }            = require("../controllers/lecturerController");
const { getProfile, updateProfile }                           = require("../controllers/profileController");
const { openSession, closeSession,
        getActiveSession, myOpenSessions }                    = require("../controllers/sessionController");
const {
  getCourses, createCourse, updateCourse, deleteCourse,
  getUnits, createUnit, updateUnit, deleteUnit,
  getLecturers, assignUnit, unassignUnit, getStudents,
}                                                             = require("../controllers/adminController");
const {
  getPeriods, createPeriod, activatePeriod, deletePeriod,
  periodReport, periodReportCSV, periodSummary,
  getSchedule, setSchedule, deleteSchedule, getNextClassDate,
}                                                             = require("../controllers/academicController");
const { protect, requireRole }                                = require("../middleware/auth");

// ── Auth (public) ──────────────────────────────────────────
router.post("/auth/register", register);
router.post("/auth/login",    login);

// ── Courses (public — needed for register screen) ──────────
router.get("/courses", getCourses);

// ── Profile (both roles) ───────────────────────────────────
router.get("/profile",  protect, getProfile);
router.put("/profile",  protect, updateProfile);

// ── Classes (filtered by student's course + year) ──────────
router.get("/classes",  protect, listClasses);

// ── Sessions ──────────────────────────────────────────────
router.post("/sessions/open",            protect, requireRole("lecturer"), openSession);
router.post("/sessions/close",           protect, requireRole("lecturer"), closeSession);
router.get ("/sessions/my-open",         protect, requireRole("lecturer"), myOpenSessions);
router.get ("/sessions/active/:classId", protect, getActiveSession);

// ── Lecturer routes ────────────────────────────────────────
router.get   ("/lecturer/dashboard",       protect, requireRole("lecturer"), dashboard);
router.get   ("/lecturer/classes",         protect, requireRole("lecturer"), myClasses);
router.post  ("/lecturer/classes",         protect, requireRole("lecturer"), createClass);
router.put   ("/lecturer/classes/:id",     protect, requireRole("lecturer"), updateClass);
router.delete("/lecturer/classes/:id",     protect, requireRole("lecturer"), deleteClass);
router.get   ("/lecturer/report/:classId", protect, requireRole("lecturer"), lecturerReport);
router.get   ("/lecturer/units",           protect, requireRole("lecturer"), myUnits);

// ── Class schedules (lecturer) ─────────────────────────────
router.get   ("/lecturer/classes/:classId/schedule",             protect, requireRole("lecturer"), getSchedule);
router.post  ("/lecturer/classes/:classId/schedule",             protect, requireRole("lecturer"), setSchedule);
router.delete("/lecturer/classes/:classId/schedule/:scheduleId", protect, requireRole("lecturer"), deleteSchedule);
router.get   ("/lecturer/classes/:classId/next-class",           protect, requireRole("lecturer"), getNextClassDate);

// ── Student attendance ─────────────────────────────────────
router.post("/attendance/sign-in",             protect, requireRole("student"),            signIn);
router.get ("/attendance/my-logs",             protect, requireRole("student"),            myLogs);
router.get ("/attendance/report/:classId",     protect, requireRole("student","lecturer"), classReport);
router.get ("/attendance/report/:classId/csv", protect, requireRole("lecturer"),           classReportCSV);
router.get("/attendance/my-summary",           protect, requireRole("student"),            mySummary);

// ── Admin routes ───────────────────────────────────────────
router.get   ("/admin/courses",          protect, requireRole("admin"), getCourses);
router.post  ("/admin/courses",          protect, requireRole("admin"), createCourse);
router.put   ("/admin/courses/:id",      protect, requireRole("admin"), updateCourse);
router.delete("/admin/courses/:id",      protect, requireRole("admin"), deleteCourse);

router.get   ("/admin/units",            protect, requireRole("admin"), getUnits);
router.post  ("/admin/units",            protect, requireRole("admin"), createUnit);
router.put   ("/admin/units/:id",        protect, requireRole("admin"), updateUnit);
router.delete("/admin/units/:id",        protect, requireRole("admin"), deleteUnit);

router.get   ("/admin/lecturers",        protect, requireRole("admin"), getLecturers);
router.post  ("/admin/lecturer-units",   protect, requireRole("admin"), assignUnit);
router.delete("/admin/lecturer-units",   protect, requireRole("admin"), unassignUnit);
router.get   ("/admin/students",         protect, requireRole("admin"), getStudents);

// ── Academic periods (admin) ───────────────────────────────
router.get   ("/admin/periods",              protect, requireRole("admin"), getPeriods);
router.post  ("/admin/periods",              protect, requireRole("admin"), createPeriod);
router.put   ("/admin/periods/:id/activate", protect, requireRole("admin"), activatePeriod);
router.delete("/admin/periods/:id",          protect, requireRole("admin"), deletePeriod);
router.get   ("/admin/periods/:id/report",   protect, requireRole("admin"), periodReport);
router.get("/admin/periods/:id/report/csv", protect, requireRole("admin"), periodReportCSV);
router.get("/admin/periods/:id/summary",    protect, requireRole("admin"), periodSummary);

// Active period — accessible by all logged-in users
router.get("/periods/active", protect, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM academic_periods WHERE is_active = TRUE LIMIT 1"
    );
    res.json({ period: rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch active period" });
  }
});

module.exports = router;