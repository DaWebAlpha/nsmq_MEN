import { config } from "../config/config.js";
import { system_logger } from "../core/pino.logger.js";

const NODE_ENV = config.node_env || 'development';

/**
 * Global Error Handling Middleware
 * Catches all errors passed to next() and renders a user-friendly error page.
 */
const handleError = (err, request, response, next) => {
    // 1. If headers have already been sent, delegate to the default Express error handler
    if (response.headersSent) {
        return next(err);
    }

    // 2. Validate and determine the status code (default to 500)
    const statusCode = 
        Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 600
            ? err.statusCode
            : 500;

    // 3. Identify if the error is an expected "AppError" (Operational)
    const isOperational = Boolean(err?.isOperational);

    // 4. Log detailed error information for the development team
    system_logger.error(
        {
            errName: err?.name || "Error",
            message: err?.message || "An unexpected error occurred",
            statusCode,
            isOperational,
            method: request.method,
            url: request.originalUrl,
            ip: request.ip,
            stack: err?.stack,
        },
        "An error occurred during request processing"
    );

    // 5. Construct the response object for the EJS view
    const errorResponse = {
        success: false,
        message: (NODE_ENV === 'development' || isOperational) 
            ? err.message 
            : "An unexpected error occurred. Please try again later.",
    };

    // 6. Include specific details if they exist (e.g., validation errors)
    if (isOperational && err?.details) {
        errorResponse.details = err.details;
    }

    // 7. Add technical debug info only when in development mode
    if (NODE_ENV === 'development') {
        errorResponse.stack = err?.stack;
        errorResponse.isOperational = isOperational;
    }
    
    // 8. Render the error.ejs template located in frontend/views
    return response.status(statusCode).render("error", {
        errorResponse,
    });
};

export { handleError };
export default handleError;
