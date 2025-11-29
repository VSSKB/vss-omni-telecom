#!/bin/bash

set -e

echo "=========================================="
echo "VSS OMNI TELECOM - Startup Script"
echo "=========================================="

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}[VSS] Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Проверка Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}[VSS] Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Определение команды docker-compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

echo -e "${GREEN}[VSS] Starting all VSS modules...${NC}"

# Проверка наличия docker-compose файла
if [ -f "docker-compose.vss-demiurge.yml" ]; then
    COMPOSE_FILE="docker-compose.vss-demiurge.yml"
elif [ -f "docker-compose.yml" ]; then
    COMPOSE_FILE="docker-compose.yml"
else
    echo -e "${RED}[VSS] Docker Compose file not found!${NC}"
    exit 1
fi

# Запуск через Docker Compose
echo -e "${BLUE}[VSS] Starting services with Docker Compose...${NC}"
$COMPOSE_CMD -f "$COMPOSE_FILE" up -d

# Ожидание запуска сервисов
echo -e "${YELLOW}[VSS] Waiting for services to be ready...${NC}"
sleep 10

# Проверка статуса контейнеров
echo -e "${BLUE}[VSS] Checking container status...${NC}"
$COMPOSE_CMD -f "$COMPOSE_FILE" ps

# Ожидание готовности PostgreSQL
echo -e "${YELLOW}[VSS] Waiting for PostgreSQL to be ready...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker exec $(docker ps -q -f name=postgres) pg_isready -U vss > /dev/null 2>&1; then
        echo -e "${GREEN}[VSS] PostgreSQL is ready!${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -e "${YELLOW}[VSS] Waiting for PostgreSQL... ($RETRY_COUNT/$MAX_RETRIES)${NC}"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}[VSS] PostgreSQL failed to start within timeout${NC}"
    exit 1
fi

# Ожидание готовности Redis
echo -e "${YELLOW}[VSS] Waiting for Redis to be ready...${NC}"
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker exec $(docker ps -q -f name=redis) redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}[VSS] Redis is ready!${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -e "${YELLOW}[VSS] Waiting for Redis... ($RETRY_COUNT/$MAX_RETRIES)${NC}"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}[VSS] Redis failed to start within timeout${NC}"
    exit 1
fi

# Инициализация базы данных (если нужно)
if [ -f "database/init/01-init-schema.sql" ]; then
    echo -e "${BLUE}[VSS] Database schema will be initialized automatically on first start${NC}"
fi

# Запуск health-check
echo -e "${BLUE}[VSS] Running health checks...${NC}"
if [ -f "scripts/health.sh" ]; then
    bash scripts/health.sh
else
    echo -e "${YELLOW}[VSS] Health check script not found, skipping...${NC}"
fi

echo -e "${GREEN}[VSS] Startup complete!${NC}"
echo -e "${GREEN}[VSS] Services are running.${NC}"
echo -e "${BLUE}[VSS] Access points:${NC}"
echo -e "  - WORKSPACE: http://localhost:3000"
echo -e "  - OTTB API: http://localhost:8083"
echo -e "  - DCI API: http://localhost:8082"
echo -e "  - POINT API: http://localhost:8081"
echo -e "  - Guacamole: http://localhost:8080/guacamole"
echo -e "  - RabbitMQ Management: http://localhost:15672"

