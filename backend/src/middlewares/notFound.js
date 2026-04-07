import { system_logger } from "../core/pino.logger.js";

/**
 * Middleware to handle requests for routes that do not exist.
 * It logs the missing resource details and renders a user-friendly 404 page.
 */
const notFound = (request, response, next) => {

    // Capture the time of the event and the specific error message
    const timestamp = new Date().toISOString();
    const message = `The requested url ${request.originalUrl} could not found`;

    // Log the event details including method and IP for security monitoring
    system_logger.error(
        {
            message,
            method: request.method,
            url: request.originalUrl, // Ensure case-sensitivity (originalUrl)
            ip: request.ip,
            timestamp,
        },
        "Route not found"
    );

    // Return a 404 status and render the custom EJS error template
    return response.status(404).render("404", {
        success: false,
        message,
        path: request.originalUrl,
        timestamp
    });
};

export { notFound };
export default notFound;
