const pool = require("../config/db");

// GET /api/classes
const listClasses = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, course_code, lecturer FROM classes ORDER BY name ASC"
    );
    res.json({ classes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch classes" });
  }
};

// POST /api/classes
const createClass = async (req, res) => {
  const { name, courseCode, lecturer, classroomLat, classroomLng } = req.body;

  if (!name || !courseCode || classroomLat == null || classroomLng == null)
    return res.status(400).json({ error: "name, courseCode, classroomLat and classroomLng are required" });

  try {
    const { rows } = await pool.query(
      `INSERT INTO classes (name, course_code, lecturer, classroom_lat, classroom_lng)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, courseCode, lecturer || null, classroomLat, classroomLng]
    );
    res.status(201).json({ message: "Class created", class: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create class" });
  }
};

module.exports = { listClasses, createClass };