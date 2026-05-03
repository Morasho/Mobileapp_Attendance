const pool = require("../config/db");

// GET /api/classes
// Students: only classes matching their course + year
// Lecturers: their own classes
const listClasses = async (req, res) => {
  const { id, role, course_id, year_of_study } = req.user;

  try {
    let rows;

    if (role === "student") {
      const result = await pool.query(
        `SELECT c.id,
                u.name        AS unit_name,
                u.code        AS unit_code,
                u.year_of_study,
                u.semester,
                usr.name      AS lecturer,
                c.classroom_lat,
                c.classroom_lng,
                COALESCE(s.is_active, FALSE) AS session_active
         FROM classes c
         JOIN units   u   ON c.unit_id     = u.id
         JOIN users   usr ON c.lecturer_id = usr.id
         LEFT JOIN sessions s ON s.class_id = c.id AND s.is_active = TRUE
         WHERE u.course_id     = $1
           AND u.year_of_study = $2
         ORDER BY u.semester, u.name ASC`,
        [course_id, year_of_study]
      );
      rows = result.rows;

    } else if (role === "lecturer") {
      const result = await pool.query(
        `SELECT c.id,
                u.name        AS unit_name,
                u.code        AS unit_code,
                u.year_of_study,
                u.semester,
                usr.name      AS lecturer,
                c.classroom_lat,
                c.classroom_lng,
                COALESCE(s.is_active, FALSE) AS session_active
         FROM classes c
         JOIN units   u   ON c.unit_id     = u.id
         JOIN users   usr ON c.lecturer_id = usr.id
         LEFT JOIN sessions s ON s.class_id = c.id AND s.is_active = TRUE
         WHERE c.lecturer_id = $1
         ORDER BY u.year_of_study, u.semester, u.name ASC`,
        [id]
      );
      rows = result.rows;

    } else {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ classes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch classes" });
  }
};

module.exports = { listClasses };