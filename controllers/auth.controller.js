const db = require("../data/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// SECURITY: Validate JWT_SECRET is configured properly on startup
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET is too weak (minimum 32 characters required)");
}

exports.login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  db.get(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ message: "Database error" });
      }

      if (!user) {
        // SECURITY: Generic error to prevent user enumeration
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "8h" }
      );

      // Return user without password
      const { password: _, ...userSafe } = user;
      res.json({ token, user: userSafe });
    }
  );
};