const jwt  = require("jsonwebtoken");
const pool = require("../config/db");

const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return res.status(401).json({ error: "No token - please log in" });

  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch full user row so course_id / year_of_study are available for filtering
    const { rows } = await pool.query(
      `SELECT id, name, email, role, student_id,
              course_id, year_of_study, semester,
              department, profile_photo
       FROM users WHERE id = $1`,
      [decoded.id]
    );

    if (!rows.length)
      return res.status(401).json({ error: "User no longer exists" });

    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: "Token invalid or expired" });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role))
    return res.status(403).json({ error: `Access denied - ${roles.join(" or ")} only` });
  next();
};

module.exports = { protect, requireRole };