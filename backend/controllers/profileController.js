const pool = require("../config/db");

// GET /api/profile
const getProfile = async (req, res) => {
  const { id, role } = req.user;
  try {
    let user;
    if (role === "lecturer") {
      const { rows } = await pool.query(
        "SELECT id, name, email, phone, department, profile_photo, role, created_at FROM lecturers WHERE id = $1",
        [id]
      );
      user = rows[0];
    } else {
      const { rows } = await pool.query(
        "SELECT id, name, email, student_id, phone, profile_photo, role, created_at FROM students WHERE id = $1",
        [id]
      );
      user = rows[0];
      if (user) user.studentId = user.student_id;
    }

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch profile" });
  }
};

// PUT /api/profile
const updateProfile = async (req, res) => {
  const { id, role } = req.user;
  const { name, phone, department, profilePhoto } = req.body;

  try {
    let user;
    if (role === "lecturer") {
      const { rows } = await pool.query(
        `UPDATE lecturers SET
           name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           department = COALESCE($3, department),
           profile_photo = COALESCE($4, profile_photo)
         WHERE id = $5
         RETURNING id, name, email, phone, department, profile_photo, role`,
        [name, phone, department, profilePhoto, id]
      );
      user = rows[0];
    } else {
      const { rows } = await pool.query(
        `UPDATE students SET
           name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           profile_photo = COALESCE($3, profile_photo)
         WHERE id = $4
         RETURNING id, name, email, student_id, phone, profile_photo, role`,
        [name, phone, profilePhoto, id]
      );
      user = rows[0];
      if (user) user.studentId = user.student_id;
    }

    res.json({ message: "Profile updated", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update profile" });
  }
};

module.exports = { getProfile, updateProfile };