/**
 * Graceful shutdown utility for VSS services
 * Handles SIGTERM/SIGINT signals and cleanly closes all connections
 */

/**
 * Setup graceful shutdown handlers
 * @param {Object} resources - Resources to close on shutdown
 * @param {http.Server} resources.server - HTTP server
 * @param {Pool} resources.pool - PostgreSQL pool
 * @param {Connection} resources.rabbitmqConnection - RabbitMQ connection
 * @param {string} serviceName - Name of the service (for logging)
 */
function setupGracefulShutdown(resources, serviceName = 'Service') {
    const { server, pool, rabbitmqConnection } = resources;
    
    let isShuttingDown = false;
    
    const shutdown = async (signal) => {
        if (isShuttingDown) {
            console.log(`[${serviceName}] Shutdown already in progress...`);
            return;
        }
        
        isShuttingDown = true;
        console.log(`\n[${serviceName}] ⚠️  Received ${signal}, starting graceful shutdown...`);
        
        // Force exit after 15 seconds if graceful shutdown takes too long
        const forceExitTimer = setTimeout(() => {
            console.error(`[${serviceName}] ❌ Graceful shutdown timeout! Forcing exit...`);
            process.exit(1);
        }, 15000);
        
        try {
            // Step 1: Stop accepting new connections
            if (server && server.listening) {
                console.log(`[${serviceName}] [1/4] Closing HTTP server...`);
                await new Promise((resolve) => {
                    server.close(() => {
                        console.log(`[${serviceName}] ✅ HTTP server closed`);
                        resolve();
                    });
                });
            }
            
            // Step 2: Close RabbitMQ connection
            if (rabbitmqConnection) {
                console.log(`[${serviceName}] [2/4] Closing RabbitMQ connection...`);
                try {
                    await rabbitmqConnection.close();
                    console.log(`[${serviceName}] ✅ RabbitMQ connection closed`);
                } catch (error) {
                    console.error(`[${serviceName}] ⚠️  Error closing RabbitMQ:`, error.message);
                }
            }
            
            // Step 3: Close PostgreSQL pool
            if (pool) {
                console.log(`[${serviceName}] [3/4] Closing PostgreSQL pool...`);
                try {
                    await pool.end();
                    console.log(`[${serviceName}] ✅ PostgreSQL pool closed`);
                } catch (error) {
                    console.error(`[${serviceName}] ⚠️  Error closing PostgreSQL:`, error.message);
                }
            }
            
            // Step 4: Clear timers and cleanup
            console.log(`[${serviceName}] [4/4] Final cleanup...`);
            clearTimeout(forceExitTimer);
            
            console.log(`[${serviceName}] ✅ Graceful shutdown complete`);
            process.exit(0);
            
        } catch (error) {
            console.error(`[${serviceName}] ❌ Error during shutdown:`, error);
            clearTimeout(forceExitTimer);
            process.exit(1);
        }
    };
    
    // Register signal handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error(`[${serviceName}] ❌ Uncaught exception:`, error);
        shutdown('EXCEPTION');
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        console.error(`[${serviceName}] ❌ Unhandled rejection at:`, promise, 'reason:', reason);
        shutdown('REJECTION');
    });
    
    console.log(`[${serviceName}] ✅ Graceful shutdown handlers registered`);
}

module.exports = { setupGracefulShutdown };

