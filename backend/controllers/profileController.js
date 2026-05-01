const pool = require("../config/db");

// GET /api/profile
const getProfile = async (req, res) => {
  const { id } = req.user;
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, student_id, phone, department,
              profile_photo, role, created_at
       FROM users WHERE id = $1`,
      [id]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    // Rename student_id to studentId for mobile consistency
    if (user.student_id) user.studentId = user.student_id;
    delete user.student_id;

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
    const { rows } = await pool.query(
      `UPDATE users SET
         name          = COALESCE($1, name),
         phone         = COALESCE($2, phone),
         department    = COALESCE($3, department),
         profile_photo = COALESCE($4, profile_photo)
       WHERE id = $5
       RETURNING id, name, email, student_id, phone, department, profile_photo, role`,
      [name, phone, department, profilePhoto, id]
    );
    const user = rows[0];

    if (user?.student_id) user.studentId = user.student_id;
    delete user?.student_id;

    res.json({ message: "Profile updated", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update profile" });
  }
};

module.exports = { getProfile, updateProfile };