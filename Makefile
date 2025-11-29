.PHONY: help build deploy test clean backup migrate monitor

help: ## Показать справку
	@echo "VSS DEMIURGE - Production Management"
	@echo ""
	@echo "Доступные команды:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Собрать Docker образы
	docker-compose -f docker-compose.production.yml build

deploy: ## Развернуть систему
	./scripts/deploy.sh production

deploy-staging: ## Развернуть в staging
	./scripts/deploy.sh staging

test: ## Запустить тесты
	npm test

clean: ## Очистить неиспользуемые ресурсы
	docker system prune -f
	docker volume prune -f

backup: ## Создать резервную копию
	docker exec vss_postgres pg_dump -U vss vss_db > backup_$$(date +%Y%m%d_%H%M%S).sql

migrate: ## Выполнить миграции БД
	./scripts/migrate.sh

monitor: ## Запустить мониторинг
	python3 scripts/monitor.py

logs: ## Показать логи всех сервисов
	docker-compose -f docker-compose.production.yml logs -f

logs-api: ## Показать логи API
	docker-compose -f docker-compose.production.yml logs -f api

restart: ## Перезапустить все сервисы
	docker-compose -f docker-compose.production.yml restart

status: ## Показать статус сервисов
	docker-compose -f docker-compose.production.yml ps

health: ## Проверить здоровье системы
	curl -f http://localhost/health || echo "Health check failed"

install: ## Установить зависимости
	npm install

update: ## Обновить систему
	docker-compose -f docker-compose.production.yml pull
	docker-compose -f docker-compose.production.yml up -d

