import { app } from "./app.js";
import { config } from "./config/config.js";
import { connectDB } from "./core/mongoose.database.js";
import { gracefulShutdown } from "./utils/gracefulShutdown.js";
import { system_logger } from "./core/pino.logger.js";

/**
 * Port configuration retrieved from environment variables with a fallback
 */
const PORT = config.port || 3200;

/**
 * Main application bootstrap function
 * Handles the sequential startup of the database and the HTTP server
 */
const startServer = async () => {
    try {
        // Initialize the connection to MongoDB before starting the server
        await connectDB();

        // Start the Express application to listen for incoming requests
        const server = app.listen(PORT, () => {
            system_logger.info(`Server is running on port ${PORT}`);
        });

        // Initialize the utility to handle clean process termination
        gracefulShutdown(server);

    } catch (error) {
        // Log startup failures and terminate the process with an error code
        system_logger.error('Failed to start server', { error: error.message });
        process.exit(1);
    }
}

// Execute the startup sequence
startServer();
