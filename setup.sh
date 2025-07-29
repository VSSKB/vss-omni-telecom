#!/bin/bash
set -e

echo "Running setup script..."

# Проверка доступности PostgreSQL (если используется)
# Если ваше приложение использует PostgreSQL, раскомментируйте и настройте
# until pg_isready -h pg_database -p 5432 -U ${POSTGRES_USER}; do
#   echo "Waiting for PostgreSQL to be ready..."
#   sleep 2
# done
# echo "PostgreSQL is ready."

# Проверка доступности Redis
until redis-cli -h redis ping; do
  echo "Waiting for Redis to be ready..."
  sleep 2
done
echo "Redis is ready."

echo "Setup script finished."
