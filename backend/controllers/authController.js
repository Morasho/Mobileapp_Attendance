const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const pool   = require("../config/db");

const makeToken = (user, role) =>
  jwt.sign(
    { id: user.id, email: user.email, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

// POST /api/auth/register
const register = async (req, res) => {
  const { name, email, studentId, password, role, phone, department } = req.body;

  if (!name || !email || !password || !role)
    return res.status(400).json({ error: "name, email, password and role are required" });

  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });

  try {
    const hashed = await bcrypt.hash(password, 12);

    if (role === "lecturer") {
      const { rows } = await pool.query(
        `INSERT INTO lecturers (name, email, password, phone, department, role)
         VALUES ($1, $2, $3, $4, $5, 'lecturer')
         RETURNING id, name, email, phone, department, role`,
        [name, email, hashed, phone || null, department || null]
      );
      const lecturer = rows[0];
      return res.status(201).json({
        message: "Lecturer registered successfully",
        token: makeToken(lecturer, "lecturer"),
        user: lecturer,
      });
    }

    // Student registration
    if (!studentId)
      return res.status(400).json({ error: "studentId is required for students" });

    const { rows } = await pool.query(
      `INSERT INTO students (name, email, student_id, password, phone, role)
       VALUES ($1, $2, $3, $4, $5, 'student')
       RETURNING id, name, email, student_id, phone, role`,
      [name, email, studentId, hashed, phone || null]
    );
    const student = rows[0];
    res.status(201).json({
      message: "Student registered successfully",
      token: makeToken(student, "student"),
      user: { ...student, studentId: student.student_id },
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
  const { email, studentId, password, role } = req.body;

  if (!password || !role)
    return res.status(400).json({ error: "password and role are required" });

  try {
    let user, userRole;

    if (role === "lecturer") {
      if (!email)
        return res.status(400).json({ error: "Email is required for lecturers" });

      const { rows } = await pool.query(
        "SELECT * FROM lecturers WHERE email = $1", [email]
      );
      user = rows[0];
      userRole = "lecturer";
    } else {
      // Student can login with studentId or email
      const identifier = studentId || email;
      if (!identifier)
        return res.status(400).json({ error: "Student ID or email is required" });

      const { rows } = await pool.query(
        "SELECT * FROM students WHERE student_id = $1 OR email = $1", [identifier]
      );
      user = rows[0];
      userRole = "student";
    }

    if (!user)
      return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: "Invalid credentials" });

    const safeUser = {
      id:         user.id,
      name:       user.name,
      email:      user.email,
      phone:      user.phone,
      role:       userRole,
      profilePhoto: user.profile_photo || null,
      ...(userRole === "student"   && { studentId: user.student_id }),
      ...(userRole === "lecturer"  && { department: user.department }),
    };

    res.json({
      message: "Login successful",
      token: makeToken(user, userRole),
      user: safeUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
};

module.exports = { register, login };