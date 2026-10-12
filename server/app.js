const path = require("node:path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
  quiet: true,
});

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const validateEnvironment = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const patientRoutes = require("./routes/patientRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  (req, res, next) => {
    const forwardedHost = req.get("x-forwarded-host");
    const forwardedProtocol = req.get("x-forwarded-proto");
    const requestHost = forwardedHost || req.get("host");
    const requestProtocol = forwardedProtocol || req.protocol;
    const requestOrigin = requestHost
      ? `${requestProtocol}://${requestHost}`
      : null;

    cors({
      origin(origin, callback) {
        if (
          !origin ||
          allowedOrigins.includes(origin) ||
          origin === requestOrigin
        ) {
          return callback(null, true);
        }

        const error = new Error("Origin not allowed by CORS");
        error.statusCode = 403;
        callback(error);
      },
    })(req, res, next);
  }
);
app.use(express.json());

app.use(async (req, res, next) => {
  try {
    validateEnvironment();
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

app.get("/", (req, res) => {
  res.json({ message: "Clinic Management System API is running" });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Clinic Management System API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
