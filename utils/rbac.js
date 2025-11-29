/**
 * RBAC (Role-Based Access Control) Utilities
 * Проверка прав доступа для различных ролей в VSS системе
 */

/**
 * Проверка прав доступа пользователя
 * @param {Object} permissions - Объект прав из БД (JSONB)
 * @param {String} action - Действие для проверки (например, "calls.start", "users.create")
 * @returns {Boolean} - Разрешено ли действие
 */
function checkPermission(permissions, action) {
    if (!permissions || typeof permissions !== 'object') {
        return false;
    }
    
    // Администратор имеет полный доступ
    if (permissions.all === true) {
        return true;
    }
    
    // Парсинг действия: "module.operation" или просто "module"
    const parts = action.split('.');
    const module = parts[0];
    const operation = parts.length > 1 ? parts[1] : null;
    
    // Проверка на уровне модуля
    if (permissions[module] === true) {
        return true;
    }
    
    // Проверка на уровне операции в массиве
    if (Array.isArray(permissions[module])) {
        if (operation) {
            return permissions[module].includes(operation);
        }
        return true; // Если модуль существует в массиве разрешенных модулей
    }
    
    // Проверка конкретной операции
    if (operation && permissions[module] && typeof permissions[module] === 'object') {
        return permissions[module][operation] === true || permissions[module][operation] === 'true';
    }
    
    return false;
}

/**
 * Извлечение списка всех разрешенных действий
 * @param {Object} permissions - Объект прав из БД
 * @returns {Array} - Массив разрешенных действий
 */
function extractPermissions(permissions) {
    const list = [];
    
    if (!permissions || typeof permissions !== 'object') {
        return list;
    }
    
    if (permissions.all === true) {
        list.push('all');
        return list;
    }
    
    for (const [module, perms] of Object.entries(permissions)) {
        if (perms === true) {
            list.push(module);
        } else if (Array.isArray(perms)) {
            perms.forEach(p => {
                if (typeof p === 'string') {
                    list.push(`${module}.${p}`);
                }
            });
        } else if (typeof perms === 'object' && perms !== null) {
            for (const [op, allowed] of Object.entries(perms)) {
                if (allowed === true || allowed === 'true') {
                    list.push(`${module}.${op}`);
                }
            }
        }
    }
    
    return list;
}

/**
 * Проверка прав для роли на конкретный ресурс
 * @param {Object} permissions - Права пользователя
 * @param {String} resourceType - Тип ресурса (users, slots, calls, etc.)
 * @param {String} operation - Операция (create, read, update, delete)
 * @returns {Boolean}
 */
function checkResourcePermission(permissions, resourceType, operation) {
    const action = `${resourceType}.${operation}`;
    return checkPermission(permissions, action);
}

/**
 * Middleware для проверки прав доступа
 * @param {String|Array} requiredPermission - Требуемое право или массив прав (любое из)
 * @returns {Function} Express middleware
 */
function requirePermission(requiredPermission) {
    return async (req, res, next) => {
        try {
            // Получаем пользователя из JWT (должен быть установлен authenticateToken middleware)
            if (!req.user || !req.user.id) {
                return res.status(401).json({ 
                    error: true, 
                    code: 'AUTH_REQUIRED', 
                    message: 'Authentication required' 
                });
            }
            
            // Если есть доступ к permissions через req, используем его
            let permissions = req.user.permissions;
            
            // Если permissions нет, нужно загрузить из БД
            // Это делается через дополнительный middleware или в каждом сервисе
            if (!permissions) {
                // В этом случае нужно загрузить из БД
                // Это будет сделано в каждом сервисе отдельно
                return res.status(500).json({
                    error: true,
                    code: 'PERMISSIONS_NOT_LOADED',
                    message: 'User permissions not loaded. Please load permissions first.'
                });
            }
            
            // Проверка прав
            const permissionsToCheck = Array.isArray(requiredPermission) 
                ? requiredPermission 
                : [requiredPermission];
            
            const hasPermission = permissionsToCheck.some(perm => 
                checkPermission(permissions, perm)
            );
            
            if (!hasPermission) {
                return res.status(403).json({
                    error: true,
                    code: 'PERMISSION_DENIED',
                    message: `Permission denied. Required: ${requiredPermission}`,
                    required: requiredPermission,
                    user_permissions: extractPermissions(permissions)
                });
            }
            
            next();
        } catch (error) {
            console.error('[RBAC] Permission check error:', error);
            res.status(500).json({
                error: true,
                code: 'RBAC_ERROR',
                message: error.message
            });
        }
    };
}

/**
 * Проверка роли пользователя
 * @param {String|Array} allowedRoles - Разрешенные роли
 * @returns {Function} Express middleware
 */
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({
                error: true,
                code: 'AUTH_REQUIRED',
                message: 'Authentication required'
            });
        }
        
        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: true,
                code: 'ROLE_DENIED',
                message: `Access denied. Required role: ${allowedRoles}`,
                user_role: req.user.role
            });
        }
        
        next();
    };
}

/**
 * Загрузка прав пользователя из БД
 * @param {Pool} pool - PostgreSQL connection pool
 * @param {String} userId - UUID пользователя
 * @returns {Promise<Object>} - Объект прав
 */
async function loadUserPermissions(pool, userId) {
    try {
        const result = await pool.query(`
            SELECT r.permissions
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = $1 AND u.status = 'active'
        `, [userId]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        return result.rows[0].permissions || {};
    } catch (error) {
        console.error('[RBAC] Error loading user permissions:', error);
        return null;
    }
}

/**
 * Middleware для загрузки прав пользователя из БД
 * @param {Pool} pool - PostgreSQL connection pool
 * @returns {Function} Express middleware
 */
function loadPermissions(pool) {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.id) {
                return next();
            }
            
            const permissions = await loadUserPermissions(pool, req.user.id);
            if (permissions) {
                req.user.permissions = permissions;
            }
            
            next();
        } catch (error) {
            console.error('[RBAC] Error loading permissions:', error);
            next();
        }
    };
}

module.exports = {
    checkPermission,
    extractPermissions,
    checkResourcePermission,
    requirePermission,
    requireRole,
    loadUserPermissions,
    loadPermissions
};

