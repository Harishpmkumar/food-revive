import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true, limit: "20kb" }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Food Revive API",
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
