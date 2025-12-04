#!/bin/bash
# Автоматическая установка Docker на Ubuntu для VSS OMNI TELECOM

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  VSS OMNI TELECOM - Установка Docker на Ubuntu           ║"
echo "╚═══════════════════════════════════════════════════════════╝"

# Проверка прав root
if [ "$EUID" -eq 0 ]; then 
    echo "❌ Не запускайте этот скрипт с sudo!"
    echo "Запустите: ./install-docker-on-ubuntu.sh"
    exit 1
fi

echo ""
echo "[1/7] Обновление системы..."
sudo apt update
sudo apt upgrade -y

echo ""
echo "[2/7] Удаление старых версий Docker..."
sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

echo ""
echo "[3/7] Установка зависимостей..."
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    net-tools \
    htop \
    git

echo ""
echo "[4/7] Добавление официального GPG ключа Docker..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo ""
echo "[5/7] Добавление репозитория Docker..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

echo ""
echo "[6/7] Установка Docker..."
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo ""
echo "[7/7] Настройка прав доступа..."
sudo usermod -aG docker $USER

echo ""
echo "✅ Docker успешно установлен!"
echo ""
echo "📋 Версии:"
docker --version
docker compose version

echo ""
echo "⚠️  ВАЖНО: Выполните следующие команды для применения изменений:"
echo "   newgrp docker"
echo "   или"
echo "   exit  # и войдите снова через SSH"

echo ""
echo "🚀 После перезахода выполните:"
echo "   docker ps  # Проверка работы Docker"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Установка Docker завершена!                             ║"
echo "╚═══════════════════════════════════════════════════════════╝"


