#!/bin/bash

set -e

echo "=========================================="
echo "VSS OMNI TELECOM - Health Check"
echo "=========================================="

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Функция проверки HTTP endpoint
check_http() {
    local url=$1
    local name=$2
    local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "000")
    
    if [ "$status" -eq 200 ] || [ "$status" -eq 401 ] || [ "$status" -eq 403 ]; then
        echo -e "${GREEN}[OK]${NC} $name - HTTP $status"
        return 0
    else
        echo -e "${RED}[FAIL]${NC} $name - HTTP $status"
        return 1
    fi
}

# Функция проверки Docker контейнера
check_container() {
    local name=$1
    if docker ps --format '{{.Names}}' | grep -q "^${name}$"; then
        local status=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null)
        if [ "$status" = "running" ]; then
            echo -e "${GREEN}[OK]${NC} Container $name - Running"
            return 0
        else
            echo -e "${RED}[FAIL]${NC} Container $name - Status: $status"
            return 1
        fi
    else
        echo -e "${RED}[FAIL]${NC} Container $name - Not found"
        return 1
    fi
}

# Функция проверки PostgreSQL
check_postgres() {
    local container=$(docker ps -q -f name=vss-postgres)
    if [ -z "$container" ]; then
        echo -e "${RED}[FAIL]${NC} PostgreSQL - Container not found"
        return 1
    fi
    
    if docker exec "$container" pg_isready -U vss > /dev/null 2>&1; then
        echo -e "${GREEN}[OK]${NC} PostgreSQL - Ready"
        return 0
    else
        echo -e "${RED}[FAIL]${NC} PostgreSQL - Not ready"
        return 1
    fi
}

# Функция проверки Redis
check_redis() {
    local container=$(docker ps -q -f name=vss-redis)
    if [ -z "$container" ]; then
        echo -e "${RED}[FAIL]${NC} Redis - Container not found"
        return 1
    fi
    
    if docker exec "$container" redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}[OK]${NC} Redis - Ready"
        return 0
    else
        echo -e "${RED}[FAIL]${NC} Redis - Not ready"
        return 1
    fi
}

# Функция проверки RabbitMQ
check_rabbitmq() {
    local container=$(docker ps -q -f name=vss-rabbitmq)
    if [ -z "$container" ]; then
        echo -e "${RED}[FAIL]${NC} RabbitMQ - Container not found"
        return 1
    fi
    
    if docker exec "$container" rabbitmq-diagnostics ping > /dev/null 2>&1; then
        echo -e "${GREEN}[OK]${NC} RabbitMQ - Ready"
        return 0
    else
        echo -e "${RED}[FAIL]${NC} RabbitMQ - Not ready"
        return 1
    fi
}

echo -e "${YELLOW}[VSS] Running health checks...${NC}"
echo ""

FAILED=0

# Проверка контейнеров
echo -e "${YELLOW}Checking containers...${NC}"
check_container "vss-postgres" || FAILED=$((FAILED + 1))
check_container "vss-redis" || FAILED=$((FAILED + 1))
check_container "vss-rabbitmq" || FAILED=$((FAILED + 1))
check_container "vss-ottb" || FAILED=$((FAILED + 1))
check_container "vss-dci" || FAILED=$((FAILED + 1))
check_container "vss-point" || FAILED=$((FAILED + 1))
check_container "vss-workspace" || FAILED=$((FAILED + 1))
check_container "vss-guacamole" || FAILED=$((FAILED + 1))
echo ""

# Проверка баз данных
echo -e "${YELLOW}Checking databases...${NC}"
check_postgres || FAILED=$((FAILED + 1))
check_redis || FAILED=$((FAILED + 1))
check_rabbitmq || FAILED=$((FAILED + 1))
echo ""

# Проверка HTTP endpoints
echo -e "${YELLOW}Checking HTTP endpoints...${NC}"
check_http "http://localhost:3000/health" "WORKSPACE" || FAILED=$((FAILED + 1))
check_http "http://localhost:8083/health" "OTTB" || FAILED=$((FAILED + 1))
check_http "http://localhost:8082/health" "DCI" || FAILED=$((FAILED + 1))
check_http "http://localhost:8081/health" "POINT" || FAILED=$((FAILED + 1))
check_http "http://localhost:8080/guacamole" "Guacamole" || FAILED=$((FAILED + 1))
check_http "http://localhost:15672" "RabbitMQ Management" || FAILED=$((FAILED + 1))
echo ""

# Итоговый результат
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}[VSS] All services are healthy!${NC}"
    exit 0
else
    echo -e "${RED}[VSS] Health check failed: $FAILED service(s) are not healthy${NC}"
    exit 1
fi

