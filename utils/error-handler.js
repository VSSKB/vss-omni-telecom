/**
 * Error handling utilities for VSS services
 * Prevents leaking sensitive information in error messages
 */

/**
 * Sanitize error message - remove sensitive data
 * @param {Error|string} error - Error object or message
 * @returns {string} - Sanitized error message
 */
function sanitizeErrorMessage(error) {
    const message = typeof error === 'string' ? error : error.message || 'Unknown error';
    
    // Remove password patterns
    let sanitized = message.replace(/password[=:]?\s*['"]?[^'"&\s]+['"]?/gi, 'password=***');
    
    // Remove connection strings with credentials
    sanitized = sanitized.replace(/postgresql:\/\/([^:]+):([^@]+)@/gi, 'postgresql://$1:***@');
    sanitized = sanitized.replace(/amqp:\/\/([^:]+):([^@]+)@/gi, 'amqp://$1:***@');
    sanitized = sanitized.replace(/redis:\/\/:([^@]+)@/gi, 'redis://:***@');
    
    // Remove API keys and tokens
    sanitized = sanitized.replace(/api[_-]?key[=:]?\s*['"]?[a-zA-Z0-9]{20,}['"]?/gi, 'api_key=***');
    sanitized = sanitized.replace(/token[=:]?\s*['"]?[a-zA-Z0-9._-]{20,}['"]?/gi, 'token=***');
    
    // Remove JWT tokens
    sanitized = sanitized.replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, 'JWT_TOKEN_REDACTED');
    
    // Remove IP addresses in production (optional)
    if (process.env.NODE_ENV === 'production') {
        // Keep first two octets only
        sanitized = sanitized.replace(/\b(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}\b/g, '$1.$2.x.x');
    }
    
    return sanitized;
}

/**
 * Create safe error response for API
 * @param {Error} error - Original error
 * @param {string} code - Error code
 * @param {string} serviceName - Service name
 * @returns {Object} - Safe error response
 */
function createSafeErrorResponse(error, code = 'INTERNAL_ERROR', serviceName = 'Service') {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Log full error server-side
    console.error(`[${serviceName}] Error [${code}]:`, error);
    
    // Return sanitized error to client
    const response = {
        error: true,
        code: code,
        message: isDevelopment ? sanitizeErrorMessage(error) : 'Internal server error',
        timestamp: new Date().toISOString()
    };
    
    // Add stack trace only in development
    if (isDevelopment && error.stack) {
        response.stack = error.stack.split('\n').slice(0, 5); // First 5 lines only
    }
    
    return response;
}

/**
 * Express error handler middleware
 * Usage: app.use(errorHandlerMiddleware);
 */
function errorHandlerMiddleware(err, req, res, next) {
    const serviceName = process.env.SERVICE_NAME || 'Service';
    
    // Determine status code
    let statusCode = err.statusCode || err.status || 500;
    
    // Special handling for specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
    } else if (err.name === 'UnauthorizedError' || err.code === 'AUTH_FAIL') {
        statusCode = 401;
    } else if (err.code === 'PERMISSION_DENIED') {
        statusCode = 403;
    } else if (err.code === 'NOT_FOUND') {
        statusCode = 404;
    }
    
    const errorResponse = createSafeErrorResponse(
        err,
        err.code || 'INTERNAL_ERROR',
        serviceName
    );
    
    res.status(statusCode).json(errorResponse);
}

/**
 * Async handler wrapper - catches errors and passes to error middleware
 * @param {Function} fn - Async route handler
 * @returns {Function} - Wrapped handler
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    sanitizeErrorMessage,
    createSafeErrorResponse,
    errorHandlerMiddleware,
    asyncHandler
};

