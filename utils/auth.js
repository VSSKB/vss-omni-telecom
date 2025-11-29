/**
 * JWT Authentication Utilities
 * Middleware для аутентификации через JWT токены
 */

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'vss_jwt_secret_change_me';

/**
 * Middleware для проверки JWT токена
 * Добавляет req.user с информацией о пользователе
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ 
            error: true, 
            code: 'AUTH_FAIL', 
            message: 'Token required' 
        });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                error: true, 
                code: 'AUTH_FAIL', 
                message: 'Invalid token' 
            });
        }
        req.user = user;
        next();
    });
}

/**
 * Опциональная аутентификация (не блокирует, если токена нет)
 * Полезно для публичных эндпоинтов, которые могут работать с токеном или без
 */
function optionalAuthenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        req.user = null;
        return next();
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            req.user = null;
        } else {
            req.user = user;
        }
        next();
    });
}

/**
 * Извлечение пользователя из JWT токена (без middleware)
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

/**
 * Создание JWT токена для пользователя
 */
function createToken(userData) {
    return jwt.sign(userData, JWT_SECRET, { expiresIn: '1h' });
}

module.exports = {
    authenticateToken,
    optionalAuthenticateToken,
    verifyToken,
    createToken,
    JWT_SECRET
};

