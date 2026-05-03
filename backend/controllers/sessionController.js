const pool = require("../config/db");
const { sendPushNotifications } = require("./lecturerController");
const { getActivePeriod, getNextClassDate } = require("./academicController");

// POST /api/sessions/open
// Body: { classId, lat, lng, nextClassDate?, isMakeup?, makeupReason? }
const openSession = async (req, res) => {
  const { classId, lat, lng, nextClassDate, isMakeup, makeupReason } = req.body;
  const lecturerId = req.user.id;

  if (!classId || lat == null || lng == null)
    return res.status(400).json({ error: "classId, lat and lng are required" });

  try {
    // 1. Verify lecturer owns class
    const { rows: classRows } = await pool.query(
      `SELECT c.id, u.name AS unit_name, u.code AS unit_code, c.unit_id
       FROM classes c
       JOIN units u ON c.unit_id = u.id
       WHERE c.id = $1 AND c.lecturer_id = $2`,
      [classId, lecturerId]
    );
    if (!classRows.length)
      return res.status(403).json({ error: "Class not found or access denied" });

    // 2. Check no existing open session
    const { rows: existing } = await pool.query(
      "SELECT id FROM sessions WHERE class_id = $1 AND is_active = TRUE",
      [classId]
    );
    if (existing.length)
      return res.status(409).json({ error: "A session is already open. Close it first." });

    // 3. Get active academic period (warn but don't block if none set)
    const period = await getActivePeriod();
    const periodId = period?.id || null;

    // 4. Compute next class date from schedule if not provided
    let resolvedNextDate = nextClassDate || null;
    if (!resolvedNextDate && !isMakeup) {
      try {
        const req2 = { params: { classId: String(classId) }, user: { id: lecturerId } };
        const { rows: scheduleRows } = await pool.query(
          "SELECT * FROM class_schedules WHERE class_id = $1 ORDER BY day_of_week",
          [classId]
        );
        if (scheduleRows.length) {
          const today = new Date();
          const todayDay = today.getDay();
          let minDays = 8;
          scheduleRows.forEach(slot => {
            let d = slot.day_of_week - todayDay;
            if (d <= 0) d += 7;
            if (d < minDays) { minDays = d; }
          });
          const next = new Date();
          next.setDate(today.getDate() + minDays);
          resolvedNextDate = next.toISOString().split("T")[0];
        }
      } catch (_) {}
    }

    // 5. Insert session
    const { rows } = await pool.query(
      `INSERT INTO sessions
         (class_id, opened_by, opened_lat, opened_lng,
          period_id, class_date, next_class_date, is_makeup, makeup_reason)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, $8)
       RETURNING *`,
      [
        classId, lecturerId, lat, lng,
        periodId,
        resolvedNextDate || null,
        isMakeup ? true : false,
        makeupReason || null,
      ]
    );

    const cls = classRows[0];

    // 6. Push notification to students
    const notifBody = isMakeup
      ? `Make-up class for ${cls.unit_name} (${cls.unit_code}) is now open. Mark your attendance.`
      : `${cls.unit_name} (${cls.unit_code}) attendance is open. Mark your attendance now.`;

    sendPushNotifications(cls.unit_id, "Class started", notifBody);

    res.status(201).json({
      message: `Attendance opened for ${cls.unit_name}`,
      session: rows[0],
      periodWarning: !period ? "No active academic period set. Ask admin to activate one." : null,
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
      message:        "Session closed",
      session:        rows[0],
      totalSignIns:   parseInt(countRows[0].total),
      classDate:      rows[0].class_date,
      nextClassDate:  rows[0].next_class_date,
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
      `SELECT s.id, s.opened_at, s.opened_lat, s.opened_lng,
              s.class_date, s.next_class_date, s.is_makeup, s.makeup_reason,
              u.name AS opened_by,
              ap.name AS period_name
       FROM sessions s
       JOIN users u ON s.opened_by = u.id
       LEFT JOIN academic_periods ap ON s.period_id = ap.id
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
      `SELECT s.id, s.opened_at, s.class_id, s.class_date,
              s.next_class_date, s.is_makeup,
              u.name AS class_name, u.code AS course_code,
              ap.name AS period_name
       FROM sessions s
       JOIN classes c ON s.class_id = c.id
       JOIN units   u ON c.unit_id  = u.id
       LEFT JOIN academic_periods ap ON s.period_id = ap.id
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