# 🔗 Быстрые ссылки - Портал документации VSS

## 🌐 Веб-интерфейс

### Главная страница портала:
**http://localhost:3100**

### API поиска:
- http://localhost:3100/api/search?q=architecture
- http://localhost:3100/api/search?q=deployment
- http://localhost:3100/api/search?q=api

### Прямые ссылки на документы:
- http://localhost:3100/doc/README.md
- http://localhost:3100/doc/DEEP-ANALYSIS-REPORT.md
- http://localhost:3100/doc/ARCHITECTURE-AUDIT-AND-REDUNDANCY-REPORT.md
- http://localhost:3100/doc/VSS-ARCHITECTURE-EXPLAINED.md
- http://localhost:3100/doc/API-DOCUMENTATION.md
- http://localhost:3100/doc/DEPLOYMENT-GUIDE.md

---

## 📂 Локальные файлы

### 🌟 Начать здесь:
- [START-HERE-DOCS-PORTAL.md](START-HERE-DOCS-PORTAL.md)

### 📚 Основная документация:
- [DOCS-PORTAL-INFO.md](DOCS-PORTAL-INFO.md) - Полное описание
- [QUICK-START-DOCS-PORTAL.md](QUICK-START-DOCS-PORTAL.md) - Быстрый старт
- [DOCS-PORTAL-CREATION-REPORT.md](DOCS-PORTAL-CREATION-REPORT.md) - Отчёт
- [PORTAL-FILES-SUMMARY.md](PORTAL-FILES-SUMMARY.md) - Сводка файлов

### 🛠️ Технические файлы:
- [docs-portal/README.md](docs-portal/README.md) - Техническая документация
- [docs-portal/server.js](docs-portal/server.js) - Исходный код
- [docs-portal/package.json](docs-portal/package.json) - Зависимости
- [docs-portal/Dockerfile](docs-portal/Dockerfile) - Docker образ

### 🔧 Скрипты:
- [start-docs-portal.ps1](start-docs-portal.ps1) - Интерактивный запуск

---

## 🚀 Быстрые команды

### Запуск:
```powershell
# Интерактивно
.\start-docs-portal.ps1

# Docker
docker-compose -f docker-compose.vss-demiurge-simple.yml up -d vss-docs

# Локально
cd docs-portal && npm start
```

### Проверка:
```powershell
# HTTP
Invoke-WebRequest http://localhost:3100

# Статус Docker
docker ps | Select-String "vss-docs"

# Логи
docker logs vss-docs-portal -f
```

### Остановка:
```powershell
# Docker
docker-compose -f docker-compose.vss-demiurge-simple.yml stop vss-docs

# Локально
Ctrl+C
```

---

## 📊 Категории документов

Портал автоматически группирует документы по категориям:

### 🏠 Главная
- README.md
- DOCUMENTATION-SUMMARY.md
- VSS-DOCUMENTATION-INDEX.md

### 🏗️ Архитектура
- ARCHITECTURE-AUDIT-AND-REDUNDANCY-REPORT.md
- VSS-ARCHITECTURE-EXPLAINED.md
- VSS-TECH-STACK.md
- VSS-INFRASTRUCTURE-TOUR.md
- docs/ARCHITECTURE.md

### 🚀 Развертывание
- DEPLOYMENT-GUIDE.md
- QUICKSTART.md
- QUICK-START-POWERSHELL.md
- LOCAL-SETUP.md
- START-VSS.md
- VSS-STARTUP-GUIDE.md

### ⚡ API
- API-DOCUMENTATION.md
- docs/API-REFERENCE.md

### 📊 Отчеты
- DEEP-ANALYSIS-REPORT.md
- PROJECT-REPORT-2-DAYS.md
- VSS-TESTING-REPORT.md
- AUDIT-REPORT.md
- VSS-STATUS-REPORT.md
- И другие...

### 🔧 Исправления
- FIX-PROJECT-START.md
- FIX-DOCKER-IMAGES.md
- POSTGRES-FIX-SUMMARY.md
- RABBITMQ-FIX-SUMMARY.md
- REDIS-SECURITY-FIX-SUMMARY.md
- И другие...

### 📖 Руководства
- VSS-MANUAL.md
- ADMIN-LOGIN-README.md
- QUICK-COMMANDS.md
- QUICK-REFERENCE.md
- И другие...

### 📁 Прочее
- Все остальные документы

---

## 🎯 Поиск примеры

Попробуйте эти запросы в портале:

- **"architecture"** - найдёт все документы по архитектуре
- **"deployment"** - документы по развертыванию
- **"api"** - API документация
- **"docker"** - всё про Docker
- **"postgres"** - документы о PostgreSQL
- **"rabbitmq"** - документы о RabbitMQ
- **"fix"** - все исправления
- **"security"** - документы по безопасности
- **"guide"** - руководства

---

## 📱 Быстрый доступ

### Сохраните в закладки:
1. 🌐 **http://localhost:3100** - Портал документации
2. 🔍 **http://localhost:3100/api/search?q=** - API поиска

### Откройте в браузере:
```powershell
Start-Process "http://localhost:3100"
```

### Поделитесь с командой:
> Портал документации VSS OMNI TELECOM доступен по адресу:
> **http://localhost:3100** (или IP сервера:3100)

---

## ℹ️ Справка

### Порт занят?
Измените порт в `docker-compose.vss-demiurge-simple.yml`:
```yaml
ports:
  - "3101:3100"  # Измените 3101 на свободный порт
```

### Нужна помощь?
1. Читайте [QUICK-START-DOCS-PORTAL.md](QUICK-START-DOCS-PORTAL.md)
2. Смотрите логи: `docker logs vss-docs-portal`
3. Проверьте статус: `docker ps | Select-String "vss-docs"`

---

## 📈 Статистика

- 📚 Документов: **72+**
- 📂 Категорий: **8**
- 🌐 Порт: **3100**
- ⚡ API Endpoints: **3**
- 🔍 Поиск: **Полнотекстовый**
- 🎨 Интерфейс: **Современный**
- 🐳 Docker: **Интегрирован**
- ✅ Статус: **Production Ready**

---

## 🎉 Готово!

Откройте портал прямо сейчас:

# http://localhost:3100

---

**Создано:** 3 декабря 2025  
**Версия:** 1.0.0

© 2025 VSS Technologies

