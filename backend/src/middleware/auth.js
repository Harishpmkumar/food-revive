import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const authenticate = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    const token = authorization.slice(7);
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32 ||
        secret === "replace_with_a_long_random_secret") {
      throw new Error("JWT_SECRET is not configured securely");
    }

    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.sub);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is unavailable",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    next(error);
  }
};

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required",
    });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to access this resource",
    });
  }

  next();
};
