const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const pool   = require("../config/db");

const makeToken = (student) =>
  jwt.sign(
    { id: student.id, studentId: student.student_id, email: student.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

// POST /api/auth/register
const register = async (req, res) => {
  const { name, email, studentId, password } = req.body;

  if (!name || !email || !studentId || !password)
    return res.status(400).json({ error: "All fields are required" });

  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });

  try {
    const hashed = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO students (name, email, student_id, password)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, student_id`,
      [name, email, studentId, hashed]
    );

    const student = rows[0];
    res.status(201).json({
      message: "Registration successful",
      token: makeToken(student),
      student: { id: student.id, name: student.name, email: student.email, studentId: student.student_id },
    });
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "Email or Student ID already exists" });
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const { studentId, password } = req.body;

  if (!studentId || !password)
    return res.status(400).json({ error: "Student ID and password are required" });

  try {
    const { rows } = await pool.query(
      "SELECT * FROM students WHERE student_id = $1",
      [studentId]
    );

    const student = rows[0];
    if (!student) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, student.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    res.json({
      message: "Login successful",
      token: makeToken(student),
      student: { id: student.id, name: student.name, email: student.email, studentId: student.student_id },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
};

module.exports = { register, login };