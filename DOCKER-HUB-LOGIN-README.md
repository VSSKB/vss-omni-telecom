# Docker Hub Login - Интеграция

## Описание

Добавлена полная поддержка авторизации в Docker Hub для загрузки приватных образов и образов, требующих авторизации.

## Функционал

### 1. API Endpoints

#### POST `/api/docker-login`
Вход в Docker Hub
- **Параметры:**
  - `username` (обязательный) - имя пользователя Docker Hub
  - `password` (обязательный) - пароль или Access Token
  - `registry` (опциональный) - URL registry (по умолчанию: `https://index.docker.io/v1/`)

#### GET `/api/docker-login-status`
Проверка статуса авторизации
- **Ответ:**
  ```json
  {
    "loggedIn": true/false,
    "config": {
      "username": "username",
      "registry": "registry_url",
      "lastLogin": "2024-01-01T00:00:00.000Z"
    }
  }
  ```

#### POST `/api/docker-logout`
Выход из Docker Hub
- **Параметры:**
  - `registry` (опциональный) - URL registry для выхода

### 2. Улучшенный API для загрузки образов

#### POST `/api/pull-docker-image`
Загрузка Docker образа с автоматическим определением необходимости авторизации
- **Параметры:**
  - `imageName` (обязательный) - имя образа для загрузки
- **Ответ при ошибке авторизации:**
  ```json
  {
    "message": "Требуется авторизация в Docker Hub...",
    "requiresAuth": true,
    "details": "..."
  }
  ```

### 3. UI в Dashboard

В Dashboard добавлен раздел "Docker Hub настройки":
- Отображение текущего статуса авторизации
- Форма для входа в Docker Hub
- Кнопка выхода
- Автоматическое определение необходимости авторизации при загрузке образов

## Использование

### Через UI

1. Откройте Dashboard: `http://localhost:3000/dashboard.html`
2. Найдите раздел "Docker Hub настройки"
3. Введите ваши учетные данные Docker Hub
4. Нажмите "Войти в Docker Hub"
5. Теперь можно загружать приватные образы

### Через API

```javascript
// Вход
fetch('/api/docker-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        username: 'your-username',
        password: 'your-password-or-token'
    })
});

// Проверка статуса
fetch('/api/docker-login-status')
    .then(res => res.json())
    .then(data => console.log(data));

// Загрузка образа
fetch('/api/pull-docker-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        imageName: 'private-repo/image:tag'
    })
});
```

## Безопасность

- Пароли передаются через защищенное API
- Credentials сохраняются локально в `.docker-config.json` (только метаданные, не пароль)
- Пароль не сохраняется на диске
- Используется стандартный механизм Docker для хранения credentials

## Автоматическое определение необходимости авторизации

При запуске проектов система автоматически:
1. Пытается загрузить образы через `docker-compose pull`
2. Определяет ошибки авторизации в выводе
3. Предупреждает пользователя о необходимости входа
4. Продолжает работу, если образы могут быть собраны из Dockerfile

## Примечания

- Для приватных репозиториев Docker Hub требуется авторизация
- Можно использовать Access Token вместо пароля (рекомендуется)
- Credentials сохраняются в стандартном месте Docker (`~/.docker/config.json`)
- При выходе credentials удаляются из локального хранилища

