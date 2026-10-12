const mongoose = require("mongoose");

let connectionPromise;
let connectionLogged = false;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
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

        return mongooseInstance.connection;
      })
      .catch((error) => {
        connectionPromise = undefined;
        throw error;
      });
  }

  return connectionPromise;
};

module.exports = connectDB;
