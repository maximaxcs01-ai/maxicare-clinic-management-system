const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const patientRoutes = require("./routes/patientRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const error = new Error("Origin not allowed by CORS");
      error.statusCode = 403;
      callback(error);
    },
  })
);
app.use(express.json());

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
