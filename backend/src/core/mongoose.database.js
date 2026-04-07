import mongoose from 'mongoose';
import { config } from "../config/config.js";
import { AppError } from "../errors/app.error.js";
import { system_logger } from "../utils/pino.logger.js";

/**
 * Mongoose database connection module that connects to MongoDB using the connection 
 * string from environment variables.
 */
const MONGO_URI = config.mongo_uri;


/**
 * Checks if the MONGO_URI environment variable is defined. 
 * If not, it logs an error and throws an AppError 
 * to prevent the application from starting without a valid database connection string.
 */
if(!MONGO_URI){
    system_logger.error('MONGO_URI is not defined in environment variables');
    throw new AppError('MONGO_URI is not defined in environment variables', 500)
}


/**
 * Asynchronous function to connect to MongoDB using Mongoose. 
 * It uses connection options to optimize performance and 
 * handles connection errors by logging them and throwing an AppError.
 */
const connectDB = async () => {
    try{

        const options = {
            maxPoolSize: 50,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        }
        await mongoose.connect(MONGO_URI, options);

        system_logger.info('MongoDB connected successfully');

    }catch(error){
        system_logger.error('Failed to connect to MongoDB', { error: error.message });
        throw new AppError('Failed to connect to MongoDB', 500, error);
    }
}

/**
 * Event listeners for Mongoose connection events.
 */
mongoose.connection.on('disconnected', () => {
    system_logger.warn('MongoDB connection lost');
})

mongoose.connection.on('error', (err) => {
    system_logger.error('MongoDB connection error', {error: err.message});
})


export { connectDB };
export default connectDB;