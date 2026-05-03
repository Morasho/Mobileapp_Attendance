const pool = require("../config/db");
const { isWithinGeofence } = require("../db/geoService");

// POST /api/attendance/sign-in
const signIn = async (req, res) => {
  const { classId, latitude, longitude } = req.body;
  const studentId = req.user.id;

  if (!classId || latitude == null || longitude == null)
    return res.status(400).json({ error: "classId, latitude and longitude are required" });

  try {
    // 1. Get class + unit info
    const { rows: classRows } = await pool.query(
      `SELECT c.*, u.name AS unit_name, u.course_id, u.year_of_study
       FROM classes c
       JOIN units u ON c.unit_id = u.id
       WHERE c.id = $1`,
      [classId]
    );
    if (!classRows.length)
      return res.status(404).json({ error: "Class not found" });

    // 2. Verify student is in the right course + year
    const cls = classRows[0];
    const { rows: studentRows } = await pool.query(
      "SELECT course_id, year_of_study FROM users WHERE id = $1",
      [studentId]
    );
    const student = studentRows[0];
    if (student.course_id !== cls.course_id || student.year_of_study !== cls.year_of_study)
      return res.status(403).json({ error: "This class is not part of your course or year" });

    // 3. Check active session
    const { rows: sessionRows } = await pool.query(
      `SELECT id, opened_lat, opened_lng
       FROM sessions WHERE class_id = $1 AND is_active = TRUE`,
      [classId]
    );
    if (!sessionRows.length)
      return res.status(403).json({
        error: "No active session. Your lecturer hasn't opened attendance yet.",
        sessionActive: false,
      });

    const session = sessionRows[0];

    // 4. Geofence check using SESSION GPS (lecturer's live location at open time)
    const { allowed, distanceM } = isWithinGeofence(
      latitude, longitude,
      session.opened_lat, session.opened_lng
    );
    if (!allowed) {
      return res.status(403).json({
        error: `You are ${distanceM}m away from the classroom. Must be within ${process.env.GEOFENCE_RADIUS_METERS || 100}m.`,
        distanceM,
        allowed: false,
      });
    }

    // 5. Record attendance
    const { rows, rowCount } = await pool.query(
      `INSERT INTO attendance_logs
         (student_id, class_id, session_id, latitude, longitude, distance_m, signed_date)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
       ON CONFLICT (student_id, class_id, signed_date) DO NOTHING
       RETURNING *`,
      [studentId, classId, session.id, latitude, longitude, distanceM]
    );

    if (rowCount === 0)
      return res.status(409).json({ error: "Attendance already recorded for today" });

    res.status(201).json({
      message: "Attendance recorded successfully",
      log: rows[0],
      distanceM,
    });
  } catch (err) {
    console.error("SIGN-IN ERROR:", err.message);
    res.status(500).json({ error: "Could not record attendance" });
  }
};

// GET /api/attendance/my-logs
const myLogs = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT al.id, al.signed_at, al.signed_date, al.distance_m, al.status,
              u.name AS class_name, u.code AS course_code
       FROM attendance_logs al
       JOIN classes c ON al.class_id = c.id
       JOIN units u   ON c.unit_id   = u.id
       WHERE al.student_id = $1
       ORDER BY al.signed_at DESC`,
      [req.user.id]
    );
    res.json({ logs: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch logs" });
  }
};

// GET /api/attendance/my-summary
// Per-unit attendance stats for the student scoped to active period
const mySummary = async (req, res) => {
  const studentId = req.user.id;
  try {
    // Get active period
    const { rows: periodRows } = await pool.query(
      "SELECT * FROM academic_periods WHERE is_active = TRUE LIMIT 1"
    );
    const period = periodRows[0] || null;

    // Per-unit: total sessions held + student attended
    const params = period
      ? [studentId, req.user.course_id, period.id, req.user.year_of_study]
      : [studentId, req.user.course_id, req.user.year_of_study];

    const periodFilter = period ? "AND s.period_id = $3" : "";
    const yearParam    = period ? "$4" : "$3";

    const { rows: units } = await pool.query(
      `SELECT
         u.id          AS unit_id,
         u.name        AS unit_name,
         u.code        AS unit_code,
         u.semester,
         COUNT(DISTINCT s.id) AS total_sessions,
         COUNT(DISTINCT al.session_id) FILTER (WHERE al.student_id = $1) AS attended
       FROM classes c
       JOIN units u ON c.unit_id = u.id
       LEFT JOIN sessions s
         ON s.class_id = c.id AND s.is_active = FALSE ${periodFilter}
       LEFT JOIN attendance_logs al
         ON al.session_id = s.id AND al.student_id = $1
       WHERE u.course_id     = $2
         AND u.year_of_study = ${yearParam}
       GROUP BY u.id, u.name, u.code, u.semester
       ORDER BY u.semester, u.name`,
      params
    );

    const summary = units.map(u => ({
      unit_id:        u.unit_id,
      unit_name:      u.unit_name,
      unit_code:      u.unit_code,
      semester:       u.semester,
      total_sessions: parseInt(u.total_sessions),
      attended:       parseInt(u.attended),
      rate:           parseInt(u.total_sessions) > 0
        ? Math.round((parseInt(u.attended) / parseInt(u.total_sessions)) * 100)
        : null,
    }));

    // Recent logs (last 10) with next class date
    const { rows: recentLogs } = await pool.query(
      `SELECT al.id, al.signed_at, al.signed_date, al.distance_m, al.status,
              u.name AS class_name, u.code AS unit_code,
              s.next_class_date
       FROM attendance_logs al
       JOIN classes c  ON al.class_id   = c.id
       JOIN units u    ON c.unit_id     = u.id
       JOIN sessions s ON al.session_id = s.id
       WHERE al.student_id = $1
       ORDER BY al.signed_at DESC
       LIMIT 10`,
      [studentId]
    );

    res.json({ period: period || null, summary, recentLogs });
  } catch (err) {
    console.error("MY-SUMMARY ERROR:", err.message);
    res.status(500).json({ error: "Could not fetch summary" });
  }
};

// GET /api/attendance/report/:classId?date=YYYY-MM-DD
const classReport = async (req, res) => {
  const { classId } = req.params;
  const date = req.query.date || new Date().toISOString().split("T")[0];

  try {
    const { rows: classRows } = await pool.query(
      `SELECT c.*, u.name AS unit_name, u.code AS unit_code, c.lecturer_id,
              usr.name AS lecturer_name
       FROM classes c
       JOIN units u   ON c.unit_id     = u.id
       JOIN users usr ON c.lecturer_id = usr.id
       WHERE c.id = $1`,
      [classId]
    );
    if (!classRows.length)
      return res.status(404).json({ error: "Class not found" });

    const cls = classRows[0];

    if (req.user.role === "lecturer" && cls.lecturer_id !== req.user.id)
      return res.status(403).json({ error: "Not your class" });

    const { rows: enrolledRows } = await pool.query(
      "SELECT COUNT(DISTINCT student_id) AS total FROM attendance_logs WHERE class_id = $1",
      [classId]
    );

    const { rows: presentRows } = await pool.query(
      `SELECT u.name, u.student_id, al.signed_at, al.distance_m, al.status
       FROM attendance_logs al
       JOIN users u ON al.student_id = u.id
       WHERE al.class_id = $1 AND al.signed_date = $2
       ORDER BY u.name ASC`,
      [classId, date]
    );

    const totalEnrolled = parseInt(enrolledRows[0].total);
    const totalPresent  = presentRows.length;

    res.json({
      class: {
        id:         classId,
        name:       cls.unit_name,
        courseCode: cls.unit_code,
        lecturer:   cls.lecturer_name,
      },
      date,
      summary: {
        totalEnrolled,
        totalPresent,
        totalAbsent:    Math.max(0, totalEnrolled - totalPresent),
        attendanceRate: totalEnrolled > 0
          ? Math.round((totalPresent / totalEnrolled) * 100) : 0,
      },
      records: presentRows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not generate report" });
  }
};

// GET /api/attendance/report/:classId/csv
const classReportCSV = async (req, res) => {
  const { classId } = req.params;
  const date = req.query.date || new Date().toISOString().split("T")[0];

  try {
    const { rows: classRows } = await pool.query(
      `SELECT c.lecturer_id, u.code AS unit_code
       FROM classes c JOIN units u ON c.unit_id = u.id
       WHERE c.id = $1`,
      [classId]
    );
    if (!classRows.length)
      return res.status(404).json({ error: "Class not found" });

    if (classRows[0].lecturer_id !== req.user.id)
      return res.status(403).json({ error: "Not your class" });

    const { rows } = await pool.query(
      `SELECT u.name, u.student_id, al.signed_at, al.distance_m, al.status
       FROM attendance_logs al
       JOIN users u ON al.student_id = u.id
       WHERE al.class_id = $1 AND al.signed_date = $2
       ORDER BY u.name ASC`,
      [classId, date]
    );

    const header = "Name,Student ID,Time Signed In,Distance (m),Status";
    const csvRows = rows.map(r =>
      `"${r.name}","${r.student_id}","${new Date(r.signed_at).toLocaleString()}","${r.distance_m}","${r.status}"`
    );

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition",
      `attachment; filename="attendance_${classRows[0].unit_code}_${date}.csv"`);
    res.send([header, ...csvRows].join("\n"));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not export CSV" });
  }
};

module.exports = { signIn, myLogs, mySummary, classReport, classReportCSV };