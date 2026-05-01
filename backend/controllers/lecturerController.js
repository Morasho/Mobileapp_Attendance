const pool = require("../config/db");

// GET /api/lecturer/dashboard
const dashboard = async (req, res) => {
  const lecturerId = req.user.id;
  try {
    const { rows: classes } = await pool.query(
      "SELECT id, name, course_code FROM classes WHERE lecturer_id = $1",
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
      `SELECT c.id, c.name, c.course_code,
              u.name AS lecturer,             -- fixed: join instead of stale string
              c.classroom_lat, c.classroom_lng, c.created_at
       FROM classes c
       JOIN users u ON c.lecturer_id = u.id
       WHERE c.lecturer_id = $1
       ORDER BY c.name ASC`,
      [req.user.id]
    );
    res.json({ classes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch classes" });
  }
};

// POST /api/lecturer/classes
const createClass = async (req, res) => {
  const { name, courseCode, classroomLat, classroomLng } = req.body;
  const lecturerId = req.user.id;

  if (!name || !courseCode || classroomLat == null || classroomLng == null)
    return res.status(400).json({ error: "name, courseCode, classroomLat and classroomLng are required" });

  try {
    // fixed: query users not lecturers
    const { rows: uRows } = await pool.query(
      "SELECT name FROM users WHERE id = $1", [lecturerId]
    );
    const lecturerName = uRows[0]?.name || null;

    const { rows } = await pool.query(
      `INSERT INTO classes (name, course_code, lecturer, classroom_lat, classroom_lng, lecturer_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, courseCode, lecturerName, classroomLat, classroomLng, lecturerId]
    );
    res.status(201).json({ message: "Class created", class: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create class" });
  }
};

// PUT /api/lecturer/classes/:id
const updateClass = async (req, res) => {
  const { id } = req.params;
  const { name, courseCode, classroomLat, classroomLng } = req.body;

  try {
    const { rows: check } = await pool.query(
      "SELECT id FROM classes WHERE id = $1 AND lecturer_id = $2",
      [id, req.user.id]
    );
    if (!check.length)
      return res.status(403).json({ error: "Class not found or access denied" });

    const { rows } = await pool.query(
      `UPDATE classes SET
         name          = COALESCE($1, name),
         course_code   = COALESCE($2, course_code),
         classroom_lat = COALESCE($3, classroom_lat),
         classroom_lng = COALESCE($4, classroom_lng)
       WHERE id = $5 RETURNING *`,
      [name, courseCode, classroomLat, classroomLng, id]
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

// GET /api/lecturer/report/:classId?date=YYYY-MM-DD
const classReport = async (req, res) => {
  const { classId } = req.params;
  const date = req.query.date || new Date().toISOString().split("T")[0];

  try {
    const { rows: classRows } = await pool.query(
      "SELECT * FROM classes WHERE id = $1 AND lecturer_id = $2",
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
       JOIN users u ON al.student_id = u.id    -- fixed: was JOIN students
       WHERE al.class_id = $1 AND al.signed_date = $2
       ORDER BY u.name ASC`,
      [classId, date]
    );

    const totalEnrolled = parseInt(enrolled[0].total);
    const totalPresent  = present.length;

    res.json({
      class: { id: classId, name: cls.name, courseCode: cls.course_code },
      date,
      summary: {
        totalEnrolled,
        totalPresent,
        totalAbsent: Math.max(0, totalEnrolled - totalPresent),
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

module.exports = { dashboard, myClasses, createClass, updateClass, deleteClass, classReport };