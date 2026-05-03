const pool = require("../config/db");

// ── Helper: get current active period ──────────────────────
const getActivePeriod = async () => {
  const { rows } = await pool.query(
    "SELECT * FROM academic_periods WHERE is_active = TRUE LIMIT 1"
  );
  return rows[0] || null;
};

// GET /api/admin/periods
const getPeriods = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM academic_periods ORDER BY academic_year DESC, semester DESC"
    );
    res.json({ periods: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch periods" });
  }
};

// POST /api/admin/periods
// Body: { name, academicYear, semester, startDate, endDate }
const createPeriod = async (req, res) => {
  const { name, academicYear, semester, startDate, endDate } = req.body;
  if (!name || !academicYear || !semester || !startDate || !endDate)
    return res.status(400).json({ error: "All fields are required" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO academic_periods (name, academic_year, semester, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, academicYear, semester, startDate, endDate]
    );
    res.status(201).json({ period: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create period" });
  }
};

// PUT /api/admin/periods/:id/activate
// Deactivates all others, activates this one
const activatePeriod = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE academic_periods SET is_active = FALSE");
    const { rows } = await client.query(
      "UPDATE academic_periods SET is_active = TRUE WHERE id = $1 RETURNING *",
      [id]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Period not found" });
    }
    await client.query("COMMIT");
    res.json({ message: "Period activated", period: rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Could not activate period" });
  } finally {
    client.release();
  }
};

// DELETE /api/admin/periods/:id
const deletePeriod = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      "SELECT is_active FROM academic_periods WHERE id = $1", [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Period not found" });
    if (rows[0].is_active)
      return res.status(400).json({ error: "Cannot delete the active period" });
    await pool.query("DELETE FROM academic_periods WHERE id = $1", [id]);
    res.json({ message: "Period deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete period" });
  }
};

// GET /api/admin/periods/:id/report
// Full semester attendance report for a period
const periodReport = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: periodRows } = await pool.query(
      "SELECT * FROM academic_periods WHERE id = $1", [id]
    );
    if (!periodRows.length)
      return res.status(404).json({ error: "Period not found" });
    const period = periodRows[0];

    // All sessions in this period
    const { rows: sessions } = await pool.query(
      `SELECT s.id, s.class_date, s.is_makeup, s.makeup_reason,
              s.opened_at, s.closed_at,
              u.name AS unit_name, u.code AS unit_code,
              usr.name AS lecturer_name,
              COUNT(al.id) AS total_signins
       FROM sessions s
       JOIN classes c   ON s.class_id    = c.id
       JOIN units u     ON c.unit_id     = u.id
       JOIN users usr   ON c.lecturer_id = usr.id
       LEFT JOIN attendance_logs al ON al.session_id = s.id
       WHERE s.period_id = $1
       GROUP BY s.id, u.name, u.code, usr.name
       ORDER BY u.name, s.class_date`,
      [id]
    );

    // Summary per class
    const { rows: summary } = await pool.query(
      `SELECT u.name AS unit_name, u.code AS unit_code,
              usr.name AS lecturer_name,
              COUNT(DISTINCT s.id) AS total_sessions,
              COUNT(DISTINCT al.student_id) AS unique_students,
              COUNT(al.id) AS total_signins
       FROM sessions s
       JOIN classes c   ON s.class_id    = c.id
       JOIN units u     ON c.unit_id     = u.id
       JOIN users usr   ON c.lecturer_id = usr.id
       LEFT JOIN attendance_logs al ON al.session_id = s.id
       WHERE s.period_id = $1
       GROUP BY u.name, u.code, usr.name
       ORDER BY u.name`,
      [id]
    );

    res.json({ period, summary, sessions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not generate report" });
  }
};

// ── Class schedules ─────────────────────────────────────────

// GET /api/lecturer/classes/:classId/schedule
const getSchedule = async (req, res) => {
  const { classId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM class_schedules WHERE class_id = $1 ORDER BY day_of_week`,
      [classId]
    );
    res.json({ schedule: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch schedule" });
  }
};

// POST /api/lecturer/classes/:classId/schedule
// Body: { dayOfWeek, startTime, endTime }
const setSchedule = async (req, res) => {
  const { classId } = req.params;
  const { dayOfWeek, startTime, endTime } = req.body;

  if (dayOfWeek == null || !startTime || !endTime)
    return res.status(400).json({ error: "dayOfWeek, startTime and endTime are required" });

  try {
    // Verify lecturer owns this class
    const { rows: check } = await pool.query(
      "SELECT id FROM classes WHERE id = $1 AND lecturer_id = $2",
      [classId, req.user.id]
    );
    if (!check.length)
      return res.status(403).json({ error: "Class not found or access denied" });

    const { rows } = await pool.query(
      `INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (class_id, day_of_week)
       DO UPDATE SET start_time = $3, end_time = $4
       RETURNING *`,
      [classId, dayOfWeek, startTime, endTime]
    );
    res.status(201).json({ schedule: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not set schedule" });
  }
};

// DELETE /api/lecturer/classes/:classId/schedule/:scheduleId
const deleteSchedule = async (req, res) => {
  const { classId, scheduleId } = req.params;
  try {
    const { rows: check } = await pool.query(
      "SELECT id FROM classes WHERE id = $1 AND lecturer_id = $2",
      [classId, req.user.id]
    );
    if (!check.length)
      return res.status(403).json({ error: "Access denied" });

    await pool.query(
      "DELETE FROM class_schedules WHERE id = $1 AND class_id = $2",
      [scheduleId, classId]
    );
    res.json({ message: "Schedule slot deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete schedule" });
  }
};

// Helper: compute next occurrence of a day_of_week from today
const nextDateForDay = (dayOfWeek) => {
  const today = new Date();
  const todayDay = today.getDay();
  let daysAhead = dayOfWeek - todayDay;
  if (daysAhead <= 0) daysAhead += 7;
  const next = new Date(today);
  next.setDate(today.getDate() + daysAhead);
  return next.toISOString().split("T")[0];
};

// GET /api/lecturer/classes/:classId/next-class
// Returns suggested next class date from schedule
const getNextClassDate = async (req, res) => {
  const { classId } = req.params;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM class_schedules WHERE class_id = $1 ORDER BY day_of_week",
      [classId]
    );
    if (!rows.length)
      return res.json({ nextDate: null, slots: [] });

    // Find the nearest upcoming slot
    const today = new Date();
    const todayDay = today.getDay();

    let nearest = null;
    let minDays = 8;

    rows.forEach(slot => {
      let daysAhead = slot.day_of_week - todayDay;
      if (daysAhead <= 0) daysAhead += 7;
      if (daysAhead < minDays) {
        minDays = daysAhead;
        nearest = slot;
      }
    });

    res.json({
      nextDate: nearest ? nextDateForDay(nearest.day_of_week) : null,
      slots: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not compute next class date" });
  }
};

module.exports = {
  getActivePeriod,
  getPeriods, createPeriod, activatePeriod, deletePeriod, periodReport,
  getSchedule, setSchedule, deleteSchedule, getNextClassDate,
};

// ── Semester report (already in academicController) ─────────
// GET /api/admin/periods/:id/report  — already implemented above
// Adding CSV export endpoint below

// GET /api/admin/periods/:id/report/csv
const periodReportCSV = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: periodRows } = await pool.query(
      "SELECT * FROM academic_periods WHERE id = $1", [id]
    );
    if (!periodRows.length)
      return res.status(404).json({ error: "Period not found" });
    const period = periodRows[0];

    // Full student-level attendance per unit per session
    const { rows } = await pool.query(
      `SELECT
         u.name        AS unit_name,
         u.code        AS unit_code,
         usr_l.name    AS lecturer,
         s.class_date,
         s.is_makeup,
         usr_s.name    AS student_name,
         usr_s.student_id,
         co.name       AS course_name,
         usr_s.year_of_study,
         al.signed_at,
         al.distance_m,
         al.status
       FROM sessions s
       JOIN classes c        ON s.class_id      = c.id
       JOIN units u          ON c.unit_id        = u.id
       JOIN courses co       ON u.course_id      = co.id
       JOIN users usr_l      ON c.lecturer_id    = usr_l.id
       JOIN attendance_logs al ON al.session_id  = s.id
       JOIN users usr_s      ON al.student_id    = usr_s.id
       WHERE s.period_id = $1
       ORDER BY u.name, s.class_date, usr_s.name`,
      [id]
    );

    const header = [
      "Unit", "Code", "Lecturer", "Class Date", "Make-up",
      "Student Name", "Student ID", "Course", "Year",
      "Signed In At", "Distance (m)", "Status"
    ].join(",");

    const csvRows = rows.map(r => [
      `"${r.unit_name}"`,
      `"${r.unit_code}"`,
      `"${r.lecturer}"`,
      `"${r.class_date}"`,
      r.is_makeup ? "Yes" : "No",
      `"${r.student_name}"`,
      `"${r.student_id}"`,
      `"${r.course_name}"`,
      r.year_of_study,
      `"${new Date(r.signed_at).toLocaleString()}"`,
      r.distance_m,
      `"${r.status}"`,
    ].join(","));

    const filename = `attendance_${period.academic_year}_sem${period.semester}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send([header, ...csvRows].join("\n"));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not export CSV" });
  }
};

// GET /api/admin/periods/:id/summary  — per-student attendance rate per unit
const periodSummary = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: periodRows } = await pool.query(
      "SELECT * FROM academic_periods WHERE id = $1", [id]
    );
    if (!periodRows.length)
      return res.status(404).json({ error: "Period not found" });

    // Total sessions per class in this period
    const { rows: sessionCounts } = await pool.query(
      `SELECT c.id AS class_id, u.name AS unit_name, u.code AS unit_code,
              co.name AS course_name, u.year_of_study, u.semester,
              usr.name AS lecturer_name,
              COUNT(s.id) AS total_sessions
       FROM classes c
       JOIN units u    ON c.unit_id     = u.id
       JOIN courses co ON u.course_id   = co.id
       JOIN users usr  ON c.lecturer_id = usr.id
       LEFT JOIN sessions s ON s.class_id = c.id AND s.period_id = $1
       GROUP BY c.id, u.name, u.code, co.name, u.year_of_study, u.semester, usr.name
       HAVING COUNT(s.id) > 0
       ORDER BY co.name, u.year_of_study, u.name`,
      [id]
    );

    // Student attendance per class
    const { rows: studentRows } = await pool.query(
      `SELECT
         c.id          AS class_id,
         usr_s.id      AS student_id,
         usr_s.name    AS student_name,
         usr_s.student_id AS reg_number,
         COUNT(al.id)  AS attended
       FROM sessions s
       JOIN classes c  ON s.class_id    = c.id
       JOIN attendance_logs al ON al.session_id = s.id
       JOIN users usr_s ON al.student_id = usr_s.id
       WHERE s.period_id = $1
       GROUP BY c.id, usr_s.id, usr_s.name, usr_s.student_id`,
      [id]
    );

    // Merge — build per-class student summary
    const classMap = {};
    sessionCounts.forEach(cls => {
      classMap[cls.class_id] = { ...cls, students: [] };
    });
    studentRows.forEach(row => {
      if (classMap[row.class_id]) {
        const total = classMap[row.class_id].total_sessions;
        classMap[row.class_id].students.push({
          student_id:   row.student_id,
          student_name: row.student_name,
          reg_number:   row.reg_number,
          attended:     parseInt(row.attended),
          total:        parseInt(total),
          rate:         Math.round((row.attended / total) * 100),
        });
      }
    });

    res.json({
      period:  periodRows[0],
      classes: Object.values(classMap),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not generate summary" });
  }
};

module.exports = {
  getActivePeriod,
  getPeriods, createPeriod, activatePeriod, deletePeriod,
  periodReport, periodReportCSV, periodSummary,
  getSchedule, setSchedule, deleteSchedule, getNextClassDate,
};