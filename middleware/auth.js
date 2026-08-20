const jwt = require("jsonwebtoken");

// SECURITY: Fail fast if JWT_SECRET is not configured
if (!process.env.JWT_SECRET) {
  console.error("❌ FATAL: JWT_SECRET environment variable is not set");
  throw new Error("JWT_SECRET environment variable is required");
}

if (process.env.JWT_SECRET.length < 32) {
  console.error("❌ FATAL: JWT_SECRET must be at least 32 characters");
  throw new Error("JWT_SECRET is too weak (minimum 32 characters required)");
}

module.exports = function (req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = header.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Malformed authorization header" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};