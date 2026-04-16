import mongoose from "mongoose";
import { config } from "../config/config.js";
import { AppError } from "../errors/app.error.js";
import { system_logger } from "../core/pino.logger.js";

const MONGO_URI = config.mongo_uri;

const connectDB = async () => {
  if (!MONGO_URI) {
    system_logger.error(
      "MONGO_URI is not defined in environment variables"
    );
    throw new AppError(
      "MONGO_URI is not defined in environment variables",
      500
    );
  }

  try {
    const options = {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(MONGO_URI, options); 

    system_logger.info("MongoDB connected successfully");
  } catch (error) {
    system_logger.error("Failed to connect to MongoDB", {
      error: error.message,
    });

    throw new AppError("Failed to connect to MongoDB", 500, error);
  }
};

// Event listeners (safe after mock)
mongoose.connection.on("disconnected", () => {
  system_logger.warn("MongoDB connection lost");
});

mongoose.connection.on("error", (err) => {
  system_logger.error("MongoDB connection error", {
    error: err.message,
  });
});

export { connectDB };
export default connectDB;