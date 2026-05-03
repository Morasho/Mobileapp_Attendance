const pool = require("../config/db");

// ── Helper: send Expo push notifications ───────────────────
// Called after a session opens — alerts all eligible students
const sendPushNotifications = async (unitId, title, body) => {
  try {
    // Get push tokens for all students enrolled in this unit's course + year
    const { rows: unitRow } = await pool.query(
      "SELECT course_id, year_of_study FROM units WHERE id = $1", [unitId]
    );
    if (!unitRow.length) return;

    const { course_id, year_of_study } = unitRow[0];

    const { rows: students } = await pool.query(
      `SELECT expo_push_token FROM users
       WHERE role = 'student'
         AND course_id     = $1
         AND year_of_study = $2
         AND expo_push_token IS NOT NULL`,
      [course_id, year_of_study]
    );

    if (!students.length) return;

    const messages = students.map(s => ({
      to:    s.expo_push_token,
      sound: "default",
      title,
      body,
      data:  { unitId },
    }));

    // Fire-and-forget — don't block the response
    fetch("https://exp.host/--/api/v2/push/send", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(messages),
    }).catch(err => console.error("Push notification error:", err.message));

  } catch (err) {
    console.error("sendPushNotifications error:", err.message);
  }
};

// GET /api/lecturer/dashboard
const dashboard = async (req, res) => {
  const lecturerId = req.user.id;
  try {
    // Join units to get names — classes no longer has name/course_code directly
    const { rows: classes } = await pool.query(
      `SELECT c.id, u.name AS unit_name, u.code AS unit_code,
              u.year_of_study, u.semester
       FROM classes c
       JOIN units u ON c.unit_id = u.id
       WHERE c.lecturer_id = $1`,
      [lecturerId]
    );

    const classIds = classes.map(c => c.id);
    let todayTotal = 0;

    if (classIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS total FROM attendance_logs
         WHERE class_id = ANY($1) AND signed_date = CURRENT_DATE`,
        [classIds]
      );
      todayTotal = parseInt(rows[0].total);
    }

    res.json({ totalClasses: classes.length, todayAttendance: todayTotal, classes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load dashboard" });
  }
};

// GET /api/lecturer/classes
const myClasses = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id,
              u.name  AS unit_name,
              u.code  AS unit_code,
              u.year_of_study,
              u.semester,
              usr.name AS lecturer,
              c.classroom_lat, c.classroom_lng, c.created_at,
              COALESCE(s.is_active, FALSE) AS session_active
       FROM classes c
       JOIN units u   ON c.unit_id     = u.id
       JOIN users usr ON c.lecturer_id = usr.id
       LEFT JOIN sessions s ON s.class_id = c.id AND s.is_active = TRUE
       WHERE c.lecturer_id = $1
       ORDER BY u.year_of_study, u.semester, u.name ASC`,
      [req.user.id]
    );
    res.json({ classes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch classes" });
  }
};

// POST /api/lecturer/classes
// Body: { unitId, classroomLat?, classroomLng? }
// classroomLat/Lng are optional reference coords — the live GPS geofence
// comes from the session open, not here.
const createClass = async (req, res) => {
  const { unitId, classroomLat, classroomLng } = req.body;
  const lecturerId = req.user.id;

  if (!unitId)
    return res.status(400).json({ error: "unitId is required" });

  try {
    // Verify this lecturer is assigned to the unit
    const { rows: assigned } = await pool.query(
      `SELECT 1 FROM lecturer_units
       WHERE lecturer_id = $1 AND unit_id = $2`,
      [lecturerId, unitId]
    );
    if (!assigned.length)
      return res.status(403).json({ error: "You are not assigned to this unit" });

    // Prevent duplicate class (one class per lecturer per unit)
    const { rows: existing } = await pool.query(
      `SELECT id FROM classes WHERE unit_id = $1 AND lecturer_id = $2`,
      [unitId, lecturerId]
    );
    if (existing.length)
      return res.status(409).json({ error: "You already have a class for this unit" });

    const { rows } = await pool.query(
      `INSERT INTO classes (unit_id, lecturer_id, classroom_lat, classroom_lng)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [unitId, lecturerId, classroomLat || null, classroomLng || null]
    );

    // Return with unit details for the mobile app
    const { rows: full } = await pool.query(
      `SELECT c.id, u.name AS unit_name, u.code AS unit_code,
              u.year_of_study, u.semester, co.name AS course_name
       FROM classes c
       JOIN units   u  ON c.unit_id  = u.id
       JOIN courses co ON u.course_id = co.id
       WHERE c.id = $1`,
      [rows[0].id]
    );

    res.status(201).json({ message: "Class created", class: full[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create class" });
  }
};

// PUT /api/lecturer/classes/:id
// Only classroom_lat/lng are updatable — unit is fixed once class is created
const updateClass = async (req, res) => {
  const { id } = req.params;
  const { classroomLat, classroomLng } = req.body;

  try {
    const { rows: check } = await pool.query(
      "SELECT id FROM classes WHERE id = $1 AND lecturer_id = $2",
      [id, req.user.id]
    );
    if (!check.length)
      return res.status(403).json({ error: "Class not found or access denied" });

    const { rows } = await pool.query(
      `UPDATE classes SET
         classroom_lat = COALESCE($1, classroom_lat),
         classroom_lng = COALESCE($2, classroom_lng)
       WHERE id = $3 RETURNING *`,
      [classroomLat, classroomLng, id]
    );
    res.json({ message: "Class updated", class: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update class" });
  }
};

// DELETE /api/lecturer/classes/:id
const deleteClass = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: check } = await pool.query(
      "SELECT id FROM classes WHERE id = $1 AND lecturer_id = $2",
      [id, req.user.id]
    );
    if (!check.length)
      return res.status(403).json({ error: "Class not found or access denied" });

    await pool.query("DELETE FROM classes WHERE id = $1", [id]);
    res.json({ message: "Class deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete class" });
  }
};

// GET /api/lecturer/units
const myUnits = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.code, u.year_of_study, u.semester,
              c.name AS course_name, c.code AS course_code,
              -- flag whether lecturer already created a class for this unit
              EXISTS (
                SELECT 1 FROM classes cl
                WHERE cl.unit_id = u.id AND cl.lecturer_id = $1
              ) AS class_exists
       FROM lecturer_units lu
       JOIN units   u ON lu.unit_id  = u.id
       JOIN courses c ON u.course_id = c.id
       WHERE lu.lecturer_id = $1
       ORDER BY c.name, u.year_of_study, u.semester, u.name`,
      [req.user.id]
    );
    res.json({ units: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch units" });
  }
};

// GET /api/lecturer/report/:classId?date=YYYY-MM-DD
const classReport = async (req, res) => {
  const { classId } = req.params;
  const date = req.query.date || new Date().toISOString().split("T")[0];

  try {
    // Join units to get name/code from new schema
    const { rows: classRows } = await pool.query(
      `SELECT c.id, c.lecturer_id,
              u.name AS unit_name, u.code AS unit_code
       FROM classes c
       JOIN units u ON c.unit_id = u.id
       WHERE c.id = $1 AND c.lecturer_id = $2`,
      [classId, req.user.id]
    );
    if (!classRows.length)
      return res.status(403).json({ error: "Class not found or access denied" });

    const cls = classRows[0];

    const { rows: enrolled } = await pool.query(
      "SELECT COUNT(DISTINCT student_id) AS total FROM attendance_logs WHERE class_id = $1",
      [classId]
    );

    const { rows: present } = await pool.query(
      `SELECT u.name, u.student_id, al.signed_at, al.distance_m, al.status
       FROM attendance_logs al
       JOIN users u ON al.student_id = u.id
       WHERE al.class_id = $1 AND al.signed_date = $2
       ORDER BY u.name ASC`,
      [classId, date]
    );

    const totalEnrolled = parseInt(enrolled[0].total);
    const totalPresent  = present.length;

    res.json({
      class: { id: classId, name: cls.unit_name, courseCode: cls.unit_code },
      date,
      summary: {
        totalEnrolled,
        totalPresent,
        totalAbsent:    Math.max(0, totalEnrolled - totalPresent),
        attendanceRate: totalEnrolled > 0
          ? Math.round((totalPresent / totalEnrolled) * 100) : 0,
      },
      records: present,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not generate report" });
  }
};

module.exports = {
  dashboard, myUnits, myClasses,
  createClass, updateClass, deleteClass,
  classReport, sendPushNotifications,
};