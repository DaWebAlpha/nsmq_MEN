import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Security & Utility Imports
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { xss } from 'express-xss-sanitizer';
import mongoSanitize from 'express-mongo-sanitize';

// Internal Imports
import { config } from './config/config.js';
import { access_logger } from './core/pino.logger.js';
import { notFound } from './middlewares/notFound.js';
import { handleError } from './middlewares/handleError.js';

const app = express();

/**
 * Path Configuration (ES Modules)
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * View Engine & Static Files
 */
app.set('view engine', 'ejs');
// Up two levels from backend/src to root, then into frontend
app.set('views', path.join(__dirname, '..', '..', 'frontend', 'views'));
app.use(express.static(path.join(__dirname, '..', '..', 'frontend', 'public')));

/**
 * Global Security & Request Logging
 */
app.set('trust proxy', 1);
app.use(helmet()); // Sets various HTTP headers for security

// Request Logging Middleware
app.use((req, res, next) => {
    access_logger.info({ method: req.method, url: req.url, ip: req.ip });
    next();
});

// CORS Configuration
app.use(cors({
    origin: [config.node_env === 'development' ? 'http://localhost:5173' : 'yourproductiondomain.com'],
    credentials: true,
}));

/**
 * Body Parsers & Sanitization
 */
app.use(cookieParser());
app.use(express.json({ limit: '10kb' })); // Limit body size for security
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/**
 * NoSQL Injection & XSS Protection
 * Manually sanitizes request properties to prevent read-only errors.
 */
app.use((req, _res, next) => {
    if (req.body) req.body = mongoSanitize.sanitize(req.body);
    if (req.query) {
        const cleanQuery = mongoSanitize.sanitize(req.query);
        Object.keys(req.query).forEach(key => delete req.query[key]);
        Object.assign(req.query, cleanQuery);
    }
    if (req.params) {
        const cleanParams = mongoSanitize.sanitize(req.params);
        Object.assign(req.params, cleanParams);
    }
    next();
});

// Sanitize user-supplied HTML/Scripts to prevent XSS
app.use(xss());

/**
 * Monitoring Routes
 */
app.get("/health", (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

/**
 * Error Handling (Must be defined last)
 */
app.use(notFound);
app.use(handleError);

export { app };
export default app;
