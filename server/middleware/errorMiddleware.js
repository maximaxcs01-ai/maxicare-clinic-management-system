const notFound = (req, res) => {
  res.status(404).json({ message: "Route not found" });
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  console.error(
    process.env.NODE_ENV === "production" ? error.message : error.stack
  );

  let statusCode = error.statusCode || 500;
  let message = error.message || "Server error";

  if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Invalid request data";
  }

  if (error.code === 11000) {
    statusCode = 409;
    message = "A record with that value already exists";
  }

  if (statusCode >= 500) message = "Server error";

  res.status(statusCode).json({ message });
};

module.exports = { notFound, errorHandler };
