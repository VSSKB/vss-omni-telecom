/**
 * Database helper utilities for VSS services
 * Provides connection pooling with retry logic and error handling
 */

const { Pool } = require('pg');

/**
 * Creates PostgreSQL pool with retry logic and proper error handling
 * @param {Object} config - Pool configuration
 * @param {string} serviceName - Name of the service (for logging)
 * @returns {Pool} - Configured PostgreSQL pool
 */
function createPoolWithRetry(config, serviceName = 'Service') {
    const poolConfig = {
        connectionString: config.connectionString,
        max: config.max || 20,
        idleTimeoutMillis: config.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: config.connectionTimeoutMillis || 5000,
        statement_timeout: config.statement_timeout || 30000,
        query_timeout: config.query_timeout || 30000
    };
    
    const pool = new Pool(poolConfig);
    
    // Handle pool errors
    pool.on('error', (err, client) => {
        console.error(`[${serviceName}] [DB] ❌ Unexpected database error:`, err.message);
        console.error(`[${serviceName}] [DB] Client info:`, client ? 'Active' : 'Idle');
    });
    
    pool.on('connect', (client) => {
        console.log(`[${serviceName}] [DB] ✅ New connection established`);
    });
    
    pool.on('acquire', (client) => {
        // Uncomment for debugging connection pool
        // console.log(`[${serviceName}] [DB] Client acquired from pool`);
    });
    
    pool.on('remove', (client) => {
        console.log(`[${serviceName}] [DB] Client removed from pool`);
    });
    
    return pool;
}

/**
 * Initialize database connection with retry logic
 * @param {Pool} pool - PostgreSQL pool
 * @param {string} serviceName - Name of the service (for logging)
 * @param {number} maxRetries - Maximum number of retry attempts (default: 5)
 * @param {number} retryDelay - Delay between retries in ms (default: 5000)
 * @returns {Promise<boolean>} - true if connected, throws error if failed
 */
async function initDatabaseWithRetry(pool, serviceName = 'Service', maxRetries = 5, retryDelay = 5000) {
    let retries = maxRetries;
    let lastError = null;
    
    console.log(`[${serviceName}] [DB] Connecting to PostgreSQL...`);
    
    while (retries > 0) {
        try {
            const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
            console.log(`[${serviceName}] [DB] ✅ Database connection successful`);
            console.log(`[${serviceName}] [DB] PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]}`);
            console.log(`[${serviceName}] [DB] Server time: ${result.rows[0].current_time}`);
            return true;
            
        } catch (error) {
            lastError = error;
            retries--;
            
            console.error(`[${serviceName}] [DB] ❌ Connection failed: ${error.message}`);
            console.error(`[${serviceName}] [DB] Retries left: ${retries}/${maxRetries}`);
            
            if (retries > 0) {
                console.log(`[${serviceName}] [DB] ⏳ Retrying in ${retryDelay/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }
    
    // All retries failed
    console.error(`[${serviceName}] [DB] ❌ Failed to connect to database after ${maxRetries} retries`);
    console.error(`[${serviceName}] [DB] Last error: ${lastError.message}`);
    throw new Error(`Database connection failed: ${lastError.message}`);
}

/**
 * Execute query with automatic retry on connection errors
 * @param {Pool} pool - PostgreSQL pool
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @param {Object} options - Options { retries, serviceName }
 * @returns {Promise<QueryResult>} - Query result
 */
async function queryWithRetry(pool, query, params = [], options = {}) {
    const { retries = 3, serviceName = 'Service' } = options;
    let lastError = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await pool.query(query, params);
        } catch (error) {
            lastError = error;
            
            // Retry only on connection errors
            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
                console.warn(`[${serviceName}] [DB] Query failed (attempt ${attempt}/${retries}):`, error.message);
                
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    continue;
                }
            }
            
            // For other errors or last retry, throw immediately
            throw error;
        }
    }
    
    throw lastError;
}

module.exports = {
    createPoolWithRetry,
    initDatabaseWithRetry,
    queryWithRetry
};

