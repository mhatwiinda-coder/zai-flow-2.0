module.exports = (allowedRoles) => {
  return (req, res, next) => {

    const user = req.user; // comes from auth middleware

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
};