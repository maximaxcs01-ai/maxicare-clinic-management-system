const connectDB = require("./config/db");
const validateEnvironment = require("./config/env");
const Appointment = require("./models/Appointment");
const QueueEntry = require("./models/QueueEntry");
const Consultation = require("./models/Consultation");
const Prescription = require("./models/Prescription");
const app = require("./app");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    validateEnvironment();
    await connectDB();
    await Appointment.init();
    await QueueEntry.init();
    await Consultation.init();
    await Prescription.init();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  validateEnvironment,
};
