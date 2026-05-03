const pool = require("../config/db");

// ── Courses ─────────────────────────────────────────────────

// GET /api/admin/courses
const getCourses = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM courses ORDER BY name ASC"
    );
    res.json({ courses: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch courses" });
  }
};

// POST /api/admin/courses
const createCourse = async (req, res) => {
  const { name, code, department } = req.body;
  if (!name || !code)
    return res.status(400).json({ error: "name and code are required" });
  try {
    const { rows } = await pool.query(
      "INSERT INTO courses (name, code, department) VALUES ($1, $2, $3) RETURNING *",
      [name, code.toUpperCase(), department || null]
    );
    res.status(201).json({ message: "Course created", course: rows[0] });
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "Course code already exists" });
    console.error(err);
    res.status(500).json({ error: "Could not create course" });
  }
};

// PUT /api/admin/courses/:id
const updateCourse = async (req, res) => {
  const { id } = req.params;
  const { name, code, department } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE courses SET
         name       = COALESCE($1, name),
         code       = COALESCE($2, code),
         department = COALESCE($3, department)
       WHERE id = $4 RETURNING *`,
      [name, code?.toUpperCase(), department, id]
    );
    if (!rows.length) return res.status(404).json({ error: "Course not found" });
    res.json({ message: "Course updated", course: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update course" });
  }
};

// DELETE /api/admin/courses/:id
const deleteCourse = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM courses WHERE id = $1", [id]);
    res.json({ message: "Course deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete course" });
  }
};

// ── Units ────────────────────────────────────────────────────

// GET /api/admin/units?courseId=1&year=2&semester=1
const getUnits = async (req, res) => {
  const { courseId, year, semester } = req.query;
  try {
    let query = `
      SELECT u.*, c.name AS course_name, c.code AS course_code
      FROM units u
      JOIN courses c ON u.course_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (courseId) { params.push(courseId); query += ` AND u.course_id = $${params.length}`; }
    if (year)     { params.push(year);     query += ` AND u.year_of_study = $${params.length}`; }
    if (semester) { params.push(semester); query += ` AND u.semester = $${params.length}`; }
    query += " ORDER BY u.year_of_study, u.semester, u.name ASC";

    const { rows } = await pool.query(query, params);
    res.json({ units: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch units" });
  }
};

// POST /api/admin/units
const createUnit = async (req, res) => {
  const { name, code, courseId, yearOfStudy, semester } = req.body;
  if (!name || !code || !courseId || !yearOfStudy || !semester)
    return res.status(400).json({ error: "name, code, courseId, yearOfStudy and semester are required" });
  if (![1,2,3,4].includes(Number(yearOfStudy)))
    return res.status(400).json({ error: "yearOfStudy must be 1, 2, 3, or 4" });
  if (![1,2].includes(Number(semester)))
    return res.status(400).json({ error: "semester must be 1 or 2" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO units (name, code, course_id, year_of_study, semester)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, code.toUpperCase(), courseId, yearOfStudy, semester]
    );
    res.status(201).json({ message: "Unit created", unit: rows[0] });
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "Unit code already exists in this course" });
    console.error(err);
    res.status(500).json({ error: "Could not create unit" });
  }
};

// PUT /api/admin/units/:id
const updateUnit = async (req, res) => {
  const { id } = req.params;
  const { name, code, yearOfStudy, semester } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE units SET
         name          = COALESCE($1, name),
         code          = COALESCE($2, code),
         year_of_study = COALESCE($3, year_of_study),
         semester      = COALESCE($4, semester)
       WHERE id = $5 RETURNING *`,
      [name, code?.toUpperCase(), yearOfStudy, semester, id]
    );
    if (!rows.length) return res.status(404).json({ error: "Unit not found" });
    res.json({ message: "Unit updated", unit: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update unit" });
  }
};

// DELETE /api/admin/units/:id
const deleteUnit = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM units WHERE id = $1", [id]);
    res.json({ message: "Unit deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete unit" });
  }
};

// ── Lecturer Unit Assignments ────────────────────────────────

// GET /api/admin/lecturers
const getLecturers = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.department,
              COALESCE(
                json_agg(
                  json_build_object('id', un.id, 'name', un.name, 'code', un.code)
                ) FILTER (WHERE un.id IS NOT NULL), '[]'
              ) AS units
       FROM users u
       LEFT JOIN lecturer_units lu ON u.id = lu.lecturer_id
       LEFT JOIN units un ON lu.unit_id = un.id
       WHERE u.role = 'lecturer'
       GROUP BY u.id ORDER BY u.name ASC`
    );
    res.json({ lecturers: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch lecturers" });
  }
};

// POST /api/admin/lecturer-units  — assign a unit to a lecturer
const assignUnit = async (req, res) => {
  const { lecturerId, unitId } = req.body;
  if (!lecturerId || !unitId)
    return res.status(400).json({ error: "lecturerId and unitId are required" });
  try {
    await pool.query(
      "INSERT INTO lecturer_units (lecturer_id, unit_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [lecturerId, unitId]
    );
    res.status(201).json({ message: "Unit assigned to lecturer" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not assign unit" });
  }
};

// DELETE /api/admin/lecturer-units — remove a unit from a lecturer
const unassignUnit = async (req, res) => {
  const { lecturerId, unitId } = req.body;
  try {
    await pool.query(
      "DELETE FROM lecturer_units WHERE lecturer_id = $1 AND unit_id = $2",
      [lecturerId, unitId]
    );
    res.json({ message: "Unit unassigned" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not unassign unit" });
  }
};

// GET /api/admin/students — view all students with course info
const getStudents = async (req, res) => {
  const { courseId, year } = req.query;
  try {
    let query = `
      SELECT u.id, u.name, u.email, u.student_id, u.year_of_study, u.semester,
             c.name AS course_name, c.code AS course_code
      FROM users u
      LEFT JOIN courses c ON u.course_id = c.id
      WHERE u.role = 'student'
    `;
    const params = [];
    if (courseId) { params.push(courseId); query += ` AND u.course_id = $${params.length}`; }
    if (year)     { params.push(year);     query += ` AND u.year_of_study = $${params.length}`; }
    query += " ORDER BY c.name, u.year_of_study, u.name ASC";

    const { rows } = await pool.query(query, params);
    res.json({ students: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch students" });
  }
};

module.exports = {
  getCourses, createCourse, updateCourse, deleteCourse,
  getUnits, createUnit, updateUnit, deleteUnit,
  getLecturers, assignUnit, unassignUnit, getStudents,
};