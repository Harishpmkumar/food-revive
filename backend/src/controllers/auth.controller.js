import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const register = async (req, res, next) => {
  try {
    let { name, email, password, role } = req.body ?? {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    name = name.trim();
    email = email.trim().toLowerCase();

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 and 80 characters",
      });
    }

    if (email.length > 254 || !validEmail.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 128 characters",
      });
    }

    // Public registration supports customers and vendors only.
    if (role !== undefined && !["customer", "vendor"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be customer or vendor",
      });
    }

    const selectedRole = role || "customer";
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: selectedRole,
      vendorStatus:
        selectedRole === "vendor" ? "pending" : "not_applicable",
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message:
        selectedRole === "vendor"
          ? "Vendor account created. Approval is required before publishing listings."
          : "Account registered successfully",
      data: {
        token,
        user: user.toSafeObject(),
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This account is disabled",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token: generateToken(user),
        user: user.toSafeObject(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Authenticated user retrieved successfully",
    data: {
      user: req.user.toSafeObject(),
    },
  });
};
