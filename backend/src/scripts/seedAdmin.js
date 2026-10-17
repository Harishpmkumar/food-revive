import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

const seedAdmin = async () => {
  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      "Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env before seeding."
    );
  }

  if (password.length < 12 || password.length > 128) {
    throw new Error("Admin password must be between 12 and 128 characters.");
  }

  await connectDB();

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    if (existingUser.role !== "admin") {
      throw new Error(
        "This email already belongs to a non-admin account. Use a different admin email."
      );
    }

    console.log("An admin account already exists for this email.");
    return;
  }

  await User.create({
    name,
    email,
    password,
    role: "admin",
    vendorStatus: "not_applicable",
  });

  console.log("Initial admin account created successfully.");
};

try {
  await seedAdmin();
} catch (error) {
  console.error("Admin seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
