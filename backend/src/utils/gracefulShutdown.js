import mongoose from 'mongoose';
import { system_logger } from '../core/pino.logger.js';

/**
 * Gracefully shuts down the application.
 * Handles:
 * - HTTP server close
 * - MongoDB disconnect
 * - active socket cleanup
 * - process termination signals
 * - uncaught exceptions and unhandled promise rejections
 *
 * @param {import('http').Server} server - Node HTTP server instance
 */

const gracefulShutdown = function (server) {
    let isShuttingDown = false;
    const connections = new Set();

    /**
     * Track open socket connections so they can be destroyed if shutdown hangs.
     */
    if (server) {
        server.on('connection', (socket) => {
            connections.add(socket);

            socket.on('close', () => {
                connections.delete(socket);
            });
        });
    }

    /**
     * Main shutdown handler
     * @param {string} signal - Signal or reason that triggered shutdown
     */
    const shutdown = async (signal) => {
        if (isShuttingDown) {
            system_logger.warn('Shutdown already in progress. Ignoring additional signal.');
            return;
        }

        isShuttingDown = true;
        system_logger.warn({ signal }, 'Shutdown signal received. Starting graceful cleanup.');

        /**
         * Force exit if graceful shutdown takes too long.
         */
        const forceExit = setTimeout(() => {
            system_logger.error('Shutdown timed out after 30 seconds. Forcing immediate exit.');

            for (const socket of connections) {
                socket.destroy();
            }

            process.exit(1);
        }, 30000);

        try {
            /**
             * Give in-flight requests a short time to complete before closing the server.
             */
            system_logger.info('Draining connections for 5 seconds...');
            await new Promise((resolve) => setTimeout(resolve, 5000));

            /**
             * Close HTTP server so it stops accepting new connections.
             */
            if (server && server.listening) {
                await new Promise((resolve, reject) => {
                    server.close((err) => {
                        if (err) {
                            return reject(err);
                        }

                        system_logger.info('HTTP server closed.');
                        resolve();
                    });
                });
            }

            /**
             * Disconnect MongoDB if connected.
             * readyState:
             * 0 = disconnected
             * 1 = connected
             * 2 = connecting
             * 3 = disconnecting
             */
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
                system_logger.info('MongoDB connection closed.');
            }

            /**
             * Redis shutdown example if needed later.
             */
            /*
            if (redis?.status && ['ready', 'connecting'].includes(redis.status)) {
                await redis.quit();
                system_logger.info('Redis connection closed.');
            }
            */

            /**
             * Destroy any remaining open sockets.
             */
            for (const socket of connections) {
                socket.destroy();
            }

            clearTimeout(forceExit);
            system_logger.info('Graceful shutdown completed successfully. Process exiting.');
            process.exit(0);
        } catch (err) {
            clearTimeout(forceExit);

            system_logger.error(
                {
                    error: err.message,
                    stack: err.stack,
                },
                'Error occurred during graceful shutdown.'
            );

            process.exit(1);
        }
    };

    /**
     * Listen for termination signals
     */
    ['SIGINT', 'SIGTERM'].forEach((signal) => {
        process.on(signal, () => {
            shutdown(signal);
        });
    });

    /**
     * Handle uncaught exceptions
     */
    process.on('uncaughtException', (err) => {
        system_logger.fatal(
            {
                error: err.message,
                stack: err.stack,
            },
            'Uncaught Exception detected.'
        );

        shutdown('uncaughtException');
    });

    /**
     * Handle unhandled promise rejections
     */
    process.on('unhandledRejection', (reason) => {
        system_logger.fatal(
            {
                reason: reason instanceof Error ? reason.message : reason,
            },
            'Unhandled Promise Rejection detected.'
        );

        shutdown('unhandledRejection');
    });
};

export { gracefulShutdown };
export default gracefulShutdown;