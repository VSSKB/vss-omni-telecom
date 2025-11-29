# Резюме реализации RBAC системы для VSS

## Выполненные изменения

### 1. ✅ Создана утилита для проверки прав доступа (`utils/rbac.js`)

**Функционал:**
- `checkPermission(permissions, action)` - проверка прав на действие
- `extractPermissions(permissions)` - извлечение списка всех разрешенных действий
- `checkResourcePermission(permissions, resourceType, operation)` - проверка прав на ресурс
- `requirePermission(requiredPermission)` - Express middleware для проверки прав
- `requireRole(allowedRoles)` - Express middleware для проверки роли
- `loadUserPermissions(pool, userId)` - загрузка прав из БД
- `loadPermissions(pool)` - middleware для автоматической загрузки прав

### 2. ✅ Создана утилита для JWT аутентификации (`utils/auth.js`)

**Функционал:**
- `authenticateToken` - обязательная JWT аутентификация
- `optionalAuthenticateToken` - опциональная JWT аутентификация
- `verifyToken(token)` - проверка токена без middleware
- `createToken(userData)` - создание JWT токена

### 3. ✅ Обновлена схема БД с правильными правами ролей

**Роли и их права:**

#### Администратор (admin)
```json
{
  "all": true,
  "users": ["create", "read", "update", "delete"],
  "roles": ["create", "read", "update", "delete"],
  "slots": ["create", "read", "update", "delete", "admin"],
  "trunks": ["create", "read", "update", "delete"],
  "calls": ["read", "monitor", "record"],
  "archonts": ["create", "read", "update", "delete"],
  "system": ["configure", "monitor", "restart"],
  "crm": ["read", "write", "admin"],
  "reports": ["read", "generate"],
  "pipelines": ["run", "stop", "create"]
}
```

#### Оператор (operator)
```json
{
  "calls": true,
  "slots": true,
  "crm": ["read", "write"],
  "notes": ["create", "read"],
  "guacamole": ["connect"]
}
```

#### Супервизор (supervisor)
```json
{
  "read": true,
  "report": true,
  "monitor": true,
  "calls": ["read", "monitor"],
  "users": ["read"],
  "slots": ["read", "monitor"],
  "crm": ["read"],
  "reports": ["read", "generate"],
  "dashboard": true,
  "logs": ["read"]
}
```

#### Продавец (seller)
```json
{
  "crm": true,
  "leads": true,
  "calls": ["read"],
  "notes": ["create", "read", "update"],
  "dashboard": ["read"]
}
```

### 4. ✅ Добавлена проверка прав в WORKSPACE сервис

**Обновленные эндпоинты:**

#### CRM API
- ✅ `GET /api/crm/leads` - с фильтрацией по роли:
  - Продавцы видят только свои лиды (`assigned_seller = user.id`)
  - Администраторы видят все лиды
  - Супервизоры могут фильтровать по продавцу
  
- ✅ `POST /api/crm/leads` - создание лида:
  - Для продавцов автоматически назначается `assigned_seller`
  - Проверка прав `crm.write`
  
- ✅ `POST /api/crm/note` - добавление заметки:
  - Проверка прав `notes.create`
  - Для продавцов проверка, что звонок связан с их лидом

#### Dashboard API
- ✅ `GET /api/dashboard` - с фильтрацией по ролям:
  - Продавцы видят статистику только по своим лидам
  - Супервизоры и администраторы видят полную статистику
  - Только админы и супервизоры видят информацию о транках и Guacamole сессиях

**Добавленный middleware:**
- Автоматическая загрузка прав для всех аутентифицированных пользователей
- Опциональная аутентификация для публичных эндпоинтов

## Оставшиеся задачи

### ⏳ 3. Добавить проверку прав в OTTB сервис

**Необходимо добавить:**
- Проверка прав для эндпоинтов управления слотами
- Проверка прав для инициации звонков
- Проверка прав для автодозвона
- Проверка прав для GACS скриптов

### ⏳ 6. Добавить middleware для передачи JWT токена между сервисами

**Необходимо реализовать:**
- Функция для создания HTTP запросов с JWT токеном
- Автоматическая передача токена при межсервисных вызовах
- Валидация токена на стороне принимающего сервиса

## Примеры использования

### Проверка прав в эндпоинте

```javascript
const { authenticateToken } = require('../../utils/auth');
const { loadPermissions, checkPermission } = require('../../utils/rbac');

app.get('/api/resource', authenticateToken, async (req, res) => {
    // Загрузка прав если еще не загружены
    if (!req.user.permissions) {
        const { loadUserPermissions } = require('../../utils/rbac');
        req.user.permissions = await loadUserPermissions(pool, req.user.id) || {};
    }
    
    // Проверка прав
    const hasAccess = checkPermission(req.user.permissions, 'resource.read');
    if (!hasAccess) {
        return res.status(403).json({
            error: true,
            code: 'PERMISSION_DENIED',
            message: 'Access denied'
        });
    }
    
    // Код обработки запроса...
});
```

### Использование middleware для проверки прав

```javascript
const { requirePermission } = require('../../utils/rbac');

app.post('/api/resource', 
    authenticateToken, 
    requirePermission('resource.create'),
    async (req, res) => {
        // Код обработки запроса...
    }
);
```

### Фильтрация данных по роли

```javascript
// Для продавцов фильтруем данные
if (req.user.role === 'seller') {
    query += ` AND assigned_seller = $${paramIndex++}`;
    params.push(req.user.id);
}
```

## Тестирование

Для тестирования системы прав доступа:

1. **Создать тестовых пользователей с разными ролями:**
```sql
-- Оператор
INSERT INTO users (username, email, password_hash, role_id)
VALUES ('operator1', 'op1@test.com', crypt('pass123', gen_salt('bf')), 
    (SELECT id FROM roles WHERE name = 'operator'));

-- Продавец
INSERT INTO users (username, email, password_hash, role_id)
VALUES ('seller1', 'seller1@test.com', crypt('pass123', gen_salt('bf')), 
    (SELECT id FROM roles WHERE name = 'seller'));

-- Супервизор
INSERT INTO users (username, email, password_hash, role_id)
VALUES ('supervisor1', 'super1@test.com', crypt('pass123', gen_salt('bf')), 
    (SELECT id FROM roles WHERE name = 'supervisor'));
```

2. **Проверить доступ к эндпоинтам:**
   - Войти как продавец и проверить, что видит только свои лиды
   - Войти как оператор и проверить доступ к звонкам
   - Войти как супервизор и проверить доступ к dashboard

## Заключение

Система RBAC успешно интегрирована в WORKSPACE сервис с поддержкой:
- ✅ Аутентификации через JWT
- ✅ Загрузки прав из БД
- ✅ Проверки прав на каждом эндпоинте
- ✅ Фильтрации данных по ролям
- ✅ Правильных прав для всех ролей

Следующие шаги:
- Добавить проверку прав в OTTB сервис
- Реализовать передачу JWT между сервисами
- Добавить аудит всех действий с правами доступа

