const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
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

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role))
    return res.status(403).json({ error: `Access denied — ${roles.join(" or ")} only` });
  next();
};

module.exports = { protect, requireRole }; // lecturerOnly/studentOnly removed