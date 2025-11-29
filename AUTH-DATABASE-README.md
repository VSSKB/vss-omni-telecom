# База данных авторизации и аутентификации

## Описание

Локальная SQLite база данных для управления пользователями, сессиями и авторизацией при доступе к админке проектов VSS.

## Файлы

- `database/auth-db.js` - Модуль работы с базой данных
- `db_data/auth.db` - SQLite база данных (создается автоматически)

## Структура базы данных

### Таблица `users`
Хранит информацию о пользователях:
- `id` - Уникальный идентификатор
- `username` - Имя пользователя (уникальное)
- `password_hash` - Хеш пароля (bcrypt)
- `email` - Email пользователя
- `role` - Роль (admin, supervisor, operator, seller)
- `full_name` - Полное имя
- `created_at` - Дата создания
- `updated_at` - Дата обновления
- `last_login` - Последний вход
- `is_active` - Активен ли пользователь
- `failed_login_attempts` - Количество неудачных попыток входа
- `locked_until` - Заблокирован до (дата)

### Таблица `sessions`
Хранит активные сессии:
- `id` - ID сессии (токен)
- `user_id` - ID пользователя
- `project_id` - ID проекта (опционально)
- `created_at` - Дата создания
- `expires_at` - Дата истечения
- `ip_address` - IP адрес
- `user_agent` - User-Agent браузера

### Таблица `login_attempts`
Логирует все попытки входа:
- `id` - Уникальный идентификатор
- `username` - Имя пользователя
- `ip_address` - IP адрес
- `success` - Успешна ли попытка
- `attempted_at` - Время попытки
- `failure_reason` - Причина неудачи

## API Endpoints

### POST `/api/admin-login`
Аутентификация пользователя

**Параметры:**
```json
{
  "username": "string",
  "password": "string",
  "role": "operator|supervisor|admin|seller",
  "projectId": "string",
  "adminUrl": "string"
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Успешный вход",
  "redirectUrl": "http://localhost:80",
  "sessionId": "session_token",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "fullName": "System Administrator"
  }
}
```

### POST `/api/admin-register`
Регистрация нового пользователя

**Параметры:**
```json
{
  "username": "string",
  "password": "string",
  "role": "operator|supervisor|admin|seller",
  "email": "string",
  "fullName": "string"
}
```

### GET `/api/admin-session/:sessionId`
Проверка валидности сессии

### POST `/api/admin-logout`
Выход из системы

**Параметры:**
```json
{
  "sessionId": "string"
}
```

### GET `/api/admin-users`
Получение списка всех пользователей

## Безопасность

### Хеширование паролей
- Используется bcrypt с 10 раундами
- Пароли никогда не хранятся в открытом виде

### Защита от брутфорса
- После 5 неудачных попыток входа аккаунт блокируется на 30 минут
- Все попытки входа логируются

### Сессии
- Сессии имеют срок действия (по умолчанию 24 часа)
- Истекшие сессии автоматически удаляются
- Каждая сессия привязана к IP адресу и User-Agent

### Роли и права доступа
Иерархия ролей:
- **admin** - Полный доступ (может использовать все роли)
- **supervisor** - Доступ к supervisor, operator, seller
- **operator** - Доступ к operator, seller
- **seller** - Только seller

## Пользователь по умолчанию

При первом запуске создается администратор:
- **Username:** `admin`
- **Password:** `admin123`
- **Role:** `admin`

⚠️ **ВАЖНО:** Измените пароль после первого входа!

## Использование

### Инициализация
База данных инициализируется автоматически при запуске сервера:
```javascript
const authDB = require('./database/auth-db');
// База данных автоматически создается и инициализируется
```

### Регистрация пользователя
```javascript
const user = await authDB.registerUser('username', 'password', 'operator', 'email@example.com', 'Full Name');
```

### Аутентификация
```javascript
const user = await authDB.authenticateUser('username', 'password', '192.168.1.1', 'Mozilla/5.0...');
```

### Создание сессии
```javascript
const session = await authDB.createSession(userId, projectId, ipAddress, userAgent, 24);
```

### Проверка сессии
```javascript
const session = await authDB.validateSession(sessionId);
```

## Очистка

Истекшие сессии автоматически удаляются каждые 30 минут.

Для ручной очистки:
```javascript
await authDB.cleanupExpiredSessions();
```

## Миграции

База данных создается автоматически при первом запуске. Все таблицы и индексы создаются автоматически.

## Резервное копирование

База данных находится в `db_data/auth.db`. Для резервного копирования просто скопируйте этот файл.

## Восстановление

Для восстановления из резервной копии:
1. Остановите сервер
2. Замените `db_data/auth.db` на резервную копию
3. Запустите сервер

