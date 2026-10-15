const mongoose = require("mongoose");
const Consultation = require("../models/Consultation");

let connectionPromise;
let connectionLogged = false;
let consultationIndexMigration;

const migrateConsultationCancellationIndex = async () => {
  if (!consultationIndexMigration) {
    consultationIndexMigration = (async () => {
      const collection = Consultation.collection;
      let indexes;
      try {
        indexes = await collection.indexes();
      } catch (error) {
        if (error.code !== 26 && error.codeName !== "NamespaceNotFound") {
          throw error;
        }
        indexes = [];
      }
      const replacementExists = indexes.some(
        (index) => index.name === "consultation_active_appointment_unique"
      );
      if (!replacementExists) {
        await collection.createIndex(
          { appointmentId: 1 },
          {
            unique: true,
            partialFilterExpression: {
              status: { $in: ["in_progress", "completed"] },
            },
            name: "consultation_active_appointment_unique",
          }
        );
      }

      indexes = await collection.indexes();
      if (indexes.some((index) => index.name === "consultation_appointment_unique")) {
        try {
          await collection.dropIndex("consultation_appointment_unique");
        } catch (error) {
          if (error.code !== 27 && error.codeName !== "IndexNotFound") {
            throw error;
          }
        }
      }
    })().catch((error) => {
      consultationIndexMigration = undefined;
      throw error;
    });
  }
  return consultationIndexMigration;
};

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    await migrateConsultationCancellationIndex();
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGO_URI)
      .then((mongooseInstance) => {
        if (!connectionLogged) {
          console.log("MongoDB Atlas Connected");
          connectionLogged = true;
        }

        return migrateConsultationCancellationIndex().then(
          () => mongooseInstance.connection
        );
      })
      .catch((error) => {
        connectionPromise = undefined;
        throw error;
      });
  }

  return connectionPromise;
};

module.exports = connectDB;
