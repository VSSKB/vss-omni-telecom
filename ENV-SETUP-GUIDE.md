# 🔐 Environment Setup Guide - VSS OMNI TELECOM

## КРИТИЧЕСКИ ВАЖНО!

После исправления критических проблем, VSS теперь **ТРЕБУЕТ** правильной настройки переменных окружения.

---

## 📋 Обязательные переменные

### 1. JWT_SECRET (КРИТИЧНО!)

**Что это:** Секретный ключ для подписи JWT токенов  
**Требования:** Минимум 32 символа, сложная случайная строка  
**Генерация:**

```bash
# Вариант 1 (Node.js)
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Вариант 2 (OpenSSL)  
openssl rand -base64 64

# Вариант 3 (PowerShell)
-join ((48..57 + 65..90 + 97..122) * 64 | Get-Random -Count 64 | % {[char]$_})
```

**Пример:**
```
JWT_SECRET=8vF3kL9mN2pQ5sT7wY0zA4bC6dE1fG8hJ3kM5nP7qR9tU2vW4xY6zA9bC1dE3fG5
```

---

### 2. Database Passwords

**Требования:** Минимум 16 символов

```bash
DB_PASSWORD=YourSecurePassword123!
RABBITMQ_PASSWORD=AnotherSecurePass456!
REDIS_PASSWORD=RedisSecurePass789!
```

---

### 3. AMI Configuration (для Asterisk)

```bash
AMI_HOST=172.30.206.128     # IP вашего Asterisk сервера
AMI_PORT=5038                # Стандартный AMI порт
AMI_USERNAME=vss             # AMI username
AMI_PASSWORD=YourAMIPass     # AMI password
```

**⚠️  Без этих переменных Admin Backend не запустится!**

---

### 4. CORS Settings

```bash
ALLOWED_ORIGINS=http://79.137.207.215,http://localhost
```

---

## 🚀 Быстрая настройка

### Шаг 1: Создайте .env файл

```powershell
# Windows PowerShell
New-Item -Path ".env" -ItemType File

# Или скопируйте шаблон
# copy .env.required .env  (если бы файл не был заблокирован)
```

### Шаг 2: Заполните .env

```env
# .env file content
JWT_SECRET=<СГЕНЕРИРОВАННЫЙ_КЛЮЧ_64_СИМВОЛА>
DB_PASSWORD=<ВАШИ_ПАРОЛЬ_16+_СИМВОЛОВ>
RABBITMQ_PASSWORD=<ВАШ_ПАРОЛЬ_16+>
REDIS_PASSWORD=<ВАШ_ПАРОЛЬ_16+>

AMI_HOST=<IP_ASTERISK>
AMI_USERNAME=<AMI_USER>
AMI_PASSWORD=<AMI_PASS>

ALLOWED_ORIGINS=http://79.137.207.215

NODE_ENV=production
```

### Шаг 3: Проверьте конфигурацию

```powershell
# Проверьте что файл создан
Test-Path .env

# Проверьте содержимое (ОСТОРОЖНО - содержит пароли!)
# Get-Content .env
```

### Шаг 4: Запустите VSS

```powershell
# Остановите текущие процессы
taskkill /F /IM node.exe

# Запустите с новыми переменными
npm run start:all
```

---

## ✅ Проверка после запуска

Вы должны увидеть:

```
[AUTH] ✅ JWT_SECRET установлен корректно
[WORKSPACE] [DB] ✅ Database connection successful
[WORKSPACE] ✅ Graceful shutdown handlers registered
[OTTB] [DB] ✅ Database connection successful
...
```

**Если видите ошибки:**

```
❌ КРИТИЧЕСКАЯ ОШИБКА: JWT_SECRET не установлен!
```
→ Проверьте что .env файл существует и содержит JWT_SECRET

```
[AMI] ⚠️  AMI credentials not configured
```
→ Установите AMI_HOST, AMI_USERNAME, AMI_PASSWORD

---

## 🔒 Безопасность

### Обязательно:

1. ✅ Используйте **сильные пароли** (минимум 16 символов, буквы+цифры+символы)
2. ✅ **НЕ коммитьте** .env в Git (.gitignore уже содержит .env)
3. ✅ **Разные пароли** для dev/staging/production
4. ✅ **Регулярно меняйте** пароли (раз в квартал)
5. ✅ **Делайте backup** .env в безопасное место

### Рекомендуется:

- Используйте password manager для генерации/хранения
- Шифруйте backup .env файлов
- Используйте secrets management (Hashicorp Vault, AWS Secrets Manager) в production

---

## 📝 Пример полного .env файла

```env
# VSS OMNI TELECOM Production Configuration

# CRITICAL
JWT_SECRET=mK9pL3nQ8sR2tU7vW0xY4zA6bC1dE5fG8hJ2kM4nP9qR3sT6uW1xY5zA7bC0dE2fG4
DB_PASSWORD=SecureDBPass2024!@#
RABBITMQ_PASSWORD=RabbitSecure2024!@#
REDIS_PASSWORD=RedisSecure2024!@#

# AMI Configuration
AMI_HOST=172.30.206.128
AMI_PORT=5038
AMI_USERNAME=vss_admin
AMI_PASSWORD=AmiSecure2024!@#

# CORS
ALLOWED_ORIGINS=http://79.137.207.215,https://vss.yourdomain.com

# Environment
NODE_ENV=production

# RabbitMQ
RABBITMQ_ENABLED=true
RABBITMQ_AUTO_RECONNECT=true
RABBITMQ_MAX_RECONNECT_ATTEMPTS=5

# Optional
GRAFANA_PASSWORD=GrafanaSecure2024!@#
```

---

**Версия:** 1.0  
**Дата:** 2025-12-04  
**Важность:** КРИТИЧЕСКАЯ

