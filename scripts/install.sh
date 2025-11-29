#!/bin/bash

set -e

echo "=========================================="
echo "VSS OMNI TELECOM - Installation Script"
echo "=========================================="

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

echo -e "${GREEN}[VSS] Installing platform dependencies...${NC}"

# Обновление пакетов
echo -e "${YELLOW}[VSS] Updating package lists...${NC}"
apt-get update

# Установка базовых зависимостей
echo -e "${YELLOW}[VSS] Installing base dependencies...${NC}"
apt-get install -y \
    python3 \
    python3-pip \
    npm \
    git \
    adb \
    curl \
    wget \
    redis-tools \
    postgresql-client \
    docker.io \
    docker-compose \
    build-essential \
    libcairo2-dev \
    libjpeg-dev \
    libpng-dev \
    libtool-bin \
    libossp-uuid-dev \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libswscale-dev \
    freerdp2-dev \
    libpango1.0-dev \
    libssh2-1-dev \
    libtelnet-dev \
    libvncserver-dev \
    libpulse-dev \
    libssl-dev \
    libvorbis-dev \
    libwebp-dev

# Установка Node.js (если не установлен)
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[VSS] Installing Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Установка Python зависимостей для MF-HUB (если есть)
if [ -f "services/mf-hub/requirements.txt" ]; then
    echo -e "${YELLOW}[VSS] Installing Python dependencies for MF-HUB...${NC}"
    python3 -m pip install --upgrade pip
    pip3 install -r services/mf-hub/requirements.txt || echo -e "${YELLOW}Warning: MF-HUB requirements not found${NC}"
fi

# Установка Node.js модулей для всех сервисов
echo -e "${YELLOW}[VSS] Installing Node.js dependencies...${NC}"

# OTTB Core
if [ -d "services/ottb" ]; then
    echo -e "${GREEN}[VSS] Installing OTTB dependencies...${NC}"
    cd services/ottb && npm install && cd ../..
fi

# DCI
if [ -d "services/dci" ]; then
    echo -e "${GREEN}[VSS] Installing DCI dependencies...${NC}"
    cd services/dci && npm install && cd ../..
fi

# POINT
if [ -d "services/point" ]; then
    echo -e "${GREEN}[VSS] Installing POINT dependencies...${NC}"
    cd services/point && npm install && cd ../..
fi

# WORKSPACE
if [ -d "services/workspace" ]; then
    echo -e "${GREEN}[VSS] Installing WORKSPACE dependencies...${NC}"
    cd services/workspace && npm install && cd ../..
fi

# Установка зависимостей для главного приложения
if [ -f "package.json" ]; then
    echo -e "${GREEN}[VSS] Installing main application dependencies...${NC}"
    npm install
fi

# Установка зависимостей для admin-backend
if [ -d "admin-backend" ]; then
    echo -e "${GREEN}[VSS] Installing admin-backend dependencies...${NC}"
    cd admin-backend && npm install && cd ..
fi

# Создание необходимых директорий
echo -e "${YELLOW}[VSS] Creating required directories...${NC}"
mkdir -p /var/lib/vss/{data,logs,config}
mkdir -p /var/lib/vss/data/{postgres,redis,guacamole}
mkdir -p /var/lib/vss/logs/{ottb,dci,point,workspace}

# Установка прав доступа
chown -R $SUDO_USER:$SUDO_USER /var/lib/vss 2>/dev/null || true

echo -e "${GREEN}[VSS] Installation complete!${NC}"
echo -e "${GREEN}[VSS] Next steps:${NC}"
echo -e "  1. Configure database: scripts/configure-db.sh"
echo -e "  2. Start services: scripts/startup.sh"
echo -e "  3. Check health: scripts/health.sh"

