const pool = require("../config/db");

// POST /api/sessions/open
const openSession = async (req, res) => {
  const { classId } = req.body;
  const lecturerId  = req.user.id;

  if (!classId)
    return res.status(400).json({ error: "classId is required" });

  try {
    const { rows: classRows } = await pool.query(
      "SELECT id, name, course_code FROM classes WHERE id = $1 AND lecturer_id = $2",
      [classId, lecturerId]
    );
    if (!classRows.length)
      return res.status(403).json({ error: "Class not found or access denied" });

    const { rows: existing } = await pool.query(
      "SELECT id FROM sessions WHERE class_id = $1 AND is_active = TRUE",
      [classId]
    );
    if (existing.length)
      return res.status(409).json({ error: "A session is already open for this class. Close it first." });

    const { rows } = await pool.query(
      "INSERT INTO sessions (class_id, opened_by) VALUES ($1, $2) RETURNING *",
      [classId, lecturerId]
    );

    res.status(201).json({
      message: `Attendance opened for ${classRows[0].name}`,
      session: rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not open session" });
  }
};

// POST /api/sessions/close
const closeSession = async (req, res) => {
  const { classId } = req.body;
  const lecturerId  = req.user.id;

  if (!classId)
    return res.status(400).json({ error: "classId is required" });

  try {
    const { rows } = await pool.query(
      `UPDATE sessions SET is_active = FALSE, closed_at = NOW()
       WHERE class_id = $1 AND opened_by = $2 AND is_active = TRUE
       RETURNING *`,
      [classId, lecturerId]
    );

    if (!rows.length)
      return res.status(404).json({ error: "No active session found for this class" });

    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*) AS total FROM attendance_logs WHERE session_id = $1",
      [rows[0].id]
    );

    res.json({
      message: "Session closed",
      session:      rows[0],
      totalSignIns: parseInt(countRows[0].total),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not close session" });
  }
};

// GET /api/sessions/active/:classId
const getActiveSession = async (req, res) => {
  const { classId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.opened_at, u.name AS opened_by
       FROM sessions s
       JOIN users u ON s.opened_by = u.id
       WHERE s.class_id = $1 AND s.is_active = TRUE`,
      [classId]
    );
    res.json({ active: rows.length > 0, session: rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not check session status" });
  }
};

// GET /api/sessions/my-open
const myOpenSessions = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.opened_at, s.class_id,
              c.name AS class_name, c.course_code
       FROM sessions s
       JOIN classes c ON s.class_id = c.id
       WHERE s.opened_by = $1 AND s.is_active = TRUE
       ORDER BY s.opened_at DESC`,
      [req.user.id]
    );
    res.json({ sessions: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch open sessions" });
  }
};

module.exports = { openSession, closeSession, getActiveSession, myOpenSessions };