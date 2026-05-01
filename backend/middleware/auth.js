const jwt = require("jsonwebtoken");

// Protect any authenticated route
const protect = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ error: "No token — please log in" });

  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch {
    return res.status(401).json({ error: "Token invalid or expired" });
  }
};

// Only allow lecturers
const lecturerOnly = (req, res, next) => {
  if (req.user?.role !== "lecturer")
    return res.status(403).json({ error: "Access denied — lecturers only" });
  next();
};

// Only allow students
const studentOnly = (req, res, next) => {
  if (req.user?.role !== "student")
    return res.status(403).json({ error: "Access denied — students only" });
  next();
};

module.exports = { protect, lecturerOnly, studentOnly };