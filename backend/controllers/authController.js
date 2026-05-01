const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const pool   = require("../config/db");

// Unchanged — keep exactly as-is
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

  if (!["student", "lecturer"].includes(role))
    return res.status(400).json({ error: "role must be student or lecturer" });

  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });

  if (role === "student" && !studentId)
    return res.status(400).json({ error: "studentId is required for students" });

  try {
    const hashed = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO users
         (name, email, student_id, password, role, phone, department)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, student_id, role, phone, department`,
      [
        name,
        email,
        role === "student" ? studentId : null,   // lecturers have no student_id
        hashed,
        role,
        phone      || null,
        department || null,                       // students will just have null here
      ]
    );

    const user = rows[0];
    return res.status(201).json({
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully`,
      token: makeToken(user, role),
      user: buildSafeUser(user),
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

  if (!["student", "lecturer"].includes(role))
    return res.status(400).json({ error: "role must be student or lecturer" });

  try {
    let user;

    if (role === "lecturer") {
      if (!email)
        return res.status(400).json({ error: "Email is required for lecturers" });

      const { rows } = await pool.query(
        "SELECT * FROM users WHERE email = $1 AND role = 'lecturer'",
        [email]
      );
      user = rows[0];

    } else {
      // Students can log in with studentId or email — same as before
      const identifier = studentId || email;
      if (!identifier)
        return res.status(400).json({ error: "Student ID or email is required" });

      const { rows } = await pool.query(
        "SELECT * FROM users WHERE (student_id = $1 OR email = $1) AND role = 'student'",
        [identifier]
      );
      user = rows[0];
    }

    if (!user)
      return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: "Invalid credentials" });

    res.json({
      message: "Login successful",
      token: makeToken(user, user.role),
      user: buildSafeUser(user),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
};

// Centralised — avoids duplicating this in register AND login
const buildSafeUser = (user) => ({
  id:           user.id,
  name:         user.name,
  email:        user.email,
  phone:        user.phone       || null,
  role:         user.role,
  profilePhoto: user.profile_photo || null,
  ...(user.role === "student"  && { studentId:  user.student_id }),
  ...(user.role === "lecturer" && { department: user.department }),
});

module.exports = { register, login };