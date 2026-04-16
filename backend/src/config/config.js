import dotenv from 'dotenv';
import { AppError } from "../errors/app.error.js";
dotenv.config();

/**
 * Configuration module that loads environment variables, validates their presence, 
 * and exports a configuration object for the application.
 */
const {
    PORT,
    MONGO_URI,
    NODE_ENV,
    LOG_LEVEL,
    REDIS_URI,
    MAX_FAILED_ATTEMPTS,
    LOCK_DURATION,
    JWT_ACCESS_SECRET,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL,
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    MAIL_HOST,
    MAIL_PORT,
    MAIL_SECURE,
    MAIL_USER,
    MAIL_PASS,
    MAIL_FROM,
} = process.env;


/**
 * Validates that all required environment variables are present and non-empty.
 */

const configEnvs = {
    MONGO_URI,
    REDIS_URI,
    JWT_ACCESS_SECRET,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL,
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    MAIL_HOST,
    MAIL_USER,
    MAIL_SECURE,
    MAIL_PASS,
    MAIL_FROM,
}


for (const [key, values] of Object.entries(configEnvs)){
    if(typeof values !== 'string' || values.trim() === ''){
        throw new AppError(`Environment variable ${key} is missing`, 500);
    }
}


/**
 * Helper function to convert environment variable values to numbers with a fallback option
*/
const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}


/**
 * Configuration object that holds all the necessary configuration values for the application.
 */
const config = {
    port: toNumber(PORT, 3200),
    mongo_uri: MONGO_URI,
    node_env: NODE_ENV || 'development',
    log_level: LOG_LEVEL || 'info',
    redis_uri: REDIS_URI,
    max_failed_attempts: toNumber(MAX_FAILED_ATTEMPTS, 5),
    lock_duration: toNumber(LOCK_DURATION, 900000),
    jwt_access_secret: JWT_ACCESS_SECRET,
    google_client_id: GOOGLE_CLIENT_ID,
    google_client_secret: GOOGLE_CLIENT_SECRET,
    google_callback_url: GOOGLE_CALLBACK_URL,
    cloudinary_cloud_name: CLOUDINARY_CLOUD_NAME,
    cloudinary_api_key: CLOUDINARY_API_KEY,
    cloudinary_api_secret: CLOUDINARY_API_SECRET,
    mail_host: MAIL_HOST,
    mail_port: toNumber(MAIL_PORT, 587),
    mail_secure: MAIL_SECURE,
    mail_user: MAIL_USER,
    mail_pass: MAIL_PASS,
    mail_from: MAIL_FROM
}

export { config };
export default config;