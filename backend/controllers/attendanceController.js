const pool = require("../config/db");
const { isWithinGeofence } = require("../db/geoService");

// POST /api/attendance/sign-in
const signIn = async (req, res) => {
  const { classId, latitude, longitude } = req.body;
  const studentId = req.user.id;  // fixed: was req.student.id

  if (!classId || latitude == null || longitude == null)
    return res.status(400).json({ error: "classId, latitude and longitude are required" });

  try {
    const { rows: classRows } = await pool.query(
      "SELECT * FROM classes WHERE id = $1", [classId]
    );
    if (!classRows.length)
      return res.status(404).json({ error: "Class not found" });

    const cls = classRows[0];
    const { allowed, distanceM } = isWithinGeofence(
      latitude, longitude, cls.classroom_lat, cls.classroom_lng
    );

    if (!allowed) {
      return res.status(403).json({
        error: `You are ${distanceM}m away. Must be within ${process.env.GEOFENCE_RADIUS_METERS || 100}m.`,
        distanceM,
        allowed: false,
      });
    }

    const { rows, rowCount } = await pool.query(
      `INSERT INTO attendance_logs (student_id, class_id, latitude, longitude, distance_m, signed_date)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
       ON CONFLICT (student_id, class_id, signed_date) DO NOTHING
       RETURNING *`,
      [studentId, classId, latitude, longitude, distanceM]
    );

    if (rowCount === 0)
      return res.status(409).json({ error: "Attendance already recorded for today" });

    res.status(201).json({ message: "Attendance recorded successfully", log: rows[0], distanceM });
  } catch (err) {
    console.error("SIGN-IN ERROR:", err.message);
    res.status(500).json({ error: "Could not record attendance" }); // fixed: was leaking err.message
  }
};

// GET /api/attendance/my-logs
const myLogs = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT al.id, al.signed_at, al.signed_date, al.distance_m, al.status,
              c.name AS class_name, c.course_code
       FROM attendance_logs al
       JOIN classes c ON al.class_id = c.id
       WHERE al.student_id = $1
       ORDER BY al.signed_at DESC`,
      [req.user.id]  // fixed: was req.student.id
    );
    res.json({ logs: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch logs" });
  }
};

// GET /api/attendance/report/:classId?date=YYYY-MM-DD
const classReport = async (req, res) => {
  const { classId } = req.params;
  const date = req.query.date || new Date().toISOString().split("T")[0];

  try {
    const { rows: classRows } = await pool.query(
      "SELECT name, course_code, lecturer, lecturer_id FROM classes WHERE id = $1",
      [classId]
    );
    if (!classRows.length)
      return res.status(404).json({ error: "Class not found" });

    const cls = classRows[0];

    // Ownership check — lecturers can only see their own classes
    if (req.user.role === "lecturer" && cls.lecturer_id !== req.user.id)
      return res.status(403).json({ error: "Not your class" });

    const { rows: enrolledRows } = await pool.query(
      `SELECT COUNT(DISTINCT student_id) AS total FROM attendance_logs WHERE class_id = $1`,
      [classId]
    );

    const { rows: presentRows } = await pool.query(
      `SELECT u.name, u.student_id, al.signed_at, al.distance_m, al.status
       FROM attendance_logs al
       JOIN users u ON al.student_id = u.id   -- fixed: was JOIN students
       WHERE al.class_id = $1 AND al.signed_date = $2
       ORDER BY u.name ASC`,
      [classId, date]
    );

    const totalEnrolled  = parseInt(enrolledRows[0].total);
    const totalPresent   = presentRows.length;
    const totalAbsent    = Math.max(0, totalEnrolled - totalPresent);
    const attendanceRate = totalEnrolled > 0
      ? Math.round((totalPresent / totalEnrolled) * 100) : 0;

    res.json({
      class: { id: classId, name: cls.name, courseCode: cls.course_code, lecturer: cls.lecturer },
      date,
      summary: { totalEnrolled, totalPresent, totalAbsent, attendanceRate },
      records: presentRows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not generate report" });
  }
};

// GET /api/attendance/report/:classId/csv?date=YYYY-MM-DD
const classReportCSV = async (req, res) => {
  const { classId } = req.params;
  const date = req.query.date || new Date().toISOString().split("T")[0];

  try {
    const { rows: classRows } = await pool.query(
      "SELECT name, course_code, lecturer_id FROM classes WHERE id = $1", [classId]
    );
    if (!classRows.length)
      return res.status(404).json({ error: "Class not found" });

    // Ownership check — lecturers can only export their own classes
    if (classRows[0].lecturer_id !== req.user.id)
      return res.status(403).json({ error: "Not your class" });

    const { rows } = await pool.query(
      `SELECT u.name, u.student_id, al.signed_at, al.distance_m, al.status
       FROM attendance_logs al
       JOIN users u ON al.student_id = u.id   -- fixed: was JOIN students
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
      `attachment; filename="attendance_${classRows[0].course_code}_${date}.csv"`);
    res.send([header, ...csvRows].join("\n"));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not export CSV" });
  }
};

module.exports = { signIn, myLogs, classReport, classReportCSV };