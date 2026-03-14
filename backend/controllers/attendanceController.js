const pool = require("../config/db");
const { isWithinGeofence } = require("../db/geoService");

// POST /api/attendance/sign-in
const signIn = async (req, res) => {
  const { classId, latitude, longitude } = req.body;
  const studentId = req.student.id;

  if (!classId || latitude == null || longitude == null)
    return res.status(400).json({ error: "classId, latitude and longitude are required" });

  try {
    // 1. Get classroom GPS pin
    const { rows: classRows } = await pool.query(
      "SELECT * FROM classes WHERE id = $1",
      [classId]
    );
    if (!classRows.length)
      return res.status(404).json({ error: "Class not found" });

    const cls = classRows[0];

    // 2. Geofence check
    const { allowed, distanceM } = isWithinGeofence(
      latitude, longitude,
      cls.classroom_lat, cls.classroom_lng
    );

    if (!allowed) {
      return res.status(403).json({
        error: `You are ${distanceM}m away. Must be within ${process.env.GEOFENCE_RADIUS_METERS || 100}m of the classroom.`,
        distanceM,
        allowed: false,
      });
    }

    // 3. Log attendance — UNIQUE (student_id, class_id, signed_date) blocks duplicates
    const { rows, rowCount } = await pool.query(
      `INSERT INTO attendance_logs (student_id, class_id, latitude, longitude, distance_m, signed_date)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
       ON CONFLICT (student_id, class_id, signed_date) DO NOTHING
       RETURNING *`,
      [studentId, classId, latitude, longitude, distanceM]
    );

    if (rowCount === 0)
      return res.status(409).json({ error: "Attendance already recorded for today" });

    res.status(201).json({
      message: "Attendance recorded successfully",
      log: rows[0],
      distanceM,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sign-in failed" });
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
      [req.student.id]
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
    const { rows } = await pool.query(
      `SELECT s.name, s.student_id, al.signed_at, al.distance_m, al.status
       FROM attendance_logs al
       JOIN students s ON al.student_id = s.id
       WHERE al.class_id = $1 AND al.signed_date = $2
       ORDER BY al.signed_at ASC`,
      [classId, date]
    );
    res.json({ classId, date, totalPresent: rows.length, records: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not generate report" });
  }
};

module.exports = { signIn, myLogs, classReport };