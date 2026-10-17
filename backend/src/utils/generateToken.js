import jwt from "jsonwebtoken";

const generateToken = (user) => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32 ||
      secret === "replace_with_a_long_random_secret") {
    throw new Error("Configure a strong JWT_SECRET in backend/.env");
  }

  return jwt.sign(
    { sub: user._id.toString() },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
};

export default generateToken;
